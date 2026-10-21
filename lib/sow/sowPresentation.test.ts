// lib/sow/sowPresentation.test.ts
//
// The printed scheme of work follows the KICD form: outcomes under the
// "Kufikia mwisho wa kipindi, mwanafunzi aweze:" stem, labelled a) b) c),
// in the infinitive; a page blank for the teacher; a sign-off block.
// Synthetic data only (Mwatate Ridge fixture naming). Pure.
//
// Run: npm test -- lib/sow/sowPresentation.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toKiswahiliInfinitive, formatOutcomes, withPageBlank, letterLabel } from './sowPresentation'
import { generateSOWHtml } from './pdfGenerator'
import type { SOWPreviewData, GeneratedLesson } from './types'

test('toKiswahiliInfinitive: legacy bare verbs print in the design\'s ku- form; KICD text is untouched', () => {
  assert.equal(toKiswahiliInfinitive('andika maana ya uzungumzaji katika sherehe'), 'kuandika maana ya uzungumzaji katika sherehe')
  assert.equal(toKiswahiliInfinitive('Eleza dhana ya ukanushaji'), 'kueleza dhana ya ukanushaji')
  assert.equal(toKiswahiliInfinitive('kutambua sentensi tata katika matini'), 'kutambua sentensi tata katika matini')
  assert.equal(toKiswahiliInfinitive('a) kufurahia kusoma matini'), 'kufurahia kusoma matini')
  assert.equal(toKiswahiliInfinitive('Mwanafunzi aweze: tambua viambishi'), 'kutambua viambishi')
})

test('formatOutcomes strips English preambles and list labels; letterLabel gives a) b) c)', () => {
  assert.deepEqual(
    formatOutcomes(['By the end of the lesson, the learner should be able to identify cells', 'b) draw a cell'], false),
    ['identify cells', 'draw a cell'],
  )
  assert.deepEqual([0, 1, 2].map(letterLabel), ['a)', 'b)', 'c)'])
})

test('withPageBlank leaves a page blank after the textbook, never twice, never invented', () => {
  assert.deepEqual(withPageBlank(['Kitabu cha Mwanafunzi', 'Kadi maneno'], true), ['Kitabu cha Mwanafunzi — uk. ______', 'Kadi maneno'])
  assert.deepEqual(withPageBlank(['Learner\'s Book', 'Chart'], false), ['Learner\'s Book — pp. ______', 'Chart'])
  assert.deepEqual(withPageBlank(['Kitabu cha Mwanafunzi uk. 45-48'], true), ['Kitabu cha Mwanafunzi uk. 45-48'])
  assert.deepEqual(withPageBlank([], true), [])
})

function lesson(overrides: Partial<GeneratedLesson> = {}): GeneratedLesson {
  return {
    week: 1, lesson: 1, strand: 'HAKI ZA KIBINADAMU', substrand: 'Sarufi - Mnyambuliko wa vitenzi', substrandId: 'sub-1',
    learningOutcomes: ['andika maana ya mnyambuliko', 'kutumia vitenzi katika kauli ya kutendana'],
    learningExperiences: ['Wanafunzi watenge vitenzi kwenye kadi maneno.'],
    keyInquiryQuestions: ['Kwa nini ni muhimu kujifunza kauli za vitenzi?'],
    learningResources: ['Kitabu cha Mwanafunzi (synthetic)', 'Kadi maneno'],
    assessmentMethods: ['Kujaza mapengo'],
    coreCompetencies: '', values: '', pciLinks: '', reflection: '', _validated: true, _confidence: 0.9,
    ...overrides,
  }
}

function preview(learningArea: string, lessons: GeneratedLesson[]): SOWPreviewData {
  return {
    meta: {
      school: 'Mwatate Ridge (synthetic)', teacherName: 'Synthetic Teacher', grade: 'Grade 9', learningArea, term: '3', year: 2026,
      textbook: 'Kitabu cha Mwanafunzi (synthetic)', totalLessons: lessons.length, totalWeeks: 1, generatedDate: '21/10/2026',
      curriculumMode: 'cbc_junior', averageConfidence: 0.9,
    },
    lessons,
    breaks: [{ id: 'b1', title: 'Tathmini ya Katikati ya Muhula', startWeek: 2, startLesson: 1, endWeek: 2, endLesson: 4 }],
  }
}

test('Kiswahili scheme prints the KICD outcome stem, lettered infinitives, page blank, Kiswahili labels and sign-off', () => {
  const html = generateSOWHtml(preview('Kiswahili', [lesson()]))
  assert.ok(html.includes('Kufikia mwisho wa kipindi, mwanafunzi aweze:'))
  assert.ok(html.includes('<span class="lbl">a)</span>kuandika maana ya mnyambuliko'), 'legacy bare verb printed as infinitive')
  assert.ok(html.includes('<span class="lbl">b)</span>kutumia vitenzi'))
  assert.ok(html.includes('SHUGHULI ZA UJIFUNZAJI'))
  assert.ok(!html.includes('SHUGHULI ZA UFUNZAJI'), 'regression: column heading typo')
  assert.ok(html.includes('Kitabu cha Mwanafunzi (synthetic) — uk. ______'))
  assert.ok(html.includes('SHUGHULI MAALUM'))
  assert.ok(html.includes('Imekaguliwa na (Mkuu wa Idara)'))
  assert.ok(html.includes('Imeidhinishwa na (Mwalimu Mkuu)'))
  assert.ok(html.includes('@bottom-right') && html.includes('@top-left'),
    'page-margin boxes replace the browser header/footer ("about:blank", timestamp)')
  assert.ok(html.includes('@page sow   { size: A4 landscape; }'), 'the 10-column table prints landscape')
  assert.ok(html.includes('size: A4;'), 'A4 declared — headless/US defaults overflowed the cover onto a blank page')
})

test('page-margin box text cannot break out of the CSS string', () => {
  const html = generateSOWHtml({ ...preview('Kiswahili', [lesson()]), meta: { ...preview('Kiswahili', [lesson()]).meta, school: 'X"; } body { display:none } </style><script>' } })
  assert.ok(!html.includes('</style><script>'))
  assert.ok(!html.includes('X"; }'))
})

test('English scheme prints the English stem, pp. blank, BREAK badge and HOD/Principal sign-off', () => {
  const html = generateSOWHtml(preview('Integrated Science', [lesson({
    strand: 'MIXTURES', substrand: 'Acids and bases',
    learningOutcomes: ['identify acids', 'classify substances'],
    learningResources: ['Learner\'s Book (synthetic)'],
  })]))
  assert.ok(html.includes('By the end of the lesson, the learner should be able to:'))
  assert.ok(html.includes('<span class="lbl">a)</span>identify acids'))
  assert.ok(html.includes('Learner&#39;s Book (synthetic) — pp. ______') || html.includes('Learner\'s Book (synthetic) — pp. ______'))
  assert.ok(html.includes('>BREAK<'))
  assert.ok(html.includes('Checked by (Head of Department)'))
})
