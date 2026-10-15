// lib/schoolEffectiveness/scoring.ts
//
// The School Effectiveness Check scorer. Pure, deterministic, DB-free: given a
// set of per-benchmark maturity ratings (0–4), it returns the school's overall
// maturity, its prioritised gaps (weakest and most addressable first), the
// EduNexus programmes that close those gaps, and — honestly — the gaps no
// provider yet addresses. This is the engine behind "sell what the buyer
// needs": the diagnostic names the gaps, the mapping names the fit.

import { CBC_GATSBY_BENCHMARKS } from './benchmarks'
import type {
  BenchmarkRating,
  BenchmarkGap,
  GapPriority,
  ProgrammeRef,
  MaturityStage,
  SchoolEffectivenessProfile,
} from './types'

const BENCHMARKS_BY_ID = new Map(CBC_GATSBY_BENCHMARKS.map((b) => [b.id, b]))

function clampLevel(level: number): 0 | 1 | 2 | 3 | 4 {
  const n = Math.round(level)
  if (n <= 0) return 0
  if (n >= 4) return 4
  return n as 1 | 2 | 3
}

function stageFor(mean: number): MaturityStage {
  if (mean < 0.5) return 'absent'
  if (mean < 1.5) return 'emerging'
  if (mean < 2.5) return 'developing'
  if (mean < 3.5) return 'established'
  return 'embedded'
}

function priorityFor(shortfall: number): GapPriority {
  if (shortfall >= 4) return 'critical'
  if (shortfall === 3) return 'critical'
  if (shortfall === 2) return 'high'
  if (shortfall === 1) return 'moderate'
  return 'low'
}

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/**
 * Score a School Effectiveness Check from per-benchmark ratings. Ratings may be
 * partial (only some of the eight benchmarks rated). Unknown benchmark ids are
 * ignored; a duplicate id keeps the last rating given. The source of the
 * ratings (self-report, auto-derived, or hybrid) is decided in a later
 * increment — this scorer is input-agnostic.
 */
export function scoreSchoolEffectiveness(ratings: readonly BenchmarkRating[]): SchoolEffectivenessProfile {
  // De-duplicate by id (last wins), drop unknown ids, clamp levels.
  const byId = new Map<string, 0 | 1 | 2 | 3 | 4>()
  for (const r of ratings) {
    if (BENCHMARKS_BY_ID.has(r.benchmarkId)) byId.set(r.benchmarkId, clampLevel(r.level))
  }

  const benchmarks_total = CBC_GATSBY_BENCHMARKS.length
  const benchmarks_rated = byId.size

  if (benchmarks_rated === 0) {
    return {
      overall_maturity: 0,
      overall_percent: 0,
      overall_stage: 'absent',
      benchmarks_rated: 0,
      benchmarks_total,
      prioritised_gaps: [],
      recommended_programmes: [],
      unaddressed_gaps: [],
      summary: 'No benchmarks have been rated yet, so there is nothing to diagnose.',
    }
  }

  const levels = [...byId.values()]
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length
  const overall_maturity = Math.round(mean * 10) / 10
  const overall_percent = Math.round((mean / 4) * 100)
  const overall_stage = stageFor(mean)

  // Build gaps for every rated benchmark below full maturity.
  const gaps: BenchmarkGap[] = []
  for (const b of CBC_GATSBY_BENCHMARKS) {
    const level = byId.get(b.id)
    if (level === undefined) continue
    const shortfall = 4 - level
    if (shortfall <= 0) continue
    gaps.push({
      benchmarkId: b.id,
      name: b.name,
      gatsbyNumber: b.gatsbyNumber,
      level,
      shortfall,
      priority: priorityFor(shortfall),
      recommended: b.addressed_by,
      unaddressed: b.horizon,
    })
  }

  // Weakest first; among equal shortfall, surface what EduNexus CAN address
  // before horizon gaps; then stable by Gatsby number.
  gaps.sort((a, b) => {
    if (b.shortfall !== a.shortfall) return b.shortfall - a.shortfall
    if (a.unaddressed !== b.unaddressed) return a.unaddressed ? 1 : -1
    return a.gatsbyNumber - b.gatsbyNumber
  })

  // Recommended programmes: de-duplicated across addressable gaps, ordered by
  // the largest shortfall each one would help close (strongest leverage first).
  const leverageByKey = new Map<string, { ref: ProgrammeRef; maxShortfall: number }>()
  for (const g of gaps) {
    if (g.unaddressed) continue
    for (const ref of g.recommended) {
      const existing = leverageByKey.get(ref.key)
      if (!existing || g.shortfall > existing.maxShortfall) {
        leverageByKey.set(ref.key, { ref, maxShortfall: g.shortfall })
      }
    }
  }
  const recommended_programmes = [...leverageByKey.values()]
    .sort((a, b) => (b.maxShortfall - a.maxShortfall) || a.ref.label.localeCompare(b.ref.label))
    .map((e) => e.ref)

  const unaddressed_gaps = gaps.filter((g) => g.unaddressed)

  const topGapNames = gaps.slice(0, 2).map((g) => g.name)
  const addressableCount = gaps.length - unaddressed_gaps.length
  const summaryParts: string[] = [
    `Across ${benchmarks_rated} of ${benchmarks_total} benchmarks, this school is at ${overall_stage} maturity (${overall_percent}%).`,
  ]
  if (topGapNames.length > 0) {
    summaryParts.push(`The biggest gaps are ${joinNames(topGapNames)}.`)
  } else {
    summaryParts.push('No benchmark falls below full maturity.')
  }
  if (addressableCount > 0) {
    summaryParts.push(`${addressableCount} ${addressableCount === 1 ? 'gap maps' : 'gaps map'} to EduNexus programmes.`)
  }
  if (unaddressed_gaps.length > 0) {
    summaryParts.push(`${unaddressed_gaps.length} (employer encounters / workplace experiences) ${unaddressed_gaps.length === 1 ? 'is' : 'are'} not yet addressed by any provider.`)
  }

  return {
    overall_maturity,
    overall_percent,
    overall_stage,
    benchmarks_rated,
    benchmarks_total,
    prioritised_gaps: gaps,
    recommended_programmes,
    unaddressed_gaps,
    summary: summaryParts.join(' '),
  }
}
