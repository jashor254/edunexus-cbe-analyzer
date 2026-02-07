// ============================================
// TOKEN DEDUCTION ROUTE - UPDATED
// Replace: app/api/tokens/deduct/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Token costs for different features
const TOKEN_COSTS = {
  add_assessment_basic: 1,
  add_assessment_detailed: 2,
  generate_pdf: 3,
  ai_career_analysis: 5,
  ai_chat_session: 2,
  download_clinic: 3,
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, feature } = body;

    // Validation
    if (!userId || !feature) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or feature' },
        { status: 400 }
      );
    }

    // Get token cost for feature
    const tokenCost = TOKEN_COSTS[feature as keyof typeof TOKEN_COSTS];
    if (!tokenCost) {
      return NextResponse.json(
        { success: false, error: 'Invalid feature' },
        { status: 400 }
      );
    }

    // Check if user has active subscription
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString());

    if (subError) {
      console.error('❌ Subscription check error:', subError);
      return NextResponse.json(
        { success: false, error: 'Failed to check subscription' },
        { status: 500 }
      );
    }

    // If has active subscription, allow without deducting
    if (subscriptions && subscriptions.length > 0) {
      console.log(`✅ User ${userId} has active subscription - no tokens deducted`);
      
      return NextResponse.json({
        success: true,
        method: 'subscription',
        tokensRemaining: 'unlimited',
        message: 'Access granted via subscription',
      });
    }

    // No subscription - use tokens
    console.log(`🪙 Attempting to deduct ${tokenCost} tokens for ${feature}`);

    // Call deduct_tokens function
    const { data, error } = await supabase.rpc('deduct_tokens', {
      p_user_id: userId,
      p_action: feature,
      p_tokens: tokenCost,
      p_metadata: {
        feature: feature,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('❌ Token deduction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to deduct tokens', details: error.message },
        { status: 500 }
      );
    }

    // Check if deduction was successful
    if (!data) {
      console.log('❌ Insufficient tokens');
      
      // Get current token balance
      const { data: tokenData } = await supabase
        .from('user_tokens')
        .select('tokens_remaining')
        .eq('user_id', userId)
        .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`);

      const availableTokens = tokenData?.reduce((sum, row) => sum + row.tokens_remaining, 0) || 0;

      return NextResponse.json(
        {
          success: false,
          error: 'insufficient_tokens',
          tokensRequired: tokenCost,
          tokensAvailable: availableTokens,
          message: `You need ${tokenCost} tokens but only have ${availableTokens}`,
        },
        { status: 402 } // 402 = Payment Required
      );
    }

    // Get updated token balance
    const { data: updatedTokens } = await supabase
      .from('user_tokens')
      .select('tokens_remaining')
      .eq('user_id', userId)
      .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`);

    const remainingTokens = updatedTokens?.reduce((sum, row) => sum + row.tokens_remaining, 0) || 0;

    console.log(`✅ Deducted ${tokenCost} tokens. Remaining: ${remainingTokens}`);

    return NextResponse.json({
      success: true,
      method: 'tokens',
      tokensDeducted: tokenCost,
      tokensRemaining: remainingTokens,
      message: `Successfully deducted ${tokenCost} tokens`,
    });

  } catch (error: any) {
    console.error('❌ Token deduction error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';