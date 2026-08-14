// lib/learnerBlueprint/actionPlan/delivery/compass.ts
//
// Blueprint action-plan -> Learning Compass delivery (Phase 2C,
// docs/architecture/blueprint-compass-delivery-phase2c.md). Coordinates
// between the Blueprint action lifecycle, teacher confirmation, provenance,
// and the canonical Compass objective-setter
// (lib/compass/objective.ts#setTeacherSuggestedTopic) — never a second
// Compass writer, never a model call.
//
// Ownership boundary (see the design doc §2 for the full audit):
//   Blueprint Action Item
//     -> Teacher-approved Compass Delivery   (this file + blueprint_compass_deliveries)
//       -> Compass objective (compass_bridge, via setTeacherSuggestedTopic)
//         -> Compass tutoring/adaptation/session progression  (untouched — lib/compass/session.ts, app/api/learn/*)
//           -> Compass-generated observations/evidence         (untouched — lib/compass/evidence.ts)
//
// This file never invokes DeepSeek, never constructs a tutoring prompt,
// never updates adaptive streak state, never decides question sequencing,
// never writes learner_evidence, never creates an assignment, and never
// sends a parent notification. It writes exactly two things: one row in
// `blueprint_compass_deliveries` (provenance) and a merge into
// `student_learning_context.compass_bridge` (via the canonical setter) —
// both pure data writes, zero model coupling.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, canManageLearnerRecordCore } from '@/lib/core/permissions'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { ResourceOwnershipError, NotFoundError, ValidationError, ConflictError, IdentityResolutionError } from '@/lib/core/errors'
import { getSchoolUser } from '@/lib/core/school-users'
import { repos } from '@/lib/repositories'
import type { BlueprintActionItemRow } from '@/lib/repositories/blueprintActionItem.repository'
import type { BlueprintCompassDeliveryRow } from '@/lib/repositories/blueprintCompassDelivery.repository'
import { setTeacherSuggestedTopic } from '@/lib/compass/objective'
import type { LearnerId } from '@/lib/core/identityTypes'

export type DeliverBlueprintActionToCompassCommand = {
  /** Must be literally `true`. Anything else (including omission) is a validation failure — delivery never happens implicitly. */
  confirmCompassDelivery: boolean
  /** Required — a real Compass subject key (e.g. 'mathematics'), never inferred from Blueprint's free-text `target_capability`. */
  subject: string
  /** Optional overrides. Omitted fields fall back to {@link mapActionToCompassObjective}'s deterministic, private-content-free mapping. */
  objective?: string
  learnerInstructions?: string
  successIndicator?: string
  reviewDate?: string
}

export type DeliverBlueprintActionToCompassResult = {
  delivery: BlueprintCompassDeliveryRow
  /** `true` if this call found and returned a prior delivery rather than creating a new one — the idempotent-replay path. */
  alreadyDelivered: boolean
}

/**
 * Deterministic, stakeholder-safe content mapping from an approved action
 * item to Compass-bound draft fields. Never reads `teacherNotes`,
 * `evidenceBasis` (so projection confidence/freshness can never leak —
 * that lives only inside `evidenceBasis`), `parentSupport`, `teacherAction`,
 * or `schoolSupport`. `curriculumReference` passes through
 * `target_capability` verbatim (already free-text and teacher-authored, not
 * an internal field) — never fabricated. No LLM is consulted; this is a
 * pure function.
 */
export function mapActionToCompassObjective(action: BlueprintActionItemRow): {
  objective: string
  learnerInstructions: string
  successIndicator: string | null
  reviewDate: string | null
  curriculumReference: string | null
} {
  const objective = action.learner_action?.trim() || action.intended_outcome.trim()
  const instructionsParts = [objective]
  if (action.success_indicator?.trim()) instructionsParts.push(`Success looks like: ${action.success_indicator.trim()}`)

  return {
    objective,
    learnerInstructions: instructionsParts.join('\n\n'),
    successIndicator: action.success_indicator?.trim() || null,
    reviewDate: action.review_date,
    curriculumReference: action.target_capability,
  }
}

async function resolveActorSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
  const schoolUser = await getSchoolUser(userId, schoolId).catch(() => null)
  return schoolUser?.id ?? null
}

/**
 * Converts an approved Blueprint action item into a queued Compass
 * objective for its originating learner. Never creates a `compass_sessions`
 * row and never invokes a tutoring model — see module header.
 *
 * Preconditions (throws on the first one violated):
 *  - `UnauthorizedError` — no authenticated session.
 *  - `NotFoundError` — no action item with this id.
 *  - `ResourceOwnershipError` — the actor may not manage this learner's
 *    Blueprint record.
 *  - `ConflictError` — the action's status is not `approved`, or a lost
 *    concurrency race (resolved transparently — see below).
 *  - `IdentityResolutionError` — the learner has no legacy Compass identity
 *    bridge yet ("Compass unavailable for learner" — Compass's own tables
 *    are keyed on the legacy `students.id` space; a Core learner with no
 *    bridge cannot be delivered to Compass, the same gap
 *    `canManageLearnerRecordCore` already documents for the admin-only
 *    fallback path).
 *  - `ValidationError` — missing/false confirmation, missing subject, or an
 *    incomplete mapped objective.
 *
 * Idempotent by design: if this action item already has a delivery (looked
 * up by `blueprint_action_item_id` — never by content matching), it is
 * returned (`alreadyDelivered: true`) without writing anything again,
 * regardless of what this call's `command` contains — identical contract to
 * Phase 2B's assignment-delivery adapter.
 */
export async function deliverBlueprintActionToCompass(
  client: SupabaseClient,
  actionItemId: string,
  command: DeliverBlueprintActionToCompassCommand,
): Promise<DeliverBlueprintActionToCompassResult> {
  const user = await requireAuthentication(client)

  const action = await repos.blueprintActionItems.findById(actionItemId)
  if (!action) throw new NotFoundError('Blueprint action item not found.')

  const canManage = await canManageLearnerRecordCore(client, action.school_id, action.learner_id)
  if (!canManage) throw new ResourceOwnershipError('You do not have permission to manage this learner\'s Blueprint action plan.')

  if (action.status !== 'approved') {
    throw new ConflictError(`Blueprint action item ${actionItemId} has status "${action.status}" — only an approved action item may be delivered to Compass.`)
  }

  // Idempotent replay — keyed only on the action item id. See function doc.
  const existing = await repos.blueprintCompassDeliveries.findByBlueprintActionItemId(actionItemId)
  if (existing) return { delivery: existing, alreadyDelivered: true }

  if (command.confirmCompassDelivery !== true) {
    throw new ValidationError('You must explicitly confirm this action will be delivered to Learning Compass (confirmCompassDelivery: true).')
  }
  if (!command.subject?.trim()) throw new ValidationError('Blueprint Compass delivery: "subject" is required.')

  // Compass access precondition — its tables are keyed on the legacy
  // students.id space; a Core learner with no bridge yet has no Compass
  // identity to deliver to at all (a legitimate, common state, not an error
  // in the learner's record — see lib/core/identity.ts's own documented gap).
  const legacyStudentId = await resolveLegacyStudentId(action.learner_id)
  if (!legacyStudentId) {
    throw new IdentityResolutionError('This learner has no Learning Compass identity yet — Compass is unavailable for this learner.')
  }

  // Phase 2.6 §12 — NO SILENT OVERWRITE.
  //
  // `compass_bridge` is a single per-learner slot, so delivering a second
  // objective while the first is still unconsumed would overwrite it and the
  // learner would never see the first — with nothing recording that it had
  // been replaced. Policy chosen: REJECTED_SECOND_ACTIVE. A queue is not
  // built here (no infrastructure for one exists, and §12 warns against
  // over-building), and silent replacement is not acceptable, so the second
  // delivery is refused with an actionable error naming the intervention
  // already waiting. A teacher who genuinely wants to replace it can act on
  // the existing action item first.
  const activeDelivery = await repos.blueprintCompassDeliveries.findActiveForLearner(action.learner_id)
  if (activeDelivery && activeDelivery.blueprint_action_item_id !== action.id) {
    throw new ConflictError(
      `This learner already has a Compass intervention waiting ("${activeDelivery.objective}", ${activeDelivery.subject}) ` +
      'that they have not started yet. Sending another now would replace it. Resolve the existing one first.'
    )
  }

  const draft = mapActionToCompassObjective(action)
  const objective = command.objective?.trim() || draft.objective
  const learnerInstructions = command.learnerInstructions?.trim() || draft.learnerInstructions
  const successIndicator = command.successIndicator?.trim() || draft.successIndicator
  const reviewDate = command.reviewDate?.trim() || draft.reviewDate

  const actorId = await resolveActorSchoolUserId(user.id, action.school_id)

  let delivery: BlueprintCompassDeliveryRow
  try {
    delivery = await repos.blueprintCompassDeliveries.insert({
      learner_id: action.learner_id,
      school_id: action.school_id,
      blueprint_action_item_id: action.id,
      subject: command.subject,
      objective,
      learner_instructions: learnerInstructions,
      success_indicator: successIndicator,
      curriculum_reference: draft.curriculumReference,
      review_date: reviewDate,
      created_by: actorId,
    })
  } catch (err) {
    if (err instanceof ConflictError) {
      // Lost a concurrent-delivery race — the winner's row is the real result.
      const winner = await repos.blueprintCompassDeliveries.findByBlueprintActionItemId(actionItemId)
      if (winner) return { delivery: winner, alreadyDelivered: true }
    }
    throw err
  }

  // The canonical Compass objective-setter — the same writer
  // app/api/teacher/students/[studentId]/compass-topic/route.ts uses. A pure
  // data write; no model invocation, no session creation.
  await setTeacherSuggestedTopic({
    studentId: legacyStudentId,
    subject: command.subject,
    concept: objective,
    strandName: draft.curriculumReference,
    // Phase 2 — the stable curriculum identity, alongside the free-text
    // reference. `curriculumReference` is what a human reads;
    // `sub_strand_id` is what the evidence comes back keyed on.
    subStrandId: action.sub_strand_id,
    // Phase 2.6 — the durable reference that lets the session that consumes
    // this objective bind back to this exact delivery.
    deliveryId: delivery.id,
  })

  await recordDeliveryHistory(action, delivery, actorId)

  return { delivery, alreadyDelivered: false }
}

/**
 * Delivery is recorded as an event, not overloaded into the action item's
 * own `status` — the item remains `approved`. Failure here is logged, not
 * thrown: the delivery row (provenance) is already durably committed by
 * this point, so a history-write failure loses only a convenience audit-log
 * entry, recoverable by re-deriving from `blueprint_compass_deliveries`
 * directly — the same documented, deliberate choice Phase 2B made for
 * assignment delivery.
 */
async function recordDeliveryHistory(
  action: BlueprintActionItemRow,
  delivery: BlueprintCompassDeliveryRow,
  actorId: string | null,
): Promise<void> {
  try {
    await repos.blueprintActionItemHistory.record({
      action_item_id: action.id,
      event_type: 'delivered_to_compass',
      previous_status: action.status,
      resulting_status: action.status, // Unchanged — "delivered to Compass" is not "action completed."
      snapshot: action,
      actor_id: actorId,
      reason: `Delivered to Learning Compass as delivery ${delivery.id} (subject: ${delivery.subject}).`,
    })
  } catch (err) {
    console.error('[blueprint/delivery/compass] failed to record delivery history:', err instanceof Error ? err.message : String(err))
  }
}
