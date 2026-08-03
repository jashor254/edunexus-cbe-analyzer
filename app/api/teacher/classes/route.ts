import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { resolveOwningSchool } from '@/lib/core/institutionOwnership'
import { UnauthorizedError } from '@/lib/core/errors'
import { getTeacherClassListProjection } from '@/lib/teacherWorkspace/classListProjection'

function generateClassCode(subject: string, grade: number, year: string): string {
  const prefix = subject.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
  const yearSuffix = year.slice(-2)
  const rand = Math.random().toString(36).substring(2, 4).toUpperCase()
  return `${prefix}${grade}${yearSuffix}${rand}`
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

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const classesWithStats = await getTeacherClassListProjection(teacher.id)

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
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    // Institution Ownership Enforcement (Phase 0) — every new class must
    // resolve to a real school before it's created. Never derived from
    // free-text school-name matching here; see resolveOwningSchool's own
    // doc comment for why.
    const { schoolId } = await resolveOwningSchool(userId, `${teacher.fullName}'s School (pending setup)`)

    const db = createServiceClient()

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
        school_id: schoolId,
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
