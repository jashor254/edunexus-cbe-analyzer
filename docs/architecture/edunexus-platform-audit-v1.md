# EduNexus Platform Audit v1.0

**Date**: 2026-07-20
**Method**: Four independent code-grounded passes (one per phase group), each required to cite a real file path, table, or test for every verdict — no verdict inferred from feature naming alone. Cross-checked against existing memory/audit trail (Sprint 22–31, Pilot Readiness Waves 1–6, LMS Basics Initiative) but **not** trusted blindly — several memory claims were re-verified against current code and some had changed (see Corrections below).

**Scoring**: Exists / Production Ready / Integrated, each ✅ (1.0) / 🟡 (0.5) / ❌ (0). Per-module score = average of the three. Per-phase completion % = average of module scores. This is a directional estimate, not a precise metric — don't over-read the second decimal.

---

## Top-Line Numbers

| Metric | Value |
|---|---|
| **Overall Completion** | ~64% (was ~62% — Sprint 6 raised the Learner Portal further) |
| SMS Completion | ~40% |
| Teacher Workspace / LMS Completion | ~63% |
| Parent Portal Completion | ~38% |
| Learner Portal Completion | ~72% (was ~67% — Sprint 6 activated Portfolio/Achievements/Timeline, previously dead code or teacher-only, and cross-linked the previously-disconnected journey. Also found and fixed a real regression Sprint 3 introduced without knowing it: the canonical Blueprint page 404'd/denied every real student — see Blocker #8) |
| Intelligence Platform Completion | ~94% |
| Architecture Health | ~67% |
| **Pilot Readiness** | **Closer, not there yet.** Both Critical RLS holes fixed (Sprint 1). Clinic payment bypass fixed (Sprint 2). The Learner Portal's root-cause unreachability (Blocker #5) is fixed (Sprint 3), and a self-view auth bug that undermined that fix is now also caught and fixed (Sprint 6, Blocker #8) — a real self-login student account now works end-to-end, verified by 30 + 14 real signed-in HTTP tests. Remaining before pilot: land the still-uncommitted work, decide a real "sign up as a student" entry point (a product/marketing decision, not a code gap), and the items below. |

**The shape of the platform**: the Intelligence layer is the most mature and complete part of the whole system by a wide margin (93%) — it is genuinely the product's core asset. The School Management System (SMS/Core-admin) and Parent Portal are the least built (~40%, ~38%) — SMS is missing an entire back half (Finance/Library/Transport/Inventory/Hostel/Timetable never started), and the Parent Portal only ever got the Intelligence-layer half of "parent experience" (Blueprint/Career/report-card) — it has **zero** visibility into day-to-day LMS activity (attendance, assignments, fees) even though that data already exists for teachers.

---

## Critical Blockers (fix before anything else)

1. ~~**`token_balances` RLS self-grant.**~~ **RESOLVED 2026-07-20 (Sprint 1).** `supabase/migrations/20260720120000_sprint1_critical_rls_fixes.sql` drops the permissive `UPDATE` policy entirely; the one real dependency (`app/api/payments/verify/route.ts` writing via the caller's own session client) was fixed to use the service client, matching its sibling `callback/route.ts`. Verified via a new RLS-bound integration test (`lib/intelligence/evidenceAndBalanceRls.integration.test.ts`) and a clean Supabase security-advisor scan.
2. ~~**`learner_evidence` RLS anti-pattern.**~~ **RESOLVED 2026-07-20 (Sprint 1).** Replaced with a `SELECT`-only policy gated on current teacher (direct `students.teacher_id` link or class-roster) or parent (`students.parent_user_id` or `class_students.parent_id`), reusing the existing `auth_is_teacher_of_student()` SECURITY DEFINER helper and adding two new ones (`auth_is_direct_teacher_of_student()`, `auth_is_parent_of_student()`) in `20260720130000_sprint1_evidence_rls_bypass_fix.sql`, after a first attempt (inline joins against `students`) was proven wrong by a real signed-in-client test and corrected. Verified: a teacher who entered a record for a student they don't teach can no longer read it back; the current teacher/parent can.
3. ~~**Clinic download payments-bypass fix exists but is uncommitted.**~~ **RESOLVED 2026-07-20 (Sprint 2).** `app/api/clinic/download/route.tsx` now uses `checkFeatureAccess`/`deductFeatureTokens`, deduction deferred until after PDF generation succeeds. Verified end-to-end with a real signed-in HTTP client (`lib/testing/clinicDownload.http.integration.test.ts`): unauthenticated/no-tokens/wrong-student-IDOR/malformed-request all correctly rejected with zero deduction; deduction happens if and only if generation succeeds. Code change is complete and tested; **still not `git commit`ed** — a repo-hygiene action, not a functional gap.
4. ~~**Two student-facing routes are fully orphaned.**~~ **ROUTING RESOLVED 2026-07-20 (Sprint 2)**, but this surfaced something much bigger — see **Blocker #5** below. `app/dashboard/resources/page.tsx` and `app/dashboard/calendar/page.tsx` were moved (git-tracked renames, not copies) to `app/(student)/resources/page.tsx` and `app/(student)/calendar/page.tsx`, matching their siblings `/blueprint`, `/career`, `/holiday`, `/progress` exactly. `DashboardNavbar.tsx` now links both. The two dead links on the parent dashboard home (`app/dashboard/page.tsx`) that pointed at the old paths were removed rather than repointed, because repointing them would have created a dead-end bounce for parents (see Blocker #5). Verified with a real HTTP client that parent/teacher/anonymous gating on the moved pages is unregressed.
5. ~~**No real account can ever resolve to a "student" primary role.**~~ **RESOLVED 2026-07-20 (Sprint 3).** Full root-cause investigation (Architecture Review Board pass) found FIVE independent, disagreeing role/redirect implementations, none of which ever routed a student anywhere real: `profiles.role`'s CHECK constraint (widened via migration `20260720_sprint3_canonical_learner_role` to permit `'student'`), `app/student/layout.tsx`'s duplicate inline query (replaced with `getUserRoles()`), `login/page.tsx#resolveDestination()`'s duplicate query (replaced with the existing `/api/auth/roles` endpoint, now extended to return `redirectTo`), `auth/callback/route.ts#resolveRoleDestination()`'s duplicate query (replaced with `getUserRoles()`+`getRoleRedirect()`), and `signup/page.tsx`'s duplicate mapping (replaced with a new pure `lib/auth/roleRedirect.ts`, safely shareable between server and client). The duplicate `app/(student)/*` route group was consolidated into the canonical `app/student/*` tree (6 pages moved, git-tracked renames); the six old flat URLs permanently redirect via `next.config.ts`. `proxy.ts` gained a `/student` branch mirroring `/teacher`'s existing defense-in-depth shape. Verified end-to-end with 30 real signed-in HTTP tests (`lib/testing/studentPageRouting.http.integration.test.ts`): student reaches all 7 canonical pages; parent/teacher/anonymous are denied everywhere; cross-role bounces resolve with no loop; all 6 legacy URLs redirect; the signup/login API contract (`/api/auth/complete-profile`, `/api/auth/roles`) correctly accepts and routes a student. A follow-up product decision remains open and is intentionally not resolved here: there is still no marketing/landing-page entry point for "sign up as a student" — the code path works end-to-end if reached, but nothing yet links to it.
6. **Career Intelligence's Sprint 29/30/31 NO-GO — re-investigated Sprint 6, narrower than described.** `app/api/career/capability-matches/route.ts` and `app/api/parent/career-intelligence/route.ts` both call `computeCapabilityMatches()` directly rather than the grade-gated `buildCareerIntelligence()` — but both routes already independently apply the correct Junior/Senior gate (`shapeForGrade()`/an inline `mode` computation) before returning, so this is **not a live grade-gating bug** today. The real defect is duplicated business logic: the same `grade >= 7 && grade <= 9` predicate is independently reimplemented in 30+ locations across the codebase (confirmed by a full grep pass, Sprint 6). Swapping either route to call `buildCareerIntelligence()` directly is not a safe drop-in — that function's return shape (`CareerIntelligence`, Insight-narrative-wrapped) is structurally incompatible with what both routes' actual consumers (student Career Explorer UI, Parent Career Intelligence UI) read today (`CapabilityMatchReport`'s raw tier arrays); fixing it properly means migrating both consumer UIs in the same change. Deferred as its own properly-scoped sprint, not attempted as a drop-in swap.
7. ~~**Portfolio and Achievements are fully dead code.**~~ **RESOLVED 2026-07-20 (Sprint 6).** Both were already fully composed into every `LearnerBlueprint` but never rendered anywhere. `components/blueprint/sections.tsx` gained `PortfolioSection`/`AchievementSection`, wired into both `BlueprintView.tsx` and `ParentBlueprintView.tsx`; `app/student/portfolio/[learnerId]` and `app/student/achievements/[learnerId]` now give `portfolioUrl`/`profileUrl` (previously hardcoded `null`) a real destination. See Sprint 6 entry, `docs/engineering/implementation-log.md`.
8. **Found and fixed during Sprint 6, not previously known:** the canonical Blueprint page (`app/student/blueprint/[learnerId]/page.tsx`) — the exact page `/student/blueprint` redirects a real student into — gated access with `requireSchoolStaff` (admin/headteacher/deputy/teacher only; `SchoolUserRole` has no `student` value). Every real self-service student account hit a permission error on their own Blueprint, contradicting this document's own Blocker #5 "reachable" claim. Sprint 3's routing test never caught it because its synthetic student fixture owned no `students` row, so `/student/blueprint` always short-circuited at the empty state before reaching `[learnerId]`. **RESOLVED 2026-07-20 (Sprint 6)** via a new `requireLearnerAccess`/`canViewLearnerRecord` pair in `lib/core/permissions.ts` composing the existing, previously-unused `canViewLearner` — verified live against a real owned-student fixture, before and after.

---

## Corrections to prior memory (found stale this pass)

- **Sprint 27b's Projection Engine crash is fixed.** `lib/projection/recompute.ts` now persists only the 7 V1 projector types; V2 types are computed in-memory and deliberately never written, matching Sprint 31's recommended code-only fix. (Recommend a live-data re-run to fully close, not just this static read.)
- **Career Explorer's Junior grade-gate bug (Sprint 29) is fixed** at the student-facing display layer (`shapeForGrade` in `capability-matches/route.ts` now correctly returns `exploration` mode / families-only for Grade 7-9). The underlying computation gap (blocker #5 above) is a narrower, still-open issue than the original Sprint 29 finding described.
- **EILS/EIR frozen status confirmed clean** — zero live imports from `_frozen/` anywhere in `app/` or `lib/`.

---

## Phase 1 — School Management System (SMS) — ~40% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| School profile/settings | ✅ | 🟡 | ✅ | No dedicated edit UI beyond onboarding/activation | Medium |
| Academic years | 🟡 | 🟡 | ❌ | Backend only, no management screen | Medium |
| Terms | 🟡 | 🟡 | ❌ | Backend only, no management screen | Medium |
| Streams/Classes | ✅ | ✅ | ✅ | — | High |
| Departments | ❌ | ❌ | ❌ | No concept exists anywhere | Low |
| Staff management | ✅ | 🟡 | ✅ | No deactivate/edit-role UI | Medium |
| Roles & permissions | ✅ | ✅ | ✅ | — | High |
| HOD workflows | ❌ | ❌ | ❌ | No HOD role/table/UI anywhere | Low |
| Principal workflows | 🟡 | 🟡 | 🟡 | `headteacher` role covers it; no dedicated dashboard | Low |
| User management | ✅ | 🟡 | ✅ | — | Medium |
| Audit logs | 🟡 | 🟡 | 🟡 | Only at SaaS org layer, not school-admin level | Medium |
| Student admission | ✅ | ✅ | ✅ | — | High |
| Student promotion | ✅ | ✅ | 🟡 | Not prominently surfaced | High |
| Transfers | ✅ | 🟡 | 🟡 | API-only, no dedicated UI | Medium |
| Alumni | ❌ | ❌ | ❌ | No concept exists | Low |
| Student documents | ❌ | ❌ | ❌ | No upload/table exists | Low |
| Subjects | ✅ | ✅ | 🟡 | No standalone management UI | Medium |
| Curriculum | ✅ | ✅ | ✅ | — | High |
| Timetable | ❌ | ❌ | ❌ | Confirmed placeholder icon only — entire module | High |
| Teacher allocation | 🟡 | 🟡 | 🟡 | Implicit only, no workflow | Medium |
| Lesson allocation | ❌ | ❌ | ❌ | No period/slot allocation system | Medium |
| Learner attendance | ✅ | ✅ | ✅ | — | High |
| Teacher/staff attendance | ❌ | ❌ | ❌ | System is 100% learner-focused | Medium |
| Attendance reports | ✅ | 🟡 | ✅ | — | High |
| Attendance notifications | 🟡 | 🟡 | 🟡 | No dedicated absence-notification pipeline | Medium |
| Fee structures | ❌ | ❌ | ❌ | No table exists | Low (pilot is subscription-based) |
| Invoices | 🟡 | 🟡 | 🟡 | Exists only as SaaS platform billing, not school fees | Low |
| Receipts | ❌ | ❌ | ❌ | — | Low |
| Balances | ❌ | ❌ | ❌ | Only `token_balances` (AI wallet, unrelated) | Low |
| Expenses | ❌ | ❌ | ❌ | — | Low |
| Payroll | ❌ | ❌ | ❌ | — | Low |
| Library | ❌ | ❌ | ❌ | Zero matches in schema/code | Low |
| Transport | ❌ | ❌ | ❌ | Zero matches | Low |
| Inventory | ❌ | ❌ | ❌ | Zero matches | Low |
| Hostel | ❌ | ❌ | ❌ | Zero matches | Low |
| Communication (school-admin) | ❌ | ❌ | ❌ | No broadcast system under Core | Medium |
| Reports (school-admin) | ✅ | ✅ | ✅ | — | High |
| Integrations (school-admin) | 🟡 | 🟡 | 🟡 | Only org-level dev-platform API keys | Low |

---

## Phase 2 — Teacher Workspace (LMS) — ~63% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| Teacher Dashboard | ✅ | 🟡 | ✅ | Actively in flux (uncommitted components) | Medium |
| Lesson Planning | ✅ | 🟡 | ✅ | Zero test files | Medium |
| Schemes of Work | ✅ | 🟡 | ✅ | Zero test files despite 11-file module | Medium |
| Records of Work | ✅ | 🟡 | ✅ | Zero test files | Low |
| Assignments (standard) | ✅ | ✅ | ✅ | — | — |
| Adaptive Assignments — Creation | 🟡 | 🟡 | 🟡 | No draft-mode gate, no Adaptive sub-toggle | High |
| Adaptive Assignments — Variant Generation | ✅ | ✅ | 🟡 | Synchronous only, no bulk/progress UI | Medium |
| Adaptive Assignments — Review Dashboard | 🟡 | 🟡 | 🟡 | Flat list only, `editVariant()` has no UI | Medium |
| Adaptive Assignments — Delivery/Grading | ✅ | ✅ | ✅ | — | — |
| Adaptive Assignments — Analytics/Inspection | ❌ | ❌ | ❌ | Data exists, zero read surfaces | Medium |
| Quizzes (MCQ, non-adaptive) | ✅ | ✅ | ✅ | — | — |
| Rubrics | ❌ | ❌ | ❌ | Grading is MCQ/marks-only | Low |
| Resources | ✅ | 🟡 | ✅ | No test coverage | Low |
| Content Library | 🟡 | 🟡 | 🟡 | Folded into Resources, not distinct | Low |
| Gradebook | ✅ | ✅ | ✅ | — | — |
| Attendance | ✅ | ✅ | ✅ | — | — |
| Calendar | ✅ | 🟡 | ✅ | — | Low |
| Messaging | ❌ | ❌ | ❌ | No feature anywhere | Medium |
| Discussion Boards | ❌ | ❌ | ❌ | No feature anywhere | Low |
| Announcements | ✅ | 🟡 | ✅ | One-way only, no tests | Low |
| Teacher AI Assistant | ❌ | ❌ | ❌ | Only scattered one-shot generation calls, no unified assistant | Medium |

---

## Phase 3 — Parent Experience — ~38% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| Dashboard | ✅ | 🟡 | ✅ | — | Medium |
| Attendance (parent view) | ❌ | ❌ | ❌ | No page/API at all | High |
| Homework (parent view) | ❌ | ❌ | ❌ | No page/API at all | Medium |
| Assignments (parent view) | ❌ | ❌ | ❌ | No page/API at all | High |
| Marks (parent view) | 🟡 | 🟡 | 🟡 | Only via report-card/Blueprint | Medium |
| Feedback | ❌ | ❌ | ❌ | No parent-teacher channel | Medium |
| Fees (parent view) | ❌ | ❌ | ❌ | No school-fee concept exists | High |
| Communication | ❌ | ❌ | ❌ | No messaging/announcements-to-parent | Medium |
| Progress | 🟡 | 🟡 | ✅ | Only inside Blueprint | Low |
| Blueprint | ✅ | ✅ | ✅ | — | — |
| Career Insights | ✅ | ✅ | ✅ | — | — |
| Notifications | 🟡 | 🟡 | 🟡 | No in-app notification center | Medium |

---

## Phase 4 — Learner Experience — ~67% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | — | — |
| Assignments | ✅ | 🟡 | ✅ | Real route is `/learn` | Medium |
| Adaptive Learning | 🟡 | 🟡 | 🟡 | No dedicated learner-facing page | Medium |
| Learning Compass | ✅ | 🟡 | 🟡 | Sits in wrong route tree | Medium |
| Progress | ✅ | ✅ | ✅ | Blocker #5 resolved (Sprint 3) — reachable at /student/progress; Sprint 6 cross-linked to the rest of the journey | — |
| Career Explorer | ✅ | 🟡 | ✅ | Blocker #5 resolved (Sprint 3) — reachable at /student/career; Sprint 6 cross-linked to the rest of the journey. Computation-layer gap (Blocker #6) still open, re-scoped Sprint 6 | Medium |
| Resources | ✅ | 🟡 | ✅ | Blocker #5 resolved (Sprint 3) — reachable at /student/resources; still no test coverage on the underlying page itself | Low |
| Calendar | ✅ | 🟡 | ✅ | Blocker #5 resolved (Sprint 3) — reachable at /student/calendar; still no test coverage on the underlying page itself | Low |
| Portfolio | ✅ | ✅ | ✅ | Sprint 6 — rendered in Blueprint, own page at /student/portfolio | — |
| Achievements | ✅ | ✅ | ✅ | Sprint 6 — rendered in Blueprint, own page at /student/achievements | — |
| Learner Timeline | ✅ | ✅ | ✅ | Sprint 6 — was teacher-API-only; now at /student/timeline | — |
| Remedials | 🟡 | 🟡 | ❌ | Teacher-only view, no student/parent surface. Considered for Sprint 6, deliberately deferred — its output (root cause, peer pairings, session allocation) is teacher-internal and needs a real reshape pass, not a safe drop-in wire | Medium |
| Holiday Planner | ✅ | ✅ | 🟡 | Blocker #5 resolved (Sprint 3) — reachable at /student/holiday. Sprint 6 added a cross-link to the rest of the journey (was previously isolated, zero mutual links to Blueprint/Progress/Career) | — |

---

## Phase 5 — Intelligence Platform — ~93% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| Evidence Engine | ✅ | ✅ | ✅ | RLS anti-pattern fixed (Sprint 1, 2026-07-20) — see Blocker #2 | — |
| Projection Engine | ✅ | ✅ | ✅ | Fixed since Sprint 27b — see Corrections | Low |
| Blueprint | ✅ | ✅ | ✅ | — | Low |
| Career Intelligence | ✅ | 🟡 | 🟡 | See Blocker #5 | High |
| Academic Clinic | ✅ | 🟡 | ✅ | Legacy pipeline still separate from canonical chain | Medium |
| Risk Detection | ✅ | ✅ | ✅ | — | Low |
| Recommendation Engine | ✅ | ✅ | ✅ | — | Low |
| Teacher Intelligence | ✅ | 🟡 | 🟡 | Legacy + Projection-based views coexist, contradicting | Medium |
| Parent Intelligence | ✅ | 🟡 | 🟡 | See Blocker #5 | Medium |
| School Intelligence | 🟡 | 🟡 | 🟡 | Principal dashboard unreachable | Medium |
| Monday Panel | ✅ | 🟡 | ✅ | No correction-triggered cache invalidation | Medium |
| Attention Feed | ✅ | ✅ | ✅ | — | Low |
| Mission System | ✅ | ✅ | ✅ | — | Low |
| Portfolio (engine) | ✅ | ✅ | ✅ | Engine itself is solid — exposure gap is Blocker #6 | Low |
| Reflection Engine | ✅ | ✅ | ✅ | — | Low |

---

## Phase 6 — Cross-cutting Architecture — ~61% complete

| Module | Exists | Production Ready | Integrated | Missing | Priority |
|---|---|---|---|---|---|
| Authentication | ✅ | ✅ | ✅ | — | Low |
| Authorization | ✅ | 🟡 | 🟡 | HOD/Principal roles absent from schema | Medium |
| Multi-school | 🟡 | 🟡 | 🟡 | Principal dashboard orphaned | Medium |
| Security | ✅ | ✅ | ✅ | Both Critical RLS bugs fixed (Sprint 1, 2026-07-20) — see Blockers #1, #2. Pre-existing unrelated finding: `.env.local`/`.env.production` point at the same Supabase project, so integration tests run against the same database as production — flagged, not fixed, out of scope for this sprint. 61 pre-existing lower-severity advisor lints (59 WARN, mostly `function_search_path_mutable` on unrelated legacy functions) remain, also out of scope. | Medium (residual items, not Critical) |
| Performance | ✅ | 🟡 | 🟡 | Indexes/timing exist, no live perf audit done | Medium |
| Offline capability | ❌ | ❌ | ❌ | No PWA/service-worker anywhere | Low |
| Background jobs | ✅ | ✅ | ✅ | Real, mature, reusable — currently unused by Adaptive Assignments bulk gen | Low |
| Notifications | 🟡 | 🟡 | 🟡 | Thin, single file | Medium |
| API (external/dev-facing) | ✅ | 🟡 | 🟡 | Separate devportal app exists, maturity not audited | Medium |
| Search | 🟡 | 🟡 | ❓ | Thin, wiring not confirmed | Medium |
| File storage | ✅ | ✅ | ✅ | — | Low |
| Analytics | 🟡 | 🟡 | ❓ | Folded into observability, no dedicated module | Low |
| Logging | ✅ | 🟡 | ✅ | No error-tracking integration (e.g. Sentry) | Medium |
| Testing | ✅ | 🟡 | — | 107 test files; newer modules well covered, legacy pipelines (Clinic, Career) largely untested | Medium |
| Deployment readiness | ✅ | 🟡 | — | CI/CD exists; standing charter says trust-fixes-first, and Critical items remain open | High |

---

## Recommended Sprint Order

This treats **fixing/finishing what already exists** as strictly higher priority than any new-scope work, per the standing [[feedback_post-audit-operating-charter]] mandate (trust fixes / pilot prep, no new intelligence features, until pilot observation window ends).

1. **Land the uncommitted work.** Commit/verify the clinic-download payments fix (code complete, tested — Sprint 2); decide the fate of the Sprint 9/10 series currently sitting as untracked files before anything else risks being lost.
2. ~~**Close the two Critical RLS holes**~~ **DONE — Sprint 1, 2026-07-20.** See Blockers #1/#2 above.
3. ~~**Fix the Resources/Calendar route orphaning**~~ **DONE (routing) — Sprint 2, 2026-07-20.** See Blocker #4. Surfaced Blocker #5.
4. ~~**Fix Blocker #5**~~ **DONE — Sprint 3, 2026-07-20.** Canonical learner architecture restored: `profiles.role` permits `'student'`, five disagreeing role/redirect implementations consolidated into one (`getUserRoles()`/`getRoleRedirect()`), `app/(student)/*` merged into `app/student/*`, `proxy.ts` gained the missing `/student` gate. 30 real signed-in HTTP tests passing. Open follow-up (product, not code): no marketing entry point yet for "sign up as a student."
5. ~~**Wire Portfolio and Achievements into the (now genuinely reachable) student UI**~~ **DONE — Sprint 6, 2026-07-20.** Also wired the canonical Learner Timeline (previously teacher-API-only) and cross-linked the previously-disconnected journey (Blueprint/Progress/Career/Holiday/Portfolio/Achievements/Timeline). Found and fixed a real access bug along the way — see Blocker #8.
6. **Close the Career Intelligence grade-gating gap at the source** — re-scoped Sprint 6: both routes already gate correctly today (not a live bug), but duplicate the same Junior/Senior predicate instead of sharing `buildCareerIntelligence()`, whose return shape is incompatible with both routes' current consumer UIs. Properly fixing this now means migrating the student Career Explorer UI and the Parent Career Intelligence UI to a shared shape in the same change — schedule as its own sprint, not a drop-in swap.
7. **Parent LMS parity** — expose existing attendance/assignment-status/gradebook data (all already built for teachers) into `app/(parent)/`. Biggest completion-% gain for the Parent Portal, no new backend.
8. **Finish Adaptive Assignments** — the five slices already scoped in `docs/architecture/sprint-10-lms-integration-audit-and-plan.md` (Slice A–E), reusing the existing job queue for bulk generation.
9. **Timetable module** — the largest genuinely-greenfield SMS gap; schedule as its own multi-sprint effort once 1–8 are done.
10. **Everything with zero prior art** (Messaging, Discussion Boards, Rubrics, Teacher AI Assistant, Fee management, Library/Transport/Inventory/Hostel) — lowest priority relative to the above; re-evaluate against actual pilot feedback before committing to any of these, per the "reduce decisions" and "start simple" standing principles.

---

*This document is intended as the single source of truth for remaining EduNexus work. Any new sprint should either close a gap named here or improve a module already marked Production Ready 🟡/❌ — not introduce scope absent from this audit — until this document is next revised.*
