import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: row, error } = await db
      .from('records_of_work').select('*')
      .eq('id', id).eq('teacher_id', teacher.id).single()

    if (error || !row) return apiError('Record not found', 404)

    const { data: entries } = await db
      .from('row_entries')
      .select('id, week, lesson, date_taught, strand, substrand, reflection')
      .eq('row_id', id)
      .order('week').order('lesson')

    return apiSuccess({ row, entries: entries || [] })
  } catch (e: any) {
    return apiError(e.message)
  }
}

// PATCH: update a single entry's date / strand / substrand / reflection
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: row } = await db.from('records_of_work').select('id').eq('id', id).eq('teacher_id', teacher.id).single()
    if (!row) return apiForbidden()

    const body = await req.json()
    const { entryId, ...fields } = body
    if (!entryId) return apiBadRequest('entryId required')

    const allowed = ['date_taught', 'strand', 'substrand', 'reflection']
    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in fields) update[key] = fields[key]
    }

    const { error } = await db.from('row_entries').update(update).eq('id', entryId).eq('row_id', id)
    if (error) return apiError('Update failed: ' + error.message)

    await db.from('records_of_work').update({ updated_at: new Date().toISOString() }).eq('id', id)
    return apiSuccess({ ok: true })
  } catch (e: any) {
    return apiError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    await db.from('records_of_work').delete().eq('id', id).eq('teacher_id', teacher.id)
    return apiSuccess({ ok: true })
  } catch (e: any) {
    return apiError(e.message)
  }
}
