import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { transferLearner, getLearnerTransfers } from '@/lib/core/transfers'
import { requireSchoolAdmin, requireAuthentication } from '@/lib/core/permissions'
import { assertLearnerOwnership } from '@/lib/api/middleware'
import { UnauthorizedError, isEduNexusError, PermissionDeniedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { z } from 'zod'

const TransferSchema = z.object({
  schoolId: z.string().uuid(),
  learner_id: z.string().uuid(),
  direction: z.enum(['in', 'out']),
  transfer_date: z.string(),
  to_school_id: z.string().uuid().optional(),
  to_school_name: z.string().optional(),
  reason: z.string().optional(),
  document_urls: z.array(z.string().url()).optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const learnerId = req.nextUrl.searchParams.get('learnerId')
  if (!schoolId || !learnerId) return NextResponse.json({ error: 'schoolId and learnerId required' }, { status: 400 })

  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const ownershipFail = await assertLearnerOwnership(learnerId, schoolId)
  if (ownershipFail) return ownershipFail

  const data = await getLearnerTransfers(learnerId)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const parsed = TransferSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...input } = parsed.data
  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const ownershipFail = await assertLearnerOwnership(input.learner_id, schoolId)
  if (ownershipFail) return ownershipFail

  // Same fix as app/api/core/promotions/route.ts this sprint:
  // learner_transfers.processed_by is a FK to school_users(id), not
  // auth.uid() — passing the raw userId would fail the FK constraint.
  const processedBySchoolUser = await repos.teachers.findSchoolUser(userId, schoolId)
  if (!processedBySchoolUser) return errorResponse(new PermissionDeniedError('No active school membership found for this admin action.'))

  const data = await transferLearner(processedBySchoolUser.id, input)
  return NextResponse.json({ data }, { status: 201 })
}
