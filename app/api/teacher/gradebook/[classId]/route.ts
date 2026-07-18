// app/api/teacher/gradebook/[classId]/route.ts
// Thin route — all aggregation lives in lib/gradebook/gradebook.ts.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { buildGradebook } from '@/lib/gradebook/gradebook'

export async function GET(
  _req: NextRequest,
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

    const gradebook = await buildGradebook(classId, teacher.id)
    return apiSuccess({ gradebook })
  } catch (e: unknown) {
    console.error('[teacher/gradebook GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
