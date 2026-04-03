import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    const { inviteCode, studentName } = await req.json()
    if (!inviteCode || !studentName) {
      return apiBadRequest('Missing inviteCode or studentName')
    }

    const db = createServiceClient()

    const { data: group, error: groupError } = await db
      .from('study_groups')
      .select('id, name, status, max_members')
      .eq('invite_code', inviteCode.toUpperCase())
      .single()

    if (groupError || !group) {
      return apiNotFound('Group not found. Check the invite code.')
    }

    if (group.status !== 'active') {
      return apiBadRequest('This group is no longer accepting members.')
    }

    // Check member count
    const { count } = await db
      .from('study_group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)

    if ((count || 0) >= group.max_members) {
      return apiBadRequest('This group is full (max 8 members).')
    }

    // Check not already a member
    const { data: existing } = await db
      .from('study_group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return apiSuccess({ message: 'You are already a member of this group.', groupId: group.id, groupName: group.name })
    }

    await db.from('study_group_members').insert({
      group_id:     group.id,
      user_id:      user.id,
      student_name: studentName,
    })

    return apiSuccess({ groupId: group.id, groupName: group.name })
  } catch (error: any) {
    console.error('[groups/join] error:', error.message)
    return apiError('Internal server error')
  }
}
