// app/api/core/assessments/[assessmentId]/marks/route.ts
//
// Phase 3C — the ONE teacher-facing marks-entry surface for a canonical
// (`class_subject_id`-bearing) Core assessment. Deliberately separate from
// the generic `app/api/core/assessments` route's `action: 'save-scores'`
// branch (which has zero production callers today, per the Phase 3C audit,
// and authorizes only "do you manage this class right now" — not "do you
// currently hold the teaching tenure for this exact subject," which is
// what canonical marks entry needs, Step 26/27). Both routes remain
// unmodified; this one exists alongside it, not instead of it.
//
// All domain logic (authorization, roster resolution, programme matching,
// score validation, Evidence/Projection) lives in
// lib/core/academicBridge.ts::getCanonicalAssessmentMarksView /
// recordCanonicalAssessmentMarks — this route is thin per RAS §2.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireSchoolMembership } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { getCanonicalAssessmentMarksView, recordCanonicalAssessmentMarks } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { z } from 'zod'

const SaveSchema = z.object({
  schoolId: z.string().uuid(),
  scores: z.array(z.object({
    coreLearnerId: z.string().uuid(),
    score: z.number(),
  })),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  throw err
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { assessmentId } = await params
  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const view = await getCanonicalAssessmentMarksView(schoolId, assessmentId)
  if (view.kind !== 'canonical') return NextResponse.json({ data: { kind: view.kind } })
  return NextResponse.json({ data: view })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { assessmentId } = await params
  const body = await req.json()
  const parsed = SaveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
    await requireSchoolMembership(supabase, parsed.data.schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const result = await recordCanonicalAssessmentMarks(
      parsed.data.schoolId,
      assessmentId,
      userId,
      parsed.data.scores.map(s => ({ coreLearnerId: asLearnerId(s.coreLearnerId), score: s.score })),
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    return errorResponse(err)
  }
}
