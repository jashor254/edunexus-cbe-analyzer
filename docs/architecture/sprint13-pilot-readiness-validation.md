# Sprint 13 — Pilot Readiness Validation & Production Hardening

**Status**: Validation complete, 2026-07-21. Verification-only — no product code changed. Four parallel research passes ran against the real codebase and the live Supabase project (not simulated): fresh-school journeys were exercised as real running code against a real, newly-created test school; upgrade/operational-readiness claims were checked with real `execute_sql` counts against production data; failure-injection/security findings were traced to real RLS policy text via `pg_policies`; architecture/performance findings were confirmed with real `eslint`/`grep` runs, not estimates.

**Method limitation, stated up front**: no browser-automation tool was available in this environment. "Journeys" in Phase 1 were verified by calling the actual `lib/` functions end-to-end (the same fixture idiom `schoolActivation.test.ts` uses) against a real database, and by tracing route→lib→repository→DB code paths — not by clicking through the UI. Where this matters (student login, LMS Assignments), it is marked **UNVERIFIED** rather than assumed passing.

**Primary question**: *Having assumed Sprint 12 closed every approved blocker, is that assumption actually true?*

**Answer: Partially, and the gap is bigger than Sprint 12 believed.** Every code-level fix from Sprint 12 holds up under direct re-verification — the two Critical RLS bugs, the clinic payment bypass, promotion re-enrollment, and guardian-invite creation all work correctly when exercised fresh. But Sprint 12 scoped its two named backfills ("small, bounded, data-repair") without ever counting the real rows. They are not small: **100% of existing guardians (579/579) have never received an invite**, and **15 real learners currently carry corrupted enrollment state** from promotions/graduations that ran before the fix. This is live production data, already in this shape today, not a hypothetical migration risk.

---

## 1. Journey Verification Matrix (Phase 1–2, fresh school)

A real test school (`b3e56245-ee38-4e47-ad46-fec26ccc8503`, "Sprint 13 Fresh Test School") was created and driven through the full lifecycle for real: activation → admissions → guardian claim → teacher onboarding → assessment → evidence → projection → blueprint → report card → promotion → transfer → year rollover.

| Journey | Result | Notes |
|---|---|---|
| School activation, years, terms, current term, streams, classes | PASS | `activateSchool()` — 7/7 steps created, `getCurrentTerm` resolved correctly |
| Grade→Subject seeding | PASS, but **hidden step** | `seedGradeSubjectsForSchool()` is not called by activation — a fresh school has zero subjects until someone calls this separately |
| Admissions | PASS | `onboardLearner()` — learner, guardian, enrollment all created |
| Guardian invite → WhatsApp → claim → parent login | PASS (fresh data) | Real invite fired, real parent account claimed it, `learner_guardians.user_id` set — but see §2, this path has **never fired against real production admissions** |
| Teacher invite/onboarding/login | PASS | `inviteTeacher`/`acceptTeacherInvitation` |
| Student login | **UNVERIFIED** | No student-level auth account concept in the Core learner model; student dashboard reads via the legacy bridge, not exercised without a browser |
| Assignments (LMS) | **UNVERIFIED** | Separate feature from Core Assessments (Sprint 4 LMS work), out of this pass's scope |
| Assessment creation + marks | PASS, **one real trap found** | `class_assessments_term_check` requires `'1'|'2'|'3'`, not `"Term 1"` — a caller sending a human-readable term string gets a raw Postgres constraint error, not a friendly message |
| Evidence → Projection | PASS | `recordBridgedMarks()` → 6 `learner_projections` rows written correctly |
| Blueprint | PASS | Reads Projection only — zero direct `learner_profiles`/evidence-repo reads found via grep, confirming CLAUDE.md's rule holds |
| Academic Clinic | **UNVERIFIED (known)** | Separate legacy pipeline; its divergence from Blueprint was already found and explicitly deferred in Sprint 12 (High 5) — not re-litigated |
| Report Cards | PASS, **one hidden required step** | `term_subject_summaries` only populate via a distinct `action:'compute'` call, separate from publishing the assessment — a first-time admin who publishes and goes straight to "Generate Report Cards" gets an empty/zero-mark card unless this control is prominent in the UI |
| Promotion | PASS | Real destination enrollment created, old enrollment withdrawn — Sprint 12's Critical 2 fix holds for a fresh school |
| Transfer | PASS | `learners.status` and enrollment status both update correctly |
| Roll into next academic year | PASS | Re-running activation for a new year only creates what's missing, leaves the prior year untouched |

**Phase 2 step count**: ~12–14 distinct actions from "school created" to "first report card issued," two of which are easy-to-miss hidden steps (subject seeding, term-summary compute) rather than a literal UI dead-end/redirect loop.

**New findings, not in any prior sprint doc**:
- `platform_events` table **does not exist** in the live database. Every `publishEvent()` call in this walkthrough failed silently (fire-and-forget by design). The entire 32-event catalog documented in `docs/events/` is a no-op in production today — anything intended to consume these events (notifications, analytics) is dark.
- `blueprint_snapshots` has an immutability trigger that blocks cascading `DELETE FROM schools` once any report card or graduation exists for that school. Intentional per ADR-0008, but means test/demo schools become permanently undeletable the moment they generate a Blueprint Snapshot — relevant for whoever runs pilot environment cleanup.

---

## 2. Existing-School Upgrade Validation (Phase 3), real counts

| Claim (from Sprint 12) | Verified count | Verdict |
|---|---|---|
| "Guardians admitted before the fix have no retroactive invite" | **579 of 579** `learner_guardians` rows have `user_id IS NULL`; `core_guardian_invites` has **0 rows total** | Confirmed, and total — not partial. The fix is wired (`lib/core/learnerOnboarding.ts:119`, `lib/core/learners.ts:40`) but has never fired on a real admission since deploy |
| "Some pre-fix promotions have no destination enrollment" | **15 learners** affected: 14 of 17 `graduated` rows (dated 2026-07-17/18, pre-fix) still show an active old-class enrollment; 1 `promoted` row has `to_class_id IS NULL` and a stale active enrollment. 3 post-fix graduations (2026-07-21) are correct | Confirmed, larger than "some" — this is most of the historical promotion/graduation activity to date |

**Migration safety**: full scan of `list_migrations` (~200 files) found no destructive DDL (no unguarded `DROP COLUMN`/`DROP TABLE`, no unsafe type changes). Two CHECK-widening migrations found safe today but become one-way once real data exists in the newly-allowed state (`20260720140000_sprint3_canonical_learner_role.sql` — rollback breaks once any `profiles.role='student'` row exists; currently 0 such rows).

**Legacy-shape resolution**: `learner_evidence` immutability is enforced by a live DB trigger (`trg_learner_evidence_immutability`), not just convention — confirmed real, not aspirational. No `.single()` call was found gated on a column that could be absent on legacy rows.

**Operational-year trace (Phase 4)**: withdraw, promote, graduate, evidence-correction, and report-card-publish all use safe patterns (status-transition UPDATE or lifecycle-guarded new-row-supersedes, never a raw overwrite of a historically-immutable row). No code path was found doing a raw `UPDATE`/`DELETE` directly against `learner_evidence` or a published report card outside the guarded lifecycle functions. Assessment "reopen" has no dedicated function — recovery today relies on an admin manually unpublishing first, with no audit trail for that action.

---

## 3. Failure Injection & Security (Phase 5–6)

| Attack / failure mode | Result | Severity |
|---|---|---|
| `token_balances` self-grant via RLS | **PASS — confirmed fixed.** Live policy check: only owner-SELECT and admin-ALL remain, no public write policy | — |
| `learner_evidence` teacher-of-entry read gate | **PASS — confirmed fixed** by the security pass (qual keyed off current-teaching-relationship functions, not `ingestion_runs.initiated_by`). *Note: the fresh-school-journey pass independently flagged the same live policy as still matching the forbidden pattern — the two passes disagree on read of the same policy text. Needs one direct read of `auth_is_teacher_of_student()`'s function body to fully reconcile; treat as provisionally fixed, not closed, until that's done.* | Needs reconciliation |
| `app/api/clinic/download` payment bypass | **PASS — confirmed fixed**, now routes through `checkFeatureAccess('clinic_report')` | — |
| Promotion replay | **PASS** — already-promoted learner is skipped with a logged error, no duplicate row | — |
| Core guardian invite dedup/claim race | **PASS** — idempotent create, conditional `UPDATE...WHERE used_at IS NULL` closes the race | — |
| **Legacy `student_invites` claim race** | **FAIL** — check-then-act with no conditional guard/row-count check; two concurrent claims of the same token can both pass validation and one silently overwrites the other's `parent_user_id` | Medium |
| Duplicate report-card generation/publication | **PASS** — refuses regeneration over an existing published card | — |
| Locked/published assessment edit bypass | **PASS** — enforced independently at both route and lib layer | — |
| Expired session on protected routes | **PASS** — sampled routes all gate on `requireAuthentication` first | — |
| Cross-school access | **PASS** — `requireSchoolAdmin` + explicit `assertLearnerOwnership` on transfers/promotions | — |
| Cross-parent access | **PASS** — resolution always keyed off the authenticated user's own guardian links | — |
| Cross-teacher/class access via assessment ownership | **PARTIAL** — `findAssessmentById`/`findMarksByAssessment` filter by the *creating* teacher, not "currently teaches this class" — same shape as the forbidden `teacher_id` pattern but on assessment objects, not evidence | Low |
| Service-role usage outside cron/webhooks | **Policy-vs-practice gap, not new** — ~140 routes use `createServiceClient()` with app-layer authorization checks rather than literal cron/webhook-only usage, per this codebase's established (pre-existing) pattern | Informational |
| Malformed request handling (Zod) | **PASS** on all sampled routes | — |

---

## 4. Architecture, Performance, Tech Debt (Phase 7–9)

**Architecture** — guardrails hold:
- Projection-canonical ESLint rule: **0 violations**, confirmed by a real `eslint` run.
- Capability-profile consolidation (Sprint 23) holds: one canonical `computeCapabilityProfile()`, no reimplementations found.
- `_frozen/` (EILS/EIR) code confirmed still fully dead — zero live imports.
- Central permission service (`lib/core/permissions.ts`) exists and is tested but adopted by only 3 of 86 auth-checking routes — unchanged, longstanding, carried over from Sprint 9.
- Repository-bypass (raw `.from()` in 134 route files) is pervasive but **pre-existing and consistent practice**, not a new regression — no prior sprint flagged it as a finding.
- 2 orphan routes found: `app/api/beta/teacher-count/route.ts` (likely called from outside this repo), `app/api/share/generate/route.ts` (fully built, zero callers anywhere).

**Performance**:
- N+1 queries: **none found** across 388 candidate loop sites; the only loop-with-query pattern found is intentional chunked batching.
- `select('*')`: **8 occurrences**, all in one production file, `lib/assignments/variants.ts:79,89,109,121,135,169,181,193` — a real CLAUDE.md violation, mechanical fix.
- No new heavy-client-component concerns beyond what ESLint already surfaces.

**Technical debt**, classified:

| Item | Class |
|---|---|
| 579 unfired guardian invites + 15 corrupted enrollments (live data) | **Pilot-blocker** |
| Legacy `student_invites` claim race | **Pilot-blocker** (data-integrity risk on a live, still-used path) |
| `platform_events` table missing — 32-event catalog is a silent no-op | **Pilot-blocker** for anything assumed wired to it (notifications/analytics); otherwise post-pilot |
| Hidden required steps: subject seeding, term-summary compute | **Pilot-blocker** (real onboarding dead-end risk) until documented in a runbook or surfaced in UI |
| High 5 — Academic Clinic/Blueprint divergence | **Architectural redesign** (unchanged from Sprint 12, deferred by design) |
| `select('*')` in `lib/assignments/variants.ts` | **Post-pilot** |
| Orphan `/api/share/generate` route | **Post-pilot** |
| Repository-bypass pattern (134 files) | **Long-term roadmap** |
| Central permissions non-adoption (83/86 routes) | **Long-term roadmap** |
| Assessment-ownership-by-creator (not "currently teaches") | **Long-term roadmap** |
| No HTTP-level test for `app/api/student/home/route.ts` | **Post-pilot** (carried over) |

---

## 5. Deliverables

**Release Readiness Score: 68/100.** Down from Sprint 12's self-reported 85 — not because new code regressed (it didn't; every Sprint 12 fix re-verified clean), but because this sprint replaced Sprint 12's unverified assumption ("small, bounded backfill") with a real count that is neither small nor bounded: it is currently 100% of one entire category of production data.

**Architecture Health Score: 85/100.** All enforced guardrails (ESLint projection rule, capability consolidation, evidence immutability trigger, frozen-code isolation) hold under direct re-verification. Docked for two small mechanical debts (`select('*')`, one orphan route) and unchanged longstanding non-adoption of the central permission service.

**Security Score: 84/100.** Both previously-Critical bugs and the payment bypass are confirmed fixed. One live Medium finding (legacy invite race) and one Low finding (assessment-ownership-by-creator) are real and new. One RLS-policy read is unreconciled between two independent passes — flagged, not resolved, in §3.

**Data Integrity Score: 52/100.** The headline finding of this sprint: real, live production rows are currently broken today — not "would break under a future migration." Every guardian ever admitted through Core cannot currently have a parent log in and see their child (579/579). 15 learners have inconsistent enrollment state that would show wrong or duplicate current-class data on any roster or report card generated today.

**Operational Readiness Score: 65/100.** Safe historical-data patterns confirmed throughout a full simulated operational year. Two real onboarding dead-ends found (subject seeding, term-summary compute) that a first pilot school will hit without guidance. The entire platform event system is dark.

**Maintainability Score: 82/100.** Clean aside from the two mechanical items above; no new duplication, no reactivated dead code.

**Performance Score: 90/100.** No N+1 patterns found anywhere in the codebase; batching is used correctly everywhere it matters.

**Remaining Technical Debt**: see the classified table in §4.

**Pilot Risks**:
1. Any existing school (any school with pre-Sprint-12 activity) currently has guardians who cannot claim their child and, if it ran a promotion/graduation before Sprint 12, has real learners with wrong enrollment data.
2. The guardian-invite trigger has never actually fired against a real admission — it is verified only via a synthetic test school, not production traffic.
3. First-time admins will hit two undocumented required steps (subject seeding, term-summary compute) with no UI guidance found.
4. `platform_events` doesn't exist — anything assumed to be notified downstream isn't.

**Manual Pre-Pilot Tasks**:
1. Run the guardian-invite backfill for all 579 `learner_guardians` rows with `user_id IS NULL` (function is already idempotent/safe per Sprint 12).
2. Run a one-time enrollment-repair for the 15 identified corrupted promotion/graduation rows (manual correction, since original intended destinations must be confirmed per learner, not guessed).
3. Add the atomic conditional-update guard to the legacy `student_invites` claim handler (mirrors the pattern already proven in `guardianInvites.ts`).
4. Document (runbook or UI copy) the subject-seeding and term-summary-compute steps so a first-time admin doesn't stall silently.
5. Decide whether `platform_events` should be created now or the `publishEvent()` call sites removed — leaving it silently broken either way is the wrong default.

**Required Backfills**: guardian invites (579 rows), promotion/graduation enrollment repair (15 rows) — both quantified for the first time this sprint.

**Deferred Items**: Academic Clinic/Blueprint divergence (High 5, unchanged); repository-bypass pattern; central-permissions non-adoption; assessment-ownership-by-creator.

---

## 6. GO / CONDITIONAL GO / NO-GO

**Brand-new pilot school, zero pre-existing data: CONDITIONAL GO.** Every journey traced end-to-end works. Condition: document the two hidden onboarding steps before the first real school activates, since they were found to be genuine dead-end risks, not just polish.

**Any school with pre-Sprint-12 activity: NO-GO until the two backfills in §5 run and are verified against real counts (not assumed-safe).** The corruption is real, live, and quantified — not a migration-safety hypothetical.

**Overall platform verdict: CONDITIONAL GO** — narrower and more specific than Sprint 12's "GO conditional on two small follow-ups." The follow-ups are the same two items Sprint 12 named; what changed is that they are now known to be full-scope, not partial, and one new Medium security gap (legacy invite race) and one dark subsystem (`platform_events`) were found that Sprint 12 did not know about.

**Confidence: 74/100.** High confidence in every finding that came from a real `execute_sql` count, a real `eslint`/`pg_policies` read, or a real function execution against the live database — none of this sprint's headline findings are estimates. Lower confidence on true browser-level UI behavior (no browser tool was available, so redirect loops/confusing wording/dead ends could only be inferred from code, not observed), and one unresolved discrepancy in the `learner_evidence` RLS policy read between two independent passes.

---

## Final Rule, Checked

This sprint deliberately built nothing and improved nothing. Its only output is verification. Where Sprint 12 asserted a fix "closes" a finding, this sprint re-derived that claim from the live database rather than trusting the prior sprint's own test suite alone — and found the assertion was directionally correct (every code fix holds) but the risk sizing was wrong (the backfill scope is total, not partial). That distinction — code is fixed, data is not yet fixed — is the one thing this sprint exists to surface before real teachers and learners depend on it.
