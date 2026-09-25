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
