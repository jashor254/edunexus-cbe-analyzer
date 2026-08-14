// lib/core/identityBoundary.test.ts
//
// Run: npm test -- lib/core/identityBoundary.test.ts
//
// The resolver contract, asserted at the type level. These are compile-time
// proofs rather than database round-trips: the runtime behaviour of
// `resolveLegacyStudentId` is already covered by lib/core/identity.test.ts and
// the academicBridge integration tests, and IDENTITY-1 Phase 1 deliberately
// changed no runtime behaviour. What was previously unprovable — and is
// asserted here — is which identity SPACE each end of the bridge speaks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveLegacyStudentId, resolveOwnCoreLearnerId } from './identity'
import type { ResolvedIdentityPair, LearnerId, StudentId } from './identityTypes'
import { asLearnerId, asStudentId } from './identityTypes'

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
function expectType<T extends true>(_proof: T): void {}

test('the forward bridge is LearnerId -> StudentId | null', () => {
  type Param = Parameters<typeof resolveLegacyStudentId>[0]
  type Result = Awaited<ReturnType<typeof resolveLegacyStudentId>>

  expectType<Equals<Param, LearnerId>>(true)
  expectType<Equals<Result, StudentId | null>>(true)

  // @ts-expect-error the bridge must not accept a legacy StudentId as its input
  void (async () => resolveLegacyStudentId(asStudentId('s')))
  assert.ok(true)
})

test('the reverse bridge returns a LearnerId, never a StudentId', () => {
  type Result = Awaited<ReturnType<typeof resolveOwnCoreLearnerId>>
  expectType<Equals<Result, LearnerId | null>>(true)
  assert.ok(true)
})

// The `| null` in the contract is the graceful-degradation guarantee: a
// legitimately-enrolled Core learner with no legacy shadow row (a newly
// admitted learner with no assessment history) resolves to null, and every
// Blueprint composer treats that as an explicit "unavailable" rather than an
// error. Phase 1 must not have converted that into a thrown exception.
test('a missing bridge stays representable — null, not an exception', () => {
  type Result = Awaited<ReturnType<typeof resolveLegacyStudentId>>
  const absent: Result = null
  assert.equal(absent, null)

  // A resolved pair carries both spaces with the nullable half explicit.
  const pair: ResolvedIdentityPair = { learnerId: asLearnerId('l'), studentId: null }
  assert.equal(pair.studentId, null)
  assert.equal(pair.learnerId, 'l')
})

test('Evidence and Projection write rows are typed to the space they actually hold', () => {
  // Both columns are NAMED learner_id and FK'd to students(id). These assert
  // the TypeScript row types state the real domain, which is what stops a
  // Core LearnerId reaching either write.
  type EvidenceRow = import('@/lib/repositories/evidence.repository').EvidenceRow
  type ProjectionRow = import('@/lib/repositories/projection.repository').ProjectionRow

  expectType<Equals<EvidenceRow['learner_id'], StudentId | null>>(true)
  expectType<Equals<ProjectionRow['learner_id'], StudentId>>(true)
  assert.ok(true)
})

test('the Blueprint carries a Core LearnerId, and its composers a legacy StudentId', () => {
  type Ids = import('@/lib/learnerBlueprint/types').BlueprintIdentifiers
  expectType<Equals<Ids['coreLearnerId'], LearnerId>>(true)

  type ComposeCareer = typeof import('@/lib/learnerBlueprint/composeCareer').composeCareer
  expectType<Equals<Parameters<ComposeCareer>[0], StudentId | null>>(true)
  assert.ok(true)
})

test('the intelligence resolver reports the space it actually matched against', () => {
  type Resolution = import('@/lib/intelligence/identityResolution').IdentityResolution
  expectType<Equals<Resolution['studentId'], StudentId | null>>(true)

  // The old field name is gone — it claimed a Core learner identity while
  // every value came from a `students` query.
  type HasOldField = 'learnerId' extends keyof Resolution ? true : false
  expectType<Equals<HasOldField, false>>(true)
  assert.ok(true)
})
