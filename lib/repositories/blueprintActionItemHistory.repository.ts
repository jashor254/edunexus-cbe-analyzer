// lib/repositories/blueprintActionItemHistory.repository.ts
//
// Owns `blueprint_action_item_history` exclusively (Phase 1 of
// docs/architecture/blueprint-living-action-plan-audit.md) — the
// append-only audit trail behind every `blueprint_action_items` lifecycle
// transition. No update/delete method exists here on purpose: the table's
// own DB triggers (trg_blueprint_action_item_history_no_update/no_delete)
// enforce unconditional immutability even against a service-role caller.

import { BaseRepository } from './base'
import type { BlueprintActionItemRow } from './blueprintActionItem.repository'
import type { LearnerId } from '@/lib/core/identityTypes'

export type BlueprintActionHistoryEventType =
  | 'proposed' | 'edited' | 'approved' | 'rejected' | 'deferred'
  | 'delivered' | 'delivered_to_compass'
  | 'review_completed' | 'review_revision_requested' | 'review_reopened' | 'review_deferred' | 'review_no_decision'

export type BlueprintActionItemHistoryRow = {
  id: string
  action_item_id: string
  event_type: BlueprintActionHistoryEventType
  previous_status: string | null
  resulting_status: string
  snapshot: BlueprintActionItemRow
  actor_id: string | null
  reason: string | null
  created_at: string
}

export type InsertBlueprintActionItemHistoryInput = {
  action_item_id: string
  event_type: BlueprintActionHistoryEventType
  previous_status: string | null
  resulting_status: string
  snapshot: BlueprintActionItemRow
  actor_id: string | null
  reason: string | null
}

const HISTORY_COLS = 'id, action_item_id, event_type, previous_status, resulting_status, snapshot, actor_id, reason, created_at'

export class BlueprintActionItemHistoryRepository extends BaseRepository {
  async record(input: InsertBlueprintActionItemHistoryInput): Promise<BlueprintActionItemHistoryRow> {
    const { data, error } = await this.db
      .from('blueprint_action_item_history')
      .insert(input)
      .select(HISTORY_COLS)
      .single()
    if (error) throw new Error(`recordBlueprintActionItemHistory: ${error.message}`)
    return data as unknown as BlueprintActionItemHistoryRow
  }

  async listForActionItem(actionItemId: string): Promise<BlueprintActionItemHistoryRow[]> {
    const { data, error } = await this.db
      .from('blueprint_action_item_history')
      .select(HISTORY_COLS)
      .eq('action_item_id', actionItemId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`listBlueprintActionItemHistory: ${error.message}`)
    return (data ?? []) as unknown as BlueprintActionItemHistoryRow[]
  }
}
