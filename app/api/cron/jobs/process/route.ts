// app/api/cron/jobs/process/route.ts
// Called every minute by Vercel cron to process background jobs.
// Runs all active queues in parallel within the 30s Vercel cron budget.
import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/jobs/process'
import { logger } from '@/lib/observability/logger'

// Active queues to process in this cron tick
const QUEUES = [
  'email.send',
  'whatsapp.send',
  'webhook.deliver',
  'report.generation',
  'ai.generation',
  'analytics.aggregate',
  'data.import',
  'data.export',
]

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  // Process all queues in parallel — each gets a slice of the budget
  const perQueueTimeout = Math.floor(20_000 / QUEUES.length)

  const results = await Promise.allSettled(
    QUEUES.map(queueName =>
      processQueue(queueName, { batchSize: 5, timeoutMs: perQueueTimeout })
        .then(r => ({ queue: queueName, ...r }))
        .catch(err => ({ queue: queueName, error: (err as Error).message, processed: 0, succeeded: 0, failed: 0 }))
    )
  )

  const summary = results.map(r => r.status === 'fulfilled' ? r.value : { error: 'queue_error' })
  const totalProcessed = summary.reduce((s, r) => s + ('processed' in r ? r.processed : 0), 0)

  logger.info('Job processing cron completed', {
    service:     'cron.jobs.process',
    total:       totalProcessed,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({ success: true, queues: summary, duration_ms: Date.now() - start })
}
