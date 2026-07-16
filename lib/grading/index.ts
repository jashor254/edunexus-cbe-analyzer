// lib/grading/index.ts
//
// Public export surface for the canonical Grading Engine. Import from here,
// not from the internal modules (validators.ts) — those are implementation
// details and may change without notice. boundaries.ts's reference scales
// are re-exported here since they're part of the intended public API.

export { gradeScore } from './gradingEngine'
export type { GradeBand, GradeScale, GradingResult } from './types'
export { GradingError } from './types'
export { CBC_SCALE_STANDARD, CBC_SCALE_CORE_LEGACY, SCALE_844_KNEC } from './boundaries'
