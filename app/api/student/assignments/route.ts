import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')

    const db = createServiceClient()

    // Get the student (verify it belongs to this user)
    let targetStudentId = studentId
    if (studentId) {
      const { data: student } = await db
        .from('students')
        .select('id')
        .eq('id', studentId)
        .or(`user_id.eq.${user.id},parent_user_id.eq.${user.id}`)
        .single()
      if (!student) return apiError('Student not found', 403)
    } else {
      // Get all students for this user
      const { data: students } = await db
        .from('students')
        .select('id')
        .or(`user_id.eq.${user.id},parent_user_id.eq.${user.id}`)
        .limit(1)
      targetStudentId = students?.[0]?.id || null
    }

    if (!targetStudentId) return apiSuccess({ assignments: [] })

    // Get all classes this student is in
    const { data: classLinks } = await db
      .from('class_students')
      .select('class_id')
      .eq('student_id', targetStudentId)

    if (!classLinks || classLinks.length === 0) {
      return apiSuccess({ assignments: [] })
    }

    const classIds = classLinks.map(c => c.class_id)

    // Get active assignments for those classes
    const { data: assignments, error } = await db
      .from('assignments')
      .select('id, class_id, title, description, due_date, status, created_at, teacher_classes(name, grade, subject), teachers(full_name)')
      .in('class_id', classIds)
      .eq('status', 'active')
      .order('due_date', { ascending: true })

    if (error) return apiError('Failed to fetch assignments')

    const assignmentList = assignments || []
    const assignmentIds = assignmentList.map(a => a.id)

    // Batch-fetch all submissions in one query instead of N queries
    const { data: submissions } = assignmentIds.length > 0
      ? await db
          .from('assignment_submissions')
          .select('id, assignment_id, status, score, submitted_at, marked_at')
          .in('assignment_id', assignmentIds)
          .eq('student_id', targetStudentId!)
      : { data: [] }

    const submissionByAssignment = new Map(
      (submissions || []).map(s => [s.assignment_id, s])
    )

    const now = new Date()
    const withStatus = assignmentList.map(a => {
      const submission = submissionByAssignment.get(a.id) ?? null
      const daysLeft = Math.ceil((new Date(a.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...a,
        submission,
        submissionStatus: submission?.status || 'pending',
        daysLeft,
        isOverdue: daysLeft < 0 && (!submission || submission.status === 'pending'),
      }
    })

    return apiSuccess({ assignments: withStatus })
  } catch (e: unknown) {
    console.error('[student/assignments GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
