// lib/core/schoolEntitlement.ts
//
// THE canonical answer to "is this teacher covered by their school's EduNexus
// entitlement?" — one function, one join, called from checkFeatureAccess() and
// nowhere else re-implemented. A feature route that needs to know whether a
// teacher is school-covered calls this; it does not query school_users or
// schools itself (same one-function-per-decision rule as lib/core/permissions.ts).
//
// FOUR DISTINCT CONCEPTS — this module owns exactly one of them:
//   1. User account          — the person's EduNexus identity (auth.users/profiles)
//   2. School membership     — their current relationship to a school (school_users)
//   3. School entitlement    — whether the SCHOOL has institutional access  ← this file
//   4. Personal entitlement  — Solo Teacher / Family purchases (subscriptions,
//                              token_balances)
//
// The chain this resolves:
//
//     user
//      → active school_users membership (role='teacher', is_active=true)
//      → schools
//      → school_entitlement_status = 'active'
//      → expiry absent OR in the future
//      → SCHOOL-COVERED
//
// Coverage is the SCHOOL's, inherited through membership — it is never personal
// property. A teacher who transfers, retires, or resigns has their membership
// deactivated and stops inheriting; their account, history, and any personal
// purchases are untouched. Their replacement inherits the same school
// entitlement through their own membership, with no repurchase.
//
// WHY 'lookup_failed' IS A DISTINCT OUTCOME, NOT AN EXCEPTION
// This module replaces a call to repos.organizations.findUserOrganizations(),
// which queried `organization_members` — a table that has never existed in
// production. It threw PGRST205, checkFeatureAccess had no try/catch, and every
// non-admin teacher got HTTP 500 on every free teacher feature from 2026-08-01
// until this change. A gated teacher route must never 500 because institutional
// infrastructure is unavailable. So a failed lookup is a returned value, and the
// caller falls through to the personal teacher paths (first-SOW-free, Solo
// Teacher bundle, tokens).
//
// Failure direction is deliberate and asymmetric: we fail toward the Solo
// Teacher path, never toward free school access. Coverage is granted only on
// positive proof of an active, unexpired entitlement.

import { repos } from '@/lib/repositories'
import { logger } from '@/lib/observability/logger'
import { publishEvent } from '@/lib/events'
import type { School, SchoolEntitlementStatus } from '@/types/core'

export type SchoolCoverage =
  /** Positively proven: an active teacher membership at a school with live entitlement. */
  | { outcome: 'covered'; schoolId: string; expiresAt: string | null }
  /** Resolved successfully; this teacher is not school-covered. Personal paths apply. */
  | { outcome: 'not_covered'; reason: NotCoveredReason }
  /** Could not resolve. Personal paths apply. Never grants coverage. */
  | { outcome: 'lookup_failed'; reason: string }

export type NotCoveredReason =
  /** No active role='teacher' membership at any school — a Solo Teacher. */
  | 'no_active_membership'
  /** Membership exists, but no school behind it has been granted entitlement. */
  | 'school_not_entitled'
  /** Membership exists and entitlement was granted, but coverage has lapsed. */
  | 'entitlement_expired'

/** True when an entitlement row is 'active' and either open-ended or not yet lapsed. */
export function isEntitlementLive(
  status: string,
  expiresAt: string | null,
  now: Date = new Date()
): boolean {
  if (status !== 'active') return false
  if (expiresAt === null) return true
  return new Date(expiresAt).getTime() > now.getTime()
}

export async function resolveSchoolCoverage(
  userId: string,
  now: Date = new Date()
): Promise<SchoolCoverage> {
  let memberships
  try {
    memberships = await repos.schools.findActiveTeacherMembershipsWithEntitlement(userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Logged, not thrown: the caller degrades to personal teacher pricing. A
    // burst of these means the institutional lookup is broken — which must be
    // visible in logs without taking teacher tools down with it.
    logger.warn('resolveSchoolCoverage: institutional lookup failed, falling through to personal entitlement', {
      service: 'core-school-entitlement',
      user_id: userId,
      error:   message,
    })
    return { outcome: 'lookup_failed', reason: message }
  }

  if (memberships.length === 0) {
    return { outcome: 'not_covered', reason: 'no_active_membership' }
  }

  // A teacher with more than one active membership is schema-legal (the unique
  // key is school_id+user_id+role). Any ONE entitled school covers them —
  // scanning rather than assuming a single row is what keeps this from
  // throwing on data the schema permits. See the repository method's note.
  const live = memberships.find(m => isEntitlementLive(m.status, m.expiresAt, now))
  if (live) {
    return { outcome: 'covered', schoolId: live.schoolId, expiresAt: live.expiresAt }
  }

  // Not covered — distinguish "granted but lapsed" from "never granted", since
  // the two mean different things to whoever handles the school relationship.
  const lapsed = memberships.some(
    m => (m.status === 'active' && m.expiresAt !== null && new Date(m.expiresAt).getTime() <= now.getTime())
      || m.status === 'expired'
  )
  return {
    outcome: 'not_covered',
    reason:  lapsed ? 'entitlement_expired' : 'school_not_entitled',
  }
}

// ── Granting and withdrawing entitlement ─────────────────────────────────────

/**
 * Grants or withdraws a school's institutional entitlement.
 *
 * THIS IS NOT A PAYMENT FUNCTION. It collects nothing, prices nothing, and
 * talks to no payment provider. It records a decision EduNexus has already
 * made out of band — "we have independently confirmed this school should be
 * covered." The commercial model is deliberately not self-service: a school is
 * quoted, pays offline or by institutional transfer, and is then activated
 * here. Payment infrastructure will later become a *reason to call this*; it
 * will not replace it.
 *
 * Authorization is the caller's job (the route gates on requireGrowthUser) and
 * the database's (trg_guard_school_entitlement rejects this write outright for
 * the `authenticated` and `anon` roles). Both layers, because UI gating alone
 * would leave the "schools: own update" RLS policy — created_by = auth.uid(),
 * which every auto-provisioned teacher satisfies for their own school — as a
 * direct self-grant path.
 *
 * Staff turnover never requires re-granting: entitlement lives on the school,
 * and members inherit it through `school_users`.
 */
export async function setSchoolEntitlement(
  schoolId: string,
  status: SchoolEntitlementStatus,
  expiresAt: string | null,
  actorUserId: string
): Promise<School> {
  const school = await repos.schools.setEntitlement(schoolId, status, expiresAt)

  void publishEvent({
    event_type:    status === 'active' ? 'school.entitlement.activated' : 'school.entitlement.suspended',
    resource_type: 'school',
    resource_id:   schoolId,
    actor_id:      actorUserId,
    payload: {
      school_id:  schoolId,
      status,
      expires_at: expiresAt,
    },
  }).catch(err => console.error('[events] school.entitlement:', err instanceof Error ? err.message : String(err)))

  logger.info('setSchoolEntitlement: institutional entitlement changed', {
    service:    'core-school-entitlement',
    school_id:  schoolId,
    status,
    expires_at: expiresAt ?? 'none',
    actor_id:   actorUserId,
  })

  return school
}
