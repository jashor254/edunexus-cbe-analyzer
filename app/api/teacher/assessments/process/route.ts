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
import { recomputeAndSaveCapabilityProfile } from '@/lib/career/careerEngine'
import { updateFromAssessment } from '@/lib/learnerModel/updater'
import { levelToApproxMarks, type CBCLevel } from '@/lib/assessments/gradeCalculator'
import { recordReportCardAssessmentEvidence } from '@/lib/assessments/reportCardEvidence'

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
        studentId:    sid,
        assessmentId: assessment_id,
        actorName:    teacherName,
        actorUserId:  user.id,
        notify:       true,
        teacherId:    teacher.id,
        classId:      class_id,
      })
      results.push(result)

      // Fire-and-forget: update capability profile and EILS learner model.
      if (result.status === 'ok') {
        recomputeAndSaveCapabilityProfile(sid).catch(err =>
          console.error('[assessments/process] capability recompute failed', sid, err)
        )
        triggerLearnerModelUpdate(db, sid, result.student_name, assessment_id).catch(err =>
          console.error('[assessments/process] learner model update failed', sid, err)
        )
        recordReportCardAssessmentEvidence(assessment_id, sid, teacher.id, user.id).catch(err =>
          console.error('[assessments/process] evidence emission failed', sid, err)
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

// Trigger learner model update after a successful assessment pipeline run.
async function triggerLearnerModelUpdate(
  db:           ReturnType<typeof import('@/utils/supabase/service').createServiceClient>,
  studentId:    string,
  studentName:  string,
  assessmentId: string,
): Promise<void> {
  // `assessments` is the real table (student-scoped, multi-subject per row).
  // No strand/sub_strand/subject columns exist here — this is a general,
  // term-level assessment, not a topical one.
  const { data: assessment } = await db
    .from('assessments')
    .select('id, subject_scores, subject_marks, term, year, created_at')
    .eq('id', assessmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (!assessment) return

  const scores      = (assessment.subject_scores as Record<string, number>) ?? {}
  const rawMarksMap = (assessment.subject_marks as Record<string, { marks?: number }>) ?? {}

  // Prefer the actual raw mark when present; only approximate from the CBC
  // level (which must round-trip through marksToLevel's band boundaries
  // back to the same level — see lib/intelligence/cbcScale.ts) when no raw
  // mark was recorded.
  const marks: Record<string, number> = {}
  for (const [subj, level] of Object.entries(scores)) {
    marks[subj] = rawMarksMap[subj]?.marks ?? levelToApproxMarks(level as CBCLevel)
  }

  // One call per subject so every subject in this assessment updates its own
  // knowledge_state entry, not just an arbitrary single subject.
  await Promise.allSettled(
    Object.keys(scores).map(subject =>
      updateFromAssessment({
        studentId,
        studentName,
        subjectScores: scores,
        subjectMarks:  marks,
        strand:        'general',
        subStrand:     'general',
        subject,
        term:          (assessment.term as number) ?? 1,
        year:          (assessment.year as number) ?? new Date().getFullYear(),
        assessedAt:    (assessment.created_at as string) ?? new Date().toISOString(),
      })
    )
  )
}
