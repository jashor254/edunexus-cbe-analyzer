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
  'id, school_id, learner_id, class_id, term_id, academic_year_id, enrollment_date, status, ended_at, created_at, updated_at'

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
        learner_enrollments (id, class_id, term_id, academic_year_id, enrollment_date, status, ended_at,
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

  // Batched counterpart to insert(), for roster import.
  //
  // The column mapping below is a copy of insert()'s, deliberately — this is
  // the SAME definition of a valid learner, written once per row instead of
  // once per round trip. It is not a second interpretation: both take
  // AdmitLearnerInput, both apply the same defaults, and roster validation
  // runs before either. A 400-learner school would otherwise pay 400
  // sequential network round trips.
  //
  // Chunked because PostgREST has a practical payload ceiling; 200 rows per
  // request comfortably clears it at pilot scale.
  async insertMany(schoolId: string, inputs: AdmitLearnerInput[]): Promise<Learner[]> {
    const CHUNK = 200
    const created: Learner[] = []

    for (let i = 0; i < inputs.length; i += CHUNK) {
      const chunk = inputs.slice(i, i + CHUNK).map(input => ({
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
      }))

      const { data, error } = await this.db
        .from('learners')
        .insert(chunk)
        .select(LEARNER_COLS)
      if (error) throw new Error(`importLearners: ${error.message}`)
      created.push(...(data ?? []))
    }

    return created
  }

  // Batched counterpart to upsertEnrollment() — same "re-enrolling into a
  // different class preserves history rather than overwriting" behaviour,
  // same reason (see upsertEnrollment's own comment: native upsert can no
  // longer target the partial current-enrollment index). Callers
  // (learnerRoster CSV import, term rollover) always pass rows sharing one
  // term_id in practice, but this stays correct even if they don't —
  // current enrollments are looked up per distinct term present in the
  // batch, not assumed uniform.
  async upsertEnrollments(
    rows: Array<EnrollLearnerInput & { school_id: string }>
  ): Promise<number> {
    if (rows.length === 0) return 0
    const CHUNK = 200
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    let count = 0

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)

      const byTerm = new Map<string, typeof chunk>()
      for (const row of chunk) {
        const forTerm = byTerm.get(row.term_id) ?? []
        forTerm.push(row)
        byTerm.set(row.term_id, forTerm)
      }

      for (const [termId, termRows] of byTerm) {
        const learnerIds = termRows.map(r => r.learner_id)
        const { data: currentRows, error: readErr } = await this.db
          .from('learner_enrollments')
          .select('id, learner_id, class_id')
          .eq('term_id', termId)
          .eq('status', 'active')
          .is('ended_at', null)
          .in('learner_id', learnerIds)
        if (readErr) throw new Error(`importLearnerEnrollments (read current): ${readErr.message}`)

        const currentByLearner = new Map((currentRows ?? []).map(r => [r.learner_id, r]))

        const idsToClose = termRows
          .map(r => currentByLearner.get(r.learner_id))
          .filter((c): c is { id: string; learner_id: string; class_id: string } => !!c && c.class_id !== termRows.find(r => r.learner_id === c.learner_id)!.class_id)
          .map(c => c.id)

        if (idsToClose.length > 0) {
          const { error: closeErr } = await this.db
            .from('learner_enrollments')
            .update({ ended_at: now })
            .in('id', idsToClose)
            .is('ended_at', null)
          if (closeErr) throw new Error(`importLearnerEnrollments (close superseded): ${closeErr.message}`)
        }

        const toInsert = termRows
          .filter(r => {
            const c = currentByLearner.get(r.learner_id)
            return !c || c.class_id !== r.class_id // no row yet, or moving to a different class
          })
          .map(r => ({
            school_id:        r.school_id,
            learner_id:       r.learner_id,
            class_id:         r.class_id,
            term_id:          r.term_id,
            academic_year_id: r.academic_year_id,
            enrollment_date:  today,
            status:           'active',
          }))

        if (toInsert.length > 0) {
          const { data, error: insertErr } = await this.db
            .from('learner_enrollments')
            .insert(toInsert)
            .select('id')
          if (insertErr) throw new Error(`importLearnerEnrollments (insert): ${insertErr.message}`)
          count += data?.length ?? 0
        }
      }
    }

    return count
  }

  // Which of these admission numbers already exist at this school. One query,
  // used by roster preview to tell NEW from ALREADY EXISTS before any write.
  async findExistingAdmissionNumbers(schoolId: string, admissionNumbers: string[]): Promise<Set<string>> {
    if (admissionNumbers.length === 0) return new Set()
    const found = new Set<string>()
    const CHUNK = 300

    for (let i = 0; i < admissionNumbers.length; i += CHUNK) {
      const { data, error } = await this.db
        .from('learners')
        .select('admission_number')
        .eq('school_id', schoolId)
        .in('admission_number', admissionNumbers.slice(i, i + CHUNK))
      if (error) throw new Error(`findExistingAdmissionNumbers: ${error.message}`)
      for (const row of data ?? []) found.add(row.admission_number)
    }

    return found
  }

  // Phase 4 — was a native `.upsert(..., { onConflict: 'learner_id,term_id' })`.
  // That relied on the total UNIQUE(learner_id, term_id) constraint
  // 20260814173242_learner_enrollments_current_history.sql replaced with a
  // partial one (current rows only), which native upsert can't target
  // through the supabase-js client (its onConflict option is a plain
  // column list; Postgres needs a matching NON-partial index to infer
  // against). Rewritten as an explicit find-current/close/insert sequence —
  // the same shape lib/repositories/teacher.repository.ts's
  // assignClassSubjectTeacher already uses for class_subjects, including
  // its close-before-insert ordering (a failure between the two leaves the
  // learner with NO current enrollment rather than two, and the partial
  // unique index rejects two regardless).
  //
  // Behavioural change, and a deliberate one: the OLD upsert overwrote
  // class_id on the same row when a caller re-enrolled a learner into a
  // different class — silently destroying the fact they were ever in the
  // previous class. This now closes the old row and inserts a new one, so
  // EVERY re-enrollment (not just the new moveLearnerToClass operation)
  // preserves history. Re-enrolling into the SAME class stays a true no-op
  // — no new row, same as before.
  async upsertEnrollment(
    input: EnrollLearnerInput & { school_id: string }
  ): Promise<LearnerEnrollment> {
    const current = await this.findCurrentEnrollment(input.learner_id, input.term_id)
    if (current && current.class_id === input.class_id) return current

    if (current) {
      await this.closeEnrollment(current.id, new Date().toISOString())
    }

    const { data, error } = await this.db
      .from('learner_enrollments')
      .insert({
        school_id:        input.school_id,
        learner_id:       input.learner_id,
        class_id:         input.class_id,
        term_id:          input.term_id,
        academic_year_id: input.academic_year_id,
        enrollment_date:  new Date().toISOString().split('T')[0],
        status:           'active',
      })
      .select(ENROLLMENT_COLS)
      .single()
    if (error) throw new Error(`enrollLearner: ${error.message}`)
    return data
  }

  // Phase 4 — scoped to the CURRENT row only (`ended_at IS NULL`). Before
  // `ended_at` existed there was at most one row per (learner_id, term_id)
  // to touch; now a learner who was moved earlier this term also has a
  // closed historical row for the same (learner_id, term_id) — without this
  // scope, withdrawing them would incorrectly relabel that historical row
  // 'withdrawn' too. Also sets ended_at, since a withdrawn/transferred row
  // is no longer the learner's current placement either.
  async updateEnrollmentStatus(
    learnerId: string,
    termId: string,
    status: string
  ): Promise<void> {
    const { error } = await this.db
      .from('learner_enrollments')
      .update({ status, ended_at: new Date().toISOString() })
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
      .is('ended_at', null)
    if (error) throw new Error(`updateEnrollmentStatus: ${error.message}`)
  }

  // Phase 4 — scoped to CURRENT rows only (`ended_at IS NULL`), so a
  // transfer-out cannot flip the status of a row a class-move already
  // closed. Before `ended_at` existed, a moved learner's superseded row
  // would have been mistakenly relabelled 'withdrawn'/'transferred' even
  // though it was never actually withdrawn — it was simply superseded.
  async withdrawActiveEnrollments(learnerId: string, status: string): Promise<void> {
    const { error } = await this.db
      .from('learner_enrollments')
      .update({ status, ended_at: new Date().toISOString() })
      .eq('learner_id', learnerId)
      .eq('status', 'active')
      .is('ended_at', null)
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
      .is('ended_at', null)
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
      .is('ended_at', null)
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
      .is('ended_at', null)
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
      .is('ended_at', null)
    if (error) throw new Error(`getClassRoster: ${error.message}`)
    return (data ?? []) as { learners: unknown }[]
  }

  // Phase 4 — the CURRENT enrollment for one learner in one term (status
  // 'active' AND ended_at NULL), or null if none. The read half of the
  // find-current/close/insert sequence upsertEnrollment/moveLearnerToClass
  // both use instead of a native upsert (see upsertEnrollment's own
  // comment for why a native upsert stopped being possible).
  async findCurrentEnrollment(learnerId: string, termId: string): Promise<LearnerEnrollment | null> {
    const { data, error } = await this.db
      .from('learner_enrollments')
      .select(ENROLLMENT_COLS)
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
      .eq('status', 'active')
      .is('ended_at', null)
      .maybeSingle()
    if (error) throw new Error(`findCurrentEnrollment: ${error.message}`)
    return data
  }

  // Closes a placement (sets ended_at) without touching status — the
  // learner was not withdrawn or transferred, their placement was simply
  // superseded by a later one. See the ended_at column comment in
  // 20260814173242_learner_enrollments_current_history.sql.
  async closeEnrollment(id: string, endedAt: string): Promise<void> {
    const { error } = await this.db
      .from('learner_enrollments')
      .update({ ended_at: endedAt })
      .eq('id', id)
      .is('ended_at', null) // never re-close an already-closed row
    if (error) throw new Error(`closeEnrollment: ${error.message}`)
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

  async findTransferById(transferId: string): Promise<LearnerTransfer | null> {
    const { data, error } = await this.db
      .from('learner_transfers')
      .select(TRANSFER_COLS)
      .eq('id', transferId)
      .maybeSingle()
    if (error) throw new Error(`findTransferById: ${error.message}`)
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
