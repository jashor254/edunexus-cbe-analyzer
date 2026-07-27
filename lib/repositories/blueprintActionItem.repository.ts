// lib/repositories/blueprintActionItem.repository.ts
//
// Owns `blueprint_action_items` exclusively (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md). No business
// logic here (no authorization, no lifecycle-transition validity, no
// history-writing) — that all lives in
// lib/learnerBlueprint/actionPlan/lifecycle.ts. This repository only knows
// how to read and write rows; the DB's own trigger
// (enforce_blueprint_action_item_decision_immutability) is the final
// backstop against an approved/rejected row ever being changed, even if a
// future bug in the service layer tried to call `update` on one.

import { BaseRepository } from './base'

export type BlueprintActionContext = 'current_term' | 'intervention' | 'extension' | 'end_of_term' | 'holiday'
export type BlueprintActionPriority = 'low' | 'medium' | 'high'
export type BlueprintActionStatus =
  | 'proposed' | 'edited' | 'approved' | 'rejected' | 'deferred'
  // Reserved for a later phase — never set by lib/learnerBlueprint/actionPlan/lifecycle.ts in Phase 1.
  | 'published' | 'completed' | 'reviewed'
export type BlueprintActionVisibility = 'teacher_only' | 'learner_visible' | 'parent_visible' | 'shared'
export type BlueprintActionProposalSource = 'teacher' | 'system'

/** Mirrors `Projection<T>` (lib/projection/types.ts) exactly — values copied verbatim at proposal time, never recomputed or invented here. */
export type BlueprintActionEvidenceBasis = {
  projectorType: string | null
  supportingEvidenceIds: string[]
  confidence: number | null
  lastComputed: string | null
  projectionVersion: string | null
}

export type BlueprintActionItemRow = {
  id: string
  learner_id: string
  school_id: string
  academic_year_id: string | null
  term_id: string | null
  blueprint_snapshot_id: string | null
  context: BlueprintActionContext
  priority: BlueprintActionPriority
  status: BlueprintActionStatus
  visibility: BlueprintActionVisibility
  title: string
  rationale: string
  intended_outcome: string
  learner_action: string | null
  teacher_action: string | null
  parent_support: string | null
  school_support: string | null
  success_indicator: string
  target_capability: string | null
  review_date: string | null
  teacher_notes: string | null
  proposal_source: BlueprintActionProposalSource
  source_generator: string | null
  evidence_basis: BlueprintActionEvidenceBasis
  proposed_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  decision_reason: string | null
  created_at: string
  updated_at: string
}

export type InsertBlueprintActionItemInput = {
  learner_id: string
  school_id: string
  academic_year_id: string | null
  term_id: string | null
  blueprint_snapshot_id: string | null
  context: BlueprintActionContext
  priority: BlueprintActionPriority
  visibility: BlueprintActionVisibility
  title: string
  rationale: string
  intended_outcome: string
  learner_action: string | null
  teacher_action: string | null
  parent_support: string | null
  school_support: string | null
  success_indicator: string
  target_capability: string | null
  review_date: string | null
  teacher_notes: string | null
  proposal_source: BlueprintActionProposalSource
  source_generator: string | null
  evidence_basis: BlueprintActionEvidenceBasis
  proposed_by: string | null
}

/** Only the fields `editBlueprintAction` is allowed to change — identity/provenance columns are never part of this type, so they can never be smuggled through an update call even by a loosely-typed caller. */
export type UpdateBlueprintActionItemContentInput = Partial<{
  context: BlueprintActionContext
  priority: BlueprintActionPriority
  visibility: BlueprintActionVisibility
  title: string
  rationale: string
  intended_outcome: string
  learner_action: string | null
  teacher_action: string | null
  parent_support: string | null
  school_support: string | null
  success_indicator: string
  target_capability: string | null
  review_date: string | null
  teacher_notes: string | null
  status: BlueprintActionStatus
}>

export type DecisionInput = {
  status: 'approved' | 'rejected' | 'deferred'
  reviewed_by: string | null
  reviewed_at: string
  decision_reason: string | null
  review_date: string | null
}

const ACTION_ITEM_COLS =
  'id, learner_id, school_id, academic_year_id, term_id, blueprint_snapshot_id, context, priority, status, visibility, title, rationale, intended_outcome, learner_action, teacher_action, parent_support, school_support, success_indicator, target_capability, review_date, teacher_notes, proposal_source, source_generator, evidence_basis, proposed_by, reviewed_by, reviewed_at, decision_reason, created_at, updated_at'

export class BlueprintActionItemRepository extends BaseRepository {
  async insert(input: InsertBlueprintActionItemInput): Promise<BlueprintActionItemRow> {
    const { data, error } = await this.db
      .from('blueprint_action_items')
      .insert(input)
      .select(ACTION_ITEM_COLS)
      .single()
    if (error) throw new Error(`insertBlueprintActionItem: ${error.message}`)
    return data as unknown as BlueprintActionItemRow
  }

  async findById(id: string): Promise<BlueprintActionItemRow | null> {
    const { data, error } = await this.db
      .from('blueprint_action_items')
      .select(ACTION_ITEM_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`findBlueprintActionItemById: ${error.message}`)
    return data as unknown as BlueprintActionItemRow | null
  }

  /** Only for `proposed`/`edited` rows — the DB trigger rejects any attempt on an `approved`/`rejected` row. */
  async updateContent(id: string, input: UpdateBlueprintActionItemContentInput): Promise<BlueprintActionItemRow> {
    const { data, error } = await this.db
      .from('blueprint_action_items')
      .update(input)
      .eq('id', id)
      .select(ACTION_ITEM_COLS)
      .single()
    if (error) throw new Error(`updateBlueprintActionItemContent: ${error.message}`)
    return data as unknown as BlueprintActionItemRow
  }

  /** Records a final (approve/reject) or revisitable (defer) decision. The DB trigger prevents this from ever running on an already-decided row. */
  async recordDecision(id: string, input: DecisionInput): Promise<BlueprintActionItemRow> {
    const { data, error } = await this.db
      .from('blueprint_action_items')
      .update(input)
      .eq('id', id)
      .select(ACTION_ITEM_COLS)
      .single()
    if (error) throw new Error(`recordBlueprintActionItemDecision: ${error.message}`)
    return data as unknown as BlueprintActionItemRow
  }

  async listForLearner(
    learnerId: string,
    schoolId: string,
    filters?: { context?: BlueprintActionContext; status?: BlueprintActionStatus }
  ): Promise<BlueprintActionItemRow[]> {
    let query = this.db
      .from('blueprint_action_items')
      .select(ACTION_ITEM_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
    if (filters?.context) query = query.eq('context', filters.context)
    if (filters?.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new Error(`listBlueprintActionItemsForLearner: ${error.message}`)
    return (data ?? []) as unknown as BlueprintActionItemRow[]
  }

  /** Approved rows only — the exact set `listApprovedBlueprintActionsForStakeholder` further filters by `visibility`. Never returns `teacher_only` rows to a non-teacher caller by itself; visibility filtering is the caller's job (`actionPlan/projections.ts`). */
  async listApprovedForLearner(learnerId: string, schoolId: string): Promise<BlueprintActionItemRow[]> {
    const { data, error } = await this.db
      .from('blueprint_action_items')
      .select(ACTION_ITEM_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listApprovedBlueprintActionItemsForLearner: ${error.message}`)
    return (data ?? []) as unknown as BlueprintActionItemRow[]
  }
}
