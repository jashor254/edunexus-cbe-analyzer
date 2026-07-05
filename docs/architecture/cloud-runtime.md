# EduNexus Cloud Runtime — Architecture Overview

## What Is the Cloud Runtime?

The EduNexus Cloud Runtime is the complete platform infrastructure that runs every workload — teacher tools, student AI, developer APIs, background jobs, events, billing, and observability — as a single coherent system.

Version 1.0 of the Cloud Runtime defines the permanent architectural boundaries of the platform. All future features are built _inside_ these boundaries, not around them.

---

## Major Platform Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│   Next.js App Router · React Components · Server Components      │
│   /app/(marketing) · /app/(teacher) · /app/(student) · /app/    │
├─────────────────────────────────────────────────────────────────┤
│                          API GATEWAY                             │
│   proxy.ts (middleware) · Auth · Locale · Trace ID Injection     │
│   /app/api/ · Route Handlers · Zod Validation · Error Shaping   │
├─────────────────────────────────────────────────────────────────┤
│                       ENVIRONMENT RUNTIME                        │
│   EnvironmentConfig · LIVE vs SANDBOX · Quota · Feature Flags   │
│   RequestContext · Policy Enforcement · Billing Guards           │
├───────────────────┬─────────────────────────────────────────────┤
│   SHARED SERVICE  │              PLATFORM SERVICES               │
│       LAYER       │                                              │
│  Organizations    │   AI Orchestration · Job Queue · Event Bus  │
│  IAM / Roles      │   Observability · Billing · Quota           │
│  Teacher Academy  │   Infrastructure Guards                      │
│  Career Intel     │                                              │
│  Curriculum       │                                              │
│  Assessments      │                                              │
│  Learner Model    │                                              │
├───────────────────┴─────────────────────────────────────────────┤
│                         DATA LAYER                               │
│         Supabase (PostgreSQL + Auth + RLS + Realtime)            │
│         Row-Level Security · Service Role · Audit Trail          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Runtime Philosophy

**Configuration, not conditionals.** The runtime reads from `EnvironmentConfig` to make decisions. There are no `if (process.env.NODE_ENV === 'production')` guards scattered through business logic. The environment config object is the single policy authority.

**Business logic lives once.** Every feature is implemented as a shared service in `lib/`. It is consumed identically by the web app, developer APIs, cron jobs, and future SDKs. There is no divergence between what the web app does and what the API does — they call the same functions.

**Infrastructure is transparent.** Quota enforcement, billing deduction, analytics recording, and audit logging happen in infrastructure guards that wrap business logic. A service function does not know it is being metered; the caller injects context and infrastructure layers apply policy.

**Cron-driven background processing.** There is no persistent background worker. Vercel Cron triggers job processing and event dispatch on a schedule. This eliminates infrastructure complexity while providing reliable background execution within the platform's serverless model.

---

## Design Goals

| Goal | How It Is Achieved |
|------|--------------------|
| Multi-tenancy | Every resource is scoped to an `organization_id` |
| Environment isolation | `LIVE` and `SANDBOX` environments with independent quotas and billing |
| Auditability | All sensitive actions emit structured audit log entries |
| AI cost control | Providers routed through an orchestration layer with per-request cost estimation |
| Developer extensibility | Webhook delivery, event subscriptions, and API keys enable third-party integration |
| Operational visibility | Structured logging, distributed tracing, and in-memory metrics flush to persistent storage |
| Reliable background work | Idempotency keys and exponential backoff prevent duplication and manage transient failures |

---

## Core Principles

1. **One implementation per domain.** A single `lib/` module owns all logic for its domain.
2. **Context carries policy.** The `RequestContext` object passes environment configuration through the call stack so policy is never re-derived inline.
3. **APIs are contracts.** Route handlers are thin. They validate input, call a lib function, and shape a response. No business logic lives in routes.
4. **Fail fast on auth.** Every route handler calls `auth.getUser()` first. Missing identity returns `401` before any other work begins.
5. **Idempotency is mandatory.** Jobs and events carry idempotency keys. Duplicate submissions are safe.
6. **Dead letters, not silent drops.** Failed jobs escalate to a dead-letter queue for manual recovery instead of being discarded.

---

## Why This Architecture Was Chosen

EduNexus runs on Vercel with Supabase as the data plane. This combination provides managed infrastructure with zero operational overhead — critical for a small team serving 50 pioneer teachers scaling toward thousands of schools.

The tradeoffs made:

- **Serverless functions over persistent servers.** Cold starts are acceptable because the platform is primarily request-driven. The cron-driven job queue compensates for the absence of a persistent worker.
- **Supabase over a custom auth stack.** Supabase Auth provides JWT issuance, session management, and Row-Level Security without custom infrastructure.
- **In-memory circuit breakers over a distributed state store.** Vercel's immutable deployments mean in-memory state resets on each cold start. For AI provider health tracking, this is acceptable — the breaker rebuilds state quickly from live traffic.
- **Two environments (LIVE/SANDBOX) over per-commit staging.** The sandbox environment gives developers and API consumers a safe execution context without requiring a separate Supabase project.
- **PostgreSQL event sourcing over a message broker.** All events are written to the `platform_events` table. Delivery is handled by cron-triggered dispatch. This avoids operational complexity of Redis Streams or SQS while retaining durability, ordering, and queryability.

---

## Related Documents

- [Request Lifecycle](request-lifecycle.md) — End-to-end request flow with diagrams
- [Environment Runtime](environment-runtime.md) — LIVE vs SANDBOX and environment-aware configuration
- [Service Layer](service-layer.md) — Shared business logic and domain services
- [Event-Driven Architecture](event-driven-architecture.md) — Event bus, jobs, and webhooks
- [AI Orchestration](ai-orchestration.md) — Provider routing, circuit breakers, and cost tracking
- [Observability](observability.md) — Logging, tracing, and metrics
- [Security](security.md) — Auth, authorization, and isolation
- [Runtime Config](runtime-config.md) — All configurable runtime components
- [Architectural Principles](architectural-principles.md) — Permanent engineering principles
