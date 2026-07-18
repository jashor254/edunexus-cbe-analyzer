// app/api/teacher/materials/[classId]/route.ts
// List + create Content Library entries (structured notes/links) for a
// class. Thin route — all DB access via repos.classResources.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'

const CreateMaterialSchema = z.object({
  title:   z.string().min(1),
  body:    z.string().min(1),
  linkUrl: z.string().url().optional(),
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
    const materials = await repos.classResources.findMaterialsByClass(classId)
    return apiSuccess({ materials })
  } catch (e: unknown) {
    console.error('[teacher/materials GET]', e instanceof Error ? e.message : String(e))
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

    const parsed = CreateMaterialSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const material = await repos.classResources.createMaterial({
      classId,
      teacherId: teacher.id,
      title: parsed.data.title,
      body: parsed.data.body,
      linkUrl: parsed.data.linkUrl,
    })

    return apiSuccess({ material }, 201)
  } catch (e: unknown) {
    console.error('[teacher/materials POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
