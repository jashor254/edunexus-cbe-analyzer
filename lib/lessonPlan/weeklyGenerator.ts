import { repos } from '@/lib/repositories'
import { generateLessonPlan } from './generator'
import { publishEvent } from '@/lib/events'
import type { AICostContext } from '@/lib/ai/deepseek'
import type { LessonPlanContext, WeeklyGenerationResult } from './types'
import type { GeneratedLesson } from '@/lib/sow/types'
import type { TimelineSlot } from '@/lib/sow/types'

interface SavedSOW {
  id: string
  teacher_id: string
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  teacher_name: string | null
  tsc_number: string | null
  lessons: GeneratedLesson[]
  timeline: TimelineSlot[]
  breaks: Array<{ startWeek: number; endWeek: number; title: string }>
}

function getNextTeachingWeek(timeline: TimelineSlot[], fromWeek: number): number {
  for (let w = fromWeek + 1; w <= 20; w++) {
    const slots = timeline.filter(s => s.week === w)
    if (slots.length > 0 && slots.some(s => !s.isBreak)) return w
  }
  return fromWeek + 1
}

function matchSlotsToLessons(
  slots: TimelineSlot[],
  generatedLessons: GeneratedLesson[]
): GeneratedLesson[] {
  return slots
    .map(slot => generatedLessons.find(l => l.week === slot.week && l.lesson === slot.lesson))
    .filter((l): l is GeneratedLesson => l !== undefined)
}

async function savePlans(
  plans: Array<{ plan: Awaited<ReturnType<typeof generateLessonPlan>>; lesson: GeneratedLesson }>,
  sowId: string,
  teacherId: string,
  weekNumber: number,
  sow: SavedSOW
): Promise<void> {
  const rows = plans.map(({ plan, lesson }) => ({
    sow_id: sowId,
    teacher_id: teacherId,
    week_number: weekNumber,
    lesson_number: lesson.lesson,
    strand: lesson.strand,
    sub_strand: lesson.substrand,
    // Curriculum Identity Preservation Contract (H5A-3, CUR-LP-001) — a
    // snapshot of the originating GeneratedLesson's canonical identity, or
    // null. Never re-derived from strand/sub_strand text.
    sub_strand_id: lesson.substrandId,
    learning_outcomes: lesson.learningOutcomes,
    key_inquiry_questions: lesson.keyInquiryQuestions,
    learning_resources: lesson.learningResources,
    organisation_of_learning: plan.organisationOfLearning,
    introduction: plan.introduction,
    step_1: plan.step1,
    step_2: plan.step2,
    step_3: plan.step3,
    conclusion: plan.conclusion,
    extended_activities: plan.extendedActivities,
    reflection: plan.reflection,
    status: 'generated',
  }))

  await repos.curriculum.insertLessonPlans(rows)
}

/** Runs once, immediately before the first AI call of a week — never for a no-op week. */
export type BeforeWeekGeneration = () => Promise<void>

const UNIQUE_VIOLATION = /duplicate key value violates unique constraint/i

/**
 * Generates and saves plans for exactly the lessons in `sowLessons` that do
 * not already have a plan for this week, then reports partial failure
 * honestly. Shared by the Friday cron and the teacher-triggered routes.
 *
 *  - Lessons already planned are skipped BEFORE any AI call (a repeated
 *    request used to regenerate the whole week, then lose all of it to the
 *    lesson_plans (sow_id, week_number, lesson_number) unique constraint).
 *  - Each lesson is independent: one failure no longer discards the plans
 *    that succeeded (Promise.all rejected the whole week). Successes are
 *    saved; failures are returned in `failedLessons`.
 *  - If EVERY attempted lesson fails, this throws, as before — callers keep
 *    treating total failure as an error.
 */
async function generateMissingWeekPlans(
  sow: SavedSOW,
  sowLessons: GeneratedLesson[],
  teacherId: string,
  weekNumber: number,
  costContext: AICostContext | undefined,
  beforeGenerate: BeforeWeekGeneration | undefined,
): Promise<{ generated: number; reason?: 'already_generated'; failedLessons: Array<{ lessonNumber: number; error: string }> }> {
  const existing = await repos.curriculum.findLessonPlansByWeek(sow.id, weekNumber)
  const planned = new Set(existing.map(p => p.lesson_number))
  const missing = sowLessons.filter(l => !planned.has(l.lesson))

  if (missing.length === 0) {
    return { generated: 0, reason: 'already_generated', failedLessons: [] }
  }

  await beforeGenerate?.()

  const settled = await Promise.allSettled(
    missing.map(async lesson => {
      const ctx: LessonPlanContext = {
        teacherName: sow.teacher_name || '',
        tscNumber: sow.tsc_number || '',
        school: sow.school,
        learningArea: sow.learning_area,
        grade: sow.grade,
        term: Number(sow.term),
        year: sow.year,
        weekNumber: lesson.week,
        lessonNumber: lesson.lesson,
        strand: lesson.strand,
        subStrand: lesson.substrand,
        learningOutcomes: lesson.learningOutcomes,
        learningExperiences: lesson.learningExperiences ?? [],
        keyInquiryQuestions: lesson.keyInquiryQuestions,
        learningResources: lesson.learningResources,
        assessmentMethods: lesson.assessmentMethods,
        costContext,
      }
      const plan = await generateLessonPlan(ctx)
      return { plan, lesson }
    })
  )

  const succeeded: Array<{ plan: Awaited<ReturnType<typeof generateLessonPlan>>; lesson: GeneratedLesson }> = []
  const failedLessons: Array<{ lessonNumber: number; error: string }> = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') succeeded.push(r.value)
    else failedLessons.push({ lessonNumber: missing[i].lesson, error: r.reason instanceof Error ? r.reason.message : String(r.reason) })
  })

  if (succeeded.length === 0) {
    throw new Error(`Lesson plan generation failed for all ${missing.length} lesson(s): ${failedLessons[0]?.error ?? 'unknown error'}`)
  }

  try {
    await savePlans(succeeded, sow.id, teacherId, weekNumber, sow)
  } catch (err) {
    // A concurrent request for the same week saved first. Its plans stand;
    // this request's duplicates are dropped rather than reported as a failure.
    if (err instanceof Error && UNIQUE_VIOLATION.test(err.message)) {
      return { generated: 0, reason: 'already_generated', failedLessons: [] }
    }
    throw err
  }

  return { generated: succeeded.length, failedLessons }
}

export async function generateWeeklyPlans(
  sowId: string,
  teacherId: string,
  currentWeek: number
): Promise<WeeklyGenerationResult> {
  const nextWeek = currentWeek + 1
  const sow = await repos.curriculum.findSOWWithTimeline(sowId) as unknown as SavedSOW

  const nextWeekSlots = (sow.timeline || []).filter(s => s.week === nextWeek)

  if (nextWeekSlots.length === 0) {
    return { generated: 0, reason: 'break_week', nextTeachingWeek: nextWeek + 1 }
  }

  const isBreakWeek = nextWeekSlots.every(s => s.isBreak === true)
  if (isBreakWeek) {
    const nextTeachingWeek = getNextTeachingWeek(sow.timeline || [], nextWeek)
    return { generated: 0, reason: 'break_week', nextTeachingWeek }
  }

  const teachingSlots = nextWeekSlots.filter(s => !s.isBreak)
  const sowLessons = matchSlotsToLessons(teachingSlots, sow.lessons || [])

  if (sowLessons.length === 0) {
    // Teaching slots exist for this week but no lesson matched them. That is
    // structural corruption, not a holiday — the two were previously
    // reported identically, so a scheme saved without its lesson data looked
    // to the Friday cron exactly like a school break and was skipped
    // silently, every week, forever.
    return { generated: 0, reason: 'invalid_scheme_structure', nextTeachingWeek: nextWeek + 1 }
  }

  const outcome = await generateMissingWeekPlans(sow, sowLessons, teacherId, nextWeek, undefined, undefined)
  if (outcome.generated === 0) {
    return { generated: 0, week: nextWeek, subject: sow.learning_area, reason: outcome.reason }
  }

  void publishEvent({
    event_type:      'teacher.lesson_plan.generated',
    resource_type:   'lesson_plan',
    resource_id:     `${sowId}:week:${nextWeek}`,
    actor_id:        teacherId,
    payload: {
      sow_id:      sowId,
      subject:     sow.learning_area,
      grade:       sow.grade,
      week_number: nextWeek,
      count:       outcome.generated,
    },
    idempotency_key: `teacher.lesson_plan.generated:${sowId}:week:${nextWeek}`,
  }).catch(err => console.error('[events] teacher.lesson_plan.generated:', err instanceof Error ? err.message : String(err)))

  return {
    generated: outcome.generated,
    week: nextWeek,
    subject: sow.learning_area,
    ...(outcome.failedLessons.length > 0 ? { failed: outcome.failedLessons.length, failedLessons: outcome.failedLessons } : {}),
  }
}

export async function generateSpecificWeekPlans(
  sowId: string,
  teacherId: string,
  weekNumber: number,
  costContext?: AICostContext,
  options?: { beforeGenerate?: BeforeWeekGeneration },
): Promise<WeeklyGenerationResult> {
  const sow = await repos.curriculum.findSOWWithTimeline(sowId) as unknown as SavedSOW

  const weekSlots = (sow.timeline || []).filter(s => s.week === weekNumber && !s.isBreak)
  const sowLessons = matchSlotsToLessons(weekSlots, sow.lessons || [])

  if (sowLessons.length === 0) {
    // A requested week with no teaching slots at all is a break; a week with
    // slots but no matching lesson data is corruption. See generateWeeklyPlans.
    const isBreak = weekSlots.length === 0
    return { generated: 0, reason: isBreak ? 'break_week' : 'invalid_scheme_structure' }
  }

  const outcome = await generateMissingWeekPlans(sow, sowLessons, teacherId, weekNumber, costContext, options?.beforeGenerate)
  if (outcome.generated === 0) {
    return { generated: 0, week: weekNumber, subject: sow.learning_area, reason: outcome.reason }
  }

  void publishEvent({
    event_type:      'teacher.lesson_plan.generated',
    resource_type:   'lesson_plan',
    resource_id:     `${sowId}:week:${weekNumber}`,
    actor_id:        teacherId,
    payload: {
      sow_id:      sowId,
      subject:     sow.learning_area,
      grade:       sow.grade,
      week_number: weekNumber,
      count:       outcome.generated,
    },
    idempotency_key: `teacher.lesson_plan.generated:${sowId}:week:${weekNumber}`,
  }).catch(err => console.error('[events] teacher.lesson_plan.generated:', err instanceof Error ? err.message : String(err)))

  return {
    generated: outcome.generated,
    week: weekNumber,
    subject: sow.learning_area,
    ...(outcome.failedLessons.length > 0 ? { failed: outcome.failedLessons.length, failedLessons: outcome.failedLessons } : {}),
  }
}
