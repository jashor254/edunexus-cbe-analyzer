# Environment Runtime

The Environment Runtime is the layer that makes EduNexus behave differently depending on _where_ code is running — production traffic versus a developer sandbox — without scattering conditionals through business logic.

---

## The Environment Abstraction

An **environment** is a named execution context with its own policy matrix. The policy matrix defines:

- How much quota each organization gets
- Whether billing is enabled
- How verbose logging should be
- Whether analytics are recorded
- Which AI provider to use
- Which feature flags are active

All of this lives in `lib/environment/config.ts` as a typed registry:

```typescript
type EnvironmentConfig = {
  name: 'live' | 'sandbox'
  billing: {
    enabled: boolean
    deductTokens: boolean
  }
  quotas: {
    requestsPerMinute: number
    tokensPerMonth: number
    apiKeysPerOrg: number
    membersPerOrg: number
    storageGb: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    includeRequestBodies: boolean
  }
  analytics: {
    enabled: boolean
    sampleRate: number
  }
  ai: {
    primaryProvider: 'deepseek' | 'gemini'
    enableFallback: boolean
    maxTokensPerRequest: number
  }
  features: {
    webhooks: boolean
    developerApi: boolean
    advancedAnalytics: boolean
    multiTenantOrgs: boolean
  }
}
```

The two active environments:

```typescript
const ENVIRONMENT_CONFIGS: Record<'live' | 'sandbox', EnvironmentConfig> = {
  live: {
    name: 'live',
    billing: { enabled: true, deductTokens: true },
    quotas: { requestsPerMinute: 60, tokensPerMonth: 500_000, ... },
    logging: { level: 'info', includeRequestBodies: false },
    analytics: { enabled: true, sampleRate: 1.0 },
    ai: { primaryProvider: 'deepseek', enableFallback: true, maxTokensPerRequest: 4096 },
    features: { webhooks: true, developerApi: true, ... },
  },
  sandbox: {
    name: 'sandbox',
    billing: { enabled: false, deductTokens: false },
    quotas: { requestsPerMinute: 600, tokensPerMonth: 10_000_000, ... },
    logging: { level: 'debug', includeRequestBodies: true },
    analytics: { enabled: false, sampleRate: 0 },
    ai: { primaryProvider: 'deepseek', enableFallback: true, maxTokensPerRequest: 4096 },
    features: { webhooks: true, developerApi: true, ... },
  },
}
```

---

## LIVE Environment

LIVE is the production environment. It is where real teachers, students, and parents interact with the platform.

**Characteristics:**

| Property | Value |
|----------|-------|
| Billing | Enabled — tokens are deducted after successful AI responses |
| Quotas | Enforced at organization level |
| Logging | `info` level — no request bodies in logs |
| Analytics | Fully recorded at 100% sample rate |
| AI provider | DeepSeek primary, Gemini fallback |
| Feature flags | All stable features enabled |

**API Keys in LIVE:** Prefixed `ek_live_`. These keys interact with real data and incur real billing.

---

## SANDBOX Environment

SANDBOX is a developer-friendly execution context. Organizations use sandbox environments to test integrations, explore APIs, and build against the platform without consuming real quota or incurring billing.

**Characteristics:**

| Property | Value |
|----------|-------|
| Billing | Disabled — no token deduction |
| Quotas | Generous (10× LIVE) to enable exploration |
| Logging | `debug` level — request bodies included in logs |
| Analytics | Disabled — sandbox traffic is not counted in production metrics |
| AI provider | Same providers, but responses may be mocked in future |
| Feature flags | Experimental features can be enabled for sandbox only |

**API Keys in SANDBOX:** Prefixed `ek_sandbox_`. These keys are safe to share with developers during testing.

**Sandbox reset:** The `/api/cron/sandbox-reset` cron job periodically clears sandbox usage data, returning organizations to a clean state.

---

## How Environments Affect Request Processing

When an API key authenticates a request, the environment is resolved from the key record:

```typescript
// In the API key validation layer
const { environment } = await validateApiKey(keyValue)
const environmentConfig = ENVIRONMENT_CONFIGS[environment]

const ctx: RequestContext = {
  requestId: crypto.randomUUID(),
  environment,
  environmentConfig,
  orgId: key.org_id,
  apiKeyId: key.id,
  scopes: key.scopes,
}
```

This `ctx` is passed through the entire call stack. Infrastructure layers read from it:

**Quota Guard (`lib/infrastructure/quota.ts`):**
```typescript
const limit = ctx.environmentConfig.quotas.requestsPerMinute
const current = await getCurrentUsage(ctx.orgId, 'requests', 'minute')
if (current >= limit) throw new QuotaExceededError()
```

**Billing Guard (`lib/infrastructure/billing.ts`):**
```typescript
if (ctx.environmentConfig.billing.deductTokens) {
  await deductTokens(ctx.orgId, tokensUsed)
}
```

**Analytics Guard (`lib/infrastructure/analytics.ts`):**
```typescript
if (ctx.environmentConfig.analytics.enabled) {
  await recordUsageEvent(ctx.orgId, eventType, quantity)
}
```

**Logger (`lib/observability/logger.ts`):**
```typescript
const level = ctx.environmentConfig.logging.level
```

Business service functions receive `ctx` but do not inspect `ctx.environment` directly. They pass `ctx` to infrastructure helpers which apply the appropriate policy. This keeps environment awareness entirely in the infrastructure layer.

---

## Business Services Are Environment-Agnostic

A critical design invariant: **business logic in `lib/` never branches on environment**.

Correct:
```typescript
// lib/sow/generator.ts
export async function generateSchemeOfWork(ctx: RequestContext, input: SOWInput) {
  const sow = await buildSOW(input)
  await saveSOW(sow)
  // ctx is passed to infrastructure helpers, not inspected here
  await recordUsage(ctx, 'sow.generated', 1)
  return sow
}
```

Incorrect (violates the pattern):
```typescript
// NEVER DO THIS
if (ctx.environment === 'sandbox') {
  return mockSOW() // bypasses real logic
}
```

The environment is an infrastructure concern. The service does the same work in both environments; the infrastructure layer decides whether to bill, log, or record analytics.

---

## Future Environments

The runtime is designed to add environments without changing business logic.

**STAGING (planned):** An environment that mirrors LIVE configuration but uses a separate Supabase branch. Used for pre-release integration testing.

**LOCAL (planned):** An environment for local development that routes AI calls to mocked providers and disables all external integrations.

**ENTERPRISE (planned):** A dedicated environment for enterprise customers who need data residency guarantees, custom quotas, and isolated execution.

Adding a new environment requires only:
1. Adding a new entry to `ENVIRONMENT_CONFIGS` in `lib/environment/config.ts`.
2. Adding the new environment name to the `environment` union type.
3. Handling the new prefix in API key generation.

No business logic changes are needed.

---

## Environment vs. Next.js Deployment Environment

The EduNexus environment runtime is distinct from the Next.js deployment environment (`NODE_ENV`).

| Concept | Values | Purpose |
|---------|--------|---------|
| Next.js NODE_ENV | `development`, `production` | Controls framework behavior (hot reload, minification) |
| EduNexus environment | `live`, `sandbox` | Controls platform policy for organizations and API keys |

A production Next.js deployment serves both `live` and `sandbox` environment requests simultaneously. The environment is determined by the API key used in the request, not by where the server is deployed.
