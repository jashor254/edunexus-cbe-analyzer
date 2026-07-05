# Observability

EduNexus uses structured logging, lightweight distributed tracing, and in-process metrics to provide operational visibility. All observability infrastructure lives in `lib/observability/`.

---

## Overview

```
lib/observability/
  ├── logger.ts    — Structured JSON logger with context binding
  ├── tracing.ts   — Lightweight span system with trace ID propagation
  └── metrics.ts   — In-memory counters, gauges, and histograms
```

The three pillars work together:
- **Logs** tell you what happened and why.
- **Traces** tell you where time was spent across a request.
- **Metrics** tell you how the system is behaving in aggregate.

---

## Structured Logging (`logger.ts`)

### Format

In production (`NODE_ENV === 'production'`), logs are emitted as newline-delimited JSON to stdout. This format is directly consumable by log aggregation systems (Vercel Log Drains, Datadog, Logtail, etc.).

In development, logs are pretty-printed to the console for readability.

**Log record shape:**

```json
{
  "timestamp": "2026-07-02T10:23:45.123Z",
  "level": "info",
  "service": "assessments",
  "message": "Assessment results uploaded",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "org_id": "org_...",
  "user_id": "usr_...",
  "request_id": "req_...",
  "assessment_id": "asm_...",
  "student_count": 32,
  "duration_ms": 142
}
```

### Context Binding

The logger is context-aware. Service functions create a logger pre-bound to their context rather than passing context to every log call:

```typescript
const log = logger.child({
  service: 'assessments',
  orgId: ctx.orgId,
  userId: ctx.userId,
  requestId: ctx.requestId,
})

log.info('Processing upload', { studentCount, filename })
log.warn('Missing scores for students', { studentIds: missing })
log.error('PDF render failed', { error: err.message })
```

Every log line from this child logger automatically carries `service`, `org_id`, `user_id`, and `request_id` without being re-specified.

### Log Levels

| Level | When to Use |
|-------|------------|
| `debug` | Detailed execution flow (SANDBOX only) |
| `info` | Normal operations, business events |
| `warn` | Unexpected but recoverable conditions |
| `error` | Failures that need investigation |

Log level is controlled by `environmentConfig.logging.level`. LIVE defaults to `info`; SANDBOX defaults to `debug`.

### What Not to Log

- Passwords, tokens, or API keys — never in plaintext
- Full request bodies in LIVE (only in SANDBOX, controlled by `includeRequestBodies`)
- PII beyond what's needed to identify the user (use `user_id` instead of email where possible)
- `console.log()` — this bypasses the structured logger and is not allowed in production code

---

## Distributed Tracing (`tracing.ts`)

### Trace ID Propagation

`proxy.ts` generates a `trace_id` UUID for every incoming request and injects it as the `x-trace-id` response header. This ID is:

1. Included in every log line via the logger context.
2. Passed to background jobs when they are spawned from a request.
3. Written to `job_logs` for all job execution steps.
4. Returned to the caller in response headers for support queries.

A complete request trace can be reconstructed from logs by filtering on `trace_id`.

### Spans

The tracing layer provides a lightweight span system for measuring duration within a request:

```typescript
const span = tracer.startSpan('pdf.render', { traceId, parentId })
try {
  const pdf = await renderPDF(sow)
  span.finish({ status: 'ok', outputBytes: pdf.length })
  return pdf
} catch (err) {
  span.finish({ status: 'error', error: err.message })
  throw err
}
```

Spans are emitted as JSON lines — either to stdout (where they are ingested by a log aggregator that understands the span format) or to a dedicated tracing sink.

**Span record:**

```json
{
  "type": "span",
  "trace_id": "550e8400...",
  "span_id": "a1b2c3d4",
  "parent_id": "e5f6a7b8",
  "name": "pdf.render",
  "started_at": "2026-07-02T10:23:45.100Z",
  "finished_at": "2026-07-02T10:23:45.842Z",
  "duration_ms": 742,
  "status": "ok",
  "attributes": { "outputBytes": 184320 }
}
```

---

## Metrics (`metrics.ts`)

### In-Memory Metrics

Metrics are accumulated in-process using a lightweight histogram/counter/gauge implementation:

```typescript
// Counter — monotonically increasing
metrics.increment('ai.requests.total', 1, { provider: 'deepseek', status: 'success' })

// Gauge — current value
metrics.set('jobs.queue.depth', pendingCount, { queue: 'email' })

// Histogram — distribution of values
metrics.observe('request.duration_ms', durationMs, { route: '/api/organizations' })
```

### Metric Flush

The `/api/cron/snapshot-metrics` cron job runs daily at 06:00 and flushes in-memory metrics to the `usage_events` table for persistent storage and reporting:

```sql
INSERT INTO usage_events (org_id, event_type, quantity, recorded_at, metadata)
VALUES (null, 'metrics.snapshot', 1, now(), $metricsJson)
```

Between flushes, metrics are visible via the `/api/health` endpoint, which reads the in-memory state directly.

### Key Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `ai.requests.total` | Counter | provider, status |
| `ai.tokens.used` | Counter | provider, feature |
| `ai.latency_ms` | Histogram | provider |
| `jobs.processed.total` | Counter | queue, status |
| `jobs.queue.depth` | Gauge | queue |
| `events.dispatched.total` | Counter | delivery_method, status |
| `http.requests.total` | Counter | method, route, status |
| `http.request.duration_ms` | Histogram | route |
| `quota.exceeded.total` | Counter | org_id, resource |

---

## Health Endpoint (`/api/health`)

The health endpoint provides a real-time summary of platform status:

```json
{
  "status": "healthy",
  "timestamp": "2026-07-02T10:23:45Z",
  "version": "1.0.0",
  "services": {
    "database": { "status": "healthy", "latencyMs": 8 },
    "ai": {
      "deepseek": { "status": "healthy", "latencyEwmaMs": 1240, "errorRate": 0.001 },
      "gemini": { "status": "healthy", "latencyEwmaMs": 890, "errorRate": 0.0 }
    },
    "jobs": {
      "pending": 12,
      "processing": 3,
      "dead_letter": 0
    },
    "events": {
      "pending_deliveries": 4,
      "failed_deliveries": 0
    }
  },
  "metrics": {
    "requests_last_hour": 1432,
    "ai_tokens_last_hour": 84200,
    "jobs_processed_last_hour": 89
  }
}
```

The database health check issues a lightweight query. AI provider health is read from the in-memory registry. Job and event counts are read from the database.

---

## Correlation IDs

Every observable unit in the system carries a correlation ID:

| Unit | ID Field | Source |
|------|----------|--------|
| HTTP request | `trace_id` | Generated by `proxy.ts` |
| Background job | `job_id` | Generated on enqueue |
| Event delivery | `delivery_id` | Generated on creation |
| Cron run | `run_id` | Generated at cron start |

When a job is enqueued from a request, the `trace_id` from the request is stored in the job's metadata so execution logs can be correlated back to the originating request.

---

## Performance Monitoring

Slow operations are automatically flagged with a warning log:

```typescript
const start = Date.now()
const result = await expensiveOperation()
const duration = Date.now() - start

if (duration > 2000) {
  log.warn('Slow operation detected', { operation: 'pdf.render', duration_ms: duration })
}

metrics.observe('pdf.render.duration_ms', duration)
```

The threshold for "slow" is operation-dependent:
- Database queries: 500ms
- AI calls: 10,000ms (10s)
- PDF rendering: 2,000ms
- HTTP responses: 3,000ms

Observations above these thresholds are candidates for performance investigation.
