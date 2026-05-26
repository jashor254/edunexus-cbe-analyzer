import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound,
} from '@/lib/api/response'
import { getAssessmentById, getLearnerMarks, bulkSaveMarks } from '@/lib/assessments/queries'

const BulkSaveSchema = z.object({
  marks: z.array(z.object({
    studentName:   z.string().min(1),
    admNo:         z.string().optional(),
    subjectScores: z.record(z.string(), z.number().min(0)),
  })).min(1),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const assessment = await getAssessmentById(assessmentId, teacher.id)
    if (!assessment) return apiNotFound('Assessment not found')

    const marks = await getLearnerMarks(assessmentId, teacher.id)
    return apiSuccess({ marks })
  } catch (e: any) {
    console.error('[marks GET]', e.message)
    return apiError('Failed to fetch marks')
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const assessment = await getAssessmentById(assessmentId, teacher.id)
    if (!assessment) return apiNotFound('Assessment not found')

    const parsed = BulkSaveSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map((i) => i.message).join(', '))
    }

    for (const m of parsed.data.marks) {
      for (const [subj, score] of Object.entries(m.subjectScores)) {
        if (score > assessment.max_score) {
          return apiBadRequest(
            `Score ${score} for "${subj}" exceeds max score ${assessment.max_score}`
          )
        }
      }
    }

    const marks = await bulkSaveMarks(
      assessmentId,
      assessment.class_id,
      teacher.id,
      parsed.data.marks,
      assessment.curriculum_type ?? 'cbc',
      assessment.max_score
    )

    // Create alerts for struggling learners (best-effort — don't fail the save if alert errors)
    const maxTotal   = assessment.subjects.length * assessment.max_score
    const threshold  = maxTotal * 0.4
    const struggling = marks.filter((m) => (m.total_marks || 0) < threshold)

    if (struggling.length > 0) {
      const { data: classStudents } = await db
        .from('class_students')
        .select('student_id')
        .eq('class_id', assessment.class_id)

      if (classStudents && classStudents.length > 0) {
        const studentIds = classStudents.map((cs) => cs.student_id)
        const { data: students } = await db
          .from('students')
          .select('id, name')
          .in('id', studentIds)

        const studentMap = new Map((students || []).map((s) => [s.name.toLowerCase(), s.id]))
        const alertRows = struggling
          .map((m) => {
            const studentId = studentMap.get(m.student_name.toLowerCase())
            if (!studentId) return null
            return {
              student_id:  studentId,
              teacher_id:  teacher.id,
              alert_type:  'declining_scores',
              message:     `${m.student_name} scored ${m.total_marks}/${maxTotal} in "${assessment.title}" — Position ${m.position ?? '?'} in class. Consider additional support.`,
              is_resolved: false,
            }
          })
          .filter(Boolean)

        if (alertRows.length > 0) {
          await db.from('student_alerts').insert(alertRows)
        }
      }
    }

    return apiSuccess({ marks, saved: marks.length })
  } catch (e: any) {
    console.error('[marks POST]', e.message)
    return apiError('Failed to save marks')
  }
}
