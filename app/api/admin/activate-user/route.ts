// app/api/admin/activate-user/route.ts
// Manually activates a user after M-PESA payment confirmation

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import { SUBSCRIPTION_PLANS, TOKEN_PACK } from '@/lib/payments/config'

type Plan = 'starter' | 'term' | 'family'

const ActivateUserSchema = z.object({
  email:  z.string().email(),
  plan:   z.enum(['starter', 'term', 'family']),
  leadId: z.string().uuid().optional(),
})

const PLAN_AMOUNTS: Record<Plan, number> = {
  starter: TOKEN_PACK.priceKes,
  term:    SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes,
  family:  SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes,
}

const PLAN_BONUS_TOKENS: Record<Plan, number> = {
  starter: TOKEN_PACK.tokens,
  term:    5,
  family:  10,
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth check (must be logged-in admin) ──────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiUnauthorized()
    }

    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) {
      return apiForbidden()
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const parsed = ActivateUserSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { email, plan, leadId } = parsed.data

    const typedPlan = plan as Plan
    const service   = createServiceClient()

    // ── Find target user ──────────────────────────────────────────────────────
    const { data: usersData, error: lookupError } = await service.auth.admin.listUsers()
    if (lookupError) return apiError('Failed to look up user', 500)

    const target = (usersData?.users ?? []).find(
      (u: { email?: string | null }) =>
        u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    ) as { id: string; email?: string | null } | undefined

    if (!target) return apiError(`No user found with email: ${email}`, 404)

    const userId = target.id
    const now    = new Date()

    // ── Plan-specific activation ──────────────────────────────────────────────
    let expiresAt: Date | null = null

    if (typedPlan === 'starter') {
      // Add tokens only — no subscription
      // Add 15 tokens (starter pack — token-based, no subscription)
      const { data: existing } = await service
        .from('token_balances')
        .select('balance, total_ever')
        .eq('user_id', userId)
        .single()

      const currentBalance = existing?.balance   ?? 0
      const currentTotal   = existing?.total_ever ?? 0

      await service.from('token_balances').upsert(
        {
          user_id:    userId,
          balance:    currentBalance + PLAN_BONUS_TOKENS.starter,
          total_ever: currentTotal   + PLAN_BONUS_TOKENS.starter,
        },
        { onConflict: 'user_id' }
      )

    } else {
      // term / family → subscription (120 days) + bonus tokens
      expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 120)

      const { error: subError } = await service.from('subscriptions').upsert(
        {
          user_id:    userId,
          plan:       typedPlan,
          status:     'active',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (subError) {
        console.error('Subscription upsert error:', subError)
        return apiError('Failed to activate subscription', 500)
      }

      // Add bonus tokens
      const { data: existing } = await service
        .from('token_balances')
        .select('balance, total_ever')
        .eq('user_id', userId)
        .single()

      const bonus          = PLAN_BONUS_TOKENS[typedPlan]
      const currentBalance = existing?.balance   ?? 0
      const currentTotal   = existing?.total_ever ?? 0

      await service.from('token_balances').upsert(
        {
          user_id:    userId,
          balance:    currentBalance + bonus,
          total_ever: currentTotal   + bonus,
        },
        { onConflict: 'user_id' }
      )
    }

    // ── Record payment ────────────────────────────────────────────────────────
    await service.from('payments').insert({
      user_id:        userId,
      payment_method: 'mpesa_manual',
      status:         'success',
      amount:         PLAN_AMOUNTS[typedPlan],
      reference:      `MANUAL-${Date.now()}`,
      created_at:     now.toISOString(),
    })

    // ── Update lead status ────────────────────────────────────────────────────
    if (leadId) {
      await service
        .from('early_access_leads')
        .update({ status: 'activated', activated_at: now.toISOString() })
        .eq('id', leadId)
    }

    return apiSuccess({
      message:   'Activated',
      email,
      plan:      typedPlan,
      expiresAt: expiresAt?.toISOString() ?? null,
    })

  } catch (err) {
    console.error('activate-user error:', err)
    return apiError('Internal Server Error', 500)
  }
}
