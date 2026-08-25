// lib/compass/prompt.test.ts
//
// Phase 4 (Blueprint/Compass Intelligence Convergence) — pure unit tests
// for buildCompassPrompt()'s new PERSISTENT CONTEXT section. No database,
// no network: every CompassPromptParams field is a hand-built fixture.
//
// The load-bearing assertions here are #3 ("informs, does not lock" — the
// explicit override rule always appears whenever persistent context is
// shown) and #6 (risk is rendered as underlying factor sentences, never a
// bare categorical label) — both directly implement Phase 4's §11-13 and
// §21 requirements at the prompt-construction level, since Compass's
// actual per-turn adaptation is model behavior, not code logic; the one
// thing code can guarantee is that the instruction handed to the model is
// unambiguous.
//
// Run: npx tsx --test lib/compass/prompt.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCompassPrompt, type CompassPromptParams, type CompassPersistentContext } from './prompt'

function baseParams(overrides: Partial<CompassPromptParams> = {}): CompassPromptParams {
  return {
    firstName: 'Amina',
    grade: 8,
    level: 3,
    isJunior: true,
    subject: 'mathematics',
    subtopic: 'fractions',
    gradeTopics: ['Fractions', 'Ratios'],
    sessionsWithoutImprovement: 0,
    mode: 'school',
    languageMode: 'mixed',
    questionMode: 'mcq-and-structured',
    ...overrides,
  }
}

// ── 1. No persistent intelligence: degrades silently ────────────────────────

test('1. undefined persistentIntelligence: no PERSISTENT CONTEXT section at all — silent degradation, not a broken/empty header', () => {
  const prompt = buildCompassPrompt(baseParams())
  assert.doesNotMatch(prompt, /PERSISTENT CONTEXT/)
})

test('2. evidenceSufficiency "none": no PERSISTENT CONTEXT section — "no learner intelligence" is not rendered as a claim', () => {
  const prompt = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: null, trajectory: null, riskFactors: [], evidenceSufficiency: 'none' },
  }))
  assert.doesNotMatch(prompt, /PERSISTENT CONTEXT/)
})

// ── 3. "Informs, does not lock" — the override rule always appears ──────────

test('3. whenever persistent context is shown, the explicit override rule is present ("trust what they show you now")', () => {
  const ctx: CompassPersistentContext = { capabilityLevel: 'developing', trajectory: 'declining', riskFactors: [], evidenceSufficiency: 'established' }
  const prompt = buildCompassPrompt(baseParams({ persistentIntelligence: ctx }))
  assert.match(prompt, /PERSISTENT CONTEXT \(background only, not a verdict\)/)
  assert.match(prompt, /trust what they show you now and adjust immediately/)
  assert.match(prompt, /this is a starting point, not a constraint/)
})

// ── 4. Evidence-sufficiency distinction (§7) ─────────────────────────────────

test('4. evidenceSufficiency "limited": the prompt explicitly says so, distinct from "established"', () => {
  const limited = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: 'developing', trajectory: null, riskFactors: [], evidenceSufficiency: 'limited' },
  }))
  assert.match(limited, /Based on limited evidence so far — treat as a loose hint, not a fact\./)

  const established = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: 'developing', trajectory: null, riskFactors: [], evidenceSufficiency: 'established' },
  }))
  assert.doesNotMatch(established, /limited evidence/)
})

test('5. no fabricated confidence percentage ever appears in the persistent context block', () => {
  const prompt = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: 'strong', trajectory: 'improving', riskFactors: [], evidenceSufficiency: 'established' },
  }))
  assert.doesNotMatch(prompt, /\d+%\s*confiden/i)
})

// ── 6. Risk as underlying factors, never a bare categorical label (§21) ─────

test('6. risk factors render as the underlying reason sentence, and the categorical severity word never appears standalone in the block', () => {
  const prompt = buildCompassPrompt(baseParams({
    persistentIntelligence: {
      capabilityLevel: 'developing',
      trajectory: 'declining',
      riskFactors: ['Below Expectation in mathematics and declining from prior evidence'],
      evidenceSufficiency: 'established',
    },
  }))
  assert.match(prompt, /Learning factors to be aware of: Below Expectation in mathematics and declining from prior evidence/)
  assert.doesNotMatch(prompt, /HIGH RISK/i)
  assert.doesNotMatch(prompt, /\bcritical\b/i)
})

test('7. no risk factors: the "Learning factors" line is simply omitted, never rendered empty', () => {
  const prompt = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: 'strong', trajectory: 'stable', riskFactors: [], evidenceSufficiency: 'established' },
  }))
  assert.doesNotMatch(prompt, /Learning factors to be aware of:\s*(\n|$)/)
})

// ── 8. Trajectory omission for insufficient_data ─────────────────────────────

test('8. trajectory "insufficient_data" is not rendered as a trend claim', () => {
  const prompt = buildCompassPrompt(baseParams({
    persistentIntelligence: { capabilityLevel: 'developing', trajectory: 'insufficient_data', riskFactors: [], evidenceSufficiency: 'limited' },
  }))
  assert.doesNotMatch(prompt, /Recent trajectory:/)
})

// ── 9. Existing session-local mechanics are untouched by this addition ──────

test('9. sessionsWithoutImprovement and levelSource provenance notes still render exactly as before, independent of persistent context', () => {
  const prompt = buildCompassPrompt(baseParams({
    sessionsWithoutImprovement: 3,
    levelSource: 'legacy_tier',
    persistentIntelligence: { capabilityLevel: 'strong', trajectory: 'improving', riskFactors: [], evidenceSufficiency: 'established' },
  }))
  assert.match(prompt, /3 sessions without improvement — try a different approach\./)
  assert.match(prompt, /provisional — no confirmed evidence yet, treat as a starting point only/)
})

// ── 10. Server-constructed only — no learner/teacher free text reaches this block ──

test('10. the persistent context block is built only from typed enum/string fields already validated upstream, never raw learner or teacher free text', () => {
  // buildCompassPrompt takes no raw "notes"/"comment" field for persistent
  // intelligence — CompassPersistentContext's own type (capabilityLevel/
  // trajectory as closed enums, riskFactors as Projection's own reason
  // sentences, evidenceSufficiency as a closed enum) is the only input
  // surface, which is what keeps this safe from prompt injection via
  // learner or teacher text. Proven structurally: TypeScript would reject
  // a free-text field here that doesn't exist on the type.
  const ctx: CompassPersistentContext = {
    capabilityLevel: 'capable',
    trajectory: 'mixed',
    riskFactors: ['Conflicting evidence for mathematics — two confirmed sources disagree; a teacher should review before relying on this.'],
    evidenceSufficiency: 'established',
  }
  const prompt = buildCompassPrompt(baseParams({ persistentIntelligence: ctx }))
  assert.match(prompt, /Conflicting evidence for mathematics/)
})
