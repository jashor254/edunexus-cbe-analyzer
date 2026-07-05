// app/api/cron/snapshot-metrics/route.ts
// Runs daily — records user counts and detects milestone crossings
import { NextRequest, NextResponse } from 'next/server'
import { recordMetrics } from '@/lib/monitoring/metrics'
import { getErrorMessage } from '@/lib/api/response'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  if (!isVercelCron && (!cronSecret || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const snapshot = await recordMetrics()

    if (snapshot.milestone_hit) {
      console.info(
        `[cron/snapshot-metrics] MILESTONE: reached ${snapshot.milestone_hit} teachers! ` +
        `Total: ${snapshot.total_teachers}, Active (30d): ${snapshot.active_teachers}, Students: ${snapshot.total_students}`
      )
    } else {
      console.info(
        `[cron/snapshot-metrics] Teachers: ${snapshot.total_teachers}, ` +
        `Active (30d): ${snapshot.active_teachers}, Students: ${snapshot.total_students}`
      )
    }

    return NextResponse.json({
      success: true,
      snapshot,
      milestone: snapshot.milestone_hit
        ? `🎉 ${snapshot.milestone_hit} teachers reached!`
        : null,
    })
  } catch (err) {
    console.error('❌ snapshot-metrics cron failed:', err)
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
