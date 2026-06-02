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
  | { allowed: true;  tier: Exclude<UserTier, 'token' | 'none'>; deductTokens: false }
  | { allowed: true;  tier: 'token'; deductTokens: true; cost: number; userId: string }
  | { allowed: false; reason: 'unauthenticated' | 'insufficient_tokens' | 'no_access' }

/**
 * Checks whether the currently authenticated user can use a gated feature.
 * Resolution order: admin → teacher-free → subscriber → token balance.
 */
export async function checkFeatureAccess(
  feature: FeatureKey
): Promise<AccessResult> {
  // 1. Auth check — always first, never trust body userId
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return { allowed: false, reason: 'unauthenticated' }
  }

  // 2. Admin bypass — full access, no token cost, no subscription required
  if (await isAdmin(user.id, user.email ?? undefined)) {
    return { allowed: true, tier: 'subscriber', deductTokens: false }
  }

  const db = createServiceClient()

  // 3. Role check — profiles.id = auth.users.id (not user_id)
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role ?? 'parent'

  // 4. Teacher tier — free for teacher-designated features
  if (role === 'teacher') {
    const teacherAccess = FEATURE_ACCESS[feature].teacher
    if (teacherAccess === 'free') {
      return { allowed: true, tier: 'teacher', deductTokens: false }
    }
    // Teacher accessing a parent-tier feature (clinic, compass, career) → token check
  }

  // 5. Active subscription → unlimited access, no deduction
  const { data: subscription } = await db
    .from('subscriptions')
    .select('id, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (subscription) {
    return { allowed: true, tier: 'subscriber', deductTokens: false }
  }

  // 6. Token balance check — last resort
  const cost = TOKEN_COSTS[feature]

  const { data: balance } = await db
    .from('token_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  const available = balance?.balance ?? 0
  if (available < cost) {
    return { allowed: false, reason: 'insufficient_tokens' }
  }

  return { allowed: true, tier: 'token', deductTokens: true, cost, userId: user.id }
}

/**
 * Atomically deducts tokens AFTER a successful AI response.
 * Throws on RPC failure so the caller can surface the error.
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
