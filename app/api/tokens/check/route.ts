// app/api/tokens/check/route.ts
// Thin route — all logic lives in lib/payments/access.ts

import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey, FEATURE_ACCESS } from '@/lib/payments/config'

const TokenCheckSchema = z.object({
  feature: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const parsed = TokenCheckSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid or missing feature' }, { status: 400 })
    }
    const feature = parsed.data.feature as FeatureKey | undefined

    if (!feature || !(feature in FEATURE_ACCESS)) {
      return NextResponse.json(
        { error: 'Invalid or missing feature' },
        { status: 400 }
      )
    }

    const result = await checkFeatureAccess(feature)

    // Explicit === false so TypeScript narrows the discriminated union correctly
    if (result.allowed === false) {
      const status = result.reason === 'unauthenticated' ? 401 : 403
      return NextResponse.json({ error: result.reason }, { status })
    }

    return NextResponse.json({
      allowed:      true,
      tier:         result.tier,
      deductTokens: result.deductTokens,
      cost:         'cost' in result ? result.cost : 0,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Token check failed'
    console.error('[tokens/check]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
