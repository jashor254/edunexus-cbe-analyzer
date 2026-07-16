import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listSubjects, listGradeSubjects, assignSubjectToGrade, seedGradeSubjectsForSchool } from '@/lib/core/subjects'
import { assignSubjectTeacher, listClassSubjects } from '@/lib/core/classes'
import { requireAuthentication, requireSchoolMembership, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
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

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
  } catch (err) {
    return errorResponse(err)
  }

  const view = req.nextUrl.searchParams.get('view')
  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const gradeId = req.nextUrl.searchParams.get('gradeId')
  const classId = req.nextUrl.searchParams.get('classId')

  if (view === 'class-subjects' && classId) {
    if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
    try {
      await requireSchoolMembership(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const data = await listClassSubjects(classId)
    return NextResponse.json({ data })
  }

  if (view === 'grade-subjects' && schoolId && gradeId) {
    try {
      await requireSchoolMembership(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const data = await listGradeSubjects(schoolId, gradeId)
    return NextResponse.json({ data })
  }

  // Public catalogue — any authenticated user, no school membership required (unchanged).
  const category = req.nextUrl.searchParams.get('category') as 'pre_primary' | 'primary' | 'junior_secondary' | null
  const data = await listSubjects(category ?? undefined)
  return NextResponse.json({ data, count: data.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()

  if (body.action === 'assign-teacher') {
    const parsed = AssignTeacherSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    try {
      await requireSchoolAdmin(supabase, parsed.data.schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    await assignSubjectTeacher(parsed.data.schoolId, parsed.data.classId, parsed.data.subjectId, parsed.data.teacherId)
    return NextResponse.json({ data: { success: true } })
  }

  if (body.action === 'seed') {
    const { schoolId } = body
    try {
      await requireSchoolAdmin(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    await seedGradeSubjectsForSchool(schoolId)
    return NextResponse.json({ data: { success: true } })
  }

  const parsed = AssignGradeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  try {
    await requireSchoolAdmin(supabase, parsed.data.schoolId)
  } catch (err) {
    return errorResponse(err)
  }
  const data = await assignSubjectToGrade(parsed.data.schoolId, parsed.data.gradeId, parsed.data.subjectId, parsed.data.isCompulsory)
  return NextResponse.json({ data }, { status: 201 })
}
