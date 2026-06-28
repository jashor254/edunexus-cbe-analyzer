import { createServiceClient } from '@/utils/supabase/service'
import type { School, SchoolSettings, AcademicYear, Term } from '@/types/core'

export async function getSchool(schoolId: string): Promise<School> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('schools')
    .select('id, school_name, nemis_code, school_type, county, sub_county, ward, address, contact_phone, contact_email, logo_url, motto, subscription_tier, is_active, created_at, updated_at')
    .eq('id', schoolId)
    .single()
  if (error) throw new Error(`getSchool: ${error.message}`)
  return data
}

export async function updateSchool(
  schoolId: string,
  updates: Partial<Pick<School, 'school_name' | 'nemis_code' | 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url' | 'motto'>>
): Promise<School> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', schoolId)
    .select('id, school_name, nemis_code, school_type, county, sub_county, ward, address, contact_phone, contact_email, logo_url, motto, subscription_tier, is_active, created_at, updated_at')
    .single()
  if (error) throw new Error(`updateSchool: ${error.message}`)
  return data
}

export async function getSchoolSettings(schoolId: string): Promise<SchoolSettings> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_settings')
    .select('id, school_id, curriculum_type, cbc_levels, grade_boundaries, school_open_days, report_footer, intelligence_enabled, intelligence_enabled_at, sms_enabled, timezone, created_at, updated_at')
    .eq('school_id', schoolId)
    .single()
  if (error) throw new Error(`getSchoolSettings: ${error.message}`)
  return data
}

export async function upsertSchoolSettings(
  schoolId: string,
  settings: Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
): Promise<SchoolSettings> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('school_settings')
    .upsert({ school_id: schoolId, ...settings }, { onConflict: 'school_id' })
    .select('id, school_id, curriculum_type, cbc_levels, grade_boundaries, school_open_days, report_footer, intelligence_enabled, intelligence_enabled_at, sms_enabled, timezone, created_at, updated_at')
    .single()
  if (error) throw new Error(`upsertSchoolSettings: ${error.message}`)
  return data
}

export async function enableIntelligence(schoolId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('school_settings')
    .update({ intelligence_enabled: true, intelligence_enabled_at: new Date().toISOString() })
    .eq('school_id', schoolId)
  if (error) throw new Error(`enableIntelligence: ${error.message}`)
}

// ── Academic Years ────────────────────────────────────────────────────────────

export async function listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, school_id, name, start_date, end_date, is_current, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false })
  if (error) throw new Error(`listAcademicYears: ${error.message}`)
  return data
}

export async function createAcademicYear(
  schoolId: string,
  input: Pick<AcademicYear, 'name' | 'start_date' | 'end_date'>
): Promise<AcademicYear> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('academic_years')
    .insert({ school_id: schoolId, ...input })
    .select('id, school_id, name, start_date, end_date, is_current, created_at, updated_at')
    .single()
  if (error) throw new Error(`createAcademicYear: ${error.message}`)
  return data
}

export async function setCurrentAcademicYear(schoolId: string, yearId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('academic_years').update({ is_current: false }).eq('school_id', schoolId)
  const { error } = await supabase
    .from('academic_years')
    .update({ is_current: true })
    .eq('id', yearId)
    .eq('school_id', schoolId)
  if (error) throw new Error(`setCurrentAcademicYear: ${error.message}`)
}

export async function getCurrentAcademicYear(schoolId: string): Promise<AcademicYear | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('academic_years')
    .select('id, school_id, name, start_date, end_date, is_current, created_at, updated_at')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()
  return data
}

// ── Terms ─────────────────────────────────────────────────────────────────────

export async function listTerms(schoolId: string, academicYearId?: string): Promise<Term[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('terms')
    .select('id, school_id, academic_year_id, term_number, name, start_date, end_date, is_current, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('term_number')
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  const { data, error } = await query
  if (error) throw new Error(`listTerms: ${error.message}`)
  return data
}

export async function createTerm(
  schoolId: string,
  input: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
): Promise<Term> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('terms')
    .insert({ school_id: schoolId, ...input })
    .select('id, school_id, academic_year_id, term_number, name, start_date, end_date, is_current, created_at, updated_at')
    .single()
  if (error) throw new Error(`createTerm: ${error.message}`)
  return data
}

export async function setCurrentTerm(schoolId: string, termId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId)
  const { error } = await supabase
    .from('terms')
    .update({ is_current: true })
    .eq('id', termId)
    .eq('school_id', schoolId)
  if (error) throw new Error(`setCurrentTerm: ${error.message}`)
}

export async function getCurrentTerm(schoolId: string): Promise<Term | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('terms')
    .select('id, school_id, academic_year_id, term_number, name, start_date, end_date, is_current, created_at, updated_at')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()
  return data
}
