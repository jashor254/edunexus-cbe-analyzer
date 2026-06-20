// app/api/career/growth/route.ts
// Phase 7: Returns capability growth report for a student (current vs previous snapshot).
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { getCapabilityProfile, getCapabilityHistory } from '@/lib/career/careerEngine'
import { computeCapabilityGrowth } from '@/lib/career/growthEngine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const studentId = new URL(req.url).searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    // Ownership check
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!student) return apiUnauthorized()

    const [current, history] = await Promise.all([
      getCapabilityProfile(studentId),
      getCapabilityHistory(studentId, 2),
    ])

    if (!current) return apiSuccess({ has_profile: false, growth: null })

    // Previous snapshot = second-most-recent history entry (history[0] is most recent = current)
    const previous = history.length > 1 ? (history[1].profile as typeof current) : null

    const growth = computeCapabilityGrowth(studentId, current, previous)

    return apiSuccess({ has_profile: true, growth })
  } catch (err) {
    console.error('[career/growth]', err)
    return apiError('Failed to compute growth report')
  }
}
