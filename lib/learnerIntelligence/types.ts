// lib/learnerIntelligence/types.ts
// The Learner Blueprint — "Who is this learner becoming?"
// Max 3 pages. Every section is one or more Insight objects (see ./insight.ts) —
// never a bare narrative string — so every claim carries its evidence and
// confidence next to it.

import type { Insight } from './insight'

export type LearnerBlueprint = {
  studentId:   string
  studentName: string
  grade:       number
  term:        number | null
  year:        number | null
  school:      string | null
  generatedAt: string
  disclaimer:  string   // conclusions are provisional, improve as more evidence arrives

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
