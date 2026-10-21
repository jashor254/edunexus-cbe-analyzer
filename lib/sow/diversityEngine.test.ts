// lib/sow/diversityEngine.test.ts
//
// The rotation pools the SOW generator still uses for lessons without a
// matched KICD sub-strand only ever draw from valid, official vocabulary:
// measurable Kiswahili verbs that resolve in cognitive order, the 7 KICD core
// competencies, the 8 national values, and KICD's assessment methods for the
// lesson's language skill. Pure.
//
// Run: npm test -- lib/sow/diversityEngine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DiversityEngine } from './diversityEngine'
import { getMergedVerbOrder, getVerbLevel } from './verbHierarchy'
import {
  KICD_CORE_COMPETENCIES,
  KICD_NATIONAL_VALUES,
  KISWAHILI_SKILL_GUIDE,
} from '@/lib/curriculum/kicdVocabulary'

const BANNED_VERBS = ['nunua', 'iga', 'linda', 'jaza', 'fahamia', 'ukuzishe', 'uendeleze', 'uchanganye', 'changanya', 'wasiliana']
const BANNED_LABELS = ['Numeracy', 'Umahiri wa kihesabu', 'Self-management', 'Kujisimamia', 'Ubora', 'Uboreshaji endelevu', 'Usimamizi']

function seeds(n: number, isCBC: boolean, isKiswahili: boolean, substrand = '') {
  const engine = new DiversityEngine()
  return Array.from({ length: n }, () => engine.next(isCBC, isKiswahili, substrand))
}

test('every Kiswahili verb trio resolves L1 < L2 < L3 in junior, senior and KCSE pools', () => {
  for (const subjectType of ['kiswahili', 'cbc_senior_kiswahili', 'kcse_kiswahili']) {
    const order = getMergedVerbOrder(subjectType)
    for (const seed of seeds(20, true, true)) {
      const { l1, l2, l3 } = seed.outcomePattern
      assert.deepEqual(
        [getVerbLevel(`${l1} x`, order), getVerbLevel(`${l2} x`, order), getVerbLevel(`${l3} x`, order)],
        [0, 1, 2],
        `${subjectType}: ${l1}/${l2}/${l3}`,
      )
    }
  }
})

test('regression: banned Kiswahili verbs are gone from every validator pool and every seed', () => {
  for (const subjectType of ['kiswahili', 'cbc_senior_kiswahili', 'kcse_kiswahili']) {
    const pool = getMergedVerbOrder(subjectType).flat()
    for (const v of BANNED_VERBS) assert.ok(!pool.includes(v), `${subjectType} still accepts "${v}"`)
  }
  for (const seed of seeds(20, true, true)) {
    const verbs = Object.values(seed.outcomePattern)
    for (const v of BANNED_VERBS) assert.ok(!verbs.includes(v), `seed uses "${v}"`)
  }
})

test('values and core competencies come only from the official KICD lists, in both languages', () => {
  for (const [isKiswahili, lang] of [[true, 'sw'], [false, 'en']] as const) {
    for (const seed of seeds(30, true, isKiswahili)) {
      for (const v of seed.values.split(', ')) {
        assert.ok((KICD_NATIONAL_VALUES[lang] as readonly string[]).includes(v), `value "${v}"`)
      }
      for (const c of seed.coreCompetencies.split(', ')) {
        assert.ok((KICD_CORE_COMPETENCIES[lang] as readonly string[]).includes(c), `competency "${c}"`)
      }
      for (const bad of BANNED_LABELS) {
        assert.ok(!`${seed.values} ${seed.coreCompetencies}`.includes(bad), `non-KICD label "${bad}"`)
      }
    }
  }
})

test('a Kiswahili lesson with a known skill is assessed with KICD\'s methods for that skill', () => {
  const sarufi = seeds(10, true, true, 'Sarufi - Mnyambuliko wa vitenzi')
  for (const seed of sarufi) {
    for (const m of seed.assessmentMethods) assert.ok(KISWAHILI_SKILL_GUIDE.sarufi.assessment.includes(m), m)
  }
  const kusoma = seeds(10, true, true, 'Kusoma - Kusoma kwa Ufasaha').flatMap(s => s.assessmentMethods)
  assert.ok(kusoma.includes('Kusoma kwa sauti'), 'reading lessons get "Kusoma kwa sauti" in rotation')
})

test('Kiswahili question frames contain none of the old absurd or ungrammatical templates', () => {
  const starters = seeds(20, true, true).flatMap(s => s.questionFrame.starters).join(' | ')
  for (const bad of ['mara mbili', 'kingeondolewa', 'hakingekuwepo', 'kinachosababisha']) {
    assert.ok(!starters.includes(bad), `still contains "${bad}"`)
  }
})

test('8-4-4 lessons keep non-CBC competencies (no CBC core competencies forced on them)', () => {
  for (const seed of seeds(5, false, false)) assert.equal(seed.coreCompetencies, 'Problem solving, Critical thinking')
})
