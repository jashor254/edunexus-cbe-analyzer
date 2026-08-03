// lib/teacherWorkspace/standing.ts
//
// Teacher Workspace Projection Extraction — the one authoritative
// score-to-standing helper. Previously reimplemented independently in
// app/api/teacher/classes/[classId]/route.ts (long-form labels: "Exceeds
// Expectations" etc.), app/teacher/classes/page.tsx (short-form labels +
// badge/bar colors), and app/teacher/insights/page.tsx (short-form labels +
// its own inline badge/bar color ternaries) — three copies of the same
// 3.5/2.5/1.5 CBC-average thresholds that could silently drift apart if one
// was edited without the others. This is the single place that mapping
// lives now; every consumer (routes, services, and the two client pages
// that render a badge/bar) imports from here. Pure, no I/O — safe to import
// from both server-only services and 'use client' pages.
//
// The threshold values and both label vocabularies are moved verbatim from
// the three prior implementations — this is an extraction, not a formula
// change (Phase B Engineering Execution Mode: "move exact current
// semantics first").

export type StandingLevel = 'exceeds' | 'meets' | 'approaching' | 'below'

export const STANDING_THRESHOLDS = {
  exceeds: 3.5,
  meets: 2.5,
  approaching: 1.5,
} as const

const LONG_LABELS: Record<StandingLevel, string> = {
  exceeds: 'Exceeds Expectations',
  meets: 'Meets Expectations',
  approaching: 'Approaching Expectations',
  below: 'Below Expectations',
}

const SHORT_LABELS: Record<StandingLevel, string> = {
  exceeds: 'Exceeds',
  meets: 'Meets',
  approaching: 'Approaching',
  below: 'Below',
}

/** Badge classes (`text-*-700 bg-*-100`) and progress-bar fill class (`bg-*-500`) per standing level — the exact palette every prior implementation used, just no longer copy-pasted three times. */
const COLOR_CLASSES: Record<StandingLevel, { badge: string; bar: string }> = {
  exceeds: { badge: 'text-purple-700 bg-purple-100', bar: 'bg-purple-500' },
  meets: { badge: 'text-green-700 bg-green-100', bar: 'bg-green-500' },
  approaching: { badge: 'text-amber-700 bg-amber-100', bar: 'bg-amber-500' },
  below: { badge: 'text-red-700 bg-red-100', bar: 'bg-red-500' },
}

/** Classifies a 0-4 CBC-scale average into one of the four standing levels. Same thresholds every prior implementation used: >=3.5 exceeds, >=2.5 meets, >=1.5 approaching, else below. */
export function classifyStanding(avg: number): StandingLevel {
  if (avg >= STANDING_THRESHOLDS.exceeds) return 'exceeds'
  if (avg >= STANDING_THRESHOLDS.meets) return 'meets'
  if (avg >= STANDING_THRESHOLDS.approaching) return 'approaching'
  return 'below'
}

/**
 * The display label for a standing average.
 * `format: 'long'` reproduces the per-learner/per-subject label previously
 * inlined in `app/api/teacher/classes/[classId]/route.ts`'s `levelLabel()`
 * ("Exceeds Expectations"). `format: 'short'` reproduces the class-card and
 * insights-page label previously inlined in `app/teacher/classes/page.tsx`
 * and `app/teacher/insights/page.tsx` ("Exceeds").
 */
export function getStandingLabel(avg: number, format: 'long' | 'short' = 'long'): string {
  const level = classifyStanding(avg)
  return format === 'long' ? LONG_LABELS[level] : SHORT_LABELS[level]
}

/** Badge (`text-* bg-*`) and progress-bar (`bg-*-500`) Tailwind classes for a standing average — previously `levelColor()` in `app/teacher/classes/page.tsx` plus a second, inline copy of the same ternary chain in `app/teacher/insights/page.tsx`. */
export function getStandingColorClasses(avg: number): { badge: string; bar: string } {
  return COLOR_CLASSES[classifyStanding(avg)]
}

/** Buckets a set of 0-4 scores into the four standing levels — the distribution shape `app/api/teacher/classes/[classId]/route.ts`'s per-subject insight already computed inline. */
export function classifyStandingDistribution(scores: number[]): { below: number; approaching: number; meets: number; exceeds: number } {
  const counts = { below: 0, approaching: 0, meets: 0, exceeds: 0 }
  for (const score of scores) counts[classifyStanding(score)]++
  return counts
}

/**
 * Unrounded arithmetic mean. `null` for an empty input rather than `NaN`.
 * Exists separately from {@link averageScore} because the prior
 * implementations classified standing (`levelLabel(avgScore)`) from the
 * *raw* average, then rounded only for display — rounding first can flip a
 * value across a 3.5/2.5/1.5 boundary (e.g. a raw 3.451 rounds to 3.5 and
 * would misclassify as "exceeds" instead of "meets"). Callers computing a
 * standing must classify on this, not on {@link averageScore}'s result.
 */
export function rawMean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Arithmetic mean, rounded to 1 decimal place — matches every prior average-score *display* computation (`Math.round(avg * 10) / 10`). Returns `null` for an empty input rather than `NaN`. Do not use this value to classify standing — use {@link rawMean} with {@link classifyStanding}/{@link getStandingLabel} instead (see {@link rawMean}'s doc comment). */
export function averageScore(values: number[]): number | null {
  const avg = rawMean(values)
  return avg === null ? null : Math.round(avg * 10) / 10
}
