import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

function levelLabel(avg: number) {
  if (avg >= 3.5) return 'Exceeds Expectations'
  if (avg >= 2.5) return 'Meets Expectations'
  if (avg >= 1.5) return 'Approaching Expectations'
  return 'Below Expectations'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
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

    // Verify class belongs to this teacher
    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiNotFound('Class not found')
    }

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, teacher_id, name, grade, subject, class_code, created_at')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiNotFound('Class not found')

    // Get all students in this class
    const { data: studentLinks } = await db
      .from('class_students')
      .select('student_id, parent_id, joined_at')
      .eq('class_id', classId)

    type StudentLink = { student_id: string; parent_id: string | null; joined_at: string }
    const links = (studentLinks || []) as StudentLink[]
    const studentIds = links.map(s => s.student_id)

    type StudentRow = { id: string; name: string; grade: number; school: string; parent_email: string | null; parent_phone: string | null }
    type AssessmentRow = { id: string; student_id: string; subject_scores: Record<string, number>; term: number; year: number; created_at: string }
    type SessionRow = { learner_id: string; updated_at: string }

    let students: ReturnType<typeof buildStudentPayload>[] = []
    let subjectAggregates: Record<string, number[]> = {}

    function buildStudentPayload(
      student: StudentRow,
      assessment: AssessmentRow | null,
      lastActive: string | null,
      link: StudentLink | undefined
    ) {
      let overallLevel: string | null = null
      let avgScore: number | null = null
      let subjectScores: Record<string, number> = {}

      if (assessment?.subject_scores) {
        subjectScores = assessment.subject_scores
        const vals = Object.values(subjectScores)
        avgScore = vals.reduce((s, v) => s + v, 0) / vals.length
        overallLevel = levelLabel(avgScore)
      }

      const daysInactive = lastActive
        ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        ...student,
        joined_at: link?.joined_at ?? null,
        parent_id: link?.parent_id ?? null,
        overallLevel,
        avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        subjectScores,
        lastActive,
        daysInactive,
        assessment: assessment ? { id: assessment.id, term: assessment.term, year: assessment.year } : null,
        latestAssessmentId: assessment?.id ?? null,
      }
    }

    if (studentIds.length > 0) {
      // Batch all queries — 3 round trips instead of 2N
      const [{ data: studentData }, { data: allAssessments }, { data: allSessions }] = await Promise.all([
        db.from('students')
          .select('id, name, grade, school, parent_email, parent_phone')
          .in('id', studentIds),
        db.from('assessments')
          .select('id, student_id, subject_scores, term, year, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false }),
        db.from('compass_sessions')
          .select('learner_id, updated_at')
          .in('learner_id', studentIds)
          .order('updated_at', { ascending: false }),
      ])

      // Pick the latest assessment and session per student (rows are desc-sorted)
      const latestAssessmentByStudent = new Map<string, AssessmentRow>()
      for (const a of (allAssessments || []) as AssessmentRow[]) {
        if (!latestAssessmentByStudent.has(a.student_id)) {
          latestAssessmentByStudent.set(a.student_id, a)
        }
      }

      const latestSessionByStudent = new Map<string, string>()
      for (const s of (allSessions || []) as SessionRow[]) {
        if (!latestSessionByStudent.has(s.learner_id)) {
          latestSessionByStudent.set(s.learner_id, s.updated_at)
        }
      }

      students = (studentData || []).map((student: StudentRow) => {
        const assessment = latestAssessmentByStudent.get(student.id) ?? null
        const lastActive = latestSessionByStudent.get(student.id) ?? null
        const link = links.find(l => l.student_id === student.id)

        // Build class-level aggregates
        if (assessment?.subject_scores) {
          Object.entries(assessment.subject_scores).forEach(([subj, score]) => {
            if (!subjectAggregates[subj]) subjectAggregates[subj] = []
            subjectAggregates[subj].push(score)
          })
        }

        return buildStudentPayload(student, assessment, lastActive, link)
      })
    }

    // Calculate class-level subject averages + identify gaps
    const subjectInsights = Object.entries(subjectAggregates).map(([subject, scores]) => {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      const distribution = {
        below: scores.filter(s => s < 1.5).length,
        approaching: scores.filter(s => s >= 1.5 && s < 2.5).length,
        meets: scores.filter(s => s >= 2.5 && s < 3.5).length,
        exceeds: scores.filter(s => s >= 3.5).length,
      }
      return {
        subject,
        avg: Math.round(avg * 10) / 10,
        level: levelLabel(avg),
        distribution,
        studentsBelow: distribution.below + distribution.approaching,
      }
    }).sort((a, b) => a.avg - b.avg)

    // Top 3 gaps
    const topGaps = subjectInsights.slice(0, 3)

    // Generate recommendations
    const recommendations: string[] = []
    if (topGaps[0] && topGaps[0].studentsBelow > 0) {
      recommendations.push(
        `${topGaps[0].studentsBelow} students need support in ${topGaps[0].subject} (avg ${topGaps[0].avg}/4)`
      )
    }

    return apiSuccess({
      class: cls,
      students,
      insights: subjectInsights,
      topGaps,
      recommendations,
    })
  } catch (e: unknown) {
    console.error('[teacher/classes/[classId] GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
