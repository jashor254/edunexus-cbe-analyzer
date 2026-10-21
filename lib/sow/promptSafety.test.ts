// lib/sow/promptSafety.test.ts
//
// SOW generation must not stereotype: no seeded place/community examples in
// the prompts, no naming of ethnic communities in language lessons (a
// generated lesson that does is rejected and retried), and KICD's own
// teaching resources are offered instead of being forbidden. AI mocked.
//
// Run: npm test -- lib/sow/promptSafety.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

let calls: Array<{ prompt: string; system: string }> = []
let replies: string[] = []

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async (prompt: string, system: string) => {
      calls.push({ prompt, system })
      return replies.shift() ?? replies[replies.length - 1] ?? '{}'
    },
  },
})

let generateValidatedLesson: typeof import('./aiLessonGenerator').generateValidatedLesson
let findEthnicReferences: typeof import('./validators').findEthnicReferences

before(async () => {
  ;({ generateValidatedLesson } = await import('./aiLessonGenerator'))
  ;({ findEthnicReferences } = await import('./validators'))
})

beforeEach(() => { calls = []; replies = [] })

const lessonReply = (experience: string) => JSON.stringify({
  learning_outcomes: ['tambua viambishi vya kauli ya kutendana', 'tumia vitenzi katika kauli ya kutendana', 'thamini matumizi ya vitenzi'],
  learning_experiences: [experience, 'Wanafunzi wajadili viambishi kwa jozi.', 'Kila mwanafunzi atunge sentensi tatu.'],
  key_inquiry_questions: ['Je, kauli ya kutendana hujitokeza vipi katika sentensi?'],
  assessment_methods: ['Kujaza mapengo'],
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

test('findEthnicReferences flags community names and "jamii ya X", not the nation or neutral place names', () => {
  assert.deepEqual(findEthnicReferences(['Mfano wa harusi za Kikuyu']), ['kikuyu'])
  assert.deepEqual(findEthnicReferences(['mawaidha ya jamii ya Waluhya']), ['waluhya'])
  assert.ok(findEthnicReferences(['uchunguzi kifani wa jamii ya Kisii']).includes('kisii'))
  assert.deepEqual(findEthnicReferences(['thamini uzungumzaji katika jamii ya Kenya', 'mila za jamii ya Kikenya']), [])
  assert.deepEqual(findEthnicReferences(['Wanafunzi waeleze soko la mji wa Kisii', 'Kaunti ya Meru ina milima']), [])
})

test('findEthnicReferences permits a community the sub-strand itself is about', () => {
  assert.deepEqual(findEthnicReferences(['Describe the political organisation of the Agikuyu'], 'Pre-colonial societies - Agikuyu'), [])
})

test('regression: a Kiswahili lesson that names an ethnic community is rejected and regenerated', async () => {
  replies = [
    lessonReply('Wanafunzi wachanganue mawaidha ya jamii ya Waluhya.'),
    lessonReply('Wanafunzi watenge vitenzi vya kauli ya kutendana kwenye kadi maneno.'),
  ]
  const result = await generateValidatedLesson({ ...BASE })
  assert.equal(result._validated, true, result.details)
  assert.equal(calls.length, 2, 'first reply rejected, second accepted')
  assert.ok(!JSON.stringify(result).includes('Waluhya'))
  assert.ok(calls[1].prompt.includes('usitaje kabila'), 'the retry tells the model why, in Kiswahili')
})

test('prompts carry no seeded place/community examples and no conflict-with-a-place example', async () => {
  replies = [lessonReply('Wanafunzi watenge vitenzi kwenye kadi maneno.')]
  await generateValidatedLesson({ ...BASE })
  await generateValidatedLesson({ ...BASE, learningArea: 'English', subjectType: 'default', substrand: 'Grammar in Use - Adverbs' })
  for (const { prompt, system } of calls) {
    const text = `${system}\n${prompt}`
    for (const seeded of ['Gikomba', 'Bonde la Ufa', 'Rift Valley', 'mgogoro wa mpaka', 'boundary dispute', 'jamii halisi za Kenya']) {
      assert.ok(!text.includes(seeded), `prompt still seeds "${seeded}"`)
    }
  }
})

test('Kiswahili resources: KICD resources for the skill are offered; page numbers are never invented', async () => {
  replies = [lessonReply('Wanafunzi watenge vitenzi kwenye kadi maneno.')]
  await generateValidatedLesson({ ...BASE })
  const { prompt, system } = calls[0]
  assert.ok(prompt.includes('Kadi maneno') && prompt.includes('Kapu maneno'), 'Sarufi resources from the KICD design')
  assert.ok(system.includes('mgeni mwalikwa'), 'resource persons are allowed, as KICD suggests')
  assert.ok(prompt.includes('usibuni nambari za ukurasa') || prompt.includes('KAMWE usibuni nambari za ukurasa'))
  assert.ok(!system.includes('watu rasilimali wa jamii, matembezi shambani, kanda za redio'), 'old blanket ban on KICD resources is gone')
})
