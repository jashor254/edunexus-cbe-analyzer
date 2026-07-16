// lib/ranking/ties.ts
//
// Standard competition ranking (1,2,2,4): tied scores share the same
// position; the position after a tied group resumes at that group's
// 1-based starting index. Ported verbatim from the semantics of
// lib/assessments/mutations.ts::buildPositionMap, which the Deprecation
// Registry (#4) names as the algorithm this engine preserves.
//
// Input must already be sorted best-first (by whichever comparator the
// caller used) — this function only assigns positions, it does not sort.

import type { RankableEntry, RankedEntry } from './types'

export function assignStandardCompetitionPositions<T>(
  sortedEntries: RankableEntry<T>[]
): RankedEntry<T>[] {
  const ranked: RankedEntry<T>[] = []
  let position = 1
  for (let i = 0; i < sortedEntries.length; i++) {
    if (i > 0 && sortedEntries[i].score !== sortedEntries[i - 1].score) {
      position = i + 1
    }
    ranked.push({ ...sortedEntries[i], position })
  }
  return ranked
}
