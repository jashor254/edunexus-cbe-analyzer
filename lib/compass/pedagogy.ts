// lib/compass/pedagogy.ts
//
// Compass in-session pedagogical diagnosis: misconception -> remediation ->
// re-check -> (only then) mastery-eligible. Session-scoped hypothesis, NOT
// confirmed learner evidence — never written to learner_evidence directly
// and never a Projection-level fact. It exists only to stop Compass from
// awarding mastery on "the model said ready" or "one correct answer after
// an explanation" (see recordCompassSessionEvidence's mastery gate in
// app/api/learn/route.ts, which reads shouldBlockMasteryForPedagogy below).
//
// This is deliberately NOT the BE/AE/ME/EE taxonomy (lib/adaptiveLearning/
// recommend.ts) and NOT the retired critical_gap/prerequisite_gap/
// concept_confusion/on_track taxonomy — it is a separate, narrower,
// in-session-only diagnosis of *what kind of wrong* an answer was, scoped to
// the current concept in the current session.
//
// LLM output is untrusted: parsePedagogyBlock returns null on anything
// malformed, missing, or logically impossible (e.g. recheck.passed=true
// without recheck.completed and remediation.completed) rather than ever
// propagating a bad state.

import { z } from 'zod'

export const MISCONCEPTION_TYPES = [
  'prerequisite_gap',
  'concept_misunderstanding',
  'procedure_error',
  'vocabulary_language_confusion',
  'careless_error',
  'unknown',
] as const
export type MisconceptionType = (typeof MISCONCEPTION_TYPES)[number]

export const PEDAGOGY_DECISIONS = ['TEACH', 'PROBE', 'REMEDIATE', 'RECHECK', 'ADVANCE'] as const
export type PedagogyDecision = (typeof PEDAGOGY_DECISIONS)[number]

export type CompassPedagogyState = {
  decision: PedagogyDecision
  misconceptionType: MisconceptionType | null
  concept: string | null
  remediation: { started: boolean; completed: boolean }
  recheck: { required: boolean; completed: boolean; passed: boolean | null }
}

export const PEDAGOGY_START = 'COMPASS_PEDAGOGY_START'
export const PEDAGOGY_END   = 'COMPASS_PEDAGOGY_END'

const RawPedagogySchema = z.object({
  decision: z.enum(PEDAGOGY_DECISIONS),
  misconception_type: z.enum(MISCONCEPTION_TYPES).nullable().optional(),
  concept: z.string().trim().min(1).max(120).nullable().optional(),
  remediation: z.object({
    started:   z.boolean().optional(),
    completed: z.boolean().optional(),
  }).optional(),
  recheck: z.object({
    required:  z.boolean().optional(),
    completed: z.boolean().optional(),
    passed:    z.boolean().nullable().optional(),
  }).optional(),
})

/**
 * Extracts a well-formed CompassPedagogyState from one turn's raw model
 * output, or null if the block is absent, malformed, or logically
 * inconsistent. Never throws.
 */
export function parsePedagogyBlock(rawOutput: string): CompassPedagogyState | null {
  const startIdx = rawOutput.indexOf(PEDAGOGY_START)
  const endIdx   = rawOutput.indexOf(PEDAGOGY_END)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const jsonText = rawOutput.slice(startIdx + PEDAGOGY_START.length, endIdx).trim()

  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return null
  }

  const result = RawPedagogySchema.safeParse(raw)
  if (!result.success) return null

  return normalizePedagogyState(result.data)
}

/**
 * Enforces the invariants an untrusted model output must never be allowed
 * to violate: a re-check can only be reported as passed if it actually ran
 * AND remediation was actually completed first. Any impossible combination
 * is corrected to the conservative (non-mastery) value rather than rejected
 * outright, so a partially-sensible turn still contributes a usable state.
 */
function normalizePedagogyState(raw: z.infer<typeof RawPedagogySchema>): CompassPedagogyState {
  const remediation = {
    started:   raw.remediation?.started ?? false,
    completed: raw.remediation?.completed ?? false,
  }

  const rawRecheck = {
    required:  raw.recheck?.required ?? false,
    completed: raw.recheck?.completed ?? false,
    passed:    raw.recheck?.passed ?? null,
  }

  // A re-check cannot have passed if it never completed, or if remediation
  // that was supposed to precede it never completed either.
  const passed = rawRecheck.passed === true && rawRecheck.completed && remediation.completed
    ? true
    : rawRecheck.passed === true
      ? false // claimed true but the preconditions don't hold — downgrade, never propagate
      : rawRecheck.passed

  const recheck = { ...rawRecheck, passed }

  // A re-check reported as required implies a real misconception is in play;
  // 'unknown' is the safe default when the model omitted the type.
  const misconceptionType = raw.misconception_type ?? (recheck.required ? 'unknown' : null)

  return {
    decision: raw.decision,
    misconceptionType,
    concept: raw.concept ?? null,
    remediation,
    recheck,
  }
}

/** Removes the structured block from text shown to the learner. */
export function stripPedagogyBlock(text: string): string {
  const startIdx = text.indexOf(PEDAGOGY_START)
  const endIdx   = text.indexOf(PEDAGOGY_END)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return text
  return (text.slice(0, startIdx) + text.slice(endIdx + PEDAGOGY_END.length)).trim()
}

/**
 * True when an in-session misconception has an open re-check — i.e. one was
 * required and has not been demonstrably passed. Used to withhold mastery
 * evidence even if the model's separate end-of-session eval says
 * genuine_progress=true (see app/api/learn/route.ts).
 */
export function shouldBlockMasteryForPedagogy(state: CompassPedagogyState | null | undefined): boolean {
  if (!state) return false
  return state.recheck.required && state.recheck.passed !== true
}

const MISCONCEPTION_LABELS: Record<MisconceptionType, string> = {
  prerequisite_gap:               'prerequisite gap',
  concept_misunderstanding:       'concept misunderstanding',
  procedure_error:                'procedure error',
  vocabulary_language_confusion:  'vocabulary/language confusion',
  careless_error:                 'careless error',
  unknown:                        'possible gap',
}

/**
 * A short, deterministic (never model-authored) note appended to the
 * session's one_line_summary when it ends with an unresolved re-check —
 * this is the one channel that carries the hypothesis into the next
 * session's prompt (via lastSessionSummary), without a new memory system or
 * a permanent Projection-level fact. Empty string when there is nothing
 * unresolved.
 */
export function buildUnresolvedPedagogyNote(state: CompassPedagogyState | null | undefined): string {
  if (!shouldBlockMasteryForPedagogy(state)) return ''
  const label = MISCONCEPTION_LABELS[state!.misconceptionType ?? 'unknown']
  const concept = state!.concept ? ` around "${state!.concept}"` : ''
  return ` Note: a possible ${label}${concept} was not yet resolved — check in on this next session.`
}
