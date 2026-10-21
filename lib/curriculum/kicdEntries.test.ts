// lib/curriculum/kicdEntries.test.ts
//
// Pure tests for the KICD entry matcher and lesson slicer. Fixtures are
// trimmed copies of the real Grade 9 Kiswahili `sow_strands.kicd_data`
// (theme 11 HAKI ZA KIBINADAMU) and real `sow_substrands` row titles —
// the exact data the SOW generator mis-grounded by always using entry [0].
//
// Run: npm test -- lib/curriculum/kicdEntries.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseKicdEntries,
  matchKicdEntry,
  assignLessonParts,
  sliceKicdForLesson,
  cleanKicdItem,
} from './kicdEntries'

const HAKI_RAW = [
  {
    title: '11.1.1 Uzungumzaji katika Sherehe',
    suggested_lessons: 2,
    learning_outcomes: [
      'kueleza maana ya uzungumzaji katika sherehe',
      'kutambua miktadha katika jamii ambamo uzungumzaji katika miktadha ya sherehe hufanywa',
      'kujadili ujumbe tofautitofauti unaoafiki uzungumzaji katika miktadha mbalimbali ya sherehe',
      'kujadili vipengele vya kuzingatia katika kuzungumza katika muktadha wa sherehe',
      'kutoa mazungumzo katika muktadha wa sherehe kwa kutumia vipengele vifaavyo',
      'kuchangamkia mazungumzo yafaayo katika miktadha ya sherehe',
    ],
    learning_experiences: ['a', 'b', 'c', 'd', 'e', 'f'],
    key_inquiry_questions: ['Ni mambo gani ya kuzingatia wakati wa kuzungumza katika muktadha wa sherehe?'],
  },
  {
    title: '11.2.1 Kusoma kwa Mapana; Matini ya kujichagulia',
    suggested_lessons: 2,
    learning_outcomes: ['kuteua matini ya kusoma ya kiwango chake', 'kueleza ujumbe katika matini ya kujichagulia', 'kufurahia kusoma matini ya kujichagulia ili kujenga ufasaha wa lugha'],
    learning_experiences: ['kuchagua matini ya kiwango chake na kuisoma'],
    key_inquiry_questions: ['Unazingatia nini unapochagua matini ya kusoma?'],
  },
  {
    title: '11.3.1 Insha za Kubuni: Maelezo',
    suggested_lessons: 2,
    learning_outcomes: ['kujadili mitazamo katika insha za maelezo', 'kuandika insha ya maelezo akizingatia mtazamo mahususi'],
    learning_experiences: [],
    key_inquiry_questions: ['Je, ni mambo gani ya kuzingatia katika kuandika insha ya maelezo?'],
  },
  {
    title: '11.4.1 Mnyambuliko wa Vitenzi',
    suggested_lessons: 2,
    learning_outcomes: [
      'kutambua viambishi vya kauli ya kutendana, kutendeana na kutendesha katika vitenzi',
      'kutumia vitenzi katika kauli ya kutendana, kutendeana na kutendesha ipasavyo katika matini',
      'kuchangamkia kutumia vitenzi katika kauli ya kutendana, kutendeana na kutendesha ipasavyo',
    ],
    learning_experiences: [],
    key_inquiry_questions: ['Kwa nini ni muhimu kujifunza kauli za vitenzi'],
  },
]

const HAKI = parseKicdEntries(HAKI_RAW)

test('parseKicdEntries normalises raw jsonb and drops entries that cannot ground a lesson', () => {
  const entries = parseKicdEntries([
    ...HAKI_RAW,
    { title: 'No outcomes', learning_outcomes: [] },
    { learning_outcomes: ['x'] },
    'not an object',
    null,
  ])
  assert.equal(entries.length, 4)
  assert.equal(entries[3].keyInquiryQuestions[0], 'Kwa nini ni muhimu kujifunza kauli za vitenzi?', 'KIQ gets its question mark')
  assert.deepEqual(entries[0].coreCompetencies, [], 'absent attributes are empty, not invented')
  assert.deepEqual(parseKicdEntries({ not: 'an array' }), [])
  assert.deepEqual(parseKicdEntries(null), [])
})

test('cleanKicdItem strips design list labels but keeps the wording verbatim', () => {
  assert.equal(cleanKicdItem('a) explain the application of Biology in everyday life'), 'explain the application of Biology in everyday life')
  assert.equal(cleanKicdItem('  kueleza maana ya mawaidha, '), 'kueleza maana ya mawaidha')
  assert.equal(cleanKicdItem('• kutambua sentensi tata.'), 'kutambua sentensi tata')
})

test('regression: a grammar row is grounded in the GRAMMAR entry, not the strand\'s first entry', () => {
  const i = matchKicdEntry('Sarufi - Mnyambuliko wa vitenzi', HAKI)
  assert.equal(i, 3)
  assert.notEqual(i, 0, 'the old generator always used kicd_data[0] (Uzungumzaji katika Sherehe)')
})

test('matchKicdEntry maps every real theme-11 row title to its own entry', () => {
  assert.equal(matchKicdEntry('Kusikiliza na Kuzungumza - Uzungumzaji katika sherehe', HAKI), 0)
  assert.equal(matchKicdEntry('Kusoma - Kusoma kwa Mapana', HAKI), 1)
  assert.equal(matchKicdEntry('Kuandika - Insha za Kubuni: Maelezo', HAKI), 2)
  assert.equal(matchKicdEntry('Sarufi - Mnyambuliko wa vitenzi', HAKI), 3)
})

test('matchKicdEntry: a split sub-strand row ("Vihusishi vya wakati") finds the combined entry', () => {
  const entries = parseKicdEntries([
    { title: '1.1.1 Kusikiliza na Kujibu; Mjadala', learning_outcomes: ['x'] },
    { title: '1.2.1 Kusoma kwa Ufahamu; Kifungu cha Simulizi', learning_outcomes: ['x'] },
    { title: '1.3.1 Viakifishi; Koloni na Semi koloni', learning_outcomes: ['x'] },
    { title: '1.4.1 Vihusishi; Vihusishi vya Mahali na Vihusishi vya Wakati', learning_outcomes: ['x'] },
  ])
  assert.equal(matchKicdEntry('Sarufi - Vihusishi vya wakati', entries), 3)
  assert.equal(matchKicdEntry('Kuandika - Viakifishi: semi koloni', entries), 2)
})

test('matchKicdEntry falls back to the skill position only when it is unambiguous', () => {
  // Row title shares no content words with the entry, but it is the only
  // listening entry in the strand.
  assert.equal(matchKicdEntry('Kusikiliza na Kuzungumza - Mazungumzo ya kila siku', HAKI), 0)
})

test('matchKicdEntry returns null rather than an arbitrary entry when nothing credible matches', () => {
  assert.equal(matchKicdEntry('Photosynthesis - Light reactions', HAKI), null)
  assert.equal(matchKicdEntry('Sarufi - Mnyambuliko wa vitenzi', []), null)
  // 8-4-4 syllabus-level entries (x.y.0) have no sub-strand to slice.
  const syllabus = parseKicdEntries([
    { title: '1.1.0 Kusikiliza na Kuzungumza', learning_outcomes: ['a', 'b'] },
    { title: '2.1.0 Sarufi na Matumizi ya Lugha', learning_outcomes: ['a'] },
  ])
  assert.equal(matchKicdEntry('Sarufi - Viulizi - "pi" na "ngapi"', syllabus), null)
})

test('matchKicdEntry: senior Fasihi genre filters candidates, so a shared generic word cannot cross genres', () => {
  const mada6 = parseKicdEntries([
    { title: '6.1.1 Maigizo', learning_outcomes: ['x'] },
    { title: '6.2.1 Uchambuzi wa Muundo', learning_outcomes: ['x'] },
    { title: '6.3.1 Riwaya: Maudhui na Dhamira', learning_outcomes: ['x'] },
  ])
  assert.equal(matchKicdEntry('Ushairi - Uchambuzi wa Mashairi - Muundo', mada6), 1)
  assert.equal(matchKicdEntry('Bunilizi na Kazi za Kihalisia - Uchambuzi wa Tawasifu - Wahusika', mada6), null,
    'shares only "uchambuzi" with 6.2.1, and genre-only fallback is not allowed')
})

test('assignLessonParts numbers lessons within their entry, in teaching order', () => {
  const parts = assignLessonParts(['s#0', 's#1', 's#2', 's#3', 's#0', null, 's#1'])
  assert.deepEqual(parts, [
    { part: 1, parts: 2 },
    { part: 1, parts: 2 },
    { part: 1, parts: 1 },
    { part: 1, parts: 1 },
    { part: 2, parts: 2 },
    { part: 1, parts: 1 },
    { part: 2, parts: 2 },
  ])
})

test('sliceKicdForLesson splits outcomes across lessons and keeps the affective outcome for the last', () => {
  const l1 = sliceKicdForLesson(HAKI[0], 1, 2)
  const l2 = sliceKicdForLesson(HAKI[0], 2, 2)
  assert.deepEqual(l1.learningOutcomes, HAKI[0].learningOutcomes.slice(0, 3))
  assert.deepEqual(l2.learningOutcomes, [...HAKI[0].learningOutcomes.slice(3, 5), HAKI[0].learningOutcomes[5]])
  assert.ok(!l1.learningOutcomes.some(o => o.startsWith('kuchangamkia')))
  assert.deepEqual(l1.learningExperiences, ['a', 'b', 'c'])
  assert.deepEqual(l2.learningExperiences, ['d', 'e', 'f'])
  assert.deepEqual(l1.keyInquiryQuestions, l2.keyInquiryQuestions, 'the KIQ belongs to the whole sub-strand')
  assert.equal(l2.part, 2)
  assert.equal(l2.parts, 2)
})

test('sliceKicdForLesson edge cases: one lesson, more lessons than outcomes, out-of-range part', () => {
  assert.deepEqual(sliceKicdForLesson(HAKI[1], 1, 1).learningOutcomes, HAKI[1].learningOutcomes)

  const short = HAKI[2] // 2 cognitive outcomes, no affective one
  const slices = [1, 2, 3].map(p => sliceKicdForLesson(short, p, 3).learningOutcomes)
  for (const s of slices) assert.ok(s.length >= 1, 'every lesson keeps at least one outcome')
  assert.deepEqual(slices[2], [short.learningOutcomes[1]])

  const clamped = sliceKicdForLesson(HAKI[0], 9, 2)
  assert.equal(clamped.part, 2)
  assert.ok(clamped.learningOutcomes.length > 0)
})
