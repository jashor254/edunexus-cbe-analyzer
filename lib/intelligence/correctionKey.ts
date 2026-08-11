// lib/intelligence/correctionKey.ts
//
// Phase E2 — the canonical constructor for `learner_evidence.correction_key`.
//
// A correction key names the underlying educational ARTIFACT a piece of
// evidence came from, so the Evidence Domain can eventually tell a
// CORRECTION ("the teacher regraded that submission") from a NEW OBSERVATION
// ("she did a second quiz on the same sub-strand"). Today it is written and
// nothing reads it — `claimKey()` still drives every supersession decision.
// E3 measures the disagreement; E4 decides the cutover.
//
// TWO RULES THAT MUST NEVER BE BROKEN
//
//   1. A key contains only IMMUTABLE identity. Never a score, level,
//      outcome, confidence, review state or timestamp. This is exactly why
//      `raw_input_ref` could not be reused: three producers embed mutable
//      values in it (`assignment:<id>:score=16/20`,
//      `formative_signal:...:<outcome>`), so a regrade produces a different
//      ref than the mark it corrects — the opposite of stable identity.
//
//   2. The namespace is bound to the producing source. `assignments` and
//      `quizzes` both key on `assignments.id`, so without namespacing the
//      same UUID would mean two different artifacts — which is already the
//      live ambiguity in `raw_input_ref`. Binding namespace to source also
//      closes the trust hole (Phase E1 §13): a parent-observation producer
//      cannot mint `assignment_mark:<id>` and later supersede a teacher's
//      tier-3 mark, because the eventual lookup is scoped to
//      (learner, evidence_source, correction_key).
//
// NULL is a first-class answer. An observation-only producer (formative
// signals, parent observations, intervention check-ins, holiday returns) has
// no correctable artifact, and saying so honestly is better than inventing
// one. Those producers pass nothing and persist NULL.

import type { EvidenceSource } from './evidence'

/**
 * The artifact families that can be corrected. Deliberately closed: a
 * producer cannot invent a namespace, because an unvalidated string would
 * quietly become global identity.
 */
export type CorrectionNamespace =
  | 'assignment_mark'          // a learner's mark on a teacher-set assignment
  | 'quiz_attempt'             // a learner's auto-graded quiz attempt
  | 'class_assessment_result'  // one subject cell of a class assessment
  | 'report_card_result'       // one subject cell of a report-card assessment

/**
 * Which sources may legitimately claim each namespace. Enforced at
 * construction so a mis-wired producer fails loudly here rather than
 * silently minting an identity in someone else's space.
 */
const NAMESPACE_SOURCES: Record<CorrectionNamespace, readonly EvidenceSource[]> = {
  assignment_mark:         ['teacher_upload'],
  quiz_attempt:            ['quiz_auto_grade'],
  class_assessment_result: ['teacher_upload'],
  // The Clinic/report-card family is entered by a teacher OR a parent
  // (Phase 1 / P0-B). Both describe the same artifact; their differing trust
  // tier and review status are carried by `evidence_source`, not by the key.
  report_card_result:      ['teacher_upload', 'parent_observation'],
}

/** A key segment must be a stable identifier — no separators, no empties. */
function assertSegment(value: string, label: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new Error(`correctionKey: "${label}" is required and must be non-empty`)
  if (trimmed.includes(':')) throw new Error(`correctionKey: "${label}" must not contain ":" (got "${trimmed}")`)
  return trimmed
}

function build(namespace: CorrectionNamespace, source: EvidenceSource, segments: string[]): string {
  const allowed = NAMESPACE_SOURCES[namespace]
  if (!allowed.includes(source)) {
    throw new Error(
      `correctionKey: evidence source "${source}" may not mint a "${namespace}" key ` +
      `(allowed: ${allowed.join(', ')}). A producer must never claim another producer's artifact identity.`
    )
  }
  return [namespace, ...segments].join(':')
}

/**
 * A learner's mark on one teacher-set assignment.
 *
 * `(assignmentId, studentId)` IS the artifact: there is one submission per
 * learner per assignment, and a regrade changes its score while leaving that
 * pair identical. A separate submission id was considered and rejected — it
 * is not available at the marking call site, and adding it would carry no
 * extra identity, since the pair already names exactly one correctable thing.
 */
export function assignmentMarkKey(input: { assignmentId: string; studentId: string; source: EvidenceSource }): string {
  return build('assignment_mark', input.source, [
    assertSegment(input.assignmentId, 'assignmentId'),
    assertSegment(input.studentId, 'studentId'),
  ])
}

/**
 * A learner's auto-graded attempt at one quiz.
 *
 * Keys on the same `assignments.id` as {@link assignmentMarkKey} but in a
 * different namespace ON PURPOSE — this is the single change that makes the
 * existing `assignment:<id>` ambiguity impossible to inherit.
 */
export function quizAttemptKey(input: { assignmentId: string; studentId: string; source: EvidenceSource }): string {
  return build('quiz_attempt', input.source, [
    assertSegment(input.assignmentId, 'assignmentId'),
    assertSegment(input.studentId, 'studentId'),
  ])
}

/**
 * One subject cell of one class assessment.
 *
 * `subject` is part of the identity because a single `learner_marks` row
 * holds a whole `subject_scores` map — one row produces several independent
 * result artifacts, and correcting the Maths cell must not touch the English
 * one. The canonical (post-mapping) subject is used so a raw-name change
 * cannot fork the identity.
 */
export function classAssessmentResultKey(input: {
  assessmentId: string; studentId: string; canonicalSubject: string; source: EvidenceSource
}): string {
  return build('class_assessment_result', input.source, [
    assertSegment(input.assessmentId, 'assessmentId'),
    assertSegment(input.studentId, 'studentId'),
    assertSegment(input.canonicalSubject, 'canonicalSubject'),
  ])
}

/** One subject cell of one report-card / Academic Clinic assessment. Same cell reasoning as above. */
export function reportCardResultKey(input: {
  assessmentId: string; studentId: string; canonicalSubject: string; source: EvidenceSource
}): string {
  return build('report_card_result', input.source, [
    assertSegment(input.assessmentId, 'assessmentId'),
    assertSegment(input.studentId, 'studentId'),
    assertSegment(input.canonicalSubject, 'canonicalSubject'),
  ])
}

/** The namespace a key belongs to, or null if it is unrecognised. Read-only helper for E3's shadow harness. */
export function correctionKeyNamespace(key: string | null | undefined): CorrectionNamespace | null {
  if (!key) return null
  const ns = key.split(':')[0] as CorrectionNamespace
  return ns in NAMESPACE_SOURCES ? ns : null
}
