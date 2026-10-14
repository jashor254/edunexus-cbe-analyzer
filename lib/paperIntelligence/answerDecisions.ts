// lib/paperIntelligence/answerDecisions.ts
//
// Pure — Phase 1, Commit 6. The answers the AI marked "plausible, not in the
// scheme", grouped across the class for ONE question, and what a class-wide
// decision on one of them does to every learner who wrote it.
//
// Phase 0/5 evidence: most of the teacher's review time is these answers —
// "Courage" for personality traits, "Nationality" for diversity types — and
// the same answer recurs across learners. Deciding it once, for everyone,
// replaces a decision per learner. Re-scoring reuses scriptScoring.ts, so a
// re-derived mark follows exactly the rules the first marking pass did.

import { scorePoints, type ClassifiedPoint } from './scriptScoring'
import type { MarkedPoint } from './types'

/** Case, punctuation and spacing never make two answers different: "Self-awareness." ≡ "self awareness". */
export function normalizeAnswer(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

// Where a learner's explanation starts: "Ethics -> involves…", "Ethics — …",
// "Ethics: …", "Insecurity because …".
const EXPLANATION_START = /\s*(?:->|→|=>|—|–|\s-\s|:|=|\bbecause\b|\bsince\b|\bso that\b)\s*/i

/**
 * The point itself, without bullet/numbering and without its explanation.
 * On a 2-mark question the decision is whether "Ethics" is an acceptable
 * quality — how well it was explained is already scored separately
 * (explained → merit) — so "-Ethics -> involves good behaviour" and "Ethics"
 * are the same answer (live review, 2026-10-14).
 */
export function answerName(text: string): string {
  const unbulleted = text.replace(/^[\s\-–—>→•*·.)(\d]+/u, '')
  const name = unbulleted.split(EXPLANATION_START)[0]?.trim() ?? ''
  return name || unbulleted.trim() || text.trim()
}

/** Identity of an answer across learners: its normalized name. */
export function answerKey(text: string): string {
  return normalizeAnswer(answerName(text))
}

export type PlausibleAnswerGroup = {
  /** answerKey() of the point — the identity of the answer across learners. */
  key: string
  /** The most common spelling of the point's name, shown to the teacher. */
  text: string
  /** Every distinct spelling of the name seen — kept as synonyms when accepted. */
  variants: string[]
  submissionIds: string[]
}

type ProposalRow = { submission_id: string; points: MarkedPoint[] }

/**
 * Plausible answers across a question's still-unreviewed proposals, most
 * common first. Reviewed rows are the teacher's settled decision and are not
 * reopened.
 */
export function collectPlausibleAnswers(rows: ProposalRow[]): PlausibleAnswerGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; submissions: Set<string> }>()
  for (const row of rows) {
    for (const p of row.points) {
      if (p.classification !== 'plausible_not_in_scheme') continue
      const key = answerKey(p.text)
      if (!key) continue
      const name = answerName(p.text)
      const g = groups.get(key) ?? { spellings: new Map(), submissions: new Set() }
      g.spellings.set(name, (g.spellings.get(name) ?? 0) + 1)
      g.submissions.add(row.submission_id)
      groups.set(key, g)
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      // Most frequent spelling; ties keep the first one seen (sort is stable).
      text: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      variants: [...g.spellings.keys()],
      submissionIds: [...g.submissions],
    }))
    .sort((a, b) => b.submissionIds.length - a.submissionIds.length || a.text.localeCompare(b.text))
}

export type AnswerDecision = 'accept' | 'reject'

export type RescoredProposal = {
  points: MarkedPoint[]
  proposedMark: number
  plausibleMark: number
  /** False when the row had no plausible point with this answer — nothing to change. */
  changed: boolean
}

/**
 * Apply a class-wide decision on one plausible answer to one learner's
 * proposal. Accept → the point now matches the scheme; reject → it is
 * incorrect for this question. Only points still classified plausible are
 * touched. Marks are re-derived, never patched.
 */
export function applyAnswerDecision(
  points: MarkedPoint[],
  key: string,
  decision: AnswerDecision,
  acceptedText: string,
  rubric: { maxMarks: number; pointsRequired: number | null; marksPerPoint: number | null },
): RescoredProposal {
  let changed = false
  const reclassified: ClassifiedPoint[] = points.map(p => {
    const base: ClassifiedPoint = { text: p.text, classification: p.classification, explained: p.explained, matchedAnswer: p.matchedAnswer, note: p.note }
    if (p.classification !== 'plausible_not_in_scheme' || answerKey(p.text) !== key) return base
    changed = true
    return decision === 'accept'
      ? { ...base, classification: 'matches_scheme', matchedAnswer: acceptedText, note: 'Accepted into the scheme by the teacher' }
      : { ...base, classification: 'incorrect', matchedAnswer: null, note: 'Not accepted by the teacher for this question' }
  })
  const scored = scorePoints(reclassified, rubric)
  return { points: scored.points, proposedMark: scored.proposedMark, plausibleMark: scored.plausibleMark, changed }
}
