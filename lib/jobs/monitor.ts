// lib/jobs/monitor.ts
// Job queue monitoring — used by admin dashboard.
import { repos } from '@/lib/repositories'
import type { JobRecord } from './types'

export type QueueDepth = {
  queue_name:       string
  queued:           number
  processing:       number
  failed:           number
  dead_letter:      number
  oldest_queued_at: string | null
}

export type JobStats = {
  total:       number
  queued:      number
  processing:  number
  completed:   number
  failed:      number
  dead_letter: number
  success_rate: number  // 0–100
}

/**
 * Get depth metrics for all queues.
 */
export async function getQueueDepths(): Promise<QueueDepth[]> {
  return repos.jobs.findQueueDepths()
}

/**
 * Get job statistics for an organization over the last N days.
 */
export async function getJobStats(
  organizationId: string,
  days = 7
): Promise<JobStats> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const data = await repos.jobs.findJobStatuses(organizationId, since)

  const jobs = data
  const counts = {
    total:       jobs.length,
    queued:      jobs.filter(j => j.status === 'queued').length,
    processing:  jobs.filter(j => j.status === 'processing').length,
    completed:   jobs.filter(j => j.status === 'completed').length,
    failed:      jobs.filter(j => j.status === 'failed').length,
    dead_letter: jobs.filter(j => j.status === 'dead_letter').length,
  }

  const finished = counts.completed + counts.dead_letter
  const success_rate = finished > 0 ? Math.round((counts.completed / finished) * 100) : 100

  return { ...counts, success_rate }
}

/**
 * List recent jobs for an organization.
 */
export async function listJobs(
  organizationId: string,
  options?: {
    status?: string
    type?: string
    limit?: number
    offset?: number
  }
): Promise<JobRecord[]> {
  return repos.jobs.listJobs(organizationId, options)
}

/**
 * Get dead-letter jobs that need manual review.
 */
export async function getDeadLetterJobs(queueName?: string): Promise<JobRecord[]> {
  return repos.jobs.findDeadLetterJobs(queueName)
}

/**
 * Requeue a dead-letter job for another attempt.
 */
export async function requeueDeadLetterJob(jobId: string): Promise<void> {
  const job = await repos.jobs.findJobStatus(jobId)
  if (!job) throw new Error('Job not found')
  if (job.status !== 'dead_letter') throw new Error('Only dead-letter jobs can be requeued')

  await repos.jobs.requeueJob(jobId)
}
