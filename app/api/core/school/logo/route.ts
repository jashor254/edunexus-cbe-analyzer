// app/api/core/school/logo/route.ts
// Uploads a school's crest/logo — thin route, all storage + DB work
// delegates to lib/core/school.ts's uploadSchoolLogo. Admin-gated
// (school_admin/headteacher/deputy_headteacher) since this changes what
// prints on every learner's Blueprint report for the whole school.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, PermissionDeniedError } from '@/lib/core/errors'
import { uploadSchoolLogo } from '@/lib/core/school'
import { SCHOOL_LOGO_LIMITS, isAllowedSchoolLogoType } from '@/lib/config/uploads'
import { logger } from '@/lib/observability/logger'

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: Request): Promise<Response> {
  try {
    const form = await req.formData()
    const schoolId = form.get('schoolId')
    const file = form.get('file')

    if (typeof schoolId !== 'string' || !schoolId) return apiBadRequest('schoolId is required')
    if (!(file instanceof File)) return apiBadRequest('file is required')

    const supabase = await createClient()
    try {
      await requireSchoolAdmin(supabase, schoolId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof PermissionDeniedError) return apiForbidden()
      throw err
    }

    if (file.size > SCHOOL_LOGO_LIMITS.maxFileSizeBytes) {
      return apiBadRequest(`Logo too large — max ${SCHOOL_LOGO_LIMITS.maxFileSizeBytes / (1024 * 1024)}MB`)
    }
    if (!isAllowedSchoolLogoType(file.type)) return apiBadRequest('Logo must be JPEG, PNG, or WebP')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const school = await uploadSchoolLogo(schoolId, bytes, file.type, EXTENSION_BY_MIME_TYPE[file.type])

    return apiSuccess({ school })
  } catch (e: unknown) {
    logger.error('core/school/logo POST failed', { route: '/api/core/school/logo' }, e)
    return apiError('Internal server error')
  }
}
