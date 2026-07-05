// app/api/tokens/deduct/route.ts
// Thin route — all logic lives in lib/payments/access.ts
// Call this AFTER the AI response succeeds — never before.

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { type FeatureKey, FEATURE_ACCESS } from '@/lib/payments/config'

const TokenDeductSchema = z.object({
  feature: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = TokenDeductSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid or missing feature' }, { status: 400 })
    }
    const feature = parsed.data.feature as FeatureKey | undefined

    if (!feature || !(feature in FEATURE_ACCESS)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing feature' },
        { status: 400 }
      )
    }

    // Re-verify access server-side — never trust a client-side check result
    const result = await checkFeatureAccess(feature)

    if (result.allowed === false) {
      const status = result.reason === 'unauthenticated' ? 401 : 403
      return NextResponse.json({ success: false, error: result.reason }, { status })
    }

    // Subscribers and teachers: no deduction needed
    if (!result.deductTokens) {
      return NextResponse.json({ success: true, deducted: false, tier: result.tier })
    }

    // Token users: deduct atomically via RPC
    await deductFeatureTokens(result.userId, feature, result.cost)

    return NextResponse.json({
      success:  true,
      deducted: true,
      cost:     result.cost,
      tier:     'token',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Token deduction failed'
    console.error('[tokens/deduct]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
