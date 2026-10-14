// lib/paperIntelligence/scriptRoster.ts
//
// Server-only — the capture screen's class list: every learner with a
// submission on this assignment, how many script pages are captured, and the
// AI marking status. Three batched queries for the whole class, never one per
// learner. Callers authorize first (requireAssignmentClassTeacher).

import { createServiceClient } from '@/utils/supabase/service'
import { findRubricsForAssignment } from './rubrics'
import { listPageNumbersForSubmissions } from './scriptPages'
import { findScriptMarkTotalsForAssignment, type ScriptMarkTotals } from './scriptMarks'

export type ScriptRosterEntry = {
  submissionId: string
  studentId: string
  name: string
  pageNumbers: number[]
  marks: ScriptMarkTotals | null
}

export type ScriptRoster = {
  learners: ScriptRosterEntry[]
  rubricCount: number
  maxTotal: number
}

export async function getScriptRoster(assignmentId: string): Promise<ScriptRoster> {
  const db = createServiceClient()
  const [{ data: submissions, error }, rubrics, markTotals] = await Promise.all([
    db.from('assignment_submissions').select('id, student_id, students(name)').eq('assignment_id', assignmentId),
    findRubricsForAssignment(assignmentId),
    findScriptMarkTotalsForAssignment(assignmentId),
  ])
  if (error) throw new Error(`getScriptRoster: ${error.message}`)

  const rows = (submissions ?? []) as unknown as Array<{ id: string; student_id: string; students: { name: string } | null }>
  const pages = await listPageNumbersForSubmissions(rows.map(r => r.id))

  return {
    learners: rows
      .map(r => ({
        submissionId: r.id,
        studentId: r.student_id,
        name: r.students?.name ?? 'Unnamed learner',
        pageNumbers: pages.get(r.id) ?? [],
        marks: markTotals.get(r.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    rubricCount: rubrics.length,
    maxTotal: rubrics.reduce((s, r) => s + r.max_marks, 0),
  }
}
