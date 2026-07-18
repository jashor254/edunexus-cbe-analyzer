// Mints a short-lived signed URL for a submitted assignment file. Same
// pattern as app/api/reports/clinic/[reportId]/url/route.ts — private
// bucket, service-role client, ownership check before minting.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { requireAuthentication } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { UnauthorizedError } from '@/lib/core/errors'

const BUCKET = 'assignment-submissions'
const SIGNED_URL_TTL_SECONDS = 60 * 5

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const { submissionId } = await params

    const supabase = await createClient()
    try {
      await requireAuthentication(supabase)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const db = createServiceClient()

    const { data: submission } = await db
      .from('assignment_submissions')
      .select('id, class_id, file_path')
      .eq('id', submissionId)
      .maybeSingle()

    if (!submission) return apiNotFound('Submission not found')

    try {
      await requireClassTeacher(supabase, submission.class_id, db)
    } catch (err) {
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    if (!submission.file_path) return apiError('No file attached to this submission', 404)

    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrl(submission.file_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed) return apiError('Failed to generate file link', 500)

    return apiSuccess({ url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS })
  } catch (e: unknown) {
    console.error('[teacher/assignments/submissions/file-url]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
