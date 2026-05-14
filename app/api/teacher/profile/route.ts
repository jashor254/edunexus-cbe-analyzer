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
      .select('id, user_id, full_name, school, subject, grade_levels, phone, is_verified, created_at, pioneer_number')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return apiError('Failed to fetch teacher profile')
    }

    return apiSuccess({ teacher: teacher || null })
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
    const { full_name, school, subject, grade_levels, phone } = body

    if (!full_name || !school) {
      return apiError('full_name and school are required', 400)
    }

    const db = createServiceClient()

    // Check if teacher already exists (determines whether to assign pioneer number)
    const { data: existing } = await db
      .from('teachers')
      .select('id, pioneer_number')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: teacher, error } = await db
      .from('teachers')
      .upsert({
        user_id: user.id,
        full_name,
        school,
        subject:      subject      || null,
        grade_levels: grade_levels || [7, 8, 9, 10, 11, 12],
        phone:        phone        || null,
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('[teacher/profile POST]', error)
      return apiError(`Failed to save teacher profile: ${error.message}`, 500)
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
