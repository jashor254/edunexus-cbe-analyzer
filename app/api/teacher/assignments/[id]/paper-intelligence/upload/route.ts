// app/api/teacher/assignments/[id]/paper-intelligence/upload/route.ts
//
// Mark Papers — file a reviewed paper's marks (mark first, file after;
// docs/engineering/mark-papers-flow-plan.md).
//   GET  → readiness (complete / unreviewed / over-the-maximum scripts, any
//          earlier upload) plus this class's termly assessments to file into.
//   POST → { destination: 'topical' }
//          { destination: 'termly', subject, assessmentId }
//          { destination: 'termly', subject, newAssessment: { assessmentType, term, year, maxScore } }
//          One destination per paper; a different one is refused (409).
// Gated on currently teaching the paper's class; the filer is the session's
// teacher, never an id from the body. Notifications, evidence and learner-model
// updates run after the response.

import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireAssignmentClassTeacher, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import {
  getUploadReadiness,
  uploadPaperMarks,
  UploadError,
  PaperNotFoundError,
  type UploadReadiness,
  type UploadOutcome,
} from '@/lib/paperIntelligence/upload'
import { getClassAssessments } from '@/lib/assessments/getters'
import { KNOWN_ASSESSMENT_TYPES } from '@/lib/assessments/assessmentTypeCatalog'

const TERMLY_TYPES = KNOWN_ASSESSMENT_TYPES.filter(t => t !== 'assignment')

const UploadSchema = z.discriminatedUnion('destination', [
  z.object({ destination: z.literal('topical') }),
  z.object({
    destination: z.literal('termly'),
    subject: z.string().trim().min(1).max(100),
    assessmentId: z.string().uuid().optional(),
    newAssessment: z.object({
      assessmentType: z.enum(TERMLY_TYPES as [typeof TERMLY_TYPES[number], ...typeof TERMLY_TYPES[number][]]),
      term: z.enum(['1', '2', '3']),
      year: z.number().int().min(2020).max(2100),
      maxScore: z.number().int().positive().max(1000),
    }).optional(),
  }).refine(t => !!t.assessmentId !== !!t.newAssessment, { message: 'Choose an assessment, or create a new one — not both.' }),
])

export type TermlyAssessmentOption = {
  id: string
  title: string
  assessmentType: string
  term: string
  year: number
  maxScore: number
  subjects: string[]
  isPublished: boolean
}

export type UploadStatusResponse = Omit<UploadReadiness, 'complete'> & {
  complete: Array<{ learnerName: string; total: number }>
  assessments: TermlyAssessmentOption[]
}

export type UploadResponse = Omit<UploadOutcome, 'followUps'>

async function authorize(assignmentId: string): Promise<{ teacherId: string; teacherUserId: string } | { response: Response }> {
  const supabase = await createClient()
  try {
    const access = await requireAssignmentClassTeacher(supabase, assignmentId)
    return { teacherId: access.teacherId, teacherUserId: access.teacherUserId }
  } catch (err) {
    if (err instanceof UnauthorizedError) return { response: apiUnauthorized() }
    if (err instanceof AssignmentOwnershipError) return { response: apiNotFound('Assignment not found') }
    throw err
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const auth = await authorize(assignmentId)
    if ('response' in auth) return auth.response

    const readiness = await getUploadReadiness(assignmentId)
    const assessments = await getClassAssessments(readiness.paper.classId, auth.teacherId)
    return apiSuccess<UploadStatusResponse>({
      ...readiness,
      complete: readiness.complete.map(c => ({ learnerName: c.learnerName, total: c.total })),
      assessments: assessments
        .filter(a => a.assessment_type !== 'assignment')
        .map(a => ({
          id: a.id,
          title: a.title,
          assessmentType: a.assessment_type,
          term: a.term,
          year: a.year,
          maxScore: a.max_score,
          subjects: a.subjects,
          isPublished: a.is_published === true,
        })),
    })
  } catch (e: unknown) {
    if (e instanceof PaperNotFoundError) return apiNotFound('Assignment not found')
    console.error('[paperIntelligence/upload GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const auth = await authorize(assignmentId)
    if ('response' in auth) return auth.response

    const parsed = UploadSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const body = parsed.data

    let outcome: UploadOutcome
    try {
      outcome = await uploadPaperMarks({
        assignmentId,
        teacherId: auth.teacherId,
        teacherUserId: auth.teacherUserId,
        target: body.destination === 'topical'
          ? { destination: 'topical' }
          : body.newAssessment
            ? { destination: 'termly', subject: body.subject, newAssessment: body.newAssessment }
            : { destination: 'termly', subject: body.subject, assessmentId: body.assessmentId as string },
      })
    } catch (err) {
      if (err instanceof UploadError) return apiError(err.message, 409)
      if (err instanceof PaperNotFoundError) return apiNotFound('Assignment not found')
      throw err
    }

    const { followUps, ...result } = outcome
    if (followUps.length > 0) after(async () => { await Promise.all(followUps.map(f => f())) })
    return apiSuccess<UploadResponse>(result)
  } catch (e: unknown) {
    console.error('[paperIntelligence/upload POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
