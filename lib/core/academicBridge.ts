// lib/core/academicBridge.ts
//
// Sprint 9F — the identity bridge that lets a Core-onboarded class/learner
// (Sprint 9B/9D) reach the existing, unmodified legacy Assessment → Evidence
// → Projection → Compass pipeline, which is keyed entirely to
// `teacher_classes.id` / `students.id` (confirmed live this session:
// `class_assessments.class_id → teacher_classes`, `learner_marks.student_id`
// filters Evidence, `learner_evidence.learner_id → students`,
// `lib/compass/ownership.ts` reads `students.teacher_id`/`class_students`
// exclusively). ADR-0002's Teacher identity question is already closed —
// Sprint 9C's `acceptTeacherInvitation()` already creates the canonical
// `teachers` row every onboarded teacher needs; this module adds no second
// teacher identity. Only Class and Learner need a bridge.
//
// ============================================================================
// EXPLICITLY TEMPORARY — read before extending this file.
// ============================================================================
// docs/architecture/learning-intelligence-migration-strategy.md §3 rejects,
// by name, "a permanent bridging adapter... a layer whose job is to hide
// the fact that two different, both-still-live schemas exist, forever."
// This module is exactly that shape of thing, and is built anyway, as a
// deliberate, user-confirmed exception scoped like that document's own
// Phase 0 carve-out ("a temporary migration script/mechanism... during a
// defined cutover window," not a permanent sync). It exists to unblock
// real pilot assessment activity now, not to become the platform's
// permanent Core↔legacy adapter. It should be retired, not extended,
// once the migration strategy's Phase 11 (Compass port onto a Core-native
// `LearnerContext`) actually lands — at that point Intelligence stops
// needing `students`/`teacher_classes` at all, and this file deletes
// cleanly (nothing outside it should ever import from it except the one
// route wired in this sprint).
//
// What this module does NOT do, matching the sprint's explicit rules:
// - Does not create a second Teacher identity (ADR-0002's `teachers.id`
//   is reused as-is, resolved via the existing `resolveTeacher()`).
// - Does not duplicate a Core class/learner within its own table — it
//   creates exactly one legacy *shadow* row per Core entity, linked via
//   `external_id` (a column that already exists on `teacher_classes`,
//   `students`, and `class_assessments` — this is not a new schema
//   concept, it is already-provisioned infrastructure, previously used
//   only by `scripts/reference-school/06-seed-legacy-bridge.ts`'s
//   disposable seed data. This module is that same mechanism, made
//   idempotent, permission-checked, and safe for real production data).
// - Does not rewrite Evidence, Projection, Ranking, or Grading — every
//   downstream call in this file (`createAssessment`, `saveScores`,
//   `recordAssessmentEvidence`, `recomputeLearnerProjection`) is the
//   existing, unmodified function, called with a resolved legacy id.
// - Does not weaken authorization. `ensureBridgedClass` adds a real
//   ownership check (respecting Core's explicit `class_teacher_id` when
//   set; self-service — "first legitimate teacher to bridge it becomes
//   its owner" — only when Core has no explicit assignment, matching the
//   legacy system's own pre-existing self-service model per Sprint 6D's
//   audit) *in addition to*, never instead of, the existing
//   `requireCanManageAssessment`/`requireClassTeacher` checks the route
//   still runs afterward, unchanged.

import { repos } from '@/lib/repositories'
import { resolveTeacher, resolveMembership, resolveLegacyStudentId } from '@/lib/core/identity'
import { asStudentId, type LearnerId, type StudentId } from '@/lib/core/identityTypes'
import { isSchoolAdmin, getSchoolUser } from '@/lib/core/school-users'
import { getClass } from '@/lib/core/classes'
import { getLearner } from '@/lib/core/learners'
import { listAcademicYears } from '@/lib/core/school'
import { createAssessment, saveScores } from '@/lib/core/assessments'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { getLearnerTimeline, type TimelineEntry } from '@/lib/learnerRecord/timeline'
import { buildCareerIntelligence, type CareerIntelligence } from '@/lib/learnerIntelligence/careerIntelligence'
import { resolveCompassStudentAccess, type OwnershipResult } from '@/lib/compass/ownership'
import { MembershipRequiredError, PermissionDeniedError, IdentityResolutionError } from '@/lib/core/errors'
import type { AcademicYear } from '@/types/core'

// ── Class bridge ─────────────────────────────────────────────────────────────

export type BridgedClass = {
  legacyClassId: string
  legacyTeacherId: string
  coreClassId: string
  gradeNumber: number
}

function gradeCodeToNumber(code: string): number {
  const n = Number(code.replace(/^[A-Za-z]+/, ''))
  if (Number.isNaN(n)) throw new Error(`academicBridge: cannot derive a grade number from grade code "${code}"`)
  return n
}

// class_code must be globally unique (live UNIQUE constraint) — derived
// deterministically from the Core class id so repeated calls resolve to
// the same value rather than colliding or drifting.
function deterministicClassCode(coreClassId: string): string {
  return `CORE-${coreClassId.slice(0, 8)}`
}

/**
 * Resolves (creating if necessary) the legacy `teacher_classes` shadow row
 * for a Core class, owned by the acting teacher.
 *
 * Authorization (in addition to, not instead of, the route's existing
 * checks): the acting user must be an active member of `schoolId`, and
 * must have a canonical `teachers` row (ADR-0002 Part 7's existing,
 * unchanged rule). If the Core class already has an explicit
 * `class_teacher_id` assigned, only that specific teacher may bridge it —
 * a real ownership check this bridge adds, not one it removes. If the
 * Core class has no explicit assignment (the common case — Sprint 9B's
 * activation pipeline never sets one), the first legitimate teacher to
 * call this becomes its bridge owner, matching the legacy system's own
 * pre-existing self-service "a teacher creates their own class" model
 * (Sprint 6D's audit, Workflow 4) — not a new permissiveness this bridge
 * introduces.
 */
export async function ensureBridgedClass(
  schoolId: string,
  coreClassId: string,
  actingUserId: string
): Promise<BridgedClass> {
  const membership = await resolveMembership(actingUserId, schoolId)
  if (!membership) throw new MembershipRequiredError()

  const teacher = await resolveTeacher(actingUserId)
  if (!teacher) {
    throw new IdentityResolutionError(
      'ensureBridgedClass: no canonical teacher record for this user — complete teacher onboarding first (see lib/core/teacherOnboarding.ts).'
    )
  }

  const coreClass = await getClass(coreClassId, schoolId) // throws if not found / wrong school

  if (coreClass.class_teacher_id) {
    // School-scoped (not repos.schools.findSchoolUserByUserId, which is
    // unscoped and would pick an arbitrary row for a user who belongs to
    // more than one school) — the correct, unambiguous membership row for
    // *this* school specifically.
    const assignedMembership = await getSchoolUser(actingUserId, schoolId)
    const isAssignedTeacher = assignedMembership?.id === coreClass.class_teacher_id
    const isAdmin = await isSchoolAdmin(actingUserId, schoolId)
    if (!isAssignedTeacher && !isAdmin) {
      throw new PermissionDeniedError('This class is assigned to a different teacher.')
    }
  }

  if (!coreClass.grade_id || !coreClass.grades) {
    throw new Error(`ensureBridgedClass: Core class ${coreClassId} has no resolvable grade.`)
  }
  const gradeNumber = gradeCodeToNumber(coreClass.grades.code)

  const existing = await repos.teachers.findLegacyClassByExternalId(coreClassId, teacher.id)
  if (existing) {
    return { legacyClassId: existing.id, legacyTeacherId: teacher.id, coreClassId, gradeNumber }
  }

  const created = await repos.teachers.insertLegacyClass({
    teacherId:    teacher.id,
    name:         coreClass.display_name ?? coreClass.class_name,
    grade:        gradeNumber,
    subject:      'General', // teacher_classes.subject has no real downstream consumer for grading/ranking/evidence — see module header
    academicYear: await resolveAcademicYearName(schoolId, coreClass.academic_year_id),
    classCode:    deterministicClassCode(coreClassId),
    externalId:   coreClassId,
  })

  return { legacyClassId: created.id, legacyTeacherId: teacher.id, coreClassId, gradeNumber }
}

async function resolveAcademicYearName(schoolId: string, academicYearId: string | null): Promise<string> {
  if (!academicYearId) return String(new Date().getFullYear())
  const years: AcademicYear[] = await listAcademicYears(schoolId)
  return years.find(y => y.id === academicYearId)?.name ?? String(new Date().getFullYear())
}

// ── Learner bridge ───────────────────────────────────────────────────────────

const GRADE_LEVEL_LABEL = (grade: number): string =>
  grade >= 10 ? 'Senior School' : grade >= 7 ? 'Junior School' : 'Primary'

/**
 * Resolves (creating if necessary) the legacy `students` shadow row for a
 * Core learner, linked to the same bridged legacy teacher as their class —
 * this direct `students.teacher_id` link is what makes
 * `lib/compass/ownership.ts::resolveTeacherOwnership`'s existing,
 * unmodified 'teacher_direct' check pass, and what
 * `lib/assessments/evidence.ts::recordAssessmentEvidence` needs
 * (`learner_marks.student_id != null`) to produce Evidence at all.
 *
 * Requires the learner to actually be enrolled in `coreClassId` for
 * `termId` (reuses Sprint 9D's `getLearner`, existing, school-scoped) —
 * prevents bridging a learner unrelated to the class an assessment is
 * being recorded against (learner ownership, Step 7).
 */
export async function ensureBridgedLearner(
  schoolId: string,
  coreLearnerId: LearnerId,
  bridgedClass: BridgedClass
): Promise<{ legacyStudentId: StudentId }> {
  const learner = await getLearner(coreLearnerId, schoolId) // throws if not found / wrong school

  const existing = await repos.teachers.findLegacyStudentByExternalId(coreLearnerId)
  if (existing) {
    // Roster link ensured every call, not just on first creation — idempotent
    // upsert, closes the gap even for a student bridged before Sprint 9G.
    await repos.teachers.upsertLegacyClassRoster(bridgedClass.legacyClassId, existing.id)
    // Trust origin: `students.id`, from a lookup on `students.external_id`.
    return { legacyStudentId: asStudentId(existing.id) }
  }

  const created = await repos.teachers.insertLegacyStudent({
    name:       `${learner.first_name} ${learner.last_name}`,
    grade:      bridgedClass.gradeNumber,
    level:      GRADE_LEVEL_LABEL(bridgedClass.gradeNumber),
    teacherId:  bridgedClass.legacyTeacherId,
    externalId: coreLearnerId,
    upi:        learner.upi,
  })

  // Sprint 9G: makes the bridged learner visible to the roster-based class
  // view (app/api/teacher/classes/[classId]/route.ts reads class_students,
  // not students.teacher_id) — see repository method's own comment for why
  // this is safe now (parent_id confirmed nullable live) and wasn't assumed
  // safe from the static migration file alone.
  await repos.teachers.upsertLegacyClassRoster(bridgedClass.legacyClassId, created.id)

  // Trust origin: `students.id`, returned by the insert that just created it.
  return { legacyStudentId: asStudentId(created.id) }
}

// ── High-level orchestration: Assessment → Evidence → Projection ────────────

export type BridgedAssessmentInput = {
  title: string
  assessment_type: string
  term: string
  year: number
  max_score: number
  subjects: string[]
  curriculum_type: string
  weight_percent?: number
  grading_type?: string
  grade_id?: string
}

/**
 * Creates an assessment against a Core class, using the existing,
 * unmodified `lib/core/assessments.ts::createAssessment` — the only new
 * work is resolving `coreClassId` to its bridged legacy id first.
 */
export async function createBridgedAssessment(
  schoolId: string,
  coreClassId: string,
  actingUserId: string,
  input: BridgedAssessmentInput
): Promise<{ assessmentId: string; legacyClassId: string }> {
  const bridged = await ensureBridgedClass(schoolId, coreClassId, actingUserId)
  const assessment = await createAssessment({ ...input, class_id: bridged.legacyClassId, userId: actingUserId })
  return { assessmentId: assessment.id, legacyClassId: bridged.legacyClassId }
}

export type BridgedScoreInput = {
  coreLearnerId: LearnerId
  admission_number: string
  student_name: string
  subject_scores: Record<string, number>
  total_marks: number
  mean_score: number
  mean_grade?: string
}

/**
 * Records marks for a set of Core learners against a bridged assessment,
 * then runs the existing, unmodified Evidence and Projection steps —
 * exactly the same call sequence a real teacher's marks-entry action
 * already triggers for a legacy class (Step 3/4: "do not redesign
 * Evidence... only identity flow"). Every learner bridge is
 * existence-checked first (Sprint 9B/9D idiom) — safe to call repeatedly
 * (Part 4-equivalent idempotency: re-recording the same scores upserts the
 * same `learner_marks` rows via the existing `assessment_id,student_id`
 * unique constraint, and Evidence/Projection recompute is itself
 * idempotent by design, per lib/projection/recompute.ts's own contract).
 */
export async function recordBridgedMarks(
  schoolId: string,
  assessmentId: string,
  bridgedClass: BridgedClass,
  actingUserId: string,
  scores: BridgedScoreInput[]
): Promise<{ legacyStudentIds: StudentId[] }> {
  const legacyScores = []
  const legacyStudentIds: StudentId[] = []
  for (const score of scores) {
    const { legacyStudentId } = await ensureBridgedLearner(schoolId, score.coreLearnerId, bridgedClass)
    legacyStudentIds.push(legacyStudentId)
    legacyScores.push({
      learner_id:       legacyStudentId,
      admission_number: score.admission_number,
      student_name:     score.student_name,
      subject_scores:   score.subject_scores,
      total_marks:      score.total_marks,
      mean_score:       score.mean_score,
      mean_grade:       score.mean_grade,
    })
  }

  await saveScores(assessmentId, bridgedClass.legacyClassId, bridgedClass.legacyTeacherId, legacyScores)
  await recordAssessmentEvidence(assessmentId, bridgedClass.legacyTeacherId, actingUserId)
  await Promise.all(legacyStudentIds.map(id => recomputeLearnerProjection(id)))

  return { legacyStudentIds }
}

// ============================================================================
// Sprint 9G — canonical read migration
// ============================================================================
// Every Intelligence-side read this sprint audited (Learner Timeline,
// Career Intelligence, Academic Clinic, Compass, Evidence, Projection) was
// already found to be uniformly keyed to the legacy `students.id` — the
// SAME identity ADR-0002/Stage 0.5 already treat as canonical for this side
// of the platform (Sprint 9F's own dependency validation). There is no
// second, competing "Core-native" version of any of these reads to migrate
// *to* — Core's `learners.id` and legacy `students.id` were never two
// candidate answers to the same question; they answer two different
// questions (institutional identity vs. Evidence-anchored identity), per
// the RAS's own §3 designation. "Canonical read migration," for this half
// of the platform, therefore means exactly one thing: resolve a
// Core-originated learner to its bridged legacy identity (if one exists,
// created lazily on first real use per Sprint 9F), then call the existing,
// unmodified read — never a second implementation of Timeline/Career
// Intelligence/Compass access, which would be exactly the "duplicated
// orchestration" every sprint in this series has been instructed to avoid.
//
// Every function below returns `null` (not an error) when no bridge exists
// yet for a given Core learner — "this learner has no assessment history
// yet" is a legitimate, common state (any newly-enrolled Sprint 9D
// learner), not a failure.

// resolveLegacyStudentId moved to lib/core/identity.ts (Sprint 12H) — the
// canonical identity module, not this temporary bridge — and re-exported
// here so this file's own existing callers (getBridgedLearnerTimeline etc.,
// below) need no change. New consumers should import it from
// lib/core/identity.ts directly, not from here.
export { resolveLegacyStudentId } from '@/lib/core/identity'

/**
 * Learner Timeline (Step 5) — `getLearnerTimeline()` (lib/learnerRecord/timeline.ts,
 * CLAUDE.md's designated canonical Learner Record) already takes exactly
 * the identity the bridge produces. No change to that function; this is
 * the resolve-then-call wrapper making it reachable from a Core learner id.
 */
export async function getBridgedLearnerTimeline(coreLearnerId: LearnerId): Promise<TimelineEntry[] | null> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (!legacyStudentId) return null
  return getLearnerTimeline(legacyStudentId)
}

/** Career Intelligence (Step 9) — `buildCareerIntelligence()` is unmodified; already Projection-sourced per docs/architecture/migration-ledger.md, already keyed to the same legacy studentId the bridge resolves. */
export async function getBridgedCareerIntelligence(coreLearnerId: LearnerId): Promise<CareerIntelligence | null> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (!legacyStudentId) return null
  return buildCareerIntelligence(legacyStudentId)
}

/** Compass access (Step 10) — `resolveCompassStudentAccess()` is unmodified; grants via the same `students.teacher_id` link `ensureBridgedLearner` already sets. */
export async function getBridgedCompassAccess(coreLearnerId: LearnerId, actingUserId: string): Promise<{ legacyStudentId: StudentId; access: OwnershipResult } | null> {
  const legacyStudentId = await resolveLegacyStudentId(coreLearnerId)
  if (!legacyStudentId) return null
  const access = await resolveCompassStudentAccess(actingUserId, legacyStudentId)
  return { legacyStudentId, access }
}
