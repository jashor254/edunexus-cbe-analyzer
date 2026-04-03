import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'

const ADMIN_EMAIL = 'kariukidennis092@gmail.com'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const service = createServiceClient()

    // Fetch everything in parallel — individual failures return safe defaults
    const [
      studentsResult,
      assessmentsResult,
      sessionsResult,
      subscriptionResult,
      tokenResult,
      teacherResult,
    ] = await Promise.all([
      service
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      service
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      service
        .from('compass_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('learner_id', user.id),
      service
        .from('subscriptions')
        .select('plan, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from('token_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle(),
      service
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const studentsCount = studentsResult.count ?? 0
    const assessmentsCount = assessmentsResult.count ?? 0
    const sessionsCount = sessionsResult.count ?? 0
    const subscription = subscriptionResult.data
      ? { plan: subscriptionResult.data.plan, expiresAt: subscriptionResult.data.expires_at }
      : null
    const tokenBalance = tokenResult.data?.balance ?? 0
    const hasTeacherAccount = !!teacherResult.data

    // Pending assignments: students → class_students → assignments due in future
    let pendingAssignments = 0
    if (studentsCount > 0) {
      const { data: studentIds } = await service
        .from('students')
        .select('id')
        .eq('user_id', user.id)

      if (studentIds && studentIds.length > 0) {
        const ids = studentIds.map((s: { id: string }) => s.id)
        const { data: classLinks } = await service
          .from('class_students')
          .select('class_id')
          .in('student_id', ids)

        if (classLinks && classLinks.length > 0) {
          const classIds = [...new Set(classLinks.map((c: { class_id: string }) => c.class_id))]
          const { count } = await service
            .from('assignments')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classIds)
            .gt('due_date', new Date().toISOString())
          pendingAssignments = count ?? 0
        }
      }
    }

    // Teacher stats (only if user has teacher account)
    let teacherStudentsCount = 0
    let teacherAssignmentsCount = 0
    if (hasTeacherAccount && teacherResult.data) {
      const teacherId = (teacherResult.data as { id: string }).id
      const { data: teacherClasses } = await service
        .from('teacher_classes')
        .select('id')
        .eq('teacher_id', teacherId)

      if (teacherClasses && teacherClasses.length > 0) {
        const classIds = teacherClasses.map((c: { id: string }) => c.id)
        const [linkedStudents, activeAssignments] = await Promise.all([
          service
            .from('class_students')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classIds),
          service
            .from('assignments')
            .select('id', { count: 'exact', head: true })
            .eq('teacher_id', teacherId)
            .gt('due_date', new Date().toISOString()),
        ])
        teacherStudentsCount = linkedStudents.count ?? 0
        teacherAssignmentsCount = activeAssignments.count ?? 0
      }
    }

    return apiSuccess({
      studentsCount,
      assessmentsCount,
      sessionsCount,
      subscription,
      tokenBalance,
      pendingAssignments,
      isAdmin: user.email === ADMIN_EMAIL,
      hasTeacherAccount,
      teacherStudentsCount,
      teacherAssignmentsCount,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err)
    return apiError('Server error')
  }
}
