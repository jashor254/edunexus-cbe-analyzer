import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { runAnnualPromotion, previewPromotion } from '@/lib/core/promotions'
import { requireSchoolAdmin, requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

const PromotionSchema = z.object({
  schoolId: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  decisions: z.array(z.object({
    learner_id: z.string().uuid(),
    promotion_type: z.enum(['promoted', 'repeated', 'graduated']),
    to_class_id: z.string().uuid().optional(),
    to_academic_year_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  })).min(1),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const academicYearId = req.nextUrl.searchParams.get('academicYearId')
  if (!schoolId || !academicYearId) return NextResponse.json({ error: 'schoolId and academicYearId required' }, { status: 400 })

  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await previewPromotion(schoolId, academicYearId)
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const parsed = PromotionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, academic_year_id, decisions } = parsed.data
  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await runAnnualPromotion(schoolId, userId, { academic_year_id, decisions })
  return NextResponse.json({ data })
}
