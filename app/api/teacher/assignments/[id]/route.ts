import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication, isCurrentTenureHolderForAssignmentClass } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const UpdateAssignmentSchema = z.object({
  status: z.enum(['draft', 'active', 'closed']),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Phase 3A — Part A: fetch by id alone, then decide READ access below.
    // Loading unconditionally (rather than filtering by teacher_id in the
    // query, as before) is required so the second, previously-missing
    // access path — the CURRENT teaching-tenure holder for the same Core
    // class+subject, who may not be this assignment's original creator —
    // has an assignment.class_id to resolve against at all. This does NOT
    // widen who may see the row: the explicit check below still denies
    // unrelated/cross-school/departed teachers exactly as the query-level
    // filter did.
    const { data: assignment } = await db
      .from('assignments')
      .select(`*, teacher_classes(name, grade, subject)`)
      .eq('id', id)
      .maybeSingle()

    if (!assignment) return apiNotFound('Assignment not found')

    // READ authority only — never mark/write authority (Step 6, PATCH below
    // is untouched). Original creator (legacy, unchanged) OR the teacher who
    // currently holds the teaching tenure for the same Core class+subject
    // this assignment's compatibility class was created under (Phase 1B/1D
    // composition — see isCurrentTenureHolderForAssignmentClass).
    const isCreator = assignment.teacher_id === teacher.id
    const isCurrentTenureHolder = !isCreator && await isCurrentTenureHolderForAssignmentClass(userId, assignment.class_id as string)
    if (!isCreator && !isCurrentTenureHolder) return apiNotFound('Assignment not found')

    // Get all submissions with student info
    const { data: submissions } = await db
      .from('assignment_submissions')
      .select(`
        id, assignment_id, student_id, class_id, status, score,
        teacher_feedback, compass_summary, work_text,
        file_path, file_name, file_type,
        submitted_at, marked_at, created_at,
        students(name, grade)
      `)
      .eq('assignment_id', id)
      .order('created_at', { ascending: true })

    // Check overdue
    const now = new Date()
    const dueDate = new Date(assignment.due_date)
    const isOverdue = now > dueDate

    const enriched = (submissions || []).map((sub: { status: string; [key: string]: unknown }) => ({
      ...sub,
      isOverdue: isOverdue && sub.status === 'pending',
    }))

    return apiSuccess({ assignment, submissions: enriched })
  } catch (e: unknown) {
    console.error('[teacher/assignments/[id] GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const parsed = UpdateAssignmentSchema.safeParse(await req.json())
    if (!parsed.success) return apiError('Invalid status', 400)
    const { status } = parsed.data

    const { data: assignment, error } = await db
      .from('assignments')
      .update({ status })
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .select()
      .single()

    if (error || !assignment) return apiNotFound('Assignment not found')

    return apiSuccess({ assignment })
  } catch (e: unknown) {
    console.error('[teacher/assignments/[id] PATCH]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
