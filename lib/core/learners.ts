import { repos } from '@/lib/repositories'
import { createGuardianInvite } from '@/lib/core/guardianInvites'
import { getCurrentTerm } from '@/lib/core/school'
import { SchoolMismatchError, ValidationError } from '@/lib/core/errors'
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

// ── Admission ─────────────────────────────────────────────────────────────────

export async function admitLearner(
  schoolId: string,
  input: AdmitLearnerInput
): Promise<LearnerWithGuardians> {
  const learner = await repos.learners.insert(schoolId, input)

  if (!input.guardian) return { ...learner, learner_guardians: [] }

  const guardian = await repos.learners.insertGuardian(schoolId, learner.id, {
    user_id: null,
    relationship: input.guardian.relationship,
    full_name: input.guardian.full_name,
    phone: input.guardian.phone,
    email: input.guardian.email ?? null,
    national_id: input.guardian.national_id ?? null,
    is_primary: true,
    can_receive_reports: true,
  })

  // Sprint 12 Wave 3 (Critical 1) — same fix, same trigger point as
  // lib/core/learnerOnboarding.ts::ensureGuardianLinked (this is the
  // standalone AdmitSchema admission path, app/api/core/learners POST
  // without class_id — a second, real, reachable place a guardian row is
  // created with user_id hardcoded null). Fire-and-forget, non-blocking.
  createGuardianInvite(schoolId, guardian.id).catch(err =>
    console.error('[learners] createGuardianInvite failed:', err instanceof Error ? err.message : String(err))
  )

  return { ...learner, learner_guardians: [guardian] }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getLearner(learnerId: string, schoolId: string): Promise<LearnerWithGuardians> {
  return repos.learners.findById(learnerId, schoolId)
}

export async function listLearners(
  schoolId: string,
  filters?: { status?: LearnerStatus; classId?: string; termId?: string; search?: string }
): Promise<Learner[]> {
  if (filters?.classId && filters?.termId) {
    const rows = await repos.learners.findEnrollmentByClass(filters.classId, filters.termId)
    return rows.map((r) => r.learners as unknown as Learner)
  }

  return repos.learners.list(schoolId, { status: filters?.status, search: filters?.search })
}

export async function getLearnerHistory(
  learnerId: string,
  schoolId: string
): Promise<LearnerWithEnrollment> {
  return repos.learners.findWithHistory(learnerId, schoolId)
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateLearner(
  learnerId: string,
  schoolId: string,
  updates: Partial<Pick<Learner, 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth' | 'gender' | 'upi' | 'photo_url' | 'county_of_origin' | 'special_needs' | 'status' | 'notes' | 'graduation_date'>>
): Promise<Learner> {
  return repos.learners.update(learnerId, schoolId, updates)
}

export async function archiveLearner(learnerId: string, schoolId: string): Promise<void> {
  return repos.learners.updateStatus(learnerId, schoolId, 'archived')
}

// ── Guardians ─────────────────────────────────────────────────────────────────

export async function addGuardian(
  schoolId: string,
  learnerId: string,
  input: Omit<LearnerGuardian, 'id' | 'school_id' | 'learner_id' | 'created_at' | 'updated_at'>
): Promise<LearnerGuardian> {
  return repos.learners.insertGuardian(schoolId, learnerId, input)
}

// ── Enrollments ───────────────────────────────────────────────────────────────

// Phase 4 (Task D — closing F1). Before this, the API route verified only
// that the CALLER had a staff role at `school_id` — neither `learner_id`
// nor `class_id`/`term_id` were checked against that school at all, and
// Core repositories run on the service client (no RLS backstop). A staff
// member supplying a foreign learner_id/class_id/term_id could write an
// enrollment row spanning two schools. Same scoping shape Phase 1 added to
// assignSubjectTeacher for class_subjects.
export async function enrollLearner(input: EnrollLearnerInput & { school_id: string }): Promise<LearnerEnrollment> {
  try {
    await repos.learners.findById(input.learner_id, input.school_id)
  } catch {
    throw new SchoolMismatchError('This learner does not belong to your school.')
  }
  try {
    await repos.teachers.findClassById(input.class_id, input.school_id)
  } catch {
    throw new SchoolMismatchError('This class does not belong to your school.')
  }
  const term = await repos.schools.findTermById(input.term_id, input.school_id)
  if (!term) throw new SchoolMismatchError('This term does not belong to your school.')

  return repos.learners.upsertEnrollment(input)
}

// Phase 4 (Task E — closing F2). Before this, `schoolId`/`termId` were read
// straight off the request body with no Zod schema and no verification
// that the target learner actually belonged to the caller's school — only
// the caller's OWN admin membership at `schoolId` was checked.
export async function withdrawLearner(learnerId: string, schoolId: string, termId: string): Promise<void> {
  try {
    await repos.learners.findById(learnerId, schoolId)
  } catch {
    throw new SchoolMismatchError('This learner does not belong to your school.')
  }
  return repos.learners.updateEnrollmentStatus(learnerId, termId, 'withdrawn')
}

export async function getClassRoster(classId: string, termId: string): Promise<Learner[]> {
  const rows = await repos.learners.findClassRoster(classId, termId)
  return rows.map((r) => r.learners as unknown as Learner)
}

// Phase 4 (Task C — term rollover). Carries the CURRENT roster of one
// class forward into a new term, unchanged, unless a lifecycle event
// (withdrawal, transfer, a mid-term move already recorded) already
// excluded them — getClassRoster/findClassRoster already filter to
// status='active' AND ended_at IS NULL, so withdrawn/transferred/moved-
// away learners are correctly never included here without any extra
// filtering in this function.
//
// Same-class carry-forward only, scoped to fromTermId -> toTermId within
// ONE class — runEndOfTerm (lib/core/endOfTerm.ts) already operates
// per-class, so this composes correctly across a school's classes without
// this function needing to know about any of the others. Does not cross
// an academic-year boundary specially (that remains runAnnualPromotion's
// job, lib/core/promotions.ts, untouched) — if nextTerm happens to belong
// to a new academic_year_id, this still just re-enrolls the same learners
// into the same classId for that term, exactly matching runEndOfTerm's
// own pre-existing (unmodified) behavior of not branching on year
// boundaries. A named limitation, not a new gap introduced here.
//
// Idempotent via upsertEnrollments' own idempotency: re-running rolls the
// SAME learners into the SAME class again, which is a true no-op (no new
// row) for every learner already rolled forward.
export async function rollEnrollmentsToTerm(
  schoolId: string,
  classId: string,
  fromTermId: string,
  toTermId: string,
  toAcademicYearId: string
): Promise<number> {
  const roster = await getClassRoster(classId, fromTermId)
  if (roster.length === 0) return 0

  return repos.learners.upsertEnrollments(
    roster.map(learner => ({
      school_id:        schoolId,
      learner_id:       learner.id,
      class_id:         classId,
      term_id:          toTermId,
      academic_year_id: toAcademicYearId,
    }))
  )
}

// Phase 4 ("The Term Turns and the Learner Moves") — the ONE canonical
// class-move operation. Deliberately not a thin wrapper over
// repos.learners.upsertEnrollment(): raw enrollment-write semantics are not
// exposed as "move learner" — this adds the scoping checks and the
// no-silent-reactivation guard a caller must not skip.
//
// Always operates on the school's CURRENT term (server-derived via
// getCurrentTerm, never a client-supplied termId) — moving a learner in a
// past or future term is not a scenario this operation supports; that
// would be a different, larger feature.
//
// Phase 5 (legacy roster convergence) — returns `previousClassId` so the
// caller can converge the legacy class_students roster afterward
// (removeStaleLegacyRosterMembership, lib/core/academicBridge.ts). Not
// called from inside this function: academicBridge.ts already imports
// getLearner from this file, so importing it back here would create a
// module cycle. Composed at the route instead (app/api/core/learners/[id]/
// route.ts's 'move' action) — still one principal click, one HTTP request;
// only the internal composition is two calls, not the user-facing action.
export async function moveLearnerToClass(
  schoolId: string,
  learnerId: string,
  destinationClassId: string
): Promise<{ moved: boolean; enrollment: LearnerEnrollment; previousClassId: string | null }> {
  // Learner must belong to this school — findById is already scoped
  // (eq id + eq school_id) and throws on a cross-school id, same shape
  // Phase 1's assignSubjectTeacher uses for classId/teacherId.
  try {
    await repos.learners.findById(learnerId, schoolId)
  } catch {
    throw new SchoolMismatchError('This learner does not belong to your school.')
  }

  // Destination class must belong to this school.
  try {
    await repos.teachers.findClassById(destinationClassId, schoolId)
  } catch {
    throw new SchoolMismatchError('This class does not belong to your school.')
  }

  const currentTerm = await getCurrentTerm(schoolId)
  if (!currentTerm) {
    throw new ValidationError('This school has no current term set — set one before moving learners.')
  }

  // No silent reactivation: a learner who was withdrawn/transferred, or
  // was never enrolled this term, has no CURRENT row to move FROM. Moving
  // them would otherwise just insert a brand-new active enrollment —
  // indistinguishable from re-admitting a departed learner without going
  // through the admission/transfer-back flow that decision deserves.
  const current = await repos.learners.findCurrentEnrollment(learnerId, currentTerm.id)
  if (!current) {
    throw new ValidationError('This learner has no current class enrollment this term — enroll them first instead of moving them.')
  }

  if (current.class_id === destinationClassId) {
    return { moved: false, enrollment: current, previousClassId: null } // same class — idempotent no-op, no new history row
  }

  const previousClassId = current.class_id

  const enrollment = await repos.learners.upsertEnrollment({
    school_id:        schoolId,
    learner_id:       learnerId,
    class_id:         destinationClassId,
    term_id:          currentTerm.id,
    academic_year_id: currentTerm.academic_year_id,
  })

  return { moved: true, enrollment, previousClassId }
}
