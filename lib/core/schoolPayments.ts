// lib/core/schoolPayments.ts
//
// recordSchoolPayment() — the canonical operation for "a school paid EduNexus."
//
// Its input is a CONFIRMED PAYMENT FACT, never a provider payload. That is the
// single design decision that makes this survive contact with automation: a
// manual bank transfer verified by the founder and a future Daraja C2B callback
// both produce the same five facts (school, amount, method, reference, date),
// so both can call this function. Daraja would add a route and a provenance
// column; it would not replace anything here.
//
// Responsibilities, in order:
//   1. record the commercial fact durably and idempotently
//   2. activate/extend the school's existing entitlement
//
// It contains no HTTP concerns and no provider-specific logic. The route above
// it does auth and validation; the entitlement service below it owns the access
// decision. This function owns neither — it owns the link between them.

import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'
import { setSchoolEntitlement } from '@/lib/core/schoolEntitlement'
import type { School, SchoolPayment, SchoolPaymentMethod } from '@/types/core'

export type RecordSchoolPaymentInput = {
  schoolId: string
  /** Whole Kenyan shillings. */
  amount: number
  paymentMethod: SchoolPaymentMethod
  paymentReference: string
  /** ISO date (YYYY-MM-DD) the money moved. */
  paymentDate: string
  coverageStart?: string | null
  /** ISO date (YYYY-MM-DD) the paid-for coverage ends, inclusive. */
  coverageEnd: string
  notes?: string | null
  /** growth_users id of the platform admin confirming this payment. */
  confirmedBy: string
}

export type RecordSchoolPaymentResult = {
  payment: SchoolPayment
  school: School
  /** False when this call replayed a payment that was already on record. */
  created: boolean
  /** Entitlement expiry after this call, ISO timestamp, or null for open-ended. */
  entitlementExpiresAt: string | null
}

/** Raised when the same payment identity is resubmitted with different facts. */
export class ConflictingPaymentError extends Error {
  readonly code = 'CONFLICTING_PAYMENT'
  constructor(message: string) {
    super(message)
    this.name = 'ConflictingPaymentError'
  }
}

/**
 * Coverage is a DATE and is inclusive — "covered until 5 Dec 2026" means the
 * 5th is a working day. Entitlement expiry is a timestamptz compared against
 * `now()` by the resolver, so the date is carried to the end of that day.
 * Without this, coverage would silently end at midnight on the 4th.
 */
function coverageEndToExpiry(coverageEnd: string): string {
  return new Date(`${coverageEnd}T23:59:59.999Z`).toISOString()
}

/**
 * The renewal rule: never shorten access a school has already paid for.
 *
 * Returns the expiry the school should hold after this payment.
 *   - existing open-ended (active, null expiry) → stays open-ended. A school on
 *     an unlimited arrangement must not be downgraded to a bounded date by
 *     recording a payment.
 *   - otherwise → the later of the current expiry and the new coverage end.
 *     Early renewal extends; a mistyped shorter date cannot truncate; an
 *     already-lapsed expiry loses to the new date.
 *
 * This mirrors creditSubscription()'s existing rule for families ("extend from
 * current expiry — not from today — so a renewal never shortens time a family
 * already paid for"). Same reasoning, same behaviour, different customer.
 */
export function resolveRenewalExpiry(
  current: Pick<School, 'school_entitlement_status' | 'school_entitlement_expires_at'>,
  coverageEnd: string
): string | null {
  if (current.school_entitlement_status === 'active' && current.school_entitlement_expires_at === null) {
    return null
  }

  const candidate = coverageEndToExpiry(coverageEnd)
  const existing = current.school_entitlement_expires_at
  if (!existing) return candidate

  return new Date(existing).getTime() > new Date(candidate).getTime() ? existing : candidate
}

export async function recordSchoolPayment(
  input: RecordSchoolPaymentInput
): Promise<RecordSchoolPaymentResult> {
  const reference = input.paymentReference.trim()

  // Throws NotFound-shaped error if the school does not exist — checked before
  // writing anything, so a typo'd school id never leaves a payment row behind.
  await repos.schools.findById(input.schoolId)

  // ── 1. The commercial fact, first ──────────────────────────────────────────
  //
  // Payment before entitlement, always. If entitlement activation then fails,
  // a retry of the whole request finds the payment already recorded, skips the
  // insert, and re-applies entitlement — self-healing. The reverse order could
  // grant access with no record of why, which is the one state that cannot be
  // reconstructed afterwards.
  let payment = await repos.schools.insertPayment({
    school_id:         input.schoolId,
    amount:            input.amount,
    payment_method:    input.paymentMethod,
    payment_reference: reference,
    payment_date:      input.paymentDate,
    coverage_start:    input.coverageStart ?? null,
    coverage_end:      input.coverageEnd,
    confirmed_by:      input.confirmedBy,
    notes:             input.notes ?? null,
  })

  const created = payment !== null

  if (!payment) {
    // Same identity already on record. Two very different situations hide here,
    // and conflating them is how money quietly goes missing:
    //
    //   REPLAY    — identical facts. A double-click, or a retry after the
    //               entitlement step failed. Safe: reuse the row, re-apply
    //               entitlement, report created:false.
    //   CONFLICT  — same reference, different amount/date/coverage. Either a
    //               typo or two genuinely different payments sharing a bank
    //               reference. Never silently idempotent — fail closed and let
    //               a human look at it.
    const existing = await repos.schools.findPaymentByIdentity(
      input.schoolId, input.paymentMethod, reference
    )
    if (!existing) {
      throw new Error('recordSchoolPayment: payment conflicted on insert but could not be re-read')
    }

    const differences: string[] = []
    if (existing.amount !== input.amount) differences.push('amount')
    if (existing.payment_date !== input.paymentDate) differences.push('payment_date')
    if (existing.coverage_end !== input.coverageEnd) differences.push('coverage_end')
    if ((existing.coverage_start ?? null) !== (input.coverageStart ?? null)) differences.push('coverage_start')

    if (differences.length > 0) {
      throw new ConflictingPaymentError(
        `A different payment is already recorded for this school with reference "${reference}" ` +
        `(differs on: ${differences.join(', ')}). Recording it again would double-count. ` +
        `Use a distinct reference if this is a separate payment.`
      )
    }

    payment = existing
  }

  // ── 2. The entitlement fact, second ────────────────────────────────────────
  //
  // Via setSchoolEntitlement() — the existing authority — never by writing the
  // entitlement columns here. There is exactly one way school access is granted,
  // and the database enforces that too (trg_guard_school_entitlement rejects
  // entitlement writes from any non-service role).
  //
  // A reversed payment must not activate anything. It can only be reached by
  // replaying a payment that was reversed after it was recorded.
  if (payment.status === 'reversed') {
    const school = await repos.schools.findById(input.schoolId)
    return {
      payment,
      school,
      created,
      entitlementExpiresAt: school.school_entitlement_expires_at,
    }
  }

  const before = await repos.schools.findById(input.schoolId)
  const expiry = resolveRenewalExpiry(before, input.coverageEnd)

  const school = await setSchoolEntitlement(input.schoolId, 'active', expiry, input.confirmedBy)

  logger.info('recordSchoolPayment: school payment confirmed', {
    service:        'core-school-payments',
    school_id:      input.schoolId,
    payment_id:     payment.id,
    amount:         input.amount,
    payment_method: input.paymentMethod,
    created,
    expires_at:     expiry ?? 'open-ended',
    confirmed_by:   input.confirmedBy,
  })

  return {
    payment,
    school,
    created,
    entitlementExpiresAt: school.school_entitlement_expires_at,
  }
}

export async function listSchoolPayments(schoolId: string): Promise<SchoolPayment[]> {
  return repos.schools.listPaymentsBySchool(schoolId)
}

/**
 * Everything the founder's payment screen needs about one school, in three
 * queries. The teacher count is the real number of people who inherit coverage
 * — resolved from the same `school_users` rows entitlement itself resolves
 * against, so the screen cannot claim a coverage figure the system disagrees
 * with.
 */
export type SchoolPaymentContext = {
  school: Pick<School, 'id' | 'school_name' | 'county' | 'school_entitlement_status' | 'school_entitlement_expires_at'>
  activeTeacherCount: number
  payments: SchoolPayment[]
}

export async function getSchoolPaymentContext(schoolId: string): Promise<SchoolPaymentContext> {
  const [school, activeTeacherCount, payments] = await Promise.all([
    repos.schools.findById(schoolId),
    repos.schools.countActiveTeachers(schoolId),
    repos.schools.listPaymentsBySchool(schoolId),
  ])

  return {
    school: {
      id:                            school.id,
      school_name:                   school.school_name,
      county:                        school.county,
      school_entitlement_status:     school.school_entitlement_status,
      school_entitlement_expires_at: school.school_entitlement_expires_at,
    },
    activeTeacherCount,
    payments,
  }
}
