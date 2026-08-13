// lib/config/careerKnowledge.ts
//
// How fast career knowledge goes out of date, as configuration rather than as
// numbers scattered through the career domain.
//
// Why these thresholds and not others
// -----------------------------------
// The facts a career profile asserts do not all age at the same rate, but the
// ones a family actually acts on — salary bands, demand, AI impact — move on a
// scale of months, not years. Kenyan tech salaries were moving 15–20%/year in
// the corpus's own seed notes; a band written 12 months ago is not a small
// error, it is a different number.
//
//   fresh  (≤ 120 days)  Recent enough to state plainly.
//   aging  (≤ 300 days)  Still usable, but the reader is told when it was
//                        confirmed so they can weigh it themselves.
//   stale  (>  300 days) Must be labelled as historical wherever a figure is
//                        shown. Never silently presented as present tense.
//
// `unknown` is its own state and deliberately NOT folded into `fresh`. A career
// with no verification date has never been confirmed by anyone; treating that
// as fresh would be the exact failure this whole module exists to prevent.
//
// Moving these to per-field decay later (salary ages faster than "what this job
// is like") is mechanical: widen `CareerKnowledgeThresholds` to a record keyed
// by field and give `assessCareerKnowledge` the field name. Nothing else moves.

export type CareerKnowledgeThresholds = {
  /** At or under this age in days, knowledge is `fresh`. */
  freshMaxDays: number
  /** At or under this age in days, knowledge is `aging`. Above it, `stale`. */
  agingMaxDays: number
}

export const CAREER_KNOWLEDGE_THRESHOLDS: CareerKnowledgeThresholds = {
  freshMaxDays: 120,
  agingMaxDays: 300,
}

/**
 * How many careers a single refresh sweep may re-verify in one run.
 *
 * Every re-verification is a DeepSeek call, so an unbounded sweep over a
 * growing corpus is an unbounded bill. The sweep always takes the *stalest*
 * careers first, so a small batch run regularly converges just as well as one
 * large run, at a predictable cost.
 */
export const CAREER_REFRESH_BATCH_LIMIT = 5
