// app/api/admin/schools/[schoolId]/bootstrap-admin/route.ts
//
// The founder's school-handoff endpoint: install the FIRST administrator of a
// canonical school that has none, so the school can then run its own staffing.
//
// SECURITY BOUNDARY
// requireGrowthUser() — the same platform-admin gate as the entitlement and
// payment routes beside it. It deliberately does NOT use requireSchoolAdmin():
// the absence of a school administrator is the exact condition this route
// exists to resolve, so demanding one would be circular. That makes the
// service's own zero-admin gate the real boundary, not a UI nicety — a school
// that already has an administrator is refused there, by the same rule
// requireSchoolAdmin uses to decide who counts as one.
//
// This is not cross-school staff management. It cannot touch a school that is
// already administered, and it never makes the founder a member of anything.
//
// SERVER-DERIVED FIELDS
// `schoolId` comes from the URL and `performedBy` from the authenticated
// session. Neither is accepted from the body, and there is no `targetUserId`,
// `is_active` or `invited_by` input — a client that could name its own
// inviter would be writing its own audit trail. The body carries only the two
// facts the founder actually chooses: who, and in what role.
//
// This route writes NOTHING commercial. No entitlement, no payment, no
// subscription, no tokens.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import {
  bootstrapSchoolAdministrator,
  listActiveAdministrators,
  BOOTSTRAPPABLE_SCHOOL_ROLES,
  type BootstrapResult,
  type ExistingAdministrator,
} from '@/lib/core/schoolBootstrap'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import type { SchoolUserRole } from '@/types/core'

const BootstrapSchema = z.object({
  email: z.string().email(),
  // A server-owned allowlist, never free text. Anything outside the canonical
  // admin-tier roles — 'admin', 'platform_admin', 'service_role', 'owner',
  // 'teacher', 'parent' — is rejected here before the service is reached.
  role:  z.enum(BOOTSTRAPPABLE_SCHOOL_ROLES as unknown as [SchoolUserRole, ...SchoolUserRole[]]),
}).strict()

type StatusResponse = {
  schoolId: string
  administered: boolean
  administrators: ExistingAdministrator[]
}

/** Reports whether this school already has an administrator — what the founder UI renders. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const { schoolId } = await params
    if (!z.string().uuid().safeParse(schoolId).success) return apiBadRequest('Invalid school id')

    const administrators = await listActiveAdministrators(schoolId)
    const body: StatusResponse = { schoolId, administered: administrators.length > 0, administrators }
    return apiSuccess(body)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/schools/bootstrap-admin GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)

    const { schoolId } = await params
    if (!z.string().uuid().safeParse(schoolId).success) return apiBadRequest('Invalid school id')

    const parsed = BootstrapSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const result: BootstrapResult = await bootstrapSchoolAdministrator({
      schoolId,
      targetEmail: parsed.data.email,
      role:        parsed.data.role,
      performedBy: growthUser.id,
    })

    // Every outcome — including the two refusals — comes back 200 with a
    // discriminated `status`, the same shape /api/core/teachers already uses
    // for its own `no_account`. A refusal here is a correct, expected answer
    // the founder must read and act on ("this school already has an admin";
    // "this principal has not signed up yet"), not a transport failure, and it
    // carries detail — the administrator list — that an error status cannot.
    return apiSuccess(result)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/schools/bootstrap-admin POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
