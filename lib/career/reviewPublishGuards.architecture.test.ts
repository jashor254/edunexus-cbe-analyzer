// lib/career/reviewPublishGuards.architecture.test.ts
//
// Phase 9.1.5 — narrow, source-text guards for the review→publish boundary.
// Guard A (application review statuses are DB-compatible) is deliberately
// NOT duplicated here as a hardcoded allowed-list — it's proven live,
// against the real constraint, by lib/career/reviewPublishCorrectness.
// integration.test.ts's publish/reject tests (a source-text copy of the
// allowed-values list would just drift from the schema the same way the
// original bug did). This file covers what a live DB test can't cheaply
// prove: that nothing outside the two designated functions can perform a
// queue→canonical transition, and that the matcher never reads the queue.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/career/reviewPublishGuards.architecture.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const REPO_ROOT = new URL('../../', import.meta.url)
function read(relPath: string): string {
  return readFileSync(new URL(relPath, REPO_ROOT), 'utf8')
}

test('Guard B — markCareerReviewDecided (the only queue→canonical status transition) is called from exactly publishReviewedCareer/rejectReviewedCareer', () => {
  const source = read('lib/career/knowledgeRequests.ts')
  const calls = source.match(/markCareerReviewDecided\(/g) ?? []
  assert.equal(calls.length, 2, 'expected exactly one call inside publishReviewedCareer and one inside rejectReviewedCareer')

  // And nowhere else in the domain calls it directly — the admin route is
  // the only caller-of-the-callers, never bypassing knowledgeRequests.ts.
  const otherFiles = [
    'app/api/career/search/route.ts',
    'app/api/career/search/track/route.ts',
    'app/api/career/[slug]/route.ts',
    'lib/career/careerEngine.ts',
  ]
  for (const file of otherFiles) {
    assert.ok(!read(file).includes('markCareerReviewDecided'), `${file} must not call markCareerReviewDecided directly`)
  }
})

test('Guard B — the admin review route is the only caller of publishReviewedCareer/rejectReviewedCareer', () => {
  const adminRoute = read('app/api/admin/career/review/route.ts')
  assert.ok(adminRoute.includes('publishReviewedCareer'))
  assert.ok(adminRoute.includes('rejectReviewedCareer'))

  const otherFiles = [
    'app/api/career/search/route.ts',
    'app/api/career/search/track/route.ts',
    'app/api/career/[slug]/route.ts',
  ]
  for (const file of otherFiles) {
    const source = read(file)
    assert.ok(!source.includes('publishReviewedCareer'), `${file} must not call publishReviewedCareer`)
    assert.ok(!source.includes('rejectReviewedCareer'), `${file} must not call rejectReviewedCareer`)
  }
})

test('Guard C — nothing that reads canonical careers for matching/search also reads career_review_queue', () => {
  const files = [
    // careerEngine.ts mentions career_review_queue only in a doc comment
    // explaining what knowledgeRequests.ts does — confirmed, never in a query.
    'lib/career/capabilityMatchEngine.ts',
  ]
  for (const file of files) {
    assert.ok(!read(file).includes('career_review_queue'), `${file} must not reference career_review_queue`)
  }
})

test('Guard D — publish still requires an explicit reviewerId and reviewId argument (no zero-argument/automatic publish path exists)', () => {
  const source = read('lib/career/knowledgeRequests.ts')
  const sig = source.match(/export async function publishReviewedCareer\(([^)]*)\)/)
  assert.ok(sig, 'publishReviewedCareer signature not found')
  assert.ok(sig![1].includes('reviewId'))
  assert.ok(sig![1].includes('reviewerId'))
})
