import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateHolidayPlan, generateClassHolidayPlans } from '@/lib/holiday/planner'

const SingleSchema = z.object({
  studentId:     z.string().uuid(),
  term:          z.number().int().min(1).max(3),
  year:          z.number().int().min(2024),
  holidayPeriod: z.string().min(1),
  holidayDays:   z.number().int().min(1).max(90),
  schoolId:      z.string().uuid().optional(),
})

const ClassSchema = z.object({
  classId:       z.string().uuid(),
  term:          z.number().int().min(1).max(3),
  year:          z.number().int().min(2024),
  holidayPeriod: z.string().min(1),
  holidayDays:   z.number().int().min(1).max(90),
  schoolId:      z.string().uuid().optional(),
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

    // Class-level generation
    if (body.classId) {
      const parsed = ClassSchema.safeParse(body)
      if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

      // Verify teacher owns this class
      const { data: cls } = await db
        .from('teacher_classes')
        .select('id')
        .eq('id', parsed.data.classId)
        .eq('teacher_id', teacher.id)
        .maybeSingle()
      if (!cls) return apiForbidden()

      const results = await generateClassHolidayPlans(parsed.data.classId, {
        teacherId:     teacher.id,
        term:          parsed.data.term,
        year:          parsed.data.year,
        holidayPeriod: parsed.data.holidayPeriod,
        holidayDays:   parsed.data.holidayDays,
        schoolId:      parsed.data.schoolId,
      })

      return apiSuccess({
        generated: results.filter(r => r.plan !== null).length,
        failed:    results.filter(r => r.plan === null).length,
        results,
      })
    }

    // Single student generation
    const parsed = SingleSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const plan = await generateHolidayPlan({
      studentId:     parsed.data.studentId,
      teacherId:     teacher.id,
      term:          parsed.data.term,
      year:          parsed.data.year,
      holidayPeriod: parsed.data.holidayPeriod,
      holidayDays:   parsed.data.holidayDays,
      schoolId:      parsed.data.schoolId,
    })

    return apiSuccess({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[holiday/generate]', msg)
    return apiError('Failed to generate holiday plan')
  }
}
