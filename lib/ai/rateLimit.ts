// lib/ai/rateLimit.ts
// Abuse-prevention daily call caps — secondary layer after token/subscription access.
// Primary access control lives in lib/payments/access.ts.
// Reads from ai_call_logs (the table lib/ai/logger.ts already writes to — no extra table).

import { createServiceClient } from '@/utils/supabase/service'
import type { TokenFeature } from '@/lib/payments/config'

// Per-user per-feature daily call caps, reset at UTC midnight.
// Hard safety limits against runaway costs from bugs or compromised accounts.
export const DAILY_CALL_LIMITS: Record<TokenFeature, number> = {
  sow_generate:         10,
  lesson_plan_generate: 20,
  row_generate:         20,
  slides_generate:      10,
  clinic_report:        5,
  learning_compass:     30,
}

export type RateLimitResult =
  | { allowed: true;  callsToday: number; limit: number }
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

/**
 * Checks if a user has exceeded their daily call cap for a feature.
 * Only counts successful calls (success = true) from ai_call_logs.
 * Fails open — if the DB check itself errors, the call is allowed through
 * rather than blocking a legitimate user because of a monitoring failure.
 *
 * Call this after checkFeatureAccess() passes, before making the AI request.
 */
export async function checkDailyCallLimit(
  userId: string,
  feature: TokenFeature
): Promise<RateLimitResult> {
  const db = createServiceClient()
  const limit = DAILY_CALL_LIMITS[feature]

  const { count, error } = await db
    .from('ai_call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('success', true)
    .gte('created_at', utcMidnightToday())

  if (error) {
    return { allowed: true, callsToday: 0, limit }
  }

  const callsToday = count ?? 0

  if (callsToday >= limit) {
    return { allowed: false, callsToday, limit, resetAt: utcMidnightTomorrow() }
  }

  return { allowed: true, callsToday, limit }
}

/**
 * Returns today's call counts for every feature for a given user.
 * Runs all feature queries in parallel for a single round-trip cost.
 * Used by the /api/ai/usage endpoint.
 */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const db = createServiceClient()
  const since = utcMidnightToday()
  const features = Object.keys(DAILY_CALL_LIMITS) as TokenFeature[]

  const results = await Promise.all(
    features.map(feature =>
      db
        .from('ai_call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature', feature)
        .eq('success', true)
        .gte('created_at', since)
        .then(({ count }) => ({ feature, callsToday: count ?? 0 }))
    )
  )

  return Object.fromEntries(
    results.map(({ feature, callsToday }) => {
      const limit = DAILY_CALL_LIMITS[feature]
      return [feature, { callsToday, limit, remaining: Math.max(0, limit - callsToday) }]
    })
  ) as DailyUsage
}
