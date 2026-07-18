import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  recordAttendance,
  bulkRecordAttendance,
  updateAttendanceRecord,
  getAttendanceRecord,
  listAttendanceForSession,
  deleteAttendanceRecord,
} from '@/lib/core/attendance'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import type { AttendanceStatus } from '@/lib/repositories/attendance.repository'
import { z } from 'zod'

// app/api/core/attendance/[id]/records/route.ts — Sprint 11E. Records
// nested under one attendance session ([id] in the URL is the session id).
// Every action calls lib/core/attendance.ts unchanged; this file adds no
// business logic — including status validity, which is intentionally left
// to the service (see RecordFieldsSchema below).

const RecordFieldsSchema = z.object({
  learnerId:       z.string().uuid(),
  // Intentionally z.string(), not z.enum(['present',...]) — validating
  // status here would duplicate lib/core/attendance.ts's own
  // assertValidStatus, which this sprint's mission explicitly forbids.
  // An invalid value is passed through and rejected by the service.
  status:          z.string(),
  arrivalTime:     z.string().nullable().optional(),
  departureTime:   z.string().nullable().optional(),
  notes:           z.string().nullable().optional(),
})

const SingleCreateSchema = z.object({ schoolId: z.string().uuid() }).extend(RecordFieldsSchema.shape)

const BulkCreateSchema = z.object({
  schoolId: z.string().uuid(),
  records:  z.array(RecordFieldsSchema).min(1),
})

const UpdateSchema = z.object({
  schoolId:        z.string().uuid(),
  recordId:        z.string().uuid(),
  status:          z.string().optional(),
  arrivalTime:     z.string().nullable().optional(),
  departureTime:   z.string().nullable().optional(),
  notes:           z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: err.message }, { status: err.statusCode })
  if (err instanceof Error && (err.message.includes('no session') || err.message.includes('no attendance record'))) {
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

  try {
    const data = await listAttendanceForSession(userId, schoolId, id)
    return NextResponse.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  const isBulk = Array.isArray(body?.records)

  let userId: string

  if (isBulk) {
    const parsed = BulkCreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    const { schoolId, records } = parsed.data

    try {
      const membership = await requireSchoolStaff(supabase, schoolId)
      userId = membership.userId
    } catch (err) {
      return errorResponse(err)
    }

    try {
      const data = await bulkRecordAttendance(
        userId,
        schoolId,
        id,
        records.map(r => ({
          learner_id:      r.learnerId,
          status:          r.status as AttendanceStatus, // service validates at runtime; see RecordFieldsSchema note
          arrival_time:    r.arrivalTime,
          departure_time:  r.departureTime,
          notes:           r.notes,
        })),
      )
      return NextResponse.json({ data }, { status: 201 })
    } catch (err) {
      return errorResponse(err)
    }
  }

  const parsed = SingleCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { schoolId, learnerId, status, arrivalTime, departureTime, notes } = parsed.data

  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const data = await recordAttendance(userId, schoolId, {
      attendance_session_id: id,
      learner_id:             learnerId,
      status:                 status as AttendanceStatus, // service validates at runtime; see RecordFieldsSchema note
      arrival_time:           arrivalTime,
      departure_time:         departureTime,
      notes,
    })
    return NextResponse.json({ data }, { status: 201 })
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
  const { schoolId, recordId, status, arrivalTime, departureTime, notes } = parsed.data

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    // Path/body consistency: recordId must actually belong to the session
    // named in the URL. A route-layer check, not a new business rule —
    // getAttendanceRecord already does the real ownership validation.
    const existing = await getAttendanceRecord(userId, schoolId, recordId)
    if (existing.attendance_session_id !== id) {
      return NextResponse.json({ error: `Record ${recordId} does not belong to session ${id}.` }, { status: 400 })
    }

    const data = await updateAttendanceRecord(userId, schoolId, recordId, {
      status:          status as AttendanceStatus | undefined, // service validates at runtime; see RecordFieldsSchema note
      arrival_time:    arrivalTime,
      departure_time:  departureTime,
      notes,
    })
    return NextResponse.json({ data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = await params

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  const recordId = req.nextUrl.searchParams.get('recordId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })
  if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

  let userId: string
  try {
    const membership = await requireSchoolStaff(supabase, schoolId)
    userId = membership.userId
  } catch (err) {
    return errorResponse(err)
  }

  try {
    const existing = await getAttendanceRecord(userId, schoolId, recordId)
    if (existing.attendance_session_id !== id) {
      return NextResponse.json({ error: `Record ${recordId} does not belong to session ${id}.` }, { status: 400 })
    }

    await deleteAttendanceRecord(userId, schoolId, recordId)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    return errorResponse(err)
  }
}
