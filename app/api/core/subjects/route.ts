import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listSubjects, listGradeSubjects, assignSubjectToGrade, seedGradeSubjectsForSchool } from '@/lib/core/subjects'
import { assignSubjectTeacher, listClassSubjects } from '@/lib/core/classes'
import { getSchoolUser, isSchoolAdmin } from '@/lib/core/school-users'
import { z } from 'zod'

const AssignGradeSchema = z.object({
  schoolId: z.string().uuid(),
  gradeId: z.string().uuid(),
  subjectId: z.string().uuid(),
  isCompulsory: z.boolean().optional(),
})

const AssignTeacherSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const view = req.nextUrl.searchParams.get('view')
  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const gradeId = req.nextUrl.searchParams.get('gradeId')
  const classId = req.nextUrl.searchParams.get('classId')

  if (view === 'class-subjects' && classId) {
    if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
    const schoolUser = await getSchoolUser(user.id, schoolId)
    if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const data = await listClassSubjects(classId)
    return NextResponse.json({ data })
  }

  if (view === 'grade-subjects' && schoolId && gradeId) {
    const schoolUser = await getSchoolUser(user.id, schoolId)
    if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const data = await listGradeSubjects(schoolId, gradeId)
    return NextResponse.json({ data })
  }

  // Public catalogue — any authenticated user
  const category = req.nextUrl.searchParams.get('category') as 'pre_primary' | 'primary' | 'junior_secondary' | null
  const data = await listSubjects(category ?? undefined)
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'assign-teacher') {
    const parsed = AssignTeacherSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const admin = await isSchoolAdmin(user.id, parsed.data.schoolId)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await assignSubjectTeacher(parsed.data.schoolId, parsed.data.classId, parsed.data.subjectId, parsed.data.teacherId)
    return NextResponse.json({ data: { success: true } })
  }

  if (body.action === 'seed') {
    const { schoolId } = body
    const admin = await isSchoolAdmin(user.id, schoolId)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await seedGradeSubjectsForSchool(schoolId)
    return NextResponse.json({ data: { success: true } })
  }

  const parsed = AssignGradeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const admin = await isSchoolAdmin(user.id, parsed.data.schoolId)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const data = await assignSubjectToGrade(parsed.data.schoolId, parsed.data.gradeId, parsed.data.subjectId, parsed.data.isCompulsory)
  return NextResponse.json({ data }, { status: 201 })
}
