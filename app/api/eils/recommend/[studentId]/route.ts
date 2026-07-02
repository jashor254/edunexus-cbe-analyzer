// app/api/eils/recommend/[studentId]/route.ts
// GET  /api/eils/recommend/:studentId  — get pending recommendations
// POST /api/eils/recommend/:studentId  — trigger recomputation

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { computeNextBestActions, markRecommendationActioned } from '@/lib/eils'

const TriggerSchema = z.object({
  trigger: z.enum(['assessment', 'compass', 'formative', 'parent', 'periodic', 'risk_change']).default('periodic'),
})

const ActionSchema = z.object({
  recommendation_id: z.string().uuid(),
  outcome:           z.enum(['effective', 'ineffective', 'partial']).optional(),
  outcome_note:      z.string().max(500).optional(),
})

export async function GET(
  _req:    Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params
    const db = createServiceClient()

    if (!await isAuthorised(user.id, studentId, db)) return apiForbidden()

    const { data } = await db
      .from('eils_recommendations')
      .select('id, action_type, priority, confidence, reasoning, evidence, expected_impact, subject, substrand, status, expires_at, created_at')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .limit(8)

    return apiSuccess(data ?? [])
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to fetch recommendations')
  }
}

export async function POST(
  req:     Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params
    const db = createServiceClient()

    if (!await isAuthorised(user.id, studentId, db)) return apiForbidden()

    const body = await req.json()

    // If body contains recommendation_id, it's marking an action as complete
    const actionParsed = ActionSchema.safeParse(body)
    if (actionParsed.success) {
      await markRecommendationActioned(
        actionParsed.data.recommendation_id,
        actionParsed.data.outcome,
        actionParsed.data.outcome_note,
      )
      return apiSuccess({ marked: true })
    }

    // Otherwise trigger recomputation
    const triggerParsed = TriggerSchema.safeParse(body)
    const trigger       = triggerParsed.success ? triggerParsed.data.trigger : 'periodic'
    const recommendations = await computeNextBestActions(studentId, trigger)
    return apiSuccess(recommendations)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to compute recommendations')
  }
}

async function isAuthorised(
  userId:    string,
  studentId: string,
  db:        ReturnType<typeof createServiceClient>,
): Promise<boolean> {
  const [teacherRes, parentRes] = await Promise.all([
    db.from('class_enrollments')
      .select('class_id, teacher_classes!inner(teachers!inner(user_id))')
      .eq('student_id', studentId)
      .limit(1),
    db.from('learners').select('parent_user_id').eq('id', studentId).single(),
  ])

  const isParent  = parentRes.data?.parent_user_id === userId
  const isTeacher = (teacherRes.data ?? []).some(row => {
    const tc = row.teacher_classes as { teachers?: { user_id?: string } } | null
    return tc?.teachers?.user_id === userId
  })

  return isParent || isTeacher
}
