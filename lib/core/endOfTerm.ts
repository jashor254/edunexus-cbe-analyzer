// lib/core/endOfTerm.ts
// Sprint 19 — a lightweight End-of-Term workflow. This orchestrates existing
// Core services in sequence; it contains no scoring, grading, or reporting
// logic of its own.
//
// Note on scope: the Holiday Planner (lib/holiday/planner.ts) operates on
// the *legacy* schema (students, teacher_classes, holiday_plans keyed by
// student_id/teacher_id), while Core end-of-term operates on
// learner_enrollments/class_assessments/school_report_cards keyed by
// class_id/term_id. There is no existing bridge between a Core class_id and
// a legacy teacher_classes.id (see lib/compass/ownership.ts's note on Core
// identity convergence being out of scope pre-Phase 11), so holiday-plan
// publication is deliberately NOT included here — wiring it in would mean
// inventing a new cross-schema mapping, which this sprint does not permit.

import {
  listAssessments,
  computeTermSummaries,
} from '@/lib/core/assessments'
import { generateReportCards, publishReportCards } from '@/lib/core/report-cards'
import { listTerms, createTerm, setCurrentTerm, getSchoolSettings } from '@/lib/core/school'
import type { Term } from '@/types/core'

export type EndOfTermInput = {
  // Sprint 12B — the already-verified admin actor, threaded through to
  // generateReportCards, which now calls the Attendance service (every
  // Attendance read requires an authorized actor, per ADR-0003/ADR-0004).
  actorUserId: string
  schoolId: string
  classId:  string
  termId:   string
  // class_assessments is keyed by a raw term/year pair, not term_id — see
  // the assessment-lock step below. Caller supplies these explicitly rather
  // than this module guessing at a term_id → term/year mapping.
  term:     string
  year:     number
  nextTerm: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
  gradeBoundaries?: Record<string, { min: number }>
}

export type EndOfTermResult =
  | { ok: false; reason: 'unpublished_assessments'; unpublished: Array<{ id: string; title: string }> }
  | {
      ok: true
      reportCardsGenerated: number
      reportCardsPublished: number
      nextTermId: string
    }

export async function runEndOfTerm(input: EndOfTermInput): Promise<EndOfTermResult> {
  // 1. Lock check — every assessment for this class/term must already be
  //    published. No auto-publish: a teacher must explicitly publish every
  //    assessment first (confirmed with user — see Sprint 19 report).
  const assessments = await listAssessments(input.classId, { term: input.term, year: input.year })
  const unpublished = assessments.filter(a => !a.is_published)
  if (unpublished.length > 0) {
    return {
      ok: false,
      reason: 'unpublished_assessments',
      unpublished: unpublished.map(a => ({ id: a.id, title: a.title })),
    }
  }

  // 2. Aggregate scores, then generate + publish report cards.
  const gradeBoundaries =
    input.gradeBoundaries ?? (await getSchoolSettings(input.schoolId)).grade_boundaries

  await computeTermSummaries(input.schoolId, input.classId, input.termId, gradeBoundaries)
  const { generated } = await generateReportCards(input.actorUserId, input.schoolId, input.classId, input.termId, gradeBoundaries)
  const { published } = await publishReportCards(input.actorUserId, input.schoolId, input.termId, input.classId, 'end_of_term')

  // 3. Next-term prep. The lock check and report-card generation above are
  //    pure recomputation + upsert (safe to repeat), but term creation is
  //    not — a second run with the same nextTerm would otherwise hit the
  //    existing (school_id, academic_year_id, term_number) unique
  //    constraint and fail ungracefully. If a term for this academic
  //    year + term_number already exists, this is a duplicate End-of-Term
  //    run (or the term was already prepared) — reuse it instead of
  //    re-inserting. listTerms is the existing lookup this reuses; the
  //    unique constraint remains the backstop for a genuine concurrent race.
  const existingTerms   = await listTerms(input.schoolId, input.nextTerm.academic_year_id)
  const alreadyPrepared = existingTerms.find(t => t.term_number === input.nextTerm.term_number)
  const newTerm         = alreadyPrepared ?? await createTerm(input.schoolId, input.nextTerm)

  // setCurrentTerm (lib/core/school.ts) already clears the previous current
  // term first — that IS the archive step, no separate flag needed. Calling
  // it again when newTerm is already current is a harmless no-op.
  await setCurrentTerm(input.schoolId, newTerm.id)

  return {
    ok: true,
    reportCardsGenerated: generated,
    reportCardsPublished: published,
    nextTermId: newTerm.id,
  }
}
