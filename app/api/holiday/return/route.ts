// POST /api/holiday/return
//
// Holiday Return intake (Adaptive Learning v2 Architecture §4/§7/§9,
// docs/architecture/adaptive-learning-v2-architecture.md, FROZEN) —
// the teacher-facing entry point that closes the Evidence Loop. Accepts
// either a teacher's batch entry of a returned printed pack (the primary
// path for the boarding-school pilot) or the same shape from a digital
// form for a smartphone parent/learner — both produce identical Evidence.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { recordHolidayReturn } from '@/lib/holiday/return'
import { KE_CBC } from '@/lib/curriculum/regional/ke-cbc'

const BodySchema = z.object({
  studentId:      z.string().uuid(),
  weeksAssigned:  z.number().int().min(1).max(12),
  weeksCompleted: z.number().int().min(0).max(12),
  teacherComment: z.string().max(2000).nullable().optional(),
  masteryClaims: z.array(z.object({
    subject:  z.string().min(1),
    cbcLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })).max(20),
  term: z.number().int().min(1).max(3).optional(),
  year: z.number().int().min(2024).optional(),
})

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    // Ownership: the student must belong to this teacher — never trust
    // studentId from the request body alone.
    const { data: student } = await db
      .from('students')
      .select('id, name')
      .eq('id', parsed.data.studentId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!student) return apiForbidden()

    if (parsed.data.weeksCompleted > parsed.data.weeksAssigned) {
      return apiBadRequest('weeksCompleted cannot exceed weeksAssigned')
    }

    const now  = new Date()
    const term = parsed.data.term ?? KE_CBC.getCurrentTerm(now)
    const year = parsed.data.year ?? now.getFullYear()

    const result = await recordHolidayReturn({
      studentId:      parsed.data.studentId,
      studentName:    (student.name as string | null) ?? 'Student',
      teacherId:      teacher.id,
      initiatedBy:    user.id,
      academicYear:   year,
      term,
      weeksAssigned:  parsed.data.weeksAssigned,
      weeksCompleted: parsed.data.weeksCompleted,
      teacherComment: parsed.data.teacherComment ?? null,
      masteryClaims:  parsed.data.masteryClaims.map(c => ({ subject: c.subject, cbcLevel: c.cbcLevel })),
    })

    return apiSuccess({ result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[holiday/return POST]', msg)
    return apiError('Failed to record holiday return')
  }
}
