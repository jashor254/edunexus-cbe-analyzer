import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id, full_name').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: rows, error } = await db
      .from('records_of_work')
      .select('id, school, grade, learning_area, term, year, curriculum_mode, teacher_name, scheme_id, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return apiError('Failed to fetch records')

    // Attach entry counts
    const withStats = await Promise.all((rows || []).map(async (row) => {
      const { count: total } = await db.from('row_entries').select('*', { count: 'exact', head: true }).eq('row_id', row.id)
      const { count: done }  = await db.from('row_entries').select('*', { count: 'exact', head: true }).eq('row_id', row.id).not('reflection', 'is', null).neq('reflection', '')
      return { ...row, total_entries: total || 0, completed_entries: done || 0 }
    }))

    return apiSuccess({ records: withStats })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id, full_name').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const body = await req.json()
    const { schemeId, school, grade, learningArea, term, year, curriculumMode } = body

    if (!grade || !learningArea || !term || !year) return apiBadRequest('Missing required fields')

    const { data: row, error: rowErr } = await db
      .from('records_of_work')
      .insert({
        teacher_id:      teacher.id,
        scheme_id:       schemeId || null,
        school:          school || '',
        grade,
        learning_area:   learningArea,
        term:            String(term),
        year:            Number(year),
        curriculum_mode: curriculumMode || null,
        teacher_name:    teacher.full_name || '',
      })
      .select('id')
      .single()

    if (rowErr) return apiError('Failed to create record: ' + rowErr.message)

    // Pre-fill entries from scheme_lessons if linked
    if (schemeId) {
      const { data: lessons } = await db
        .from('scheme_lessons')
        .select('week, lesson, strand, substrand')
        .eq('scheme_id', schemeId)
        .order('week').order('lesson')

      if (lessons && lessons.length > 0) {
        const entries = lessons.map((l: { week: number; lesson: number; strand: string | null; substrand: string | null }) => ({
          row_id:    row.id,
          week:      l.week,
          lesson:    l.lesson,
          strand:    l.strand || '',
          substrand: l.substrand || '',
        }))

        const BATCH = 200
        for (let i = 0; i < entries.length; i += BATCH) {
          await db.from('row_entries').insert(entries.slice(i, i + BATCH))
        }
      }
    }

    return apiSuccess({ rowId: row.id })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}
