// lib/adaptiveLearning/riskTaskStyleBoundary.architecture.test.ts
//
// PHASE 6 — Adaptive Next-Action Loop audit.
//
// Finding this guard locks in: `rawBand()` (lib/adaptiveLearning/recommend.ts)
// reads a subject's canonical risk flag to choose between two group labels —
// `critical_gap` vs `prerequisite_gap` — when a learner is already at CBC
// level 1. That is a real, direct coupling from risk into the adaptive
// classifier's decision (not merely risk surfacing to a teacher, the
// pattern Phase 3.5 guarded). It is deliberately narrow: both group types
// resolve through the SAME instructional style, `'foundational'`
// (TASK_STYLE_BY_GROUP, recommend.ts), so risk changes which *label and
// rationale text* a teacher/learner sees, never which *difficulty or
// scaffolding* Compass/an assignment actually delivers. Subject-scoping is
// separately guarded by recommend.test.ts's "a risk flag for a different
// subject is ignored".
//
// This test does not change that behavior and does not touch Projection's
// risk/capability authority — it only prevents a future edit from silently
// widening the coupling (e.g. giving critical_gap its own, harder
// taskStyle), which would make risk a direct instructional-difficulty
// control rather than the classification-label nuance it is today. If this
// test ever needs to change, that is itself the signal that the boundary
// has moved and should be reviewed, not casually adjusted.
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

test('risk only ever separates critical_gap from prerequisite_gap at the label/rationale layer, never at taskStyle — both share the same foundational instructional style', () => {
  const src = read('lib/adaptiveLearning/recommend.ts')

  const styleMap = src.match(/const TASK_STYLE_BY_GROUP[\s\S]*?\n}/)
  assert.ok(styleMap, 'TASK_STYLE_BY_GROUP not found')
  const critical = styleMap![0].match(/critical_gap:\s*'([a-z]+)'/)
  const prerequisite = styleMap![0].match(/prerequisite_gap:\s*'([a-z]+)'/)
  assert.ok(critical && prerequisite, 'expected both critical_gap and prerequisite_gap entries in TASK_STYLE_BY_GROUP')
  assert.equal(
    critical![1],
    prerequisite![1],
    'critical_gap and prerequisite_gap must resolve to the same TaskStyle — if this ever diverges, risk has started directly controlling instructional difficulty, not just a classification label, and that is a product decision, not an incidental edit'
  )
})

test('rawBand() is still the only place a subject risk flag feeds the adaptive classifier — level 1 + critical risk is the sole risk-driven branch', () => {
  const src = read('lib/adaptiveLearning/recommend.ts')
  const fn = src.match(/function rawBand\([\s\S]*?\n}/)
  assert.ok(fn, 'rawBand() not found')
  assert.match(
    fn![0],
    /subjectFlagSeverity === 'critical'/,
    'rawBand must still gate the risk-driven critical_gap branch on the subject-scoped flag severity, not a broader/looser risk read'
  )
})
