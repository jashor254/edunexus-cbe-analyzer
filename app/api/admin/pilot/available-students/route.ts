// app/api/admin/pilot/available-students/route.ts
//
// The trusted server path for the pilot admin "Add Student" picker.
//
// Named `available-students` rather than `students` because the sibling route
// `/api/admin/pilot/students` already returns the pilot ROSTER (tracking rows
// joined to reports). This one returns the candidates you may add TO that
// roster — a different question, so a different path.
//
// SECURITY BOUNDARY
// requireGrowthUser() is the authorization boundary, not the page. The client
// still checks NEXT_PUBLIC_ADMIN_EMAILS to decide what to render, but that is a
// public env var compiled into the bundle and is UX only — anyone can edit it
// in their own browser. This route re-derives identity server-side from the
// validated session and fails closed for everyone else.
//
// The service client is used only AFTER that check passes, and only to read the
// three columns the picker renders. It is never handed to the browser.
//
// Read-only by construction: GET only, and lib/pilot/students.ts issues a
// single SELECT.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listSelectableStudents, type SelectableStudent } from '@/lib/pilot/students'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

type AvailableStudentsResponse = { students: SelectableStudent[] }

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const students = await listSelectableStudents()

    const body: AvailableStudentsResponse = { students }
    return apiSuccess(body)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/pilot/available-students]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
