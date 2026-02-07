// ============================================
// TOKEN CHECK ROUTE (Check Before Action)
// Create: app/api/tokens/check/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { userId, feature } = await request.json();

    if (!userId || !feature) {
      return NextResponse.json(
        { error: 'Missing userId or feature' },
        { status: 400 }
      );
    }

    const tokenCost = TOKEN_COSTS[feature as keyof typeof TOKEN_COSTS];
    if (!tokenCost) {
      return NextResponse.json(
        { error: 'Invalid feature' },
        { status: 400 }
      );
    }

    // Check for active subscription
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString());

    if (subscriptions && subscriptions.length > 0) {
      return NextResponse.json({
        canProceed: true,
        method: 'subscription',
        tokensRequired: 0,
        tokensAvailable: 'unlimited',
        subscription: {
          plan_type: subscriptions[0].plan_type,
          end_date: subscriptions[0].end_date
        }
      });
    }

    // Check token balance
    const { data: tokenData } = await supabase
      .from('user_tokens')
      .select('tokens_remaining')
      .eq('user_id', userId)
      .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`);

    const availableTokens = tokenData?.reduce((sum, row) => sum + row.tokens_remaining, 0) || 0;

    return NextResponse.json({
      canProceed: availableTokens >= tokenCost,
      method: 'tokens',
      tokensRequired: tokenCost,
      tokensAvailable: availableTokens,
      needToPurchase: availableTokens < tokenCost,
    });

  } catch (error: any) {
    console.error('Token check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';