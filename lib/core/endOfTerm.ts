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
import { listTerms, createTerm, setCurrentTerm, getCurrentTerm, getSchoolSettings } from '@/lib/core/school'
import { rollEnrollmentsToTerm } from '@/lib/core/learners'
import { listClasses } from '@/lib/core/classes'
import { ValidationError } from '@/lib/core/errors'
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

  // 4. Phase 4 (Task C) — carry this class's CURRENT roster forward into
  //    the new term. Without this, the morning the term turns, every class
  //    roster the platform can compute for input.classId goes empty — the
  //    Phase 3 audit's P0 finding. Idempotent (see rollEnrollmentsToTerm's
  //    own comment), so safe on retry alongside steps 1-3 above.
  await rollEnrollmentsToTerm(input.schoolId, input.classId, input.termId, newTerm.id, newTerm.academic_year_id)

  return {
    ok: true,
    reportCardsGenerated: generated,
    reportCardsPublished: published,
    nextTermId: newTerm.id,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 12 (DR-05/DR-03/self-service term closure) — runEndOfTerm() above is
// semantically CLASS-level (its whole surface — assessments, report cards —
// is keyed by one classId+termId) but mutates SCHOOL-level state
// (setCurrentTerm) on every single call. Nothing before this phase ever
// called it more than once per term closure, because nothing called it at
// all outside tests (DR-03) — but the moment a real principal exists with
// more than one class, closing 7A alone must not silently advance the
// school to Term 2 while 7B/8A are still sitting in Term 1 (DR-05, found in
// the Phase 10 rehearsal). runEndOfTerm() itself is deliberately left
// completely unchanged (endOfTermFullChain.test.ts exercises its exact
// single-class contract) — this is new, additive orchestration built from
// the same underlying steps, not a rewrite of the old function.
//
// The finalize step (lock check + report cards) is genuinely per-class and
// safe to redo. Term creation and the roll-forward are resolved ONCE, up
// front, for the whole school — never per class — so a retry after a
// partial failure cannot recreate the destination term or double-flip the
// current-term pointer.

/** The final term of any academic year — Term 3, per the existing term_number 1–3 model this codebase already uses everywhere (see TermSchema in app/api/core/academic-years/route.ts). Not configurable per school; CBC's own three-term calendar is the canonical assumption already baked into every term-creation call site. */
const FINAL_TERM_NUMBER = 3

export type ClassFinalizeResult =
  | { ok: false; classId: string; className: string; reason: string }
  | { ok: true; classId: string; reportCardsGenerated: number; reportCardsPublished: number }

async function finalizeClassTerm(input: {
  actorUserId: string
  schoolId: string
  classId: string
  className: string
  termId: string
  term: string
  year: number
  gradeBoundaries: Record<string, { min: number }>
}): Promise<ClassFinalizeResult> {
  const assessments = await listAssessments(input.classId, { term: input.term, year: input.year })
  const unpublished = assessments.filter(a => !a.is_published)
  if (unpublished.length > 0) {
    return { ok: false, classId: input.classId, className: input.className, reason: `${unpublished.length} unpublished assessment(s) — lock every assessment for this class before closing the term.` }
  }

  try {
    await computeTermSummaries(input.schoolId, input.classId, input.termId, input.gradeBoundaries)
    const { generated } = await generateReportCards(input.actorUserId, input.schoolId, input.classId, input.termId, input.gradeBoundaries)
    const { published } = await publishReportCards(input.actorUserId, input.schoolId, input.termId, input.classId, 'end_of_term')
    return { ok: true, classId: input.classId, reportCardsGenerated: generated, reportCardsPublished: published }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // A class that was already fully finalized in an earlier, partial
    // school-wide attempt hits generateReportCards's own "already
    // published" guard on retry — that is a completed class, not a new
    // failure. Reported here as a distinct sentinel so the orchestrator can
    // tell "already done" apart from a real error and skip it silently,
    // same as the loop's own idempotent-retry design.
    if (/already published/i.test(message)) {
      return { ok: true, classId: input.classId, reportCardsGenerated: 0, reportCardsPublished: 0 }
    }
    return { ok: false, classId: input.classId, className: input.className, reason: message }
  }
}

export type RunSchoolEndOfTermResult =
  | { ok: false; failures: Array<{ classId: string; className: string; reason: string }> }
  | { ok: true; academicYearComplete: true; classResults: ClassFinalizeResult[] }
  | { ok: true; academicYearComplete: false; nextTermId: string; classResults: ClassFinalizeResult[] }

/**
 * The one canonical school-level "Close Term" operation. Finalizes report
 * cards for every class currently in the school's academic year, then EITHER:
 *   - rolls every class's current roster into the next term and advances the
 *     school's global current term (Term 1 → 2, Term 2 → 3), or
 *   - for Term 3 (FINAL_TERM_NUMBER), finalizes reports only — no term is
 *     created, no enrollment is rolled, and the school's current term is left
 *     exactly where it is. There is no Term 4 to roll into within the same
 *     academic year; the correct next step is annual promotion into a NEW
 *     academic year (Phase 11), a deliberately separate operation this
 *     function does not perform.
 *
 * The current-term pointer only ever advances after EVERY class has
 * finalized successfully — never per class, never partially.
 */
export async function runSchoolEndOfTerm(
  schoolId: string,
  actorUserId: string,
  currentTermId: string,
  nextTerm?: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
): Promise<RunSchoolEndOfTermResult> {
  const currentTerm = await getCurrentTerm(schoolId)
  if (!currentTerm || currentTerm.id !== currentTermId) {
    throw new ValidationError('This is no longer the school\'s current term — refresh and try again.')
  }

  const isFinalTerm = currentTerm.term_number === FINAL_TERM_NUMBER
  if (!isFinalTerm && !nextTerm) {
    throw new ValidationError('The next term\'s details are required to close this term.')
  }

  const gradeBoundaries = (await getSchoolSettings(schoolId)).grade_boundaries
  const classes = await listClasses(schoolId, currentTerm.academic_year_id)
  const term = String(currentTerm.term_number)
  const year = new Date(currentTerm.start_date).getFullYear()

  const results = await Promise.all(classes.map(cls => finalizeClassTerm({
    actorUserId, schoolId, classId: cls.id, className: cls.display_name ?? cls.class_name ?? cls.id,
    termId: currentTermId, term, year, gradeBoundaries,
  })))

  const failures = results.filter((r): r is Extract<ClassFinalizeResult, { ok: false }> => !r.ok)
  if (failures.length > 0) {
    return { ok: false, failures: failures.map(f => ({ classId: f.classId, className: f.className, reason: f.reason })) }
  }

  if (isFinalTerm) {
    return { ok: true, academicYearComplete: true, classResults: results }
  }

  // Resolved/created ONCE for the whole school — never per class — exactly
  // the find-or-create idempotency runEndOfTerm's own single-class version
  // already established, reused here at school scope instead.
  const existingTerms = await listTerms(schoolId, nextTerm!.academic_year_id)
  const newTerm = existingTerms.find(t => t.term_number === nextTerm!.term_number) ?? await createTerm(schoolId, nextTerm!)

  await Promise.all(classes.map(cls =>
    rollEnrollmentsToTerm(schoolId, cls.id, currentTermId, newTerm.id, newTerm.academic_year_id)
  ))

  // Only now, after every class has finalized AND every class's roster has
  // rolled forward, does the school-wide pointer move — the exact ordering
  // DR-05 was missing.
  await setCurrentTerm(schoolId, newTerm.id)

  return { ok: true, academicYearComplete: false, nextTermId: newTerm.id, classResults: results }
}
