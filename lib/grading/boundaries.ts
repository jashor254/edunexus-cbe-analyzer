// lib/grading/boundaries.ts
//
// Reference GradeScale constants ported from the 4 grading implementations
// catalogued in docs/engineering/sprint-3-assessment-domain-audit.md §4 /
// docs/architecture/deprecation-registry.md #5.
//
// IMPORTANT — genuine, unresolved boundary conflict (found while building
// this engine, documented in the Sprint 4A implementation log, not silently
// normalized): 3 of the 4 existing implementations
// (lib/core/assessments.ts's inline toCbcLevel, lib/core/report-cards.ts's
// inline toCbcLevel, and assessment.repository.ts::gradeLevelFromScore) use
// 75/50/25 as the EE/ME/AE floor. The 4th
// (lib/assessments/gradeCalculator.ts's BUILTIN_CBC_SCALE — the one
// Deprecation Registry #5 names as the replacement) uses 76/51/31, one
// point higher at every boundary. A score of exactly 75, 50, or 30 grades
// differently depending on which is used. This module intentionally keeps
// both as separately-named scales rather than picking a winner — which one
// becomes canonical is a migration-time policy decision for Sprint 4B+, not
// this (infrastructure-only) sprint's to make.

import type { GradeScale } from './types'

export const CBC_SCALE_STANDARD: GradeScale = {
  name: 'CBC (Standard — matches lib/assessments/gradeCalculator.ts BUILTIN_CBC_SCALE)',
  bands: [
    { label: 'EE', minPct: 76, descriptor: 'Exceeds Expectation' },
    { label: 'ME', minPct: 51, descriptor: 'Meets Expectation' },
    { label: 'AE', minPct: 31, descriptor: 'Approaches Expectation' },
    { label: 'BE', minPct: 0, descriptor: 'Below Expectation' },
  ],
}

export const CBC_SCALE_CORE_LEGACY: GradeScale = {
  name: 'CBC (Core/legacy — matches lib/core/assessments.ts, lib/core/report-cards.ts, assessment.repository.ts defaults)',
  bands: [
    { label: 'EE', minPct: 75, descriptor: 'Exceeds Expectation' },
    { label: 'ME', minPct: 50, descriptor: 'Meets Expectation' },
    { label: 'AE', minPct: 25, descriptor: 'Approaches Expectation' },
    { label: 'BE', minPct: 0, descriptor: 'Below Expectation' },
  ],
}

// 8-4-4 — full KNEC grading scale, matches
// lib/assessments/gradeCalculator.ts's BUILTIN_844_SCALE exactly (no
// boundary conflict found for this scale).
export const SCALE_844_KNEC: GradeScale = {
  name: '8-4-4 (KNEC)',
  bands: [
    { label: 'A', minPct: 80, points: 12, descriptor: 'Excellent' },
    { label: 'B+', minPct: 75, points: 10, descriptor: 'Very Good' },
    { label: 'B', minPct: 70, points: 9, descriptor: 'Good' },
    { label: 'B-', minPct: 65, points: 8, descriptor: 'Fairly Good' },
    { label: 'C+', minPct: 60, points: 7, descriptor: 'Above Average' },
    { label: 'C', minPct: 55, points: 6, descriptor: 'Average' },
    { label: 'C-', minPct: 50, points: 5, descriptor: 'Pass' },
    { label: 'D+', minPct: 45, points: 4, descriptor: 'Below Average' },
    { label: 'D', minPct: 40, points: 3, descriptor: 'Poor' },
    { label: 'D-', minPct: 35, points: 2, descriptor: 'Very Poor' },
    { label: 'E', minPct: 0, points: 1, descriptor: 'Fail' },
  ],
}
