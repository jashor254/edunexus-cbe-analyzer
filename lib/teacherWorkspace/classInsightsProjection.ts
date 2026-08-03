// lib/teacherWorkspace/classInsightsProjection.ts
//
// Teacher Workspace Projection Extraction — extracted from
// app/api/teacher/classes/[classId]/insights/route.ts GET. Same 3-query
// batching the original route already used; no query-count change, only
// the move of the risk-map/subject-distribution assembly into a tested,
// reusable module.

import { createServiceClient } from '@/utils/supabase/service'
import {
  computeClassInsightsProjection,
  type ClassInsightsProjection,
  type InsightsSessionRow,
  type InsightsAssessmentRow,
  type InsightsStudentRow,
} from './classInsightsProjectionPure'

const EMPTY_PROJECTION: ClassInsightsProjection = {
  totalStudents: 0,
  activeStudents: 0,
  holidayRisk: [],
  subjectDistribution: {},
  riskLevels: { high: 0, medium: 0, low: 0 },
}

export async function getTeacherClassInsightsProjection(
  classId: string,
  teacherId: string,
): Promise<ClassInsightsProjection | null> {
  const db = createServiceClient()

  const { data: cls } = await db
    .from('teacher_classes')
    .select('id, subject')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .single()

  if (!cls) return null

  const { data: studentLinks } = await db
    .from('class_students')
    .select('student_id')
    .eq('class_id', classId)

  const studentIds = (studentLinks ?? []).map((s: { student_id: string }) => s.student_id)

  if (studentIds.length === 0) return EMPTY_PROJECTION

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

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

  return computeClassInsightsProjection({
    studentIds,
    sessions: (sessionsResult.data ?? []) as InsightsSessionRow[],
    assessments: (assessmentsResult.data ?? []) as InsightsAssessmentRow[],
    students: (studentsResult.data ?? []) as InsightsStudentRow[],
    nowMs: Date.now(),
  })
}
