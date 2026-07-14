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

    // Fetch students with their assessments — include added_by to detect scenario
    const { data: rawStudents, error } = await service
      .from('students')
      .select(`
        id, name, grade, school, current_pathway, curriculum_type, created_at, added_by,
        assessments(id, term, year, grade, subject_scores, created_at)
      `)
      .or(`user_id.eq.${user.id},parent_user_id.eq.${user.id}`)
      .order('name')

    if (error) {
      console.error('[students/list]', error.message)
      return apiError('Failed to load students')
    }

    // teacherManaged = true  → Scenario B (teacher created, parent linked via invite)
    // teacherManaged = false → Scenario A (parent created directly, no teacher involved)
    const students = (rawStudents ?? []).map(({ added_by, ...rest }) => ({
      ...rest,
      teacherManaged: added_by === 'teacher',
    }))

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

    // selfCreated counts only students the parent owns directly (Scenario A)
    const selfCreatedCount = students.filter(s => !s.teacherManaged).length

    return apiSuccess({ students, plan, maxStudents, selfCreatedCount })
  } catch (err) {
    console.error('[students/list]', err)
    return apiError('Server error')
  }
}
