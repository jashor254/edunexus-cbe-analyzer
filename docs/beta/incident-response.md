# Incident Response

For the closed beta (50 pioneer teachers), incident response is intentionally lightweight — there is currently one platform administrator, not an on-call rotation. This doc defines severity, first steps, and escalation so that whoever is available can act consistently.

## Severity levels

| Severity | Definition | Example |
|---|---|---|
| **SEV-1** | Platform down or data at risk for all/most users | Database unreachable, auth broken platform-wide, a migration corrupted data |
| **SEV-2** | A core teacher workflow broken for some/all users | Lesson plan generation failing, SOW save failing, assignments not loading |
| **SEV-3** | Degraded but workable | AI provider degraded (fallback still working), one cron job failing silently, slow queries |
| **SEV-4** | Cosmetic / non-blocking | UI glitch, a non-critical notification not sending |

## First response (any severity)

1. **Check `GET /api/platform/health`** — this is the fastest signal. It reports:
   - `database` (connectivity + latency)
   - `ai_providers` (DeepSeek/Gemini circuit-breaker state — real call outcomes as of Phase 13.3)
   - `jobs` (queue depths, failed/dead-letter counts)
   - `events` (webhook delivery backlog)
2. **Check `GET /api/health`** if `platform/health` itself is unreachable — it's the minimal public uptime check and should be up even if internal systems are struggling.
3. **Check Vercel function logs** for the affected route/cron — all routes use the structured `logger` (`lib/observability/logger.ts`), which emits JSON in production, so logs are greppable by `service`, `error`, etc.

## SEV-1 — Platform down / data at risk

1. Confirm scope: is it everyone, or one workflow? `/api/platform/health` database check answers this fast.
2. If it's a bad deploy: **promote the last known-good Vercel deployment immediately** (see `docs/beta/rollback-guide.md` §1). Don't investigate root cause first — stop the bleeding.
3. If it's a bad migration: do **not** attempt a live schema fix under pressure. Promote the last known-good deploy if the app code can tolerate the old schema; otherwise see `docs/beta/rollback-guide.md` §2.
4. If Supabase itself is down (not your migration, actual provider outage): check Supabase status page, there is nothing to fix on your end — communicate to affected teachers and wait.
5. Once stable, notify pioneer teachers if the outage was visible to them (WhatsApp/email, whatever channel is normally used — see `docs/beta/support-workflow.md`).

## SEV-2 — Core workflow broken

1. Reproduce the failure path (which route, which input).
2. Check the relevant cron/job isn't the cause — `lib/jobs/monitor.ts`'s `getQueueDepths()` / `getDeadLetterJobs()` will show if background processing is backed up.
3. If it's AI-generation related (SOW/lesson plan generation), check `ai_providers` health first — if DeepSeek is `down`, the Gemini fallback should already be covering it; if both are unhealthy, that's the SEV-2.
4. Fix forward in a branch, verify with `npm run typecheck && npm run lint && npm run build`, deploy.

## SEV-3 — Degraded

1. Log it, don't panic-fix. The circuit breaker and job retry/backoff/DLQ infrastructure (already solid pre-Phase-13, confirmed in the Phase 13.3 audit) is designed to self-heal most of these.
2. If a cron is silently failing repeatedly, check its Vercel function logs for the specific error and fix at your own pace — it's not urgent unless it's compounding (e.g. `billing-renewals` failing daily means trial expiries pile up unprocessed).

## SEV-4 — Cosmetic

Track it, fix it in normal development flow. Not an incident.

## Data-integrity double-check after any incident touching payments or subscriptions

Payment and subscription writes are idempotent by design (`payments.status` guard in `app/api/payments/callback/route.ts`, `organization_subscriptions` upserts) — but after any SEV-1/2 incident that touched billing, manually spot-check:

- No duplicate `payments` rows for the same `transaction_id`
- `token_balances` deltas look sane (deductions only happen after a successful AI response, per `lib/payments/access.ts`)
- `organization_subscriptions.status` matches what Paystack/M-PESA actually confirmed

## Escalation

There is currently a single admin/maintainer. If you are not that person and hit a SEV-1/SEV-2 you cannot resolve, do not guess — leave the system in its current state (don't attempt destructive fixes) and escalate via whatever channel is documented in `docs/beta/support-workflow.md`.
