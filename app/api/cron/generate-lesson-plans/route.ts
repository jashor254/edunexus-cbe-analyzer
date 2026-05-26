// Vercel Cron: Friday 18:00 EAT (15:00 UTC) — "0 15 * * 5"
// Generates next-week lesson plans for all teachers with active SOWs.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { generateWeeklyPlans } from '@/lib/lessonPlan/weeklyGenerator'

export const maxDuration = 300

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = createServiceClient()

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentTerm = currentMonth <= 4 ? 1 : currentMonth <= 8 ? 2 : 3

    const { data: activeSows, error } = await db
      .from('schemes_of_work')
      .select('id, teacher_id, learning_area, grade_name, term, year')
      .eq('year', currentYear)
      .eq('term', currentTerm)
      .eq('status', 'saved')

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch active SOWs' }, { status: 500 })
    }

    const results: Array<{ sowId: string; result: Awaited<ReturnType<typeof generateWeeklyPlans>> }> = []
    const errors: Array<{ sowId: string; error: string }> = []

    // Sequential to avoid rate-limiting DeepSeek
    for (const sow of activeSows ?? []) {
      // Determine which week to generate next from existing lesson_plans
      const { data: latestPlan } = await db
        .from('lesson_plans')
        .select('week_number')
        .eq('sow_id', sow.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const latestWeek = latestPlan?.week_number ?? 0

      try {
        const result = await generateWeeklyPlans(sow.id, sow.teacher_id, latestWeek)
        results.push({ sowId: sow.id, result })

        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id: sow.id,
          week_number: latestWeek + 1,
          status: 'done',
          completed_at: new Date().toISOString(),
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ sowId: sow.id, error: message })

        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id: sow.id,
          week_number: latestWeek + 1,
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({
      processed: (activeSows ?? []).length,
      generated: results.length,
      errors: errors.length,
      details: results.map(r => ({ sowId: r.sowId, ...r.result })),
      errorDetails: errors,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cron job failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
