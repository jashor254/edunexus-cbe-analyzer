// app/api/tokens/deduct/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Hakikisha hapa hakuna "NEXT_PUBLIC" kwa Service Role Key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, feature } = body;

    if (!userId || !feature) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or feature' },
        { status: 400 }
      );
    }

    // Call database function
    const { data, error } = await supabase.rpc('deduct_ai_token', {
      p_user_id: userId,
      p_feature: feature,
    });

    if (error) {
      console.error('Token deduction error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to deduct token' },
        { status: 500 }
      );
    }

    // Pata updated subscription
    const { data: subscription } = await supabase.rpc('get_active_subscription', { 
      p_user_id: userId 
    });

    return NextResponse.json({
      success: true,
      tokensRemaining: subscription?.[0]?.ai_tokens_remaining || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Hamisha hii iwe juu ya POST au iache hapa, lakini iwe na 'export'
export const dynamic = 'force-dynamic';