// Shared signed-URL download route for class_resources — used by both
// teacher and student/parent surfaces. Same private-bucket + ownership-
// check-then-sign pattern as app/api/reports/clinic/[reportId]/url and
// app/api/teacher/assignments/.../file-url.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'

const BUCKET = 'class-resources'
const SIGNED_URL_TTL_SECONDS = 60 * 5

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const resource = await repos.classResources.findResourceById(id)
    if (!resource) return apiNotFound('Resource not found')

    const db = createServiceClient()

    // Teacher who owns the resource
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('id', resource.teacher_id)
      .eq('user_id', userId)
      .maybeSingle()

    // Student or parent currently in the resource's class
    let membership = null as { id: string } | null
    if (!teacher) {
      const { data: parentLink } = await db
        .from('class_students')
        .select('id')
        .eq('class_id', resource.class_id)
        .eq('parent_id', userId)
        .maybeSingle()
      membership = parentLink

      if (!membership) {
        const { data: student } = await db
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
        if (student) {
          const { data: studentLink } = await db
            .from('class_students')
            .select('id')
            .eq('class_id', resource.class_id)
            .eq('student_id', student.id)
            .maybeSingle()
          membership = studentLink
        }
      }
    }

    if (!teacher && !membership) return apiForbidden()

    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrl(resource.file_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed) return apiError('Failed to generate file link', 500)

    return apiSuccess({ url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS })
  } catch (e: unknown) {
    console.error('[resources/file-url]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
