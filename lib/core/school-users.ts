import { repos } from '@/lib/repositories'
import { publishEvent } from '@/lib/events'
import type { SchoolUser, SchoolUserRole } from '@/types/core'

export async function getSchoolUser(
  userId: string,
  schoolId: string
): Promise<SchoolUser | null> {
  return repos.teachers.findSchoolUser(userId, schoolId)
}

export async function listSchoolUsers(
  schoolId: string,
  role?: SchoolUserRole
): Promise<SchoolUser[]> {
  return repos.teachers.listSchoolUsers(schoolId, role)
}

export async function addSchoolUser(
  schoolId: string,
  userId: string,
  role: SchoolUserRole,
  invitedBy: string
): Promise<SchoolUser> {
  const schoolUser = await repos.teachers.upsertSchoolUser(schoolId, userId, role, invitedBy)

  void publishEvent({
    event_type:      'organization.member.invited',
    resource_type:   'school_user',
    resource_id:     schoolUser.id,
    actor_id:        invitedBy,
    payload: {
      school_user_id: schoolUser.id,
      user_id:        userId,
      role,
      school_id:      schoolId,
    },
    idempotency_key: `organization.member.invited:${schoolUser.id}`,
  }).catch(err => console.error('[events] organization.member.invited:', err instanceof Error ? err.message : String(err)))

  return schoolUser
}

export async function updateSchoolUserRole(
  schoolUserId: string,
  role: SchoolUserRole
): Promise<SchoolUser> {
  const schoolUser = await repos.teachers.updateSchoolUserRole(schoolUserId, role)

  void publishEvent({
    event_type:      'organization.member.role_changed',
    resource_type:   'school_user',
    resource_id:      schoolUserId,
    payload: {
      school_user_id: schoolUserId,
      user_id:        schoolUser.user_id,
      school_id:      schoolUser.school_id,
      new_role:       role,
    },
  }).catch(err => console.error('[events] organization.member.role_changed:', err instanceof Error ? err.message : String(err)))

  return schoolUser
}

// Canonical "this person no longer works at this school" operation — transfer,
// retirement, resignation, replacement, or any other end of employment.
//
// Keyed on (userId, schoolId) because that is how the event is actually known
// ("Teacher A left School X"), not by a school_users row id nobody holds. Sets
// `is_active = false` on the existing membership; it introduces no second
// status model, because the boolean already expresses the only two states this
// phase needs (active ↔ on hold) and is already what every membership read
// filters on.
//
// WHAT THIS DOES, in two parts:
//   1. stops the teacher inheriting the school's institutional entitlement
//      (lib/core/schoolEntitlement.ts resolves only active memberships), and
//   2. CLOSES their current teaching assignments at that school, so the posts
//      they held become vacant and stop appearing as anyone's current work.
//
// Part 2 is not cosmetic. Without it a departed teacher's `class_subjects`
// rows stayed open forever, pointing at an inactive membership: the class
// looked staffed when nobody taught it, and the partial unique index would
// have blocked the replacement's assignment because the outgoing one was
// still current.
//
// WHAT THIS DELIBERATELY DOES NOT DO: delete the user, delete their profile,
// delete or reassign their historical records, DELETE any assignment row,
// transfer their login, transfer their personal Solo Teacher or Family
// purchases, suspend the school, consume the school's entitlement, or affect
// any other teacher at that school. A teacher_id on a historical row means
// "who entered this," never "who owns this" (CLAUDE.md) — employment ending
// never rewrites authorship. Their EduNexus identity and any personal
// entitlement survive intact, and a replacement receives their own membership
// rather than this one.
//
// Idempotent end to end: the membership lookup filters on is_active, and the
// assignment closure filters on ended_at IS NULL, so calling this twice
// closes nothing the second time and cannot rewrite the first closure's
// timestamps.
//
// Returns false when there was no active membership to deactivate, so callers
// can distinguish "already gone" from "just removed" without a second query.
export async function deactivateSchoolMembership(
  userId: string,
  schoolId: string
): Promise<boolean> {
  const membership = await repos.teachers.findSchoolUser(userId, schoolId)
  if (!membership) return false

  // Assignments first: if this call fails partway, a still-active membership
  // with closed assignments is a recoverable, honest state (they work here but
  // teach nothing yet). The reverse — an inactive membership still holding
  // open posts — is the exact stale state described above.
  await repos.teachers.closeCurrentAssignmentsForMembership(membership.id)
  await deactivateSchoolUser(membership.id)
  return true
}

export async function deactivateSchoolUser(schoolUserId: string): Promise<void> {
  await repos.teachers.deactivateSchoolUser(schoolUserId)

  void publishEvent({
    event_type:      'organization.member.removed',
    resource_type:   'school_user',
    resource_id:     schoolUserId,
    payload:         { school_user_id: schoolUserId },
    idempotency_key: `organization.member.removed:${schoolUserId}`,
  }).catch(err => console.error('[events] organization.member.removed:', err instanceof Error ? err.message : String(err)))
}

export async function isSchoolAdmin(userId: string, schoolId: string): Promise<boolean> {
  return repos.teachers.isSchoolAdmin(userId, schoolId)
}

export async function isTeacherInSchool(userId: string, schoolId: string): Promise<boolean> {
  return repos.teachers.isTeacherInSchool(userId, schoolId)
}
