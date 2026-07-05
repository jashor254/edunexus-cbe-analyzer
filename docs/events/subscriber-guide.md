# Webhook Subscriber Guide

Step-by-step guide for receiving EduNexus platform events in your application.

## Step 1 — Create a Project in DevPortal

1. Log in at `developers.edunexus.co.ke`
2. Create a project and obtain your `client_id` and API key
3. Note your `organization_id` — this scopes events to your school/org

## Step 2 — Register a Webhook Endpoint

```bash
POST /api/v1/webhooks/subscriptions
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "endpoint_url": "https://yourapp.example.com/webhooks/edunexus",
  "event_pattern": "teacher.*",
  "organization_id": "<your_school_id>",
  "max_retries": 3
}
```

Response:
```json
{
  "id": "<subscription_uuid>",
  "signing_secret": "whs_<64_char_secret>",
  "is_active": true
}
```

Store the `signing_secret` securely. It is shown only once.

## Step 3 — Implement Your Endpoint

Your endpoint must:
1. Parse the raw request body as bytes (do not decode before verifying)
2. Verify the HMAC signature
3. Return HTTP 200 within 10 seconds
4. Process the event asynchronously if needed

```typescript
// Next.js App Router example
import { createHmac, timingSafeEqual } from 'crypto'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-edunexus-signature') ?? ''
  const secret = process.env.EDUNEXUS_WEBHOOK_SECRET!

  // 1. Verify signature
  const expected = 'sha512=' + createHmac('sha512', secret).update(rawBody).digest('hex')
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))

  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse event
  const event = JSON.parse(rawBody)

  // 3. Dispatch by event type
  switch (event.event_type) {
    case 'teacher.assessment.created':
      await handleAssessmentCreated(event.payload)
      break
    case 'billing.payment.succeeded':
      await handlePaymentSucceeded(event.payload)
      break
    // add more handlers as needed
  }

  // 4. Acknowledge
  return new Response('OK', { status: 200 })
}
```

## Step 4 — Handle Idempotency

The same event may be delivered more than once (e.g. after a network timeout). Use the event `id` as an idempotency key:

```typescript
const alreadyProcessed = await db.query(
  'SELECT 1 FROM processed_events WHERE event_id = $1',
  [event.id]
)
if (alreadyProcessed.rows.length) return new Response('OK')

// Process and mark as handled
await db.query('INSERT INTO processed_events (event_id) VALUES ($1)', [event.id])
```

## Step 5 — Test Your Endpoint

Use the DevPortal's "Send Test Event" feature to send a sample payload to your endpoint without triggering real business logic.

Alternatively, use the EduNexus CLI:

```bash
edunexus webhooks test --subscription <id> --event teacher.assessment.created
```

## Step 6 — Monitor Deliveries

In DevPortal → Webhooks → Delivery Logs, you can see:
- Delivery status (pending / delivered / failed / dead_letter)
- HTTP response code from your endpoint
- Retry history and timestamps
- Error messages on failure

## Event Pattern Reference

| Pattern | Matches |
|---------|---------|
| `*` | All events (platform-wide only) |
| `teacher.*` | All teacher events |
| `student.*` | All student events |
| `billing.*` | All billing events |
| `billing.payment.*` | Payment succeeded and failed |
| `teacher.assessment.created` | Exact match only |

## Common Mistakes

- **Returning non-200 for events you don't handle** — return 200 always, even if you ignored the event type
- **Verifying signature after JSON.parse** — always verify on the raw body string, before parsing
- **Blocking the response for slow processing** — queue the work, respond immediately
- **Not handling duplicate deliveries** — always implement idempotency
