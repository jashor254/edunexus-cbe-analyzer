// lib/payments/access.ts
//
// Central access gatekeeper for all token/subscription-gated features.
// Call checkFeatureAccess() at the top of every gated API route.
// Call deductFeatureTokens() AFTER a successful AI response — never before.
// No business logic lives in routes — only here.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { isAdmin } from '@/lib/auth/isAdmin'
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
 * auth.getUser() always runs (security boundary). The 3–4 DB queries that follow
 * are cached per user+feature for 60 seconds — a session of 10 exchanges pays
 * the full DB cost only on the first message.
 */
export async function checkFeatureAccess(
  feature: FeatureKey
): Promise<AccessResult> {
  // 1. Auth check — always runs, never trust body userId, needed for cache key
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

  // 3. Admin bypass — full access, no token cost, no subscription required
  if (await isAdmin(user.id, user.email ?? undefined)) {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  const db = createServiceClient()

  // 4. Role check — profiles.id = auth.users.id (not user_id)
  //    Select both role and secondary_role for dual-role users
  const { data: profile } = await db
    .from('profiles')
    .select('role, secondary_role')
    .eq('id', user.id)
    .maybeSingle()

  const primaryRole   = profile?.role         ?? 'parent'
  const secondaryRole = profile?.secondary_role ?? null

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

  // 6. Active subscription → unlimited access, no deduction
  const { data: subscription } = await db
    .from('subscriptions')
    .select('id, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (subscription) {
    return cacheAndReturn({ allowed: true, tier: 'subscriber', deductTokens: false, userId: user.id })
  }

  // 7. Token balance check — last resort
  const cost = TOKEN_COSTS[feature]

  const { data: balance } = await db
    .from('token_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

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
  const db = createServiceClient()
  const { error } = await db.rpc('deduct_tokens', {
    p_user_id: userId,
    p_action:  feature,
    p_tokens:  cost,
    p_metadata: { feature, timestamp: new Date().toISOString() },
  })
  if (error) throw new Error(`Token deduction failed: ${error.message}`)
}
