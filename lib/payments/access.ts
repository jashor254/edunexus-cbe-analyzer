// lib/payments/access.ts
//
// Central access gatekeeper for all token/subscription-gated features.
// Call checkFeatureAccess() at the top of every gated API route.
// Call deductFeatureTokens() AFTER a successful AI response — never before.
// No business logic lives in routes — only here.

import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { resolveSchoolCoverage } from '@/lib/core/schoolEntitlement'
import {
  TOKEN_COSTS,
  FEATURE_ACCESS,
  type UserTier,
  type FeatureKey,
} from '@/lib/payments/config'

export type AccessResult =
  | { allowed: true;  tier: Exclude<UserTier, 'token' | 'none'>; deductTokens: false; userId: string }
  | { allowed: true;  tier: 'token'; deductTokens: true; cost: number; userId: string }
  | { allowed: false; reason: 'unauthenticated' | 'insufficient_tokens' | 'no_access' }

// In-process, per-server-instance, keyed on user+feature.
//
// MAXIMUM STALE-ACCESS WINDOW: 60 seconds. This is the documented bound on
// every entitlement change:
//   * School activated      → covered teachers may see the old denial for ≤60s.
//   * School suspended      → teachers may retain coverage for ≤60s.
//   * Membership deactivated (teacher leaves/transfers/retires)
//                           → the departed teacher may retain school-covered
//                             access for ≤60s, then resolves as uncovered.
//   * Replacement teacher added → covered within ≤60s of their first call.
//
// Not invalidated explicitly, and deliberately so: the map is per-instance and
// non-shared, so a correct invalidation would need a distributed channel this
// codebase has no infrastructure for today. A ≤60s window on a term-length
// institutional entitlement is not a security-relevant exposure — a departing
// teacher generating one more scheme of work a minute after their membership is
// deactivated is not the risk this phase exists to close.
const accessCache = new Map<string, { result: AccessResult; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

/**
 * Checks whether the currently authenticated user can use a gated feature.
 * Resolution order: admin → teacher-free → subscriber → token balance.
 * Always returns userId in the allowed result to avoid double auth calls in routes.
 *
 * getUser() validates the JWT with the Supabase server — revoked or tampered
 * tokens are rejected. The DB queries that follow are cached per user+feature
 * for 60 seconds.
 */
export async function checkFeatureAccess(
  feature: FeatureKey
): Promise<AccessResult> {
  // 1. Auth — getUser() performs server-side token validation (no cookie-only trust)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return { allowed: false, reason: 'unauthenticated' }
  }

  // 2. Cache check — short-circuits all DB queries after the first call
  const cacheKey = `${user.id}-${feature}`
  const cached = accessCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result
  }

  const cacheAndReturn = (result: AccessResult): AccessResult => {
    accessCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  }

  // 3. Fast-path admin email check — no DB needed
  if (user.email && (await import('@/lib/config/api')).ADMIN_CONFIG.isAdmin(user.email)) {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // 4. Single profiles query — covers admin role, teacher role, and secondary_role
  //    Replaces the separate isAdmin() DB call + profiles query that ran sequentially
  const profile = await repos.billing.findProfileRole(user.id)

  const primaryRole   = profile?.role         ?? 'parent'
  const secondaryRole = profile?.secondary_role ?? null

  // Admin role in profiles → full bypass
  if (primaryRole === 'admin') {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // A parent who is also a teacher gets teacher privileges on teacher-tier features
  const isTeacherRole = primaryRole === 'teacher' || secondaryRole === 'teacher'

  // 5. Teacher tier — free for teacher-designated features, but ONLY when
  //    that teacher's school holds an active EduNexus institutional
  //    entitlement. Role alone ('teacher' in profiles) is not sufficient —
  //    a Solo Teacher with no entitled school pays per service like any
  //    token user, same as everyone else. This is checked here, not
  //    inferred from role, because role is set at signup and never
  //    re-verified against whether a real, paying school stands behind it.
  //
  //    Coverage belongs to the SCHOOL and is inherited through an active
  //    school_users membership — see lib/core/schoolEntitlement.ts for the
  //    full chain. A departed teacher's membership goes inactive and
  //    coverage stops; their replacement inherits the same school
  //    entitlement through their own membership, with no repurchase.
  //
  //    This previously called repos.organizations.findUserOrganizations(),
  //    which queried `organization_members` — absent from production, so it
  //    threw PGRST205 and every non-admin teacher got a 500 (including on
  //    their free first SOW, since step 6b sits below this throw). The
  //    resolver now returns lookup failure as a value instead of throwing,
  //    and anything short of positive proof falls through to the personal
  //    teacher paths below rather than failing the request.
  if (isTeacherRole) {
    const teacherAccess = FEATURE_ACCESS[feature].teacher
    if (teacherAccess === 'free') {
      const coverage = await resolveSchoolCoverage(user.id)
      if (coverage.outcome === 'covered') {
        return cacheAndReturn({ allowed: true, tier: 'teacher', deductTokens: false, userId: user.id })
      }
      // Not covered, or the institutional lookup was unavailable → falls
      // through to first-SOW-free / subscription / token pricing below.
      // Never the reverse: absence of proof is never treated as coverage.
    }
    // Teacher accessing a parent-tier feature (clinic, compass, career) → falls through
  }

  // 6. Subscription + token balance — fetched in parallel since both are needed
  //    to make a final decision when there's no subscription
  const [subscription, balance] = await Promise.all([
    repos.billing.findActiveSubscription(user.id),
    repos.billing.findTokenBalance(user.id),
  ])

  if (subscription) {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // 6b. First-SOW trial — a genuinely first-ever Scheme of Work is free,
  //     for any teacher, affiliated or not (affiliated teachers already
  //     returned free at step 5; this specifically covers the self-teacher
  //     path). Checked against real SOW history, never a flag that could
  //     go stale — "first" means zero rows in schemes_of_work, checked now.
  if (feature === 'sow_generate') {
    const teacherId = await repos.billing.findTeacherIdByUserId(user.id)
    if (teacherId) {
      const priorSOWCount = await repos.curriculum.countByTeacher(teacherId)
      if (priorSOWCount === 0) {
        return cacheAndReturn({ allowed: true, tier: 'teacher', deductTokens: false, userId: user.id })
      }
    }
  }

  // 7. Token balance — last resort
  const cost      = TOKEN_COSTS[feature]
  const available = balance?.balance ?? 0
  if (available < cost) {
    return cacheAndReturn({ allowed: false, reason: 'insufficient_tokens' })
  }

  return cacheAndReturn({ allowed: true, tier: 'token', deductTokens: true, cost, userId: user.id })
}

/**
 * Atomically deducts tokens AFTER a successful AI response.
 * Throws on RPC failure so the caller can surface the error.
 * Never call this before the AI response succeeds.
 */
export async function deductFeatureTokens(
  userId: string,
  feature: FeatureKey,
  cost: number
): Promise<void> {
  await repos.billing.deductTokens(userId, feature, cost, {
    feature,
    timestamp: new Date().toISOString(),
  })
}
