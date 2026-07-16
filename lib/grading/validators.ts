// lib/grading/validators.ts
//
// Pure guard functions for the canonical Grading Engine. Isolated from
// gradingEngine.ts so validation rules can be unit-tested independently and
// so the main entrypoint stays a simple, readable pipeline.

import type { GradeScale } from './types'
import { GradingError } from './types'

export function assertValidScore(score: number, maxScore: number): void {
  if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) {
    throw new GradingError(`Invalid maxScore: expected a finite number > 0, got ${maxScore}`)
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new GradingError(`Invalid score: expected a finite number, got ${score}`)
  }
  if (score < 0 || score > maxScore) {
    throw new GradingError(`Invalid score: ${score} is outside the range 0-${maxScore}`)
  }
}

export function assertValidScale(scale: GradeScale): void {
  if (!scale.bands.length) {
    throw new GradingError(`Invalid scale "${scale.name}": must have at least one band`)
  }

  for (const band of scale.bands) {
    if (typeof band.minPct !== 'number' || !Number.isFinite(band.minPct)) {
      throw new GradingError(`Invalid scale "${scale.name}": band "${band.label}" has a non-finite minPct`)
    }
    if (band.minPct < 0 || band.minPct > 100) {
      throw new GradingError(
        `Invalid scale "${scale.name}": band "${band.label}" has minPct ${band.minPct}, expected 0-100`
      )
    }
  }

  for (let i = 1; i < scale.bands.length; i++) {
    if (scale.bands[i].minPct >= scale.bands[i - 1].minPct) {
      throw new GradingError(
        `Invalid scale "${scale.name}": bands must be strictly descending by minPct — ` +
          `"${scale.bands[i - 1].label}" (${scale.bands[i - 1].minPct}) is not greater than ` +
          `"${scale.bands[i].label}" (${scale.bands[i].minPct})`
      )
    }
  }

  const lowestBand = scale.bands[scale.bands.length - 1]
  if (lowestBand.minPct !== 0) {
    throw new GradingError(
      `Invalid scale "${scale.name}": lowest band "${lowestBand.label}" has minPct ${lowestBand.minPct}, ` +
        `expected 0 (otherwise scores below it would have no matching band)`
    )
  }
}
