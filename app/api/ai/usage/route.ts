import { createClient } from '@/utils/supabase/server'
import { getDailyUsage } from '@/lib/ai/rateLimit'
import { apiSuccess, apiUnauthorized, apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!user || error) return apiUnauthorized()

    const usage = await getDailyUsage(user.id)

    const resetAt = new Date()
    resetAt.setUTCDate(resetAt.getUTCDate() + 1)
    resetAt.setUTCHours(0, 0, 0, 0)

    return apiSuccess({ usage, resetAt: resetAt.toISOString() })
  } catch (err) {
    console.error('[ai/usage]', err)
    return apiError('Internal Server Error', 500)
  }
}
