import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listClasses, createClass, listGrades, listStreams, createStream } from '@/lib/core/classes'
import { getSchoolUser } from '@/lib/core/school-users'
import { z } from 'zod'

const CreateClassSchema = z.object({
  schoolId: z.string().uuid(),
  grade_id: z.string().uuid(),
  stream_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid(),
  class_teacher_id: z.string().uuid().optional(),
  capacity: z.number().int().positive().optional(),
  display_name: z.string().min(1),
})

const CreateStreamSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  const schoolUser = await getSchoolUser(user.id, schoolId)
  if (!schoolUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const academicYearId = req.nextUrl.searchParams.get('academicYearId') ?? undefined

  const [classes, grades, streams] = await Promise.all([
    listClasses(schoolId, academicYearId),
    listGrades(),
    listStreams(schoolId),
  ])

  return NextResponse.json({ data: { classes, grades, streams } })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.type === 'stream') {
    const parsed = CreateStreamSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const schoolUser = await getSchoolUser(user.id, parsed.data.schoolId)
    if (!schoolUser || !['school_admin', 'headteacher', 'deputy_headteacher'].includes(schoolUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await createStream(parsed.data.schoolId, parsed.data.name)
    return NextResponse.json({ data }, { status: 201 })
  }

  const parsed = CreateClassSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...input } = parsed.data
  const schoolUser = await getSchoolUser(user.id, schoolId)
  if (!schoolUser || !['school_admin', 'headteacher', 'deputy_headteacher'].includes(schoolUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await createClass(schoolId, input)
  return NextResponse.json({ data }, { status: 201 })
}
