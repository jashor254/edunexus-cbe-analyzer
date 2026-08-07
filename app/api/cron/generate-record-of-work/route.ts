// Vercel Cron: Monday 06:00 EAT (03:00 UTC) — "0 3 * * 1"
//
// Keeps each scheme's Record of Work skeleton in step with its teaching
// documents. This route is now a thin driver: all behaviour lives in
// lib/row/recordOfWork.ts, the single canonical writer it shares with the
// interactive route (ADR-0032 §7).
//
// ── What changed in Phase 1, and why ────────────────────────────────────────
//
// OWNERSHIP. This route used to write `lesson_plans.teacher_id` — an
// auth.users id — into `records_of_work.teacher_id`, a column whose RLS and
// every API filter resolve `teachers.id`. Every Record of Work it produced
// was therefore invisible to the teacher who owned it. The owner is now
// derived inside `syncRecordOfWorkForScheme` from `schemes_of_work.teacher_id`,
// which is already canonical, so this route no longer handles an identity at
// all. See ADR-0032 §2.
//
// TEACHER EVIDENCE. This route used to UPSERT a payload that rewrote every
// entry column on each run. It now cannot touch `date_taught`, `reflection`
// or `remarks` — those columns are absent from the writer's payload by
// construction. See ADR-0032 §4 and the Test E regression guard.
//
// COVERAGE. This route used to skip each scheme's latest week, on the theory
// that a week is "complete" only once a newer one exists — which meant the
// final week of every scheme could never enter the Record of Work at all.
// Because entries are now structural (`status: 'planned'`) rather than an
// assertion that teaching happened, the whole scheme is seeded and the
// teacher records what was actually taught. See ADR-0032 §8.
//
// PHASE 2 — EVIDENCE CONVERGENCE. This synchronisation now also carries
// `lesson_plans.taught_date` and `lesson_plans.teacher_self_evaluation` into
// the corresponding Record of Work entry, but only to *initialise* an empty
// field. Once the Record of Work holds a teacher value it is authoritative
// and no later run can change it. That merge lives entirely in
// `convergeTeacherEvidence()`; there is no mapping logic in this route, and
// `remarks` is never touched. See ADR-0032 §11.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { timingSafeEqualString } from '@/lib/api/secretCompare'
import { syncRecordOfWorkForScheme } from '@/lib/row/recordOfWork'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!timingSafeEqualString(request.headers.get('authorization'), `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceClient()

    // Trigger condition is unchanged: a scheme enters the Record of Work
    // pipeline once it has lesson plans. Status is not gated on — teachers
    // often teach offline and never mark a lesson taught.
    const { data: candidates, error } = await db
      .from('lesson_plans')
      .select('sow_id')
      .in('status', ['generated', 'edited', 'taught'])

    if (error) {
      console.error('[cron/generate-record-of-work] lesson_plans read failed:', error.message)
      return NextResponse.json({ error: 'Failed to fetch lesson plans' }, { status: 500 })
    }

    const schemeIds = [...new Set((candidates ?? []).map(c => c.sow_id as string).filter(Boolean))]

    if (schemeIds.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No lesson plans to convert' })
    }

    const results: Array<{ sowId: string; source: string; entries: number; headerCreated: boolean }> = []
    const errors:  Array<{ sowId: string; error: string }> = []

    for (const schemeId of schemeIds) {
      try {
        const result = await syncRecordOfWorkForScheme(schemeId)
        results.push({
          sowId:         schemeId,
          source:        result.source,
          entries:       result.seeded,
          headerCreated: result.created,
        })
      } catch (err: unknown) {
        errors.push({ sowId: schemeId, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return NextResponse.json({ processed: results.length, results, errors })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron job failed'
    console.error('[cron/generate-record-of-work]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
