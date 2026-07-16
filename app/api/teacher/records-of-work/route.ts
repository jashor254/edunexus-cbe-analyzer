import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const CreateRowSchema = z.object({
  schemeId:       z.string().uuid().optional(),
  school:         z.string().optional(),
  grade:          z.union([z.string(), z.number()]),
  learningArea:   z.string().min(1),
  term:           z.union([z.string(), z.number()]),
  year:           z.union([z.string(), z.number()]),
  curriculumMode: z.string().optional(),
})

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

    const db = createServiceClient()

    const { data: rows, error } = await db
      .from('records_of_work')
      .select('id, school, grade, learning_area, term, year, curriculum_mode, teacher_name, scheme_id, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return apiError('Failed to fetch records')

    // Attach entry counts — one batched query instead of 2 per row
    const rowIds = (rows || []).map(row => row.id)
    const { data: entries } = rowIds.length
      ? await db.from('row_entries').select('row_id, reflection').in('row_id', rowIds)
      : { data: [] as { row_id: string; reflection: string | null }[] }

    const totalByRow: Record<string, number> = {}
    const doneByRow: Record<string, number> = {}
    for (const entry of entries ?? []) {
      totalByRow[entry.row_id] = (totalByRow[entry.row_id] ?? 0) + 1
      if (entry.reflection) doneByRow[entry.row_id] = (doneByRow[entry.row_id] ?? 0) + 1
    }

    const withStats = (rows || []).map(row => ({
      ...row,
      total_entries:     totalByRow[row.id] ?? 0,
      completed_entries: doneByRow[row.id]  ?? 0,
    }))

    return apiSuccess({ records: withStats })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
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

    const db = createServiceClient()

    const parsed = CreateRowSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Missing required fields')
    const { schemeId, school, grade, learningArea, term, year, curriculumMode } = parsed.data

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
        teacher_name:    teacher.fullName || '',
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
