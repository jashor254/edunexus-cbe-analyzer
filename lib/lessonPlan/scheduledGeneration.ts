// lib/lessonPlan/scheduledGeneration.ts
//
// Which schemes the Friday cron (app/api/cron/friday-generation) generates
// next week's lesson plans for, and the generation step itself.
//
// The cron used to generate for every current-term scheme with status
// 'active' or 'saved' — whether or not anyone was teaching from it — so an
// abandoned scheme kept consuming ~5 AI calls a week and filling lesson_plans
// until its timeline ran out (docs/audits/ai-call-efficiency-deep-audit.md
// F-16).
//
// ELIGIBLE = all of:
//   1. current year + term, status 'active' | 'saved'        (unchanged; the cron's query)
//   2. the scheme's teacher resolves to an auth user          (unchanged; fail closed)
//   3. the teacher has USED the scheme within the last
//      SCHEDULED_PLAN_LOOKBACK_DAYS — any one of:
//        a. marked one of its lesson plans taught (taught_date)
//        b. generated one of its weeks themselves (generation_jobs with no
//           job_type — the cron always writes 'weekly_lp')
//        c. created the scheme (a newly saved scheme gets its first weeks)
//
// Only teacher actions with a reliable timestamp count. lesson_plans and
// schemes_of_work have no updated_at trigger, so their updated_at is not a
// signal; an 'edited' plan has no edit timestamp and is therefore not used.
// A teacher who stops teaching from a scheme stops receiving plans after the
// lookback; generating a week manually (or marking a lesson taught) resumes it.

import { repos } from '@/lib/repositories'
import type { WeeklyGenerationResult } from './types'

export const SCHEDULED_PLAN_LOOKBACK_DAYS = 21

export type SchemeUseSignals = {
  createdAt:              string | null
  latestTaughtDate:       string | null   // YYYY-MM-DD
  latestManualGeneration: string | null   // ISO
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whether a scheme shows a teacher action inside the lookback window. Pure. */
export function isSchemeInUse(signals: SchemeUseSignals, now: number): boolean {
  const since = now - SCHEDULED_PLAN_LOOKBACK_DAYS * DAY_MS
  const within = (iso: string | null): boolean => {
    if (!iso) return false
    const t = Date.parse(iso)
    return Number.isFinite(t) && t >= since
  }
  return within(signals.latestTaughtDate) || within(signals.latestManualGeneration) || within(signals.createdAt)
}

/**
 * The ids of `schemes` that are in use (rule 3). Two batched queries for the
 * whole set — never one per scheme.
 */
export async function findSchemesInUse(
  schemes: Array<{ id: string; created_at: string | null }>,
  now: number,
): Promise<Set<string>> {
  const ids = schemes.map(s => s.id)
  const sinceIso = new Date(now - SCHEDULED_PLAN_LOOKBACK_DAYS * DAY_MS).toISOString()
  const [taught, manual] = await Promise.all([
    repos.curriculum.findTaughtPlansSince(ids, sinceIso.slice(0, 10)),
    repos.curriculum.findManualGenerationsSince(ids, sinceIso),
  ])

  const latest = (rows: Array<{ sow_id: string }>, key: 'taught_date' | 'created_at'): Map<string, string> => {
    const out = new Map<string, string>()
    for (const r of rows as Array<{ sow_id: string } & Record<string, string>>) {
      const v = r[key]
      if (v && (!out.has(r.sow_id) || v > out.get(r.sow_id)!)) out.set(r.sow_id, v)
    }
    return out
  }
  const taughtBySow = latest(taught, 'taught_date')
  const manualBySow = latest(manual, 'created_at')

  return new Set(schemes
    .filter(s => isSchemeInUse({
      createdAt:              s.created_at,
      latestTaughtDate:       taughtBySow.get(s.id) ?? null,
      latestManualGeneration: manualBySow.get(s.id) ?? null,
    }, now))
    .map(s => s.id))
}

export type ScheduledScheme = {
  id:         string
  teacherId:  string   // teachers.id
  latestWeek: number   // highest week with any lesson plan (0 = none)
}

export type ScheduledGenerationDeps = {
  inUse:               Set<string>
  authUserFor:         (teacherId: string) => Promise<string | null>
  generateWeeklyPlans: (sowId: string, authUserId: string, currentWeek: number) => Promise<WeeklyGenerationResult>
  recordJob:           (row: Record<string, unknown>) => Promise<void>
}

export type ScheduledGenerationOutcome = {
  results: Array<{ sowId: string; result: WeeklyGenerationResult }>
  errors:  Array<{ sowId: string; error: string }>
  skipped: Array<{ sowId: string; reason: 'not_in_use' | 'unresolved_teacher_identity' }>
}

/**
 * Generates next week's plans for each eligible scheme, one at a time.
 * Ineligible schemes cost nothing: no identity lookup, no AI call, no job row.
 * Safe to re-run — generateWeeklyPlans skips lessons that already have a plan
 * and treats a concurrent duplicate save as already generated.
 */
export async function runScheduledLessonPlanGeneration(
  schemes: ScheduledScheme[],
  deps: ScheduledGenerationDeps,
): Promise<ScheduledGenerationOutcome> {
  const outcome: ScheduledGenerationOutcome = { results: [], errors: [], skipped: [] }

  for (const sow of schemes) {
    if (!deps.inUse.has(sow.id)) {
      outcome.skipped.push({ sowId: sow.id, reason: 'not_in_use' })
      continue
    }

    // R2 / ADR-0032 — lesson_plans.teacher_id and generation_jobs.teacher_id
    // are auth.users ids, schemes_of_work.teacher_id is a teachers.id. Fail
    // closed: without a resolvable owner there is no valid teacher_id for the
    // generated plans, and any substitute would misattribute the work.
    const authUserId = await deps.authUserFor(sow.teacherId)
    if (!authUserId) {
      outcome.skipped.push({ sowId: sow.id, reason: 'unresolved_teacher_identity' })
      continue
    }

    try {
      const result = await deps.generateWeeklyPlans(sow.id, authUserId, sow.latestWeek)
      outcome.results.push({ sowId: sow.id, result })
      await deps.recordJob({
        teacher_id:  authUserId,
        sow_id:      sow.id,
        week_number: sow.latestWeek + 1,
        job_type:    'weekly_lp',
        status:      'done',
        error_message: result.generated === 0
          ? `skipped: ${result.reason ?? 'unknown'}`
          : (result.failed ? `partial: ${result.failed} lesson(s) failed` : null),
        completed_at: new Date().toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      outcome.errors.push({ sowId: sow.id, error: message })
      await deps.recordJob({
        teacher_id:  authUserId,
        sow_id:      sow.id,
        week_number: sow.latestWeek + 1,
        job_type:    'weekly_lp',
        status:      'failed',
        error_message: message,
        completed_at: new Date().toISOString(),
      })
    }
  }

  return outcome
}
