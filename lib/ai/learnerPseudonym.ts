// lib/ai/learnerPseudonym.ts
// Keeps learner names out of prompts sent to third-party LLM providers.
//
// A prompt carries LEARNER_NAME_TOKEN wherever it would have carried the
// learner's name; the model writes the token back in its output, and
// restoreLearnerName() swaps the real first name in locally after the
// response returns. The name never leaves our infrastructure.
//
// This removes direct identifiers only — grade, subject levels and learning
// gaps are still sent, because they are the content the model reasons over.
// Same approach remedial/planner.ts already takes (`Student (xxxx)`).

export const LEARNER_NAME_TOKEN = '{{LEARNER}}'

const TOKEN_PATTERN = /\{\{\s*LEARNER\s*\}\}/g

/** First word of a stored full name, used to fill LEARNER_NAME_TOKEN back in. */
export function learnerFirstName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0]
  return first || 'your child'
}

/**
 * Replaces every LEARNER_NAME_TOKEN in a model response with the learner's
 * first name. Walks strings, arrays and plain objects so a parsed JSON
 * response can be restored in one call; other values pass through untouched.
 */
export function restoreLearnerName<T>(value: T, firstName: string): T {
  return restore(value, firstName) as T
}

function restore(value: unknown, firstName: string): unknown {
  if (typeof value === 'string') return value.replace(TOKEN_PATTERN, firstName)
  if (Array.isArray(value)) return value.map(item => restore(item, firstName))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, restore(item, firstName)]),
    )
  }
  return value
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The outbound half of the scheme, for text the application did not write
 * itself — a learner's own message, stored conversation history, an earlier
 * model summary that has already been restored. Replaces whole-word
 * occurrences of `firstName` (case-insensitive) with LEARNER_NAME_TOKEN.
 *
 * Deliberately conservative about what it can promise: it removes the
 * learner's stored first name, not every possible identifier (a surname, a
 * nickname, or a classmate's name typed by the learner still passes through).
 * A name that is also an ordinary word ("Joy") is replaced in its ordinary
 * sense too — privacy wins that trade-off.
 */
export function pseudonymiseLearnerName(text: string, firstName: string | null | undefined): string {
  const name = (firstName ?? '').trim()
  if (name.length < 2) return text
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu')
  return text.replace(pattern, LEARNER_NAME_TOKEN)
}

const CANONICAL_TOKEN = LEARNER_NAME_TOKEN.replace(/\s+/g, '')

/**
 * Index from which `s` must be held back because it may be the start of a
 * LEARNER_NAME_TOKEN that the next chunk completes ("…well done {{LEA" +
 * "RNER}}!"). Everything before it is safe to emit now.
 */
function holdbackStart(s: string): number {
  const open = s.lastIndexOf('{')
  if (open === -1) return s.length
  const start = open > 0 && s[open - 1] === '{' ? open - 1 : open
  const tail = s.slice(start).replace(/\s+/g, '')
  return CANONICAL_TOKEN.startsWith(tail) && tail.length < CANONICAL_TOKEN.length ? start : s.length
}

/**
 * Streaming counterpart of restoreLearnerName(): feed it model output chunk
 * by chunk and it emits text with every LEARNER_NAME_TOKEN replaced by the
 * real first name — including a token split across chunk boundaries. Only a
 * trailing fragment that could still become a token is ever held back, so a
 * learner sees text as promptly as before. Call flush() once at the end.
 */
export function createLearnerNameStreamRestorer(firstName: string): {
  push: (chunk: string) => string
  flush: () => string
} {
  let pending = ''
  return {
    push(chunk: string): string {
      pending += chunk
      const cut = holdbackStart(pending)
      const ready = pending.slice(0, cut)
      pending = pending.slice(cut)
      return restoreLearnerName(ready, firstName)
    },
    flush(): string {
      const rest = restoreLearnerName(pending, firstName)
      pending = ''
      return rest
    },
  }
}
