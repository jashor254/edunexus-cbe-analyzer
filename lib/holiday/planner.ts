// lib/holiday/planner.ts
// Generates a personalised holiday learning plan per student.
// Based on: Projection (academic gaps) + Career Intelligence + holiday duration.
// Light, focused, parent-friendly — not a worksheet mountain.
//
// Re-pointed to Projection per Adaptive Learning v2 Architecture §4
// (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN) — this
// moves Holiday Planner from Legacy to Projection in the Migration Ledger.
// Priority gaps are now subject-level, not substrand-level: the frozen
// Projection Engine's `knowledgeProjector` is subject-level only (a named,
// accepted Migration Ledger gap, per architecture §8 — not a bug in this
// change, and not something this module works around with a parallel
// substrand computation, per LI-1).

import { repos } from '@/lib/repositories'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { buildAdaptiveTask } from '@/lib/adaptiveLearning/recommend'
import { buildCareerIntelligence } from '@/lib/learnerIntelligence/careerIntelligence'
import type { HolidayPlanData, HolidayWeek } from './types'

type PlanInput = {
  studentId:     string
  teacherId:     string
  term:          number
  year:          number
  holidayPeriod: string   // "August Holiday 2026"
  holidayDays:   number   // typically 14–28
  schoolId?:     string
}

export async function generateHolidayPlan(input: PlanInput): Promise<HolidayPlanData> {
  // 1. Load student basic info + current Projection — the one source every
  // other Adaptive Learning channel reads (Recommendation Layer, §2 of the
  // architecture). `buildCareerIntelligence` is best-effort: a learner with
  // zero confirmed evidence yet still gets a plan, just without a career note.
  const [student, projection, careerIntel] = await Promise.all([
    repos.learnerIntelligence.getStudentHolidayData(input.studentId),
    recomputeLearnerProjection(input.studentId),
    buildCareerIntelligence(input.studentId).catch(() => null),
  ])

  const studentName = student?.name?.trim() || 'Student'
  const grade = (student?.grade as number) ?? 8

  // 2. Priority subjects, weakest first (subject-level — see module header).
  const subjectPerformance = projection.academic ? Object.values(projection.academic.value.bySubject) : []
  const priorityGaps = subjectPerformance
    .filter(s => s.latestLevel <= 2)
    .sort((a, b) => a.latestLevel - b.latestLevel)
    .map(s => s.subject)

  // 3. Career note — via the existing, already-Projection-sourced Career
  // Intelligence module (Migration Ledger: Projection), not a bespoke read
  // of career_signals.
  let careerNote: string | null = null
  if (careerIntel?.matches?.length) {
    const top = careerIntel.matches[0]
    careerNote = `${top.careerTitle} is a strong match for you. ${top.insight.action}`
  } else if (careerIntel?.families?.length) {
    const top = careerIntel.families[0]
    careerNote = `Explore ${top.categoryLabel}. ${top.insight.action}`
  }

  // 4. AdaptiveTasks for the top priority subjects, via the Recommendation
  // Layer — the same function Classroom Differentiation and the Printable
  // Pack read (one engine, per architecture §1). Each task's `.action` is
  // Insight-backed (observation/evidence/confidence/action), giving the
  // week's plain-language text a traceable, evidence-grounded source
  // instead of a template string built from a raw substrand key.
  const topTasks = priorityGaps
    .slice(0, 2)
    .map(subject => buildAdaptiveTask(input.studentId, studentName, subject, projection, { careerNote }))

  // 5. Build week structure
  const holidayWeeks = Math.ceil(input.holidayDays / 7)
  const weeks: HolidayWeek[] = []

  if (holidayWeeks === 0) {
    weeks.push({
      week: 1, label: 'Short Break', compass_topics: priorityGaps.slice(0, 1),
      parent_action: 'Have a brief conversation about what was learned this term.',
      student_task: priorityGaps[0] ? `Review ${priorityGaps[0]} briefly.` : 'Rest and reflect on the term.',
      is_rest_week: true,
    })
  } else {
    for (let w = 1; w <= holidayWeeks; w++) {
      const isLastWeek = w === holidayWeeks
      const isRestWeek = isLastWeek && holidayWeeks >= 3

      if (isRestWeek) {
        const careerSlug = careerIntel?.matches?.[0]?.careerSlug
        weeks.push({
          week: w, label: `Week ${w} — Rest & Explore`,
          compass_topics: careerSlug ? [careerSlug] : [],
          parent_action: 'Let your child rest. Congratulate them on the term.',
          student_task: `Optional: explore one career that interests you in the Career Explorer.`,
          is_rest_week: true,
        })
      } else if (w === 1) {
        const task = topTasks[0]
        const topic = task?.subject
        weeks.push({
          week: w, label: `Week ${w} — Consolidate`,
          compass_topics: topic ? [topic] : [],
          parent_action: topic
            ? `Ask ${studentName.split(' ')[0]} to explain ${topic} in their own words — even 5 minutes counts.`
            : 'Have a brief conversation about what was learned this term.',
          student_task: topic
            ? `Complete 2 Compass sessions on "${topic}". Take your time — no rush.`
            : 'Review your notes from this term. Identify one concept you want to understand better.',
          is_rest_week: false,
        })
      } else if (w === 2) {
        const task = topTasks[1] ?? topTasks[0]
        const topic = task?.subject
        weeks.push({
          week: w, label: `Week ${w} — Strengthen`,
          compass_topics: topic ? [topic] : [],
          parent_action: topic
            ? `This week, ask "${studentName.split(' ')[0]}, what is ${topic}?" Listen to the answer — it tells you a lot.`
            : 'Check in on how your child is feeling about the upcoming term.',
          student_task: topic
            ? `Complete 2 Compass sessions on "${topic}". Connect it to something real around you.`
            : 'Prepare one question to ask your teacher on the first day of Term 3.',
          is_rest_week: false,
        })
      } else {
        weeks.push({
          week: w, label: `Week ${w} — Explore`,
          compass_topics: [],
          parent_action: 'Encourage your child to read something they enjoy — any topic.',
          student_task: 'Explore the Career section — read about one career path that interests you.',
          is_rest_week: false,
        })
      }
    }
  }

  // 6. Build parent WhatsApp message
  const firstName = studentName.split(' ')[0]
  const topGap = priorityGaps[0]
  const compassCount = weeks.reduce((s, w) => s + w.compass_topics.length, 0)

  const whatsappMessage = buildWhatsAppMessage({
    firstName, grade, topGap, careerNote,
    weeks, compassCount, holidayPeriod: input.holidayPeriod,
  })

  const parentSummary = topGap
    ? `${firstName} had a strong term but has room to grow in ${topGap}. ${careerNote ? careerNote + ' ' : ''}The holiday plan is light and focused — ${compassCount} short Compass session${compassCount !== 1 ? 's' : ''} spread across the break.`
    : `${firstName} had a solid term. The holiday plan keeps momentum light — rest, explore, and stay curious.`

  const planData: HolidayPlanData = {
    student_name:    studentName,
    grade,
    holiday_period:  input.holidayPeriod,
    priority_gaps:   priorityGaps,
    career_note:     careerNote,
    weeks,
    whatsapp_message: whatsappMessage,
    parent_summary:  parentSummary,
  }

  // 7. Enrich with AI for a more personalised narrative
  const enriched = await enrichPlanWithAI(planData, null)
  if (enriched) {
    planData.whatsapp_message = enriched.whatsappMessage ?? planData.whatsapp_message
    planData.parent_summary   = enriched.parentSummary   ?? planData.parent_summary
  }

  // 8. Persist
  await repos.learnerIntelligence.upsertHolidayPlan({
    student_id:     input.studentId,
    teacher_id:     input.teacherId,
    school_id:      input.schoolId ?? null,
    term:           input.term,
    year:           input.year,
    holiday_period: input.holidayPeriod,
    holiday_days:   input.holidayDays,
    plan_data:      planData,
  })

  return planData
}

// ── Publish (teacher approval gate) ───────────────────────────────────────────
// A generated plan is a draft until a teacher explicitly approves it — nothing
// reaches a parent through the Learner Blueprint before that (see
// lib/learnerIntelligence/blueprint.ts). Bulk publish covers the whole class
// roster the plans were generated for.

export async function publishHolidayPlan(
  studentId: string,
  teacherId: string,
  term:      number,
  year:      number,
): Promise<number> {
  return repos.learnerIntelligence.publishHolidayPlans({ teacherId, term, year, studentIds: [studentId] })
}

export async function publishClassHolidayPlans(
  classId:   string,
  teacherId: string,
  term:      number,
  year:      number,
): Promise<number> {
  const studentIds = await repos.learnerIntelligence.getClassEnrollment(classId)
  return repos.learnerIntelligence.publishHolidayPlans({ teacherId, term, year, studentIds })
}

// ── Batch generate for a whole class ─────────────────────────────────────────

type BatchInput = Omit<PlanInput, 'studentId'>
type BatchResult = { studentId: string; studentName: string; plan: HolidayPlanData | null; error?: string }

export type HolidayBatchProgress = {
  phase:               'started' | 'done'
  total:               number
  completed:           number
  generated:           number
  failed:              number
  currentStudentName:  string
  failedStudents:      Array<{ studentId: string; studentName: string; reason: string }>
}

/**
 * Generate holiday plans for a class (or, when `studentIds` is passed, for
 * just that subset — used by "Retry Failed Only" so a partial failure never
 * requires regenerating the students that already succeeded).
 *
 * `onProgress` fires twice per student (started, then done) so a caller can
 * show live "Generating: <name>" text plus running generated/failed counts
 * instead of a single opaque wait — see app/api/holiday/generate/route.ts,
 * which persists each event onto a `jobs` row so the UI can poll it and
 * survive the teacher navigating away mid-generation.
 */
export async function generateClassHolidayPlans(
  classId:    string,
  input:      BatchInput,
  onProgress?: (event: HolidayBatchProgress) => void | Promise<void>,
  studentIds?: string[],
): Promise<BatchResult[]> {
  const enrollment = studentIds ?? await repos.learnerIntelligence.getClassEnrollment(classId)
  if (!enrollment.length) return []

  const names = await repos.learnerIntelligence.getStudentNamesByIds(enrollment)
  const nameById = new Map(names.map(n => [n.id, n.name?.trim() || n.id]))

  let completed = 0
  let generated = 0
  let failed = 0
  const failedStudents: Array<{ studentId: string; studentName: string; reason: string }> = []

  const emit = (phase: HolidayBatchProgress['phase'], currentStudentName: string) =>
    onProgress?.({ total: enrollment.length, completed, generated, failed, currentStudentName, failedStudents: [...failedStudents], phase })

  const results = await Promise.allSettled(
    enrollment.map(async (studentId) => {
      const studentName = nameById.get(studentId) ?? studentId
      await emit('started', studentName)
      try {
        const plan = await generateHolidayPlan({ studentId, ...input })
        completed++; generated++
        await emit('done', studentName)
        return { studentId, studentName, plan }
      } catch (err) {
        completed++; failed++
        const reason = err instanceof Error ? err.message : String(err)
        failedStudents.push({ studentId, studentName, reason })
        await emit('done', studentName)
        throw err
      }
    })
  )

  return results.map((r, i) => {
    const id = enrollment[i]
    if (r.status === 'fulfilled') return r.value as BatchResult
    const failedEntry = failedStudents.find(f => f.studentId === id)
    return { studentId: id, studentName: nameById.get(id) ?? id, plan: null, error: failedEntry?.reason ?? String((r as PromiseRejectedResult).reason) }
  })
}

// ── WhatsApp message builder ──────────────────────────────────────────────────

function buildWhatsAppMessage(p: {
  firstName:     string
  grade:         number
  topGap:        string | undefined
  careerNote:    string | null
  weeks:         HolidayWeek[]
  compassCount:  number
  holidayPeriod: string
}): string {
  const workWeeks = p.weeks.filter(w => !w.is_rest_week)
  const restWeeks = p.weeks.filter(w => w.is_rest_week)

  const weekLines = workWeeks.map(w =>
    `📅 ${w.label}\n${w.student_task}`
  ).join('\n\n')

  return `EduNexus — ${p.firstName}'s ${p.holidayPeriod} Plan 🎓

Good news: ${p.firstName} completed Term ${p.weeks.length > 0 ? '2' : '1'} and is ready for a break.
${p.topGap ? `\nOne focus this holiday: *${p.topGap}*` : ''}
${p.careerNote ? `\n🔭 ${p.careerNote}` : ''}

${weekLines}
${restWeeks.length ? `\n😌 ${restWeeks[0].label}: Rest. They earned it.` : ''}

${p.compassCount > 0 ? `✅ ${p.compassCount} short Compass session${p.compassCount !== 1 ? 's' : ''} — available on their phone anytime.\n` : ''}
See you in Term 3! 🇰🇪
— EduNexus`.trim()
}

// ── AI enrichment ─────────────────────────────────────────────────────────────

async function enrichPlanWithAI(
  plan:        HolidayPlanData,
  dreamCareer: string | null,
): Promise<{ whatsappMessage?: string; parentSummary?: string } | null> {
  try {
    const prompt = `You are writing a WhatsApp holiday plan for a Kenyan parent.

Student: ${plan.student_name}, Grade ${plan.grade}
Holiday: ${plan.holiday_period} (${plan.weeks.length} weeks)
Priority gaps: ${plan.priority_gaps.join(', ') || 'none — student is on track'}
${dreamCareer ? `Dream career: ${dreamCareer}` : ''}
${plan.career_note ? `Career context: ${plan.career_note}` : ''}

Write:
1. A WhatsApp message to the parent (max 220 words). Warm, specific, Kenyan context.
   Include: one good news sentence about the term, one focus for the holiday,
   a 2-3 week plan with simple parent actions, end with encouragement.
   Use emojis sparingly. Do NOT use markdown bold (*text*) or headers.

2. A 2-sentence parent summary for the app dashboard.

Format your response as:
WHATSAPP:
[message here]
SUMMARY:
[2 sentences here]`

    const text = await callDeepSeek(prompt, undefined, {
      maxTokens:   500,
      temperature: 0.7,
    })
    const waMatch = text.match(/WHATSAPP:\n([\s\S]+?)(?=SUMMARY:|$)/)
    const sumMatch = text.match(/SUMMARY:\n([\s\S]+?)$/)

    return {
      whatsappMessage: waMatch?.[1]?.trim(),
      parentSummary:   sumMatch?.[1]?.trim(),
    }
  } catch {
    return null
  }
}
