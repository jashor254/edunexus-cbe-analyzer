# Migration History Reconciliation Plan

## Current state (verified against production, not estimated)

Production's migration history currently has 127 recorded entries. Comparing against `supabase/migrations/` in this repository: **~22 production migrations have no corresponding file in the repository**, spanning from the project's earliest days (`create_shared_reports`, `create_study_groups` ×4, `create_sow_curriculum_tables`, `clean_slate_sow_tables` — March–April 2026) through the most recent work (`devportal_*` ×8, `db_security_hardening_phase1-11`, `create_insights_platform`, `insights_increment_view_function` — all July 2026).

Additionally, this release's own `eir_foundation` migration is recorded in production under version `20260702083523`, while the local file is named `20260702_eir_foundation.sql` (no time component) — a version-identifier mismatch that would confuse `supabase db push`'s history diffing if ever used for this migration.

**This is a long-standing, systemic gap, not something this release introduced** (beyond the one version-naming mismatch above). It represents repeated instances of someone applying SQL directly to production — via the dashboard SQL editor, or an agent session's `apply_migration` call — without the corresponding file also being committed to the repository.

## Why this matters

The repository is not currently capable of reconstructing production from scratch. Disaster recovery, spinning up an accurate staging environment, or onboarding a new engineer who needs to understand "what does our schema actually look like" all implicitly depend on production always being available and never needing a from-scratch rebuild — a single point of failure that migration history is supposed to eliminate.

## Principle: never bypass migration history permanently

The fix for *this specific release* (manual, targeted SQL execution for the two still-pending migrations, documented separately in the deployment plan) is an explicitly narrow, one-time exception justified by drift this release didn't create — not a template for future work. Going forward, **the repository must become the source of truth**, and every future schema change must go through a committed migration file before it touches production, with no exceptions.

## Reconciliation steps

1. **Inventory.** For each of the ~22 undocumented migration versions, determine its actual applied DDL from production. This is mechanical, not guesswork: each migration's name (e.g. `create_shared_reports`) combined with introspection of the current live schema (`information_schema`, `pg_get_functiondef`, `pg_policies`, `pg_get_constraintdef`) is sufficient to reconstruct an accurate `CREATE TABLE`/`CREATE POLICY`/etc. statement — the same method used successfully to reconstruct the verified dependency closure during this release's validation.
2. **Backfill migration files**, one per missing version, named to exactly match production's recorded `<version>_<name>.sql` so `supabase migration repair` (step 4) can reference them cleanly.
3. **Peer-review each backfilled file against the live schema** before considering it done. A backfilled file that's subtly wrong is worse than an honestly-missing one — it creates false confidence that the repository matches production when it doesn't.
4. **Run `supabase migration repair --status applied <version>`** for each backfilled version once its file is confirmed accurate, so the CLI's local migration tracking agrees with remote history without attempting to re-execute anything against production.
5. **Fix the `eir_foundation` version mismatch** the same way: either rename the local file to match `20260702083523_eir_foundation.sql` and repair, or accept the mismatch as permanent and document it — reconciling it is preferable since it removes a footgun for the next person who touches this migration.
6. **Freeze the informal-application habit going forward.** This release's own migrations (via manual SQL, per the deployment plan) should be the last ones applied without a matching committed file *at the time of application*. Every future schema change goes through a `supabase/migrations/*.sql` file first, always — this is a process discipline fix, not a technical one, and it's the only thing that actually prevents this problem from recurring.

## Scope note

This is a dedicated project with its own review cycle — do not attempt it as part of, or a prerequisite to, deploying this release's 3 migrations. The two problems are independent: this release's migrations can be deployed safely today (see the deployment plan and this release's fix report) regardless of when the broader history gap gets closed.
