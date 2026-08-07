import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { ensureRecordOfWork, seedRecordOfWorkEntries } from '@/lib/row/recordOfWork'

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

    // Phase 1 — creation and seeding both go through lib/row/recordOfWork.ts,
    // the single canonical writer shared with the Monday cron (ADR-0032 §7).
    // Two behaviours changed here, both deliberate:
    //   * get-or-create replaces the plain INSERT, so a scheme whose Record
    //     of Work the cron already created no longer surfaces a raw
    //     duplicate-key error (records_of_work_scheme_id_key).
    //   * seeding falls back across sources rather than reading
    //     scheme_lessons alone, which produced an empty document for any
    //     scheme whose scheme_lessons rows are missing.
    // Ownership is unchanged: still teachers.id, still this teacher.
    if (schemeId) {
      const { data: owned } = await db
        .from('schemes_of_work')
        .select('id')
        .eq('id', schemeId)
        .eq('teacher_id', teacher.id)
        .maybeSingle()

      if (!owned) return apiForbidden()
    }

    let rowId: string
    try {
      const header = await ensureRecordOfWork({
        schemeId:       schemeId || null,
        teacherId:      teacher.id,
        school:         school || '',
        grade:          String(grade),
        learningArea:   learningArea,
        term:           String(term),
        year:           Number(year),
        curriculumMode: curriculumMode || null,
        teacherName:    teacher.fullName || '',
      })
      rowId = header.rowId

      if (schemeId) await seedRecordOfWorkEntries(rowId, schemeId)
    } catch (err) {
      console.error('[teacher/records-of-work POST]', err instanceof Error ? err.message : String(err))
      return apiError('Failed to create record')
    }

    return apiSuccess({ rowId })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}
