// app/api/referrals/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .rpc('get_referral_stats', {
        p_user_id: userId,
      });

    if (error) {
      console.error('Referral stats error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const stats = data[0] || {
      referral_code: null,
      total_referrals: 0,
      total_tokens_earned: 0,
      pending_referrals: 0,
      completed_referrals: 0,
      recent_referrals: [],
    };

    return NextResponse.json({
      success: true,
      stats: {
        referralCode: stats.referral_code,
        totalReferrals: stats.total_referrals,
        tokensEarned: stats.total_tokens_earned,
        pendingReferrals: stats.pending_referrals,
        completedReferrals: stats.completed_referrals,
        recentReferrals: stats.recent_referrals || [],
      },
    });
  } catch (error: any) {
    console.error('Referral stats API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';