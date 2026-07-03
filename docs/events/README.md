# EduNexus Event System — Documentation Index

The EduNexus event bus publishes typed platform events to external subscribers via webhooks. Events flow from business logic → `publishEvent()` → `platform_events` table → delivery scheduler → external HTTP endpoints.

## Documents

| File | Contents |
|------|----------|
| [event-catalog.md](event-catalog.md) | All event types: name, description, resource_type, when emitted |
| [payload-schemas.md](payload-schemas.md) | TypeScript payload shape for every event |
| [lifecycle.md](lifecycle.md) | End-to-end event flow diagram |
| [retry-policy.md](retry-policy.md) | Retry strategy, backoff, dead-letter |
| [webhook-flow.md](webhook-flow.md) | How external subscribers receive events |
| [subscriber-guide.md](subscriber-guide.md) | Step-by-step webhook registration guide |

## Quick Start

1. Register a webhook endpoint via the DevPortal or API
2. Subscribe to one or more event patterns (e.g. `teacher.*`, `billing.payment.*`)
3. Receive HTTPS POST requests when matching events occur
4. Verify the `X-EduNexus-Signature` header on every delivery
5. Return HTTP 200 within 10 seconds; anything else triggers a retry

## Architecture

```
lib/ business logic
    └── publishEvent()           [lib/events/publish.ts]
        └── platform_events      [Supabase table]
            └── scheduleDeliveries()
                └── event_deliveries [Supabase table]
                    └── dispatchPendingEvents() [cron: /api/cron/events/dispatch]
                        └── HTTP POST → subscriber endpoint
```

## Event Versioning

All events carry `event_version: '1.0'`. Breaking payload changes will increment the version. Subscribers should check `event_version` before processing.
