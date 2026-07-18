// app/api/core/academic-readiness/route.ts
//
// Sprint 10E Phase 4 — the route Sprint 10D's audit found missing:
// getSchoolAcademicReadiness() (lib/core/academicActivation.ts, Sprint 9E)
// existed with zero caller anywhere in the codebase. This route is a pure
// wrapper — auth check, authorization, one service call, exactly as RAS §2
// requires. The report shape is surfaced exactly as implemented; nothing
// here recomputes or redesigns it.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSchoolAcademicReadiness } from '@/lib/core/academicActivation'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

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
    await requireSchoolAdmin(supabase, schoolId)
  } catch (err) {
    return errorResponse(err)
  }

  const readiness = await getSchoolAcademicReadiness(schoolId)
  return NextResponse.json({ data: readiness })
}
