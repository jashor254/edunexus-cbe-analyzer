# Sprint 19 — Pilot Experience Closure Report

## Executive Summary

Sprint 19 closed ten pilot-facing gaps identified after the Trust Closure, Pilot Readiness, Final Gate, and Production Blocker Closure sprints. Every goal reused an existing service, repository, or API — no new domain models, no duplicated business logic, no architecture changes. Three genuine gaps were found during implementation and resolved by narrowing scope rather than inventing new schema (all confirmed with the user before building):

- **Report cards** are Core-only and Core's `Learner` has no auth-user link — only a guardian (parent) link exists. Student self-view of Core report cards remains blocked on the "Core identity convergence" work already noted as out of scope elsewhere in the codebase (`lib/compass/ownership.ts`). Scoped to parent viewing.
- **End-of-Term** primitives (`lock`, `archive`, `next-term-prep`) didn't exist as named functions. Built as a thin orchestrator over existing calls only, with no auto-publish of stragglers.
- **Role-lookup consolidation** (goal 8) turned up no remaining work — `getUserRoles()` is already the single lookup everywhere it needs to be; the two "admin" call sites solve a genuinely different problem and were correctly left alone.

One pre-existing, unrelated TypeScript error blocks a full `next build` type-check pass (see Validation). One pre-existing structural finding — three local migration files not yet applied to the remote database — was discovered during Goal 10 and is reported, not fixed.

## Files Modified

**New:**
- `app/(student)/blueprint/page.tsx`, `components/student/StudentBlueprint.tsx`
- `app/(student)/holiday/page.tsx`, `components/student/StudentHolidayPlan.tsx`, `app/api/holiday/mine/route.ts`
- `app/(student)/progress/page.tsx`, `components/student/StudentProgress.tsx`
- `app/(parent)/report-card/page.tsx`, `app/api/reports/report-card/route.ts`, `app/api/reports/report-card/mine/route.ts`
- `app/admin/core-schools/new/page.tsx`
- `lib/core/endOfTerm.ts`, `app/api/core/school/end-of-term/route.ts`

**Modified:**
- `app/dashboard/components/DashboardNavbar.tsx` — student-only nav entries (Blueprint, Holiday, Progress); Careers href now role-aware
- `app/dashboard/page.tsx` — "Career Explorer" card now points at `/career-intelligence` for parents; added "Report Card" card
- `app/api/parent/compass-activity/route.ts` — dropped raw CBC codes from parent-facing level line
- `lib/repositories/school.repository.ts` — added `findGuardianLink`, `listGuardianLearners`, `findCurrentTermsForSchools`
- `lib/holiday/types.ts` — hoisted `HOLIDAY_PLAN_RELEVANCE_DAYS` (was private to `blueprint.ts`) so it can be shared
- `lib/learnerIntelligence/blueprint.ts` — imports the hoisted constant instead of redefining it
- `app/admin/page.tsx` — added "Onboard Core School" link

## Routes Added
- `GET /api/holiday/mine`
- `GET /api/reports/report-card`
- `GET /api/reports/report-card/mine`
- `POST /api/core/school/end-of-term`

## Services/Repositories Modified
- `lib/repositories/school.repository.ts`: `findGuardianLink`, `listGuardianLearners`, `findCurrentTermsForSchools` (new, read-only, batched where multiple rows are involved — no query-in-loop introduced)
- `lib/core/endOfTerm.ts`: new orchestrator, zero new scoring/grading logic — sequences `listAssessments` → `computeTermSummaries` → `generateReportCards` → `publishReportCards` → `createTerm`/`setCurrentTerm`, all pre-existing

## Components Modified
- `DashboardNavbar.tsx`, `app/dashboard/page.tsx` (nav/card fixes only, no business logic)

## Issues Fixed
1. Parent Career navigation silently routed parents to the student's own career explorer (`/career`) instead of any of the three existing parent career pages, which had no nav entry anywhere in the app.
2. Parent-facing `compass-activity` API returned raw CBC codes (`BE`/`AE`/`ME`/`EE`) alongside the already-existing plain-language names — the raw code is now dropped entirely for this parent surface.
3. No student-facing surfaces existed for Blueprint, Holiday plans, or Progress despite all three backing services/APIs already working correctly.
4. No parent-facing report-card viewer existed for Core schools despite `generateReportCards`/`publishReportCards`/`getReportCard` all being production-ready.
5. No internal onboarding UI existed for Core schools — `POST /api/core/school` was reachable only via direct API calls.
6. No End-of-Term workflow existed — term rollover required manually orchestrating five separate service calls with no single entry point and no lock-state precondition check.

**Goal 8 (role-lookup consolidation):** audited, not fixed — no fix was needed. `getUserRoles()` is already the sole teacher/parent/student lookup at every layout/middleware gate. `lib/auth/isAdmin.ts` and `lib/payments/access.ts` check the literal `'admin'` role string, a concept `getUserRoles()`'s `UserRole` type doesn't model (it would silently collapse `admin` → `parent`) — correctly left alone per user decision.

## Validation Performed
- `npx tsc --noEmit`: clean for every file this sprint touched. Two pre-existing errors remain in `scripts/create-compass-auto-confirm-account.ts` and `scripts/reference-school/integration.test.ts` — confirmed via `git status` to be untouched, pre-existing files, unrelated to Sprint 19.
- `npx eslint` on all new/changed files: 0 errors. One pre-existing warning in `app/dashboard/page.tsx` (line 208, unrelated `useEffect` setState pattern predating this sprint).
- `npm run build`: Turbopack compile succeeded ("Compiled successfully"). The subsequent full-project type-check phase fails on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error noted above — this blocks a clean `next build` exit today, independent of this sprint's changes.
- Manual code-path verification (read-through, not live-clicked in a browser this session): student self-lookup convention (`GET /api/learn/student`) traced through each new student page; ownership checks in `/api/reports/report-card` traced against `learner_guardians`; `runEndOfTerm`'s call sequence traced against each callee's actual implementation (not just its signature) to confirm ordering — `computeTermSummaries` must run before `generateReportCards` reads `term_subject_summaries`, which the original plan had not sequenced explicitly.
- Supabase advisors (`get_advisors`) and `list_migrations`/`list_tables`/indexes queried directly — see Goal 10 detail below.

## Regression Results
- No existing route's request/response contract changed except `compass-activity`'s `summary`/level-line string content (additive-safe: consumers already treat it as an opaque display string).
- `setCurrentTerm`'s existing "clear previous current term" behavior (in `lib/core/school.ts`, already present before this sprint) was verified, not modified — an earlier draft of this sprint's diff mistakenly duplicated that logic at the repository layer and was reverted before commit-worthy state.
- No `lib/holiday/*`, `lib/career/*`, or Projection Engine files were modified — Blueprint, Holiday Planner, and Career Intelligence logic are byte-for-byte unchanged; only new callers were added.

## Behaviour Changes
- Parents now land on `/career-intelligence` instead of `/career` from both nav entry points.
- Parent `compass-activity` responses no longer contain raw CBC letter codes.
- Students see three new nav entries (Blueprint, Holiday, Progress); parents see one new dashboard card (Report Card).

## Security Impact
- All new routes call `auth.getUser()` first and return 401/403 per CLAUDE.md.
- `/api/reports/report-card` and `/mine` are the first routes to use `learner_guardians.user_id` as a Core ownership check — added as a new repository method (`findGuardianLink`) rather than inline query, matching existing repository-only-CRUD convention.
- `/api/core/school/end-of-term` is gated on `isSchoolAdmin` (pre-existing helper, not previously wired into a route of its own).
- No service-role client is exposed client-side; no new webhook endpoints were added.

## Privacy Impact
- No new PII fields are collected. The report-card page renders only fields already gated behind the same guardian-link check used elsewhere in Core.

## Educational Impact
- Students can now see their own Blueprint, Holiday plan, and Compass progress — previously computed but invisible to them.
- Parents can see plain-language CBC progress language and a consolidated Career Intelligence entry point, and can view their child's published report card without contacting the school.

## Remaining Work
- **Core report cards have no student-facing path.** Fixing this requires the Core identity-convergence bridge (`lib/compass/ownership.ts` calls this "Phase 11") — out of scope for this sprint by design, not an oversight.
- **Holiday-plan publication was intentionally excluded from the End-of-Term orchestrator.** The legacy Holiday Planner (`lib/holiday/planner.ts`) operates on `students`/`teacher_classes`, while Core operates on `learners`/`learner_enrollments`/`class_assessments` — there is no existing mapping between a Core `class_id` and a legacy `teacher_classes.id`. Wiring holiday-plan publication into `runEndOfTerm` would require inventing that bridge, which the sprint rules explicitly prohibit.
- **`next build`'s type-check phase is currently broken** by a pre-existing bug in `scripts/create-compass-auto-confirm-account.ts` (unrelated file, not touched this sprint) — worth a follow-up ticket since it blocks a clean CI build today regardless of this sprint.

### Observed but intentionally deferred (outside Sprint 19 scope — reported, not fixed)
- **Three local migration files are not yet applied to the remote Supabase project**: `supabase/migrations/20260710120000_sprint15_corrections.sql`, `20260710130000_trust_closure_sprint.sql`, and `20260710_sprint14_security_hardening.sql` exist in the working tree (untracked) but do not appear in `list_migrations` — the applied history stops at `20260710112718_sprint15_corrections`. If prior sprints' migrations were meant to already be live, they are not.
- **Security advisors** (via `mcp__supabase__get_advisors`): `public.job_queues` has RLS enabled with no policy at all; several `SECURITY DEFINER` functions (`increment_insights_view`, `auth_is_group_member`, `auth_is_guardian_of`, `auth_is_teacher_of_student`, `auth_owns_student`, `auth_teacher_id`, `get_grade_topics`, `is_admin`) are callable by `anon`/`authenticated` roles directly via RPC — likely intentional for several of these (e.g. `auth_owns_student`) but worth a confirmation pass; `pg_trgm` extension is installed in the `public` schema rather than a dedicated schema; several tables have `INSERT`/`ALL` policies with `WITH CHECK (true)` (mostly service-role-only patterns that appear intentional, e.g. `capability_history`, `sow_*` tables, `notification_log`); leaked-password protection is disabled in Supabase Auth.
- **Cron registration gap**: `app/api/cron/` contains 17 route directories, but `vercel.json`'s `crons` array registers only 4 (`friday-generation`, `generate-record-of-work`, `auto-publish-holiday-plans`, `ai-log-retention`). Routes like `billing-renewals`, `parent-pulse`, `quota-alerts`, `dlq-requeue`, `term-readiness`, `academy-nudge`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges`, `cleanup-users`, `events`, `jobs`, `projection-events` have no scheduled trigger in this file — some may be intentionally invoked another way (queue workers, manual triggers), but this wasn't verified per-route and is worth a triage pass.
- **Performance advisor** output exceeded the tool's single-response size limit and was not reviewed in full this pass — worth a dedicated follow-up rather than a partial read.
- Tables touched by this sprint's new code (`holiday_plans`, `school_report_cards`, `learner_guardians`, `learners`, `learner_enrollments`, `terms`, `class_assessments`) all have RLS enabled, and every new query path (`learner_guardians.user_id`/`.learner_id`, `terms.school_id`+`is_current`, `class_assessments.class_id`) is backed by an existing index — no new index gaps were introduced.

## Engineering Confidence Score
**7.5 / 10.** High confidence in the new student/parent surfaces (thin, read-mostly, reuse verified end-to-end services). Medium confidence in the End-of-Term orchestrator specifically — it is new code with no existing test coverage and has not been exercised against real data (the reference school fixture) in this session; the sequencing was verified by reading each callee's implementation, not by running it.

## Production Go/No-Go Recommendation
**Conditional Go.** The pilot-facing UI additions (goals 1–7) are low-risk and ready. Before relying on the End-of-Term workflow (goal 9) in production, run it once against the reference school fixture in a non-destructive way and confirm the unapplied-migrations finding above — if those three migrations represent real unshipped work from prior sprints, they should be applied (or explicitly deferred with sign-off) before this sprint is considered fully closed.
