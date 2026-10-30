// lib/ai/rateLimit.ts
// Abuse-prevention daily call caps — secondary layer after token/subscription access.
// Primary access control lives in lib/payments/access.ts.
//
// Enforced through the shared database-backed attempt limiter
// (lib/security/attemptLimiter.ts → public.rate_limit_reserve), one bucket per
// feature, window = the current UTC day. Security audit 2026-10-30, F-03/F-13 —
// the previous implementation counted successful ai_call_logs rows, which:
//   - never enforced at all for 12 of these 14 features: only the academy
//     judge, career knowledge requests and the teaching-intelligence
//     generators ever write ai_call_logs, and none of them under these keys
//     except career_knowledge_request, so every other count was always 0;
//   - let the AI call through whenever the count query failed (fail open);
//   - checked before the call and counted after it, so N parallel requests
//     all passed the same check.
// Each call now RESERVES its slot atomically before the provider is called,
// the check fails closed (AttemptLimiterUnavailableError), and a caller whose
// provider call fails can refund the slot with releaseDailyCall().

import type { TokenFeature } from '@/lib/payments/config'
import {
  reserveAttempt, releaseAttempt, countAttempts, type AttemptReservation,
} from '@/lib/security/attemptLimiter'

// Per-user per-feature daily call caps, reset at UTC midnight.
// Hard safety limits against runaway costs from bugs or compromised accounts.
// One unit = one request to the feature's route (a whole scheme, one lesson
// plan or week, one report, one essay…), counted when the request reserves
// it — not per underlying provider call.
export const DAILY_CALL_LIMITS: Record<TokenFeature, number> = {
  sow_generate:               10,
  lesson_plan_generate:       20,
  row_generate:               20,
  slides_generate:            10,
  remedial_planner:           10,
  holiday_plan:               30,
  clinic_report:              5,
  // Counted per NEW tutoring session (app/api/learn reserves only when no
  // sessionId is supplied) — the unit its 429 message has always promised.
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
  // One per lesson / mission / taught lesson plan — the same unit and cap as
  // lesson_plan_generate. Free teacher features, previously uncapped.
  academy_reflection_feedback:   20,
  academy_mission_feedback:      20,
  lesson_reflection_suggestions: 20,
  // Paper Intelligence, per teacher per day. Set well above real marking
  // volume — 300 scripts is five full 60-learner classes in one day — so a
  // genuine marking session never meets it, while scripted abuse of the
  // vision model stops. Revisit with real usage data.
  paper_script_marking:    300,
  paper_page_marking:      300,
  // One per assessment's marking scheme; re-extraction after a bad photo included.
  paper_rubric_extraction: 30,
}

export type RateLimitResult =
  | { allowed: true;  limit: number; reservation: AttemptReservation }
  | { allowed: false; limit: number; resetAt: string }

export type DailyUsage = Record<
  TokenFeature,
  { callsToday: number; limit: number; remaining: number }
>

/** The limiter bucket for a feature's daily cap. Part of the stored key — renaming resets counters. */
export function dailyCallBucket(feature: TokenFeature): string {
  return `ai_daily:${feature}`
}

function utcMidnightToday(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function utcMidnightTomorrow(): string {
  const d = utcMidnightToday()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

/**
 * Reserves one of today's calls for this user and feature, atomically.
 * `allowed: false` once the cap is reached. Throws
 * AttemptLimiterUnavailableError if the limiter cannot be consulted — the
 * caller must NOT make the AI request in that case.
 *
 * Call this after checkFeatureAccess() passes, before making the AI request.
 */
export async function checkDailyCallLimit(
  userId: string,
  feature: TokenFeature
): Promise<RateLimitResult> {
  const limit = DAILY_CALL_LIMITS[feature]
  const reservation = await reserveAttempt({
    bucket:  dailyCallBucket(feature),
    subject: userId,
    limit,
    since:   utcMidnightToday(),
  })
  if (!reservation) return { allowed: false, limit, resetAt: utcMidnightTomorrow() }
  return { allowed: true, limit, reservation }
}

/**
 * Refunds a reserved call whose provider request failed, so a failed
 * generation does not use up the user's day. Safe to call with a refused
 * result (no-op). Never call it after a successful generation.
 */
export async function releaseDailyCall(result: RateLimitResult): Promise<void> {
  if (result.allowed) await releaseAttempt(result.reservation)
}

/**
 * Returns today's reserved call counts for every feature for a given user,
 * from the same records the cap enforces against, in a single query.
 * Used by the /api/ai/usage endpoint.
 */
export async function getDailyUsage(userId: string): Promise<DailyUsage> {
  const features = Object.keys(DAILY_CALL_LIMITS) as TokenFeature[]
  const counts = await countAttempts({
    buckets: features.map(dailyCallBucket),
    subject: userId,
    since:   utcMidnightToday(),
  })

  return Object.fromEntries(
    features.map(feature => {
      const limit      = DAILY_CALL_LIMITS[feature]
      const callsToday = counts[dailyCallBucket(feature)] ?? 0
      return [feature, { callsToday, limit, remaining: Math.max(0, limit - callsToday) }]
    })
  ) as DailyUsage
}
