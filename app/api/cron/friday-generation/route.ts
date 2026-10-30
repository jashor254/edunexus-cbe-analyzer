// Vercel Cron: Friday 18:00 EAT (15:00 UTC)
// Two jobs per active SOW, in this order:
//   1. LP generation — next week's lesson plans (existing)
//   2. TIE processing — root cause backfill + weekly_intelligence + ROW population (new)
//
// vercel.json cron config:
// { "path": "/api/cron/friday-generation", "schedule": "0 15 * * 5" }

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError } from '@/lib/api/response'
import { generateWeeklyPlans } from '@/lib/lessonPlan/weeklyGenerator'
import { findSchemesInUse, runScheduledLessonPlanGeneration } from '@/lib/lessonPlan/scheduledGeneration'
import { classifyRootCause } from '@/lib/teachingIntelligence/rootCauseClassifier'
import { runTIEForSOW } from '@/lib/teachingIntelligence/weeklyGenerator'
import type { SubstrandHealthRow } from '@/lib/teachingIntelligence/types'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { resolveAuthUserForTeacher } from '@/lib/core/identity'

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!timingSafeEqualString(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const db = createServiceClient()

    const now         = new Date()
    const currentYear = now.getFullYear()
    const month       = now.getMonth() + 1
    const currentTerm = month <= 4 ? 1 : month <= 8 ? 2 : 3

    const termStartMonth = currentTerm === 1 ? 1 : currentTerm === 2 ? 5 : 9
    const termStart      = new Date(currentYear, termStartMonth - 1, 1)
    const currentWeek    = Math.min(
      Math.max(
        Math.floor((now.getTime() - termStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
        1
      ),
      14
    )

    const { data: activeSows, error } = await db
      .from('schemes_of_work')
      .select('id, teacher_id, learning_area, grade, term, year, status, created_at')
      .eq('year', currentYear)
      .eq('term', String(currentTerm))
      .in('status', ['active', 'saved'])

    if (error) return apiError('Failed to fetch active SOWs')

    const sowIds = (activeSows || []).map(s => s.id)

    // ── Pre-fetch per-SOW data used inside the loop — 2 batched queries
    // instead of 2 queries per SOW ────────────────────────────────────────────
    const { data: timelineRows } = sowIds.length
      ? await db.from('schemes_of_work').select('id, timeline').in('id', sowIds)
      : { data: [] as { id: string; timeline: unknown }[] }
    const timelineBySow: Record<string, unknown[]> = {}
    for (const row of timelineRows ?? []) {
      timelineBySow[row.id] = (row.timeline as unknown[]) || []
    }

    const { data: allLatestPlans } = sowIds.length
      ? await db.from('lesson_plans').select('sow_id, week_number').in('sow_id', sowIds)
      : { data: [] as { sow_id: string; week_number: number }[] }
    const latestWeekBySow: Record<string, number> = {}
    for (const plan of allLatestPlans ?? []) {
      const cur = latestWeekBySow[plan.sow_id] ?? 0
      if (plan.week_number > cur) latestWeekBySow[plan.sow_id] = plan.week_number
    }

    // R2 — `schemes_of_work.teacher_id` is a `teachers.id`, but
    // `lesson_plans.teacher_id` and `generation_jobs.teacher_id` are both
    // foreign-keyed to `auth.users(id)`. This route used to pass the
    // teachers.id straight through, so every write violated its FK — including
    // the failure record the catch block writes, which is why the breakage
    // left no trace anywhere. Resolve once per scheme, up front, and fail
    // closed if the mapping is missing rather than guessing an identity.
    // See ADR-0032 for the namespace map.
    const authIdByTeacher = new Map<string, string | null>()
    async function authUserFor(teacherId: string): Promise<string | null> {
      if (!authIdByTeacher.has(teacherId)) {
        authIdByTeacher.set(teacherId, await resolveAuthUserForTeacher(teacherId))
      }
      return authIdByTeacher.get(teacherId) ?? null
    }

    // generation_jobs writes are the route's only failure record. A silently
    // rejected insert here is what made R2 invisible, so surface it.
    async function recordJob(row: Record<string, unknown>): Promise<void> {
      const { error: jobErr } = await db.from('generation_jobs').insert(row)
      if (jobErr) {
        console.error('[cron/friday-generation] generation_jobs insert failed:', jobErr.message, row)
      }
    }
    const tieResults: Array<{ sowId: string; result: Awaited<ReturnType<typeof runTIEForSOW>> }> = []
    const tieErrors:  Array<{ sowId: string; error: string }> = []

    // ── 1. Lesson plan generation — only for schemes a teacher is actually
    // using (lib/lessonPlan/scheduledGeneration.ts defines eligibility). An
    // unused scheme costs no identity lookup, no AI call and no job row.
    const schemesWithTimeline = (activeSows || []).filter(sow => (timelineBySow[sow.id] || []).length > 0)
    const inUse = await findSchemesInUse(
      schemesWithTimeline.map(sow => ({ id: sow.id, created_at: (sow.created_at as string | null) ?? null })),
      Date.now(),
    )
    const lp = await runScheduledLessonPlanGeneration(
      schemesWithTimeline.map(sow => ({ id: sow.id, teacherId: sow.teacher_id, latestWeek: latestWeekBySow[sow.id] ?? 0 })),
      { inUse, authUserFor, generateWeeklyPlans, recordJob },
    )
    for (const skip of lp.skipped.filter(sk => sk.reason === 'unresolved_teacher_identity')) {
      console.error('[cron/friday-generation] skipped scheme — no auth user for its teacher', skip.sowId)
    }

    for (const sow of activeSows || []) {
      const timeline = timelineBySow[sow.id] || []
      if (!timeline.length) continue

      // TIE (no AI calls) still runs for every current scheme; it only acts
      // on lesson plans a teacher has evaluated. Its rows need the teacher's
      // auth id — the lookup is cached from the LP step above.
      const authUserId = await authUserFor(sow.teacher_id)
      if (!authUserId) continue

      // ── 2a. Root cause backfill ─────────────────────────────────────────
      // Deterministic: rule-based heuristics, UNKNOWN when the counters
      // cannot tell (no AI call — see rootCauseClassifier.ts).
      // Only processes rows with struggle_count >= 1 AND root_cause IS NULL.
      try {
        const { data: pendingRows } = await db
          .from('substrand_health')
          .select('id, sow_id, teacher_id, strand, sub_strand, struggle_count, lessons_covered, assessment_level, remediated, root_cause, risk_score, last_flagged, resolved_at')
          .eq('sow_id', sow.id)
          .gte('struggle_count', 1)
          .is('root_cause', null)

        const rootCauseUpdates: { id: string; root_cause: string; updated_at: string }[] = []
        for (const row of (pendingRows ?? []) as SubstrandHealthRow[]) {
          const code = classifyRootCause(row)
          rootCauseUpdates.push({ id: row.id, root_cause: code, updated_at: new Date().toISOString() })
        }

        if (rootCauseUpdates.length > 0) {
          await db.from('substrand_health').upsert(rootCauseUpdates, { onConflict: 'id' })
        }

        if ((pendingRows ?? []).length > 0) {
          await recordJob({
            teacher_id:  authUserId,
            sow_id:      sow.id,
            week_number: currentWeek,
            job_type:    'gap_root_cause',
            status:      'done',
            completed_at: new Date().toISOString(),
          })
        }
      } catch (err: unknown) {
        // Root cause failure is non-fatal — TIE still computes weekly_intelligence
        console.error('[cron/tie/root_cause]', sow.id, err instanceof Error ? err.message : err)
      }

      // ── 2b. Weekly intelligence + ROW population ────────────────────────
      try {
        // NOTE: `sow.teacher_id` (teachers.id) is correct here and is
        // deliberately NOT changed. runTIEForSOW writes
        // weekly_intelligence.teacher_id, whose only reader
        // (getTeacherAttentionTier) filters it alongside
        // learner_marks.teacher_id — both in the teachers namespace, and the
        // live rows match. Only the two auth-FK'd writers above were wrong.
        const tieResult = await runTIEForSOW(sow.id, sow.teacher_id, {
          grade: sow.grade,
          learningArea: sow.learning_area,
        })
        tieResults.push({ sowId: sow.id, result: tieResult })

        if (tieResult.processed) {
          await recordJob({
            teacher_id:  authUserId,
            sow_id:      sow.id,
            week_number: tieResult.weekNumber,
            job_type:    'weekly_intelligence',
            status:      'done',
            completed_at: new Date().toISOString(),
          })
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        tieErrors.push({ sowId: sow.id, error: message })
        console.error('[cron/tie/weekly]', sow.id, message)
      }

    } // end SOW loop

    return apiSuccess({
      term: currentTerm,
      week: currentWeek,
      processed: (activeSows || []).length,
      lp: {
        generated:  lp.results.length,
        errors:     lp.errors.length,
        skipped:    lp.skipped.length,
        not_in_use: lp.skipped.filter(sk => sk.reason === 'not_in_use').length,
      },
      tie: { processed: tieResults.filter(r => r.result.processed).length, errors: tieErrors.length },
      details: lp.results.map(r => ({ sowId: r.sowId, ...r.result })),
      skipped: lp.skipped,
    })
  } catch (err: unknown) {
    console.error('[cron/friday-generation]', err)
    return apiError(err instanceof Error ? err.message : 'Cron job failed')
  }
}
