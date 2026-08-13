// lib/core/schoolDirectory.ts
//
// The platform-admin view of canonical schools — the list the founder needs to
// find the school they just sold to, and reach its payment/entitlement page
// without knowing a UUID.
//
// Cross-school reads happen HERE, server-side, behind requireGrowthUser(). They
// deliberately do not happen through RLS: the previous phases removed exactly
// that architecture (an `Admin full access on students` policy trusting a
// self-writable admin flag), and rebuilding a browser-reachable cross-tenant
// view of `schools` would be the same mistake in a new table.
//
// This is a READ. It writes nothing.

import { createServiceClient } from '@/utils/supabase/service'
import type { SchoolEntitlementStatus } from '@/types/core'

export type SchoolDirectoryEntry = {
  id: string
  schoolName: string
  county: string | null
  entitlementStatus: SchoolEntitlementStatus
  entitlementExpiresAt: string | null
  activeTeacherCount: number
  activeMemberCount: number
  /** True when the row was auto-provisioned by a teacher's first write rather than deliberately onboarded. */
  autoProvisioned: boolean
  /** True when the name matches a deterministic test-fixture marker — see isLikelyTestSchool. */
  likelyTestFixture: boolean
  createdAt: string
}

/**
 * Deterministic test-fixture detection, deliberately conservative.
 *
 * 395 of 405 live `schools` rows are test leftovers, because integration
 * suites create schools and do not clean them up. The founder must not record
 * a real KES 40,000 payment against `SYNTHETIC_MARY_FULL_CIRCUIT_TEST-school`.
 *
 * Only PREFIX markers this codebase actually emits are matched — `SYNTHETIC_`
 * (every lib/**\/*.test.ts fixture) and `DEBUG`/`debugredir-`/`debugbp-`. No
 * heuristic on the word "test" anywhere in the name: real Kenyan schools are
 * called things like "Testimony Academy", and flagging one of those as fake
 * would be worse than flagging none. This is a warning badge, never a filter —
 * nothing is hidden, deleted, or merged on the strength of it.
 */
export function isLikelyTestFixture(schoolName: string): boolean {
  return /^(synthetic_|debug)/i.test(schoolName.trim())
}

/**
 * Lists canonical schools for the founder, newest first, with the operational
 * counts needed to tell two similarly-named institutions apart.
 *
 * Two queries regardless of result size: one for the schools, one batched
 * membership lookup aggregated in memory. Never one query per school.
 *
 * Search is a plain case-insensitive name contains — enough for a human
 * looking up a school they just spoke to. No fuzzy-match infrastructure, and
 * no auto-selection: near-duplicates are all returned so the founder can see
 * them and choose, which is the correct response to a proven duplicate risk.
 */
export async function listSchoolsForPlatformAdmin(
  search?: string,
  limit = 50
): Promise<SchoolDirectoryEntry[]> {
  const db = createServiceClient()

  let query = db
    .from('schools')
    .select('id, school_name, county, school_entitlement_status, school_entitlement_expires_at, provisioning_source, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  const term = search?.trim()
  if (term) {
    // PostgREST treats % and , specially inside a filter value; strip them so a
    // pasted school name cannot turn into a different pattern than typed.
    query = query.ilike('school_name', `%${term.replace(/[%,]/g, '')}%`)
  }

  const { data: schools, error } = await query
  if (error) throw new Error(`listSchoolsForPlatformAdmin: ${error.message}`)
  if (!schools || schools.length === 0) return []

  const ids = schools.map(s => s.id)
  const { data: members, error: memberError } = await db
    .from('school_users')
    .select('school_id, role')
    .in('school_id', ids)
    .eq('is_active', true)
  if (memberError) throw new Error(`listSchoolsForPlatformAdmin members: ${memberError.message}`)

  const teacherCounts = new Map<string, number>()
  const memberCounts  = new Map<string, number>()
  for (const m of members ?? []) {
    memberCounts.set(m.school_id, (memberCounts.get(m.school_id) ?? 0) + 1)
    if (m.role === 'teacher') {
      teacherCounts.set(m.school_id, (teacherCounts.get(m.school_id) ?? 0) + 1)
    }
  }

  return schools.map(s => ({
    id:                   s.id,
    schoolName:           s.school_name,
    county:               s.county,
    entitlementStatus:    s.school_entitlement_status as SchoolEntitlementStatus,
    entitlementExpiresAt: s.school_entitlement_expires_at,
    activeTeacherCount:   teacherCounts.get(s.id) ?? 0,
    activeMemberCount:    memberCounts.get(s.id) ?? 0,
    autoProvisioned:      s.provisioning_source !== null,
    likelyTestFixture:    isLikelyTestFixture(s.school_name),
    createdAt:            s.created_at,
  }))
}
