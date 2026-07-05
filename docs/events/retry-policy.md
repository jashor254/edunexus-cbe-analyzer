# Retry Policy

## Delivery Attempts

Each subscription configures `max_retries`. The total number of delivery attempts is `max_retries + 1` (the initial attempt plus retries).

Default: 3 retries = 4 total attempts.

## Backoff Schedule

Retry delays use the subscription's `retry_delay_ms` as the base unit with exponential growth:

| Attempt | Delay before retry |
|---------|-------------------|
| 1 (initial) | immediate |
| 2 | retry_delay_ms × 2 |
| 3 | retry_delay_ms × 4 |
| 4 | retry_delay_ms × 8 |

Default `retry_delay_ms` = 30,000 (30 seconds).

Example with default settings:
- Attempt 1: immediate
- Attempt 2: 60 seconds after failure
- Attempt 3: 120 seconds after failure
- Attempt 4: 240 seconds after failure → if this fails, status = `dead_letter`

## Dead Letter

When `attempt_count >= max_attempts`, the delivery status is set to `dead_letter`. Dead-letter deliveries are never retried automatically.

To re-process a dead-letter delivery: update `status = 'pending'` and `next_attempt_at = now()` directly in the DB, or use the DevPortal dashboard.

## Failure Conditions

A delivery attempt is considered failed when:
- HTTP response status is not 2xx
- The HTTP request times out (10-second timeout)
- A network error prevents the request from being sent
- The endpoint URL is unreachable

## What Is NOT Retried

- `already_processed` idempotency hits — these are no-ops, not failures
- Events with no matching subscriptions — nothing to retry

## Monitoring

Failed deliveries are visible in the `event_deliveries` table. The `error_message` column stores the failure reason from the last attempt.
