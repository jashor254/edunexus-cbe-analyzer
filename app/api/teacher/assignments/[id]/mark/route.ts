import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { recordSubmissionMark, ScoreOutOfRangeError, SubmissionToMarkNotFoundError } from '@/lib/assignments/markSubmission'

const MarkSubmissionSchema = z.object({
  submissionId: z.string().uuid().optional(),
  studentId:    z.string().uuid().optional(),
  score:        z.number().optional(),
  feedback:     z.string().optional(),
  status:       z.string().optional(),
}).refine(d => d.submissionId || d.studentId, {
  message: 'submissionId or studentId is required',
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const db = createServiceClient()

    // Verify assignment belongs to this teacher
    const { data: assignment } = await db
      .from('assignments')
      .select('id, title, max_score, class_id, subject, topic, substrand_id')
      .eq('id', assignmentId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')

    const parsed = MarkSubmissionSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { submissionId, studentId, score, feedback } = parsed.data

    let result: Awaited<ReturnType<typeof recordSubmissionMark>>
    try {
      result = await recordSubmissionMark({
        assignment: {
          id: assignment.id as string,
          max_score: (assignment.max_score as number | null) ?? null,
          subject: assignment.subject as string,
          topic: (assignment.topic as string | null) ?? null,
          substrand_id: (assignment.substrand_id as string | null) ?? null,
        },
        target: submissionId ? { submissionId } : { studentId: studentId as string },
        score: score ?? null,
        feedback: feedback ?? null,
        teacherId: teacher.id,
        teacherUserId: userId,
      })
    } catch (err) {
      if (err instanceof ScoreOutOfRangeError) return apiError(err.message, 400)
      if (err instanceof SubmissionToMarkNotFoundError) return apiNotFound('Submission not found')
      throw err
    }

    // Notification + Evidence Domain observation — additive, never blocking
    // the response; registered with after() rather than left detached (same
    // rationale as app/api/student/submit-quiz/route.ts).
    after(result.followUp)

    return apiSuccess({ submission: result.submission })
  } catch (e: unknown) {
    console.error('[teacher/assignments/[id]/mark POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
