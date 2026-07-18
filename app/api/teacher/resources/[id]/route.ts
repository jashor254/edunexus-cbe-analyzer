// Delete a class resource (teacher-owned only).

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'

export async function DELETE(
  _req: Request,
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

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const resource = await repos.classResources.findResourceById(id)
    if (!resource) return apiNotFound('Resource not found')
    if (resource.teacher_id !== teacher.id) return apiForbidden()

    await repos.classResources.deleteResource(id, teacher.id)
    return apiSuccess({ deleted: true })
  } catch (e: unknown) {
    console.error('[teacher/resources/[id] DELETE]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
