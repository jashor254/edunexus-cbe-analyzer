import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAttendanceSession, updateAttendanceSession, deleteAttendanceSession, getSessionCompletionState } from '@/lib/core/attendance'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

// app/api/core/attendance/[id]/route.ts — Sprint 11E. One attendance
// session, by id. Every action calls lib/core/attendance.ts unchanged;
// this file adds no business logic.
//
// Sprint 11H — GET additionally accepts `?includeCompletion=true`, purely
// additive and opt-in: without it, the response is byte-for-byte identical
// to before (the bare session). With it, the response nests the session's
// computed completion state (Phase 2 — lib/core/attendance.ts's
// getSessionCompletionState, itself computed fresh on every call, never
// stored) under `completion`. No existing caller (Sprint 11F's Session
// Detail page previously, now updated to pass the flag) had to change its
// parsing of the base session fields.

const UpdateSchema = z.object({
  schoolId:           z.string().uuid(),
  markedByTeacherId:  z.string().uuid().nullable(),
})

type Params = { params: Promise<{ id: string }> }

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  if (err instanceof Error && err.message.includes('no session')) {
    return NextResponse.json({ error: err.message }, { status: 404 })
  }
  if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 422 })
  throw err
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  const includeCompletion = req.nextUrl.searchParams.get('includeCompletion') === 'true'

  try {
    const session = await getAttendanceSession(userId, schoolId, id)
    if (!includeCompletion) return NextResponse.json({ data: session })

    const completion = await getSessionCompletionState(userId, schoolId, id)
    return NextResponse.json({ data: { ...session, completion } })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { schoolId, markedByTeacherId } = parsed.data

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    // Metadata-only — exactly what the service already supports
    // (AttendanceSessionMetadataUpdate is restricted to this one field).
    const session = await updateAttendanceSession(userId, schoolId, id, { marked_by_teacher_id: markedByTeacherId })
    return NextResponse.json({ data: session })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    await deleteAttendanceSession(userId, schoolId, id)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    return errorResponse(err)
  }
}
