// Vercel Cron: Monday 06:00 EAT (03:00 UTC) — "0 3 * * 1"
// Converts completed lesson plans from previous weeks into Record of Work entries.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'

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
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceClient()

    // Fetch all generated (not yet reflected as ROW) lesson plans
    const { data: candidates, error } = await db
      .from('lesson_plans')
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, step_1, step_2, step_3')
      .eq('status', 'generated')

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

    for (const [sowId, plans] of Object.entries(bySow)) {
      try {
        const { data: sow } = await db
          .from('schemes_of_work')
          .select('teacher_id, school, grade, learning_area, term, year, curriculum_mode')
          .eq('id', sowId)
          .single()

        if (!sow) continue

        const { data: teacher } = await db
          .from('teachers')
          .select('full_name')
          .eq('id', sow.teacher_id)
          .maybeSingle()

        // Upsert the ROW header document (one per SOW)
        const { data: rowHeader, error: headerErr } = await db
          .from('records_of_work')
          .upsert(
            {
              scheme_id: sowId,
              teacher_id: plans[0].teacher_id,
              school: sow.school,
              grade: sow.grade,
              learning_area: sow.learning_area,
              term: String(sow.term),
              year: sow.year,
              curriculum_mode: sow.curriculum_mode,
              teacher_name: teacher?.full_name ?? '',
            },
            { onConflict: 'scheme_id' }
          )
          .select('id')
          .single()

        if (headerErr || !rowHeader) {
          throw new Error(headerErr?.message ?? 'Failed to upsert ROW header')
        }

        // Upsert per-lesson entries — idempotent via unique constraint (row_id, week, lesson)
        const entries = plans.map(p => ({
          row_id: rowHeader.id,
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

        const { error: entriesErr } = await db
          .from('row_entries')
          .upsert(entries, { onConflict: 'row_id,week,lesson' })

        if (entriesErr) throw new Error(entriesErr.message)

        results.push({ sowId, entriesCreated: entries.length })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ sowId, error: message })
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
