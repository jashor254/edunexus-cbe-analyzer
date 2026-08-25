// app/api/students/list/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { resolveCurrentInstitutionalCompatibilityStudentId } from '@/lib/core/assignmentDiscovery'

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
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const service = createServiceClient()

    const STUDENT_SELECT = `
      id, name, grade, school, current_pathway, curriculum_type, created_at, added_by,
      assessments(id, term, year, grade, subject_scores, created_at)
    `

    // Fetch students with their assessments — include added_by to detect scenario
    const { data: rawStudents, error } = await service
      .from('students')
      .select(STUDENT_SELECT)
      .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)
      .order('name')

    if (error) {
      console.error('[students/list]', error.message)
      return apiError('Failed to load students')
    }

    let allRawStudents = rawStudents ?? []

    // Institutional (Core learner_accounts) learners have no `user_id`/
    // `parent_user_id` on their Phase 1C compatibility `students` row — the
    // query above always returns empty for them. Compass and Career
    // Intelligence both discover their own studentId through this endpoint
    // (Phase 1 — Institutional Identity Convergence), so their current
    // compatibility row is appended here the same way
    // app/api/student/home/route.ts already resolves it for the dashboard.
    if (allRawStudents.length === 0) {
      const compatStudentId = await resolveCurrentInstitutionalCompatibilityStudentId(userId)
      if (compatStudentId) {
        const { data: compatStudent } = await service
          .from('students')
          .select(STUDENT_SELECT)
          .eq('id', compatStudentId)
          .maybeSingle()
        if (compatStudent) allRawStudents = [compatStudent]
      }
    }

    // teacherManaged = true  → Scenario B (teacher created, parent linked via invite)
    // teacherManaged = false → Scenario A (parent created directly, no teacher involved)
    const students = allRawStudents.map(({ added_by, ...rest }) => ({
      ...rest,
      teacherManaged: added_by === 'teacher',
    }))

    // Get subscription/plan
    const { data: subscription } = await service
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
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
