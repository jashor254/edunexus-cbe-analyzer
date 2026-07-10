// lib/compass/ownership.ts
// The one place Compass decides who may act on a given learner's data.
//
// Consolidates six previously-independent ownership checks found across
// app/api/learn/* and app/api/teacher/*/compass* (Compass v2 Wave 1,
// Phase 2 audit — see docs/architecture/compass-v2-implementation-roadmap.md
// Phases 3-6): a teacher may act via direct `students.teacher_id` link OR
// class-roster membership; a parent or self-login student may act via
// `students.parent_user_id` / `students.user_id`. A session additionally
// must be verified to actually belong to the student it's claimed for.
//
// Scope: legacy schema only (`students`, `class_students`, `teacher_classes`).
// Core identity convergence is Migration Strategy Phase 11 — out of scope here.

import { repos } from '@/lib/repositories'

export type OwnershipVia = 'teacher_roster' | 'teacher_direct' | 'parent' | 'learner'

export type OwnershipResult =
  | { allowed: true;  via: OwnershipVia }
  | { allowed: false }

const DENIED: OwnershipResult = { allowed: false }

// ── Teacher ──────────────────────────────────────────────────────────────────
// Grants access if the authenticated user is a teacher with EITHER a direct
// `students.teacher_id` link OR the student is on one of their class rosters.
// Previously these were two separate, mutually-inconsistent checks (the class
// tab recognized roster-only; the topic picker recognized direct-link only).
// A teacher now needs only one relationship, not both.
export async function resolveTeacherOwnership(userId: string, studentId: string): Promise<OwnershipResult> {
  const teacher = await repos.teachers.findTeacherByUserId(userId)
  if (!teacher) return DENIED

  const student = await repos.compass.findStudentOwnership(studentId)
  if (!student) return DENIED

  if (student.teacher_id === teacher.id) return { allowed: true, via: 'teacher_direct' }

  const classes = await repos.schools.findTeacherClasses([teacher.id])
  if (classes.length === 0) return DENIED

  const classIds = classes.map(c => c.id)
  const roster = await repos.schools.findClassStudents(classIds)
  const onRoster = roster.some(r => r.student_id === studentId)

  return onRoster ? { allowed: true, via: 'teacher_roster' } : DENIED
}

// ── Parent ───────────────────────────────────────────────────────────────────
export async function resolveParentOwnership(userId: string, studentId: string): Promise<OwnershipResult> {
  const student = await repos.compass.findStudentOwnership(studentId)
  if (!student) return DENIED
  return student.parent_user_id === userId ? { allowed: true, via: 'parent' } : DENIED
}

// ── Learner (self-login student) ────────────────────────────────────────────
export async function resolveLearnerOwnership(userId: string, studentId: string): Promise<OwnershipResult> {
  const student = await repos.compass.findStudentOwnership(studentId)
  if (!student) return DENIED
  return student.user_id === userId ? { allowed: true, via: 'learner' } : DENIED
}

// ── Session ──────────────────────────────────────────────────────────────────
// Confirms a given compass_sessions row actually belongs to the student the
// caller is otherwise authorized for. Distinct from student ownership: a user
// authorized for student A must not be able to act on student B's session by
// supplying student A's studentId alongside student B's sessionId.
export async function resolveSessionOwnership(sessionId: string, studentId: string): Promise<boolean> {
  const learnerId = await repos.compass.findSessionLearnerId(sessionId)
  return learnerId !== null && learnerId === studentId
}

// ── Combined student-access resolver ────────────────────────────────────────
// The single call Compass routes make to decide "can this authenticated user
// act on this student's Compass data at all" — teacher, parent, and learner
// relationships are all independent access modes onto the same student row,
// per Compass v2 Design §2/P2. Checked in this order only because teacher
// access is the platform's primary use case; any one match is sufficient.
export async function resolveCompassStudentAccess(userId: string, studentId: string): Promise<OwnershipResult> {
  const teacher = await resolveTeacherOwnership(userId, studentId)
  if (teacher.allowed) return teacher

  const parent = await resolveParentOwnership(userId, studentId)
  if (parent.allowed) return parent

  const learner = await resolveLearnerOwnership(userId, studentId)
  if (learner.allowed) return learner

  return DENIED
}
