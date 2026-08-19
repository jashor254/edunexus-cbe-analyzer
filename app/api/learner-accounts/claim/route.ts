// app/api/learner-accounts/claim/route.ts
//
// Phase 2B-RESUME Step 10/26 — redeems a school-issued activation (or
// recovery) code. Deliberately UNAUTHENTICATED at the start of the request
// — the whole point of this route is to BOOTSTRAP the learner's first
// Supabase session (Step 7/8), so there is no prior `auth.getUser()` to
// check. All authority instead comes from possession of the one-time
// activation token, validated entirely inside
// lib/core/learnerAccounts.ts::claimLearnerAccountActivation (never a
// client-supplied learnerIdentityId).
//
// On success, the session minted by the auth bootstrap is written to this
// response's cookies via the same @supabase/ssr server client every other
// route uses — the browser is authenticated as a real `auth.users.id`
// immediately after this call returns, no further round-trip needed.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { claimLearnerAccountActivation } from '@/lib/core/learnerAccounts'

const BodySchema = z.object({
  token: z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  let result
  try {
    result = await claimLearnerAccountActivation(parsed.data.token)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Activation claim failed' }, { status: 409 })
  }

  if (result.status !== 'claimed') {
    const statusCode = result.status === 'invalid' || result.status === 'expired' || result.status === 'already_used' ? 400 : 409
    return NextResponse.json({ error: result.status }, { status: statusCode })
  }

  const supabase = await createClient()
  const { error: sessionErr } = await supabase.auth.setSession({
    access_token: result.session.accessToken,
    refresh_token: result.session.refreshToken,
  })
  if (sessionErr) {
    return NextResponse.json({ error: 'Activation succeeded but session could not be established' }, { status: 500 })
  }

  return NextResponse.json({
    data: { status: 'claimed', learnerAccountId: result.learnerAccountId, learnerIdentityId: result.learnerIdentityId },
  })
}
