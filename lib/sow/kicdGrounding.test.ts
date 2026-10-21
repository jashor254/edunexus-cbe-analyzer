// lib/sow/kicdGrounding.test.ts
//
// Proves each allocated SOW lesson is grounded in the KICD sub-strand it
// teaches — loaded server-side by strand id — and that the pipeline's
// grounding verdict is honest. Repositories and the AI generator are
// mocked; no DB, no network.
//
// Run: npm test -- lib/sow/kicdGrounding.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { AllocatedLesson, SelectedSubstrand, TimelineSlot, SOWContext } from './types'

const STRAND = 'strand-haki'

const HAKI_KICD = [
  { title: '11.1.1 Uzungumzaji katika Sherehe', learning_outcomes: ['kueleza maana ya uzungumzaji katika sherehe', 'kutoa mazungumzo katika muktadha wa sherehe', 'kuchangamkia mazungumzo yafaayo katika miktadha ya sherehe'], key_inquiry_questions: ['Ni mambo gani ya kuzingatia wakati wa kuzungumza katika muktadha wa sherehe?'] },
  { title: '11.2.1 Kusoma kwa Mapana; Matini ya kujichagulia', learning_outcomes: ['kuteua matini ya kusoma ya kiwango chake'] },
  { title: '11.3.1 Insha za Kubuni: Maelezo', learning_outcomes: ['kuandika insha ya maelezo akizingatia mtazamo mahususi'] },
  { title: '11.4.1 Mnyambuliko wa Vitenzi', learning_outcomes: ['kutambua viambishi vya kauli ya kutendana, kutendeana na kutendesha katika vitenzi'] },
]

let strandRows: Array<{ id: string; kicd_data: unknown }> = []
let requestedIds: string[][] = []

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      curriculum: {
        findKicdDataByStrandIds: async (ids: string[]) => {
          requestedIds.push(ids)
          return strandRows.filter(r => ids.includes(r.id))
        },
      },
    },
  },
})

type GenCall = { substrand: string; kicdSlice?: { entryTitle: string; part: number; parts: number; learningOutcomes: string[] } }
let genCalls: GenCall[] = []

mock.module('./aiLessonGenerator', {
  namedExports: {
    generateValidatedLesson: async (ctx: GenCall) => {
      genCalls.push(ctx)
      return {
        learning_outcomes: ['tambua x', 'eleza x', 'thamini x'],
        learning_experiences: ['Wanafunzi wajadili.'],
        key_inquiry_questions: ['Je?'],
        assessment_methods: ['Maswali ya mdomo'],
        learning_resources: ['Kitabu'],
        _validated: true,
        _confidence: 0.9,
        _source: 'mock',
      }
    },
  },
})

let grounding: typeof import('./kicdGrounding')
let pipeline: typeof import('./lessonPipeline')

before(async () => {
  grounding = await import('./kicdGrounding')
  pipeline = await import('./lessonPipeline')
})

beforeEach(() => {
  strandRows = [{ id: STRAND, kicd_data: HAKI_KICD }]
  requestedIds = []
  genCalls = []
})

function allocated(substrand: string, strandId: string | null = STRAND): AllocatedLesson {
  return { slotIndex: 0, week: 1, lesson: 1, strand: 'HAKI ZA KIBINADAMU', substrand, substrandId: `id-${substrand}`, strandId, lessonInSubstrand: 1 }
}

test('loadKicdEntriesByStrandId loads by exact strand id, deduplicated, and parses entries', async () => {
  const byId = await grounding.loadKicdEntriesByStrandId([STRAND, STRAND, ''])
  assert.deepEqual(requestedIds, [[STRAND]])
  assert.equal(byId[STRAND].length, 4)
  assert.equal(byId[STRAND][3].title, '11.4.1 Mnyambuliko wa Vitenzi')
})

test('groundAllocatedLessons gives each lesson its own sub-strand and numbers the parts', async () => {
  const entries = await grounding.loadKicdEntriesByStrandId([STRAND])
  const slices = grounding.groundAllocatedLessons([
    allocated('Kusikiliza na Kuzungumza - Uzungumzaji katika sherehe'),
    allocated('Sarufi - Mnyambuliko wa vitenzi'),
    allocated('Kusikiliza na Kuzungumza - Uzungumzaji katika sherehe'),
  ], entries)

  assert.equal(slices[0]?.entryTitle, '11.1.1 Uzungumzaji katika Sherehe')
  assert.equal(slices[1]?.entryTitle, '11.4.1 Mnyambuliko wa Vitenzi',
    'regression: the old generator gave every lesson kicd_data[0] (Uzungumzaji)')
  assert.deepEqual([slices[0]?.part, slices[0]?.parts], [1, 2])
  assert.deepEqual([slices[2]?.part, slices[2]?.parts], [2, 2])
  assert.ok(slices[2]?.learningOutcomes.includes('kuchangamkia mazungumzo yafaayo katika miktadha ya sherehe'))
})

test('groundAllocatedLessons returns null for lessons with no credible entry or no strand id', async () => {
  const entries = await grounding.loadKicdEntriesByStrandId([STRAND])
  const slices = grounding.groundAllocatedLessons([
    allocated('Photosynthesis - Light reactions'),
    allocated('Sarufi - Mnyambuliko wa vitenzi', null),
    allocated('Sarufi - Mnyambuliko wa vitenzi', 'strand-with-no-kicd'),
  ], entries)
  assert.deepEqual(slices, [null, null, null])
})

// ── Pipeline: grounding source + honest verdict ──────────────────────────────

const timeline: TimelineSlot[] = Array.from({ length: 2 }, (_, i) => ({ slotIndex: i, week: 1, lesson: i + 1, isBreak: false }))

const selected = (titles: string[]): SelectedSubstrand[] => titles.map((t, i) => ({
  strandId: STRAND, strandTitle: 'HAKI ZA KIBINADAMU', substrandId: `sub-${i}`, substrandTitle: t, lessonsRequired: 1, orderIndex: i,
}))

const context = {
  school: 'Mwatate Ridge (synthetic)', grade: 'Grade 9', gradeName: 'Grade 9', learningArea: 'la', learningAreaName: 'Kiswahili',
  term: 3, year: 2026, curriculumMode: 'cbc_junior',
} as SOWContext

test('pipeline: a grounded run passes each lesson its own KICD slice and reports groundedInKicd', async () => {
  const entries = await grounding.loadKicdEntriesByStrandId([STRAND])
  const result = await pipeline.generateSchemePipeline({
    timeline,
    selectedSubstrands: selected(['Kusikiliza na Kuzungumza - Uzungumzaji katika sherehe', 'Sarufi - Mnyambuliko wa vitenzi']),
    context,
    kicdEntriesByStrandId: entries,
  })
  assert.equal(genCalls[1].kicdSlice?.entryTitle, '11.4.1 Mnyambuliko wa Vitenzi')
  assert.equal(result.lessons[1].kicdEntryTitle, '11.4.1 Mnyambuliko wa Vitenzi')
  assert.equal(result.summary.grounded, 2)
  assert.equal(result.groundedInKicd, true)
})

test('pipeline: partial grounding is reported as NOT grounded, with the count', async () => {
  const entries = await grounding.loadKicdEntriesByStrandId([STRAND])
  const result = await pipeline.generateSchemePipeline({
    timeline,
    selectedSubstrands: selected(['Sarufi - Mnyambuliko wa vitenzi', 'Photosynthesis - Light reactions']),
    context,
    kicdEntriesByStrandId: entries,
  })
  assert.equal(result.summary.grounded, 1)
  assert.equal(result.summary.generated, 2)
  assert.equal(result.groundedInKicd, false)
  assert.equal(result.lessons[1].kicdEntryTitle, undefined)
})

test('pipeline: a client-smuggled kicdContext grounds nothing — only server-loaded entries count', async () => {
  const smuggled = {
    ...context,
    kicdContext: { subjectData: {}, strandData: [{ title: 'HAKI ZA KIBINADAMU', kicd_data: HAKI_KICD }] },
  } as unknown as SOWContext
  const result = await pipeline.generateSchemePipeline({
    timeline,
    selectedSubstrands: selected(['Sarufi - Mnyambuliko wa vitenzi', 'Kusoma - Kusoma kwa Mapana']),
    context: smuggled,
  })
  assert.ok(genCalls.every(c => c.kicdSlice === undefined))
  assert.equal(result.summary.grounded, 0)
  assert.equal(result.groundedInKicd, false,
    'regression: groundedInKicd used to be true whenever strand rows were present')
})
