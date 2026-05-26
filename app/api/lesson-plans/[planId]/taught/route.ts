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

    return apiSuccess({ plan })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
