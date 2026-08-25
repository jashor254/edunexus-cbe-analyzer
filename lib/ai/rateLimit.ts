// lib/ai/rateLimit.ts
// Abuse-prevention daily call caps — secondary layer after token/subscription access.
// Primary access control lives in lib/payments/access.ts.
// Reads from ai_call_logs (the table lib/ai/logger.ts already writes to — no extra table).

import { repos } from '@/lib/repositories'
import type { TokenFeature } from '@/lib/payments/config'

// Per-user per-feature daily call caps, reset at UTC midnight.
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
  const limit = DAILY_CALL_LIMITS[feature]

  try {
    const callsToday = await repos.analytics.countAICallsByFeature(userId, feature, utcMidnightToday())
    if (callsToday >= limit) {
      return { allowed: false, callsToday, limit, resetAt: utcMidnightTomorrow() }
    }
    return { allowed: true, callsToday, limit }
  } catch {
    return { allowed: true, callsToday: 0, limit }
  }
}

/**
 * Returns today's call counts for every feature for a given user.
 * Runs all feature queries in parallel for a single round-trip cost.
 * Used by the /api/ai/usage endpoint.
 */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const since = utcMidnightToday()
  const features = Object.keys(DAILY_CALL_LIMITS) as TokenFeature[]

  const results = await Promise.all(
    features.map(async feature => ({
      feature,
      callsToday: await repos.analytics.countAICallsByFeature(userId, feature, since),
    }))
  )

  return Object.fromEntries(
    results.map(({ feature, callsToday }) => {
      const limit = DAILY_CALL_LIMITS[feature]
      return [feature, { callsToday, limit, remaining: Math.max(0, limit - callsToday) }]
    })
  ) as DailyUsage
}
