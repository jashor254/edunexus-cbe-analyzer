// lib/ranking/index.ts
//
// Public export surface for the canonical Ranking Engine. Import from here,
// not from the internal modules (comparators.ts, ties.ts) — those are
// implementation details and may change without notice.

export { computeRankings } from './rankingEngine'
export type { RankableEntry, RankedEntry, RankingDirection, RankingOptions } from './types'
export { RankingError } from './types'
