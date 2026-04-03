import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const { data: assignments, error } = await db
      .from('assignments')
      .select(`
        *,
        teacher_classes(name, grade, subject)
      `)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })

    if (error) return apiError('Failed to fetch assignments')

    // Add submission counts
    const withCounts = await Promise.all(
      (assignments || []).map(async (a: any) => {
        const { count: totalStudents } = await db
          .from('class_students')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', a.class_id)

        const { count: submitted } = await db
          .from('assignment_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('assignment_id', a.id)
          .in('status', ['submitted', 'marked'])

        return {
          ...a,
          total_students: totalStudents || 0,
          submitted_count: submitted || 0,
        }
      })
    )

    return apiSuccess({ assignments: withCounts })
  } catch (e: any) {
    console.error('[teacher/assignments GET]', e.message)
    return apiError('Internal server error')
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const body = await req.json()
    const { class_id, title, subject, topic, instructions, due_date, type, max_score, is_compass_guided } = body

    if (!class_id || !title || !subject || !topic || !instructions || !due_date) {
      return apiError('Missing required fields', 400)
    }

    // Verify class belongs to teacher
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', class_id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!cls) return apiForbidden()

    const { data: assignment, error } = await db
      .from('assignments')
      .insert({
        class_id,
        teacher_id: teacher.id,
        title,
        subject,
        topic,
        instructions,
        due_date,
        type: type || 'practice',
        max_score: max_score || 100,
        is_compass_guided: is_compass_guided !== false,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[teacher/assignments POST]', error)
      return apiError('Failed to create assignment')
    }

    // Pre-create pending submissions for all class students
    const { data: classStudents } = await db
      .from('class_students')
      .select('student_id')
      .eq('class_id', class_id)

    if (classStudents && classStudents.length > 0) {
      const submissions = classStudents.map((cs: any) => ({
        assignment_id: assignment.id,
        student_id: cs.student_id,
        class_id,
        status: 'pending',
      }))

      await db.from('assignment_submissions').insert(submissions)
    }

    return apiSuccess({ assignment }, 201)
  } catch (e: any) {
    console.error('[teacher/assignments POST]', e.message)
    return apiError('Internal server error')
  }
}
