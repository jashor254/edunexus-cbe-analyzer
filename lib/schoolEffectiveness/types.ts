// lib/schoolEffectiveness/types.ts
//
// The CBC-adapted Gatsby "School Effectiveness Check" — types.
//
// A school-level maturity diagnostic across eight benchmarks, adapted from the
// UK Gatsby Benchmarks of Good Career Guidance (statutory in England since
// 2018) to Kenya's CBC/CBE context. It is the backbone of the "sell what the
// buyer needs" GTM: one diagnostic → prioritised gaps → the EduNexus
// programme(s) that address each gap → a fitted configuration, over one
// evidence spine.
//
// This layer is deterministic, token-free and DB-free. Ratings are passed in,
// so the source of those ratings (self-report form, auto-derived from existing
// school data, or hybrid) is a later, separately-decided increment.

/**
 * A reference to a real EduNexus programme that addresses a benchmark gap.
 * `status: 'available'` means the programme exists today; `status: 'horizon'`
 * marks a benchmark EduNexus does NOT yet address (benchmarks 5 and 6 —
 * employer encounters and workplace experiences, the market-wide blind spot).
 * A horizon benchmark is reported honestly as unaddressed; it never maps to a
 * programme we do not have.
 */
export type ProgrammeRef = {
  key:    string
  label:  string
  status: 'available' | 'horizon'
}

/**
 * One maturity band on a benchmark's 0–4 rubric. `level` 0 = absent,
 * 4 = fully embedded.
 */
export type MaturityBand = {
  level:       0 | 1 | 2 | 3 | 4
  descriptor:  string
}

/**
 * Which framework a benchmark belongs to. `gatsby_core` = one of the 8 Gatsby
 * Benchmarks of Good Career Guidance. `edunexus_beyond` = a dimension where
 * EduNexus goes beyond traditional career guidance (AI-era readiness,
 * enterprise/livelihood, whole-child talent) — things the Gatsby framework,
 * and the Kenyan matching-quiz competitors, do not cover.
 */
export type BenchmarkFramework = 'gatsby_core' | 'edunexus_beyond'

export type SchoolEffectivenessBenchmark = {
  /** Stable id, e.g. 'stable_programme'. */
  id:           string
  framework:    BenchmarkFramework
  /** Universal display/sort order: Gatsby 1–8, then beyond 9+. */
  order:        number
  /** The Gatsby number (1–8); set only for gatsby_core benchmarks. */
  gatsbyNumber?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  name:         string
  /** What this benchmark means in the CBC/CBE context. */
  definition:   string
  /** The observable signal that reveals where a school sits on this benchmark. */
  signal:       string
  /** The 0–4 maturity rubric (exactly five bands, level 0..4). */
  rubric:       readonly MaturityBand[]
  /**
   * The EduNexus programme(s) that close a gap on this benchmark. Empty only
   * for horizon benchmarks EduNexus does not yet address — in which case
   * `horizon` is true and the gap is reported as unaddressed, never faked.
   */
  addressed_by: readonly ProgrammeRef[]
  /** True when EduNexus has no programme for this benchmark yet (5 and 6). */
  horizon:      boolean
  /**
   * Hybrid rating model: 'hybrid' = auto-derived from existing EduNexus data
   * when a signal exists, otherwise self-reported; 'self_report' = always
   * asked (process/encounter benchmarks we cannot derive — 1, 5, 6).
   */
  ratingSource: 'self_report' | 'hybrid'
}

/** A single benchmark's maturity rating, 0–4, as fed into the diagnostic. */
export type BenchmarkRating = {
  benchmarkId: string
  /** 0 (absent) … 4 (fully embedded). */
  level:       0 | 1 | 2 | 3 | 4
}

/** Where a stored rating came from in the hybrid model. */
export type RatingProvenance = 'auto' | 'self_report'

/**
 * A rating plus its provenance — the shape mergeRatings() produces and a stored
 * Check persists. Accepted anywhere a BenchmarkRating fits (the scorer ignores
 * `source`).
 */
export type SourcedRating = BenchmarkRating & { source: RatingProvenance }

/** How urgently a gap should be addressed. */
export type GapPriority = 'critical' | 'high' | 'moderate' | 'low'

/** One prioritised gap in the scored profile. */
export type BenchmarkGap = {
  benchmarkId:   string
  name:          string
  order:         number
  framework:     BenchmarkFramework
  level:         number
  /** 4 - level: how far below "fully embedded" this benchmark sits. */
  shortfall:     number
  priority:      GapPriority
  /** Programmes that address this gap; empty when the benchmark is horizon. */
  recommended:   readonly ProgrammeRef[]
  /** True when there is a real shortfall but EduNexus has no programme yet. */
  unaddressed:   boolean
}

export type MaturityStage = 'absent' | 'emerging' | 'developing' | 'established' | 'embedded'

export type SchoolEffectivenessProfile = {
  /** Mean maturity across all rated benchmarks, 0–4, rounded to 1 dp. */
  overall_maturity:   number
  /** 0–100 for display: overall_maturity / 4 * 100, rounded. */
  overall_percent:    number
  overall_stage:      MaturityStage
  benchmarks_rated:   number
  benchmarks_total:   number
  /** Gaps, weakest-and-highest-leverage first. */
  prioritised_gaps:   readonly BenchmarkGap[]
  /** De-duplicated available programmes across all gaps, strongest-leverage first. */
  recommended_programmes: readonly ProgrammeRef[]
  /** Benchmarks with a real shortfall that EduNexus does not yet address. */
  unaddressed_gaps:   readonly BenchmarkGap[]
  /** One deterministic sentence; honest, no overclaiming. */
  summary:            string
}
