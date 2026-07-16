import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
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

    const { data: assignment } = await db
      .from('assignments')
      .select(`*, teacher_classes(name, grade, subject)`)
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')

    // Get all submissions with student info
    const { data: submissions } = await db
      .from('assignment_submissions')
      .select(`
        *,
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
