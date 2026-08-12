// lib/learnerBlueprint/actionPlan/lifecycle.ts
//
// The canonical Blueprint action-plan service (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md §5/§7). Owns:
// authorization (via lib/core/permissions.ts — never a second, weaker
// authorization query), field validation, the propose/edit/approve/
// reject/defer lifecycle, and history-writing. No Supabase client is ever
// used directly here for reads/writes of the domain's own tables — every
// one goes through repos.blueprintActionItems /
// repos.blueprintActionItemHistory, which own the tables exclusively.
//
// This is a decision/coordination record, not a second Projection Engine,
// classifier, recommendation-arbitration engine, evidence writer,
// assignment writer, or Compass writer — see the migration's own header
// comment and docs/architecture/blueprint-action-plan-phase1.md for the
// full boundary. No function here ever calls persistEvidenceBatch, creates
// an assignment, or starts a Compass session.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuthentication, canManageLearnerRecordCore } from '@/lib/core/permissions'
import { ResourceOwnershipError } from '@/lib/core/errors'
import { getSchoolUser } from '@/lib/core/school-users'
import { getCurrentAcademicYear, getCurrentTerm } from '@/lib/core/school'
import { repos } from '@/lib/repositories'
import type { BlueprintActionItemRow, UpdateBlueprintActionItemContentInput } from '@/lib/repositories/blueprintActionItem.repository'
import { validateProposeInput, validateEditFields, requireNonEmptyReason } from './validation'
import { toBlueprintActionItem, EVIDENCE_BASIS_EMPTY, type BlueprintActionItem, type ProposeBlueprintActionInput, type EditableBlueprintActionFields } from './types'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import { validateBlueprintCoherence } from '@/lib/learnerBlueprint/coherence'

// Statuses from which a decision (approve/reject/defer) may be recorded —
// a fresh proposal, an edited-but-undecided proposal, or a previously
// deferred item being revisited. Never 'approved'/'rejected' (the DB
// trigger would reject it anyway; this check exists to give a clean,
// actionable error instead of surfacing that raw DB exception — mirrors
// lib/teacherReflection/reflection.ts's own `updateDraft` precedent).
const DECIDABLE_STATUSES = ['proposed', 'edited', 'deferred'] as const
const EDITABLE_STATUSES = ['proposed', 'edited'] as const

async function requireManageAccess(client: SupabaseClient, schoolId: string, learnerId: string): Promise<void> {
  const canManage = await canManageLearnerRecordCore(client, schoolId, learnerId)
  if (!canManage) throw new ResourceOwnershipError('You do not have permission to manage this learner\'s Blueprint action plan.')
}

async function resolveActorSchoolUserId(userId: string, schoolId: string): Promise<string | null> {
  const schoolUser = await getSchoolUser(userId, schoolId).catch(() => null)
  return schoolUser?.id ?? null
}

async function writeHistory(
  actionItemId: string,
  eventType: 'proposed' | 'edited' | 'approved' | 'rejected' | 'deferred',
  previousStatus: string | null,
  row: BlueprintActionItemRow,
  actorId: string | null,
  reason: string | null
): Promise<void> {
  await repos.blueprintActionItemHistory.record({
    action_item_id: actionItemId,
    event_type: eventType,
    previous_status: previousStatus,
    resulting_status: row.status,
    snapshot: row,
    actor_id: actorId,
    reason,
  })
}

/**
 * Proposes a new action item for a learner — teacher-authored or a saved
 * system-generated candidate (see candidateGeneration.ts). Always starts
 * as `status: 'proposed'` regardless of source (Phase 1's own requirement:
 * "do not treat an automated proposal as teacher-approved" — and, for
 * consistency and testability, a teacher-authored one isn't auto-approved
 * either; approval is always a distinct, later step).
 */
export async function proposeBlueprintAction(
  client: SupabaseClient,
  input: ProposeBlueprintActionInput
): Promise<BlueprintActionItem> {
  const user = await requireAuthentication(client)
  const schoolId = await repos.learners.findSchoolId(input.coreLearnerId)
  await requireManageAccess(client, schoolId, input.coreLearnerId)
  validateProposeInput(input)

  const [proposedBy, academicYear, term] = await Promise.all([
    resolveActorSchoolUserId(user.id, schoolId),
    getCurrentAcademicYear(schoolId).catch(() => null),
    getCurrentTerm(schoolId).catch(() => null),
  ])

  const row = await repos.blueprintActionItems.insert({
    learner_id: input.coreLearnerId,
    school_id: schoolId,
    academic_year_id: academicYear?.id ?? null,
    term_id: term?.id ?? null,
    blueprint_snapshot_id: null, // Reserved for a future phase — see migration comment.
    context: input.context,
    priority: input.priority ?? 'medium',
    visibility: input.visibility ?? 'teacher_only',
    title: input.title,
    rationale: input.rationale,
    intended_outcome: input.intendedOutcome,
    learner_action: input.learnerAction ?? null,
    teacher_action: input.teacherAction ?? null,
    parent_support: input.parentSupport ?? null,
    school_support: input.schoolSupport ?? null,
    success_indicator: input.successIndicator,
    target_capability: input.targetCapability ?? null,
    // Phase 2 — the canonical curriculum anchor travels with the action from
    // the moment it is proposed. Never derived from `targetCapability` text.
    sub_strand_id: input.subStrandId ?? null,
    review_date: input.reviewDate ?? null,
    teacher_notes: input.teacherNotes ?? null,
    proposal_source: input.proposalSource,
    source_generator: input.sourceGenerator ?? null,
    evidence_basis: input.evidenceBasis ?? EVIDENCE_BASIS_EMPTY,
    proposed_by: proposedBy,
  })

  await writeHistory(row.id, 'proposed', null, row, proposedBy, null)
  return toBlueprintActionItem(row)
}

/**
 * Edits an existing action item's teacher-controlled content fields. Only
 * `proposed`/`edited` rows may be edited — the DB trigger would reject an
 * attempt on an `approved`/`rejected` row anyway; this check surfaces a
 * clean error first. Identity/provenance fields are never part of
 * `EditableBlueprintActionFields`, so they cannot be smuggled through
 * regardless of what a caller passes — the repository's update payload is
 * built from an explicit whitelist, never a spread of the raw input.
 */
export async function editBlueprintAction(
  client: SupabaseClient,
  actionItemId: string,
  patch: EditableBlueprintActionFields
): Promise<BlueprintActionItem> {
  const user = await requireAuthentication(client)

  const existing = await repos.blueprintActionItems.findById(actionItemId)
  if (!existing) throw new Error('Blueprint action item not found.')
  await requireManageAccess(client, existing.school_id, existing.learner_id)

  if (!(EDITABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new Error(`Blueprint action item ${actionItemId} has status "${existing.status}" and can no longer be edited — a decided item is immutable.`)
  }

  const merged = {
    title: patch.title ?? existing.title,
    rationale: patch.rationale ?? existing.rationale,
    intendedOutcome: patch.intendedOutcome ?? existing.intended_outcome,
    learnerAction: patch.learnerAction !== undefined ? patch.learnerAction : existing.learner_action,
    teacherAction: patch.teacherAction !== undefined ? patch.teacherAction : existing.teacher_action,
    parentSupport: patch.parentSupport !== undefined ? patch.parentSupport : existing.parent_support,
    schoolSupport: patch.schoolSupport !== undefined ? patch.schoolSupport : existing.school_support,
    successIndicator: patch.successIndicator ?? existing.success_indicator,
    targetCapability: patch.targetCapability !== undefined ? patch.targetCapability : existing.target_capability,
    reviewDate: patch.reviewDate !== undefined ? patch.reviewDate : existing.review_date,
    teacherNotes: patch.teacherNotes !== undefined ? patch.teacherNotes : existing.teacher_notes,
  }
  validateEditFields(merged)

  const updatePayload: UpdateBlueprintActionItemContentInput = {
    context: patch.context ?? existing.context,
    priority: patch.priority ?? existing.priority,
    visibility: patch.visibility ?? existing.visibility,
    title: merged.title,
    rationale: merged.rationale,
    intended_outcome: merged.intendedOutcome,
    learner_action: merged.learnerAction,
    teacher_action: merged.teacherAction,
    parent_support: merged.parentSupport,
    school_support: merged.schoolSupport,
    success_indicator: merged.successIndicator,
    target_capability: merged.targetCapability,
    review_date: merged.reviewDate,
    teacher_notes: merged.teacherNotes,
    status: 'edited',
  }

  const row = await repos.blueprintActionItems.updateContent(actionItemId, updatePayload)
  const actorId = await resolveActorSchoolUserId(user.id, existing.school_id)
  await writeHistory(row.id, 'edited', existing.status, row, actorId, null)
  return toBlueprintActionItem(row)
}

/**
 * Enforcement boundary for the Phase 4A Coherence Engine (Phase 4A
 * Conformance Audit Area 2 / Requirement "FAIL prevents publication or
 * approval of the affected action"). Composing coherence findings and
 * displaying them was, before this fix, the only place coherence was ever
 * checked — nothing stopped a FAIL-grade action from being approved,
 * delivered to Assignment/Compass, or reviewed. This re-runs the exact
 * same, single canonical validator (`validateBlueprintCoherence`) the
 * Blueprint page already uses, against the learner's real composed
 * Blueprint plus the would-be post-approval action set, and blocks the
 * transition on a critical finding. It never re-derives PASS/WARN/FAIL
 * itself and never mutates the pending action item — diagnosis stays in
 * one place (types.ts's `toCoherenceReport`), enforcement is just "read
 * that result and stop."
 *
 * Uses the plain `composeBlueprint()` (not `composeBlueprintWithCoherence`)
 * deliberately: the report this boundary needs is for the WOULD-BE approved
 * set (existing approved + this pending item), which the composer's own
 * report — computed over the currently-approved set only — cannot answer.
 * Before coherence became opt-in, calling the composer here ran the seven
 * rules once internally, threw that report away, and then ran them again
 * below on the augmented set. Now it runs exactly once.
 */
async function requireCoherentApproval(actorUserId: string, pending: BlueprintActionItemRow): Promise<void> {
  const [blueprintResult, approvedRows] = await Promise.all([
    composeBlueprint({ actorUserId, coreLearnerId: pending.learner_id, schoolId: pending.school_id }),
    repos.blueprintActionItems.listApprovedForLearner(pending.learner_id, pending.school_id),
  ])

  const wouldBeApproved = [...approvedRows.map(toBlueprintActionItem), toBlueprintActionItem(pending)]
  const report = validateBlueprintCoherence(blueprintResult.blueprint, wouldBeApproved)

  if (report.result === 'FAIL') {
    const critical = report.findings.filter(f => f.severity === 'critical').map(f => f.explanation)
    throw new Error(
      `This action cannot be approved: it would leave the learner's Blueprint in a coherence FAIL state. ${critical.join(' ')}`
    )
  }
}

async function recordDecision(
  client: SupabaseClient,
  actionItemId: string,
  status: 'approved' | 'rejected' | 'deferred',
  eventType: 'approved' | 'rejected' | 'deferred',
  reason: string | null,
  reviewDateOverride: string | null | undefined
): Promise<BlueprintActionItem> {
  const user = await requireAuthentication(client)

  const existing = await repos.blueprintActionItems.findById(actionItemId)
  if (!existing) throw new Error('Blueprint action item not found.')
  await requireManageAccess(client, existing.school_id, existing.learner_id)

  if (!(DECIDABLE_STATUSES as readonly string[]).includes(existing.status)) {
    throw new Error(`Blueprint action item ${actionItemId} has status "${existing.status}" and cannot transition to "${status}" from there.`)
  }

  if (status === 'approved') {
    await requireCoherentApproval(user.id, existing)
  }

  const actorId = await resolveActorSchoolUserId(user.id, existing.school_id)
  const row = await repos.blueprintActionItems.recordDecision(actionItemId, {
    status,
    reviewed_by: actorId,
    reviewed_at: new Date().toISOString(),
    decision_reason: reason,
    review_date: reviewDateOverride !== undefined ? reviewDateOverride : existing.review_date,
  })

  await writeHistory(row.id, eventType, existing.status, row, actorId, reason)
  return toBlueprintActionItem(row)
}

/** Approves a proposed/edited/deferred action item. `decisionReason` is optional (approval doesn't require justification the way reject/defer do); `reviewDate` may be set or left as whatever the item already carried. */
export async function approveBlueprintAction(
  client: SupabaseClient,
  actionItemId: string,
  input?: { decisionReason?: string | null; reviewDate?: string | null }
): Promise<BlueprintActionItem> {
  return recordDecision(client, actionItemId, 'approved', 'approved', input?.decisionReason ?? null, input?.reviewDate)
}

/** Rejects a proposed/edited/deferred action item. A reason is required — a bare rejection with no explanation isn't auditable in any useful way. */
export async function rejectBlueprintAction(
  client: SupabaseClient,
  actionItemId: string,
  reason: string
): Promise<BlueprintActionItem> {
  requireNonEmptyReason(reason, 'reject')
  return recordDecision(client, actionItemId, 'rejected', 'rejected', reason, undefined)
}

/** Defers a proposed/edited/(already-)deferred action item — the one non-final decision, revisitable later via approve/reject/defer again. A reason is required; `reviewDate` (when to revisit) is optional but strongly expected in practice. */
export async function deferBlueprintAction(
  client: SupabaseClient,
  actionItemId: string,
  input: { reason: string; reviewDate?: string | null }
): Promise<BlueprintActionItem> {
  requireNonEmptyReason(input.reason, 'defer')
  return recordDecision(client, actionItemId, 'deferred', 'deferred', input.reason, input.reviewDate)
}

/** Retrieves one action item — throws if the caller cannot manage this learner's record (Phase 1 uses the same staff-only capability check for reads and writes; no separate, weaker read gate). */
export async function getBlueprintAction(client: SupabaseClient, actionItemId: string): Promise<BlueprintActionItem | null> {
  const existing = await repos.blueprintActionItems.findById(actionItemId)
  if (!existing) return null
  await requireManageAccess(client, existing.school_id, existing.learner_id)
  return toBlueprintActionItem(existing)
}

/** The current canonical action items for a learner, newest first, optionally filtered by context/status. */
export async function listBlueprintActionsForLearner(
  client: SupabaseClient,
  coreLearnerId: string,
  filters?: { context?: BlueprintActionItem['context']; status?: BlueprintActionItem['status'] }
): Promise<BlueprintActionItem[]> {
  const schoolId = await repos.learners.findSchoolId(coreLearnerId)
  await requireManageAccess(client, schoolId, coreLearnerId)
  const rows = await repos.blueprintActionItems.listForLearner(coreLearnerId, schoolId, filters)
  return rows.map(toBlueprintActionItem)
}

/** The full lifecycle history for one action item — proves auditability (original proposal, every edit, the final decision, actor, timestamp, previous/resulting state). */
export async function getBlueprintActionHistory(client: SupabaseClient, actionItemId: string) {
  const existing = await repos.blueprintActionItems.findById(actionItemId)
  if (!existing) throw new Error('Blueprint action item not found.')
  await requireManageAccess(client, existing.school_id, existing.learner_id)
  return repos.blueprintActionItemHistory.listForActionItem(actionItemId)
}
