import { repos } from '@/lib/repositories'
import type { School, SchoolSettings, AcademicYear, Term } from '@/types/core'

export async function getSchool(schoolId: string): Promise<School> {
  return repos.schools.findById(schoolId)
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
