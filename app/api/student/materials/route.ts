// app/api/student/materials/route.ts
// Content Library entries for any class the current student (or their
// parent) belongs to. Mirrors app/api/student/resources/route.ts exactly.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const db = createServiceClient()

    const { data: students } = await db
      .from('students')
      .select('id')
      .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)

    const studentIds = (students ?? []).map(s => s.id)
    if (!studentIds.length) return apiSuccess({ materials: [] })

    const { data: classLinks } = await db
      .from('class_students')
      .select('class_id')
      .in('student_id', studentIds)

    const classIds = [...new Set((classLinks ?? []).map(c => c.class_id))]
    if (!classIds.length) return apiSuccess({ materials: [] })

    const { data: materials, error } = await db
      .from('course_materials')
      .select('id, class_id, title, body, link_url, created_at, teacher_classes(name, subject)')
      .in('class_id', classIds)
      .order('created_at', { ascending: false })

    if (error) return apiError('Failed to fetch materials')

    return apiSuccess({ materials: materials ?? [] })
  } catch (e: unknown) {
    console.error('[student/materials GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
