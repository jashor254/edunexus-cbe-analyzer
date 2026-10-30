# EduNexus — Pre-Deployment GO / NO-GO (Independent Audit)

**Date:** 2026-10-30
**Scope:** Independent verification of the security remediation on branch
`security/remediation-2026-10-30`, migration safety, regression audit, and
production-readiness. No production changes, commits, or pushes were made.

---

## A. Executive decision

### CONDITIONAL GO

The remediation of F-01–F-14 is real, independently reproduced, and sound: I
confirmed the key fixes by raw REST probes with the public anon key and real
signed-in sessions (not the project's own test helpers), by rolled-back SQL
probes, and by re-running the full deep-PR suite on a freshly bootstrapped
disposable database. Two new **pre-existing** privilege escalations found
while auditing (AUDIT-F15, AUDIT-F16) were fixed here with tests. The code is
internally consistent and builds.

Deployment may proceed **only after every condition below is met**:

1. **(Blocker — AUDIT-F17) Production read-only preflight must confirm RLS is
   ENABLED, and anon SELECT revoked, on `clinic_reports`, `compass_progress`,
   `learning_compass_configs`, `learning_compass_state`, `struggle_patterns`.**
   On the committed-migration schema these tables have **RLS disabled** with
   `anon`+`authenticated` SELECT granted — i.e. any key-holder could read
   every learner's clinic/compass data. Production is *believed* to enable
   RLS via a prod-only migration (`20260610105350…`) that is **not in the
   repo**, but I cannot verify production. **If production has RLS off on
   these tables, this is NO-GO** until fixed. See §C-F17 and §I.
2. Migrations are applied in the validated order (§F), limiter **before** code.
3. `GROWTH_FOUNDER_EMAIL` is set in the production environment before/with the
   deploy (else all founder endpoints 403 — fail-closed, but the dashboard
   stops working).
4. The owner decisions in §J are confirmed (AI quota values, the parent-invite
   behaviour change, the bounded token-overdraw residual).
5. The repo's missing RLS migration is reconciled (§F / §I) — committed, or
   explicitly accepted as production-managed.
6. Post-deploy header and anon-read checks pass (§I).

This headline does not overstate confidence: the single largest learner-data
question (F-17) is **unverified against production** and gates GO.

---

## B. Repository integrity

| Item | Value |
|---|---|
| Worktree | `/home/the-dev/projects/edunexus-security` (separate git worktree) |
| Branch | `security/remediation-2026-10-30` |
| HEAD / base | `da8b34d` (uncommitted working tree); base = `main` `da8b34d` |
| Staged | 0 |
| Original checkout | `/home/the-dev/projects/edunexus` on `feat/growth-reply-loop` `00f5dd8`, its `replyTo.ts` edit **untouched** |

The remediation exists entirely as uncommitted changes (47 modified + new
files). I snapshotted the pre-audit diff and untracked-file hashes before
starting. **No destructive git ran; no commits; the original checkout was
never modified.**

**Changes this audit added (security worktree only):**
- `supabase/migrations/20261030124000_student_guardians_close_self_insert.sql` (AUDIT-F15)
- `supabase/migrations/20261030125000_growth_users_close_self_insert.sql` (AUDIT-F16)
- `lib/core/studentGuardiansEscalation.integration.test.ts`
- `lib/growth/growthUsersEscalation.integration.test.ts`
- manifest/CI registrations for the two tests; schema-fingerprint pin update
- removed one inert, all-comment stray migration draft
  (`…124000_close_privilege_self_insert.sql`) left by an interrupted step.

---

## C. Finding-by-finding verification

Legend: **Verified** / **Partially verified** / **Blocked**. "Raw REST" =
PostgREST called directly with the public anon key or a real signed-in token,
independent of project test code.

### F-01 Shared-report confidentiality — **Verified** (production: **pending**)
- Fix: `lib/sharing/sharedReports.ts` (service-role, exact `.eq('token')`,
  5 rendered columns, server-side expiry), `app/shared/[token]/page.tsx`,
  migration `…120000`.
- Raw REST (anon): read → `42501 permission denied`; forged insert →
  `42501`. DB: `shared_reports` RLS=on, `anon` SELECT/INSERT revoked. Raw REST
  (authenticated non-owner): list → `[]`. Deep RLS test 7/7.
- Residual: owner-delete policy is now inert (no reader) — harmless. Token
  shape regex is permissive by design; security is the exact token match.
- Production: policy/row state not inspected — **pending §I**.

### F-02 Class codes / join abuse / removal — **Verified**
- crypto codes (`lib/classes/classCode.ts`, 8 chars over 32-symbol alphabet);
  atomic DB limiter (`…121000` + `rate_limit_reserve`); fail-closed;
  service-role-only; removal route + `removeClassMember` (Core-bridged
  refused); `classResources/resourceAccess.ts`.
- Evidence: limiter integration test (25 concurrent → exactly 10),
  enrolment/invite integration suites pass on fresh DB; per-**account** (not
  per-IP) — correctly described. Access matrix §D.

### F-03 / F-13 AI spending & dead counters — **Verified**
- Limits in code match the report exactly (§E). Reservation is taken before
  the provider call; fail-closed; refund on fallback/empty; retry bounded to
  one wrapper call (was 3/5); insha, class-reports and all three
  paper-intelligence routes now covered. `learn` counts **new sessions**
  (`if (!sessionId)`), confirmed.
- Evidence: `route.quota.integration` (30 concurrent → exactly 20 provider
  calls; oversized input → 0 calls; fallback refunded); `rateLimit.test`;
  `generationRetryBudget.test` (fails on old code). Inventory §E.

### F-04 / F-09 Student bridge integrity — **Verified**
- Trigger `fn_guard_students_server_fields` (`…122000`); bridge lookups add
  `user_id IS NULL`.
- Raw REST (authenticated): insert with `external_id`+`added_by=teacher` →
  `42501 "bridge, ownership and computed fields are set server-side only"`;
  a plain own-student insert succeeds. Deep test 10/10.

### F-05 / F-12 Parent alerts & invite ownership — **Verified**
- `createTeacherAlert` runs `resolveTeacherOwnership` and returns `forbidden`
  **before** any insert or `notifyAlertCreated` (source lines 49–50 precede
  55/69). Invite redemption matches teacher-recorded parent email to the
  **confirmed** account email, case-insensitive, literal (no wildcard).
- Evidence: `teacherAlertsOwnership`, `classInvite` integration suites pass.

### F-06 Security headers / CSP — **Verified (local)**; production **pending**
- `next.config.ts` → `buildSecurityHeaders`; `securityHeaders.test` (6/6);
  local production build emitted the headers on page/login/API/404 in the
  prior session. CSP is **report-only** (enforcement needs nonces). Live
  production headers to be re-checked post-deploy (§I).

### F-07 Distributed rate limiting — **Partially verified (as reported)**
- Per-account DB limiter covers class join, invites, all AI routes. **No
  per-IP limit on anonymous forms** (early-access, newsletter, view counter,
  learner-claim). Needs Vercel Firewall / Turnstile (§I, §J).

### F-08 Founder-only endpoints — **Verified**
- `admin/init`, `admin/trigger-cleanup`, `admin/cleanup-stats`,
  `GET /api/feedback` now use `requireGrowthUser`. Raw handler tests: no
  session + legacy `Bearer`/`x-admin-secret` headers → 401; non-founder →
  403; founder admitted. `ADMIN_CONFIG.adminSecret` removed; no code reads
  `ADMIN_SECRET`. Fail-closed when `GROWTH_FOUNDER_EMAIL` unset.

### F-10 Payment verification — **Verified**
- `chargeCoversPayment` (KES + amount≥owed) in callback **and** verify, before
  `fulfillPayment`; the failure path uses `.neq('status','success')` so a late
  mismatched event cannot reverse a completed payment.
- Evidence: `route.chargeAmount.integration` on a fresh DB with the Paystack
  verify call mocked — underpaid/wrong-currency never fulfils; duplicate
  deliveries credit once; it **fails on old code**. `chargeVerification.test` 6/6.

### F-11 CI route-ownership & tripwire — **Verified**
- Per-handler analysis (a guarded sibling no longer covers an unguarded
  handler); `unregistered-shared-secret` rule; `learner-ownership-unreviewed`
  rule + `route-ownership-registry.json` (22 reviewed entries). Gate unit
  tests 36/36. Re-run against unchanged `main`, the gate flags F-05, F-08,
  F-12 and F-14 — i.e. it detects the real defect class, not just guard
  presence.
- Limitation (honest): the standard-manifest secret tripwire is a string
  grep; an aliased/re-exported service client import could evade it. It is a
  CI hygiene guard, not a runtime control.

### F-14 Single-learner holiday plan ownership — **Verified**
- `resolveTeacherOwnership` before `generateHolidayPlan`; `apiForbidden`
  otherwise. `route.ownership.integration` passes and **fails on old code**.

### AUDIT-F15 (NEW, pre-existing) `student_guardians` self-insert — **Fixed & Verified**
- Any signed-in user could `insert into student_guardians (student_id,
  guardian_id=self)`; `auth_is_guardian_of` then true, gating SELECT on six
  report tables. Rolled-back probe confirmed the insert + flip. No app code
  reads/writes `student_guardians` or calls `auth_is_guardian_of` (the live
  model is `learner_guardians`). Fix `…124000` drops the insert policy +
  revokes; raw REST now `42501`; service role unaffected. Test added.
- **Note:** end-to-end report exposure via this path also depends on
  AUDIT-F17 (RLS actually enforced on those report tables).

### AUDIT-F16 (NEW, pre-existing) `growth_users` self-insert → CRM — **Fixed & Verified**
- Any signed-in user could `insert into growth_users (id=self)`, flipping
  `is_growth_user()` true — the sole RLS predicate on every `growth_*` table
  (`growth_schools_all = is_growth_user()`), which grant SELECT/ALL to
  `authenticated`. That grants read/write of the founder's sales CRM over
  PostgREST, bypassing `requireGrowthUser`/`GROWTH_FOUNDER_EMAIL`. Only writer
  of `growth_users` is the service-role repository, so the fix (`…125000`,
  drop insert/update policy + revoke) leaves founder bootstrap intact. Raw
  REST now `42501`; service-role insert still works. Test added.

### AUDIT-F17 (NEW, pre-existing) RLS disabled on report tables — **Blocked**
- On the committed-migration schema, `clinic_reports`, `compass_progress`,
  `learning_compass_configs`, `learning_compass_state`, `struggle_patterns`
  have **`relrowsecurity = false`** with `anon`+`authenticated` SELECT
  granted. `academic_reports` has RLS on. The RLS-enabling migration
  `20260610105350_enable_rls_clinic_reports_career_cache` appears in
  **production's** migration history (first-pass audit) but is **absent from
  `supabase/migrations/`** — a repo/production reconciliation gap.
- Impact if present in production: direct REST read of every learner's clinic
  and compass data — a learner-data exposure on the scale of F-01. **Cannot be
  confirmed or refuted without read-only production access** → this is the
  gating condition in §A. I did **not** add an enable-RLS migration blindly:
  if production already enforces RLS with its own policies, a repo migration
  must be reconciled against them, not guessed.

---

## D. Class-resource access matrix (F-02)

Server-side enforcement, from source + integration tests. "Member" = current
`class_students` row.

| Resource (route) | Anonymous | Unrelated learner | Class member | Owning teacher | Non-owning teacher |
|---|---|---|---|---|---|
| Join by code (`student/join-class`) | Denied (401) | n/a (creates membership, capped 10/h, crypto codes) | — | — | — |
| Materials / resources / announcements / calendar / assignments (`student/*`) | Denied | Denied (not member) | Allowed | Allowed (own class) | Denied |
| Resource signed URL (`resources/[id]/file-url`) | Denied | Denied | Allowed | Allowed (owner) | Denied |
| Remove member (`DELETE classes/[classId]/students/[id]`) | Denied | Denied | n/a | Allowed (own, non-Core) | Denied (403) |
| After removal: new signed URL / materials | — | — | **Denied** (verified) | — | — |

Residual: a previously-issued signed URL stays valid until its short TTL
(5 min) — documented, not revocable early. Possession of a broadcast class
code still permits joining (product decision, §J), now rate-limited.

---

## E. AI-call & quota inventory

Provider call sites (grep-verified): the shared wrappers `lib/ai/deepseek.ts`
(`callDeepSeek`/`streamDeepSeek`, with internal single-retry + Gemini
fallback) and `lib/ai/gemini.ts`; the router `lib/ai-orchestration/router.ts`
(→ `callDeepSeek`); and **direct `@google/generative-ai` SDK** calls in
`lib/paperIntelligence/{vision,scriptMarking,schemeExtraction}.ts` (bypass
`lib/ai/`, but all three routes now carry daily caps).

| Feature / route | Provider | Calls/op | Daily limit (code) | Reserve timing | Refund | 
|---|---|---|---|---|---|
| sow_generate | DeepSeek | ≤5 (bounded) | 10 | before | partial |
| lesson_plan_generate / generate-week | DeepSeek | ≤2 each lesson | 20 | before | — |
| learning_compass (`learn`) | DeepSeek | 1/msg | 30 **new sessions** | on new session | n/a |
| career_intelligence_report | DeepSeek | 1 | 2 | before | — |
| holiday_plan (single + class) | DeepSeek | 1/learner | 30 | before | on 0-generated |
| class_reports_generate | DeepSeek | 1/learner | 5 | before | on 0/fail |
| kiswahili_insha_pack | DeepSeek | 1 | 60 | before | on fallback |
| teaching_quick_check | DeepSeek | 1 | 30 | before | on fail |
| adaptive_variant_generate (×3 routes) | router→DeepSeek | 1–N | 40 | before | — |
| academy_reflection_feedback / mission_feedback | DeepSeek | 1 | 20 / 20 | before | on fallback |
| lesson_reflection_suggestions | DeepSeek | 1 | 20 | before | — (generator can't signal failure) |
| paper_script_marking / page_marking / rubric_extraction | **Gemini (direct SDK)** | 1 vision | 300 / 300 / 30 | before | on fail |

- Atomic reservation proven: 30 concurrent reflect requests → exactly 20
  provider calls.
- Max amplification per action: SOW lesson ≤5 wrapper calls (each wrapper =
  up to DeepSeek+retry+Gemini internally); bounded, no nested generator retry
  (verified `generationRetryBudget.test`).
- Residual: per-message cap within a tutor session is intentionally absent
  (§J); `lesson_reflection_suggestions` keeps its slot on provider failure
  (generator substitutes canned text silently).

---

## F. Migration review

| Migration | Preconditions | Compatible code | Main risk | Verified | Rollback risk |
|---|---|---|---|---|---|
| `120000` shared_reports | shared_reports exists | **new** code (service-role read) | old page 404s if applied before code | anon/auth denied via REST; RLS test | reopens F-01 |
| `121000` rate_limit_attempts | none | both; **new code fails closed without it** | code 503s if missing at deploy | limiter integration (atomic) | breaks limiter if dropped under live code |
| `122000` students guard | students exists | both (service-role writers unaffected) | none (catalog only) | raw REST guard probe | reopens F-04/F-09 |
| `123000` insights RPC | function may be absent (guarded) | both | none | grants probe | re-opens public view-count bump |
| `124000` student_guardians (audit) | table exists | both | none | raw REST + test | reopens AUDIT-F15 |
| `125000` growth_users (audit) | table exists | both | none | raw REST + test | reopens AUDIT-F16 |

All six are idempotent/rerunnable (`if exists` / `if not exists` / `create or
replace` / `to_regprocedure` guard), catalog-only (no large-table lock or
rewrite), and mutually independent (distinct objects). Fresh bootstrap:
`FAIL_COUNT=9 UNRECOVERED=0`, fingerprint pin updated.

**Validated deployment order** (the report's order, extended):
1. Production read-only preflight (§I), incl. the **F-17 RLS check** (gating).
2. Apply `121000`, `122000`, `123000`, `124000`, `125000` (all old-code-safe;
   limiter must precede code).
3. Deploy code.
4. Smoke-test (shared page via service-role read, login, payment page,
   `/learn` mic, script capture, CSP console).
5. Apply `120000` (shared-reports) last.
6. Verify anon `shared_reports` read denied; verify headers.

Not safe to reorder: `120000` before code breaks the old shared page; code
before `121000` makes AI/join routes 503.

---

## G. Regression assessment

- **Evidence/projection pipeline:** bridge-lookup change adds only
  `user_id IS NULL` (bridge rows have none); `studentsBridgeIntegrity` and the
  11 bridge-suite tests show identical behaviour to `main` (§H).
- **Teacher/parent access:** removal, invites, alerts, holiday, class reports
  verified via integration suites; no legitimate path lost.
- **Payments:** pay-what's-owed preserved; only underpay/wrong-currency now
  fail.
- **Founder:** service-role bootstrap preserved (AUDIT-F16 fix); endpoints
  work with `GROWTH_FOUNDER_EMAIL`.
- **Uploads:** extension now derived from MIME + magic-byte check; size/path/
  bucket unchanged; `uploads.test` 7/7.
- No architectural change; learner-intelligence pipeline untouched.

---

## H. Test results

| Suite | Command | Env | Result |
|---|---|---|---|
| Standard | `npm test` | no DB | **1761 / 1761** |
| Deep-PR | `node scripts/run-deep-pr.mjs` | fresh disposable stack | **226 / 226** (224 remediation + 2 audit), 0 skipped |
| Cleanup gate | residue query | after deep-PR | **0** synthetic rows |
| tsc | `npx tsc --noEmit` | — | **0 errors** |
| Route-auth / architecture / manifest / classification / tier | gates | — | all pass; 36/36 gate unit tests |
| Production build | `npx next build` | — | **279/279**, 2 pre-existing `csvImport.ts` warnings |
| Raw REST probes | curl + anon/token | fresh stack | F-01, F-04, F-08, F-15, F-16 denials confirmed |

**Pre-existing failures (not regressions):** the full `test:deep` has 11
failures; in the representative subset I ran, **the failing set is byte-for-
byte identical on unchanged `main`** (3× `deleteAuthUserOrThrow` FK teardown,
1× `composeBlueprint` career-availability assertion). Classified **Confirmed
pre-existing / cleanup-and-environment dependent**. They are in `test:deep`
tiers, not in the CI-gating deep-PR set.

**Not executed (blocked):** HTTP-PR tier (needs a running Next server pointed
at a test target); browser end-to-end flows; any production inspection.

---

## I. Production preflight checklist

**Blocked pending read-only production access** — hand to an authorized
operator. Aggregate/redact output; return no names, emails, tokens or IDs.

**Supabase — gating (AUDIT-F17):**
```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('clinic_reports','compass_progress','learning_compass_configs',
                  'learning_compass_state','struggle_patterns','shared_reports');
-- every row must show relrowsecurity = true. Any false => NO-GO until fixed.
```
If any are false in production, enable RLS (they already carry SELECT
policies) and revoke anon, then reconcile the missing migration into the repo.

**Supabase — remediation confirmation:**
```sql
-- shared_reports: no permissive read policy; anon revoked
select policyname, cmd from pg_policies where tablename='shared_reports';
select has_table_privilege('anon','public.shared_reports','SELECT');   -- expect false
-- limiter functions present + service-role only
select has_function_privilege('authenticated','public.rate_limit_reserve(text,text,integer,timestamptz)','EXECUTE'); -- false
-- guards present
select tgname from pg_trigger where tgrelid='public.students'::regclass and not tgisinternal;
select policyname from pg_policies where tablename in ('student_guardians','growth_users') and cmd in ('INSERT','ALL');
```

**Read-only data triage (counts only, redact):**
```sql
select count(*) total, count(*) filter (where expires_at < now()) expired from shared_reports;
select count(*) planted from students where external_id is not null and user_id is not null; -- F-04 leftovers
-- parent-invite mismatches: validate column semantics first (parent_email may be null/legacy)
select count(*) from class_students cs join students s on s.id=cs.student_id
  join auth.users u on u.id=cs.parent_id where cs.parent_id is not null
  and s.parent_email is not null and lower(s.parent_email) <> lower(u.email);
select count(*) from teacher_classes where class_code !~ '^CORE-';
```

**Vercel:** set `GROWTH_FOUNDER_EMAIL`; preview/prod env separation; firewall/
Turnstile for anonymous forms (F-07); subdomain inventory before any HSTS
change; re-check response headers after deploy.

**Supabase Auth (dashboard — not code-verifiable):** email confirmation,
password length, leaked-password protection, CAPTCHA, auth rate limits,
founder MFA, redirect allow-list, legacy JWT retirement.

**GitHub/CI:** branch protection on `main`; make security + fingerprint checks
required; secret-scanning alerts; block merge without the gates.

---

## J. Owner decision register

| Item | Recommendation | Why |
|---|---|---|
| **AUDIT-F17 RLS** | **Must fix / confirm before deploy** | Potential learner-data exposure; production state unknown |
| Parent-invite email match (F-12) | Accept as designed; run mismatch triage (§I) before relying on auto-link | Closes hijacking; a few legitimate links may need a teacher to set the parent email |
| AI quotas (§E values/units) | Confirm; watch class_reports (5/day) and paper (300) at term end | Enforced for the first time; could block heavy legitimate days |
| Per-message tutor cap | Accept as temporary gap; add if cost spikes | New-session cap bounds worst case |
| Class broadcast codes | Accept as designed (now rate-limited + crypto) | Product feature, not a guessing hole |
| Token-overdraw race | Accept as documented follow-up | Bounded by daily cap; not independently exploitable for unbounded spend |
| Retire `ADMIN_SECRET` | Safe after `GROWTH_FOUNDER_EMAIL` set and deploy verified | No code references it |
| AUDIT-F15 / F-16 fixes | Accept | Close real escalations; service-role paths unaffected |

---

## K. Deployment runbook

Each step: role · precondition · action · verification · stop-condition ·
recovery. **No step authorizes production change without the owner.**

1. **Operator** · access granted · run §I gating + confirmation SQL ·
   all RLS flags true, remediation objects present · **STOP if any report
   table RLS=false** · n/a (read-only).
2. **Operator** · step 1 clean · apply `121000,122000,123000,124000,125000` ·
   functions/triggers/policies present · STOP on migration error · each has
   rollback SQL in its header.
3. **Operator** · migrations applied · deploy branch build · build green,
   app boots · STOP on boot error · roll back deploy (migrations stay — they
   are old-code-safe).
4. **Operator** · deployed · smoke-test shared page, login, payment page,
   `/learn` mic, capture, CSP console · all work, no CSP breakage · STOP on
   broken auth/payment · roll back deploy.
5. **Operator** · smoke clean · apply `120000` · anon `shared_reports` read
   denied; valid token page works · STOP if shared page 404s for valid tokens ·
   re-create dropped policies (header) only if reverting the read code too.
6. **Operator** · all green · set required CI checks, monitor 429/503 and
   `attempt limiter unavailable` logs · stable · n/a.

---

## Appendices

- Evidence logs: `/tmp/claude-1000/.../scratchpad/audit2/` (bootstrap,
  deep-pr, standard, bridge branch-vs-main).
- No production changes, commits, or pushes occurred during this audit.
