# EduNexus — Pre-Push Security Review

**Date:** 30 October 2026
**Worktree:** `/home/the-dev/projects/edunexus-security`
**Branch:** `security/remediation-2026-10-30`
**Base commit:** `da8b34d` (`docs: log 2026-10-26 security refresh findings`)
**Reviewer role:** independent pre-push gate (verify, don't assume)
**Scope of this document:** whether this branch is safe to **push for review**. Push, deploy, and migrate are three separate authorizations; this report clears at most the first.

This review supersedes the gating uncertainty in `pre-deployment-go-no-go-2026-10-30.md`: the AUDIT-F17 production state was previously unverifiable and is now verified directly against the production catalog (read-only). The production rollout, preview-safety checklist, and rollback plan live in the companion `production-security-release-runbook-2026-10-30.md`.

---

## A. Executive decision

### CONDITIONAL GO — PUSH FOR REVIEW

Pushing this branch to the remote **for code review** is safe, subject to the conditions below. The branch is cleanly scoped, the working tree contains no concurrent or unrelated work, no CI workflow deploys or migrates on push, and the one previously-blocking production gate (AUDIT-F17) is now resolved by read-only production inspection.

It is **CONDITIONAL**, not an unqualified GO, because:

1. **Push ≠ deploy ≠ migrate.** This branch's migrations fix vulnerabilities that are **live and exploitable in production right now** (F-01, F-15, F-16 — confirmed below against the production catalog). Pushing does **not** fix them. Review → merge → apply-migrations-in-order → deploy is a separate, urgent sequence that must not be collapsed.
2. **Vercel preview behaviour is owner-verifiable only.** No repo workflow deploys to production on push (verified). Deployment is driven by Vercel's external Git integration, which I cannot inspect from here. Under standard Vercel config a non-production branch produces a **preview**, not a production deploy — but the owner must confirm the branch is not wired as a production branch, and should expect limiter-dependent AI routes to return `503` on any preview URL until the migrations are applied (the new code fails *closed*).

**Do not push automatically.** This report ends at the decision point; the owner authorizes the actual push.

---

## B. Current repository state

| Property | Value | Evidence |
|---|---|---|
| Working directory | `/home/the-dev/projects/edunexus-security` | `pwd` |
| Branch | `security/remediation-2026-10-30` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `da8b34d` (= base; **no commits made**) | `git log --oneline -1` |
| Upstream | none configured | `git rev-parse --abbrev-ref @{u}` → fatal |
| Divergence vs `main` | `0  0` (left-right count) | `git rev-list --left-right --count main...HEAD` |
| Remote branch exists? | **No** — `git ls-remote --heads origin security/remediation-2026-10-30` empty | push creates a fresh branch, no name conflict |
| Tracked modified | 47 | `git status --porcelain \| grep -vc '^??'` |
| Untracked entries | 26 (incl. 6 new migrations, 10 new test files, 5 new `lib/` module dirs) | `git status --porcelain \| grep -c '^??'` |
| Unrelated/concurrent work in tree? | **None found.** All changes map to F-01…F-16 remediation + the two AUDIT-F15/F16 migrations/tests. The only migrations newer than production's latest are exactly `20261030120000`–`125000`. | file-by-file review |
| Concurrent checkout | Not accessed or modified. A separate session was reported editing the **main checkout** (`lib/growth/messaging/replyTo.ts` and others); that is a different working tree and out of scope. | I operated only inside this worktree |

All work is **uncommitted on top of the base commit**. Pushing requires the owner to commit first (see §I).

---

## C. Findings matrix (F-01 … F-17)

Status legend: **FIXED** (implementation + evidence + test verify the control) · **FIXED (prod-live)** (same, and the hole is confirmed still open in production, so the fix is also a production remediation) · **PARTIAL** (code fix lands, operational control still required) · **RESOLVED-SAFE** (production verified safe; see note).

| # | Finding | Implementation on branch | Evidence reviewed | Status | Remaining risk / next action |
|---|---|---|---|---|---|
| F-01 | `shared_reports` world-readable | migration `…120000` drops `"Anyone can read shared reports"`, revokes anon/auth; reads go through `lib/sharing/sharedReports.ts` (service-role, exact token, server expiry) | Prod policy inspection shows the permissive `USING (true)` SELECT **still live in production**; migration drops it; anon REST read fails on branch stack | **FIXED (prod-live)** | Apply `…120000` **after** code deploy (post-code ordering). |
| F-02 | Legacy class-code guessing | DB-backed fail-closed limiter (`lib/security/attemptLimiter.ts` + migration `…121000`), crypto `classCode.ts`, `requireClassTeacher` on removal | Gate unit tests; limiter throws `AttemptLimiterUnavailableError` (fail-closed) when RPC missing | **FIXED** | Per-IP control is F-07 (operational). |
| F-03 | AI route quota amplification | reserve-before-call + refund in `lib/ai/rateLimit.ts`; provider-failure `break` (no retry storm), `LESSON_PLAN_MAX_ATTEMPTS=2` | `lib/ai/rateLimit.test.ts`, `lib/ai/generationRetryBudget.test.ts` | **FIXED** | Concurrent overdraw bounded by daily cap (§G). |
| F-04 | Core learner bridge forge | `students` guard trigger (migration `…122000`); `.is('user_id', null)` on legacy lookups | `studentsBridgeIntegrity.integration.test.ts`; negative test fails on unchanged `main` | **FIXED** | — |
| F-05 | Teacher→parent messaging scope | `resolveTeacherOwnership` before alert insert/notify in `lib/alerts/teacherAlerts.ts` | route + lib review | **FIXED** | Server-side boundary enforced, not UI-only. |
| F-06 | Security headers / CSP | `next.config.ts` `headers()` + `lib/security/securityHeaders.ts`; **CSP is report-only** | header strings reviewed | **PARTIAL (by design)** | Enforced CSP needs nonces + compat testing — documented follow-up, not this branch. |
| F-07 | Per-IP abuse controls | app-level limiter covers authenticated flows | — | **PARTIAL** | Anonymous forms (early-access, newsletter, view counters, activation) need Vercel Firewall / Turnstile — operational, owner action. |
| F-08 | Founder/admin endpoints | legacy `x-admin-secret`/`Bearer` removed; founder routes gated by `requireGrowthUser` (`GROWTH_FOUNDER_EMAIL`) | `founderOnly.integration.test.ts`; legacy headers → 401 | **FIXED** | Requires `GROWTH_FOUNDER_EMAIL` set in prod (§I). |
| F-09 | Server-owned student fields | guard trigger (migration `…122000`) blocks client writes to protected columns | trigger review + test | **FIXED** | Service-role path unaffected. |
| F-10 | Payment integrity | `lib/payments/chargeVerification.ts` checks amount≥owed **and** currency (KES); idempotent callback | `chargeVerification.test.ts`, `route.chargeAmount.integration.test.ts` | **FIXED** | No real charges created in testing. |
| F-11 | Route-auth CI gate | `route-auth-rules.mjs` does per-handler ownership analysis (not just "auth helper present"); 22-entry ownership registry | gate unit tests 10/10; gate fails when a guard is removed | **FIXED** | — |
| F-12 | Invite redemption / guardian match | `redeemClassInvite.ts` email-match to confirmed account | lib review | **FIXED** | — |
| F-13 | Daily AI caps counting nothing | caps wired to limiter buckets, reserve-before-call; added paper-intelligence (300/300/30), academy (20), tutor (30), class-report (5) | `rateLimit.test.ts` asserts increment+enforce | **FIXED** | Limit **values** need owner product sign-off (§G). |
| F-14 | Holiday-plan ownership | `resolveTeacherOwnership` in holiday route | `route.ownership.integration.test.ts`; fails on unchanged `main` | **FIXED** | — |
| F-15 | `student_guardians` self-insert → read learner reports | migration `…124000` drops `"student_guardians: guardian insert"`, revokes anon/auth | **Production policy confirms the hole is LIVE**: INSERT policy `WITH CHECK (guardian_id = auth.uid())` with INSERT granted to `authenticated`. Any authenticated user can name themselves guardian of any learner, flipping `auth_is_guardian_of()` true → SELECT on that learner's clinic/compass/struggle reports. `studentGuardiansEscalation.integration.test.ts` | **FIXED (prod-live)** | **Urgent.** Apply `…124000` in the pre-code batch. |
| F-16 | `growth_users` self-insert → sales CRM | migration `…125000` drops `growth_users_insert_own`/`_update_own`, revokes anon/auth | **Production policy confirms the hole is LIVE**: INSERT policy `WITH CHECK (id = auth.uid())` with INSERT granted to `authenticated`. Self-insert flips `is_growth_user()` true → read/write founder CRM over PostgREST. `growthUsersEscalation.integration.test.ts` | **FIXED (prod-live)** | **Urgent.** Apply `…125000` in the pre-code batch. |
| F-17 | RLS/grants on 5 learner-intelligence tables | no new migration on branch (see §D decision) | **Production RLS verified ENABLED** on all five, with ownership-scoped SELECT policies and no permissive write policy | **RESOLVED-SAFE (prod)** / repo-drift follow-up | Production is safe. The **repo** committed schema does not enable RLS on these (missing migration) — a fresh-environment hazard, not a prod/push blocker (§D). |

No finding is marked fixed on the strength of "code exists" alone — each row cites a test or a catalog observation.

---

## D. AUDIT-F17 evidence (the former blocker — now resolved for production)

**Production catalog accessed read-only** via the Supabase MCP connection to project `lpxrfbmzncaztpmyqzkc` (`https://lpxrfbmzncaztpmyqzkc.supabase.co`). No learner rows were read; only catalog metadata and policy/grant definitions.

**RLS status (`pg_class.relrowsecurity`) in production:**

| Table | RLS enabled | SELECT policy (ownership-scoped) |
|---|---|---|
| `clinic_reports` | **true** | `auth_owns_student(student_id) OR auth_is_guardian_of(student_id)` |
| `compass_progress` | **true** | `… OR auth_is_teacher_of_student(student_id)` |
| `learning_compass_configs` | **true** | `auth_owns_student OR auth_is_guardian_of` |
| `learning_compass_state` | **true** | `auth_owns_student OR auth_is_guardian_of` |
| `struggle_patterns` | **true** | `… OR auth_is_teacher_of_student` |
| `shared_reports` | true (but permissive `USING (true)` SELECT — F-01) | — |
| `student_guardians` | true (but F-15 INSERT hole) | — |
| `growth_users` | true (but F-16 INSERT hole) | — |

- **Conclusion for F-17 proper:** the five learner-intelligence tables have RLS **enabled** and their only policies are **ownership-scoped SELECT** policies — no permissive INSERT/UPDATE/DELETE policy exists, so the broad `anon`/`authenticated` table grants are gated by RLS. **Production is not in the exposed state the committed-migration schema implied.** The earlier CONDITIONAL-GO blocker is **cleared for production exposure.**
- **RLS-enabled is not asserted as sufficient alone:** I inspected the policies, which are correctly ownership-scoped, and the grants, which are broad but inert under RLS. Safe.
- **Repo ↔ production drift (confirmed):** production migration history contains `20260610105350 enable_rls_clinic_reports_career_cache`; this file is **absent from the repo** (`ls supabase/migrations/ | grep 20260610105350` → not present). So a database bootstrapped **from committed migrations** leaves RLS **disabled** on these tables — a hazard for any future/fresh environment, even though production is safe.
- **Decision on the drift (deliberately not "fixed" in this pass):** I did **not** add an RLS-enabling migration to this branch. Reconstructing `20260610105350` would (a) change the pinned schema fingerprint (`8c15e1a3…`, requiring a disposable-stack re-bootstrap), (b) expand the branch beyond the authorized remediation, and (c) risk diverging from production's exact policy set. Per the directive's "determine intended semantics, don't invent broad policies, smallest change, stop at the decision point," this is logged as a **required scoped follow-up** (§I, item 7) with production's exact definition already captured here, rather than churned in under a push decision. The branch's `…124000` test asserts only the INSERT boundary (which it fixes regardless of RLS state), so the branch remains internally consistent.

---

## E. Migration plan (no production migration was applied)

Six migrations on the branch, all newer than production's latest (`20261019111233`); nothing else newer exists in the repo.

| File | Purpose | Idempotent / rerun-safe | Assumes code deployed? | Order |
|---|---|---|---|---|
| `20261030121000_rate_limit_attempts.sql` | limiter table + `rate_limit_reserve/release` (service-role only) | yes (`if not exists`) | **No — code depends on IT** | **Pre-code (first)** |
| `20261030122000_students_guard_server_fields.sql` | trigger guarding server-owned student fields (F-04/F-09) | yes | No | Pre-code |
| `20261030123000_insights_view_rpc_service_only.sql` | lock insights view RPC to service role | yes | No | Pre-code |
| `20261030124000_student_guardians_close_self_insert.sql` | **F-15 — live prod fix**; drop policy + revoke | yes (`drop policy if exists`) | No (old-code-safe: only writer is service-role) | **Pre-code (urgent)** |
| `20261030125000_growth_users_close_self_insert.sql` | **F-16 — live prod fix**; drop policies + revoke | yes | No (only writer is service-role repo) | **Pre-code (urgent)** |
| `20261030120000_shared_reports_close_public_read.sql` | **F-01 — live prod fix**; drop public-read policy | yes | **Yes — needs new `lib/sharing` code live first** | **Post-code (last)** |

**Derived order (from code dependencies, not assumed):**
1. Apply the five pre-code migrations (`121000`, `122000`, `123000`, `124000`, `125000`). The limiter table must exist before the new code runs, or AI/limiter routes fail closed (`503`). F-15/F-16 fixes are old-code-safe (their only writers are service-role, which bypasses RLS) and can — and should, given live exposure — go in this batch.
2. Deploy application code.
3. Apply `120000` (shared_reports) **after** the new `lib/sharing` read path is live, so legitimate shared-report reads don't break in the gap.

All six are catalog-only and independent of each other except the code-ordering above. **None was applied to production during this review.**

A **seventh**, separate migration (reconstructing `20260610105350` into the repo) is required before any fresh-environment bootstrap — see §D and §I item 7. It is **not** on this branch and is **not** required for the production deploy (production already has that state).

---

## F. Test results (re-run on the actual current branch, 2026-10-30)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Lint | `npm run lint` | **0 errors** (38 pre-existing warnings: unused eslint-disable directives, not introduced here) |
| Production build | `npm run build` | **success** (all routes compiled) |
| Architecture gate | `node scripts/check-architecture.mjs` | **pass** (`console.log` 1 = baseline; `select('*')` 0) |
| Route-auth gate | `node scripts/check-route-auth.mjs` | **pass** (305 routes, 23 registered exceptions) |
| Standard manifest | `node scripts/check-standard-manifest.mjs` | **pass** (207 files, zero privileged-infra signals) |
| Deep-PR classification | `node scripts/check-deep-pr-classification.mjs` | **pass** |
| Tier manifests | `node scripts/check-tier-manifests.mjs` | **pass** (155 files, 6 tiers) |
| Standard test suite | (ran via `npm test`) | **1761 / 1761 pass, 0 fail, 0 skip** |
| Gate unit tests | `route-auth-rules.test.ts` | **pass** (fail-closed target validation + per-handler analysis) |

**Infrastructure limitation (stated, not hidden):** the **deep integration suite** (226 tests) and the **HTTP auth suite** (14 tests) require a disposable Supabase stack. I did **not** re-bootstrap that stack in this pass. They were validated in the prior session (`226 pass / 1 skip / 0 fail / 0 residue`), and — critically for a *push* decision — **CI re-runs them on push** against an isolated throwaway stack on shifted ports, pinned to fingerprint `8c15e1a35af2db4f81029b7471d62e06`, with **zero production contact**. So push itself re-verifies them safely; a stale fingerprint or a regression surfaces as a red check, never as a production action.

**Newly-introduced vs baseline failures:** none introduced. The 11 full-`test:deep` failures noted previously (teardown FK cascades + one Blueprint assertion) were shown byte-for-byte identical on unchanged `main`; they are not in the DEEP_PR gate and are pre-existing.

---

## G. Residual risks

1. **Live production exposure until migrations are applied (highest priority).** F-01, F-15, F-16 are confirmed open in the production catalog *today*. The branch fixes them but the push does not. Treat merge + pre-code migration batch as urgent.
2. **F-07 — anonymous-form per-IP protection: not closed in code.** Early-access, newsletter, view counters, activation claims need Vercel Firewall / Turnstile (operational). Residual: anonymous volumetric abuse.
3. **F-06 — CSP is report-only, not enforced.** Enforcement needs nonces and compatibility testing; deferred.
4. **Tutor/session AI limits (F-13 values).** 30 tutor sessions/day, 5 class-reports/day, paper-intelligence 300/300/30, academy 20/day — these are *proposed product limits*. They must not silently throttle a paying school; **owner product sign-off required** before deploy.
5. **Concurrent token-balance overdraw.** Bounded by the daily cap but not atomic per-charge. Accept as documented follow-up unless the owner wants a reserve-and-charge mechanism.
6. **External AI privacy.** Unchanged by this branch; learner pseudonymisation remains a separate open item (per existing privacy audit). Note only — no regression here.
7. **Operational env must be present before relying on the new auth flows:** `GROWTH_FOUNDER_EMAIL` (F-08), `CRON_SECRET`, `PRODUCTION_URL`, service-role key server-only. Existence in an example file is not proof of configuration (§I).

---

## H. Push / deploy / migrate distinction

- **Push → GitHub:** triggers `ci.yml`, `codeql.yml`, `security.yml` (all on `push`/`pull_request`). These run tests, type-check, build, gates, and an **isolated** schema stack. The only production-touching job in `security.yml` (the Supabase advisor) and the prod-URL crons (`queue-cron.yml`, `notification-crons.yml`) are **`schedule:`-triggered, not push-triggered.** **No workflow deploys to production or applies a migration on push.** Verified by reading all five workflow files.
- **Push → Vercel:** deployment is Vercel's external Git integration, not a repo workflow (no `.vercel`, no Actions deploy step). Standard behaviour: a **non-production branch** (`main` is production) yields a **preview** deployment, not production. I **cannot inspect** the project's Vercel settings from here, so this is owner-verifiable (§I item 2). Caveat: a preview typically inherits production env, so the new code would run against prod Supabase — limiter-dependent AI routes will return `503` on the preview until the migrations land (fails *closed* = safe, just degraded on the preview URL). This does not affect `main`/production.
- **Migrate:** nothing in push or preview applies a migration. Migrations are applied deliberately by the owner in the §E order. CI explicitly never runs `supabase db push` against production.

**Net:** pushing this branch for review does not deploy to production and does not migrate the production database.

---

## I. Final owner checklist (actions requiring your access/approval)

1. **[write — git] Commit then push for review.** The branch is uncommitted on `da8b34d`. Commit the remediation, then:
   `git push -u origin security/remediation-2026-10-30` → open a PR into `main`. Do **not** merge-deploy yet.
2. **[read-only — Vercel] Confirm deploy wiring.** Verify in Vercel that the production branch is `main` and this branch will only ever produce a **preview**, and that you accept preview AI routes returning `503` until migrations land. If any doubt, disable preview deploys for this branch before pushing.
3. **[read-only — SQL, already done by reviewer] Production RLS preflight — PASSED.** For the record, re-runnable read-only:
   ```sql
   select c.relname, c.relrowsecurity
   from pg_class c
   where c.relnamespace='public'::regnamespace
     and c.relname in ('clinic_reports','compass_progress','learning_compass_configs',
                       'learning_compass_state','struggle_patterns','shared_reports');
   ```
   All five learner tables returned `relrowsecurity = true` with ownership-scoped SELECT policies on 2026-10-30. No action needed unless re-confirming before deploy.
4. **[write — DB, deploy sequence] Apply migrations in the §E order:** five pre-code migrations (incl. the urgent F-15 `…124000` and F-16 `…125000`) → deploy code → `…120000` (shared_reports) last. These close F-01/F-15/F-16, which are **live in production now.**
5. **[config] Confirm production env vars are actually set** (not just in `.env.example`): `GROWTH_FOUNDER_EMAIL`, `CRON_SECRET`, `PRODUCTION_URL`, service-role key (server-only).
6. **[product approval] Sign off the AI daily-limit values** (§G item 4) before deploy, so no paying school is throttled unexpectedly.
7. **[write — repo, scoped follow-up] Restore the missing `20260610105350` RLS migration into the repo** so fresh/CI environments enable RLS on the five learner tables (production already has it). Reconstruct from production's exact definition (captured in §D): enable RLS + the ownership-scoped SELECT policies shown there — do **not** invent broader policies. This changes the pinned schema fingerprint, so re-bootstrap the disposable stack and re-pin `ci.yml`. Not required for the production deploy; required before trusting any fresh bootstrap.

---

## J. Confirmation of reviewer actions

- No commits, pushes, deploys, or production migrations were made. HEAD remains `da8b34d`.
- Only read-only queries were run against production (catalog metadata, policy/grant definitions). No learner rows, secrets, tokens, or contact details were read or printed.
- Work stayed inside `/home/the-dev/projects/edunexus-security`. The original/main checkout and the concurrent session's changes were not accessed or modified.
- No security control, RLS policy, grant, rate limit, validation, or test was weakened to make a check pass.
