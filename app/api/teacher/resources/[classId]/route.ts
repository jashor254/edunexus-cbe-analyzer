// app/api/teacher/resources/[classId]/route.ts
// List + upload class resources (files) for a class. Thin route — Storage
// upload + DB row creation both delegate to repos.classResources /
// service-role Storage client, matching app/api/student/submit-file's
// upload pattern.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { UPLOAD_LIMITS, isAllowedUploadType } from '@/lib/config/uploads'
import { repos } from '@/lib/repositories'

const BUCKET = 'class-resources'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }
    const resources = await repos.classResources.findResourcesByClass(classId)
    return apiSuccess({ resources })
  } catch (e: unknown) {
    console.error('[teacher/resources GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireClassTeacher(supabase, classId)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const form = await req.formData()
    const title = form.get('title')
    const file = form.get('file')

    if (typeof title !== 'string' || !title.trim()) return apiBadRequest('title is required')
    if (!(file instanceof File)) return apiBadRequest('file is required')
    if (file.size > UPLOAD_LIMITS.maxFileSizeBytes) {
      return apiBadRequest(`File too large — max ${UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)}MB`)
    }
    if (!isAllowedUploadType(file.type)) return apiBadRequest('Unsupported file type')

    const db = createServiceClient()
    const ext = file.name.split('.').pop() || 'bin'
    const objectPath = `${classId}/${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[teacher/resources POST] upload', uploadError.message)
      return apiError('Failed to upload file')
    }

    const resource = await repos.classResources.createResource({
      classId,
      teacherId: teacher.id,
      title: title.trim(),
      filePath: objectPath,
      fileName: file.name,
      fileType: file.type,
    })

    return apiSuccess({ resource }, 201)
  } catch (e: unknown) {
    console.error('[teacher/resources POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
