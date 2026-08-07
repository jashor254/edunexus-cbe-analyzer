// POST: Mark a lesson plan as taught
// Body: { taughtDate: string, reflection?: string }
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { syncRecordOfWorkInBackground } from '@/lib/row/recordOfWork'

interface RouteContext {
  params: Promise<{ planId: string }>
}

const MarkTaughtSchema = z.object({
  taughtDate: z.string().min(1),
  reflection: z.string().optional(),
})

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = MarkTaughtSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'taughtDate is required')
    const { taughtDate, reflection } = parsed.data

    const db = createServiceClient()
    const update: Record<string, unknown> = {
      status: 'taught',
      taught_date: taughtDate,
    }
    if (reflection !== undefined) update.reflection = reflection

    const { data: plan, error } = await db
      .from('lesson_plans')
      .update(update)
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .select()
      .single()

    if (error || !plan) return apiForbidden()

    // Phase 3 — the teaching evidence has just been persisted; converge it
    // into an already-existing Record of Work now rather than leaving it
    // stale until the Monday cron. Fire-and-forget by design: the mark itself
    // has succeeded and must not be reported as failed if synchronisation
    // trips (ADR-0032 §13). No convergence logic lives here — this calls the
    // one canonical domain function.
    if (plan.sow_id) syncRecordOfWorkInBackground(plan.sow_id as string, 'mark-taught')

    return apiSuccess({ plan })
  } catch (err: unknown) {
    console.error('[lesson-plans/mark-taught]', err)
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
