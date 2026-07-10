import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

function generateClassCode(subject: string, grade: number, year: string): string {
  const prefix = subject.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
  const yearSuffix = year.slice(-2)
  const rand = Math.random().toString(36).substring(2, 4).toUpperCase()
  return `${prefix}${grade}${yearSuffix}${rand}`
}

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

    const { data: classes, error } = await db
      .from('teacher_classes')
      .select(`
        *,
        class_students(count)
      `)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })

    if (error) return apiError('Failed to fetch classes')

    // Get avg performance per class from assessments via class_students
    const classesWithStats = await Promise.all(
      (classes || []).map(async (cls) => {
        const { data: studentLinks } = await db
          .from('class_students')
          .select('student_id')
          .eq('class_id', cls.id)

        const studentIds = (studentLinks || []).map((s: { student_id: string }) => s.student_id)
        let avgLevel = null

        if (studentIds.length > 0) {
          const { data: assessments } = await db
            .from('assessments')
            .select('subject_scores')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false })
            .limit(studentIds.length)

          if (assessments && assessments.length > 0) {
            const allAvgs = assessments.map((a: { subject_scores: Record<string, number> }) => {
              const scores = a.subject_scores
              const vals = Object.values(scores)
              return vals.reduce((s, v) => s + v, 0) / vals.length
            })
            avgLevel = allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length
          }
        }

        return {
          ...cls,
          student_count: studentIds.length,
          avg_level: avgLevel ? Math.round(avgLevel * 10) / 10 : null,
        }
      })
    )

    const response = apiSuccess({ classes: classesWithStats })
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
    return response
  } catch (e: unknown) {
    console.error('[teacher/classes GET]', e instanceof Error ? e.message : String(e))
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
    const { name, grade, subject, academic_year, stream, standalone } = body

    if (!name || !grade || !subject || !academic_year) {
      return apiError('name, grade, subject, academic_year are required', 400)
    }

    // Generate unique class code with collision retry
    let class_code = ''
    let attempts = 0
    while (attempts < 5) {
      class_code = generateClassCode(subject, grade, academic_year)
      const { data: existing } = await db
        .from('teacher_classes')
        .select('id')
        .eq('class_code', class_code)
        .single()
      if (!existing) break
      attempts++
    }

    const { data: cls, error } = await db
      .from('teacher_classes')
      .insert({
        teacher_id: teacher.id,
        name,
        grade,
        subject,
        academic_year,
        class_code,
        // A class only auto-combines with same-grade streams in analytics
        // when it shares this exact cohort string. `standalone: true` opts
        // a class (e.g. a pilot/testing roster) out of that grouping even
        // though it shares a grade number with real streams.
        grade_cohort: standalone ? name : `Grade ${grade}`,
        ...(stream ? { stream: stream.trim() } : {}),
      })
      .select()
      .single()

    if (error) {
      console.error('[teacher/classes POST]', error)
      return apiError('Failed to create class')
    }

    return apiSuccess({ class: cls }, 201)
  } catch (e: unknown) {
    console.error('[teacher/classes POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
