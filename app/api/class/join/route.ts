import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

const JoinSchema = z.object({
  inviteCode: z.string().min(1, 'inviteCode is required'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = JoinSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { inviteCode } = parsed.data

    const db = createServiceClient()

    // Look up the invite
    const { data: invite, error: inviteError } = await db
      .from('class_invites')
      .select('id, class_id, expires_at, used_count')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (inviteError || !invite) {
      return apiError('Invite link not found or has expired', 404)
    }

    if (new Date(invite.expires_at as string) < new Date()) {
      return apiError('This invite link has expired. Ask the teacher for a new one.', 410)
    }

    // Get the class info
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, name, grade')
      .eq('id', invite.class_id)
      .single()

    if (!cls) return apiError('Class not found', 404)

    // Update class_students: set parent_id for students in this class that don't have one yet
    const { data: unlinked } = await db
      .from('class_students')
      .select('id, student_id')
      .eq('class_id', invite.class_id)
      .is('parent_id', null)

    if (!unlinked || unlinked.length === 0) {
      // All students already have parents — still allow but inform
      return apiSuccess({
        className: cls.name as string,
        grade:     cls.grade as number,
        linked:    0,
        message:   'All students in this class are already connected to a parent.',
      })
    }

    // Link this parent to all unlinked students in the class
    const studentIds = unlinked.map((u) => u.student_id as string)

    const { error: updateError } = await db
      .from('class_students')
      .update({ parent_id: userId })
      .eq('class_id', invite.class_id)
      .is('parent_id', null)

    if (updateError) return apiError('Failed to connect to class')

    // Increment used_count
    await db
      .from('class_invites')
      .update({ used_count: (invite.used_count as number) + 1 })
      .eq('id', invite.id)

    // Also store parent_email on each student for notifications
    const { data: authUser } = await db.auth.admin.getUserById(userId)
    const parentEmail = authUser.user?.email

    if (parentEmail && studentIds.length > 0) {
      await db
        .from('students')
        .update({ parent_email: parentEmail })
        .in('id', studentIds)
        .is('parent_email', null)
    }

    return apiSuccess({
      className: cls.name as string,
      grade:     cls.grade as number,
      linked:    studentIds.length,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[class/join POST]', message)
    return apiError('Internal server error')
  }
}
