// lib/ranking/types.ts
//
// Public contract for the canonical Ranking Engine (Sprint 3A,
// docs/engineering/sprint-3-assessment-domain-audit.md §4/§11). This engine
// has no callers yet — see docs/engineering/implementation-log.md for the
// Sprint 3A/3B split.

export type RankableEntry<T = string> = {
  id: T
  score: number
}

export type RankedEntry<T = string> = RankableEntry<T> & {
  position: number
}

export type RankingDirection = 'desc' | 'asc'

export type RankingOptions = {
  /** Which score wins position 1. Defaults to 'desc' (highest score first). */
  direction?: RankingDirection
}

export class RankingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RankingError'
  }
}
