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
import { classifyRootCause } from '@/lib/teachingIntelligence/rootCauseClassifier'
import { runTIEForSOW } from '@/lib/teachingIntelligence/weeklyGenerator'
import type { SubstrandHealthRow } from '@/lib/teachingIntelligence/types'

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
      .select('id, teacher_id, learning_area, grade, term, year, status')
      .eq('year', currentYear)
      .eq('term', String(currentTerm))
      .in('status', ['active', 'saved'])

    if (error) return apiError('Failed to fetch active SOWs')

    const lpResults:  Array<{ sowId: string; result: Awaited<ReturnType<typeof generateWeeklyPlans>> }> = []
    const lpErrors:   Array<{ sowId: string; error: string }> = []
    const tieResults: Array<{ sowId: string; result: Awaited<ReturnType<typeof runTIEForSOW>> }> = []
    const tieErrors:  Array<{ sowId: string; error: string }> = []

    for (const sow of activeSows || []) {

      // ── 1. Lesson plan generation (unchanged logic) ─────────────────────
      const { data: sowFull } = await db
        .from('schemes_of_work')
        .select('timeline')
        .eq('id', sow.id)
        .single()

      const timeline = sowFull?.timeline || []
      if (!timeline.length) continue

      const { data: latestPlan } = await db
        .from('lesson_plans')
        .select('week_number')
        .eq('sow_id', sow.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const latestWeek    = latestPlan?.week_number ?? 0
      const sowCurrentWeek = latestWeek > 0 ? latestWeek : 0

      try {
        const result = await generateWeeklyPlans(sow.id, sow.teacher_id, sowCurrentWeek)
        lpResults.push({ sowId: sow.id, result })
        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id:     sow.id,
          week_number: sowCurrentWeek + 1,
          job_type:   'weekly_lp',
          status:     'done',
          completed_at: new Date().toISOString(),
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        lpErrors.push({ sowId: sow.id, error: message })
        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id:     sow.id,
          week_number: sowCurrentWeek + 1,
          job_type:   'weekly_lp',
          status:     'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        })
      }

      // ── 2a. Root cause backfill ─────────────────────────────────────────
      // Rule-based first (free). AI fallback only for ambiguous rows.
      // Only processes rows with struggle_count >= 1 AND root_cause IS NULL.
      try {
        const { data: pendingRows } = await db
          .from('substrand_health')
          .select('id, sow_id, teacher_id, strand, sub_strand, struggle_count, lessons_covered, assessment_level, remediated, root_cause, risk_score, last_flagged, resolved_at')
          .eq('sow_id', sow.id)
          .gte('struggle_count', 1)
          .is('root_cause', null)

        for (const row of (pendingRows ?? []) as SubstrandHealthRow[]) {
          const code = await classifyRootCause(row, {
            grade: sow.grade,
            learningArea: sow.learning_area,
          })
          await db
            .from('substrand_health')
            .update({ root_cause: code, updated_at: new Date().toISOString() })
            .eq('id', row.id)
        }

        if ((pendingRows ?? []).length > 0) {
          await db.from('generation_jobs').insert({
            teacher_id: sow.teacher_id,
            sow_id:     sow.id,
            week_number: currentWeek,
            job_type:   'gap_root_cause',
            status:     'done',
            completed_at: new Date().toISOString(),
          })
        }
      } catch (err: unknown) {
        // Root cause failure is non-fatal — TIE still computes weekly_intelligence
        console.error('[cron/tie/root_cause]', sow.id, err instanceof Error ? err.message : err)
      }

      // ── 2b. Weekly intelligence + ROW population ────────────────────────
      try {
        const tieResult = await runTIEForSOW(sow.id, sow.teacher_id, {
          grade: sow.grade,
          learningArea: sow.learning_area,
        })
        tieResults.push({ sowId: sow.id, result: tieResult })

        if (tieResult.processed) {
          await db.from('generation_jobs').insert({
            teacher_id: sow.teacher_id,
            sow_id:     sow.id,
            week_number: tieResult.weekNumber,
            job_type:   'weekly_intelligence',
            status:     'done',
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
      lp: { generated: lpResults.length, errors: lpErrors.length },
      tie: { processed: tieResults.filter(r => r.result.processed).length, errors: tieErrors.length },
      details: lpResults.map(r => ({ sowId: r.sowId, ...r.result })),
    })
  } catch (err: unknown) {
    console.error('[cron/friday-generation]', err)
    return apiError(err instanceof Error ? err.message : 'Cron job failed')
  }
}
