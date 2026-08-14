// lib/projection/equivalenceHarness.ts
//
// The Evidence Migration Trigger ADR's "projection-equivalence gate" —
// a test-only harness proving that resolving a learner through Core
// identity (students.external_id → resolveLegacyStudentId) produces
// identical intelligence output to resolving the same learner directly
// through legacy identity. Test-only by design (per the ADR's own
// instruction: "this classification may be test-only unless a small
// reusable diagnostic utility is clearly justified") — no production
// code is added or changed by this module. It composes real, unmodified
// production functions (`resolveLegacyStudentId`, `computeLearnerProjection`,
// `repos.evidence.findConfirmedEvidenceForLearner`) — it never
// reimplements projection logic or bypasses identity resolution.
//
// Lives in lib/projection/ (not lib/testing/) because
// `findConfirmedEvidenceForLearner` is restricted by the Decision 5
// read-path guardrail (eslint.config.mjs's no-restricted-syntax rule) to
// `lib/projection/**`/`lib/intelligence/**` only — this harness is a
// legitimate projection-domain consumer, not an exception to that rule.
//
// Run any consumer with: npx tsx --env-file=.env.local --test <file>

import { createServiceClient } from '@/utils/supabase/service'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { repos } from '@/lib/repositories'
import { computeLearnerProjection } from './engine'
import type { LearnerIntelligenceProjection, Projection, ProjectorType } from './types'
import { type LearnerId } from '@/lib/core/identityTypes'

const PROJECTOR_KEYS: ProjectorType[] = [
  'academic', 'capability', 'knowledge', 'behaviour', 'growth', 'risk', 'completeness',
]

// ── Bridge classification ────────────────────────────────────────────────────

export type BridgeClassification =
  | { status: 'NO_BRIDGE' }
  | { status: 'AMBIGUOUS_BRIDGE'; count: number }
  | { status: 'ELIGIBLE'; legacyStudentId: string }

/**
 * Classifies a Core learner id's bridge state by directly counting matching
 * `students.external_id` rows — deliberately independent of, and stricter
 * than, the real `resolveLegacyStudentId` (which uses `.maybeSingle()` and
 * — per the Identity Resolution Failure Audit — silently returns `null`
 * for both "no bridge" and "2+ matching rows," collapsing two different
 * failure modes into one). This function exists specifically so the
 * harness can tell those two apart, which production code today cannot.
 */
export async function classifyBridge(coreLearnerId: LearnerId): Promise<BridgeClassification> {
  const db = createServiceClient()
  const { data, error } = await db.from('students').select('id').eq('external_id', coreLearnerId)
  if (error) throw new Error(`classifyBridge: ${error.message}`)
  if (!data || data.length === 0) return { status: 'NO_BRIDGE' }
  if (data.length > 1) return { status: 'AMBIGUOUS_BRIDGE', count: data.length }
  return { status: 'ELIGIBLE', legacyStudentId: data[0].id }
}

// ── Projection paths ─────────────────────────────────────────────────────────

/** The legacy-direct path: real evidence read + the real, pure, unmodified projection engine. No shortcuts. */
export async function runLegacyProjectionPath(legacyStudentId: string, now?: Date): Promise<LearnerIntelligenceProjection> {
  const evidence = await repos.evidence.findConfirmedEvidenceForLearner(legacyStudentId)
  return computeLearnerProjection(legacyStudentId, evidence, now)
}

export type CoreProjectionResult =
  | { status: 'NO_BRIDGE' }
  | { status: 'AMBIGUOUS_BRIDGE' }
  | { status: 'RESOLVED'; legacyStudentId: string; projection: LearnerIntelligenceProjection }

/**
 * The Core-resolved path — calls the REAL production `resolveLegacyStudentId`
 * (never a hardcoded id), then runs the identical evidence-read + projection
 * computation the legacy path uses. `classifyBridge` gates entry so the
 * harness can distinguish "no bridge" from "ambiguous bridge" even though
 * `resolveLegacyStudentId` itself cannot (see that function's own doc above)
 * — but the real `resolveLegacyStudentId` call still happens and its result
 * is asserted to agree with the classification for the ELIGIBLE case, so
 * this proves resolution, it does not bypass it.
 */
export async function runCoreResolvedProjectionPath(coreLearnerId: LearnerId, now?: Date): Promise<CoreProjectionResult> {
  const classification = await classifyBridge(coreLearnerId)
  if (classification.status === 'NO_BRIDGE') return { status: 'NO_BRIDGE' }
  if (classification.status === 'AMBIGUOUS_BRIDGE') return { status: 'AMBIGUOUS_BRIDGE' }

  const resolved = await resolveLegacyStudentId(coreLearnerId)
  if (resolved !== classification.legacyStudentId) {
    throw new Error(
      `INVALID_MAPPING: resolveLegacyStudentId returned ${resolved ? 'a different id' : 'null'} ` +
      `for a coreLearnerId classifyBridge found exactly one match for.`
    )
  }

  const projection = await runLegacyProjectionPath(resolved, now)
  return { status: 'RESOLVED', legacyStudentId: resolved, projection }
}

// ── Comparison ────────────────────────────────────────────────────────────────

export type EquivalenceDiff = {
  field: string
  expected: unknown
  actual: unknown
}

export type EquivalenceResult =
  | { equal: true }
  | { equal: false; diffs: EquivalenceDiff[] }

/**
 * Deep-compares two projections of the same type on every field the
 * equivalence contract defines as deterministic. `lastComputed` is the one
 * deliberately excluded field — it is wall-clock metadata about *when* the
 * computation ran, not part of the reproducible educational value (the
 * existing `engine.test.ts` determinism test already excludes it for the
 * same reason). Everything else — value, supportingEvidenceIds, confidence,
 * coverage (including freshnessDays, which is deterministic once `now` is
 * fixed by the caller), and projectionVersion — must match exactly.
 */
function compareProjection<T>(field: string, a: Projection<T> | null, b: Projection<T> | null, diffs: EquivalenceDiff[]): void {
  if (a === null && b === null) return
  if (a === null || b === null) {
    diffs.push({ field, expected: a, actual: b })
    return
  }
  const { lastComputed: _a, ...aRest } = a
  const { lastComputed: _b, ...bRest } = b
  // supportingEvidenceIds ordering is not part of the contract — the engine
  // is deterministic given identical input, but comparing as sets matches
  // the existing engine.test.ts convention and avoids over-constraining on
  // an incidental array order.
  const aNorm = { ...aRest, supportingEvidenceIds: [...aRest.supportingEvidenceIds].sort() }
  const bNorm = { ...bRest, supportingEvidenceIds: [...bRest.supportingEvidenceIds].sort() }
  const aStr = JSON.stringify(aNorm)
  const bStr = JSON.stringify(bNorm)
  if (aStr !== bStr) diffs.push({ field, expected: aNorm, actual: bNorm })
}

/** Convenience for assertion messages — avoids inline ternary narrowing awkwardness at call sites. */
export function diffsOf(result: EquivalenceResult): EquivalenceDiff[] | null {
  if (result.equal) return null
  return (result as { equal: false; diffs: EquivalenceDiff[] }).diffs
}

export function compareProjections(
  expected: LearnerIntelligenceProjection,
  actual: LearnerIntelligenceProjection
): EquivalenceResult {
  const diffs: EquivalenceDiff[] = []

  if (expected.learnerId !== actual.learnerId) {
    diffs.push({ field: 'learnerId', expected: expected.learnerId, actual: actual.learnerId })
  }
  for (const key of PROJECTOR_KEYS) {
    compareProjection(key, expected[key] as Projection<unknown> | null, actual[key] as Projection<unknown> | null, diffs)
  }

  return diffs.length === 0 ? { equal: true } : { equal: false, diffs }
}
