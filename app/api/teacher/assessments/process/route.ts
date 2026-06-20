// app/api/teacher/assessments/process/route.ts
// Teacher-side entry point for the assessment processing pipeline.
// Accepts { assessment_id, student_id } for single or { class_id, assessment_id } for bulk.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest,
} from '@/lib/api/response'
import { runAssessmentPipeline, type AssessmentPipelineResult } from '@/lib/academicClinic/assessmentPipeline'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { saveCapabilityProfile } from '@/lib/career/careerEngine'

const BodySchema = z.union([
  z.object({
    assessment_id: z.string().uuid(),
    student_id:    z.string().uuid(),
    class_id:      z.string().uuid().optional(),
  }),
  z.object({
    assessment_id: z.string().uuid(),
    class_id:      z.string().uuid(),
    student_id:    z.string().uuid().optional(),
  }),
])

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const { assessment_id, student_id, class_id } = parsed.data as {
      assessment_id: string
      student_id?: string
      class_id?: string
    }

    const teacherName = teacher.full_name ?? 'Your Teacher'

    let studentIds: string[] = []

    if (student_id) {
      // Single student
      studentIds = [student_id]
    } else if (class_id) {
      // Verify class belongs to teacher, get all students
      const { data: cls } = await db
        .from('teacher_classes')
        .select('id')
        .eq('id', class_id)
        .eq('teacher_id', teacher.id)
        .single()
      if (!cls) return apiForbidden()

      const { data: links } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', class_id)

      studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id)
    }

    if (studentIds.length === 0) {
      return apiBadRequest('No students found to process')
    }

    // Process all students (sequential to avoid overwhelming PDF renderer + Resend rate limits)
    const results: AssessmentPipelineResult[] = []
    for (const sid of studentIds) {
      const result = await runAssessmentPipeline({
        db,
        studentId:    sid,
        assessmentId: assessment_id,
        actorName:    teacherName,
        actorUserId:  user.id,
        notify:       true,
        teacherId:    teacher.id,
        classId:      class_id,
      })
      results.push(result)

      // Fire-and-forget: recompute capability profile after a successful pipeline run.
      // This keeps the growth engine up-to-date without blocking the response.
      if (result.status === 'ok') {
        recomputeCapabilityProfile(db, sid).catch(err =>
          console.error('[assessments/process] capability recompute failed', sid, err)
        )
      }
    }

    const processed = results.filter(r => r.status === 'ok').length
    const failed    = results.filter(r => r.status === 'error').length

    return apiSuccess({ processed, failed, results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/assessments/process POST]', msg)
    return apiError('Internal server error')
  }
}

// Fetch latest assessment scores for a student and recompute their capability profile.
async function recomputeCapabilityProfile(
  db: ReturnType<typeof import('@/utils/supabase/service').createServiceClient>,
  studentId: string
): Promise<void> {
  const { data: assessments } = await db
    .from('student_assessments')
    .select('subject_scores')
    .eq('student_id', studentId)
    .not('subject_scores', 'is', null)
    .order('created_at', { ascending: true })
    .limit(10)

  if (!assessments || assessments.length === 0) return

  const scoreHistory = assessments.map(a => a.subject_scores as Record<string, number>)
  const profile      = extractCapabilityProfile(scoreHistory)
  await saveCapabilityProfile(studentId, profile)
}
