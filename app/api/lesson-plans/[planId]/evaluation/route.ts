// PATCH: Save teacher self-evaluation for a taught lesson
// Body: { evaluation: string }
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

interface RouteContext {
  params: Promise<{ planId: string }>
}

const EvaluationSchema = z.object({
  evaluation: z.string().min(1, 'evaluation is required'),
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
    const { evaluation } = parsed.data

    const db = createServiceClient()

    // Verify plan is taught before allowing evaluation save
    const { data: existing } = await db
      .from('lesson_plans')
      .select('status')
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .single()

    if (!existing) return apiForbidden()
    if (existing.status !== 'taught') {
      return apiBadRequest('Cannot save evaluation — mark the lesson as taught first')
    }

    const { data: plan, error } = await db
      .from('lesson_plans')
      .update({ teacher_self_evaluation: evaluation })
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .eq('status', 'taught')
      .select()
      .single()

    if (error || !plan) return apiForbidden()

    return apiSuccess({ plan })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
