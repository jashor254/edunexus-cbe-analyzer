# Operational Invariants — Reliability Under Real Conditions

**Phase**: H4A. **Depends on**: Harness Foundation v1 (H1), H2A–H2E's intelligence-layer assurance, H3A's product-intent register. **Purpose**: this document is not "is the logic correct" (H2/H3's question) — it's "does the system still behave correctly when retries, schedules, partial failure, provider outages, and crashed workers introduce real operational conditions."

Format per invariant: ID, statement, boundary, failure mode, proof, status.

---

## OPS-CRON-001 — Scheduled routes cannot be invoked without their authentication boundary

**Statement**: A route under `app/api/cron/` cannot be successfully invoked without the caller presenting the configured `CRON_SECRET`, except through the one deliberate alternate trust path named below.

**Boundary**: `timingSafeEqualString(authHeader, `Bearer ${CRON_SECRET}`)` (`lib/api/secretCompare.ts`), checked first in every one of the 17 routes under `app/api/cron/`.

**Failure mode caught**: an unauthenticated caller triggering a scheduled job on demand (duplicate sends, unscheduled data mutation, resource exhaustion).

**Proof**: `app/api/cron/cronAuthBoundary.integration.test.ts` (10 tests) — calls the real, unmodified exported route handlers directly (no mocked auth check) for `events/dispatch`, `jobs/process`, `billing-renewals` (missing header → 401, wrong secret → 401, correct secret → not 401), and `academy-nudge` (missing/wrong → 401).

**Named finding, not fixed**: `academy-nudge`, `cleanup-users`, and `snapshot-metrics` also accept `x-vercel-cron: 1` with **no secret check at all** — a second trust path relying entirely on Vercel's platform guarantee that this header is stripped from client-supplied requests and only set internally by Vercel's own cron dispatcher. This guarantee lives outside this codebase and cannot be verified by a code-level test. If it were ever wrong — a different host, a platform behavior change, a local/self-hosted deployment — this is a full auth bypass for those 3 routes. Documented and proven-as-is (`cronAuthBoundary.integration.test.ts`'s FINDING test), not changed: removing the bypass could break legitimate Vercel Cron invocations that don't send an Authorization header by default.

**Status**: was ABSENT (zero test coverage before this phase, despite a real, working auth mechanism) → **EXISTING**.

---

## OPS-CRON-002 — Re-executing a scheduled job cannot duplicate notification/entitlement effects

**Statement**: Running the same cron job twice while the underlying condition remains true must not duplicate learner/org-impacting notifications, evidence, interventions, or payment/entitlement effects.

**Boundary**: `publishEvent()`'s `idempotency_key` parameter (`lib/events/publish.ts`) and per-route WHERE-not-already-done query gates.

**Audit result, per route**:
| Route | Idempotency |
|---|---|
| `academy-nudge` | EXISTING — dedups via `notification_log` lookup before sending |
| `billing-renewals` | EXISTING — only acts on rows still in the pre-transition status; a second run finds nothing left to change |
| `dlq-requeue`, `events/dispatch`, `jobs/process`, `projection-events/process` | EXISTING — status-gated compare-and-swap claims |
| `parent-pulse`, `term-readiness` | **PARTIAL** — the published event itself carries an idempotency key, but the WhatsApp send + `notification_log` insert alongside it has no pre-check — a rerun would send a duplicate WhatsApp message even though the event itself dedups. Not fixed this phase (would touch two more cron routes beyond the one closed below; named here for a future targeted fix using the same pattern). |
| `quota-alerts` | **was ABSENT** (confirmed: no idempotency_key on its `publishEvent` call at all) → **fixed this phase** |

**Fix**: `app/api/cron/quota-alerts/route.ts` — added `idempotency_key: \`org.quota.warning:${org.id}:${todayStr.slice(0,10)}\`` (one alert per org per day), matching the pattern already used by sibling cron routes.

**Proof**: `app/api/cron/quotaAlertsIdempotency.integration.test.ts` — real org over both daily/monthly thresholds, route invoked twice, exactly one `org.quota.warning` `platform_events` row survives.

**Status**: PARTIAL (mixed across routes) → the one confirmed-ABSENT case (quota-alerts) is now EXISTING. `parent-pulse`/`term-readiness`'s WhatsApp-send gap remains PARTIAL, named not fixed.

---

## OPS-EVT-001 — Duplicate delivery of a canonical event cannot produce duplicate canonical state

**Statement**: If the same `evidence_projection_events` row is processed twice (crash between recompute and mark-processed, or at-least-once outbox redelivery), the resulting canonical state must be identical, not duplicated or drifted.

**Boundary**: `processProjectionEvents()` (`lib/projection/eventConsumer.ts`) → `recomputeLearnerProjection()` (`lib/projection/recompute.ts`).

**Why this is safe by construction**: `recomputeLearnerProjection()` does a full delete-then-upsert per projector type from currently-confirmed evidence on every call — never an incremental apply. Reprocessing the identical event recomputes from the identical underlying evidence and produces the identical projection value.

**Proof**: `lib/projection/eventConsumerDuplicateDelivery.integration.test.ts` — seeds real evidence, processes the resulting event once, manually resets that same event back to unprocessed (simulating the exact redelivery window), processes again, asserts the projection `value` is byte-identical and exactly one `learner_evidence`/`learner_projections` row exists throughout.

**Status**: EXISTING (proven, not previously tested at this exact boundary).

---

## OPS-WA-001 — WhatsApp send failures are correctly classified and observable, never silently reported as sent

**Statement**: A WhatsApp send attempt against every realistic provider response (2xx, 4xx, 5xx, malformed body, thrown network error) must be classified correctly and, where the platform's own delivery record depends on it, logged — never silently treated as successful.

**Boundary**: `sendWhatsAppTemplate()` (`lib/whatsapp/client.ts`) for the transport contract; `notification_log` writes in `lib/whatsapp/sender.ts` for the delivery record.

**Proof — transport contract**: `lib/whatsapp/client.test.ts` (8 tests, fetch-mocked, zero network, zero secrets) — 2xx success; a 200 response carrying a Meta `error` object is correctly classified as failure (never a false "sent"); 400/401/429/500 all return `{success:false}`, never throw; missing credentials fail closed before any network attempt.

**Named finding, not fixed**: a thrown network error (fetch itself rejecting) is **not** caught inside `sendWhatsAppTemplate` — it propagates to the caller, unlike the DeepSeek AI wrapper's own internal try/catch (H2E). Every caller must handle this itself. Proven, not changed — a codebase-wide change to add internal retry/catch to this wrapper is a larger design decision than this phase's scope.

**Fix — failure logging**: `sendAssignmentMarkedWhatsApp`'s catch block (`lib/whatsapp/sender.ts`) previously returned `{success:false}` to its own caller but wrote **no** `notification_log` row at all for a thrown transport error — unlike a provider-reported 4xx/5xx failure, which was already logged correctly. Fixed for this one function (the highest-value parent-facing example named in the brief); `sendWelcomeMessage`/`notifyOwnerMilestone` have the same gap and remain unfixed (named, not swept — a mechanical multi-file fix is out of this phase's scope, matching the DEEP_MAIN cleanup precedent below).

**Proof**: `lib/whatsapp/senderFailureLogging.integration.test.ts` — a thrown network error during `sendAssignmentMarkedWhatsApp` now produces exactly one `notification_log` row with `success:false` and the real error message.

**Status**: PARTIAL → transport contract now EXISTING; failure-logging gap partially closed (1 of 3 affected functions), remainder named.

---

## OPS-PAY-* — Payment recovery (audited, not selected — already substantially protected)

**Fulfillment atomicity**: EXISTING. `fulfillPayment()` uses a single conditional `UPDATE ... WHERE status = 'pending'` — atomic at the DB level, proven under real concurrent dispatch by `lib/payments/fulfillment.test.ts`'s "two concurrent fulfillPayment calls... credit tokens exactly once."

**Stuck-pending recovery**: PARTIAL/leaning ABSENT, audited not fixed. If Paystack's verify call itself times out or throws, the `payments` row is never touched and stays `'pending'` indefinitely — no first-party reconciliation sweep exists; recovery depends entirely on Paystack's own webhook-retry behavior. Building a reconciliation cron is a new operational surface (`Do not add a new job system`) — named as a real gap for a future phase, not built here.

**Status**: not selected as one of H4A's six — the atomicity half is already proven, and the recovery half requires new infrastructure explicitly out of scope.

---

## OPS-ENV-001 — Production startup fails closed on a missing critical secret

**Statement**: A required critical operational secret/configuration being absent or structurally invalid must fail closed with a clear message, not proceed silently or crash with an opaque error deep inside a client constructor.

**Audit finding**: `lib/config/env.ts` (a well-formed Zod schema) existed but was **imported nowhere in the real app** — confirmed zero production startup path calls it. All real code paths rely on ad-hoc `process.env.X!` assertions (`utils/supabase/service.ts` has an explicit check with a clear message; `utils/supabase/server.ts` uses bare `!` with no check, which would throw an opaque runtime error deep inside `createServerClient` instead).

**Why NOT wired this phase**: the schema's own "required" set (`DEEPSEEK_AI_API_KEY` included) directly conflicts with Harness Foundation v1's own foundational guarantee — the STANDARD test tier runs with **zero** AI/Supabase/payment credentials by design (`docs/architecture/assurance-tiers.md`). Wiring this validator into any code path STANDARD tests could reach would break that guarantee. A future phase should reconcile the critical set (Supabase URL/key are plausibly always-critical; DeepSeek/Paystack are legitimately optional in some real environments) before wiring startup validation anywhere — not decided here.

**Fix**: refactored from a top-level import-time `throw` (untestable without process-spawning) into a pure `validateEnv()`/`validateEnvOrThrow()` function pair. Zero behavior change for any real caller, since there were none.

**Proof**: `lib/config/env.test.ts` (7 tests) — valid environment passes; missing critical secret fails closed with the field named; structurally invalid URL fails closed; optional Paystack keys being absent does not fail validation.

**Status**: was PARTIAL (built, unused, untestable) → validator itself now EXISTING and tested; **wiring into a real startup path remains a named, deliberate future decision, not done here.**

**No prod-vs-test target guard, the other direction**: `utils/supabase/test-service.ts` refuses if a TEST target resolves to the known production project — but no equivalent guard exists on the real runtime clients (`service.ts`/`server.ts`) preventing a production deploy from silently pointing at a staging/dev Supabase project. Confirmed as a genuine gap, not built here (same "no new architecture without an audited, minimal path" reasoning as OPS-ENV-001's wiring decision).

---

## OPS-TEST-001 — DEEP_MAIN cleanup residual (the harness's own known gap)

**Statement candidate**: the full DEEP_MAIN population must leave zero synthetic Auth users and school fixtures after a successful run.

**Root cause, found and confirmed this phase** (not merely re-cited): `db.auth.admin.deleteUser()` **never rejects** on a server-side/FK-blocked deletion — confirmed by reading `node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js`: it catches the API error internally and *resolves* with `{ data: { user: null }, error }`. Grepping every `deleteUser` call site across all 104 DEEP_MAIN files found **zero** that inspect the returned `.error` — every file uses either a bare `await db.auth.admin.deleteUser(id)` or a `try/catch`/`safely()` wrapper that can never fire, since the promise never rejects in the first place. Any single unresolved FK dependency per file (not only `notification_log` — the originally-suspected cause, confirmed present in only 2 of 104 files and therefore far too narrow to explain 614 leaked rows — but also plausibly `school_users`, `teachers`, `capability_history`, or any row a file forgot to track) silently turns "cleanup succeeded" into a permanent leak, invisible to the test's own passing green status. The reaper's fixture-naming pattern match was checked and ruled out as a contributing cause (no naming-convention drift found across 104 files).

**Fix (foundation, not the full remediation)**: `lib/testing/deleteAuthUserOrThrow.ts` — a drop-in replacement for the bare pattern that throws loudly instead of silently no-opping.

**Proof**: `lib/testing/deleteAuthUserOrThrow.integration.test.ts` — reproduces the exact silent-leak mechanism against a real local Supabase instance (a `notification_log` row blocking deletion, the bare pattern "succeeds" while the user still exists; the throwing helper surfaces the block immediately), then proves the helper succeeds once the real blocker is removed.

**Status (superseded by H4A-FIX, below)**: root cause was PROVEN in H4A; adoption at scale and its consequences are now resolved by OPS-TEST-002.

---

## OPS-TEST-002 — every synthetic Auth identity must be deleted or fail the run loudly (H4A-FIX)

**Statement**: every synthetic Auth identity created by a DEEP test must either be deleted successfully by that test, or cause the test run to fail visibly. A cleanup call that silently fails is worse than no cleanup call at all — it creates false assurance.

**What was done**: all 104 DEEP_MAIN files' `deleteUser` call sites (mechanically inventoried, then migrated) now route through the single canonical helper, `lib/testing/deleteAuthUserOrThrow.ts` — no domain-specific variants. The helper additionally deletes the `developer_profiles` row it knows every `createUser()` call unconditionally creates (a universal trigger side effect, not arbitrary state) before attempting `deleteUser`, then throws if the deletion still fails.

**Static guard**: `scripts/check-auth-cleanup-safety.mjs` greps all `*.test.ts` files for a raw, unchecked `.auth.admin.deleteUser(` call. **0 hits inside the 104 DEEP_MAIN files** (confirmed by cross-referencing guard output against `scripts/deep-main-tests.json`). 68 hits remain outside DEEP_MAIN's scope (other test tiers never touched by this phase) — tracked as known future work, not fixed here (out of this phase's scope lock).

**What throw-on-error exposed, and how each was fixed** (owning test's own cleanup sequence, never a global purge):

| Family | Cause | Fix |
|---|---|---|
| `notification_log` | invite/notification side effects of production functions under test | delete scoped by `user_id` before `deleteAuthUserOrThrow` |
| `platform_events` | `publishEvent()` calls during the workflow under test | delete scoped by `actor_id` before `deleteAuthUserOrThrow` |
| `ingestion_runs` | evidence-ingestion side effects (`startIngestionRun`) | delete scoped by `initiated_by` before `deleteAuthUserOrThrow` |
| `developer_profiles` | universal `on_auth_user_created` trigger | centralized once, inside the helper itself (not per-file) |

**What throw-on-error exposed that is NOT fixable within this phase's scope**: a structural, by-design immutability barrier — see `docs/architecture/assurance-tiers.md`'s DEEP_MAIN section for the full blocker ledger (`blueprint_snapshots`, `blueprint_action_items`, `learner_achievements`/`_projects`/`_leadership`/`_competitions`/`_innovations`/`_wellbeing_cases`/`_updates`, `portfolio_items`, `teacher_reflections`, `assignment_question_variants`, `learner_transfers`). These tables enforce permanent immutability via unconditional DB triggers (or, for `learner_transfers`, a plain `RESTRICT` FK preserving enrollment history) — 9+ ADRs' worth of deliberate product guarantees. Confirmed empirically: of 83 synthetic schools left after one fresh DEEP_MAIN run, only 9 could be deleted even by raw superuser SQL. Modifying these triggers is out of scope ("do NOT modify product behavior"); no bypass exists that isn't such a modification.

**Verdict**: OPS-TEST-002 as an *implementation* (single helper, throw-on-error, no silent leaks, static guard) is **PROVEN and adopted across all 104 DEEP_MAIN files**. OPS-TEST-002 as a *precondition for CI promotion* ("zero residual, two clean runs") is **NOT ACHIEVABLE** for roughly a third of DEEP_MAIN's files, permanently, by product design — not a bug, not unfinished work. DEEP_MAIN remains a manual/local-only tier; see assurance-tiers.md for the full reasoning and the two real paths forward (accept an explicit residue allowlist, or a future product-level archival/soft-delete mechanism), both deliberately left as policy decisions outside this phase.

---

## Run-ID vs self-cleanup (SAFE-006)

Evaluated, not implemented, reconfirmed in H4A-FIX. A `DEEP_RUN_ID` marker letting the reaper safely remove all rows from one run was considered against the now-fully-confirmed root cause: it would not fix anything, since (a) throw-on-error adoption already makes cleanup failure visible per-test, and (b) the remaining residue is permanent by product design, not an attribution-ambiguity problem a run ID could resolve. **Deferred, correctly**: no new evidence from this phase changes that conclusion.

---

## Summary

| ID | Status |
|---|---|
| OPS-CRON-001 | ABSENT → EXISTING (new test, 1 named finding: Vercel-header bypass) |
| OPS-CRON-002 | PARTIAL → 1 real gap fixed (quota-alerts), 2 named not fixed (parent-pulse, term-readiness) |
| OPS-EVT-001 | EXISTING (proven, not previously tested) |
| OPS-WA-001 | PARTIAL → transport contract EXISTING, 1 of 3 failure-logging gaps fixed |
| OPS-PAY-* | EXISTING (atomicity) / PARTIAL (recovery, not selected — needs new infra) |
| OPS-ENV-001 | PARTIAL → validator EXISTING and tested, wiring deliberately deferred |
| OPS-TEST-001 | PROVEN (superseded by OPS-TEST-002's resolution) |
| OPS-TEST-002 | PROVEN and adopted at scale — DEEP_MAIN's remaining residue is permanent-by-design, not a defect; CI promotion NOT READY, and will not become ready without a policy decision outside this phase's scope |

**H4A-FIX's real finding**: DEEP_MAIN's cleanup mechanism is now fully sound — every synthetic Auth identity either disappears or fails the run loudly, with one canonical helper and no silent leaks. But the phase's original target (zero residual, CI-promotable) was built on an assumption — that residue was purely a cleanup bug — that turned out to be only partially true. A large, deliberate slice of the product's own evidence-integrity design (immutable blueprint snapshots, decisions, published artifacts, and terminal-status learner records across 9+ ADRs) makes full self-cleaning structurally impossible for the tests that exercise it. Finding that boundary precisely, rather than either forcing a false "clean" result or endlessly chasing an unreachable target, is this phase's actual deliverable.
