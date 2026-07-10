// lib/intelligence/cbcScale.ts
// The one raw-marks-to-CBC-level conversion used by the Evidence Domain.
// Previously lib/intelligence/pipeline.ts imported this conversion from
// lib/assessments/gradeCalculator.ts (a teacher-gradebook feature module) —
// backwards for a frozen canonical domain, which should own this definition
// rather than depend on a non-domain consumer for it. gradeCalculator.ts now
// re-exports from here instead, so every existing caller of
// lib/assessments/gradeCalculator's marksToLevel/DEFAULT_MARKS_THRESHOLDS
// keeps working unchanged.

import type { CBCLevel } from './evidence'

export type MarksThresholds = {
  level4: number
  level3: number
  level2: number
}

// marksToLevel(74) → 3  Meeting ✓
// marksToLevel(75) → 4  Exceeding ✓
// marksToLevel(49) → 2  Approaching ✓
// marksToLevel(50) → 3  Meeting ✓
// marksToLevel(29) → 1  Below ✓
// marksToLevel(30) → 2  Approaching ✓
export const DEFAULT_MARKS_THRESHOLDS: MarksThresholds = {
  level4: 75,   // 75-100 → Exceeding Expectations
  level3: 50,   // 50-74  → Meeting Expectations
  level2: 30,   // 30-49  → Approaching Expectations
} as const

export function marksToLevel(
  marks:      number,
  thresholds: MarksThresholds = DEFAULT_MARKS_THRESHOLDS,
): CBCLevel {
  if (marks < 0 || marks > 100) {
    throw new Error(`Marks must be 0-100, got ${marks}`)
  }
  if (marks >= thresholds.level4) return 4
  if (marks >= thresholds.level3) return 3
  if (marks >= thresholds.level2) return 2
  return 1
}
