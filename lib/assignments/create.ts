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
// accept a caller-provided teacher id as proof of identity.
//
// `blueprintActionItemId` (Phase 2B) is trusted server-derived provenance,
// never a client-controlled field: the ordinary HTTP route
// (app/api/teacher/assignments/route.ts) has no request-schema field for it
// and always omits it from the command, so it can only ever be set by a
// caller constructing `CreateAssignmentCommand` directly in server code —
// today, only the Blueprint delivery adapter, after it has independently
// verified the action item is approved and the actor may manage it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { publishEvent } from '@/lib/events'
import { repos } from '@/lib/repositories'
import type { AssignmentRow } from '@/lib/repositories/assignment.repository'

export type CreateAssignmentCommand = {
  classId: string
  title: string
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
 * Throws (never returns an HTTP-shaped value):
 *  - `UnauthorizedError` (lib/core/errors) — no authenticated session.
 *  - `ResourceOwnershipError` — the session has no teacher record, or the
 *    teacher does not own `command.classId` (also thrown when the class id
 *    does not exist at all — indistinguishable from "not your class" by
 *    design, matching `requireClassTeacher`'s existing semantics).
 *
 * Callers map these onto HTTP responses; this function never touches
 * `Request`/`NextResponse`.
 */
export async function createAssignment(
  supabase: SupabaseClient,
  command: CreateAssignmentCommand,
): Promise<CreateAssignmentResult> {
  const user = await requireAuthentication(supabase)
  const teacher = await resolveTeacher(user.id)
  if (!teacher) throw new ResourceOwnershipError('This account has no teacher record.')

  // Re-derives auth/teacher internally, but is the canonical class-ownership
  // gate (RAS §8) — never re-implement this check locally.
  await requireClassTeacher(supabase, command.classId)

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
    class_id: command.classId,
    teacher_id: teacher.id,
    title: command.title,
    subject: command.subject,
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

  await fanOutPendingSubmissions(assignment, command.classId)

  void publishEvent({
    event_type: 'teacher.assignment.created',
    resource_type: 'assignment',
    resource_id: assignment.id,
    actor_id: teacher.id,
    payload: {
      assignment_id: assignment.id,
      class_id: command.classId,
      title: command.title,
      due_date: command.dueDate,
    },
    idempotency_key: `teacher.assignment.created:${assignment.id}`,
  }).catch(err => console.error('[events] teacher.assignment.created:', err instanceof Error ? err.message : String(err)))

  return { assignment }
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
