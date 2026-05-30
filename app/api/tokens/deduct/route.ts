// app/api/tokens/deduct/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/auth/isAdmin'

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
    const body = await request.json()
    const { userId, feature } = body

    if (!userId || !feature) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or feature' },
        { status: 400 }
      )
    }

    const tokenCost = TOKEN_COSTS[feature as keyof typeof TOKEN_COSTS]
    if (!tokenCost) {
      return NextResponse.json(
        { success: false, error: 'Invalid feature' },
        { status: 400 }
      )
    }

    // Admin bypass — unlimited access, no deduction
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    if (await isAdmin(userId, user?.email)) {
      return NextResponse.json({
        success: true,
        method: 'admin',
        tokensRemaining: 'unlimited',
        message: 'Access granted — admin account',
      })
    }

    // ✅ Check active subscription — use expires_at (NOT end_date)
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan, expires_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (subscriptions && subscriptions.length > 0) {
      return NextResponse.json({
        success: true,
        method: 'subscription',
        tokensRemaining: 'unlimited',
        message: 'Access granted via subscription',
      })
    }

    // ✅ Call RPC — deducts from token_balances atomically
    const { data, error } = await supabase.rpc('deduct_tokens', {
      p_user_id: userId,
      p_action:  feature,
      p_tokens:  tokenCost,
      p_metadata: { feature, timestamp: new Date().toISOString() },
    })

    if (error) {
      console.error('Token deduction error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to deduct tokens', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      // ✅ Read remaining balance from token_balances (not user_tokens)
      const { data: balanceRow } = await supabase
        .from('token_balances')
        .select('balance')
        .eq('user_id', userId)
        .single()

      const availableTokens = balanceRow?.balance || 0

      return NextResponse.json(
        {
          success: false,
          error: 'insufficient_tokens',
          tokensRequired:  tokenCost,
          tokensAvailable: availableTokens,
          message: `You need ${tokenCost} tokens but only have ${availableTokens}`,
        },
        { status: 402 }
      )
    }

    // ✅ Get updated balance from token_balances
    const { data: updatedBalance } = await supabase
      .from('token_balances')
      .select('balance')
      .eq('user_id', userId)
      .single()

    const remainingTokens = updatedBalance?.balance || 0

    return NextResponse.json({
      success: true,
      method: 'tokens',
      tokensDeducted: tokenCost,
      tokensRemaining: remainingTokens,
      message: `Successfully deducted ${tokenCost} tokens`,
    })

  } catch (error: any) {
    console.error('Token deduction error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
