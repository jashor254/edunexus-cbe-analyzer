import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'

let projectionBehavior: 'none' | 'normal' | 'flagged' = 'none'

mock.module('@/lib/projection/recompute', {
  namedExports: {
    recomputeLearnerProjection: async (): Promise<LearnerIntelligenceProjection> => {
      if (projectionBehavior === 'none') {
        return {
          learnerId: 'learner-1',
          academic: null,
          capability: null,
          knowledge: null,
          behaviour: null,
          growth: null,
          risk: null,
          completeness: null,
        }
      }

      if (projectionBehavior === 'normal') {
        return {
          learnerId: 'learner-1',
          academic: null,
          capability: null,
          knowledge: null,
          behaviour: null,
          growth: null,
          risk: {
            value: { overallRiskLevel: 'normal', flags: [] },
            supportingEvidenceIds: ['e1', 'e2'],
            confidence: 72,
            coverage: {
              evidenceCount: 2,
              evidenceDiversity: 1,
              latestEvidenceAt: '2026-07-20T00:00:00.000Z',
              oldestEvidenceAt: '2026-06-20T00:00:00.000Z',
              freshnessDays: 3,
            },
            lastComputed: '2026-07-23T10:00:00.000Z',
            projectionVersion: 'risk-v1',
          },
          completeness: null,
        }
      }

      return {
        learnerId: 'learner-1',
        academic: null,
        capability: null,
        knowledge: null,
        behaviour: null,
        growth: null,
        risk: {
          value: {
            overallRiskLevel: 'critical',
            flags: [{
              subject: 'Mathematics',
              reason: 'Below Expectation in Mathematics and declining from prior evidence',
              severity: 'critical',
              evidenceIds: ['e1', 'e2'],
            }],
          },
          supportingEvidenceIds: ['e1', 'e2'],
          confidence: 84,
          coverage: {
            evidenceCount: 2,
            evidenceDiversity: 2,
            latestEvidenceAt: '2026-07-20T00:00:00.000Z',
            oldestEvidenceAt: '2026-06-20T00:00:00.000Z',
            freshnessDays: 3,
          },
          lastComputed: '2026-07-23T10:00:00.000Z',
          projectionVersion: 'risk-v1',
        },
        completeness: null,
      }
    },
  },
})

let composeRisk: typeof import('./composeRisk').composeRisk

before(async () => {
  ;({ composeRisk } = await import('./composeRisk'))
})

test('composeRisk is unavailable when no legacy bridge exists', async () => {
  const section = await composeRisk(null)
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /bridged/)
})

test('composeRisk is unavailable when projection has no risk evidence', async () => {
  projectionBehavior = 'none'
  const section = await composeRisk('legacy-1')
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /risk exposure/i)
})

test('composeRisk returns an available normal state when evidence supports no active flags', async () => {
  projectionBehavior = 'normal'
  const section = await composeRisk('legacy-1')
  assert.equal(section.status, 'available')
  assert.equal(section.data?.overallRiskLevel, 'normal')
  assert.deepEqual(section.data?.flags, [])
  assert.equal(section.data?.confidence, 72)
})

test('composeRisk preserves level, flags, evidence references, confidence, coverage, and freshness metadata', async () => {
  projectionBehavior = 'flagged'
  const section = await composeRisk('legacy-1')
  assert.equal(section.status, 'available')
  assert.equal(section.data?.overallRiskLevel, 'critical')
  assert.equal(section.data?.flags[0].reason, 'Below Expectation in Mathematics and declining from prior evidence')
  assert.deepEqual(section.data?.flags[0].evidenceIds, ['e1', 'e2'])
  assert.equal(section.data?.coverage.freshnessDays, 3)
  assert.equal(section.data?.lastComputed, '2026-07-23T10:00:00.000Z')
})
