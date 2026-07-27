# Security

Security in EduNexus is layered. Each layer independently enforces a boundary, so a failure at one layer is contained by the layers below it.

---

## Security Layers

```
┌───────────────────────────────────────────────────────┐
│               Layer 1: Edge Gateway                   │
│  proxy.ts · JWT validation · Route-level access guards│
├───────────────────────────────────────────────────────┤
│              Layer 2: Authentication                  │
│  supabase.auth.getUser() · Session validation         │
│  API key hashing and scope verification               │
├───────────────────────────────────────────────────────┤
│              Layer 3: Authorization                   │
│  IAM permission matrix · assertPermission()           │
│  Organization membership verification                 │
├───────────────────────────────────────────────────────┤
│           Layer 4: Data Isolation (RLS)               │
│  Row-Level Security on all tables                     │
│  org_id scoping on every resource                     │
├───────────────────────────────────────────────────────┤
│              Layer 5: Audit Trail                     │
│  Immutable audit_logs · Event sourcing                │
│  Structured logging with trace IDs                    │
└───────────────────────────────────────────────────────┘
```

---

## Authentication

### Session-Based (Web App)

The web app uses Supabase Auth with JWT sessions stored in HTTP-only cookies.

1. User authenticates via email/password or OAuth.
2. Supabase issues a JWT with the user's `sub` (user ID) and role claims.
3. The JWT is stored in a secure, HTTP-only cookie by the browser.
4. On each request, `proxy.ts` calls `updateSession()` which validates the JWT and refreshes it if near expiry.
5. Route handlers call `supabase.auth.getUser()` to retrieve the verified user identity.

**The user identity from `auth.getUser()` is the only trusted source of the caller's identity.** A `userId` in the request body is never trusted — it is always verified against the authenticated session.

### API Key-Based (Developer Platform)

External developers authenticate using API keys issued through the organization dashboard.

**Key lifecycle:**

1. An organization member with `developer` role (or higher) issues a key via `POST /api/organizations/{orgId}/api-keys`.
2. The system generates a random key: `ek_live_{random}` or `ek_sandbox_{random}`.
3. The key is hashed with SHA-256 before storage. The plaintext key is shown once and never stored.
4. On each API request, the caller provides `Authorization: Bearer ek_live_{random}`.
5. The server hashes the incoming key and looks it up in the `api_keys` table.

**API key record:**

```sql
api_keys (
  id           uuid PRIMARY KEY,
  org_id       uuid NOT NULL,
  name         text NOT NULL,
  key_prefix   text NOT NULL,          -- first 8 chars, for identification
  key_hash     text NOT NULL UNIQUE,   -- SHA-256 of the full key
  scopes       text[] NOT NULL,        -- e.g. ['sow:read', 'assessments:create']
  environment  text NOT NULL,          -- 'live' | 'sandbox'
  rate_limit   int DEFAULT 60,         -- requests per minute
  expires_at   timestamptz,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_by   uuid REFERENCES auth.users(id)
)
```

**Key rotation:** Keys can be revoked at any time. Revoked keys are rejected immediately; no grace period.

### Cron Authentication

Cron job endpoints verify the `Authorization: Bearer {CRON_SECRET}` header. The `CRON_SECRET` is a long random string stored as a Vercel environment variable. It is never committed to source control.

### Webhook Authentication

Incoming webhook handlers (e.g., Paystack payment webhooks) verify a provider-specific signature before processing any payload. Webhooks without a valid signature return `400` immediately and log the rejection.

---

## Authorization

### IAM Model

Authorization uses a Role-Based Access Control (RBAC) model with two tiers:

**System roles** — Defined in code in `SYSTEM_ROLE_PERMISSIONS`. Cannot be modified by organizations.

**Custom roles** — Defined per organization in the `organization_roles` table. Store a `permissions[]` array.

**Permission format:** `resource:action`

Examples: `sow:create`, `assessments:view`, `members:remove`, `api_keys:issue`, `billing:manage`

### `assertPermission`

Every operation that modifies data or accesses sensitive information calls `assertPermission` from `lib/iam/`:

```typescript
await assertPermission(userId, orgId, 'assessments:create')
```

This function:
1. Loads the user's `organization_members` record. If not found or status ≠ `active`, throws `PermissionDeniedError`.
2. Resolves the role's permissions (from `SYSTEM_ROLE_PERMISSIONS` for system roles, from DB for custom roles).
3. Checks that the required permission is in the set.
4. If denied, throws `PermissionDeniedError` — the route handler catches this and returns `403`.

### Owner Protection

The `owner` role cannot be removed from an organization, and there must always be at least one owner. Attempts to remove the last owner return `400`.

---

## Organization Isolation

Every resource in the system is scoped to an `organization_id`. Cross-organization access is structurally impossible:

- All queries include `WHERE org_id = $orgId` where `orgId` comes from the verified session or API key, never from the request body.
- Row-Level Security (RLS) enforces this at the database level, independent of application code.
- The service role client (used for cron jobs) bypasses RLS — it is only used for operations that legitimately need cross-organization access (billing renewals, system-wide aggregations).

---

## Row-Level Security (RLS)

All tables have RLS enabled. Policies define which rows a user's session can access.

**Standard pattern for org-scoped tables:**

```sql
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Users can only see assessments in their organizations
CREATE POLICY "org members can view assessments"
  ON assessments
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );
```

RLS is the last line of defence. Even if application code has a bug that omits an `org_id` filter, RLS ensures the database returns only the rows the authenticated user is allowed to see.

**Service role bypass:** The `createServiceClient()` factory uses the service role key, which bypasses RLS. It is used only for:
- Cron jobs (system operations without a user session)
- Webhook handlers (verifying incoming events from providers)
- Background jobs (operating on behalf of the system)

It is never used in route handlers that handle user-initiated requests.

**Core school RLS regression audit (2026-07-26/27):** the Core school-membership table (`school_users`, distinct from the `organization_members` table shown above) had two real defects found and fixed via real-session testing — an infinite-recursion bug in its own policy, and a privilege-escalation gap where any authenticated user could self-insert an admin row for an arbitrary school (`docs/architecture/school-users-rls-regression-audit.md`). The same defect shape (a `FOR ALL` policy with no explicit `WITH CHECK`) was then found and fixed across 12 further Core/Learner-Intelligence tables, plus one unrelated, previously-non-functional read policy on `learner_projections` (`docs/architecture/core-academic-rls-write-hardening-phase1.6.md`). Every real-session RLS check in this codebase now passes.

---

## API Key Scopes

API keys are issued with explicit scopes. A key can only perform operations that its scopes permit.

**Scope format:** `resource:action`

**Scope checking in route handlers:**

```typescript
if (!ctx.scopes.includes('assessments:create')) {
  return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
}
```

The scope check happens after API key validation and before the service function is called.

---

## Secret Management

| Secret | Storage | Access |
|--------|---------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel environment variable | Server only — never exposed to clients |
| `DEEPSEEK_AI_API_KEY` | Vercel environment variable | Server only |
| `GOOGLE_GEMINI_API_KEY` | Vercel environment variable | Server only |
| `PAYSTACK_SECRET_KEY` | Vercel environment variable | Server only |
| `CRON_SECRET` | Vercel environment variable | Server only |
| `RESEND_API_KEY` | Vercel environment variable | Server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel environment variable | Public — safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel environment variable | Public — safe to expose (RLS protects data) |

**Rules:**
- Secrets prefixed `NEXT_PUBLIC_` are safe to expose to the browser.
- All other secrets are server-only and must never be read in client components.
- Secrets are validated at startup via Zod (`lib/config/env.ts`) — the application will not start if required secrets are missing.

---

## Security Headers

HTTP security headers are set in `next.config.ts` for all responses:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [strict policy]
```

For API routes, CORS is configured to allow only the EduNexus web origin and registered developer origins.

---

## Input Validation

All API route inputs are validated with Zod before any business logic runs:

```typescript
const InputSchema = z.object({
  subjectId: z.string().uuid(),
  gradeLevel: z.number().int().min(7).max(12),
  termNumber: z.enum(['1', '2', '3']),
})

const parsed = InputSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
}
```

This prevents malformed data from reaching the service layer. SQL injection is structurally prevented by Supabase's parameterised query client — raw SQL is not used in application code.

---

## Audit Logs

All sensitive operations write to the `audit_logs` table:

- Member invitation, acceptance, and removal
- Role assignment changes
- API key issuance and revocation
- Organization settings changes
- Billing and subscription changes

Audit logs include:
- `user_id` — who performed the action
- `action` — what was done
- `old_values` / `new_values` — what changed (as JSONB)
- `ip_address` — where the request originated
- `created_at` — when it happened

Audit logs are immutable. There is no API to update or delete them.

---

## Rate Limiting

Rate limits are enforced per API key at the quota guard layer:

- Default limit: 60 requests per minute for LIVE keys
- Limits are configurable per key in the `api_keys` table (`rate_limit` column)
- Quota checks read current usage from `usage_events` for the last 60 seconds
- Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header

Web app sessions are not individually rate-limited but are protected by Supabase's built-in auth rate limiting.

---

## Environment Isolation

LIVE and SANDBOX environments are isolated by API key prefix:

- `ek_live_*` keys can only access `live` environment data
- `ek_sandbox_*` keys can only access `sandbox` environment data
- It is impossible for a sandbox API key to affect live data

This isolation is enforced in the key validation step before any application logic runs.
