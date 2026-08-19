// lib/core/transferTokens.ts
//
// Phase 2D Step 7/8/12 — transfer-continuity token cryptography. Reuses the
// exact Web Crypto pattern already proven in lib/organizations/utils.ts's
// generateApiKey()/hashApiKey() (32-byte random, hex-encoded, SHA-256 hash
// for storage) rather than inventing a second scheme — that module's
// pattern is API-key shaped (en_{env}_{hex} with a stored prefix), which
// doesn't fit a single-use transfer handshake, so this is a sibling
// implementation of the same primitive, not a duplicate import: the raw
// token itself is what's returned to the caller ONCE (Step 7) and is never
// persisted anywhere — only its hash is stored (learner_transfer_tokens.token_hash).
//
// TTL is centralized in lib/config/constants.ts (TRANSFER_TOKEN_TTL_DAYS)
// per CLAUDE.md's "no hardcoded costs/limits/TTLs" rule.

import { TRANSFER_TOKEN_TTL_DAYS } from '@/lib/config/constants'

/** A high-entropy, URL-safe raw transfer token — 32 random bytes, hex-encoded (64 chars). Never persisted; only its hash is stored. */
export function generateTransferToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-256 hex digest of a raw transfer token — the only form ever written to `learner_transfer_tokens.token_hash`. */
export async function hashTransferToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawToken)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** The expiry timestamp (ISO string) for a transfer token issued right now, per the centralized TTL config. */
export function transferTokenExpiryFromNow(): string {
  const expiresAt = new Date(Date.now() + TRANSFER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  return expiresAt.toISOString()
}
