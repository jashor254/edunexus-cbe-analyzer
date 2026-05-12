// POST: Mark a lesson plan as taught
// Body: { taughtDate: string, reflection?: string }
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

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { taughtDate, reflection } = await req.json()
    if (!taughtDate) return apiBadRequest('taughtDate is required')

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

    return apiSuccess({ plan })
  } catch (err: any) {
    console.error('[lesson-plans/mark-taught]', err)
    return apiError(err.message || 'Update failed')
  }
}
