// lib/compass/pedagogy.test.ts
//
// Pure unit tests for the misconception -> remediation -> re-check state
// machine. No database, no network — every input is a hand-built raw model
// output string or CompassPedagogyState fixture.
//
// Run: npm test -- lib/compass/pedagogy.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePedagogyBlock,
  stripPedagogyBlock,
  shouldBlockMasteryForPedagogy,
  buildUnresolvedPedagogyNote,
  type CompassPedagogyState,
} from './pedagogy'

function block(json: string): string {
  return `Some learner-facing reply text.\nCOMPASS_PEDAGOGY_START\n${json}\nCOMPASS_PEDAGOGY_END`
}

// ── Case 1 — no misconception ────────────────────────────────────────────────

test('1. no block present: parsePedagogyBlock returns null, no false state introduced', () => {
  const result = parsePedagogyBlock('Just a normal reply, no structured block at all.')
  assert.equal(result, null)
})

// ── Case 2 — misconception detected mid-remediation ──────────────────────────

test('2. remediation in progress: recheck required, not yet passed — mastery is blocked', () => {
  const state = parsePedagogyBlock(block(
    '{"decision":"REMEDIATE","misconception_type":"prerequisite_gap","concept":"fractions","remediation":{"started":true,"completed":false},"recheck":{"required":true,"completed":false,"passed":false}}'
  ))
  assert.ok(state)
  assert.equal(state!.misconceptionType, 'prerequisite_gap')
  assert.equal(shouldBlockMasteryForPedagogy(state), true)
})

// ── Case 3 — remediation succeeds ────────────────────────────────────────────

test('3. re-check passed with completed remediation: mastery is allowed', () => {
  const state = parsePedagogyBlock(block(
    '{"decision":"RECHECK","misconception_type":"procedure_error","concept":"long division","remediation":{"started":true,"completed":true},"recheck":{"required":true,"completed":true,"passed":true}}'
  ))
  assert.ok(state)
  assert.equal(shouldBlockMasteryForPedagogy(state), false)
  assert.equal(buildUnresolvedPedagogyNote(state), '')
})

// ── Case 4 — remediation fails ───────────────────────────────────────────────

test('4. re-check completed but failed: mastery stays blocked, unresolved note is produced', () => {
  const state = parsePedagogyBlock(block(
    '{"decision":"RECHECK","misconception_type":"concept_misunderstanding","concept":"place value","remediation":{"started":true,"completed":true},"recheck":{"required":true,"completed":true,"passed":false}}'
  ))
  assert.ok(state)
  assert.equal(shouldBlockMasteryForPedagogy(state), true)
  const note = buildUnresolvedPedagogyNote(state)
  assert.match(note, /concept misunderstanding/)
  assert.match(note, /place value/)
})

// ── Case 5 — malformed model output ──────────────────────────────────────────

test('5a. malformed JSON inside the markers: returns null, never throws', () => {
  assert.doesNotThrow(() => {
    const result = parsePedagogyBlock(block('{not valid json'))
    assert.equal(result, null)
  })
})

test('5b. invalid enum value: rejected by schema, returns null', () => {
  const result = parsePedagogyBlock(block(
    '{"decision":"MAKE_LEARNER_FEEL_BAD","recheck":{"required":true,"completed":true,"passed":true}}'
  ))
  assert.equal(result, null)
})

test('5c. missing required "decision" field: rejected by schema, returns null', () => {
  const result = parsePedagogyBlock(block(
    '{"misconception_type":"careless_error","recheck":{"required":true}}'
  ))
  assert.equal(result, null)
})

// ── Safety invariant: recheck.passed=true is never trusted without its preconditions ──

test('impossible state: recheck.passed=true but recheck never completed — downgraded to false, not trusted', () => {
  const state = parsePedagogyBlock(block(
    '{"decision":"ADVANCE","misconception_type":"unknown","recheck":{"required":true,"completed":false,"passed":true}}'
  ))
  assert.ok(state)
  assert.equal(state!.recheck.passed, false)
  assert.equal(shouldBlockMasteryForPedagogy(state), true)
})

test('impossible state: recheck.passed=true but remediation never completed — downgraded to false', () => {
  const state = parsePedagogyBlock(block(
    '{"decision":"RECHECK","misconception_type":"unknown","remediation":{"started":true,"completed":false},"recheck":{"required":true,"completed":true,"passed":true}}'
  ))
  assert.ok(state)
  assert.equal(state!.recheck.passed, false)
})

// ── stripPedagogyBlock ────────────────────────────────────────────────────────

test('stripPedagogyBlock removes the block from learner-visible text', () => {
  const raw = block('{"decision":"TEACH"}')
  const visible = stripPedagogyBlock(raw)
  assert.doesNotMatch(visible, /COMPASS_PEDAGOGY_START/)
  assert.match(visible, /Some learner-facing reply text\./)
})

test('stripPedagogyBlock is a no-op when no block is present', () => {
  const text = 'Nothing to strip here.'
  assert.equal(stripPedagogyBlock(text), text)
})

// ── shouldBlockMasteryForPedagogy / buildUnresolvedPedagogyNote on null ──────

test('null/undefined state never blocks mastery and never produces a note', () => {
  assert.equal(shouldBlockMasteryForPedagogy(null), false)
  assert.equal(shouldBlockMasteryForPedagogy(undefined), false)
  assert.equal(buildUnresolvedPedagogyNote(null), '')
})

test('recheck not required at all (e.g. TEACH/ADVANCE turn): never blocks mastery', () => {
  const state: CompassPedagogyState = {
    decision: 'ADVANCE',
    misconceptionType: null,
    concept: null,
    remediation: { started: false, completed: false },
    recheck: { required: false, completed: false, passed: null },
  }
  assert.equal(shouldBlockMasteryForPedagogy(state), false)
})
