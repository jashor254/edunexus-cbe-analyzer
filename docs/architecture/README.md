# EduNexus Architecture — v1.0

This directory is the official architectural reference for EduNexus Cloud Runtime v1.0. All future development follows the principles and patterns documented here.

## Documents

| Document | What It Covers |
|----------|---------------|
| [cloud-runtime.md](cloud-runtime.md) | Overall architecture, platform layers, design goals, runtime philosophy |
| [request-lifecycle.md](request-lifecycle.md) | End-to-end request flow from client to response |
| [environment-runtime.md](environment-runtime.md) | LIVE vs SANDBOX environments, environment-aware configuration |
| [service-layer.md](service-layer.md) | Shared business logic, service domains, lib/ rules |
| [event-driven-architecture.md](event-driven-architecture.md) | Platform events, job queue, webhooks, retry policy |
| [ai-orchestration.md](ai-orchestration.md) | Provider routing, circuit breakers, cost tracking, fallback |
| [observability.md](observability.md) | Structured logging, tracing, metrics, health endpoint |
| [security.md](security.md) | Auth, authorization, RLS, API keys, audit logs, secrets |
| [runtime-config.md](runtime-config.md) | All configurable runtime components and environment variables |
| [architectural-principles.md](architectural-principles.md) | The 15 permanent engineering principles |

## Where to Start

If you are new to the codebase, read in this order:

1. [cloud-runtime.md](cloud-runtime.md) — understand the big picture
2. [architectural-principles.md](architectural-principles.md) — understand how we make decisions
3. [request-lifecycle.md](request-lifecycle.md) — understand how a request moves through the system
4. [service-layer.md](service-layer.md) — understand where business logic lives
5. The remaining documents as your work requires them
