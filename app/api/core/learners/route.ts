import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { admitLearner, listLearners } from '@/lib/core/learners'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
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

// Sprint 9D: the full Administration→Academics onboarding pipeline
// (Admission → Guardian (optional) → Enrollment), reachable through this
// same canonical route by additionally supplying class_id/term_id/
// academic_year_id. Guardian is optional here — AdmitSchema above is left
// completely unchanged for backward compatibility (existing callers who
// only admit, never touching this branch, see zero behavior change).
const OnboardSchema = z.object({
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
  }).optional(),
  class_id: z.string().uuid(),
  term_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
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

  // DR-04 (Phase 10 rehearsal finding) — listLearners only applies the
  // classId filter when termId is ALSO present (a roster is class+term
  // scoped, not class-alone); supplying classId without termId used to
  // silently fall through to the full-school list with no error. A caller
  // that forgot termId got every learner in the school back with no signal
  // anything was wrong. Rejected here instead, before the ambiguous read.
  if (classId && !termId) {
    return NextResponse.json({ error: 'termId is required when classId is supplied — a class roster is scoped to one term, not the whole class history.' }, { status: 422 })
  }

  const data = await listLearners(schoolId, { status: status ?? undefined, classId, termId, search })
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()

  // Administration owns enrollment (Sprint 9D Part 3) — the full pipeline
  // is admin-only, tighter than the pre-existing standalone enroll action
  // on app/api/core/learners/[id] (requireSchoolStaff, left unchanged).
  if (body?.class_id) {
    const parsed = OnboardSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    const { schoolId, ...input } = parsed.data
    try {
      await requireSchoolAdmin(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }

    const result = await onboardLearner(schoolId, input)
    return NextResponse.json({ data: result }, { status: result.status === 'complete' ? 201 : 422 })
  }

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
