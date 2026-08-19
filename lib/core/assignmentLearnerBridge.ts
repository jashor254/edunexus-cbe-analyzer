// lib/core/assignmentLearnerBridge.ts
//
// Phase 1C — Institutional Learner Roster Bridge.
//
// Closes the gap Phase 1B (lib/core/assignmentCompatibilityBridge.ts) left
// open on purpose: that module resolves/creates the compatibility CLASS for
// a teaching tenure but never populates its `class_students` roster, because
// doing so requires translating Core-enrolled learners
// (`learner_enrollments.learner_id` -> `learners.id`) into the legacy
// `students.id` the Assignment/submission/Evidence pipeline is keyed to.
//
// ============================================================================
// DESIGN GATE OUTCOME (Phase 1C Steps 1-5 — full audit in the phase closeout)
// ============================================================================
// That translation mechanism already exists, is already proven in
// production, and needs no new schema:
//   - `students.external_id = learners.id::text`, enforced 1:1 by a live
//     partial unique index (`uq_students_external_id_bridge`, migration
//     20260814150000, "IDENTITY-1 Phase 2").
//   - Read through exactly one canonical resolver,
//     `resolveLegacyStudentId()` (lib/core/identity.ts) — promoted there by
//     Sprint 12H specifically so every future consumer (this module
//     included) shares it rather than re-deriving the same lookup.
// Production audit (2026-08-18, read-only against lpxrfbmzncaztpmyqzkc):
// 718 students / 972 learners, 479 populated bridge values, 0 duplicate
// external_id values, 0 learners mapped to more than one student, 0
// cross-school mismatches among existing bridge rows (all existing bridge
// rows have `school_id` NULL, so this was checked via the Core-side
// `learners.school_id` join, not the legacy side — see below). The 56
// "orphaned" external_id values found are all synthetic `added_by='system'`,
// `school_id NULL`, name `'Test Learner'` rows from an integration-test
// window (2026-07-16 to 2026-08-15) — confirmed NOT a second semantic for
// this column, only test debris; this module never reads or writes rows
// shaped like that. Cardinality (Step 5) is therefore genuinely 1:1 by
// construction and by data, not merely assumed. Because the mapping is an
// exact key match (`external_id = learners.id::text`), never a heuristic
// (never name, never admission number) there is structurally no "probable
// but unprovable" or "conflicting candidate" case for this bridge to
// produce — Backfill Categories 2 and 4 (spec Step 6) are empty by design,
// not by luck.
//
// Deliberately independent of lib/core/academicBridge.ts's own
// `ensureBridgedLearner` — same underlying identity bridge, own write path —
// matching the same boundary lib/core/assignmentCompatibilityBridge.ts
// already drew for the class side (Phase 1B's own explicit rule: this
// domain does not depend on academicBridge.ts).
//
// One deliberate improvement over the existing write path: every bridge row
// academicBridge.ts's `ensureBridgedLearner` has ever created leaves
// `students.school_id` NULL (verified live: 479/479) because Compass/
// Evidence/Projection ownership never needed it (they gate on
// `students.teacher_id` / `class_students`, not `school_id`). This module
// DOES set it, for two reasons: (1) it is a real, already-provisioned,
// already-indexed, already-FK'd column (`students.school_id ->
// schools.id`) — populating it is not new schema; (2) the Assignment
// domain's own school-ownership boundary (Step 10) is otherwise enforced
// entirely by the Core-side lookup (`getLearner()` is school-scoped and
// throws for a cross-school learnerId) — stamping `school_id` on the legacy
// row makes that boundary visible on the legacy side too, for free, without
// touching a single pre-existing row (existing NULL-`school_id` rows are
// left exactly as they are — no historical backfill, no identity rewrite).
//
// NO NEW MIGRATION. Step 19 authorizes one additive migration IF the design
// gates conclude one is needed; here they conclude the opposite — the
// existing schema (external_id + its unique index + the already-nullable
// `students.school_id` column) already fully supports this module. Adding a
// second, parallel bridge structure (a new table, a new column) would
// duplicate an already-canonical mechanism — exactly what Sprint 12H's own
// audit flagged as the mistake to avoid repeating.

import { repos } from '@/lib/repositories'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { getLearner, getClassRoster } from '@/lib/core/learners'
import { getCurrentTerm } from '@/lib/core/school'
import { BridgeAlreadyClaimedError } from '@/lib/core/errors'
import { asLearnerId, asStudentId, type LearnerId, type StudentId } from '@/lib/core/identityTypes'
import { ensureAssignmentCompatibilityClass, type AssignmentCompatibilityClass } from '@/lib/core/assignmentCompatibilityBridge'

const GRADE_LEVEL_LABEL = (grade: number): string => (grade >= 10 ? 'Senior School' : 'Junior School')

/**
 * Resolves (creating if necessary) the compatibility `students` row for a
 * Core learner.
 *
 * School ownership (Step 10) is enforced by `getLearner(coreLearnerId,
 * schoolId)`, which throws if the learner does not belong to `schoolId` —
 * the same school-scoped lookup every other Core read in this codebase
 * uses. `students.school_id`, set on creation below, mirrors that fact on
 * the legacy row; it is not itself the authorization check.
 *
 * Never mutates an existing row (Non-Negotiable: no rewrite of an
 * already-linked identity, no historical backfill) — a learner who already
 * has a legacy student via ANY path (including academicBridge.ts's own
 * bridge, created by an earlier assessment) is simply reused, exactly as
 * `resolveLegacyStudentId` already finds it. Idempotent: repeated calls for
 * the same learner return the same `studentId`.
 *
 * Concurrency: mirrors `ensureAssignmentCompatibilityClass`'s own shape —
 * a losing concurrent insert surfaces `BridgeAlreadyClaimedError`
 * (never a generic 500, `uq_students_external_id_bridge` names it exactly)
 * and recovers by re-reading the winner's row via `resolveLegacyStudentId`.
 */
export async function ensureAssignmentCompatibilityStudent(
  schoolId: string,
  coreLearnerId: LearnerId,
  gradeNumber: number
): Promise<{ studentId: StudentId; created: boolean }> {
  const learner = await getLearner(coreLearnerId, schoolId) // throws if not found / wrong school

  const existingId = await resolveLegacyStudentId(coreLearnerId)
  if (existingId) return { studentId: existingId, created: false }

  try {
    const created = await repos.teachers.insertAssignmentCompatibilityStudent({
      name:      `${learner.first_name} ${learner.last_name}`,
      grade:     gradeNumber,
      level:     GRADE_LEVEL_LABEL(gradeNumber),
      schoolId,
      externalId: coreLearnerId,
      upi:       learner.upi ?? null,
    })
    return { studentId: asStudentId(created.id), created: true }
  } catch (err) {
    if (!(err instanceof BridgeAlreadyClaimedError)) throw err

    const winner = await resolveLegacyStudentId(coreLearnerId)
    if (!winner) {
      throw new Error(
        `ensureAssignmentCompatibilityStudent: bridge claimed concurrently for ${coreLearnerId} but no row found on re-read`
      )
    }
    return { studentId: winner, created: false }
  }
}

export type RosterSyncResult = {
  classSubjectId: string
  teacherClassId: string
  /** Learners currently enrolled and now present on the compatibility roster (created or already-present). */
  currentRosterSize: number
  /** Compatibility students newly created this call (Category 3 provisioning). */
  studentsCreated: number
  /** class_students rows removed because the learner is no longer on the current Core roster for this class/term. */
  removed: number
}

/**
 * Materializes a Phase 1B compatibility class's roster from the CURRENT
 * Core enrollment of its teaching tenure's class, for the school's current
 * term:
 *
 *   class_subjects -> (Phase 1B) compatibility teacher_classes
 *   Core class + current term -> learner_enrollments (via getClassRoster)
 *   each learner -> (this module) compatibility students
 *   -> class_students (upsert, then reconcile removals)
 *
 * Idempotent, school-scoped (every learner resolved through
 * `ensureAssignmentCompatibilityStudent`, which is itself school-scoped),
 * deterministic (no heuristic matching anywhere in this call graph), and
 * non-destructive to historical assignment data — this function only ever
 * touches `class_students` rows on `compatClass.teacherClassId`, a
 * synthetic class this bridge itself owns; it never touches
 * `assignment_submissions`, `learner_marks`, or `learner_evidence`.
 *
 * Exit handling (Step 13): `class_students` is a pure current-roster join
 * table with zero downstream foreign keys (confirmed live and already
 * relied upon by `lib/core/academicBridge.ts`'s Phase 5 —
 * `removeStaleLegacyRosterMembership` — the first production DELETE against
 * this table). Removing a `class_students` row here changes only "is this
 * compatibility student currently on this compatibility class's roster,"
 * never anything historical. A learner who withdraws/transfers/moves is
 * removed from the CURRENT compatibility roster on the next sync; their
 * past `assignment_submissions` rows (keyed to `students.id` directly, not
 * `class_students.id`) are untouched.
 */
export async function syncAssignmentCompatibilityRoster(classSubjectId: string): Promise<RosterSyncResult> {
  const tenure = await repos.teachers.findTenureForCompatibilityBridge(classSubjectId)
  if (!tenure) {
    throw new Error(`syncAssignmentCompatibilityRoster: no such teaching assignment ${classSubjectId}.`)
  }
  if (tenure.endedAt !== null) {
    throw new Error(
      `syncAssignmentCompatibilityRoster: teaching assignment ${classSubjectId} is not current (ended ${tenure.endedAt}).`
    )
  }

  const compatClass: AssignmentCompatibilityClass = await ensureAssignmentCompatibilityClass(classSubjectId)

  const term = await getCurrentTerm(tenure.schoolId)
  if (!term) {
    throw new Error(`syncAssignmentCompatibilityRoster: school ${tenure.schoolId} has no current term set.`)
  }

  const roster = await getClassRoster(tenure.classId, term.id)

  const currentStudentIds: string[] = []
  let studentsCreated = 0
  for (const learner of roster) {
    const { studentId, created } = await ensureAssignmentCompatibilityStudent(
      tenure.schoolId,
      asLearnerId(learner.id),
      compatClass.gradeNumber
    )
    if (created) studentsCreated += 1
    await repos.teachers.upsertLegacyClassRoster(compatClass.teacherClassId, studentId)
    currentStudentIds.push(studentId)
  }

  const existingMembers = await repos.teachers.findClassStudentIds(compatClass.teacherClassId)
  const staleStudentIds = existingMembers.filter((id) => !currentStudentIds.includes(id))
  const removed = staleStudentIds.length
    ? await repos.teachers.removeLegacyClassRosterMembershipForStudents(compatClass.teacherClassId, staleStudentIds)
    : 0

  return {
    classSubjectId,
    teacherClassId:    compatClass.teacherClassId,
    currentRosterSize: currentStudentIds.length,
    studentsCreated,
    removed,
  }
}
