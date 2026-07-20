# Pilot Readiness Wave 6 — LMS Foundations Full Audit

**Date:** 2026-07-18
**Type:** Audit-only (no code changed). Four parallel research passes across core academic domain, auth/security/RLS, in-progress Teacher Workspace (PRP-1→4, uncommitted), and notifications/crons/payments.
**Verdict:** CONDITIONAL GO — two Critical security findings must be fixed before the next pilot cohort touches token balances or evidence read paths. Everything else is either already solid or a known, scoped backlog item.

---

## Critical (fix before continuing pilot rollout)

### 1. `token_balances` RLS lets any signed-in user grant themselves unlimited tokens
`supabase/schema.sql:1005-1006` / `supabase/final_schema.sql:1108-1109`:
```sql
CREATE POLICY "token_balances: own update" ON token_balances
  FOR UPDATE USING (auth.uid() = user_id)
```
No `WITH CHECK` restricting columns or values. Since the anon key is public, any authenticated user can call `supabase.from('token_balances').update({balance: 999999})` from a browser console and bypass `lib/payments/config.ts` entirely. **This is the single highest-severity finding in the whole audit** — it undermines the entire payments/token system, not just one feature.
**Fix:** add `WITH CHECK` scoping legitimate updates only through server-side paths (service role), or restrict the authenticated-role UPDATE policy to specific non-balance columns, or drop client UPDATE entirely and require all balance mutations to flow through `lib/payments/`.

### 2. `learner_evidence` RLS policy encodes the exact anti-pattern CLAUDE.md forbids
`supabase/migrations/20260707_evidence_domain.sql:126-134` — policy `learner_evidence_own_teacher` gates SELECT by whether `auth.uid()` matches the *entering* teacher, not the *current* teacher (`class_students`). CLAUDE.md is explicit that `teacher_id` on evidence rows means "who entered this," never "who may read this." Application code is documented to always read through `recomputeLearnerProjection()`, so this hasn't caused a visible bug yet — but the DB policy itself is wrong, meaning any future direct query (a script, a new route written by someone who doesn't know the convention, a Supabase Studio session under a teacher JWT) will silently hide a transferred student's evidence from their new teacher.
**Fix:** rewrite the policy to check `class_students` (current teaching relationship) instead of the ingestion actor.

### 3. `app/api/clinic/download/route.tsx` bypasses the canonical payments path
Found fresh, not in any prior audit. Three stacked violations in one route:
- Hardcodes `balance: tokens - 1` (line 94) while `TOKEN_COSTS.clinic_report = 5` in `lib/payments/config.ts:52` — a duplicate, wrong constant.
- Never calls `checkFeatureAccess`/`deductFeatureTokens` — reimplements the balance/subscription check inline, violating "API routes are thin."
- Deducts the token **before** `generateReport`/`generateAcademicClinicPDF` run, violating "deduct only after a successful AI response."

Net effect: this route silently undercharges every clinic-report download by 4 tokens and can charge a user even when report generation fails.
**Fix:** replace the inline logic with `lib/payments/access.ts` calls, same pattern as every other feature route.

---

## High

- **Destructive mark overwrites, zero audit trail** — `lib/repositories/assessment.repository.ts:371-376` `upsertMarks()` upserts directly into `learner_marks`; a correction silently replaces the prior value with no history, no actor, no timestamp. (Confirmed still true from Wave 1-5.)
- **Term/year rollover is an untracked boolean flip** — `lib/repositories/school.repository.ts:202-269`. No actor id, no history, no undo. (Confirmed still true.)
- **HOD/Principal roles still don't exist in the schema** — `lib/auth/getRole.ts:6` only permits `teacher | parent | student`. (Confirmed still true.)
- **N+1 query patterns** — `lib/core/academicActivation.ts:96-101, 177-182` and `lib/core/promotions.ts:31-53` loop per-item instead of batching with `.in()`.
- **No error-tracking integration anywhere** — only in-process logging; `notification_log` captures failures but no admin UI ever reads them. (Confirmed still true.)

## Medium

- **`buildPrincipalDashboard()` and `lib/core/promotions.ts` remain fully unreachable** — no UI caller found anywhere. (Confirmed still true — correction to the older "most of Core admin is unreachable" framing: most Core admin routes *do* now have UI callers via `core-office`/`core-team`/`core-admissions`/`core-term` pages; only the Principal dashboard and promotions remain orphaned.)
- **`CRON_SECRET` unquoted `#`** — still present in `.env.local`, `.env.local.backup`, `.env.production` (`edunexus666#`). No `.env.example` exists to correct the pattern for future deploys.
- **`assessment.repository.ts`'s dense `teacher_id` filtering** (~28 call sites) — most look like legitimate "assessments I authored" scoping, but `getCohortData`/`getTeacherCohorts` should be spot-verified to confirm they don't silently drop a transferred student's marks recorded by a prior teacher.
- **`lib/attentionFeed/tier.ts:7`** scopes `learner_marks` by `teacher_id` for an onboarding-tier heuristic — not an access-control bug (service client, low stakes), but the same conflation pattern; worth a naming/comment fix so it isn't copied into a real gating context later.

## Low / Clean (confirmed, don't re-audit)

- Core academic domain: RLS enabled with real policies on every canonical table checked; no `select('*')`; no direct `@supabase/supabase-js` imports in routes; no `console.log` in `lib/core`/`app/api/core`; no `any` violations; all FK columns indexed.
- Auth pattern is centralized and correct: routes go through `requireSchoolMembership`/`requireSchoolAdmin`/`requireTeacher`/etc. in `lib/core/permissions.ts`, or `requireAuth`/`checkFeatureAccess`, all of which call `auth.getUser()` internally.
- Payments webhook (`app/api/payments/callback/route.ts`) and WhatsApp webhook (`app/api/whatsapp/inbound/route.ts`): proper timing-safe HMAC verification before processing; `fulfillPayment()` is atomically idempotent.
- `app/api/payments/verify/route.ts` correctly 403s on `user_id` mismatch and validates amount against Paystack.
- No service-role client import found in any `"use client"` file — no key leakage.
- Token deduction ordering is correct everywhere *except* `clinic/download` (Critical #3 above).
- **4 of the 6 Wave 1-5 notification findings are now genuinely fixed**: the `assessmentPipeline.ts` positional-unpack bug, the two false "notified"/"sent to email" promises, and all three previously-dead crons (now scheduled via `.github/workflows/notification-crons.yml`).
- **Uncommitted Teacher Workspace (PRP-1→4) is clean and safe to commit as-is**: 17/17 tests pass, `tsc --noEmit` clean, eslint clean (only 4 pre-existing-pattern warnings), no doc-vs-code drift, no orphaned exports, thin routes, auth-first, no `any`/`select('*')`/console.log.

---

## Recommended order of work

1. Fix `token_balances` RLS (Critical #1) — highest blast radius, trivial exploit.
2. Fix `learner_evidence` RLS policy (Critical #2) — latent but structurally wrong, matches a rule the team already cares enough about to enforce via ESLint elsewhere.
3. Fix `clinic/download` route (Critical #3) — quantifiable revenue leak (4 tokens/download undercharged) plus charges-on-failure bug.
4. Commit the Teacher Workspace work (PRP-1→4) — it's ready, nothing found blocks it.
5. Quote the `#` in `CRON_SECRET` across all three env files.
6. Carry forward as backlog (unchanged from Wave 1-5): mark-correction audit trail, term-rollover audit trail, HOD/Principal roles, error-tracking integration, N+1 batching in `lib/core`.
