// lib/repositories/job.repository.ts
// All DB queries for the background job queue.

import { BaseRepository } from './base'
import type { JobRecord, EnqueueJobInput, JobStatus } from '@/lib/jobs/types'

// ── Column constants ──────────────────────────────────────────────────────────

const JOB_COLS =
  'id, queue_name, organization_id, user_id, type, status, priority, payload, result, error_message, attempt_count, max_attempts, scheduled_at, started_at, completed_at, idempotency_key, created_at, updated_at'

const JOB_STATUS_COLS =
  'id, status, result, error_message, attempt_count, completed_at'

const JOB_STATUS_ONLY =
  'status'

// ── Repository ────────────────────────────────────────────────────────────────

export class JobRepository extends BaseRepository {
  /**
   * Find an existing job by idempotency key.
   * Returns the existing record to prevent duplicate enqueues.
   */
  async findByIdempotencyKey(key: string): Promise<JobRecord | null> {
    const { data } = await this.db
      .from('jobs')
      .select(JOB_COLS)
      .eq('idempotency_key', key)
      .maybeSingle()

    return (data as JobRecord) ?? null
  }

  /**
   * Insert a single job and return the created record.
   */
  async insertJob(input: EnqueueJobInput): Promise<JobRecord> {
    const { data, error } = await this.db
      .from('jobs')
      .insert({
        queue_name:      input.queue_name,
        organization_id: input.organization_id ?? null,
        user_id:         input.user_id ?? null,
        type:            input.type,
        status:          'queued',
        priority:        input.priority ?? 5,
        payload:         input.payload,
        max_attempts:    input.max_attempts ?? 3,
        scheduled_at:    input.scheduled_at ?? new Date().toISOString(),
        idempotency_key: input.idempotency_key ?? null,
      })
      .select(JOB_COLS)
      .single()

    if (error) throw new Error(`Failed to enqueue job: ${error.message}`)
    return data as JobRecord
  }

  /**
   * Insert multiple jobs in a single statement.
   */
  async insertBatch(inputs: EnqueueJobInput[]): Promise<JobRecord[]> {
    const { data, error } = await this.db
      .from('jobs')
      .insert(
        inputs.map(input => ({
          queue_name:      input.queue_name,
          organization_id: input.organization_id ?? null,
          user_id:         input.user_id ?? null,
          type:            input.type,
          status:          'queued',
          priority:        input.priority ?? 5,
          payload:         input.payload,
          max_attempts:    input.max_attempts ?? 3,
          scheduled_at:    input.scheduled_at ?? new Date().toISOString(),
          idempotency_key: input.idempotency_key ?? null,
        }))
      )
      .select(JOB_COLS)

    if (error) throw new Error(`Failed to enqueue batch: ${error.message}`)
    return (data ?? []) as JobRecord[]
  }

  /**
   * Fetch status, result, and error for a single job (used for client polling).
   */
  async findStatus(
    jobId: string
  ): Promise<Pick<JobRecord, 'id' | 'status' | 'result' | 'error_message' | 'attempt_count' | 'completed_at'>> {
    const { data, error } = await this.db
      .from('jobs')
      .select(JOB_STATUS_COLS)
      .eq('id', jobId)
      .single()

    if (error) throw new Error('Job not found')
    return data as Pick<JobRecord, 'id' | 'status' | 'result' | 'error_message' | 'attempt_count' | 'completed_at'>
  }

  /**
   * Check a job's current status (used before cancel/requeue).
   */
  async findJobStatus(jobId: string): Promise<{ status: JobStatus } | null> {
    const { data } = await this.db
      .from('jobs')
      .select(JOB_STATUS_ONLY)
      .eq('id', jobId)
      .maybeSingle()

    return data as { status: JobStatus } | null
  }

  /**
   * Cancel a queued job.
   */
  async cancelJob(jobId: string): Promise<void> {
    const { error } = await this.db
      .from('jobs')
      .update({ status: 'canceled' })
      .eq('id', jobId)

    if (error) throw new Error(`Failed to cancel job: ${error.message}`)
  }

  /**
   * Claim the next available job in a queue — highest priority, oldest scheduled_at first.
   * Returns null when the queue is empty or all jobs are future-scheduled.
   */
  async claimNextJob(queueName: string): Promise<JobRecord | null> {
    const { data, error } = await this.db
      .from('jobs')
      .select(JOB_COLS)
      .eq('queue_name', queueName)
      .eq('status', 'queued')
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) return null
    if (!data) return null

    // Optimistic lock — only claim if still 'queued'
    const { data: claimed } = await this.db
      .from('jobs')
      .update({
        status:        'processing',
        started_at:    new Date().toISOString(),
        attempt_count: (data.attempt_count as number) + 1,
      })
      .eq('id', data.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle()

    // Another worker beat us to it
    if (!claimed) return null

    return data as JobRecord
  }

  /**
   * Mark a job as completed and store its result.
   */
  async markComplete(jobId: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await this.db
      .from('jobs')
      .update({
        status:       'completed',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) throw new Error(`Failed to mark job complete: ${error.message}`)
  }

  /**
   * Mark a job as failed (or dead_letter on last attempt) and record backoff.
   */
  async markFailed(
    jobId: string,
    errorMessage: string,
    newAttemptCount: number,
    maxAttempts: number,
    nextScheduledAt: string | undefined
  ): Promise<void> {
    const isLastAttempt = newAttemptCount >= maxAttempts
    const { error } = await this.db
      .from('jobs')
      .update({
        status:        isLastAttempt ? 'dead_letter' : 'queued',
        error_message: errorMessage,
        ...(isLastAttempt ? {} : { scheduled_at: nextScheduledAt }),
      })
      .eq('id', jobId)

    if (error) throw new Error(`Failed to mark job failed: ${error.message}`)
  }

  /**
   * Write a job log entry (debug, info, warn, error).
   */
  async insertJobLog(
    jobId: string,
    attempt: number,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.db
      .from('job_logs')
      .insert({ job_id: jobId, attempt, level, message, data })
  }

  /**
   * Fetch depth metrics for all queues via the queue_depth view.
   */
  async findQueueDepths(): Promise<Array<{
    queue_name: string
    queued: number
    processing: number
    failed: number
    dead_letter: number
    oldest_queued_at: string | null
  }>> {
    const { data, error } = await this.db
      .from('queue_depth')
      .select('queue_name, queued, processing, failed, dead_letter, oldest_queued_at')

    if (error) throw new Error(`Failed to fetch queue depths: ${error.message}`)
    return (data ?? []) as Array<{
      queue_name: string
      queued: number
      processing: number
      failed: number
      dead_letter: number
      oldest_queued_at: string | null
    }>
  }

  /**
   * Fetch job status counts for an organization within the last N days.
   */
  async findJobStatuses(
    organizationId: string,
    since: string
  ): Promise<Array<{ status: string }>> {
    const { data, error } = await this.db
      .from('jobs')
      .select('status')
      .eq('organization_id', organizationId)
      .gte('created_at', since)

    if (error) throw new Error(`Failed to fetch job stats: ${error.message}`)
    return (data ?? []) as Array<{ status: string }>
  }

  /**
   * List recent jobs for an organization with optional filters.
   */
  async listJobs(
    organizationId: string,
    options?: {
      status?: string
      type?: string
      limit?: number
      offset?: number
    }
  ): Promise<JobRecord[]> {
    let query = this.db
      .from('jobs')
      .select(JOB_COLS)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 50)

    if (options?.status) query = query.eq('status', options.status)
    if (options?.type)   query = query.eq('type', options.type)
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)

    const { data, error } = await query
    if (error) throw new Error(`Failed to list jobs: ${error.message}`)
    return (data ?? []) as JobRecord[]
  }

  /**
   * Fetch dead-letter jobs, optionally filtered by queue name.
   */
  async findDeadLetterJobs(queueName?: string): Promise<JobRecord[]> {
    let query = this.db
      .from('jobs')
      .select(JOB_COLS)
      .eq('status', 'dead_letter')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (queueName) query = query.eq('queue_name', queueName)

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch dead-letter jobs: ${error.message}`)
    return (data ?? []) as JobRecord[]
  }

  /**
   * Requeue a dead-letter job by resetting its status and attempt count.
   */
  async requeueJob(jobId: string): Promise<void> {
    const { error } = await this.db
      .from('jobs')
      .update({
        status:        'queued',
        attempt_count: 0,
        error_message: null,
        scheduled_at:  new Date().toISOString(),
      })
      .eq('id', jobId)

    if (error) throw new Error(`Failed to requeue job: ${error.message}`)
  }
}
