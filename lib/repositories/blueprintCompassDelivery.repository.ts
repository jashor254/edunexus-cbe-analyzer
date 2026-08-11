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

  /** One delivery by id — the durable provenance record. */
  async findById(id: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .select(DELIVERY_COLS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`findBlueprintCompassDeliveryById: ${error.message}`)
    return data as unknown as BlueprintCompassDeliveryRow | null
  }

  /**
   * The learner's currently-unconsumed teacher intervention, if any — an
   * `available` delivery that no Compass session has claimed yet.
   *
   * Exists so a second delivery cannot silently destroy a first one that the
   * learner has not acted on (Phase 2.6 §12). Learner-scoped by the Core
   * `learners.id` this table is keyed on.
   */
  async findActiveForLearner(coreLearnerId: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .select(DELIVERY_COLS)
      .eq('learner_id', coreLearnerId)
      .eq('status', 'available')
      .is('compass_session_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`findActiveBlueprintCompassDeliveryForLearner: ${error.message}`)
    return data as unknown as BlueprintCompassDeliveryRow | null
  }

  /**
   * Binds a delivery to the exact Compass session that consumed it:
   * `available` -> `started`, storing `compass_session_id`.
   *
   * The state precondition lives in the WHERE clause, not in the caller — a
   * concurrent double-claim (two tabs, a retried first message) is resolved
   * by the database, and the loser gets `null` rather than silently
   * overwriting the winner's binding. This is why there is no generic
   * `updateDelivery(id, patch)`: no caller should be able to move a delivery
   * into an arbitrary state, and the atomicity would be lost if they could.
   *
   * Returns the bound row, or `null` when this call was not the one that
   * claimed it (already started, already completed, or claimed concurrently).
   */
  async claimAvailable(deliveryId: string, compassSessionId: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .update({ status: 'started', compass_session_id: compassSessionId, updated_at: new Date().toISOString() })
      .eq('id', deliveryId)
      .eq('status', 'available')
      .is('compass_session_id', null)
      .select(DELIVERY_COLS)
    if (error) throw new Error(`claimAvailableBlueprintCompassDelivery: ${error.message}`)
    return ((data ?? [])[0] as unknown as BlueprintCompassDeliveryRow) ?? null
  }

  /**
   * `started` -> `completed`, and ONLY for the exact session that claimed it.
   *
   * Completion is matched on `compass_session_id`, never on learner+subject+
   * recency — "did Mary finish the session I sent her to" is a different
   * question from "did Mary do any Maths Compass", and this is the method
   * that keeps them different. Returns `null` if this session does not own
   * the delivery or it is not in `started`, which makes a repeat end call a
   * no-op rather than an error.
   */
  async completeForSession(deliveryId: string, compassSessionId: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', deliveryId)
      .eq('status', 'started')
      .eq('compass_session_id', compassSessionId)
      .select(DELIVERY_COLS)
    if (error) throw new Error(`completeBlueprintCompassDeliveryForSession: ${error.message}`)
    return ((data ?? [])[0] as unknown as BlueprintCompassDeliveryRow) ?? null
  }

  /** The delivery bound to this exact Compass session, if any — the reverse provenance lookup. */
  async findByCompassSessionId(compassSessionId: string): Promise<BlueprintCompassDeliveryRow | null> {
    const { data, error } = await this.db
      .from('blueprint_compass_deliveries')
      .select(DELIVERY_COLS)
      .eq('compass_session_id', compassSessionId)
      .maybeSingle()
    if (error) throw new Error(`findBlueprintCompassDeliveryBySessionId: ${error.message}`)
    return data as unknown as BlueprintCompassDeliveryRow | null
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
