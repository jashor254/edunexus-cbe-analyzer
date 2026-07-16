import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { admitLearner, listLearners } from '@/lib/core/learners'
import { requireSchoolMembership, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

const AdmitSchema = z.object({
  schoolId: z.string().uuid(),
  admission_number: z.string().min(1),
  first_name: z.string().min(1),
  middle_name: z.string().optional(),
  last_name: z.string().min(1),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  upi: z.string().optional(),
  county_of_origin: z.string().optional(),
  special_needs: z.array(z.string()).optional(),
  notes: z.string().optional(),
  guardian: z.object({
    full_name: z.string().min(1),
    phone: z.string().min(1),
    relationship: z.enum(['father', 'mother', 'guardian', 'grandparent', 'sibling', 'other']),
    email: z.string().email().optional(),
    national_id: z.string().optional(),
  }),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const status = req.nextUrl.searchParams.get('status') as 'active' | null
  const classId = req.nextUrl.searchParams.get('classId') ?? undefined
  const termId = req.nextUrl.searchParams.get('termId') ?? undefined
  const search = req.nextUrl.searchParams.get('search') ?? undefined

  const data = await listLearners(schoolId, { status: status ?? undefined, classId, termId, search })
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()
  const parsed = AdmitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...input } = parsed.data
  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await admitLearner(schoolId, input)
  return NextResponse.json({ data }, { status: 201 })
}
