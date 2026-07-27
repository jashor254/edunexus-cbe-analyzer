import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { timedQuery } from '@/lib/observability/queryTiming'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import { createAssignment } from '@/lib/assignments/create'

const CreateAssignmentSchema = z.object({
  class_id:              z.string().uuid(),
  title:                 z.string().min(1),
  subject:               z.string().min(1),
  topic:                 z.string().min(1),
  // ADR-0024 Sprint A Objective 3 — the canonical curriculum reference the
  // KICD picker already resolves. Null in custom mode or where no
  // curriculum data exists for the grade/subject (free-text fallback) —
  // never fabricated, per ADR-0024's "no silent guessing" invariant.
  substrand_id:          z.string().uuid().nullable().optional(),
  instructions:          z.string().min(1),
  due_date:              z.string().min(1),
  type:                  z.string().optional(),
  max_score:             z.number().int().positive().optional(),
  is_quiz:               z.boolean().optional(),
  // Sprint 10 Slice A — Part 1/3. Adaptive assignments always go through
  // Draft -> Generate Variants -> Teacher Review -> Publish (created
  // 'draft', is_quiz forced true) rather than today's immediate 'active'.
  // Optional and defaulted false: every existing caller (the plain
  // Standard/Quiz toggle) is completely unaffected.
  is_adaptive:           z.boolean().optional(),
  is_compass_guided:     z.boolean().optional(),
  is_holiday_assignment: z.boolean().optional(),
  holiday_period:        z.string().optional(),
  lesson_plan_id:        z.string().uuid().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const db = createServiceClient()

    const { data: assignments, error } = await timedQuery('assignments', 'listByTeacher', async () => db
      .from('assignments')
      .select(`
        id, class_id, teacher_id, title, subject, topic, type, status,
        due_date, max_score, is_quiz, is_adaptive, is_compass_guided, is_holiday_assignment,
        holiday_period, lesson_plan_id, created_at, updated_at,
        teacher_classes(name, grade)
      `)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false }))

    if (error) return apiError('Failed to fetch assignments')
    if (!assignments?.length) return apiSuccess({ assignments: [] })

    // Batch fetch student counts and submission counts — 2 queries total instead of 2N
    const classIds      = [...new Set(assignments.map(a => a.class_id as string))]
    const assignmentIds = assignments.map(a => a.id as string)

    const [{ data: classStudentRows }, { data: submissionRows }] = await Promise.all([
      db.from('class_students').select('class_id').in('class_id', classIds),
      db.from('assignment_submissions')
        .select('assignment_id')
        .in('assignment_id', assignmentIds)
        .in('status', ['submitted', 'marked']),
    ])

    // Count in memory
    const studentCountByClass: Record<string, number> = {}
    for (const row of classStudentRows ?? []) {
      studentCountByClass[row.class_id] = (studentCountByClass[row.class_id] ?? 0) + 1
    }
    const submittedCountByAssignment: Record<string, number> = {}
    for (const row of submissionRows ?? []) {
      submittedCountByAssignment[row.assignment_id] = (submittedCountByAssignment[row.assignment_id] ?? 0) + 1
    }

    const withCounts = assignments.map(a => ({
      ...a,
      total_students:  studentCountByClass[a.class_id as string]  ?? 0,
      submitted_count: submittedCountByAssignment[a.id as string] ?? 0,
    }))

    return apiSuccess({ assignments: withCounts })
  } catch (e: unknown) {
    console.error('[teacher/assignments GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const parsed = CreateAssignmentSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { class_id, title, subject, topic, substrand_id, instructions, due_date, type, max_score, is_quiz, is_adaptive, is_compass_guided, is_holiday_assignment, holiday_period, lesson_plan_id } = parsed.data

    const { assignment } = await createAssignment(supabase, {
      classId: class_id,
      title,
      subject,
      topic,
      substrandId: substrand_id ?? null,
      instructions,
      dueDate: due_date,
      type,
      maxScore: max_score,
      isQuiz: is_quiz,
      isAdaptive: is_adaptive,
      isCompassGuided: is_compass_guided,
      isHolidayAssignment: is_holiday_assignment,
      holidayPeriod: holiday_period,
      lessonPlanId: lesson_plan_id,
    })

    return apiSuccess({ assignment }, 201)
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof ForbiddenError) return apiForbidden()
    console.error('[teacher/assignments POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
