// lib/teacherWorkspace/classDetailProjectionPure.ts
//
// Pure computation extracted from app/api/teacher/classes/[classId]/route.ts
// GET — the `buildStudentPayload` closure and the subject-insight/top-gaps/
// recommendations logic that used to live inline in the route. Moved
// verbatim: standing is classified from the *raw* (unrounded) average via
// lib/teacherWorkspace/standing.ts's rawMean/getStandingLabel, exactly as
// the original `levelLabel(avgScore)` call did before `avgScore` was
// rounded for display — see standing.ts's rawMean doc comment for why this
// distinction matters (rounding first can flip a value across a
// 3.5/2.5/1.5 boundary).

import { getStandingLabel, classifyStandingDistribution, rawMean, averageScore } from './standing'

export type StudentLink = { student_id: string; parent_id: string | null; joined_at: string }
export type StudentRow = { id: string; name: string; grade: number; school: string; parent_email: string | null; parent_phone: string | null }
export type AssessmentRow = { id: string; student_id: string; subject_scores: Record<string, number>; term: number; year: number; created_at: string }
export type SessionRow = { learner_id: string; updated_at: string }

export type StudentProjection = StudentRow & {
  joined_at: string | null
  parent_id: string | null
  overallLevel: string | null
  avgScore: number | null
  subjectScores: Record<string, number>
  lastActive: string | null
  daysInactive: number | null
  assessment: { id: string; term: number; year: number } | null
  latestAssessmentId: string | null
}

export type SubjectInsight = {
  subject: string
  avg: number
  level: string
  distribution: { below: number; approaching: number; meets: number; exceeds: number }
  studentsBelow: number
}

export type ClassDetailProjection = {
  class: unknown
  students: StudentProjection[]
  insights: SubjectInsight[]
  topGaps: SubjectInsight[]
  recommendations: string[]
}

function buildStudentPayload(
  student: StudentRow,
  assessment: AssessmentRow | null,
  lastActive: string | null,
  link: StudentLink | undefined,
  nowMs: number,
): StudentProjection {
  let overallLevel: string | null = null
  let avgScore: number | null = null
  let subjectScores: Record<string, number> = {}

  if (assessment?.subject_scores) {
    subjectScores = assessment.subject_scores
    const vals = Object.values(subjectScores)
    const raw = rawMean(vals)
    avgScore = averageScore(vals)
    overallLevel = raw !== null ? getStandingLabel(raw, 'long') : null
  }

  const daysInactive = lastActive
    ? Math.floor((nowMs - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return {
    ...student,
    joined_at: link?.joined_at ?? null,
    parent_id: link?.parent_id ?? null,
    overallLevel,
    avgScore,
    subjectScores,
    lastActive,
    daysInactive,
    assessment: assessment ? { id: assessment.id, term: assessment.term, year: assessment.year } : null,
    latestAssessmentId: assessment?.id ?? null,
  }
}

/**
 * @param allAssessments must be pre-sorted descending by `created_at` (the caller's DB query does this) — the "latest per student" lookup relies on first-occurrence-wins.
 * @param allSessions must be pre-sorted descending by `updated_at`, same reasoning.
 * @param nowMs injected `Date.now()` for deterministic tests — the route passes the real value.
 */
export function computeClassDetailProjection(params: {
  cls: unknown
  links: StudentLink[]
  studentData: StudentRow[]
  allAssessments: AssessmentRow[]
  allSessions: SessionRow[]
  nowMs: number
}): ClassDetailProjection {
  const { cls, links, studentData, allAssessments, allSessions, nowMs } = params

  const latestAssessmentByStudent = new Map<string, AssessmentRow>()
  for (const a of allAssessments) {
    if (!latestAssessmentByStudent.has(a.student_id)) latestAssessmentByStudent.set(a.student_id, a)
  }

  const latestSessionByStudent = new Map<string, string>()
  for (const s of allSessions) {
    if (!latestSessionByStudent.has(s.learner_id)) latestSessionByStudent.set(s.learner_id, s.updated_at)
  }

  const subjectAggregates: Record<string, number[]> = {}

  const students = studentData.map(student => {
    const assessment = latestAssessmentByStudent.get(student.id) ?? null
    const lastActive = latestSessionByStudent.get(student.id) ?? null
    const link = links.find(l => l.student_id === student.id)

    if (assessment?.subject_scores) {
      Object.entries(assessment.subject_scores).forEach(([subj, score]) => {
        if (!subjectAggregates[subj]) subjectAggregates[subj] = []
        subjectAggregates[subj].push(score)
      })
    }

    return buildStudentPayload(student, assessment, lastActive, link, nowMs)
  })

  const subjectInsights: SubjectInsight[] = Object.entries(subjectAggregates)
    .map(([subject, scores]) => {
      const raw = rawMean(scores)! // subjectAggregates entries are only ever created with a first push, so never empty
      return {
        subject,
        avg: averageScore(scores)!,
        level: getStandingLabel(raw, 'long'),
        distribution: classifyStandingDistribution(scores),
        studentsBelow: 0, // filled below, after distribution is known
      }
    })
    .map(insight => ({ ...insight, studentsBelow: insight.distribution.below + insight.distribution.approaching }))
    .sort((a, b) => a.avg - b.avg)

  const topGaps = subjectInsights.slice(0, 3)

  const recommendations: string[] = []
  if (topGaps[0] && topGaps[0].studentsBelow > 0) {
    recommendations.push(
      `${topGaps[0].studentsBelow} students need support in ${topGaps[0].subject} (avg ${topGaps[0].avg}/4)`
    )
  }

  return { class: cls, students, insights: subjectInsights, topGaps, recommendations }
}
