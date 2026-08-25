// ─────────────────────────────────────────────────────────────────────────────
// EduNexus Core — TypeScript Types
// All types map 1:1 to the Core DB schema (20260629_core_foundation.sql)
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

// Matches the live `schools_school_type_check` DB constraint exactly
// (confirmed via direct query — the previous 'public_primary' etc. set here
// and in CreateSchoolSchema had never matched the database: every school
// ever created through the validated API path silently fell through to the
// column's own default, 'secondary', regardless of what was requested).
export type SchoolType = 'primary' | 'secondary' | 'mixed' | 'special'

export type SubscriptionTier = 'free' | 'standard' | 'premium'

export type CurriculumType = 'cbc' | '844' | 'igcse'

export type GradeCategory =
  | 'pre_primary'
  | 'lower_primary'
  | 'upper_primary'
  | 'junior_secondary'
  | 'senior_secondary'

export type SubjectCategory = 'pre_primary' | 'primary' | 'junior_secondary' | 'senior_secondary'

export type SchoolUserRole =
  | 'school_admin'
  | 'headteacher'
  | 'deputy_headteacher'
  | 'teacher'
  | 'parent'

// Institutional entitlement held by the SCHOOL, never by an individual teacher.
// Distinct from a teacher's personal Solo Teacher purchases and from a parent's
// Family subscription — see lib/core/schoolEntitlement.ts.
export type SchoolEntitlementStatus =
  | 'none'
  | 'active'
  | 'suspended'
  | 'expired'

// How a school actually sent the money. Institutional payments arrive outside
// EduNexus — there is no in-product collection — so this records the channel a
// human verified, not a provider integration.
export type SchoolPaymentMethod =
  | 'mpesa'
  | 'bank_transfer'
  | 'cheque'
  | 'cash'
  | 'other'

// Two statuses, both earned. There is no 'pending': a payment is recorded only
// after the founder has confirmed the money arrived, so it is never pending
// inside EduNexus.
export type SchoolPaymentStatus =
  | 'confirmed'
  | 'reversed'

/**
 * One institutional payment received from a school, confirmed by a platform
 * admin. Explains WHY a school holds entitlement — never consulted to decide
 * whether access is allowed now (that is `schools.school_entitlement_status`).
 */
export type SchoolPayment = {
  id: string
  school_id: string
  /** Whole Kenyan shillings. */
  amount: number
  payment_method: SchoolPaymentMethod
  /** M-PESA code, bank reference, or a deliberate one the founder assigned. */
  payment_reference: string
  /** The day the money moved — not the day it was recorded. */
  payment_date: string
  coverage_start: string | null
  coverage_end: string
  /** The `growth_users` id of the admin who verified the payment. */
  confirmed_by: string
  status: SchoolPaymentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type LearnerStatus =
  | 'active'
  | 'transferred'
  | 'graduated'
  | 'archived'
  | 'deceased'

export type Gender = 'male' | 'female' | 'other'

export type GuardianRelationship =
  | 'father'
  | 'mother'
  | 'guardian'
  | 'grandparent'
  | 'sibling'
  | 'other'

export type EnrollmentStatus = 'active' | 'withdrawn' | 'transferred'

export type PromotionType = 'promoted' | 'repeated' | 'graduated'

export type TransferDirection = 'in' | 'out'

// ── Durable learner identity (Phase 2D) ─────────────────────────────────────

/** Allowed provenance reasons for a `learner_identity_links` row — no others (Phase 2D Step 1). */
export type LearnerIdentityLinkageReason = 'admission_default' | 'transfer_token' | 'admin_correction'

export type CbcLevel = 'EE' | 'ME' | 'AE' | 'BE'

export type GradingType = 'marks' | 'cbc_level' | 'both'

export type AssessmentType =
  | 'formative'
  | 'summative'
  | 'end_of_term'
  | 'project'
  | 'observation'

// ── Core Entities ─────────────────────────────────────────────────────────────

export type School = {
  id: string
  school_name: string
  nemis_code: string
  school_type: SchoolType
  county: string
  sub_county: string | null
  ward: string | null
  address: string | null
  contact_phone: string | null
  contact_email: string | null
  logo_url: string | null
  motto: string | null
  subscription_tier: SubscriptionTier
  is_active: boolean
  /** Institutional EduNexus entitlement. Active teachers inherit school-covered access through `school_users` while this is 'active' and unexpired. Mutable only through the platform-admin service path (DB trigger `trg_guard_school_entitlement`), never by the school itself. */
  school_entitlement_status: SchoolEntitlementStatus
  /** When institutional coverage lapses. Null means open-ended. */
  school_entitlement_expires_at: string | null
  created_by: string | null
  /** Provenance tag for how this school came to exist — e.g. 'teacher_first_write_auto_provision' (lib/core/institutionOwnership.ts). Null for every normally-created school. */
  provisioning_source: string | null
  created_at: string
  updated_at: string
}

export type AcademicYear = {
  id: string
  school_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
  updated_at: string
}

export type Term = {
  id: string
  school_id: string
  academic_year_id: string
  term_number: 1 | 2 | 3
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
  updated_at: string
}

export type SchoolSettings = {
  id: string
  school_id: string
  curriculum_type: CurriculumType
  cbc_levels: string[]
  grade_boundaries: Record<string, { min: number }>
  school_open_days: number
  report_footer: string | null
  intelligence_enabled: boolean
  intelligence_enabled_at: string | null
  sms_enabled: boolean
  timezone: string
  created_at: string
  updated_at: string
}

export type Grade = {
  id: string
  name: string
  code: string
  level_order: number
  category: GradeCategory
  created_at: string
  updated_at: string
}

export type Stream = {
  id: string
  school_id: string
  name: string
  created_at: string
  updated_at: string
}

export type SchoolUser = {
  id: string
  school_id: string
  user_id: string
  role: SchoolUserRole
  is_active: boolean
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

export type Subject = {
  id: string
  name: string
  code: string
  category: SubjectCategory
  is_core: boolean
  created_at: string
  updated_at: string
}

export type GradeSubject = {
  id: string
  school_id: string
  grade_id: string
  subject_id: string
  is_compulsory: boolean
  created_at: string
  updated_at: string
}

export type ClassSubject = {
  id: string
  school_id: string
  class_id: string
  subject_id: string
  teacher_id: string
  created_at: string
  updated_at: string
}

export type Learner = {
  id: string
  school_id: string
  admission_number: string
  upi: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string | null
  gender: Gender | null
  photo_url: string | null
  nationality: string
  county_of_origin: string | null
  special_needs: string[]
  status: LearnerStatus
  admission_date: string
  graduation_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LearnerGuardian = {
  id: string
  school_id: string
  learner_id: string
  user_id: string | null
  relationship: GuardianRelationship
  full_name: string
  phone: string
  email: string | null
  national_id: string | null
  is_primary: boolean
  can_receive_reports: boolean
  created_at: string
  updated_at: string
}

export type LearnerEnrollment = {
  id: string
  school_id: string
  learner_id: string
  class_id: string
  term_id: string
  academic_year_id: string
  enrollment_date: string
  status: EnrollmentStatus
  /** Phase 4 — NULL = this row is the learner's CURRENT placement for this term. Non-null = superseded by a later placement (a class move), closed at this instant. Independent of `status`. */
  ended_at: string | null
  created_at: string
  updated_at: string
}

export type LearnerPromotion = {
  id: string
  school_id: string
  learner_id: string
  from_class_id: string
  to_class_id: string | null
  from_academic_year_id: string
  to_academic_year_id: string | null
  promotion_type: PromotionType
  processed_by: string
  notes: string | null
  promoted_at: string
  created_at: string
  updated_at: string
}

export type LearnerTransfer = {
  id: string
  learner_id: string
  from_school_id: string
  to_school_id: string | null
  to_school_name: string | null
  direction: TransferDirection
  transfer_date: string
  reason: string | null
  document_urls: string[]
  processed_by: string
  created_at: string
  updated_at: string
}

export type TermSubjectSummary = {
  id: string
  school_id: string
  learner_id: string
  term_id: string
  class_id: string
  subject_id: string
  weighted_score: number | null
  cbc_level: CbcLevel | null
  position_in_class: number | null
  teacher_comment: string | null
  computed_at: string
  created_at: string
  updated_at: string
}

// Phase P5.5 (docs/architecture/parent-portal-p5-5-report-card-snapshot-integrity.md):
// the per-subject breakdown a published report card shows a parent, frozen
// at the exact moment of publish — the same "computed once, stored,
// never recomputed on view" precedent overall_score/overall_cbc_level
// already use, extended to the subject list. Deliberately narrow: subject
// identity is whatever term_subject_summaries already resolved (subject_id
// + the canonical subjects.name/code join), not a new taxonomy.
export type ReportCardSubjectSnapshotEntry = {
  subject_id: string
  subject_name: string
  subject_code: string
  weighted_score: number | null
  cbc_level: CbcLevel | null
  position_in_class: number | null
  teacher_comment: string | null
}

export type SchoolReportCard = {
  id: string
  school_id: string
  learner_id: string
  term_id: string
  class_id: string
  overall_score: number | null
  overall_cbc_level: CbcLevel | null
  position_in_class: number | null
  total_learners: number | null
  days_present: number | null
  days_absent: number | null
  class_teacher_comment: string | null
  headteacher_comment: string | null
  pdf_url: string | null
  is_published: boolean
  published_at: string | null
  generated_at: string | null
  // NULL for a still-draft card (intentionally live, see getReportCard/
  // findReportCardWithSubjects) and for a card published before Phase P5.5
  // (historical drift for those rows is a named, accepted limitation — see
  // the P5.5 doc). Populated once, at publish time, for every card
  // published from P5.5 onward; never rewritten after that.
  subject_snapshot: ReportCardSubjectSnapshotEntry[] | null
  created_at: string
  updated_at: string
}

// ── Rich joined types (for UI) ────────────────────────────────────────────────

export type LearnerWithGuardians = Learner & {
  learner_guardians: LearnerGuardian[]
}

export type LearnerWithEnrollment = Learner & {
  learner_enrollments: Array<LearnerEnrollment & {
    classes: { id: string; display_name: string; grade_id: string }
  }>
}

export type ClassWithDetails = {
  id: string
  school_id: string
  /**
   * Nullable in the database, and genuinely NULL for schools activated through
   * activateSchool(), which writes the label to `display_name` only. Read a
   * human-readable name as `display_name ?? class_name` — the precedence
   * academicBridge, termStatus and {@link TeachingAssignment} already use —
   * and never assume either column alone is present.
   */
  class_name: string | null
  display_name: string | null
  grade_id: string | null
  stream_id: string | null
  class_teacher_id: string | null
  academic_year_id: string | null
  capacity: number | null
  created_at: string
  updated_at: string
  grades: Pick<Grade, 'id' | 'name' | 'code' | 'category'> | null
  streams: Pick<Stream, 'id' | 'name'> | null
}

export type ReportCardWithSubjects = SchoolReportCard & {
  term_subject_summaries: Array<TermSubjectSummary & {
    subjects: Pick<Subject, 'id' | 'name' | 'code'>
  }>
  learners: Pick<Learner, 'id' | 'first_name' | 'middle_name' | 'last_name' | 'admission_number'>
}

// ── API request/response shapes ───────────────────────────────────────────────

export type AdmitLearnerInput = {
  admission_number: string
  first_name: string
  middle_name?: string
  last_name: string
  date_of_birth?: string
  gender?: Gender
  upi?: string
  county_of_origin?: string
  special_needs?: string[]
  notes?: string
  // Optional as of Sprint 9D — admission and guardian-linking are
  // independently idempotent steps in lib/core/learnerOnboarding.ts's
  // pipeline ("Parents (optional)"). Every pre-existing caller (the
  // app/api/core/learners POST route's Zod schema, the reference-school
  // seed script) still always supplies one — this widening is additive,
  // not a behavior change for them.
  guardian?: {
    full_name: string
    phone: string
    relationship: GuardianRelationship
    email?: string
    national_id?: string
  }
}

export type EnrollLearnerInput = {
  learner_id: string
  class_id: string
  term_id: string
  academic_year_id: string
}

export type RunPromotionInput = {
  academic_year_id: string
  decisions: Array<{
    learner_id: string
    promotion_type: PromotionType
    to_class_id?: string
    to_academic_year_id?: string
    notes?: string
  }>
}

export type TransferLearnerInput = {
  learner_id: string
  direction: TransferDirection
  transfer_date: string
  to_school_id?: string
  to_school_name?: string
  reason?: string
  document_urls?: string[]
}

// ── Durable learner identity (Phase 2D) ─────────────────────────────────────

/** `learner_identities` — minimal, PII-free durable identity that survives inter-school transfer. */
export type LearnerIdentity = {
  id: string
  created_at: string
  updated_at: string
}

/** `learner_identity_links` — audit trail of which durable identity a school-owned `learners` row points to, and why. Supersede-never-edit. */
export type LearnerIdentityLink = {
  id: string
  learner_id: string
  learner_identity_id: string
  linked_by: string | null
  linked_at: string
  linkage_reason: LearnerIdentityLinkageReason
  transfer_id: string | null
  superseded_at: string | null
  superseded_by_link_id: string | null
  created_at: string
  updated_at: string
}

/** `learner_transfer_tokens` — single-use transfer-continuity handshake. `token_hash` only; the raw token is never persisted. */
export type LearnerTransferToken = {
  id: string
  transfer_id: string
  token_hash: string
  expires_at: string
  consumed_at: string | null
  consumed_by_learner_id: string | null
  created_at: string
  updated_at: string
}

/**
 * `transferLearner`'s return shape — a superset of `LearnerTransfer` (Phase
 * 2D, additive, does not change existing callers' behavior). For
 * `direction: 'out'`, also carries the one-time raw transfer-continuity
 * token (Step 7) — never persisted anywhere, returned exactly once through
 * this call. `direction: 'in'` transfers (this route's historical-record
 * path, distinct from token-based admission continuity) carry neither.
 */
export type TransferLearnerResult = LearnerTransfer & {
  transferToken?: string
  transferTokenExpiresAt?: string
}

export type TransferInConsumptionResult =
  | { status: 'consumed'; learnerIdentityId: string; sourceLearnerId: string; fromSchoolId: string; transferId: string }
  | { status: 'invalid' | 'expired' | 'already_consumed' | 'wrong_school' }

// ── Learner account foundation (Phase 2B-RESUME) ────────────────────────────

export type LearnerAccountStatus = 'active' | 'suspended'

/**
 * `learner_accounts` — the authenticated learner identity anchor.
 * `learner_identity_id` (Phase 2D's durable identity), not `learners.id`,
 * is the binding — the account survives inter-school transfer because the
 * durable identity does. Deliberately carries no school_id, no current
 * learners.id, no token, no password.
 */
export type LearnerAccount = {
  id: string
  learner_identity_id: string
  user_id: string
  status: LearnerAccountStatus
  activated_at: string
  suspended_at: string | null
  created_at: string
  updated_at: string
}

export type LearnerAccountInvitePurpose = 'activation' | 'recovery'

/** `learner_account_invites` — ephemeral school-issued authorization to activate (or recover) a learner account. `token_hash` only; the raw token is never persisted. */
export type LearnerAccountInvite = {
  id: string
  learner_identity_id: string
  school_id: string
  token_hash: string
  purpose: LearnerAccountInvitePurpose
  expires_at: string
  used_at: string | null
  issued_by: string | null
  created_at: string
  updated_at: string
}

export type IssueLearnerAccountActivationResult =
  | { status: 'issued'; inviteId: string; token: string; expiresAt: string }
  | { status: 'already_active' }

/** Session tokens minted by the auth bootstrap (Step 7/8) — handed back exactly once so the caller (API route) can establish the browser session; never persisted. */
export type LearnerAccountSession = {
  accessToken: string
  refreshToken: string
}

export type ClaimLearnerAccountActivationResult =
  | { status: 'claimed'; learnerAccountId: string; learnerIdentityId: string; session: LearnerAccountSession }
  | { status: 'invalid' | 'expired' | 'already_used' | 'already_active' | 'user_already_bound' }

// ── Institutional teaching assignment ────────────────────────────────────────

/**
 * One row of "what this teacher has been assigned to teach, by their school."
 *
 * The projection of the canonical assignment chain:
 *
 *     auth user
 *       → school_users (role='teacher', is_active=true)
 *       → class_subjects.teacher_id = school_users.id
 *       → classes + subjects + schools
 *
 * `teacherMembershipId` is a `school_users.id`, NOT a `teachers.id` and NOT an
 * `auth.users.id`. Those are three different id spaces in this codebase and
 * `class_subjects` deliberately keys on the membership: an assignment belongs
 * to an employment relationship, not to a person, so it ends when the
 * employment does. Never pass a `teachers.id` here.
 */
export type TeachingAssignment = {
  /** `class_subjects.id` — the assignment row itself. */
  assignmentId: string
  schoolId: string
  schoolName: string
  classId: string
  /** `classes.display_name` when set, else `class_name` — what the school calls this class. */
  className: string
  /** Null for a school that models no streams; a single-stream school is a valid shape, not a degraded one. */
  gradeName: string | null
  gradeCode: string | null
  streamName: string | null
  academicYearId: string | null
  subjectId: string
  subjectName: string
  subjectCode: string
  /** `school_users.id` of the membership this assignment was made to. */
  teacherMembershipId: string
}
