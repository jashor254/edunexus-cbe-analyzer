// POST /api/holiday/publish
// Teacher approves a generated holiday plan (or the whole class's plans) so
// it becomes visible to parents through the Learner Blueprint. Generated
// plans start as drafts — see lib/holiday/planner.ts.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { publishHolidayPlan, publishClassHolidayPlans } from '@/lib/holiday/planner'

const SingleSchema = z.object({
  studentId: z.string().uuid(),
  term:      z.number().int().min(1).max(3),
  year:      z.number().int().min(2024),
})

const ClassSchema = z.object({
  classId: z.string().uuid(),
  term:    z.number().int().min(1).max(3),
  year:    z.number().int().min(2024),
})

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const body = await req.json()

    if (body.classId) {
      const parsed = ClassSchema.safeParse(body)
      if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

      const { data: cls } = await db
        .from('teacher_classes')
        .select('id')
        .eq('id', parsed.data.classId)
        .eq('teacher_id', teacher.id)
        .maybeSingle()
      if (!cls) return apiForbidden()

      const published = await publishClassHolidayPlans(parsed.data.classId, teacher.id, parsed.data.term, parsed.data.year)
      return apiSuccess({ published })
    }

    const parsed = SingleSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    // Ownership: the plan must belong to this teacher (enforced inside
    // publishHolidayPlan's update, which filters on teacher_id).
    const published = await publishHolidayPlan(parsed.data.studentId, teacher.id, parsed.data.term, parsed.data.year)
    if (published === 0) return apiForbidden()

    return apiSuccess({ published })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[holiday/publish]', msg)
    return apiError('Failed to publish holiday plan')
  }
}
