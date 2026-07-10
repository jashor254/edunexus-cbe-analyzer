// app/api/cron/projection-events/process/route.ts
// Called every 5 minutes by the queue-cron GitHub Actions workflow to drain
// evidence_projection_events — the outbox Phase 2 built ("hooks for
// downstream projection recomputation... no consumer implemented yet") but
// nothing has called since. This is the activation: the consumer function
// (processProjectionEvents) already existed and is unchanged — this route
// only gives it a production entry point, mirroring the existing
// events/dispatch and jobs/process cron routes.
import { NextRequest, NextResponse } from 'next/server'
import { processProjectionEvents } from '@/lib/projection/eventConsumer'
import { logger } from '@/lib/observability/logger'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (!timingSafeEqualString(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const result = await processProjectionEvents(100)
    logger.info('Projection event processing cron completed', {
      service:     'cron.projection-events.process',
      ...result,
      duration_ms: Date.now() - start,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    logger.error('Projection event processing cron failed', { service: 'cron.projection-events.process' }, err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
