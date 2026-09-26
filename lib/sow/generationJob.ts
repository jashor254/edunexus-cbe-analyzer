// lib/sow/generationJob.ts
//
// A Scheme of Work is paid for when it is GENERATED, not when it is saved.
// Generation runs as a background job (`jobs` row, type SOW_GENERATE_JOB_TYPE)
// and hands the finished scheme back to the browser, which can download it as
// a PDF without ever saving it. So:
//
//   1. "The teacher's first scheme is free" is decided by generation history
//      (completed + in-flight jobs), with saved schemes also counted for rows
//      that predate the job-based pipeline. Counting saved schemes alone let a
//      teacher who only ever downloaded generate every scheme as their "first".
//
//   2. Saving is bound to a generation. Each completed generation job can be
//      saved exactly once; /api/sow/save no longer accepts a scheme the server
//      did not generate and charge for.

import { repos } from '@/lib/repositories'

export const SOW_GENERATE_JOB_TYPE = 'ai.sow.generate'

// A generation still `processing` after this long is dead — its `after()`
// callback was killed — and delivered nothing, so it must not use up the
// teacher's free scheme.
export const STALE_GENERATION_AFTER_MS = 60 * 60 * 1000

export type GenerationJobSummary = {
  id:         string
  status:     string
  created_at: string
  started_at: string | null
  payload:    Record<string, unknown> | null
}

/** Whether a generation job counts as a scheme the teacher has had. Pure. */
export function countsAsUsedGeneration(job: GenerationJobSummary, now: number): boolean {
  if (job.status === 'completed') return true
  if (job.status !== 'processing') return false
  const started = Date.parse(job.started_at ?? job.created_at)
  return Number.isFinite(started) && now - started < STALE_GENERATION_AFTER_MS
}

/**
 * Of several free-trial generations started at once (two tabs, a double
 * click), exactly one may proceed: the earliest, with id as the tie-break.
 * Every request that inserted a free-trial job calls this after its own insert,
 * so all of them see the same set and agree on the same winner. Pure.
 */
export function isWinningFreeTrial(jobId: string, freeTrialJobs: GenerationJobSummary[], now: number): boolean {
  const live = freeTrialJobs.filter(j => countsAsUsedGeneration(j, now))
  if (live.length === 0) return false
  const [winner] = [...live].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
  )
  return winner.id === jobId
}

/** True once a teacher has generated or saved any scheme of work. */
export async function hasUsedFirstScheme(userId: string, teacherId: string): Promise<boolean> {
  const [savedCount, generations] = await Promise.all([
    repos.curriculum.countByTeacher(teacherId),
    repos.jobs.listJobsForUser(userId, SOW_GENERATE_JOB_TYPE),
  ])
  if (savedCount > 0) return true
  const now = Date.now()
  return generations.some(j => countsAsUsedGeneration(j, now))
}

/**
 * Called by the generate route right after it inserts a free-trial job.
 * Returns false when a concurrent free-trial request won the race; the caller
 * must then fail its own job and ask for payment.
 */
export async function confirmFreeTrialJob(userId: string, jobId: string): Promise<boolean> {
  const jobs = await repos.jobs.listJobsForUser(userId, SOW_GENERATE_JOB_TYPE)
  const freeTrialJobs = jobs.filter(j => j.payload?.free_trial === true)
  return isWinningFreeTrial(jobId, freeTrialJobs, Date.now())
}

export type SaveClaimResult = 'claimed' | 'not_found' | 'not_ready' | 'already_saved'

/**
 * Reserve a completed generation for saving. Atomic: two saves of the same
 * generation race on a conditional update and only one wins.
 */
export async function claimGenerationForSave(jobId: string, userId: string): Promise<SaveClaimResult> {
  return repos.jobs.claimForSave(jobId, userId, SOW_GENERATE_JOB_TYPE)
}

/** Undo a claim when the save itself failed, so the teacher can retry. */
export async function releaseGenerationClaim(jobId: string): Promise<void> {
  await repos.jobs.releaseSaveClaim(jobId)
}
