import { z } from 'zod'
import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'

const JoinGroupSchema = z.object({
  inviteCode: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const parsed = JoinGroupSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Missing inviteCode')
    const { inviteCode } = parsed.data

    const db = createServiceClient()

    // Resolve the student record for this user account
    const { data: student } = await db
      .from('students')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiBadRequest('No student profile found. Ask your parent to set up your account first.')

    const { data: group } = await db
      .from('study_groups')
      .select('id, name, status, max_members')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle()

    if (!group) return apiNotFound('Group not found. Check the invite code.')
    if (group.status !== 'active') return apiBadRequest('This group is no longer accepting members.')

    const { count } = await db
      .from('study_group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)

    if ((count ?? 0) >= group.max_members) return apiBadRequest('This group is full (max 8 members).')

    // Check not already a member (by student_id OR user_id)
    const { data: existing } = await db
      .from('study_group_members')
      .select('id')
      .eq('group_id', group.id)
      .or(`student_id.eq.${student.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (existing) {
      return apiSuccess({ message: 'Already a member.', groupId: group.id, groupName: group.name })
    }

    await db.from('study_group_members').insert({
      group_id:     group.id,
      user_id:      user.id,
      student_id:   student.id,
      student_name: student.name,
    })

    return apiSuccess({ groupId: group.id, groupName: group.name })
  } catch (error: unknown) {
    return apiError(error instanceof Error ? error.message : 'Internal server error')
  }
}
