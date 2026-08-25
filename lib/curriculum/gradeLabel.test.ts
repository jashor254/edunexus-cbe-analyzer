// lib/curriculum/gradeLabel.test.ts
//
// 8-4-4 Career Intelligence compatibility fix — proves
// resolveCurriculumFraming() never infers curriculum identity from grade
// alone. curriculum_type is authoritative: CBC Senior School (Grade 10-12)
// and 8-4-4's remaining Form 3/4 cohort share the same numeric grade range
// (lib/config/curriculumPhaseOut.ts), so grade cannot disambiguate them.
//
// Run: npx tsx --test lib/curriculum/gradeLabel.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCurriculumFraming } from './gradeLabel'

test('CBC Junior (Grade 7-9): label is CBC Junior, CBC pathway vocabulary is admissible', () => {
  const framing = resolveCurriculumFraming('cbc', 8)
  assert.equal(framing.label, 'Grade 8 — CBC Junior')
  assert.equal(framing.cbcPathwayAdmissible, true)
})

test('CBC Senior (Grade 10+): label is CBC Senior, CBC pathway vocabulary is admissible', () => {
  const framing = resolveCurriculumFraming('cbc', 11)
  assert.equal(framing.label, 'Grade 11 — CBC Senior')
  assert.equal(framing.cbcPathwayAdmissible, true)
})

test('8-4-4 Form 3 (grade 11): label reads 8-4-4 Form 3, never CBC, CBC pathway vocabulary is not admissible', () => {
  const framing = resolveCurriculumFraming('844', 11)
  assert.equal(framing.label, '8-4-4 Form 3')
  assert.equal(framing.cbcPathwayAdmissible, false)
  assert.ok(!framing.label.includes('CBC'), 'an 8-4-4 label must never contain the string "CBC"')
})

test('8-4-4 Form 4 (grade 12): label reads 8-4-4 Form 4, never CBC, CBC pathway vocabulary is not admissible', () => {
  const framing = resolveCurriculumFraming('844', 12)
  assert.equal(framing.label, '8-4-4 Form 4')
  assert.equal(framing.cbcPathwayAdmissible, false)
  assert.ok(!framing.label.includes('CBC'))
})

test('grade 11/12 alone never decides curriculum identity: same grade, opposite curriculum_type, opposite label', () => {
  const cbcEleven = resolveCurriculumFraming('cbc', 11)
  const f844Eleven = resolveCurriculumFraming('844', 11)
  assert.notEqual(cbcEleven.label, f844Eleven.label)
  assert.equal(cbcEleven.cbcPathwayAdmissible, true)
  assert.equal(f844Eleven.cbcPathwayAdmissible, false)
})

test('null curriculum_type falls back to a neutral label, never silently CBC or 8-4-4', () => {
  const framing = resolveCurriculumFraming(null, 11)
  assert.equal(framing.cbcPathwayAdmissible, false)
  assert.ok(!framing.label.includes('CBC'), 'must not guess CBC')
  assert.ok(!framing.label.includes('8-4-4'), 'must not guess 8-4-4')
})

test('an unrecognised curriculum_type (e.g. igcse) falls back to the same neutral label, never CBC', () => {
  const framing = resolveCurriculumFraming('igcse', 11)
  assert.equal(framing.cbcPathwayAdmissible, false)
  assert.ok(!framing.label.includes('CBC'))
})

test('curriculum_type comparison is case/whitespace-insensitive', () => {
  assert.equal(resolveCurriculumFraming(' CBC ', 8).cbcPathwayAdmissible, true)
  assert.equal(resolveCurriculumFraming('844', 12).label, resolveCurriculumFraming(' 844 ', 12).label)
})
