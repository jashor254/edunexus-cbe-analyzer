// app/api/students/list/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'

const PLAN_LIMITS: Record<string, number> = {
  free:    1,
  starter: 2,
  term:    3,
  premium: 3,
  admin:   3,
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const service = createServiceClient()

    // Fetch students with their assessments
    const { data: students, error } = await service
      .from('students')
      .select(`
        id, name, grade, school, current_pathway, curriculum_type, created_at,
        assessments(id, term, year, grade, subject_scores, created_at)
      `)
      .eq('user_id', user.id)
      .order('name')

    if (error) return apiError(error.message)

    // Get subscription/plan
    const { data: subscription } = await service
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const plan = subscription?.plan || 'free'
    const maxStudents = PLAN_LIMITS[plan] ?? 1

    return apiSuccess({ students: students ?? [], plan, maxStudents })
  } catch (err) {
    console.error('[students/list]', err)
    return apiError('Server error')
  }
}
