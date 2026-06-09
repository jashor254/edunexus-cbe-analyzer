// GET: Return document_downloads rows for the current teacher
// Response: { markers: DlMarkerRow[] }

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export interface DlMarkerRow {
  scheme_id:               string
  document_type:           'sow' | 'lesson_plans' | 'row' | 'bundle'
  last_week_downloaded:    number | null
  total_weeks:             number | null
  lesson_count_at_download: number | null
  downloaded_at:           string
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const { data: markers, error } = await db
      .from('document_downloads')
      .select('scheme_id, document_type, last_week_downloaded, total_weeks, lesson_count_at_download, downloaded_at')
      .eq('teacher_id', teacher.id)

    if (error) return apiError('Failed to fetch download markers')

    return apiSuccess({ markers: (markers ?? []) as DlMarkerRow[] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch markers'
    console.error('[documents/markers]', err)
    return apiError(msg)
  }
}
