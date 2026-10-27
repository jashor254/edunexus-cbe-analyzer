// lib/compass/namePseudonym.ts
//
// Keeps the learner's real name out of Compass prompts sent to external AI
// providers (Gemini / DeepSeek), reusing the shared LEARNER_NAME_TOKEN scheme
// (lib/ai/learnerPseudonym.ts). The prompt carries the token; the model writes
// the token back; we restore the real name locally before it reaches the
// learner.
//
// Compass is streamed, so restoration must be split-safe: the token can land
// across two SSE chunks ("{{LEA" then "RNER}}"). makeNameRestorer() buffers a
// trailing fragment that might be an incomplete token until the next chunk (or
// flush) resolves it. See docs/audits/learner-data-privacy-remediation-plan.md
// Stage B2.

import { LEARNER_NAME_TOKEN } from '@/lib/ai/learnerPseudonym'

const TOKEN_PATTERN = /\{\{\s*LEARNER\s*\}\}/g
// The exact literal we emit into prompts (lib/ai/learnerPseudonym.ts). Stream
// hold-back is computed against this literal: a trailing fragment that is a
// proper prefix of it ("{", "{{", "{{LEA", …) might still grow into a full
// token on the next chunk, so it is held back rather than emitted raw.
const TOKEN_LITERAL = '{{LEARNER}}'

/**
 * Replacement for name parts OTHER than the first name (e.g. a surname the
 * learner types). Deliberately not restored: unlike the first name, nothing in
 * the tutoring needs it, so it simply never leaves.
 */
export const OTHER_NAME_PART_TOKEN = '[name]'

/** True first name only — never 'there'/empty (nothing to protect then). */
function isRealName(firstName: string): boolean {
  return firstName.trim().length > 0 && firstName.trim().toLowerCase() !== 'there'
}

// ASCII apostrophe, right/left single quotes, modifier-letter apostrophe, backtick.
const APOSTROPHE_CHARS = "'\\u2019\\u2018\\u02BC`"
const APOSTROPHES = new RegExp(`[${APOSTROPHE_CHARS}]`, 'gu')

/** Drops combining marks so "Wanjirũ" and "Wanjiru" compare equal. */
function foldMarks(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '')
}

/**
 * Whole-word, case-insensitive, accent-insensitive matcher for one name part.
 * Word edges are Unicode letters/marks — JS `\b` is ASCII-only, so a name
 * ending in "ũ"/"ĩ" (common in Kikuyu names) would never match with `\b`.
 * Returns null for parts too short to scrub safely (single letters/initials).
 */
function namePartPattern(part: string): RegExp | null {
  // Apostrophes are optional and interchangeable: "Ng'ang'a" (stored) must match
  // "Ng’ang’a" (phone keyboards) and "Nganga" (typed without), and vice versa.
  const folded = foldMarks(part.trim()).replace(APOSTROPHES, '')
  if ([...folded].filter(ch => /\p{L}/u.test(ch)).length < 2) return null
  const body = [...folded]
    .map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\p{M}*')
    .join(`[${APOSTROPHE_CHARS}]?`)
  return new RegExp(`(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])`, 'giu')
}

/** Text is matched in NFD (so marks are separable) and returned as NFC. */
function replaceNamePart(text: string, part: string, replacement: string): string {
  const pattern = namePartPattern(part)
  if (!pattern) return text
  return text.normalize('NFD').replace(pattern, replacement).normalize('NFC')
}

/**
 * Replaces whole-word, case-insensitive, accent-insensitive occurrences of the
 * learner's first name in text the learner (or we) are about to send to an
 * external model with LEARNER_NAME_TOKEN. No-op when there is no real name to
 * protect.
 *
 * Known limits (documented, not hidden): it only knows the name it is given —
 * classmates', teachers' or misspelled names pass through; and a first name
 * that is also an ordinary word ("Hope", "Will") is replaced wherever that
 * word appears, which can make a sentence read oddly to the model.
 */
export function scrubLearnerName(text: string, firstName: string): string {
  if (!isRealName(firstName)) return text
  return replaceNamePart(text, firstName, LEARNER_NAME_TOKEN)
}

export type LearnerIdentity = {
  /** The first name restored into the learner's view (route's `firstName`). */
  firstName: string
  /** The stored full name, if known — its other parts are scrubbed too. */
  fullName: string | null
}

/**
 * scrubLearnerName plus every other part of the stored full name (surname,
 * middle names) → OTHER_NAME_PART_TOKEN. This removes the learner's own direct
 * name identifiers; it does not de-identify or anonymise the text.
 */
export function scrubLearnerIdentity(text: string, identity: LearnerIdentity): string {
  let out = scrubLearnerName(text, identity.firstName)
  const comparable = (s: string): string => foldMarks(s.trim()).replace(APOSTROPHES, '').toLowerCase()
  const first = comparable(identity.firstName)
  const otherParts = (identity.fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(part => part.length > 0 && comparable(part) !== first)
  for (const part of otherParts) out = replaceNamePart(out, part, OTHER_NAME_PART_TOKEN)
  return out
}

export type NameRestorer = {
  /** Feed a streamed chunk; returns the text safe to emit now (tokens restored). */
  push(content: string): string
  /** Emit any held-back trailing fragment (tokens restored). Call once at end. */
  flush(): string
}

/**
 * Stateful, split-safe restorer of LEARNER_NAME_TOKEN -> firstName for a stream.
 * Holds back a trailing fragment that could be an incomplete token so a token
 * split across chunk boundaries is never emitted half-restored.
 */
export function makeNameRestorer(firstName: string): NameRestorer {
  let carry = ''
  const name = firstName
  return {
    push(content: string): string {
      let buf = carry + content
      buf = buf.replace(TOKEN_PATTERN, name)
      // Hold back the longest trailing fragment that is a proper prefix of the
      // token literal — it could still complete into a token on the next chunk.
      for (let k = Math.min(TOKEN_LITERAL.length - 1, buf.length); k >= 1; k--) {
        if (buf.endsWith(TOKEN_LITERAL.slice(0, k))) {
          carry = buf.slice(buf.length - k)
          return buf.slice(0, buf.length - k)
        }
      }
      carry = ''
      return buf
    },
    flush(): string {
      const out = carry.replace(TOKEN_PATTERN, name)
      carry = ''
      return out
    },
  }
}
