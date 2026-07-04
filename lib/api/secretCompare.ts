// lib/api/secretCompare.ts
// Timing-safe comparison for shared-secret auth (cron jobs, admin endpoints).
// Plain `===`/`!==` on secrets is vulnerable to timing attacks — use this everywhere instead.

import { timingSafeEqual } from 'crypto'

export function timingSafeEqualString(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false

  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')

  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
