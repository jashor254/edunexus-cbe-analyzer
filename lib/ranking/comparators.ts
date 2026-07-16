// lib/ranking/comparators.ts
//
// Score comparators for the canonical Ranking Engine. Kept separate from
// tie assignment (ties.ts) because "which direction is better" is a
// distinct decision from "how are equal scores positioned".

import type { RankableEntry } from './types'

export function compareDescending<T>(a: RankableEntry<T>, b: RankableEntry<T>): number {
  return b.score - a.score
}

export function compareAscending<T>(a: RankableEntry<T>, b: RankableEntry<T>): number {
  return a.score - b.score
}
