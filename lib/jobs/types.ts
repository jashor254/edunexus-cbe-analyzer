// lib/jobs/types.ts

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'dead_letter'

export type JobRecord = {
  id: string
  queue_name: string
  organization_id: string | null
  user_id: string | null
  type: string
  status: JobStatus
  priority: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  attempt_count: number
  max_attempts: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  idempotency_key: string | null
  created_at: string
  updated_at: string
}

export type EnqueueJobInput = {
  queue_name: string
  type: string
  payload: Record<string, unknown>
  organization_id?: string
  user_id?: string
  priority?: number       // 1 (low) to 10 (critical); default 5
  scheduled_at?: string   // ISO datetime; defaults to now()
  max_attempts?: number
  idempotency_key?: string
}

// Job type handlers registered in lib/jobs/handlers/
export type JobHandler = (job: JobRecord) => Promise<Record<string, unknown> | void>

// Well-known job types
export type WellKnownJobType =
  | 'ai.sow.generate'
  | 'ai.lesson_plan.generate'
  | 'ai.assessment.generate'
  | 'report.academic_clinic'
  | 'report.term_summary'
  | 'data.import.students'
  | 'data.export.gradebook'
  | 'email.send'
  | 'whatsapp.send'
  | 'analytics.aggregate.school'
  | 'analytics.aggregate.district'
  | string
