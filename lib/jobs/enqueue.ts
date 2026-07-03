// lib/jobs/enqueue.ts
import { repos } from '@/lib/repositories'
import type { EnqueueJobInput, JobRecord } from './types'

/**
 * Enqueue a background job.
 * Returns the existing job if idempotency_key is set and job already exists.
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<JobRecord> {
  // Idempotency check
  if (input.idempotency_key) {
    const existing = await repos.jobs.findByIdempotencyKey(input.idempotency_key)
    if (existing) return existing
  }

  return repos.jobs.insertJob(input)
}

/**
 * Enqueue multiple jobs in a single insert.
 */
export async function enqueueBatch(inputs: EnqueueJobInput[]): Promise<JobRecord[]> {
  return repos.jobs.insertBatch(inputs)
}

/**
 * Cancel a queued job.
 */
export async function cancelJob(jobId: string): Promise<void> {
  const job = await repos.jobs.findJobStatus(jobId)
  if (!job) throw new Error('Job not found')
  if (!['queued'].includes(job.status)) {
    throw new Error(`Cannot cancel a job with status: ${job.status}`)
  }

  await repos.jobs.cancelJob(jobId)
}

/**
 * Get job status — for polling from client.
 */
export async function getJobStatus(jobId: string): Promise<Pick<JobRecord, 'id' | 'status' | 'result' | 'error_message' | 'attempt_count' | 'completed_at'>> {
  return repos.jobs.findStatus(jobId)
}
