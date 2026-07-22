# Release Gate 2 — Pilot Experience Certification

**Role**: Senior QA Lead / Pilot Readiness Auditor. **Standard**: could a real Kenyan school succeed using EduNexus today, without the founder sitting beside them? **Status**: complete, 2026-07-21, immediately following Sprint C0 Stabilization (`docs/engineering/implementation-log.md`, "Sprint C0 Stabilization: Uniqueness Constraint, Onboarding Visibility, Recovery Plan").

**Method and its limits, stated up front**: no browser-automation tool is available in this environment. Every journey below is verified one of two ways — (a) reused from [Release Gate 1](architecture/release-gate-1-pilot-readiness-certification.md) and [Sprint 13](architecture/sprint13-pilot-readiness-validation.md), both of which exercised these exact code paths as real running code against a real database this same session, re-confirmed live where the underlying data could change (guardian/promotion counts re-queried fresh, below, and unchanged), or (b) newly traced this pass for the two areas neither prior report covered: Growth Engine (§7) and a fresh UX/dead-end pass (§10). Findings carried from a prior report are marked **[carried]**; everything else is newly derived this session.

---

## Executive Summary

A brand-new pilot school can complete the full academic-year journey — activation through promotion — using only in-product actions, with no database intervention required. Sprint C0 closed the two concrete onboarding gaps Release Gate 1 found (subject seeding had no in-flow trigger; "End of Term" showed false-positive completion) and added a real database backstop to the one MAJOR data-integrity gap (`learner_promotions` had no uniqueness constraint) — all three verified live this session, the last with an actual concurrency test, not just code reading.

Two things stand between this platform and an unconditional READY FOR PILOT:

1. **Live data, not code**: this database currently contains 579 real guardians who have never received an invite and 15 real learners with inconsistent enrollment history from before Sprint 12's fix. These numbers are unchanged since Release Gate 1 — Task 3's recovery plan was deliberately written but not executed this sprint (correctly, per its own "DO NOT modify production data" instruction). This only matters for a school with pre-existing history; it does not affect a genuinely new pilot school's own journey.
2. **A newly-found Growth Engine access gap** (§7, §8): any authenticated user of the platform — a teacher, a parent, a pilot admin — can self-provision into the founder-only Growth OS (sales pipeline, school contacts, follow-ups) simply by visiting `/growth`, because the only gate is "is this caller authenticated at all," not "is this caller the founder." This is a real cross-boundary privilege gap, not yet exploited, but the mechanism is provably there.

**Verdict: READY WITH CONDITIONS.** See §11.

---

## 1. School Creation

**[carried, re-confirmed]** `activateSchool()` (`lib/core/schoolActivation.ts`) creates a school, academic year, terms, streams, and classes in one call — 7/7 steps confirmed in a real run against a disposable test school. Current term now resolves correctly post-activation (Sprint 12 fix, re-confirmed).

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| Grade→Subject seeding is not part of `activateSchool()` | **Medium → now Low, fixed this sprint** | `seedGradeSubjectsForSchool()` is a separate call; Sprint C0 added a one-click "Set Up Default Subjects" action directly on the Academic Office page instead of leaving it undiscoverable | A fresh school previously had zero subjects with no in-flow prompt | Already fixed — verify in a real fresh-school walkthrough before pilot #1 | Done | Low, now that the button exists |
| No dedicated Academic Years/Terms management screen | Observation **[carried]** | The Academic Office page states this plainly rather than fabricating a screen | A school needing a mid-year academic-year edit has no UI; extremely rare in year 1 | Not needed for pilot 1 | — | Low |

---

## 2. Administrator Setup

**[carried]** Roles/permissions/authentication all confirmed working: `requireSchoolAdmin`, `requireAuthentication` gate every Core route sampled; `school_users` correctly associates an admin to exactly one school.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| Central permission service (`lib/core/permissions.ts`) adopted by only 3 of 86 auth-checking routes | Observation **[carried]** | Most routes hand-roll their own `auth.getUser()` + ownership check instead of the shared service | No observed security gap from this — each route was independently checked and correctly gated | Post-pilot consolidation, not a blocker | Medium (refactor) | Low near-term, rising maintenance cost long-term |

---

## 3. Academic Activation

**[carried, re-confirmed]** Academic years, terms, grades, subjects, classes all create correctly through `activateSchool()`. `getSchoolAcademicReadiness()` correctly reports every blocking gap with (as of Sprint C0) admin-facing wording — reworded this sprint to remove internal function/file names that previously leaked directly into the UI (`resolveSubjectReadiness()`'s reason string).

No new findings this pass beyond what Sprint C0 already fixed.

---

## 4. Teacher Onboarding

**[carried]** Invite → accept → `teachers` row creation → class assignment all confirmed working in a real run. `class_assessments_term_check` requires the literal values `'1'|'2'|'3'`, not human-readable term names.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| `class_assessments_term_check` rejects `"Term 1"`-style input with a raw Postgres error, not a friendly message | **Medium** | Confirmed live during Release Gate 1's fresh-school walkthrough — hit this exact error creating a real assessment | Any future UI bug or integration sending a human-readable term string surfaces an opaque DB error to the teacher, not an actionable one | Add Zod validation at the API boundary restricting `term` to `'1'|'2'|'3'` with a clear error message, matching CLAUDE.md's Zod rule | Low (single route) | Medium — confusing failure for a teacher mid-assessment-creation, no data corruption |

---

## 5. Learner Onboarding, Promotion, Transfers, Graduation

**[carried, re-confirmed]** Admissions, enrollment, transfer all confirmed working. Promotion/graduation confirmed working for a *new* learner this sprint (Sprint C0's concurrency test used a genuinely new fixture learner, processed correctly). Guardian invite creation and claim confirmed working end-to-end for a real claim.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| `learner_promotions` had no uniqueness backstop against a concurrent double-promotion | **Major → Fixed this sprint** | `supabase/migrations/20260723120000_learner_promotions_uniqueness.sql`, live-verified via `pg_constraint`; a real `Promise.all` concurrency test now proves exactly one of two simultaneous promotions succeeds | Previously: a double-click or network retry could corrupt a learner's enrollment history | Fixed | Done | — |
| 579/580 guardians have never received an invite; 15 learners have corrupted enrollment history | **Critical, live data — unchanged from Release Gate 1** | Re-queried fresh this session: `unlinked_guardians: 579`, `total_invites: 1`, `dangling_graduated: 14`, `orphan_promoted: 1` | Any *existing* school (not a fresh pilot school) has real broken guardian access and real roster inconsistencies today | `docs/architecture/legacy-data-recovery-plan.md` — written, not executed, per this sprint's explicit "DO NOT modify production data" instruction | Plan exists; execution is a separate approved program | Critical for any pre-existing school; zero impact on a genuinely new pilot school |
| Legacy `student_invites` claim path has no atomic race guard | **Medium [carried]** | Confirmed via `pg_constraint`: only a PK and `UNIQUE(token)`, no guard against a double-claim race, unlike its newer `core_guardian_invites` counterpart | A shared/replayed legacy invite link could have its claim overwritten by a second claimant | Add the same `.is('used_at', null)`-plus-row-count pattern already proven in `guardianInvites.ts` | Low | Medium — account-linkage integrity, not academic-record integrity |

---

## 6. Teaching Workflow (Assessments, Marks, Moderation, Publishing, Reports)

**[carried, re-confirmed]** Assessment creation, marks entry, lock/publish, evidence recording, projection, blueprint, report generation and publication all confirmed working end-to-end in a real run this session. Lock enforcement confirmed at both route and lib layer independently (defense in depth). Duplicate report-card generation/publication is DB-enforced (`UNIQUE(learner_id, term_id)` on `school_report_cards`), not just app-level.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| Term-summary computation ("End of Term") previously showed false-positive "done" as soon as assessments were locked | **High → Fixed this sprint** | `lib/core/client/termStatus.ts`'s new `summariesComputed` field, wired into `app/teacher/core-office/academic/page.tsx`'s status row and startup checklist | Previously: an admin could believe report generation was ready when summaries hadn't actually been computed, risking an empty/zero-mark report card | Fixed | Done | — |
| No dedicated "reopen a locked assessment" workflow | Observation **[carried]** | Recovery relies on an admin manually unpublishing first, with no audit trail for that action | Rare in year 1; worth a small audit-trail addition post-pilot | Low-medium | Low near-term |

---

## 7. Growth Engine

**New this pass.** Growth Engine (`lib/growth/`, `app/(growth)/growth/`, `app/api/growth/`) is a real, separate bounded context — schools/contacts/activities/follow-ups/pipeline, correctly isolated with no foreign keys into learner-platform tables (confirmed via migration `20260723110000_growth_engine_sprint_c0.sql`'s own header comment and schema).

The "Today" dashboard (`app/(growth)/growth/page.tsx`) shows Must Do / Waiting For / At Risk / Wins — a real, working daily view, not a stub. It is **not** the four-pillar Product/Sales/Customer-Success/Learning scorecard the Phase 1 CEO Plan describes — that scorecard does not exist yet as its own view. Per this mission's explicit "do not expand scope" instruction, this is recorded as an **Observation**, not a blocker: the CEO Plan's scorecard is a distinct future ask, not part of Sprint C0/PR-1.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| Any authenticated user can self-provision into Growth OS, founder-only in intent | **High** | `lib/growth/auth.ts`'s `requireGrowthUser()` calls `requireAuthentication()` (any valid session) then unconditionally `growthRepos.users.ensure(user.id, ...)` — no allowlist, no role check, no founder-specific gate anywhere in the route chain (`app/api/growth/*/route.ts` all call only this). Every `growth_*` table's RLS policy is `USING (is_growth_user())`, which becomes true for anyone the instant `ensure()` runs. A teacher or pilot admin account, sharing the same `auth.users` pool, who navigates to `/growth` in the same browser session becomes a full-access Growth OS user immediately. | Not yet exploited (no link from any pilot-facing page to `/growth`), but the mechanism is real and provable, not theoretical | Gate `requireGrowthUser()` on a real founder check (e.g. an explicit allowlisted user id/email, or restrict `growth_users.role` insert to a pre-seeded row rather than self-registering any caller) | Low-medium (one function, one migration to stop self-registration) | High if a pilot user ever discovers the route — full read/write on sales pipeline/contact data, a real confidentiality breach, not just an inconvenience |

---

## 8. Security

**[carried, re-confirmed this session]** Both previously-Critical bugs independently re-verified fixed by reading live policy text/function source: `token_balances` self-grant (only owner-SELECT + admin-ALL policies exist) and `learner_evidence` teacher-of-entry read gate (all three gating functions check a *current* teaching/parent relationship, not an evidence-entry actor column). Cross-school, cross-parent, cross-class access all confirmed enforced on sampled routes. Zod validation present on sampled routes. Security advisor scan re-run: zero new Critical/Error findings.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| Growth OS self-provisioning (see §7) | **High** | Same as §7 | Cross-boundary access to commercial/sales data by a non-founder authenticated user | Same as §7 | Low-medium | High |
| Assessment ownership filtered by creating-teacher, not "currently teaches this class" | **Low [carried]** | `findAssessmentById`/`findMarksByAssessment` filter by the creating teacher's id, same shape as the forbidden `teacher_id`-as-access-control pattern but on assessment objects, not evidence | A teacher who now teaches a class but didn't create its assessment gets a 404, not visibility | Extend the same "currently teaches" check already used for evidence | Low-medium | Low — availability annoyance, not a data-exposure risk |
| Several `SECURITY DEFINER` functions callable via RPC by `anon`/`authenticated` roles | Observation **[carried]** | Security advisor WARN-level, not independently confirmed exploitable this pass | Unknown | Review each for intentionality | Low | Unknown, flagged not resolved |
| Leaked-password protection not enabled | Low **[carried]** | Security advisor, unchanged | Weaker password hygiene than available | Enable in Supabase Auth settings | Trivial | Low |

---

## 9. Performance

**[carried, re-confirmed this session]** No N+1 query patterns found across 388 candidate loop sites. All FK columns on hot tables (`learner_evidence`, `learner_enrollments`, `class_assessments`, `learner_promotions`) confirmed indexed via fresh `pg_indexes` query. `learner_enrollments` and `school_report_cards`/`term_subject_summaries` all carry real DB-level unique constraints, not just app-level checks.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| `select('*')` in `lib/assignments/variants.ts` (8 occurrences) | **Low [carried]** | Re-confirmed same file, same 8 line numbers, this session and last | Over-fetches columns on a variant-generation path; no measured slowness | Mechanical fix — name the columns | Trivial | Low |
| No live query-timing measurement performed (no EXPLAIN ANALYZE run this pass) | Observation | Budget — schema/index-level checks were prioritized over live timing | Unknown whether any endpoint is slow in practice at real pilot data volumes (currently small) | Run real timing once pilot data volume exists | — | Low at current data volume |

---

## 10. User Experience

New pass this session, reading actual UI copy and click paths rather than re-deriving from prior reports.

| Finding | Class | Evidence | Impact | Fix | Effort | Risk if ignored |
|---|---|---|---|---|---|---|
| `platform_events` table does not exist in the live database | **High [carried]** | Every `publishEvent()` call fails silently (fire-and-forget); confirmed live this session's Release Gate 1 pass and unchanged | The entire 32-event catalog (`docs/events/`) is a silent no-op — any notification/analytics assumed wired to it isn't | Either create the table or remove the dead call sites — leaving it silently broken is the wrong default either way | Medium | Medium — false sense that events/notifications are flowing |
| `blueprint_snapshots` immutability trigger blocks cascading school deletion once any report card/graduation exists | Observation **[carried]** | Intentional per ADR-0008, confirmed live | A test/demo/pilot school can never be deleted once it has real academic activity — relevant for whoever manages pilot environment cleanup, not a pilot-facing UX issue | None needed for pilot | — | Low |
| Academic Office overview previously showed misleading "done" states (subjects, End of Term) | **Fixed this sprint** | See §1, §6 | — | Fixed | Done | — |
| No student-login concept exists in the Core learner model | Observation **[carried, unverified this pass]** | No `user_id` on the Core learner row; student dashboard reads via a legacy bridge | If a pilot school expects students (not just parents/teachers) to log in directly, this journey is unconfirmed | Needs its own dedicated walkthrough before promising student login to a pilot school | — | Medium if promised to a school before verified |

---

## 11. Final Verdict

**READY WITH CONDITIONS.**

A genuinely new pilot school — the actual first-customer scenario this gate exists to certify — can complete school creation, administrator setup, academic activation, teacher onboarding, learner onboarding, a full teaching cycle (assessment → marks → lock → summary → report → publish), and promotion, entirely through the product, with no founder intervention and no database access required. Every gap Release Gate 1 found in that specific journey has either been fixed this sprint (subject seeding, End of Term status, promotion uniqueness) or was already fixed before it (the two Critical RLS bugs, the clinic payment bypass).

The conditions, in priority order:

1. **Before onboarding any school with pre-existing history** (not a brand-new pilot school): execute the guardian-invite backfill and the enrollment repair per `docs/architecture/legacy-data-recovery-plan.md`, with its named human checkpoint for the one non-mechanical row. This does not block a genuinely new pilot school today.
2. **Before any pilot user's account could plausibly discover `/growth`**: close the Growth OS self-provisioning gap (§7/§8). This is the one finding from this pass that is High severity and touches the actual pilot-facing app (shared auth pool), not just legacy/historical data. Low-medium effort, recommend fixing before pilot school #1's admin account is created, not after.
3. **Low-cost, non-blocking cleanups**: the `class_assessments_term_check` friendly-error gap (§4), the legacy `student_invites` race guard (§5), `platform_events` (§10) — none of these block a first pilot, all are worth closing before scaling past a handful of schools.

If asked "could a real Kenyan school succeed using EduNexus today without the founder sitting beside them" for its own journey: **yes**, and this report's evidence — not just Sprint C0's fixes but this pass's independent re-confirmation of them — supports that directly. The conditions above are about protecting data that predates this pilot and about a boundary between the school-facing product and the founder's own internal tool, not about the pilot journey itself.
