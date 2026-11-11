import { randomBytes } from 'node:crypto'

// 24 random bytes = 192 bits of entropy (CSPRNG: crypto.randomBytes), encoded
// as base64url — 6 bits per character — which is exactly 32 characters with no
// padding. This is base64url, NOT hexadecimal: 32 hex characters would only be
// 128 bits. The legacy 12-hex-character (48-bit) tokens are retired and are
// rejected everywhere (this pattern, the database lookup, and a table CHECK).
export const SHARE_TOKEN_BYTES = 24
export const SHARE_TOKEN_LENGTH = 32

// Must stay in step with get_shared_report_by_token() and the
// shared_reports_token_format CHECK in 20261104120000_shared_reports_token_boundary.sql.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/

export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url')
}

export function isWellFormedShareToken(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}
