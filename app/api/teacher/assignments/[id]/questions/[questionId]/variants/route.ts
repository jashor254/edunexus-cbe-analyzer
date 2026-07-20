// GET — list every variant (any status) for one canonical question.
// The teacher review screen's read path.
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { findVariantsForQuestion } from '@/lib/assignments/variants'

async function loadClassId(questionId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data: question } = await db.from('assignment_questions').select('assignment_id').eq('id', questionId).maybeSingle()
  if (!question) return null
  const { data: assignment } = await db.from('assignments').select('class_id').eq('id', question.assignment_id).maybeSingle()
  return assignment?.class_id ?? null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { questionId } = await params
    const classId = await loadClassId(questionId)
    if (!classId) return apiNotFound('Question not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const variants = await findVariantsForQuestion(questionId)
    return apiSuccess({ variants })
  } catch (e: unknown) {
    console.error('[variants GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
