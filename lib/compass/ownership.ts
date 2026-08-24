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
import { resolveInstitutionalCompatibilityStudentIds } from '@/lib/core/assignmentDiscovery'
import { resolveParent } from '@/lib/core/identity'

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
//
// Parent Portal Phase P2 (Compass / Learner-Action Access Boundary Audit) —
// this used to check ONLY `students.parent_user_id`, the same legacy-only
// shape P1 already found and fixed for /api/student/{resources,materials,
// calendar,announcements} (see resolveFamilyStudentIds's header,
// lib/core/identity.ts). An institutional-only guardian (linked solely via
// `learner_guardians`, never `students.parent_user_id`) got a silent 403
// here on Progress/Holiday/Compass — the same bug class, just not yet
// audited on this boundary. Fixed the same way: bridge `resolveParent`'s
// `coreLearnerIds` back to the Phase 1C compatibility `students.id` space
// via the existing `findLegacyStudentsByExternalIds` primitive, exactly as
// `resolveFamilyStudentIds` does — but scoped to ONE studentId rather than
// returning the whole family list, since this function is a per-student
// ownership check, not a listing.
//
// Deliberately does NOT reuse `resolveFamilyStudentIds` wholesale: that
// function unions in the caller's OWN self/institutional-self ids too
// (branch 1 and 2), which would make a learner's own login satisfy the
// PARENT check here and get misreported as `via: 'parent'` — the actor
// model (Phase P2 Step 4) depends on this function answering "is this
// person someone else's guardian," not "is this person related to this
// student at all." Self access is `resolveLearnerOwnership`'s job alone.
export async function resolveParentOwnership(userId: string, studentId: string): Promise<OwnershipResult> {
  const student = await repos.compass.findStudentOwnership(studentId)
  if (!student) return DENIED
  if (student.parent_user_id === userId) return { allowed: true, via: 'parent' }

  const parent = await resolveParent(userId)
  if (parent.coreLearnerIds.length === 0) return DENIED

  const bridged = await repos.teachers.findLegacyStudentsByExternalIds(parent.coreLearnerIds)
  return bridged.some(row => row.id === studentId) ? { allowed: true, via: 'parent' } : DENIED
}

// ── Learner (self-login student) ────────────────────────────────────────────
//
// Phase 1 (Institutional Identity Convergence, Compass/Career entry
// convergence): also grants access via the institutional Phase 1C
// compatibility bridge (`resolveInstitutionalCompatibilityStudentIds`,
// lib/core/assignmentDiscovery.ts — already the canonical resolver Home
// and Assignments use for this exact bridge, reused here rather than
// duplicated). Legacy self-login (`students.user_id === userId`) is
// checked first and unchanged; the institutional check only runs as a
// fallback, so a legacy/Solo learner's existing behavior never changes.
export async function resolveLearnerOwnership(userId: string, studentId: string): Promise<OwnershipResult> {
  const student = await repos.compass.findStudentOwnership(studentId)
  if (!student) return DENIED
  if (student.user_id === userId) return { allowed: true, via: 'learner' }

  const institutionalIds = await resolveInstitutionalCompatibilityStudentIds(userId)
  return institutionalIds.includes(studentId) ? { allowed: true, via: 'learner' } : DENIED
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

// ── Mutation-only access (Parent Portal Phase P2) ───────────────────────────
//
// `resolveCompassStudentAccess` above answers "may this user READ/act-adjacent
// to this student's Compass data at all" and is correct as-is for the
// genuinely read-only surfaces (`/api/learn/progress`, `/api/holiday/mine`,
// the `/api/learn/student` subject picker). It is NOT the right check for
// the two routes that actually WRITE learner-attributed state — a full
// Compass tutoring turn (`/api/learn` POST: transcript, session state,
// `student_learning_context`, and ultimately `learner_evidence` via
// `recordCompassSessionEvidence`) and session completion (`/api/learn/end`
// POST: XP, `ending_level`, the Learner Model write, and the same Evidence
// emission). P0 (§10/§24/§29) found a parent-authenticated caller passes
// the combined check identically to the learner and can drive both routes
// end-to-end; the resulting Evidence and XP land attributed to the LEARNER
// alone — `initiatedBy` is recorded only on the `ingestion_run`, never as a
// discriminating `evidence_source` — indistinguishable from the learner's
// own work anywhere Projection or the Learner Model reads it.
//
// Policy decision (P2 Option A — VIEW ONLY, see
// docs/architecture/parent-portal-p2-compass-actor-boundary.md): a parent
// may observe a child's Compass progress but may not perform learner
// interactions that mint learner-attributed Evidence or XP. Compass has no
// existing parent-mediated-interaction product surface to preserve (no
// route, page, or copy anywhere invites a parent to run a tutoring turn
// themselves — the parent-facing entry points are Progress and Holiday,
// both already read-only), so the smallest correct fix is narrowing WHO may
// invoke the two write routes, not adding a new actor-provenance model.
//
// Teacher and learner-self are unchanged (a teacher legitimately drives a
// diagnostic/demo session; a learner drives their own). Parent is excluded
// outright — not "parent minus something," a straight omission of the
// parent branch above.
export async function resolveCompassMutationAccess(userId: string, studentId: string): Promise<OwnershipResult> {
  const teacher = await resolveTeacherOwnership(userId, studentId)
  if (teacher.allowed) return teacher

  const learner = await resolveLearnerOwnership(userId, studentId)
  if (learner.allowed) return learner

  return DENIED
}
