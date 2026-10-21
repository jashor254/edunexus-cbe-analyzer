// lib/curriculum/kicdVocabulary.test.ts
//
// Run: npm test -- lib/curriculum/kicdVocabulary.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KICD_CORE_COMPETENCIES, KICD_NATIONAL_VALUES, kiswahiliSkillOf, rotate } from './kicdVocabulary'

test('the official lists have the BECF sizes: 7 core competencies, 8 national values, both languages aligned', () => {
  assert.equal(KICD_CORE_COMPETENCIES.en.length, 7)
  assert.equal(KICD_CORE_COMPETENCIES.sw.length, 7)
  assert.equal(KICD_NATIONAL_VALUES.en.length, 8)
  assert.equal(KICD_NATIONAL_VALUES.sw.length, 8)
})

test('kiswahiliSkillOf reads the skill from real sub-strand row prefixes', () => {
  assert.equal(kiswahiliSkillOf('Kusikiliza na Kuzungumza - Mazungumzo Mawaidha'), 'kusikiliza')
  assert.equal(kiswahiliSkillOf('Kusoma - Kusoma kwa Ufasaha'), 'kusoma')
  assert.equal(kiswahiliSkillOf('Kuandika - Hotuba ya kushawishi'), 'kuandika')
  assert.equal(kiswahiliSkillOf('Sarufi - Aina za sentensi'), 'sarufi')
  assert.equal(kiswahiliSkillOf('Matumizi ya Lugha - Ngeli za Nomino – Ngeli ya A-WA'), 'sarufi')
  assert.equal(kiswahiliSkillOf('Fasihi Simulizi - Semi'), null)
})

test('rotate wraps around and never returns more than the list holds', () => {
  assert.deepEqual(rotate(['a', 'b', 'c'], 2, 2), ['c', 'a'])
  assert.deepEqual(rotate(['a', 'b'], 0, 5), ['a', 'b'])
  assert.deepEqual(rotate([], 3, 2), [])
})
