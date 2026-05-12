// GET /api/lesson-plans/[planId]/tsc-view
// Returns the linked assignment + results summary for the TSC inspector modal.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

interface RouteContext {
  params: Promise<{ planId: string }>
}

function cbcLevel(score: number, maxScore: number): number {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  if (pct >= 75) return 4
  if (pct >= 55) return 3
  if (pct >= 40) return 2
  return 1
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    // Verify plan belongs to this teacher
    const { data: plan } = await db
      .from('lesson_plans')
      .select('id, teacher_id')
      .eq('id', planId)
      .single()

    if (!plan) return apiNotFound('Plan not found')
    if (plan.teacher_id !== user.id) return apiForbidden()

    // Find linked assignment
    const { data: assignment } = await db
      .from('assignments')
      .select('id, title, subject, topic, max_score, status')
      .eq('lesson_plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!assignment) {
      return apiSuccess({ assignment: null, results: null })
    }

    // Fetch submissions with scores
    const { data: submissions } = await db
      .from('assignment_submissions')
      .select('id, score, status')
      .eq('assignment_id', assignment.id)

    const subs = submissions || []
    const total = subs.length
    const marked = subs.filter(s => s.status === 'marked' && s.score !== null).length

    const levelCounts = { level1: 0, level2: 0, level3: 0, level4: 0 }
    for (const s of subs) {
      if (s.status !== 'marked' || s.score === null) continue
      const lvl = cbcLevel(s.score, assignment.max_score)
      if (lvl === 1) levelCounts.level1++
      else if (lvl === 2) levelCounts.level2++
      else if (lvl === 3) levelCounts.level3++
      else levelCounts.level4++
    }

    return apiSuccess({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        subject: assignment.subject,
        topic: assignment.topic,
        status: assignment.status,
      },
      results: {
        total,
        marked,
        ...levelCounts,
      },
    })
  } catch (e: any) {
    console.error('[tsc-view GET]', e.message)
    return apiError('Internal server error')
  }
}
