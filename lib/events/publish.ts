// lib/events/publish.ts
// Publish platform events. Downstream delivery is handled by the dispatcher.
import { repos } from '@/lib/repositories'
import type { PublishEventInput, PlatformEventRecord } from './types'

/**
 * Publish a platform event.
 * Idempotency key prevents duplicate events for the same operation.
 * Returns the created event record, or the existing one on duplicate key.
 */
export async function publishEvent(input: PublishEventInput): Promise<PlatformEventRecord> {
  // If idempotency_key is set, check for an existing event first
  if (input.idempotency_key) {
    const existing = await repos.webhooks.findEventByIdempotencyKey(input.idempotency_key)
    if (existing) return existing
  }

  const event = await repos.webhooks.insertEvent(input)

  // Asynchronously schedule delivery to matching subscriptions
  scheduleDeliveries(event.id, event.event_type, event.organization_id).catch(err =>
    console.error('[events/publish] scheduleDeliveries failed:', err instanceof Error ? err.message : String(err))
  )

  return event
}

/**
 * Create delivery records for all active subscriptions matching this event.
 * Runs in the background after publish — fires and forgets.
 */
async function scheduleDeliveries(
  eventId: string,
  eventType: string,
  organizationId: string | null
): Promise<void> {
  const subscriptions = await repos.webhooks.findActiveSubscriptions()

  if (!subscriptions.length) return

  const matching = subscriptions.filter(sub => {
    // Org-scoped subscriptions only receive events from their org
    if (sub.organization_id && sub.organization_id !== organizationId) return false
    return matchesPattern(eventType, sub.event_pattern)
  })

  if (!matching.length) return

  const deliveries = matching.map(sub => ({
    event_id:        eventId,
    subscription_id: sub.id,
    status:          'pending' as const,
    max_attempts:    sub.max_retries + 1,
    next_attempt_at: new Date().toISOString(),
  }))

  await repos.webhooks.insertDeliveries(deliveries)
}

/**
 * Match an event type against a subscription pattern.
 * 'teacher.*' matches 'teacher.sow.generated'
 * 'teacher.sow.*' matches 'teacher.sow.generated'
 * 'teacher.sow.generated' matches exactly
 */
function matchesPattern(eventType: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern === eventType) return true
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2)
    return eventType.startsWith(prefix + '.')
  }
  return false
}
