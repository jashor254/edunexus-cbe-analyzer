// app/api/teacher/announcements/by-class/[classId]/route.ts
// Nested under by-class/ for the same reason as the calendar/resources
// routes — Next.js forbids sibling dynamic segments with different param
// names at the same directory level.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1),
  body:  z.string().min(1),
})

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
    const announcements = await repos.classCalendar.findAnnouncementsByClass(classId)
    return apiSuccess({ announcements })
  } catch (e: unknown) {
    console.error('[teacher/announcements GET]', e instanceof Error ? e.message : String(e))
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

    const parsed = CreateAnnouncementSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const announcement = await repos.classCalendar.createAnnouncement({
      classId, teacherId: teacher.id, title: parsed.data.title, body: parsed.data.body,
    })

    return apiSuccess({ announcement }, 201)
  } catch (e: unknown) {
    console.error('[teacher/announcements POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
