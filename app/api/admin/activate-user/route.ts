// app/api/admin/activate-user/route.ts
// Manually activates a user after M-PESA payment confirmation

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import { SUBSCRIPTION_PLANS, TOKEN_PACK } from '@/lib/payments/config'
import { creditSubscription, creditTokens } from '@/lib/payments/fulfillment'

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

    // ── Idempotency guard ────────────────────────────────────────────────────
    // A common support flow is: customer says "I paid but nothing happened",
    // admin activates manually, then the (just-delayed, not actually lost)
    // Paystack webhook lands too. Both paths credit the same tables, so
    // refuse to credit twice for the same user+plan within a short window
    // rather than silently doubling tokens / clobbering subscription expiry.
    const lookback = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentSuccess } = await service
      .from('payments')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('product_id', typedPlan)
      .eq('status', 'success')
      .gte('created_at', lookback)
      .maybeSingle()

    if (recentSuccess) {
      return apiSuccess({
        message:   'Already activated — a successful payment for this plan already exists in the last 24h. No changes made.',
        email,
        plan:      typedPlan,
        expiresAt: null,
      })
    }

    // ── Record payment first — gives creditSubscription() a payment_id to
    //    link, and matches the real payments schema (transaction_id,
    //    product_id, amount, status, metadata — no payment_method/reference
    //    columns exist) ──────────────────────────────────────────────────────
    const { data: paymentRow, error: paymentError } = await service
      .from('payments')
      .insert({
        user_id:        userId,
        transaction_id: `MANUAL-${now.getTime()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        amount:         PLAN_AMOUNTS[typedPlan],
        status:         'success',
        product_id:     typedPlan,
        metadata:       { source: 'admin_manual_activation', activated_by: user.email },
      })
      .select('id')
      .single()

    if (paymentError || !paymentRow) {
      console.error('Payment record insert error:', paymentError)
      return apiError('Failed to record payment', 500)
    }

    // ── Plan-specific activation — shares the exact same crediting logic
    //    used by the Paystack webhook/verify paths (lib/payments/fulfillment.ts)
    //    so there is exactly one way tokens/subscriptions are ever granted.
    const bonus = PLAN_BONUS_TOKENS[typedPlan]

    if (typedPlan !== 'starter') {
      await creditSubscription(service, userId, typedPlan, paymentRow.id)
    }
    await creditTokens(service, userId, bonus)

    let expiresAt: Date | null = null
    if (typedPlan !== 'starter') {
      const { data: sub } = await service
        .from('subscriptions')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      expiresAt = sub?.expires_at ? new Date(sub.expires_at) : null
    }

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
