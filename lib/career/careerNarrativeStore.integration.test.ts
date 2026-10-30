// lib/career/careerNarrativeStore.integration.test.ts
//
// DEEP (real database): Career Intelligence narrative reuse AFTER migration
// 20261030120000_career_intelligence_narratives.sql is applied. The unit
// tests (aiReuseAndTargets.test.ts) cover the rules with a test double and
// the pre-migration "table missing" path; this proves the real table,
// repository and RLS behave as those rules assume:
//
//   - first view generates and stores; the second reuses from the DB (no model call)
//   - the stored row holds the {{LEARNER}} placeholder, never the learner's name
//   - (student_id, input_fingerprint) is unique — a repeat save never duplicates
//   - new evidence (a changed input) stores a second, separate narrative
//   - RLS: an anonymous client cannot read the table
//   - deleting the learner removes their narratives (ON DELETE CASCADE)
//
// Requires an isolated, migrated test database (TEST_SUPABASE_* — see
// scripts/check-test-target.ts). The AI call is mocked; nothing leaves the machine.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/career/careerNarrativeStore.integration.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'

let modelCalls = 0
mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      modelCalls++
      return JSON.stringify({
        domain_expertise: '{{LEARNER}} is building depth.', career_flexibility: 'x',
        teacher_insight: { subjects_requiring_intervention: [], hidden_strengths: [], suggested_classroom_opportunities: [], suggested_responsibilities: [], how_to_nurture_confidence: 'x' },
        learner_challenge: { challenge: 'x', why: 'x', how_to_do_it: 'x' },
        intelligence_summary: 'x', if_learning_continues: 'If {{LEARNER}} continues…',
      })
    },
  },
})

const SYNTHETIC_MARKER = 'SYNTHETIC_CIE_NARRATIVE_REUSE_TEST'
const db = createServiceClient()
let engine: typeof import('./careerIntelligenceEngine')
let studentId: string

const INPUTS: import('./careerIntelligenceEngine').NarrativeInputs = {
  grade: 9, age: 14, pathway: 'STEM', dominantCluster: ['analytical_reasoning'], emergingCluster: [],
  topSubjects: ['Mathematics'], weakSubjects: [], readinessScore: 70, readinessLabel: 'Strong',
  topMatchTitles: ['Engineering & Technology'], dreamCareer: null, assessmentCount: 2,
  confidenceLevel: 'Low', mode: 'exploration',
}

before(async () => {
  engine = await import('./careerIntelligenceEngine')
  const { data, error } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} Wanjiku`, grade: 9 }).select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  studentId = data.id
})

after(async () => {
  if (studentId) {
    await db.from('career_intelligence_narratives').delete().eq('student_id', studentId)
    await db.from('students').delete().eq('id', studentId)
  }
})

const rowsFor = async (id: string) => {
  const { data, error } = await db.from('career_intelligence_narratives').select('input_fingerprint, prompt_version, narrative').eq('student_id', id)
  if (error) throw new Error(error.message)
  return data ?? []
}

test('first view generates and stores; the second view reuses the stored narrative with no model call', async () => {
  modelCalls = 0
  const first = await engine.resolveCareerNarrative(studentId, INPUTS, {})
  assert.equal(first.source, 'generated')
  assert.equal(modelCalls, 1)

  const second = await engine.resolveCareerNarrative(studentId, { ...INPUTS }, {})
  assert.equal(second.source, 'reused')
  assert.equal(modelCalls, 1, 'reuse made no model call')

  const rows = await rowsFor(studentId)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].input_fingerprint, engine.narrativeFingerprint(INPUTS))
  assert.equal(rows[0].prompt_version, engine.CAREER_NARRATIVE_PROMPT_VERSION)
  const stored = JSON.stringify(rows[0].narrative)
  assert.match(stored, /\{\{LEARNER\}\}/, 'stored in placeholder form')
  assert.doesNotMatch(stored, /Wanjiku/, 'the learner\'s name is never stored')
})

test('a repeat save for the same inputs never duplicates the row (unique student + fingerprint)', async () => {
  await engine.resolveCareerNarrative(studentId, INPUTS, { narrativeStore: {
    find: async () => null, // force a fresh generation + save for identical inputs
    save: async (sid, fp, sections) => {
      const { error } = await db.from('career_intelligence_narratives')
        .upsert({ student_id: sid, input_fingerprint: fp, prompt_version: engine.CAREER_NARRATIVE_PROMPT_VERSION, narrative: sections, model: null }, { onConflict: 'student_id,input_fingerprint' })
      if (error) throw new Error(error.message)
    },
  } })
  assert.equal((await rowsFor(studentId)).length, 1)
})

test('new evidence (changed inputs) stores a separate narrative instead of serving the old one', async () => {
  modelCalls = 0
  const r = await engine.resolveCareerNarrative(studentId, { ...INPUTS, assessmentCount: 3 }, {})
  assert.equal(r.source, 'generated')
  assert.equal(modelCalls, 1)
  assert.equal((await rowsFor(studentId)).length, 2)
})

test('RLS: an anonymous client cannot read stored narratives', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  assert.ok(url && anonKey, 'anon credentials for the isolated test stack')
  const anon = createClient(url!, anonKey!, { auth: { persistSession: false } })
  const { data } = await anon.from('career_intelligence_narratives').select('student_id').eq('student_id', studentId)
  assert.equal((data ?? []).length, 0)
})

test('deleting the learner removes their narratives (ON DELETE CASCADE)', async () => {
  const { data: other } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} cascade`, grade: 9 }).select('id').single()
  await engine.resolveCareerNarrative(other!.id, INPUTS, {})
  assert.equal((await rowsFor(other!.id)).length, 1)
  await db.from('students').delete().eq('id', other!.id)
  assert.equal((await rowsFor(other!.id)).length, 0)
})
