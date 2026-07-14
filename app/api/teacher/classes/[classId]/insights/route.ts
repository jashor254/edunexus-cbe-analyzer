import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { computeStudentRiskLevel } from '@/lib/assessments/analyticsStats'

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

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, subject')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiNotFound('Class not found')

    const { data: studentLinks } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)

    const studentIds = (studentLinks || []).map((s: { student_id: string }) => s.student_id)

    if (studentIds.length === 0) {
      return apiSuccess({
        insights: {
          totalStudents: 0,
          activeStudents: 0,
          holidayRisk: [],
          subjectDistribution: {},
          riskLevels: { high: 0, medium: 0, low: 0 },
        }
      })
    }

    // Last 30 days activity
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [sessionsResult, assessmentsResult, studentsResult] = await Promise.all([
      db.from('compass_sessions')
        .select('learner_id, updated_at')
        .in('learner_id', studentIds)
        .gte('updated_at', thirtyDaysAgo),

      db.from('assessments')
        .select('student_id, subject_scores, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false }),

      db.from('students')
        .select('id, name, grade')
        .in('id', studentIds),
    ])

    const sessions = sessionsResult.data || []
    const allAssessments = assessmentsResult.data || []
    const studentData = studentsResult.data || []

    type SessionRow = { learner_id: string; updated_at: string }
    type AssessmentRow = { student_id: string; subject_scores: Record<string, number>; created_at: string }
    type StudentRow = { id: string; name: string; grade: number }

    // Active in last 7 days
    const recentlyActive = new Set(
      (sessions as SessionRow[])
        .filter((s) => s.updated_at >= sevenDaysAgo)
        .map((s) => s.learner_id)
    )

    // Per-student risk — Phase D (docs/architecture/academic-evidence-layer.md
    // §8): computeStudentRiskLevel averages across all of a student's
    // assessments, not just the most recent one (see its own doc comment).
    const riskMap: Record<string, 'high' | 'medium' | 'low'> = {}
    studentIds.forEach((sid: string) => {
      const isActive = recentlyActive.has(sid)
      const studentAssessmentScores = (allAssessments as AssessmentRow[])
        .filter((a) => a.student_id === sid)
        .map((a) => a.subject_scores)
      riskMap[sid] = computeStudentRiskLevel(isActive, studentAssessmentScores)
    })

    const holidayRisk = (studentData as StudentRow[])
      .filter((s) => riskMap[s.id] === 'high' || riskMap[s.id] === 'medium')
      .map((s) => ({
        ...s,
        riskLevel: riskMap[s.id],
        isActive: recentlyActive.has(s.id),
      }))

    // Subject distribution across class
    const subjectDistribution: Record<string, number[]> = {}
    const latestPerStudent: Record<string, AssessmentRow> = {};
    (allAssessments as AssessmentRow[]).forEach((a) => {
      if (!latestPerStudent[a.student_id]) {
        latestPerStudent[a.student_id] = a
        const scores = a.subject_scores
        Object.entries(scores).forEach(([subj, score]) => {
          if (!subjectDistribution[subj]) subjectDistribution[subj] = []
          subjectDistribution[subj].push(score)
        })
      }
    })

    const riskCounts = Object.values(riskMap).reduce(
      (acc, level) => { acc[level]++; return acc },
      { high: 0, medium: 0, low: 0 }
    )

    return apiSuccess({
      insights: {
        totalStudents: studentIds.length,
        activeStudents: recentlyActive.size,
        holidayRisk,
        subjectDistribution,
        riskLevels: riskCounts,
      }
    })
  } catch (e: unknown) {
    console.error('[teacher/classes/insights GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
