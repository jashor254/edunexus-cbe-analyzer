import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

// GET — return existing invite or create one
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
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

    // Verify class belongs to this teacher
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, name')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiNotFound('Class not found')

    // Find a valid existing invite (not expired)
    const { data: existing } = await db
      .from('class_invites')
      .select('id, invite_code, expires_at, used_count')
      .eq('class_id', classId)
      .eq('teacher_id', teacher.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return apiSuccess({ invite: existing })
    }

    // Create a fresh invite
    const { data: created, error } = await db
      .from('class_invites')
      .insert({ class_id: classId, teacher_id: teacher.id })
      .select('id, invite_code, expires_at, used_count')
      .single()

    if (error || !created) return apiError('Failed to create invite link')

    return apiSuccess({ invite: created })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[teacher/classes/[classId]/invite GET]', message)
    return apiError('Internal server error')
  }
}
