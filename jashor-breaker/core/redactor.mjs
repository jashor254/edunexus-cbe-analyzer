import { createHash } from 'node:crypto'

// Secret patterns. Every pattern is deterministic; none verifies liveness
// (verification would require a network call, which v0 forbids).
/** @type {{id:string, re:RegExp, severity:'low'|'medium'|'high'|'critical', classification:'suspected'|'unverified', label:string}[]} */
export const SECRET_PATTERNS = [
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g, severity: 'critical', classification: 'suspected', label: 'Private key block' },
  { id: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'high', classification: 'suspected', label: 'AWS access key id' },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, severity: 'high', classification: 'suspected', label: 'GitHub token' },
  { id: 'supabase-secret-key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g, severity: 'critical', classification: 'suspected', label: 'Supabase secret key' },
  { id: 'paystack-live-key', re: /\bsk_live_[A-Za-z0-9]{20,}/g, severity: 'critical', classification: 'suspected', label: 'Paystack live secret key' },
  { id: 'paystack-test-key', re: /\bsk_test_[A-Za-z0-9]{20,}/g, severity: 'medium', classification: 'suspected', label: 'Paystack test secret key' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'high', classification: 'suspected', label: 'JWT (may be a service-role or legacy key)' },
  {
    id: 'generic-secret-assignment',
    re: /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD)[A-Z0-9_]*\s*[:=]\s*(['"])(?![^'"]*(?:process\.env|example|placeholder|your[_-]|xxx|\$\{|<))[^'"\s]{16,}\1/gi,
    severity: 'medium', classification: 'unverified', label: 'Hard-coded secret-like assignment',
  },
]

/** Short, non-reversible tag so the same secret can be deduplicated without being stored. */
export function fingerprint(secret) {
  return createHash('sha256').update(secret).digest('hex').slice(0, 8)
}

const TEST_PATH = /(\.test\.|\.spec\.|\/__tests__\/|\/fixtures?\/|\/testing\/|^test\/)/
const PLACEHOLDER = /(^|[^a-z])(dummy|fake|sample|changeme|mock|test)([^a-z]|$)|x{4,}|0{6,}|1234/i

/** Shannon entropy in bits per character. */
export function shannon(s) {
  if (!s) return 0
  const counts = new Map()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) h -= (n / s.length) * Math.log2(n / s.length)
  return h
}

/**
 * Safe false-positive triage. Runs on the RAW match inside this module so the
 * raw value never leaves it; only a verdict and reason ids are returned.
 *
 * Safety properties:
 *  - Never suppresses: a "likely-false-positive" is still reported (as info), just ranked last.
 *  - Only the weak generic-assignment pattern can ever be called a likely false positive.
 *    Specific-prefix patterns (private keys, AWS, GitHub, Supabase, Paystack, JWT) are always
 *    "needs-review", even in test files, because fixtures sometimes hold real keys.
 *  - Path signals (test/docs) are recorded as reasons but never decide the verdict alone.
 * @returns {{verdict:'likely-false-positive'|'needs-review', reasons:string[]}}
 */
export function triage(pattern, raw, file = '') {
  const reasons = []
  if (TEST_PATH.test(file)) reasons.push('test-path')
  if (/\.mdx?$/.test(file)) reasons.push('docs-path')
  let decisive = false
  if (pattern.id === 'generic-secret-assignment') {
    const value = /[:=]\s*['"]([^'"\s]+)['"]/.exec(raw)?.[1] ?? ''
    if (/^env\(/.test(value)) { reasons.push('env-indirection'); decisive = true }
    if (PLACEHOLDER.test(value)) { reasons.push('placeholder-value'); decisive = true }
    if (value && shannon(value) < 3) { reasons.push('low-entropy'); decisive = true }
  }
  return { verdict: decisive ? 'likely-false-positive' : 'needs-review', reasons }
}

/**
 * Replace every secret match in a line with a redaction token.
 * @param {string} line
 * @param {{file?:string}} [opts]
 * @returns {{redacted:string, hits:{patternId:string, tag:string, triage:{verdict:string, reasons:string[]}}[]}}
 */
export function redactLine(line, { file = '' } = {}) {
  let out = line
  const hits = []
  for (const p of SECRET_PATTERNS) {
    out = out.replace(new RegExp(p.re.source, p.re.flags), (m) => {
      const tag = fingerprint(m)
      hits.push({ patternId: p.id, tag, triage: triage(p, m, file) })
      return `[REDACTED:${p.id}:${tag}]`
    })
  }
  if (out.length > 200) out = `${out.slice(0, 200)}…`
  return { redacted: out, hits }
}

/** Defence in depth: true if any known secret pattern still matches. */
export function containsSecret(text) {
  return SECRET_PATTERNS.some((p) => new RegExp(p.re.source, p.re.flags).test(text))
}
