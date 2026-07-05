# Webhook Delivery Flow

## Subscription Model

External developers register webhook subscriptions via the DevPortal or the Subscriptions API. Each subscription specifies:

- `endpoint_url` — the HTTPS URL to POST events to
- `event_pattern` — glob pattern matching event types (e.g. `teacher.*`, `billing.payment.*`, `*`)
- `organization_id` — optional; if set, only receives events from that org
- `max_retries` — retry count on failure (default: 3)
- `retry_delay_ms` — base backoff delay (default: 30,000ms)
- `is_active` — boolean; inactive subscriptions receive no deliveries

## HTTP Request Format

The dispatcher sends a POST request to the subscriber's endpoint:

```
POST https://your-endpoint.example.com/webhooks/edunexus
Content-Type: application/json
X-EduNexus-Signature: sha512=<hmac_hex>
X-EduNexus-Event: teacher.assessment.created
X-EduNexus-Delivery: <delivery_uuid>
X-EduNexus-Event-Version: 1.0

{
  "id": "<event_uuid>",
  "event_type": "teacher.assessment.created",
  "event_version": "1.0",
  "resource_type": "assessment",
  "resource_id": "<assessment_uuid>",
  "actor_id": "<teacher_uuid>",
  "organization_id": "<school_uuid>",
  "payload": { ... },
  "published_at": "2026-07-02T10:00:00Z"
}
```

## HMAC Signature Verification

The `X-EduNexus-Signature` header contains `sha512=<hex>` where the hex is:

```
HMAC-SHA512(secret, raw_body_bytes)
```

`secret` is the webhook signing secret generated when the subscription is created. It is shown once in the DevPortal and cannot be retrieved again.

**Always verify the signature before processing.** Use timing-safe comparison.

Example (Node.js):
```typescript
import { createHmac, timingSafeEqual } from 'crypto'

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = 'sha512=' + createHmac('sha512', secret).update(rawBody).digest('hex')
  if (signature.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

## Response Requirements

- Return HTTP **2xx** (200, 201, 204) to acknowledge delivery
- Return within **10 seconds** — longer responses are treated as failures
- Response body is ignored
- Any non-2xx status or timeout triggers a retry

## Org-Scoped vs Platform-Wide Subscriptions

| Subscription type | `organization_id` | Receives |
|-------------------|------------------|---------|
| Platform-wide | `null` | All matching events, all orgs |
| Org-scoped | `<uuid>` | Only events from that org |

Most DevPortal subscriptions are org-scoped. Platform-wide subscriptions require admin approval.
