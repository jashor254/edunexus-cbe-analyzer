// lib/grading/types.ts
//
// Public contract for the canonical Grading Engine (Sprint 4A,
// docs/engineering/sprint-3-assessment-domain-audit.md §4,
// docs/architecture/deprecation-registry.md #5). This engine has no
// callers yet — see docs/engineering/implementation-log.md.

export type GradeBand = {
  /** e.g. 'EE', 'A', 'B+' */
  label: string
  /** Inclusive lower bound as a percentage, 0-100. Bands must be sorted descending. */
  minPct: number
  /** Optional grade-point value (e.g. KNEC's 12-point scale). */
  points?: number
  /** Optional human-readable label. */
  descriptor?: string
}

export type GradeScale = {
  name: string
  /** Strictly descending by minPct; the lowest band's minPct must be 0. */
  bands: GradeBand[]
}

export type GradingResult = {
  grade: string
  points: number | null
  descriptor: string | null
  band: GradeBand
}

export class GradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GradingError'
  }
}
