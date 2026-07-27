// lib/repositories/blueprintCompassDelivery.repository.ts
//
// Owns `blueprint_compass_deliveries` exclusively (Phase 2C of
// docs/architecture/blueprint-living-action-plan-audit.md — see
// docs/architecture/blueprint-compass-delivery-phase2c.md). No business
// logic here (no authorization, no content mapping) — that lives in
// lib/learnerBlueprint/actionPlan/delivery/compass.ts. This repository only
// knows how to read and write rows.

import { ConflictError } from '@/lib/core/errors'
import { BaseRepository } from './base'

export type BlueprintCompassDeliveryStatus = 'available' | 'started' | 'completed' | 'expired'

export type BlueprintCompassDeliveryRow = {
  id: string
  learner_id: string
  school_id: string
  blueprint_action_item_id: string
  status: BlueprintCompassDeliveryStatus
  subject: string
  objective: string
  learner_instructions: string
  success_indicator: string | null
  curriculum_reference: string | null
  review_date: string | null
  compass_session_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type InsertBlueprintCompassDeliveryInput = {
  learner_id: string
  school_id: string
  blueprint_action_item_id: string
  subject: string
  objective: string
  learner_instructions: string
  success_indicator: string | null
  curriculum_reference: string | null
  review_date: string | null
  created_by: string | null
}

const DELIVERY_COLS =
  'id, learner_id, school_id, blueprint_action_item_id, status, subject, objective, learner_instructions, success_indicator, curriculum_reference, review_date, compass_session_id, created_by, created_at, updated_at'

export class BlueprintCompassDeliveryRepository extends BaseRepository {
  /**
   * Throws {@link ConflictError} (not a generic `Error`) on a
   * `blueprint_action_item_id` uniqueness violation (Postgres `23505`) — the
   * concurrent-delivery race the delivery adapter's idempotency contract
   * depends on the database to resolve deterministically.
   */
  async insert(input: InsertBlueprintCompassDeliveryInput): Promise<BlueprintCompassDeliveryRow> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .insert({ ...input, status: 'available' })
      .select(DELIVERY_COLS)
      .single()
    if (error) {
      if (error.code === '23505') throw new ConflictError(`insertBlueprintCompassDelivery: duplicate blueprint_action_item_id (${error.message})`)
      throw new Error(`insertBlueprintCompassDelivery: ${error.message}`)
    }
    return data as unknown as BlueprintCompassDeliveryRow
  }

  /** The delivery already created for this Blueprint action item, if any — the natural-key idempotency lookup, never title/content matching. */
  async findByBlueprintActionItemId(actionItemId: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .select(DELIVERY_COLS)
      .eq('blueprint_action_item_id', actionItemId)
      .maybeSingle()
    if (error) throw new Error(`findBlueprintCompassDeliveryByActionItemId: ${error.message}`)
    return data as unknown as BlueprintCompassDeliveryRow | null
  }
}
