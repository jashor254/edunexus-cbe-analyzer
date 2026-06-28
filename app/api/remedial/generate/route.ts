import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateRemedialPlan } from '@/lib/remedial/planner'

const Schema = z.object({
  sowId:          z.string().uuid(),
  classId:        z.string().uuid(),
  strand:         z.string().min(1),
  subStrand:      z.string().min(1),
  subject:        z.string().min(1),
  term:           z.number().int().min(1).max(3),
  year:           z.number().int().min(2024),
  currentWeek:    z.number().int().min(1),
  weeksRemaining: z.number().int().min(1),
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

    const parsed = Schema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    // Verify teacher owns this SOW
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', parsed.data.sowId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!sow) return apiForbidden()

    const plan = await generateRemedialPlan({
      sowId:          parsed.data.sowId,
      teacherId:      teacher.id,
      classId:        parsed.data.classId,
      strand:         parsed.data.strand,
      subStrand:      parsed.data.subStrand,
      subject:        parsed.data.subject,
      term:           parsed.data.term,
      year:           parsed.data.year,
      currentWeek:    parsed.data.currentWeek,
      weeksRemaining: parsed.data.weeksRemaining,
    })

    return apiSuccess({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[remedial/generate]', msg)
    return apiError('Failed to generate remedial plan')
  }
}
