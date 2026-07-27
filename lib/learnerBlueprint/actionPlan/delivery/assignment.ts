// lib/learnerBlueprint/actionPlan/delivery/assignment.ts
//
// Blueprint action-plan -> assignment delivery (Phase 2B,
// docs/architecture/blueprint-assignment-delivery-phase2b.md). Coordinates
// between the Blueprint action lifecycle (lib/learnerBlueprint/actionPlan/
// lifecycle.ts), teacher confirmation, the Phase 2A canonical assignment
// service (lib/assignments/create.ts), provenance linkage, and action
// history. Owns none of that persistence itself:
//
//  - the action item's own rows/history:      repos.blueprintActionItems /
//                                              repos.blueprintActionItemHistory
//  - the assignment row + submission fan-out:  lib/assignments/create.ts's
//                                              createAssignment() only
//
// Chosen Phase 2B scope (see the design doc for the full audit): CLASS-WIDE
// delivery only. A Blueprint action item is learner-specific; the assignment
// it produces is intentionally class-wide, requiring an explicit teacher
// confirmation (`confirmClassWideDelivery: true`) — the originating learner
// is provenance, never a silent single-learner target. No single-learner
// assignment-targeting model exists in this codebase to build on safely
// without redesigning submission fan-out/grading/listing, so that
// alternative was not attempted here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, canManageLearnerRecordCore } from '@/lib/core/permissions'
import { ResourceOwnershipError, NotFoundError, ValidationError, ConflictError } from '@/lib/core/errors'
import { getSchoolUser } from '@/lib/core/school-users'
import { repos } from '@/lib/repositories'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import type { AssignmentRow } from '@/lib/repositories/assignment.repository'
import { createAssignment } from '@/lib/assignments/create'

export type DeliverBlueprintActionAsAssignmentCommand = {
  classId: string
  /** Must be literally `true`. Anything else (including omission) is a validation failure — delivery never happens implicitly. */
  confirmClassWideDelivery: boolean
  /** Required — the Blueprint domain has no reliable subject/topic data to derive these from; inventing them from free-text `target_capability` would violate the "deterministic mapping only" rule. */
  subject: string
  topic: string
  /** Optional overrides. Omitted fields fall back to {@link mapActionToAssignmentDraft}'s deterministic, private-content-free mapping. */
  title?: string
  instructions?: string
  dueDate?: string
  type?: string
  maxScore?: number
  isQuiz?: boolean
}

export type DeliverBlueprintActionAsAssignmentResult = {
  assignment: AssignmentRow
  /** `true` if this call found and returned a prior delivery rather than creating a new one — the idempotent-replay path. */
  alreadyDelivered: boolean
}

/**
 * Deterministic, stakeholder-safe content mapping from an approved action
 * item to draft assignment fields. Never reads `teacherNotes`,
 * `evidenceBasis`, `parentSupport`, `teacherAction`, or `schoolSupport` —
 * none of those are teacher-confirmed, learner-facing instructions. Exported
 * so a future prefill UI (not built in Phase 2B) can call the exact same
 * function a real delivery uses, rather than a second, drifting copy.
 */
export function mapActionToAssignmentDraft(action: BlueprintActionItemRow): { title: string; instructions: string; dueDate: string | null } {
  const instructionsParts = [action.learner_action?.trim() || action.intended_outcome.trim()]
  if (action.success_indicator?.trim()) instructionsParts.push(`Success looks like: ${action.success_indicator.trim()}`)

  return {
    title: action.title,
    instructions: instructionsParts.join('\n\n'),
    dueDate: action.review_date,
  }
}

async function resolveActorSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
  const schoolUser = await getSchoolUser(userId, schoolId).catch(() => null)
  return schoolUser?.id ?? null
}

/**
 * Converts an approved Blueprint action item into a real, class-wide
 * assignment through the Phase 2A canonical assignment service. Never
 * inserts into `assignments` directly.
 *
 * Preconditions (throws on the first one violated):
 *  - `UnauthorizedError` — no authenticated session.
 *  - `NotFoundError` — no action item with this id.
 *  - `ResourceOwnershipError` — the actor may not manage this learner's
 *    Blueprint record (`canManageLearnerRecordCore`), OR (surfaced from
 *    `createAssignment`) the actor does not teach `command.classId`. Action
 *    `visibility` (teacher_only/learner_visible/parent_visible/shared) never
 *    substitutes for this check — visibility governs stakeholder *reads*,
 *    never delivery authorization.
 *  - `ConflictError` — the action's status is not `approved`.
 *  - `ValidationError` — `confirmClassWideDelivery` is not `true`, or the
 *    resolved assignment payload is missing a required field (e.g. no
 *    `dueDate` override and the action has no `reviewDate` to fall back to).
 *
 * Idempotent by design: if this action item already produced an assignment
 * (looked up by the `blueprint_action_item_id` linkage — never by
 * title/date matching), that existing assignment is returned
 * (`alreadyDelivered: true`) without creating a second one or re-running
 * class authorization, regardless of what `command` this call was made
 * with — "was this action already delivered" depends only on the action
 * item's id. A genuine concurrent race that slips past this check is
 * resolved by the database's partial unique index
 * (`uq_assignments_blueprint_action_item_id`): the losing insert's
 * `ConflictError` (lib/repositories/assignment.repository.ts) is caught here
 * and resolved into the same idempotent return.
 */
export async function deliverBlueprintActionAsAssignment(
  client: SupabaseClient,
  actionItemId: string,
  command: DeliverBlueprintActionAsAssignmentCommand,
): Promise<DeliverBlueprintActionAsAssignmentResult> {
  const user = await requireAuthentication(client)

  const action = await repos.blueprintActionItems.findById(actionItemId)
  if (!action) throw new NotFoundError('Blueprint action item not found.')

  const canManage = await canManageLearnerRecordCore(client, action.school_id, action.learner_id)
  if (!canManage) throw new ResourceOwnershipError('You do not have permission to manage this learner\'s Blueprint action plan.')

  if (action.status !== 'approved') {
    throw new ConflictError(`Blueprint action item ${actionItemId} has status "${action.status}" — only an approved action item may be delivered as an assignment.`)
  }

  // Idempotent replay — keyed only on the action item id, independent of
  // whatever this call's `command` contains. See function doc.
  const existing = await repos.assignments.findByBlueprintActionItemId(actionItemId)
  if (existing) return { assignment: existing, alreadyDelivered: true }

  if (command.confirmClassWideDelivery !== true) {
    throw new ValidationError('You must explicitly confirm this assignment will be issued to the entire selected class (confirmClassWideDelivery: true).')
  }
  if (!command.classId) throw new ValidationError('A class must be selected for delivery.')
  if (!command.subject?.trim()) throw new ValidationError('Blueprint delivery: "subject" is required.')
  if (!command.topic?.trim()) throw new ValidationError('Blueprint delivery: "topic" is required.')

  const draft = mapActionToAssignmentDraft(action)
  const title = command.title?.trim() || draft.title
  const instructions = command.instructions?.trim() || draft.instructions
  const dueDate = command.dueDate?.trim() || draft.dueDate
  if (!dueDate) {
    throw new ValidationError('Blueprint delivery: no "dueDate" was given and this action item has no reviewDate to fall back to — a due date is required.')
  }

  let created: AssignmentRow
  try {
    const result = await createAssignment(client, {
      classId: command.classId,
      title,
      subject: command.subject,
      topic: command.topic,
      substrandId: null,
      instructions,
      dueDate,
      type: command.type,
      maxScore: command.maxScore,
      isQuiz: command.isQuiz,
      isAdaptive: false,
      isCompassGuided: undefined,
      isHolidayAssignment: false,
      holidayPeriod: undefined,
      lessonPlanId: undefined,
      blueprintActionItemId: action.id,
    })
    created = result.assignment
  } catch (err) {
    if (err instanceof ConflictError) {
      // Lost a concurrent-delivery race — the winner's row is the real
      // result. Never surface the race to the caller as a failure.
      const winner = await repos.assignments.findByBlueprintActionItemId(actionItemId)
      if (winner) return { assignment: winner, alreadyDelivered: true }
    }
    throw err
  }

  await recordDeliveryHistory(action, created, user.id, command.classId)

  return { assignment: created, alreadyDelivered: false }
}

/**
 * Delivery is recorded as an event, not overloaded into the action item's
 * own `status` — the item remains `approved`. Failure here is logged, not
 * thrown: `blueprint_action_item_id` is already durably stored on the
 * assignment row itself (written atomically with the assignment insert
 * above), so a history-write failure loses only this convenience audit
 * entry, never the provenance link itself — recoverable by re-deriving from
 * `assignments.blueprint_action_item_id` directly.
 */
async function recordDeliveryHistory(
  action: BlueprintActionItemRow,
  assignment: AssignmentRow,
  userId: string,
  classId: string,
): Promise<void> {
  try {
    const actorId = await resolveActorSchoolUserId(userId, action.school_id)
    await repos.blueprintActionItemHistory.record({
      action_item_id: action.id,
      event_type: 'delivered',
      previous_status: action.status,
      resulting_status: action.status, // Unchanged — "assignment created" is not "action completed."
      snapshot: action,
      actor_id: actorId,
      reason: `Delivered as assignment ${assignment.id} to class ${classId} (class-wide delivery).`,
    })
  } catch (err) {
    console.error('[blueprint/delivery] failed to record delivery history:', err instanceof Error ? err.message : String(err))
  }
}
