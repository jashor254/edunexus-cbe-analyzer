import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { recordSchoolNameForReconciliation } from '@/lib/core/school'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

const UpdateProfileSchema = z.object({
  full_name:    z.string().trim().min(1),
  school:       z.string().trim().min(1),
  subject:      z.string().optional(),
  grade_levels: z.array(z.number().int()).optional(),
  phone:        z.string().optional(),
  tsc_number:   z.string().optional(),
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

    const db = createServiceClient()
    const { data: teacher, error } = await db
      .from('teachers')
      .select('id, user_id, full_name, school, subject, grade_levels, phone, is_verified, tsc_number, created_at, pioneer_number')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[teacher/profile GET]', error)
      return apiError(`Failed to fetch teacher profile: ${error.message}`)
    }

    return apiSuccess({ teacher: teacher ?? null })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/profile GET]', msg)
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

    const parsed = UpdateProfileSchema.safeParse(await req.json())
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'full_name and school are required', 400)
    const { full_name, school, subject, grade_levels, phone, tsc_number } = parsed.data

    // Use the user's own authenticated client for INSERT/UPDATE so RLS
    // (auth.uid() = user_id) passes without needing service role on user tables.
    // Service client is reserved for the pioneer counter (touches beta_stats).

    // Check if teacher already exists — drives INSERT vs UPDATE and pioneer logic
    const { data: existing, error: lookupErr } = await supabase
      .from('teachers')
      .select('id, pioneer_number')
      .eq('user_id', userId)
      .maybeSingle()

    if (lookupErr) {
      console.error('[teacher/profile POST] lookup error', lookupErr)
      return apiError(`Profile lookup failed: ${lookupErr.message}`, 500)
    }

    const fields = {
      full_name,
      school,
      subject:      subject      ?? null,
      grade_levels: grade_levels ?? [7, 8, 9, 10, 11, 12],
      phone:        phone        ?? null,
      tsc_number:   tsc_number   ?? null,
    }

    let teacher: Record<string, unknown> | null = null

    if (existing) {
      // UPDATE — row already exists, just patch it
      const { data, error } = await supabase
        .from('teachers')
        .update(fields)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) {
        console.error('[teacher/profile POST] update error', error)
        return apiError(`Failed to update teacher profile: ${error.message}`, 500)
      }
      teacher = data
    } else {
      // INSERT — first time setup
      const { data, error } = await supabase
        .from('teachers')
        .insert({ user_id: userId, ...fields })
        .select()
        .single()
      if (error) {
        console.error('[teacher/profile POST] insert error', error)
        return apiError(`Failed to create teacher profile: ${error.message}`, 500)
      }
      teacher = data
    }

    // Observation only — this NEVER creates a school membership.
    //
    // It used to: the free-text school name was matched against `schools` and
    // a matching teacher got an active `school_users` row on the spot, which
    // (via lib/core/schoolEntitlement.ts) handed them that school's paid
    // entitlement. Institutional membership is provisioned by a school
    // administrator through POST /api/core/teachers and claimed by the
    // teacher; it is not something a teacher can type themselves into.
    //
    // Still best-effort and still never blocks the profile save — the call
    // only writes a log line now, but a logging failure must not cost a
    // teacher their setup.
    try {
      await recordSchoolNameForReconciliation(userId, school)
    } catch (linkErr) {
      console.error('[teacher/profile POST] school name reconciliation log failed', linkErr)
    }

    // Pioneer counter needs service role to touch beta_stats
    if (!existing && !teacher.pioneer_number) {
      const db = createServiceClient()
      const { data: pioneerNum, error: rpcErr } = await db.rpc('increment_beta_teacher_count')
      if (!rpcErr && pioneerNum) {
        const { data: updated } = await supabase
          .from('teachers')
          .update({ pioneer_number: pioneerNum })
          .eq('user_id', userId)
          .select()
          .single()

        return apiSuccess({ teacher: updated ?? teacher })
      }
    }

    return apiSuccess({ teacher })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teacher/profile POST]', msg)
    return apiError(`Failed to save: ${msg}`)
  }
}
