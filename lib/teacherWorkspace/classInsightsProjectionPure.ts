// lib/teacherWorkspace/classInsightsProjectionPure.ts
//
// Pure computation extracted from
// app/api/teacher/classes/[classId]/insights/route.ts GET. Reuses the
// existing risk-level service (`computeStudentRiskLevel`,
// lib/assessments/analyticsStats.ts) rather than duplicating risk logic —
// this module only assembles the per-student risk map, "recently active"
// set, subject distribution, and risk counts around it, exactly as the
// route did inline.

import { computeStudentRiskLevel } from '@/lib/assessments/analyticsStats'

export type InsightsSessionRow = { learner_id: string; updated_at: string }
export type InsightsAssessmentRow = { student_id: string; subject_scores: Record<string, number>; created_at: string }
export type InsightsStudentRow = { id: string; name: string; grade: number }

export type ClassInsightsProjection = {
  totalStudents: number
  activeStudents: number
  holidayRisk: Array<InsightsStudentRow & { riskLevel: 'high' | 'medium' | 'low'; isActive: boolean }>
  subjectDistribution: Record<string, number[]>
  riskLevels: { high: number; medium: number; low: number }
}

/**
 * @param studentIds every student enrolled in the class.
 * @param sessions compass_sessions rows already scoped to the last 30 days (the caller's DB query filters this — see the doc comment on the service wrapper for why that boundary is kept even though only the last-7-days subset is used here).
 * @param assessments every assessment for `studentIds`, no date filter, order does not need to be pre-sorted (this function only groups by "latest per student" using created_at comparison, not array order).
 * @param nowMs injected `Date.now()` for deterministic tests.
 */
export function computeClassInsightsProjection(params: {
  studentIds: string[]
  sessions: InsightsSessionRow[]
  assessments: InsightsAssessmentRow[]
  students: InsightsStudentRow[]
  nowMs: number
}): ClassInsightsProjection {
  const { studentIds, sessions, assessments, students, nowMs } = params

  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()

  const recentlyActive = new Set(
    sessions.filter(s => s.updated_at >= sevenDaysAgo).map(s => s.learner_id)
  )

  const riskMap: Record<string, 'high' | 'medium' | 'low'> = {}
  studentIds.forEach(sid => {
    const isActive = recentlyActive.has(sid)
    const studentAssessmentScores = assessments
      .filter(a => a.student_id === sid)
      .map(a => a.subject_scores)
    riskMap[sid] = computeStudentRiskLevel(isActive, studentAssessmentScores)
  })

  const holidayRisk = students
    .filter(s => riskMap[s.id] === 'high' || riskMap[s.id] === 'medium')
    .map(s => ({ ...s, riskLevel: riskMap[s.id], isActive: recentlyActive.has(s.id) }))

  // Latest-per-student subject distribution — `assessments` is grouped by
  // finding, per student, the row with the most recent `created_at`
  // (matches the original route's assumption that its desc-ordered query
  // meant "first occurrence wins"; here we compare explicitly since this
  // function doesn't require the caller to pre-sort).
  const latestPerStudent = new Map<string, InsightsAssessmentRow>()
  for (const a of assessments) {
    const existing = latestPerStudent.get(a.student_id)
    if (!existing || a.created_at > existing.created_at) latestPerStudent.set(a.student_id, a)
  }
  const subjectDistribution: Record<string, number[]> = {}
  for (const a of latestPerStudent.values()) {
    Object.entries(a.subject_scores).forEach(([subj, score]) => {
      if (!subjectDistribution[subj]) subjectDistribution[subj] = []
      subjectDistribution[subj].push(score)
    })
  }

  const riskCounts = Object.values(riskMap).reduce(
    (acc, level) => { acc[level]++; return acc },
    { high: 0, medium: 0, low: 0 }
  )

  return {
    totalStudents: studentIds.length,
    activeStudents: recentlyActive.size,
    holidayRisk,
    subjectDistribution,
    riskLevels: riskCounts,
  }
}
