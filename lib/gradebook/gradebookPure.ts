// lib/gradebook/gradebookPure.ts
// Pure types + functions only — no Supabase import, safe to import from a
// client component (the CSV export button does exactly that). All DB
// access lives in gradebook.ts, which is server-only.

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

/** Merges roster/assessments/assignments/marks/submissions into a Gradebook. */
export function mergeGradebook(input: {
  students: Array<{ id: string; name: string }>
  assessments: Array<{ id: string; title: string; max_score: number; created_at: string }>
  assignments: Array<{ id: string; title: string; due_date: string; max_score: number | null }>
  marks: Array<{ assessment_id: string; student_id: string | null; total_marks: number | null }>
  submissions: Array<{ assignment_id: string; student_id: string; score: number | null }>
}): Gradebook {
  const columns: GradebookColumn[] = [
    ...input.assessments.map(a => ({
      id: a.id, kind: 'assessment' as const, title: a.title, maxScore: a.max_score, date: a.created_at,
    })),
    ...input.assignments.map(a => ({
      id: a.id, kind: 'assignment' as const, title: a.title, maxScore: a.max_score ?? 100, date: a.due_date,
    })),
  ]

  const rows: GradebookRow[] = input.students.map(s => {
    const scores: Record<string, number | null> = {}
    for (const a of input.assessments) {
      const mark = input.marks.find(m => m.assessment_id === a.id && m.student_id === s.id)
      scores[a.id] = mark?.total_marks ?? null
    }
    for (const a of input.assignments) {
      const sub = input.submissions.find(sub => sub.assignment_id === a.id && sub.student_id === s.id)
      scores[a.id] = sub?.score ?? null
    }
    return { studentId: s.id, studentName: s.name, scores }
  })

  return { columns, rows }
}

/** Serializes a Gradebook to CSV for export. */
export function gradebookToCSV(gradebook: Gradebook): string {
  const header = ['Student', ...gradebook.columns.map(c => `${c.title} (/${c.maxScore})`)]
  const lines = [header.join(',')]
  for (const row of gradebook.rows) {
    const cells = [row.studentName, ...gradebook.columns.map(c => row.scores[c.id] ?? '')]
    lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  }
  return lines.join('\n')
}
