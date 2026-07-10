// lib/errors/friendlyMessage.ts
//
// Turns a raw error string — a Supabase/Postgres error, a fetch failure, a
// DeepSeek timeout, or a bare "undefined"/"null" — into something a teacher
// can actually act on. Dozens of API routes across this app return
// `err instanceof Error ? err.message : 'fallback'` straight into the
// `error` field of the API response (see the pilot-readiness sprint's audit,
// HOTFIX 5), and just as many components render that string directly. This
// is the one place that translation happens, so every surface says the same
// kind of thing instead of each screen inventing its own wording.
//
// Not a replacement for good error messages at the source — routes should
// still throw/return something specific where they can. This is the safety
// net for the raw ones that slip through, and the shared vocabulary for
// deliberately-written ones (timeouts, retries) to plug into.

export type FriendlyError = {
  message: string
  retryable: boolean
}

const PATTERNS: Array<{ test: RegExp; friendly: FriendlyError }> = [
  {
    test: /timeout|timed out/i,
    friendly: { message: "This took longer than expected. Please try again.", retryable: true },
  },
  {
    test: /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND/i,
    friendly: { message: "A connection problem interrupted this. Please try again.", retryable: true },
  },
  {
    test: /rate limit|429|too many requests/i,
    friendly: { message: "Too much happened at once — please wait a moment and try again.", retryable: true },
  },
  {
    test: /PGRST116|coerce the result to a single|0 rows/i,
    friendly: { message: "We couldn't find that record. It may have been removed.", retryable: false },
  },
  {
    test: /permission denied|RLS|row-level security|not authorized|forbidden/i,
    friendly: { message: "You don't have access to do that.", retryable: false },
  },
  {
    test: /duplicate key|already exists|unique constraint/i,
    friendly: { message: "That already exists — no changes were made.", retryable: false },
  },
  {
    test: /^(undefined|null|\[object Object\]|)$/i,
    friendly: { message: "Something went wrong on our end. Nothing has been lost — please try again.", retryable: true },
  },
  {
    test: /5\d\d|internal server error|internal error/i,
    friendly: { message: "Something went wrong on our end. Nothing has been lost — please try again.", retryable: true },
  },
]

const LOOKS_TECHNICAL = /error:|Error:|at [A-Za-z.]+\s*\(|\.ts:\d+|\.js:\d+|stack trace|SyntaxError|TypeError|column ".*" does not exist|relation ".*" does not exist/i

/**
 * @param raw the error string as received from an API response's `error`
 *   field, or a caught Error's `.message`
 * @param fallback shown when `raw` doesn't match a known pattern but still
 *   looks safe to show verbatim (a route that already wrote a plain-language
 *   message, e.g. "Please choose a shorter holiday period.") — only used
 *   when `raw` does NOT look like leaked technical detail; otherwise the
 *   generic fallback below is used instead so a stray stack trace or SQL
 *   error can never reach a teacher's screen.
 */
export function friendlyMessage(raw: string | null | undefined, fallback?: string): FriendlyError {
  const text = (raw ?? '').trim()

  for (const { test, friendly } of PATTERNS) {
    if (test.test(text)) return friendly
  }

  if (!text || LOOKS_TECHNICAL.test(text)) {
    return { message: fallback ?? "Something went wrong on our end. Nothing has been lost — please try again.", retryable: true }
  }

  // Doesn't match a known technical signature and doesn't look like a stack
  // trace / raw SQL error — treat it as an already-human message a route
  // author wrote on purpose (e.g. a Zod validation message) and show it as-is.
  return { message: text, retryable: true }
}
