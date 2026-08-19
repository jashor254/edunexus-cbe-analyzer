// lib/assignments/create.ts
//
// Canonical assignment-creation service (Blueprint Living Action Plan Phase
// 2A — docs/architecture/assignment-creation-service-phase2a.md). Extracted
// from app/api/teacher/assignments/route.ts, which remains this service's
// only production caller. Owns actor resolution, class-ownership
// authorization, the adaptive/quiz status derivation, the assignments
// insert, the pending-submission fan-out to the class roster, and the
// `teacher.assignment.created` event. The route's job is now only to parse
// the request and map this service's result/errors onto an HTTP response.
//
// The Blueprint delivery adapter (Phase 2B,
// lib/learnerBlueprint/actionPlan/delivery/assignment.ts) is this service's
// second production caller — never a second writer. It supplies a
// session-bound Supabase client for an authorized teacher actor and passes
// through the same `requireClassTeacher` gate below; this service does not
// accept a caller-provided teacher id as proof of identity. (Phase 1D: the
// Blueprint adapter still only ever uses the legacy/Solo path — see its own
// module header and the Phase 1D closeout report §14 for why institutional
// Blueprint delivery is a named limitation, not migrated in this phase.)
//
// `blueprintActionItemId` (Phase 2B) is trusted server-derived provenance,
// never a client-controlled field: the ordinary HTTP route
// (app/api/teacher/assignments/route.ts) has no request-schema field for it
// and always omits it from the command, so it can only ever be set by a
// caller constructing `CreateAssignmentCommand` directly in server code —
// today, only the Blueprint delivery adapter, after it has independently
// verified the action item is approved and the actor may manage it.
//
// ============================================================================
// PHASE 1D — TWO EXPLICIT CREATION MODES, NEVER ONE OVERLOADED IDENTITY
// ============================================================================
// `CreateAssignmentCommand` carries either `classId` (legacy `teacher_classes.id`
// — Solo Teacher mode, `requireClassTeacher`) or `classSubjectId` (institutional
// `class_subjects.id` — `requireInstitutionalAssignmentAuthority`), never both,
// never neither. The two identity spaces are never allowed to collide on one
// field: a UUID landing in `classId` can only ever be interpreted as a
// `teacher_classes.id`, and a UUID landing in `classSubjectId` can only ever
// be interpreted as a `class_subjects.id`. Institutional mode authorizes
// against the TENURE, then resolves the Phase 1B/1C compatibility class and
// roster as storage machinery — legacy `teacher_classes` ownership is never
// itself consulted for institutional authority (see
// `requireInstitutionalAssignmentAuthority`'s own doc comment).

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, requireClassTeacher, requireInstitutionalAssignmentAuthority } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { ResourceOwnershipError, ValidationError } from '@/lib/core/errors'
import { ensureAssignmentCompatibilityClass } from '@/lib/core/assignmentCompatibilityBridge'
import { syncAssignmentCompatibilityRoster } from '@/lib/core/assignmentLearnerBridge'
import { publishEvent } from '@/lib/events'
import { repos } from '@/lib/repositories'
import type { AssignmentRow } from '@/lib/repositories/assignment.repository'

export type CreateAssignmentCommand = {
  /** Solo Teacher mode — legacy `teacher_classes.id`. Exactly one of `classId`/`classSubjectId` must be set. */
  classId?: string
  /** Institutional mode — `class_subjects.id` (a current teaching tenure). Exactly one of `classId`/`classSubjectId` must be set. */
  classSubjectId?: string
  title: string
  /**
   * Solo Teacher mode: authoritative as given. Institutional mode: IGNORED
   * and overwritten with the Core subject name resolved from
   * `classSubjectId` (Step 7 — subject authority belongs to Core, a
   * contradictory client string is never allowed to change what gets
   * stored or, more importantly, must never be mistaken for a source of
   * authorization).
   */
  subject: string
  topic: string
  substrandId: string | null
  instructions: string
  dueDate: string
  type: string | undefined
  maxScore: number | undefined
  isQuiz: boolean | undefined
  isAdaptive: boolean | undefined
  isCompassGuided: boolean | undefined
  isHolidayAssignment: boolean | undefined
  holidayPeriod: string | undefined
  lessonPlanId: string | undefined
  /** Server-derived provenance only — see module header. Omit for every ordinary caller. */
  blueprintActionItemId?: string | null
}

export type CreateAssignmentResult = {
  assignment: AssignmentRow
}

/**
 * Creates an assignment on behalf of the authenticated teacher and fans out
 * pending submission rows to the class roster.
 *
 * Dispatches on which of `command.classId` / `command.classSubjectId` is
 * present (see module header) — throws `ValidationError` if the command
 * carries both or neither, before either authorization path runs.
 *
 * Throws (never returns an HTTP-shaped value):
 *  - `UnauthorizedError` (lib/core/errors) — no authenticated session.
 *  - `ValidationError` — command carries both or neither of `classId`/`classSubjectId`.
 *  - Solo Teacher mode — `ResourceOwnershipError` — the session has no
 *    teacher record, or the teacher does not own `command.classId` (also
 *    thrown when the class id does not exist at all — indistinguishable
 *    from "not your class" by design, matching `requireClassTeacher`'s
 *    existing semantics).
 *  - Institutional mode — whatever `requireInstitutionalAssignmentAuthority`
 *    throws (`ResourceOwnershipError` / `MembershipRequiredError` /
 *    `PermissionDeniedError`) — see that function's doc comment.
 *
 * Callers map these onto HTTP responses; this function never touches
 * `Request`/`NextResponse`.
 */
export async function createAssignment(
  supabase: SupabaseClient,
  command: CreateAssignmentCommand,
): Promise<CreateAssignmentResult> {
  const hasClassId = !!command.classId
  const hasClassSubjectId = !!command.classSubjectId
  if (hasClassId === hasClassSubjectId) {
    throw new ValidationError(
      'createAssignment: exactly one of classId (Solo Teacher mode) or classSubjectId (institutional mode) must be provided.'
    )
  }

  const resolved = hasClassSubjectId
    ? await resolveInstitutionalTarget(supabase, command.classSubjectId!)
    : await resolveSoloTarget(supabase, command.classId!, command.subject)

  // Sprint 10 Slice A: an adaptive assignment is always a quiz, and always
  // starts 'draft' — invisible to students (the existing student-list route
  // already filters to status='active' only) until the teacher explicitly
  // publishes it via PATCH, after generating and reviewing variants. A
  // Standard/plain-quiz assignment is completely unaffected: is_adaptive
  // defaults false, status stays 'active' immediately, byte for byte the
  // same as before this column existed.
  const adaptive = command.isAdaptive === true
  const quiz = adaptive ? true : command.isQuiz === true

  const assignment = await repos.assignments.createAssignmentRecord({
    class_id: resolved.storageClassId,
    teacher_id: resolved.storageTeacherId,
    title: command.title,
    subject: resolved.subject,
    topic: command.topic,
    substrand_id: command.substrandId || null,
    instructions: command.instructions,
    due_date: command.dueDate,
    type: command.type || 'practice',
    max_score: command.maxScore || 100,
    is_quiz: quiz,
    is_adaptive: adaptive,
    // Quizzes are self-contained MCQ, never Compass-guided.
    is_compass_guided: quiz ? false : command.isCompassGuided !== false,
    is_holiday_assignment: command.isHolidayAssignment === true,
    holiday_period: command.isHolidayAssignment ? (command.holidayPeriod || null) : null,
    lesson_plan_id: command.lessonPlanId || null,
    blueprint_action_item_id: command.blueprintActionItemId ?? null,
    status: adaptive ? 'draft' : 'active',
  })

  await fanOutPendingSubmissions(assignment, resolved.storageClassId)

  void publishEvent({
    event_type: 'teacher.assignment.created',
    resource_type: 'assignment',
    resource_id: assignment.id,
    // Preserves the existing, already-confirmed actor-id mismatch
    // (`platform_events.actor_id` FKs to `auth.users.id`; this passes a
    // legacy `teachers.id`) unchanged in shape for both modes — Phase 1D
    // Step 17 is explicit that this phase must not fix it, and institutional
    // mode reuses the exact same (wrong) convention rather than inventing a
    // second, differently-wrong one.
    actor_id: resolved.storageTeacherId,
    payload: {
      assignment_id: assignment.id,
      class_id: resolved.storageClassId,
      title: command.title,
      due_date: command.dueDate,
    },
    idempotency_key: `teacher.assignment.created:${assignment.id}`,
  }).catch(err => console.error('[events] teacher.assignment.created:', err instanceof Error ? err.message : String(err)))

  return { assignment }
}

/** What the (legacy-keyed, unchanged) storage/fan-out layer needs, regardless of which mode resolved it. */
type ResolvedAssignmentTarget = {
  /** `teacher_classes.id` — real for Solo mode, the Phase 1B compatibility class for institutional mode. */
  storageClassId: string
  /** `teachers.id` (legacy) — the id `assignments.teacher_id`/RLS/event payloads have always used. */
  storageTeacherId: string
  /** The subject text to store — client-supplied for Solo mode, Core-derived for institutional mode (Step 7). */
  subject: string
}

/** Solo Teacher mode: unchanged behaviour, `requireClassTeacher` is still the sole authority. `subject` passes through as given — client-authoritative, exactly as before Phase 1D. */
async function resolveSoloTarget(supabase: SupabaseClient, classId: string, subject: string): Promise<ResolvedAssignmentTarget> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  // Re-derives auth/teacher internally, but is the canonical class-ownership
  // gate (RAS §8) — never re-implement this check locally.
  await requireClassTeacher(supabase, classId)

  return { storageClassId: classId, storageTeacherId: teacher.id, subject }
}

/**
 * Institutional mode: `classSubjectId` → tenure authority → Core subject
 * name → Phase 1B compatibility class → Phase 1C roster sync (Step 4-6).
 * Legacy `teacher_classes` ownership is never itself consulted for
 * authority — only for where the (unchanged) storage/fan-out layer writes.
 */
async function resolveInstitutionalTarget(supabase: SupabaseClient, classSubjectId: string): Promise<ResolvedAssignmentTarget> {
  const authority = await requireInstitutionalAssignmentAuthority(supabase, classSubjectId)

  // Step 4 — compatibility resolution happens strictly AFTER authority succeeds.
  const compatClass = await ensureAssignmentCompatibilityClass(classSubjectId)

  // Step 5 — roster synced before fan-out; `fanOutPendingSubmissions` below is unchanged.
  await syncAssignmentCompatibilityRoster(classSubjectId)

  return {
    storageClassId: compatClass.teacherClassId,
    storageTeacherId: compatClass.legacyTeacherId,
    subject: authority.subjectName,
  }
}

/**
 * Pre-creates a pending submission row for every current student on the
 * class roster. Failure here is logged, not thrown: the assignment row is
 * already committed by this point and there is no transaction wrapping the
 * two writes (a pre-existing gap — see
 * docs/architecture/assignment-creation-service-phase2a.md §10 — carried
 * forward unchanged from the original inline route, which discarded this
 * error silently; only the logging is new).
 */
async function fanOutPendingSubmissions(assignment: AssignmentRow, classId: string): Promise<void> {
  const studentIds = await repos.assignments.listClassStudentIds(classId)
  if (studentIds.length === 0) return

  try {
    await repos.assignments.createAssignmentSubmissions(
      studentIds.map(studentId => ({
        assignment_id: assignment.id,
        student_id: studentId,
        class_id: classId,
        status: 'pending',
      }))
    )
  } catch (err) {
    console.error('[assignments/create] submission fan-out failed:', err instanceof Error ? err.message : String(err))
  }
}
