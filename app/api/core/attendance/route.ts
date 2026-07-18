import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  createAttendanceSession,
  listAttendanceSessionsForClass,
  listAttendanceSessionsForSchool,
  listAttendanceSessionsByDateRange,
} from '@/lib/core/attendance'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

// app/api/core/attendance/route.ts — Sprint 11E. Thin route: every read/write
// call goes straight to lib/core/attendance.ts (Sprint 11D), which already
// enforces the full ownership chain and every business rule (session
// uniqueness, status validity). This file adds no business logic of its
// own — only auth, request parsing, and status-code mapping.
//
// `requireSchoolStaff` is the route's only gate: any active teacher or
// admin-tier member of the school may reach the service. "Teacher: only own
// class" is enforced by the service's own assertOwnershipChain, not here —
// duplicating that check in the route would be exactly the "inline
// permission check" this sprint's mission forbids.

const CreateSessionSchema = z.object({
  schoolId:        z.string().uuid(),
  academicYearId:  z.string().uuid(),
  termId:          z.string().uuid(),
  classId:         z.string().uuid(),
  attendanceDate:  z.string(),
  // Intentionally z.string(), not a fixed enum — the schema does not decide
  // what a valid session_type is; the service does (and today accepts only
  // 'daily', enforced by the live CHECK constraint via the repository).
  sessionType:     z.string().optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  // Any other thrown Error comes from lib/core/attendance.ts's own business
  // rules (duplicate session, broken ownership chain, invalid date range) —
  // surfaced verbatim, never swallowed, as a 422 (the same status this
  // codebase already uses for Zod validation failures).
  if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 422 })
  throw err
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const body = await req.json()

  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const input = parsed.data

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, input.schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const session = await createAttendanceSession(userId, {
      school_id:            input.schoolId,
      academic_year_id:     input.academicYearId,
      term_id:              input.termId,
      class_id:              input.classId,
      attendance_date:       input.attendanceDate,
      session_type:          input.sessionType,
    })
    // Returns the session only — no summary, no learner records.
    return NextResponse.json({ data: session }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  const classId = req.nextUrl.searchParams.get('classId')
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  try {
    // Reuses the three existing list methods exactly as Sprint 11D built
    // them — no combined/new query shape invented. classId takes
    // precedence (a specific class's own sessions); otherwise a date range
    // if both bounds are given; otherwise every session in the school.
    if (classId) {
      const data = await listAttendanceSessionsForClass(userId, schoolId, classId)
      return NextResponse.json({ data })
    }
    if (from && to) {
      const data = await listAttendanceSessionsByDateRange(userId, schoolId, from, to)
      return NextResponse.json({ data })
    }
    const data = await listAttendanceSessionsForSchool(userId, schoolId)
    return NextResponse.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}
