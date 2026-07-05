# Event Lifecycle

## End-to-End Flow

```
Business Action (createAssessment, endSession, etc.)
        │
        ▼
  publishEvent(input)                          lib/events/publish.ts
        │
        ├─── idempotency check ──────────────► findEventByIdempotencyKey()
        │         │ duplicate found → return existing event
        │         │ no duplicate → continue
        │
        ├─── insertEvent(input) ─────────────► platform_events table
        │                                       (id, event_type, actor_id,
        │                                        resource_id, payload, ...)
        │
        └─── scheduleDeliveries() [async] ──► findActiveSubscriptions()
                    │                          (event_subscriptions table)
                    │
                    ├─── filter by org + pattern match
                    │
                    └─── insertDeliveries() ──► event_deliveries table
                                                (status='pending',
                                                 next_attempt_at=now)
                                                      │
                                    ┌─────────────────┘
                                    │ (cron every 30s)
                                    ▼
                    dispatchPendingEvents()             lib/events/dispatch.ts
                            │
                            ├─── findPendingDeliveries(batchSize=50)
                            │
                            ├─── markDeliveriesProcessing(ids)
                            │
                            └─── for each delivery:
                                      │
                                      ├─── HTTP POST to endpoint_url
                                      │    (with HMAC signature header)
                                      │
                                      ├─── 200 OK → status='delivered'
                                      │
                                      └─── error → status='failed'
                                                    next_attempt_at += backoff
                                                    attempt_count >= max_attempts
                                                    → status='dead_letter'
```

## State Machine (event_deliveries.status)

```
pending ──► processing ──► delivered
    │                          │
    │        (error)           │
    └──────► failed ───────────┘
                │
                │ (max retries exhausted)
                ▼
           dead_letter
```

## Timing

| Phase | Timing |
|-------|--------|
| publishEvent() → DB insert | < 100ms (synchronous) |
| scheduleDeliveries() | async, ~100-500ms, never blocks caller |
| Cron dispatch cycle | every 30 seconds |
| Max delivery latency (no retries) | < 60 seconds from publish |
| Delivery timeout per attempt | 10 seconds |
