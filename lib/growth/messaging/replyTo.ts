/**
 * Phase 1 (client-acquisition reply-loop fix) — the single source of truth for
 * the cold-outreach reply destination.
 *
 * Why this exists: cold emails were sent with no `reply-to`, so replies fell
 * back to the `From:` (hello@edunexus.co.ke), which has no inbox behind it
 * (see lib/resend-client.ts) — replies silently vanished. This resolver forces
 * every outreach send to carry an explicit, env-configured, monitored address
 * (dennis@edunexus.co.ke via ImprovMX), and **fails closed**: if the address is
 * missing or malformed it throws, so the sender refuses to send rather than
 * delivering to a dead inbox.
 *
 * Deliberately NOT hardcoded to a personal address — the value lives in the
 * GROWTH_OUTREACH_REPLY_TO environment variable so the monitored inbox can
 * change without a code edit.
 */

export const GROWTH_OUTREACH_REPLY_TO_ENV = 'GROWTH_OUTREACH_REPLY_TO'

/** Pragmatic single-address check — not RFC-complete, just enough to reject blanks, lists, and obvious typos before a send. */
function isPlausibleSingleEmail(value: string): boolean {
  if (/[\s,;]/.test(value)) return false // no whitespace, no comma/semicolon lists
  return /^[^@]+@[^@]+\.[^@]+$/.test(value)
}

/**
 * Returns the configured, validated outreach reply-to address, or throws with a
 * descriptive message naming the env var to set. `env` is injectable for tests.
 */
export function resolveOutreachReplyTo(env: Record<string, string | undefined> = process.env): string {
  const raw = env[GROWTH_OUTREACH_REPLY_TO_ENV]
  const value = raw?.trim() ?? ''

  if (!value) {
    throw new Error(
      `${GROWTH_OUTREACH_REPLY_TO_ENV} is not set — refusing to send cold outreach with no monitored reply-to. ` +
        `Set it to the inbox that receives replies (e.g. dennis@edunexus.co.ke via ImprovMX).`,
    )
  }
  if (!isPlausibleSingleEmail(value)) {
    throw new Error(
      `${GROWTH_OUTREACH_REPLY_TO_ENV}="${value}" is not a single valid email address — refusing to send cold outreach.`,
    )
  }
  return value
}
