import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

// Sprint 1B Batch F note: only the top-level auth check below is migrated.
// This route's ownership mechanism is `class_students.parent_id` — a third
// mechanism, distinct from `students.parent_user_id` (the dominant one used
// elsewhere in this batch) and from Core's `learner_guardians`. First found
// in Batch B's clinic/[reportId]/url route; confirmed here in a second file.
// Not modeled by any Sprint 1A canonical function — left completely
// untouched, per the Discovery Rule (document, do not normalize).

type Alert = {
  id: string
  alert_type: string
  message: string
  is_resolved: boolean
  created_at: string
  student_id: string
  student_name: string
  student_grade: number
  teacher_name: string
  teacher_school: string
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

    const db = createServiceClient()

    // Get all students linked to this parent via class_students
    const { data: classStudents, error: csError } = await db
      .from('class_students')
      .select('student_id')
      .eq('parent_id', userId)

    if (csError) return apiError('Failed to fetch student links')

    if (!classStudents || classStudents.length === 0) {
      return apiSuccess({ alerts: [] })
    }

    const studentIds = classStudents.map((cs) => cs.student_id as string)

    // Fetch alerts for those students, joining student + teacher data
    const { data: rawAlerts, error: alertsError } = await db
      .from('student_alerts')
      .select(`
        id,
        alert_type,
        message,
        is_resolved,
        created_at,
        student_id,
        students!inner(name, grade),
        teachers!inner(full_name, school)
      `)
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    if (alertsError) return apiError('Failed to fetch alerts')

    const alerts: Alert[] = (rawAlerts ?? []).map((a) => {
      const student = (a.students as unknown as { name: string; grade: number })
      const teacher = (a.teachers as unknown as { full_name: string; school: string })
      return {
        id:             a.id as string,
        alert_type:     a.alert_type as string,
        message:        a.message as string,
        is_resolved:    a.is_resolved as boolean,
        created_at:     a.created_at as string,
        student_id:     a.student_id as string,
        student_name:   student.name,
        student_grade:  student.grade,
        teacher_name:   teacher.full_name,
        teacher_school: teacher.school,
      }
    })

    return apiSuccess({ alerts })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[parent/alerts GET]', message)
    return apiError('Internal server error')
  }
}
