import { z } from 'zod'
import { createClient }        from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'

const ChallengeAnswerSchema = z.object({
  groupId:     z.string().uuid(),
  answer:      z.string().min(1),
  isAnonymous: z.boolean().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const parsed = ChallengeAnswerSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Missing groupId or answer')
    const { groupId, answer, isAnonymous } = parsed.data

    const db = createServiceClient()

    // Find member by student_id first, fall back to user_id (legacy parent-side records)
    const { data: studentRow } = await db
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let member: { id: string; student_name: string; points: number } | null = null

    if (studentRow) {
      const { data } = await db
        .from('study_group_members')
        .select('id, student_name, points')
        .eq('group_id', groupId)
        .eq('student_id', studentRow.id)
        .maybeSingle()
      member = data ?? null
    }

    if (!member) {
      const { data } = await db
        .from('study_group_members')
        .select('id, student_name, points')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()
      member = data ?? null
    }

    if (!member) return apiForbidden()

    const today = new Date().toISOString().split('T')[0]
    const { data: challenge } = await db
      .from('study_group_challenges')
      .select('id, correct_answer')
      .eq('group_id', groupId)
      .eq('date', today)
      .maybeSingle()

    if (!challenge) return apiNotFound('No challenge available for today.')

    // Already answered?
    const { data: existing } = await db
      .from('study_group_answers')
      .select('id')
      .eq('challenge_id', challenge.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) return apiBadRequest("You've already answered today's challenge.")

    const isCorrect = answer.trim().toLowerCase() === (challenge.correct_answer as string).trim().toLowerCase()

    const { count: correctCount } = await db
      .from('study_group_answers')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id)
      .eq('is_correct', true)

    const pointsEarned = isCorrect ? ((correctCount ?? 0) === 0 ? 25 : 10) : 2

    await db.from('study_group_answers').insert({
      challenge_id:  challenge.id,
      group_id:      groupId,
      user_id:       user.id,
      student_name:  member.student_name,
      answer:        answer.trim(),
      is_correct:    isCorrect,
      is_anonymous:  isAnonymous ?? false,
      points_earned: pointsEarned,
    })

    await db
      .from('study_group_members')
      .update({ points: ((member.points as number) ?? 0) + pointsEarned })
      .eq('id', member.id)

    return apiSuccess({
      isCorrect,
      pointsEarned,
      correctAnswer: isCorrect ? null : challenge.correct_answer,
    })
  } catch (error: unknown) {
    return apiError(error instanceof Error ? error.message : 'Internal server error')
  }
}
