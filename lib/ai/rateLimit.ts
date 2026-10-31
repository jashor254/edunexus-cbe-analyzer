// lib/ai/rateLimit.ts
// Abuse-prevention daily call caps — secondary layer after token/subscription access.
// Primary access control lives in lib/payments/access.ts.
//
// Unit of account: one LOGICAL operation per feature (one SOW, one week of
// lesson plans, one essay, one Compass session start…) — never a provider
// request, retry or fallback. Each operation reserves one quota row in
// ai_call_logs (model = AI_QUOTA_MODEL_MARKER) before its AI work and
// releases it if the operation fails, so only successful operations count.
//
// The previous version only READ ai_call_logs by TokenFeature key, but almost
// no caller ever wrote a row under that key — the caps for 10 of 11 features
// counted zero forever (docs/audits/ai-call-efficiency-deep-audit.md F-01).
// Reserving here, at the one place that also enforces, makes it impossible
// for a feature to be capped but never counted.

import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'
import type { TokenFeature } from '@/lib/payments/config'

// Per-user per-feature daily caps, reset at UTC midnight.
// Hard safety limits against runaway costs from bugs or compromised accounts.
export const DAILY_CALL_LIMITS: Record<TokenFeature, number> = {
  sow_generate:               10,
  lesson_plan_generate:       20,
  row_generate:               20,
  slides_generate:            10,
  remedial_planner:           10,
  holiday_plan:               30,
  clinic_report:              5,
  learning_compass:           30,
  career_intelligence_report: 2,
  adaptive_variant_generate:  40,
  // Unknown-career AI generation only (lib/career/knowledgeRequests.ts) — never
  // gates ordinary canonical DB search. Conservative like clinic_report: this
  // is an ungrounded free-generation call (Phase 9 finding), not a cheap lookup.
  career_knowledge_request:   5,
  class_reports_generate:     5,
  // Per essay, not per pack — a teacher marking a class set in one sitting.
  kiswahili_insha_pack:       60,
  teaching_quick_check:       30,
}

export type DailyCallReservation =
  | { allowed: true;  callsToday: number; limit: number; release: (reason: string) => Promise<void> }
  | { allowed: false; callsToday: number; limit: number; resetAt: string }

export type DailyUsage = Record<
  TokenFeature,
  { callsToday: number; limit: number; remaining: number }
>

function utcMidnightToday(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function utcMidnightTomorrow(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

const NO_OP_RELEASE = async (): Promise<void> => {}

/**
 * Reserves one unit of a feature's daily cap for `userId`. Call it after
 * checkFeatureAccess() passes and immediately before the operation's AI
 * work; call `release(reason)` if the operation then fails, so a failed
 * operation never counts against the user.
 *
 * Concurrency: reserve-then-recount. Every request inserts its row first and
 * only then counts, so N concurrent requests racing for the last slot can
 * never all be admitted — at worst all of them see the overshoot and are
 * refused (conservative, never over-admits). A request refused after
 * inserting releases its own row.
 *
 * Fails OPEN, loudly: if the quota store itself errors, the operation is
 * allowed (a monitoring failure must not block a teacher's lesson plan) and
 * an error is logged so a broken cap is visible, never silent.
 */
export async function reserveDailyCall(
  userId: string,
  feature: TokenFeature
): Promise<DailyCallReservation> {
  const limit = DAILY_CALL_LIMITS[feature]
  const since = utcMidnightToday()

  try {
    // Cheap pre-check: an already-exhausted cap is refused without a write.
    const before = await repos.analytics.countQuotaReservations(userId, feature, since)
    if (before >= limit) {
      return { allowed: false, callsToday: before, limit, resetAt: utcMidnightTomorrow() }
    }

    const reservationId = await repos.analytics.insertQuotaReservation(userId, feature)
    const after = await repos.analytics.countQuotaReservations(userId, feature, since)

    if (after > limit) {
      await repos.analytics.releaseQuotaReservation(reservationId, 'refused: daily cap reached concurrently')
      return { allowed: false, callsToday: after - 1, limit, resetAt: utcMidnightTomorrow() }
    }

    let released = false
    return {
      allowed: true,
      callsToday: after,
      limit,
      release: async (reason: string): Promise<void> => {
        if (released) return
        released = true
        try {
          await repos.analytics.releaseQuotaReservation(reservationId, reason)
        } catch (err) {
          logger.error('AI quota release failed — a failed operation will still count against the cap', { operation: 'ai.rateLimit.release', feature, user_id: userId }, err)
        }
      },
    }
  } catch (err) {
    logger.error('AI daily cap unavailable — failing open for this request', { operation: 'ai.rateLimit.reserve', feature, user_id: userId }, err)
    return { allowed: true, callsToday: 0, limit, release: NO_OP_RELEASE }
  }
}

/**
 * Returns today's quota usage for every feature for a given user.
 * Read-only — never reserves. Used by the /api/ai/usage endpoint.
 */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const since = utcMidnightToday()
  const features = Object.keys(DAILY_CALL_LIMITS) as TokenFeature[]

  const results = await Promise.all(
    features.map(async feature => ({
      feature,
      callsToday: await repos.analytics.countQuotaReservations(userId, feature, since),
    }))
  )

  return Object.fromEntries(
    results.map(({ feature, callsToday }) => {
      const limit = DAILY_CALL_LIMITS[feature]
      return [feature, { callsToday, limit, remaining: Math.max(0, limit - callsToday) }]
    })
  ) as DailyUsage
}

/** An allowed reservation — what a route holds while its AI work runs. */
export type HeldReservation = Extract<DailyCallReservation, { allowed: true }>

/**
 * Thrown by `reserveDailyCallOrThrow` when the cap is exhausted. Lets a
 * reservation be taken from inside a library hook (e.g. "just before the
 * first AI call of a week") and still surface at the route as a 429.
 */
export class DailyLimitExceededError extends Error {
  constructor(readonly limit: number, readonly resetAt: string, readonly feature: TokenFeature) {
    super(`Daily limit of ${limit} reached for ${feature}. Resets at ${resetAt}`)
    this.name = 'DailyLimitExceededError'
  }
}

export async function reserveDailyCallOrThrow(userId: string, feature: TokenFeature): Promise<HeldReservation> {
  const r = await reserveDailyCall(userId, feature)
  if (r.allowed === false) throw new DailyLimitExceededError(r.limit, r.resetAt, feature)
  return r
}

/** Shared 429 message so every capped route words the refusal the same way. */
export function dailyLimitMessage(r: { limit: number; resetAt: string }, what: string): string {
  return `Daily limit of ${r.limit} ${what} reached. Resets at ${r.resetAt}`
}
