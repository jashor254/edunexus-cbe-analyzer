// lib/paperIntelligence/scriptScoring.ts
//
// Turns classified points into marks. Pure and deterministic: the model reads
// and classifies, this module counts. Shared by whole-script marking (Commit
// 4) and by accept-answer re-apply (Commit 6), so a mark re-derived after a
// teacher accepts an answer follows exactly the rules the first pass did.
//
// The rules are the ones Phase 0 measured teachers applying on real scripts:
//   - "Any N×M": only the first N points the learner wrote count, right or
//     wrong — a learner who lists nine guesses for five marks does not get
//     the best five.
//   - A point earns its merit only if it matches the scheme. A plausible
//     answer the scheme does not list earns nothing until a teacher accepts
//     it; the "if accepted" total is reported alongside.
//   - Incorrect points earn nothing in either total.
//   - A point's worth is derived here, not by the model: naming a correct
//     point earns 1; on a multi-mark point the rest is earned only with a
//     correct explanation. (Measured 2026-10-14: asked for a number, the model
//     wrote "no explanation, so merit is 1" and returned 2.)
//
// Prototype 01 rubrics carry no "Any N×M" structure; they are scored as
// "each correct point earns 1, up to the question's max".

import type { MarkedPoint, PointClassification } from './types'

export type ClassifiedPoint = {
  text: string
  classification: PointClassification
  explained: boolean
  matchedAnswer: string | null
  note: string | null
}

export type ScoringRubric = {
  maxMarks: number
  pointsRequired: number | null
  marksPerPoint: number | null
}

export function pointMerit(classification: PointClassification, explained: boolean, marksPerPoint: number): number {
  if (classification === 'incorrect') return 0
  return marksPerPoint <= 1 ? 1 : 1 + (explained ? marksPerPoint - 1 : 0)
}

export type ScoredPoints = {
  points: MarkedPoint[]
  proposedMark: number
  plausibleMark: number
}

export function scorePoints(classified: ClassifiedPoint[], rubric: ScoringRubric): ScoredPoints {
  const marksPerPoint = rubric.marksPerPoint ?? 1
  const limit = rubric.pointsRequired ?? Math.floor(rubric.maxMarks / marksPerPoint)
  let proposedMark = 0
  let plausibleMark = 0

  const points = classified.map((p, i): MarkedPoint => {
    const merit = pointMerit(p.classification, p.explained, marksPerPoint)
    const counted = i < limit
    const awarded = counted && p.classification === 'matches_scheme' ? merit : 0
    proposedMark += awarded
    if (counted) plausibleMark += merit
    return { ...p, merit, counted, awarded }
  })

  return { points, proposedMark, plausibleMark }
}
