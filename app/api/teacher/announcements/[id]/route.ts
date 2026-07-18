// Delete a class announcement (teacher-owned only).

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

    const announcement = await repos.classCalendar.findAnnouncementById(id)
    if (!announcement) return apiNotFound('Announcement not found')
    if (announcement.teacher_id !== teacher.id) return apiForbidden()

    await repos.classCalendar.deleteAnnouncement(id, teacher.id)
    return apiSuccess({ deleted: true })
  } catch (e: unknown) {
    console.error('[teacher/announcements/[id] DELETE]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
