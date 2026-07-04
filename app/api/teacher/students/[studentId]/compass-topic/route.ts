// app/api/teacher/students/[studentId]/compass-topic/route.ts
// PATCH — teacher sets a specific Compass starting topic for a struggling student

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { z } from 'zod'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid request')

    const { subject, concept, strandName } = parsed.data

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    // Verify this student belongs to the authenticated teacher
    const { data: student } = await db
      .from('students')
      .select('id, teacher_id')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiBadRequest('Student not found')
    if (student.teacher_id !== teacher.id) return apiForbidden()

    // Upsert student_learning_context with updated compass_bridge
    const { data: existing } = await db
      .from('student_learning_context')
      .select('compass_bridge')
      .eq('student_id', studentId)
      .maybeSingle()

    const currentBridge = (existing?.compass_bridge as Record<string, unknown>) ?? {}

    const updatedBridge = {
      ...currentBridge,
      firstSubject:        subject,
      firstConcept:        concept,
      strandName:          strandName ?? null,
      teacherSuggested:    true,
      teacherSuggestedAt:  new Date().toISOString(),
    }

    const { error } = await db
      .from('student_learning_context')
      .upsert(
        {
          student_id:    studentId,
          compass_bridge: updatedBridge,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'student_id' }
      )

    if (error) throw error

    return apiSuccess({ ok: true })
  } catch (err) {
    console.error('[teacher/compass-topic]', err)
    return apiError('Failed to update compass topic')
  }
}
