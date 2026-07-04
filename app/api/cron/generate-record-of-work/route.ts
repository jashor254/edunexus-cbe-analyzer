// Vercel Cron: Monday 06:00 EAT (03:00 UTC) — "0 3 * * 1"
// Converts lesson plans from completed weeks into Record of Work entries.
// A week is considered complete once a newer week's plans have been generated
// (teachers often teach offline and never mark lessons as "taught").

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { timingSafeEqualString } from '@/lib/api/secretCompare'

export const maxDuration = 300

interface LessonPlanCandidate {
  id: string
  sow_id: string
  teacher_id: string
  week_number: number
  lesson_number: number
  strand: string
  sub_strand: string
  learning_outcomes: string[]
  key_inquiry_questions: string[]
  learning_resources: string[]
  step_1: string | null
  step_2: string | null
  step_3: string | null
}

export async function GET(request: Request) {
  if (!timingSafeEqualString(request.headers.get('authorization'), `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceClient()

    // Fetch all lesson plans regardless of taught status — teachers often teach offline
    // and never mark lessons as taught, so we can't gate on that
    const { data: candidates, error } = await db
      .from('lesson_plans')
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, step_1, step_2, step_3')
      .in('status', ['generated', 'edited', 'taught'])

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch lesson plans' }, { status: 500 })
    }

    if (!candidates?.length) {
      return NextResponse.json({ processed: 0, message: 'No lesson plans to convert' })
    }

    // Determine the max week_number per sow_id — the "current" week being generated
    const maxWeekBySow: Record<string, number> = {}
    for (const p of candidates) {
      if ((maxWeekBySow[p.sow_id] ?? 0) < p.week_number) {
        maxWeekBySow[p.sow_id] = p.week_number
      }
    }

    // Only process weeks that are strictly before the latest generated week
    // (the latest week is still "current" — not yet finished)
    const toProcess = (candidates as LessonPlanCandidate[]).filter(
      p => p.week_number < maxWeekBySow[p.sow_id]
    )

    if (!toProcess.length) {
      return NextResponse.json({ processed: 0, message: 'All generated plans are from the current week' })
    }

    // Group by sow_id
    const bySow: Record<string, LessonPlanCandidate[]> = {}
    for (const p of toProcess) {
      if (!bySow[p.sow_id]) bySow[p.sow_id] = []
      bySow[p.sow_id].push(p)
    }

    const results: Array<{ sowId: string; entriesCreated: number }> = []
    const errors: Array<{ sowId: string; error: string }> = []

    const sowIds     = Object.keys(bySow)
    const teacherIds = [...new Set(Object.values(bySow).map(plans => plans[0].teacher_id))]

    // ── Pre-fetch SOW + teacher metadata for all SOWs — 2 batched queries
    // instead of 2 queries per SOW ────────────────────────────────────────────
    const [{ data: sowRows }, { data: teacherRows }] = await Promise.all([
      db.from('schemes_of_work')
        .select('id, teacher_id, school, grade, learning_area, term, year, curriculum_mode')
        .in('id', sowIds),
      db.from('teachers').select('id, full_name').in('id', teacherIds),
    ])

    const sowById     = new Map((sowRows ?? []).map(s => [s.id, s]))
    const teacherById = new Map((teacherRows ?? []).map(t => [t.id, t]))

    // ── Upsert all ROW headers in one call, then map scheme_id -> row id ──────
    const headerRows = sowIds
      .map(sowId => {
        const sow = sowById.get(sowId)
        if (!sow) return null
        return {
          scheme_id: sowId,
          teacher_id: bySow[sowId][0].teacher_id,
          school: sow.school,
          grade: sow.grade,
          learning_area: sow.learning_area,
          term: String(sow.term),
          year: sow.year,
          curriculum_mode: sow.curriculum_mode,
          teacher_name: teacherById.get(sow.teacher_id)?.full_name ?? '',
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    const missingSowIds = sowIds.filter(id => !sowById.has(id))
    for (const sowId of missingSowIds) errors.push({ sowId, error: 'SOW not found' })

    let rowIdBySow = new Map<string, string>()
    if (headerRows.length > 0) {
      const { data: upsertedHeaders, error: headerErr } = await db
        .from('records_of_work')
        .upsert(headerRows, { onConflict: 'scheme_id' })
        .select('id, scheme_id')

      if (headerErr) {
        for (const row of headerRows) errors.push({ sowId: row.scheme_id, error: headerErr.message })
      } else {
        rowIdBySow = new Map((upsertedHeaders ?? []).map(h => [h.scheme_id, h.id]))
      }
    }

    // ── Build and upsert all per-lesson entries across every SOW in one call ──
    const allEntries: Array<{
      row_id: string; week: number; lesson: number; strand: string; substrand: string
      learning_outcomes: string[]; key_inquiry_questions: string[]; learning_resources: string[]
      activities_summary: string[]; status: string; remarks: string
    }> = []

    for (const sowId of sowIds) {
      const rowId = rowIdBySow.get(sowId)
      if (!rowId) continue

      const plans = bySow[sowId]
      const entries = plans.map(p => ({
        row_id: rowId,
        week: p.week_number,
        lesson: p.lesson_number,
        strand: p.strand,
        substrand: p.sub_strand,
        learning_outcomes: p.learning_outcomes ?? [],
        key_inquiry_questions: p.key_inquiry_questions ?? [],
        learning_resources: p.learning_resources ?? [],
        activities_summary: [p.step_1, p.step_2, p.step_3].filter((s): s is string => !!s),
        status: 'completed',
        remarks: '',
      }))
      allEntries.push(...entries)
      results.push({ sowId, entriesCreated: entries.length })
    }

    if (allEntries.length > 0) {
      const { error: entriesErr } = await db
        .from('row_entries')
        .upsert(allEntries, { onConflict: 'row_id,week,lesson' })

      if (entriesErr) {
        for (const r of results) errors.push({ sowId: r.sowId, error: entriesErr.message })
        results.length = 0
      }
    }

    return NextResponse.json({
      processed: Object.keys(bySow).length,
      results,
      errors,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron job failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
