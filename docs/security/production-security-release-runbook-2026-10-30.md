# EduNexus — Production Security Release Runbook

**Date:** 30 October 2026
**Worktree:** `/home/the-dev/projects/edunexus-security`
**Branch:** `security/remediation-2026-10-30`
**Base commit:** `da8b34d`
**Production project:** `lpxrfbmzncaztpmyqzkc` (`www.edunexus.co.ke`)
**Companion:** `docs/security/pre-push-security-review-2026-10-30.md` (branch verification)

> **Status: PREPARED, NOT EXECUTED.** Nothing in this runbook has been run against production. No commit, push, PR, deploy, or migration has been performed. Every step below requires explicit owner authorization at the gates marked ⛔.

---

## 1. Executive summary

Three access-control vulnerabilities are **confirmed live in the production database today** by read-only catalog inspection (2026-10-30):

- **F-01** — `shared_reports` is world-readable (`"Anyone can read shared reports" USING (true)`) and world-insertable by any signed-in user.
- **F-15** — any authenticated user can insert a `student_guardians` row naming themselves guardian of any learner, unlocking that learner's clinic/compass/struggle reports.
- **F-16** — any authenticated user can insert a `growth_users` row for themselves, flipping `is_growth_user()` true and exposing the founder sales CRM.

The remediation branch closes all three (plus F-02…F-14) and is fully verified locally (§8). **The branch does not change production until migrations are applied and code is deployed, in the order below.** A branch push publishes code for review only; it is not a fix.

A fourth item — **F-17 repo/production drift** — is a fresh-database hazard, not a production exposure (production RLS is already correct). It is kept **out of this urgent release** and handled as a separate scoped follow-up (§6).

The release is **low-risk and backward-compatible** when sequenced as specified: five migrations are old-code-safe and apply before the deploy; one (`shared_reports`) applies after the deploy.

---

## 2. The three live vulnerabilities and their fixes

| # | Live production state (verified read-only) | Fix (migration) | Deploy position | Old-code safe? |
|---|---|---|---|---|
| **F-01** | `shared_reports`: SELECT policy `USING (true)` (role `public`) + INSERT `WITH CHECK (auth.uid()=user_id)`; anon has table grants. Any browser anon key reads every report's `student_name`, `grade`, `student_id`, `user_id`, `report_data`; any signed-in user mints reports at `/shared/<token>`. | `20261030120000_shared_reports_close_public_read.sql` — drops both policies, `revoke all … from anon`. Reads move to `lib/sharing/sharedReports.ts::getSharedReportByToken` (service-role, exact token, 5 columns, server-side expiry). | **AFTER code** | No — needs new read path live first (else `/shared/*` links 404 in the gap; a temporary outage, never an exposure). |
| **F-15** | `student_guardians`: INSERT policy `WITH CHECK (guardian_id = auth.uid())` (role `public`) + INSERT granted to `authenticated`. Self-insert → `auth_is_guardian_of(victim)` true → SELECT on `clinic_reports`, `compass_progress`, `learning_compass_configs/state`, `struggle_patterns` for that victim. | `20261030124000_student_guardians_close_self_insert.sql` — drops `"student_guardians: guardian insert"`, `revoke insert,update,delete … from anon, authenticated`. | **BEFORE code** | Yes — only writer is service-role (bypasses RLS). |
| **F-16** | `growth_users`: INSERT policy `WITH CHECK (id = auth.uid())` + UPDATE `USING (id=auth.uid())` + INSERT granted to `authenticated`. Self-insert → `is_growth_user()` true → read/write `growth_schools`, `growth_contacts`, `growth_activities`, … over PostgREST. | `20261030125000_growth_users_close_self_insert.sql` — drops `growth_users_insert_own` + `growth_users_update_own`, `revoke insert,update,delete … from anon, authenticated`. Keeps `growth_users_select_own` (own row only). | **BEFORE code** | Yes — only writer is `growthUser.repository.ts` on service-role. |

**Independent review of each fix (Phase D):**

- **F-01** — reviewed policy drops + `revoke`; confirmed defence-in-depth (no SELECT/INSERT/UPDATE policy remains → RLS denies anon *and* authenticated regardless of grants). Legitimate path preserved: `share/generate` authenticates with `createClient()` then inserts via `createServiceClient()`; public page reads via `getSharedReportByToken`. Tests: `lib/sharing/sharedReports.test.ts` (unit), `lib/sharing/sharedReportsRls.test.ts` (RLS boundary). Note: `"Users can delete their own shared reports"` is intentionally left but **inert** post-migration (a DELETE needs a passing SELECT policy); documented, not a regression.
- **F-15** — reviewed `drop policy if exists` + `revoke`. Service-role management preserved. Test `lib/core/studentGuardiansEscalation.integration.test.ts` asserts the **INSERT boundary** (the control F-15 owns) *and* that service-role writes still work. The test documents that the end-to-end read-block additionally depends on RLS being enabled on the five report tables — which production has (§6) but the committed repo schema does not.
- **F-16** — reviewed drops + `revoke`; `growth_users_select_own` retained (no cross-tenant read). Test `lib/growth/growthUsersEscalation.integration.test.ts`: self-insert denied, CRM not readable without the row, service-role bootstrap still works.

All three negative assertions were previously shown to **fail on unchanged `main`** and pass on the branch — they prove the block, not merely the presence of a helper.

---

## 3. Verified vs unverified

**Verified (evidence in hand):**
- Production RLS/policy/grant state for all eight tables (read-only `pg_class`, `pg_policies`, `information_schema.role_table_grants`, 2026-10-30).
- The three vulnerabilities are live in production.
- All six branch migrations' full SQL, idempotency, and rollback.
- Local quality gates (§8) on the actual branch HEAD.
- No workflow deploys/migrates on push; remote branch absent; branch cleanly scoped.

**Unverified (owner must confirm):**
- Vercel preview environment isolation and env wiring (§4, §5) — not inspectable from the repo.
- Production env vars actually set (`GROWTH_FOUNDER_EMAIL`, `CRON_SECRET`, `PRODUCTION_URL`, service-role key) — presence in `.env.example` is not proof.
- Product sign-off on the AI daily-limit **values** (F-13).
- Deep-PR (226) + HTTP (14) suites were **not** re-bootstrapped locally this pass; CI re-runs them on push against an isolated stack.

---

## 4. Preview-environment / publication owner checklist

Publishing for review (not executed here):

```
git push -u origin security/remediation-2026-10-30
```

Pre-flight facts (verified from the repo):
- Remote `origin` = `https://github.com/jashor254/edunexus-cbe-analyzer.git` (intended repo).
- Remote branch `security/remediation-2026-10-30` is **absent** → push creates it, no overwrite, **no `--force` needed**.
- **A commit must be created first** (branch is uncommitted on `da8b34d`); the push does not create it implicitly. ⛔ owner-authorized.
- Push triggers `ci.yml`, `codeql.yml`, `security.yml` (test/type/build/gates + isolated schema stack). No workflow deploys or migrates on push; prod-URL crons are `schedule:`-only.

Owner must confirm in the Vercel dashboard (not inspectable here):
1. Production branch is `main`; this branch yields a **preview only**, never production.
2. Whether to disable preview deploys for this branch during review.

---

## 5. Preview-environment safety checklist (owner-verified in Vercel)

| Check | Why it matters | Expected safe answer |
|---|---|---|
| Does the preview use **isolated** Supabase credentials? | A preview on prod Supabase reads/writes real learner data. | Isolated project, or accept prod-data exposure risk and restrict preview access. |
| Can preview routes reach **production learner records**? | Preview typically inherits prod env. | Confirm, or scope env per-environment. |
| Is the **service-role key** present in preview env? | It bypasses RLS. | Present only if preview is trusted/access-restricted. |
| Can preview AI requests incur **real provider cost**? | DeepSeek/Gemini keys in preview = real spend. | Use test keys or accept/limit. |
| Are auth **redirect/callback URLs** configured for the preview domain? | Broken or permissive callbacks. | Preview domain allow-listed, no open redirect. |
| Can a preview deploy **alter production data**? | Writes from preview. | No, under isolated env; otherwise restrict. |
| Do missing DB prerequisites **fail closed**? | `rate_limit_attempts` absent in prod until migration. | **Yes — limiter-dependent AI routes return `503`** (fail closed), a controlled degradation, not an outage of the whole app or an info leak. Confirm `503` carries no internal detail. |

If the preview environment cannot be verified, **do not treat a push as safe to leave running**; restrict preview access or disable it until confirmed.

---

## 6. Migration-history reconciliation (F-17 — separate follow-up)

- Production migration history contains `20260610105350 enable_rls_clinic_reports_career_cache`; this file is **absent from the repo**.
- Production catalog (verified): the five learner-intelligence tables have **RLS enabled** with ownership-scoped SELECT policies (`auth_owns_student OR auth_is_guardian_of [OR auth_is_teacher_of]`) and no permissive write policy. **Production is safe.**
- A fresh database bootstrapped from committed migrations would leave RLS **disabled** on these five → a future-environment hazard.
- No existing repo migration provides equivalent behaviour under another filename (grep over `supabase/migrations/` confirms none enables RLS on these tables except the new `…124000`, which only touches `student_guardians`).
- Restoring the migration **would change the pinned schema fingerprint** (`8c15e1a35af2db4f81029b7471d62e06`), requiring a disposable-stack re-bootstrap and a `ci.yml` re-pin.

**Recommendation:** handle as a **separate, narrowly scoped follow-up migration** (e.g. `202611xx_restore_rls_clinic_reports_career_cache.sql`) that reproduces production's exact RLS-enable + ownership SELECT policies for the five tables — reconstructed from the production definition captured in the pre-push review §D, **not** invented broader policies. Keep it **out of this urgent access-control release** (no release dependency: production already has this state). Fresh-database security is **not** considered solved until that migration is added, the fingerprint re-pinned, and the escalation integration test extended to assert the read-block (currently it asserts only the INSERT boundary).

---

## 7. Production rollout runbook

### 7.1 Before release ⛔

1. PR reviewed and approved into `main`. Reviewer reads all six `20261030*` migrations.
2. Confirm a recent production **DB backup / PITR** point exists.
3. Run the read-only **preflight** (all read-only):
   ```sql
   -- (a) current policy state (expect the vulnerable policies still present pre-release)
   select tablename, policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname='public'
     and tablename in ('shared_reports','student_guardians','growth_users');

   -- (b) RLS on the five learner tables must be TRUE (production safety invariant)
   select relname, relrowsecurity from pg_class
   where relnamespace='public'::regnamespace
     and relname in ('clinic_reports','compass_progress','learning_compass_configs',
                     'learning_compass_state','struggle_patterns');

   -- (c) any already-planted bridge rows (F-04 forensic; expect 0)
   select id, external_id, added_by, user_id, teacher_id
   from public.students
   where user_id is not null and external_id is not null;
   ```
4. Confirm env vars set in production: `GROWTH_FOUNDER_EMAIL`, `CRON_SECRET`, `PRODUCTION_URL`, service-role key (server-only).
5. Product sign-off on AI daily-limit values (F-13).

### 7.2 During release — verified order ⛔

Derived from actual migration contents and code dependencies (not copied blindly):

1. **Pre-code migration batch** (apply together; all old-code-safe, catalog-only, idempotent):
   - `20261030121000_rate_limit_attempts.sql` — **must precede the code** (code fails closed without the table/RPCs).
   - `20261030122000_students_guard_server_fields.sql`
   - `20261030123000_insights_view_rpc_service_only.sql`
   - `20261030124000_student_guardians_close_self_insert.sql` — **closes F-15 immediately.**
   - `20261030125000_growth_users_close_self_insert.sql` — **closes F-16 immediately.**
2. **Deploy application code** (the new `lib/sharing`, `lib/security/attemptLimiter`, rate-limit wiring, route guards).
3. **Post-code migration**:
   - `20261030120000_shared_reports_close_public_read.sql` — **closes F-01** *after* the `getSharedReportByToken` read path is live, so legitimate `/shared/*` links keep working across the window.

Backward compatibility: steps 1 are safe under the *currently running* old code (their only writers are service-role). The only ordering hazard is applying `120000` before the code — which would 404 shared links until deploy (outage, not exposure). There is **no interval** in which F-15/F-16 remain open after step 1, nor in which F-01 reopens.

Failure handling: each migration is idempotent (`if (not) exists` / `drop … if exists` / `to_regprocedure` guard). If any migration errors, **halt**; the batch is independent so a partial apply is safe to re-run. Do not proceed to deploy until the pre-code batch is fully applied.

### 7.3 After release — verification (read-only + isolated negatives)

1. `shared_reports` policy list shows **no** `USING (true)` SELECT and **no** public INSERT; anon REST read of `/rest/v1/shared_reports` returns `[]`/`401`.
2. A legitimate `/shared/<token>` link renders via `getSharedReportByToken`.
3. `student_guardians` has no `guardian insert` policy; a signed-in self-insert is denied (`42501`). Legitimate guardian onboarding (service-role path) works.
4. `growth_users` self-insert denied; founder `requireGrowthUser` bootstrap works; CRM reads scoped.
5. Limiter-dependent AI routes return normal responses (no `503`) now that `rate_limit_attempts` exists.
6. Re-run preflight (b): the five tables still `relrowsecurity=true`.
7. Watch error rates and AI provider spend for anomalies.

Prefer read-only catalog checks and isolated negative tests. **Do not perform production writes solely to prove a denied operation is denied** — use a disposable stack for destructive negatives.

---

## 8. Final quality gates (re-run on the actual branch, 2026-10-30)

| Check | Command | Result | Where |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | **0 errors** | local, this pass |
| Lint | `npm run lint` | **0 errors** (38 pre-existing warnings) | local, this pass |
| Build | `npm run build` | **success** | local, this pass |
| Standard suite | `npm test` | **1761/1761 pass, 0 fail** | local, this pass |
| Architecture gate | `node scripts/check-architecture.mjs` | pass | local, this pass |
| Route-auth gate | `node scripts/check-route-auth.mjs` | pass (305 routes, 23 exceptions) | local, this pass |
| Standard manifest | `node scripts/check-standard-manifest.mjs` | pass (207 files) | local, this pass |
| Deep-PR classification | `node scripts/check-deep-pr-classification.mjs` | pass | local, this pass |
| Tier manifests | `node scripts/check-tier-manifests.mjs` | pass (155 files) | local, this pass |
| Gate unit tests | `route-auth-rules.test.ts` | pass | local, this pass |
| **Deep-PR (226)** | `run-deep-pr.mjs` | **not run this pass** — needs disposable stack | **CI on push** (isolated, fingerprint-pinned, no prod contact) |
| **HTTP auth (14)** | `run-http-pr.mjs` | **not run this pass** — needs disposable stack | **CI on push** |

Newly introduced failures: **none.** The 11 full-`test:deep` failures (teardown FK + one Blueprint assertion) are confirmed pre-existing (identical on unchanged `main`) and are not in the DEEP_PR gate. No security test was weakened.

---

## 9. Rollback & incident response

**Distinct rollback layers:**
- **Application rollback** — redeploy the previous build. Safe at any time. Note: after `120000`, the *old* code's user-scoped `/shared/*` read returns 404 (the policy it relied on is gone) — so if rolling back code, either also keep the new read path or accept shared-link outage. **Do not** recreate the F-01 policies to make old code work (that re-exposes every report).
- **Database-policy rollback** — each migration header carries verbatim rollback SQL. **Rolling back `120000`/`124000`/`125000` re-opens the vulnerability** and must not be done for convenience. Only roll back if a policy is proven to break a *legitimate* workflow, and then pair it with a corrected forward fix.
- **Migration rollback** — `121000` (drop table + two functions) and `122000`/`123000` (drop trigger/function, re-grant) are reversible per their headers. No migration here is intentionally irreversible.
- **Credential rotation** — not required by this release. Only if a service-role key or anon key is suspected leaked.

**If unauthorized access is suspected (F-01/F-15/F-16 were live pre-release):**
1. Preserve evidence first — export Supabase/PostgREST request logs before changing anything.
2. Apply the closing migrations (they restrict without destroying forensic data).
3. Assess scope read-only: for F-15, `select * from student_guardians where guardian_id not in (…known-legitimate…)`; for F-16, `select * from growth_users` (expect only the founder); for F-01, review access logs to `/rest/v1/shared_reports` and `/shared/*`.
4. Determine whether learner reports or CRM rows may have been accessed; follow the owner's incident-response and any applicable notification obligations.
5. **A vulnerability existing is not proof it was exploited** — state findings factually.

---

## 10. Outstanding operational controls & residual risks

- **F-07** — anonymous-form per-IP limiting (early-access, newsletter, view counters, activation) needs Vercel Firewall / Turnstile. App-level limiter does not cover unauthenticated volumetric abuse.
- **F-06** — CSP is **report-only**, not enforced; enforcement needs nonces + compat testing (deferred).
- **Token-overdraw under concurrency** — bounded by the daily cap; not atomic per-charge. Follow-up only if owner wants reserve-and-charge.
- **External AI privacy** — unchanged by this branch; pseudonymisation of insha/tutor text remains a separate open item.
- **F-17 fresh-DB drift** — §6 follow-up migration required before trusting any fresh bootstrap.

---

## 11. Explicit approval gates ⛔

The reviewer stops here. Each of the following requires the owner's explicit authorization, separately:

1. **Commit** the remediation on the branch.
2. **Push** `security/remediation-2026-10-30` and open the PR (review only).
3. **Confirm** Vercel preview isolation (§5) or disable preview for the branch.
4. **Merge** the PR into `main`.
5. **Apply** the pre-code migration batch (§7.2 step 1).
6. **Deploy** the application code (§7.2 step 2).
7. **Apply** the post-code `shared_reports` migration (§7.2 step 3).
8. **Add** the separate F-17 reconciliation migration (§6) — not part of this release.

No step above has been executed. HEAD remains `da8b34d`; no commit, push, deploy, or production migration was performed; only read-only production catalog queries were run.
