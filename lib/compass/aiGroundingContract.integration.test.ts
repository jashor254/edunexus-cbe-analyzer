// lib/compass/aiGroundingContract.integration.test.ts
//
// H2E — proves the real, unmodified Compass grounding chain
// (resolveCompassAcademicLevelFor -> buildCompassPrompt) against real
// evidence and a real persisted Projection — not a mocked prompt builder.
//
// AI-CMP-001 — Compass AI context is derived only from canonical admissible
//   learner state, and never cross-contaminates between learners.
// AI-CMP-002 — when canonical evidence is absent, the prompt explicitly
//   marks the level as provisional rather than handing the model a
//   confident-looking number indistinguishable from real evidence.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/compass/aiGroundingContract.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { resolveCompassAcademicLevelFor } from '@/lib/compass/learnerContext'
import { buildCompassPrompt, type CompassPromptParams } from '@/lib/compass/prompt'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_AI_CMP_TEST'
const db = createServiceClient()
const NO_LEGACY_FALLBACK = { subjectTiers: {}, overallLevel: null, sessionLevel: null, clientHint: null }

let initiatedByUserId: string
const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id
})

after(async () => {
  if (createdStudentIds.length) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', createdStudentIds)
    const evidenceIds = (evidenceRows ?? []).map(r => r.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('learner_projections').delete().in('learner_id', createdStudentIds)
    await db.from('students').delete().in('id', createdStudentIds)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function makeStudent(label: string): Promise<string> {
  const { data, error } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} ${label}`, grade: 8 }).select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  createdStudentIds.push(data.id)
  return data.id
}

async function seedMathEvidence(studentId: string, cbcLevel: LearnerEvidence['cbcLevel'], score: number): Promise<void> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  await persistEvidenceBatch([{
    learnerId: studentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score, cbcLevel,
    assessmentType: 'cat', term: 1, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h2e_ai_cmp_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test', importedAt: '2026-01-01T00:00:00Z', issues: [],
  }], run.id)
}

function basePromptParams(overrides: Partial<CompassPromptParams> & Pick<CompassPromptParams, 'firstName' | 'level'>): CompassPromptParams {
  return {
    grade: 8, isJunior: true, subject: 'mathematics', subtopic: 'Fractions',
    gradeTopics: [], sessionsWithoutImprovement: 0, mode: 'school',
    languageMode: 'mixed', questionMode: 'mcq-and-structured',
    ...overrides,
  }
}

test('AI-CMP-001: two learners with opposing Mathematics evidence produce prompts grounded only in their own canonical level, never each other\'s', async () => {
  const learnerA = await makeStudent('strong')
  const learnerB = await makeStudent('weak')
  await seedMathEvidence(learnerA, 4, 98)
  await seedMathEvidence(learnerB, 1, 25)
  await recomputeLearnerProjection(learnerA)
  await recomputeLearnerProjection(learnerB)

  const stateA = await resolveCompassAcademicLevelFor(learnerA, 'mathematics', NO_LEGACY_FALLBACK)
  const stateB = await resolveCompassAcademicLevelFor(learnerB, 'mathematics', NO_LEGACY_FALLBACK)

  assert.equal(stateA.source, 'projection', 'sanity: learner A must be grounded in real evidence, not a fallback')
  assert.equal(stateB.source, 'projection', 'sanity: learner B must be grounded in real evidence, not a fallback')
  assert.equal(stateA.level, 4)
  assert.equal(stateB.level, 1)

  const promptA = buildCompassPrompt(basePromptParams({ firstName: 'LearnerAlpha', level: stateA.level, levelSource: stateA.source }))
  const promptB = buildCompassPrompt(basePromptParams({ firstName: 'LearnerBeta', level: stateB.level, levelSource: stateB.source }))

  assert.match(promptA, /LearnerAlpha \| Grade 8 \| Level 4\/4/)
  assert.doesNotMatch(promptA, /LearnerBeta/, 'learner A\'s prompt must never mention learner B')
  assert.doesNotMatch(promptA, /Level 1\/4/, 'learner A\'s prompt must never carry learner B\'s level')

  assert.match(promptB, /LearnerBeta \| Grade 8 \| Level 1\/4/)
  assert.doesNotMatch(promptB, /LearnerAlpha/, 'learner B\'s prompt must never mention learner A')
  assert.doesNotMatch(promptB, /Level 4\/4/, 'learner B\'s prompt must never carry learner A\'s level')
})

test('AI-CMP-002: a learner with zero admissible evidence gets an explicitly provisional level in the prompt, not a confident fabricated one', async () => {
  const studentId = await makeStudent('no-evidence')
  await recomputeLearnerProjection(studentId) // no evidence seeded — establishes the "nothing yet" state for real

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', NO_LEGACY_FALLBACK)
  assert.equal(state.source, 'default', 'sanity: with zero evidence and no legacy fallback, the conservative default must be used')
  assert.equal(state.level, 2)

  const prompt = buildCompassPrompt(basePromptParams({ firstName: 'NoEvidenceLearner', level: state.level, levelSource: state.source }))

  assert.match(prompt, /Level 2\/4.*provisional — no confirmed evidence yet/, 'the prompt must explicitly flag this level as unconfirmed, not present it as equivalent to real evidence')
})

test('AI-CMP-002 sanity check: a learner WITH confirmed evidence gets no provisional caveat', async () => {
  const studentId = await makeStudent('with-evidence')
  await seedMathEvidence(studentId, 3, 68)
  await recomputeLearnerProjection(studentId)

  const state = await resolveCompassAcademicLevelFor(studentId, 'mathematics', NO_LEGACY_FALLBACK)
  assert.equal(state.source, 'projection')

  const prompt = buildCompassPrompt(basePromptParams({ firstName: 'RealEvidenceLearner', level: state.level, levelSource: state.source }))
  assert.doesNotMatch(prompt, /provisional/, 'a real, evidence-derived level must never carry the no-evidence caveat')
})
