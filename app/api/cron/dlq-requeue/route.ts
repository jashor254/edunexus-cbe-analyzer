// GET /api/cron/dlq-requeue
// Runs daily at 03:30 UTC. Retries up to 50 dead-letter jobs per run.
// Only requeues jobs that failed < 7 days ago (stale jobs are abandoned).
import { NextRequest, NextResponse } from 'next/server'
import { requeueDeadLetterJob, getDeadLetterJobs } from '@/lib/jobs/monitor'
import { logger } from '@/lib/observability/logger'

const MAX_REQUEUE  = 50
const MAX_AGE_DAYS = 7

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS)

    // getDeadLetterJobs takes an optional queue name — pass undefined to get all queues
    const allJobs = await getDeadLetterJobs()
    const jobs = allJobs
      .filter(j => new Date(j.updated_at) >= cutoff)
      .slice(0, MAX_REQUEUE)

    let requeued = 0
    let skipped  = 0

    for (const job of jobs) {
      try {
        await requeueDeadLetterJob(job.id)
        requeued++
      } catch {
        skipped++
      }
    }

    logger.info('dlq-requeue completed', { requeued, skipped, total: jobs.length })
    return NextResponse.json({ ok: true, requeued, skipped })
  } catch (err) {
    logger.error('dlq-requeue failed', { error: err })
    return NextResponse.json({ error: 'DLQ requeue failed' }, { status: 500 })
  }
}
