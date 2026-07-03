// lib/repositories/webhook.repository.ts
// All DB queries for platform events, subscriptions, and deliveries.

import { BaseRepository } from './base'
import type { PlatformEventRecord, PublishEventInput, DeliveryStatus } from '@/lib/events/types'

// ── Column constants ──────────────────────────────────────────────────────────

const EVENT_COLS =
  'id, event_type, event_version, organization_id, actor_id, resource_type, resource_id, payload, idempotency_key, published_at, correlation_id, trace_id, environment'

const SUBSCRIPTION_COLS =
  'id, event_pattern, organization_id, max_retries'

const DELIVERY_COLS =
  'id, event_id, subscription_id, attempt_count, max_attempts'

const DELIVERY_WITH_JOIN_COLS = `
  id, event_id, subscription_id, attempt_count, max_attempts,
  event_subscriptions!inner (delivery_method, endpoint_url, handler_name, retry_delay_ms),
  platform_events!inner (event_type, event_version, payload, resource_type, resource_id, organization_id)
`

// ── Types ─────────────────────────────────────────────────────────────────────

type EventSubscriptionRow = {
  id: string
  event_pattern: string
  organization_id: string | null
  max_retries: number
}

type DeliveryInsertRow = {
  event_id: string
  subscription_id: string
  status: 'pending'
  max_attempts: number
  next_attempt_at: string
}

type DeliveryWithJoins = {
  id: string
  event_id: string
  subscription_id: string
  attempt_count: number
  max_attempts: number
  event_subscriptions: {
    delivery_method: string
    endpoint_url: string | null
    handler_name: string | null
    retry_delay_ms: number
  }
  platform_events: {
    event_type: string
    event_version: string
    payload: Record<string, unknown>
    resource_type: string
    resource_id: string
    organization_id: string | null
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

export class WebhookRepository extends BaseRepository {
  /**
   * Find an existing event by its idempotency key.
   * Returns the existing record to prevent duplicate publishes.
   */
  async findEventByIdempotencyKey(key: string): Promise<PlatformEventRecord | null> {
    const { data } = await this.db
      .from('platform_events')
      .select(EVENT_COLS)
      .eq('idempotency_key', key)
      .maybeSingle()

    return (data as PlatformEventRecord) ?? null
  }

  /**
   * Insert a new platform event and return the created record.
   */
  async insertEvent(input: PublishEventInput): Promise<PlatformEventRecord> {
    const { data, error } = await this.db
      .from('platform_events')
      .insert({
        event_type:      input.event_type,
        event_version:   input.event_version ?? '1.0',
        organization_id: input.organization_id ?? null,
        actor_id:        input.actor_id ?? null,
        resource_type:   input.resource_type,
        resource_id:     input.resource_id,
        payload:         input.payload ?? {},
        idempotency_key: input.idempotency_key ?? null,
        correlation_id:  input.correlation_id ?? null,
        trace_id:        input.trace_id ?? null,
        environment:     input.environment ?? null,
      })
      .select(EVENT_COLS)
      .single()

    if (error) throw new Error(`Failed to publish event: ${error.message}`)
    return data as PlatformEventRecord
  }

  /**
   * Fetch all active event subscriptions.
   * Used by the scheduler to find matching subscribers after a publish.
   */
  async findActiveSubscriptions(): Promise<EventSubscriptionRow[]> {
    const { data, error } = await this.db
      .from('event_subscriptions')
      .select(SUBSCRIPTION_COLS)
      .eq('is_active', true)

    if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`)
    return (data ?? []) as EventSubscriptionRow[]
  }

  /**
   * Bulk-insert delivery rows for matching subscriptions.
   */
  async insertDeliveries(deliveries: DeliveryInsertRow[]): Promise<void> {
    if (!deliveries.length) return

    const { error } = await this.db
      .from('event_deliveries')
      .insert(deliveries)

    if (error) throw new Error(`Failed to insert deliveries: ${error.message}`)
  }

  /**
   * Fetch a batch of pending/failed deliveries that are due for processing,
   * joined with their subscription and event data.
   */
  async findPendingDeliveries(batchSize = 50): Promise<DeliveryWithJoins[]> {
    const { data, error } = await this.db
      .from('event_deliveries')
      .select(DELIVERY_WITH_JOIN_COLS)
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .limit(batchSize)

    if (error) throw new Error(`Failed to fetch deliveries: ${error.message}`)
    return (data ?? []) as unknown as DeliveryWithJoins[]
  }

  /**
   * Mark a batch of delivery rows as 'processing'.
   * Called immediately after claiming a batch to prevent double-processing.
   */
  async markDeliveriesProcessing(ids: string[]): Promise<void> {
    if (!ids.length) return

    const { error } = await this.db
      .from('event_deliveries')
      .update({ status: 'processing', last_attempted_at: new Date().toISOString() })
      .in('id', ids)

    if (error) throw new Error(`Failed to mark deliveries as processing: ${error.message}`)
  }

  /**
   * Update a single delivery's status after an attempt.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    fields: {
      status: DeliveryStatus
      attempt_count: number
      delivered_at?: string
      error_message?: string
      next_attempt_at?: string | null
    }
  ): Promise<void> {
    const { error } = await this.db
      .from('event_deliveries')
      .update(fields)
      .eq('id', deliveryId)

    if (error) throw new Error(`Failed to update delivery status: ${error.message}`)
  }
}
