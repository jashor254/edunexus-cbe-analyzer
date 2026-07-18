// lib/core/learnerOnboarding.ts
//
// Sprint 9D — the Administration→Academics bridge: Admission → Enrollment
// → Class, in one orchestrated, idempotent pipeline, so a class teacher
// automatically sees a learner Administration enrolled — without the
// teacher ever creating a learner, class, or enrollment themselves.
//
// Canonical path determination (Part 1): Core's admitLearner()/
// enrollLearner() (lib/core/learners.ts) — already admin/staff-gated,
// already schema-correct (learners/learner_enrollments, both school_id-
// scoped with real FKs) — is the path this sprint builds on, not the
// legacy app/api/teacher/classes/[classId]/students/route.ts path. Sprint
// 6D's audit found that legacy path lets a class teacher write students +
// class_students in one indivisible request with no Administration/
// Academics separation at all — precisely the anti-pattern this sprint's
// "teachers must never create learners" instruction rules out. The legacy
// path is left exactly as it is (a real, pre-existing, out-of-scope
// architectural debt — deprecating it is a separate, larger decision, not
// this sprint's).
//
// Every step composes an *existing* lib/core/learners.ts function — no
// direct Supabase query was added inside this orchestrator itself.
// Idempotency mirrors lib/core/schoolActivation.ts's check-then-create
// idiom throughout, for the same reason: learners has a live
// UNIQUE(school_id, admission_number) constraint but learner_guardians has
// none, so guardian idempotency is enforced in application code, not the
// database — documented at the repository method, not assumed silently.

import { getLearner, getLearnerHistory, admitLearner, addGuardian, enrollLearner, getClassRoster } from '@/lib/core/learners'
import { repos } from '@/lib/repositories'
import type { Learner, LearnerGuardian, LearnerEnrollment, AdmitLearnerInput } from '@/types/core'

// ── Input / result shapes (mirrors schoolActivation.ts's step-result idiom) ─

export type LearnerOnboardingInput = Omit<AdmitLearnerInput, 'guardian'> & {
  guardian?: AdmitLearnerInput['guardian']
  class_id: string
  term_id: string
  academic_year_id: string
}

export type OnboardingStepName = 'learner' | 'guardian' | 'enrollment'
export type OnboardingStepStatus = 'created' | 'already_exists' | 'skipped' | 'failed'

export type OnboardingStepResult = {
  step: OnboardingStepName
  status: OnboardingStepStatus
  detail: string
}

export type LearnerOnboardingResult = {
  schoolId: string
  learnerId?: string
  status: 'complete' | 'failed'
  steps: OnboardingStepResult[]
  failedStep?: OnboardingStepName
  error?: string
}

// ── Individual, independently-testable pipeline steps ───────────────────────

export async function ensureLearnerAdmitted(
  schoolId: string,
  input: Omit<LearnerOnboardingInput, 'class_id' | 'term_id' | 'academic_year_id' | 'guardian'>
): Promise<{ result: OnboardingStepResult; learner: Learner }> {
  const existing = await repos.learners.findByAdmissionNumber(schoolId, input.admission_number)
  if (existing) {
    return {
      learner: existing,
      result: { step: 'learner', status: 'already_exists', detail: `Learner with admission number "${input.admission_number}" already exists.` },
    }
  }
  const created = await admitLearner(schoolId, { ...input, guardian: undefined })
  return {
    learner: created,
    result: { step: 'learner', status: 'created', detail: `Admitted learner "${created.first_name} ${created.last_name}" (${created.admission_number}).` },
  }
}

export async function ensureGuardianLinked(
  schoolId: string,
  learnerId: string,
  guardian?: NonNullable<AdmitLearnerInput['guardian']>
): Promise<{ result: OnboardingStepResult; guardian: LearnerGuardian | null }> {
  if (!guardian) {
    return { guardian: null, result: { step: 'guardian', status: 'skipped', detail: 'No guardian supplied — admission does not require one.' } }
  }
  const existing = await repos.learners.findGuardianByPhone(learnerId, guardian.phone)
  if (existing) {
    return { guardian: existing, result: { step: 'guardian', status: 'already_exists', detail: `Guardian with phone "${guardian.phone}" already linked.` } }
  }
  const created = await addGuardian(schoolId, learnerId, {
    user_id: null,
    relationship: guardian.relationship,
    full_name: guardian.full_name,
    phone: guardian.phone,
    email: guardian.email ?? null,
    national_id: guardian.national_id ?? null,
    is_primary: true,
    can_receive_reports: true,
  })
  return { guardian: created, result: { step: 'guardian', status: 'created', detail: `Linked guardian "${created.full_name}".` } }
}

export async function ensureEnrolled(
  schoolId: string,
  learnerId: string,
  classId: string,
  termId: string,
  academicYearId: string
): Promise<{ result: OnboardingStepResult; enrollment: LearnerEnrollment }> {
  // enrollLearner() already upserts on the live UNIQUE(learner_id, term_id)
  // constraint (lib/repositories/learner.repository.ts:170-191) — reused
  // as-is, not reimplemented. This single call also correctly handles "a
  // learner moved class during the same term": re-onboarding the same
  // learner+term with a different class_id updates the existing row's
  // class_id rather than creating a second enrollment (Part 7's "learner
  // moved during onboarding" case — proven directly in the test suite, not
  // just asserted here).
  const before = await repos.learners.findEnrollmentByClass(classId, termId)
  const wasAlreadyEnrolledHere = before.some(row => row.learner_id === learnerId)

  const enrollment = await enrollLearner({ school_id: schoolId, learner_id: learnerId, class_id: classId, term_id: termId, academic_year_id: academicYearId })

  return {
    enrollment,
    result: {
      step: 'enrollment',
      status: wasAlreadyEnrolledHere ? 'already_exists' : 'created',
      detail: wasAlreadyEnrolledHere
        ? 'Learner was already enrolled in this class for this term.'
        : 'Enrolled learner in class for this term.',
    },
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Runs the full Administration→Academics onboarding pipeline for one
 * learner: Admission → Guardian (optional) → Enrollment. Every step is
 * idempotent — safe to call repeatedly, including after a partial failure.
 * Stops at the first failing step; later steps are never attempted once
 * one fails (matches lib/core/schoolActivation.ts's failure contract
 * exactly, for the same reason: no cross-table transaction spans these
 * writes, so recovery is idempotent retry, not rollback).
 */
export async function onboardLearner(
  schoolId: string,
  input: LearnerOnboardingInput
): Promise<LearnerOnboardingResult> {
  const steps: OnboardingStepResult[] = []

  try {
    const { result: learnerResult, learner } = await ensureLearnerAdmitted(schoolId, input)
    steps.push(learnerResult)

    const { result: guardianResult } = await ensureGuardianLinked(schoolId, learner.id, input.guardian)
    steps.push(guardianResult)

    const { result: enrollmentResult } = await ensureEnrolled(schoolId, learner.id, input.class_id, input.term_id, input.academic_year_id)
    steps.push(enrollmentResult)

    return { schoolId, learnerId: learner.id, status: 'complete', steps }
  } catch (err) {
    const failedStep = (['learner', 'guardian', 'enrollment'] as const)[steps.length]
    const message = err instanceof Error ? err.message : String(err)
    if (failedStep) steps.push({ step: failedStep, status: 'failed', detail: message })
    return { schoolId, status: 'failed', steps, failedStep, error: message }
  }
}

// ── Readiness (Part 6 — read-only, never mutates) ────────────────────────────

export type LearnerReadiness = {
  enrolled: boolean
  classAssigned: boolean
  classId: string | null
  /** Proven by actually calling getClassRoster() (Part 5's exact "existing class query") and checking the learner appears — not inferred from the enrollment row alone. */
  visibleToTeacher: boolean
  /** True once enrolled (Sprint 9F) — lib/core/academicBridge.ts resolves the class_assessments.class_id/teacher_classes identity gap (docs/architecture/sprint-9a-phase2-school-activation-audit.md §3.1) transparently on first use. */
  eligibleForAssessment: boolean
  eligibleForAssessmentReason: string
  /** True once enrolled (Sprint 9F) — same bridge; Compass's existing lib/compass/ownership.ts resolves access via the bridged students.teacher_id link, unmodified. */
  eligibleForCompass: boolean
  eligibleForCompassReason: string
}

/**
 * Reports a learner's readiness for schoolId/termId. Creates nothing —
 * every field is read via an existing service function
 * (getLearnerHistory-backed getLearner / getClassRoster), never a new
 * write.
 *
 * eligibleForAssessment/eligibleForCompass (Sprint 9F): true once the
 * learner is enrolled — the structural blocker (class_assessments.class_id
 * requiring a legacy teacher_classes id; Evidence/Projection/Compass
 * requiring a legacy students.id) is closed by
 * lib/core/academicBridge.ts's identity bridge, invoked lazily the first
 * time an assessment is actually created against the learner's class (see
 * app/api/core/assessments/route.ts). This reports "the pipeline would
 * work if invoked," not "a bridge row already exists for this learner" —
 * consistent with how Sprint 9C's readyForAssessmentOwnership was already
 * computed (a capability check, not a has-this-specific-thing-already-
 * happened check). The bridge itself is explicitly temporary
 * infrastructure — see that module's header — not a permanent redesign of
 * Evidence/Projection/Compass, which remain completely unmodified.
 */
export async function getLearnerReadiness(
  learnerId: string,
  schoolId: string,
  termId: string
): Promise<LearnerReadiness> {
  // getLearner throws if the id doesn't exist at all — the correct
  // behavior for a readiness check on an unknown learner (distinct from
  // "exists but not yet enrolled", which is the normal not-found-enrollment
  // branch below).
  await getLearner(learnerId, schoolId)

  const history = await getLearnerHistory(learnerId, schoolId)
  const enrollment = history.learner_enrollments.find(e => e.term_id === termId && e.status === 'active')

  if (!enrollment) {
    return {
      enrolled: false,
      classAssigned: false,
      classId: null,
      visibleToTeacher: false,
      eligibleForAssessment: false,
      eligibleForAssessmentReason: 'Not enrolled for this term.',
      eligibleForCompass: false,
      eligibleForCompassReason: 'Not enrolled for this term.',
    }
  }

  const roster = await getClassRoster(enrollment.class_id, termId)
  const visibleToTeacher = roster.some(l => l.id === learnerId)

  return {
    enrolled: true,
    classAssigned: true,
    classId: enrollment.class_id,
    visibleToTeacher,
    eligibleForAssessment: true,
    eligibleForAssessmentReason:
      'Resolved via lib/core/academicBridge.ts (Sprint 9F) — class_assessments.class_id/learner_marks.student_id are bridged to legacy teacher_classes/students identities on first use, transparently, via app/api/core/assessments.',
    eligibleForCompass: true,
    eligibleForCompassReason:
      'Same bridge (Sprint 9F) — lib/compass/ownership.ts resolves access via the bridged students.teacher_id link, unmodified.',
  }
}
