// lib/events/dispatch.ts
// Process pending event deliveries — called from cron or a background worker.
import { repos } from '@/lib/repositories'
import { signWebhookPayload } from './utils'
import type { DeliveryStatus } from './types'

type DeliveryRow = {
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

/**
 * Process a batch of pending event deliveries.
 * Call from a cron job: POST /api/cron/events/dispatch
 */
export async function dispatchPendingEvents(batchSize = 50): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const deliveries = await repos.webhooks.claimPendingDeliveries(batchSize)

  if (!deliveries.length) return { processed: 0, succeeded: 0, failed: 0 }

  let succeeded = 0
  let failed = 0

  await Promise.allSettled(
    (deliveries as unknown as DeliveryRow[]).map(async delivery => {
      const sub = delivery.event_subscriptions
      const event = delivery.platform_events
      const newAttempt = delivery.attempt_count + 1

      try {
        if (sub.delivery_method === 'webhook' && sub.endpoint_url) {
          await deliverWebhook(sub.endpoint_url, event, delivery.id, sub.signing_secret)
        } else if (sub.delivery_method === 'internal' && sub.handler_name) {
          await deliverInternal(sub.handler_name, event)
        }
        // email / whatsapp delivery methods handled by their own lib functions

        await repos.webhooks.updateDeliveryStatus(delivery.id, {
          status:        'delivered' as DeliveryStatus,
          attempt_count: newAttempt,
          delivered_at:  new Date().toISOString(),
        })

        succeeded++
      } catch (err) {
        const isLastAttempt = newAttempt >= delivery.max_attempts
        const nextStatus: DeliveryStatus = isLastAttempt ? 'dead_letter' : 'failed'
        const nextAttemptAt = new Date(
          Date.now() + sub.retry_delay_ms * Math.pow(2, newAttempt - 1)
        ).toISOString()

        await repos.webhooks.updateDeliveryStatus(delivery.id, {
          status:          nextStatus,
          attempt_count:   newAttempt,
          error_message:   err instanceof Error ? err.message : String(err),
          next_attempt_at: isLastAttempt ? null : nextAttemptAt,
        })

        failed++
      }
    })
  )

  return { processed: deliveries.length, succeeded, failed }
}

async function deliverWebhook(
  url: string,
  event: DeliveryRow['platform_events'],
  deliveryId: string,
  signingSecret: string | null
): Promise<void> {
  const body = JSON.stringify({
    id:              deliveryId,
    event_type:      event.event_type,
    event_version:   event.event_version,
    resource_type:   event.resource_type,
    resource_id:     event.resource_id,
    organization_id: event.organization_id,
    payload:         event.payload,
    delivered_at:    new Date().toISOString(),
  })

  const headers: Record<string, string> = {
    'Content-Type':        'application/json',
    'X-EduNexus-Event':    event.event_type,
    'X-EduNexus-Delivery': deliveryId,
    'X-EduNexus-Version':  event.event_version,
  }

  // Subscriptions created before signing secrets existed (or created for
  // delivery_method !== 'webhook') have no secret — deliver unsigned rather
  // than failing the whole delivery. See lib/events/utils.ts for the
  // verification steps a receiver should perform against this header.
  if (signingSecret) {
    headers['X-EduNexus-Signature'] = `sha256=${await signWebhookPayload(signingSecret, body)}`
  }

  const response = await fetch(url, {
    method:  'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`)
  }
}

// Internal handlers are registered by name and called in-process
const INTERNAL_HANDLERS: Record<string, (event: DeliveryRow['platform_events']) => Promise<void>> = {}

export function registerEventHandler(
  name: string,
  handler: (event: DeliveryRow['platform_events']) => Promise<void>
): void {
  INTERNAL_HANDLERS[name] = handler
}

async function deliverInternal(
  handlerName: string,
  event: DeliveryRow['platform_events']
): Promise<void> {
  const handler = INTERNAL_HANDLERS[handlerName]
  if (!handler) throw new Error(`No handler registered for: ${handlerName}`)
  await handler(event)
}
