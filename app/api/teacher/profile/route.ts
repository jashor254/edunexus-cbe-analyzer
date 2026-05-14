import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher, error } = await db
      .from('teachers')
      .select('id, user_id, full_name, school, subject, grade_levels, phone, is_verified, tsc_number, created_at, pioneer_number')
      .eq('user_id', user.id)
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const { full_name, school, subject, grade_levels, phone, tsc_number } = body

    if (!full_name || !school) {
      return apiError('full_name and school are required', 400)
    }

    const db = createServiceClient()

    // Check if teacher already exists — drives INSERT vs UPDATE and pioneer logic
    const { data: existing, error: lookupErr } = await db
      .from('teachers')
      .select('id, pioneer_number')
      .eq('user_id', user.id)
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
      const { data, error } = await db
        .from('teachers')
        .update(fields)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) {
        console.error('[teacher/profile POST] update error', error)
        return apiError(`Failed to update teacher profile: ${error.message}`, 500)
      }
      teacher = data
    } else {
      // INSERT — first time setup
      const { data, error } = await db
        .from('teachers')
        .insert({ user_id: user.id, ...fields })
        .select()
        .single()
      if (error) {
        console.error('[teacher/profile POST] insert error', error)
        return apiError(`Failed to create teacher profile: ${error.message}`, 500)
      }
      teacher = data
    }

    // Assign pioneer number only on first-ever setup
    if (!existing && !teacher.pioneer_number) {
      const { data: pioneerNum, error: rpcErr } = await db.rpc('increment_beta_teacher_count')
      if (!rpcErr && pioneerNum) {
        const { data: updated } = await db
          .from('teachers')
          .update({ pioneer_number: pioneerNum })
          .eq('user_id', user.id)
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
