// app/api/core/teachers/route.ts
//
// Sprint 9C — the reserved-but-unbuilt Teacher-domain API surface
// (RAS §3: "Teacher | ... | app/api/core/teachers/**"). Thin per RAS §2 —
// auth check, authorization, one service call each. All business logic
// lives in lib/core/teacherOnboarding.ts.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { inviteTeacher, acceptTeacherInvitation, getTeacherReadiness, listTeacherMemberships } from '@/lib/core/teacherOnboarding'
import { requireAuthentication, requireSchoolAdmin } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

const InviteSchema = z.object({
  action:   z.literal('invite'),
  schoolId: z.string().uuid(),
  email:    z.string().email(),
})

const AcceptSchema = z.object({
  action:       z.literal('accept'),
  schoolId:     z.string().uuid(),
  full_name:    z.string().trim().min(1),
  subject:      z.string().optional(),
  grade_levels: z.array(z.number().int()).optional(),
  phone:        z.string().optional(),
})

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (isEduNexusError(err)) return NextResponse.json({ error: 'Forbidden' }, { status: err.statusCode })
  throw err
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const body = await req.json()

  if (body?.action === 'invite') {
    const parsed = InviteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    let userId: string
    try {
      userId = (await requireSchoolAdmin(supabase, parsed.data.schoolId)).userId
    } catch (err) {
      return errorResponse(err)
    }

    const result = await inviteTeacher(parsed.data.schoolId, parsed.data.email, userId)
    return NextResponse.json({ data: result }, { status: result.status === 'invited' ? 201 : 200 })
  }

  if (body?.action === 'accept') {
    const parsed = AcceptSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    // Never trust a userId from the body (CLAUDE.md rule) — a teacher can
    // only accept their own invitation, established from auth.getUser().
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      return errorResponse(err)
    }

    try {
      const result = await acceptTeacherInvitation(userId, parsed.data.schoolId, {
        full_name:    parsed.data.full_name,
        subject:      parsed.data.subject,
        grade_levels: parsed.data.grade_levels,
        phone:        parsed.data.phone,
      })
      return NextResponse.json({ data: result })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to accept invitation' }, { status: 404 })
    }
  }

  return NextResponse.json({ error: 'action must be "invite" or "accept"' }, { status: 400 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const schoolId = req.nextUrl.searchParams.get('schoolId')
  if (!schoolId) return NextResponse.json({ error: 'schoolId required' }, { status: 400 })

  // Sprint 10E Phase 2 — admin-tier roster for the Team screen, additive:
  // the pre-existing self-readiness branch below is completely unchanged.
  if (req.nextUrl.searchParams.get('list') === 'true') {
    try {
      await requireSchoolAdmin(supabase, schoolId)
    } catch (err) {
      return errorResponse(err)
    }
    const teachers = await listTeacherMemberships(schoolId)
    return NextResponse.json({ data: teachers })
  }

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    return errorResponse(err)
  }

  // Self-only this sprint — a teacher checking their own readiness. An
  // admin-checking-another-teacher variant is a small, separate extension,
  // not built here to keep this route's scope matched to Part 5's ask.
  const readiness = await getTeacherReadiness(userId, schoolId)
  return NextResponse.json({ data: readiness })
}
