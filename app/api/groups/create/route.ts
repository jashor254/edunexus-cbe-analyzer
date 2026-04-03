import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    const { name, subject, grade, studentName } = await req.json()
    if (!name || !subject || !grade || !studentName) {
      return apiBadRequest('Missing required fields')
    }

    const db = createServiceClient()

    // Generate unique invite code (retry if taken)
    let inviteCode = generateInviteCode()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await db
        .from('study_groups')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()
      if (!existing) break
      inviteCode = generateInviteCode()
      attempts++
    }

    const groundRules = [
      'Respect every member — no mockery',
      'Show your working, not just the answer',
      'Help others understand — don\'t just give answers',
      'Anonymous questions are welcome',
      `Stay on topic — ${subject} only`,
      'Celebrate every correct answer 🎉',
      'One challenge per day — quality over quantity',
    ]

    const { data: group, error: groupError } = await db
      .from('study_groups')
      .insert({
        name,
        subject,
        grade,
        invite_code: inviteCode,
        created_by:  user.id,
        ground_rules: groundRules,
      })
      .select()
      .single()

    if (groupError || !group) {
      console.error('[groups/create] error:', groupError)
      return apiError('Failed to create group')
    }

    // Auto-add creator as first member
    await db.from('study_group_members').insert({
      group_id:     group.id,
      user_id:      user.id,
      student_name: studentName,
    })

    return apiSuccess({ groupId: group.id, inviteCode })
  } catch (error: any) {
    console.error('[groups/create] error:', error.message)
    return apiError('Internal server error')
  }
}
