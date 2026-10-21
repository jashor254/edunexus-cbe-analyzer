// lib/sow/aiLessonGenerator.grounded.test.ts
//
// A lesson grounded in a KICD sub-strand carries the design's outcomes and
// inquiry question VERBATIM — the model designs around them and cannot
// reword them — and the prompt no longer dictates the old
// "[verb] sifa za X katika muktadha wa Kenya" outcome template. The AI
// call is mocked; no network.
//
// Run: npm test -- lib/sow/aiLessonGenerator.grounded.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { KicdLessonSlice } from '@/lib/curriculum/kicdEntries'

let prompts: string[] = []
let reply = ''

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async (prompt: string) => {
      prompts.push(prompt)
      return reply
    },
  },
})

let generateValidatedLesson: typeof import('./aiLessonGenerator').generateValidatedLesson
let validateLesson: typeof import('./validators').validateLesson

before(async () => {
  ;({ generateValidatedLesson } = await import('./aiLessonGenerator'))
  ;({ validateLesson } = await import('./validators'))
})

beforeEach(() => { prompts = [] })

const SARUFI_SLICE: KicdLessonSlice = {
  entryTitle: '11.4.1 Mnyambuliko wa Vitenzi',
  part: 1,
  parts: 2,
  learningOutcomes: [
    'kutambua viambishi vya kauli ya kutendana, kutendeana na kutendesha katika vitenzi',
    'kutumia vitenzi katika kauli ya kutendana, kutendeana na kutendesha ipasavyo katika matini',
  ],
  learningExperiences: ['kutenga vitenzi katika kauli ya kutendana, kutendeana na kutendesha kwenye chati au kadi maneno'],
  keyInquiryQuestions: ['Kwa nini ni muhimu kujifunza kauli za vitenzi?'],
  coreCompetencies: [],
  values: [],
  pcis: [],
}

// What a model typically sends back: the outcomes "improved" into the old
// template and generic questions — both must be discarded.
const MODEL_REPLY = JSON.stringify({
  learning_outcomes: ['nunua sifa za mnyambuliko wa vitenzi katika muktadha wa Kenya', 'eleza x', 'thamini x'],
  learning_experiences: [
    'Wanafunzi watenge vitenzi vya kauli ya kutendana na kutendesha kwenye kadi maneno.',
    'Wanafunzi wajadili kwa jozi viambishi vya kauli ya kutendeana.',
    'Kila mwanafunzi atunge sentensi tatu akitumia kauli ya kutendesha.',
  ],
  key_inquiry_questions: ['Ni nini kingetokea iwapo vitenzi vingeongezwa mara mbili?'],
  assessment_methods: ['Kujaza mapengo kwa vitenzi katika kauli lengwa'],
  learning_resources: ['Kitabu cha Mwanafunzi', 'Kadi maneno'],
  core_competencies: 'Mawasiliano na ushirikiano',
  values: 'Heshima',
  pci_links: 'Haki za binadamu',
})

const BASE = {
  learningArea: 'Kiswahili',
  grade: 'Grade 9',
  strand: 'HAKI ZA KIBINADAMU',
  substrand: 'Sarufi - Mnyambuliko wa vitenzi',
  lessonNumber: 1,
  totalLessons: 1,
  curriculumMode: 'cbc_junior' as const,
  subjectType: 'kiswahili',
  textbook: 'Kitabu cha Mwanafunzi (synthetic)',
}

test('grounded lesson: outcomes and KIQ are the KICD text verbatim, whatever the model returns', async () => {
  reply = MODEL_REPLY
  const result = await generateValidatedLesson({ ...BASE, kicdSlice: SARUFI_SLICE })
  assert.equal(result._validated, true, result.details)
  assert.deepEqual(result.learning_outcomes, SARUFI_SLICE.learningOutcomes)
  assert.deepEqual(result.key_inquiry_questions, SARUFI_SLICE.keyInquiryQuestions)
  assert.ok(!JSON.stringify(result).includes('nunua'), 'the model\'s reworded outcome is discarded')
  assert.equal(prompts.length, 1, 'official wording passes validation first time — no retries')
})

test('grounded prompt carries the right sub-strand and no longer dictates the old outcome template', async () => {
  reply = MODEL_REPLY
  await generateValidatedLesson({ ...BASE, kicdSlice: SARUFI_SLICE })
  const prompt = prompts[0]
  assert.ok(prompt.includes('11.4.1 Mnyambuliko wa Vitenzi'))
  assert.ok(prompt.includes('kipindi 1 kati ya 2'))
  assert.ok(prompt.includes('Kufikia mwisho wa kipindi, mwanafunzi aweze:'))
  assert.ok(prompt.includes(SARUFI_SLICE.learningOutcomes[0]))
  assert.ok(prompt.includes(SARUFI_SLICE.learningExperiences[0]))
  assert.ok(!prompt.includes('sifa za Sarufi - Mnyambuliko wa vitenzi katika muktadha wa Kenya'),
    'regression: the "[verb] sifa za X katika muktadha wa Kenya" template is gone for grounded lessons')
})

test('ungrounded lesson keeps the old verb-progression validation (no silent loosening)', async () => {
  // Infinitive outcomes + a starter-less question: valid only when they are
  // official KICD text, so an UNgrounded lesson must still be rejected.
  reply = JSON.stringify({
    ...JSON.parse(MODEL_REPLY),
    learning_outcomes: [...SARUFI_SLICE.learningOutcomes, 'kuchangamkia kutumia vitenzi'],
    key_inquiry_questions: ['Mawaidha hushirikisha kina nani?'],
  })
  const result = await generateValidatedLesson({ ...BASE })
  assert.equal(result._validated, false)
  assert.ok(prompts.length > 1, 'the invalid ungrounded reply was retried')
})

test('validateLesson: KICD infinitive outcomes and official KIQs pass only when flagged as KICD', () => {
  const lesson = {
    learning_outcomes: SARUFI_SLICE.learningOutcomes,
    learning_experiences: ['Wanafunzi watenge vitenzi kwenye kadi maneno.'],
    key_inquiry_questions: ['Mawaidha hushirikisha kina nani?'],
    assessment_methods: ['Kujaza mapengo'],
    learning_resources: ['Kadi maneno'],
  }
  const flagged = validateLesson(lesson, 'Sarufi - Mnyambuliko wa vitenzi', 'kiswahili', { outcomesFromKicd: true, inquiryFromKicd: true })
  assert.equal(flagged.isValid, true, flagged.issues.join('; '))
  const unflagged = validateLesson(lesson, 'Sarufi - Mnyambuliko wa vitenzi', 'kiswahili')
  assert.equal(unflagged.isValid, false)
})
