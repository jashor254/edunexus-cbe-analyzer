// app/api/parent/assessments/process/route.ts
// Parent-side entry point for the assessment processing pipeline — for teacherless
// students whose parent has just entered scores via /dashboard/assessments/add.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { runAssessmentPipeline } from '@/lib/academicClinic/assessmentPipeline'

const BodySchema = z.object({
  assessment_id: z.string().uuid(),
  student_id:    z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { assessment_id, student_id } = parsed.data

    const db = createServiceClient()

    // Ownership check: student must belong to this parent (self-created OR teacher-linked)
    const { data: student } = await db
      .from('students')
      .select('id, user_id, parent_user_id, name')
      .eq('id', student_id)
      .single()
    if (!student) return apiForbidden()
    const owned = student.user_id === user.id || student.parent_user_id === user.id
    if (!owned) return apiForbidden()

    const result = await runAssessmentPipeline({
      studentId:    student_id,
      assessmentId: assessment_id,
      actorName:    'Parent',
      actorUserId:  user.id,
      notify:       false,
    })

    if (result.status === 'error') return apiError(result.error ?? 'Failed to process assessment')

    return apiSuccess({ result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[parent/assessments/process POST]', msg)
    return apiError('Internal server error')
  }
}
