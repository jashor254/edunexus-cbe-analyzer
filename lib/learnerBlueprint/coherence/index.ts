// lib/learnerBlueprint/coherence/index.ts
//
// The Blueprint Intelligence Coherence Engine's public surface. Consumers
// (composeBlueprint.ts, tests, a future diagnostic route) import from
// here, never reach into rules/* directly.

export { validateBlueprintCoherence } from './validateBlueprintCoherence'
export { composeBlueprintCoherence } from './composeBlueprintCoherence'
export {
  type CoherenceSeverity,
  type CoherenceRuleId,
  type CoherenceFinding,
  type CoherenceResult,
  type CoherenceReport,
  COHERENCE_RULE_VERSION,
} from './types'
