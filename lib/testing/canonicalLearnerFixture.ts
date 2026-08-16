// lib/testing/canonicalLearnerFixture.ts
//
// H2C shared fixture — ONE canonical educational history reused by multiple
// cross-surface consistency tests (lib/learnerBlueprint, lib/career,
// lib/projection). Deliberately not a framework: three plain functions
// returning LearnerEvidence arrays, seeded through the real
// persistEvidenceBatch() pipeline by each test's own before()/after() —
// this module owns no DB lifecycle itself.
//
// The history, fixed and non-random:
//
//   Mathematics — persistent historical gap, then recent measurable
//     improvement: Level 1 (2026 Term 1), Level 1 (2026 Term 2),
//     Level 3 (2026 Term 3). Three independent assignments (distinct
//     correctionKeys), not corrections of each other.
//
//   English — stable strength: Level 4 across all three terms.
//
//   Science — moderate/uncertain, a single Term 3 signal only.
//
// Fixed timestamps throughout (no Date.now()) so trend/recency computation
// is deterministic across runs.
import { assignmentMarkKey } from '@/lib/intelligence/correctionKey'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

export const CANONICAL_MARKER = 'SYNTHETIC_H2C_CANONICAL'

function baseEvidence(studentId: string, overrides: Partial<LearnerEvidence> & { term: number; academicYear: number }): LearnerEvidence {
  return {
    learnerId: studentId,
    extractedName: CANONICAL_MARKER,
    extractedExternalId: null,
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    score: 50,
    cbcLevel: 2,
    assessmentType: 'cat',
    evidenceSource: 'teacher_upload',
    trustTier: 3,
    evidenceConfidence: 95,
    extractionMethod: 'h2c_canonical_fixture_v1',
    reviewStatus: 'auto_confirmed',
    rawInputRef: 'test',
    importedAt: `2026-0${overrides.term * 2}-01T00:00:00Z`,
    issues: [],
    ...overrides,
  }
}

/**
 * Mathematics: persistent gap (Terms 1-2), then a genuine, recent
 * improvement (Term 3).
 *
 * NOTE ON ORDERING: a single bulk INSERT shares one Postgres
 * statement-level NOW(), so seeding multiple rows meant to represent
 * different points in time in ONE persistEvidenceBatch() call can tie on
 * `created_at` — Projection's chronological sort then falls back to `id`
 * (UUID), unrelated to intended term order. Callers building a single
 * subject's history across terms MUST seed each entry from this array in
 * its own sequential, awaited persistEvidenceBatch() call (see
 * canonicalMathPastTerms / canonicalCurrentTermReportCard below for the
 * split this requires).
 */
export function canonicalMathHistory(studentId: string): LearnerEvidence[] {
  return [1, 2, 3].map(term => baseEvidence(studentId, {
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    cbcLevel: term < 3 ? 1 : 3,
    score: term < 3 ? 28 : 68,
    term,
    academicYear: 2026,
    correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-math-term${term}`, studentId, source: 'teacher_upload' }),
  }))
}

/** Mathematics Terms 1-2 only (the historical-gap portion) — seed sequentially, one call per item. */
export function canonicalMathPastTerms(studentId: string): LearnerEvidence[] {
  return canonicalMathHistory(studentId).slice(0, 2)
}

/**
 * One "report card" moment: Term 3 Mathematics (the recent improvement),
 * Term 3 English (stable strength) and Term 3 Science (sparse/uncertain),
 * all assessed together — a real report card produces several subjects'
 * scores at once, which is exactly the "current moment" multi-subject
 * snapshot extractCapabilityProfile()'s `current` reads from. Seed this
 * array in ONE persistEvidenceBatch() call so all three rows genuinely
 * share one timestamp, the same way a real concurrent report-card import
 * would.
 */
export function canonicalCurrentTermReportCard(studentId: string): LearnerEvidence[] {
  return [
    baseEvidence(studentId, {
      subject: 'mathematics', rawSubject: 'Mathematics', cbcLevel: 3, score: 68, term: 3, academicYear: 2026,
      correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-math-term3`, studentId, source: 'teacher_upload' }),
    }),
    baseEvidence(studentId, {
      subject: 'english', rawSubject: 'English', cbcLevel: 4, score: 95, term: 3, academicYear: 2026,
      correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-english-term3`, studentId, source: 'teacher_upload' }),
    }),
    baseEvidence(studentId, {
      subject: 'integrated_science', rawSubject: 'Integrated Science', cbcLevel: 2, score: 52, term: 3, academicYear: 2026,
      correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-science-term3`, studentId, source: 'teacher_upload' }),
    }),
  ]
}

/** English: stable, uncontested strength across all three terms (sequential — see ordering note above). */
export function canonicalEnglishHistory(studentId: string): LearnerEvidence[] {
  return [1, 2, 3].map(term => baseEvidence(studentId, {
    subject: 'english',
    rawSubject: 'English',
    cbcLevel: 4,
    score: 95,
    term,
    academicYear: 2026,
    correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-english-term${term}`, studentId, source: 'teacher_upload' }),
  }))
}

/** A deliberately contradictory Mathematics-only history: Level 1 -> 4 -> 1, ending exactly where it started (H2B's detectTrend finding fixture). */
export function contradictoryMathHistory(studentId: string): LearnerEvidence[] {
  const levels: LearnerEvidence['cbcLevel'][] = [1, 4, 1]
  const scores = [28, 92, 28]
  return [1, 2, 3].map((term, i) => baseEvidence(studentId, {
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    cbcLevel: levels[i],
    score: scores[i],
    term,
    academicYear: 2026,
    correctionKey: assignmentMarkKey({ assignmentId: `${CANONICAL_MARKER}-contradictory-math-term${term}`, studentId, source: 'teacher_upload' }),
  }))
}
