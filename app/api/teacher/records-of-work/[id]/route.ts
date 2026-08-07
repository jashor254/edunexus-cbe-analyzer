import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const UpdateRowEntrySchema = z.object({
  entryId:     z.string().uuid(),
  date_taught: z.string().optional(),
  strand:      z.string().optional(),
  substrand:   z.string().optional(),
  reflection:  z.string().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Phase 1 — these column names are the live, canonical ones. This
    // previously selected `sow_id` and `subject`, neither of which exists on
    // records_of_work (the columns are `scheme_id` and `learning_area`), so
    // PostgREST errored and every detail request fell through to the 404
    // below. See ADR-0032 §6.
    const { data: row, error } = await db
      .from('records_of_work')
      .select('id, teacher_id, scheme_id, school, grade, learning_area, term, year, curriculum_mode, teacher_name, created_at, updated_at')
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .maybeSingle()

    if (error) return apiError('Failed to load record')
    if (!row) return apiError('Record not found', 404)

    const { data: entries } = await db
      .from('row_entries')
      .select('id, week, lesson, date_taught, strand, substrand, activities_summary, reflection')
      .eq('row_id', id)
      .order('week').order('lesson')

    return apiSuccess({ row, entries: entries || [] })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}

// PATCH: update a single entry's date / strand / substrand / reflection
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const { data: row } = await db.from('records_of_work').select('id').eq('id', id).eq('teacher_id', teacher.id).single()
    if (!row) return apiForbidden()

    const parsed = UpdateRowEntrySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'entryId required')
    const { entryId, ...fields } = parsed.data

    const allowed = ['date_taught', 'strand', 'substrand', 'reflection'] as const
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in fields && fields[key] !== undefined) update[key] = fields[key]
    }

    const { error } = await db.from('row_entries').update(update).eq('id', entryId).eq('row_id', id)
    if (error) return apiError('Update failed: ' + error.message)

    await db.from('records_of_work').update({ updated_at: new Date().toISOString() }).eq('id', id)
    return apiSuccess({ ok: true })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    // Phase 1 — the delete itself was always correctly scoped by teacher_id,
    // so a non-owner never removed anything; but the route reported
    // `{ ok: true }` regardless, telling a caller a delete had succeeded when
    // no row matched. Confirm ownership first and answer 404 (matching GET's
    // convention — non-disclosure) when there is nothing this teacher owns.
    const { data: owned } = await db
      .from('records_of_work')
      .select('id')
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .maybeSingle()

    if (!owned) return apiError('Record not found', 404)

    const { error } = await db
      .from('records_of_work')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher.id)

    if (error) return apiError('Failed to delete record')

    return apiSuccess({ ok: true })
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : 'Internal error')
  }
}
