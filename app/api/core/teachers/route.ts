// app/api/core/teachers/route.ts
//
// Sprint 9C — the reserved-but-unbuilt Teacher-domain API surface
// (RAS §3: "Teacher | ... | app/api/core/teachers/**"). Thin per RAS §2 —
// auth check, authorization, one service call each. All business logic
// lives in lib/core/teacherOnboarding.ts.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { inviteSchoolMember, acceptTeacherInvitation, getTeacherReadiness, listTeacherMemberships, INVITABLE_SCHOOL_ROLES } from '@/lib/core/teacherOnboarding'
import { requireAuthentication, requireSchoolAdmin } from '@/lib/core/permissions'
import { deactivateSchoolMembership } from '@/lib/core/school-users'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { z } from 'zod'

// `role` is a strict server-side allowlist (INVITABLE_SCHOOL_ROLES), never a
// free string from the browser — and it is only honoured after
// requireSchoolAdmin(schoolId) proves the CALLER already holds admin authority
// AT THAT SCHOOL. Both halves matter: an allowlist alone would still let a
// teacher at School A make themselves an admin at School B.
//
// Omitting `role` keeps the pre-existing teacher-invite behaviour byte for
// byte, so every existing caller is unaffected.
const InviteSchema = z.object({
  action:   z.literal('invite'),
  schoolId: z.string().uuid(),
  email:    z.string().email(),
  role:     z.enum(INVITABLE_SCHOOL_ROLES).optional(),
})

// Ending someone's employment at a school. `userId` here is the SUBJECT of the
// action, not the caller — which is safe only because requireSchoolAdmin(schoolId)
// proves the CALLER holds admin authority at that same school first, and the
// service resolves the membership by (userId, schoolId) so an id from another
// school matches nothing. A teacher cannot deactivate a colleague, and cannot
// reactivate themselves, because neither can pass requireSchoolAdmin.
const DeactivateSchema = z.object({
  action:   z.literal('deactivate'),
  schoolId: z.string().uuid(),
  userId:   z.string().uuid(),
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

    const result = await inviteSchoolMember(
      parsed.data.schoolId,
      parsed.data.email,
      parsed.data.role ?? 'teacher',
      userId
    )
    return NextResponse.json({ data: result }, { status: result.status === 'invited' ? 201 : 200 })
  }

  if (body?.action === 'deactivate') {
    const parsed = DeactivateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    let adminUserId: string
    try {
      adminUserId = (await requireSchoolAdmin(supabase, parsed.data.schoolId)).userId
    } catch (err) {
      return errorResponse(err)
    }

    // An admin removing themselves would leave a school with no administrator
    // and no way back in without founder intervention. Refused here rather
    // than at the UI, so the API is safe on its own.
    if (adminUserId === parsed.data.userId) {
      return NextResponse.json(
        { error: 'You cannot remove your own school access. Ask another administrator at this school.' },
        { status: 400 },
      )
    }

    const removed = await deactivateSchoolMembership(parsed.data.userId, parsed.data.schoolId)
    return NextResponse.json({ data: { removed } })
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
