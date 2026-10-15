import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireSchoolMembership, requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import {
  createSchoolEffectivenessCheck,
  getLatestSchoolEffectivenessCheck,
} from '@/lib/schoolEffectiveness/service'
import { z } from 'zod'

const RatingSchema = z.object({
  benchmarkId: z.string().min(1).max(64),
  level: z.number().int().min(0).max(4),
})

const CreateSchema = z.object({
  schoolId: z.string().uuid(),
  selfReport: z.array(RatingSchema),
  // Onboarded schools may pass auto-derived ratings; a prospect omits them.
  auto: z.array(RatingSchema).optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

// Cast the Zod-validated numbers (0–4) to the BenchmarkRating level union.
type Level = 0 | 1 | 2 | 3 | 4
function toRatings(rows: { benchmarkId: string; level: number }[]) {
  return rows.map((r) => ({ benchmarkId: r.benchmarkId, level: r.level as Level }))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Running a Check is a staff action; ownership is school membership, never
  // teacher_id. requireSchoolStaff both authenticates and scopes to the school.
  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, parsed.data.schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  const check = await createSchoolEffectivenessCheck({
    schoolId: parsed.data.schoolId,
    createdBy: userId,
    selfReport: toRatings(parsed.data.selfReport),
    auto: parsed.data.auto ? toRatings(parsed.data.auto) : undefined,
  })

  return NextResponse.json({ data: check }, { status: 201 })
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

  const check = await getLatestSchoolEffectivenessCheck(schoolId)
  return NextResponse.json({ data: check }, { status: 200 })
}
