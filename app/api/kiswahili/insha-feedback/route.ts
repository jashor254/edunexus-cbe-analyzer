// app/api/kiswahili/insha-feedback/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { evaluateInsha } from '@/lib/kiswahili/inshaEvaluator'
import { resolveInshaCharge, recordInshaEssay } from '@/lib/kiswahili/inshaBilling'
import { apiPaymentRequired } from '@/lib/payments/paywall'
import type { InshaType } from '@/lib/kiswahili/inshaEvaluator'

const INSHA_TYPES: InshaType[] = ['masimulizi', 'hoja', 'maelezo', 'barua_rasmi', 'mazungumzo']

const RequestSchema = z.object({
  insha:     z.string().min(50,  'Insha ni fupi mno — andika angalau maneno 50').max(3000, 'Insha ni ndefu mno — upeo ni maneno 3000'),
  inshaType: z.enum(INSHA_TYPES as [InshaType, ...InshaType[]]),
  grade:     z.number().int().min(7).max(12),
  studentId: z.string().uuid().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body: unknown = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues.map(e => e.message).join('; '), 400)
    }

    const { insha, inshaType, grade, studentId } = parsed.data

    // If a studentId is given, verify the teacher owns this student
    if (studentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!student) return apiError('Student not found or access denied', 403)
    }

    // Sold as an Insha Marking Pack (lib/kiswahili/inshaBilling.ts).
    const charge = await resolveInshaCharge(user.id)
    if (charge.allowed === false) {
      if (charge.reason === 'payment_required') return apiPaymentRequired('kiswahili_insha_pack')
      return charge.reason === 'unauthenticated' ? apiUnauthorized() : apiError('Access denied', 403)
    }

    const feedback = await evaluateInsha({ insha, inshaType, grade })

    // Recorded only for a genuine evaluation — a fallback placeholder (AI
    // failed) never uses up an essay or opens a pack.
    if (!feedback.isFallback) await recordInshaEssay(charge)

    return apiSuccess({ feedback })
  } catch (err) {
    console.error('[kiswahili/insha-feedback]', err)
    return apiError('Tathmini imeshindwa — tafadhali jaribu tena')
  }
}
