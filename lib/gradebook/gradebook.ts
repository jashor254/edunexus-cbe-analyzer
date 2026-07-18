// lib/gradebook/gradebook.ts
// LMS Basics Phase 0b — a real gradebook: one matrix of every student x
// every assessment/assignment for a class, computed from the same
// canonical tables the per-assessment mark-entry UI already writes to
// (class_assessments/learner_marks via assessment.repository.ts) plus
// assignments/assignment_submissions. Read-only aggregation — no new
// write path, no new identity.

import { createServiceClient } from '@/utils/supabase/service'
import { AssessmentRepository } from '@/lib/repositories/assessment.repository'

export type GradebookColumn = {
  id: string
  kind: 'assessment' | 'assignment'
  title: string
  maxScore: number
  date: string | null
}

export type GradebookRow = {
  studentId: string
  studentName: string
  scores: Record<string, number | null> // columnId -> score, null if ungraded
}

export type Gradebook = {
  columns: GradebookColumn[]
  rows: GradebookRow[]
}

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

  const columns: GradebookColumn[] = [
    ...assessments.map(a => ({
      id: a.id, kind: 'assessment' as const, title: a.title, maxScore: a.max_score, date: a.created_at,
    })),
    ...(assignments ?? []).map(a => ({
      id: a.id, kind: 'assignment' as const, title: a.title, maxScore: a.max_score ?? 100, date: a.due_date,
    })),
  ]

  const assessmentIds = assessments.map(a => a.id)
  const marks = assessmentIds.length ? await repo.findMarksByAssessmentIds(assessmentIds) : []

  const assignmentIds = (assignments ?? []).map(a => a.id)
  const { data: submissions } = assignmentIds.length
    ? await db
        .from('assignment_submissions')
        .select('assignment_id, student_id, score')
        .in('assignment_id', assignmentIds)
    : { data: [] as Array<{ assignment_id: string; student_id: string; score: number | null }> }

  const rows: GradebookRow[] = students.map(s => {
    const scores: Record<string, number | null> = {}
    for (const a of assessments) {
      const mark = marks.find(m => m.assessment_id === a.id && m.student_id === s.id)
      scores[a.id] = mark?.total_marks ?? null
    }
    for (const a of assignments ?? []) {
      const sub = (submissions ?? []).find(sub => sub.assignment_id === a.id && sub.student_id === s.id)
      scores[a.id] = sub?.score ?? null
    }
    return { studentId: s.id, studentName: s.name, scores }
  })

  return { columns, rows }
}
