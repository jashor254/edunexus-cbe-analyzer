import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { revokeSharedReport } from '@/lib/sharedReports/read'
import { SHARE_TOKEN_LENGTH } from '@/lib/sharedReports/token'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'

const ShareRevokeSchema = z.object({
  token: z.string().length(SHARE_TOKEN_LENGTH),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiUnauthorized()
    }

    const parsed = ShareRevokeSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest('Missing or invalid token')

    // Ownership is enforced inside the repository update (user_id = caller).
    // Not-yours, unknown and already-revoked all return the same 404.
    const revoked = await revokeSharedReport(parsed.data.token, user.id)
    if (!revoked) return apiNotFound('Share link not found')

    return apiSuccess({ revoked: true })
  } catch (error: unknown) {
    console.error('[share/revoke] error:', error instanceof Error ? error.message : String(error))
    return apiError('Internal server error')
  }
}
