// lib/assignments/printRoutes.pure.test.ts
//
// Pure/mocked unit coverage for the printable-routes routing rule —
// runnable with no live database (unlike printRoutes.http.integration.test.ts,
// which needs a real server + Supabase project). Mirrors
// lib/learnerBlueprint/composeRisk.test.ts's mock.module pattern.
//
// Run: npx tsx --env-file=.env.local --test --experimental-test-module-mocks lib/assignments/printRoutes.pure.test.ts
import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'

let shouldThrow = false

mock.module('@/lib/projection/recompute', {
  namedExports: {
    recomputeLearnerProjection: async (): Promise<LearnerIntelligenceProjection> => {
      if (shouldThrow) throw new Error('synthetic Projection failure')
      // A learner with no academic evidence at all — classifyGroup resolves
      // this to 'insufficient_data', the routing rule's other "-> core" case.
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
    },
  },
})

let mapGroupToRoute: typeof import('./printRoutes').mapGroupToRoute
let suggestRouteForLearner: typeof import('./printRoutes').suggestRouteForLearner

before(async () => {
  ;({ mapGroupToRoute, suggestRouteForLearner } = await import('./printRoutes'))
})

test('mapGroupToRoute: the locked routing matrix, exhaustively', () => {
  assert.equal(mapGroupToRoute('critical_gap'), 'guided')
  assert.equal(mapGroupToRoute('prerequisite_gap'), 'guided')
  assert.equal(mapGroupToRoute('concept_confusion'), 'core')
  assert.equal(mapGroupToRoute('on_track'), 'extension')
  assert.equal(mapGroupToRoute('insufficient_data'), 'core')
  // "failed projection lookup" is represented as null by the caller.
  assert.equal(mapGroupToRoute(null), 'core')
})

test('suggestRouteForLearner: a failed Projection lookup is caught and routed to Core, never Guided, with no evidence band fabricated', async () => {
  shouldThrow = true
  try {
    const suggestion = await suggestRouteForLearner({ id: 'learner-1', name: 'Test Learner' }, 'mathematics', null)
    assert.equal(suggestion.route, 'core')
    assert.equal(suggestion.evidenceBand, null)
    assert.equal(suggestion.evidenceNote, null)
  } finally {
    shouldThrow = false
  }
})

test('suggestRouteForLearner: zero evidence (insufficient_data, not a thrown error) also routes to Core', async () => {
  const suggestion = await suggestRouteForLearner({ id: 'learner-1', name: 'Test Learner' }, 'mathematics', null)
  assert.equal(suggestion.route, 'core')
  assert.equal(suggestion.evidenceBand, 'insufficient_data')
})
