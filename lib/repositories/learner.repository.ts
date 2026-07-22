import { BaseRepository } from './base'
import type {
  Learner,
  LearnerWithGuardians,
  LearnerWithEnrollment,
  LearnerGuardian,
  LearnerEnrollment,
  LearnerPromotion,
  LearnerTransfer,
  LearnerStatus,
  AdmitLearnerInput,
  EnrollLearnerInput,
  TransferLearnerInput,
  RunPromotionInput,
} from '@/types/core'

const LEARNER_COLS =
  'id, school_id, admission_number, upi, first_name, middle_name, last_name, date_of_birth, gender, photo_url, nationality, county_of_origin, special_needs, status, admission_date, graduation_date, notes, created_at, updated_at'

const GUARDIAN_COLS =
  'id, school_id, learner_id, user_id, relationship, full_name, phone, email, national_id, is_primary, can_receive_reports, created_at, updated_at'

const ENROLLMENT_COLS =
  'id, school_id, learner_id, class_id, term_id, academic_year_id, enrollment_date, status, created_at, updated_at'

const PROMOTION_COLS =
  'id, school_id, learner_id, from_class_id, to_class_id, from_academic_year_id, to_academic_year_id, promotion_type, processed_by, notes, promoted_at, created_at, updated_at'

const TRANSFER_COLS =
  'id, learner_id, from_school_id, to_school_id, to_school_name, direction, transfer_date, reason, document_urls, processed_by, created_at, updated_at'

export class LearnerRepository extends BaseRepository {
  // ── Learners ───────────────────────────────────────────────────────────────

  async insert(
    schoolId: string,
    input: AdmitLearnerInput
  ): Promise<Learner> {
    const { data, error } = await this.db
      .from('learners')
      .insert({
        school_id:        schoolId,
        admission_number: input.admission_number,
        first_name:       input.first_name,
        middle_name:      input.middle_name ?? null,
        last_name:        input.last_name,
        date_of_birth:    input.date_of_birth ?? null,
        gender:           input.gender ?? null,
        upi:              input.upi ?? null,
        county_of_origin: input.county_of_origin ?? null,
        special_needs:    input.special_needs ?? [],
        notes:            input.notes ?? null,
      })
      .select(LEARNER_COLS)
      .single()
    if (error) throw new Error(`admitLearner: ${error.message}`)
    return data
  }

  async findById(learnerId: string, schoolId: string): Promise<LearnerWithGuardians> {
    const { data, error } = await this.db
      .from('learners')
      .select(`${LEARNER_COLS}, learner_guardians (${GUARDIAN_COLS})`)
      .eq('id', learnerId)
      .eq('school_id', schoolId)
      .single()
    if (error) throw new Error(`getLearner: ${error.message}`)
    return data as LearnerWithGuardians
  }

  async findWithHistory(learnerId: string, schoolId: string): Promise<LearnerWithEnrollment> {
    const { data, error } = await this.db
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

  async list(
    schoolId: string,
    filters?: { status?: LearnerStatus; search?: string }
  ): Promise<Learner[]> {
    let query = this.db
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

  async update(
    learnerId: string,
    schoolId: string,
    updates: Partial<Pick<Learner, 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth' | 'gender' | 'upi' | 'photo_url' | 'county_of_origin' | 'special_needs' | 'status' | 'notes' | 'graduation_date'>>
  ): Promise<Learner> {
    const { data, error } = await this.db
      .from('learners')
      .update(updates)
      .eq('id', learnerId)
      .eq('school_id', schoolId)
      .select(LEARNER_COLS)
      .single()
    if (error) throw new Error(`updateLearner: ${error.message}`)
    return data
  }

  async updateStatus(learnerId: string, schoolId: string, status: LearnerStatus): Promise<void> {
    const { error } = await this.db
      .from('learners')
      .update({ status })
      .eq('id', learnerId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`updateLearnerStatus: ${error.message}`)
  }

  async updateStatusById(learnerId: string, updates: Partial<Pick<Learner, 'status' | 'graduation_date'>>): Promise<void> {
    const { error } = await this.db
      .from('learners')
      .update(updates)
      .eq('id', learnerId)
    if (error) throw new Error(`updateLearnerStatus: ${error.message}`)
  }

  async findSchoolId(learnerId: string): Promise<string> {
    const { data } = await this.db
      .from('learners')
      .select('school_id')
      .eq('id', learnerId)
      .single()
    if (!data) throw new Error(`Learner ${learnerId} not found`)
    return data.school_id
  }

  // Sprint 9D: admission idempotency — mirrors the live UNIQUE(school_id,
  // admission_number) constraint (supabase/migrations/20260629_core_foundation.sql:422)
  // so learnerOnboarding.ts can check-then-create instead of relying on a
  // raw constraint-violation error.
  async findByAdmissionNumber(schoolId: string, admissionNumber: string): Promise<Learner | null> {
    const { data } = await this.db
      .from('learners')
      .select(LEARNER_COLS)
      .eq('school_id', schoolId)
      .eq('admission_number', admissionNumber)
      .maybeSingle()
    return data
  }

  // ── Guardians ──────────────────────────────────────────────────────────────

  // Sprint 9D: guardian-link idempotency. learner_guardians has no live
  // UNIQUE constraint (confirmed via pg_constraint) — phone number is the
  // most realistic "same guardian" business key available on this table,
  // so this is the only thing preventing a duplicate guardian row on
  // retry; called explicitly for a reason, not assumed safe.
  async findGuardianByPhone(learnerId: string, phone: string): Promise<LearnerGuardian | null> {
    const { data } = await this.db
      .from('learner_guardians')
      .select(GUARDIAN_COLS)
      .eq('learner_id', learnerId)
      .eq('phone', phone)
      .maybeSingle()
    return data
  }

  async insertGuardian(
    schoolId: string,
    learnerId: string,
    input: Omit<LearnerGuardian, 'id' | 'school_id' | 'learner_id' | 'created_at' | 'updated_at'>
  ): Promise<LearnerGuardian> {
    const { data, error } = await this.db
      .from('learner_guardians')
      .insert({ school_id: schoolId, learner_id: learnerId, ...input })
      .select(GUARDIAN_COLS)
      .single()
    if (error) throw new Error(`addGuardian: ${error.message}`)
    return data
  }

  // Sprint 12 Wave 3 (Critical 1) — the two reads/writes the guardian-claim
  // flow needs on learner_guardians itself, beyond insertGuardian above.
  async findGuardianById(guardianId: string): Promise<LearnerGuardian | null> {
    const { data } = await this.db
      .from('learner_guardians')
      .select(GUARDIAN_COLS)
      .eq('id', guardianId)
      .maybeSingle()
    return data
  }

  async updateGuardianUserId(guardianId: string, userId: string): Promise<void> {
    const { error } = await this.db
      .from('learner_guardians')
      .update({ user_id: userId })
      .eq('id', guardianId)
    if (error) throw new Error(`updateGuardianUserId: ${error.message}`)
  }

  // ── Enrollments ────────────────────────────────────────────────────────────

  async upsertEnrollment(
    input: EnrollLearnerInput & { school_id: string }
  ): Promise<LearnerEnrollment> {
    const { data, error } = await this.db
      .from('learner_enrollments')
      .upsert(
        {
          school_id:        input.school_id,
          learner_id:       input.learner_id,
          class_id:         input.class_id,
          term_id:          input.term_id,
          academic_year_id: input.academic_year_id,
          enrollment_date:  new Date().toISOString().split('T')[0],
          status:           'active',
        },
        { onConflict: 'learner_id,term_id' }
      )
      .select(ENROLLMENT_COLS)
      .single()
    if (error) throw new Error(`enrollLearner: ${error.message}`)
    return data
  }

  async updateEnrollmentStatus(
    learnerId: string,
    termId: string,
    status: string
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_enrollments')
      .update({ status })
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
    if (error) throw new Error(`updateEnrollmentStatus: ${error.message}`)
  }

  async withdrawActiveEnrollments(learnerId: string, status: string): Promise<void> {
    const { error } = await this.db
      .from('learner_enrollments')
      .update({ status })
      .eq('learner_id', learnerId)
      .eq('status', 'active')
    if (error) throw new Error(`withdrawActiveEnrollments: ${error.message}`)
  }

  async findEnrollmentByClass(
    classId: string,
    termId: string
  ): Promise<{ learner_id: string; learners: unknown }[]> {
    const { data, error } = await this.db
      .from('learner_enrollments')
      .select(`learner_id, learners (${LEARNER_COLS})`)
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('status', 'active')
    if (error) throw new Error(`listLearners (by class): ${error.message}`)
    return (data ?? []) as { learner_id: string; learners: unknown }[]
  }

  async findEnrollmentsByYear(
    schoolId: string,
    academicYearId: string
  ): Promise<{
    learner_id: string
    class_id: string
    learners: unknown
    classes: unknown
  }[]> {
    const { data, error } = await this.db
      .from('learner_enrollments')
      .select(`
        learner_id,
        class_id,
        learners (id, first_name, middle_name, last_name, admission_number),
        classes (id, display_name, grade_id, grades (name, code, level_order))
      `)
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active')
    if (error) throw new Error(`previewPromotion: ${error.message}`)
    return (data ?? []) as {
      learner_id: string
      class_id: string
      learners: unknown
      classes: unknown
    }[]
  }

  async findActiveEnrollmentClass(
    learnerId: string,
    academicYearId: string
  ): Promise<string> {
    const { data } = await this.db
      .from('learner_enrollments')
      .select('class_id')
      .eq('learner_id', learnerId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!data) throw new Error(`No active enrollment found for learner ${learnerId}`)
    return data.class_id
  }

  async findClassRoster(classId: string, termId: string): Promise<{ learners: unknown }[]> {
    const { data, error } = await this.db
      .from('learner_enrollments')
      .select(`learners (${LEARNER_COLS})`)
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('status', 'active')
    if (error) throw new Error(`getClassRoster: ${error.message}`)
    return (data ?? []) as { learners: unknown }[]
  }

  // ── Promotions ─────────────────────────────────────────────────────────────

  async listPromotionHistory(learnerId: string, schoolId: string): Promise<LearnerPromotion[]> {
    const { data, error } = await this.db
      .from('learner_promotions')
      .select(PROMOTION_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('promoted_at', { ascending: false })
    if (error) throw new Error(`getLearnerPromotionHistory: ${error.message}`)
    return data
  }

  async insertPromotion(params: {
    school_id: string
    learner_id: string
    from_class_id: string
    to_class_id: string | null
    from_academic_year_id: string
    to_academic_year_id: string | null
    promotion_type: string
    processed_by: string
    notes: string | null
  }): Promise<void> {
    const { error } = await this.db.from('learner_promotions').insert(params)
    if (error) throw new Error(error.message)
  }

  // ── Transfers ──────────────────────────────────────────────────────────────

  async insertTransfer(params: {
    learner_id: string
    from_school_id: string
    to_school_id: string | null
    to_school_name: string | null
    direction: string
    transfer_date: string
    reason: string | null
    document_urls: string[]
    processed_by: string
  }): Promise<LearnerTransfer> {
    const { data, error } = await this.db
      .from('learner_transfers')
      .insert(params)
      .select(TRANSFER_COLS)
      .single()
    if (error) throw new Error(`transferLearner: ${error.message}`)
    return data
  }

  async listTransfers(learnerId: string): Promise<LearnerTransfer[]> {
    const { data, error } = await this.db
      .from('learner_transfers')
      .select(TRANSFER_COLS)
      .eq('learner_id', learnerId)
      .order('transfer_date', { ascending: false })
    if (error) throw new Error(`getLearnerTransfers: ${error.message}`)
    return data
  }
}
