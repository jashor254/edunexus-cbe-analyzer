// lib/config/compassProviders.ts
//
// Which external AI providers the learner-facing Compass tutor may call, in
// order. Read from COMPASS_AI_PROVIDERS (comma-separated: "gemini",
// "deepseek"), e.g. COMPASS_AI_PROVIDERS=gemini,deepseek reproduces the
// historical Gemini-then-DeepSeek routing.
//
// FAIL-CLOSED: unset, empty or unrecognised values mean NO provider is
// allowed, and Compass is paused (the route returns 503 before any learner
// data is read for a prompt or sent anywhere). This is deliberate: whether a
// provider may serve a service used by under-18 learners is a contractual
// question (see docs privacy audits, 2026-10-21), and a provider must be
// opted in explicitly once that question is settled — never by default and
// never as a silent fallback. Other AI features are unaffected.

export type CompassProvider = 'gemini' | 'deepseek'

export const COMPASS_PROVIDERS_ENV = 'COMPASS_AI_PROVIDERS'

const KNOWN: readonly CompassProvider[] = ['gemini', 'deepseek']

/** Learner-facing message shown while no provider is approved for Compass. */
export const COMPASS_PAUSED_MESSAGE =
  'The Learning Compass tutor is paused while we complete a review of how it handles learner data. Your learning record is safe, and Compass will return as soon as the review is done.'

/**
 * Parses the allowed-provider list. Order is preserved (first = primary),
 * duplicates and unknown entries are dropped. Returns [] when Compass must stay
 * paused.
 */
export function resolveCompassProviders(
  raw: string | undefined = process.env[COMPASS_PROVIDERS_ENV],
): CompassProvider[] {
  if (!raw) return []
  const out: CompassProvider[] = []
  for (const token of raw.split(',')) {
    const name = token.trim().toLowerCase()
    if ((KNOWN as readonly string[]).includes(name) && !out.includes(name as CompassProvider)) {
      out.push(name as CompassProvider)
    }
  }
  return out
}
