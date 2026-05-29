import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    // Verify class belongs to this teacher
    const { data: cls } = await db
      .from('teacher_classes')
      .select('*')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiNotFound('Class not found')

    // Get all students in this class
    const { data: studentLinks } = await db
      .from('class_students')
      .select('student_id, parent_id, joined_at')
      .eq('class_id', classId)

    const studentIds = (studentLinks || []).map((s: any) => s.student_id)

    let students: any[] = []
    let subjectAggregates: Record<string, number[]> = {}

    if (studentIds.length > 0) {
      const { data: studentData } = await db
        .from('students')
        .select('id, name, grade, school, parent_email, parent_phone')
        .in('id', studentIds)

      // Get latest assessment per student
      const assessmentPromises = studentIds.map((sid: string) =>
        db.from('assessments')
          .select('id, subject_scores, term, year, created_at')
          .eq('student_id', sid)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      )

      const assessmentResults = await Promise.allSettled(assessmentPromises)

      // Get last activity (compass sessions)
      const activityPromises = studentIds.map((sid: string) =>
        db.from('compass_sessions')
          .select('updated_at')
          .eq('learner_id', sid)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()
      )

      const activityResults = await Promise.allSettled(activityPromises)

      students = (studentData || []).map((student: any, idx: number) => {
        const assessmentResult = assessmentResults[idx]
        const activityResult = activityResults[idx]

        const assessment = assessmentResult.status === 'fulfilled'
          ? assessmentResult.value.data
          : null

        const lastActive = activityResult.status === 'fulfilled'
          ? activityResult.value.data?.updated_at
          : null

        let overallLevel = null
        let avgScore = null
        let subjectScores: Record<string, number> = {}

        if (assessment?.subject_scores) {
          subjectScores = assessment.subject_scores as Record<string, number>
          const vals = Object.values(subjectScores)
          avgScore = vals.reduce((s, v) => s + v, 0) / vals.length
          overallLevel = levelLabel(avgScore)

          // Aggregate for class averages
          Object.entries(subjectScores).forEach(([subj, score]) => {
            if (!subjectAggregates[subj]) subjectAggregates[subj] = []
            subjectAggregates[subj].push(score)
          })
        }

        // Days inactive
        let daysInactive = null
        if (lastActive) {
          daysInactive = Math.floor(
            (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
          )
        }

        const link = (studentLinks || []).find((sl: any) => sl.student_id === student.id)

        return {
          ...student,
          joined_at: link?.joined_at,
          overallLevel,
          avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
          subjectScores,
          lastActive,
          daysInactive,
          assessment: assessment
            ? { id: assessment.id, term: assessment.term, year: assessment.year }
            : null,
          latestAssessmentId: assessment?.id ?? null,
        }
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
  } catch (e: any) {
    console.error('[teacher/classes/[classId] GET]', e.message)
    return apiError('Internal server error')
  }
}
