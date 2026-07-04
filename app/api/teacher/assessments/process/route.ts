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
import { afterAssessment } from '@/lib/eils'

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

      // Fire-and-forget: update capability profile and EILS learner model.
      if (result.status === 'ok') {
        recomputeCapabilityProfile(db, sid).catch(err =>
          console.error('[assessments/process] capability recompute failed', sid, err)
        )
        triggerEILSUpdate(db, sid, result.student_name, assessment_id).catch(err =>
          console.error('[assessments/process] EILS update failed', sid, err)
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

// Trigger EILS continuous learning update after a successful assessment pipeline run.
async function triggerEILSUpdate(
  db:           ReturnType<typeof import('@/utils/supabase/service').createServiceClient>,
  studentId:    string,
  studentName:  string,
  assessmentId: string,
): Promise<void> {
  // Load assessment for EILS — strand, substrand, subject, term, year
  const { data: assessment } = await db
    .from('student_assessments')
    .select('id, subject_scores, strand, sub_strand, subject, term, year, created_at')
    .eq('id', assessmentId)
    .eq('student_id', studentId)
    .single()

  if (!assessment) return

  const scores     = (assessment.subject_scores as Record<string, number>) ?? {}
  const subject    = (assessment.subject as string) || Object.keys(scores)[0] || 'unknown'
  const subStrand  = (assessment.sub_strand as string) || 'general'
  const strand     = (assessment.strand as string) || subStrand

  // Approximate raw marks from CBC levels (level × 25 gives midpoint)
  const marks: Record<string, number> = {}
  for (const [subj, level] of Object.entries(scores)) {
    marks[subj] = Math.min(100, level * 25)
  }

  await afterAssessment({
    studentId,
    studentName,
    assessmentId,
    subjectScores: scores,
    subjectMarks:  marks,
    strand,
    subStrand,
    subject,
    term:          (assessment.term as number) ?? 1,
    year:          (assessment.year as number) ?? new Date().getFullYear(),
    assessedAt:    (assessment.created_at as string) ?? new Date().toISOString(),
  })
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
