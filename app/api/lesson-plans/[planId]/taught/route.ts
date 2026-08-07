// PATCH: Mark a lesson plan as taught
// Body: { taught_date?: string }
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

const TaughtSchema = z.object({
  taught_date: z.string().optional(),
})

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = TaughtSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const taughtDate = parsed.data.taught_date ?? new Date().toISOString().split('T')[0]

    const db = createServiceClient()
    const { data: plan, error } = await db
      .from('lesson_plans')
      .update({
        status: 'taught',
        taught_date: taughtDate,
      })
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
    if (plan.sow_id) syncRecordOfWorkInBackground(plan.sow_id as string, 'taught')

    return apiSuccess({ plan })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
