// lib/assignments/variantVerification.ts
//
// P0-2 (docs/audits/differentiated-assignment-deep-audit.md F-01/F-10) — the
// verifier's structured output contract and the bounded generate→verify→retry
// policy. Pure: the model calls are injected, so every safety rule here is
// unit-tested without a model or a database.
//
// The verifier used to answer one boolean ("valid"), covering only answer-key
// uniqueness, concept and single-question. It never judged whether the stem
// gives the answer away in other words, or whether supporting text is true —
// a Foundation variant calling a straight line "a full turn" passed. It now
// judges giveaway and factual correctness separately, each as
// none / clear / uncertain, with a quoted sentence for anything but "none".
//
// Safety rules (each pinned by variantVerification.test.ts):
//  - Only a fully clean verdict ('pass') lets a variant be saved.
//  - Malformed, incomplete or self-inconsistent verifier output is never a
//    pass ('invalid_output').
//  - 'uncertain' is never a pass ('review'). Variants have no column to hold
//    a "needs teacher judgement" state, so a review outcome is NOT saved; it
//    is reported to the teacher with the verifier's quoted concern. Storing it
//    instead needs a schema decision (not made here).
//  - A regenerated draft is verified again from scratch; retry exhaustion
//    returns a failure, never the last unverified draft.

export type Judgement = 'none' | 'clear' | 'uncertain'

export type VerifierVerdict = {
  keyCorrect: boolean
  sameConcept: boolean
  singleQuestion: boolean
  answerGiveaway: Judgement
  giveawayEvidence: string
  factualError: Judgement
  factualEvidence: string
  reason: string
}

export type VerificationOutcome =
  /** Every check clean. The only outcome that allows saving. */
  | { kind: 'pass' }
  /** A specific, demonstrable problem — regeneration with this feedback may fix it. */
  | { kind: 'retry'; problems: string[] }
  /** The verifier could not decide; a person must. Never treated as a pass. */
  | { kind: 'review'; concerns: string[] }
  /** The verifier's response broke the contract, so nothing was verified. */
  | { kind: 'invalid_output'; detail: string }

const JUDGEMENTS: readonly Judgement[] = ['none', 'clear', 'uncertain']

function stripFences(text: string): string {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '')
}

/**
 * Strict parse of the verifier's JSON. Anything missing, mistyped, or
 * claiming a problem without quoting it is rejected — never defaulted.
 */
export function parseVerifierVerdict(text: string): { verdict: VerifierVerdict } | { invalid: string } {
  let raw: unknown
  try {
    raw = JSON.parse(stripFences(text))
  } catch {
    return { invalid: 'verifier response was not valid JSON' }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { invalid: 'verifier response was not a JSON object' }
  const r = raw as Record<string, unknown>

  for (const key of ['keyCorrect', 'sameConcept', 'singleQuestion'] as const) {
    if (typeof r[key] !== 'boolean') return { invalid: `verifier field "${key}" missing or not true/false` }
  }
  for (const key of ['answerGiveaway', 'factualError'] as const) {
    if (!JUDGEMENTS.includes(r[key] as Judgement)) return { invalid: `verifier field "${key}" missing or not none/clear/uncertain` }
  }
  for (const key of ['giveawayEvidence', 'factualEvidence', 'reason'] as const) {
    if (typeof r[key] !== 'string') return { invalid: `verifier field "${key}" missing or not text` }
  }

  const verdict = r as unknown as VerifierVerdict
  if (verdict.answerGiveaway !== 'none' && !verdict.giveawayEvidence.trim()) {
    return { invalid: `verifier reported answerGiveaway "${verdict.answerGiveaway}" without quoting the sentence` }
  }
  if (verdict.factualError !== 'none' && !verdict.factualEvidence.trim()) {
    return { invalid: `verifier reported factualError "${verdict.factualError}" without quoting the sentence` }
  }
  if ((!verdict.keyCorrect || !verdict.sameConcept || !verdict.singleQuestion) && !verdict.reason.trim()) {
    return { invalid: 'verifier failed a check without giving a reason' }
  }
  return { verdict }
}

/** Clear problems outrank uncertainty: a variant with one clear error is retried, not merely reviewed. */
export function decideVerification(verdict: VerifierVerdict): VerificationOutcome {
  const problems: string[] = []
  if (!verdict.keyCorrect) problems.push(`answer key: ${verdict.reason}`)
  if (!verdict.sameConcept) problems.push(`does not assess the same concept: ${verdict.reason}`)
  if (!verdict.singleQuestion) problems.push(`not a single question: ${verdict.reason}`)
  if (verdict.answerGiveaway === 'clear') problems.push(`gives the answer away: "${verdict.giveawayEvidence}"`)
  if (verdict.factualError === 'clear') problems.push(`factual or logical error: "${verdict.factualEvidence}"`)
  if (problems.length > 0) return { kind: 'retry', problems }

  const concerns: string[] = []
  if (verdict.answerGiveaway === 'uncertain') concerns.push(`possible answer giveaway: "${verdict.giveawayEvidence}"`)
  if (verdict.factualError === 'uncertain') concerns.push(`claim that needs checking: "${verdict.factualEvidence}"`)
  if (concerns.length > 0) return { kind: 'review', concerns }

  return { kind: 'pass' }
}

export function verifyResponse(text: string): VerificationOutcome {
  const parsed = parseVerifierVerdict(text)
  if ('invalid' in parsed) return { kind: 'invalid_output', detail: parsed.invalid }
  return decideVerification(parsed.verdict)
}

// ── Bounded generate → verify → retry ─────────────────────────────────────

export type DraftAttempt<T> = { draft: T } | { structuralError: string }

export type VerifiedGenerationFailureKind = 'structural' | 'retry_exhausted' | 'needs_review' | 'verifier_output_invalid'

export type VerifiedGenerationResult<T> =
  | { status: 'verified'; draft: T; attempts: number }
  | { status: 'not_verified'; failure: VerifiedGenerationFailureKind; reason: string; attempts: number }

function feedbackFor(outcome: VerificationOutcome): string | null {
  if (outcome.kind === 'retry') return outcome.problems.join('\n')
  if (outcome.kind === 'review') return outcome.concerns.join('\n')
  return null // invalid verifier output says nothing about the draft itself
}

/**
 * Runs up to `maxAttempts` generate→verify rounds. Each regenerated draft is
 * verified again from scratch with the same rules; the previous round's
 * specific problems are passed to the next generation as feedback. When the
 * attempts run out, the result is a failure describing the LAST round —
 * never the last draft presented as verified.
 */
export async function generateWithVerification<T>(opts: {
  maxAttempts: number
  generate: (feedback: string | null) => Promise<DraftAttempt<T>>
  verify: (draft: T) => Promise<VerificationOutcome>
}): Promise<VerifiedGenerationResult<T>> {
  const maxAttempts = Math.max(1, Math.floor(opts.maxAttempts))
  let feedback: string | null = null
  let last: { failure: VerifiedGenerationFailureKind; reason: string } = { failure: 'structural', reason: 'Structural validation failed: no attempt made' }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const generated = await opts.generate(feedback)
    if ('structuralError' in generated) {
      last = { failure: 'structural', reason: `Structural validation failed: ${generated.structuralError}` }
      feedback = `Your previous output was rejected before checking: ${generated.structuralError}`
      continue
    }

    const outcome = await opts.verify(generated.draft)
    if (outcome.kind === 'pass') return { status: 'verified', draft: generated.draft, attempts: attempt }

    if (outcome.kind === 'retry') {
      last = { failure: 'retry_exhausted', reason: `Independent verification failed: ${outcome.problems.join('; ')}` }
    } else if (outcome.kind === 'review') {
      last = { failure: 'needs_review', reason: `Independent verification failed: needs a teacher's judgement, so it was not saved — ${outcome.concerns.join('; ')}` }
    } else {
      last = { failure: 'verifier_output_invalid', reason: `Independent verification failed: the check itself returned an unusable answer (${outcome.detail}), so nothing was verified` }
    }
    feedback = feedbackFor(outcome)
  }

  return { status: 'not_verified', ...last, attempts: maxAttempts }
}
