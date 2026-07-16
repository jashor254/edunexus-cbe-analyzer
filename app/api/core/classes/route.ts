import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listClasses, createClass, listGrades, listStreams, createStream } from '@/lib/core/classes'
import { requireSchoolMembership, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
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

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolMembership(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

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
  const body = await req.json()

  if (body.type === 'stream') {
    const parsed = CreateStreamSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    try {
      await requireSchoolAdmin(supabase, parsed.data.schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const data = await createStream(parsed.data.schoolId, parsed.data.name)
    return NextResponse.json({ data }, { status: 201 })
  }

  const parsed = CreateClassSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { schoolId, ...input } = parsed.data
  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const data = await createClass(schoolId, input)
  return NextResponse.json({ data }, { status: 201 })
}
