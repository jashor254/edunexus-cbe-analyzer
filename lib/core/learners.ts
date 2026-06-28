import { createServiceClient } from '@/utils/supabase/service'
import type {
  Learner,
  LearnerWithGuardians,
  LearnerWithEnrollment,
  LearnerGuardian,
  LearnerEnrollment,
  LearnerStatus,
  AdmitLearnerInput,
  EnrollLearnerInput,
} from '@/types/core'

const LEARNER_COLS = 'id, school_id, admission_number, upi, first_name, middle_name, last_name, date_of_birth, gender, photo_url, nationality, county_of_origin, special_needs, status, admission_date, graduation_date, notes, created_at, updated_at'
const GUARDIAN_COLS = 'id, school_id, learner_id, user_id, relationship, full_name, phone, email, national_id, is_primary, can_receive_reports, created_at, updated_at'

// ── Admission ─────────────────────────────────────────────────────────────────

export async function admitLearner(
  schoolId: string,
  input: AdmitLearnerInput
): Promise<LearnerWithGuardians> {
  const supabase = createServiceClient()

  const { data: learner, error: learnerErr } = await supabase
    .from('learners')
    .insert({
      school_id: schoolId,
      admission_number: input.admission_number,
      first_name: input.first_name,
      middle_name: input.middle_name ?? null,
      last_name: input.last_name,
      date_of_birth: input.date_of_birth ?? null,
      gender: input.gender ?? null,
      upi: input.upi ?? null,
      county_of_origin: input.county_of_origin ?? null,
      special_needs: input.special_needs ?? [],
      notes: input.notes ?? null,
    })
    .select(LEARNER_COLS)
    .single()
  if (learnerErr) throw new Error(`admitLearner: ${learnerErr.message}`)

  const { data: guardian, error: guardianErr } = await supabase
    .from('learner_guardians')
    .insert({
      school_id: schoolId,
      learner_id: learner.id,
      relationship: input.guardian.relationship,
      full_name: input.guardian.full_name,
      phone: input.guardian.phone,
      email: input.guardian.email ?? null,
      national_id: input.guardian.national_id ?? null,
      is_primary: true,
      can_receive_reports: true,
    })
    .select(GUARDIAN_COLS)
    .single()
  if (guardianErr) throw new Error(`admitLearner (guardian): ${guardianErr.message}`)

  return { ...learner, learner_guardians: [guardian] }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getLearner(learnerId: string, schoolId: string): Promise<LearnerWithGuardians> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learners')
    .select(`${LEARNER_COLS}, learner_guardians (${GUARDIAN_COLS})`)
    .eq('id', learnerId)
    .eq('school_id', schoolId)
    .single()
  if (error) throw new Error(`getLearner: ${error.message}`)
  return data as LearnerWithGuardians
}

export async function listLearners(
  schoolId: string,
  filters?: { status?: LearnerStatus; classId?: string; termId?: string; search?: string }
): Promise<Learner[]> {
  const supabase = createServiceClient()

  if (filters?.classId && filters?.termId) {
    const { data, error } = await supabase
      .from('learner_enrollments')
      .select(`learner_id, learners (${LEARNER_COLS})`)
      .eq('class_id', filters.classId)
      .eq('term_id', filters.termId)
      .eq('status', 'active')
    if (error) throw new Error(`listLearners (by class): ${error.message}`)
    return (data ?? []).map((r) => r.learners as unknown as Learner)
  }

  let query = supabase
    .from('learners')
    .select(LEARNER_COLS)
    .eq('school_id', schoolId)
    .order('last_name')
    .order('first_name')

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,admission_number.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(`listLearners: ${error.message}`)
  return data
}

export async function getLearnerHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerWithEnrollment> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learners')
    .select(`
      ${LEARNER_COLS},
      learner_enrollments (id, class_id, term_id, academic_year_id, enrollment_date, status,
        classes (id, display_name, grade_id)),
      learner_promotions (id, from_class_id, to_class_id, promotion_type, promoted_at, notes),
      learner_transfers (id, direction, transfer_date, to_school_name, reason)
    `)
    .eq('id', learnerId)
    .eq('school_id', schoolId)
    .single()
  if (error) throw new Error(`getLearnerHistory: ${error.message}`)
  return data as unknown as LearnerWithEnrollment
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateLearner(
  learnerId: string,
  schoolId: string,
  updates: Partial<Pick<Learner, 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth' | 'gender' | 'upi' | 'photo_url' | 'county_of_origin' | 'special_needs' | 'status' | 'notes' | 'graduation_date'>>
): Promise<Learner> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learners')
    .update(updates)
    .eq('id', learnerId)
    .eq('school_id', schoolId)
    .select(LEARNER_COLS)
    .single()
  if (error) throw new Error(`updateLearner: ${error.message}`)
  return data
}

export async function archiveLearner(learnerId: string, schoolId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('learners')
    .update({ status: 'archived' })
    .eq('id', learnerId)
    .eq('school_id', schoolId)
  if (error) throw new Error(`archiveLearner: ${error.message}`)
}

// ── Guardians ─────────────────────────────────────────────────────────────────

export async function addGuardian(
  schoolId: string,
  learnerId: string,
  input: Omit<LearnerGuardian, 'id' | 'school_id' | 'learner_id' | 'created_at' | 'updated_at'>
): Promise<LearnerGuardian> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_guardians')
    .insert({ school_id: schoolId, learner_id: learnerId, ...input })
    .select(GUARDIAN_COLS)
    .single()
  if (error) throw new Error(`addGuardian: ${error.message}`)
  return data
}

// ── Enrollments ───────────────────────────────────────────────────────────────

export async function enrollLearner(input: EnrollLearnerInput & { school_id: string }): Promise<LearnerEnrollment> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_enrollments')
    .upsert(
      { school_id: input.school_id, learner_id: input.learner_id, class_id: input.class_id, term_id: input.term_id, academic_year_id: input.academic_year_id, enrollment_date: new Date().toISOString().split('T')[0], status: 'active' },
      { onConflict: 'learner_id,term_id' }
    )
    .select('id, school_id, learner_id, class_id, term_id, academic_year_id, enrollment_date, status, created_at, updated_at')
    .single()
  if (error) throw new Error(`enrollLearner: ${error.message}`)
  return data
}

export async function withdrawLearner(learnerId: string, termId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('learner_enrollments')
    .update({ status: 'withdrawn' })
    .eq('learner_id', learnerId)
    .eq('term_id', termId)
  if (error) throw new Error(`withdrawLearner: ${error.message}`)
}

export async function getClassRoster(classId: string, termId: string): Promise<Learner[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('learner_enrollments')
    .select(`learners (${LEARNER_COLS})`)
    .eq('class_id', classId)
    .eq('term_id', termId)
    .eq('status', 'active')
  if (error) throw new Error(`getClassRoster: ${error.message}`)
  return (data ?? []).map((r) => r.learners as unknown as Learner)
}
