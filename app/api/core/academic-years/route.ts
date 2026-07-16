import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { listAcademicYears, createAcademicYear, setCurrentAcademicYear, listTerms, createTerm, setCurrentTerm } from '@/lib/core/school'
import { requireSchoolMembership, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

const YearSchema = z.object({ name: z.string().min(1), start_date: z.string(), end_date: z.string() })
const TermSchema = z.object({
  academic_year_id: z.string().uuid(),
  term_number: z.union([z.literal(1), z.literal(2), z.literal(3)]) as z.ZodType<1 | 2 | 3>,
  name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
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

  const academicYearId = req.nextUrl.searchParams.get('academicYearId')
  const [years, terms] = await Promise.all([
    listAcademicYears(schoolId),
    listTerms(schoolId, academicYearId ?? undefined),
  ])

  return NextResponse.json({ data: { years, terms } })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()
  const { schoolId, type, setCurrent, ...rest } = body
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  try {
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  if (type === 'term') {
    const parsed = TermSchema.safeParse(rest)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const term = await createTerm(schoolId, parsed.data)
    if (setCurrent) await setCurrentTerm(schoolId, term.id)
    return NextResponse.json({ data: term }, { status: 201 })
  }

  if (type === 'set-current-term') {
    const { termId } = rest
    if (!termId) return NextResponse.json({ error: 'termId required' }, { status: 400 })
    await setCurrentTerm(schoolId, termId)
    return NextResponse.json({ data: { success: true } })
  }

  if (type === 'set-current-year') {
    const { yearId } = rest
    if (!yearId) return NextResponse.json({ error: 'yearId required' }, { status: 400 })
    await setCurrentAcademicYear(schoolId, yearId)
    return NextResponse.json({ data: { success: true } })
  }

  const parsed = YearSchema.safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const year = await createAcademicYear(schoolId, parsed.data)
  if (setCurrent) await setCurrentAcademicYear(schoolId, year.id)
  return NextResponse.json({ data: year }, { status: 201 })
}
