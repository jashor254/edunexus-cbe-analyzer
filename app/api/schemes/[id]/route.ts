import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { z } from 'zod'

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function resolveTeacher() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, teacher: null, db: null }
  const db = createServiceClient()
  const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
  return { user, teacher, db }
}

// ─── GET /api/schemes/[id] ────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schemeId } = await params
    const { teacher, db } = await resolveTeacher()
    if (!teacher || !db) return apiUnauthorized()

    const { data: scheme, error: schemeErr } = await db
      .from('schemes_of_work')
      .select(
        'id, school, grade, learning_area, term, year, curriculum_mode, ' +
        'total_lessons, total_weeks, lessons_per_week, teacher_name, tsc_number, textbook, breaks'
      )
      .eq('id', schemeId)
      .eq('teacher_id', teacher.id)
      .single()

    if (schemeErr || !scheme) return apiNotFound('Scheme not found')

    const { data: lessons } = await db
      .from('scheme_lessons')
      .select(
        'id, week, lesson, strand, substrand, learning_outcomes, ' +
        'learning_experiences, key_inquiry_questions, learning_resources, ' +
        'assessment_methods, reflection'
      )
      .eq('scheme_id', schemeId)
      .order('week')
      .order('lesson')

    return apiSuccess({ scheme, lessons: lessons ?? [], breaks: ((scheme as unknown) as { breaks: unknown }).breaks ?? [] })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Failed to fetch scheme')
  }
}

// ─── PATCH /api/schemes/[id] ──────────────────────────────────────────────────

const PATCHABLE_FIELDS = new Set([
  'strand', 'substrand', 'learning_outcomes', 'learning_experiences',
  'key_inquiry_questions', 'learning_resources', 'assessment_methods', 'reflection',
])

const PatchSchema = z.object({
  lessonId: z.string().uuid(),
  field:    z.string(),
  value:    z.string(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schemeId } = await params
    const { teacher, db } = await resolveTeacher()
    if (!teacher || !db) return apiUnauthorized()

    const parsed = PatchSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest('Invalid request body')
    const { lessonId, field, value } = parsed.data

    if (!PATCHABLE_FIELDS.has(field)) return apiBadRequest(`Field "${field}" is not editable`)

    // Verify ownership via scheme
    const { data: lesson, error: lookupErr } = await db
      .from('scheme_lessons')
      .select('id, scheme_id')
      .eq('id', lessonId)
      .eq('scheme_id', schemeId)
      .single()

    if (lookupErr || !lesson) return apiNotFound('Lesson not found')

    // Verify teacher owns the scheme
    const { data: scheme, error: schemeErr } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', schemeId)
      .eq('teacher_id', teacher.id)
      .single()

    if (schemeErr || !scheme) return apiForbidden()

    const { error } = await db
      .from('scheme_lessons')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', lessonId)

    if (error) return apiError('Save failed: ' + error.message)

    return apiSuccess({ lessonId, field, value })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Save failed')
  }
}

// ─── DELETE /api/schemes/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schemeId } = await params
    const { teacher, db } = await resolveTeacher()
    if (!teacher || !db) return apiUnauthorized()

    const { data: scheme, error: fetchErr } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', schemeId)
      .eq('teacher_id', teacher.id)
      .single()

    if (fetchErr || !scheme) return apiNotFound('Scheme not found')

    const { error } = await db
      .from('schemes_of_work')
      .delete()
      .eq('id', schemeId)
      .eq('teacher_id', teacher.id)

    if (error) return apiError('Could not delete scheme. Please try again.')

    return apiSuccess({ deleted: schemeId })
  } catch (err: unknown) {
    console.error('[schemes/delete]', err)
    return apiError(err instanceof Error ? err.message : 'Delete failed')
  }
}
