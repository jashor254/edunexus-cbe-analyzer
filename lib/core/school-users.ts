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
  return repos.teachers.updateSchoolUserRole(schoolUserId, role)
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
