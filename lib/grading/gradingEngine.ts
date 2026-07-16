// lib/grading/gradingEngine.ts
//
// The canonical Grading Engine's single public entrypoint. Pure function:
// no Supabase, no repositories, no services, no route imports, no
// Intelligence/Core dependency. See docs/engineering/sprint-3-assessment-domain-audit.md
// and docs/engineering/implementation-log.md for why this exists and what
// still needs to migrate to it (Sprint 4B — not this file).

import { assertValidScale, assertValidScore } from './validators'
import type { GradeScale, GradingResult } from './types'
import { GradingError } from './types'

export function gradeScore(score: number, maxScore: number, scale: GradeScale): GradingResult {
  assertValidScale(scale)
  assertValidScore(score, maxScore)

  const pct = (score / maxScore) * 100
  const band = scale.bands.find((b) => pct >= b.minPct)

  if (!band) {
    // Unreachable given assertValidScale's "lowest band must be 0" rule —
    // fails loudly rather than guessing, per this engine's own guarantee.
    throw new GradingError(`No grade band matches percentage ${pct} for scale "${scale.name}"`)
  }

  return {
    grade: band.label,
    points: band.points ?? null,
    descriptor: band.descriptor ?? null,
    band,
  }
}
