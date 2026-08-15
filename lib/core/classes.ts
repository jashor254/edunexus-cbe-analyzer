import { repos } from '@/lib/repositories'
import type { ClassWithDetails, Stream, Grade } from '@/types/core'
import { SCHOOL_ADMIN_ROLES } from '@/lib/core/permissions'
import { SchoolMismatchError } from '@/lib/core/errors'

// ── Grades catalogue ──────────────────────────────────────────────────────────

export async function listGrades(): Promise<Grade[]> {
  return repos.teachers.listGrades()
}

// ── Streams ───────────────────────────────────────────────────────────────────

export async function listStreams(schoolId: string): Promise<Stream[]> {
  return repos.teachers.listStreams(schoolId)
}

export async function createStream(schoolId: string, name: string): Promise<Stream> {
  return repos.teachers.insertStream(schoolId, name)
}

// ── Classes ───────────────────────────────────────────────────────────────────

export async function listClasses(
  schoolId: string,
  academicYearId?: string
): Promise<ClassWithDetails[]> {
  return repos.teachers.listClasses(schoolId, academicYearId)
}

export async function getClass(classId: string, schoolId: string): Promise<ClassWithDetails> {
  return repos.teachers.findClassById(classId, schoolId)
}

export async function createClass(
  schoolId: string,
  input: {
    grade_id: string
    stream_id?: string
    academic_year_id: string
    class_teacher_id?: string
    capacity?: number
    display_name: string
  }
): Promise<ClassWithDetails> {
  return repos.teachers.insertClass(schoolId, input)
}

export async function updateClass(
  classId: string,
  schoolId: string,
  updates: { class_teacher_id?: string; capacity?: number; display_name?: string }
): Promise<ClassWithDetails> {
  return repos.teachers.updateClass(classId, schoolId, updates)
}

// ── Class → Subject → Teacher assignment ─────────────────────────────────────

/**
 * Assigns a teacher to a subject in a class, closing the outgoing teacher's
 * tenure rather than overwriting it.
 *
 * `teacherId` is a `school_users.id` — the membership, not the person.
 *
 * Returns what actually happened so a caller can word its confirmation
 * honestly ("replaced Peter" vs "assigned" vs "already assigned").
 *
 * Phase 1 self-serve onboarding, Task 5 — the caller (POST /api/core/
 * subjects, action=assign-teacher) only verifies the admin's OWN membership
 * in `schoolId` via requireSchoolAdmin; `classId` and `teacherId` arrive as
 * free client input with nothing else checking they belong to that same
 * school. Before this, an admin at School A supplying School B's classId
 * and a School B school_users.id could write a class_subjects row whose
 * school_id, class_id and teacher's real school disagreed — a real
 * cross-tenant write, even though its blast radius was bounded (the
 * assignment only ever surfaces on the victim teacher's own "My Teaching",
 * which is filtered by their own membership ids). These two existence/
 * scoping checks close that, the same way requireSchoolAdmin already closes
 * the schoolId side.
 */
export async function assignSubjectTeacher(
  schoolId: string,
  classId: string,
  subjectId: string,
  teacherId: string
): Promise<{ replaced: boolean; unchanged: boolean }> {
  try {
    // Scoped by (classId, schoolId) already — throws if classId doesn't
    // exist at all, or exists but belongs to a different school.
    await repos.teachers.findClassById(classId, schoolId)
  } catch {
    throw new SchoolMismatchError('This class does not belong to your school.')
  }

  const teacherMembership = await repos.schools.findSchoolUserById(teacherId)
  if (!teacherMembership || teacherMembership.school_id !== schoolId) {
    throw new SchoolMismatchError('This teacher does not belong to your school.')
  }
  // Phase 2 correction: Phase 1 rejected ANY inactive membership here,
  // which correctly blocks a departed teacher but ALSO blocked assigning a
  // still-pending (invited, not yet accepted) teacher — and pre-assigning
  // a just-invited teacher's classes/subjects before they ever log in is
  // exactly the "admin creates, teacher consumes" ordering Phase 2 is
  // built around (lib/core/teacherOnboarding.ts's acceptTeacherInvitation
  // upserts the SAME school_users row in place, so an assignment made
  // while pending is still correctly attached once the row goes active —
  // nothing needs to be re-assigned). is_active is not a distinct-enough
  // signal to tell "pending" from "departed" (both are simply `false`),
  // so it is no longer checked here; school + role scoping remain the
  // real invariants.
  const canTeach = teacherMembership.role === 'teacher' || SCHOOL_ADMIN_ROLES.includes(teacherMembership.role)
  if (!canTeach) {
    throw new SchoolMismatchError('This membership does not hold a teaching-eligible role.')
  }

  return repos.teachers.assignClassSubjectTeacher(schoolId, classId, subjectId, teacherId)
}

/**
 * Every teacher who has held one class+subject post, newest first. Closed
 * tenures included.
 *
 * Phase 9 — this function existed with zero HTTP caller and, unlike every
 * other class_subjects reader here, took no `schoolId` and did no ownership
 * check: nothing stopped a caller who had merely proven membership at their
 * OWN school from passing a `classId` belonging to a different school and
 * reading its teaching history. Scoped now, on its first real wiring, the
 * same way assignSubjectTeacher already scopes classId.
 */
export async function getClassSubjectHistory(schoolId: string, classId: string, subjectId: string): Promise<Array<{
  id: string
  teacherId: string
  startedAt: string
  endedAt: string | null
}>> {
  try {
    await repos.teachers.findClassById(classId, schoolId)
  } catch {
    throw new SchoolMismatchError('This class does not belong to your school.')
  }
  return repos.teachers.listClassSubjectHistory(classId, subjectId)
}

export async function listClassSubjects(classId: string): Promise<Array<{
  id: string
  subject_id: string
  teacher_id: string
  subjects: { id: string; name: string; code: string }
}>> {
  return repos.teachers.listClassSubjects(classId)
}
