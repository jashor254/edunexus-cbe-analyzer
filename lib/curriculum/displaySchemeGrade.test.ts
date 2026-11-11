// lib/curriculum/displaySchemeGrade.test.ts
//
// Pure tests for the formatter behind the Booklet grade label. The defect it
// fixes: the Booklet printed "Grade Grade 8" (and "Grade Form 3") because it
// prefixed "Grade " to a stored value that already carries its label.
//
// Run: npx tsx --test lib/curriculum/displaySchemeGrade.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displaySchemeGrade, schemeGradeFieldLabel } from './displaySchemeGrade'

test('GRADE-LABEL-001 Junior grades 7-9 keep their stored label, never doubled', () => {
  for (const g of ['Grade 7', 'Grade 8', 'Grade 9']) assert.equal(displaySchemeGrade(g), g)
})

test('GRADE-LABEL-002 Grade 10 stays correct', () => {
  assert.equal(displaySchemeGrade('Grade 10'), 'Grade 10')
})

test('GRADE-LABEL-003 8-4-4 forms stay forms (no "Grade Form 3")', () => {
  assert.equal(displaySchemeGrade('Form 3'), 'Form 3')
  assert.equal(displaySchemeGrade('Form 4'), 'Form 4')
  assert.equal(schemeGradeFieldLabel('Form 3'), 'Form')
  assert.equal(schemeGradeFieldLabel('Grade 8'), 'Grade')
})

test('GRADE-LABEL-004 a bare number is labelled as it always was', () => {
  assert.equal(displaySchemeGrade('8'), 'Grade 8')
  assert.equal(displaySchemeGrade(8), 'Grade 8')
  assert.equal(displaySchemeGrade('10'), 'Grade 10')
})

test('GRADE-LABEL-005 formatting only: Grade 11 is passed through, nothing is enabled or inferred', () => {
  assert.equal(displaySchemeGrade('Grade 11'), 'Grade 11')
  assert.equal(displaySchemeGrade('11'), 'Grade 11', 'a bare number gets the same label it always got — no curriculum inference')
  assert.equal(schemeGradeFieldLabel('Grade 11'), 'Grade')
})

test('GRADE-LABEL-006 labelled variants, case and whitespace', () => {
  assert.equal(displaySchemeGrade('  Grade 8  '), 'Grade 8')
  assert.equal(displaySchemeGrade('grade 8'), 'grade 8', 'never rewrites what the teacher saved')
  assert.equal(displaySchemeGrade('Grade 7 (JSS)'), 'Grade 7 (JSS)')
  assert.equal(displaySchemeGrade('Gredi 8'), 'Gredi 8')
  assert.equal(displaySchemeGrade('Kidato 3'), 'Kidato 3')
  assert.equal(schemeGradeFieldLabel('Kidato 3'), 'Form')
})

test('GRADE-LABEL-007 unknown or empty values are not guessed', () => {
  assert.equal(displaySchemeGrade('Year 5'), 'Year 5')
  assert.equal(displaySchemeGrade(''), '')
  assert.equal(displaySchemeGrade('   '), '')
  assert.equal(displaySchemeGrade(null), '')
  assert.equal(displaySchemeGrade(undefined), '')
})
