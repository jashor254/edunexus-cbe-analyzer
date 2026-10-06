// lib/career/careerProvenance.test.ts
//
// FIX 6 — career-knowledge provenance. Proves that hand-curated knowledge,
// human-reviewed AI drafts and unreviewed AI drafts can never be conflated:
//   * assessCareerKnowledge: human keeps its original labels; source_cited is
//     dated but always says a person reviewed an AI draft; ai_drafted and
//     unrecorded (NULL) provenance are never fresh at any age.
//   * publishReviewedCareer records 'source_cited' even if the AI payload
//     claims otherwise.
//   * generateCareerProfile drafts arrive as 'ai_drafted' (proved at source by
//     the architecture guard; the draft object is asserted here via publish).
//   * markCareerHumanVerified needs a reviewer and a note, and records 'human'.
//   * composeCareer's Blueprint note names the real cause of an unknown state.
//
// No real DB, no real AI call — repositories, careerEngine, rate limiting and
// AI logging are mocked at the module boundary.
//
// Run: npm test -- lib/career/careerProvenance.test.ts

import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import { assessCareerKnowledge, needsReverification } from './knowledgeLifecycle'
import type { CareerKnowledgeState } from './knowledgeLifecycle'
import { composeCareer } from '../learnerBlueprint/composeCareer'
import type { CareerAccessResult } from '../learnerBlueprint/careerAccess'
import type { StudentId } from '@/lib/core/identityTypes'

// ── Module mocks for the knowledgeRequests write paths ───────────────────────

let upserted: Record<string, unknown>[] = []
let verifiedCalls: { slug: string; verifiedAt: string; note: string }[] = []
let reviewRow: { id: string; status: string; payload: Record<string, unknown> | null } | null = null

mock.module('./careerEngine', {
  namedExports: {
    slugify: (s: string) => s.toLowerCase(),
    getCareerBySlug: async () => null,
    generateCareerProfile: async () => { throw new Error('not used here') },
  },
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      careers: {
        findCareerReviewById: async () => reviewRow,
        upsertCareer: async (row: Record<string, unknown>) => { upserted.push(row); return row },
        markCareerReviewDecided: async () => undefined,
        markCareerKnowledgeVerified: async (slug: string, verifiedAt: string, note: string) => {
          verifiedCalls.push({ slug, verifiedAt, note })
        },
      },
    },
  },
})

mock.module('@/lib/ai/rateLimit', { namedExports: { checkDailyCallLimit: async () => ({ allowed: true }) } })
mock.module('@/lib/ai/logger', { namedExports: { logAICall: async () => undefined } })

let publishReviewedCareer: typeof import('./knowledgeRequests').publishReviewedCareer
let markCareerHumanVerified: typeof import('./knowledgeRequests').markCareerHumanVerified
before(async () => {
  ;({ publishReviewedCareer, markCareerHumanVerified } = await import('./knowledgeRequests'))
})

// ── assessCareerKnowledge ─────────────────────────────────────────────────────

const NOW = new Date('2026-10-06T12:00:00.000Z')
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString()

test('human: original time-based labels, provenance recorded', () => {
  const s = assessCareerKnowledge(daysAgo(10), NOW, 'human')
  assert.equal(s.provenance, 'human')
  assert.equal(s.freshness, 'fresh')
  assert.equal(s.asOfLabel, assessCareerKnowledge(daysAgo(10), NOW).asOfLabel, 'human must keep the existing wording')
})

test('source_cited: dated freshness kept, but always labelled as a reviewed AI draft', () => {
  const s = assessCareerKnowledge(daysAgo(10), NOW, 'source_cited')
  assert.equal(s.provenance, 'source_cited')
  assert.equal(s.freshness, 'fresh')
  assert.match(s.asOfLabel, /^Drafted with AI and reviewed by a person\./)
  const stale = assessCareerKnowledge(daysAgo(400), NOW, 'source_cited')
  assert.equal(stale.freshness, 'stale')
  assert.match(stale.asOfLabel, /^Drafted with AI and reviewed by a person\..*out of date/)
})

test('ai_drafted: never fresh at any age, never present tense, no verification date claimed', () => {
  for (const age of [0, 1, 30, 120, 300, 1000]) {
    const s = assessCareerKnowledge(daysAgo(age), NOW, 'ai_drafted')
    assert.equal(s.freshness, 'unknown', `ai_drafted read as ${s.freshness} at age ${age}`)
    assert.equal(s.requiresHistoricalFraming, true)
    assert.equal(s.verifiedAt, null, 'a draft date is not a verification date')
    assert.match(s.asOfLabel, /^AI-drafted, not yet confirmed by a person \(as of /)
  }
  const undated = assessCareerKnowledge(null, NOW, 'ai_drafted')
  assert.match(undated.asOfLabel, /^AI-drafted, not yet confirmed by a person — /)
})

test('unrecorded (NULL) provenance: never fresh, says who-confirmed is unknown, keeps the last-updated date', () => {
  const s = assessCareerKnowledge(daysAgo(5), NOW, null)
  assert.equal(s.provenance, 'unrecorded')
  assert.equal(s.freshness, 'unknown')
  assert.equal(s.requiresHistoricalFraming, true)
  assert.match(s.asOfLabel, /^We have no record of who confirmed these figures \(last updated .*\d{4}\)/)
})

test('the three provenance classes cannot be conflated: distinct labels for the same date', () => {
  const date = daysAgo(10)
  const labels = (['human', 'source_cited', 'ai_drafted', null] as const)
    .map(p => assessCareerKnowledge(date, NOW, p).asOfLabel)
  assert.equal(new Set(labels).size, labels.length, `labels collided: ${JSON.stringify(labels)}`)
})

test('omitting provenance gives the time-only assessment (existing behaviour, provenance null)', () => {
  const s = assessCareerKnowledge(daysAgo(10), NOW)
  assert.equal(s.provenance, null)
  assert.equal(s.freshness, 'fresh')
})

test('needsReverification: ai_drafted and unrecorded are always due; recent human is not', () => {
  assert.equal(needsReverification(daysAgo(1), NOW, 'ai_drafted'), true)
  assert.equal(needsReverification(daysAgo(1), NOW, null), true)
  assert.equal(needsReverification(daysAgo(1), NOW, 'human'), false)
})

// ── Write paths ───────────────────────────────────────────────────────────────

test('publishReviewedCareer records source_cited even when the AI payload claims human', async () => {
  upserted = []
  reviewRow = {
    id: 'r1', status: 'pending',
    payload: { slug: 'x', title: 'X', verification_source: 'human', knowledge_verified_at: '2020-01-01T00:00:00Z' },
  }
  await publishReviewedCareer('r1', 'reviewer-1', 'Checked against KNBS 2026 survey')
  assert.equal(upserted.length, 1)
  assert.equal(upserted[0].verification_source, 'source_cited')
  assert.notEqual(upserted[0].knowledge_verified_at, '2020-01-01T00:00:00Z', 'payload cannot supply its own verification date')
})

test('markCareerHumanVerified records via the human stamp with reviewer and note', async () => {
  verifiedCalls = []
  await markCareerHumanVerified('  actuary  ', 'reviewer-1', '  Checked salary bands against IRA 2026 report ')
  assert.equal(verifiedCalls.length, 1)
  assert.equal(verifiedCalls[0].slug, 'actuary')
  assert.match(verifiedCalls[0].note, /^Verified by reviewer-1 — Checked salary bands against IRA 2026 report$/)
})

test('markCareerHumanVerified refuses an empty note, a missing reviewer, or a blank slug', async () => {
  verifiedCalls = []
  await assert.rejects(() => markCareerHumanVerified('actuary', 'reviewer-1', '   '), /verification note is required/)
  await assert.rejects(() => markCareerHumanVerified('actuary', '', 'note'), /named reviewer is required/)
  await assert.rejects(() => markCareerHumanVerified('  ', 'reviewer-1', 'note'), /slug is required/)
  assert.equal(verifiedCalls.length, 0)
})

// ── Blueprint note (composeCareer) ────────────────────────────────────────────

function accessWith(knowledge: CareerKnowledgeState): CareerAccessResult {
  return {
    summary: {
      careerCluster: 'Engineering & Technology', strengthProfile: 's', futureDirection: 'f',
      aiOutlook: null, confidence: 'Medium', version: null, doorsPreview: null,
      aiChangeSummary: null, humanAdvantageSummary: null, explorationSuggestions: null, knowledge,
    },
    error: null,
  }
}

test('composeCareer names the real cause of an unknown freshness state', async () => {
  const sid = 'student-1' as StudentId
  const drafted = await composeCareer(sid, accessWith(assessCareerKnowledge(daysAgo(3), NOW, 'ai_drafted')))
  assert.ok(drafted.data?.notes.some(n => /drafted with AI and have not yet been confirmed/.test(n)))

  const unrecorded = await composeCareer(sid, accessWith(assessCareerKnowledge(daysAgo(3), NOW, null)))
  assert.ok(unrecorded.data?.notes.some(n => /no record of who confirmed/.test(n)))

  const human = await composeCareer(sid, accessWith(assessCareerKnowledge(daysAgo(3), NOW, 'human')))
  assert.ok(!human.data?.notes.some(n => /no record|drafted with AI/.test(n)), 'fresh human knowledge needs no caveat note')
})
