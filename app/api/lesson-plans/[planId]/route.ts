// GET: Fetch a single lesson plan
// PATCH: Update a field on a lesson plan (teacher edits)
//   Body: { field: string, value: string }
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'

const EDITABLE_FIELDS = new Set([
  'organisation_of_learning',
  'introduction',
  'step_1',
  'step_2',
  'step_3',
  'conclusion',
  'extended_activities',
  'reflection',
])

interface RouteContext {
  params: Promise<{ planId: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: plan, error } = await db
      .from('lesson_plans')
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, organisation_of_learning, introduction, step_1, step_2, step_3, conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at')
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .single()

    if (error || !plan) return apiForbidden()

    return apiSuccess({ plan })
  } catch (err: unknown) {
    console.error('[lesson-plans/[planId] GET]', err)
    return apiError(err instanceof Error ? err.message : 'Fetch failed')
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { field, value } = await req.json()
    if (!field || !EDITABLE_FIELDS.has(field)) {
      return apiBadRequest(`Invalid field. Allowed: ${[...EDITABLE_FIELDS].join(', ')}`)
    }

    const db = createServiceClient()
    const { data: plan, error } = await db
      .from('lesson_plans')
      .update({ [field]: value, status: 'edited' })
      .eq('id', planId)
      .eq('teacher_id', user.id)
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, organisation_of_learning, introduction, step_1, step_2, step_3, conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at')
      .single()

    if (error || !plan) return apiForbidden()

    return apiSuccess({ plan })
  } catch (err: unknown) {
    console.error('[lesson-plans/[planId] PATCH]', err)
    return apiError(err instanceof Error ? err.message : 'Update failed')
  }
}
