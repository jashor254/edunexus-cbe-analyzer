// lib/career/reviewPublishCorrectness.integration.test.ts
//
// Phase 9.1.5 — proves the real publishReviewedCareer()/rejectReviewedCareer()
// code paths (not raw SQL) against a disposable local Docker database, after
// 20260824130531_career_review_queue_status_published.sql. Before that
// migration, the first assertion below reproduced a guaranteed CHECK-
// constraint violation on every publish; see
// docs/architecture/phase9-1-5-review-publish-correctness.md for the raw-SQL
// reproduction this test's application-level equivalent is built on.
//
// Uses BOTH test clients deliberately: createTestServiceClient() (this
// file's own `db`, for setup/verification only) and the ordinary repos
// barrel — repos.careers.* and publishReviewedCareer()/rejectReviewedCareer()
// go through createServiceClient() (utils/supabase/service.ts), which is
// real application code and must ALSO be pointed at the disposable target
// for this test to exercise anything real. See this file's run command.
//
// Run with BOTH pairs of Supabase env vars pointed at local Docker
// (never .env.local's production-shaped NEXT_PUBLIC_SUPABASE_URL):
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   TEST_SUPABASE_URL=http://127.0.0.1:54321 \
//   TEST_SUPABASE_SERVICE_ROLE_KEY=<local service_role key> \
//   TEST_SUPABASE_PROJECT_REF=local-docker \
//   npx tsx --experimental-test-module-mocks --test lib/career/reviewPublishCorrectness.integration.test.ts
//
// Deliberately NOT in scripts/standard-tests.json or scripts/deep-tests.json
// yet — it needs both credential pairs pointed at a disposable target
// simultaneously, which today's `npm run test:deep` harness does not set up
// (it only exports TEST_SUPABASE_* to the test process's own client, not to
// the ordinary NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY pair that
// repos.* actually reads). Run manually as shown above until that's true.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { publishReviewedCareer, rejectReviewedCareer, requestCareerKnowledge } from './knowledgeRequests'
import type { Career } from './types'

const SYNTHETIC_MARKER = 'synthetic-9-1-5-test'
const db = createServiceClient()

let reviewerId: string
const createdCareerSlugs: string[] = []
const createdQueueSlugs: string[] = []

before(async () => {
  const email = `${SYNTHETIC_MARKER}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`reviewer user creation failed: ${error?.message}`)
  reviewerId = data.user.id
})

after(async () => {
  if (createdCareerSlugs.length) await db.from('careers').delete().in('slug', createdCareerSlugs)
  if (createdQueueSlugs.length) await db.from('career_review_queue').delete().in('slug', createdQueueSlugs)
  if (reviewerId) await db.auth.admin.deleteUser(reviewerId)
})

type GeneratedProfile = Omit<Career, 'id' | 'created_at' | 'updated_at'>

function fakeProfile(slug: string, title: string): GeneratedProfile {
  return {
    slug, title, category: 'business', description: 'A synthetic test career profile.',
    ai_impact: null, ai_impact_level: 'medium', kenya_market_outlook: 'x', salary_range_kes: null,
    pathway: 'Social Sciences', required_subjects: [], subject_importance: {}, skill_timeline: [],
    future_skills: [], kenya_examples: null, disclaimer: 'Synthetic test data.',
  } as unknown as GeneratedProfile
}

async function makePendingReview(slug: string, title: string): Promise<string> {
  createdQueueSlugs.push(slug)
  await repos.careers.enqueueCareerReview({
    slug, career_name: title, payload: fakeProfile(slug, title) as unknown as Record<string, unknown>,
    submitted_by: null, origin: 'learner_search',
  })
  const { data } = await db.from('career_review_queue').select('id').eq('slug', slug).single()
  return data!.id as string
}

test('publish writes the canonical career AND marks the queue row published (the reproduced bug is fixed)', async () => {
  const slug = `${SYNTHETIC_MARKER}-publish-ok`
  createdCareerSlugs.push(slug)
  const reviewId = await makePendingReview(slug, 'Publish OK Career')

  const published = await publishReviewedCareer(reviewId, reviewerId, 'looks good')
  assert.equal(published.slug, slug)
  assert.ok(published.knowledge_verified_at, 'publish must stamp knowledge_verified_at')

  const { data: queueRow } = await db.from('career_review_queue')
    .select('status, reviewed_at, reviewed_by').eq('slug', slug).single()
  assert.equal(queueRow!.status, 'published')
  assert.ok(queueRow!.reviewed_at)
  assert.equal(queueRow!.reviewed_by, reviewerId)
})

test('publishing the same review twice is a safe explicit error, never a duplicate career', async () => {
  const slug = `${SYNTHETIC_MARKER}-idempotent`
  createdCareerSlugs.push(slug)
  const reviewId = await makePendingReview(slug, 'Idempotent Career')

  await publishReviewedCareer(reviewId, reviewerId, null)
  await assert.rejects(() => publishReviewedCareer(reviewId, reviewerId, null), /already published/)

  const { data: careersRows } = await db.from('careers').select('id').eq('slug', slug)
  assert.equal(careersRows!.length, 1, 'exactly one canonical row — no duplicate from the second attempt')
})

test('reject keeps the career out of canonical `careers`', async () => {
  const slug = `${SYNTHETIC_MARKER}-rejected`
  const reviewId = await makePendingReview(slug, 'Rejected Career')

  await rejectReviewedCareer(reviewId, reviewerId, 'not a real career')

  const { data: careerRow } = await db.from('careers').select('id').eq('slug', slug).maybeSingle()
  assert.equal(careerRow, null)
  const { data: queueRow } = await db.from('career_review_queue').select('status').eq('slug', slug).single()
  assert.equal(queueRow!.status, 'rejected')
})

test('a still-pending review never appears in the real canonical-search input (provisional/canonical boundary holds)', async () => {
  const slug = `${SYNTHETIC_MARKER}-not-matchable`
  await makePendingReview(slug, 'Not Matchable Career')

  // getAllCareers()/searchCareers() are the ONLY inputs capabilityMatchEngine
  // and the Explorer/search API ever see — proving the pending row is absent
  // from this is proving it cannot reach the matcher, without needing to
  // read career_review_queue from inside matching code (which would defeat
  // the point of the boundary).
  const all = await repos.careers.getAllCareers()
  assert.ok(!all.some(c => c.slug === slug))
})

test('after publish, the same query now resolves as canonical — no further AI generation needed', async () => {
  const slug = `${SYNTHETIC_MARKER}-findable`
  createdCareerSlugs.push(slug)
  const title = 'Findable After Publish Career'
  const reviewId = await makePendingReview(slug, title)
  await publishReviewedCareer(reviewId, reviewerId, null)

  const result = await requestCareerKnowledge(title, null)
  assert.equal(result.status, 'known')
})
