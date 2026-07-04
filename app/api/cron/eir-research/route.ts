// app/api/cron/eir-research/route.ts
// GET /api/cron/eir-research
//
// Weekly platform-wide EIR research cycle. Runs every Sunday night.
// Protected by CRON_SECRET. Uses service role throughout.
//
// What it does:
//   1. runPlatformResearchCycle()  — KG discoveries, effectiveness report, KB synthesis
//   2. evaluatePastPredictions()   — scores risk prediction accuracy
//   3. expireStalePendingOutcomes() — housekeeping on old pending outcomes
//   4. Per-active-student periodic cycle — refreshes trajectories + personalization
//
// Schedule (Vercel cron): "0 22 * * 0"  (Sunday 22:00 UTC = Monday 01:00 EAT)

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import {
  runPlatformResearchCycle,
  runLearnerResearchCycle,
} from '@/lib/eir/engine'
import {
  evaluatePastPredictions,
  expireStalePendingOutcomes,
} from '@/lib/eir'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export async function GET(req: Request): Promise<Response> {
  try {
    // ── Auth: CRON_SECRET only ────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`)) {
      return apiUnauthorized()
    }

    const startedAt = Date.now()
    const db        = createServiceClient()

    // ── 1. Platform-wide research cycle ──────────────────────────────────────
    const platformResult = await runPlatformResearchCycle()

    // ── 2. Evaluate past risk predictions for accuracy ────────────────────────
    await evaluatePastPredictions()

    // ── 3. Expire stale pending outcomes ─────────────────────────────────────
    await expireStalePendingOutcomes()

    // ── 4. Per-learner periodic cycle for active students ─────────────────────
    // "Active" = had a compass session or assessment in the last 30 days.
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()

    const { data: activeStudents } = await db
      .from('compass_sessions')
      .select('learner_id')
      .gte('created_at', cutoff)
      .limit(200)

    const studentIds = [...new Set(
      (activeStudents ?? []).map(r => r.learner_id as string).filter(Boolean)
    )]

    let periodicCycles = 0

    // Process in batches of 10 to avoid overwhelming the DB
    for (let i = 0; i < studentIds.length; i += 10) {
      const batch = studentIds.slice(i, i + 10)
      await Promise.all(
        batch.map(studentId =>
          runLearnerResearchCycle({ studentId, trigger: 'periodic' }).catch(() => {})
        )
      )
      periodicCycles += batch.length
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000)

    return apiSuccess({
      ran_at:                    new Date().toISOString(),
      elapsed_seconds:           elapsed,
      kg_discoveries:            platformResult.kg_discoveries,
      validation_acceptance_rate: platformResult.validation_summary.acceptance_rate,
      validation_effectiveness:  platformResult.validation_summary.effectiveness_rate,
      knowledge_base_hypotheses: platformResult.knowledge_base_report.total_hypotheses,
      knowledge_base_findings:   platformResult.knowledge_base_report.total_findings,
      periodic_learner_cycles:   periodicCycles,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return apiError(`EIR research cron failed: ${msg}`)
  }
}
