// app/api/parent/link-guardian/route.ts
//
// Sprint 12 Wave 3 (Critical 1, Release Blocker Remediation) — the Core
// counterpart to app/api/parent/link-student/route.ts (legacy). Verifies a
// core_guardian_invites token and links the authenticated user as the
// parent via learner_guardians.user_id. All validation/claim logic lives
// in lib/core/guardianInvites.ts::claimGuardianInvite — this route is thin
// per RAS §2 (auth check, one service call, map the result to a response).

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiBadRequest, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { claimGuardianInvite } from '@/lib/core/guardianInvites'

const BodySchema = z.object({
  token: z.string().min(1),
})

const STATUS_MESSAGES: Record<string, string> = {
  invalid: 'Invalid invite link.',
  expired: 'This invite link has expired — ask the school to send a new one.',
  already_used: 'This invite link has already been used.',
  linked_to_another_account: 'This guardian record is already linked to a different account.',
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const result = await claimGuardianInvite(userId, parsed.data.token)

    if (result.status === 'claimed' || result.status === 'already_claimed_by_you') {
      return apiSuccess({ linked: true, learnerId: result.learnerId, schoolId: result.schoolId, learnerName: result.learnerName })
    }

    return apiBadRequest(STATUS_MESSAGES[result.status] ?? 'Unable to link this invite.')
  } catch (e: unknown) {
    console.error('[parent/link-guardian POST]', e instanceof Error ? e.message : String(e))
    return apiBadRequest('Failed to link guardian invite.')
  }
}
