// lib/grading/thresholdConflictInventory.architecture.test.ts
//
// PHASE 5.5 — Remaining Career Authority Closeout.
//
// VERDICT: POLICY DECISION REQUIRED, not converged. Two dedicated prior
// audits in this repo (docs/engineering/sprint-4b-grading-policy-
// ratification.md, sprint-4c0-grading-policy-integration.md) already
// searched exhaustively for an authoritative KICD/KNEC source for the raw-
// score-to-CBC-level boundary and found none — both explicitly end in
// "requires human ratification," not a resolution. This phase re-confirmed
// that finding and found the conflict is WIDER than previously documented:
// at least 6 independently-maintained threshold sets exist, not 3-4:
//
//   A  lib/intelligence/cbcScale.ts            75/50/30  (canonical Evidence Domain)
//   B  lib/assessments/gradeCalculator.ts      76/51/31  (legacy teacher gradebook)
//   C  lib/grading/boundaries.ts CBC_SCALE_STANDARD       76/51/31 (mirrors B)
//   D  lib/grading/boundaries.ts CBC_SCALE_CORE_LEGACY    75/50/25 (mirrors core assessments/report-cards)
//   E  lib/curriculum/regional/ke-cbc.ts       75/50/25  (self-labeled "canonical reference," unverified)
//   F  3 inline copies (tsc-view route, assignment results/marking pages)  75/55/40
//   G  2 inline copies (notify.ts, email/sender.ts)                       80/60/40
//
// This phase deliberately changed NONE of these values — per the explicit
// mandate "do not choose a CBC threshold because it appears most
// intuitive." This test is not a "pick the winner" guard — it is a DRIFT
// DETECTOR: it locks in today's known-inconsistent values so that any
// FUTURE change to any one of them is a deliberate, reviewed act (and
// should come with an update to this file, the policy-decision docs, and
// ideally the human ratification both prior sprints called for) — never a
// silent, incidental edit that quietly shifts which score classifies as
// which CBC band for one consumer but not the others.
//
// Run: npx tsx --test lib/grading/thresholdConflictInventory.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

test('Set A (Evidence Domain, lib/intelligence/cbcScale.ts): 75/50/30 unchanged', () => {
  const src = read('lib/intelligence/cbcScale.ts')
  assert.match(src, /level4:\s*75/)
  assert.match(src, /level3:\s*50/)
  assert.match(src, /level2:\s*30/)
})

test('Set B (legacy teacher gradebook, lib/assessments/gradeCalculator.ts BUILTIN_CBC_SCALE): 76/51/31 unchanged', () => {
  const src = read('lib/assessments/gradeCalculator.ts')
  const scaleMatch = src.match(/BUILTIN_CBC_SCALE[\s\S]*?\n}/)
  assert.ok(scaleMatch, 'BUILTIN_CBC_SCALE not found')
  const scale = scaleMatch![0]
  assert.match(scale, /EE'[\s\S]*?minPct:\s*76/)
  assert.match(scale, /ME'[\s\S]*?minPct:\s*51/)
  assert.match(scale, /AE'[\s\S]*?minPct:\s*31/)
})

test('Set C/D (lib/grading/boundaries.ts, both reference scales): STANDARD 76/51/31, CORE_LEGACY 75/50/25 unchanged', () => {
  const src = read('lib/grading/boundaries.ts')
  const standard = src.match(/CBC_SCALE_STANDARD[\s\S]*?\n}/)![0]
  assert.match(standard, /EE'[\s\S]*?minPct:\s*76/)
  assert.match(standard, /AE'[\s\S]*?minPct:\s*31/)

  const legacy = src.match(/CBC_SCALE_CORE_LEGACY[\s\S]*?\n}/)![0]
  assert.match(legacy, /EE'[\s\S]*?minPct:\s*75/)
  assert.match(legacy, /AE'[\s\S]*?minPct:\s*25/)
})

test('Set E (lib/curriculum/regional/ke-cbc.ts GRADING_SCALE, "the canonical reference implementation" — self-labeled, not externally verified): 75/50/25 unchanged', () => {
  const src = read('lib/curriculum/regional/ke-cbc.ts')
  const scale = src.match(/GRADING_SCALE[\s\S]*?\n\]/)![0]
  assert.match(scale, /EE'[\s\S]*?minPct:\s*75/)
  assert.match(scale, /AE'[\s\S]*?minPct:\s*25/)
})

test('Set F (3 inline copies, 75/55/40 — confirmed this phase to drive a teacher-facing "struggling" alert inconsistently with the canonical Set A classification at the 30-40% band): all 3 copies still present and unchanged', () => {
  for (const rel of [
    'app/api/lesson-plans/[planId]/tsc-view/route.ts',
    'app/teacher/assignments/[assignmentId]/page.tsx',
    'app/teacher/assignments/[assignmentId]/results/page.tsx',
  ]) {
    const src = read(rel)
    assert.match(src, /pct >= 75/, `${rel}: expected Set F's 75 EE-equivalent floor`)
    assert.match(src, /pct >= 55/, `${rel}: expected Set F's 55 ME-equivalent floor`)
    assert.match(src, /pct >= 40/, `${rel}: expected Set F's 40 AE-equivalent floor`)
  }
})

test('Set G (2 byte-identical copies, 80/60/40 — text-only, never persisted, but the widest disagreement of all 6 sets): both copies still present and unchanged', () => {
  for (const rel of ['lib/notifications/notify.ts', 'lib/email/sender.ts']) {
    const src = read(rel)
    const fn = src.match(/function deriveCbcLevel[\s\S]*?\n}/)
    assert.ok(fn, `${rel}: deriveCbcLevel not found`)
    assert.match(fn![0], /pct >= 80/)
    assert.match(fn![0], /pct >= 60/)
    assert.match(fn![0], /pct >= 40/)
  }
})

test('lib/grading/boundaries.ts still explicitly refuses to declare a winner — the un-picked status this phase preserved, not resolved', () => {
  const src = read('lib/grading/boundaries.ts')
  assert.match(
    src,
    /intentionally keeps[\s\S]{0,20}separately-named scales rather than picking a winner/,
    'boundaries.ts must keep documenting that no threshold set has been ratified — if this line is gone, someone made the policy decision this phase deferred and this test (and the Phase 5.5 closeout) should be updated to reflect it'
  )
})
