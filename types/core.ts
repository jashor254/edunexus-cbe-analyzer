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
  class_name: string
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
