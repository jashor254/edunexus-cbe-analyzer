// app/api/teacher/calendar/by-class/[classId]/route.ts
// Nested under by-class/ for the same reason as
// app/api/teacher/resources/by-class/[classId]/route.ts — Next.js forbids
// sibling dynamic segments with different param names ([classId] here,
// [id] in ../[id]/route.ts) at the same directory level.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { buildClassCalendar } from '@/lib/calendar/calendar'

const CreateEventSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  eventDate:   z.string().min(1),
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
    const calendar = await buildClassCalendar(classId)
    return apiSuccess({ calendar })
  } catch (e: unknown) {
    console.error('[teacher/calendar GET]', e instanceof Error ? e.message : String(e))
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

    const parsed = CreateEventSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const event = await repos.classCalendar.createEvent({
      classId, teacherId: teacher.id,
      title: parsed.data.title, description: parsed.data.description, eventDate: parsed.data.eventDate,
    })

    return apiSuccess({ event }, 201)
  } catch (e: unknown) {
    console.error('[teacher/calendar POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
