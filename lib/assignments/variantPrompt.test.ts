// Audit F-01 — the generation prompt's answer-integrity instructions. Pure:
// builds prompt strings only, never calls a model.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ANSWER_INTEGRITY_RULE, TIER_RULES, VERIFIER_RESPONSE_SHAPE, buildGenerationPrompt, buildVerificationPrompt, type RedactedContext } from './variantPrompt'

const CANONICAL = { question_text: 'Angles on a straight line add up to:', choices: ['90°', '180°', '270°', '360°'], correct_index: 1 }
const CONTEXT: RedactedContext = { subject: 'Mathematics', band: 'BE', academicGrain: 'subject', confidence: 'Medium' }
const TIERS = ['foundation', 'guided_practice', 'supported_practice', 'extension'] as const

test('every tier is told to keep the assessed thinking with the learner and never state the answer', () => {
  for (const tier of TIERS) {
    const { system } = buildGenerationPrompt(CANONICAL, null, tier, CONTEXT)
    assert.ok(system.includes(ANSWER_INTEGRITY_RULE), tier)
  }
  assert.match(ANSWER_INTEGRITY_RULE, /Never state, restate or paraphrase the correct choice/)
  assert.match(ANSWER_INTEGRITY_RULE, /recalling a fact or definition, support may simplify the wording .* but must not contain that fact/)
})

test('legitimate scaffolding stays explicitly allowed (vocabulary, rule reminders for application, worked examples on different instances, steps that stop short)', () => {
  assert.match(ANSWER_INTEGRITY_RULE, /explaining an unfamiliar word/)
  assert.match(ANSWER_INTEGRITY_RULE, /reminding the learner of a rule or formula when the question assesses APPLYING it/)
  assert.match(ANSWER_INTEGRITY_RULE, /worked example that uses different numbers, objects or situations/)
  assert.match(ANSWER_INTEGRITY_RULE, /steps that stop before the step the question assesses/)
})

test('Foundation no longer asks for "explicit guided reasoning" in the stem; it asks for support that stops before the assessed step', () => {
  assert.doesNotMatch(TIER_RULES.foundation, /explicit guided reasoning|worked-example framing inside the stem/)
  assert.match(TIER_RULES.foundation, /worked example on a DIFFERENT instance/)
  assert.match(TIER_RULES.foundation, /the learner must still complete that step themselves/)
  assert.match(TIER_RULES.foundation, /never give the answer away/)
  assert.match(TIER_RULES.guided_practice, /Hints point to the method, never to the answer/)
})

test('no figures: the generator is told nothing can be drawn', () => {
  assert.match(ANSWER_INTEGRITY_RULE, /Never refer to a diagram, picture, figure, graph or drawn shape/)
})

test('the generator still receives the canonical question, choices, answer key and tier rule — and nothing about the learner but the band', () => {
  const { prompt } = buildGenerationPrompt(CANONICAL, null, 'foundation', CONTEXT)
  assert.ok(prompt.includes('"Angles on a straight line add up to:"'))
  assert.ok(prompt.includes(JSON.stringify(CANONICAL.choices)))
  assert.ok(prompt.includes('Correct answer index: 1'))
  assert.ok(prompt.includes(TIER_RULES.foundation))
  assert.match(prompt, /Learner readiness context \(band only, no personal data\): BE, academic precision: subject\./)
})

// ── P0-2: verifier judges giveaway and factual correctness separately ────────

function verification() {
  return buildVerificationPrompt({
    canonical: { question_text: 'Why is the inside of an electric cable made of copper?', choices: ['Copper is a good conductor of electricity', 'Copper stops electricity'], correct_index: 0 },
    learningOutcome: null,
    tier: 'foundation',
    variant: { questionText: 'Copper lets electricity flow through it easily. Why is copper chosen?', choices: ['Copper is a good conductor of electricity', 'Copper stops electricity'], correctIndex: 0 },
  })
}

test('the verifier sees the source answer, every variant option, the marked answer TEXT and the tier', () => {
  const { prompt } = verification()
  assert.match(prompt, /Source correct answer: "Copper is a good conductor of electricity"/)
  assert.match(prompt, /Variant choices: \["Copper is a good conductor of electricity","Copper stops electricity"\]/)
  assert.match(prompt, /Marked correct answer: choices\[0\] = "Copper is a good conductor of electricity"/)
  assert.match(prompt, /Variant tier: foundation/)
})

test('the verifier keeps the original three checks and adds giveaway (incl. paraphrase) and factual checks', () => {
  const { prompt, system } = verification()
  assert.match(prompt, /1\. keyCorrect/)
  assert.match(prompt, /2\. sameConcept/)
  assert.match(prompt, /3\. singleQuestion/)
  assert.match(prompt, /4\. answerGiveaway — .*INCLUDING when it uses different words from the marked answer/)
  assert.match(prompt, /5\. factualError — /)
  assert.match(system, /Judge each check on its own: passing one says nothing about the others/)
  assert.ok(system.includes(VERIFIER_RESPONSE_SHAPE))
})

test('the giveaway policy names the legitimate cases so scaffolding is not penalised', () => {
  const { prompt } = verification()
  for (const legit of [
    /worked example on different numbers or objects followed by a new case/,
    /rule or formula reminder when the question assesses applying it/,
    /explaining an unfamiliar word/,
    /asking why a stated answer is correct/,
    /asking the learner to find an error in a statement/,
  ]) assert.match(prompt, legit)
  assert.match(prompt, /If the source question asks for a fact or definition itself .* a variant that states that fact or definition gives it away/)
  assert.match(prompt, /when the source question asks the learner to classify or identify an example .* stating the definition is NOT a giveaway: the learner must still apply it to the choices/)
  assert.match(prompt, /A false or misleading statement is never a giveaway — it belongs under factualError/)
})

test('the factual policy separates demonstrable errors from claims needing a specialist, and forbids invented sources', () => {
  const { prompt } = verification()
  assert.match(prompt, /"a straight line is a full turn" \(it is a half turn, 180°\)/)
  assert.match(prompt, /Answer "uncertain" for a claim you cannot confirm without a specialist or a source\. Never invent a source\./)
  assert.match(prompt, /copy the exact sentence or step into the matching evidence field/)
})

test('a retry passes the verifier\'s specific problems back to the generator; a first attempt carries none', () => {
  const first = buildGenerationPrompt(CANONICAL, null, 'foundation', CONTEXT).prompt
  assert.doesNotMatch(first, /previous draft/)
  const retry = buildGenerationPrompt(CANONICAL, null, 'foundation', CONTEXT, 'factual or logical error: "a straight line is a full turn"').prompt
  assert.match(retry, /Your previous draft for this tier was rejected by an independent check for these specific reasons:\nfactual or logical error: "a straight line is a full turn"/)
  assert.match(retry, /keeps the same learning outcome and tier/)
})
