// lib/gradebook/gradebook.ts
// LMS Basics Phase 0b — a real gradebook: one matrix of every student x
// every assessment/assignment for a class, computed from the same
// canonical tables the per-assessment mark-entry UI already writes to
// (class_assessments/learner_marks via assessment.repository.ts) plus
// assignments/assignment_submissions. Read-only aggregation — no new
// write path, no new identity. Server-only (uses the service-role
// client) — pure types/functions live in gradebookPure.ts so client
// components (the CSV export button) can import those without pulling in
// the service-role key.

import { createServiceClient } from '@/utils/supabase/service'
import { AssessmentRepository } from '@/lib/repositories/assessment.repository'
import { mergeGradebook, type Gradebook } from './gradebookPure'

export type { Gradebook, GradebookColumn, GradebookRow } from './gradebookPure'
export { gradebookToCSV } from './gradebookPure'

export async function buildGradebook(classId: string, teacherId: string): Promise<Gradebook> {
  const db = createServiceClient()
  const repo = new AssessmentRepository()

  const [{ data: roster }, assessments, { data: assignments }] = await Promise.all([
    db
      .from('class_students')
      .select('student_id, students(id, name)')
      .eq('class_id', classId),
    repo.findAssessmentsByClass(classId, teacherId),
    db
      .from('assignments')
      .select('id, title, due_date, max_score')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .order('due_date', { ascending: true }),
  ])

  type RosterRow = { student_id: string; students: { id: string; name: string } | { id: string; name: string }[] | null }
  const students = ((roster ?? []) as RosterRow[])
    .map(r => (Array.isArray(r.students) ? r.students[0] : r.students))
    .filter((s): s is { id: string; name: string } => !!s)
    // de-dupe — a student can appear once per roster row, but guard anyway
    .filter((s, idx, arr) => arr.findIndex(x => x.id === s.id) === idx)

  const assessmentIds = assessments.map(a => a.id)
  const marks = assessmentIds.length ? await repo.findMarksByAssessmentIds(assessmentIds) : []

  const assignmentIds = (assignments ?? []).map(a => a.id)
  const { data: submissions } = assignmentIds.length
    ? await db
        .from('assignment_submissions')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignmentIds)
    : { data: [] as Array<{ assignment_id: string; student_id: string; score: number | null }> }

  return mergeGradebook({
    students,
    assessments,
    assignments: assignments ?? [],
    marks,
    submissions: (submissions ?? []) as Array<{ assignment_id: string; student_id: string; score: number | null }>,
  })
}
