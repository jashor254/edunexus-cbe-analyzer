// lib/paperIntelligence/scriptMarkingPrompt.ts
//
// The whole-script marking prompt, kept pure (no SDK import) so it is
// unit-testable in the standard suite — same split as
// lib/assignments/variantPrompt.ts. The reading rules here are each a fix for
// a failure measured on real scripts (2026-10-14 eval, Phase 0 photos):
// continuations filed under the next question, skipped lines, one point split
// in two, explanations written in a separate block read as extra points,
// strict mode turning correct unlisted answers "incorrect" (the teacher
// accepted them), and the model's own arithmetic contradicting its notes.

import type { RubricForScriptMarking } from './types'

function describeRubric(r: RubricForScriptMarking): string {
  const label = r.questionLabel ?? String(r.questionNumber)
  const structure = r.pointsRequired && r.marksPerPoint
    ? `Any ${r.pointsRequired} × ${r.marksPerPoint} = ${r.maxMarks} marks${r.marksPerPoint > 1 ? ' (each point: name it + explain it)' : ''}`
    : `${r.maxMarks} marks in total`
  const answers = r.acceptedAnswers.length > 0
    ? r.acceptedAnswers.map(a => `  - ${a.text}${a.synonyms.length ? ` (also: ${a.synonyms.join(', ')})` : ''}`).join('\n')
    : `  (no answer list — use: ${r.expectedAnswerSummary})`
  return `Question ${label} — rubricId "${r.rubricId}"
Asks: ${r.questionText}
Marking: ${structure}
Mode: ${r.mode === 'strict' ? 'STRICT — the teacher expects the listed answers; still report correct unlisted ones as plausible_not_in_scheme for the teacher to decide' : 'ACCEPT RELEVANT — listed answers match; other correct answers are plausible_not_in_scheme'}
Scheme answers:
${answers}`
}

export function buildScriptMarkingPrompt(rubrics: RubricForScriptMarking[], pageCount: number): string {
  return `You are reading and marking ONE Kenyan junior-school learner's handwritten exam script against the teacher's marking scheme below. The script is ${pageCount} photographed page${pageCount === 1 ? '' : 's'}, labelled Page 1 to Page ${pageCount} in the order captured. Answers may continue from one page onto the next — read them as one script. You are not an authority: a teacher reviews every mark before it counts.

MARKING SCHEME
${rubrics.map(describeRubric).join('\n\n')}

READING THE SCRIPT
- An answer belongs to the question number it is written under. An answer that runs off the bottom of a page CONTINUES at the top of the next page, until the next question number appears — never file a continuation under the following question.
- Transcribe EVERY line the learner wrote. Never skip a line, even if it looks wrong.
- One point per line or bullet as the learner wrote it. Do not split one written point into several ("Socio-economic status" is one point), and do not merge separate lines.
- Some learners list the points first and explain them further down (e.g. a numbered block "1. Honesty -> involves …"). Attach each explanation to the point it explains — it is NOT a new point.

FOR EACH QUESTION, list every point in the order written and classify each one:
- "matches_scheme": it is one of the scheme answers (or an obvious equivalent / misspelling of one where the meaning is clear). Put the scheme answer in matchedAnswer.
- "plausible_not_in_scheme": a correct, relevant answer to THIS question that the scheme does not list — in any mode; the teacher decides whether it earns. Say in note why it is plausible. It must answer what the question actually asks — on the same topic is not enough (e.g. a skill or competency is not a personality trait), and respect any scope the question sets (e.g. problems learners themselves could solve locally).
- "incorrect": wrong, irrelevant, or a repeat of an idea the learner already gave (note "repeats point N"). A repeated idea scores once.

For each point also set explained:
- true ONLY if the learner wrote a correct explanation of the point beyond naming it (a reason, an effect, a "because …"). A bare name is false. A wrong explanation is false.
Do NOT give marks or totals — they are computed from your classifications.

Also report per question:
- recognizedAnswer: the learner's whole answer transcribed as literally as you can
- pageNumbers: which page(s) the answer is on
- recognitionConfidence (0-1): confidence in your TRANSCRIPTION only
- uncertain: true if any of the handwriting for this answer is unreadable — say so honestly, never guess and hide it; put what you could not read in recognitionNotes
- gradingConfidence (0-1): confidence in your classifications, separate from transcription. Be lower when the marking turns on judgment (explanation quality, borderline relevance).
- rationale: one or two sentences

Return EVERY question in the scheme. If a question was left blank, return it with an empty points list and recognizedAnswer "".

Respond with JSON only, exactly this shape:
{"questions": [{"rubricId": string, "recognizedAnswer": string, "pageNumbers": number[], "recognitionConfidence": number, "recognitionNotes": string | null, "uncertain": boolean, "points": [{"text": string, "classification": "matches_scheme" | "plausible_not_in_scheme" | "incorrect", "explained": boolean, "matchedAnswer": string | null, "note": string | null}], "gradingConfidence": number, "rationale": string}]}`
}
