// app/api/admin/schools/[schoolId]/payments/route.ts
//
// The founder's record-a-school-payment surface.
//
// THIS COLLECTS NO MONEY. Schools pay outside EduNexus by bank transfer,
// M-PESA, or cheque against a quotation. This route records the fact that the
// money arrived — after a human verified it — and activates the school's
// existing entitlement as a consequence. No Paystack, no Daraja, no checkout.
//
// SECURITY BOUNDARY
// requireGrowthUser() — the same boundary as the entitlement route this
// ultimately calls. A school admin cannot confirm their own school's payment; a
// teacher cannot; a parent cannot. The database enforces the entitlement half
// independently (trg_guard_school_entitlement), so a bug here cannot become a
// self-activation path.
//
// SERVER-DERIVED FIELDS
// school_id comes from the URL, confirmed_by from the authenticated growth
// user, and status is always 'confirmed' on creation. None of the three is
// accepted from the request body — a client that could name its own confirmer
// or pre-set a status would be writing its own audit trail.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { recordSchoolPayment, getSchoolPaymentContext, ConflictingPaymentError } from '@/lib/core/schoolPayments'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import type { SchoolPayment } from '@/types/core'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const RecordPaymentSchema = z.object({
  amount:            z.number().int().positive(),
  payment_method:    z.enum(['mpesa', 'bank_transfer', 'cheque', 'cash', 'other']),
  payment_reference: z.string().trim().min(1).max(200),
  payment_date:      z.string().regex(ISO_DATE, 'payment_date must be YYYY-MM-DD'),
  coverage_start:    z.string().regex(ISO_DATE, 'coverage_start must be YYYY-MM-DD').nullable().optional(),
  coverage_end:      z.string().regex(ISO_DATE, 'coverage_end must be YYYY-MM-DD'),
  notes:             z.string().trim().max(2000).nullable().optional(),
}).strict() // reject unknown keys outright — including confirmed_by/status/school_id
  .refine(
    v => !v.coverage_start || v.coverage_start <= v.coverage_end,
    { message: 'coverage_start must not be after coverage_end', path: ['coverage_start'] }
  )

type RecordPaymentResponse = {
  payment: SchoolPayment
  created: boolean
  entitlementStatus: string
  entitlementExpiresAt: string | null
}

async function resolveSchoolId(params: Promise<{ schoolId: string }>): Promise<string | null> {
  const { schoolId } = await params
  return z.string().uuid().safeParse(schoolId).success ? schoolId : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const schoolId = await resolveSchoolId(params)
    if (!schoolId) return apiBadRequest('Invalid school id')

    // Payment history plus the minimum school context the founder screen needs
    // to be operationally useful (name, current entitlement, how many teachers
    // that actually covers). Same school, same authorization, one round trip —
    // still scoped strictly to this school and exposing no learner data.
    return apiSuccess(await getSchoolPaymentContext(schoolId))
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/schools/payments GET]', err instanceof Error ? err.message : err)
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

    const schoolId = await resolveSchoolId(params)
    if (!schoolId) return apiBadRequest('Invalid school id')

    const parsed = RecordPaymentSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const input = parsed.data

    const result = await recordSchoolPayment({
      schoolId,
      amount:           input.amount,
      paymentMethod:    input.payment_method,
      paymentReference: input.payment_reference,
      paymentDate:      input.payment_date,
      coverageStart:    input.coverage_start ?? null,
      coverageEnd:      input.coverage_end,
      notes:            input.notes ?? null,
      confirmedBy:      growthUser.id,
    })

    const body: RecordPaymentResponse = {
      payment:              result.payment,
      created:              result.created,
      entitlementStatus:    result.school.school_entitlement_status,
      entitlementExpiresAt: result.entitlementExpiresAt,
    }
    // 201 only when this call actually created the record; a safe replay is 200.
    return apiSuccess(body, result.created ? 201 : 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof ConflictingPaymentError) return apiError(err.message, 409)
    console.error('[admin/schools/payments POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
