import { createServiceClient } from '@/utils/supabase/service'
import { callGemini } from '@/lib/ai/gemini'
import { logAICall } from '@/lib/ai/logger'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import type {
  EvaluatedPlan,
  FollowUp,
  ReflectionSource,
  SubstrandHealthRow,
  WeeklyIntelligenceData,
} from './types'

// ─── Staleness ────────────────────────────────────────────────────────────────
// Compare taught_date vs updated_at (when followUp was saved).
// A large gap = "CSO panic batch" — teacher evaluated many lessons at once
// days/weeks after teaching. Confidence is reduced to prevent those from
// distorting the weekly health overview.

function stalenessMultiplier(taughtDate: string | null, updatedAt: string | null): number {
  if (!taughtDate || !updatedAt) return 0.7 // unknown = moderate penalty
  const gapMs = new Date(updatedAt).getTime() - new Date(taughtDate).getTime()
  const gapDays = gapMs / (1000 * 60 * 60 * 24)
  if (gapDays <= 3)  return 1.0
  if (gapDays <= 7)  return 0.8
  if (gapDays <= 14) return 0.6
  return 0.4 // week+ gap — very low weight in aggregate
}

// ─── Lesson health score (0–100) ─────────────────────────────────────────────
// followUp is teacher-confirmed ground truth (weight 0.55).
// reflectionSource captures authenticity (weight 0.20).
// noStruggleFlag from substrand_health (weight 0.25).
// All multiplied by staleness before contributing to weekly aggregate.

function lessonHealthScore(
  followUp: FollowUp,
  reflectionSource: ReflectionSource | null,
  hasStruggle: boolean,
  staleness: number
): number {
  const followUpScore = followUp === 'none' ? 1.0 : followUp === 'minor' ? 0.5 : 0.0
  const sourceScore =
    reflectionSource === 'manual' ? 1.0
    : reflectionSource === 'edited_suggestion' ? 0.7
    : reflectionSource === 'ai_suggestion' ? 0.3
    : 0.5

  const raw = (followUpScore * 0.55) + (sourceScore * 0.20) + ((hasStruggle ? 0 : 1) * 0.25)
  return Math.round(raw * staleness * 100)
}

// ─── Teacher note (Prompt C) ──────────────────────────────────────────────────
// Inputs: structured data only — no raw reflection text re-analysis.
// Output: 2–3 sentences the teacher sees in their ROW.

async function generateTeacherNote(
  data: {
    learningArea: string
    grade: string
    weekNumber: number
    healthScore: number
    lessonsAnalyzed: number
    newFlags: SubstrandHealthRow[]
    persistentFlags: SubstrandHealthRow[]
    resolvedFlags: SubstrandHealthRow[]
  }
): Promise<string> {
  const newFlagList = data.newFlags.map(f => f.sub_strand).join(', ') || 'none'
  const persistentList = data.persistentFlags.map(f => f.sub_strand).join(', ') || 'none'
  const resolvedList = data.resolvedFlags.map(f => f.sub_strand).join(', ') || 'none'

  const prompt = `You are a supportive teaching coach writing a brief weekly note for a Kenyan CBC teacher.

Subject: ${data.learningArea} | Grade: ${data.grade} | Week ${data.weekNumber}
Health score: ${data.healthScore}/100 (based on ${data.lessonsAnalyzed} evaluated lessons)
New follow-up flags this week: ${newFlagList}
Ongoing concerns: ${persistentList}
Resolved this week: ${resolvedList}

Write 2–3 concise, encouraging sentences summarising this week's teaching intelligence.
- Mention the health score naturally (e.g. "solid week" for >70, "mixed week" for 50–70, "challenging week" for <50)
- If there are new flags, name the specific sub-strands
- If something was resolved, acknowledge it
- Tone: professional but warm, not robotic
- Do NOT use bullet points. Plain prose only.`

  const start = Date.now()
  let note = `Week ${data.weekNumber} teaching completed across ${data.lessonsAnalyzed} lesson${data.lessonsAnalyzed !== 1 ? 's' : ''}.`
  let success = true
  let errMsg: string | undefined

  try {
    note = (await callGemini(prompt)).trim()
  } catch (err) {
    success = false
    errMsg = err instanceof Error ? err.message : String(err)
  }

  await logAICall({
    feature: 'tie_weekly_note',
    model: GEMINI_PRIMARY,
    prompt: prompt.substring(0, 500),
    response: note.substring(0, 200),
    latencyMs: Date.now() - start,
    success,
    error: errMsg,
  })

  return note
}

// ─── Main export ─────────────────────────────────────────────────────────────

export type TIEWeekResult = {
  processed: boolean
  weekNumber: number
  lessonsAnalyzed: number
  skipped?: string
}

export async function runTIEForSOW(
  sowId: string,
  teacherId: string,
  context: { grade: string; learningArea: string },
  opts?: { overrideWeek?: number }
): Promise<TIEWeekResult> {
  const db = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Step 1: find evaluated plans ─────────────────────────────────────────
  // Normal mode: past 7 days (Friday cron cadence).
  // overrideWeek: process a specific week regardless of date — used by seed scripts
  // to backfill weekly_intelligence history without touching system clock.
  let planQuery = db
    .from('lesson_plans')
    .select('id, week_number, lesson_number, strand, sub_strand, taught_date, updated_at, teacher_flagged_followup, reflection_source, teacher_self_evaluation')
    .eq('sow_id', sowId)
    .not('teacher_flagged_followup', 'is', null)

  if (opts?.overrideWeek !== undefined) {
    planQuery = planQuery.eq('week_number', opts.overrideWeek) as typeof planQuery
  } else {
    planQuery = planQuery.gte('updated_at', sevenDaysAgo) as typeof planQuery
  }

  planQuery = planQuery.order('week_number').order('lesson_number') as typeof planQuery

  const { data: rawPlans } = await planQuery

  const plans = (rawPlans ?? []) as EvaluatedPlan[]

  if (!plans.length) {
    return { processed: false, weekNumber: 0, lessonsAnalyzed: 0, skipped: 'no_evaluated_plans' }
  }

  // Process the most recent week that has evaluated plans
  const weekNumbers = [...new Set(plans.map(p => p.week_number))].sort((a, b) => b - a)
  const weekNumber = weekNumbers[0]
  const weekPlans = plans.filter(p => p.week_number === weekNumber)

  // ── Step 2: load substrand_health for this SOW ───────────────────────────
  const { data: healthRows } = await db
    .from('substrand_health')
    .select('id, sow_id, teacher_id, strand, sub_strand, struggle_count, lessons_covered, assessment_level, remediated, root_cause, risk_score, last_flagged, resolved_at')
    .eq('sow_id', sowId)

  const health = (healthRows ?? []) as SubstrandHealthRow[]
  const healthBySubStrand = new Map(health.map(h => [h.sub_strand, h]))

  // ── Step 3: compute per-lesson health, apply staleness ───────────────────
  const scores: number[] = []

  for (const plan of weekPlans) {
    if (!plan.teacher_flagged_followup) continue
    const hRow = healthBySubStrand.get(plan.sub_strand)
    const hasStruggle = (hRow?.struggle_count ?? 0) > 0
    const staleness = stalenessMultiplier(plan.taught_date, plan.updated_at)
    scores.push(lessonHealthScore(
      plan.teacher_flagged_followup,
      plan.reflection_source,
      hasStruggle,
      staleness
    ))
  }

  const weekHealthScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  // ── Step 4: classify substrand_health flags ───────────────────────────────
  const newFlags: SubstrandHealthRow[] = []
  const persistentFlags: SubstrandHealthRow[] = []
  const resolvedFlags: SubstrandHealthRow[] = []

  for (const h of health) {
    if (h.struggle_count === 0) continue
    if (h.resolved_at && h.resolved_at >= sevenDaysAgo) {
      resolvedFlags.push(h)
    } else if (h.last_flagged && h.last_flagged >= sevenDaysAgo) {
      newFlags.push(h)
    } else if (!h.resolved_at) {
      persistentFlags.push(h)
    }
  }

  // Remedial bank = union of new + persistent, sorted by struggle_count desc
  const remedialBankItems = [...newFlags, ...persistentFlags]
    .sort((a, b) => b.struggle_count - a.struggle_count)

  // ── Step 5: generate teacher note ────────────────────────────────────────
  const teacherNote = await generateTeacherNote({
    learningArea: context.learningArea,
    grade: context.grade,
    weekNumber,
    healthScore: weekHealthScore,
    lessonsAnalyzed: weekPlans.length,
    newFlags,
    persistentFlags,
    resolvedFlags,
  })

  // ── Step 6: upsert weekly_intelligence ───────────────────────────────────
  const payload: WeeklyIntelligenceData = {
    sow_id: sowId,
    teacher_id: teacherId,
    week_number: weekNumber,
    week_health_score: weekHealthScore,
    lessons_analyzed: weekPlans.length,
    new_flags: newFlags,
    persistent_flags: persistentFlags,
    resolved_flags: resolvedFlags,
    remedial_bank_items: remedialBankItems,
    teacher_note: teacherNote,
  }

  await db
    .from('weekly_intelligence')
    .upsert(payload, { onConflict: 'sow_id,week_number' })

  // ── Step 7: populate ROW entries reflection field ─────────────────────────
  // Each taught lesson gets its own teacher_self_evaluation as reflection.
  // Lessons without an evaluation get the week-level teacher_note as fallback.
  const rowEntryUpdates = weekPlans.map(plan => ({
    sub_strand: plan.sub_strand,
    reflection: plan.teacher_self_evaluation ?? teacherNote,
  }))

  // row_entries are matched by their week + lesson via the records_of_work join.
  // We bulk-update each row_entry that belongs to this SOW's ROW for this week.
  if (rowEntryUpdates.length > 0) {
    const { data: rowRecord } = await db
      .from('records_of_work')
      .select('id')
      .eq('scheme_id', sowId)
      .maybeSingle()

    if (rowRecord) {
      // Update reflection on each matching row_entry
      for (const plan of weekPlans) {
        await db
          .from('row_entries')
          .update({ reflection: plan.teacher_self_evaluation ?? teacherNote })
          .eq('row_id', rowRecord.id)
          .eq('week', weekNumber)
          .eq('substrand', plan.sub_strand)
      }
    }
  }

  return {
    processed: true,
    weekNumber,
    lessonsAnalyzed: weekPlans.length,
  }
}
