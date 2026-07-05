# Event-Driven Architecture

EduNexus uses a database-backed event bus combined with a persistent job queue for all asynchronous processing. Vercel Cron drives the execution. There is no external message broker.

---

## Design Philosophy

**Durability over latency.** Events and jobs are written to PostgreSQL before being processed. If the processing step fails, the record remains and will be retried. Nothing is lost to a dead process or a network partition.

**Idempotency is mandatory.** Every event publish and job enqueue carries an idempotency key. Duplicate submissions (from retries, double-submits, or cron overlap) are silently deduplicated at the database level.

**Cron as the scheduler.** Vercel Cron triggers job processing and event dispatch on a 1-minute heartbeat. This eliminates the need for a persistent background worker while providing reliable, observable background execution.

---

## Platform Events

### What Is a Platform Event?

A platform event is a fact that something happened in the system. It is immutable once written. Other parts of the platform react to events asynchronously.

Examples:
- `teacher.sow.generated` — a teacher generated a scheme of work
- `assessment.results.uploaded` — a teacher uploaded student scores
- `organization.member.invited` — a new member was invited
- `student.competency.updated` — the learner model updated a competency score
- `billing.token.depleted` — an organization's token balance reached zero

### Event Schema (`platform_events` table)

```sql
platform_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  event_type      text NOT NULL,          -- e.g. 'teacher.sow.generated'
  event_version   text NOT NULL DEFAULT '1.0',
  resource_type   text,                  -- e.g. 'sow', 'assessment', 'organization'
  resource_id     uuid,                  -- ID of the affected resource
  org_id          uuid REFERENCES organizations(id),
  user_id         uuid REFERENCES auth.users(id),
  payload         jsonb NOT NULL DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}',
  idempotency_key text UNIQUE,           -- prevents duplicate events
  published_at    timestamptz NOT NULL DEFAULT now()
)
```

### Publishing an Event

```typescript
// lib/events/publish.ts
await publishEvent({
  eventType: 'teacher.sow.generated',
  resourceType: 'sow',
  resourceId: sow.id,
  orgId: ctx.orgId,
  userId: ctx.userId,
  payload: { subjectId, gradeLevel, termNumber, weekCount },
  idempotencyKey: `sow.generated.${sow.id}`,
})
```

If a record with the same `idempotency_key` already exists, the insert is silently ignored (PostgreSQL `ON CONFLICT DO NOTHING`).

---

## Subscriptions

### What Is a Subscription?

A subscription declares interest in events matching a pattern. When the event bus dispatches an event, it delivers it to all matching subscriptions.

### Subscription Schema (`event_subscriptions` table)

```sql
event_subscriptions (
  id              uuid PRIMARY KEY,
  created_at      timestamptz,
  updated_at      timestamptz,
  org_id          uuid REFERENCES organizations(id),
  event_pattern   text NOT NULL,         -- pattern to match against event_type
  delivery_method text NOT NULL,         -- 'webhook' | 'internal' | 'email' | 'whatsapp'
  endpoint_url    text,                  -- for webhook delivery
  handler_name    text,                  -- for internal delivery
  is_active       boolean DEFAULT true,
  max_retries     int DEFAULT 3,
  metadata        jsonb DEFAULT '{}'
)
```

### Pattern Matching

| Pattern | Matches |
|---------|---------|
| `teacher.sow.generated` | Exact match only |
| `teacher.*` | All events starting with `teacher.` |
| `*` | All events |
| `assessment.results.*` | All result-related events |

### Delivery Methods

**`webhook`** — HTTP POST to `endpoint_url` with the event payload. Used for external developer integrations.

**`internal`** — Calls a registered handler function by `handler_name`. Used for first-party reactions (e.g., updating the learner model after an assessment is uploaded).

**`email`** — Sends an email via Resend. Used for teacher and parent notifications.

**`whatsapp`** — Sends a WhatsApp message. Used for engagement nudges.

---

## Event Dispatch (Cron)

### Delivery Flow

```
platform_events (new records)
        │
        ▼
/api/cron/events/dispatch (runs every minute)
        │
        ├── Query pending event_deliveries (status = 'pending', next_attempt_at <= now())
        │
        ├── For each delivery:
        │     ├── Mark as 'processing'
        │     ├── Deliver (HTTP POST, internal handler, email, WhatsApp)
        │     ├── On success: mark 'delivered', record delivered_at
        │     └── On failure: mark 'failed', increment attempt_count,
        │                     set next_attempt_at (exponential backoff)
        │
        └── Return { processed, delivered, failed, duration_ms }
```

### Event Deliveries Schema (`event_deliveries` table)

```sql
event_deliveries (
  id              uuid PRIMARY KEY,
  created_at      timestamptz,
  updated_at      timestamptz,
  event_id        uuid REFERENCES platform_events(id),
  subscription_id uuid REFERENCES event_subscriptions(id),
  status          text DEFAULT 'pending',   -- pending | processing | delivered | failed | dead
  attempt_count   int DEFAULT 0,
  next_attempt_at timestamptz DEFAULT now(),
  delivered_at    timestamptz,
  last_error      text,
  response_status int
)
```

### Retry Policy

| Attempt | Delay Before Retry |
|---------|-------------------|
| 1st | 30 seconds |
| 2nd | 60 seconds |
| 3rd | 120 seconds |
| 4th | 240 seconds |
| After max_retries | Status → `dead` |

The delay formula is `30 * 2^(attempt_count - 1)` seconds. After `max_retries` attempts, the delivery is marked `dead` and no further retries occur. Dead deliveries remain in the table for investigation.

---

## Background Job Queue

### What Is a Job?

A job is a unit of deferred work that needs to run outside of a request/response cycle. Jobs are used for operations that are too slow, too expensive, or too side-effectful to run synchronously.

Examples:
- Sending an email after user registration
- Sending a WhatsApp nudge to a teacher
- Generating a PDF report for download
- Running an AI batch operation
- Importing a large data file

### Job Schema (`jobs` table)

```sql
jobs (
  id              uuid PRIMARY KEY,
  created_at      timestamptz,
  updated_at      timestamptz,
  queue_name      text NOT NULL,          -- which queue this job belongs to
  type            text NOT NULL,          -- job type, used to select handler
  status          text DEFAULT 'pending', -- pending | processing | completed | failed | dead_letter
  priority        int DEFAULT 5,          -- lower = higher priority (1 = urgent)
  payload         jsonb NOT NULL,
  result          jsonb,
  scheduled_at    timestamptz DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  attempt_count   int DEFAULT 0,
  max_attempts    int DEFAULT 3,
  idempotency_key text UNIQUE,
  org_id          uuid,
  error           text
)
```

### Enqueueing a Job

```typescript
// lib/jobs/enqueue.ts
await enqueueJob({
  queueName: 'email',
  type: 'send_invitation_email',
  payload: { to: 'teacher@school.ke', orgName: 'Nairobi Academy', token: '...' },
  priority: 3,
  idempotencyKey: `invitation.email.${invitationId}`,
})
```

### Job Processing (Cron)

```
/api/cron/jobs/process (runs every minute)
        │
        ├── Drain all 8 queues in parallel (each gets a time budget)
        │
        ├── Per queue:
        │     ├── SELECT jobs WHERE status='pending' AND scheduled_at <= now()
        │     │         ORDER BY priority ASC, scheduled_at ASC
        │     │         LIMIT N FOR UPDATE SKIP LOCKED
        │     │
        │     ├── Update status → 'processing'
        │     │
        │     ├── Look up handler in registry (Map<type, handler>)
        │     │
        │     ├── Execute handler(payload)
        │     │
        │     ├── On success: status → 'completed', result saved
        │     │
        │     └── On failure: attempt_count++
        │           ├── attempt_count < max_attempts:
        │           │     status → 'pending', scheduled_at = now() + backoff
        │           └── attempt_count >= max_attempts:
        │                 status → 'dead_letter'
        │
        └── Return summary per queue
```

### Queue Names

| Queue | Purpose | Workers (per tick) |
|-------|---------|-------------------|
| `email` | Outbound emails via Resend | 10 |
| `whatsapp` | WhatsApp messages | 10 |
| `webhook` | Outbound webhook deliveries | 10 |
| `report` | PDF generation | 5 |
| `ai.generation` | Batch AI content generation | 3 |
| `analytics` | Analytics writes (non-critical) | 20 |
| `data.import` | CSV/Excel file processing | 3 |
| `data.export` | Report data exports | 3 |

### Dead-Letter Queue

After `max_attempts` failures, a job moves to `dead_letter` status. Dead-letter jobs:

- Are not automatically retried.
- Are logged to `job_logs` with the last error.
- Are visible in the monitoring dashboard.
- Can be manually requeued via the admin API.
- Are automatically requeued by `/api/cron/dlq-requeue` (daily, at 03:30 AM) after investigation.

### Job Logs

```sql
job_logs (
  id         uuid PRIMARY KEY,
  created_at timestamptz,
  job_id     uuid REFERENCES jobs(id),
  attempt    int,
  level      text,    -- 'info' | 'warn' | 'error'
  message    text,
  data       jsonb
)
```

Every job execution writes structured logs. These logs are correlated by `job_id` and are queryable for debugging.

---

## Idempotency

Idempotency is enforced at the database level with unique constraints on `idempotency_key`.

**For events:**
```sql
UNIQUE (idempotency_key)
```
Duplicate event publishes with the same key are silently ignored.

**For jobs:**
```sql
UNIQUE (idempotency_key)
```
Duplicate job enqueues with the same key fail silently (the first enqueue wins).

**Idempotency key conventions:**

| Operation | Key Format |
|-----------|-----------|
| SOW generation | `sow.generated.{sowId}` |
| Invitation email | `invitation.email.{invitationId}` |
| Assessment result event | `assessment.results.{assessmentId}.{uploadedAt}` |
| Billing renewal | `billing.renewal.{orgId}.{periodStart}` |

---

## Webhook Flow

Webhooks are the mechanism by which external developers receive platform events.

```
Platform Event (teacher.sow.generated)
        │
        ▼
Event subscription lookup (delivery_method = 'webhook')
        │
        ▼
Create event_delivery record
        │
        ▼
/api/cron/events/dispatch
        │
        ▼
HTTP POST to endpoint_url
  Headers:
    Content-Type: application/json
    X-EduNexus-Event: teacher.sow.generated
    X-EduNexus-Delivery: {deliveryId}
    X-EduNexus-Signature: HMAC-SHA256 of payload with org webhook secret
  Body: { event_type, resource_type, resource_id, payload, metadata, published_at }
        │
        ├── 2xx response: delivery marked 'delivered'
        └── Non-2xx / timeout: retry with exponential backoff
```

**Signature verification:** Recipients must verify the `X-EduNexus-Signature` header using their webhook secret. This prevents spoofed webhook deliveries.

---

## Audit Logging

Audit logs capture who did what, when, and to what resource. They are separate from platform events and job logs.

```sql
audit_logs (
  id            uuid PRIMARY KEY,
  created_at    timestamptz,
  org_id        uuid,
  user_id       uuid,
  action        text,           -- e.g. 'member.role_changed'
  resource_type text,           -- e.g. 'organization_member'
  resource_id   uuid,
  old_values    jsonb,
  new_values    jsonb,
  ip_address    inet,
  user_agent    text
)
```

Audit logs are written by `lib/iam/` for all sensitive operations:
- Member invitation, acceptance, removal
- Role creation, update, deletion
- API key issuance and revocation
- Organization settings changes
- Billing changes

Audit logs are immutable. They are never updated or deleted.
