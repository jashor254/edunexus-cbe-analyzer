import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { generateRemedialPlan } from '@/lib/remedial/planner'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'

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
    const access = await checkFeatureAccess('remedial_planner')
    if (access.allowed === false) {
      return apiError(
        access.reason === 'insufficient_tokens' ? 'Insufficient tokens. Please top up to generate a remedial plan.' : 'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const rateLimit = await checkDailyCallLimit(access.userId, 'remedial_planner')
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} remedial plan generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

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

    // Verify teacher owns classId too — sowId ownership alone does not imply
    // classId ownership, since the two are independent, client-supplied
    // fields. Without this check a teacher could supply any real classId and
    // pull that class's roster/learner profiles into their own plan.
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', parsed.data.classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

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

    // Charged only after a successful plan (never before, per lib/payments/access.ts).
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'remedial_planner', access.cost)
    }

    return apiSuccess({ plan })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[remedial/generate]', msg)
    return apiError('Failed to generate remedial plan')
  }
}
