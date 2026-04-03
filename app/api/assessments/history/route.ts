// app/api/assessments/history/route.ts
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(request.url)
    const filterStudentId = searchParams.get('student_id')
    const filterYear      = searchParams.get('year')
    const filterTerm      = searchParams.get('term')

    const service = createServiceClient()

    // Get all students for this user
    const { data: students, error: studentsError } = await service
      .from('students')
      .select('id, name, grade, school, current_pathway')
      .eq('user_id', user.id)

    if (studentsError) return apiError(studentsError.message)
    if (!students?.length) return apiSuccess({ assessments: [], students: [] })

    const studentIds = students.map(s => s.id)
    const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

    // Build assessments query
    let query = service
      .from('assessments')
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    if (filterStudentId) query = query.eq('student_id', filterStudentId)
    if (filterYear)      query = query.eq('year', Number(filterYear))
    if (filterTerm)      query = query.eq('term', Number(filterTerm))

    const { data: assessments, error: assessmentsError } = await query
    if (assessmentsError) return apiError(assessmentsError.message)

    // Enrich each assessment with student info
    const enriched = (assessments ?? []).map(a => ({
      ...a,
      student_name:    studentMap[a.student_id]?.name ?? 'Unknown',
      student_grade:   studentMap[a.student_id]?.grade ?? null,
      student_pathway: studentMap[a.student_id]?.current_pathway ?? null,
    }))

    return apiSuccess({ assessments: enriched, students })
  } catch (err) {
    console.error('[assessments/history]', err)
    return apiError('Server error')
  }
}
