# Request Lifecycle

This document traces the complete path of a request through the EduNexus Cloud Runtime, from the moment a client sends a packet to the moment a response arrives.

---

## Overview

```
Client
  │
  ▼
proxy.ts (Next.js Middleware)
  │  • JWT validation via updateSession()
  │  • x-trace-id injection
  │  • x-locale injection
  │  • Route-level access guards (admin, teacher, dashboard)
  │
  ▼
Route Handler (/app/api/...)
  │  • Parse & validate body with Zod
  │  • Call createClient() / createServiceClient()
  │
  ▼
Authentication
  │  • supabase.auth.getUser()
  │  • Return 401 if no user
  │
  ▼
Authorization
  │  • assertPermission(userId, orgId, 'scope:action')
  │  • Return 403 if denied
  │  • Writes audit log for sensitive operations
  │
  ▼
Environment Runtime
  │  • Resolve RequestContext (orgId, env, environmentConfig)
  │  • Quota guard — check current usage vs limit
  │  • Return 429 if quota exceeded
  │
  ▼
Shared Service (lib/)
  │  • Business logic executes
  │  • Calls data layer (Supabase)
  │  • Publishes platform event (if applicable)
  │  • Enqueues background job (if applicable)
  │
  ▼
Usage Logging
  │  • Record usage_event for metering
  │  • Update token balance (if AI call)
  │
  ▼
Billing
  │  • Deduct tokens after successful response
  │  • Emit billing event for webhooks (if applicable)
  │
  ▼
Analytics
  │  • Write analytics record to usage_events
  │
  ▼
Response
     • JSON payload with correct HTTP status
     • Headers: x-trace-id, x-locale set by middleware
```

---

## Stage 1 — Middleware (`proxy.ts`)

Every HTTP request first hits `proxy.ts`, which runs as a Next.js Edge Middleware function before any route handler executes.

**What it does:**

1. Calls `updateSession()` from `utils/supabase/middleware.ts` to validate the user's JWT and refresh the session cookie if needed.
2. Injects `x-trace-id` (a UUID) into the response headers for distributed tracing correlation.
3. Injects `x-locale` (derived from `accept-language` header or user preference) for internationalisation.
4. Applies route-level access guards:
   - `/admin/*` — verifies the authenticated user's email matches the hardcoded admin address
   - `/teacher/*` — verifies the user has the `teacher` role and has completed onboarding setup
   - `/dashboard/*` — verifies role-based access
5. Redirects or returns `403` for any access violation before the route handler runs.

**What it does not do:**

- It does not check organization membership (that happens inside route handlers).
- It does not apply business logic.
- It does not read request bodies (middleware runs on the edge and must remain fast).

---

## Stage 2 — Route Handler (`/app/api/`)

Route handlers are thin controllers. Their sole responsibility is to coordinate the request.

**Standard pattern:**

```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  const body = await req.json()

  // 2. Validate with Zod
  const parsed = InputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // 3. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 4. Call lib function
  const result = await someFeatureFunction(parsed.data, user.id)

  // 5. Return response
  return NextResponse.json({ data: result }, { status: 201 })
}
```

No business logic lives in the route handler. If a route handler grows beyond ~50 lines, the logic belongs in `lib/`.

---

## Stage 3 — Authentication

Every protected route handler calls `supabase.auth.getUser()` as its first operation after parsing input.

- Uses `createClient()` (SSR client with cookie store) for user-facing routes.
- Uses `createServiceClient()` (service role key) for cron jobs, webhooks, and internal operations.
- Returns `401 Unauthorized` immediately if no authenticated user exists.
- **Never** trusts a `userId` passed in the request body — always reads identity from the verified session.

---

## Stage 4 — Authorization

For organization-scoped operations, the route handler (or the `lib/` function it calls) calls `assertPermission`:

```typescript
await assertPermission(user.id, orgId, 'assessments:create')
```

`assertPermission` in `lib/iam/`:
1. Loads the user's membership record for the organization.
2. Looks up the role's permission set (system roles from `SYSTEM_ROLE_PERMISSIONS`, custom roles from the DB).
3. Throws a `PermissionDeniedError` if the permission is not granted.
4. The route handler catches this and returns `403 Forbidden`.

For sensitive operations (role changes, member removal, key revocation), `assertPermission` also writes an entry to `audit_logs`.

---

## Stage 5 — Environment Runtime

Platform API routes that are environment-aware (developer API routes, AI routes) resolve a `RequestContext`:

```typescript
type RequestContext = {
  requestId: string
  environment: 'live' | 'sandbox'
  environmentConfig: EnvironmentConfig
  orgId: string
  userId?: string
  apiKeyId: string
  scopes: string[]
}
```

The `environmentConfig` contains all policy decisions for the current environment — quota limits, billing enabled/disabled, logging verbosity, analytics enabled, AI provider, feature flags.

After context is resolved, the **quota guard** in `lib/infrastructure/quota.ts` checks whether the organization has remaining quota for the requested operation. If quota is exhausted, it returns `429 Too Many Requests` before the service layer runs.

---

## Stage 6 — Shared Service (`lib/`)

The service function in `lib/` executes the actual business logic:

1. Reads from Supabase using named column selects (never `select('*')`).
2. Applies domain validation rules.
3. Writes results to the database.
4. Publishes a `platform_event` if the operation has downstream subscribers.
5. Enqueues a background job if async processing is needed.

The service function is completely unaware of HTTP — it receives typed inputs, returns typed outputs, and throws descriptive errors. This is what enables the same function to be called from a route handler, a cron job, an SDK, or a CLI.

---

## Stage 7 — Usage Logging, Billing, and Analytics

After a successful service call:

1. **Usage logging** — A record is written to `usage_events` with the operation type, quantity, and organization ID.
2. **Token deduction** — For AI operations, tokens are deducted from `token_balances` _after_ the AI response is received and verified. Tokens are never pre-deducted.
3. **Billing events** — If the environment has billing enabled (`environmentConfig.billing.enabled === true`), a billing event is emitted for downstream billing webhooks.
4. **Analytics** — If analytics are enabled (`environmentConfig.analytics.enabled === true`), an analytics record is written.

These operations are infrastructure concerns, not business logic. They do not affect the response the caller receives.

---

## Stage 8 — Response

The route handler returns a `NextResponse` with:
- A JSON payload with the result or error.
- The correct HTTP status code.
- Headers injected by middleware (`x-trace-id`, `x-locale`).

**HTTP status conventions:**

| Code | Meaning |
|------|---------|
| `200` | Success (GET, query) |
| `201` | Created (POST, mutation) |
| `400` | Validation failure |
| `401` | Authentication required |
| `403` | Permission denied |
| `404` | Resource not found |
| `409` | Conflict (e.g., slug already taken) |
| `429` | Quota exceeded |
| `500` | Unexpected server error |

---

## Developer API Request Lifecycle

Developer API requests (from external consumers using API keys) follow a slightly different path:

```
External Client (SDK / curl / third-party app)
  │
  ▼
/api/platform/* or /api/organizations/*/...
  │
  ▼
API Key Extraction (Authorization: Bearer ek_live_...)
  │
  ▼
Key Validation (hash lookup in api_keys table)
  │  • Verify key exists, not expired, not revoked
  │  • Resolve organization + environment from key
  │  • Check rate limits (per-key limits)
  │
  ▼
Scope Validation
  │  • Verify the key's scopes include the required scope
  │  • Return 403 if scope missing
  │
  ▼
RequestContext Construction
  │  • environment from key (live/sandbox)
  │  • environmentConfig from ENVIRONMENT_CONFIGS registry
  │  • orgId, apiKeyId, scopes
  │
  ▼
[continues as above: quota → service → billing → analytics → response]
```

---

## Cron Job Request Lifecycle

Cron jobs are triggered by Vercel Cron via HTTP GET to `/api/cron/*` endpoints.

```
Vercel Cron Scheduler
  │
  ▼
GET /api/cron/[job-name]
  │
  ▼
Authorization Check
  │  • Verify Authorization: Bearer ${CRON_SECRET}
  │  • Return 401 if missing or wrong
  │
  ▼
Job Processor / Event Dispatcher
  │  • Uses createServiceClient() (bypasses RLS)
  │  • Processes up to N items in parallel
  │  • Logs start, end, duration, item count
  │
  ▼
Response
     • JSON summary: { processed, failed, duration_ms }
```

Cron routes use the service role client because they operate outside of user sessions. They must never be triggered by external callers — the `CRON_SECRET` header is mandatory.

---

## Correlation and Tracing

Every request receives a `x-trace-id` UUID from `proxy.ts`. This ID propagates:

- Into response headers (visible to API consumers for support).
- Into the structured logger context (every log line for this request carries the trace ID).
- Into span records written by `lib/observability/tracing.ts`.
- Into `job_logs` for any background work spawned from this request.

This allows a complete request trace to be reconstructed from logs by filtering on `trace_id`.
