// lib/core/academicActivation.ts
//
// Sprint 9E — the consolidated academic-readiness report: does an
// activated school (9B) with onboarded teachers (9C) and enrolled learners
// (9D) actually have a coherent academic structure to teach inside? This
// module is read-only — it verifies and resolves, it creates nothing
// (matching Part 2's own verbs: "verify," "resolve," "return"). Every
// figure comes from an existing lib/core/*.ts function; no direct
// Supabase query was added here beyond the one genuinely-missing batched
// repository method (findUserIdsWithTeacherRecord — CLAUDE.md's
// "batch with .in()", not a query-per-teacher loop).
//
// Scope boundary, explicit per the sprint's own instruction: this module
// never creates an assessment, evidence row, projection, or report card —
// eligibleForAssessment/eligibleForCompass stay false here, exactly as
// Sprint 9D left them. That connection is Sprint 9F's stated scope.
//
// One honest finding this module surfaces rather than works around
// silently (documented fully in docs/engineering/implementation-log.md's
// Sprint 9E entry): lib/core/schoolActivation.ts's ensureAcademicYear/
// ensureDefaultTerms never call setCurrentAcademicYear/setCurrentTerm, so
// getCurrentAcademicYear()/getCurrentTerm() (both is_current-only) return
// null for every school activated purely through Sprint 9B's pipeline.
// resolveActiveAcademicYear/resolveActiveTerm below therefore reuse the
// exact same "is_current row, else the first row" fallback
// getSchoolActivationStatus() (lib/core/schoolActivation.ts) already
// established — not a new rule, the same one, applied consistently, so
// "academic year active" doesn't spuriously report false for every real
// activated school in the system.

import {
  listAcademicYears,
  listTerms,
} from '@/lib/core/school'
import { listGrades, listClasses } from '@/lib/core/classes'
import { listGradeSubjects } from '@/lib/core/subjects'
import { listSchoolUsers } from '@/lib/core/school-users'
import { getClassRoster } from '@/lib/core/learners'
import { getSchoolActivationStatus, type SchoolActivationStatus } from '@/lib/core/schoolActivation'
import { repos } from '@/lib/repositories'
import type { AcademicYear, Term, Grade, ClassWithDetails } from '@/types/core'

// ── Small resolvers (Part 2: "resolve active year" / "resolve active term") ─

export type ResolvedOrNot<T> =
  | { resolved: true; value: T; reason?: undefined }
  | { resolved: false; value: null; reason: string }

/** Same fallback as getSchoolActivationStatus(): the is_current row if one exists, else the first (most recent) row. See module header for why. */
export async function resolveActiveAcademicYear(schoolId: string): Promise<ResolvedOrNot<AcademicYear>> {
  const years = await listAcademicYears(schoolId)
  if (years.length === 0) return { resolved: false, value: null, reason: 'No academic year exists for this school.' }
  const current = years.find(y => y.is_current) ?? years[0]
  return { resolved: true, value: current }
}

export async function resolveActiveTerm(schoolId: string, academicYearId: string): Promise<ResolvedOrNot<Term>> {
  const terms = await listTerms(schoolId, academicYearId)
  if (terms.length === 0) return { resolved: false, value: null, reason: 'No term exists for the active academic year.' }
  const current = terms.find(t => t.is_current) ?? terms[0]
  return { resolved: true, value: current }
}

// ── Subject readiness (Part 3 — Core's grade_subjects, the RAS §3-named canonical source; no redesign) ──

export type SubjectReadinessByGrade = {
  gradeId: string
  gradeName: string
  subjectCount: number
  hasSubjects: boolean
}

export type SubjectReadiness = {
  byGrade: SubjectReadinessByGrade[]
  allGradesInUseHaveSubjects: boolean
  reason?: string
}

/**
 * Resolves subject readiness for every grade the school actually has a
 * class in (not every grade in the global catalogue — a primary-only
 * school with no senior-secondary class shouldn't be marked "missing
 * subjects" for grades it doesn't teach). Reads Core's `grade_subjects`
 * exclusively — RAS §3 already names `subjects`/`SubjectRepository` as the
 * canonical Subject-domain source; the hardcoded lib/curriculum/subjects.ts
 * catalogue and SOW's `sow_learning_areas` (Sprint 6D/6B's documented
 * three/four-way duplication) are pre-existing, out-of-scope dependencies
 * this function does not read, reconcile, or migrate.
 */
export async function resolveSubjectReadiness(schoolId: string, classes: ClassWithDetails[]): Promise<SubjectReadiness> {
  const gradeIds = [...new Set(classes.map(c => c.grade_id).filter((id): id is string => !!id))]
  if (gradeIds.length === 0) {
    return { byGrade: [], allGradesInUseHaveSubjects: false, reason: 'No classes exist yet, so no grade has a resolvable subject requirement.' }
  }

  const byGrade: SubjectReadinessByGrade[] = []
  for (const gradeId of gradeIds) {
    const gradeSubjects = await listGradeSubjects(schoolId, gradeId)
    const gradeName = classes.find(c => c.grade_id === gradeId)?.grades?.name ?? gradeId
    byGrade.push({ gradeId, gradeName, subjectCount: gradeSubjects.length, hasSubjects: gradeSubjects.length > 0 })
  }

  const allGradesInUseHaveSubjects = byGrade.every(g => g.hasSubjects)
  return {
    byGrade,
    allGradesInUseHaveSubjects,
    reason: allGradesInUseHaveSubjects
      ? undefined
      // Sprint C0 Task 2 — this string reaches a school admin's screen
      // directly (app/teacher/core-office/academic/page.tsx's Subjects
      // StructureRow, app/teacher/core-office/page.tsx's Startup
      // checklist), not just a developer log. It previously named internal
      // function/file references, which is exactly the "tribal knowledge"
      // this task exists to remove — reworded to describe the required
      // action in the admin's own terms; the UI now pairs this with a
      // one-click "Set up default subjects" button rather than relying on
      // the admin to know what to do with the message.
      : `${byGrade.filter(g => !g.hasSubjects).length} of ${byGrade.length} grade(s) in use don't have subjects set up yet.`,
  }
}

// ── Teacher readiness, school-wide (Part 4) ──────────────────────────────────

export type SchoolTeacherReadiness = {
  totalTeacherMemberships: number
  activeTeacherMemberships: number
  teachersWithCanonicalIdentity: number
  allActiveTeachersHaveCanonicalIdentity: boolean
  reason?: string
}

/**
 * Read-only, school-wide. Does not resolve per-teacher class/subject
 * assignment eligibility individually (that's
 * lib/core/teacherOnboarding.ts::getTeacherReadiness, reused as-is for a
 * single teacher) — this reports the aggregate shape: how many teachers
 * exist, how many are active, how many have the ADR-0002 canonical
 * `teachers` row that class/subject assignment and assessment ownership
 * both require. Batched — one query for the whole school
 * (findUserIdsWithTeacherRecord), not one per teacher.
 */
export async function getSchoolTeacherReadiness(schoolId: string): Promise<SchoolTeacherReadiness> {
  const memberships = await listSchoolUsers(schoolId, 'teacher')
  const active = memberships.filter(m => m.is_active)
  const withIdentity = await repos.teachers.findUserIdsWithTeacherRecord(active.map(m => m.user_id))

  const allActiveTeachersHaveCanonicalIdentity = active.length > 0 && withIdentity.length === active.length
  return {
    totalTeacherMemberships: memberships.length,
    activeTeacherMemberships: active.length,
    teachersWithCanonicalIdentity: withIdentity.length,
    allActiveTeachersHaveCanonicalIdentity,
    reason: active.length === 0
      ? 'No active teacher memberships — invite and accept at least one teacher (lib/core/teacherOnboarding.ts).'
      : allActiveTeachersHaveCanonicalIdentity
        ? undefined
        : `${active.length - withIdentity.length} of ${active.length} active teacher(s) have not completed onboarding (school_users active but no teachers row) — class/subject assignment eligibility is per-teacher, see getTeacherReadiness().`,
  }
}

// ── Learner readiness, school-wide (Part 5) ──────────────────────────────────

export type SchoolLearnerReadiness = {
  totalClasses: number
  classesWithEnrolledLearners: number
  enrolledLearnerCount: number
  allClassesHaveLearners: boolean
  reason?: string
}

/**
 * Read-only, school-wide, scoped to one term. Loops over the school's
 * classes (typically a handful — the same bounded-loop shape
 * lib/core/schoolActivation.ts::ensureClasses already uses for grade×stream
 * combinations, not a per-learner loop) calling the existing
 * getClassRoster() per class — Part 5's exact "existing class query,"
 * reused rather than a new aggregate query invented to replace it.
 */
export async function getSchoolLearnerReadiness(classes: ClassWithDetails[], termId: string): Promise<SchoolLearnerReadiness> {
  if (classes.length === 0) {
    return { totalClasses: 0, classesWithEnrolledLearners: 0, enrolledLearnerCount: 0, allClassesHaveLearners: false, reason: 'No classes exist yet.' }
  }

  let enrolledLearnerCount = 0
  let classesWithEnrolledLearners = 0
  for (const cls of classes) {
    const roster = await getClassRoster(cls.id, termId)
    enrolledLearnerCount += roster.length
    if (roster.length > 0) classesWithEnrolledLearners += 1
  }

  const allClassesHaveLearners = classesWithEnrolledLearners === classes.length
  return {
    totalClasses: classes.length,
    classesWithEnrolledLearners,
    enrolledLearnerCount,
    allClassesHaveLearners,
    reason: enrolledLearnerCount === 0
      ? 'No learners enrolled for this term yet (lib/core/learnerOnboarding.ts::onboardLearner).'
      : allClassesHaveLearners
        ? undefined
        : `${classes.length - classesWithEnrolledLearners} of ${classes.length} class(es) have no learner enrolled for this term.`,
  }
}

// ── The consolidated report (Part 6) ─────────────────────────────────────────

export type SchoolAcademicReadiness = {
  schoolId: string
  activationStatus: SchoolActivationStatus
  academicYear: ResolvedOrNot<AcademicYear>
  term: ResolvedOrNot<Term>
  grades: { count: number; inUse: number }
  classes: { count: number }
  subjects: SubjectReadiness
  teachers: SchoolTeacherReadiness
  learners: SchoolLearnerReadiness
  overallReady: boolean
  blockingReasons: string[]
}

/**
 * The one consolidated readiness report Part 6 asks for. Orchestrates
 * existing functions from Sprints 9B/9C/9D plus this module's own small
 * resolvers/aggregators — no assessment, evidence, projection, or report
 * card is read or written. `overallReady` is true only when every
 * prerequisite the Target Workflow names (year → terms → subjects →
 * teachers → classes → learners) actually resolves; `blockingReasons`
 * collects every individual reason, so a caller never has to re-derive
 * "why isn't this school ready" from the sub-reports by hand.
 */
export async function getSchoolAcademicReadiness(schoolId: string): Promise<SchoolAcademicReadiness> {
  const activationStatus = await getSchoolActivationStatus(schoolId)
  const academicYear = await resolveActiveAcademicYear(schoolId)

  const term: ResolvedOrNot<Term> = academicYear.resolved
    ? await resolveActiveTerm(schoolId, academicYear.value.id)
    : { resolved: false, value: null, reason: 'Cannot resolve a term without an academic year.' }

  const allGrades = await listGrades()
  const classes = academicYear.resolved ? await listClasses(schoolId, academicYear.value.id) : []
  const gradesInUse = new Set(classes.map(c => c.grade_id).filter(Boolean)).size

  const subjects = await resolveSubjectReadiness(schoolId, classes)
  const teachers = await getSchoolTeacherReadiness(schoolId)
  const learners: SchoolLearnerReadiness = term.resolved
    ? await getSchoolLearnerReadiness(classes, term.value.id)
    : { totalClasses: classes.length, classesWithEnrolledLearners: 0, enrolledLearnerCount: 0, allClassesHaveLearners: false, reason: 'Cannot resolve enrollment without an active term.' }

  const blockingReasons: string[] = []
  if (!academicYear.resolved) blockingReasons.push(academicYear.reason)
  if (!term.resolved) blockingReasons.push(term.reason)
  if (classes.length === 0) blockingReasons.push('No classes exist yet.')
  if (subjects.reason) blockingReasons.push(subjects.reason)
  if (teachers.reason) blockingReasons.push(teachers.reason)
  if (learners.reason) blockingReasons.push(learners.reason)

  const overallReady =
    academicYear.resolved &&
    term.resolved &&
    classes.length > 0 &&
    subjects.allGradesInUseHaveSubjects &&
    teachers.allActiveTeachersHaveCanonicalIdentity &&
    learners.allClassesHaveLearners

  return {
    schoolId,
    activationStatus,
    academicYear,
    term,
    grades: { count: allGrades.length, inUse: gradesInUse },
    classes: { count: classes.length },
    subjects,
    teachers,
    learners,
    overallReady,
    blockingReasons,
  }
}
