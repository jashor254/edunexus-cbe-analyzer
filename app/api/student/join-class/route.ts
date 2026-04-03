import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const { classCode, studentId } = body

    if (!classCode || !studentId) {
      return apiError('classCode and studentId are required', 400)
    }

    const db = createServiceClient()

    // Verify student belongs to this user
    const { data: student } = await db
      .from('students')
      .select('id, name, grade')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (!student) return apiError('Student not found or not yours', 403)

    // Find class by code
    const { data: cls } = await db
      .from('teacher_classes')
      .select(`
        id, name, subject, grade, academic_year,
        teachers(full_name, school)
      `)
      .eq('class_code', classCode.toUpperCase().trim())
      .single()

    if (!cls) return apiNotFound('Class not found. Check the code and try again.')

    // Check if already enrolled
    const { data: existing } = await db
      .from('class_students')
      .select('id')
      .eq('class_id', cls.id)
      .eq('student_id', studentId)
      .single()

    if (existing) {
      return apiError('Student is already in this class', 400)
    }

    // Join class
    const { error } = await db
      .from('class_students')
      .insert({
        class_id: cls.id,
        student_id: studentId,
        parent_id: user.id,
      })

    if (error) {
      console.error('[student/join-class POST]', error)
      return apiError('Failed to join class')
    }

    const teacher = (cls as any).teachers

    return apiSuccess({
      class: {
        id: cls.id,
        name: cls.name,
        subject: cls.subject,
        grade: cls.grade,
        academic_year: cls.academic_year,
        teacher: teacher?.full_name || 'Unknown',
        school: teacher?.school || '',
      }
    })
  } catch (e: any) {
    console.error('[student/join-class POST]', e.message)
    return apiError('Internal server error')
  }
}
