// lib/core/identityTypes.test.ts
//
// Run: npm test -- lib/core/identityTypes.test.ts
//
// Two kinds of assertion live here:
//
//   1. Runtime tests, proving the brands are erased and change no behaviour.
//   2. `@ts-expect-error` compile-time tests, proving the mistakes this whole
//      phase exists to prevent are now rejected by tsc. A `@ts-expect-error`
//      that stops being an error becomes a compile failure itself, so if
//      someone weakens the brands, THIS FILE stops compiling — which is
//      exactly the alarm we want.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  asLearnerId,
  asStudentId,
  asLearnerIdOrNull,
  asStudentIdOrNull,
  identityIsIn,
  type LearnerId,
  type StudentId,
  type AnyLearnerIdentity,
} from './identityTypes'

// ── Runtime: brands are erased ───────────────────────────────────────────────

test('a branded id is the same string at runtime', () => {
  const raw = '11111111-1111-1111-1111-111111111111'
  const learnerId = asLearnerId(raw)
  const studentId = asStudentId(raw)

  assert.equal(learnerId, raw)
  assert.equal(studentId, raw)
  assert.equal(typeof learnerId, 'string')
  assert.equal(JSON.stringify({ learnerId }), `{"learnerId":"${raw}"}`)
})

test('the nullable constructors pass null and undefined through', () => {
  assert.equal(asLearnerIdOrNull(null), null)
  assert.equal(asLearnerIdOrNull(undefined), null)
  assert.equal(asStudentIdOrNull(null), null)
  assert.equal(asStudentIdOrNull('abc'), 'abc')
})

test('identityIsIn answers plain membership across both spaces', () => {
  const students = [asStudentId('s1'), asStudentId('s2')]
  const learners = [asLearnerId('l1')]

  assert.equal(identityIsIn(students, asStudentId('s1')), true)
  assert.equal(identityIsIn(students, asStudentId('s9')), false)
  assert.equal(identityIsIn(learners, asLearnerId('l1')), true)
  // The deliberate cross-space case `requireParent` relies on: a LearnerId
  // tested against a StudentId[] answers false rather than failing to compile.
  assert.equal(identityIsIn(students, asLearnerId('l1')), false)
})

// ── Compile-time: the invariant ──────────────────────────────────────────────

// Real values, not `declare const` — these run at runtime as well as
// type-check, so a broken brand fails compilation and a broken constructor
// fails the test.
const learnerId: LearnerId = asLearnerId('22222222-2222-2222-2222-222222222222')
const studentId: StudentId = asStudentId('33333333-3333-3333-3333-333333333333')
const plain: string = '44444444-4444-4444-4444-444444444444'

function needsStudent(_id: StudentId): void {}
function needsLearner(_id: LearnerId): void {}
function needsEither(_id: AnyLearnerIdentity): void {}

test('the identity invariant is enforced by the compiler', () => {
  // Correct usage compiles.
  needsStudent(studentId)
  needsLearner(learnerId)
  needsEither(studentId)
  needsEither(learnerId)

  // A branded id still satisfies a plain-string parameter — this asymmetry is
  // what keeps the blast radius small, so it is asserted deliberately.
  const widened: string = studentId
  assert.equal(typeof widened, 'string')

  // @ts-expect-error a LearnerId must never be accepted where a StudentId is required
  needsStudent(learnerId)

  // @ts-expect-error a StudentId must never be accepted where a LearnerId is required
  needsLearner(studentId)

  // @ts-expect-error an unbranded string must not enter either space implicitly
  needsStudent(plain)

  // @ts-expect-error same for the Core space
  needsLearner(plain)

  // @ts-expect-error and not even into the deliberately-permissive union
  needsEither(plain)

  assert.ok(true, 'compile-time assertions above are the real test')
})

test('the two spaces do not compare as equal types', () => {
  // @ts-expect-error comparing across spaces is a type error, not a silent false
  const _never = learnerId === studentId
  void _never
  assert.ok(true)
})
