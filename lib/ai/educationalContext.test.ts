// lib/ai/educationalContext.test.ts
// Pure unit tests for deriveEducationalAIContext — no DB. Proves the
// canonical EducationalAIContext contract is a pure reshape of an
// already-computed AdaptiveTask (lib/adaptiveLearning/recommend.ts),
// introducing zero new reasoning: every field traces back to a value
// buildAdaptiveTask already computed.
//
// Run with: npx tsx --env-file=.env.local --test lib/ai/educationalContext.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveEducationalAIContext } from './educationalContext'
import { buildAdaptiveTask } from '@/lib/adaptiveLearning/recommend'
import type { LearnerIntelligenceProjection, AcademicValue } from '@/lib/projection/types'

const SUBJECT = 'mathematics'

function projection(level: 1 | 2 | 3 | 4 | null): LearnerIntelligenceProjection {
  const academic = level === null ? null : {
    value: {
      bySubject: { [SUBJECT]: { subject: SUBJECT, latestLevel: level, trend: 'stable' as const, history: [] } },
      bySubStrand: {},
    } as AcademicValue,
    supportingEvidenceIds: ['ev-1', 'ev-2'],
    confidence: 80,
    coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'academic-v1',
  }

  return {
    learnerId: 'learner-1', academic, capability: null, knowledge: null,
    behaviour: null, growth: null, risk: null, completeness: null,
  }
}

test('deriveEducationalAIContext: every field traces back to the AdaptiveTask it was built from', () => {
  const p = projection(2)
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  const ctx = deriveEducationalAIContext(task)

  assert.equal(ctx.learnerId, task.learnerId)
  assert.equal(ctx.subject, task.subject)
  assert.equal(ctx.band, task.groupType)
  assert.equal(ctx.academicGrain, task.academicGrain)
  assert.equal(ctx.curriculum, task.curriculum)
  assert.equal(ctx.curriculumNotice, task.curriculumNotice)
  assert.equal(ctx.observation, task.observation)
  assert.equal(ctx.action, task.action)
  assert.deepEqual(ctx.supportingEvidenceIds, task.evidence)
  assert.equal(ctx.confidence, task.confidence)
})

test('deriveEducationalAIContext: reserved fields are always null — never a fabricated ARDS/IKL claim', () => {
  const ctx = deriveEducationalAIContext(buildAdaptiveTask('learner-1', 'Amina', SUBJECT, projection(3)))
  assert.equal(ctx.precision, null)
  assert.equal(ctx.instructionalKnowledge, null)
})

test('deriveEducationalAIContext: insufficient_data band carries a null curriculum and null academicGrain, honestly', () => {
  const ctx = deriveEducationalAIContext(buildAdaptiveTask('learner-1', 'Amina', SUBJECT, projection(null)))
  assert.equal(ctx.band, 'insufficient_data')
  assert.equal(ctx.academicGrain, null)
  assert.equal(ctx.curriculum, null)
  assert.deepEqual(ctx.supportingEvidenceIds, [])
})

test('deriveEducationalAIContext: with a resolved curriculum context, curriculum and academicGrain reflect it exactly', () => {
  const p = projection(2)
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: ['Add fractions with different denominators'], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  const ctx = deriveEducationalAIContext(task)

  assert.deepEqual(ctx.curriculum, curriculum)
  assert.equal(ctx.academicGrain, 'subject') // no bySubStrand evidence in this fixture — honest fallback
  assert.equal(ctx.curriculumNotice, null)
})

test('deriveEducationalAIContext: resolvedAt is a real, current ISO timestamp', () => {
  const before = Date.now()
  const ctx = deriveEducationalAIContext(buildAdaptiveTask('learner-1', 'Amina', SUBJECT, projection(4)))
  const resolvedAtMs = new Date(ctx.resolvedAt).getTime()
  assert.ok(resolvedAtMs >= before && resolvedAtMs <= Date.now())
})
