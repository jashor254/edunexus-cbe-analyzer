// app/api/admin/schools/[schoolId]/entitlement/route.ts
//
// The trusted platform-admin mechanism for granting or withdrawing a school's
// institutional EduNexus entitlement.
//
// THIS IS NOT A PAYMENT ENDPOINT. It collects no money, calls no payment
// provider (no Paystack, no Daraja), prices nothing, issues no invoice, and
// creates no teacher subscription or bundle. It records a decision already
// made out of band: "EduNexus has independently confirmed this school should
// be covered." School payment will later become the business reason to call
// this — this phase builds the destination first.
//
// Authorization is requireGrowthUser (founder-only, fail-closed, hardened in
// Sprint PR-2) — not ADMIN_CONFIG's hardcoded email, because that constant
// bakes an address into the bundle while requireGrowthUser reads a server-only
// env var and already guards every other founder surface. The database
// enforces the same boundary independently via trg_guard_school_entitlement,
// so a bug in this route cannot become a self-grant path.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { setSchoolEntitlement } from '@/lib/core/schoolEntitlement'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

// Only the two operations this phase needs. 'expired' is deliberately absent —
// it is what an elapsed school_entitlement_expires_at means on read, not
// something an admin sets by hand, so there is exactly one way a school
// becomes expired.
const EntitlementSchema = z.object({
  action:    z.enum(['activate', 'suspend']),
  expiresAt: z.string().datetime().nullable().optional(),
})

type EntitlementResponse = {
  schoolId:  string
  status:    string
  expiresAt: string | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)

    const { schoolId } = await params
    if (!z.string().uuid().safeParse(schoolId).success) {
      return apiBadRequest('Invalid school id')
    }

    const parsed = EntitlementSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { action, expiresAt } = parsed.data

    // Suspension always clears the expiry: leaving a future date on a
    // suspended school would misread as "coverage resumes then", which is not
    // what suspending means.
    const status    = action === 'activate' ? 'active' : 'suspended'
    const expiry    = action === 'activate' ? (expiresAt ?? null) : null

    const school = await setSchoolEntitlement(schoolId, status, expiry, growthUser.id)

    const body: EntitlementResponse = {
      schoolId:  school.id,
      status:    school.school_entitlement_status,
      expiresAt: school.school_entitlement_expires_at,
    }
    return apiSuccess(body)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/schools/entitlement POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
