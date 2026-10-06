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

// ── FIX 6 — AI may draft, AI may request review, AI may not self-verify ──────
//
// Source-text guards for the provenance boundary added by
// supabase/migrations/20261006120000_careers_verification_source.sql. They
// prove what a live DB test can't cheaply: that no AI path can stamp a
// verified provenance, and that the only human-verify stamp is reachable only
// through a named-reviewer function behind the admin gate.

/** Drop // line comments and /* block comments *\/ so guards match code, never prose. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '')
}

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  assert.ok(from >= 0, `marker not found: ${start}`)
  const to = source.indexOf(end, from + start.length)
  return to >= 0 ? source.slice(from, to) : source.slice(from)
}

test('Guard P (provenance) — generateCareerProfile drafts declare ai_drafted and never claim a verification', () => {
  const body = codeOnly(sliceBetween(read('lib/career/careerEngine.ts'), 'export async function generateCareerProfile', '// ── READ'))
  assert.ok(/verification_source:\s*'ai_drafted'/.test(body), 'AI drafts must declare themselves ai_drafted')
  assert.ok(!/verification_source:\s*'(human|source_cited)'/.test(body), 'an AI draft must never claim human/source_cited')
  assert.ok(!/knowledge_verified_at\s*:/.test(body), 'an AI draft must never carry a verification date')
  assert.ok(!body.includes('markCareerKnowledgeVerified('), 'an AI draft must never call the human stamp')
})

test('Guard P (provenance) — requestCareerKnowledge (the learner/AI path) never writes the corpus or stamps verification', () => {
  const body = codeOnly(sliceBetween(read('lib/career/knowledgeRequests.ts'), 'export async function requestCareerKnowledge', 'export async function publishReviewedCareer'))
  assert.ok(!body.includes('upsertCareer('), 'requestCareerKnowledge must not write the corpus')
  assert.ok(!body.includes('markCareerKnowledgeVerified('), 'requestCareerKnowledge must not call the human stamp')
  assert.ok(!/knowledge_verified_at\s*:/.test(body), 'requestCareerKnowledge must not set a verification date')
  assert.ok(!/verification_source\s*:/.test(body), 'requestCareerKnowledge must not set provenance')
})

test('Guard P (provenance) — publishReviewedCareer sets source_cited AFTER spreading the payload (payload cannot override it)', () => {
  const body = codeOnly(sliceBetween(read('lib/career/knowledgeRequests.ts'), 'export async function publishReviewedCareer', 'export async function markCareerHumanVerified'))
  const spreadAt = body.indexOf('...(review.payload')
  const provenanceAt = body.search(/verification_source:\s*'source_cited'/)
  assert.ok(spreadAt >= 0 && provenanceAt > spreadAt, 'source_cited must be assigned after the payload spread')
})

test('Guard P (provenance) — the human stamp is called only from markCareerHumanVerified, which requires a named reviewer', () => {
  const lib = codeOnly(read('lib/career/knowledgeRequests.ts'))
  assert.equal((lib.match(/markCareerKnowledgeVerified\(/g) ?? []).length, 1, 'exactly one caller of the human stamp')
  const sig = lib.match(/export async function markCareerHumanVerified\(([^)]*)\)/)
  assert.ok(sig && sig[1].includes('reviewerId'), 'markCareerHumanVerified must take a reviewerId')
  for (const file of [
    'lib/career/careerEngine.ts',
    'app/api/career/search/route.ts',
    'app/api/career/[slug]/route.ts',
    'app/api/admin/career/review/route.ts',
  ]) {
    assert.ok(!codeOnly(read(file)).includes('markCareerKnowledgeVerified('), `${file} must not call the human stamp`)
  }
})

test('Guard P (provenance) — the verify route authenticates through the admin gate before verifying', () => {
  const route = read('app/api/admin/career/verify/route.ts')
  const gateAt = route.indexOf('await requireGrowthUser(supabase)')
  const verifyAt = route.indexOf('await markCareerHumanVerified(')
  assert.ok(gateAt >= 0, 'verify route must use requireGrowthUser')
  assert.ok(verifyAt > gateAt, 'the gate must run before any verification')
})

test('Guard P (provenance) — the production freshness caller always passes provenance', () => {
  const orchestration = codeOnly(read('lib/learnerIntelligence/careerIntelligenceOrchestration.ts'))
  const callLines = orchestration.split('\n').filter(line => line.includes('assessCareerKnowledge('))
  assert.ok(callLines.length >= 1, 'expected the Blueprint summary to assess career knowledge')
  for (const line of callLines) {
    assert.ok(line.includes('verification_source'), `freshness call omits provenance: ${line.trim()}`)
  }
})
