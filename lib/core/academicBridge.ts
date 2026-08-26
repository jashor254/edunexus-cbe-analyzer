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
import { asStudentId, asLearnerId, type LearnerId, type StudentId } from '@/lib/core/identityTypes'
import { BridgeAlreadyClaimedError } from '@/lib/core/errors'
import { logger } from '@/lib/observability/logger'
import { isSchoolAdmin, getSchoolUser } from '@/lib/core/school-users'
import { getClass } from '@/lib/core/classes'
import { getLearner } from '@/lib/core/learners'
import { listAcademicYears } from '@/lib/core/school'
import { createAssessment, saveScores, getCanonicalAssessmentContext, getAssessmentScores, type CanonicalAssessmentContext } from '@/lib/core/assessments'
import { resolveInstitutionalAssignmentAuthority, resolveCurrentSubjectTeachingAuthority } from '@/lib/core/permissions'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { getClassRoster } from '@/lib/core/learners'
import { getCurrentTerm } from '@/lib/core/school'
import { getCurrentSeniorProgrammesForLearners, type CurrentSeniorProgrammeResult } from '@/lib/curriculum/seniorProgramme'
import { getDeterministicAliasesForCode } from '@/lib/curriculum/evidenceSubjectResolution'
import { mapSubject } from '@/lib/intelligence/subjectMapping'
import { getGradeBand, isSeniorBand } from '@/lib/learnerBlueprint/gradeBand'
import { getLearnerTimeline, type TimelineEntry } from '@/lib/learnerRecord/timeline'
import { buildCareerIntelligence, type CareerIntelligence } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { resolveCompassStudentAccess, type OwnershipResult } from '@/lib/compass/ownership'
import { MembershipRequiredError, PermissionDeniedError, IdentityResolutionError, ResourceOwnershipError } from '@/lib/core/errors'
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

// class_code must be globally unique (live UNIQUE constraint:
// teacher_classes_class_code_key) — derived deterministically so repeated
// calls resolve to the same value rather than colliding or drifting.
//
// Phase 13A (NEW-01) — this used to be keyed on coreClassId ALONE, but the
// actual bridge identity this module has always used for lookup/insert is
// (coreClassId, teacherId) — see findLegacyClassByExternalId's teacher-
// scoped signature just below, unchanged. A class-only code meant the
// SECOND subject teacher of any shared class (the default shape of a real
// secondary-school class — one Math teacher, one English teacher, etc.)
// collided with the first teacher's row on their very first assessment,
// surfacing a raw, unhandled unique-violation as a generic 500 — Phase 13's
// freeze audit reproduced this live. Including the teacher fragment keeps
// the value deterministic per (class, teacher) — same pair always derives
// the same code, safe to look up again — while making different teachers
// of the same class derive different codes. Existing rows are untouched:
// the lookup below has never read class_code's value, only external_id +
// teacher_id, so an old-format code already stored for a teacher who
// bridged before this fix continues to resolve exactly as before.
function deterministicClassCode(coreClassId: string, teacherId: string): string {
  return `CORE-${coreClassId.slice(0, 8)}-${teacherId.slice(0, 8)}`
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
    classCode:    deterministicClassCode(coreClassId, teacher.id),
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

  // IDENTITY-1 Phase 3: the lookup above and this insert are not atomic — a
  // concurrent request bridging the SAME Core learner (a network retry or a
  // double-submitted assessment; the only caller, recordBridgedMarks, has no
  // idempotency key) can insert between them. Phase 2's
  // `uq_students_external_id_bridge` partial unique index makes that a real,
  // reachable Postgres 23505, surfaced here as `BridgeAlreadyClaimedError`
  // (never a generic 500). The loser recovers by re-reading the bridge the
  // winner just created — this is idempotency recovery, not a retry of
  // arbitrary failures, and it catches exactly this one named constraint.
  let created: { id: string }
  try {
    created = await repos.teachers.insertLegacyStudent({
      name:       `${learner.first_name} ${learner.last_name}`,
      grade:      bridgedClass.gradeNumber,
      level:      GRADE_LEVEL_LABEL(bridgedClass.gradeNumber),
      teacherId:  bridgedClass.legacyTeacherId,
      externalId: coreLearnerId,
      upi:        learner.upi,
    })
  } catch (err) {
    if (!(err instanceof BridgeAlreadyClaimedError)) throw err

    const winner = await repos.teachers.findLegacyStudentByExternalId(coreLearnerId)
    if (!winner) {
      // The constraint fired, so a row exists — this would mean it was
      // deleted between the failed insert and this re-read. Genuinely
      // exceptional; surface it rather than silently returning nothing.
      throw new Error(`ensureBridgedLearner: bridge claimed concurrently for ${coreLearnerId} but no row found on re-read`)
    }
    await repos.teachers.upsertLegacyClassRoster(bridgedClass.legacyClassId, winner.id)
    // Trust origin: `students.id`, from the re-read that recovered the race.
    return { legacyStudentId: asStudentId(winner.id) }
  }

  // Sprint 9G: makes the bridged learner visible to the roster-based class
  // view (app/api/teacher/classes/[classId]/route.ts reads class_students,
  // not students.teacher_id) — see repository method's own comment for why
  // this is safe now (parent_id confirmed nullable live) and wasn't assumed
  // safe from the static migration file alone.
  await repos.teachers.upsertLegacyClassRoster(bridgedClass.legacyClassId, created.id)

  // Trust origin: `students.id`, returned by the insert that just created it.
  return { legacyStudentId: asStudentId(created.id) }
}

// ── Legacy roster convergence on learner move (Phase 5) ─────────────────────
//
// The gap this closes: Phase 4's moveLearnerToClass() correctly updates
// canonical learner_enrollments (7A -> 7B), but a learner already bridged
// into the legacy gradebook (i.e. one who has had at least one assessment
// recorded before the move) stayed on the OLD class's class_students
// roster forever — ensureBridgedLearner only ever ADDS a roster row, and
// until this function, nothing in the codebase ever removed one. A
// teacher's legacy-roster-backed gradebook/assignments/reports view would
// keep showing a learner who administratively left their class.
//
// Proven safe to delete (see removeLegacyClassRosterMembership's own
// comment): class_students is a pure current-roster join table with zero
// downstream foreign keys — every historical academic table references
// students.id directly, never class_students.id. Removing a row here
// changes only "is this student currently on this legacy class roster,"
// never anything historical.
//
// Deliberately a no-op, not an error, in the two expected cases: the
// learner was never bridged at all (no students row yet — the common
// case, since bridging is lazy-on-first-assessment), or the vacated Core
// class itself was never bridged by any teacher. An ACTUAL failure (the
// delete call itself erroring) still throws — callers must not treat this
// as unconditionally safe to ignore, only conditionally absent.
export async function removeStaleLegacyRosterMembership(
  coreLearnerId: LearnerId,
  vacatedCoreClassId: string
): Promise<{ removed: number }> {
  const legacyStudent = await repos.teachers.findLegacyStudentByExternalId(coreLearnerId)
  if (!legacyStudent) return { removed: 0 } // never bridged — nothing to converge

  // Teacher-agnostic on purpose (§18): more than one teacher_classes row
  // can legitimately represent the same Core class (each teacher who ever
  // bridged it gets/reuses their own row, keyed by (external_id,
  // teacherId) in ensureBridgedClass) — e.g. a class reassigned between
  // teachers over time, each having bridged it while they held it. All of
  // them are stale once the learner has left the Core class, so all are
  // removed; none is skipped as "the wrong one."
  const legacyClassIds = await repos.teachers.findLegacyClassIdsByExternalId(vacatedCoreClassId)
  if (legacyClassIds.length === 0) return { removed: 0 } // old class itself was never bridged — nothing to converge

  const removed = await repos.teachers.removeLegacyClassRosterMembership(legacyClassIds, legacyStudent.id)

  if (removed > 0) {
    logger.info('legacy roster membership removed on canonical class move', {
      service:            'academic-bridge',
      core_learner_id:    coreLearnerId,
      vacated_core_class: vacatedCoreClassId,
      legacy_class_count: legacyClassIds.length,
      removed,
      reason:             'canonical_class_move',
    })
  }

  return { removed }
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
 *
 * Phase 3A — an optional `classSubjectId` gives the assessment canonical
 * subject identity. When supplied, it is authorized via
 * {@link resolveInstitutionalAssignmentAuthority} — the same tenure/
 * `ended_at`/active-membership/role check the assignment/quiz domain
 * already uses — never trusted as-is:
 *  - the resolved tenure's `schoolId`/`coreClassId` must match this call's
 *    own `schoolId`/`coreClassId` exactly, or the request is rejected
 *    (cross-school and class-mismatch tampering, Phase 3A Steps 9-10) —
 *    both are derived from `classSubjectId` alone, never taken from the
 *    caller's own `schoolId`/`coreClassId` arguments as truth.
 *  - the caller's `input.subjects` free text is IGNORED and replaced with
 *    the canonical subject name (Phase 3A Step 8, Option A — the browser
 *    cannot make its own subject text stick once a verified `classSubjectId`
 *    is present).
 *
 * `classSubjectId` omitted entirely reproduces the exact pre-Phase-3A
 * behaviour (free-text `input.subjects`, no canonical columns set) — every
 * existing caller of this function is unaffected.
 */
export async function createBridgedAssessment(
  schoolId: string,
  coreClassId: string,
  actingUserId: string,
  input: BridgedAssessmentInput,
  classSubjectId?: string,
): Promise<{ assessmentId: string; legacyClassId: string }> {
  const bridged = await ensureBridgedClass(schoolId, coreClassId, actingUserId)

  let canonicalSubjectId: string | undefined
  let canonicalSubjects: string[] | undefined
  if (classSubjectId) {
    const authority = await resolveInstitutionalAssignmentAuthority(actingUserId, classSubjectId)
    if (authority.schoolId !== schoolId) {
      throw new ResourceOwnershipError('This teaching assignment does not belong to the requested school.')
    }
    if (authority.coreClassId !== coreClassId) {
      throw new ResourceOwnershipError('This teaching assignment does not belong to the requested class.')
    }
    canonicalSubjectId = authority.subjectId
    canonicalSubjects = [authority.subjectName]
  }

  const assessment = await createAssessment({
    ...input,
    subjects: canonicalSubjects ?? input.subjects,
    class_id: bridged.legacyClassId,
    userId: actingUserId,
    class_subject_id: classSubjectId ?? null,
    subject_id: canonicalSubjectId ?? null,
  })
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

// ── Phase 3C: canonical marks entry ─────────────────────────────────────────

export type CanonicalScoreInput = { coreLearnerId: LearnerId; score: number }

export type CanonicalMarkRejectionReason = 'not_on_roster' | 'programme_mismatch' | 'score_out_of_range'
export type CanonicalMarkRejection = { coreLearnerId: LearnerId; reason: CanonicalMarkRejectionReason }

export type RecordCanonicalMarksResult = {
  saved: LearnerId[]
  rejected: CanonicalMarkRejection[]
}

/**
 * Phase 3C — the ONE teacher-facing marks-entry path for a canonical
 * (`class_subject_id`-bearing) assessment. Composes entirely of existing,
 * unmodified pieces (`getClassRoster`, `resolveCurrentSubjectTeachingAuthority`,
 * `getCurrentSeniorProgrammesForLearners`, `recordBridgedMarks`) — no new
 * Evidence/Projection/Blueprint logic, per Phase 3C's scope lock.
 *
 * Authorization: re-verifies the CURRENT class+subject teaching tenure on
 * every call (Step 26/27) — never the assessment's own, possibly long-ended
 * `class_subject_id` snapshot. A departed teacher is rejected even for an
 * assessment they created; the current subject teacher (including a
 * replacement) may manage it.
 *
 * Roster authority: `getClassRoster` (Core `learner_enrollments`, current
 * term), never a client-supplied learner list and never legacy
 * `class_students` — a `coreLearnerId` not on the roster is rejected
 * (`not_on_roster`), closing the gap the existing free-text `save-scores`
 * action leaves open (it trusts whatever the caller posts).
 *
 * Programme matching (Senior bands only, Step 10-12/25): a learner whose
 * CURRENT senior programme is resolved and does NOT include this
 * assessment's subject is rejected (`programme_mismatch`) rather than
 * silently scored — but a learner with NO resolved programme yet
 * (transitional/incomplete rollout) is allowed, never blocked and never
 * given a fabricated programme. Junior classes never run this check at all
 * (`isSeniorBand` gates it) — Grade 9 roster members are always eligible.
 *
 * Score range (0..maxScore) is validated per learner; an out-of-range score
 * is rejected for that learner only (`score_out_of_range`) — the rest of
 * the batch still saves (Step 16 partial-entry support). A malformed
 * request (duplicate `coreLearnerId`) throws rather than guessing which
 * entry to keep.
 */
export async function recordCanonicalAssessmentMarks(
  schoolId: string,
  assessmentId: string,
  actingUserId: string,
  scores: CanonicalScoreInput[],
): Promise<RecordCanonicalMarksResult> {
  const seen = new Set<string>()
  for (const s of scores) {
    if (seen.has(s.coreLearnerId)) {
      throw new Error(`recordCanonicalAssessmentMarks: duplicate coreLearnerId ${s.coreLearnerId} in scores payload`)
    }
    seen.add(s.coreLearnerId)
  }

  const context = await getCanonicalAssessmentContext(schoolId, assessmentId)
  if (context.kind !== 'canonical') {
    throw new ResourceOwnershipError('This assessment is not available for canonical marks entry.')
  }

  await resolveCurrentSubjectTeachingAuthority(actingUserId, schoolId, context.coreClassId, context.subjectId)

  const currentTerm = await getCurrentTerm(schoolId)
  if (!currentTerm) throw new Error('recordCanonicalAssessmentMarks: no current term configured for this school')

  const roster = await getClassRoster(context.coreClassId, currentTerm.id)
  const rosterById = new Map(roster.map(l => [l.id, l]))

  const rejected: CanonicalMarkRejection[] = []
  const inRange: CanonicalScoreInput[] = []
  for (const entry of scores) {
    if (!rosterById.has(entry.coreLearnerId)) {
      rejected.push({ coreLearnerId: entry.coreLearnerId, reason: 'not_on_roster' })
      continue
    }
    if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > context.maxScore) {
      rejected.push({ coreLearnerId: entry.coreLearnerId, reason: 'score_out_of_range' })
      continue
    }
    inRange.push(entry)
  }

  let eligible = inRange
  if (isSeniorBand(getGradeBand(context.className)) && inRange.length > 0) {
    const programmesByLearnerId = await getCurrentSeniorProgrammesForLearners(inRange.map(e => e.coreLearnerId))
    eligible = []
    for (const entry of inRange) {
      const programme = programmesByLearnerId.get(entry.coreLearnerId)
      const isExplicitMismatch =
        programme?.status === 'resolved' && !programme.subjects.some(s => s.subjectId === context.subjectId)
      if (isExplicitMismatch) {
        rejected.push({ coreLearnerId: entry.coreLearnerId, reason: 'programme_mismatch' })
        continue
      }
      // status === 'unresolved' is deliberately NOT a rejection (Step 10) —
      // transitional, never fabricated, never treated as exclusion.
      eligible.push(entry)
    }
  }

  if (eligible.length === 0) return { saved: [], rejected }

  // Canonical raw Evidence key — the audited alias table when this subject
  // has one (guarantees Blueprint attribution matches Phase 2A's identity),
  // else the same identity-safe normalizer every other producer uses. Never
  // the Title-Case `subjects.name` verbatim — mapSubject('Core Mathematics')
  // would collapse to 'core mathematics' (a space, not the underscore form
  // every existing consumer of this identity expects), silently breaking
  // the exact attribution chain Phase 3A proved.
  const rawSubjectKey =
    getDeterministicAliasesForCode(context.subjectCode)[0] ?? mapSubject(context.subjectName).canonicalSubject

  const bridged = await ensureBridgedClass(schoolId, context.coreClassId, actingUserId)
  const bridgedScores: BridgedScoreInput[] = eligible.map(entry => {
    const learner = rosterById.get(entry.coreLearnerId)!
    return {
      coreLearnerId: entry.coreLearnerId,
      admission_number: learner.admission_number,
      student_name: `${learner.first_name} ${learner.last_name}`.trim(),
      subject_scores: { [rawSubjectKey]: entry.score },
      total_marks: entry.score,
      mean_score: entry.score,
    }
  })

  await recordBridgedMarks(schoolId, assessmentId, bridged, actingUserId, bridgedScores)

  return { saved: eligible.map(e => e.coreLearnerId), rejected }
}

export type CanonicalRosterProgrammeStatus = 'not_applicable' | 'matched' | 'unresolved' | 'mismatch'

export type CanonicalRosterEntry = {
  coreLearnerId: LearnerId
  admissionNumber: string
  name: string
  existingScore: number | null
  programmeStatus: CanonicalRosterProgrammeStatus
}

export type CanonicalAssessmentMarksView =
  | { kind: 'not_found' }
  | { kind: 'legacy' }
  | { kind: 'canonical'; context: Extract<CanonicalAssessmentContext, { kind: 'canonical' }>; roster: CanonicalRosterEntry[] }

/**
 * Phase 3C — the read side of the marks page: canonical assessment context
 * plus the current roster, each learner's already-saved score (if any, so
 * the teacher never re-enters what was already saved — Step 17) and, for
 * Senior classes only, their programme-match status for this subject. Never
 * writes anything (including no bridging) — a page load must not create
 * legacy shadow rows a teacher never asked to create.
 */
export async function getCanonicalAssessmentMarksView(
  schoolId: string,
  assessmentId: string,
): Promise<CanonicalAssessmentMarksView> {
  const context = await getCanonicalAssessmentContext(schoolId, assessmentId)
  if (context.kind !== 'canonical') return context

  const currentTerm = await getCurrentTerm(schoolId)
  if (!currentTerm) return { kind: 'canonical', context, roster: [] }

  const roster = await getClassRoster(context.coreClassId, currentTerm.id)
  if (roster.length === 0) return { kind: 'canonical', context, roster: [] }

  const rawSubjectKey =
    getDeterministicAliasesForCode(context.subjectCode)[0] ?? mapSubject(context.subjectName).canonicalSubject

  // Existing scores are keyed by the LEGACY student id (learner_marks.student_id);
  // resolve the reverse bridge (students.external_id -> learners.id) to
  // align them back onto the Core roster. No bridge yet for a learner
  // simply means "never scored on this assessment" — a legitimate, common
  // state, not an error.
  const existingScores = await getAssessmentScores(assessmentId)
  const legacyStudentIds = existingScores.map(s => s.learner_id).filter((id): id is string => !!id)
  const bridgeRows = legacyStudentIds.length ? await repos.teachers.findExternalIdsByStudentIds(legacyStudentIds) : []
  const coreLearnerIdByLegacyId = new Map(bridgeRows.filter(r => r.external_id).map(r => [r.id, r.external_id as string]))
  const scoreByCoreLearnerId = new Map<string, number>()
  for (const s of existingScores) {
    const coreId = coreLearnerIdByLegacyId.get(s.learner_id)
    const value = s.subject_scores[rawSubjectKey]
    if (coreId && typeof value === 'number') scoreByCoreLearnerId.set(coreId, value)
  }

  let programmesByLearnerId: Map<LearnerId, CurrentSeniorProgrammeResult> | null = null
  const senior = isSeniorBand(getGradeBand(context.className))
  if (senior) {
    programmesByLearnerId = await getCurrentSeniorProgrammesForLearners(roster.map(l => asLearnerId(l.id)))
  }

  const rosterEntries: CanonicalRosterEntry[] = roster.map(learner => {
    let programmeStatus: CanonicalRosterProgrammeStatus = 'not_applicable'
    if (senior && programmesByLearnerId) {
      const programme = programmesByLearnerId.get(asLearnerId(learner.id))
      if (programme?.status === 'resolved') {
        programmeStatus = programme.subjects.some(s => s.subjectId === context.subjectId) ? 'matched' : 'mismatch'
      } else {
        programmeStatus = 'unresolved'
      }
    }
    return {
      coreLearnerId: asLearnerId(learner.id),
      admissionNumber: learner.admission_number,
      name: `${learner.first_name} ${learner.last_name}`.trim(),
      existingScore: scoreByCoreLearnerId.get(learner.id) ?? null,
      programmeStatus,
    }
  })

  return { kind: 'canonical', context, roster: rosterEntries }
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
