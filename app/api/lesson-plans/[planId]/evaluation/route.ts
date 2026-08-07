// PATCH: Save teacher evaluation for a taught lesson (TIE Phase 1a)
// Body: { evaluation: string, followUp: 'none' | 'minor' | 'major', reflectionSource?: string }
//
// followUp is the teacher's tap (Hapana/Kidogo/Ndiyo) — required, no default.
// On followUp !== 'none', substrand_health.struggle_count is incremented synchronously.
// Core logic lives in lib/lessonPlan/evaluation.ts — called by both this route and scripts.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
} from '@/lib/api/response'
import { submitEvaluation } from '@/lib/lessonPlan/evaluation'
import { syncRecordOfWorkInBackground } from '@/lib/row/recordOfWork'

interface RouteContext {
  params: Promise<{ planId: string }>
}

const EvaluationSchema = z.object({
  evaluation: z.string().min(1, 'evaluation is required'),
  followUp: z.enum(['none', 'minor', 'major']),
  reflectionSource: z.enum(['manual', 'edited_suggestion', 'ai_suggestion']).optional(),
})

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = EvaluationSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { evaluation, followUp, reflectionSource } = parsed.data

    try {
      const plan = await submitEvaluation(planId, user.id, { evaluation, followUp, reflectionSource })

      // Phase 3 — saving the evaluation is the moment the reflection becomes
      // available, so converge it into an already-existing Record of Work
      // now instead of waiting for the Monday cron. The reflection is NOT
      // copied here: this hands off to the one canonical domain function,
      // whose guarded fill-if-empty merge still means an existing Record of
      // Work value wins (ADR-0032 §13). Fire-and-forget — the evaluation is
      // already saved and must not report failure if synchronisation trips.
      const sowId = (plan as { sow_id?: string | null }).sow_id
      if (sowId) syncRecordOfWorkInBackground(sowId, 'evaluation')

      return apiSuccess({ plan })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation failed'
      if (msg.includes('must be marked as taught')) return apiBadRequest(msg)
      if (msg.includes('not found or not owned')) return apiUnauthorized()
      throw err
    }
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
