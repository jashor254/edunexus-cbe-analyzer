// app/api/eir/explain/[recommendationId]/route.ts
// GET  /api/eir/explain/:recommendationId   — get full explanation
// POST /api/eir/explain/:recommendationId/feedback — record feedback

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getExplanation, recordFeedback } from '@/lib/eir'

export async function GET(
  _req:    Request,
  { params }: { params: Promise<{ recommendationId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { recommendationId } = await params

    const explanation = await getExplanation(recommendationId)
    if (!explanation) return apiError('Explanation not found', 404)

    // Auth: verify the requesting user has access to this student
    const db      = createServiceClient()
    const studentId = explanation.student_id

    const [teacherRes, parentRes] = await Promise.all([
      db.from('class_enrollments')
        .select('class_id, teacher_classes!inner(teacher_id, teachers!inner(user_id))')
        .eq('student_id', studentId)
        .limit(1),
      db.from('learners')
        .select('parent_user_id')
        .eq('id', studentId)
        .single(),
    ])

    const isParent  = parentRes.data?.parent_user_id === user.id
    const isTeacher = (teacherRes.data ?? []).some(row => {
      const tc = row.teacher_classes as { teachers?: { user_id?: string } } | null
      return tc?.teachers?.user_id === user.id
    })

    if (!isParent && !isTeacher) return apiForbidden()

    return apiSuccess(explanation)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get explanation')
  }
}

const FeedbackBodySchema = z.object({
  recommendationId: z.string().uuid(),
  role:             z.enum(['teacher', 'learner', 'parent']),
  feedback:         z.string().min(1).max(1000),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body   = await req.json()
    const parsed = FeedbackBodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.message, 400)

    await recordFeedback({
      recommendationId: parsed.data.recommendationId,
      role:             parsed.data.role,
      feedback:         parsed.data.feedback,
    })

    return apiSuccess({ recorded: true })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to record feedback')
  }
}
