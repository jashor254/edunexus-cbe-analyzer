// lib/core/assignmentCompatibilityBridge.ts
//
// Phase 1B — the explicit, reversible bridge between one institutional
// teaching TENURE (`class_subjects.id`) and one legacy compatibility class
// (`teacher_classes.id`), so the still-legacy-keyed assignment/submission/
// evidence pipeline can keep operating while assignment authority moves
// onto `class_subjects`. See:
//   - supabase/migrations/20260818120000_assignment_class_subject_bridge.sql
//   - docs/architecture/teaching-assignment-legacy-boundary.md
//
// ============================================================================
// SCOPE — CLASS-LEVEL ONLY. Deliberately stops short of roster population.
// ============================================================================
// This module resolves/creates the compatibility CLASS for a teaching
// tenure. It does NOT populate that class's `class_students` roster from
// `learner_enrollments`, and callers must not assume one exists after
// calling `ensureAssignmentCompatibilityClass`.
//
// Why: populating the roster would require translating every Core-enrolled
// learner (`learner_enrollments.learner_id`) into a legacy `students.id` —
// exactly the identity translation `lib/core/academicBridge.ts`'s
// `ensureBridgedLearner` performs, lazily, on first assessment. Phase 1B's
// own live audit (2026-08-18) found only 9 of 148 current teaching tenures
// already have a usable legacy shadow class producible from data on hand;
// the other 139 have real, currently-enrolled learners with NO existing
// `students` row at all. Silently creating 139 tenures' worth of brand-new
// legacy student identities inside an assignment-creation code path is a
// learner-identity migration, not a compatibility bridge, and is explicitly
// out of scope here (Phase 1B Step 5/Step 12 — see the phase report for the
// full blocker analysis: PHASE 1B BLOCKED ON ROSTER BRIDGE).
//
// This module also does NOT depend on `academicBridge.ts` in any way — not
// its `external_id` column, not `ensureBridgedClass`, not
// `ensureBridgedLearner`. That file remains the Assessment domain's own
// bridge; this is a second, independent structure for the Assignment
// domain, keyed on the teaching TENURE rather than (coreClassId, teacherId).
// Retiring `academicBridge.ts` from the assignment-authority path (Phase 1B
// Step 8) means this module is the only approved compatibility mechanism
// for assignment authority going forward — nothing in the assignment domain
// should read or write `teacher_classes.external_id`.

import { repos } from '@/lib/repositories'
import { resolveTeacher } from '@/lib/core/identity'
import { listAcademicYears } from '@/lib/core/school'
import { AssignmentBridgeAlreadyClaimedError } from '@/lib/core/errors'
import type { AcademicYear } from '@/types/core'

export type AssignmentCompatibilityClass = {
  /** `class_subjects.id` — the teaching tenure this bridge was resolved for. */
  classSubjectId: string
  /** `teacher_classes.id` — the compatibility class. Roster NOT guaranteed populated (see module header). */
  teacherClassId: string
  /** `teachers.id` — the legacy teacher identity the compatibility class is owned by. */
  legacyTeacherId: string
  gradeNumber: number
}

function gradeCodeToNumber(code: string): number {
  const n = Number(code.replace(/^[A-Za-z]+/, ''))
  if (Number.isNaN(n)) throw new Error(`assignmentCompatibilityBridge: cannot derive a grade number from grade code "${code}"`)
  return n
}

// class_code must be globally unique (teacher_classes_class_code_key). Keyed
// on the TENURE, not (coreClassId, teacherId) like academicBridge.ts's
// deterministicClassCode — a replacement teacher's new tenure must derive a
// different code even for the same class+subject, since it gets its own
// compatibility class, never the departed teacher's.
function deterministicClassCode(classSubjectId: string): string {
  return `ACB-${classSubjectId.slice(0, 8)}`
}

async function resolveAcademicYearName(schoolId: string, academicYearId: string | null): Promise<string> {
  if (!academicYearId) return String(new Date().getFullYear())
  const years: AcademicYear[] = await listAcademicYears(schoolId)
  return years.find(y => y.id === academicYearId)?.name ?? String(new Date().getFullYear())
}

/**
 * Resolves (creating if necessary) the compatibility `teacher_classes` row
 * for a CURRENT institutional teaching tenure.
 *
 * Throws:
 *  - `Error` if `classSubjectId` does not resolve, is not CURRENT
 *    (`ended_at` non-null — a departed/replaced tenure never gets a fresh
 *    bridge; its historical bridge, if one exists, is read-only from here
 *    on), or the owning membership is inactive.
 *  - `AssignmentBridgeAlreadyClaimedError` is never thrown to the caller —
 *    it is caught internally and resolved by re-reading the winner's row
 *    (see Step 6 race-safety proof, `lib/core/assignmentCompatibilityBridge.race.test.ts`).
 *
 * Does NOT populate `class_students` — see module header. Callers that need
 * assignment recipients must not call this expecting a ready roster.
 */
export async function ensureAssignmentCompatibilityClass(
  classSubjectId: string
): Promise<AssignmentCompatibilityClass> {
  const tenure = await repos.teachers.findTenureForCompatibilityBridge(classSubjectId)
  if (!tenure) {
    throw new Error(`ensureAssignmentCompatibilityClass: no such teaching assignment ${classSubjectId}.`)
  }
  if (tenure.endedAt !== null) {
    throw new Error(
      `ensureAssignmentCompatibilityClass: teaching assignment ${classSubjectId} is not current (ended ${tenure.endedAt}). ` +
      'A closed tenure never gets a new compatibility class; only its own already-existing bridge (if any) may still be read.'
    )
  }
  if (!tenure.membershipIsActive) {
    throw new Error(`ensureAssignmentCompatibilityClass: the teacher holding assignment ${classSubjectId} is not an active school member.`)
  }
  if (!tenure.gradeCode) {
    throw new Error(`ensureAssignmentCompatibilityClass: class ${tenure.classId} has no resolvable grade.`)
  }
  const gradeNumber = gradeCodeToNumber(tenure.gradeCode)

  const teacher = await resolveTeacher(tenure.membershipUserId)
  if (!teacher) {
    throw new Error(
      `ensureAssignmentCompatibilityClass: no canonical teacher record for the user holding assignment ${classSubjectId} — ` +
      'complete teacher onboarding first (see lib/core/teacherOnboarding.ts).'
    )
  }

  const existing = await repos.teachers.findAssignmentCompatibilityBridge(classSubjectId)
  if (existing) {
    return { classSubjectId, teacherClassId: existing.teacherClassId, legacyTeacherId: teacher.id, gradeNumber }
  }

  try {
    const teacherClass = await repos.teachers.insertAssignmentCompatibilityTeacherClass({
      classSubjectId,
      teacherId:    teacher.id,
      schoolId:     tenure.schoolId,
      name:         tenure.className,
      grade:        gradeNumber,
      subject:      tenure.subjectName,
      academicYear: await resolveAcademicYearName(tenure.schoolId, tenure.academicYearId),
      classCode:    deterministicClassCode(classSubjectId),
    })

    await repos.teachers.insertAssignmentCompatibilityBridge({
      classSubjectId,
      teacherClassId: teacherClass.id,
    })
    return { classSubjectId, teacherClassId: teacherClass.id, legacyTeacherId: teacher.id, gradeNumber }
  } catch (err) {
    if (!(err instanceof AssignmentBridgeAlreadyClaimedError)) throw err

    // Lost the race. Two different inserts can produce exactly this error
    // (see insertAssignmentCompatibilityTeacherClass's own doc comment):
    //   (a) our teacher_classes insert lost on `class_code` (deterministic
    //       per classSubjectId) to a concurrent caller's insert, before
    //       either of us reached the bridge-table insert at all; or
    //   (b) our teacher_classes insert succeeded (a second, orphaned
    //       compatibility class — left in place, never deleted, matching
    //       this codebase's "never delete teacher_classes" convention) but
    //       our bridge insert then lost on class_subject_legacy_bridge's
    //       own unique constraint.
    // Either way the winner's bridge row may not have committed yet at the
    // instant our own insert fails — a short bounded retry, not a single
    // re-read, is what makes this safe rather than merely usually-safe.
    for (let attempt = 0; attempt < 10; attempt++) {
      const winner = await repos.teachers.findAssignmentCompatibilityBridge(classSubjectId)
      if (winner) return { classSubjectId, teacherClassId: winner.teacherClassId, legacyTeacherId: teacher.id, gradeNumber }
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    throw new Error(
      `ensureAssignmentCompatibilityClass: bridge claimed concurrently for ${classSubjectId} but no row found after retrying re-read.`
    )
  }
}
