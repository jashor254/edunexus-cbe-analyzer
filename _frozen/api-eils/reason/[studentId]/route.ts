// app/api/eils/reason/[studentId]/route.ts
// POST /api/eils/reason/:studentId
// Ask the Education Reasoning Engine a specific question about a learner.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import {
  whyIsLearnerStruggling,
  isLearnerImproving,
  whichInterventionIsLikelyToWork,
  shouldTeacherIntervene,
} from '@/_frozen/eils'

const BodySchema = z.object({
  question: z.enum([
    'why_struggling',
    'is_improving',
    'best_intervention',
    'should_teacher_intervene',
  ]),
  grade:   z.number().int().min(1).max(12),
  subject: z.string().optional(),
})

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

    // Only teachers can query the reasoning engine
    const { data: teacher } = await db
      .from('class_enrollments')
      .select('class_id, teacher_classes!inner(teachers!inner(user_id))')
      .eq('student_id', studentId)
      .limit(1)

    const isTeacher = (teacher ?? []).some(row => {
      const tc = row.teacher_classes as { teachers?: { user_id?: string } } | null
      return tc?.teachers?.user_id === user.id
    })
    if (!isTeacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))

    const { question, grade, subject } = parsed.data

    let result
    switch (question) {
      case 'why_struggling':
        result = await whyIsLearnerStruggling(studentId, grade, subject)
        break
      case 'is_improving':
        result = await isLearnerImproving(studentId)
        break
      case 'best_intervention':
        result = await whichInterventionIsLikelyToWork(studentId, grade)
        break
      case 'should_teacher_intervene':
        result = await shouldTeacherIntervene(studentId)
        break
    }

    return apiSuccess(result)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Reasoning engine failed')
  }
}
