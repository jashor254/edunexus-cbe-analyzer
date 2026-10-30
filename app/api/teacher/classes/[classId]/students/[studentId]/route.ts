import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { removeClassMember } from '@/lib/classes/removeClassMember'

const ParamsSchema = z.object({
  classId:   z.string().uuid(),
  studentId: z.string().uuid(),
})

// Removes one learner from the caller's own class roster. See
// lib/classes/removeClassMember.ts for what is (and is not) removed.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  try {
    const parsed = ParamsSchema.safeParse(await params)
    if (!parsed.success) return apiBadRequest('classId and studentId must be valid ids')
    const { classId, studentId } = parsed.data

    const supabase = await createClient()
    try {
      await requireAuthentication(supabase)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    let result
    try {
      result = await removeClassMember(supabase, classId, studentId)
    } catch (err) {
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    if (result.status === 'not_member') return apiNotFound('This learner is not on this class roster.')
    if (result.status === 'managed_by_school') {
      return apiError("This class's roster is managed by your school's enrolment. Remove the learner there.", 409)
    }
    return apiSuccess({ removed: true })
  } catch (e: unknown) {
    console.error('[teacher/classes/students DELETE]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
