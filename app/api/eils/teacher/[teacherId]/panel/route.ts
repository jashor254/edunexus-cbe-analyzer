// app/api/eils/teacher/[teacherId]/panel/route.ts
// GET /api/eils/teacher/:teacherId/panel?class_id=...
// Returns the EILS teacher intelligence panel for a given class.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { buildTeacherPanel } from '@/lib/eils'

const QuerySchema = z.object({
  class_id: z.string().uuid(),
  week_of:  z.string().optional(),
})

export async function GET(
  req:     Request,
  { params }: { params: Promise<{ teacherId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { teacherId } = await params
    const db = createServiceClient()

    // Verify caller is the teacher
    const { data: teacher } = await db
      .from('teachers')
      .select('id, user_id')
      .eq('id', teacherId)
      .single()

    if (!teacher || teacher.user_id !== user.id) return apiForbidden()

    const url    = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      class_id: url.searchParams.get('class_id'),
      week_of:  url.searchParams.get('week_of') ?? undefined,
    })
    if (!parsed.success) return apiBadRequest('class_id query param required')

    // Verify teacher owns this class
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', parsed.data.class_id)
      .eq('teacher_id', teacherId)
      .single()
    if (!cls) return apiForbidden()

    const panel = await buildTeacherPanel(
      parsed.data.class_id,
      teacherId,
      parsed.data.week_of,
    )
    return apiSuccess(panel)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build teacher panel')
  }
}
