// lib/assignments/variantPrompt.ts
//
// The adaptive-variant generation and verification prompts, extracted
// unchanged-in-shape from variantGeneration.ts so they are pure and testable:
// variantGeneration.ts imports the shared repositories singleton, which
// constructs a database client at import time, so nothing in it can run in
// the secret-free STANDARD test tier. Type-only imports below are erased.
//
// Audit F-01 (docs/audits/differentiated-assignment-deep-audit.md §8): the
// former Foundation rule asked for "worked-example framing inside the stem,
// explicit guided reasoning", and the structural rule forces all scaffolding
// into the stem. For a recall question the only "explicit reasoning" there is
// to give is the answer itself — 9 of 15 sampled Foundation variants stated
// or paraphrased their answer, every one derived from a recall-type canonical
// question that did not leak on its own. ANSWER_INTEGRITY_RULE and the
// revised tier rules keep scaffolding while forbidding the giveaway.
//
// P0-2: the verification prompt now also judges, separately, (a) semantic
// answer giveaway and (b) factual/logical correctness of every learner-facing
// statement, and answers in the structured contract parsed by
// variantVerification.ts. A failed draft's specific problems can be fed back
// into the next generation (bounded retry).

import type { CurriculumContext } from '@/lib/curriculum/service'
import type { EducationalAIContext } from '@/lib/ai/educationalContext'
import type { TeacherQuestionRow } from '@/lib/quiz/quiz'
import type { VariantType } from './variants'

/** Only the fields safe to hand to a language model — never a name, a mark, or an evidence id. */
export type RedactedContext = {
  subject: string
  band: EducationalAIContext['band']
  academicGrain: EducationalAIContext['academicGrain']
  confidence: EducationalAIContext['confidence']
}

export const ANSWER_INTEGRITY_RULE = `Answer-integrity rule (every tier): the learner must still do the thinking the canonical question assesses. Never state, restate or paraphrase the correct choice anywhere in the stem, and never write a sentence whose wording the correct choice simply repeats. Support that IS allowed: explaining an unfamiliar word; reminding the learner of a rule or formula when the question assesses APPLYING it (not when it assesses recalling it); a worked example that uses different numbers, objects or situations from the ones being assessed; steps that stop before the step the question assesses. If the canonical question assesses recalling a fact or definition, support may simplify the wording or add familiar context, but must not contain that fact. Never refer to a diagram, picture, figure, graph or drawn shape — none can be shown, so describe everything in words.`

export const TIER_RULES: Record<VariantType, string> = {
  foundation: 'Foundation tier (Below Expectations): smaller reasoning steps, simpler wording, concrete context. Where it helps, add a worked example on a DIFFERENT instance, or a step-by-step frame that stops before the step being assessed — the learner must still complete that step themselves. Never remove essential reasoning, never lower the curriculum standard, never give the answer away.',
  guided_practice: 'Guided Practice tier (Approaching Expectations): light-to-moderate scaffolding — clearer step markers and a small amount of context or hinting, but noticeably closer to grade-level phrasing than Foundation. Hints point to the method, never to the answer. Never as heavily scaffolded as Foundation, never as close to the canonical wording as Supported Practice.',
  supported_practice: 'Supported Practice tier (Meeting Expectations): stay as close as possible to the canonical question — light clarity edits only, minimal scaffolding, reduced (not absent) hints. Never drift toward Foundation, Guided Practice, or Extension.',
  extension: 'Extension tier (Exceeding Expectations): higher-order reasoning, transfer to a new but still in-grade context, real-world application, connect to a second concept the learner has evidence of readiness for. Never introduce future-grade content or content outside the given curriculum node.',
}

export function buildGenerationPrompt(
  canonical: Pick<TeacherQuestionRow, 'question_text' | 'choices' | 'correct_index'>,
  curriculum: CurriculumContext | null,
  tier: VariantType,
  context: RedactedContext,
  /** The verifier's specific problems with this tier's previous draft, for a bounded retry. */
  feedback: string | null = null,
): { system: string; prompt: string } {
  const system = `You transform one teacher-authored canonical assessment question into an instructional variant.

First Principle: you transform instruction, never curriculum. Every variant must measure the exact same learning outcome as the canonical question. You may change wording, scaffolding, examples, representation, and cognitive load. You may NEVER change the concept being tested, invent content outside the given curriculum node, or produce a question that could be answered correctly in more than one way.

Non-negotiable structural rule: you always produce exactly ONE question with exactly ONE stem, ONE choice list, and ONE correct answer index — never multiple numbered sub-questions, never a multi-part item. Scaffolding (worked steps, guided reasoning) must live entirely inside the single question's own text, never as separate gradable parts.

${ANSWER_INTEGRITY_RULE}

Respond with valid JSON only, matching this exact shape, no markdown, no commentary:
{
  "questionText": string,
  "choices": string[],
  "correctIndex": number,
  "cognitiveIntent": string,
  "difficultyRationale": string,
  "expectedMisconceptions": string[],
  "teacherExplanation": string,
  "learnerExplanation": string
}`

  const curriculumBlock = curriculum
    ? `Curriculum node: ${curriculum.strandTitle} — ${curriculum.subStrandTitle}\nLearning outcome: ${curriculum.learningOutcomes[0] ?? '(none seeded — infer the outcome strictly from the canonical question itself, do not invent curriculum content)'}`
    : `No specific curriculum sub-strand is assigned — ground the variant in the canonical question's own subject-level scope only (${context.subject}), never invent a curriculum node.`

  const prompt = `${curriculumBlock}

Canonical question:
"${canonical.question_text}"
Choices: ${JSON.stringify(canonical.choices)}
Correct answer index: ${canonical.correct_index}

Target instructional tier: ${tier}
${TIER_RULES[tier]}

Learner readiness context (band only, no personal data): ${context.band}, academic precision: ${context.academicGrain ?? 'unknown'}.${feedback ? `

Your previous draft for this tier was rejected by an independent check for these specific reasons:
${feedback}
Write a new variant that fixes them, keeps the same learning outcome and tier, and follows every rule above.` : ''}`

  return { system, prompt }
}

// The topic-preservation check (item 2 below) previously went silent
// whenever no curriculum sub-strand was attached to the assignment — a
// fully legal, and in practice the DEFAULT, configuration (substrand_id is
// optional at assignment creation). Forensic audit finding: with no
// learning outcome, verification degraded to "verify internal consistency
// only," meaning nothing — deterministic or AI — ever confirmed a tier
// variant still tests the same concept as the canonical question. The
// canonical question's own text is always available regardless of
// curriculum grounding, so it is now always passed in and always checked
// against, with the learning outcome used as the stricter standard only
// when one is actually seeded.
export const VERIFIER_RESPONSE_SHAPE = '{"keyCorrect": boolean, "sameConcept": boolean, "singleQuestion": boolean, "answerGiveaway": "none" | "clear" | "uncertain", "giveawayEvidence": string, "factualError": "none" | "clear" | "uncertain", "factualEvidence": string, "reason": string}'

export function buildVerificationPrompt(input: {
  canonical: Pick<TeacherQuestionRow, 'question_text' | 'choices' | 'correct_index'>
  learningOutcome: string | null
  tier: VariantType
  variant: { questionText: string; choices: string[]; correctIndex: number }
}): { system: string; prompt: string } {
  const { canonical, learningOutcome, tier, variant } = input
  const system = `You are an independent verification pass for an AI-generated assessment question — a second, separate check, not the original generator. Verify only; never write a replacement question. Judge each check on its own: passing one says nothing about the others. Respond with valid JSON only, exactly this shape: ${VERIFIER_RESPONSE_SHAPE}`
  const topicStandard = learningOutcome
    ? `Learning outcome this question must measure: ${learningOutcome}`
    : `No curriculum learning outcome is seeded for this assignment. The concept being tested must instead match the source question below — this is the required standard, not an optional check.`
  const prompt = `${topicStandard}

Source question (written by the teacher): "${canonical.question_text}"
Source choices: ${JSON.stringify(canonical.choices)}
Source correct answer: "${canonical.choices[canonical.correct_index] ?? '(not available)'}"

Variant tier: ${tier}
Variant question (everything the learner reads before choosing): "${variant.questionText}"
Variant choices: ${JSON.stringify(variant.choices)}
Marked correct answer: choices[${variant.correctIndex}] = "${variant.choices[variant.correctIndex] ?? '(index out of range)'}"

Checks:
1. keyCorrect — Is the marked answer the single, unambiguous correct choice, with no other choice defensible as correct?
2. sameConcept — Does the variant still measure the same underlying concept as the standard above — not a different, easier or unrelated topic?
3. singleQuestion — Is exactly one question asked (not several bundled together)?
4. answerGiveaway — Does the learner still have to do the thinking the question assesses? Answer "clear" when the learner could answer mainly by copying, recognising or repeating something the variant itself says before asking — INCLUDING when it uses different words from the marked answer. Example: "Rubber does not let electric current pass through it. Which material is an insulator?" gives away "Rubber". If the source question asks for a fact or definition itself (e.g. "What is a mixture?"), a variant that states that fact or definition gives it away. But when the source question asks the learner to classify or identify an example (e.g. "Which of these is a mixture?"), stating the definition is NOT a giveaway: the learner must still apply it to the choices. A false or misleading statement is never a giveaway — it belongs under factualError. NOT a giveaway: a worked example on different numbers or objects followed by a new case; a rule or formula reminder when the question assesses applying it; explaining an unfamiliar word; a passage the learner must interpret when interpreting it is what is assessed; asking why a stated answer is correct; asking the learner to find an error in a statement. Answer "uncertain" only when it depends on what exactly the lesson intends to assess. Otherwise "none".
5. factualError — Read every learner-facing statement: definitions, explanations, rule and formula reminders, worked examples and their arithmetic, units, scientific, historical and civic claims, and any sentence that contradicts the marked answer or the choices. Answer "clear" only for an error or contradiction you can demonstrate from the text and standard grade-level knowledge — for example "a straight line is a full turn" (it is a half turn, 180°) or "70° + 120° = 180°". Answer "uncertain" for a claim you cannot confirm without a specialist or a source. Never invent a source. Otherwise "none".

For "clear" or "uncertain", copy the exact sentence or step into the matching evidence field; use "" for "none". If any of checks 1–3 is false, explain which and why in "reason".`
  return { system, prompt }
}
