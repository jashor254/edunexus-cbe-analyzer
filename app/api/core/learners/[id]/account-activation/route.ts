// app/api/core/learners/[id]/account-activation/route.ts
//
// Phase 2B-RESUME Step 6/26 — school-scoped issuance of a one-time learner
// account activation code. Thin route: authenticates + authorizes, then
// delegates entirely to lib/core/learnerAccounts.ts. The raw activation
// token is returned in this response ONCE — only its hash is ever
// persisted (learner_account_invites.token_hash).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { issueLearnerAccountActivation, resolveIssuingSchoolUserId } from '@/lib/core/learnerAccounts'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

const BodySchema = z.object({
  schoolId: z.string().uuid(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  return NextResponse.json({ error: err instanceof Error ? err.message : 'Activation issuance failed' }, { status: 409 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id: learnerId } = await params
  const supabase = await createClient()

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  let actorUserId: string
  try {
    actorUserId = (await requireSchoolAdmin(supabase, parsed.data.schoolId)).userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const issuedBySchoolUserId = await resolveIssuingSchoolUserId(actorUserId, parsed.data.schoolId)
    const result = await issueLearnerAccountActivation(parsed.data.schoolId, learnerId, issuedBySchoolUserId)
    return NextResponse.json({ data: result })
  } catch (err) {
    return errorResponse(err)
  }
}
