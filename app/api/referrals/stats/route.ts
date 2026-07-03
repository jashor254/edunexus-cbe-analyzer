// app/api/referrals/stats/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'

export async function GET() {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const db = createServiceClient()
    const { data, error } = await db.rpc('get_referral_stats', {
      p_user_id: auth.user.id,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const stats = data[0] ?? {
      referral_code: null,
      total_referrals: 0,
      total_tokens_earned: 0,
      pending_referrals: 0,
      completed_referrals: 0,
      recent_referrals: [],
    }

    return NextResponse.json({
      success: true,
      stats: {
        referralCode:       stats.referral_code,
        totalReferrals:     stats.total_referrals,
        tokensEarned:       stats.total_tokens_earned,
        pendingReferrals:   stats.pending_referrals,
        completedReferrals: stats.completed_referrals,
        recentReferrals:    stats.recent_referrals ?? [],
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
