import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { transferLearner, getLearnerTransfers } from '@/lib/core/transfers'
import { isSchoolAdmin } from '@/lib/core/school-users'
import { assertLearnerOwnership } from '@/lib/api/middleware'
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const learnerId = req.nextUrl.searchParams.get('learnerId')
  if (!schoolId || !learnerId) return NextResponse.json({ error: 'schoolId and learnerId required' }, { status: 400 })

  const admin = await isSchoolAdmin(user.id, schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ownershipFail = await assertLearnerOwnership(learnerId, schoolId)
  if (ownershipFail) return ownershipFail

  const data = await getLearnerTransfers(learnerId)
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = TransferSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...input } = parsed.data
  const admin = await isSchoolAdmin(user.id, schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ownershipFail = await assertLearnerOwnership(input.learner_id, schoolId)
  if (ownershipFail) return ownershipFail

  const data = await transferLearner(user.id, input)
  return NextResponse.json({ data }, { status: 201 })
}
