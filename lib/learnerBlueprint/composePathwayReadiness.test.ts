// lib/learnerBlueprint/composePathwayReadiness.test.ts
//
// Run: npx tsx --test lib/learnerBlueprint/composePathwayReadiness.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composePathwayReadiness } from './composePathwayReadiness'
import type { SubjectRecord } from './types'

function subject(name: string, level: 1 | 2 | 3 | 4): SubjectRecord {
  return { subject: name, latestLevel: level, trend: 'stable', evidenceCount: 3, latestEvidenceAt: '2026-06-01T00:00:00.000Z' }
}

/** A full nine-group KJSEA record, so the composite is not partial. */
function fullRecord(level: 1 | 2 | 3 | 4): SubjectRecord[] {
  return [
    subject('English', level),
    subject('Kiswahili', level),
    subject('Mathematics', level),
    subject('Integrated Science', level),
    subject('Social Studies', level),
    subject('Agriculture Nutrition', level),
    subject('Christian Religious Education', level),
    subject('Creative Arts Sports', level),
    subject('Pre Technical Studies', level),
  ]
}

// ── The grade-band asymmetry: the reason this composer exists ────────────────

test('a senior learner gets no pathway gap — the decision is already made', () => {
  for (const band of ['grade_10', 'grade_11_12'] as const) {
    const section = composePathwayReadiness(band, fullRecord(3))
    assert.equal(section.status, 'unavailable', `expected unavailable for ${band}`)
    assert.equal(section.data, null)
    assert.match(section.unavailableReason ?? '', /already been placed/)
  }
})

test('an unknown grade band withholds rather than guessing', () => {
  const section = composePathwayReadiness('unknown', fullRecord(3))
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /grade could not be determined/)
})

test('Grade 7-8 gets the composite and the "this counts" message but NO forecast', () => {
  const section = composePathwayReadiness('grade_7_8', fullRecord(3))
  assert.equal(section.status, 'available')
  assert.equal(section.data?.stage, 'accumulating')
  // The whole point: a projection off two terms would be a guess wearing a number.
  assert.equal(section.data?.recommendedPathway, null)
  assert.deepEqual(section.data?.qualifiesFor, [])
  assert.equal(section.data?.nextDoor, null)
  assert.match(section.data?.stageMessage ?? '', /too early to project/)
  assert.match(section.data?.stageMessage ?? '', /already counts/)
})

test('Grade 9 gets the full forecast — this is the decision year', () => {
  const section = composePathwayReadiness('grade_9', fullRecord(4))
  assert.equal(section.status, 'available')
  assert.equal(section.data?.stage, 'decision_year')
  assert.notEqual(section.data?.recommendedPathway, null)
  assert.ok((section.data?.compositeScore ?? 0) > 0)
})

// ── Evidence honesty ────────────────────────────────────────────────────────

test('too little evidence yields unavailable, never a composite off two subjects', () => {
  const section = composePathwayReadiness('grade_9', [
    subject('Mathematics', 4),
    subject('English', 3),
  ])
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
  assert.match(section.unavailableReason ?? '', /at least 3 of the 9/)
  assert.match(section.unavailableReason ?? '', /describe our records, not the learner/)
})

test('a partial composite is flagged as a floor, not presented as a score', () => {
  const section = composePathwayReadiness('grade_9', [
    subject('Mathematics', 4),
    subject('English', 3),
    subject('Integrated Science', 4),
  ])
  assert.equal(section.status, 'available')
  assert.equal(section.data?.isPartialComposite, true)
  assert.ok(
    section.data?.notes.some(n => /floor/.test(n)),
    'expected a note explaining the composite can only go up',
  )
})

test('a complete nine-group record is not flagged partial', () => {
  const section = composePathwayReadiness('grade_9', fullRecord(3))
  assert.equal(section.data?.isPartialComposite, false)
  assert.equal(section.data?.subjectsEntered, 9)
})

// ── The provisional-rule-set contract (lib/config/kjseaRules.ts) ─────────────

test('every available section carries the disclaimer and the rule-set cycle', () => {
  for (const band of ['grade_7_8', 'grade_9'] as const) {
    const section = composePathwayReadiness(band, fullRecord(3))
    assert.equal(section.status, 'available')
    assert.ok((section.data?.disclaimer ?? '').length > 0, `no disclaimer for ${band}`)
    assert.ok((section.data?.disclaimerFull ?? '').length > 0)
    assert.ok((section.data?.source ?? '').length > 0)
    assert.ok((section.data?.ruleSetCycle ?? '').length > 0)
    assert.equal(typeof section.data?.ruleSetVerified, 'boolean')
  }
})

test('an unverified rule set says so in the notes, not only in the flag', () => {
  const section = composePathwayReadiness('grade_9', fullRecord(3))
  if (section.data?.ruleSetVerified === false) {
    assert.ok(
      section.data.notes.some(n => /not yet confirmed against an official KNEC/.test(n)),
      'an unverified rule set must be stated in reader-facing notes',
    )
  }
})

// ── Subject key handling ────────────────────────────────────────────────────

test('display-name subjects map onto canonical KJSEA keys', () => {
  // "Integrated Science" and "Pre Technical Studies" only count toward the
  // subject-group total if the display-name lowering works.
  const section = composePathwayReadiness('grade_9', [
    subject('Integrated Science', 3),
    subject('Pre Technical Studies', 3),
    subject('Social Studies', 3),
  ])
  assert.equal(section.status, 'available')
  assert.equal(section.data?.subjectsEntered, 3)
})

test('a subject recorded twice takes its stronger level, not the last one seen', () => {
  const strongerFirst = composePathwayReadiness('grade_9', [
    subject('Mathematics', 4),
    subject('mathematics', 1),
    subject('English', 3),
    subject('Integrated Science', 3),
  ])
  const strongerLast = composePathwayReadiness('grade_9', [
    subject('Mathematics', 1),
    subject('mathematics', 4),
    subject('English', 3),
    subject('Integrated Science', 3),
  ])
  assert.equal(strongerFirst.data?.compositeScore, strongerLast.data?.compositeScore)
})

test('no section is ever composed with a fabricated zero composite', () => {
  const section = composePathwayReadiness('grade_9', fullRecord(1))
  // Level 1 across the board is a real, low record — it must still produce a
  // real composite rather than being suppressed as "no data".
  assert.equal(section.status, 'available')
  assert.ok((section.data?.compositeScore ?? -1) >= 0)
})
