// lib/jobs/process.ts
// Job processing engine — called from cron route or a worker process.
import { repos } from '@/lib/repositories'
import type { JobRecord, JobHandler } from './types'

// Handler registry
const HANDLERS = new Map<string, JobHandler>()

/**
 * Register a handler for a job type.
 * Call this at app startup before processing begins.
 */
export function registerJobHandler(type: string, handler: JobHandler): void {
  HANDLERS.set(type, handler)
}

/**
 * Process a batch of queued jobs from a specific queue.
 * Designed to run within a 30-second execution budget (Vercel cron).
 */
export async function processQueue(
  queueName: string,
  options: { batchSize?: number; timeoutMs?: number } = {}
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const batchSize = options.batchSize ?? 10
  const deadline = Date.now() + (options.timeoutMs ?? 25_000)

  let processed = 0
  let succeeded = 0
  let failed = 0

  while (Date.now() < deadline) {
    // Claim one job at a time to avoid race conditions
    const job = await repos.jobs.claimNextJob(queueName)
    if (!job) break  // No more jobs

    processed++

    try {
      await repos.jobs.insertJobLog(job.id, job.attempt_count + 1, 'info', `Processing job: ${job.type}`)

      const result = await runWithTimeout(
        () => executeJob(job as JobRecord),
        options.timeoutMs ?? 25_000
      )

      await repos.jobs.markComplete(job.id, (result ?? {}) as Record<string, unknown>)
      await repos.jobs.insertJobLog(job.id, job.attempt_count + 1, 'info', 'Job completed successfully')

      succeeded++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const newAttempt = job.attempt_count + 1
      const nextScheduledAt = new Date(Date.now() + 30_000 * Math.pow(2, newAttempt - 1)).toISOString()

      await repos.jobs.markFailed(job.id, message, newAttempt, job.max_attempts, nextScheduledAt)
      await repos.jobs.insertJobLog(job.id, newAttempt, 'error', message)

      failed++
    }

    if (processed >= batchSize) break
  }

  return { processed, succeeded, failed }
}

async function executeJob(job: JobRecord): Promise<Record<string, unknown> | void> {
  const handler = HANDLERS.get(job.type)
  if (!handler) throw new Error(`No handler registered for job type: ${job.type}`)
  return handler(job)
}

async function runWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Job timed out after ${ms}ms`)), ms)
    fn().then(
      result => { clearTimeout(timer); resolve(result) },
      err    => { clearTimeout(timer); reject(err) }
    )
  })
}
