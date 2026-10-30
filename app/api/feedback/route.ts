// app/api/feedback/route.ts
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { requireAuth } from '@/lib/api/middleware'
import { requireGrowthUser } from '@/lib/growth/auth'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import { logger } from '@/lib/observability/logger'

const FeedbackSchema = z.object({
  trigger:        z.string().optional(),
  rating:         z.string().optional(),
  npsScore:       z.number().min(0).max(10).optional(),
  category:       z.string().optional(),
  message:        z.string().optional(),
  wouldRecommend: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const parsed = FeedbackSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { trigger, rating, npsScore, category, message, wouldRecommend } = parsed.data

    const db = createServiceClient()

    const { error: insertError } = await db.from('user_feedback').insert({
      user_id:        auth.user.id,
      trigger,
      rating,
      nps_score:      npsScore,
      category,
      message:        message?.trim() ?? null,
      would_recommend: wouldRecommend,
      created_at:     new Date().toISOString(),
    })

    if (insertError) {
      logger.error('Feedback insert failed', { operation: 'feedback.create', user_id: auth.user.id }, insertError)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    // Promoter flag — only set when NPS is genuinely high; user owns their own profile record
    if (npsScore !== null && npsScore !== undefined && npsScore >= 9) {
      await db
        .from('profiles')
        .update({ is_promoter: true })
        .eq('id', auth.user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

// GET — founder-only feedback stats dashboard. Security audit 2026-10-30,
// F-08: previously gated by a shared ADMIN_SECRET header (and invisible to
// the route-auth gate, which only saw this file's guarded POST); now the
// founder's own signed-in session (requireGrowthUser).
export async function GET() {
  try {
    await requireGrowthUser(await createClient())
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    throw error
  }

  try {
    const db = createServiceClient()

    const { data: feedback } = await db
      .from('user_feedback')
      .select('id, user_id, trigger, rating, nps_score, category, message, would_recommend, created_at')
      .order('created_at', { ascending: false })

    if (!feedback) return NextResponse.json({ stats: null, feedback: [] })

    const total      = feedback.length
    const helpful    = feedback.filter((f) => f.rating === 'helpful').length
    const notHelpful = feedback.filter((f) => f.rating === 'not_helpful').length
    const npsScores  = feedback.filter((f) => f.nps_score !== null).map((f) => f.nps_score as number)
    const avgNPS     = npsScores.length
      ? Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length)
      : null
    const promoters  = npsScores.filter((s) => s >= 9).length
    const detractors = npsScores.filter((s) => s <= 6).length
    const npsCalculated = npsScores.length
      ? Math.round(((promoters - detractors) / npsScores.length) * 100)
      : null

    const cancelReasons = feedback
      .filter((f) => f.trigger === 'on_cancel' && f.category)
      .reduce((acc: Record<string, number>, f) => {
        const key = f.category as string
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})

    return NextResponse.json({
      stats: {
        total,
        helpful,
        notHelpful,
        helpfulRate:    total ? Math.round((helpful / (helpful + notHelpful)) * 100) : null,
        avgNPS,
        npsCalculated,
        promoters,
        detractors,
        cancelReasons,
      },
      feedback: feedback.slice(0, 50),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
