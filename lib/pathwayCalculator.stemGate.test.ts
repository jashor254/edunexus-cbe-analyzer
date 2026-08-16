// lib/pathwayCalculator.stemGate.test.ts
//
// H2B / CAR-EVD-001 — Career/pathway interpretation may use only relevant
// admissible educational signals for the pathway being evaluated: strong
// evidence in an unrelated subject must not accidentally satisfy a
// STEM-specific competency requirement.
//
// H2B's audit found calculateJuniorPathwayAffinity()'s STEM gate
// (lib/pathwayCalculator.ts) is already explicit and subject-scoped —
// PATHWAY_RULES.STEM requires mathematics OR integrated_science at Level 3+
// (never English/Kiswahili as a substitute), plus a language co-requirement
// that is additive, not an alternate qualifying path — but no test had ever
// exercised this gate directly. This file closes that gap.
//
// Pure/deterministic, no DB — calculateJuniorPathwayAffinity() only reads
// KJSEA rule-set config (lib/config/kjseaRules.ts), which has zero imports.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/pathwayCalculator.stemGate.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateJuniorPathwayAffinity } from './pathwayCalculator'

test('CAR-EVD-001: exceptional English/Kiswahili alone cannot satisfy the STEM gate when Mathematics and Science are both below threshold', () => {
  const result = calculateJuniorPathwayAffinity({
    mathematics: 1,          // below PATHWAY_RULES.STEM.mathematics (3)
    integrated_science: 1,   // below PATHWAY_RULES.STEM.integrated_science (3)
    english: 4,               // exceptional — the unrelated-subject signal under test
    kiswahili: 4,              // exceptional — langAvg alone would clear the language co-requirement
    social_studies: 3,
    creative_arts_sports: 3,
  })

  assert.notEqual(result.top_pathway, 'STEM', 'a strong-language, weak-Math/Science learner must not be routed into STEM')
  assert.equal(result.stem_viable, false)
})

test('CAR-EVD-001 sanity check: genuine Mathematics-or-Science strength (with the language co-requirement met) DOES satisfy the STEM gate', () => {
  const result = calculateJuniorPathwayAffinity({
    mathematics: 4,
    integrated_science: 3,
    english: 3,
    kiswahili: 3,
    social_studies: 2,
    creative_arts_sports: 2,
  })

  assert.equal(result.top_pathway, 'STEM', 'sanity check: the gate must still be reachable by a learner who actually has the required Math/Science evidence — proves the previous test failed for the right reason, not because the gate is unreachable')
  assert.equal(result.stem_viable, true)
})

test('CAR-EVD-001: Mathematics OR Science alone is sufficient (KNEC composite semantics) — English cannot compensate for BOTH being weak', () => {
  // Strong Mathematics, weak Science — the OR-gate must still admit this
  // (documented KNEC composite behavior), distinguishing "OR is allowed
  // between the two STEM subjects themselves" from "an unrelated subject
  // can substitute for either."
  const mathOnly = calculateJuniorPathwayAffinity({
    mathematics: 4,
    integrated_science: 1,
    english: 3,
    kiswahili: 3,
    social_studies: 3,
    creative_arts_sports: 3,
  })
  assert.equal(mathOnly.top_pathway, 'STEM', 'Math alone (Level 4) with Science weak must still qualify — the OR is between Math/Science, not a wildcard for any subject')

  // Now hold Math AND Science both weak, but push English/Kiswahili even
  // higher than in the mathOnly case above — the unrelated subject must
  // still not be able to open a path the STEM subjects themselves refuse.
  const languageCompensation = calculateJuniorPathwayAffinity({
    mathematics: 1,
    integrated_science: 1,
    english: 4,
    kiswahili: 4,
  })
  assert.notEqual(languageCompensation.top_pathway, 'STEM', 'no amount of English/Kiswahili strength opens the STEM gate when both Mathematics and Science are below threshold')
})
