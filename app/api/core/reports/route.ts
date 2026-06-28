import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateReportCards, publishReportCards, getReportCard, listClassReportCards, updateReportCard } from '@/lib/core/report-cards'
import { getSchoolUser, isSchoolAdmin } from '@/lib/core/school-users'
import { getSchoolSettings } from '@/lib/core/school'
import { z } from 'zod'

const GenerateSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
})

const PublishSchema = z.object({
  schoolId: z.string().uuid(),
  termId: z.string().uuid(),
  classId: z.string().uuid().optional(),
})

const UpdateSchema = z.object({
  schoolId: z.string().uuid(),
  reportId: z.string().uuid(),
  class_teacher_comment: z.string().optional(),
  headteacher_comment: z.string().optional(),
  days_present: z.number().int().min(0).optional(),
  days_absent: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  const schoolUser = await getSchoolUser(user.id, schoolId)
  if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const learnerId = req.nextUrl.searchParams.get('learnerId')
  const termId = req.nextUrl.searchParams.get('termId')
  const classId = req.nextUrl.searchParams.get('classId')

  if (learnerId && termId) {
    const data = await getReportCard(learnerId, termId)
    return NextResponse.json({ data })
  }

  if (classId && termId) {
    const data = await listClassReportCards(classId, termId)
    return NextResponse.json({ data, count: data.length })
  }

  return NextResponse.json({ error: 'learnerId+termId or classId+termId required' }, { status: 400 })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'publish') {
    const parsed = PublishSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const admin = await isSchoolAdmin(user.id, parsed.data.schoolId)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const data = await publishReportCards(parsed.data.schoolId, parsed.data.termId, parsed.data.classId)
    return NextResponse.json({ data })
  }

  if (body.action === 'update') {
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const schoolUser = await getSchoolUser(user.id, parsed.data.schoolId)
    if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { schoolId, reportId, ...updates } = parsed.data
    const data = await updateReportCard(reportId, schoolId, updates as Parameters<typeof updateReportCard>[2])
    return NextResponse.json({ data })
  }

  // Generate
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const admin = await isSchoolAdmin(user.id, parsed.data.schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settings = await getSchoolSettings(parsed.data.schoolId)
  const data = await generateReportCards(parsed.data.schoolId, parsed.data.classId, parsed.data.termId, settings.grade_boundaries)
  return NextResponse.json({ data })
}
