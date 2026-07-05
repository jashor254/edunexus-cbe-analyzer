import { z } from 'zod'
import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'

const CreateGroupSchema = z.object({
  name:    z.string().trim().min(1),
  subject: z.string().trim().min(1),
  grade:   z.union([z.string(), z.number()]),
})

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const parsed = CreateGroupSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Missing required fields')
    const { name, subject, grade } = parsed.data

    const db = createServiceClient()

    // Resolve the student record for this user account
    const { data: student } = await db
      .from('students')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiBadRequest('No student profile found. Ask your parent to set up your account first.')

    // Unique invite code
    let inviteCode = generateInviteCode()
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await db
        .from('study_groups')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle()
      if (!existing) break
      inviteCode = generateInviteCode()
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
      .insert({ name, subject, grade, invite_code: inviteCode, created_by: user.id, ground_rules: groundRules })
      .select()
      .single()

    if (groupError || !group) return apiError('Failed to create group')

    // Auto-add creator as first member — name comes from their student profile
    await db.from('study_group_members').insert({
      group_id:     group.id,
      user_id:      user.id,
      student_id:   student.id,
      student_name: student.name,
    })

    return apiSuccess({ groupId: group.id, inviteCode })
  } catch (error: unknown) {
    return apiError(error instanceof Error ? error.message : 'Internal server error')
  }
}
