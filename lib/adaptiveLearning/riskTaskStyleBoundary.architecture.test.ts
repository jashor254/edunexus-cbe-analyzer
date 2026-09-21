// lib/adaptiveLearning/riskTaskStyleBoundary.architecture.test.ts
//
// PHASE 6 — Adaptive Next-Action Loop audit, superseded by the CBC-level
// tier redesign (2026-09-04): `rawBand()` used to read a subject's risk
// flag to choose between `critical_gap` and `prerequisite_gap` when a
// learner was at CBC level 1 — both resolving to the same 'foundational'
// TaskStyle, so risk could only ever affect a label/rationale, never
// instructional difficulty. That branch is retired: `rawBand()` is now a
// pure function of CBC level alone (`AdaptiveGroupType` is 'BE'|'AE'|'ME'|
// 'EE', a direct 1:1 with the level), and risk severity survives only as
// `AdaptiveDecision.riskFlag` — informational, read by nothing that
// chooses a band or a tier.
//
// This guard now protects the boundary in its new, stricter form: risk
// must never re-enter classification at all, not even at the old narrow
// "same taskStyle" carve-out. If this test ever needs to change, that is
// itself the signal the boundary has moved and should be reviewed, not
// casually adjusted.
//
// Run: npx tsx --test lib/adaptiveLearning/riskTaskStyleBoundary.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

test('rawBand() takes CBC level alone — no risk-severity parameter of any kind', () => {
  const src = read('lib/adaptiveLearning/recommend.ts')
  const fn = src.match(/function rawBand\([^)]*\)/)
  assert.ok(fn, 'rawBand() not found')
  assert.doesNotMatch(
    fn![0],
    /severity|risk|flag/i,
    'rawBand() must take only a CBC level — risk severity re-entering its signature would mean risk is once again a second classification axis'
  )
})

test('TASK_STYLE_BY_GROUP has exactly 4 entries, one per CBC band, no risk-derived band left to collapse', () => {
  const src = read('lib/adaptiveLearning/recommend.ts')
  const styleMap = src.match(/const TASK_STYLE_BY_GROUP[\s\S]*?\n}/)
  assert.ok(styleMap, 'TASK_STYLE_BY_GROUP not found')
  for (const band of ['BE', 'AE', 'ME', 'EE']) {
    assert.match(styleMap![0], new RegExp(`${band}:\\s*'[a-z]+'`), `TASK_STYLE_BY_GROUP missing an entry for ${band}`)
  }
  assert.doesNotMatch(styleMap![0], /critical_gap|prerequisite_gap|concept_confusion|on_track/,
    'TASK_STYLE_BY_GROUP must not resurrect the retired risk-mixed taxonomy')
})

test('decideAdaptive still surfaces risk severity, but only as an informational field never read by rawBand/groupType selection', () => {
  const src = read('lib/adaptiveLearning/recommend.ts')
  assert.match(src, /riskFlag:\s*string \| null/, 'AdaptiveDecision must still carry risk severity somewhere — it is real information, not deleted')
  // The only call site of rawBand() must pass level alone, never subjectFlag/severity.
  const callSite = src.match(/const undamped = rawBand\([^)]*\)/)
  assert.ok(callSite, 'rawBand() call site not found in decideAdaptive')
  assert.doesNotMatch(callSite![0], /subjectFlag|severity/i,
    'decideAdaptive must not pass risk severity into rawBand() — riskFlag is read independently, never fed into band selection')
})
