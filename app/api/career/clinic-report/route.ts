// app/api/career/clinic-report/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { buildClinicReport } from '@/lib/career/clinicReportBuilder'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    // Verify student belongs to this user
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiForbidden()

    const db = createServiceClient()
    const report = await buildClinicReport(studentId, db)

    return apiSuccess({ report })
  } catch (err) {
    console.error('[career/clinic-report]', err)
    return apiError('Failed to build clinic report')
  }
}
