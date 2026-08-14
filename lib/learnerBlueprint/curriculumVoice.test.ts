// lib/learnerBlueprint/curriculumVoice.test.ts
//
// Run: npm test -- lib/learnerBlueprint/curriculumVoice.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveCurriculumVoice,
  systemFromClassName,
  formNumberFromClassName,
  transitionNote,
} from './curriculumVoice'
import {
  formsRemainingIn,
  eightFourFourStillRunning,
  isExpectedForm,
  yearsLeftUnder844,
} from '@/lib/config/curriculumPhaseOut'

// ── Which system a class belongs to ──────────────────────────────────────────

test('Grade classes are CBE, Form classes are 8-4-4', () => {
  for (const cbe of ['Grade 7', 'Grade 9Y', 'Grade 10', 'Grade 12 Blue']) {
    assert.equal(systemFromClassName(cbe), 'cbe', cbe)
  }
  for (const eff of ['Form 3', 'Form 4 East', 'form 3', 'FORM 4']) {
    assert.equal(systemFromClassName(eff), '844', eff)
  }
})

test('an unreadable class name falls back to CBE, the system the country is moving to', () => {
  for (const unknown of [null, '', 'Blue Class', 'Stream A']) {
    assert.equal(systemFromClassName(unknown), 'cbe', String(unknown))
  }
})

test('the form number is recovered, and only for real forms', () => {
  assert.equal(formNumberFromClassName('Form 3'), 3)
  assert.equal(formNumberFromClassName('Form 4 East'), 4)
  assert.equal(formNumberFromClassName('Grade 10'), null)
  assert.equal(formNumberFromClassName('Form 7'), null)
  assert.equal(formNumberFromClassName(null), null)
})

// ── The actual defect: CBC words shown to an 8-4-4 learner ───────────────────

test('a CBE learner sees KICD rubric wording', () => {
  const voice = resolveCurriculumVoice('Grade 10', 2026)
  assert.equal(voice.system, 'cbe')
  assert.equal(voice.levelLabel[4], 'Exceeding Expectations')
  assert.equal(voice.levelLabel[1], 'Below Expectations')
  // Nothing extra to explain — these are the words used in their classroom.
  assert.equal(voice.scaleNote, null)
})

test('an 8-4-4 learner never sees CBC rubric wording', () => {
  const voice = resolveCurriculumVoice('Form 3', 2026)
  assert.equal(voice.system, '844')
  for (const level of [1, 2, 3, 4] as const) {
    assert.doesNotMatch(
      voice.levelLabel[level], /Expectations/,
      `level ${level} leaked CBC rubric language to an 8-4-4 learner`,
    )
  }
  assert.equal(voice.levelLabel[4], 'Excellent')
  assert.equal(voice.levelLabel[1], 'Below Average')
})

// We can report a mark. We cannot report a KCSE grade without the school's own
// scale, and `teacher_grade_scales` is effectively empty — so the document must
// say what these bands are NOT.
test('an 8-4-4 learner is told these bands are not a KCSE grade', () => {
  const voice = resolveCurriculumVoice('Form 4', 2026)
  assert.ok(voice.scaleNote)
  assert.match(voice.scaleNote, /not a KCSE grade/i)
})

// ── The phase-out timetable ──────────────────────────────────────────────────

test('2026 holds Form 3 and Form 4; 2027 holds only the final Form 4', () => {
  assert.deepEqual(formsRemainingIn(2026), [3, 4])
  assert.deepEqual(formsRemainingIn(2027), [4])
})

test('8-4-4 has ended by 2028 and stays ended', () => {
  assert.equal(eightFourFourStillRunning(2026), true)
  assert.equal(eightFourFourStillRunning(2027), true)
  assert.equal(eightFourFourStillRunning(2028), false)
  assert.equal(eightFourFourStillRunning(2035), false)
})

test('Form 1 and Form 2 are not supported states — there is no such intake', () => {
  assert.equal(isExpectedForm(1, 2026), false)
  assert.equal(isExpectedForm(2, 2026), false)
  assert.equal(isExpectedForm(3, 2026), true)
  assert.equal(isExpectedForm(4, 2026), true)
})

test('a Form 1 on the roster is flagged as a data problem, but still spoken to in 8-4-4', () => {
  const voice = resolveCurriculumVoice('Form 1', 2026)
  assert.equal(voice.rosterLooksWrong, true)
  // We do not override the school about its own learner — we mark the record.
  assert.equal(voice.system, '844')
  assert.equal(voice.levelLabel[3], 'Good')
})

test('a Form class after the phase-out is flagged too', () => {
  assert.equal(resolveCurriculumVoice('Form 4', 2030).rosterLooksWrong, true)
  assert.equal(resolveCurriculumVoice('Form 4', 2026).rosterLooksWrong, false)
})

test('years remaining counts down to the final KCSE and then stops', () => {
  assert.equal(yearsLeftUnder844(2026), 1)
  assert.equal(yearsLeftUnder844(2027), 0)
  assert.equal(yearsLeftUnder844(2028), null)
})

// ── Transition wording ───────────────────────────────────────────────────────

test('a Form 4 in the final year is told plainly, without alarm', () => {
  const note = transitionNote(resolveCurriculumVoice('Form 4', 2027))
  assert.ok(note)
  assert.match(note, /final 2027 examination/)
  assert.doesNotMatch(note, /behind|disadvantage|outdated|obsolete|lesser/i)
})

test('a Form 3 is told how long is left, in calm language', () => {
  const note = transitionNote(resolveCurriculumVoice('Form 3', 2026))
  assert.ok(note)
  assert.match(note, /1 year from now/)
  assert.doesNotMatch(note, /behind|disadvantage|outdated|obsolete|lesser/i)
})

test('a CBE learner gets no transition note at all', () => {
  assert.equal(transitionNote(resolveCurriculumVoice('Grade 10', 2026)), null)
})

// A snapshot taken in 2026 must keep reading correctly in 2029, when 8-4-4 no
// longer exists — which is why the year is injectable rather than read from the
// clock inside the resolver.
test('a stored report re-reads against the year it was written', () => {
  const asWritten = resolveCurriculumVoice('Form 4', 2026)
  assert.equal(asWritten.rosterLooksWrong, false)
  assert.equal(asWritten.levelLabel[4], 'Excellent')
})
