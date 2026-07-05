// lib/repositories/webhook.repository.ts
// All DB queries for platform events, subscriptions, and deliveries.

import { BaseRepository } from './base'
import type { PlatformEventRecord, PublishEventInput, DeliveryStatus } from '@/lib/events/types'
import { generateWebhookSecret } from '@/lib/events/utils'

// ── Column constants ──────────────────────────────────────────────────────────

const EVENT_COLS =
  'id, event_type, event_version, organization_id, actor_id, resource_type, resource_id, payload, idempotency_key, published_at'

const SUBSCRIPTION_COLS =
  'id, event_pattern, organization_id, max_retries'

const DELIVERY_COLS =
  'id, event_id, subscription_id, attempt_count, max_attempts'

const DELIVERY_WITH_JOIN_COLS = `
  id, event_id, subscription_id, attempt_count, max_attempts,
  event_subscriptions!inner (delivery_method, endpoint_url, handler_name, retry_delay_ms, signing_secret),
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
    signing_secret: string | null
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
   *
   * Race-safe: uses INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
   * (via upsert + ignoreDuplicates) instead of a plain insert, so concurrent
   * callers publishing the same idempotency_key never see a unique-violation
   * error. When the conflict branch is taken, PostgREST returns no row
   * (DO NOTHING has nothing to RETURN) — in that case, fetch and return the
   * row the winning concurrent caller created, so every caller receives the
   * same event record. idempotency_key is nullable and NULL never conflicts
   * with NULL in Postgres, so events published without a key always insert
   * normally and this fallback path is never taken for them.
   */
  async insertEvent(input: PublishEventInput): Promise<PlatformEventRecord> {
    const row = {
      event_type:      input.event_type,
      event_version:   input.event_version ?? '1.0',
      organization_id: input.organization_id ?? null,
      actor_id:        input.actor_id ?? null,
      resource_type:   input.resource_type,
      resource_id:     input.resource_id,
      payload:         input.payload ?? {},
      idempotency_key: input.idempotency_key ?? null,
    }

    if (!input.idempotency_key) {
      const { data, error } = await this.db
        .from('platform_events')
        .insert(row)
        .select(EVENT_COLS)
        .single()
      if (error) throw new Error(`Failed to publish event: ${error.message}`)
      return data as PlatformEventRecord
    }

    const { data, error } = await this.db
      .from('platform_events')
      .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select(EVENT_COLS)
      .maybeSingle()

    if (error) throw new Error(`Failed to publish event: ${error.message}`)
    if (data) return data as PlatformEventRecord

    // Conflict branch: another concurrent call already inserted this
    // idempotency_key. Fetch and return that row instead of throwing.
    const existing = await this.findEventByIdempotencyKey(input.idempotency_key)
    if (!existing) {
      throw new Error(
        `Failed to publish event: upsert reported a conflict on idempotency_key "${input.idempotency_key}" but no existing row could be found`
      )
    }
    return existing
  }

  /**
   * Create a webhook event subscription. Generates a signing secret when
   * delivery_method is 'webhook' — the secret is returned once here and
   * never stored in plaintext-retrievable form anywhere else; the caller
   * is responsible for showing it to the user exactly once.
   */
  async createSubscription(input: {
    organization_id: string
    event_pattern: string
    delivery_method: string
    endpoint_url?: string | null
    handler_name?: string | null
    max_retries?: number
    retry_delay_ms?: number
  }): Promise<{ id: string; signing_secret: string | null }> {
    const signing_secret = input.delivery_method === 'webhook' ? generateWebhookSecret() : null

    const { data, error } = await this.db
      .from('event_subscriptions')
      .insert({
        organization_id: input.organization_id,
        event_pattern:   input.event_pattern,
        delivery_method: input.delivery_method,
        endpoint_url:    input.endpoint_url ?? null,
        handler_name:    input.handler_name ?? null,
        signing_secret,
        max_retries:     input.max_retries ?? 3,
        retry_delay_ms:  input.retry_delay_ms ?? 1000,
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to create event subscription: ${error.message}`)
    return { id: data.id, signing_secret }
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
   * Atomically claim a batch of pending/failed deliveries that are due for
   * processing, and return them joined with their subscription and event
   * data.
   *
   * Claiming (marking rows 'processing') and reading which rows were
   * claimed used to be two separate calls — a plain SELECT followed by a
   * separate UPDATE. That left a real race window: if two dispatch-cron
   * invocations overlapped (e.g. a slow batch still running when the next
   * minute's invocation starts), both could SELECT the same still-'pending'
   * rows before either UPDATE committed, and both would then process and
   * deliver the same webhook.
   *
   * Fixed by claiming via claim_pending_deliveries(), a SECURITY DEFINER SQL
   * function that does `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP
   * LOCKED) RETURNING *` in one atomic statement — Postgres guarantees two
   * concurrent callers can never both claim the same row. The follow-up
   * join-select below is safe precisely because it only reads rows that
   * this call already exclusively claimed (status is now 'processing', not
   * 'pending'/'failed'), so no other caller can claim them out from under us.
   */
  async claimPendingDeliveries(batchSize = 50): Promise<DeliveryWithJoins[]> {
    const { data: claimed, error: claimError } = await this.db
      .rpc('claim_pending_deliveries', { batch_size: batchSize })

    if (claimError) throw new Error(`Failed to claim deliveries: ${claimError.message}`)
    if (!claimed?.length) return []

    const ids = (claimed as { id: string }[]).map(d => d.id)

    const { data, error } = await this.db
      .from('event_deliveries')
      .select(DELIVERY_WITH_JOIN_COLS)
      .in('id', ids)

    if (error) throw new Error(`Failed to fetch claimed deliveries: ${error.message}`)
    return (data ?? []) as unknown as DeliveryWithJoins[]
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

  /**
   * Count deliveries by status — used by the platform health endpoint to
   * surface a backlog of pending/failed/dead-letter event deliveries.
   */
  async findDeliveryStatusCounts(): Promise<Record<DeliveryStatus, number>> {
    const statuses: DeliveryStatus[] = ['pending', 'processing', 'delivered', 'failed', 'dead_letter']

    const counts = await Promise.all(
      statuses.map(async status => {
        const { count } = await this.db
          .from('event_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('status', status)
        return [status, count ?? 0] as const
      })
    )

    return Object.fromEntries(counts) as Record<DeliveryStatus, number>
  }
}
