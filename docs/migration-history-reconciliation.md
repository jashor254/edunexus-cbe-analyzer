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

---

## 2026-08-16 update (H1M → H1M-SNAPSHOT-3 arc)

The "~22 migrations" figure above is **superseded and should not be used as a
proxy for total schema loss.** It undercounted badly: one missing migration
entry can produce 15+ tables (the Academy cluster); conversely a table can be
missing from every tracked migration while its migration *entry* exists (or
vice versa). The real picture, established by empirically reconstructing a
fresh database twice from zero and proving it deterministic
(`scripts/bootstrap-local-db/`, see its README for the full manifest), sorts
into nine distinct categories:

1. **Tracked repo migrations** — 107 files under `supabase/migrations/`, all
   proven to replay cleanly on a fresh database (one, `20260629_core_foundation.sql`,
   has a genuine internal bug in its final statement — a broken view — and
   applies successfully minus that one statement).
2. **Production migration entries with no repo file** — the `db_security_hardening_phase1-11`
   sequence, the original `create_study_group_challenges`/`create_study_group_answers`,
   `career_reality_engine_rebuild`, `eils_intelligence_learning_system`,
   the devportal cluster (~8 entries), the Academy cluster (~15 entries),
   `knowledge_graph_phase1_grade7_math` (a data-seed migration), and others —
   all recovered verbatim from `supabase_migrations.schema_migrations.statements`
   and now live in `scripts/bootstrap-local-db/00-baseline/`.
3. **Pre-history/manual objects** — schema objects with no corresponding
   migration *entry* at all in production's own history table, only
   reconstructable from current live `information_schema`/`pg_get_functiondef`
   introspection (e.g. several `careers` columns added after
   `career_reality_engine_rebuild` by an unrecovered later change; several
   functions targeted by security phases 8-11).
4. **Version mismatches** — repo filename timestamp vs. production's recorded
   version differ for the same-content migration (`eir_foundation`,
   `baseline_sow_curriculum_schema`, `sow_tables`, `lms_quiz_extends_assignments`,
   `growth_engine_sprint_c0`, and `sprint15_corrections`/`sprint14_security_hardening`,
   the last pair notable because their filenames lexicographically *reverse*
   true chronological order — see `01-security-hardening/phase11b-*.sql`'s
   header for the concrete bug this caused and how it was corrected).
5. **Fresh-bootstrap recovery artifacts** — everything under
   `scripts/bootstrap-local-db/00-baseline/` and `01-security-hardening/`.
   Deliberately kept out of `supabase/migrations/` so they stay invisible to
   `supabase db push`/production migration discovery — they exist only to
   reconstruct a *disposable local* database, never to be replayed against
   production (which already has this state).
6. **Historical data-only events excluded** — e.g.
   `20260707_fix_strand_assessments_source_backfill.sql`, a pure data
   backfill with no structural effect, deliberately skipped by the bootstrap.
7. **Account-specific operations excluded** — none identified as schema-relevant;
   none included in the bootstrap.
8. **Security-hardening recovery** — the 11 `db_security_hardening_phase*`
   operations plus the `sprint14`/`sprint15` policy rewrite, recovered and
   proven to reach exact production parity (spot-checked: `auth_owns_student`,
   `auth_is_guardian_of`, token/payment function grants, EILS deny-all RLS
   posture, `v_api_*` `security_invoker`, and `study_group_challenges`
   policy state — all confirmed matching live production as of 2026-08-16).
9. **Known production-vs-bootstrap intentional differences** — none
   outstanding. (A `study_group_challenges` policy divergence was open as of
   H1M-SNAPSHOT-2; H1M-SNAPSHOT-3 determined it was a local reconstruction
   ordering bug — not a real difference — and fixed it.)

**Determinism proof**: two independent fresh runs of the unchanged bootstrap
script produce an identical canonical schema fingerprint (structural MD5 over
tables/columns/constraints/indexes/RLS/policies/functions/triggers/views,
semantically normalized — see `scripts/bootstrap-local-db/fingerprint.sql`).
See `scripts/bootstrap-local-db/README.md` for how to run it
(`npm run db:bootstrap:test`).
