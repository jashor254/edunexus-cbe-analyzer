import { repos } from '@/lib/repositories'
import type { School, SchoolSettings, AcademicYear, Term, SchoolUser } from '@/types/core'
import { REFERENCE_SCHOOL_NAME } from '@/lib/config/referenceSchool'
import { logger } from '@/lib/observability/logger'
import { publishEvent } from '@/lib/events'
import { createServiceClient } from '@/utils/supabase/service'
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
  // DR-06 (Phase 10 rehearsal finding) — resubmitting this request (a UI
  // double-click, or a browser retry of a dropped response) used to create
  // a second, fully-activated school for the same principal. Narrowly
  // scoped to the same creator + same name within the last two minutes, so
  // it catches exactly that retry without ever blocking a founder who
  // later, deliberately, creates a second real institution.
  const recentDuplicate = await repos.schools.findRecentByCreatorAndName(creatorUserId, input.school_name)
  if (recentDuplicate) {
    const existingMembership = await repos.teachers.findSchoolUser(creatorUserId, recentDuplicate.id)
    if (existingMembership) {
      return { school: recentDuplicate, schoolUser: existingMembership }
    }
  }

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

/**
 * Records, for reconciliation only, the free-text school name a teacher typed
 * into their own profile. **Writes nothing.**
 *
 * WHAT THIS REPLACED, AND WHY
 * This was `ensureSchoolMembership()`, and it did exactly what its name said:
 * it matched the typed name case-insensitively against `schools` and, on a
 * hit, inserted a `school_users` row —
 *
 *     repos.schools.addSchoolUser(existingSchool.id, userId, 'teacher')
 *
 * — with `is_active` defaulting to TRUE, `invited_by` NULL, and no acceptance
 * step. No administrator was consulted at any point. Because
 * `lib/core/schoolEntitlement.ts` grants coverage on any active role='teacher'
 * membership at an entitled school, typing a school's name was sufficient to
 * inherit that institution's paid entitlement. Proven live against a synthetic
 * entitled school before removal: `resolveSchoolCoverage()` returned
 * `'covered'` (`lib/testing/teacherSelfJoin.http.integration.test.ts`).
 *
 * Institutional membership is school-owned data. It is created by an
 * administrator through `inviteSchoolMember()` (requireSchoolAdmin-gated) and
 * claimed by the teacher through `acceptTeacherInvitation()`, which reads the
 * role from the row the admin wrote and never from the invitee. The school
 * adds the teacher; the teacher does not add the school.
 *
 * The profile's `school` field survives as descriptive employment text on the
 * `teachers` row — useful on documents and in support conversations, and
 * carrying no authority whatsoever.
 *
 * The logging is kept deliberately: an unmatched (or matched-but-unlinked)
 * name is the only signal of who believes they work somewhere EduNexus has
 * not yet connected them to, and it is the reconciliation backlog a founder
 * works through when onboarding that school.
 */
export async function recordSchoolNameForReconciliation(
  userId: string,
  schoolName: string
): Promise<void> {
  const existingMembership = await repos.schools.findSchoolUserByUserId(userId)
  if (existingMembership) return // already institutionally linked — nothing to reconcile

  // Matching is still performed, but only to make the log actionable: it tells
  // a founder whether this teacher named a school EduNexus already knows about
  // (so an admin can be asked to add them) or one it has never heard of.
  const existingSchool = await repos.schools.findByNameCaseInsensitive(schoolName)

  logger.info('teacher profile school name recorded; no membership created', {
    service:               'core-school',
    user_id:               userId,
    attempted_school_name: schoolName,
    matched_school_id:     existingSchool?.id ?? null,
    // true = a real school of that name exists and this teacher is NOT linked
    // to it. That is an onboarding action for its administrator, never a
    // self-service join.
    awaiting_admin_link:   !!existingSchool,
  })
}

export async function updateSchool(
  schoolId: string,
  updates: Partial<Pick<School, 'school_name' | 'nemis_code' | 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url' | 'motto'>>
): Promise<School> {
  return repos.schools.update(schoolId, updates)
}

// Uploads a school's crest/logo to the public `school-logos` Storage
// bucket and points `schools.logo_url` at it — this is what the Learner
// Blueprint cover/header renders instead of generic EduNexus branding.
// Storage writes go through the service-role client (same posture as
// class-resources/assignment-submissions); the caller route is what
// enforces requireSchoolAdmin before this runs.
export async function uploadSchoolLogo(
  schoolId: string,
  bytes: Uint8Array,
  contentType: string,
  fileExtension: string
): Promise<School> {
  const db = createServiceClient()
  const objectPath = `${schoolId}/logo-${Date.now()}.${fileExtension}`

  const { error: uploadError } = await db.storage
    .from('school-logos')
    .upload(objectPath, bytes, { contentType, upsert: true })
  if (uploadError) throw new Error(`uploadSchoolLogo: ${uploadError.message}`)

  const { data: publicUrl } = db.storage.from('school-logos').getPublicUrl(objectPath)
  return repos.schools.update(schoolId, { logo_url: publicUrl.publicUrl })
}

export async function getSchoolSettings(schoolId: string): Promise<SchoolSettings> {
  return repos.schools.findSettings(schoolId)
}

export async function getSchoolSettingsOrNull(schoolId: string): Promise<SchoolSettings | null> {
  return repos.schools.findSettingsOrNull(schoolId)
}

// Sprint 4I (docs/engineering/sprint-4f-teacher-school-identity-audit.md,
// docs/architecture/deprecation-registry.md #5, docs/engineering/
// implementation-log.md): resolves a legacy teacher's grade_boundaries via
// Sprint 4G's findSchoolIdByTeacherId, the same way
// computeTermSummaries/generateReportCards already receive theirs — shared
// here (not duplicated per-route) since both
// app/api/teacher/analytics/route.ts and app/api/teacher/cohort/[grade]/
// route.ts need the identical resolution. Defensive by design, not just
// convenience: most teachers today have no school_users bridge (Sprint 4F),
// and a bridged school may not yet have a school_settings row
// (upsertSettings is opt-in, not auto-created on school creation) — both
// cases fall back to {} (the same 75/50/25 defaults as before this sprint),
// never a thrown error.
export async function resolveTeacherGradeBoundaries(
  teacherId: string
): Promise<Record<string, { min: number }>> {
  const schoolId = await repos.schools.findSchoolIdByTeacherId(teacherId)
  if (!schoolId) return {}
  try {
    const settings = await repos.schools.findSettings(schoolId)
    return settings.grade_boundaries ?? {}
  } catch {
    return {}
  }
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
