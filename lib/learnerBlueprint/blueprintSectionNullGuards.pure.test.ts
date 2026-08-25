// lib/learnerBlueprint/blueprintSectionNullGuards.pure.test.ts
//
// Blueprint Section Access Boundary Fix — split out of
// composeBlueprint.pure.test.ts. composeAcademicRecord.ts and
// composeGrowthTimeline.ts retain a real, load-bearing internal fallback to
// recomputeLearnerProjection() for direct callers that call them with only
// a studentId (composeGrowthTimeline.test.ts's own suite,
// composeRisk.test.ts, lib/intelligence/crossSurfaceConsistency.integration.test.ts)
// — removing it would mean caller churn beyond this seam, so per the
// Learner Blueprint Pure Composition Boundary Audit it was left as-is.
//
// These two tests only ever exercise the early-return null-guard branch,
// which never calls recomputeLearnerProjection() — mocking the module
// (the same node:test technique composeGrowthTimeline.test.ts and
// composeRisk.test.ts already use, and that is already vetted for STANDARD)
// both lets this run zero-env and proves the null path genuinely never
// reaches the fetch call: the mock throws if invoked.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/learnerBlueprint/blueprintSectionNullGuards.pure.test.ts

import { before, mock, test } from 'node:test'
import assert from 'node:assert/strict'

mock.module('@/lib/projection/recompute', {
  namedExports: {
    recomputeLearnerProjection: async () => {
      throw new Error('recomputeLearnerProjection must never be called for a null legacyStudentId')
    },
  },
})

let composeGrowthTimeline: typeof import('./composeGrowthTimeline').composeGrowthTimeline
let composeAcademicRecord: typeof import('./composeAcademicRecord').composeAcademicRecord

before(async () => {
  ;({ composeGrowthTimeline } = await import('./composeGrowthTimeline'))
  ;({ composeAcademicRecord } = await import('./composeAcademicRecord'))
})

test('composeGrowthTimeline is unavailable when no legacy student is bridged (no DB call attempted)', async () => {
  const section = await composeGrowthTimeline(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
  assert.match(section.unavailableReason ?? '', /bridged/)
})

test('composeAcademicRecord is unavailable when no legacy student is bridged ("missing assessments")', async () => {
  const section = await composeAcademicRecord(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
  assert.match(section.unavailableReason ?? '', /bridged/)
})
