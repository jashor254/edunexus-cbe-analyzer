// lib/sow/aiGenerationRemediation.test.ts
//
// SOW and lesson-plan generation after the AI-call remediation
// (docs/audits/ai-call-efficiency-deep-audit.md F-12, F-14):
//
//   - A provider failure ends that lesson's attempts. callDeepSeek has already
//     retried and fallen back by the time it throws, so looping again only
//     repeated the whole chain (SOW: up to 5 × 3 requests per lesson).
//     Validation failures still get their retries.
//   - A KICD-grounded lesson no longer asks the model to echo official
//     outcomes / inquiry questions / competencies / values / PCIs; the server
//     sets every one of them from the official slice, so a model paraphrase
//     can never replace official curriculum text.
//
// The AI call is mocked; no network.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/sow/aiGenerationRemediation.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { KicdLessonSlice } from '@/lib/curriculum/kicdEntries'

let prompts: string[] = []
let behaviour: 'provider-down' | 'reply' = 'reply'
let reply = ''

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async (prompt: string) => {
      prompts.push(prompt)
      if (behaviour === 'provider-down') throw new Error('All providers failed: DeepSeek timeout after 25s')
      return reply
    },
  },
})

let generateValidatedLesson: typeof import('./aiLessonGenerator').generateValidatedLesson
let kicdOfficialFields: typeof import('./aiLessonGenerator').kicdOfficialFields
let generateLessonPlan: typeof import('@/lib/lessonPlan/generator').generateLessonPlan

before(async () => {
  ;({ generateValidatedLesson, kicdOfficialFields } = await import('./aiLessonGenerator'))
  ;({ generateLessonPlan } = await import('@/lib/lessonPlan/generator'))
})
beforeEach(() => { prompts = []; behaviour = 'reply'; reply = '' })

const SLICE: KicdLessonSlice = {
  entryTitle: '1.2 Fractions',
  part: 1,
  parts: 1,
  learningOutcomes: ['add fractions with unlike denominators', 'use fractions in real-life situations'],
  learningExperiences: ['Learners use fraction strips to add halves and quarters'],
  keyInquiryQuestions: ['How do we use fractions in daily life?'],
  coreCompetencies: ['Critical thinking and problem solving'],
  values: ['Responsibility'],
  pcis: ['Financial literacy'],
}

const BASE = {
  learningArea: 'Mathematics', grade: 'Grade 7', strand: 'Numbers', substrand: 'Fractions',
  lessonNumber: 1, totalLessons: 1, curriculumMode: 'cbc_junior' as const,
  subjectType: 'mathematics', textbook: 'Class textbook',
}

// A model that "helpfully" rewrites every official field.
const PARAPHRASING_REPLY = JSON.stringify({
  learning_outcomes: ['rewritten outcome', 'another rewrite'],
  learning_experiences: [
    'Learners add fractions with unlike denominators using fraction strips in pairs.',
    'Learners solve fraction word problems from market price lists in groups.',
    'Learners explain to a partner how they added two fractions.',
  ],
  key_inquiry_questions: ['A paraphrased question?'],
  assessment_methods: ['Oral questions', 'Written exercise', 'Exit ticket'],
  learning_resources: ['Class textbook', "Teacher's Guide for Mathematics 7", 'Fraction strips'],
  core_competencies: 'Paraphrased competency',
  values: 'Paraphrased value',
  pci_links: 'Paraphrased PCI',
})

test('SOW: a provider failure ends the lesson after ONE wrapper call (it used to loop 5×)', async () => {
  behaviour = 'provider-down'
  const r = await generateValidatedLesson({ ...BASE, kicdSlice: SLICE })
  assert.equal(r._validated, false)
  assert.equal(prompts.length, 1)
  assert.match(r.details ?? '', /AI request failed/)
})

test('SOW: an invalid (unparseable) reply still gets its validation retries', async () => {
  reply = 'not json at all'
  await generateValidatedLesson({ ...BASE, kicdSlice: SLICE })
  assert.ok(prompts.length > 1, 'validation failures are still retried')
})

test('lesson plan: a provider failure ends after ONE wrapper call (it used to loop 3×)', async () => {
  behaviour = 'provider-down'
  await assert.rejects(() => generateLessonPlan({
    teacherName: '', tscNumber: '', school: 'S', learningArea: 'Mathematics', grade: 'Grade 7',
    term: 2, year: 2026, weekNumber: 1, lessonNumber: 1, strand: 'Numbers', subStrand: 'Fractions',
    learningOutcomes: ['o'], learningExperiences: [], keyInquiryQuestions: [], learningResources: [], assessmentMethods: [],
  }), /Lesson plan generation failed/)
  assert.equal(prompts.length, 1)
})

test('KICD-grounded prompt: official fields are context, not part of the JSON the model must return', async () => {
  reply = PARAPHRASING_REPLY
  await generateValidatedLesson({ ...BASE, kicdSlice: SLICE })
  const prompt = prompts[0]
  assert.ok(prompt.includes(SLICE.learningOutcomes[0]), 'official outcomes still inform the design')
  const template = prompt.slice(prompt.indexOf('OUTPUT'))
  for (const key of ['"learning_outcomes"', '"key_inquiry_questions"', '"core_competencies"', '"values"', '"pci_links"']) {
    assert.ok(!template.includes(key), `${key} is server-set from KICD — not requested from the model`)
  }
  assert.ok(template.includes('"learning_experiences"'), 'model-designed fields are still requested')
})

test('KICD-grounded result: every official field is the KICD text, whatever the model returned', async () => {
  reply = PARAPHRASING_REPLY
  const r = await generateValidatedLesson({ ...BASE, kicdSlice: SLICE })
  assert.equal(r._validated, true, r.details)
  assert.deepEqual(r.learning_outcomes, SLICE.learningOutcomes)
  assert.deepEqual(r.key_inquiry_questions, SLICE.keyInquiryQuestions)
  assert.equal(r.core_competencies, 'Critical thinking and problem solving')
  assert.equal(r.values, 'Responsibility')
  assert.equal(r.pci_links, 'Financial literacy')
  assert.ok(!JSON.stringify(r).includes('Paraphrased'), 'no model paraphrase of official text survives')
})

test('ungrounded lesson: the model still writes outcomes (nothing official to substitute)', async () => {
  reply = PARAPHRASING_REPLY
  await generateValidatedLesson({ ...BASE })
  assert.ok(prompts[0].slice(prompts[0].indexOf('OUTPUT')).includes('"learning_outcomes"'))
})

test('kicdOfficialFields: an empty official list leaves that field model-written', () => {
  const f = kicdOfficialFields({ ...SLICE, keyInquiryQuestions: [], values: [], pcis: [], coreCompetencies: [] })
  assert.deepEqual(Object.keys(f), ['learning_outcomes'])
  assert.deepEqual(kicdOfficialFields(undefined), {})
})
