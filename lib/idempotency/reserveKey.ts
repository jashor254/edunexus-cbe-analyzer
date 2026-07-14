// lib/idempotency/reserveKey.ts
//
// Generic idempotency guard for write-with-side-effect API routes (Sprint —
// Production Hardening Audit). Deliberately its own table
// (idempotency_keys), not a column on learner_evidence or
// student_promotions: both are ratified, closed schemas, and "was this
// exact client request already processed" is a transport concern, not a
// fact about the learner.

import { createServiceClient } from '@/utils/supabase/service'

/**
 * Atomically claims (scope, key). Returns false if this exact key was
 * already claimed under this scope — a retry of an already-processed
 * request, so the caller should skip the side effect. Returns true the
 * first time, meaning it's safe to proceed.
 */
export async function reserveIdempotencyKey(scope: string, key: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from('idempotency_keys').insert({ scope, key })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`reserveIdempotencyKey: ${error.message}`)
}
