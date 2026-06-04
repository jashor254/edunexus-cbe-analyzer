// app/api/teacher/classes/[classId]/generate-reports/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateClassReports } from '@/lib/career/autoReportGenerator'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  assessmentIds: z.array(z.string().uuid()).min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const db = createServiceClient()

    // Verify teacher owns this class
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const { classId } = await params

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()

    if (!cls) return apiForbidden()

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('assessmentIds array required')

    const { assessmentIds } = parsed.data

    const result = await generateClassReports(classId, assessmentIds, db)

    return apiSuccess(result)
  } catch (err) {
    console.error('[generate-reports]', err)
    return apiError('Failed to generate reports')
  }
}
