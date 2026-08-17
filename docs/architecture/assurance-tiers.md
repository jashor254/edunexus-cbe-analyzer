# Assurance tiers — Harness Foundation v1

What CI actually enforces, and what it doesn't yet. Written at the close of
the H1 phase arc (H0 → H1A → H1S/H1S-FIX → H1C → H1D → H1M* → H1D-2 → H1D-3
→ H1D-4 → H1D-3B → H1E-A → H1D-3C → H1E-B) that built this from a read-only
audit of pre-existing test infrastructure up to a full, wired assurance
hierarchy. See `docs/migration-history-reconciliation.md` and
`scripts/bootstrap-local-db/README.md` for the database-reconstruction side
of this work.

**Harness Foundation v1: COMPLETE WITH NAMED EXCLUSIONS.** Every tier below
has a clear purpose, known infrastructure, known runtime, known cleanup
behavior, known trigger, and known exclusions. What's *not* automated is
listed explicitly, not silently absorbed into a passing badge.

## FAST (enforced, every push/PR)

`typecheck`, `lint`, `architecture`, `build` — unchanged from before this
phase arc.

## STANDARD (enforced, secret-free)

`npm run test:standard` — `scripts/standard-tests.json`, 839/839. Runs with
all Supabase/AI env vars explicitly emptied in CI, to prove genuine absence
rather than mere tolerance of placeholder values.

## DEEP_PR (enforced, every PR)

`scripts/deep-pr-tests.json` — 20 files, 154 tests, `scripts/run-deep-pr.mjs`
(runs `--test-concurrency=1`, see H4A-FIX2 note below). Highest-risk
database/Auth/RLS/Storage invariants: RLS/tenant isolation, Evidence
lifecycle/immutability, projection persistence + retraction exclusion,
evidence→review→projection loop, teacher lifecycle, payment idempotency
(incl. a real concurrent-race test), subscription self-grant prevention,
Storage bucket privacy. Runs against a Supabase stack the job builds from
scratch inside the runner — never a remote project, never a repo secret.
Gated by: deterministic bootstrap, canonical fingerprint check,
classification guard (`scripts/check-deep-pr-classification.mjs`), cleanup
gate (0-residual, `reap-synthetic-fixtures.sh` dry-run).

**H4A-FIX2 — reproven from a fresh environment, 2 consecutive clean runs,
genuine 0 residual both times** (154/154, 0 fail, 0 skip both runs). The
gate had silently drifted broken since some earlier point — not from
anything in H4A-FIX, and not from residue: (1) the committed schema
fingerprint (`08388515ac18a5c5facf59593a461a85`) no longer matched what the
deterministic bootstrap actually produces (`e84e429d524729d0885e694bf5a90e60`,
independently reproduced 5 times across this and the H4A-FIX session); (2)
`tail -1 /tmp/*.log` is invalid syntax for this repo's GNU coreutils when
given multiple files (needs `tail -n 1`); (3) the job left
`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` blank, which crashes
`subscriptionSelfGrant.test.ts`'s real anon-client sign-in; (4) it also left
`SUPABASE_SERVICE_ROLE_KEY` blank, which crashes any file importing the
`lib/repositories` barrel (`assessmentRepository`'s eager, module-load-time
client construction — a known wart, not fixed, just given a valid local
value); (5) `PAYSTACK_WEBHOOK_SECRET` and `RESEND_API_KEY` were never set,
crashing the webhook-authenticity and teacher-lifecycle files respectively.
All five fixed in `.github/workflows/ci.yml`, always resolved from the
job's own local `supabase status`, never a repo secret. A sixth, unrelated
finding: `eventConsumerDuplicateDelivery.integration.test.ts` asserts an
exact count from an unscoped global batch read
(`processProjectionEvents(100)`) — under default multi-file concurrency a
sibling file's own pending events land in the same batch and inflate the
count. Fixed by serializing the whole manifest (`--test-concurrency=1` in
`run-deep-pr.mjs`) rather than rewriting the test's assertion — the same
shared-global-resource class of problem DEEP_SERIAL already exists for.
None of these 20 files touch an immutable-domain table, so DEEP_PR never
needed any residue exception — see OPS-TEST-003 in
operational-invariants.md for the residue taxonomy this distinction feeds.

## HTTP_PR (enforced, every PR)

`scripts/http-pr-tests.json` — 3 files, 14 tests, `scripts/run-http-pr.mjs`.
Full D2 boundary: real sign-in → real session cookie → real HTTP request →
real Next server → real route auth → real database. Separate job/Supabase
instance from DEEP_PR. Sequence before any test: HTTP auth sentinel
(`check-http-auth-sentinel.ts`), base-URL consistency across all 35 HTTP
files (`check-http-base-url-consistency.mjs`), executable SAFE-009
target-equality proof (`check-http-target-equality.sh`).

**H4A-FIX2** — same `SUPABASE_SERVICE_ROLE_KEY`/`RESEND_API_KEY` gaps as
DEEP_PR above hit this job's test-side process too (the Next server itself
was already correctly isolated); fixed the same way. Reproven green,
14/14, 0 residual, from a fresh environment.

## DEEP_MAIN — functionally proven, **permanently NOT CI-eligible under the current zero-residual bar** (H4A-FIX)

`scripts/deep-main-tests.json` — 104 files, ~858 tests. All 104 files now
route auth-user cleanup through the single canonical helper,
`deleteAuthUserOrThrow` (`lib/testing/deleteAuthUserOrThrow.ts`) — see
OPS-TEST-002 below. `db.auth.admin.deleteUser()` never rejects on a
server-side/FK error (confirmed by reading `@supabase/auth-js`'s
`GoTrueAdminApi.js`); it resolves with an unchecked `.error` regardless.
The old pattern therefore produced false assurance — "cleanup ran" when it
silently hadn't. The helper throws instead, so a leftover synthetic Auth
identity now fails the test loudly rather than leaking quietly.

Throw-on-error adoption found and fixed several real, narrow, per-test
cleanup-ordering gaps (see the blocker ledger below) — but it also
surfaced a **structural, un-fixable-within-scope blocker**: a large
fraction of DEEP_MAIN exists specifically to prove that certain tables
become permanently immutable once a row leaves its initial state. Testing
that invariant *creates* a row the same invariant then forbids ever
deleting — no service-role bypass exists, by design.

Confirmed via direct SQL against a fresh, single-run DB: of 83 synthetic
schools left after one DEEP_MAIN run, only 9 could be deleted (even by a
raw superuser `DELETE`); 74 were permanently blocked. Blocker ledger (all
enforced by unconditional DB triggers except the last row, a plain
`RESTRICT` FK):

| Table | Trigger / constraint | Rule |
|---|---|---|
| `blueprint_snapshots` | ADR-0008 Part 3, Sprint 12K | immutable forever, no exception |
| `blueprint_action_items` | Sprint 12K | immutable once a decision (approved/rejected) is recorded |
| `learner_achievements` | ADR-0012 Phase 4/11, Sprint 12W | immutable once it leaves `draft` |
| `learner_projects` | ADR-0013, Sprint 12Z | immutable once it leaves `draft` |
| `learner_leadership` | ADR-0015, Sprint 13D | immutable once it leaves `nomination` |
| `learner_competitions` | ADR-0014, Sprint 13B | immutable once it leaves `opportunity` |
| `learner_innovations` | ADR-0018, Sprint 13I | immutable once it leaves `idea` |
| `learner_wellbeing_cases` / `_updates` | ADR-0017, Sprint 13G | immutable once it leaves `concern_raised`; updates are append-only |
| `portfolio_items` | Sprint 12V | immutable once published/archived |
| `teacher_reflections` | Sprint 12O Phase 5 | immutable once published |
| `assignment_question_variants` | Sprint 9 | immutable once approved/archived |
| `learner_transfers` (`from_school_id`/`to_school_id`) | plain `RESTRICT` FK | enrollment-history preservation (see commit `5ef4fdf`) — not a trigger, but same by-design permanence |

None of this is a cleanup bug and none of it is in scope to change — H4A-FIX's
own scope lock forbids modifying product behavior or redesigning schema, and
these triggers *are* the product behavior (evidence/decision integrity
guarantees the domain layer depends on). **Verdict: DEEP_MAIN cannot meet a
strict zero-residual bar and is not being wired into CI.** It remains a
manual/local-only tier. The ~30 files with no immutable-domain fixtures
(core academic bridge, promotions, transfers, term closure, etc.) are now
fully self-cleaning after this phase's fixes; the ~15 files directly
exercising an immutable-domain table, plus the handful of `lib/core/*`
files that trigger a `blueprint_snapshots` row as a downstream side effect
of the workflow under test, will always leave exactly the rows their own
assertions require to exist. Any future CI-promotion attempt must either
accept this residue as expected (allowlist by file, not by silence) or
introduce a product-level archival/soft-delete escape hatch — both are
policy decisions outside this phase's scope.

**H4A-FIX2** — the "allowlist by file, not by silence" option now exists in
concrete form: `scripts/intentional-test-residue.json` (23 verified
entries, one per file+table+cited invariant, each individually confirmed by
a direct SQL delete attempt, no wildcards) plus
`scripts/validate-intentional-residue.mjs` guarding its shape. This is
scaffolding for a future DEEP_MAIN diagnostic pass, not a promotion — the
reaper (`reap-synthetic-fixtures.sh`) that the enforced PR gates actually
run was deliberately left untouched, since none of THEIR manifests need any
residue exception at all. See OPS-TEST-003 in operational-invariants.md for
the full taxonomy (`CLEAN` / `INTENTIONAL_TERMINAL_RESIDUE` /
`CLEANUP_DEFECT` / `SHARED_FIXTURE`) and the one file
(`quizDelivery.integration.test.ts`) that investigation reclassified as a
genuine `CLEANUP_DEFECT` rather than residue.

## DEEP_SERIAL — proven, **not yet wired into CI**

`scripts/deep-serial-tests.json` — 1 file
(`lib/core/autoProvisionCleanup.test.ts`). Asserts on a global, unscoped
`COUNT(*)` over the `schools` table — a shared resource no per-test
synthetic-data isolation can make parallel-safe, since *any* concurrently
running file that creates a school changes the count out from under it.
Must run with `--test-concurrency=1`, separately from DEEP_MAIN's default
concurrency. Deferred alongside DEEP_MAIN pending the same cleanup work.

## HTTP_MAIN (enforced, push to main + manual dispatch)

`scripts/http-main-tests.json` — 5 files, 55 tests, `scripts/run-http-main.mjs`.
Broader authenticated route coverage: school payments/entitlement, pilot
student listing, school handoff/membership, teacher activation, growth
schools admin search. **2 consecutive clean runs, 0 residual both times**
(after fixing the same `notification_log` leak pattern in 2 of these 5
files). Same server/sentinel/SAFE-009 sequence as HTTP_PR, separate job.

## DEEP_NIGHTLY (enforced, scheduled 02:00 UTC + manual dispatch)

`scripts/deep-nightly-tests.json` — 8 files, 35 tests, `scripts/run-deep-nightly.mjs`.
Content-seed-dependent D1 scenarios (curriculum-context resolution,
sub-strand-anchored evidence, correction-key validation, Academy
reflections, quiz evidence) that need real `sow_substrands`/`academy_lessons`/
`academy_missions` rows to exist. Requires
`npm run db:seed:test-content` (`scripts/bootstrap-local-db/seed-test-content.sql`
— deterministic, idempotent, fixed-UUID, synthetic-but-canonical CBC
content, zero personal data, zero Mwatate Ridge dependency) to run *after*
the schema bootstrap and *before* the tests; the runner refuses to proceed
if the seed's sentinel row isn't present. **1 clean run, 0 residual, 35/35**
(after excluding `lib/testing/maryFullCircuit.integration.test.ts` from this
manifest — it also needs the content seed and passes functionally, but its
cleanup hits `teachers`' 34-table FK fan-out in a way not resolved within
this phase's budget; tracked as a known gap, not silently dropped).

## REHEARSAL — not identified as a concrete population yet

No file encountered across any wave of this entire H1 arc referenced
Mwatate Ridge, founder handoff, or persistent reference-school state — a
negative result worth recording, not an omission. If such tests exist in
the ~27 HTTP files and remaining D1 scope never fully swept, they haven't
surfaced yet.

## Explicitly excluded, by design

- **23 architecture-excluded tests** (`scripts/excluded-tests.json`) —
  blocked on an eager-singleton pattern in `lib/repositories/*.ts`
  (module-scope `export const xRepository = new XRepository()` calls the
  production-named `createServiceClient()` at import time). **All 23 tested
  under a verified local-env-override in H1D-3C: 247/247 pass.** Kept
  outside CI regardless — execution safety under a workaround is not the
  same as architectural cleanliness, and normalizing production-named env
  vars into the harness was explicitly rejected. H1R (fix the eager
  singleton) remains recommended but not urgent — nothing in this arc's
  evidence shows it causing a real incident beyond harness classification.
- **3 files with individually-known failing tests**, excluded from every
  enforced tier rather than silently included with a red gate:
  `lib/core/coreAssessmentTypeIntegrity.test.ts` (FIXTURE_DEFECT — one test
  passes a raw legacy class id to a function expecting a Core-bridged id),
  `lib/projection/equivalenceHarness.integration.test.ts`
  (APPLICATION_BLOCKED — a real evidence-retraction-semantics question:
  does retracting a superseding evidence row un-supersede its predecessor?
  needs a product decision, not a mechanical fix),
  `lib/learnerBlueprint/composeBlueprint.integration.test.ts`
  (CONTENT_SEED_REQUIRED, unresolved — one test needs the real `careers`
  catalogue, 0 rows locally; a career-catalogue seed is out of scope for
  this phase's "small, minimal" content-seed model).
- **DEEP_MAIN / DEEP_SERIAL** — proven, not yet CI-enforced (see above).

This is a critical *subset* plus a proven-but-not-yet-wired broader set, not
full DEEP coverage — do not read the enforced tiers passing as "the
database layer is fully tested." It means the highest-value, individually
and combined-proven invariants block bad changes now; everything listed
above is real, scoped follow-up work, not a hidden gap.
