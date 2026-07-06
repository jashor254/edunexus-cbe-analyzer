// app/api/eils/events/route.ts
// POST /api/eils/events
// Emit an EILS event from any external integration or webhook.
// Internal services use the lib/eils/continuousLearning.ts functions directly.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { emitEvent } from '@/_frozen/eils'

const BodySchema = z.object({
  student_id:  z.string().uuid(),
  event_type:  z.enum([
    'assessment.completed',
    'compass.session_ended',
    'formative.recorded',
    'parent.observation',
    'remedial.started',
    'remedial.completed',
    'career.profile_updated',
    'risk.escalated',
    'risk.resolved',
    'milestone.achieved',
    'academy.mission_completed',
  ]),
  source:  z.enum([
    'assessmentPipeline',
    'compass',
    'remedialPlanner',
    'parentPulse',
    'formativeSignal',
    'careerEngine',
    'academyMissions',
    'eils.coordinator',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))

    const db = createServiceClient()

    // Verify caller has access to this student
    const { data: learner } = await db
      .from('learners')
      .select('parent_user_id')
      .eq('id', parsed.data.student_id)
      .single()

    const isParent = learner?.parent_user_id === user.id

    const { data: teacherRow } = await db
      .from('class_enrollments')
      .select('class_id, teacher_classes!inner(teachers!inner(user_id))')
      .eq('student_id', parsed.data.student_id)
      .limit(1)

    const isTeacher = (teacherRow ?? []).some(row => {
      const tc = row.teacher_classes as { teachers?: { user_id?: string } } | null
      return tc?.teachers?.user_id === user.id
    })

    if (!isParent && !isTeacher) return apiForbidden()

    await emitEvent(
      parsed.data.student_id,
      parsed.data.event_type,
      parsed.data.source,
      parsed.data.payload,
    )

    return apiSuccess({ emitted: true })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to emit event')
  }
}
