// lib/career/capabilityExtractor.test.ts
//
// H2A / CAP-001 + CAP-003 — capabilityExtractor.ts is the Reasoning layer's
// first citizen (docs/architecture/learner-record-layer-decisions.md
// Decision 6): five modules (careerEngine, careerIntelligenceEngine,
// learnerIntelligence/careerIntelligence, learnerModel/updater,
// learnerBlueprint/composeCareer) treat its output as the single reasoning
// interpretation of a learner's score history. It had zero tests before
// this file.
//
// CAP-001 — determinism: the same scoreHistory input must always produce
// the same dimension scores/levels/trends/evidence (excluding computed_at,
// which is a wall-clock timestamp by design).
//
// CAP-003 — sparse evidence must not fabricate capability: a dimension with
// no assessed subjects must fall back to the documented low-confidence
// estimate (score 0.35, confidence 0), never a crash or a confident-looking
// number invented from nothing.
//
// Pure/sync function, no DB, no mocks — this is the strongest boundary for
// this module: extractCapabilityProfile() takes plain data in and returns
// plain data out.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractCapabilityProfile } from './capabilityExtractor'
import type { CapabilityProfile } from './types'

function withoutComputedAt(profile: CapabilityProfile): Omit<CapabilityProfile, 'computed_at'> {
  const { computed_at: _computed_at, ...rest } = profile
  return rest
}

// ── CAP-001 — determinism ────────────────────────────────────────────────────

test('CAP-001: a stable-mastery learner (same subject scores repeated across terms) yields identical, deterministic output', () => {
  // Three terms of unchanged CBC levels — "stable mastery," not improvement
  // or decline. Educationally meaningful: this learner should read as
  // steady, not trending in either direction.
  const stableMastery = [
    { mathematics: 3, english: 3, integrated_science: 3 },
    { mathematics: 3, english: 3, integrated_science: 3 },
    { mathematics: 3, english: 3, integrated_science: 3 },
  ]

  const first = extractCapabilityProfile(stableMastery)
  const second = extractCapabilityProfile(stableMastery)

  assert.deepEqual(withoutComputedAt(first), withoutComputedAt(second),
    'identical scoreHistory input must produce byte-identical output (modulo the wall-clock computed_at field)')
  assert.equal(first.analytical_reasoning.trend, 'stable')
})

test('CAP-001: a persistent-gap learner (low, unchanging scores) is deterministic and reads as emerging, not fabricated growth', () => {
  const persistentGap = [
    { mathematics: 1, english: 1 },
    { mathematics: 1, english: 1 },
  ]

  const first = extractCapabilityProfile(persistentGap)
  const second = extractCapabilityProfile(persistentGap)

  assert.deepEqual(withoutComputedAt(first), withoutComputedAt(second))
  assert.equal(first.analytical_reasoning.level, 'emerging')
  assert.equal(first.communication.level, 'emerging')
})

test('CAP-001: an improving-evidence learner (rising scores across terms) is deterministic and its trend reflects the improvement', () => {
  const improving = [
    { mathematics: 1, english: 2 },
    { mathematics: 2, english: 2 },
    { mathematics: 4, english: 3 },
  ]

  const first = extractCapabilityProfile(improving)
  const second = extractCapabilityProfile(improving)

  assert.deepEqual(withoutComputedAt(first), withoutComputedAt(second))
  assert.notEqual(first.analytical_reasoning.trend, 'declining',
    'mathematics rose 1 -> 2 -> 4 across three terms; this must never read as declining')
})

test('CAP-001: contradictory evidence (a sharp swing between terms) is deterministic and does not silently pick the strongest-looking signal', () => {
  // Level 4 then Level 1 then Level 4 again — genuinely contradictory,
  // not a clean trend in either direction.
  const contradictory = [
    { mathematics: 4 },
    { mathematics: 1 },
    { mathematics: 4 },
  ]

  const first = extractCapabilityProfile(contradictory)
  const second = extractCapabilityProfile(contradictory)

  assert.deepEqual(withoutComputedAt(first), withoutComputedAt(second),
    'a contradictory history must still resolve to one deterministic profile, not vary run to run')
})

// ── CAP-003 — sparse evidence never fabricates capability ───────────────────

test('CAP-003: sparse evidence (no subjects for a dimension) falls back to the documented low-confidence estimate, not a fabricated score', () => {
  // Only a Creative Arts score — nothing that feeds ANALYTICAL_WEIGHTS at all.
  const sparse = [{ creative_arts: 3 }]

  const profile = extractCapabilityProfile(sparse)

  assert.equal(profile.analytical_reasoning.raw_score, 0.35, 'the documented sparse-evidence fallback score')
  assert.equal(profile.analytical_reasoning.confidence, 0, 'zero confidence — no analytical subject was ever observed')
  assert.deepEqual(profile.analytical_reasoning.evidence, ['No analytical subjects assessed yet — score is an estimate'])
})

test('CAP-003: a single-assessment learner never crashes and never fabricates a resilience trend', () => {
  const singleSnapshot = [{ mathematics: 2 }]
  const profile = extractCapabilityProfile(singleSnapshot)

  assert.equal(profile.resilience.confidence, 0.15, 'documented low-confidence floor for <2 assessments')
  assert.equal(profile.resilience.trend, 'stable', 'insufficient history must never be reported as growing/declining')
  assert.equal(profile.assessment_count, 1)
})

test('CAP-003: completely empty scoreHistory is refused, never silently interpreted as zero capability', () => {
  assert.throws(() => extractCapabilityProfile([]), /at least one assessment snapshot/)
})
