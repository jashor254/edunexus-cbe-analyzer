import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { ADMIN_CONFIG } from '@/lib/config/api'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ADMIN_CONFIG.isAdmin(user.email ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = createServiceClient()

    const { data: teachers, error } = await db
      .from('teachers')
      .select('id, user_id, full_name, school, subject, role, created_at, is_verified')
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!teachers || teachers.length === 0) {
      return NextResponse.json({ teachers: [] })
    }

    const userIds = teachers.map((t) => t.user_id)

    const [
      { data: sowData },
      { data: lpData },
      { data: rowData },
      { data: lastActive },
    ] = await Promise.all([
      db.from('schemes_of_work').select('teacher_id').in('teacher_id', userIds),
      db.from('lesson_plans').select('teacher_id').in('teacher_id', userIds),
      db.from('records_of_work').select('teacher_id').in('teacher_id', userIds),
      db.from('user_activity_log')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false }),
    ])

    // Build per-teacher counts
    const sowCount: Record<string, number> = {}
    const lpCount: Record<string, number> = {}
    const rowCount: Record<string, number> = {}
    const lastSeen: Record<string, string> = {}

    sowData?.forEach((r) => { sowCount[r.teacher_id] = (sowCount[r.teacher_id] ?? 0) + 1 })
    lpData?.forEach((r)  => { lpCount[r.teacher_id]  = (lpCount[r.teacher_id]  ?? 0) + 1 })
    rowData?.forEach((r) => { rowCount[r.teacher_id] = (rowCount[r.teacher_id] ?? 0) + 1 })
    lastActive?.forEach((r) => {
      if (!lastSeen[r.user_id]) lastSeen[r.user_id] = r.created_at
    })

    const result = teachers.map((t) => ({
      id:            t.id,
      user_id:       t.user_id,
      full_name:     t.full_name,
      school:        t.school,
      subject:       t.subject,
      role:          t.role,
      is_verified:   t.is_verified,
      joined:        t.created_at,
      last_active:   lastSeen[t.user_id] ?? null,
      sow_count:     sowCount[t.user_id]  ?? 0,
      lp_count:      lpCount[t.user_id]   ?? 0,
      row_count:     rowCount[t.user_id]  ?? 0,
    }))

    return NextResponse.json({ teachers: result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
