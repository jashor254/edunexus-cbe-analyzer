import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import { z } from 'zod'

const bodySchema = z.object({
  tracking_id: z.string().uuid(),
  updates: z.object({
    whatsapp_sent_at: z.string().optional(),
    feedback_notes: z.string().optional(),
    feedback_received_at: z.string().optional(),
    parent_name: z.string().optional(),
    parent_phone: z.string().optional(),
  }),
})

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()
    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) return apiForbidden()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { tracking_id, updates } = parsed.data

    const service = createServiceClient()
    const { data, error } = await service
      .from('pilot_tracking')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', tracking_id)
      .select('id, student_id, term, year, whatsapp_sent_at, parent_name, parent_phone, feedback_notes, feedback_received_at, updated_at')
      .single()

    if (error) {
      console.error('[admin/pilot/tracking]', error.message)
      return apiError('Failed to update pilot tracking record')
    }

    return apiSuccess({ record: data })
  } catch (err) {
    console.error('[admin/pilot/tracking]', err)
    return apiError('Server error')
  }
}
