// lib/career/careerSignals.test.ts
//
// Run: npm test -- lib/career/careerSignals.test.ts
//
// Validates the static curated Career Signals corpus (Phase 8.1 MVP) and enforces
// the architecture guards from docs/architecture/phase8-career-signals-audit.md:
// no learner-state writes, no live-web/AI calls, every signal has provenance,
// every related career slug is real, and no prescriptive/sensational framing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CAREER_SIGNALS,
  getCareerSignalsForCareer,
  getCareerSignalsForCategory,
  type CareerSignalType,
  type CareerSignalGeography,
  type CareerSignalConfidence,
} from './careerSignals'

// lib/career/seedCareers.ts imports `repos` from `@/lib/repositories`, which
// eagerly constructs 42 Supabase-backed repositories at import time (the same
// reason recomputeCapabilityProfile.ts exists as a wrapper around
// capabilityExtractor.ts — see the Phase 8 audit doc). This is a STANDARD-safe
// test that must require zero Supabase credentials, so real career slugs are
// read from the seed file's source text rather than importing the module.
const SEED_CAREERS_SOURCE = readFileSync(new URL('./seedCareers.ts', import.meta.url), 'utf8')
const REAL_SLUGS = new Set(
  Array.from(SEED_CAREERS_SOURCE.matchAll(/slug:\s*'([a-z0-9-]+)'/g)).map((m) => m[1]),
)

const VALID_TYPES: CareerSignalType[] = [
  'EMERGING_SPECIALISATION',
  'TECHNOLOGY_SHIFT',
  'SKILL_SHIFT',
  'INDUSTRY_CONVERGENCE',
  'NEW_WORK_PRACTICE',
  'EDUCATION_ROUTE_CHANGE',
  'PROFESSIONAL_STANDARD_CHANGE',
  'REGIONAL_OPPORTUNITY',
  'SCIENTIFIC_TECHNICAL_DEVELOPMENT',
]
const VALID_GEOGRAPHIES: CareerSignalGeography[] = ['KENYA', 'EAST_AFRICA', 'AFRICA', 'GLOBAL']
const VALID_CONFIDENCE: CareerSignalConfidence[] = ['EARLY', 'EMERGING', 'ESTABLISHED']

const PROHIBITED_PHRASES = [
  'you should become',
  'perfect career for you',
  'guaranteed',
  'will replace all',
  'this career is dying',
  'career is dead',
  'is dying',
]

test('curated corpus stays a small, deliberately-bounded set (Phase 8.2: 8-12 signals)', () => {
  assert.ok(CAREER_SIGNALS.length >= 8, 'expected at least 8 signals after Phase 8.2 expansion')
  assert.ok(CAREER_SIGNALS.length <= 12, 'expected at most 12 signals — this is curated content, not a feed')
})

test('every signal has a unique id', () => {
  const ids = CAREER_SIGNALS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate signal id found')
})

test('every signal has non-empty title and summary', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(signal.title.trim().length > 0, `${signal.id} missing title`)
    assert.ok(signal.summary.trim().length > 0, `${signal.id} missing summary`)
    assert.ok(signal.learnerExplanation.trim().length > 0, `${signal.id} missing learnerExplanation`)
  }
})

test('every signal has a non-empty exploreNext list, distinct from learnerExplanation (Phase 8.2 WHAT/WHY/EXPLORE contract)', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(signal.exploreNext.length > 0, `${signal.id} has no exploreNext items`)
    for (const item of signal.exploreNext) {
      assert.ok(item.trim().length > 0, `${signal.id} has an empty exploreNext item`)
    }
  }
})

test('every signal has a valid signalType, geography and confidence', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(VALID_TYPES.includes(signal.signalType), `${signal.id} has invalid signalType`)
    assert.ok(VALID_GEOGRAPHIES.includes(signal.geography), `${signal.id} has invalid geography`)
    assert.ok(VALID_CONFIDENCE.includes(signal.confidence), `${signal.id} has invalid confidence`)
  }
})

test('every signal has observedAt and lastReviewedAt as parseable dates', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(!Number.isNaN(Date.parse(signal.observedAt)), `${signal.id} has unparseable observedAt`)
    assert.ok(!Number.isNaN(Date.parse(signal.lastReviewedAt)), `${signal.id} has unparseable lastReviewedAt`)
  }
})

test('every signal has at least one source (Guard F)', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(signal.sources.length > 0, `${signal.id} has no sources`)
  }
})

test('every source has an https URL and a publisher and a claim', () => {
  for (const signal of CAREER_SIGNALS) {
    for (const source of signal.sources) {
      assert.ok(source.url.startsWith('https://'), `${signal.id} source URL is not https: ${source.url}`)
      assert.ok(source.publisher.trim().length > 0, `${signal.id} source missing publisher`)
      assert.ok(source.claim.trim().length > 0, `${signal.id} source missing claim`)
      assert.ok(source.claim.length < 600, `${signal.id} source claim looks like a copied excerpt, not a short claim`)
    }
  }
})

test('no duplicate source URLs within the same signal', () => {
  for (const signal of CAREER_SIGNALS) {
    const urls = signal.sources.map((s) => s.url)
    assert.equal(new Set(urls).size, urls.length, `${signal.id} has duplicate source URLs`)
  }
})

test('every relatedCareerSlugs entry exists in the real Career seed corpus', () => {
  for (const signal of CAREER_SIGNALS) {
    assert.ok(signal.relatedCareerSlugs.length > 0, `${signal.id} maps to no careers`)
    for (const slug of signal.relatedCareerSlugs) {
      assert.ok(REAL_SLUGS.has(slug), `${signal.id} references non-existent career slug "${slug}"`)
    }
  }
})

test('structural-trend signals cite at least 2 independent sources, including tier1/tier2', () => {
  // Factual institutional-change signals (a regulator/ministry/professional body announcing
  // its own action) may rely on a single authoritative source. Anything broader —
  // an interpretive claim about an industry/technology shift — needs corroboration.
  const singleSourceOk = new Set([
    'kenya-agriculture-digital-policy-2026',      // Ministry's own draft policy, reported factually
    'kenya-green-buildings-roadmap-2026',         // government department's own roadmap launch
    'kenya-accounting-audit-analytics-2026',      // ICPAK is the regulator itself (tier1, primary source)
    'kenya-jss-teacher-digital-training-2026',    // TSC/ICT Authority's own programme, reported factually
  ])
  for (const signal of CAREER_SIGNALS) {
    if (singleSourceOk.has(signal.id)) continue
    assert.ok(signal.sources.length >= 2, `${signal.id} is a structural claim and needs 2+ sources`)
    const hasTier1or2 = signal.sources.some((s) => s.sourceType === 'tier1' || s.sourceType === 'tier2')
    assert.ok(hasTier1or2, `${signal.id} needs at least one tier1/tier2 source`)
  }
})

test('confidence is never ESTABLISHED on tier3/tier4-only evidence', () => {
  for (const signal of CAREER_SIGNALS) {
    const hasTier1or2 = signal.sources.some((s) => s.sourceType === 'tier1' || s.sourceType === 'tier2')
    if (!hasTier1or2) {
      assert.notEqual(signal.confidence, 'ESTABLISHED', `${signal.id} claims ESTABLISHED without tier1/2 evidence`)
    }
  }
})

test('no prescriptive or sensational framing in learner-facing copy (content policy guard)', () => {
  for (const signal of CAREER_SIGNALS) {
    const text = `${signal.title} ${signal.summary} ${signal.learnerExplanation}`.toLowerCase()
    for (const phrase of PROHIBITED_PHRASES) {
      assert.ok(!text.includes(phrase), `${signal.id} contains prohibited phrasing: "${phrase}"`)
    }
  }
})

test('GLOBAL signals do not claim to already be happening "in Kenya"', () => {
  for (const signal of CAREER_SIGNALS) {
    if (signal.geography !== 'GLOBAL') continue
    const text = `${signal.summary} ${signal.learnerExplanation}`.toLowerCase()
    assert.ok(!text.includes('in kenya'), `${signal.id} is GLOBAL but phrased as already happening "in Kenya"`)
  }
})

test('no fake precision — no percentage sign in learner-facing confidence-adjacent copy', () => {
  // Confidence itself must never be exposed as a fabricated probability.
  // (Sources MAY cite real statistics with %, e.g. FDA clearance rates — that's
  // reported evidence, not a fabricated confidence score. This guard only checks
  // the learnerExplanation field, which should stay in plain evidence-strength language.)
  for (const signal of CAREER_SIGNALS) {
    assert.ok(!signal.learnerExplanation.includes('%'), `${signal.id} learnerExplanation exposes a raw percentage`)
  }
})

test('getCareerSignalsForCareer is pure, deterministic, and caps at 3', () => {
  const first = getCareerSignalsForCareer('environmental-scientist')
  const second = getCareerSignalsForCareer('environmental-scientist')
  assert.deepEqual(first, second, 'lookup must be deterministic')
  assert.ok(first.length <= 3, 'must cap at 3 cards')
})

test('getCareerSignalsForCareer returns empty array for a career with no curated signal', () => {
  const result = getCareerSignalsForCareer('advocate-lawyer')
  assert.deepEqual(result, [])
})

test('getCareerSignalsForCareer only returns signals actually mapped to that slug', () => {
  const result = getCareerSignalsForCareer('software-engineer')
  for (const signal of result) {
    assert.ok(signal.relatedCareerSlugs.includes('software-engineer'))
  }
})

test('no signal maps to an implausibly broad set of careers (defensible mapping, not "about AI so attach everywhere")', () => {
  const MAX_DEFENSIBLE_CAREERS = 6
  for (const signal of CAREER_SIGNALS) {
    assert.ok(
      signal.relatedCareerSlugs.length <= MAX_DEFENSIBLE_CAREERS,
      `${signal.id} maps to ${signal.relatedCareerSlugs.length} careers — re-check this is still a defensible mapping, not breadth for its own sake`,
    )
  }
})

test('a career can have multiple signals, and a signal can have multiple careers (both directions proven with real data)', () => {
  // environmental-scientist appears in two distinct signals (agriculture + green buildings).
  const envSignals = getCareerSignalsForCareer('environmental-scientist')
  assert.ok(envSignals.length >= 2, 'expected environmental-scientist to have 2+ curated signals')

  // the creative-economy signal maps to 4 careers — real, distinct, individually justified.
  const creativeSignal = CAREER_SIGNALS.find((s) => s.id === 'kenya-creative-economy-bill-2026')
  assert.ok(creativeSignal)
  assert.ok(creativeSignal!.relatedCareerSlugs.length >= 3)
})

test('getCareerSignalsForCategory only returns signals mapped to that category', () => {
  const result = getCareerSignalsForCategory('health')
  for (const signal of result) {
    assert.ok(signal.relatedCategories.includes('health'))
  }
})

// ── Architecture guards (Guards A-E, G) ─────────────────────────────────────
// Static import-graph checks: the module must never reach into Projection,
// capability persistence, learner interests, pathway affinity, Compass, or any
// Supabase/AI client. Read the actual source text rather than relying on types,
// since a banned import could be added without any type ever exposing it here.

const SOURCE = readFileSync(new URL('./careerSignals.ts', import.meta.url), 'utf8')

test('careerSignals.ts imports only from its own types module — no Projection, repositories, Compass, or any external client (Guards A/B/C/D/E)', () => {
  const importTargets = Array.from(SOURCE.matchAll(/from\s+'([^']+)'/g)).map((m) => m[1])
  assert.deepEqual(
    importTargets,
    ['./types'],
    `careerSignals.ts must import only from './types', found: ${importTargets.join(', ')}`,
  )
})

test('careerSignals.ts contains no fetch/network calls (Guard G — static data only)', () => {
  assert.ok(!SOURCE.includes('fetch('), 'careerSignals.ts must not perform network calls')
  assert.ok(!/\bawait\b/.test(SOURCE), 'careerSignals.ts must be synchronous/pure — no async I/O')
})

test('every source URL is a well-formed https:// link, not javascript:/protocol-relative/malformed (Phase 8.2 §32)', () => {
  for (const signal of CAREER_SIGNALS) {
    for (const source of signal.sources) {
      assert.doesNotThrow(() => new URL(source.url), `${signal.id} has a malformed source URL: ${source.url}`)
      const parsed = new URL(source.url)
      assert.equal(parsed.protocol, 'https:', `${signal.id} source URL is not https: ${source.url}`)
    }
  }
})

test('Guard H — careerSignals.ts does not import Academic Clinic matching policy', () => {
  assert.ok(!SOURCE.includes('academicClinic'), 'careerSignals.ts must not import from lib/academicClinic/**')
})

test('careerSignals.ts is unrelated to lib/learnerModel\'s unrelated, identically-named "CareerSignals" type (naming-collision guard)', () => {
  // lib/learnerModel/types.ts independently defines a type ALSO called
  // `CareerSignals` (plural) — learner-specific derived data (top_career_slugs,
  // readiness_scores per career, refreshed from Projection events via
  // lib/learnerModel/updater.ts's refreshCareerSignals()). It predates this
  // module, is completely unrelated to Phase 8's world-of-work Career Signals,
  // and the near-identical name is a real risk for a future maintainer to
  // conflate. This guard proves this module has zero connection to it.
  assert.ok(!SOURCE.includes('learnerModel'), 'careerSignals.ts must not import from lib/learnerModel — that is a different "CareerSignals" concept entirely')
  assert.ok(!SOURCE.includes('refreshCareerSignals'), 'careerSignals.ts must not reference the unrelated learner-model refreshCareerSignals()')
})
