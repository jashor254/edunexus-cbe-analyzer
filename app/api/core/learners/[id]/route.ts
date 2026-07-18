import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getLearner, updateLearner, getLearnerHistory, enrollLearner, withdrawLearner } from '@/lib/core/learners'
import { getLearnerReadiness } from '@/lib/core/learnerOnboarding'
import { getBridgedLearnerTimeline, getBridgedCareerIntelligence } from '@/lib/core/academicBridge'
import { requireSchoolMembership, requireSchoolAdmin, requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

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
    const data = await getBridgedLearnerTimeline(id)
    return NextResponse.json({ data })
  }

  if (view === 'career-intelligence') {
    const data = await getBridgedCareerIntelligence(id)
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
      await requireSchoolStaff(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const data = await enrollLearner({ school_id: schoolId, learner_id: id, ...rest })
    return NextResponse.json({ data })
  }

  if (body.action === 'withdraw') {
    const { schoolId, termId } = body
    try {
      await requireSchoolAdmin(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    await withdrawLearner(id, termId)
    return NextResponse.json({ data: { success: true } })
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
