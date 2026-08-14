import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication, requireStudent, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { asStudentId } from '@/lib/core/identityTypes'

/**
 * Preserves the exact original union check
 * (`.or(user_id.eq,parent_user_id.eq)`) for a specific studentId, composed
 * from the canonical self/parent gates rather than reimplemented — same
 * pattern as app/api/parent/assessments/process and whatsapp-optin (Batch F).
 */
async function isSelfOrParentOf(client: Awaited<ReturnType<typeof createClient>>, studentId: string): Promise<boolean> {
  try { await requireStudent(client, studentId); return true } catch { /* fall through */ }
  // Trust origin: this id is used against `students` / `class_students` below.
  try { await requireParent(client, asStudentId(studentId)); return true } catch { return false }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')

    const db = createServiceClient()

    // Get the student (verify it belongs to this user)
    let targetStudentId = studentId
    if (studentId) {
      if (!(await isSelfOrParentOf(supabase, studentId))) return apiError('Student not found', 403)
    } else {
      // Get all students for this user
      const { data: students } = await db
        .from('students')
        .select('id')
        .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)
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
    // Note: 'description' column does not exist — schema uses 'instructions' + 'topic'
    const { data: assignments, error } = await db
      .from('assignments')
      .select('id, class_id, title, topic, instructions, type, is_compass_guided, is_quiz, max_score, due_date, status, created_at, teacher_classes(name, grade, subject), teachers(full_name)')
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
