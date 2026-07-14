// lib/learnerRecord/timeline.ts
//
// The Learner Record — Phase E
// (docs/architecture/learner-record-layer-decisions.md roadmap Phase E,
// design in learner-record-layer.md §6). Named explicitly, per that
// document's own finding: "getEvidenceHistoryForLearner() already returns
// the full ... evidence history for one learner ... this IS the
// longitudinal timeline. What's missing is not code, it's discoverability
// and scope" — merging in promotion events (Phase A, which didn't exist
// when §6 was written) and giving the result a name a new engineer is
// pointed to first.
//
// THIS is the canonical "what do we know about this learner" entry point.
// Nothing here is new storage or new computation — it is a thin,
// chronological merge of two already-existing, already-correct sources:
// confirmed-and-superseded-and-retracted Evidence, and permanent promotion
// history. No other function in this codebase should reimplement this
// merge — extend this one instead.

import { getEvidenceHistoryForLearner } from '@/lib/intelligence/evidenceLifecycle'
import { getPromotionHistory } from '@/lib/promotions/promote'

export type TimelineEntry =
  | {
      kind: 'evidence'
      date: string
      evidenceId: string
      evidenceSource: string
      subject: string
      score: number | null
      cbcLevel: number | null
      /** The remark body, for teacher_remark evidence (Phase C); null for every other source. */
      body: string | null
      lifecycleState: string
    }
  | {
      kind: 'promotion'
      date: string
      promotionId: string
      fromGrade: number | null
      toGrade: number
      academicYear: string
      notes: string | null
    }

/**
 * The full chronological story for one learner: every piece of Evidence
 * (in whatever lifecycle state it's in — superseded and retracted records
 * are included, since "what actually happened" includes corrections, not
 * just the current answer) merged with every promotion event, oldest
 * first. A UI layer decides how to group this (by grade, by year); this
 * function's job ends at "one true time-ordered sequence," matching the
 * same principle mergeChronologicalScoreHistories (Phase H) already
 * established for a narrower case.
 */
export async function getLearnerTimeline(studentId: string): Promise<TimelineEntry[]> {
  const [evidence, promotions] = await Promise.all([
    getEvidenceHistoryForLearner(studentId),
    getPromotionHistory(studentId),
  ])

  const evidenceEntries: TimelineEntry[] = evidence.map((e) => ({
    kind: 'evidence',
    date: e.created_at,
    evidenceId: e.id,
    evidenceSource: e.evidence_source,
    subject: e.subject,
    score: e.score,
    cbcLevel: e.cbc_level,
    body: (e.payload as { body?: string } | null)?.body ?? null,
    lifecycleState: e.lifecycle_state,
  }))

  const promotionEntries: TimelineEntry[] = promotions.map((p) => ({
    kind: 'promotion',
    date: p.promoted_at,
    promotionId: p.id,
    fromGrade: p.from_grade,
    toGrade: p.to_grade,
    academicYear: p.academic_year,
    notes: p.notes,
  }))

  return [...evidenceEntries, ...promotionEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}
