# Local disposable-database bootstrap

Reconstructs a fresh local Supabase/Postgres instance from repository-controlled
artifacts, proving the schema is not dependent on undocumented, one-off manual
production changes. **Assurance infrastructure — not a production migration
tool.** See `docs/migration-history-reconciliation.md` for the full audit
trail this was built from (phases H1M through H1M-SNAPSHOT-3).

## Usage

```bash
supabase start                              # brings up the local Docker stack
npm run db:bootstrap:test                   # or: bash scripts/bootstrap-local-db/run.sh
```

The script refuses to run against anything but the local `supabase_db_edunexus`
Docker container — see "Safety" below. It always starts from whatever schema
state that container currently has; run `supabase db reset --local` first (or
drop/recreate the `public` schema) for a truly from-zero run.

On success it prints a canonical schema fingerprint (`FINGERPRINT: <md5>`).
Proven deterministic under H1M-SNAPSHOT-3: two independent fresh runs of the
unchanged script produce the identical hash.

## Safety

- No connection-string parameter exists — the target container name
  (`supabase_db_edunexus`) is hardcoded, not configurable.
- No `.env.local` / `.env.production` / any repo secret is read.
- A preflight (`docker inspect`) verifies the container exists and is a
  Supabase image before any SQL runs; anything else is a hard refusal.
- Any SQL failure without a matching recovery case in STAGE 2's `case`
  statement is an `UNRECOVERED STOP` — the script exits non-zero rather than
  continuing best-effort.

## Manifest

### `00-baseline/` — pre-tracked-migration recovery SQL

Applied before the 107 tracked migrations. Every file's origin/reason:

| File | Represents | Origin |
|---|---|---|
| `01-shared-reports.sql` | pre-history table | recovered from `supabase_migrations.schema_migrations` |
| `02-study-groups.sql` | pre-history tables | recovered from `schema_migrations` |
| `03-sow-curriculum-tables.sql` | pre-history tables | recovered from `schema_migrations` |
| `04-academic-reports.sql` | pre-history table, historical (pre-05-25) form | recovered from `schema_migrations` |
| `05-additional-prehistory-tables.sql` | pre-history tables | recovered from `schema_migrations` |
| `06-second-prehistory-batch.sql` | pre-history tables | recovered from `schema_migrations` |
| `07-clean-slate-sow-schema-and-curriculum-configs.sql` | pre-history tables | recovered from `schema_migrations` |
| `08-student-learning-context.sql` | pre-history table | recovered from `schema_migrations` |
| `09-column-gap-patches.sql` | structural patch | live columns with no tracked-migration origin (`row_entries`, `learner_profiles`, `compass_sessions`) |
| `10-devportal-cluster.sql` | pre-history domain | full devportal cluster, recovered from `schema_migrations` |
| `11-learning-intelligence-foundation.sql` | pre-history domain | `school_teachers`/`formative_signals`/`remedial_plans`/`holiday_plans`, recovered from `schema_migrations` |
| `12-academy-cluster.sql` | pre-history domain | 15 Academy-domain production migrations, concatenated |
| `13-eils-careers-functions.sql` | pre-history domain + version correction | EILS tables, `careers` rebuild (patched to match production's *current* live shape — the recovered historical DDL was an intermediate form, see file comment), ~19 recovered function definitions |
| `14-knowledge-graph-tables.sql` | pre-history domain | `knowledge_nodes`/`knowledge_edges`/`node_assessment_map`, recovered from a data-seed migration with no repo file (seed data itself excluded — out of structural scope) |
| `15-security-phase6-column-gaps.sql` | structural patch | `assessments`/`whatsapp_inbound_log` columns needed by security phase 6, no tracked-migration origin |
| `16-parent-profiles-service-policy-and-insights-view-fn.sql` | structural patch | policy + function referenced by real tracked migrations but never themselves created by any tracked migration |

### `01-security-hardening/` — security-hardening recovery

Production applied 11 numbered `db_security_hardening_phase*` operations and
one later `sprint14`/`sprint15` policy rewrite **out of band of the tracked
migration history** (no corresponding repo file). Recovered verbatim from
`supabase_migrations.schema_migrations.statements` where the migration is
tracked-but-missing, or via `pg_get_functiondef`/live introspection where no
migration record exists at all (functions targeted by phases 8-11's
REVOKE/GRANT, where only the current signature matters, not historical body
content).

`phase11b-study-group-challenges-ordering-correction.sql` is **not** a
recovered historical event — it is an ordering correction. Production's true
chronology has phase 11 (2026-07-02) *before* `sprint14_security_hardening`
(2026-07-10), so sprint14's later blanket policy rewrite is what actually
survived to become the final production state. This script applies all
tracked migrations (STAGE 2, includes sprint14) before the recovered security
phases (STAGE 3, includes phase 11) — the reverse order — so phase 11's
policy is reasserted last and must be corrected back. See the file's own
header comment for the full explanation and the production verification query
used to confirm the final state.

### `fingerprint.sql`

Canonical structural schema fingerprint (one MD5 over sorted, semantically-
normalized lines covering tables/columns/types, constraints via
`pg_get_constraintdef` rather than possibly-generated names, indexes via
normalized `pg_get_indexdef`, RLS enabled/forced, policies, functions keyed by
`pg_proc.oid` (not name — overloaded functions broke an earlier name-keyed
join), triggers, and views). See the file's own header for the full field
classification (STABLE STRUCTURAL / GENERATED-NAME / RUNTIME-VOLATILE /
ORDER-SENSITIVE) and why each category is included or excluded.

## Known, documented differences from production

None outstanding as of H1M-SNAPSHOT-3. (H1M-SNAPSHOT-2 had flagged a
`study_group_challenges` policy divergence; H1M-SNAPSHOT-3 determined it was a
local reconstruction ordering bug, not a real production/bootstrap difference,
and fixed it — see `01-security-hardening/phase11b-*` above.)
