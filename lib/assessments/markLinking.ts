// lib/assessments/markLinking.ts
//
// Resolves a saved mark to the learner it belongs to.
//
// This exists because the previous rule resolved `learner_marks.student_id`
// exclusively through `students.admission_number` — a column that does not
// exist on `students`. The repository read swallowed the resulting PostgREST
// error (`const { data } = ...`, no error check) and returned an empty list,
// so every mark entered through the teacher gradebook was written with
// `student_id: null`. Nothing failed and nothing was logged; the marks simply
// belonged to no one. `recordAssessmentEvidence` attributes Evidence by
// `student_id`, so no teacher-entered mark ever produced Evidence, and
// Projection — and therefore Blueprint, Career Intelligence and Adaptive
// Learning — never moved from a teacher's own marks.
//
// The roster is the authority here, not a free-text field on the mark: a mark
// is saved against a class, and a class has a definite set of learners. Name
// matching is confined to that roster, so it is a small closed set rather than
// a search across every learner in the platform.

/** A roster entry a mark can be linked to. */
export type LinkableLearner = {
  id: string
  name: string
  external_id: string | null
  upi: string | null
}

export type LinkableMark = {
  studentName: string
  admNo?: string
}

/**
 * Normalises a learner name for comparison: case-insensitive, punctuation-
 * insensitive, and insensitive to repeated or leading/trailing whitespace.
 * Deliberately does NOT reorder words — "Wairimu Margaret" is not assumed to
 * be "Margaret Wairimu", because for two siblings on one roster that guess
 * attaches marks to the wrong child, and a null link is recoverable where a
 * wrong link is not.
 */
export function normaliseLearnerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export type MarkLinker = (mark: LinkableMark) => string | null

/**
 * Builds a resolver over one class roster.
 *
 * Identifier match (`external_id`, `upi`) wins over name match — an explicit
 * identifier is a stronger claim than a typed name. A name that appears twice
 * on the roster resolves to null rather than guessing between two learners.
 */
export function buildMarkLinker(roster: LinkableLearner[]): MarkLinker {
  const byIdentifier = new Map<string, string>()
  const byName = new Map<string, string | null>() // null = ambiguous

  for (const learner of roster) {
    for (const identifier of [learner.external_id, learner.upi]) {
      const key = identifier?.trim().toLowerCase()
      if (key) byIdentifier.set(key, learner.id)
    }

    const nameKey = normaliseLearnerName(learner.name)
    if (!nameKey) continue
    byName.set(nameKey, byName.has(nameKey) ? null : learner.id)
  }

  return (mark: LinkableMark): string | null => {
    const adm = mark.admNo?.trim().toLowerCase()
    if (adm) {
      const byAdm = byIdentifier.get(adm)
      if (byAdm) return byAdm
    }
    return byName.get(normaliseLearnerName(mark.studentName)) ?? null
  }
}
