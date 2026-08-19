// lib/core/assignmentDiscovery.ts
//
// PHASE 2 — Institutional Learner Portal Discovery.
//
// The read-side mirror of institutional assignment CREATION (Phase 1B/1C/1D):
// an authenticated institutional learner discovers the assignments issued to
// them WITHOUT depending on `students.user_id` for identity — that column is
// the legacy/Solo learner's own auth link, never populated for an
// institutional learner (their `students` row, if any, is a Phase 1C
// compatibility row: `students.external_id = learners.id`, `user_id` NULL).
//
// ============================================================================
// THE CHAIN (Step 12)
// ============================================================================
//   auth.getUser()
//     -> resolveAuthenticatedLearnerIdentity(userId)         [Phase 2B-resume, canonical, NOT duplicated here]
//     -> resolveAllCoreLearnersForAuthenticatedUser(userId)  [Phase 2B-resume, canonical, NOT duplicated here]
//     -> filter to CURRENT school-local learners.id records (status === 'active')
//     -> resolveLegacyStudentId per current record             [lib/core/identity.ts, canonical, NOT duplicated here]
//        (batched via repos.teachers.findLegacyStudentsByExternalIds — the
//        same batched primitive lib/core/assessments.ts already uses, never
//        a per-learner loop)
//     -> compatibility students.id[]
//     -> assignment_submissions (the recipient-materialization signal
//        fanOutPendingSubmissions already writes at assignment-creation
//        time — see lib/repositories/assignment.repository.ts's
//        findSubmissionsWithAssignmentsForStudents for the full rationale)
//     -> assignments (joined, status='active' only, mirrors legacy filter)
//     -> learner-facing projection (same shape legacy
//        app/api/student/assignments/route.ts has always returned)
//
// ============================================================================
// STEP 7/8 — ASSIGNMENT VISIBILITY POLICY (decision, not a guess — traced
// against the actual fan-out mechanism in lib/assignments/create.ts)
// ============================================================================
// `assignment_submissions` rows are created ONCE, at assignment-creation
// time, for exactly the students who were on the compatibility class's
// roster at that moment (`fanOutPendingSubmissions`, called immediately
// after `syncAssignmentCompatibilityRoster`). No later process ever adds or
// removes a submission row for an existing assignment. This makes submission
// existence a durable, precise, already-canonical eligibility signal:
//   - current teacher's assignment                                -> VISIBLE (fanned out to current roster)
//   - previous teacher's assignment, still active                 -> VISIBLE (fanned out while that teacher's tenure was current; a replacement's new tenure gets its OWN bridge/compatibility class, never touches the old one's submissions)
//   - previous teacher's overdue assignment                       -> VISIBLE (visibility is not gated on due date, matches legacy `isOverdue` being a projected flag, not a filter)
//   - completed / submitted / marked assignment                   -> VISIBLE (submission row carries the marked state through unchanged)
//   - assignment created BEFORE the learner joined the class       -> NOT VISIBLE (no submission row was ever fanned out to them)
//   - assignment created while enrolled, learner LATER transferred -> VISIBLE (their submission row is never deleted by a transfer or by a later roster sync of a DIFFERENT assignment's creation event)
//   - NEW assignment created AFTER the learner left/transferred    -> NOT VISIBLE (roster sync removes them from `class_students` before the next fan-out runs, so the new fan-out set excludes them)
// This is the "recipient eligibility as signal" approach Step 8 asks to
// evaluate against a class-based reconstruction — chosen deliberately because
// it is the ONLY option that is both already-canonical (no new membership
// table, no heuristic date math), and it is what actually already happens
// system-wide, not a policy invented for this phase.
//
// ============================================================================
// NON-NEGOTIABLE: no `students.user_id`, no compatibility-identity creation
// ============================================================================
// This module never reads `students.user_id`/`parent_user_id` (that is the
// Solo/legacy identity path, untouched — app/api/student/assignments/route.ts
// keeps its own, completely unchanged, self/parent branch). It never calls
// `ensureAssignmentCompatibilityStudent` / `ensureAssignmentCompatibilityClass`
// / `syncAssignmentCompatibilityRoster` — those are WRITES, teacher-side,
// invoked only at assignment-creation time. A learner whose institutional
// assignment exists but whose compatibility student mapping is somehow
// missing is a genuine integrity gap (Step 13) — this module skips such a
// learner record rather than silently provisioning one from a GET request.

import { repos } from '@/lib/repositories'
import {
  resolveAuthenticatedLearnerIdentity,
  resolveAllCoreLearnersForAuthenticatedUser,
} from '@/lib/core/learnerAccounts'

/**
 * Actor + institutional-context resolution (Step 11's first two concerns,
 * kept separate from assignment projection below). Returns the set of
 * Phase 1C compatibility `students.id` values this authenticated user is
 * currently, legitimately, an institutional learner behind — across every
 * school they currently have an active `learners` record at (Step 17,
 * multi-school active case).
 *
 * Returns an empty array — never throws, never guesses — for: no
 * `learner_accounts` row (Solo learner, teacher, guardian, unrelated user);
 * a suspended account; or an active account whose school-local learner
 * record(s) have no compatibility student mapping yet (Step 13 — an
 * institutional learner with no institutional assignment history yet has
 * legitimately never been fanned into anything).
 *
 * Step 4/5 design decision, traced not guessed: this deliberately does
 * NOT filter `resolveAllCoreLearnersForAuthenticatedUser`'s rows down to
 * `status === 'active'` before resolving compatibility students. Every
 * school-local `learners.id` this identity has EVER held (active,
 * transferred, graduated, archived alike) keeps its own permanent Phase 1C
 * compatibility student (`students.external_id = learners.id`, never
 * rewritten by a transfer). Including all of them costs nothing extra in
 * risk: the actual visibility boundary is `assignment_submissions`
 * existence (see `listAssignmentsForAuthenticatedLearner`'s header), which
 * is already scoped to whoever was genuinely on a class roster at
 * assignment-creation time — a transferred-out learner's OLD school stops
 * fanning them into anything the moment roster sync next runs, with or
 * without this filter. Filtering to 'active' here would instead have
 * ACTIVELY HIDDEN the one case Step 7/15 explicitly calls out as needing to
 * remain visible: "assignment created while enrolled, learner later
 * transferred" — their compatibility student (and its historical
 * `assignment_submissions` rows) belongs to the now-'transferred' record,
 * which an active-only filter would have excluded entirely.
 *
 * Reusable by any learner-portal read that needs "which compatibility
 * student ids may this authenticated user currently or historically act
 * as" — the assignment list below, and the per-assignment direct-read
 * gates in the question/resource routes (Step 23/25).
 */
export async function resolveInstitutionalCompatibilityStudentIds(userId: string): Promise<string[]> {
  const learnerIdentityId = await resolveAuthenticatedLearnerIdentity(userId)
  if (!learnerIdentityId) return []

  const allRecords = await resolveAllCoreLearnersForAuthenticatedUser(userId)
  if (allRecords.length === 0) return []

  // Batched — the same primitive lib/core/assessments.ts's computeTermSummaries
  // uses to resolve a whole roster's bridges at once, never a per-learner loop.
  const bridged = await repos.teachers.findLegacyStudentsByExternalIds(allRecords.map(r => r.id))
  return bridged.map(row => row.id)
}

/**
 * Phase 3A — Part C. Resolves the SINGLE compatibility `students.id`
 * belonging to this identity's CURRENTLY active school-local learner
 * record — for surfaces that need a "who is this learner right now"
 * profile (grade/school/name to feed the existing legacy-keyed
 * assessments/compass_sessions/projection queries), as distinct from
 * {@link resolveInstitutionalCompatibilityStudentIds}'s deliberately
 * broader "every compatibility student this identity has ever held," which
 * exists for durable assignment/resource READ eligibility, not identity.
 *
 * Returns `null` — never throws — for: no learner account; no currently
 * active school-local record; or an active record with no compatibility
 * student mapping yet (same "genuine, not-yet-fanned-out" case
 * {@link resolveInstitutionalCompatibilityStudentIds}'s header documents).
 *
 * If more than one school-local record is currently active (a multi-school
 * active learner), the first is used — a documented simplification for a
 * "pick one current profile to show" question, never an authorization
 * decision; nothing downstream of this treats the choice as anything but
 * "a" current profile.
 */
export async function resolveCurrentInstitutionalCompatibilityStudentId(userId: string): Promise<string | null> {
  const learnerIdentityId = await resolveAuthenticatedLearnerIdentity(userId)
  if (!learnerIdentityId) return null

  const allRecords = await resolveAllCoreLearnersForAuthenticatedUser(userId)
  const activeRecords = allRecords.filter(r => r.status === 'active')
  if (activeRecords.length === 0) return null

  const bridged = await repos.teachers.findLegacyStudentsByExternalIds(activeRecords.map(r => r.id))
  return bridged[0]?.id ?? null
}

export type LearnerAssignmentListItem = {
  id: string
  class_id: string
  title: string
  topic: string
  instructions: string
  type: string
  is_compass_guided: boolean | null
  is_quiz: boolean
  max_score: number | null
  due_date: string
  status: string
  created_at: string
  teacher_classes: { name: string | null; grade: number | null; subject: string | null } | null
  teachers: { full_name: string | null } | null
  submission: {
    id: string
    assignment_id: string
    status: string
    score: number | null
    submitted_at: string | null
    marked_at: string | null
  } | null
  submissionStatus: string
  daysLeft: number
  isOverdue: boolean
}

function projectSubmissionRow(row: {
  id: string
  assignment_id: string
  student_id: string
  status: string
  score: number | null
  submitted_at: string | null
  marked_at: string | null
  assignments: LearnerAssignmentListItem
}): LearnerAssignmentListItem {
  const a = row.assignments
  const submission = {
    id: row.id,
    assignment_id: row.assignment_id,
    status: row.status,
    score: row.score,
    submitted_at: row.submitted_at,
    marked_at: row.marked_at,
  }
  const now = new Date()
  const daysLeft = Math.ceil((new Date(a.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return {
    id: a.id,
    class_id: a.class_id,
    title: a.title,
    topic: a.topic,
    instructions: a.instructions,
    type: a.type,
    is_compass_guided: a.is_compass_guided,
    is_quiz: a.is_quiz,
    max_score: a.max_score,
    due_date: a.due_date,
    status: a.status,
    created_at: a.created_at,
    teacher_classes: a.teacher_classes,
    teachers: a.teachers,
    submission,
    submissionStatus: submission.status || 'pending',
    daysLeft,
    isOverdue: daysLeft < 0 && submission.status === 'pending',
  }
}

/**
 * Step 11's assignment-projection concern — the domain function the
 * `/api/student/assignments` route calls for the institutional branch only
 * (Step 3: institutional takes precedence over the legacy self/parent
 * fallback when an active learner account exists; the legacy branch itself
 * is completely untouched — see the route for the precedence gate).
 *
 * One primary query (Step 21 — low-connectivity): a single joined
 * `assignment_submissions` -> `assignments` -> `teacher_classes`/`teachers`
 * read, already batched across every compatibility student id this
 * identity currently holds (Step 17's multi-school case falls out for
 * free — no per-school loop).
 */
export async function listAssignmentsForAuthenticatedLearner(userId: string): Promise<LearnerAssignmentListItem[]> {
  const studentIds = await resolveInstitutionalCompatibilityStudentIds(userId)
  if (studentIds.length === 0) return []

  const rows = await repos.assignments.findSubmissionsWithAssignmentsForStudents(studentIds)
  return rows.map(row => projectSubmissionRow(row as unknown as Parameters<typeof projectSubmissionRow>[0]))
}

/**
 * Step 23/24 — the per-assignment READ-authorization check for direct
 * detail/question/resource routes. Institutional-only counterpart to each
 * route's own legacy self/parent check (never replaces it — routes keep
 * their existing legacy branch and add this as an additional, independent
 * OR path). Returns the compatibility `students.id` allowed to read this
 * specific assignment, or `null` if this authenticated user has no
 * institutional recipient relationship with it.
 *
 * Deliberately does NOT trust a client-supplied studentId/learnerId (Step
 * 10) — everything here is derived from `userId` (the verified
 * `auth.getUser()` subject) and the assignment's own `id`/`class_id`.
 */
export async function resolveInstitutionalAssignmentReadAccess(
  userId: string,
  assignmentId: string
): Promise<{ studentId: string } | null> {
  const studentIds = await resolveInstitutionalCompatibilityStudentIds(userId)
  if (studentIds.length === 0) return null

  const submission = await repos.assignments.findSubmissionForStudentsAndAssignment(studentIds, assignmentId)
  if (!submission) return null
  return { studentId: submission.student_id }
}
