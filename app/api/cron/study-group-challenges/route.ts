import { apiSuccess, apiError } from '@/lib/api/response'
import { generateChallengesForAllGroups } from '@/lib/studyGroups/challengeGenerator'

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await generateChallengesForAllGroups()
    return apiSuccess(result)
  } catch (err: unknown) {
    console.error('[cron/study-group-challenges]', err instanceof Error ? err.message : String(err))
    return apiError('Cron job failed')
  }
}
