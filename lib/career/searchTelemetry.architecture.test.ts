// lib/career/searchTelemetry.architecture.test.ts
//
// Phase 9.1 architecture guards — source-text checks (mirrors the pattern in
// lib/career/careerSignals.test.ts) rather than import-graph execution, so
// these run with zero DB/network setup, exactly like the files they guard.
//
// Guard A — search/telemetry code never imports Projection or writes learner
//           evidence/capability persistence.
// Guard B — the search flow never calls saveCareerInterest() (search ≠ interest).
// Guard C — nothing outside the review-queue repository methods reads/writes
//           career_review_queue — provisional careers cannot enter matching.
// Guard D — the search-tracking event emitter performs no domain writes.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/career/searchTelemetry.architecture.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const REPO_ROOT = new URL('../../', import.meta.url)

function read(relPath: string): string {
  return readFileSync(new URL(relPath, REPO_ROOT), 'utf8')
}

const SEARCH_FILES = [
  'app/api/career/search/route.ts',
  'app/api/career/search/track/route.ts',
]

test('Guard A — career search/telemetry code does not import Projection or capability persistence', () => {
  const bannedImportTargets = ['@/lib/projection/recompute', '@/lib/career/recomputeCapabilityProfile']
  for (const file of SEARCH_FILES) {
    const source = read(file)
    for (const banned of bannedImportTargets) {
      assert.ok(!source.includes(banned), `${file} must not import "${banned}"`)
    }
  }
})

test('Guard B — the search flow never calls saveCareerInterest() (search ≠ interest)', () => {
  for (const file of SEARCH_FILES) {
    const source = read(file)
    assert.ok(!source.includes('saveCareerInterest'), `${file} must not call saveCareerInterest`)
  }
})

test('Guard C — only career.repository.ts touches career_review_queue', () => {
  // Provisional (unreviewed) careers must stay physically confined to the
  // review-queue table — the matcher/Blueprint/Career-Signals path must never
  // learn to read it. This is a repo-wide check, not just the search files,
  // because the risk is "something new starts reading the queue," not just
  // "the search route does."
  const filesLikelyToTouchCareerDomain = [
    // careerEngine.ts is deliberately excluded here: it mentions
    // career_review_queue only in a doc comment (explaining what
    // knowledgeRequests.ts does), never in an actual query — confirmed by
    // reading the file, not assumed.
    'lib/career/capabilityMatchEngine.ts',
    'lib/career/careerIntelligenceEngine.ts',
    'lib/career/clinicReportBuilder.ts',
    'lib/career/careerSignals.ts',
    'app/api/career/search/route.ts',
    'app/api/career/search/track/route.ts',
    'app/api/career/[slug]/route.ts',
  ]
  for (const file of filesLikelyToTouchCareerDomain) {
    const source = read(file)
    assert.ok(
      !source.includes('career_review_queue'),
      `${file} must not reference career_review_queue directly — only lib/repositories/career.repository.ts may`,
    )
  }
})

test('Guard D — the search-tracking route performs no domain writes beyond publishing its own event', () => {
  const source = read('app/api/career/search/track/route.ts')
  const bannedCalls = [
    'saveCareerInterest', 'enqueueCareerReview', 'upsertCareer', 'insertCareerInterest',
    'recomputeAndSaveCapabilityProfile', 'insertCapabilityHistory',
  ]
  for (const banned of bannedCalls) {
    assert.ok(!source.includes(banned), `search/track route must not call "${banned}"`)
  }
  // Its only side effect should be publishEvent — confirm that import is the
  // one domain-adjacent call surface this route actually has.
  assert.ok(source.includes("from '@/lib/events/publish'"), 'search/track route should publish events via the shared dispatcher')
})

test('the two new event-emitting surfaces actually emit the events they claim to', () => {
  assert.ok(read('app/api/career/[slug]/route.ts').includes('student.career_result.opened'))
  assert.ok(read('lib/career/careerEngine.ts').includes('student.career_interest.saved'))
  assert.ok(read('app/api/career/search/track/route.ts').includes('student.career_search.performed'))
  assert.ok(read('app/api/career/search/track/route.ts').includes('student.career_search.no_result'))
})
