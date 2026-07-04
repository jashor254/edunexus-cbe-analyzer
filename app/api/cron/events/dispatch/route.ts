// app/api/cron/events/dispatch/route.ts
// Called every minute by Vercel cron to process pending event deliveries.
import { NextRequest, NextResponse } from 'next/server'
import { dispatchPendingEvents } from '@/lib/events/dispatch'
import { logger } from '@/lib/observability/logger'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

// Vercel cron: 0 * * * * (every minute) — configure in vercel.json
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify this is a legitimate cron call (Vercel sets this header)
  const authHeader = req.headers.get('authorization')
  if (!timingSafeEqualString(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const result = await dispatchPendingEvents(50)
    logger.info('Event dispatch cron completed', {
      service:   'cron.events.dispatch',
      ...result,
      duration_ms: Date.now() - start,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    logger.error('Event dispatch cron failed', { service: 'cron.events.dispatch' }, err)
    return NextResponse.json({ error: 'Dispatch failed' }, { status: 500 })
  }
}
