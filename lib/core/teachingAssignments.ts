// lib/core/teachingAssignments.ts
//
// THE canonical answer to "what does this teacher teach?" — one function, one
// resolution chain, never re-derived by a route or a component.
//
//     auth user
//       → school_users   (role='teacher', is_active=true)   ← employment
//       → class_subjects (teacher_id = school_users.id)     ← assignment
//       → classes + subjects + schools                       ← institution
//
// WHAT THIS IS NOT
// It is not an authorization function. It answers "what has the school
// assigned to Peter", never "may Peter do X" — gating stays in
// lib/core/permissions.ts, and feature access stays in lib/payments/access.ts.
// A caller that treats a returned row as permission to write is misusing it.
//
// It is also not a payment check (Phase 5). Membership and assignment answer
// "what does Peter teach"; lib/core/schoolEntitlement.ts answers "is Peter
// school-covered". A teacher at a school whose entitlement has lapsed still
// genuinely teaches Grade 7 East — hiding the structural fact would tell them
// a lie about their own timetable to enforce a commercial state. The access
// gate remains authoritative for gated ACTIONS; it does not edit reality.
//
// WHY class_subjects AND NOT teacher_classes
// `teacher_classes` is the legacy teacher-owned private classroom: the teacher
// creates it, owns it, and names its subject as free text. It cannot express
// one class taught by several subject teachers — ordinary JSS reality — and a
// class row there disappears with its teacher. `class_subjects` is school-
// owned, admin-written, and keys `teacher_id` to a MEMBERSHIP (school_users.id)
// rather than a person, so an assignment ends when employment ends and the
// class survives. See docs/architecture/school-controlled-roster-and-teaching-
// assignment-audit.md §3/§6.
//
// A THIRD representation, `class_teachers`, also exists live (1 row, keyed to
// auth.users.id, no FK on class_id, no migration file in this repo). It is NOT
// canonical, is not read here, and is documented in the audit above. Do not
// extend it.

import { repos } from '@/lib/repositories'
import type { TeachingAssignment } from '@/types/core'

/**
 * Every teaching assignment currently held by this user, across every school
 * they actively teach at.
 *
 * `userId` must come from `auth.getUser()` — never from a request body, query
 * string, or any client-supplied `teacherId`/`schoolId`/`teacherMembershipId`.
 * The whole cross-school safety property (Phase 14) rests on this: the
 * membership set is derived from the authenticated user, so there is no
 * identifier a caller can pass that reaches another school's assignments.
 *
 * Returns [] for a Solo Teacher (no active teacher membership anywhere). That
 * is a normal state, not an error — see `resolveTeachingContext`.
 */
export async function listTeachingAssignmentsForUser(userId: string): Promise<TeachingAssignment[]> {
  return repos.teachers.listTeachingAssignmentsByUser(userId)
}

/** One subject, and every class this teacher teaches it to. */
export type TeachingSubjectGroup = {
  subjectId: string
  subjectName: string
  subjectCode: string
  classes: Array<{
    assignmentId: string
    classId: string
    className: string
    gradeName: string | null
    streamName: string | null
    schoolId: string
    schoolName: string
  }>
}

/**
 * The same assignments, grouped subject-first — the shape the teacher-facing
 * "My Teaching" surface renders:
 *
 *     Mathematics
 *       Grade 7 East
 *       Grade 8 North
 *     Integrated Science
 *       Grade 9 East
 *
 * Grouping happens here, once, rather than in the component, so the ordering
 * rule is testable and every surface that shows assignments agrees. Subjects
 * are ordered by name and classes within a subject by class name — a stable,
 * alphabetical order, because there is no meaningful institutional ranking
 * between two classes a teacher teaches and an unstable order would make the
 * dashboard reshuffle between reloads.
 */
export function groupAssignmentsBySubject(assignments: TeachingAssignment[]): TeachingSubjectGroup[] {
  const bySubject = new Map<string, TeachingSubjectGroup>()

  for (const a of assignments) {
    let group = bySubject.get(a.subjectId)
    if (!group) {
      group = { subjectId: a.subjectId, subjectName: a.subjectName, subjectCode: a.subjectCode, classes: [] }
      bySubject.set(a.subjectId, group)
    }
    group.classes.push({
      assignmentId: a.assignmentId,
      classId:      a.classId,
      className:    a.className,
      gradeName:    a.gradeName,
      streamName:   a.streamName,
      schoolId:     a.schoolId,
      schoolName:   a.schoolName,
    })
  }

  const groups = Array.from(bySubject.values())
  groups.sort((x, y) => x.subjectName.localeCompare(y.subjectName))
  for (const g of groups) g.classes.sort((x, y) => x.className.localeCompare(y.className))
  return groups
}

// ── Context resolution (Phase 7 / Phase 8) ──────────────────────────────────

/**
 * Which workspace this user belongs in.
 *
 * Derived entirely from signals that already exist — an active `school_users`
 * teacher membership, and whether the school has assigned them anything. No
 * new role flag, no new column, no new profile field: the mission's Phase 7
 * rule is that if the current signals are sufficient, nothing new is invented,
 * and they are.
 *
 *  - `school`      — active membership AND at least one assignment. Reads
 *                    institutional assignments.
 *  - `school_unassigned` — active membership, zero assignments. This is the
 *                    state Phase 8 exists for: it must NOT silently fall back
 *                    to `teacher_classes` and present private classes as if
 *                    the school had assigned them. That would hide an
 *                    administrative gap and recreate dual truth.
 *  - `solo`        — no active teacher membership anywhere. Existing personal
 *                    planning behaviour is untouched and remains correct.
 */
export type TeachingContext =
  | { kind: 'school'; assignments: TeachingAssignment[]; groups: TeachingSubjectGroup[] }
  | { kind: 'school_unassigned'; schoolIds: string[] }
  | { kind: 'solo' }

export async function resolveTeachingContext(userId: string): Promise<TeachingContext> {
  const assignments = await listTeachingAssignmentsForUser(userId)

  if (assignments.length > 0) {
    return { kind: 'school', assignments, groups: groupAssignmentsBySubject(assignments) }
  }

  // Zero assignments is ambiguous on its own — it means either "no school" or
  // "school, nothing assigned yet", and those need opposite empty states
  // (Phase 19). Distinguishing them requires the membership question asked
  // directly, since listTeachingAssignmentsForUser collapses both to [].
  const memberships = await repos.teachers.listActiveTeacherMembershipSchoolIds(userId)
  if (memberships.length > 0) return { kind: 'school_unassigned', schoolIds: memberships }

  return { kind: 'solo' }
}
