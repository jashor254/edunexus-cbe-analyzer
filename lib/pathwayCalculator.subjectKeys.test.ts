// lib/pathwayCalculator.subjectKeys.test.ts
//
// Regression lock for the silent subject-key mismatch found by live testing on
// 2026-10-06. Evidence keeps the source's spelling ("integrated science",
// "pre-technical studies", "creative arts & sports"), but every analytical
// consumer keys on snake_case. normalizeSubjectKey() only lowercased, so those
// subjects were dropped: a pilot school's capability profiles used Maths,
// English and Kiswahili alone, and its Grade 9 STEM gate read Integrated
// Science as absent. The subject names below are taken verbatim from
// production learner_projections keys.
//
// Also proves the analytical/identity split from lib/intelligence/
// subjectMapping.ts is intact: the family merge core_mathematics → mathematics
// still happens here, and the identity normalizer is untouched.
//
// Run: npm test -- lib/pathwayCalculator.subjectKeys.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSubjectKey, normalizeSubjectScores, calculateJuniorPathwayAffinity } from './pathwayCalculator'
import { normalizeSubjectKeyForIdentity } from './intelligence/subjectMapping'
import { extractCapabilityProfile } from './career/capabilityExtractor'

test('subject names exactly as stored in production map to the analytical keys', () => {
  const cases: Array<[string, string]> = [
    ['integrated science',            'integrated_science'],
    ['social studies',                'social_studies'],
    ['pre-technical studies',         'pre_technical_studies'],
    ['creative arts & sports',        'creative_arts_sports'],
    ['creative arts',                 'creative_arts_sports'],
    ['christian religious education', 'christian_religious_education'],
    ['agriculture & nutrition',       'agriculture_nutrition'],
    ['kiswahili_lugha',               'kiswahili'],
    ['history_citizenship',           'history'],
    ['History & Citizenship',         'history'],
    ['Mathematics',                   'mathematics'],
    ['  Mathematics ',                'mathematics'],
    ['Kiswahili/KSL',                 'kiswahili_ksl'],
  ]
  for (const [stored, expected] of cases) {
    assert.equal(normalizeSubjectKey(stored), expected, `"${stored}"`)
  }
})

test('existing aliases and already-canonical keys are unchanged', () => {
  assert.equal(normalizeSubjectKey('core_mathematics'), 'mathematics', 'the deliberate family merge for the STEM gate stays')
  assert.equal(normalizeSubjectKey('emat'), 'essential_mathematics')
  assert.equal(normalizeSubjectKey('geo'), 'geography')
  assert.equal(normalizeSubjectKey('History & Government'), 'history_and_government')
  assert.equal(normalizeSubjectKey('history and government'), 'history_and_government')
  assert.equal(normalizeSubjectKey('business studies'), 'business_studies')
  for (const k of ['integrated_science', 'pre_technical_studies', 'creative_arts_sports', 'english', 'cre']) {
    assert.equal(normalizeSubjectKey(k), k)
  }
})

test('the identity normalizer is untouched: still lossless, still keeps the source spelling', () => {
  assert.equal(normalizeSubjectKeyForIdentity('core_mathematics'), 'core_mathematics')
  assert.equal(normalizeSubjectKeyForIdentity('integrated science'), 'integrated science')
})

test('two spellings of one subject collapse to one, keeping the higher level (existing collision rule)', () => {
  const out = normalizeSubjectScores({ 'integrated science': 2, integrated_science: 3 })
  assert.deepEqual(out, { integrated_science: 3 })
})

test('Grade 9 STEM gate reads Integrated Science stored with a space', () => {
  const spaced = calculateJuniorPathwayAffinity({
    mathematics: 2, 'integrated science': 4, english: 3, kiswahili: 3, 'social studies': 3, 'creative arts & sports': 3,
  })
  const snake = calculateJuniorPathwayAffinity({
    mathematics: 2, integrated_science: 4, english: 3, kiswahili: 3, social_studies: 3, creative_arts_sports: 3,
  })
  assert.equal(spaced.stem_viable, snake.stem_viable)
  assert.equal(spaced.top_pathway, snake.top_pathway)
  assert.equal(spaced.stem_viable, true, 'science at Level 4 must reach the gate')
})

test('capability profile from production-spelled subjects observes every subject dimension', () => {
  const snap = {
    mathematics: 2, english: 2, kiswahili: 2, 'integrated science': 2, 'social studies': 2,
    'pre-technical studies': 2, 'creative arts & sports': 2, 'christian religious education': 2,
  }
  const p = extractCapabilityProfile([snap, snap])
  for (const d of ['analytical_reasoning', 'communication', 'creative_thinking', 'technical_aptitude', 'social_intelligence'] as const) {
    assert.ok(p[d].confidence > 0, `${d} confidence is 0`)
  }
  assert.ok(p.technical_aptitude.evidence.some(e => e.startsWith('pre technical studies')), 'Pre-Technical Studies must reach Technical Aptitude')
  assert.ok(p.analytical_reasoning.evidence.some(e => e.startsWith('integrated science')), 'Integrated Science must reach Analytical Reasoning')
  assert.ok(p.social_intelligence.evidence.some(e => e.startsWith('social studies')))
})

test('kiswahili_lugha and history_citizenship count toward Communication', () => {
  const p = extractCapabilityProfile([{ kiswahili_lugha: 3, history_citizenship: 3 }])
  assert.ok(p.communication.confidence > 0)
  assert.ok(p.communication.evidence.some(e => e.startsWith('kiswahili')))
  assert.ok(p.communication.evidence.some(e => e.startsWith('history')))
})
