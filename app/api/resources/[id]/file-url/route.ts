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
import { canAccessClassResource } from '@/lib/classResources/resourceAccess'

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

    // Teacher who owns the resource, or a parent/learner currently in its class
    if (!(await canAccessClassResource(userId, resource))) return apiForbidden()

    const db = createServiceClient()
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
