// lib/teacherWorkspace/classDetailProjection.ts
//
// Teacher Workspace Projection Extraction — extracted from
// app/api/teacher/classes/[classId]/route.ts GET. Same 3-query batching the
// original route already used (`Promise.all` over students/assessments/
// compass_sessions) — this route never had the N+1 problem the class-list
// route had, so no query-count change here, only the move of the
// `buildStudentPayload` closure and subject-insight math into a tested,
// reusable module.

import { createServiceClient } from '@/utils/supabase/service'
import {
  computeClassDetailProjection,
  type ClassDetailProjection,
  type StudentLink,
  type StudentRow,
  type AssessmentRow,
  type SessionRow,
} from './classDetailProjectionPure'

export async function getTeacherClassDetailProjection(
  classId: string,
  teacherId: string,
): Promise<ClassDetailProjection | null> {
  const db = createServiceClient()

  const { data: cls } = await db
    .from('teacher_classes')
    .select('id, teacher_id, name, grade, subject, class_code, created_at')
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .single()

  if (!cls) return null

  const { data: studentLinks } = await db
    .from('class_students')
    .select('student_id, parent_id, joined_at')
    .eq('class_id', classId)

  const links = (studentLinks ?? []) as StudentLink[]
  const studentIds = links.map(s => s.student_id)

  if (studentIds.length === 0) {
    return computeClassDetailProjection({
      cls, links, studentData: [], allAssessments: [], allSessions: [], nowMs: Date.now(),
    })
  }

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

  return computeClassDetailProjection({
    cls,
    links,
    studentData: (studentData ?? []) as StudentRow[],
    allAssessments: (allAssessments ?? []) as AssessmentRow[],
    allSessions: (allSessions ?? []) as SessionRow[],
    nowMs: Date.now(),
  })
}
