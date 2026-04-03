import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    const { groupId, answer, isAnonymous } = await req.json()
    if (!groupId || answer === undefined) {
      return apiBadRequest('Missing groupId or answer')
    }

    const db = createServiceClient()

    // Get member info
    const { data: member } = await db
      .from('study_group_members')
      .select('id, student_name, points')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return apiForbidden()
    }

    // Get today's challenge
    const today = new Date().toISOString().split('T')[0]
    const { data: challenge } = await db
      .from('study_group_challenges')
      .select('*')
      .eq('group_id', groupId)
      .eq('date', today)
      .single()

    if (!challenge) {
      return apiNotFound('No challenge available for today.')
    }

    // Check not already answered
    const { data: existing } = await db
      .from('study_group_answers')
      .select('id')
      .eq('challenge_id', challenge.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return apiBadRequest("You have already answered today's challenge.")
    }

    // Evaluate answer
    const isCorrect = answer.trim().toLowerCase() === challenge.correct_answer.trim().toLowerCase()

    // Check if first correct answer
    const { count: correctCount } = await db
      .from('study_group_answers')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id)
      .eq('is_correct', true)

    let pointsEarned = 2 // for trying
    if (isCorrect) {
      pointsEarned = (correctCount || 0) === 0 ? 25 : 10
    }

    // Save answer
    await db.from('study_group_answers').insert({
      challenge_id:  challenge.id,
      group_id:      groupId,
      user_id:       user.id,
      student_name:  member.student_name,
      answer:        answer.trim(),
      is_correct:    isCorrect,
      is_anonymous:  isAnonymous || false,
      points_earned: pointsEarned,
    })

    // Update member points
    await db
      .from('study_group_members')
      .update({ points: (member.points || 0) + pointsEarned })
      .eq('id', member.id)

    return apiSuccess({
      isCorrect,
      pointsEarned,
      correctAnswer: isCorrect ? null : challenge.correct_answer,
    })
  } catch (error: any) {
    console.error('[groups/challenge] error:', error.message)
    return apiError('Internal server error')
  }
}
