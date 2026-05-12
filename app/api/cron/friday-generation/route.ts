// Vercel Cron: Friday 18:00 EAT (15:00 UTC)
// Generates next-week lesson plans for all teachers with active SOWs
//
// vercel.json cron config:
// { "path": "/api/cron/friday-generation", "schedule": "0 15 * * 5" }

import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError } from '@/lib/api/response'
import { generateWeeklyPlans } from '@/lib/lessonPlan/weeklyGenerator'

export const maxDuration = 300

export async function GET(req: Request) {
  // Vercel cron auth header check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const db = createServiceClient()

    // Get current term week from a simple date calculation
    const now = new Date()
    // Use a rough week number based on the current date within the year
    // In production you'd derive this from the actual term start date stored in the SOW
    const currentWeek = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    )

    // Get all active SOWs for this term
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentTerm = currentMonth <= 4 ? 1 : currentMonth <= 8 ? 2 : 3

    const { data: activeSows, error } = await db
      .from('schemes_of_work')
      .select('id, teacher_id, learning_area, grade, term, year, status')
      .eq('year', currentYear)
      .eq('term', String(currentTerm))
      .eq('status', 'saved')

    if (error) return apiError('Failed to fetch active SOWs')

    const results: Array<{
      sowId: string
      teacherId: string
      result: Awaited<ReturnType<typeof generateWeeklyPlans>>
    }> = []

    const errors: Array<{ sowId: string; error: string }> = []

    // Process each SOW — sequential to avoid rate limiting DeepSeek
    for (const sow of activeSows || []) {
      // Find the week number from the SOW's timeline
      const { data: sowFull } = await db
        .from('schemes_of_work')
        .select('timeline')
        .eq('id', sow.id)
        .single()

      const timeline = sowFull?.timeline || []
      if (!timeline.length) continue

      // Find current max taught week to determine next week to generate
      const { data: latestPlan } = await db
        .from('lesson_plans')
        .select('week_number')
        .eq('sow_id', sow.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      // If no plans exist yet, generate week 1; otherwise next after latest
      const latestWeek = latestPlan?.week_number ?? 0
      const sowCurrentWeek = latestWeek > 0 ? latestWeek : 0

      try {
        const result = await generateWeeklyPlans(sow.id, sow.teacher_id, sowCurrentWeek)
        results.push({ sowId: sow.id, teacherId: sow.teacher_id, result })

        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id: sow.id,
          week_number: sowCurrentWeek + 1,
          status: 'done',
          completed_at: new Date().toISOString(),
        })
      } catch (err: any) {
        errors.push({ sowId: sow.id, error: err.message })
        await db.from('generation_jobs').insert({
          teacher_id: sow.teacher_id,
          sow_id: sow.id,
          week_number: sowCurrentWeek + 1,
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
      }
    }

    return apiSuccess({
      processed: (activeSows || []).length,
      generated: results.length,
      errors: errors.length,
      details: results.map(r => ({
        sowId: r.sowId,
        ...r.result,
      })),
    })
  } catch (err: any) {
    console.error('[cron/friday-generation]', err)
    return apiError(err.message || 'Cron job failed')
  }
}
