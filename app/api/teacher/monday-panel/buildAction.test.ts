// app/api/teacher/monday-panel/buildAction.test.ts
//
// Phase 3.5 (Risk Consumer Convergence) — pure unit test for buildAction(),
// which now formats Projection's own RiskFlag (lib/projection/types.ts)
// instead of the legacy learner_profiles taxonomy. Proves the exact
// migration rule this phase is bound by: "formatting canonical Projection
// state is allowed, creating a new risk formula is not" — buildAction must
// reuse Projection's `reason` text verbatim, never re-derive a category-
// based judgment the legacy switch statement used to invent.
//
// Run: npx tsx --test app/api/teacher/monday-panel/buildAction.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAction } from './buildAction'

test('no flag: falls back to a generic check-in, never throws on undefined', () => {
  const result = buildAction(undefined, 'Amina')
  assert.equal(result, 'Check in with Amina this week — their profile is incomplete.')
})

test('a flag is formatted as "{firstName}: {reason}" — Projection\'s own sentence, not reclassified', () => {
  const result = buildAction(
    { subject: 'mathematics', severity: 'critical', reason: 'Below Expectation in mathematics and declining from prior evidence' },
    'Brian'
  )
  assert.equal(result, 'Brian: Below Expectation in mathematics and declining from prior evidence')
})

test('the reason text is used verbatim — no truncation, no keyword-based rewrite', () => {
  const longReason = 'Conflicting evidence for kiswahili_lugha — two confirmed sources disagree; a teacher should review before relying on this.'
  const result = buildAction({ subject: 'kiswahili_lugha', severity: 'watch', reason: longReason }, 'Faith')
  assert.ok(result.includes(longReason), 'the full Projection reason must survive formatting unmodified')
})

test('regression guard: no legacy category-specific phrasing is fabricated for any severity', () => {
  // Before Phase 3.5, a 'missing_prerequisite'/'disengaged'-typed legacy
  // flag would produce bespoke, hardcoded advice text
  // ("Re-teach this first — 15 minutes...", "Personal contact first.").
  // Projection's RiskFlag carries no such category, so none of that
  // invented advice may ever appear again.
  for (const severity of ['watch', 'at_risk', 'critical'] as const) {
    const result = buildAction({ subject: 'english', severity, reason: 'Below Expectation in english' }, 'Joy')
    assert.doesNotMatch(result, /Re-teach this first/)
    assert.doesNotMatch(result, /Personal contact first/)
    assert.doesNotMatch(result, /Focus on one substrand at a time/)
    assert.doesNotMatch(result, /Brief one-on-one/)
  }
})
