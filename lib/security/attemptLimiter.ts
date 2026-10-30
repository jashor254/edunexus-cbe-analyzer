// lib/security/attemptLimiter.ts
//
// Application wrapper over the database-backed limiter
// (public.rate_limit_reserve / rate_limit_release,
// supabase/migrations/20261030121000_rate_limit_attempts.sql).
//
// Database-backed on purpose: an in-memory counter is per serverless
// instance, so it is not a limit at all once Vercel runs more than one.
//
// FAILS CLOSED. If the limiter cannot be consulted, reserveAttempt throws
// AttemptLimiterUnavailableError and the caller must refuse the action —
// a broken limiter must never become an unlimited one.

import { createServiceClient } from '@/utils/supabase/service'
import { logger } from '@/lib/observability/logger'

/**
 * The limiter could not be consulted, so the guarded action must not run.
 * `message` is deliberately user-safe — many routes show err.message in their
 * error response — while the database detail goes to the server log only.
 */
export class AttemptLimiterUnavailableError extends Error {
  readonly detail: string
  constructor(detail: string) {
    super('Usage limits are temporarily unavailable. Please try again shortly.')
    this.name = 'AttemptLimiterUnavailableError'
    this.detail = detail
    logger.error('attempt limiter unavailable — refusing the guarded action', { service: 'attempt-limiter', detail })
  }
}

export type AttemptReservation = { id: string }

type LimiterDeps = {
  /** Injected only by tests — production always uses the service client. */
  db?: ReturnType<typeof createServiceClient>
}

export type ReserveAttemptInput = {
  bucket:  string
  /** Server-derived identity (authenticated user id, trusted client IP) — never a request field. */
  subject: string
  limit:   number
  /** Start of the counting window: rows older than this no longer count. */
  since:   Date
}

/** Reserves one attempt. Returns null when the subject is at its limit; throws when the limiter is unavailable. */
export async function reserveAttempt(
  input: ReserveAttemptInput,
  deps: LimiterDeps = {}
): Promise<AttemptReservation | null> {
  const db = deps.db ?? createServiceClient()
  const { data, error } = await db.rpc('rate_limit_reserve', {
    p_bucket:  input.bucket,
    p_subject: input.subject,
    p_limit:   input.limit,
    p_since:   input.since.toISOString(),
  })
  if (error) {
    throw new AttemptLimiterUnavailableError(`reserveAttempt(${input.bucket}): ${error.message}`)
  }
  return typeof data === 'string' ? { id: data } : null
}

/**
 * Refunds a reservation so it no longer counts. A failed refund only ever
 * costs the subject one slot (the safe direction), so it is logged rather
 * than surfaced to a caller whose action already succeeded.
 */
export async function releaseAttempt(
  reservation: AttemptReservation,
  deps: LimiterDeps = {}
): Promise<void> {
  const db = deps.db ?? createServiceClient()
  const { error } = await db.rpc('rate_limit_release', { p_id: reservation.id })
  if (error) {
    logger.warn('releaseAttempt: refund failed; the attempt still counts', { service: 'attempt-limiter' }, error)
  }
}

/**
 * Current counts per bucket for one subject since `since`, in one query.
 * Display-only (e.g. "N of M used today") — enforcement always goes through
 * reserveAttempt. Throws on a database error rather than reporting 0.
 */
export async function countAttempts(
  input: { buckets: string[]; subject: string; since: Date },
  deps: LimiterDeps = {}
): Promise<Record<string, number>> {
  if (input.buckets.length === 0) return {}
  const db = deps.db ?? createServiceClient()
  const { data, error } = await db
    .from('rate_limit_attempts')
    .select('bucket')
    .in('bucket', input.buckets)
    .eq('subject', input.subject)
    .gte('created_at', input.since.toISOString())
  if (error) throw new AttemptLimiterUnavailableError(`countAttempts: ${error.message}`)

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ bucket: string }>) counts[row.bucket] = (counts[row.bucket] ?? 0) + 1
  return counts
}

/** Window start for a rolling window of `windowMs` ending now. */
export function rollingWindowStart(windowMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - windowMs)
}
