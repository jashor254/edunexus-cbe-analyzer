// lib/assessments/subjectMarkMerge.ts
//
// Pure — how ONE subject's marks merge into a termly assessment's existing
// learner_marks rows. Used when a teacher files a marked paper (Mark Papers)
// into an Opener / CAT / Mid-Term / End-Term / SBA: the paper is one subject,
// the assessment row per learner holds every subject. The CSV and bulk-save
// paths replace a learner's whole subject_scores; this path must never touch
// another subject's mark.
//
// Matching an existing row: by student_id first (the authoritative link).
// Failing that, by normalised name — but only onto a row that has no
// student_id yet. A name match onto a row already linked to a DIFFERENT
// learner is refused, never overwritten: learner_marks is unique on
// (assessment_id, student_name), so writing it would replace another child's
// marks. A refused entry is reported back for the teacher to resolve.

import { normaliseLearnerName } from './markLinking'

export type ExistingAssessmentMark = {
  student_name: string
  admission_number: string | null
  student_id: string | null
  subject_scores: Record<string, number>
}

export type SubjectMarkEntry = {
  studentId: string
  studentName: string
  score: number
}

export type MergedMarkRow = {
  student_name: string
  admission_number: string | null
  student_id: string
  subject_scores: Record<string, number>
}

export type MergeOutcome = {
  rows: MergedMarkRow[]
  refused: Array<{ studentId: string; studentName: string; reason: string }>
}

export function mergeSubjectIntoMarks(
  existing: ExistingAssessmentMark[],
  subject: string,
  entries: SubjectMarkEntry[],
): MergeOutcome {
  const byStudentId = new Map<string, ExistingAssessmentMark>()
  const byName = new Map<string, ExistingAssessmentMark>()
  for (const row of existing) {
    if (row.student_id) byStudentId.set(row.student_id, row)
    byName.set(normaliseLearnerName(row.student_name), row)
  }

  const outcome: MergeOutcome = { rows: [], refused: [] }
  const writtenNames = new Set<string>()

  for (const entry of entries) {
    let match = byStudentId.get(entry.studentId)
    if (!match) {
      const named = byName.get(normaliseLearnerName(entry.studentName))
      if (named && named.student_id && named.student_id !== entry.studentId) {
        outcome.refused.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          reason: `Another learner named "${named.student_name}" already has marks in this assessment.`,
        })
        continue
      }
      match = named
    }

    const studentName = match?.student_name ?? entry.studentName
    const nameKey = normaliseLearnerName(studentName)
    if (writtenNames.has(nameKey)) {
      outcome.refused.push({ studentId: entry.studentId, studentName: entry.studentName, reason: 'Two learners share this name on the paper.' })
      continue
    }
    writtenNames.add(nameKey)

    outcome.rows.push({
      student_name: studentName,
      admission_number: match?.admission_number ?? null,
      student_id: entry.studentId,
      subject_scores: { ...(match?.subject_scores ?? {}), [subject]: entry.score },
    })
  }

  return outcome
}

/**
 * A paper marked out of `paperOutOf` filed into an assessment whose subjects
 * are out of `assessmentMax`: proportional, rounded to a whole mark (the
 * assessment marks paths store whole marks). Identity when they match.
 */
export function convertScore(score: number, paperOutOf: number, assessmentMax: number): number {
  if (paperOutOf <= 0) throw new Error('A paper must be marked out of more than 0.')
  if (paperOutOf === assessmentMax) return score
  return Math.round((score * assessmentMax) / paperOutOf)
}
