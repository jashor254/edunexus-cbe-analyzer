import { repos } from '@/lib/repositories'
import type { School, SchoolSettings, AcademicYear, Term, SchoolUser } from '@/types/core'
import { REFERENCE_SCHOOL_NAME } from '@/lib/config/referenceSchool'
import { logger } from '@/lib/observability/logger'
import { publishEvent } from '@/lib/events'
import { addSchoolUser } from './school-users'

// Creates a new Core school and makes the creator its school_admin — same
// "create, then grant the creator ownership" shape as
// lib/organizations/create.ts's createOrganization, and the same audit path
// Core already uses for membership changes (addSchoolUser publishes
// 'organization.member.invited' via lib/events — see lib/core/school-users.ts).
// The school-creation step itself is also published here (previously only
// the resulting admin membership grant was traceable, not the school's own
// attributes at creation time).
export async function createSchool(
  input: Pick<School, 'school_name'> & Partial<Pick<School, 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'nemis_code' | 'motto'>>,
  creatorUserId: string
): Promise<{ school: School; schoolUser: SchoolUser }> {
  const school = await repos.schools.create(input, creatorUserId)

  void publishEvent({
    event_type:      'organization.created',
    resource_type:   'school',
    resource_id:     school.id,
    actor_id:        creatorUserId,
    payload:         { school_name: school.school_name, school_type: school.school_type, county: school.county },
    idempotency_key: `organization.created:${school.id}`,
  }).catch(err => console.error('[events] organization.created:', err instanceof Error ? err.message : String(err)))

  const schoolUser = await addSchoolUser(school.id, creatorUserId, 'school_admin', creatorUserId)
  return { school, schoolUser }
}

export async function getSchool(schoolId: string): Promise<School> {
  return repos.schools.findById(schoolId)
}

export async function getSchoolByName(schoolName: string): Promise<School | null> {
  return repos.schools.findByName(schoolName)
}

export async function getReferenceSchool(): Promise<School> {
  const school = await repos.schools.findByName(REFERENCE_SCHOOL_NAME)
  if (!school) throw new Error(`Reference School not found — run scripts/reference-school/run-all.ts first`)
  return school
}

// Links a teacher to a real `schools`/`school_users` row from the free-text
// school name captured at signup (app/teacher/setup). Idempotent — a teacher
// who already has an active school_users row is left untouched. Matches
// case/whitespace-insensitively so "Nairobi Academy" and "nairobi academy "
// resolve to the same school. When no match is found, this deliberately does
// NOT create a new `schools` row — Core has no onboarding UI today (no page
// calls any app/api/core/* route), so a silently-created school can never be
// viewed, corrected, or managed by anyone. Returns `schoolId: null` in that
// case; the caller (app/api/teacher/profile) already discards this return
// value, so no caller-side change is needed.
export async function ensureSchoolMembership(
  userId: string,
  schoolName: string
): Promise<{ schoolId: string | null; role: SchoolUser['role'] | null; created: boolean }> {
  const existingMembership = await repos.schools.findSchoolUserByUserId(userId)
  if (existingMembership) {
    return { schoolId: existingMembership.school_id, role: existingMembership.role, created: false }
  }

  const existingSchool = await repos.schools.findByNameCaseInsensitive(schoolName)

  if (existingSchool) {
    const schoolUser = await repos.schools.addSchoolUser(existingSchool.id, userId, 'teacher')
    return { schoolId: existingSchool.id, role: schoolUser.role, created: false }
  }

  // No match, and no school is minted (see comment above). Log the
  // unmatched name so there's a reconciliation backlog once a school-
  // management UI exists — without this there's no record of who fell
  // through or what they typed.
  logger.info('ensureSchoolMembership: no school match, no Core row created', {
    service:  'core-school',
    user_id:  userId,
    attempted_school_name: schoolName,
  })

  return { schoolId: null, role: null, created: false }
}

export async function updateSchool(
  schoolId: string,
  updates: Partial<Pick<School, 'school_name' | 'nemis_code' | 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url' | 'motto'>>
): Promise<School> {
  return repos.schools.update(schoolId, updates)
}

export async function getSchoolSettings(schoolId: string): Promise<SchoolSettings> {
  return repos.schools.findSettings(schoolId)
}

export async function upsertSchoolSettings(
  schoolId: string,
  settings: Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
): Promise<SchoolSettings> {
  return repos.schools.upsertSettings(schoolId, settings)
}

export async function enableIntelligence(schoolId: string): Promise<void> {
  return repos.schools.enableIntelligence(schoolId)
}

// ── Academic Years ────────────────────────────────────────────────────────────

export async function listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  return repos.schools.listAcademicYears(schoolId)
}

export async function createAcademicYear(
  schoolId: string,
  input: Pick<AcademicYear, 'name' | 'start_date' | 'end_date'>
): Promise<AcademicYear> {
  return repos.schools.insertAcademicYear(schoolId, input)
}

export async function setCurrentAcademicYear(schoolId: string, yearId: string): Promise<void> {
  await repos.schools.clearCurrentAcademicYear(schoolId)
  return repos.schools.setCurrentAcademicYear(schoolId, yearId)
}

export async function getCurrentAcademicYear(schoolId: string): Promise<AcademicYear | null> {
  return repos.schools.findCurrentAcademicYear(schoolId)
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export async function listTerms(schoolId: string, academicYearId?: string): Promise<Term[]> {
  return repos.schools.listTerms(schoolId, academicYearId)
}

export async function createTerm(
  schoolId: string,
  input: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
): Promise<Term> {
  return repos.schools.insertTerm(schoolId, input)
}

export async function setCurrentTerm(schoolId: string, termId: string): Promise<void> {
  await repos.schools.clearCurrentTerm(schoolId)
  return repos.schools.setCurrentTerm(schoolId, termId)
}

export async function getCurrentTerm(schoolId: string): Promise<Term | null> {
  return repos.schools.findCurrentTerm(schoolId)
}
