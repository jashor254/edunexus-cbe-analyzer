import { repos } from '@/lib/repositories'
import { generateLessonPlan } from './generator'
import { publishEvent } from '@/lib/events'
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
    return { generated: 0, reason: 'break_week', nextTeachingWeek: nextWeek + 1 }
  }

  const results = await Promise.all(
    sowLessons.map(async lesson => {
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
      }
      const plan = await generateLessonPlan(ctx)
      return { plan, lesson }
    })
  )

  await savePlans(results, sowId, teacherId, nextWeek, sow)

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
      count:       results.length,
    },
    idempotency_key: `teacher.lesson_plan.generated:${sowId}:week:${nextWeek}`,
  }).catch(err => console.error('[events] teacher.lesson_plan.generated:', err instanceof Error ? err.message : String(err)))

  return {
    generated: results.length,
    week: nextWeek,
    subject: sow.learning_area,
  }
}

export async function generateSpecificWeekPlans(
  sowId: string,
  teacherId: string,
  weekNumber: number
): Promise<WeeklyGenerationResult> {
  const sow = await repos.curriculum.findSOWWithTimeline(sowId) as unknown as SavedSOW

  const weekSlots = (sow.timeline || []).filter(s => s.week === weekNumber && !s.isBreak)
  const sowLessons = matchSlotsToLessons(weekSlots, sow.lessons || [])

  if (sowLessons.length === 0) {
    return { generated: 0, reason: 'break_week' }
  }

  const results = await Promise.all(
    sowLessons.map(async lesson => {
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
      }
      const plan = await generateLessonPlan(ctx)
      return { plan, lesson }
    })
  )

  await savePlans(results, sowId, teacherId, weekNumber, sow)

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
      count:       results.length,
    },
    idempotency_key: `teacher.lesson_plan.generated:${sowId}:week:${weekNumber}`,
  }).catch(err => console.error('[events] teacher.lesson_plan.generated:', err instanceof Error ? err.message : String(err)))

  return {
    generated: results.length,
    week: weekNumber,
    subject: sow.learning_area,
  }
}
