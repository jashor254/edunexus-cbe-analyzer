# EduNexus v1 — Closed Beta Release

Date: 2026-07-04
Audience: pioneer beta teachers, platform admin, anyone picking up this codebase cold.

## What EduNexus is

A Kenya CBC/CBE AI education platform for teachers, parents, and students, currently in closed beta with 50 pioneer teachers across CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), and 8-4-4 (Form 3–4).

Stack: Next.js 16, TypeScript, Supabase (Postgres + Auth), Tailwind CSS, DeepSeek AI (with Gemini fallback), Paystack (with M-PESA via mobile-init).

## Completed systems

**Core teacher workflow**
- Scheme of Work generation (AI-assisted, KICD-curriculum-aware) and manual save
- Automatic weekly lesson plan generation (Friday cron) with root-cause classification and teaching-intelligence backfill
- Automatic Record of Work population from completed lesson plan weeks (Monday cron)
- Assignments: creation, pre-populated pending submissions per class roster, marking with score-bound validation
- Assessments: creation, bulk mark entry, CSV upload/upsert, position ranking
- Formative signals ("got it / confused / lost") feeding directly into the learner model

**Student-facing**
- Learning Compass AI tutoring sessions, with teacher-settable topic overrides for struggling students
- Study groups with daily challenges and point-based leaderboards
- Assignment submission flow

**Parent-facing**
- Weekly Parent Pulse via WhatsApp (Sunday cron), summarising engagement
- Inbound WhatsApp observation replies parsed and fed into the learner model
- Shared report links (time-limited, token-based)

**Intelligence layers** (built prior to Phase 13, unchanged by this stabilization work)
- EILS (Education Intelligence Learning System) — 10-layer cognitive coordination engine across profile, reasoning, next-action, knowledge-graph intelligence, career, teacher/parent panels, school intelligence, AI coordination, continuous learning
- EIR (Education Intelligence Research) — 10-pillar research layer: misconception detection, trajectory modelling, intervention effectiveness, personalization, career development, knowledge-graph evolution, risk detection, explainability, validation, knowledge base
- Career Operating System — capability engine, matching, career explorer, life simulation, parent intelligence, growth engine
- Academy — teacher professional development: reflections, missions, evidence portfolio, competency radar, cohorts

**Billing & organisations**
- Legacy single-teacher subscriptions + tokens (Paystack/M-PESA)
- Newer multi-org system: organizations, members, invitations, roles, quotas, API keys — used by the emerging developer/school platform

**Platform events**
- 21 `publishEvent()` call sites across teacher, student, parent, and organisation workflows (13 pre-existing + 8 wired in Phase 13.5), with retry/backoff/dead-letter delivery already built into the dispatch pipeline

## Phase 13 stabilization work (this release cycle)

Completed in 4 stages, each independently verified with `npm run typecheck && npm run lint && npm run build`:

1. **Security hardening** (`docs/security/remediation-report.md`) — fixed a real IDOR in formative signal recording, a broken teacher-ownership check on Compass topic overrides, added timing-safe comparison everywhere secrets are compared, made the WhatsApp webhook fail closed on misconfiguration, added Zod validation to ~30 previously-unvalidated write endpoints, and stopped trusting a client-supplied `role` field in EIR feedback.
2. **Performance** (`docs/performance/query-optimisations.md`) — eliminated the last three confirmed N+1 query patterns (records-of-work counts, two crons), batched a per-class upsert loop, added two missing indexes, cleaned up remaining `select('*')` usage.
3. **Observability & reliability** — added a slow-query timing wrapper (500ms threshold) applied to the hottest billing/assignments/SOW queries; wired the existing AI-provider circuit breaker to real DeepSeek/Gemini call outcomes instead of just an env-var check; extended `/api/platform/health` with live job-queue and event-delivery-backlog checks. Did *not* rebuild retry/backoff/DLQ/idempotency — that infrastructure was already solid.
4. **Event integration** — wired the 8 remaining gaps identified in the event-coverage audit (SOW save, assessment grading, assignment submission, parent observation, parent pulse sent, subscription upgrade/cancel, and three organisation-membership workflows).

## Architecture overview

- `app/api/**` — thin route handlers; business logic lives in `lib/`
- `lib/repositories/*` — the only layer allowed to talk to Supabase directly (enforced by convention, not yet by lint rule)
- `lib/events/*` — platform event bus: publish → schedule deliveries → dispatch cron (every minute) → webhook/internal delivery with exponential backoff and dead-lettering
- `lib/jobs/*` — background job queue with the same retry/backoff/DLQ/idempotency pattern, processed every minute across 8 named queues
- `lib/observability/*` — structured logger, in-process metrics, error taxonomy, lightweight tracing, and (new in Phase 13.3) a slow-query timing wrapper
- `lib/ai/*` + `lib/ai-orchestration/*` — DeepSeek-primary/Gemini-fallback AI calls with an in-memory circuit breaker per provider

Full architecture detail lives in `docs/architecture/*` (cloud runtime, request lifecycle, event-driven architecture, AI orchestration, security, observability, runtime config, architectural principles).

## Deployment status

- **Hosting:** Vercel (Next.js), 13 scheduled crons defined in `vercel.json` covering generation, cleanup, billing, events dispatch, and job processing
- **Database:** Supabase (Postgres + Auth), migrations tracked append-only in `supabase/migrations/`
- **AI:** DeepSeek primary, Gemini fallback on timeout/error (non-streaming and streaming paths both covered)
- **Payments:** Paystack (cards, bank, mobile money via M-PESA channel)
- Build is currently clean: 0 TypeScript errors, 0 ESLint errors (36 pre-existing warnings, all in React effect patterns/a11y/unused directives, unrelated to Phase 13 changes), production build passes

## Known limitations

- `GET /api/eir/explain/[recommendationId]` depends on a `learners.parent_user_id` column not found in the audited migration set — flagged, not fixed, low blast radius (affects one explainability endpoint's parent-access check)
- No generic circuit breaker for non-AI external calls (Paystack, WhatsApp) — the AI-provider circuit breaker pattern exists but wasn't generalized; deferred until real instability is observed
- The two health endpoints (`/api/health`, `/api/platform/health`) are intentionally separate and slightly inconsistent in shape — not unified in this release
- `assignment_submissions`/`assignments` table indexes live outside the main `supabase/migrations/` folder (in `supabase/teacher_portal_migration.sql`) and weren't re-verified in the Phase 13.2 index audit
- No formal support ticketing system — by design, given the 50-teacher scale (see `docs/beta/support-workflow.md`)
- Single platform administrator, no on-call rotation — incident response (`docs/beta/incident-response.md`) is written for this reality, not a larger team

## Beta roadmap (near-term)

- Monitor `/api/platform/health` and the in-app feedback NPS/helpful-rate as the two primary beta-health signals
- Expand event integration coverage as new webhook/integration consumers emerge (the event bus infrastructure is ready; coverage grows with demand, not speculatively)
- Revisit the non-AI circuit breaker and unified health endpoint if/when the beta scales past what direct-contact support and single-admin operations can sustain
- Continue closing security/performance debt items listed above as they become load-bearing rather than theoretical

## Support contacts

- **Platform administrator:** see `ADMIN_CONFIG.adminEmails` in `lib/config/api.ts` for the current admin account
- **Beta teacher support:** see `docs/beta/support-workflow.md` for channels and triage
- **Incident escalation:** see `docs/beta/incident-response.md`
