// lib/learnerIntelligence/types.ts
// The Learner Blueprint — "Who is this learner becoming?"
// Max 3 pages. Every section is one or more Insight objects (see ./insight.ts) —
// never a bare narrative string — so every claim carries its evidence and
// confidence next to it.

import type { Insight, ConfidenceLevel } from './insight'

// Reuses the Projection Engine's own completeness/coverage output (see
// lib/projection/completenessProjector.ts, lib/projection/coverage.ts) —
// no new scoring, just surfacing what was already computed. Sprint 21
// (Educational Intelligence Convergence): every consumer must be able to
// say what evidence it used, how confident it is, what's missing, and what
// evidence would help next — this is the Blueprint's answer to that.
export type BlueprintEvidenceSummary = {
  evidenceUsed:             string[]   // subjects with at least one confirmed evidence row
  confidence:                ConfidenceLevel
  freshnessDays:              number | null   // days since the most recent supporting evidence
  missingEvidence:           string[]   // capability dimensions/areas with no supporting evidence yet
  recommendedNextEvidence:   string     // one hedged sentence: what evidence would sharpen this Blueprint next
}

export type LearnerBlueprint = {
  studentId:   string
  studentName: string
  grade:       number
  term:        number | null
  year:        number | null
  school:      string | null
  generatedAt: string
  disclaimer:  string   // conclusions are provisional, improve as more evidence arrives
  evidenceSummary: BlueprintEvidenceSummary

  // ── Page 1 — Who is this learner becoming? ──────────────────────────────────
  becoming: {
    insights: Insight[]   // one per capability dimension with enough evidence to speak on
  }

  // ── Page 2 — What is the learner's greatest opportunity? ───────────────────
  opportunity: {
    insight: Insight
  }

  // ── Page 3 — What should parents / teachers / the learner do? ──────────────
  actions: {
    parent:  Insight
    teacher: Insight
    learner: Insight
  }
}
