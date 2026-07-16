// lib/ranking/rankingEngine.ts
//
// The canonical Ranking Engine's single public entrypoint. Pure function:
// no Supabase, no repositories, no services, no route imports, no
// Intelligence/Core dependency. See docs/engineering/sprint-3-assessment-domain-audit.md
// and docs/engineering/implementation-log.md for why this exists and what
// still needs to migrate to it (Sprint 3B — not this file).

import { compareAscending, compareDescending } from './comparators'
import { assignStandardCompetitionPositions } from './ties'
import type { RankableEntry, RankedEntry, RankingOptions } from './types'
import { RankingError } from './types'

export function computeRankings<T = string>(
  entries: RankableEntry<T>[],
  options: RankingOptions = {}
): RankedEntry<T>[] {
  for (const entry of entries) {
    if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) {
      throw new RankingError(
        `Invalid score for entry id=${String(entry.id)}: expected a finite number, got ${entry.score}`
      )
    }
  }

  const direction = options.direction ?? 'desc'
  const comparator = direction === 'asc' ? compareAscending : compareDescending

  const sorted = [...entries].sort(comparator)
  return assignStandardCompetitionPositions(sorted)
}
