import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { runAnnualPromotion, previewPromotion } from '@/lib/core/promotions'
import { requireSchoolAdmin, requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError, PermissionDeniedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { z } from 'zod'

const PromotionSchema = z.object({
  schoolId: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  decisions: z.array(z.object({
    learner_id: z.string().uuid(),
    promotion_type: z.enum(['promoted', 'repeated', 'graduated']),
    // Sprint 12 Wave 2 (Critical 2): required except for 'graduated' — the
    // Zod refine below enforces this at the boundary, matching the same
    // rule runAnnualPromotion() itself now enforces (defense in depth, not
    // duplicated business logic — the lib function's check is the one that
    // actually matters and stays regardless of this route-level check).
    to_class_id: z.string().uuid().optional(),
    to_academic_year_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  }).refine(
    d => d.promotion_type === 'graduated' || (!!d.to_class_id && !!d.to_academic_year_id),
    { message: 'to_class_id and to_academic_year_id are required unless promotion_type is "graduated"' }
  )).min(1),
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
  const termId = req.nextUrl.searchParams.get('termId')
  if (!schoolId || !academicYearId || !termId) return NextResponse.json({ error: 'schoolId, academicYearId, and termId required' }, { status: 400 })

  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await previewPromotion(schoolId, academicYearId, termId)
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

  // Bug found during Sprint 10 testing (docs/engineering/implementation-log.md):
  // learner_promotions.processed_by is a FK to school_users(id), not
  // auth.uid() — passing the raw userId here caused every single promotion
  // decision to fail its FK constraint, silently swallowed into
  // runAnnualPromotion's per-decision `errors` array (HTTP 200, processed:
  // 0). Resolved via the same school-scoped, active-only lookup
  // requireSchoolAdmin already proved this user passes.
  const processedBySchoolUser = await repos.teachers.findSchoolUser(userId, schoolId)
  if (!processedBySchoolUser) return errorResponse(new PermissionDeniedError('No active school membership found for this admin action.'))

  const data = await runAnnualPromotion(schoolId, processedBySchoolUser.id, { academic_year_id, decisions })
  return NextResponse.json({ data })
}
