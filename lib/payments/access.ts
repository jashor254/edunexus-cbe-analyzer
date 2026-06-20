// lib/payments/access.ts
//
// Central access gatekeeper for all token/subscription-gated features.
// Call checkFeatureAccess() at the top of every gated API route.
// Call deductFeatureTokens() AFTER a successful AI response — never before.
// No business logic lives in routes — only here.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
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

const accessCache = new Map<string, { result: AccessResult; expiresAt: number }>()
const CACHE_TTL_MS = 60_000

/**
 * Checks whether the currently authenticated user can use a gated feature.
 * Resolution order: admin → teacher-free → subscriber → token balance.
 * Always returns userId in the allowed result to avoid double auth calls in routes.
 *
 * getSession() reads the JWT from the cookie (no network round-trip). Safe here
 * because this is an access-check, not a security-critical write path.
 * The DB queries that follow are cached per user+feature for 60 seconds.
 */
export async function checkFeatureAccess(
  feature: FeatureKey
): Promise<AccessResult> {
  // 1. Auth — getSession() reads the local JWT cookie, no Supabase network call
  const supabase = await createClient()
  const { data: { session }, error: authError } = await supabase.auth.getSession()
  if (!session?.user || authError) {
    return { allowed: false, reason: 'unauthenticated' }
  }
  const user = session.user

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

  const db = createServiceClient()

  // 4. Single profiles query — covers admin role, teacher role, and secondary_role
  //    Replaces the separate isAdmin() DB call + profiles query that ran sequentially
  const { data: profile } = await db
    .from('profiles')
    .select('role, secondary_role')
    .eq('id', user.id)
    .maybeSingle()

  const primaryRole   = profile?.role         ?? 'parent'
  const secondaryRole = profile?.secondary_role ?? null

  // Admin role in profiles → full bypass
  if (primaryRole === 'admin') {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // A parent who is also a teacher gets teacher privileges on teacher-tier features
  const isTeacherRole = primaryRole === 'teacher' || secondaryRole === 'teacher'

  // 5. Teacher tier — free for teacher-designated features
  if (isTeacherRole) {
    const teacherAccess = FEATURE_ACCESS[feature].teacher
    if (teacherAccess === 'free') {
      return cacheAndReturn({ allowed: true, tier: 'teacher', deductTokens: false, userId: user.id })
    }
    // Teacher accessing a parent-tier feature (clinic, compass, career) → falls through
  }

  // 6. Subscription + token balance — fetched in parallel since both are needed
  //    to make a final decision when there's no subscription
  const [subscriptionRes, balanceRes] = await Promise.all([
    db.from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
    db.from('token_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (subscriptionRes.data) {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // 7. Token balance — last resort
  const cost      = TOKEN_COSTS[feature]
  const available = balanceRes.data?.balance ?? 0
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
  const db = createServiceClient()
  const { error } = await db.rpc('deduct_tokens', {
    p_user_id: userId,
    p_action:  feature,
    p_tokens:  cost,
    p_metadata: { feature, timestamp: new Date().toISOString() },
  })
  if (error) throw new Error(`Token deduction failed: ${error.message}`)
}
