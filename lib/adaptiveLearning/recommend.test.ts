// lib/adaptiveLearning/recommend.test.ts
// Pure unit tests — no DB. Covers classification, Insight shape, neutral
// labeling, and class-grouping using synthetic LearnerIntelligenceProjection
// fixtures directly (not persisted, not read from Evidence).
// Run with: npx tsx --env-file=.env.local --test lib/adaptiveLearning/recommend.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyGroup, buildAdaptiveTask, buildClassRecommendations, neutralGroupLabel } from './recommend'
import type { LearnerIntelligenceProjection, AcademicValue, RiskValue } from '@/lib/projection/types'

const SUBJECT = 'mathematics'

function projection(overrides: {
  level?: 1 | 2 | 3 | 4 | null
  trend?: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  riskSeverity?: 'watch' | 'at_risk' | 'critical' | null
  confidence?: number
  evidenceIds?: string[]
}): LearnerIntelligenceProjection {
  const level = overrides.level === undefined ? 3 : overrides.level
  const academic = level === null ? null : {
    value: {
      bySubject: {
        [SUBJECT]: {
          subject: SUBJECT,
          latestLevel: level,
          trend: overrides.trend ?? 'stable',
          history: [],
        },
      },
    } as AcademicValue,
    supportingEvidenceIds: overrides.evidenceIds ?? ['ev-1', 'ev-2'],
    confidence: overrides.confidence ?? 80,
    coverage: { evidenceCount: 2, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'academic-v1',
  }

  const risk = overrides.riskSeverity === undefined ? null : {
    value: {
      flags: overrides.riskSeverity === null ? [] : [{
        subject: SUBJECT, reason: 'test', severity: overrides.riskSeverity, evidenceIds: ['ev-1'],
      }],
      overallRiskLevel: 'normal',
    } as RiskValue,
    supportingEvidenceIds: ['ev-1'],
    confidence: 80,
    coverage: { evidenceCount: 1, evidenceDiversity: 1, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: 1 },
    lastComputed: new Date().toISOString(),
    projectionVersion: 'risk-v1',
  }

  return {
    learnerId: 'learner-1', academic, capability: null, knowledge: null,
    behaviour: null, growth: null, risk, completeness: null,
  }
}

// ── classifyGroup ─────────────────────────────────────────────────────────────

test('classifyGroup: no academic projection → insufficient_data', () => {
  const p = projection({ level: null })
  assert.equal(classifyGroup(p, SUBJECT), 'insufficient_data')
})

test('classifyGroup: level 1 + critical risk severity → critical_gap', () => {
  const p = projection({ level: 1, riskSeverity: 'critical' })
  assert.equal(classifyGroup(p, SUBJECT), 'critical_gap')
})

test('classifyGroup: level 1 without critical severity → prerequisite_gap, not critical_gap', () => {
  const p = projection({ level: 1, riskSeverity: 'at_risk' })
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

test('classifyGroup: level 2 → prerequisite_gap regardless of risk', () => {
  const p = projection({ level: 2, riskSeverity: null })
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

test('classifyGroup: level 3 → concept_confusion', () => {
  const p = projection({ level: 3 })
  assert.equal(classifyGroup(p, SUBJECT), 'concept_confusion')
})

test('classifyGroup: level 4 → on_track (Group C)', () => {
  const p = projection({ level: 4 })
  assert.equal(classifyGroup(p, SUBJECT), 'on_track')
})

test('classifyGroup: a risk flag for a different subject is ignored', () => {
  const p = projection({ level: 1, riskSeverity: 'critical' })
  p.risk!.value.flags[0] = { subject: 'english', reason: 'x', severity: 'critical', evidenceIds: [] }
  assert.equal(classifyGroup(p, SUBJECT), 'prerequisite_gap')
})

// ── buildAdaptiveTask (Insight shape) ─────────────────────────────────────────

test('buildAdaptiveTask: insufficient data produces the shared insufficientEvidenceInsight, never a guess', () => {
  const p = projection({ level: null })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.groupType, 'insufficient_data')
  assert.equal(task.level, null)
  assert.equal(task.confidence, 'Low')
  assert.deepEqual(task.evidence, [])
  assert.match(task.observation, /insufficient evidence/)
})

test('buildAdaptiveTask: every task carries observation, evidence, confidence, action (LI-2)', () => {
  const p = projection({ level: 2, evidenceIds: ['ev-a', 'ev-b'] })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.groupType, 'prerequisite_gap')
  assert.ok(task.observation.length > 0)
  assert.deepEqual(task.evidence, ['ev-a', 'ev-b'])
  assert.ok(['Low', 'Medium', 'High'].includes(task.confidence))
  assert.ok(task.action.length > 0)
})

test('buildAdaptiveTask: career note is appended to the action when provided', () => {
  const p = projection({ level: 4 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { careerNote: 'Future Engineer: try a design challenge.' })
  assert.match(task.action, /Future Engineer/)
})

test('buildAdaptiveTask: on_track maps to enrichment task style', () => {
  const p = projection({ level: 4 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.taskStyle, 'enrichment')
})

// ── Curriculum Grounding Layer (Wave 7) ───────────────────────────────────────

test('buildAdaptiveTask: without a curriculum context, the task is honest — null curriculum, explicit notice, generic action', () => {
  const p = projection({ level: 2 })
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p)
  assert.equal(task.curriculum, null)
  assert.match(task.curriculumNotice ?? '', /No specific curriculum sub-strand/)
})

test('buildAdaptiveTask: with a curriculum context but zero seeded outcomes, states the gap explicitly rather than fabricating one', () => {
  const p = projection({ level: 2 })
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: [], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  assert.deepEqual(task.curriculum, curriculum)
  assert.match(task.curriculumNotice ?? '', /No Specific Learning Outcomes are seeded/)
  assert.match(task.action, /Re-teach the prerequisite/) // falls back to the generic template, honestly
})

test('buildAdaptiveTask: with real learning outcomes, the action is built from the actual outcome text, and there is no notice', () => {
  const p = projection({ level: 2 })
  const curriculum = {
    strandId: 's1', strandTitle: 'NUMBERS', subStrandId: 'ss1', subStrandTitle: 'Fractions',
    learningOutcomes: ['Add fractions with different denominators'], unavailableFields: ['core_competencies'] as const,
  }
  const task = buildAdaptiveTask('learner-1', 'Amina', SUBJECT, p, { curriculumContext: curriculum })
  assert.equal(task.curriculumNotice, null)
  assert.match(task.action, /Add fractions with different denominators/)
  assert.match(task.action, /Fractions/)
  assert.match(task.observation, /NUMBERS — Fractions/)
})

// ── neutralGroupLabel — must never leak internal taxonomy to a learner ────────

test('neutralGroupLabel: no internal group name appears in any neutral label', () => {
  const internalNames = ['critical_gap', 'prerequisite_gap', 'concept_confusion', 'on_track', 'insufficient_data']
  for (const g of internalNames) {
    const label = neutralGroupLabel(g as never)
    for (const name of internalNames) {
      assert.ok(!label.includes(name), `neutral label "${label}" leaked internal name "${name}"`)
    }
  }
})

// ── buildClassRecommendations ──────────────────────────────────────────────────

test('buildClassRecommendations: sorts learners into the correct groups', () => {
  const learners = [
    { learnerId: 'l1', learnerName: 'Critical Learner', projection: projection({ level: 1, riskSeverity: 'critical' }) },
    { learnerId: 'l2', learnerName: 'Gap Learner', projection: projection({ level: 2 }) },
    { learnerId: 'l3', learnerName: 'Confused Learner', projection: projection({ level: 3 }) },
    { learnerId: 'l4', learnerName: 'On Track Learner', projection: projection({ level: 4 }) },
    { learnerId: 'l5', learnerName: 'No Data Learner', projection: projection({ level: null }) },
  ]

  const groups = buildClassRecommendations(learners, SUBJECT)

  assert.equal(groups.critical_gap.length, 1)
  assert.equal(groups.critical_gap[0].learnerId, 'l1')
  assert.equal(groups.prerequisite_gap.length, 1)
  assert.equal(groups.prerequisite_gap[0].learnerId, 'l2')
  assert.equal(groups.concept_confusion.length, 1)
  assert.equal(groups.on_track.length, 1)
  assert.equal(groups.insufficient_data.length, 1)
})

test('buildClassRecommendations: is deterministic for identical input', () => {
  const learners = [{ learnerId: 'l1', learnerName: 'A', projection: projection({ level: 3 }) }]
  const first = buildClassRecommendations(learners, SUBJECT)
  const second = buildClassRecommendations(learners, SUBJECT)
  assert.deepEqual(first, second)
})
