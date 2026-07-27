// lib/repositories/blueprintActionReview.repository.ts
//
// Owns `blueprint_action_reviews` exclusively (Phase 2D of
// docs/architecture/blueprint-living-action-plan-audit.md — see
// docs/architecture/blueprint-review-loop-phase2d.md). No business logic
// here (no authorization, no snapshot-gathering) — that lives in
// lib/learnerBlueprint/actionPlan/review.ts. This repository only knows how
// to read and insert rows; the DB's own triggers
// (enforce_blueprint_action_reviews_immutability) are the final backstop
// against a review ever being changed or deleted, even by a future bug in
// the service layer — there is no `update`/`delete` method here on purpose.

import { BaseRepository } from './base'

export type BlueprintActionReviewDecision = 'complete' | 'needs_revision' | 'reopen' | 'defer' | 'no_decision'

export type BlueprintActionReviewRow = {
  id: string
  learner_id: string
  school_id: string
  blueprint_action_item_id: string
  decision: BlueprintActionReviewDecision
  notes: string | null
  assignment_snapshot: unknown
  compass_snapshot: unknown
  evidence_snapshot: unknown
  projection_snapshot: unknown
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export type InsertBlueprintActionReviewInput = {
  learner_id: string
  school_id: string
  blueprint_action_item_id: string
  decision: BlueprintActionReviewDecision
  notes: string | null
  assignment_snapshot: unknown
  compass_snapshot: unknown
  evidence_snapshot: unknown
  projection_snapshot: unknown
  reviewed_by: string | null
}

const REVIEW_COLS =
  'id, learner_id, school_id, blueprint_action_item_id, decision, notes, assignment_snapshot, compass_snapshot, evidence_snapshot, projection_snapshot, reviewed_by, created_at, updated_at'

export class BlueprintActionReviewRepository extends BaseRepository {
  async insert(input: InsertBlueprintActionReviewInput): Promise<BlueprintActionReviewRow> {
    const { data, error } = await this.db
      .from('blueprint_action_reviews')
      .insert(input)
      .select(REVIEW_COLS)
      .single()
    if (error) throw new Error(`insertBlueprintActionReview: ${error.message}`)
    return data as unknown as BlueprintActionReviewRow
  }

  /** Every review for this action item, newest first — "previous review history" for the review snapshot, and the input `reviewBlueprintAction` diffs the new projection snapshot against. */
  async listForActionItem(actionItemId: string): Promise<BlueprintActionReviewRow[]> {
    const { data, error } = await this.db
      .from('blueprint_action_reviews')
      .select(REVIEW_COLS)
      .eq('blueprint_action_item_id', actionItemId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listBlueprintActionReviewsForActionItem: ${error.message}`)
    return (data ?? []) as unknown as BlueprintActionReviewRow[]
  }
}
