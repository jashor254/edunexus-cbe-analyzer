# Rollback Guide

EduNexus deploys on Vercel (Next.js) with Supabase as the database/auth backend. This guide covers rolling back a bad deploy, a bad migration, and a bad cron/job change — the three failure modes most likely to hurt during closed beta.

## 1. Bad application deploy

Vercel keeps every previous deployment addressable and instantly promotable.

1. Go to the Vercel project dashboard → Deployments.
2. Find the last known-good deployment (check `/api/platform/health` was green on it, if you can correlate by timestamp).
3. Click **Promote to Production** on that deployment. This is instant — no rebuild required — and reverts the live site without touching the database.
4. Confirm via `/api/platform/health` that `database`, `ai_providers`, `jobs`, and `events` all report healthy again.
5. Only after confirming stability, investigate and fix the root cause in a new branch — do not hot-fix directly against production.

**Never** force-push over the bad commit on `main`; keep it in history so the incident is traceable. Revert with a new commit instead.

## 2. Bad Supabase migration

Migrations in this repo are additive-by-convention (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) specifically so they're safe to re-run and rarely need a hard rollback. If a migration causes a problem:

1. **If it added a column/index/table**: usually safe to leave in place even if unused — dropping it is riskier than leaving inert schema. Only drop if it's actively causing errors (e.g. a bad `NOT NULL` constraint blocking writes).
2. **If it altered existing behavior** (changed a constraint, renamed a column, altered a trigger/RPC): write a new forward migration that reverses the specific change — do not edit or delete the already-applied migration file. Migration files are an append-only log; once applied to any environment, treat them as immutable history.
3. Use `mcp__supabase__list_migrations` / `mcp__supabase__list_tables` to confirm the current applied state before writing the reversing migration.
4. Test the reversing migration against a Supabase branch (`mcp__supabase__create_branch`) before applying to production, if time allows.
5. Apply via `mcp__supabase__apply_migration` (or the Supabase CLI) — never hand-edit production schema through the dashboard SQL editor for anything that should be tracked in `supabase/migrations/`.

## 3. Bad cron/job behavior

If a cron job (see `vercel.json` for the full schedule list) starts misbehaving — e.g. `friday-generation` double-generating lesson plans, or `billing-renewals` downgrading orgs incorrectly:

1. **Disable the specific cron** by removing its entry from `vercel.json` and redeploying — this stops it running on schedule without touching anything else. (There's no per-cron kill switch beyond this; `CRON_SECRET` gates *auth*, not *whether it runs*.)
2. Check `platform_events` / `notification_log` / the relevant table for how much damage was done (all crons in this codebase log their outcome — check `logger.info`/`logger.error` output in Vercel's function logs).
3. Fix forward, redeploy, re-add the cron entry.
4. For the two "irreversible-feeling" crons specifically:
   - **`billing-renewals`** (downgrades expired trials to free): if it wrongly downgraded active orgs, restore their `organization_subscriptions.status`/`plan_id` and `organizations.api_quota_*` from the values in the `organization.subscription.canceled` platform event payload it published (Phase 13.5 wired this — the payload records what happened) or from your latest Supabase backup.
   - **`cleanup-users`** (deletes idle/unverified accounts): check `user_cleanup_stats` and `users.deleted_at` before assuming data is gone — Supabase point-in-time recovery is the fallback if a legitimate account was deleted.

## 4. Bad AI-provider behavior (DeepSeek/Gemini)

The AI provider circuit breaker (`lib/ai-orchestration/registry.ts`, wired to real call outcomes in Phase 13.3) will automatically mark a provider `degraded` after 2 consecutive errors and `down` after 5, recovering automatically 60s later. You generally don't need to intervene — but if a provider is silently producing bad *content* (not errors), that won't trip the breaker. In that case:

1. Check `/api/platform/health`'s `ai_providers` detail for current health.
2. If DeepSeek itself is the problem, there's no feature flag to force Gemini-only today — the fallback only triggers on DeepSeek errors/timeouts, not on bad-but-successful responses. Treat this as a bug report to fix forward, not a rollback scenario.

## General principle

Prefer **forward fixes** over destructive rollback wherever the blast radius allows it — this is a small (50-teacher) but real, in-use platform. Data loss or a broken week for a pioneer teacher is worse than an extra hour spent writing a careful forward fix.
