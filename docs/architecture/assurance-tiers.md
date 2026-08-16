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

`scripts/deep-pr-tests.json` — 8 files, 105 tests, `scripts/run-deep-pr.mjs`.
Highest-risk database/Auth/RLS/Storage invariants: RLS/tenant isolation,
Evidence lifecycle/immutability, projection persistence + retraction
exclusion, evidence→review→projection loop, teacher lifecycle, payment
idempotency (incl. a real concurrent-race test), subscription self-grant
prevention, Storage bucket privacy. Runs against a Supabase stack the job
builds from scratch inside the runner — never a remote project, never a repo
secret. Gated by: deterministic bootstrap, canonical fingerprint check,
classification guard (`scripts/check-deep-pr-classification.mjs`), cleanup
gate (0-residual, `reap-synthetic-fixtures.sh` dry-run).

## HTTP_PR (enforced, every PR)

`scripts/http-pr-tests.json` — 3 files, 14 tests, `scripts/run-http-pr.mjs`.
Full D2 boundary: real sign-in → real session cookie → real HTTP request →
real Next server → real route auth → real database. Separate job/Supabase
instance from DEEP_PR. Sequence before any test: HTTP auth sentinel
(`check-http-auth-sentinel.ts`), base-URL consistency across all 35 HTTP
files (`check-http-base-url-consistency.mjs`), executable SAFE-009
target-equality proof (`check-http-target-equality.sh`).

## DEEP_MAIN — proven, **not yet wired into CI**

`scripts/deep-main-tests.json` — 104 files, 820 tests. Proven functionally
correct: 1 clean combined run (820/820, 0 fail, 7 intentional skips,
~158s), reconfirmed as individual-file-clean across 10 domain batches in
H1D-3C. **Blocked from CI enforcement by a real, well-evidenced cleanup
finding**: at 104-file combined scale, this set leaks substantially (614
`auth.users`, 192 `schools` rows observed in one run) — almost certainly the
same `notification_log`-blocks-`deleteUser` FK pattern found and fixed in a
handful of specific files during H1E-A/H1E-B, present much more widely
across files never individually cleanup-audited at this scale. Per this
harness's own rule (never auto-clean then declare success), DEEP_MAIN is
**not** wired into a hard-fail CI gate until that's fixed. Recommend a
dedicated cleanup-hardening pass (grep every DEEP_MAIN file for
`auth.admin.deleteUser` without a preceding `notification_log` clear, same
pattern as the fixes already applied) before promotion.

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
