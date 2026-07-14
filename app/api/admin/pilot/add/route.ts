import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { ADMIN_CONFIG } from '@/lib/config/api'
import { z } from 'zod'

const bodySchema = z.object({
  student_id: z.string().uuid(),
  parent_name: z.string().min(1),
  parent_phone: z.string().min(1),
  term: z.number().int().min(1).max(3),
  year: z.number().int().min(2024).max(2030),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()
    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) return apiForbidden()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { student_id, parent_name, parent_phone, term, year } = parsed.data

    const service = createServiceClient()
    const { data, error } = await service
      .from('pilot_tracking')
      .upsert(
        { student_id, parent_name, parent_phone, term, year },
        { onConflict: 'student_id,term,year' }
      )
      .select('id, student_id, term, year, parent_name, parent_phone, created_at')
      .single()

    if (error) {
      console.error('[admin/pilot/add]', error.message)
      return apiError('Failed to save pilot tracking record')
    }

    return apiSuccess({ record: data })
  } catch (err) {
    console.error('[admin/pilot/add]', err)
    return apiError('Server error')
  }
}
