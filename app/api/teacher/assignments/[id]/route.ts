import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

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

    const enriched = (submissions || []).map((sub: any) => ({
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const body = await req.json()
    const { status } = body

    if (!status || !['draft', 'active', 'closed'].includes(status)) {
      return apiError('Invalid status', 400)
    }

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
