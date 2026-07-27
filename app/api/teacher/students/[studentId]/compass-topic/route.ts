// app/api/teacher/students/[studentId]/compass-topic/route.ts
// PATCH — teacher sets a specific Compass starting topic for a struggling student

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { resolveTeacherOwnership } from '@/lib/compass/ownership'
import { setTeacherSuggestedTopic } from '@/lib/compass/objective'
import { z } from 'zod'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

// Sprint 1B Batch E note: only the top-level auth check below is migrated.
// `resolveTeacherOwnership` (lib/compass/ownership.ts) is Intelligence/Compass
// domain logic — a student-scoped ownership resolver, the same one found
// untouched in Batch C's compass/evidence route — left completely untouched,
// per "Do NOT touch Intelligence Layer."

const BodySchema = z.object({
  subject:    z.string().min(1),
  concept:    z.string().min(1),
  strandName: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const { studentId } = await params

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid request')

    const { subject, concept, strandName } = parsed.data

    const ownership = await resolveTeacherOwnership(userId, studentId)
    if (!ownership.allowed) return apiForbidden()

    await setTeacherSuggestedTopic({ studentId, subject, concept, strandName })

    return apiSuccess({ ok: true })
  } catch (err) {
    console.error('[teacher/compass-topic]', err)
    return apiError('Failed to update compass topic')
  }
}
