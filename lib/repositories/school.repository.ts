import { BaseRepository } from './base'
import type { School, SchoolUser, SchoolUserRole, SchoolSettings, AcademicYear, Term, SchoolReportCard, ReportCardWithSubjects, CbcLevel, SchoolEntitlementStatus, SchoolPayment, SchoolPaymentMethod } from '@/types/core'
import type {
  SchoolIntelligenceSummary,
  StrandHealthRecord,
  GradeHealthRecord,
  InterventionEfficacyRecord,
  TeacherActivitySignal,
} from '@/lib/school/types'

const SCHOOL_COLS =
  'id, school_name, nemis_code, school_type, county, sub_county, ward, address, contact_phone, contact_email, logo_url, motto, subscription_tier, is_active, school_entitlement_status, school_entitlement_expires_at, created_by, provisioning_source, created_at, updated_at'

const SCHOOL_USER_COLS =
  'id, school_id, user_id, role, is_active, invited_by, joined_at, created_at, updated_at'

const SETTINGS_COLS =
  'id, school_id, curriculum_type, cbc_levels, grade_boundaries, school_open_days, report_footer, intelligence_enabled, intelligence_enabled_at, sms_enabled, timezone, created_at, updated_at'

const ACADEMIC_YEAR_COLS =
  'id, school_id, name, start_date, end_date, is_current, created_at, updated_at'

const TERM_COLS =
  'id, school_id, academic_year_id, term_number, name, start_date, end_date, is_current, created_at, updated_at'

const SCHOOL_PAYMENT_COLS =
  'id, school_id, amount, payment_method, payment_reference, payment_date, coverage_start, coverage_end, confirmed_by, status, notes, created_at, updated_at'

const REPORT_COLS =
  'id, school_id, learner_id, term_id, class_id, overall_score, overall_cbc_level, position_in_class, total_learners, days_present, days_absent, class_teacher_comment, headteacher_comment, pdf_url, is_published, published_at, generated_at, created_at, updated_at'

/** One active teacher membership, with the entitlement state of the school it points at. */
export type SchoolEntitlementMembership = {
  schoolId:  string
  status:    SchoolEntitlementStatus
  expiresAt: string | null
}

export class SchoolRepository extends BaseRepository {
  // ── Schools ────────────────────────────────────────────────────────────────

  async findById(schoolId: string): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .select(SCHOOL_COLS)
      .eq('id', schoolId)
      .single()
    if (error) throw new Error(`getSchool: ${error.message}`)
    return data
  }

  async findByName(schoolName: string): Promise<School | null> {
    const { data, error } = await this.db
      .from('schools')
      .select(SCHOOL_COLS)
      .eq('school_name', schoolName)
      .maybeSingle()
    if (error) throw new Error(`findSchoolByName: ${error.message}`)
    return data
  }

  // Case/whitespace-insensitive lookup — used at teacher onboarding so
  // "Nairobi Academy" and "nairobi academy " resolve to the same school
  // instead of minting a duplicate. `.ilike` with no wildcards behaves as a
  // case-insensitive exact match.
  async findByNameCaseInsensitive(schoolName: string): Promise<School | null> {
    const { data, error } = await this.db
      .from('schools')
      .select(SCHOOL_COLS)
      .ilike('school_name', schoolName.trim().replace(/\s+/g, ' '))
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findSchoolByNameCaseInsensitive: ${error.message}`)
    return data
  }

  async update(
    schoolId: string,
    updates: Partial<Pick<School, 'school_name' | 'nemis_code' | 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'logo_url' | 'motto'>>
  ): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select(SCHOOL_COLS)
      .single()
    if (error) throw new Error(`updateSchool: ${error.message}`)
    return data
  }

  async create(
    input: Pick<School, 'school_name'> & Partial<Pick<School, 'school_type' | 'county' | 'sub_county' | 'ward' | 'address' | 'contact_phone' | 'contact_email' | 'nemis_code' | 'motto'>>,
    createdBy: string
  ): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .insert({ ...input, created_by: createdBy })
      .select(SCHOOL_COLS)
      .single()
    if (error) throw new Error(`createSchool: ${error.message}`)
    return data
  }

  // DR-06 (Phase 10 rehearsal finding) — a double-submitted "Create School"
  // request (a UI double-click, or a browser retry of a dropped response)
  // used to create a second, fully-activated school for the same person.
  // Scoped narrowly to a short window and the SAME name, deliberately: a
  // founder legitimately creating a second, differently-named institution
  // later must never be blocked by this — only the exact within-seconds
  // retry Phase 10 actually reproduced.
  async findRecentByCreatorAndName(createdBy: string, schoolName: string, withinMs = 120_000): Promise<School | null> {
    const since = new Date(Date.now() - withinMs).toISOString()
    const { data, error } = await this.db
      .from('schools')
      .select(SCHOOL_COLS)
      .eq('created_by', createdBy)
      .eq('school_name', schoolName)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findRecentByCreatorAndName: ${error.message}`)
    return data
  }

  // ── Institutional entitlement ──────────────────────────────────────────────

  // The one query behind school-covered teacher access: every active teacher
  // membership this user holds, with its school's entitlement state attached.
  //
  // Returns an ARRAY, and deliberately does not use .maybeSingle() the way
  // findSchoolUserByUserId does. The `school_users` unique key is
  // (school_id, user_id, role), so a second active teacher membership is
  // schema-legal even though all 581 live memberships are currently 1-per-user
  // — and .maybeSingle() would turn that data shape into a thrown error, i.e.
  // an HTTP 500 on a gated teacher route. Resolution picks the entitled school
  // (lib/core/schoolEntitlement.ts); it never fails merely because a teacher
  // has two rows.
  //
  // Only role='teacher' memberships confer teacher-tool coverage. A 'parent'
  // membership at an entitled school does not make that person a covered
  // teacher.
  async findActiveTeacherMembershipsWithEntitlement(
    userId: string
  ): Promise<SchoolEntitlementMembership[]> {
    const { data, error } = await this.db
      .from('school_users')
      .select('school_id, role, is_active, schools!inner (id, school_entitlement_status, school_entitlement_expires_at)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('role', 'teacher')
    if (error) throw new Error(`findActiveTeacherMembershipsWithEntitlement: ${error.message}`)

    return (data ?? []).map((row) => {
      const school = row.schools as unknown as {
        id: string
        school_entitlement_status: SchoolEntitlementStatus
        school_entitlement_expires_at: string | null
      }
      return {
        schoolId:  school.id,
        status:    school.school_entitlement_status,
        expiresAt: school.school_entitlement_expires_at,
      }
    })
  }

  // Sets institutional entitlement. Callable only from the platform-admin
  // service path — the DB trigger trg_guard_school_entitlement rejects this
  // write for the `authenticated` and `anon` roles regardless of what any
  // caller intends, so this method is safe to expose but useless to abuse.
  async setEntitlement(
    schoolId: string,
    status: SchoolEntitlementStatus,
    expiresAt: string | null
  ): Promise<School> {
    const { data, error } = await this.db
      .from('schools')
      .update({
        school_entitlement_status:     status,
        school_entitlement_expires_at: expiresAt,
      })
      .eq('id', schoolId)
      .select(SCHOOL_COLS)
      .single()
    if (error) throw new Error(`setSchoolEntitlement: ${error.message}`)
    return data
  }

  // ── School payments ────────────────────────────────────────────────────────

  // Records one confirmed institutional payment.
  //
  // Returns null (rather than throwing) when the unique identity
  // (school_id, payment_method, lower(trim(payment_reference))) already exists,
  // so the caller can distinguish a replay of the same payment from a genuine
  // failure. That distinction is the whole idempotency story — see
  // lib/core/schoolPayments.ts.
  async insertPayment(input: {
    school_id: string
    amount: number
    payment_method: SchoolPaymentMethod
    payment_reference: string
    payment_date: string
    coverage_start: string | null
    coverage_end: string
    confirmed_by: string
    notes: string | null
  }): Promise<SchoolPayment | null> {
    const { data, error } = await this.db
      .from('school_payments')
      .insert(input)
      .select(SCHOOL_PAYMENT_COLS)
      .single()

    // 23505 = unique_violation — this exact payment is already on record.
    if (error?.code === '23505') return null
    if (error) throw new Error(`insertSchoolPayment: ${error.message}`)
    return data
  }

  async findPaymentByIdentity(
    schoolId: string,
    paymentMethod: SchoolPaymentMethod,
    paymentReference: string
  ): Promise<SchoolPayment | null> {
    const { data, error } = await this.db
      .from('school_payments')
      .select(SCHOOL_PAYMENT_COLS)
      .eq('school_id', schoolId)
      .eq('payment_method', paymentMethod)
      // The unique index normalises with lower(btrim(...)); ilike with no
      // wildcards is the case-insensitive equality that matches it.
      .ilike('payment_reference', paymentReference.trim())
      .maybeSingle()
    if (error) throw new Error(`findSchoolPaymentByIdentity: ${error.message}`)
    return data
  }

  // How many people actually inherit coverage when this school is entitled.
  // Counts the same rows lib/core/schoolEntitlement.ts resolves against, so the
  // number the founder is shown is the number that is really covered.
  async countActiveTeachers(schoolId: string): Promise<number> {
    const { count, error } = await this.db
      .from('school_users')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true)
    if (error) throw new Error(`countActiveTeachers: ${error.message}`)
    return count ?? 0
  }

  async listPaymentsBySchool(schoolId: string): Promise<SchoolPayment[]> {
    const { data, error } = await this.db
      .from('school_payments')
      .select(SCHOOL_PAYMENT_COLS)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listSchoolPaymentsBySchool: ${error.message}`)
    return data ?? []
  }

  // ── School Users ───────────────────────────────────────────────────────────

  // Phase 1 self-serve onboarding, Task 4 — was `.maybeSingle()`, which
  // throws (surfacing as a 500, e.g. GET /api/core/my-membership) the moment
  // a user has more than one active membership. None of this function's
  // callers pass a schoolId — they're asking "what school is this person
  // in" with no context yet — unlike the properly schoolId-scoped
  // `getSchoolUser(userId, schoolId)` that every authorization check
  // (requireSchoolMembership/requireSchoolAdmin) already uses instead, which
  // is unaffected by this whole class of bug.
  //
  // Multiple active memberships per user are NOT prevented at creation
  // time, deliberately: app/admin/core-schools/new (the internal founder
  // onboarding tool, gated by ADMIN_EMAILS) reuses the same createSchool()
  // for every school it sets up, with the founder as creatorUserId each
  // time — the founder legitimately ends up school_admin of many schools.
  // Refusing a second active membership here would break that tool, not
  // just harden this one. So instead of preventing the state, this
  // degrades gracefully when it's encountered: pick the most recently
  // created active membership deterministically and log the rest, rather
  // than bricking the caller. This makes reality match what
  // app/api/core/my-membership/route.ts's own header comment already
  // claimed ("picks one membership if a user belongs to more than one
  // school... acceptable at current pilot scale") — that comment described
  // intended behavior the old `.maybeSingle()` implementation didn't
  // actually deliver.
  async findSchoolUserByUserId(userId: string): Promise<SchoolUser | null> {
    const { data, error } = await this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`findSchoolUserByUserId: ${error.message}`)
    if (!data || data.length === 0) return null
    if (data.length > 1) {
      console.error('[school.repository] findSchoolUserByUserId: user has multiple active school memberships — picking the most recently created', {
        userId,
        schoolIds: data.map(row => row.school_id),
      })
    }
    return data[0]
  }

  // Reverse of findSchoolUserByUserId — resolves the auth user_id from a
  // school_users.id (e.g. learner_promotions.processed_by, Sprint 12K's
  // graduation snapshot trigger needs the real auth.uid() for downstream
  // permission checks, not the school_users row id it's FK'd to).
  async findSchoolUserById(schoolUserId: string): Promise<SchoolUser | null> {
    const { data, error } = await this.db
      .from('school_users')
      .select(SCHOOL_USER_COLS)
      .eq('id', schoolUserId)
      .maybeSingle()
    if (error) throw new Error(`findSchoolUserById: ${error.message}`)
    return data
  }

  async addSchoolUser(schoolId: string, userId: string, role: SchoolUserRole): Promise<SchoolUser> {
    const { data, error } = await this.db
      .from('school_users')
      .insert({ school_id: schoolId, user_id: userId, role, joined_at: new Date().toISOString() })
      .select(SCHOOL_USER_COLS)
      .single()
    if (error) throw new Error(`addSchoolUser: ${error.message}`)
    return data
  }

  // ── School Settings ────────────────────────────────────────────────────────

  async findSettings(schoolId: string): Promise<SchoolSettings> {
    const { data, error } = await this.db
      .from('school_settings')
      .select(SETTINGS_COLS)
      .eq('school_id', schoolId)
      .single()
    if (error) throw new Error(`getSchoolSettings: ${error.message}`)
    return data
  }

  // Non-throwing counterpart to findSettings — needed by activation's
  // idempotency check (Sprint 9B), which must distinguish "no row yet" from
  // an actual query failure without relying on error-message sniffing.
  async findSettingsOrNull(schoolId: string): Promise<SchoolSettings | null> {
    const { data, error } = await this.db
      .from('school_settings')
      .select(SETTINGS_COLS)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findSettingsOrNull: ${error.message}`)
    return data
  }

  async upsertSettings(
    schoolId: string,
    settings: Partial<Omit<SchoolSettings, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
  ): Promise<SchoolSettings> {
    const { data, error } = await this.db
      .from('school_settings')
      .upsert({ school_id: schoolId, ...settings }, { onConflict: 'school_id' })
      .select(SETTINGS_COLS)
      .single()
    if (error) throw new Error(`upsertSchoolSettings: ${error.message}`)
    return data
  }

  async enableIntelligence(schoolId: string): Promise<void> {
    const { error } = await this.db
      .from('school_settings')
      .update({ intelligence_enabled: true, intelligence_enabled_at: new Date().toISOString() })
      .eq('school_id', schoolId)
    if (error) throw new Error(`enableIntelligence: ${error.message}`)
  }

  // ── Academic Years ─────────────────────────────────────────────────────────

  async listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
    const { data, error } = await this.db
      .from('academic_years')
      .select(ACADEMIC_YEAR_COLS)
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
    if (error) throw new Error(`listAcademicYears: ${error.message}`)
    return data
  }

  async insertAcademicYear(
    schoolId: string,
    input: Pick<AcademicYear, 'name' | 'start_date' | 'end_date'>
  ): Promise<AcademicYear> {
    const { data, error } = await this.db
      .from('academic_years')
      .insert({ school_id: schoolId, ...input })
      .select(ACADEMIC_YEAR_COLS)
      .single()
    if (error) throw new Error(`createAcademicYear: ${error.message}`)
    return data
  }

  async clearCurrentAcademicYear(schoolId: string): Promise<void> {
    await this.db
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', schoolId)
  }

  async setCurrentAcademicYear(schoolId: string, yearId: string): Promise<void> {
    const { error } = await this.db
      .from('academic_years')
      .update({ is_current: true })
      .eq('id', yearId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`setCurrentAcademicYear: ${error.message}`)
  }

  async findCurrentAcademicYear(schoolId: string): Promise<AcademicYear | null> {
    const { data } = await this.db
      .from('academic_years')
      .select(ACADEMIC_YEAR_COLS)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()
    return data
  }

  // ── Terms ──────────────────────────────────────────────────────────────────

  async listTerms(schoolId: string, academicYearId?: string): Promise<Term[]> {
    let query = this.db
      .from('terms')
      .select(TERM_COLS)
      .eq('school_id', schoolId)
      .order('term_number')
    if (academicYearId) query = query.eq('academic_year_id', academicYearId)
    const { data, error } = await query
    if (error) throw new Error(`listTerms: ${error.message}`)
    return data
  }

  async insertTerm(
    schoolId: string,
    input: Pick<Term, 'academic_year_id' | 'term_number' | 'name' | 'start_date' | 'end_date'>
  ): Promise<Term> {
    const { data, error } = await this.db
      .from('terms')
      .insert({ school_id: schoolId, ...input })
      .select(TERM_COLS)
      .single()
    if (error) throw new Error(`createTerm: ${error.message}`)
    return data
  }

  async clearCurrentTerm(schoolId: string): Promise<void> {
    await this.db
      .from('terms')
      .update({ is_current: false })
      .eq('school_id', schoolId)
  }

  async setCurrentTerm(schoolId: string, termId: string): Promise<void> {
    const { error } = await this.db
      .from('terms')
      .update({ is_current: true })
      .eq('id', termId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`setCurrentTerm: ${error.message}`)
  }

  async findCurrentTerm(schoolId: string): Promise<Term | null> {
    const { data } = await this.db
      .from('terms')
      .select(TERM_COLS)
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()
    return data
  }

  // Phase 4 (Task D — closing F1) — scoped existence check for a
  // client-supplied term_id, the same shape findClassById already provides
  // for classId. Returns null (not a throw) for "doesn't exist here" so
  // callers can produce a clean, typed rejection rather than a raw error.
  async findTermById(termId: string, schoolId: string): Promise<Term | null> {
    const { data } = await this.db
      .from('terms')
      .select(TERM_COLS)
      .eq('id', termId)
      .eq('school_id', schoolId)
      .maybeSingle()
    return data
  }

  // Batched counterpart to findCurrentTerm — one row per school instead of
  // a query per school (used by the report-card selector, which may span
  // several of a guardian's children across different schools).
  async findCurrentTermsForSchools(schoolIds: string[]): Promise<Term[]> {
    if (schoolIds.length === 0) return []
    const { data, error } = await this.db
      .from('terms')
      .select(TERM_COLS)
      .in('school_id', schoolIds)
      .eq('is_current', true)
    if (error) throw new Error(`findCurrentTermsForSchools: ${error.message}`)
    return data ?? []
  }

  // ── Report Cards ───────────────────────────────────────────────────────────

  async findActiveEnrollmentsByClass(
    classId: string,
    termId: string
  ): Promise<{ learner_id: string }[]> {
    const { data } = await this.db
      .from('learner_enrollments')
      .select('learner_id')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('status', 'active')
    return data ?? []
  }

  async findTermSubjectSummaries(
    classId: string,
    termId: string,
    learnerIds: string[]
  ): Promise<{ learner_id: string; weighted_score: number | null; cbc_level: string | null }[]> {
    const { data } = await this.db
      .from('term_subject_summaries')
      .select('learner_id, weighted_score, cbc_level')
      .eq('class_id', classId)
      .eq('term_id', termId)
      .in('learner_id', learnerIds)
    return data ?? []
  }

  async upsertReportCards(rows: {
    school_id: string
    learner_id: string
    term_id: string
    class_id: string
    // Sprint 12 Wave 1 (High 3) — nullable: a learner with no
    // term_subject_summaries at all gets null here, never a fabricated 0/BE.
    // Both columns were already nullable in the DB and in types/core.ts's
    // SchoolReportCard; only this repository's local insert-shape type was
    // narrower than reality.
    overall_score: number | null
    overall_cbc_level: CbcLevel | null
    position_in_class: number
    total_learners: number
    is_published: boolean
    generated_at: string
    // Sprint 12B (ADR-0004) — optional so any other existing caller of this
    // method is unaffected; generateReportCards now always supplies them,
    // computed fresh from Attendance at generation time (a snapshot,
    // matching overall_score/overall_cbc_level/position_in_class's
    // existing computed-at-generation, not computed-at-view, precedent).
    days_present?: number | null
    days_absent?: number | null
  }[]): Promise<void> {
    const { error } = await this.db
      .from('school_report_cards')
      .upsert(rows, { onConflict: 'learner_id,term_id' })
    if (error) throw new Error(`generateReportCards: ${error.message}`)
  }

  async updateReportCard(
    reportId: string,
    schoolId: string,
    updates: Pick<SchoolReportCard, 'class_teacher_comment' | 'headteacher_comment' | 'days_present' | 'days_absent'>
  ): Promise<SchoolReportCard> {
    const { data, error } = await this.db
      .from('school_report_cards')
      .update(updates)
      .eq('id', reportId)
      .eq('school_id', schoolId)
      .select(REPORT_COLS)
      .single()
    if (error) throw new Error(`updateReportCard: ${error.message}`)
    return data
  }

  async publishReportCards(
    schoolId: string,
    termId: string,
    classId?: string
  ): Promise<{ published: number; publishedCards: Array<{ id: string; learner_id: string }> }> {
    let query = this.db
      .from('school_report_cards')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('term_id', termId)
      .eq('is_published', false)
    if (classId) query = query.eq('class_id', classId)
    // `learner_id` added Sprint 12K — lets the caller trigger one Blueprint
    // Snapshot per published learner (ADR-0008 Part 3) without a second
    // query; purely additive to the existing select.
    const { data, error } = await query.select('id, learner_id')
    if (error) throw new Error(`publishReportCards: ${error.message}`)
    return { published: data?.length ?? 0, publishedCards: (data ?? []) as Array<{ id: string; learner_id: string }> }
  }

  // TD-014 (docs/engineering/implementation-log.md): term_subject_summaries
  // has no FK to school_report_cards — both merely share (learner_id, term_id)
  // — so PostgREST cannot embed one inside the other; the original single
  // `.select()` with a nested `term_subject_summaries (...)` always failed
  // with PGRST200, and the missing `error` destructure swallowed it, making
  // every call return null as if the report simply didn't exist. Fixed by
  // querying the two tables separately (each embed below — learners and
  // subjects — has a real FK) and joining in application code.
  async findReportCardWithSubjects(
    learnerId: string,
    termId: string
  ): Promise<ReportCardWithSubjects | null> {
    const { data: report, error: reportError } = await this.db
      .from('school_report_cards')
      .select(`
        ${REPORT_COLS},
        learners (id, first_name, middle_name, last_name, admission_number)
      `)
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
      .maybeSingle()
    if (reportError) throw new Error(`findReportCardWithSubjects: ${reportError.message}`)
    if (!report) return null

    const { data: summaries, error: summariesError } = await this.db
      .from('term_subject_summaries')
      .select(`
        id, subject_id, weighted_score, cbc_level, position_in_class, teacher_comment,
        subjects (id, name, code)
      `)
      .eq('learner_id', learnerId)
      .eq('term_id', termId)
    if (summariesError) throw new Error(`findReportCardWithSubjects: ${summariesError.message}`)

    return {
      ...report,
      term_subject_summaries: summaries ?? [],
    } as unknown as ReportCardWithSubjects
  }

  // Confirms `userId` is a registered guardian of `learnerId` — the only
  // existing auth bridge into Core for a parent account (Core's Learner type
  // itself has no user_id; see lib/compass/ownership.ts's note on Core
  // identity convergence being out of scope pre-Phase 11).
  async findGuardianLink(learnerId: string, userId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('learner_guardians')
      .select('id')
      .eq('learner_id', learnerId)
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  // All Core learners this parent account is a registered guardian for —
  // drives the report-card selector (app/(parent)/report-card).
  async listGuardianLearners(userId: string): Promise<Array<{
    learner_id: string
    school_id: string
    first_name: string
    last_name: string
  }>> {
    const { data, error } = await this.db
      .from('learner_guardians')
      .select('learner_id, learners (id, school_id, first_name, last_name)')
      .eq('user_id', userId)
    if (error) throw new Error(`listGuardianLearners: ${error.message}`)

    return (data ?? [])
      .map(row => {
        const learner = row.learners as unknown as { id: string; school_id: string; first_name: string; last_name: string } | null
        if (!learner) return null
        return {
          learner_id: learner.id,
          school_id:  learner.school_id,
          first_name: learner.first_name,
          last_name:  learner.last_name,
        }
      })
      .filter((r): r is { learner_id: string; school_id: string; first_name: string; last_name: string } => r !== null)
  }

  async listClassReportCards(classId: string, termId: string): Promise<SchoolReportCard[]> {
    const { data, error } = await this.db
      .from('school_report_cards')
      .select(REPORT_COLS)
      .eq('class_id', classId)
      .eq('term_id', termId)
      .order('position_in_class')
    if (error) throw new Error(`listClassReportCards: ${error.message}`)
    return data
  }

  async updateReportPdfUrl(reportId: string, pdfUrl: string): Promise<void> {
    const { error } = await this.db
      .from('school_report_cards')
      .update({ pdf_url: pdfUrl })
      .eq('id', reportId)
    if (error) throw new Error(`updatePdfUrl: ${error.message}`)
  }

  // ── Intelligence Snapshots ─────────────────────────────────────────────────

  async findLatestIntelligenceSnapshot(
    schoolId: string
  ): Promise<{ at_risk_count: number; critical_count: number; total_students: number } | null> {
    const { data } = await this.db
      .from('school_intelligence_snapshots')
      .select('at_risk_count, critical_count, total_students')
      .eq('school_id', schoolId)
      .is('grade', null)
      .is('subject', null)
      .order('week_of', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as { at_risk_count: number; critical_count: number; total_students: number } | null
  }

  async findPreviousIntelligenceSnapshot(
    schoolId: string
  ): Promise<{ at_risk_count: number; critical_count: number; total_students: number; top_struggling_substrands: unknown } | null> {
    const { data } = await this.db
      .from('school_intelligence_snapshots')
      .select('at_risk_count, critical_count, total_students, top_struggling_substrands')
      .eq('school_id', schoolId)
      .is('grade', null)
      .is('subject', null)
      .order('week_of', { ascending: false })
      .range(1, 2)
      .maybeSingle()
    return data as { at_risk_count: number; critical_count: number; total_students: number; top_struggling_substrands: unknown } | null
  }

  async upsertIntelligenceSnapshot(params: {
    school_id: string
    week_of: string
    grade: number | null
    subject: string | null
    total_students: number
    normal_count: number
    watch_count: number
    at_risk_count: number
    critical_count: number
    top_struggling_substrands: StrandHealthRecord[]
    interventions_run: number
    interventions_effective: number
    avg_capability_dimensions: Record<string, number>
    risk_trend: 'improving' | 'stable' | 'declining'
  }): Promise<void> {
    await this.db
      .from('school_intelligence_snapshots')
      .upsert(params, { onConflict: 'school_id,week_of,grade,subject', ignoreDuplicates: false })
  }

  // ── Intelligence: raw data reads ───────────────────────────────────────────

  // Resolves teacher membership via the Core School `school_users` table —
  // never via the legacy free-text `teachers.school_name` field. `schoolId`
  // here is a real `schools.id` UUID.
  async findTeacherUserIdsBySchoolId(schoolId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('school_users')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
    if (error) throw new Error(`findTeacherUserIdsBySchoolId: ${error.message}`)
    return (data ?? []).map(r => r.user_id as string)
  }

  // All teachers belonging to a school (no verification filter) — used where
  // the caller previously matched every teacher row on school_name regardless
  // of is_verified. `grade_levels`/`subjects` were previously selected here
  // but never read by any caller, and `subjects` isn't a real column on
  // `teachers` (the column is `subject`, singular) — dropped rather than
  // carrying forward an unused, incorrect field.
  // Sprint 4G (docs/engineering/sprint-4f-teacher-school-identity-audit.md,
  // docs/engineering/implementation-log.md): the reverse of
  // findTeacherUserIdsBySchoolId/findTeachersBySchoolId above — resolves a
  // legacy `teachers.id` to a Core `schools.id` via the same shared
  // `auth.users.id` identity space those two already use, just walked in
  // the other direction. Returns null for the common case (most legacy
  // teachers have never been bridged to a `school_users` row — see Sprint
  // 4F Part 1/4). A teacher active in more than one school (schema allows
  // it: `school_users` is UNIQUE(school_id, user_id, role), not unique on
  // user_id alone) resolves to whichever active membership sorts first —
  // not disambiguated further, since no caller needs that yet.
  async findSchoolIdByTeacherId(teacherId: string): Promise<string | null> {
    const { data: teacher, error: teacherErr } = await this.db
      .from('teachers')
      .select('user_id')
      .eq('id', teacherId)
      .maybeSingle()
    if (teacherErr) throw new Error(`findSchoolIdByTeacherId: ${teacherErr.message}`)
    if (!teacher?.user_id) return null

    const { data: schoolUsers, error: suErr } = await this.db
      .from('school_users')
      .select('school_id')
      .eq('user_id', teacher.user_id)
      .eq('is_active', true)
      .limit(1)
    if (suErr) throw new Error(`findSchoolIdByTeacherId: ${suErr.message}`)
    return schoolUsers?.[0]?.school_id ?? null
  }

  async findTeachersBySchoolId(
    schoolId: string
  ): Promise<{ id: string; user_id: string }[]> {
    const userIds = await this.findTeacherUserIdsBySchoolId(schoolId)
    if (userIds.length === 0) return []
    const { data, error } = await this.db
      .from('teachers')
      .select('id, user_id')
      .in('user_id', userIds)
    if (error) throw new Error(`findTeachersBySchoolId: ${error.message}`)
    return (data ?? []) as { id: string; user_id: string }[]
  }

  async findVerifiedTeachers(
    schoolId: string
  ): Promise<{ id: string; user_id: string }[]> {
    const userIds = await this.findTeacherUserIdsBySchoolId(schoolId)
    if (userIds.length === 0) return []
    const { data, error } = await this.db
      .from('teachers')
      .select('id, user_id')
      .in('user_id', userIds)
      .eq('is_verified', true)
    if (error) throw new Error(`findVerifiedTeachers: ${error.message}`)
    return (data ?? []) as { id: string; user_id: string }[]
  }

  async findTeacherClasses(
    teacherIds: string[]
  ): Promise<{ id: string; grade: unknown; subject: unknown; teacher_id: unknown }[]> {
    const { data } = await this.db
      .from('teacher_classes')
      .select('id, grade, subject, teacher_id')
      .in('teacher_id', teacherIds)
    return (data ?? []) as { id: string; grade: unknown; subject: unknown; teacher_id: unknown }[]
  }

  async findClassStudents(
    classIds: string[]
  ): Promise<{ student_id: string; class_id: string }[]> {
    const { data } = await this.db
      .from('class_students')
      .select('student_id, class_id')
      .in('class_id', classIds)
    return data ?? []
  }

  async findLearnerProfiles(
    studentIds: string[]
  ): Promise<{
    student_id: string
    overall_risk_level: unknown
    capability_dimensions: unknown
    risk_history: unknown
    knowledge_state: unknown
  }[]> {
    const { data } = await this.db
      .from('learner_profiles')
      .select('student_id, overall_risk_level, capability_dimensions, risk_history, knowledge_state')
      .in('student_id', studentIds)
    return (data ?? []) as {
      student_id: string
      overall_risk_level: unknown
      capability_dimensions: unknown
      risk_history: unknown
      knowledge_state: unknown
    }[]
  }

  async findTopStrugglingSubstrands(
    classIds: string[]
  ): Promise<{
    subject: unknown
    sub_strand: unknown
    strand: unknown
    struggle_count: unknown
    total_students: unknown
    assessment_level: unknown
    trend: unknown
    risk_score: unknown
  }[]> {
    const { data } = await this.db
      .from('substrand_health')
      .select('subject, sub_strand, strand, struggle_count, total_students, assessment_level, trend, risk_score')
      .in('class_id', classIds)
      .gt('risk_score', 30)
      .order('risk_score', { ascending: false })
      .limit(5)
    return (data ?? []) as {
      subject: unknown
      sub_strand: unknown
      strand: unknown
      struggle_count: unknown
      total_students: unknown
      assessment_level: unknown
      trend: unknown
      risk_score: unknown
    }[]
  }

  async findInterventions(
    teacherUserIds: string[]
  ): Promise<{ intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown; intervened_at?: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('intervention_type, was_effective, checkin_completed_at, intervened_at')
      .in('teacher_id', teacherUserIds)
      .not('checkin_completed_at', 'is', null)
    return (data ?? []) as { intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown; intervened_at?: unknown }[]
  }

  async findAllInterventions(
    teacherUserIds: string[]
  ): Promise<{ intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('intervention_type, was_effective, checkin_completed_at')
      .in('teacher_id', teacherUserIds)
    return (data ?? []) as { intervention_type: unknown; was_effective: unknown; checkin_completed_at: unknown }[]
  }

  async findTeacherInterventions(
    teacherUserId: string
  ): Promise<{ was_effective: unknown }[]> {
    const { data } = await this.db
      .from('intervention_log')
      .select('was_effective')
      .eq('teacher_id', teacherUserId)
      .not('checkin_completed_at', 'is', null)
    return (data ?? []) as { was_effective: unknown }[]
  }

  async countFormativeSignals(teacherId: string, termStart: string): Promise<number> {
    const { count } = await this.db
      .from('formative_signals')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .gte('recorded_at', termStart)
    return count ?? 0
  }

  async findEnrolledStudents(
    classId: string
  ): Promise<{ student_id: unknown }[]> {
    const { data } = await this.db
      .from('class_students')
      .select('student_id')
      .eq('class_id', classId)
    return (data ?? []) as { student_id: unknown }[]
  }

  async findLearnerRiskProfiles(
    studentIds: string[]
  ): Promise<{ overall_risk_level: unknown; risk_history: unknown }[]> {
    const { data } = await this.db
      .from('learner_profiles')
      .select('overall_risk_level, risk_history')
      .in('student_id', studentIds)
    return (data ?? []) as { overall_risk_level: unknown; risk_history: unknown }[]
  }
}
