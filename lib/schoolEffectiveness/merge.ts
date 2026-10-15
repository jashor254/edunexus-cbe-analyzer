// lib/schoolEffectiveness/merge.ts
//
// The hybrid merge. Given auto-derived ratings (computed from existing EduNexus
// data for an onboarded school) and self-report ratings (entered by/for the
// school), produce the final set of sourced ratings the Check is scored from.
//
// Rules:
//   - A 'hybrid' benchmark prefers its auto-derived rating when one exists,
//     otherwise falls back to self-report.
//   - A 'self_report' benchmark (process/encounter benchmarks 1, 5, 6) always
//     uses the self-report answer; any auto rating for it is ignored.
//   - A benchmark with neither is simply unrated (omitted) — a cold prospect
//     with no EduNexus data yet therefore ends up entirely self-reported.
//
// Pure and deterministic.

import { CBC_GATSBY_BENCHMARKS } from './benchmarks'
import type { BenchmarkRating, SourcedRating } from './types'

export function mergeRatings(
  auto: readonly BenchmarkRating[],
  selfReport: readonly BenchmarkRating[],
): SourcedRating[] {
  const autoById = new Map(auto.map((r) => [r.benchmarkId, r.level]))
  const selfById = new Map(selfReport.map((r) => [r.benchmarkId, r.level]))

  const merged: SourcedRating[] = []
  for (const b of CBC_GATSBY_BENCHMARKS) {
    const autoLevel = autoById.get(b.id)
    if (b.ratingSource === 'hybrid' && autoLevel !== undefined) {
      merged.push({ benchmarkId: b.id, level: autoLevel, source: 'auto' })
      continue
    }
    const selfLevel = selfById.get(b.id)
    if (selfLevel !== undefined) {
      merged.push({ benchmarkId: b.id, level: selfLevel, source: 'self_report' })
    }
  }
  return merged
}
