import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSchool, updateSchool, getSchoolSettings, upsertSchoolSettings } from '@/lib/core/school'
import { getSchoolUser } from '@/lib/core/school-users'
import type { SchoolSettings } from '@/types/core'
import { z } from 'zod'

const UpdateSchoolSchema = z.object({
  school_name: z.string().min(1).optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  ward: z.string().optional(),
  address: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  motto: z.string().optional(),
})

const UpdateSettingsSchema = z.object({
  curriculum_type: z.enum(['cbc', '844', 'igcse']).optional(),
  school_open_days: z.number().int().min(1).max(7).optional(),
  report_footer: z.string().optional(),
  sms_enabled: z.boolean().optional(),
  grade_boundaries: z.record(z.string(), z.object({ min: z.number() })).optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  const schoolUser = await getSchoolUser(user.id, schoolId)
  if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [school, settings] = await Promise.all([
    getSchool(schoolId),
    getSchoolSettings(schoolId).catch(() => null),
  ])

  return NextResponse.json({ data: { school, settings } })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { schoolId, type, ...rest } = body

  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  const schoolUser = await getSchoolUser(user.id, schoolId)
  if (!schoolUser || !['school_admin', 'headteacher'].includes(schoolUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (type === 'settings') {
    const parsed = UpdateSettingsSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const data = await upsertSchoolSettings(schoolId, parsed.data as Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>)
    return NextResponse.json({ data })
  }

  const parsed = UpdateSchoolSchema.safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const data = await updateSchool(schoolId, parsed.data)
  return NextResponse.json({ data })
}
