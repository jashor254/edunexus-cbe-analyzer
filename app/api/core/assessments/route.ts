import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listAssessments, getAssessmentScores, computeTermSummaries, getClassPerformanceSummary } from '@/lib/core/assessments'
import { getSchoolSettings } from '@/lib/core/school'
import { requireAuthentication, requireSchoolMembership, canManageAssessment } from '@/lib/core/permissions'
import { UnauthorizedError, PermissionDeniedError, isEduNexusError } from '@/lib/core/errors'
import { ensureBridgedClass, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { z } from 'zod'

const CreateSchema = z.object({
  schoolId: z.string().uuid(),
  class_id: z.string().uuid(),
  title: z.string().min(1),
  assessment_type: z.string(),
  term: z.string(),
  year: z.number().int(),
  max_score: z.number().positive(),
  subjects: z.array(z.string()),
  curriculum_type: z.string().default('cbc'),
  weight_percent: z.number().min(0).max(100).optional(),
  grading_type: z.enum(['marks', 'cbc_level', 'both']).optional(),
  grade_id: z.string().uuid().optional(),
})

// Sprint 9F: classId/coreLearnerId are Core identities (classes.id,
// learners.id) — lib/core/academicBridge.ts resolves them to the legacy
// teacher_classes.id/students.id the underlying tables actually require
// (class_assessments.class_id and learner_marks.teacher_id both FK to
// legacy tables, confirmed live; see that module's header for the full
// rationale). Renamed learner_id -> coreLearnerId explicitly (not a
// compatibility shim for the old field name) since nothing could
// previously call this action successfully — class_id already failed the
// FK before this field's value ever mattered.
const SaveScoresSchema = z.object({
  schoolId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  classId: z.string().uuid(),
  scores: z.array(z.object({
    coreLearnerId: z.string().uuid(),
    admission_number: z.string(),
    student_name: z.string(),
    subject_scores: z.record(z.string(), z.number()),
    total_marks: z.number(),
    mean_score: z.number(),
    mean_grade: z.string().optional(),
  })),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

/**
 * SECURITY FIX (Stage 0 Architectural Census, gap #1): this route's three
 * mutating actions (save-scores, compute, create) previously checked only
 * `getSchoolUser` membership — any active school_users row, of any role,
 * could save assessment scores school-wide. Now requires admin-tier or the
 * assessment's own class teacher, via the canonical `canManageAssessment`.
 * Throws {@link PermissionDeniedError} (403) if neither.
 */
async function requireCanManageAssessment(client: Awaited<ReturnType<typeof createClient>>, schoolId: string, classId: string): Promise<void> {
  await requireSchoolMembership(client, schoolId)
  if (!(await canManageAssessment(client, schoolId, classId))) throw new PermissionDeniedError()
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const classId = req.nextUrl.searchParams.get('classId')
  if (!schoolId || !classId) return NextResponse.json({ error: 'schoolId and classId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const view = req.nextUrl.searchParams.get('view')
  const termId = req.nextUrl.searchParams.get('termId')

  if (view === 'summary' && termId) {
    const data = await getClassPerformanceSummary(classId, termId)
    return NextResponse.json({ data })
  }

  if (view === 'scores') {
    const assessmentId = req.nextUrl.searchParams.get('assessmentId')
    if (!assessmentId) return NextResponse.json({ error: 'assessmentId required' }, { status: 400 })
    const data = await getAssessmentScores(assessmentId)
    return NextResponse.json({ data })
  }

  const term = req.nextUrl.searchParams.get('term') ?? undefined
  const year = req.nextUrl.searchParams.get('year') ? Number(req.nextUrl.searchParams.get('year')) : undefined
  const data = await listAssessments(classId, { term, year })
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()

  if (body.action === 'save-scores') {
    const parsed = SaveScoresSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
      await requireSchoolMembership(supabase, parsed.data.schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    // ensureBridgedClass is the school-boundary + ownership check for the
    // bridged path (see lib/core/academicBridge.ts) — resolved before, and
    // in addition to, the existing requireCanManageAssessment gate below,
    // which now runs against the resolved legacy class id.
    let legacyClassId: string
    try {
      const bridged = await ensureBridgedClass(parsed.data.schoolId, parsed.data.classId, userId)
      legacyClassId = bridged.legacyClassId
      await requireCanManageAssessment(supabase, parsed.data.schoolId, legacyClassId)
      await recordBridgedMarks(parsed.data.schoolId, parsed.data.assessmentId, bridged, userId, parsed.data.scores)
    } catch (err) {
      return errorResponse(err)
    }
    return NextResponse.json({ data: { success: true } })
  }

  if (body.action === 'compute') {
    const { schoolId, classId, termId } = body
    let legacyClassId: string
    try {
      await requireSchoolMembership(supabase, schoolId)
      const bridged = await ensureBridgedClass(schoolId, classId, (await requireAuthentication(supabase)).id)
      legacyClassId = bridged.legacyClassId
      await requireCanManageAssessment(supabase, schoolId, legacyClassId)
    } catch (err) {
      return errorResponse(err)
    }
    const settings = await getSchoolSettings(schoolId)
    // Sprint 10A: computeTermSummaries takes the Core classId (its own
    // writes FK to `classes`) and resolves the legacy bridge internally —
    // passing legacyClassId here would make it look up a bridge for a
    // legacy id, finding none, and silently write nothing.
    await computeTermSummaries(schoolId, classId, termId, settings.grade_boundaries)
    return NextResponse.json({ data: { success: true } })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, class_id: coreClassId, ...input } = parsed.data
  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  let result: Awaited<ReturnType<typeof createBridgedAssessment>>
  try {
    // ensureBridgedClass runs inside createBridgedAssessment; the existing
    // requireCanManageAssessment check still runs, against the resolved
    // legacy class id, as an unchanged second gate.
    const bridged = await ensureBridgedClass(schoolId, coreClassId, userId)
    await requireCanManageAssessment(supabase, schoolId, bridged.legacyClassId)
    result = await createBridgedAssessment(schoolId, coreClassId, userId, input)
  } catch (err) {
    return errorResponse(err)
  }

  return NextResponse.json({ data: result }, { status: 201 })
}
