// POST: Generate PDF HTML for one or multiple lesson plans
// Body: { planIds: string[] }
// Returns: HTML string to open in print dialog
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateLessonPlanHTML } from '@/lib/lessonPlan/pdfRenderer'
import type { LessonPlanRecord } from '@/lib/lessonPlan/types'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { planIds } = await req.json()
    if (!planIds?.length) return apiBadRequest('planIds required')

    const db = createServiceClient()

    const { data: plans, error } = await db
      .from('lesson_plans')
      .select('*')
      .in('id', planIds)
      .eq('teacher_id', user.id)
      .order('week_number')
      .order('lesson_number')

    if (error || !plans?.length) return apiForbidden()

    // Fetch SOW meta for footer
    const sowId = plans[0].sow_id
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('school, grade, learning_area, term, year, teacher_name, tsc_number')
      .eq('id', sowId)
      .single()

    const meta = {
      teacherName: sow?.teacher_name || '',
      tscNumber: sow?.tsc_number || '',
      school: sow?.school || '',
      learningArea: sow?.learning_area || '',
      grade: sow?.grade || '',
      term: sow?.term || '',
      year: sow?.year || new Date().getFullYear(),
    }

    const html = generateLessonPlanHTML(plans as LessonPlanRecord[], meta)
    return apiSuccess({ html })
  } catch (err: any) {
    console.error('[lesson-plans/download]', err)
    return apiError(err.message || 'PDF generation failed')
  }
}
