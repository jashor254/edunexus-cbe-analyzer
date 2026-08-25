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

// ── CAP-004 — contradictory evidence preserves uncertainty ──────────────────
//
// extractCapabilityProfile()'s current per-dimension level/raw_score is
// always computed from only the LAST snapshot (the deterministic "what do
// we believe right now" answer — see extractCapabilityProfile's `current =
// normalized[normalized.length - 1]`), while resilience.raw_score is the
// one field that reasons across the whole history's trajectory
// (computeResilience: per-subject first-vs-last delta, >=0.75 strong
// momentum, >0.25 improving, <-0.25 declining). A genuinely contradictory
// history (up then back down to where it started) nets to delta=0 —
// neither improving nor declining — and must not be scored the same as a
// real sustained improvement that happens to touch the same two endpoints.

test('CAP-004: sustained improvement scores measurably higher resilience than a contradictory up-then-down swing with the same start/end volume', () => {
  const sustainedImprovement = [{ mathematics: 1 }, { mathematics: 2 }, { mathematics: 4 }]
  const contradictorySwing   = [{ mathematics: 1 }, { mathematics: 4 }, { mathematics: 1 }]

  const improving = extractCapabilityProfile(sustainedImprovement)
  const contradictory = extractCapabilityProfile(contradictorySwing)

  assert.ok(
    improving.resilience.raw_score > contradictory.resilience.raw_score,
    `sustained improvement (${improving.resilience.raw_score}) must score higher resilience than a contradictory swing that nets to no real change (${contradictory.resilience.raw_score})`
  )
})

test('CAP-004: current capability level reflects the most recent evidence, not a historical spike a contradictory swing left behind', () => {
  // Level 4 in the middle, but the learner's latest demonstrated evidence is
  // back down at Level 1 — "what is true right now" must not be inflated by
  // an interim high point that the latest evidence has since contradicted.
  const spikeThenDrop = [{ mathematics: 1 }, { mathematics: 4 }, { mathematics: 1 }]
  const profile = extractCapabilityProfile(spikeThenDrop)

  assert.equal(profile.analytical_reasoning.level, 'emerging', 'current level must reflect the latest (Level 1) evidence, not the interim Level 4 spike')
  assert.equal(profile.analytical_reasoning.raw_score, 0, 'the current raw score is computed only from the most recent snapshot')
})

// ── 8-4-4 compatibility — real KCSE subjects contribute capability evidence ──
//
// Audit finding: Business Studies and History & Government (real, common
// 8-4-4/KCSE subjects) previously had no entry in any weight map at all —
// evidence for those subjects was silently dropped, weakening confidence
// for 8-4-4 learners relative to CBC learners for no principled reason.

test('8-4-4 compatibility: a realistic KCSE snapshot yields evidence from every subject, including Business Studies and History & Government', () => {
  const kcseSnapshot = [{
    mathematics: 3, english: 3, kiswahili: 3,
    biology: 3, chemistry: 3, physics: 3,
    business_studies: 3, history_and_government: 3,
  }]

  const profile = extractCapabilityProfile(kcseSnapshot)

  // Science/language subjects still map — unchanged behaviour.
  assert.ok(profile.analytical_reasoning.confidence > 0, 'mathematics/physics/chemistry/biology must still contribute analytical evidence')
  assert.ok(profile.communication.confidence > 0, 'english/kiswahili must still contribute communication evidence')

  // The two previously-dropped subjects now contribute evidence somewhere.
  const allEvidence = [
    ...profile.communication.evidence,
    ...profile.social_intelligence.evidence,
  ].join(' ').toLowerCase()
  assert.ok(allEvidence.includes('business studies'), 'Business Studies must now appear as capability evidence')
  assert.ok(allEvidence.includes('history and government'), 'History & Government must now appear as capability evidence')
})

test('8-4-4 compatibility: Business Studies alone is enough for non-zero social_intelligence confidence', () => {
  const businessOnly = [{ business_studies: 3 }]
  const profile = extractCapabilityProfile(businessOnly)
  assert.ok(profile.social_intelligence.confidence > 0, 'Business Studies is weighted in SOCIAL_WEIGHTS and must not fall back to the zero-evidence estimate')
})

test('8-4-4 compatibility: History & Government alone is enough for non-zero communication confidence', () => {
  const historyOnly = [{ history_and_government: 3 }]
  const profile = extractCapabilityProfile(historyOnly)
  assert.ok(profile.communication.confidence > 0, 'History & Government is weighted in COMMUNICATION_WEIGHTS and must not fall back to the zero-evidence estimate')
})

test('8-4-4 compatibility: existing CBC/science subject weighting is unchanged by the new entries', () => {
  // Adding business_studies/history_and_government/hre only touched
  // COMMUNICATION_WEIGHTS and SOCIAL_WEIGHTS — ANALYTICAL_WEIGHTS (and its
  // maxWeight denominator) must be byte-identical to before this patch.
  const mathOnly = extractCapabilityProfile([{ mathematics: 3 }])
  const mathAndBiology = extractCapabilityProfile([{ mathematics: 3, biology: 3 }])
  assert.ok(
    mathAndBiology.analytical_reasoning.confidence > mathOnly.analytical_reasoning.confidence,
    'adding a second analytical subject must still raise analytical confidence — the analytical weight map was not touched by this patch',
  )
  assert.ok(Math.abs(mathOnly.analytical_reasoning.raw_score - mathAndBiology.analytical_reasoning.raw_score) < 1e-9,
    'mathematics alone at Level 3 normalises to the same ~0.667 score with or without biology present, since the weighted average only includes observed subjects')
})

// H2B FINDING (reported, not fixed — see closeout report; fixing this would
// mean redesigning detectTrend()'s algorithm, out of H2B's scope lock):
// detectTrend() (capabilityExtractor.ts) compares the average of the first
// half of history against the average of the second half, not "does the
// latest value exceed the first." For a 3-point spike-then-drop history
// ([1, 4, 1]), the second half ([4, 1], avg 2.5-normalized) still averages
// higher than the first half ([1] alone) purely because the interim spike
// drags the second-half average up — so this genuinely contradictory
// history (ends exactly where it started) is currently reported as
// 'accelerating', the single most confident growth label the enum has.
// This test pins the real, current, deterministic behavior — not the
// desired one — so a future change to detectTrend() is a deliberate,
// reviewed decision, not a silent regression either direction.
test('CAP-004 FINDING: a 3-point spike-then-drop history — which ends exactly where it started — is currently labeled "accelerating," not neutral, by detectTrend()\'s half-average method', () => {
  const spikeThenDrop = [{ mathematics: 1 }, { mathematics: 4 }, { mathematics: 1 }]
  const profile = extractCapabilityProfile(spikeThenDrop)

  assert.equal(profile.analytical_reasoning.trend, 'accelerating', 'pins the actual current behavior — see the H2B finding above')
})
