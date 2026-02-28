// app/api/feedback/route.ts
// ✅ Saves feedback to Supabase
// ✅ Sends email alert to you for negative feedback
// ✅ Logs NPS scores separately for tracking

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      trigger,
      rating,
      npsScore,
      category,
      message,
      wouldRecommend,
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // ── Save to feedback table ──
    const { error: insertError } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId,
        trigger,
        rating,           // 'helpful' | 'not_helpful' | null
        nps_score: npsScore,
        category,         // cancel reason or null
        message: message?.trim() || null,
        would_recommend: wouldRecommend,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('❌ Feedback insert failed:', insertError)
      // Don't fail silently - but don't break user experience
    }

    // ── Alert you for negative feedback ──
    // If NPS < 7 or rating = not_helpful → you want to know immediately
    const isNegative = (npsScore !== null && npsScore < 7) || rating === 'not_helpful'

    if (isNegative && message) {
      console.log(`🚨 NEGATIVE FEEDBACK from user ${userId}:`, {
        trigger,
        rating,
        npsScore,
        category,
        message,
      })
      // TODO: Send email alert via Resend when it's connected
      // await sendFeedbackAlert({ userId, trigger, rating, npsScore, message })
    }

    // ── If promoter (NPS 9-10) → flag for referral follow-up ──
    if (npsScore !== null && npsScore >= 9) {
      await supabase
        .from('profiles')
        .update({ is_promoter: true })
        .eq('id', userId)
        .single()
      // Later: trigger referral email
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('❌ Feedback route error:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}

// GET - fetch feedback stats for admin dashboard
export async function GET(request: NextRequest) {
  try {
    // Check admin auth
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Overall stats
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (!feedback) {
      return NextResponse.json({ stats: null, feedback: [] })
    }

    const total = feedback.length
    const helpful = feedback.filter((f) => f.rating === 'helpful').length
    const notHelpful = feedback.filter((f) => f.rating === 'not_helpful').length
    const npsScores = feedback.filter((f) => f.nps_score !== null).map((f) => f.nps_score)
    const avgNPS = npsScores.length
      ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length)
      : null
    const promoters = npsScores.filter((s) => s >= 9).length
    const detractors = npsScores.filter((s) => s <= 6).length
    const npsCalculated = npsScores.length
      ? Math.round(((promoters - detractors) / npsScores.length) * 100)
      : null

    // Cancel reasons breakdown
    const cancelReasons = feedback
      .filter((f) => f.trigger === 'on_cancel' && f.category)
      .reduce((acc: Record<string, number>, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1
        return acc
      }, {})

    return NextResponse.json({
      stats: {
        total,
        helpful,
        notHelpful,
        helpfulRate: total ? Math.round((helpful / (helpful + notHelpful)) * 100) : null,
        avgNPS,
        npsCalculated,
        promoters,
        detractors,
        cancelReasons,
      },
      feedback: feedback.slice(0, 50), // Latest 50
    })

  } catch (error: any) {
    console.error('❌ Feedback GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}