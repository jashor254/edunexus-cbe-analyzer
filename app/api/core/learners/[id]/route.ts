import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getLearner, updateLearner, getLearnerHistory, enrollLearner, withdrawLearner, moveLearnerToClass } from '@/lib/core/learners'
import { getLearnerReadiness } from '@/lib/core/learnerOnboarding'
import { getBridgedLearnerTimeline, getBridgedCareerIntelligence, removeStaleLegacyRosterMembership } from '@/lib/core/academicBridge'
import { requireSchoolMembership, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'
import { asLearnerId } from '@/lib/core/identityTypes'

const UpdateSchema = z.object({
  schoolId: z.string().uuid(),
  first_name: z.string().min(1).optional(),
  middle_name: z.string().nullable().optional(),
  last_name: z.string().min(1).optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  upi: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  county_of_origin: z.string().nullable().optional(),
  special_needs: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
})

const EnrollSchema = z.object({
  schoolId: z.string().uuid(),
  class_id: z.string().uuid(),
  term_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
})

// Phase 4 (Task E — closing F2). Was body destructuring with no schema at all.
const WithdrawSchema = z.object({
  schoolId: z.string().uuid(),
  termId: z.string().uuid(),
})

// Phase 4 (Task B) — the one canonical class-move action. No term_id here
// deliberately: moveLearnerToClass always operates on the school's own
// current term (server-derived), never a client-supplied one.
const MoveSchema = z.object({
  schoolId: z.string().uuid(),
  class_id: z.string().uuid(),
})

type Params = { params: Promise<{ id: string }> }

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()

  const { id } = await params
  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const view = req.nextUrl.searchParams.get('view')
  if (view === 'history') {
    const data = await getLearnerHistory(id, schoolId)
    return NextResponse.json({ data })
  }

  if (view === 'readiness') {
    const termId = req.nextUrl.searchParams.get('termId')
    if (!termId) return NextResponse.json({ error: 'termId required for view=readiness' }, { status: 400 })
    const data = await getLearnerReadiness(id, schoolId, termId)
    return NextResponse.json({ data })
  }

  // Sprint 9G — canonical read migration. Resolves through
  // lib/core/academicBridge.ts to the same legacy identity Sprint 9F's
  // Assessment/Evidence/Projection pipeline already produced; the
  // underlying reads (getLearnerTimeline/buildCareerIntelligence) are
  // completely unmodified. null (not 404) when this learner has no
  // assessment history yet — a real, common, non-error state.
  if (view === 'timeline') {
    const data = await getBridgedLearnerTimeline(asLearnerId(id))
    return NextResponse.json({ data })
  }

  if (view === 'career-intelligence') {
    const data = await getBridgedCareerIntelligence(asLearnerId(id))
    return NextResponse.json({ data })
  }

  const data = await getLearner(id, schoolId)
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()

  const { id } = await params
  const body = await req.json()

  if (body.action === 'enroll') {
    const parsed = EnrollSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const { schoolId, ...rest } = parsed.data
    try {
      // Phase 4 (Task D — closing the teacher-boundary leak) — was
      // requireSchoolStaff, which SCHOOL_STAFF_ROLES includes 'teacher'.
      // Institutional enrollment is admin-owned; a plain teacher could
      // otherwise write learner_enrollments rows, i.e. maintain a class
      // roster themselves.
      await requireSchoolAdmin(supabase, schoolId)
      const data = await enrollLearner({ school_id: schoolId, learner_id: id, ...rest })
      return NextResponse.json({ data })
    } catch (err) {
      return errorResponse(err)
    }
  }

  if (body.action === 'withdraw') {
    const parsed = WithdrawSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const { schoolId, termId } = parsed.data
    try {
      await requireSchoolAdmin(supabase, schoolId)
      await withdrawLearner(id, schoolId, termId)
      return NextResponse.json({ data: { success: true } })
    } catch (err) {
      return errorResponse(err)
    }
  }

  if (body.action === 'move') {
    const parsed = MoveSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const { schoolId, class_id: destinationClassId } = parsed.data
    try {
      await requireSchoolAdmin(supabase, schoolId)
      const result = await moveLearnerToClass(schoolId, id, destinationClassId)

      // Phase 5 — legacy roster convergence, composed here rather than
      // inside moveLearnerToClass itself (see that function's own comment
      // on the module-cycle reason). Canonical institutional truth is
      // already committed by this point and stays authoritative regardless
      // of what happens next: a missing/never-bridged legacy mapping is an
      // expected no-op, not a failure, and an ACTUAL cleanup failure is
      // logged (removeStaleLegacyRosterMembership's own logger.info on
      // success; a thrown error here is caught and logged, never surfaced
      // as if the learner's canonical move itself failed — the principal's
      // action already succeeded).
      if (result.moved && result.previousClassId) {
        try {
          await removeStaleLegacyRosterMembership(asLearnerId(id), result.previousClassId)
        } catch (err) {
          console.error('[core/learners PATCH move] legacy roster convergence failed (canonical move already succeeded)', {
            learnerId: id, previousClassId: result.previousClassId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return NextResponse.json({ data: result })
    } catch (err) {
      return errorResponse(err)
    }
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...updates } = parsed.data
  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await updateLearner(id, schoolId, updates)
  return NextResponse.json({ data })
}
