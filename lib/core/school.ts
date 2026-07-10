import { repos } from '@/lib/repositories'
import type { School, SchoolSettings, AcademicYear, Term, SchoolUser } from '@/types/core'
import { REFERENCE_SCHOOL_NAME } from '@/lib/config/referenceSchool'

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
// who already has an active school_users row is left untouched. Exact-name
// match only (no fuzzy matching yet), so "Nairobi Academy" vs "nairobi academy"
// will currently create two schools — acceptable at pilot scale, worth a
// case-insensitive match or an explicit join/create UI once schools collide.
export async function ensureSchoolMembership(
  userId: string,
  schoolName: string
): Promise<{ schoolId: string; role: SchoolUser['role']; created: boolean }> {
  const existingMembership = await repos.schools.findSchoolUserByUserId(userId)
  if (existingMembership) {
    return { schoolId: existingMembership.school_id, role: existingMembership.role, created: false }
  }

  const trimmedName = schoolName.trim()
  const existingSchool = await repos.schools.findByName(trimmedName)

  if (existingSchool) {
    const schoolUser = await repos.schools.addSchoolUser(existingSchool.id, userId, 'teacher')
    return { schoolId: existingSchool.id, role: schoolUser.role, created: false }
  }

  const newSchool = await repos.schools.create({ school_name: trimmedName }, userId)
  const schoolUser = await repos.schools.addSchoolUser(newSchool.id, userId, 'school_admin')
  return { schoolId: newSchool.id, role: schoolUser.role, created: true }
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
