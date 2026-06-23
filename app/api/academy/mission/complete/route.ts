import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiNotFound,
  apiError,
  getErrorMessage,
} from '@/lib/api/response'
import { getMission, upsertMissionCompletion, recordXpEvent } from '@/lib/academy/missions'
import { scoreMissionComparison } from '@/lib/academy/aiJudge'
import type { MissionCompleteResponse } from '@/lib/academy/types'

const bodySchema = z.object({
  mission_id:       z.string().uuid(),
  tool_a_output:    z.string().trim().default(''),
  tool_b_output:    z.string().trim().default(''),
  comparison_notes: z.string().trim().min(1, 'Please write your comparison notes.'),
  self_scores:      z.record(z.string(), z.number().min(1).max(5)).default({}),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0].message)

    const { mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores } = parsed.data
    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiNotFound('Teacher profile not found')

    const missionWithCompletion = await getMission(mission_id, teacher.id)
    if (!missionWithCompletion) return apiNotFound('Mission not found')

    const isFirstCompletion = missionWithCompletion.completion === null

    const verdict = await scoreMissionComparison(
      {
        title:        missionWithCompletion.title,
        mission_type: missionWithCompletion.mission_type,
        description:  missionWithCompletion.description,
      },
      { mission_id, tool_a_output, tool_b_output, comparison_notes, self_scores },
      user.id
    )

    const completion = await upsertMissionCompletion(
      teacher.id,
      mission_id,
      tool_a_output,
      tool_b_output,
      comparison_notes,
      self_scores,
      verdict
    )

    // Award XP only on first completion
    const xpEarned = isFirstCompletion ? missionWithCompletion.xp_reward : 0
    if (xpEarned > 0) {
      await recordXpEvent(teacher.id, 'mission_complete', xpEarned, {
        mission_id,
        mission_title: missionWithCompletion.title,
        ai_score: verdict.ai_score,
      })
    }

    return apiSuccess<MissionCompleteResponse>({
      success: true,
      completion,
      verdict,
      xp_earned: xpEarned,
    })
  } catch (err: unknown) {
    return apiError(getErrorMessage(err), 500)
  }
}
