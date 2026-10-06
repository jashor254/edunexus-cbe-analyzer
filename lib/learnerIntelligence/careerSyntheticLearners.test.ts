// lib/learnerIntelligence/careerSyntheticLearners.test.ts
//
// FIX 7 — end-to-end deterministic regression suite. Synthetic learners (full
// score histories, lib/testing/careerSyntheticLearners.ts) run through the
// REAL extractor, match engine and orchestration (buildCareerIntelligence /
// resolveFreshCapabilityProfile) against the real curated 18-career seed
// corpus. Only the data sources are mocked: student info, Projection, the
// career store and the cohort loader. No DB, no network, no AI.
//
// Also prints the entrepreneurial-tier base rate across ~20 varied synthetic
// learners — reported, never auto-corrected (FIX 7).
//
// Run: npm test -- lib/learnerIntelligence/careerSyntheticLearners.test.ts

import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Career, CapabilityProfile } from '@/lib/career/types'
import type { SyntheticLearner } from '@/lib/testing/careerSyntheticLearners'

// ── Mocked data sources (the only non-real parts) ────────────────────────────

const learnersById = new Map<string, SyntheticLearner>()
let corpus: Career[] = []

mock.module('@/lib/repositories', { namedExports: { repos: {} } })

mock.module('@/lib/learnerModel', {
  namedExports: {
    getStudentBasicInfo: async (id: string) => {
      const l = learnersById.get(id)
      return l ? { name: l.label, grade: l.grade, school: null, term: 2, year: 2026, current_pathway: l.pathway } : null
    },
  },
})

mock.module('@/lib/projection/recompute', {
  namedExports: {
    recomputeLearnerProjection: async (id: string) => ({ learnerId: id, completeness: null }),
  },
})

mock.module('./projectionAdapters', {
  namedExports: {
    projectionToScoreHistory: (p: { learnerId: string }) => learnersById.get(p.learnerId)?.history ?? [],
  },
})

mock.module('@/lib/career/careerEngine', {
  namedExports: {
    getAllCareersWithCOS: async () => corpus,
    getCareerBySlugWithCOS: async (slug: string) => corpus.find(c => c.slug === slug) ?? null,
    getCapabilityProfile: async () => null,
    getCohortCapabilityProfiles: async () => ({ kind: 'missing', reason: 'synthetic suite — no cohort' }),
  },
})

type Orchestration = typeof import('./careerIntelligenceOrchestration')
type Fixtures = typeof import('@/lib/testing/careerSyntheticLearners')
type Engine = typeof import('@/lib/career/capabilityMatchEngine')
let orch: Orchestration
let fx: Fixtures
let engine: Engine

before(async () => {
  fx = await import('@/lib/testing/careerSyntheticLearners')
  orch = await import('./careerIntelligenceOrchestration')
  engine = await import('@/lib/career/capabilityMatchEngine')
  corpus = fx.syntheticCorpus()
  for (const l of [...fx.SYNTHETIC_LEARNERS, ...fx.variedSeniorCohort()]) learnersById.set(l.id, l)
})

async function profileOf(id: string): Promise<CapabilityProfile> {
  const resolved = await orch.resolveFreshCapabilityProfile(id)
  assert.ok(resolved, `${id} should have a profile`)
  return resolved.profile
}

const STRONG = ['strong', 'exceptional']

// ── The synthetic learners ────────────────────────────────────────────────────

test('corpus sanity: every curated seed career carries capability requirements', () => {
  assert.equal(corpus.length, 18)
  assert.ok(corpus.every(c => c.required_capabilities), 'a seed career is missing required_capabilities')
})

test('consistently top learner: resilience capable (not strong from stability), no alignment above 100%', async () => {
  assert.equal((await profileOf('syn-top-flat')).resilience.level, 'capable')
  const ci = await orch.buildCareerIntelligence('syn-top-flat')
  assert.equal(ci.mode, 'planning')
  assert.ok(ci.matches && ci.matches.length > 0)
  for (const m of ci.matches) assert.ok(m.alignmentPct >= 0 && m.alignmentPct <= 100, `${m.careerSlug} at ${m.alignmentPct}%`)
})

test('recovery learner earns recovery credit; bad-first learner earns less', async () => {
  const recovery = (await profileOf('syn-recovery')).resilience
  const badFirst = (await profileOf('syn-bad-first')).resilience
  assert.ok(STRONG.includes(recovery.level), `recovery read as ${recovery.level}`)
  assert.ok(recovery.evidence.some(e => e.startsWith('Recovered in')))
  assert.ok(badFirst.raw_score < recovery.raw_score)
})

test('single-assessment learner: capped at 65%, Low, caveat present, never primary', async () => {
  const ci = await orch.buildCareerIntelligence('syn-single')
  assert.ok(ci.matches && ci.matches.length > 0)
  for (const m of ci.matches) {
    assert.ok(m.alignmentPct <= 65, `${m.careerSlug} at ${m.alignmentPct}%`)
    assert.notEqual(m.tier, 'primary')
    assert.equal(m.insight.confidence, 'Low')
    assert.match(m.insight.observation, /Confidence is low/)
  }
})

test('learner with no creative subjects: creative is unknown, never a weakness; >50%-unobserved careers are Low', async () => {
  const profile = await profileOf('syn-no-creative')
  assert.equal(profile.creative_thinking.confidence, 0)

  const report = engine.computeCapabilityMatches('syn-no-creative', profile, corpus)
  const all = [...report.primary, ...report.stretch, ...report.alternative]
  for (const m of all) {
    assert.ok(!m.gaps.some(g => g.dimension === 'creative_thinking'), `${m.career_slug}: creative fabricated as a gap`)
    assert.equal(m.dimension_scores.creative_thinking, undefined)
  }

  // The FIX 3 floor applies exactly where creative carries >50% of the career's required weight.
  for (const c of corpus) {
    const caps = c.required_capabilities!
    const total = Object.values(caps).reduce((s, r) => s + r.weight, 0)
    const share = caps.creative_thinking.weight / total
    const m = all.find(x => x.career_slug === c.slug)
    if (!m) continue
    if (share > 0.5) assert.equal(m.confidence, 'Low', `${c.slug} relies ${Math.round(share * 100)}% on creative`)
    else assert.ok(!/incomplete capability evidence/.test(m.narrative), `${c.slug} wrongly floored at ${Math.round(share * 100)}% creative`)
  }
})

test('accelerating learner at or above ideal: alignment never exceeds 100%', async () => {
  const ci = await orch.buildCareerIntelligence('syn-accelerating')
  assert.ok(ci.matches && ci.matches.length > 0)
  for (const m of ci.matches) assert.ok(m.alignmentPct <= 100, `${m.careerSlug} at ${m.alignmentPct}%`)
})

test('Junior learner: families only — no ranked matches, no per-career tier or alignment', async () => {
  // Enforced Career Principle as built: exploration mode, career FAMILIES, never
  // a ranked or scored single career. Families still list unranked example
  // titles (exampleCareerTitles) by existing design — see ADR-0033 FIX 7 note.
  const ci = await orch.buildCareerIntelligence('syn-junior')
  assert.equal(ci.mode, 'exploration')
  assert.equal(ci.matches, undefined)
  assert.ok(ci.families && ci.families.length > 0)
  for (const f of ci.families) {
    assert.ok(!('tier' in f) && !('alignmentPct' in f))
    assert.doesNotMatch(f.insight.observation, /strong match/i)
  }
})

test('no-evidence learner: a single notice, no matches, no families', async () => {
  const ci = await orch.buildCareerIntelligence('syn-no-evidence')
  assert.ok(ci.notice)
  assert.equal(ci.matches, undefined)
  assert.equal(ci.families, undefined)
})

// ── Entrepreneurial base rate (reported, never auto-corrected) ───────────────

test('entrepreneurial-tier base rate across 20 varied synthetic learners is reported', async () => {
  const cohort = fx.variedSeniorCohort()
  let numerator = 0
  for (const l of cohort) {
    const ci = await orch.buildCareerIntelligence(l.id)
    if (ci.matches?.some(m => m.tier === 'entrepreneurial')) numerator++
  }
  const rate = numerator / cohort.length
  console.log(
    `[entrepreneurial base rate] population: ${cohort.length} deterministic synthetic Senior learners (fixed seed); ` +
    `definition: learner receives the entrepreneurial tier; numerator ${numerator}, denominator ${cohort.length}, ` +
    `rate ${Math.round(rate * 100)}%. A result for this synthetic set only, not a population rate.` +
    (rate > 0.5 ? ' FLAG: most learners qualify — threshold left unchanged; for review.' : ''),
  )
  assert.ok(numerator >= 0 && numerator <= cohort.length)
})
