import { repos } from '@/lib/repositories'
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

// ─── Teacher note ─────────────────────────────────────────────────────────────
// Inputs: structured data only. Output: 2–3 sentences the teacher sees in
// their ROW.
//
// Deterministic. This was a Gemini call whose prompt already spelled out the
// whole rule — "solid week" above 70, "mixed week" 50–70, "challenging week"
// below 50, name new flags, acknowledge resolved ones — over inputs that are
// all structured data. The template applies that same rule exactly, every
// time, with no provider call (docs/audits/ai-call-efficiency-deep-audit.md
// AI-17). The wording deliberately avoids "gap", "failing" and "weak", like
// the quick-check prompt.

function listSubStrands(rows: SubstrandHealthRow[]): string {
  const names = [...new Set(rows.map(r => r.sub_strand))]
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function buildTeacherNote(data: {
  learningArea: string
  grade: string
  weekNumber: number
  healthScore: number
  lessonsAnalyzed: number
  newFlags: SubstrandHealthRow[]
  persistentFlags: SubstrandHealthRow[]
  resolvedFlags: SubstrandHealthRow[]
}): string {
  const lessons = `${data.lessonsAnalyzed} evaluated lesson${data.lessonsAnalyzed === 1 ? '' : 's'}`
  const tone = data.healthScore > 70 ? 'A solid week'
    : data.healthScore >= 50 ? 'A mixed week'
    : 'A challenging week'

  const sentences = [
    `${tone} in ${data.learningArea} (${data.grade}), week ${data.weekNumber} — a health score of ${data.healthScore}/100 across ${lessons}.`,
  ]

  if (data.newFlags.length > 0) {
    sentences.push(`Learners asked for more support with ${listSubStrands(data.newFlags)} this week, so a short revisit there is worthwhile.`)
  }
  if (data.persistentFlags.length > 0) {
    sentences.push(`${listSubStrands(data.persistentFlags)} still needs attention from earlier weeks.`)
  }
  if (data.newFlags.length === 0 && data.persistentFlags.length === 0) {
    sentences.push('No follow-ups are outstanding this week.')
  }

  if (data.resolvedFlags.length > 0) {
    sentences.push(`Well done resolving ${listSubStrands(data.resolvedFlags)}.`)
  }

  return sentences.join(' ')
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Step 1: find evaluated plans ─────────────────────────────────────────
  const plans = await repos.learnerIntelligence.getEvaluatedPlansForSOW(sowId, sevenDaysAgo, opts?.overrideWeek)

  if (!plans.length) {
    return { processed: false, weekNumber: 0, lessonsAnalyzed: 0, skipped: 'no_evaluated_plans' }
  }

  // Process the most recent week that has evaluated plans
  const weekNumbers = [...new Set(plans.map(p => p.week_number))].sort((a, b) => b - a)
  const weekNumber = weekNumbers[0]
  const weekPlans = plans.filter(p => p.week_number === weekNumber)

  // ── Step 2: load substrand_health for this SOW ───────────────────────────
  const health = await repos.learnerIntelligence.getSubstrandHealth(sowId)
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
  const teacherNote = buildTeacherNote({
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

  await repos.learnerIntelligence.upsertWeeklyIntelligence(payload)

  // ── Step 7: populate ROW entries reflection field ─────────────────────────
  if (weekPlans.length > 0) {
    const rowRecord = await repos.learnerIntelligence.getRowRecordForSOW(sowId)
    if (rowRecord) {
      for (const plan of weekPlans) {
        await repos.learnerIntelligence.updateRowEntryReflection(
          rowRecord.id,
          weekNumber,
          plan.sub_strand,
          plan.teacher_self_evaluation ?? teacherNote,
        )
      }
    }
  }

  return {
    processed: true,
    weekNumber,
    lessonsAnalyzed: weekPlans.length,
  }
}
