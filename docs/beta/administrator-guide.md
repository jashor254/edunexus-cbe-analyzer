# Platform Administrator Guide

For whoever holds the `ADMIN_CONFIG.adminEmails` role (currently a single admin account, `lib/config/api.ts`). This is the person who can hit `/api/admin/*` routes and see platform-wide stats.

## Getting admin access

Admin status is a hardcoded email allowlist, not a database role:

```ts
// lib/config/api.ts
adminEmails: ['<admin-email>'],
isAdmin(email) { return this.adminEmails.includes(email.toLowerCase().trim()) }
```

To add a second admin, add their email to `adminEmails` and redeploy — there is no self-service admin promotion, by design.

Separately, `ADMIN_CONFIG.adminSecret` (an env var) gates the bearer-token admin routes (`/api/admin/init`, `/api/admin/cleanup-stats`, `/api/admin/trigger-cleanup`, `/api/admin/activate-user`, `/api/admin/grant-access`). These are for scripted/manual operations, not for the logged-in admin UI.

## Admin routes reference

| Route | Purpose |
|---|---|
| `GET /api/admin/stats` | Platform-wide counts: users, students, assessments, compass sessions, payments, active subscriptions, total revenue |
| `POST /api/admin/init` | One-time admin account initialisation (grants unlimited tokens + 10-year premium subscription to the admin's own account) |
| `POST /api/admin/activate-user` | Manually activate a user after an M-PESA payment confirmation that didn't reconcile automatically |
| `POST /api/admin/grant-access` | Grant a user a subscription + bonus tokens directly (support/goodwill grants) |
| `GET /api/admin/cleanup-stats` | View idle/unverified account cleanup history |
| `POST /api/admin/trigger-cleanup` | Manually trigger the user cleanup cron outside its schedule |
| `GET /api/feedback` (with `x-admin-secret` header) | In-app feedback dashboard: NPS, helpful/not-helpful rates, cancel reasons |

All of these require the `Authorization: Bearer <ADMIN_SECRET>` header (or `x-admin-secret` for feedback) and now use timing-safe comparison (`lib/api/secretCompare.ts`, added in Phase 13.1) — plain string mismatches are handled the same way as before, just not exploitable via timing attacks.

## Platform health

Two health endpoints exist, deliberately kept separate:

- **`GET /api/health`** — public, minimal, meant for uptime monitors (UptimeRobot etc). Checks database, auth, and a DeepSeek env-var sanity check. No auth required, no internals leaked.
- **`GET /api/platform/health`** — richer internal view. Checks:
  - `database` — connectivity + latency
  - `ai_providers` — DeepSeek/Gemini circuit-breaker state (`healthy`/`degraded`/`down`), now driven by real call outcomes (Phase 13.3 — `lib/ai/deepseek.ts` reports success/failure into `lib/ai-orchestration/registry.ts`)
  - `jobs` — queue depths and dead-letter counts across all 8 job queues (added Phase 13.3)
  - `events` — pending/failed/dead-letter webhook delivery counts (added Phase 13.3)

  Overall status is `healthy` only if every check is healthy; any `down` component makes the whole endpoint return HTTP 503.

Bookmark `/api/platform/health` — it's the fastest way to answer "is something actually broken right now, and where."

## Job queues and dead letters

- `GET` via `lib/jobs/monitor.ts` functions (not yet exposed as a dedicated admin UI route — call from a script or extend `/api/admin/stats` if you need a page): `getQueueDepths()`, `getJobStats(orgId)`, `getDeadLetterJobs()`.
- Dead-letter jobs younger than 7 days are auto-requeued daily at 03:30 UTC (`/api/cron/dlq-requeue`, up to 50/run). Older dead-letter jobs need manual review — call `requeueDeadLetterJob(jobId)` or investigate why they keep failing.

## Security posture (as of Phase 13.1)

- No route uses `getSession()` — all auth checks use `getUser()`.
- All cron/admin shared-secret comparisons are timing-safe.
- Every audited write endpoint validates its request body with Zod.
- Known residual gap: `GET /api/eir/explain/[recommendationId]` relies on a `learners.parent_user_id` column that doesn't appear in the audited migration set — flagged, not yet fixed (see `docs/security/remediation-report.md`, "Remaining security debt").

## Performance posture (as of Phase 13.2)

- No known N+1 query patterns remain in the audited hot paths (assignments, SOW, ROW, billing cron jobs).
- `assignment_submissions`/`assignments` indexes live in `supabase/teacher_portal_migration.sql`, outside the main migrations folder — worth confirming they're indexed if performance issues show up around those tables specifically.

## When something looks wrong

1. Check `/api/platform/health` first.
2. Check `docs/beta/incident-response.md` for severity triage.
3. If it's a bad deploy or migration, see `docs/beta/rollback-guide.md`.
