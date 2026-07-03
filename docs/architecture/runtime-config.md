# Runtime Configuration

EduNexus uses configuration to drive behaviour instead of hardcoded logic. Every configurable component of the runtime is documented here.

---

## Configuration Hierarchy

```
Environment Variables (Vercel / .env.local)
        │
        ▼
lib/config/env.ts         ← validates variables at startup
        │
        ├── lib/config/api.ts     ← provider configurations
        │
        └── lib/environment/config.ts  ← per-environment policy matrix
                │
                └── RequestContext.environmentConfig  ← runtime policy object
```

---

## Environment Variables

### Required — Application Fails to Start Without These

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key for client-side queries (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for cron/webhooks (server-only) |
| `DEEPSEEK_AI_API_KEY` | Primary AI provider key (server-only) |

### Optional — Graceful Degradation if Missing

| Variable | Purpose | Degraded Behaviour |
|----------|---------|-------------------|
| `GOOGLE_GEMINI_API_KEY` | AI fallback provider | No fallback if DeepSeek fails |
| `PAYSTACK_PUBLIC_KEY` | Paystack payment initiation | Payments disabled |
| `PAYSTACK_SECRET_KEY` | Paystack webhook verification | Webhooks rejected |
| `RESEND_API_KEY` | Email delivery | Emails not sent |
| `RESEND_FROM_EMAIL` | Sender address for emails | Defaults to `noreply@edunexus.co.ke` |
| `CRON_SECRET` | Vercel Cron authentication | Cron endpoints refuse all requests |
| `ADMIN_SECRET` | Admin panel access | Admin endpoints disabled |

### Validation

`lib/config/env.ts` validates all environment variables at startup using Zod:

```typescript
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEEPSEEK_AI_API_KEY: z.string().min(1),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)
```

If required variables fail validation, the application throws at startup rather than failing silently at runtime.

---

## Provider Configuration (`lib/config/api.ts`)

Centralises all external provider configurations. Nothing else should hardcode provider-specific values.

```typescript
export const AI_CONFIG = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    inputCostPerToken: 0.00000027,   // USD per input token
    outputCostPerToken: 0.00000110,  // USD per output token
    timeoutMs: 30_000,
    maxRetries: 1,
  },
  gemini: {
    model: 'gemini-pro',
    inputCostPerToken: 0.000000125,
    outputCostPerToken: 0.000000375,
    timeoutMs: 30_000,
    maxRetries: 1,
  },
}

export const SUPABASE_CONFIG = {
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
}

export const PAYSTACK_CONFIG = {
  publicKey: env.PAYSTACK_PUBLIC_KEY,
  secretKey: env.PAYSTACK_SECRET_KEY,
  baseUrl: 'https://api.paystack.co',
  webhookSecret: env.PAYSTACK_WEBHOOK_SECRET,
}

export const EMAIL_CONFIG = {
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_FROM_EMAIL ?? 'noreply@edunexus.co.ke',
}
```

---

## Token Costs (`lib/payments/config.ts`)

All AI feature token costs are defined in one place. No other file may define token prices.

```typescript
export const TOKEN_COSTS = {
  sow_generation: 50,
  lesson_plan_generation: 20,
  record_of_work_generation: 10,
  assessment_feedback: 15,
  career_analysis: 30,
  monday_panel: 25,
  parent_pulse: 20,
  learner_model_update: 5,
  slide_generation: 40,
} as const

export type TokenCostKey = keyof typeof TOKEN_COSTS
```

When a new AI feature is added, its cost is added here. The feature reads its cost from this map — it does not hardcode a value.

---

## Environment Policy Matrix (`lib/environment/config.ts`)

The environment config drives all runtime policy decisions. See [Environment Runtime](environment-runtime.md) for full documentation.

**Configurable properties per environment:**

| Property | Type | Effect |
|----------|------|--------|
| `billing.enabled` | boolean | Whether billing checks run |
| `billing.deductTokens` | boolean | Whether tokens are deducted after AI calls |
| `quotas.requestsPerMinute` | number | Org-level request rate limit |
| `quotas.tokensPerMonth` | number | Monthly AI token budget per org |
| `quotas.apiKeysPerOrg` | number | Maximum API keys an org can issue |
| `quotas.membersPerOrg` | number | Maximum members per org |
| `quotas.storageGb` | number | Storage allocation per org |
| `logging.level` | enum | Minimum log level to emit |
| `logging.includeRequestBodies` | boolean | Whether to log request bodies |
| `analytics.enabled` | boolean | Whether usage events are recorded |
| `analytics.sampleRate` | number | Fraction of requests to record (0–1) |
| `ai.primaryProvider` | enum | Which provider to use first |
| `ai.enableFallback` | boolean | Whether to fall back on provider failure |
| `ai.maxTokensPerRequest` | number | Hard cap on tokens per AI call |
| `features.*` | boolean | Feature flag per capability |

---

## Cron Schedule (`vercel.json`)

All cron jobs are declared in `vercel.json`. The schedule is configuration, not code.

```json
{
  "crons": [
    { "path": "/api/cron/jobs/process",           "schedule": "* * * * *"    },
    { "path": "/api/cron/events/dispatch",         "schedule": "* * * * *"    },
    { "path": "/api/cron/billing-renewals",        "schedule": "0 1 * * *"    },
    { "path": "/api/cron/quota-alerts",            "schedule": "0 * * * *"    },
    { "path": "/api/cron/dlq-requeue",             "schedule": "30 3 * * *"   },
    { "path": "/api/cron/snapshot-metrics",        "schedule": "0 6 * * *"    },
    { "path": "/api/cron/academy-nudge",           "schedule": "0 5 * * *"    },
    { "path": "/api/cron/parent-pulse",            "schedule": "0 6 * * 0"    },
    { "path": "/api/cron/term-readiness",          "schedule": "0 4 * * 1"    },
    { "path": "/api/cron/friday-generation",       "schedule": "0 15 * * 5"   },
    { "path": "/api/cron/study-group-challenges",  "schedule": "0 2 * * *"    },
    { "path": "/api/cron/generate-record-of-work", "schedule": "0 3 * * 1"    },
    { "path": "/api/cron/cleanup-users",           "schedule": "0 0 * * *"    },
    { "path": "/api/cron/sandbox-reset",           "schedule": "0 0 * * 0"    }
  ]
}
```

To adjust a cron schedule, edit `vercel.json` only — no code changes are needed.

---

## Job Queue Configuration

Job queue behaviour is configured per-queue in the cron handler:

| Queue | Concurrency (jobs per tick) | Timeout (ms) |
|-------|-----------------------------|--------------|
| `email` | 10 | 25,000 |
| `whatsapp` | 10 | 25,000 |
| `webhook` | 10 | 25,000 |
| `report` | 5 | 25,000 |
| `ai.generation` | 3 | 25,000 |
| `analytics` | 20 | 25,000 |
| `data.import` | 3 | 25,000 |
| `data.export` | 3 | 25,000 |

Default job `max_attempts` is 3. This is configurable per job on enqueue.

---

## Supabase Client Factories

Four client factories, each with a specific purpose and access level:

| Factory | File | Key Used | RLS | Use Case |
|---------|------|----------|-----|----------|
| `createClient()` | `utils/supabase/client.ts` | Anon key | Enforced | Client components (browser) |
| `createClient()` (SSR) | `utils/supabase/server.ts` | Anon key | Enforced | Server components, route handlers |
| `updateSession()` | `utils/supabase/middleware.ts` | Anon key | Enforced | JWT refresh in middleware |
| `createServiceClient()` | `utils/supabase/service.ts` | Service role | Bypassed | Cron jobs, webhooks, internal ops |

The correct factory must be used for each context. Importing `createClient` from `@supabase/supabase-js` directly in application code is forbidden.

---

## Feature Flags

Feature flags are controlled per environment in `EnvironmentConfig.features`. They are read at runtime from the request context — not at build time.

To add a new feature flag:
1. Add the flag to the `EnvironmentConfig` type in `lib/environment/config.ts`.
2. Set its value in both `live` and `sandbox` configurations.
3. Read it in the application code via `ctx.environmentConfig.features.myFeature`.

Feature flags are binary (`boolean`). Percentage-based rollouts are not currently supported — add a `rolloutPercentage` field to the feature entry if needed.

---

## Configuration Over Conditionals

A principle of the runtime: **behaviour is determined by configuration, not by `if/else` chains scattered through code**.

Incorrect pattern:
```typescript
if (process.env.NODE_ENV === 'production') {
  deductTokens()
}
```

Correct pattern:
```typescript
if (ctx.environmentConfig.billing.deductTokens) {
  await deductTokens(ctx.orgId, tokensUsed)
}
```

The first pattern breaks the moment you need a "production-like" sandbox or a staging environment. The second pattern works for any environment because the configuration object expresses the intent, not the environment name.
