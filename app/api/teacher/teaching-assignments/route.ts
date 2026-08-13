// app/api/teacher/teaching-assignments/route.ts
//
// The canonical institutional read, exposed to teacher-facing client
// components: "what has my school assigned me to teach?"
//
// Thin per RAS §2 — authenticate, one service call, return. All resolution
// lives in lib/core/teachingAssignments.ts.
//
// READ ONLY, BY CONSTRUCTION (Phase 13). There is no POST/PATCH/DELETE here
// and there must never be one: assignment is an administrative act, and its
// only write path is the admin-gated `POST /api/core/subjects`
// (action:'assign-teacher', requireSchoolAdmin). A teacher may see what they
// have been assigned; they may not assign themselves, a colleague, a
// different subject, a different class, or a different school.
//
// CROSS-SCHOOL SAFETY (Phase 14). This route accepts NO parameters at all —
// no teacherId, no schoolId, no teacherMembershipId, no query string. The
// identity is taken from auth.getUser() and the membership set is derived
// from it server-side, so there is no input a caller could supply to widen
// the result to another school or another teacher. That is the reason the
// route has no inputs rather than validated ones: an id that is never
// accepted cannot be forged.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { resolveTeachingContext } from '@/lib/core/teachingAssignments'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    throw err
  }

  const context = await resolveTeachingContext(userId)
  return NextResponse.json({ data: context })
}
