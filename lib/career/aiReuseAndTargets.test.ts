// lib/career/aiReuseAndTargets.test.ts
//
// Career-side AI remediation (docs/audits/ai-call-efficiency-deep-audit.md):
//
//   F-10 Career Intelligence narrative reuse — an unchanged learner re-opening
//        the report reuses the stored narrative: no model call, no quota hook.
//        Any change to the narrative's inputs (new evidence) regenerates it.
//        Reuse-only mode (no tokens) never generates.
//   F-03 Class reports — the LLM briefing never overwrites session_goal /
//        guided_topics that the assessment pipeline derived from the
//        knowledge graph; without graph data it writes them as before.
//
// No DB, no network: the narrative store is injected and callDeepSeek is mocked.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/career/aiReuseAndTargets.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

let modelCalls = 0
mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      modelCalls++
      return JSON.stringify({
        domain_expertise: '{{LEARNER}} goes deep.', career_flexibility: 'x',
        teacher_insight: { subjects_requiring_intervention: [], hidden_strengths: [], suggested_classroom_opportunities: [], suggested_responsibilities: [], how_to_nurture_confidence: 'x' },
        learner_challenge: { challenge: 'x', why: 'x', how_to_do_it: 'x' },
        intelligence_summary: 'x', if_learning_continues: 'If {{LEARNER}} continues…',
      })
    },
  },
})
// The repository behaves as it does BEFORE the narratives migration is
// applied: PostgREST reports the table missing on every read and write.
const MISSING_TABLE = 'Could not find the table \'public.career_intelligence_narratives\' in the schema cache'
let storeReads = 0
mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      careers: {
        findCareerNarrative: async () => { storeReads++; throw new Error(`Failed to read career narrative: ${MISSING_TABLE}`) },
        upsertCareerNarrative: async () => { throw new Error(`Failed to store career narrative: ${MISSING_TABLE}`) },
      },
    },
  },
})
mock.module('@/lib/observability/logger', { namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } } })

let engine: typeof import('./careerIntelligenceEngine')
let reportOwnedTargets: typeof import('./autoReportGenerator').reportOwnedTargets

before(async () => {
  engine = await import('./careerIntelligenceEngine')
  ;({ reportOwnedTargets } = await import('./autoReportGenerator'))
})
beforeEach(() => { modelCalls = 0; storeReads = 0 })

type Inputs = import('./careerIntelligenceEngine').NarrativeInputs
const INPUTS: Inputs = {
  grade: 8, age: 13, pathway: 'STEM', dominantCluster: ['analytical_reasoning'], emergingCluster: [],
  topSubjects: ['Mathematics'], weakSubjects: ['English'], readinessScore: 60, readinessLabel: 'On Track',
  topMatchTitles: ['Engineering & Technology'], dreamCareer: null, assessmentCount: 3,
  confidenceLevel: 'Medium', mode: 'exploration',
}

function memoryStore() {
  const rows = new Map<string, { sections: unknown; generatedAt: string }>()
  let saves = 0
  return {
    store: {
      find: async (sid: string, fp: string) => (rows.get(`${sid}:${fp}`) as { sections: never; generatedAt: string } | undefined) ?? null,
      save: async (sid: string, fp: string, sections: unknown) => { saves++; rows.set(`${sid}:${fp}`, { sections, generatedAt: '2026-10-30T08:00:00Z' }) },
    },
    saves: () => saves,
  }
}

test('first view generates once (quota hook runs once) and stores the pseudonymised narrative', async () => {
  const m = memoryStore()
  let hooks = 0
  const r = await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store, beforeGenerate: async () => { hooks++ } })
  assert.equal(r.source, 'generated')
  assert.equal(modelCalls, 1)
  assert.equal(hooks, 1)
  assert.equal(m.saves(), 1)
  assert.match(JSON.stringify(r.sections), /\{\{LEARNER\}\}/, 'stored form carries the placeholder, not a name')
})

test('re-opening with unchanged inputs reuses the narrative — no model call, no quota hook, no save', async () => {
  const m = memoryStore()
  await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store })
  modelCalls = 0
  let hooks = 0
  const again = await engine.resolveCareerNarrative('s1', { ...INPUTS }, { narrativeStore: m.store, beforeGenerate: async () => { hooks++ } })
  assert.equal(again.source, 'reused')
  assert.equal(again.generatedAt, '2026-10-30T08:00:00Z')
  assert.equal(modelCalls, 0)
  assert.equal(hooks, 0)
  assert.equal(m.saves(), 1)
})

test('new evidence that changes any narrative input regenerates (never serves a stale narrative)', async () => {
  const m = memoryStore()
  await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store })
  for (const changed of [
    { assessmentCount: 4 }, { weakSubjects: ['English', 'Kiswahili'] }, { readinessScore: 61 },
    { mode: 'planning' as const }, { dominantCluster: ['communication'] },
  ]) {
    modelCalls = 0
    const r = await engine.resolveCareerNarrative('s1', { ...INPUTS, ...changed }, { narrativeStore: m.store })
    assert.equal(r.source, 'generated', JSON.stringify(changed))
    assert.equal(modelCalls, 1)
  }
})

test('narratives are per learner — another learner with identical inputs never receives it', async () => {
  const m = memoryStore()
  await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store })
  modelCalls = 0
  const other = await engine.resolveCareerNarrative('s2', INPUTS, { narrativeStore: m.store })
  assert.equal(other.source, 'generated')
  assert.equal(modelCalls, 1)
})

test('reuse-only mode (no tokens): a stored narrative is served; a miss throws and never calls the model', async () => {
  const m = memoryStore()
  await assert.rejects(
    () => engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store, allowGeneration: false }),
    engine.NarrativeNotAvailableError,
  )
  assert.equal(modelCalls, 0)
  await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store })
  modelCalls = 0
  const r = await engine.resolveCareerNarrative('s1', INPUTS, { narrativeStore: m.store, allowGeneration: false })
  assert.equal(r.source, 'reused')
  assert.equal(modelCalls, 0)
})

test('a refused quota hook stops generation before the model call', async () => {
  await assert.rejects(() => engine.resolveCareerNarrative('s1', INPUTS, {
    narrativeStore: memoryStore().store,
    beforeGenerate: async () => { throw new Error('daily limit') },
  }), /daily limit/)
  assert.equal(modelCalls, 0)
})

test('fingerprint: stable for equal inputs, sensitive to the prompt version', () => {
  assert.equal(engine.narrativeFingerprint(INPUTS), engine.narrativeFingerprint({ ...INPUTS }))
  assert.match(engine.narrativeFingerprint(INPUTS), /^[0-9a-f]{64}$/)
  assert.ok(engine.CAREER_NARRATIVE_PROMPT_VERSION.length > 0)
})

test('pre-migration (table missing): the report still generates, and never claims reuse it cannot do', async () => {
  // No narrativeStore injected → the real table-backed store, whose table does not exist yet.
  const first = await engine.resolveCareerNarrative('s1', INPUTS, {})
  const second = await engine.resolveCareerNarrative('s1', INPUTS, {})
  assert.equal(first.source, 'generated')
  assert.equal(second.source, 'generated', 'without the table nothing can be reused — and nothing pretends to be')
  assert.equal(modelCalls, 2)
  assert.equal(storeReads, 2, 'the lookup was attempted and degraded to a miss, not an error')
})

test('pre-migration, reuse-only (no tokens): a missing table means "not available", never a crash', async () => {
  await assert.rejects(() => engine.resolveCareerNarrative('s1', INPUTS, { allowGeneration: false }), engine.NarrativeNotAvailableError)
  assert.equal(modelCalls, 0)
})

// ── Class reports: never overwrite graph-grounded targets ────────────────────

const BRIDGE = {
  sessionGoal: 'Close the gap in fractions',
  weeklyMilestones: [{ week: 1, goal: 'g', subject: 'mathematics', checkConcept: 'fractions' }],
}

test('class report: graph-derived session_goal/guided_topics are preserved (the LLM briefing writes neither)', () => {
  const update = reportOwnedTargets(BRIDGE, [{ subject: 'mathematics', failing_topic_name: 'Algebra', root_causes: [] }])
  assert.deepEqual(update, {})
})

test('class report: without knowledge-graph data the briefing\'s targets are written as before', () => {
  for (const none of [null, undefined, []]) {
    assert.deepEqual(reportOwnedTargets(BRIDGE, none), { session_goal: 'Close the gap in fractions', guided_topics: ['fractions'] })
  }
})
