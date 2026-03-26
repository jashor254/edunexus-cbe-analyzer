// app/api/tokens/check/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TOKEN_COSTS = {
  add_assessment_basic:    1,
  add_assessment_detailed: 2,
  generate_pdf:            3,
  ai_career_analysis:      5,
  ai_chat_session:         2,
  download_clinic:         3,
} as const

export async function POST(request: NextRequest) {
  try {
    const { userId, feature } = await request.json()

    if (!userId || !feature) {
      return NextResponse.json(
        { error: 'Missing userId or feature' },
        { status: 400 }
      )
    }

    const tokenCost = TOKEN_COSTS[feature as keyof typeof TOKEN_COSTS]
    if (!tokenCost) {
      return NextResponse.json(
        { error: 'Invalid feature' },
        { status: 400 }
      )
    }

    // ✅ Check active subscription — use expires_at + plan (NOT end_date / plan_type)
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan, expires_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (subscriptions && subscriptions.length > 0) {
      return NextResponse.json({
        canProceed: true,
        method: 'subscription',
        tokensRequired: 0,
        tokensAvailable: 'unlimited',
        subscription: {
          plan:       subscriptions[0].plan,
          expires_at: subscriptions[0].expires_at,
        },
      })
    }

    // ✅ Read from token_balances (not user_tokens)
    const { data: balanceRow } = await supabase
      .from('token_balances')
      .select('balance')
      .eq('user_id', userId)
      .single()

    const availableTokens = balanceRow?.balance || 0

    return NextResponse.json({
      canProceed:      availableTokens >= tokenCost,
      method:          'tokens',
      tokensRequired:  tokenCost,
      tokensAvailable: availableTokens,
      needToPurchase:  availableTokens < tokenCost,
    })

  } catch (error: any) {
    console.error('Token check error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
