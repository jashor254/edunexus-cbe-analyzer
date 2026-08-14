import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'
import { asLearnerId, asStudentId, type LearnerId, type StudentId } from '@/lib/core/identityTypes'

let projectionBehavior: 'none' | 'insufficient' | 'rich' = 'none'

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

      if (projectionBehavior === 'insufficient') {
        return {
          learnerId: 'learner-1',
          academic: null,
          capability: null,
          knowledge: null,
          behaviour: null,
          growth: {
            value: {
              trend: 'insufficient_data',
              sourceSubject: null,
              earliestScore: null,
              latestScore: null,
              delta: null,
              windowStart: null,
              windowEnd: null,
              bySubject: {},
            },
            supportingEvidenceIds: ['e1'],
            confidence: 42,
            coverage: {
              evidenceCount: 1,
              evidenceDiversity: 1,
              latestEvidenceAt: '2026-07-01T00:00:00.000Z',
              oldestEvidenceAt: '2026-07-01T00:00:00.000Z',
              freshnessDays: 22,
            },
            lastComputed: '2026-07-23T10:00:00.000Z',
            projectionVersion: 'growth-v1',
          },
          risk: null,
          completeness: null,
        }
      }

      return {
        learnerId: 'learner-1',
        academic: null,
        capability: null,
        knowledge: null,
        behaviour: null,
        growth: {
          value: {
            trend: 'improving',
            sourceSubject: 'mathematics',
            earliestScore: 0.35,
            latestScore: 0.7,
            delta: 0.35,
            windowStart: '2026-01-10T00:00:00.000Z',
            windowEnd: '2026-07-10T00:00:00.000Z',
            bySubject: {
              mathematics: { trend: 'improving', earliestScore: 0.35, latestScore: 0.7, delta: 0.35, windowStart: '2026-01-10T00:00:00.000Z', windowEnd: '2026-07-10T00:00:00.000Z' },
            },
          },
          supportingEvidenceIds: ['e1', 'e2', 'e3'],
          confidence: 81,
          coverage: {
            evidenceCount: 3,
            evidenceDiversity: 2,
            latestEvidenceAt: '2026-07-10T00:00:00.000Z',
            oldestEvidenceAt: '2026-01-10T00:00:00.000Z',
            freshnessDays: 13,
          },
          lastComputed: '2026-07-23T10:00:00.000Z',
          projectionVersion: 'growth-v1',
        },
        risk: null,
        completeness: null,
      }
    },
  },
})

let composeGrowthTimeline: typeof import('./composeGrowthTimeline').composeGrowthTimeline

before(async () => {
  ;({ composeGrowthTimeline } = await import('./composeGrowthTimeline'))
})

test('composeGrowthTimeline is unavailable when no legacy bridge exists', async () => {
  const section = await composeGrowthTimeline(null)
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /bridged/)
})

test('composeGrowthTimeline is unavailable when projection has no growth evidence', async () => {
  projectionBehavior = 'none'
  const section = await composeGrowthTimeline(asStudentId('legacy-1'))
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /scored evidence/i)
})

test('composeGrowthTimeline is unavailable when growth remains insufficient', async () => {
  projectionBehavior = 'insufficient'
  const section = await composeGrowthTimeline(asStudentId('legacy-1'))
  assert.equal(section.status, 'unavailable')
  assert.match(section.unavailableReason ?? '', /at least two scored evidence points/i)
})

test('composeGrowthTimeline preserves trajectory, confidence, and coverage from projection growth', async () => {
  projectionBehavior = 'rich'
  const section = await composeGrowthTimeline(asStudentId('legacy-1'))
  assert.equal(section.status, 'available')
  assert.equal(section.data?.length, 1)
  assert.equal(section.data?.[0].direction, 'improving')
  assert.equal(section.data?.[0].confidence, 81)
  assert.equal(section.data?.[0].coverage.evidenceCount, 3)
  assert.match(section.data?.[0].trajectory ?? '', /35% to 70%/)
})
