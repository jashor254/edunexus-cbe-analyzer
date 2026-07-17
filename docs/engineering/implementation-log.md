# EduNexus Implementation Log

A durable, append-only record of what actually got built, sprint by sprint. This complements the architecture documents in `docs/architecture/` without turning them into changelogs — those documents describe the *permanent target state and rules*; this log describes *what happened, when, and why*, in Phase B's disciplined, small-commit execution mode.

Every completed sprint, stage, or significant change gets one entry, in this format, newest first:

```
## YYYY-MM-DD — <Sprint/Stage name>

**What changed**: one or two sentences, plain language.

**Architectural documents referenced**: which of the Constitution / RAS / Canonical Domain Registry /
Deprecation Registry / Evolution Blueprint / Execution Plan / Stage 0 / Stage 0.5 governed this change.

**ADR**: link to `docs/architecture/adr/NNNN-title.md`, or "None — no trigger condition met."

**Tests added**: what, and where.

**Rollback considerations**: what it takes to undo this, if anything.
```

Entries are never edited to rewrite history — if a change is later reverted or corrected, a new entry records that, referencing the original.

---

## 2026-07-17 — Sprint 12V: Learner Portfolio Foundation

**What changed**: implemented the first Learner Portfolio implementation sprint against ADR-0011/ADR-0012 (both flipped from DRAFT to Approved as part of this sprint). Phase 1 audit (delegated, verified against current repo state) re-confirmed both ADRs' own findings still hold: no learner-facing Portfolio/Achievement domain, upload pipeline, or storage bucket exists anywhere in the codebase. Built the canonical domain: migration `20260717160000_learner_portfolio.sql` (`learner_portfolios`, `portfolio_items`, `portfolio_media`, `portfolio_tags`, RLS school-isolation policies, a publish-immutability trigger that allows exactly one legal transition — Published → Archived — and rejects every other edit/delete on a published or archived row); `PortfolioRepository` (table access only, one named method per lifecycle transition, no generic update/delete); `lib/learnerPortfolio/` service (Draft → Submitted → Verified → Published → Archived lifecycle with Rejected reachable from Submitted, teacher-only verification workflow, field validation, canonical category enum deliberately excluding every ADR-0012 Achievement-owned concept — Awards/Certificates/Leadership/Competitions/Community Service/Innovation); `composePortfolio()` wired into `composeBlueprint.ts` as a new always-optional section, summary-only (published count + latest/featured highlight + URL), same "ask, never compute" pattern as `composeCareer`. One deviation from the sprint brief, made explicit and confirmed with the user before implementation: the brief's Phase 5 category list included "Innovation," which conflicts with ADR-0012's explicit supersession of Innovation records to the Achievement domain — dropped per user confirmation. Parent Portal/other Blueprint consumers automatically gain the new section with no code change (they already read `composeBlueprint()`'s output), satisfying the "Parent Portal reads Portfolio only through Blueprint" requirement structurally rather than via new integration code.

**Architectural documents referenced**: `docs/architecture/adr-0011-learner-portfolio-architecture.md` (governs the whole domain — ownership, Blueprint relationship, Evidence reference-not-copy rule, paper/digital split), `docs/architecture/adr-0012-learner-achievement-domain.md` (governs the category exclusions), `adr-0005-learner-blueprint-architecture.md` §3, `adr-0008-blueprint-lifecycle-and-rendering.md` (immutability/snapshot precedent), CLAUDE.md (evidence-lifecycle mutation discipline, applied here to Portfolio items).

**ADR**: none new — this sprint implements ADR-0011/0012 as written; no trigger condition (new canonical domain, changed ownership, new architectural layer) was met beyond what those ADRs already cover.

**Tests added**: `lib/learnerPortfolio/portfolio.integration.test.ts` — 7 tests against real synthetic Supabase data: full lifecycle with both service-layer and DB-trigger immutability enforcement (including DELETE on published/archived rows), teacher-reject workflow, canonical-category enforcement (explicitly proving "innovation"/"awards" are rejected), mixed-category multi-item listing, Blueprint composition (empty-portfolio unavailable + published-summary available, asserting the exact 4-field budget), cross-school isolation, and permission checks. Also updated two existing fixture-based pure tests (`composeBlueprint.pure.test.ts`, `lib/parentExperience/growthTimeline.pure.test.ts`) for the new required `LearnerBlueprint.portfolio` field. All pass.

**Rollback considerations**: schema is purely additive (`DROP TABLE learner_portfolios, portfolio_items, portfolio_media, portfolio_tags CASCADE` fully reverses it, zero existing tables touched); `composeBlueprint.ts`'s new section degrades to `unavailable` on any failure without affecting other sections, matching every existing composer's contract, so it can be removed by reverting the one integration commit with no data loss. No UI, routes, or upload capability exist yet — per the sprint's own Stop Condition, Sprint 12W (Achievement) and any Portfolio UI/uploads/QR/AI work await separate approval.

---

## 2026-07-16 — Sprint 10A (partial): End-of-Term Identity Bridge Repair

**What changed**: fixed two confirmed, live FK-space collisions in `computeTermSummaries` (`lib/core/assessments.ts`), the term-aggregation step of `runEndOfTerm()` (`lib/core/endOfTerm.ts`). Discovered while auditing the End-of-Term pipeline for reachability per the Sprint 10A mission brief; scope was deliberately narrowed to this one confirmed blocker rather than the mission's full 9-step scope, per user direction.

**Root cause (two bugs, same underlying cause)**: `computeTermSummaries` mixes two id spaces that a single `classId`/`studentId` cannot both satisfy, confirmed live via `information_schema`:
1. `learner_marks.student_id` FKs to legacy `students.id` (Sprint 9F's academic bridge writes it via `saveScores`), but `term_subject_summaries.learner_id` FKs to Core `learners.id` — the function was writing the legacy id straight into the Core FK column.
2. `class_assessments.class_id` FKs to legacy `teacher_classes.id`, but `term_subject_summaries.class_id` FKs to Core `classes.id` — the function used one `classId` parameter to both read `class_assessments` (needs legacy) and write `term_subject_summaries` (needs Core), which no single id can do.

For any Core-native/bridged school, every `upsertTermSubjectSummaries` call inside `computeTermSummaries` was therefore either finding zero assessments (Core classId passed in, matching nothing in the legacy-keyed `class_assessments`) or failing its FK check outright (legacy classId/studentId passed in, violating `term_subject_summaries`' Core-keyed FKs) — breaking the Assessment → Evidence → Projection → Summaries chain End-of-Term depends on, before Report Cards, Ranking, or Publication are ever reached.

**Repair**: reused Sprint 9F's existing `external_id` bridge mechanism in both directions, no new identity or schema:
- `lib/repositories/teacher.repository.ts`: added `findExternalIdsByStudentIds` (batched legacy `students.id` → Core `learners.id`, via `students.external_id`) and `findLegacyClassIdsByExternalId` (Core `classes.id` → legacy `teacher_classes.id`(s), via `teacher_classes.external_id`).
- `lib/repositories/assessment.repository.ts`: added `findPublishedAssessmentsByClassIds` (batched `.in()` variant of the existing single-class lookup, since a Core class can bridge to zero or more legacy classes).
- `lib/core/assessments.ts::computeTermSummaries`: now resolves the Core `classId` to its bridged legacy class id(s) before reading `class_assessments`/`learner_marks`, and resolves each mark's `student_id` back to its Core learner before writing `term_subject_summaries.learner_id`. A mark with no resolvable bridge is skipped (not written with an invalid id) — matches the function's existing "skip unknown subject code" defensive pattern.
- `app/api/core/assessments/route.ts`'s `compute` action: was passing the resolved `legacyClassId` into `computeTermSummaries` (itself part of this session's uncommitted in-flight work) — corrected to pass the Core `classId`, matching the function's corrected contract.

**Explicitly out of scope**: the remaining 8 steps of the Sprint 10A mission brief (UI reachability for triggering End-of-Term, publication-workflow re-validation, parent/teacher/admin experience re-audit, full regression). `generateReportCards`/`publishReportCards`/Ranking/Grading were independently verified already correct (derive from `term_subject_summaries`, not raw marks; publish-overwrite guard intact) and were not modified.

**Tests added**: `lib/core/computeTermSummariesBridge.test.ts` (2 tests, integration-style against real synthetic Supabase data, following this series' established convention) — proves a bridged mark's `student_id` resolves to the correct Core `learner_id` (not the legacy id) in the written summary row, and proves an orphaned mark with no resolvable bridge is skipped rather than written with an invalid `learner_id`. Full regression: all 70 tests across `academicReadMigration`, `academicBridge`, `academicActivation`, `schoolActivation`, `learnerOnboarding`, `teacherOnboarding` test suites still passing; all 36 tests across the report-card/grading suites (`reportCardOwnership.security`, `reportCardPublicationGuard.integration`, `toCbcLevel.grading.regression`, `generateReportCards.ranking`, `reportCardWithSubjects`) still passing. Typecheck and lint clean on all changed files.

**Architectural documents referenced**: `docs/architecture/learning-intelligence-migration-strategy.md` §3 (the bridge's temporary-not-permanent scoping, respected — no new bridge mechanism invented, the existing `external_id` link reused in both directions).

**ADR**: None — no new canonical identity, ownership model, layer, or domain; reuses Sprint 9F's already-approved bridge mechanism for its designed purpose.

**Rollback considerations**: five files changed (`lib/core/assessments.ts`, `lib/repositories/teacher.repository.ts`, `lib/repositories/assessment.repository.ts`, `app/api/core/assessments/route.ts`) plus one new test file, each independently revertible via `git checkout --`. Reverting restores the pre-fix state where `computeTermSummaries` silently produces zero or FK-violating rows for any bridged school — a known-broken state, not a regression risk.

---

## 2026-07-16 — Sprint 10A Commit 3: End-of-Term Operational UI Activation

**What changed**: built the first teacher- and admin-facing UI for the Core End-of-Term pipeline. Before this commit every step (lock, compute, generate, publish) was only reachable via direct API calls — confirmed by audit: zero pages anywhere called `/api/core/{assessments,reports,school/end-of-term}`, and `app/teacher/reports` (the only "reports" screen found) is the unrelated legacy Academic Clinic PDF system. One real orchestration gap was also found and closed: `publishAssessment()` (the "lock assessment" step) had a service function but no route ever called it.

**New backend (thin, no new business logic)**:
- `app/api/core/assessments/route.ts`: added a `publish` POST action — same auth pattern as the sibling `compute` action (`ensureBridgedClass` + `requireCanManageAssessment`), thin call-through to the existing, unmodified `publishAssessment()`.
- `app/api/core/my-membership/route.ts` (new): resolves the caller's own Core school + role + current term, self-scoped by authentication only — same pattern as the existing `app/api/reports/report-card/mine/route.ts`, and reuses `repos.schools.findSchoolUserByUserId`, the same single-membership lookup already used unmodified by three existing `app/api/school/*` routes. No new resolution strategy.

**New UI**:
- `app/teacher/core-term/page.tsx`: the teacher journey — select class, lock each assessment, generate summaries, generate report cards, publish report cards — each a direct call to an existing route. A status row (Assessments Locked / Summaries Generated / Reports Generated / Reports Published) reads state already returned by those routes; no new computation.
- `app/teacher/core-term/status/page.tsx`: the Headteacher/Academic Office view — per-class assessment/report completion for the current term, plus a school-wide "reports published %". Read-only, no mutation actions (Phase 7 scope guard).

**A placement bug found and corrected via actually running the app**: this admin status screen was first built under `app/admin/core-schools/status`, following the styling precedent of `app/admin/core-schools/new`. Running it end-to-end in a real browser surfaced that `proxy.ts` hard-gates all of `/admin/*` to one specific internal platform email — not any real school's admin/headteacher. This platform also has no separate "school_admin" platform-auth role distinct from `teacher` (confirmed in `proxy.ts`'s own role gate and the login redirect logic). The page was moved to `app/teacher/core-term/status` — reachable the same way any teacher reaches `app/teacher/core-term` — and gates its *content* (not its route) on the existing Core `role` field from `/api/core/my-membership`, restricted to `school_admin`/`headteacher`/`deputy_headteacher`. No new platform role was introduced.

**Two more findings surfaced only by running the app for real, not from reading code**:
1. `activateSchool()` creates terms but never marks one `is_current` — every newly activated school shows "No current term is set" until an admin explicitly calls the existing `set-current-term` action. Not caused by this commit and not fixed here (out of scope — no business-logic changes); flagged as the one real remaining blocker to a brand-new school using this UI immediately after activation.
2. The initial dark-theme styling (copied from the standalone `app/admin/core-schools/new` page) rendered as invisible white-on-white text once actually loaded inside the real `app/teacher` layout, which is light-themed (`bg-slate-50`, `slate-900` text, teal-600 accents, confirmed from `app/teacher/dashboard/page.tsx`). Corrected before verification passed. Both findings are logged here because they would not have been caught by typecheck, lint, or the unit/integration test suite — only by loading the actual page.

**Verification method**: full manual browser run (not just tests) — created a real Supabase-authed teacher fixture and a real school with a class/learner/assessment, ran `next dev`, logged in via the actual `/login` form with Playwright, and drove the complete journey through the rendered UI: locked the assessment, generated summaries, generated report cards, published them (as a promoted school_admin, since generate/publish are admin-gated — confirmed the non-admin teacher correctly gets a 403, not a crash, exercising the existing, unmodified permission boundary), and confirmed the status page showed "100% Reports published" with the correct per-class pills. Screenshots taken at every step. All fixture data and the temporary role promotion were cleaned up afterward; nothing from the verification run was committed.

**Tests added**: `lib/core/granularEndOfTermFlow.test.ts` (1 integration test, real synthetic Supabase data) — exercises the exact four-call sequence the new UI drives (lock → compute → generate → publish, as separate calls, not the one-shot `runEndOfTerm()` Commit 2's test already covers), asserting the intermediate state at every step matches what the UI's status row reads. Full regression: 42 tests across `granularEndOfTermFlow`, `computeTermSummariesBridge`, `endOfTermFullChain`, `reportCardOwnership.security` (including all SH-001 exploit-blocked cases), `reportCardPublicationGuard.integration`, and `permissions` — all passing. Typecheck and lint clean on all changed/new files.

**Explicitly not built (Phase 7 scope guard)**: attendance, analytics dashboards, notifications, a workflow engine, approvals, messaging, email, or any parent-portal changes. The existing parent report-card page (`app/(parent)/report-card`) was not touched — already correctly published-only gated.

**Architectural documents referenced**: none new — this commit composes Commit 1/2's already-fixed services and existing permission functions; no canonical-domain, identity, or Constitution/RAS question was involved.

**ADR**: None — no new identity, ownership model, layer, domain, or Constitution/RAS conflict. The `my-membership` route reuses an existing repository method for its existing designed purpose; the `publish` action reuses an existing service function.

**Rollback considerations**: two new route files, two new page files, one changed route file (`app/api/core/assessments/route.ts`, additive only), one new test file — every one independently revertible via `git checkout --`/deletion with no data or schema impact. Reverting restores the pre-commit state where End-of-Term is API-reachable but not screen-reachable by any teacher or admin — a known gap, not a regression risk.

---

## 2026-07-16 — Sprint 10A Commit 2: End-of-Term Workflow Activation (verification)

**What changed**: found and fixed a third instance of Commit 1's class_id identity-space bug (this one in `listAssessments`/`runEndOfTerm`'s own lock check, not `computeTermSummaries`), then proved the complete End-of-Term journey works end-to-end against real bridged fixture data — Assessment → Evidence → Projection → Summaries → Ranking → Report Cards → Publication → Parent view → Term closed — via a new integration test that drives `runEndOfTerm()` exactly as a school would. No new orchestration, routes, or UI were added — per user direction, this commit was scoped to verification only.

**Root cause (third instance of the same bug class)**: `listAssessments` (`lib/core/assessments.ts`, called by `runEndOfTerm`'s unpublished-assessment lock check and by `GET /api/core/assessments`) queried `class_assessments.class_id` directly with the caller-supplied `classId` — but every real caller supplies a Core `classId`, and `class_assessments.class_id` FKs to legacy `teacher_classes.id` (confirmed live, same as Commit 1's finding). The lock check was therefore always vacuously "no unpublished assessments found," regardless of actual state — not a crash, a silent no-op, which is why it wasn't caught by Commit 1's tests (those called `computeTermSummaries` directly, never through the full `runEndOfTerm` lock-check path).

**Repair**: same bridge-resolution pattern as Commit 1, no new mechanism — `lib/repositories/assessment.repository.ts::listAssessmentsByClassIds` (new, batched `.in()` variant), `lib/core/assessments.ts::listAssessments` now resolves the Core `classId` to its bridged legacy class id(s) via `repos.teachers.findLegacyClassIdsByExternalId` before querying, mirroring `computeTermSummaries`'s existing fix.

**Step 1/2 audit finding (verification, not a defect)**: every End-of-Term stage — compute (`/api/core/assessments`, action=`compute`), generate/publish (`/api/core/reports`), and the one-shot orchestrator (`/api/core/school/end-of-term`) — was already correctly orchestrated, correctly ordered, and correctly permission-gated at the API layer once Commit 1 + this commit's fix landed. The only genuine "dormancy" is UI reachability: no teacher/admin page calls any Core report-card route (`app/teacher/reports` is the unrelated legacy Academic Clinic PDF system, confirmed by reading it). Parent side is not dormant — `app/(parent)/report-card/page.tsx` already exists, already published-only gated, SH-001 tests already passing. Per explicit user direction, closing the teacher/admin UI gap was deferred rather than built this commit — documented as the readiness state below rather than left silent.

**Tests added**: `lib/core/endOfTermFullChain.test.ts` (1 comprehensive integration test, real synthetic Supabase data) — two learners with different scores through the full pipeline, asserting: the lock check correctly blocks on a real unpublished assessment (not vacuously), Ranking assigns correct positions or ties, Grading assigns correct CBC levels, the parent-facing `getReportCard` only returns the report once published, `setCurrentTerm` correctly archives the old term and activates the new one, and — Step 4's failure-recovery requirement — re-running `runEndOfTerm()` after publication fails safely (existing Sprint 5B guard) without corrupting the already-published cards. Full regression: all suites from Commit 1 re-run and still green (70 + 36 tests), plus `permissions`, `identity`, `context`, `coreAssessmentTypeIntegrity` (this commit's additional regression scope) — 2 unrelated transient network failures (`TypeError: fetch failed`) reproduced as passing in isolation, not real regressions. Typecheck and lint clean on all changed files.

**Leadership status API (Step 7, documented per the mission's own "don't build dashboards" allowance)**: `GET /api/core/reports?classId=&termId=` already returns every report card's `is_published` state per learner — sufficient to observe generation/publication progress without new UI.

**Architectural documents referenced**: same as Commit 1 — `docs/architecture/learning-intelligence-migration-strategy.md` §3 (bridge scoping respected, no new bridge mechanism).

**ADR**: None — same class of fix as Commit 1, no new identity/layer/domain.

**Rollback considerations**: two files changed (`lib/core/assessments.ts`, `lib/repositories/assessment.repository.ts`) plus one new test file, independently revertible via `git checkout --`. Reverting restores the pre-fix state where `runEndOfTerm`'s lock check is a silent no-op for any bridged school — a known-broken state, not a regression risk.

---

## 2026-07-16 — Sprint 9G: Canonical Academic Read Path Migration (IMPLEMENTATION)

**What changed**: audited every academic read surface (Teacher Dashboard, the roster-based class view, Learner Timeline, Career Intelligence, Academic Clinic, Compass, Report Cards) against the canonical identity chain, and extended `lib/core/academicBridge.ts` with four small resolve-then-call wrapper functions plus one real gap fix (`class_students` roster visibility), rather than a broad rewrite — because the audit's central finding is that almost nothing needed migrating in the sense of "point this query at a different table."

**Step 1/2 — the central finding**: every Intelligence-side read this sprint traced — `lib/learnerRecord/timeline.ts:56` (`getLearnerTimeline(studentId)`), `lib/learnerIntelligence/careerIntelligence.ts:150` (`buildCareerIntelligence(studentId)`), `lib/academicClinic/assessmentPipeline.ts` (`runAssessmentPipeline({studentId,...})`), and `lib/compass/ownership.ts` (`resolveTeacherOwnership`/`resolveCompassStudentAccess`, both `students.teacher_id`/`class_students`-based) — was **already** uniformly keyed to the legacy `students.id`, the same identity ADR-0002/Stage 0.5 already treat as canonical for the Evidence-anchored side of the platform (restated from Sprint 9F's own dependency validation, re-confirmed here). There was never a second, Core-native version of any of these reads to migrate *to* — Core's `learners.id` and legacy `students.id` answer two different questions (institutional identity vs. Evidence-anchored identity), not two competing answers to the same one. "Canonical read migration," for this half of the platform, is therefore exactly one operation: resolve a Core-originated learner to its bridged legacy identity (created lazily on first real use, Sprint 9F), then call the existing, completely unmodified read. Building a second implementation of any of these reads would have been exactly the "duplicated orchestration" this sprint's Architectural Rules forbid — so none was built.

**Step 3 — migrations actually made**: `lib/core/academicBridge.ts` gained `resolveLegacyStudentId` (pure lookup, returns `null` — not an error — when a Core learner has no bridge yet, a legitimate, common state for any Sprint 9D learner with no assessment history), `getBridgedLearnerTimeline`, `getBridgedCareerIntelligence`, and `getBridgedCompassAccess`. Each is a thin resolve-then-call wrapper; none contains new business logic. Wired into `app/api/core/learners/[id]/route.ts` as two new `view` query-param branches (`timeline`, `career-intelligence`), mirroring the file's own pre-existing `view=history`/`view=readiness` pattern exactly — no new route file, no new pattern introduced.

**One real gap found and fixed, meeting every one of Step 3's criteria**: a bridged learner was invisible to the roster-based class view (`app/api/teacher/classes/[classId]/route.ts:51-58`, which reads `class_students`, not `students.teacher_id` directly) — even though direct-link reads (Compass, the dashboard's class count) already worked, per Sprint 9F. Initially assumed unfixable without a schema change, since the historical migration file (`supabase/teacher_portal_migration.sql`) declares `class_students.parent_id NOT NULL` and most Core-onboarded guardians have no `auth.users` account to supply one. **Live-schema verification reversed this** — `information_schema.columns` confirms `parent_id` is actually nullable today (a later, undocumented migration relaxed it; the static file is stale). This is the second time this sprint series has found the live schema disagreeing with a static migration file (Sprint 9E's `is_current` gap being the first) — worth establishing as a standing practice: **verify live, never assume from a historical file alone**. Fixed via one new repository method, `TeacherRepository.upsertLegacyClassRoster` (upserts on the live `UNIQUE(class_id, student_id)` constraint), called from `ensureBridgedLearner` on every invocation (not just first creation, so a learner bridged before this sprint self-heals on their next assessment too).

**Step 4-6 — validation, verified live, not assumed**: Teacher Dashboard's `activeClasses` count (`app/teacher/dashboard/page.tsx:47-63`) was replicated verbatim in a test and confirmed to count a bridged class correctly, zero code changes to that page needed. The roster-based class view's exact query (`app/api/teacher/classes/[classId]/route.ts:51-58`) was replicated and confirmed to now include the bridged learner (post-fix). Cross-school isolation was directly tested: a School B teacher gets `allowed: false` from `resolveCompassStudentAccess` against a School A bridged learner, and School B's own `teacher_classes` count is unaffected by School A's bridge activity. Duplicate prevention was directly tested: resolving the same learner's bridge twice creates zero additional `students` or `class_students` rows.

**Step 7 — a second, independent, previously-undiscovered identity mismatch found in Core's own Report Card write path, documented not fixed**: `term_subject_summaries.learner_id NOT NULL REFERENCES learners(id)` and `term_subject_summaries.class_id NOT NULL REFERENCES classes(id)` — both confirmed live via `information_schema` — require **Core** identities. But `lib/core/assessments.ts::computeTermSummaries()` (lines ~210-236) builds its insert rows from `mark.student_id` (the **legacy** `students.id`, from `learner_marks` — exactly what Sprint 9F's bridge produces) and the **legacy** `classId` parameter it's called with. This means Core's Report Card pipeline (`computeTermSummaries` → `generateReportCards` → `publishReportCards`, and therefore the parent-facing `GET /api/reports/report-card` route, which reads `getReportCard()` off `school_report_cards`) would violate both FK constraints on any real invocation, bridged or not — a bug that exists **independent of and unrelated to** Sprint 9F/9G's identity bridge work, not something either sprint introduced or claimed to fix. This is a **write-path** bug (constructing the wrong insert), not a read-path identity gap, and therefore correctly outside this sprint's explicitly read-only migration scope ("Migrate only reads that satisfy ALL of..."). Documented here precisely — file, lines, both wrong columns — rather than fixed inline, per Step 7's own explicit branching ("If legacy: can it safely bridge? If no: document").

**Step 8 — Academic Clinic**: already resolvable through the same bridge, zero new code needed — `runAssessmentPipeline({studentId, assessmentId, ...})` (`lib/academicClinic/assessmentPipeline.ts:62-91`) takes a legacy `studentId` directly, identical shape to Career Intelligence. Not executed end-to-end this sprint (it has non-identity dependencies — a seeded `node_assessment_map`/career-matching dataset — unrelated to identity resolution and out of this sprint's scope to seed); the identity question itself (`resolveLegacyStudentId` + the pipeline's existing signature) is fully answered and requires no blocker documentation.

**Step 9 — Career Intelligence**: same answer, verified directly (not just read) — `getBridgedCareerIntelligence()` was called end-to-end in the test suite against a real bridged learner and returned the correct, unmodified `CareerIntelligence` shape (`studentId` resolved to the bridged legacy id, `mode: 'planning'` correctly derived from the learner's Grade 10).

**A third, separate, correctly-untouched finding**: `app/api/teacher/classes/[classId]/route.ts` (the same file whose roster gap this sprint fixed) also reads a **third**, distinct legacy `assessments` table (not `class_assessments`, which the bridge writes to) for its "latest assessment/level" summary display. A bridged learner's roster entry now appears correctly, but their assessment/level column on this specific view will show empty until that table is separately populated — this is Sprint 6D/6H's already-documented multi-table Assessment duplication (not a new finding), correctly left untouched: fixing it would mean choosing which of three assessment tables is authoritative for this view, a design decision, not a read-migration.

**Architectural documents referenced**: `docs/architecture/learning-intelligence-migration-strategy.md` §3 (the bridge's temporary framing, unchanged and un-expanded — every new function this sprint added is a resolver *around* the existing bridge, not a new permanent mechanism); `docs/architecture/sprint-9a-phase2-school-activation-audit.md`, `docs/architecture/migration-ledger.md` (Career Intelligence/Blueprint already confirmed Projection-sourced, restated as the reason `buildCareerIntelligence` needed no changes); `docs/architecture/adr/0002-canonical-teacher-identity.md` (untouched — every read migrated resolves through the same `teachers.id`, directly verified in a dedicated test asserting the bridged class's `teacher_id` matches the dashboard's own `teachers` lookup); `docs/architecture/reference-architecture-specification.md` §4 (the one repository addition, `upsertLegacyClassRoster`, lives on the already-canonical `TeacherRepository`, which already owns both `class_students`-adjacent and Core `classes` queries).

**ADR**: None — no canonical identity, domain, or ownership change; every function added resolves through already-ratified identities (ADR-0002's `teachers.id`, Sprint 9F's bridge), and the one real fix (`class_students`) uses an existing, unconstrained-in-practice column, not a schema change.

**Tests added**: `lib/core/academicReadMigration.test.ts` — 10 integration tests against real synthetic rows on the live Supabase project: Teacher Dashboard's exact query replicated, the roster-view fix verified, Learner Timeline (both the happy path and the legitimate `null`-for-no-bridge-yet case), Career Intelligence, Compass access (both the allow and the cross-teacher-deny case), cross-school isolation, duplicate prevention, and canonical identity consistency across dashboard/bridge/Compass. All 10 passing (one run showed a single transient `ETIMEDOUT`/`AuthRetryableFetchError` on the very first `auth.admin.createUser` call of the process — confirmed environmental by re-running three times, always the same single early test, never a logic failure, never recurring past the first network call of a run). Full regression suite re-run across all seven `lib/core/*.test.ts` files in this series — **91/91 passing** (19 schoolActivation + 12 teacherOnboarding + 11 learnerOnboarding + 9 academicActivation + 9 academicBridge + 10 academicReadMigration + 21 permissions). Zero residual synthetic rows confirmed after the full run. Full-project `tsc --noEmit` clean throughout.

**Performance impact**: negligible. Each new resolver is a single existence-check read (`findLegacyStudentByExternalId`) before delegating to an already-existing, already-optimized read function; `upsertLegacyClassRoster` adds one upsert per learner-bridge call, already inside the existing per-learner loop in `recordBridgedMarks` (not a new loop).

**Backward compatibility**: full. No existing function's signature or behavior changed except the internal addition inside `ensureBridgedLearner` (a `students` row now also gets a `class_students` link — purely additive, no caller observes a different return shape). The two new route views are new, additive query-param branches; no existing branch changed.

**Security validation**: re-confirmed, not assumed — cross-school isolation and cross-teacher-denial are both directly, freshly tested in this sprint's own suite (not just re-run from Sprint 9F's), against the new read surfaces specifically, not only the write path 9F covered.

**Remaining legacy reads, explicitly out of scope**: Core's Report Card pipeline (Step 7's finding, a write-path bug); the third `assessments` table read by the class-detail dashboard; anything Career Intelligence/Academic Clinic themselves internally still read from `learner_profiles` rather than pure Projection (already tracked in `docs/architecture/migration-ledger.md`, not this sprint's concern — this sprint verified reachability, not internal migration status, per Steps 8-9's own "do not redesign" instruction).

**Rollback considerations**: trivial. Every function added is new, additive, and — except `upsertLegacyClassRoster`'s call inside `ensureBridgedLearner` — has no caller yet outside its own test and the two new route views. Reverting is deleting the four new functions, the one repository method, the two route branches, and the test file; no existing behavior needs to be restored because none was changed.

---

## 2026-07-16 — Sprint 9F: Core Academic Bridge (IMPLEMENTATION)

**What changed**: built `lib/core/academicBridge.ts` and wired it into the existing `app/api/core/assessments/route.ts`, closing the gap every sprint since 9A (§3.1) had left honestly `false`: a learner admitted through the Core lifecycle (School → Teacher → Class → Enrollment, Sprints 9B–9E) can now have a real assessment created, marked, and flow through Evidence → Projection → Compass — the platform's existing, unmodified, most production-hardened pipeline. `getLearnerReadiness()`'s `eligibleForAssessment`/`eligibleForCompass` both flip to `true` post-enrollment. Verified end-to-end against the live database, not asserted: one test admits+enrolls a learner, creates an assessment, records marks, then directly queries `learner_evidence` (confirms a real `auto_confirmed` row), `learner_projections` (confirms a real persisted row), and calls `lib/compass/ownership.ts::resolveCompassStudentAccess` (confirms the bridged teacher is granted access via `'teacher_direct'`) — all through code paths this sprint did not modify.

**A mid-sprint architectural conflict, surfaced and resolved before writing code, not after**: `docs/architecture/learning-intelligence-migration-strategy.md` §3 explicitly rejects "a permanent bridging adapter... a layer whose job is to hide the fact that two different, both-still-live schemas exist, forever" — which is structurally what this sprint's ask requires. That document's own mandated path (a Core-native `LearnerContext` domain layer, 13 phases, Phase 1 of 13 complete) is real, multi-sprint work, not achievable in one sprint. Flagged directly to the user before implementation began; the user chose to proceed with a bridge **explicitly scoped as temporary, Phase-0-style infrastructure** (that document's own carve-out for "a temporary migration script/mechanism... during a defined cutover window") rather than either silently building the permanent adapter that document rejects, or silently declining the sprint's actual ask. `lib/core/academicBridge.ts`'s header states this explicitly, names its own retirement condition (Phase 11 — Compass ported onto `LearnerContext`), and restricts itself to being the only file in the codebase that imports the bridge mechanism.

**Step 1 — dependency validation, verified live this session, not carried over from Sprint 9A's now 5-sprint-old findings**:
| Layer | Identity expected | Confirmed via |
|---|---|---|
| `class_assessments.class_id` | legacy `teacher_classes.id` | live FK query — unchanged from 9A, re-confirmed |
| `class_assessments.teacher_id` / `learner_marks.teacher_id` | legacy `teachers.id` (ADR-0002) | live FK query; **already satisfied** — Sprint 9C's `acceptTeacherInvitation()` already creates this row, zero teacher bridge needed |
| `learner_marks.student_id` | legacy `students.id`; `lib/assessments/evidence.ts::recordAssessmentEvidence` silently **skips** any mark row where this is null | direct code read |
| `learner_evidence.learner_id` | legacy `students.id` (FK, live query) | `information_schema` — resolves the "which table" ambiguity Sprint 9A's research left as an inference |
| `lib/compass/ownership.ts::resolveTeacherOwnership` | `students.teacher_id` (direct) or `class_students` roster | direct code read — confirms Compass needs **no separate bridge**, the same student/class bridge Assessment needs already satisfies it |
| Report Cards (Core `runEndOfTerm`) | Core `classes.id` **as written**, but blocked by the same `class_assessments` FK as everything else — `lib/core/endOfTerm.ts`'s own header comment already documented this exact gap as deliberately deferred to a named future "Phase 11" | direct code read |

**Two independent, pre-existing bugs found and fixed** (both squarely inside the activation path, not adjacent — left unfixed, Step 2 could not have succeeded regardless of the identity bridge):
1. `app/api/core/assessments/route.ts`'s `save-scores` action passed `schoolUser!.id` (a Permissions-domain `school_users.id`) as the `teacherId` argument to `saveScores()`, which requires the ADR-0002 canonical `teachers.id` (`learner_marks.teacher_id → teachers(id)`, `NOT NULL`) — would have violated the FK on every real call. Fixed by routing through the same `resolveTeacher`/bridge-resolved teacher identity `createAssessment` above it already used correctly.
2. `AssessmentRepository.saveScores()`'s upsert targeted `onConflict: 'assessment_id,student_id'`, but the live unique constraint on `learner_marks` is `learner_marks_assessment_student_unique = UNIQUE(assessment_id, student_name)` — confirmed via `pg_constraint`. Every real call would have thrown "no unique or exclusion constraint matching the ON CONFLICT specification." Fixed to target the constraint that actually exists (`lib/repositories/assessment.repository.ts`).

**The bridge itself** (`lib/core/academicBridge.ts`): `ensureBridgedClass(schoolId, coreClassId, actingUserId)` resolves or creates a `teacher_classes` shadow row (linked via the already-existing `external_id` column — schema infrastructure that predates this sprint, previously used only by `scripts/reference-school/06-seed-legacy-bridge.ts`'s disposable seed data), owned by the acting teacher's already-canonical `teachers.id`. `ensureBridgedLearner` does the same for `students`, requiring the learner to actually be enrolled in the class first (reuses Sprint 9D's `getLearner`, school-scoped). `createBridgedAssessment`/`recordBridgedMarks` are thin wrappers that resolve identities, then call the **existing, unmodified** `lib/core/assessments.ts::createAssessment`/`saveScores`, `lib/assessments/evidence.ts::recordAssessmentEvidence`, and `lib/projection/recompute.ts::recomputeLearnerProjection` — no ranking, grading, Evidence, or Projection logic was read or modified beyond the one unrelated `saveScores` bug above.

**Security — additions, not weakenings** (Step 7, directly tested): `ensureBridgedClass` requires active school membership (throws `MembershipRequiredError` otherwise) and, when a Core class has an explicit `class_teacher_id` assigned, **only that specific teacher (or an admin) may bridge it** — a real ownership check that did not exist before this sprint (Core classes have never had any authorization concept beyond school membership), added *in addition to*, not instead of, the pre-existing `requireCanManageAssessment`/`requireClassTeacher` gate the route still runs afterward, unchanged, against the now-resolved legacy id. Both the deny case (wrong teacher) and the allow cases (assigned teacher; admin override) are directly tested.

**A real bug found in this sprint's own test infrastructure, worth recording**: the first version of `academicBridge.test.ts`'s `after()` cleanup called `.delete()` on bridged `students` rows without checking `.error` — the delete silently failed on live foreign-key violations (`learner_evidence`, `evidence_audit_log`, `evidence_projection_events`, `learner_marks`, `learner_projections` all still referenced the row) and orphaned synthetic rows survived undetected across three separate test runs before being caught by a manual residual-row check. Fixed by deleting the full dependency chain in order before the `students` row itself, and by switching from a manually-threaded happy-path-only tracking array to a sweep keyed off Core `external_id` (robust against a future test failing mid-call, exactly what caused the first version of this bug). Recorded here because "the test passed" and "cleanup actually worked" turned out to be two different facts, silently — a pattern worth watching for elsewhere in this codebase's `after()` hooks.

**Known limitations / remaining scope, explicitly deferred to Sprint 9G per the sprint's own Stop Condition**:
1. **GET-path reads on `app/api/core/assessments` are not bridged** — `listAssessments`/`getClassPerformanceSummary`/`getAssessmentScores` still expect a legacy class id directly; a caller must currently resolve the bridge themselves (via the `legacyClassId` returned by `createBridgedAssessment`) rather than pass a Core class id to `GET`. Scoped out to keep this sprint to "the smallest bridge necessary... to create their first Assessment" (Step 2's own wording), not full CRUD parity.
2. **Report Cards** (Core's `runEndOfTerm`) are not wired — `lib/core/endOfTerm.ts`'s own pre-existing header comment already named this exact gap and deferred it to "Phase 11"; this sprint's Stop Condition does not require it (only "first assessment successfully reaches Projection" and `eligibleForCompass`/`eligibleForAssessment`, both achieved).
3. **Career Intelligence, Academic Clinic, and administrative workflows** — explicitly out of scope per the sprint's own instruction ("Do not continue... Those become the starting point for Sprint 9G").
4. **The bridge is per-(class, teacher) and per-learner, lazily created on first real use** — it does not pre-populate a legacy shadow for every Core class/learner at activation time, matching "smallest bridge necessary," but meaning `eligibleForAssessment: true` reports capability, not a guarantee a bridge row already exists for that specific learner (see `learnerOnboarding.ts`'s updated doc comment).

**Architectural documents referenced**: `docs/architecture/learning-intelligence-migration-strategy.md` (the central conflict this sprint navigated, cited directly in `academicBridge.ts`'s own header); `docs/architecture/sprint-9a-phase2-school-activation-audit.md` §3.1 (the gap this sprint closes); `docs/architecture/adr/0002-canonical-teacher-identity.md` (preserved exactly — no second teacher identity, `teachers.id` reused as-is throughout); `docs/architecture/reference-architecture-specification.md` §4 (repository ownership respected — bridge methods added to the already-canonical `TeacherRepository`, which already owned both `teacher_classes` and Core `classes` queries), §8 (Security Standards — the new ownership check follows the existing "shared check, never per-route reimplementation" pattern, added to the service layer, called from the route unchanged).

**ADR**: None — this was explicitly confirmed with the user as a temporary, scoped exception to `learning-intelligence-migration-strategy.md` §3, not a permanent architectural decision requiring one. No canonical identity was introduced (ADR-0002 untouched); the bridge creates shadow rows in an already-existing, already-provisioned schema mechanism (`external_id`), not a new identity concept.

**Tests added**: `lib/core/academicBridge.test.ts` — 9 integration tests against real synthetic rows on the live Supabase project: the full Step 10 end-to-end path (Create School → Activate → Invite/Accept Teacher → Admit → Enroll → Assessment → Evidence → Projection → Compass, with real assertions at every stage, not just "didn't throw"), class-bridge idempotency, learner-bridge idempotency, no-duplicate-teacher-identity, three security tests (school isolation, ownership-respected-not-weakened, admin override), ranking/grading preserved (two learners, real score-based position assignment verified), and repeated-marks-recording idempotency. All 9 passing after two real bugs were found and fixed mid-sprint (the `saveScores` onConflict bug, and the test's own cleanup bug) — both verified fixed by re-running to green and confirming zero residual synthetic rows via direct query, not assumed from a passing test run alone. Re-ran the full prior-sprint regression suite (`schoolActivation` 19, `teacherOnboarding` 12, `learnerOnboarding` 11, `academicActivation` 9, `permissions` 21 — 72/72) — no regressions from the `learners.ts`/`assessment.repository.ts`/`types/core.ts` changes. Full-project `tsc --noEmit` clean throughout.

**Performance impact**: low. Bridge resolution adds 2-4 existence-check reads per assessment-creation/marks-recording call (not per learner in a loop beyond the marks batch itself, which is already the natural unit — one bridge check per learner being marked, matching the existing `saveScores` batch shape). No new indexes required — all lookups use already-indexed columns (`external_id` has no dedicated index, matching the pre-existing precedent from Sprint 9B's `classes` table and Sprint 9D's `learner_guardians`; acceptable at pilot scale, flagged if it ever needs revisiting at higher volume).

**Backward compatibility**: full for every existing caller. `app/api/core/assessments/route.ts`'s Zod schemas are unchanged in shape except `SaveScoresSchema`'s `learner_id` field renamed to `coreLearnerId` (justified in-code: no caller could have succeeded against this action before this sprint, per the pre-existing bugs above — nothing to preserve compatibility with). `lib/core/assessments.ts::createAssessment`/`saveScores` themselves are completely unmodified.

**Risk assessment**: the bridge's own header names its risk honestly — it is real, acknowledged technical debt (a second, shadow identity space per bridged class/learner) accepted deliberately for pilot velocity, not free. Mitigated by: explicit temporary framing and a named retirement condition; zero changes to Evidence/Projection/Ranking/Grading internals (the debt is fully contained to identity resolution, not spread through the intelligence engines); real, tested security checks; and a single, greppable entry point (`lib/core/academicBridge.ts`) that must be deleted, not refactored, when Phase 11 lands — nothing else in the codebase should ever import from it.

**Rollback considerations**: moderate — higher than any prior sprint in this series, stated plainly. `lib/core/academicBridge.ts` and its test are new, no other file imports it except `app/api/core/assessments/route.ts`, so code rollback is a small, bounded diff. Real data risk if this ships and accrues live bridge rows: reverting the bridge *code* after real schools have used it would strand those schools' assessment history in orphaned `teacher_classes`/`students` shadow rows with no Core-side view of them — any future decision to retire this bridge must include a data migration step, not just a code revert. Not a concern for the pilot's current pre-launch state, but recorded here so it isn't rediscovered the hard way later.

---

## 2026-07-16 — Sprint 9E: Academic Activation Engine (IMPLEMENTATION)

**What changed**: built `lib/core/academicActivation.ts` — a single, read-only, consolidated readiness report (`getSchoolAcademicReadiness()`) that answers "is this school's academic structure actually ready to teach in" by orchestrating existing Sprint 9B/9C/9D functions plus a handful of small new aggregators. This module creates nothing, mutates nothing — every figure in the report comes from an existing `lib/core/*.ts` function call, verified directly in a dedicated test that the report is byte-identical and row-count-identical across two consecutive calls.

**Readiness model (Part 6)**: `SchoolAcademicReadiness` resolves, in dependency order, exactly the Target Workflow's chain — Academic Year → Term → Grades-in-use → Subjects (per grade in use) → Teachers (school-wide) → Classes → Learners (school-wide, per term) — and reduces every unresolved link to a plain-English reason collected into one `blockingReasons` array, so a caller never has to re-derive "why isn't this school ready" from six separate sub-reports by hand. `overallReady` is `true` only when every one of those six links resolves; a school missing even one (e.g., zero teachers) reports `overallReady: false` with the exact reason, not a vague failure.

**One real, non-obvious gap surfaced, not silently worked around**: `lib/core/schoolActivation.ts`'s `ensureAcademicYear`/`ensureDefaultTerms` (Sprint 9B) never call `setCurrentAcademicYear`/`setCurrentTerm` — confirmed directly this session (`academic_years.is_current` is `false` for every row on every school activated purely through Sprint 9B's pipeline). This means `getCurrentAcademicYear()`/`getCurrentTerm()` (both `is_current`-only) would return `null` for every real activated school, which would make "academic year active" spuriously false platform-wide. `resolveActiveAcademicYear`/`resolveActiveTerm` (this sprint) instead reuse the **exact same** "is_current row, else the first row" fallback `getSchoolActivationStatus()` (Sprint 9B) already established — not a new rule invented here, the same one, applied consistently, per RAS §5's "never duplicate business logic." Flagged as a candidate fix for whoever next touches `schoolActivation.ts` (see Known limitations below) rather than patched inline in what's supposed to be a read-only reporting module.

**Part 3 — subject readiness, no redesign**: `resolveSubjectReadiness()` reads Core's `grade_subjects` exclusively (via the pre-existing `listGradeSubjects()`, `lib/core/subjects.ts`) — the RAS §3-named canonical Subject-domain source — for every grade the school actually has a class in (not the full global catalogue; a primary-only school isn't marked "missing subjects" for grades it doesn't teach). The hardcoded `lib/curriculum/subjects.ts` catalogue and SOW's `sow_learning_areas` (Sprint 6D/6B's already-documented three/four-way Subject duplication) are untouched, unread, and unreconciled — exactly as instructed.

**Part 4/5 — teacher/learner readiness, school-wide aggregates, not per-user loops disguised as one**: `getSchoolTeacherReadiness()` calls the pre-existing `listSchoolUsers(schoolId,'teacher')` once, then resolves "how many of these have the ADR-0002 canonical `teachers` row" with **one** new batched repository method (`TeacherRepository.findUserIdsWithTeacherRecord`, a single `.in('user_id', userIds)` query) instead of Sprint 9C's per-teacher `getTeacherReadiness()` called in a loop — the one genuinely-required repository addition this sprint, matching CLAUDE.md's "batch with `.in()`, never query inside a loop" rule directly. `getSchoolLearnerReadiness()` loops over the school's **classes** (typically a handful — the same bounded-loop shape `schoolActivation.ts::ensureClasses` already uses for grade×stream combinations, not a per-learner loop) calling the pre-existing `getClassRoster()` per class — Part 5's own "existing class query," reused verbatim, not replaced with a new aggregate query.

**Part 8 — validation**: `eligibleForAssessment`/`eligibleForCompass` are not read, referenced, or claimed anywhere in this module — Sprint 9D's honest `false` finding stands completely untouched. No ranking/grading/assessment/evidence/projection/report-card file was read or modified. No route was added — the sprint's own Deliverables list omits "route integration" this time (unlike 9C/9D), so `getSchoolAcademicReadiness()` is reachable by direct import only, matching that scope exactly rather than assuming a route was wanted.

**Known limitations / remaining blockers before Assessment activation (Sprint 9F)**:
1. **The `is_current` gap** (see above) — a real, small, isolated fix (`schoolActivation.ts` should probably call `setCurrentAcademicYear`/`setCurrentTerm` after creating the first year/term) that this sprint deliberately did not make, since a read-only readiness reporter mutating state on the side would violate its own contract. Flagged for whoever next touches Sprint 9B's pipeline.
2. **The Assessment/Evidence/Projection connection remains unbuilt**, exactly as Sprint 9D left it — `class_assessments.class_id` still FKs to the legacy `teacher_classes`, not Core's `classes` (Sprint 9A §3.1). This readiness report proves the *academic structure* (year, term, subjects, teachers, classes, learners) is coherent; it does not and cannot claim assessment readiness, per the sprint's own explicit instruction — that transition (`eligibleForAssessment`/`eligibleForCompass`: false → true, through real integration) is Sprint 9F's named scope.
3. **Subject duplication is read, not reconciled** — this module picks Core's `grade_subjects` as the source of truth for its own report, but the legacy/curriculum/SOW representations (Sprint 6B/6D) still exist in parallel, unaffected, and a teacher-facing UI reading one of those instead would see a different picture than this readiness report. Reconciling them remains the larger, separately-scoped decision Sprint 6H already named.

**Architectural documents referenced**: `docs/architecture/sprint-9a-phase2-school-activation-audit.md` (§3.1, restated as this sprint's own explicit non-goal); `docs/architecture/sprint-8a-operating-system-implementation-blueprint.md` (background context, no new citation needed — its Stage 0/Year 1 "activation" priority is what Sprints 9B–9E have been executing); `docs/architecture/reference-architecture-specification.md` §3 (Subject/Grade as shared reference data — why subject readiness is read-only and scoped to grades-in-use), §4 (the one repository addition is a genuinely-missing, CLAUDE.md-mandated batched query, not a duplicate), §5 (reusing `getSchoolActivationStatus()`'s exact fallback rather than inventing a second one); `docs/architecture/adr/0002-canonical-teacher-identity.md` (teacher readiness explicitly checks for the canonical `teachers` row, not `school_users.id`, consistent with every prior sprint in this series).

**ADR**: None — no canonical domain, identity, schema, or ownership change; this sprint is purely a read-only aggregation over already-canonical sources.

**Tests added**: `lib/core/academicActivation.test.ts` — 9 integration tests against real synthetic rows on the live Supabase project: missing year, missing term, the `is_current` fallback proven directly against real activated-school data, missing subject source, no teachers, no learners, a partially-configured school (all three downstream gaps reported simultaneously), a fully-ready school (built end-to-end through activation → subject seeding → teacher onboarding → learner onboarding, `overallReady: true`, zero blocking reasons), and repeated readiness evaluation proven to be both stable (`deepEqual` across two calls) and side-effect-free (identical row counts on `classes`/`academic_years` before and after). All 9 passing; zero residual synthetic rows confirmed after a full run. Re-ran `lib/core/schoolActivation.test.ts` (19), `lib/core/teacherOnboarding.test.ts` (12), `lib/core/learnerOnboarding.test.ts` (11), and `lib/core/permissions.test.ts` (21) — 63/63 passing, confirming the one `TeacherRepository` addition caused no regression. Full-project `tsc --noEmit` clean throughout.

**Rollback considerations**: trivial. `lib/core/academicActivation.ts` and its test file are new, with no other callers yet (no route was added). The one repository addition (`findUserIdsWithTeacherRecord`) is new and additive, unused elsewhere. No existing file's behavior changed. No migration was written or needed.

---

## 2026-07-16 — Sprint 9D: Learner Enrollment & Administrative–Academic Bridge (IMPLEMENTATION)

**What changed**: built `lib/core/learnerOnboarding.ts` — the Administration→Academics bridge — so a school admin can admit a learner, optionally link a guardian, and enroll them into a class in one idempotent call, with a class teacher automatically able to see that learner through the *exact same* existing query an admin uses to list a class. Together with Sprint 9B (institution) and 9C (educators), the platform now supports School → Activated → Teachers → Learners Enrolled → Teachers Automatically See Their Class end-to-end, entirely on Core.

**Part 1 — canonical path determination**: traced two learner-creation paths. The **legacy** path (`app/api/teacher/classes/[classId]/students/route.ts`, `students`/`class_students`) lets a class teacher write admission + class assignment in one indivisible request with no Administration/Academics separation at all — Sprint 6D's audit already named this exact shape as the platform's clearest workflow-responsibility violation. The **Core** path (`admitLearner`/`enrollLearner`, `lib/core/learners.ts`, already `requireSchoolAdmin`/`requireSchoolStaff`-gated, already schema-correct — `learners`/`learner_enrollments`, both `school_id`-scoped with real FKs) was already the architecturally correct choice and is what this sprint builds on. The legacy path is untouched — deprecating it is a separate, larger decision (RAS §13: deprecate before deleting), not this sprint's, and is named here as a real, documented, pre-existing gap rather than silently left unmentioned.

**Part 2 — the service**: `onboardLearner(schoolId, input)` runs three independently-exported, independently-tested steps — `ensureLearnerAdmitted` (reuses `admitLearner`), `ensureGuardianLinked` (reuses `addGuardian`, optional), `ensureEnrolled` (reuses `enrollLearner`) — mirroring `lib/core/schoolActivation.ts`'s step-result idiom (`created`/`already_exists`/`skipped`/`failed` per step) for consistency across the whole Stage 1 series. Zero direct Supabase query was added inside the orchestrator — every write goes through an existing `lib/core/learners.ts` function.

**One small, deliberate service evolution**: `AdmitLearnerInput.guardian` (`types/core.ts`) was widened from required to optional, and `admitLearner()` (`lib/core/learners.ts`) now skips the guardian insert when none is supplied — matching the sprint's "Parents (optional)" target workflow. This is additive and backward-compatible: every existing caller (the pre-existing `POST /api/core/learners` route's `AdmitSchema`, still requiring guardian, left completely unchanged; the reference-school seed script) is unaffected. Evolving the one existing canonical admission function was preferred over adding a second, guardian-optional admission path, per RAS §5 ("never duplicates another service").

**Part 3 — administrative ownership, enforced not just described**: the new orchestrated path (reachable through `POST /api/core/learners` by additionally supplying `class_id`/`term_id`/`academic_year_id` in the body — the same canonical route, not a parallel one) is `requireSchoolAdmin`-gated end to end, tighter than the pre-existing standalone enroll action on `PATCH /api/core/learners/[id]` (`requireSchoolStaff`, includes teachers — left exactly as it was, a pre-existing, more permissive building block this sprint doesn't touch). Teachers have no route, in this new pipeline, capable of admitting a learner, creating a class, or creating an enrollment — they only ever read via `getClassRoster`/`listLearners`, both pre-existing.

**Repository additions to `LearnerRepository`** (already RAS-canonical for this domain): `findByAdmissionNumber` (mirrors the live `UNIQUE(school_id, admission_number)` constraint) and `findGuardianByPhone` (`learner_guardians` has **no** live unique constraint at all — confirmed via `pg_constraint` — so this application-level check is the *only* thing preventing a duplicate guardian row on retry, called out explicitly rather than assumed safe, matching Sprint 9B's precedent for `classes`).

**Part 4/9 — idempotency, verified against raw row counts**: repeated onboarding with identical input → all three steps `already_exists`, zero duplicate `learners`/`learner_guardians`/`learner_enrollments` rows. A duplicate `admission_number` with *different* supplied names reuses the original record rather than updating it (idempotent reuse, not upsert-overwrite — tested explicitly, since silently letting a retry rewrite an official admission record would be its own correctness bug). `ensureEnrolled` reuses `enrollLearner`'s **already-upsert-safe** `UNIQUE(learner_id, term_id)` behavior verbatim — zero new code needed there.

**Part 7 — "learner moved during onboarding," answered by existing upsert semantics, not new code**: re-onboarding the same learner into a *different* class for the *same* term does not create a second enrollment — `learner_enrollments`' `UNIQUE(learner_id, term_id)` means the upsert updates the existing row's `class_id` in place. Proven directly in the test suite (one enrollment row, before and after, now pointing at the new class), not merely asserted. Failure recovery: a nonexistent `class_id` fails cleanly at the `enrollment` step (a real FK violation, exactly as intended by RAS §7 — the database is the enforcement floor, not an extra application-level check duplicating it) while the already-admitted learner and linked guardian survive untouched; retrying with a valid `class_id` reuses both (`already_exists`) and only the enrollment step actually runs.

**Part 5 — academic visibility, proven not assumed**: `getClassRoster(classId, termId)` (pre-existing, unchanged) is the exact function a teacher's UI would call; a dedicated test asserts it returns **the same learner-id set** as `listLearners(schoolId, {classId, termId})` (the admin-facing list) after onboarding — "the administrative class list is the academic class list" is executable, not aspirational.

**Part 6 — readiness, read-only, one honest and important finding**: `getLearnerReadiness(learnerId, schoolId, termId)` reads via `getLearner`/`getLearnerHistory`/`getClassRoster` only — creates nothing. `enrolled`/`classAssigned`/`visibleToTeacher` are computed from real state (the last one by actually calling `getClassRoster` and checking membership, not inferred from the enrollment row alone). **`eligibleForAssessment` and `eligibleForCompass` are hard-coded `false`, with a cited reason, regardless of enrollment state** — this is deliberate, not a bug: `class_assessments.class_id` still FKs to the legacy `teacher_classes` table, not Core's `classes` (Sprint 9A §3.1, unresolved), and Evidence/Projection are anchored to the legacy `students.id`, not Core `learners.id` (Sprint 9A's research). A learner onboarded through this sprint's pipeline has a fully correct, complete Core identity chain — Sprints 9B+9C+9D are now internally coherent — but that chain is **not yet connected** to the platform's actual teaching/Intelligence engines, which still run entirely on the pre-Core legacy schema. Silently reporting `true` here because "enrollment succeeded" would have been a hallucinated readiness claim of exactly the kind CLAUDE.md's evidence-first principle exists to prevent; reporting it honestly is this sprint's most important finding, not a limitation to apologize for.

**Route integration**: `POST /api/core/learners` (extended, backward-compatible — see above); `GET /api/core/learners/[id]?view=readiness&termId=` (new query branch, mirrors the route's existing `view=history` pattern exactly).

**Known limitations / remaining blockers, carried forward honestly**:
1. **The Assessment/Evidence/Projection connection remains unbuilt** (see Part 6 above) — this is the platform's actual next architectural bridge, matching the user's own stated Sprint 9F scope ("connect Assessment → Evidence → Projection pipeline"), not something this sprint could or should have closed.
2. **The legacy teacher-direct-admission path is untouched and still live** — a class teacher can still write `students`+`class_students` in one request today, bypassing the Administration-owns-enrollment separation this sprint builds for the Core path. Consolidating or deprecating it is a distinct, larger, out-of-scope decision.
3. **No UI** — matching Sprint 9B/9C's precedent exactly, this is reachable by direct API call only.
4. **Bulk/cohort admission** (Sprint 9A §Part 8's real-school comparison already flagged this — a registrar typically admits a whole incoming class at once) is not built; `onboardLearner` is one-learner-at-a-time, matching the existing `admitLearner`/`enrollLearner` shape it composes.

**Architectural documents referenced**: `docs/architecture/sprint-9a-phase2-school-activation-audit.md` (§3.1, cited directly in `getLearnerReadiness`'s own code, not just this log); `docs/architecture/sprint-6d-school-workflow-model.md` (Workflow 1/Admission — the exact "single indivisible write, no Administration/Academics separation" finding this sprint's Part 3 fixes for the Core path); `docs/architecture/reference-architecture-specification.md` §3 (Learner domain ownership respected — `LearnerRepository` is the only repository touched for `learners`/`learner_enrollments`/`learner_guardians`), §5 (evolving `admitLearner` rather than duplicating it), §7 (idempotency mirrors live constraints where they exist, is explicit application-level enforcement where they don't); `docs/architecture/adr/0002-canonical-teacher-identity.md` (untouched by this sprint — no teacher-identity code was written; the end-to-end test exercises Sprint 9C's `teacherOnboarding.ts` unchanged, as a consumer, not a modification).

**ADR**: None — no canonical domain, identity, or ownership change. The `AdmitLearnerInput.guardian` widening is a backward-compatible service evolution within the already-canonical Learner domain, not a new domain or identity.

**Tests added**: `lib/core/learnerOnboarding.test.ts` — 11 integration tests against real synthetic rows on the live Supabase project: first learner, second learner (no interference), guardian-optional, repeated onboarding (zero duplicates across all three tables), duplicate-admission-number reuse (not overwrite), learner-moved-during-onboarding (upsert-driven class change), failure-then-retry at the enrollment step, an isolated single-step test, administrative-vs-academic class list equality, readiness before/after enrollment (including the honest `eligibleForAssessment`/`eligibleForCompass: false` assertions), and one full activation→teacher-onboarding→learner-onboarding end-to-end test tying all three Stage 1 sprints together. All 11 passing; zero residual synthetic rows confirmed after a full run. Re-ran `lib/core/schoolActivation.test.ts` (19), `lib/core/teacherOnboarding.test.ts` (12), and `lib/core/permissions.test.ts` (21) — 52/52 passing, confirming the `types/core.ts`/`lib/core/learners.ts` changes caused no regression. Full-project `tsc --noEmit` clean throughout.

**Rollback considerations**: low. `lib/core/learnerOnboarding.ts` and its test file are new with no other callers yet. The `admitLearner()`/`AdmitLearnerInput` change is a 2-line, additive, backward-compatible widening (an `if (!input.guardian)` early return) — reverting it restores the exact prior always-requires-a-guardian behavior. The two route changes are additive branches (`POST /api/core/learners` only takes the new path when `class_id` is present in the body; the readiness view is a new, isolated `if` branch) — no existing branch's behavior changed. The two `LearnerRepository` additions are new, unused-elsewhere methods. No migration was written or needed.

---

## 2026-07-16 — Sprint 9C: Teacher Onboarding & School Activation Integration (IMPLEMENTATION)

**What changed**: wired Sprint 9B's `activateSchool()` into the one real school-creation path (`POST /api/core/school`, `app/api/core/school/route.ts`), and built `lib/core/teacherOnboarding.ts` — the canonical, admin-driven Invite→Accept teacher-onboarding flow Sprint 9A found completely missing ("there is no `app/api/core/teachers` or `app/api/core/school-users` route at all"). Together these close the chain: Create School → Activate School → Invite Teacher → Teacher Accepts → `teachers` row + `school_users` row, correctly linked per ADR-0002 → Ready to Teach.

**Part 1 — activation wiring**: `app/api/core/school/route.ts`'s `POST` handler now calls `activateSchool(school.id)` immediately after `createSchool()` succeeds, and returns both outcomes in one response body (`{ data: { school, schoolUser, activation } }`, still `201`). Composed at the **route**, not inside `lib/core/school.ts` itself — calling `activateSchool()` from inside `createSchool()` would create a `school.ts` ↔ `schoolActivation.ts` circular import (`schoolActivation.ts` already calls back into `school.ts`'s `createAcademicYear`/`createTerm`/etc.); composing two service calls at the Application Layer instead is explicitly permitted by RAS §6. Activation runs exactly once per creation call (no retry loop, no duplicate invocation) and is never rolled back on failure — school creation has already durably succeeded by the time activation runs, so the response separates the two outcomes (`school`/`schoolUser` vs. `activation.status`/`activation.failedStep`) rather than collapsing them into one ambiguous success/failure — a caller must check `activation.status === 'complete'` before treating the school as ready, exactly the "never leave ambiguous success" instruction.

**Part 2/3 — teacher onboarding, canonical identity**: `lib/core/teacherOnboarding.ts` implements a two-phase Invite/Accept model built entirely on **existing** `school_users` columns (`is_active`, `invited_by`, `joined_at` — all present since `20260629_core_foundation.sql`), zero schema change. `inviteTeacher(schoolId, email, invitedBy)` resolves the email against existing `auth.users` accounts (mirroring the exact `auth.admin.listUsers()`-then-find-by-email pattern already used in `app/api/admin/activate-user/route.ts` and three sibling admin routes — consolidated into one new repository method, `TeacherRepository.findAuthUserByEmail`, rather than re-implemented a fifth time) and inserts a **pending** (`is_active: false`) `school_users` row. `acceptTeacherInvitation(userId, schoolId, profile)` flips that row active (reusing the existing, already-tested `lib/core/school-users.ts::addSchoolUser`, which already upserts `is_active: true` + `joined_at` on the correct `UNIQUE(school_id,user_id,role)` constraint — no new method needed for this half), then ensures `teachers` and `profiles` rows exist (two new, genuinely-missing `TeacherRepository` methods — `insertTeacher`, `upsertProfile` — since no repository owned either write before this sprint; every prior `teachers` INSERT in the codebase was an inline route query in the legacy `app/api/teacher/profile/route.ts`). **ADR-0002 guarantee, directly asserted in a test** (`teacherOnboarding.test.ts`'s "all correctly linked" test): `result.teacherId !== result.schoolUser.id` — the two identities are always created and returned as two distinct fields, never conflated, and the `teachers.school` free-text column is populated with the school's real, canonical `school_name` (not a guessed string) since — unlike the legacy signup flow — this path always has the real `schools` row in hand.

**Part 5 — readiness, not auto-assignment**: `getTeacherReadiness(userId, schoolId)` composes the **existing** identity resolvers (`resolveTeacher`, `resolveMembership` from `lib/core/identity.ts`) into one report (`hasActiveMembership`, `hasTeacherRecord`, `readyForClassAssignment`, `readyForAssessmentOwnership`) — zero new queries, creates nothing, per the sprint's explicit "do not auto-assign classes, only ensure readiness" instruction. `readyForAssessmentOwnership` is true exactly when `resolveTeacher()` would succeed — the precondition `createAssessment()` already enforces (Sprint 9A §3.2 / ADR-0002 Part 7), so a teacher who onboards through this flow is provably eligible for assessment ownership the moment `acceptTeacherInvitation` returns, without any hidden manual repair step.

**Route**: `app/api/core/teachers/route.ts` (new) — fills RAS §3's reserved-but-unbuilt `app/api/core/teachers/**` slot. `POST {action:'invite', schoolId, email}` (`requireSchoolAdmin`-gated), `POST {action:'accept', schoolId, full_name, ...}` (`requireAuthentication`-gated, self-accept only — `userId` is always taken from `auth.getUser()`, never trusted from the body, per CLAUDE.md), `GET ?schoolId=` (self-readiness). Thin per RAS §2 — auth/authorization + one service call, no business logic.

**Repository additions to `TeacherRepository`** (already RAS-canonical for this area — it already owned `school_users`/`classes`/`grades`/`streams` queries before this sprint): `findAuthUserByEmail`, `findSchoolUserByUserIdAndRole` (status-agnostic — needed to distinguish "never invited" / "pending" / "already active" in one query instead of three), `insertPendingSchoolUser` (deliberately a plain insert, not an upsert — an upsert here risked silently flipping an already-active member back to pending on a careless re-invite), `insertTeacher`, `upsertProfile`.

**Idempotency (Part 4), verified against raw row counts, not just return values**: repeated invitation → `already_pending`/`already_member`, zero duplicate `school_users` rows (`UNIQUE(school_id,user_id,role)` backs this, but the pre-check gives a meaningful status instead of a raw constraint-violation error). Repeated acceptance → `already_member`, zero duplicate `teachers` rows (`teachers.user_id UNIQUE` backs this) or `profiles` rows (`profiles.id` is the PK). A full invite→accept→invite→accept sequence, and activation run twice + onboarding on top of it, were both tested directly.

**Part 6 — existing schools**: onboarding has no dependency on activation state at all (verified, not assumed) — three dedicated tests cover a freshly-activated school, a school with only a bare academic year and nothing else ("partially configured"), and the shared already-activated test fixture; all three onboard identically.

**Part 7 — failure/retry**: `acceptTeacherInvitation` throws a clear, specific error ("no invitation found... invite them first") for the missing-membership case rather than silently creating one — you cannot accept an invitation that was never extended. `inviteTeacher` for an email with no `auth.users` account returns a structured `{status:'no_account'}` rather than throwing — tested end-to-end as a real retry: invite fails with `no_account`, the person signs up with that exact email, re-inviting then succeeds, and acceptance completes normally.

**Known limitations, carried forward honestly, not fixed here**:
1. **No email/token invitation system.** `inviteTeacher` only works for emails that already have a platform account — inviting someone who hasn't signed up yet is a real, unclosed gap (returns `no_account`, not an error, so the caller can tell the difference). Building a full pending-invite-for-a-nonexistent-account system (a new table, expiry, actual email delivery — no email-sending infrastructure for this purpose exists anywhere in this codebase) is a distinct, larger product feature, deliberately not built this sprint to keep the identity-linkage work (this sprint's actual ask) from being entangled with a delivery mechanism.
2. **A second, pre-existing, unrelated `school_users`-insert implementation was discovered, not fixed**: `SchoolRepository.addSchoolUser(schoolId, userId, role)` (plain insert, no `invited_by`) and `TeacherRepository.upsertSchoolUser`/`lib/core/school-users.ts::addSchoolUser` (upsert, sets `invited_by`) both write to the same table from two different repositories — a real RAS §4 "never duplicates queries" violation, pre-existing (used by `createSchool()`'s admin-grant and the legacy `ensureSchoolMembership` bridge respectively), out of scope to consolidate this sprint. `acceptTeacherInvitation` always uses the canonical (`TeacherRepository`-backed) one; a legacy row created via the other path with `invited_by: null` is handled gracefully (falls back to the accepting user's own id) but this is a workaround, not a fix.
3. **Not wired to any UI**, matching Sprint 9B's own precedent — `app/api/core/teachers/route.ts` is reachable by direct API call only; an admin-facing "invite a teacher" form is next-sprint (or later) work.
4. **The Assessment FK mismatch remains unresolved**, exactly as in Sprint 9B — a teacher who completes onboarding through this flow is `readyForAssessmentOwnership: true`, but actually creating an assessment against a Core-created class still fails on the `class_assessments.class_id → teacher_classes` FK (Sprint 9A §3.1). "Ready to teach" in this sprint's sense means "the identity chain is correct and complete," not "the Assessment pipeline itself works" — that remains Sprint 9F's stated scope in the user's own five-sprint roadmap.

**Architectural documents referenced**: `docs/architecture/sprint-9a-phase2-school-activation-audit.md` (Parts 4/5/7, the gaps this sprint closes); `docs/architecture/adr/0002-canonical-teacher-identity.md` (this sprint's central contract — verified, not just cited, via a direct `teacherId !== schoolUser.id` assertion in the test suite); `docs/architecture/reference-architecture-specification.md` §2 (thin routes), §3 (fills the reserved `app/api/core/teachers/**` slot; Teacher/Permissions domain ownership respected throughout), §4 (repository additions are genuinely-missing capabilities on the already-canonical `TeacherRepository`, not a new repository), §6 (route composition of two service calls, not a duplicated activation implementation).

**ADR**: None — no canonical domain, identity, or ownership change; ADR-0002 is respected exactly as ratified, not amended or reopened.

**Tests added**: `lib/core/teacherOnboarding.test.ts` — 12 integration tests against real synthetic rows on the live Supabase project: invite (fresh, repeated/idempotent, no-account), accept (missing-invitation failure, first accept with full ADR-0002/linkage verification, repeated/idempotent), first-teacher + second-teacher onboarding into the same school, readiness for an untouched user, activation+onboarding together on a fresh school, onboarding into a partially-configured school, and two failure/retry scenarios (no-account → real signup → retry succeeds; full repeated invite→accept sequence). All 12 passing; zero residual synthetic rows confirmed after a full run. Re-ran `lib/core/schoolActivation.test.ts` (19/19) and `lib/core/permissions.test.ts` (21/21) to confirm the `TeacherRepository`/route changes caused no regression. Full-project `tsc --noEmit` clean throughout.

**Rollback considerations**: low. `lib/core/teacherOnboarding.ts`, its test file, and `app/api/core/teachers/route.ts` are new and have no other callers yet — deleting them is a full revert. The `app/api/core/school/route.ts` change is a 2-line addition (one `await activateSchool(...)` call, one extra response field) — reverting it restores the exact pre-9C response shape. The four `TeacherRepository` additions and `activateSchool`'s composition are purely additive; no existing method signature changed. No migration was written or needed.

---

## 2026-07-16 — Sprint 9B: School Activation Orchestrator (IMPLEMENTATION)

**What changed**: built `lib/core/schoolActivation.ts`, the orchestration layer Sprint 9A found missing — a deterministic pipeline (Academic Year → Terms → Grades resolved → Streams → Classes → School Settings) that turns a school with only its `schools`/`school_users` row (what `createSchool()` produces today) into one ready for a class roster, without touching Learner, Assessment, Evidence, Report Card, or Intelligence — a deliberate scope boundary per the sprint's own "activation creates institutional structure, not academic activity" instruction. Every step (`ensureAcademicYear`, `ensureDefaultTerms`, `ensureDefaultGrades`, `ensureStreams`, `ensureClasses`, `ensureSchoolSettings`) is independently exported and independently tested, and composes only existing `lib/core/school.ts`/`lib/core/classes.ts` functions — no direct Supabase query was added inside the orchestrator itself.

**Files changed**: `lib/core/schoolActivation.ts` (new), `lib/core/schoolActivation.test.ts` (new, 19 tests); `lib/repositories/school.repository.ts` (+`findSettingsOrNull`, a non-throwing existence check `findSettings`'s `.single()` couldn't provide — needed for idempotency, added because a genuinely missing capability, per Stage 6's discipline, not a duplicate); `lib/core/school.ts` (+`getSchoolSettingsOrNull`, the service-layer wrapper so the orchestrator never calls a repository directly); `types/core.ts` (+`'senior_secondary'` added to `GradeCategory` — a pre-existing type/schema drift discovered while typing the grades step: the live `grades.category` CHECK constraint has allowed `'senior_secondary'` since `20260707_senior_secondary_grades.sql`, but the TS type never picked it up; fixed because leaving it would have made this sprint's own grade-filtering logic silently untypeable/wrong for every senior-secondary school, not scope creep).

**Repositories reused, not duplicated**: `SchoolRepository` (via `createAcademicYear`/`createTerm`/`listAcademicYears`/`listTerms`/`getSchoolSettingsOrNull`/`upsertSchoolSettings`, all pre-existing except the one addition above) and `TeacherRepository` (via `listGrades`/`listStreams`/`createStream`/`listClasses`/`createClass`, all pre-existing, `lib/core/classes.ts`).

**Activation order**: School (pre-existing) → Academic Year → Terms → Grades (resolved from the global catalogue, never written — Grade is School-catalog shared reference data per RAS §3, not a per-school row) → Streams (optional — skipped cleanly if none requested) → Classes (one per grade, or one per grade×stream if streams exist) → School Settings (materializes the row with schema defaults; a pre-existing `school_settings` row is always left untouched). Grade defaults are resolved from `school.school_type` via a small, explicitly-documented map (`SCHOOL_TYPE_GRADE_CATEGORIES` in `lib/core/schoolActivation.ts`) built only from `grades.category` values that already exist in the schema — not a new curriculum rule. `'special'` (a real, live `schools_school_type_check` value) and any unrecognized value have **no** default and require an explicit `gradeCodes` override — activation refuses to guess an institutional structure for a school type it can't confidently map, rather than silently assuming one.

**Idempotency**: every step checks for an existing row before inserting (mirroring the live UNIQUE constraints on `academic_years(school_id,name)`, `terms(school_id,academic_year_id,term_number)`, `streams(school_id,name)`, `school_settings(school_id)`), and re-running `activateSchool()` on an already-activated school reports `already_exists`/`skipped` on every step and creates zero duplicate rows — verified directly against Postgres row counts in the test suite, not just against the function's own return value. One exception, called out explicitly rather than left implicit: `classes` has **no** live UNIQUE constraint (confirmed via `pg_constraint` this session) — the existence check in `ensureClasses` (keyed on `grade_id`+`stream_id`) is the *only* thing preventing duplicate classes on rerun. Adding a DB-level constraint would be a schema change, out of scope this sprint per its own instruction not to invent one.

**Failure behavior**: the pipeline stops at the first failing step (verified with a dedicated test: an unresolvable `school_type` fails cleanly at the `grades` step, and `streams`/`classes`/`school_settings` are never attempted). There is no cross-table transaction — the Supabase JS client doesn't span one across `academic_years`/`terms`/`classes` without an RPC, which would itself be a schema-adjacent addition out of scope. Recovery is by idempotent retry, not rollback: calling `activateSchool()` again after a partial failure skips every already-created object and resumes at the failed step — proven directly in the failure test (retrying after supplying the missing `gradeCodes` completes successfully, and the academic year created by the first, failed run is reused, not duplicated).

**School status (Stage 5)**: no activation-state column exists on `schools` today (confirmed live — only `is_active: boolean`, an enabled/disabled flag, not a lifecycle stage). Per the sprint's explicit "do not invent schema changes" instruction, `getSchoolActivationStatus()` computes `CREATED` / `INITIALIZED` / `ACTIVE` on demand from existing rows (no year → CREATED; year+terms, no classes → INITIALIZED; at least one class → ACTIVE) rather than persisting it. Documented as intentionally cheap and safe to call often; persisting it later, if a future sprint needs to filter/index schools by activation state at scale, would be schema-additive only and would not require an ADR (doesn't change School's canonical identity, per RAS §12).

**Known limitations, carried forward honestly, not fixed here**:
1. **Not wired to any route or UI.** Per the sprint's own deliverables list (service + tests + log only), `activateSchool()` is currently reachable only by direct import — closing that gap (an `app/api/core/school/[id]/activate` route, `requireSchoolAdmin`-gated) is explicitly next-sprint work, not silently done here.
2. **The Assessment FK mismatch** (`class_assessments.class_id → teacher_classes`, `docs/architecture/sprint-9a-phase2-school-activation-audit.md` §3.1) remains unresolved, exactly as instructed — a school activated by this sprint's pipeline still cannot have its first assessment created against it.
3. **A pre-existing, unrelated bug observed while building this**, not fixed (out of scope): `app/api/core/school/route.ts`'s `CreateSchoolSchema` and `types/core.ts`'s `SchoolType` both accept `'public_primary' | 'private_primary' | 'public_comprehensive' | 'private_comprehensive'`, but the live `schools_school_type_check` constraint only allows `'primary' | 'secondary' | 'mixed' | 'special'` — a school created through the existing admin UI with any `school_type` selected would fail its INSERT today. `resolveDefaultGrades`'s default map is deliberately built to cover both value sets so it keeps working regardless of which side of that mismatch is eventually fixed, but the mismatch itself is untouched.
4. **Term/academic-year default dates are a simple 3-way calendar split**, not aligned to Kenya's actual school-term calendar (which varies year to year and isn't encoded anywhere in this codebase) — acceptable as a default per Stage 2's "deterministic" requirement, but a caller who cares about real term dates should pass `academicYear`/rely on `createTerm` directly rather than the pipeline default.

**Architectural documents referenced**: `docs/architecture/sprint-9a-phase2-school-activation-audit.md` (the gap this sprint closes, Parts 2/3/6/9); `docs/architecture/reference-architecture-specification.md` §3 (Grade/Subject as shared reference data — why "Default Grades" never writes a row), §4/§5 (repository/service reuse discipline — no new repository, one additive method on an existing one), §7 (idempotency mirrors live UNIQUE constraints; the one table without one, `classes`, is called out explicitly rather than assumed safe); `docs/architecture/adr/0002-canonical-teacher-identity.md` (untouched by this sprint — no Teacher-identity code was written; `class_teacher_id` is never set by this pipeline).

**ADR**: None — no canonical domain, identity, or ownership change. The `school_type` → grade-category map is a config default built entirely from already-schema-defined `grades.category` values, not a new domain decision.

**Tests added**: `lib/core/schoolActivation.test.ts` — 19 tests, integration-style against real synthetic rows on the live Supabase project (same convention as `lib/core/permissions.test.ts`/`lib/core/identity.test.ts`), covering: pure-function grade/term resolution (4 tests), each pipeline step in isolation with its own idempotency check (7 tests), full end-to-end fresh-school activation, already-activated rerun (zero duplicates, verified against raw row counts), partially-initialized school (only missing objects created), triple-repeated calls, mid-pipeline failure + idempotent retry, nonexistent-school failure, and activation-status transitions (CREATED→INITIALIZED→ACTIVE). All 19 passing; verified zero residual synthetic rows after a full run. Also re-ran `lib/repositories/findSchoolIdByTeacherId.integration.test.ts` (adjacent, pre-existing) to confirm the `SchoolRepository`/`types/core.ts` changes caused no regression — still 3/3 passing. Full-project `tsc --noEmit` clean (0 errors) both before and after the `GradeCategory` fix.

**Rollback considerations**: low. Deleting `lib/core/schoolActivation.ts` + its test file, plus reverting the three small additive edits (`findSettingsOrNull`, `getSchoolSettingsOrNull`, `GradeCategory`'s new member), fully reverts this sprint with no data or schema impact — nothing else imports `schoolActivation.ts` yet (Known Limitation 1), so there is no caller to update. No migration was written or needed.

---

## 2026-07-16 — Sprint 9A Phase 2: School Activation & Onboarding Engine Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-9a-phase2-school-activation-audit.md`, a targeted trace of the exact call chain a new school follows from `createSchool()` through the earliest point Assessment/Report/Compass would engage. Every claim independently re-verified this session (not carried over from Sprint 8A's higher-level framing) via direct file read/grep against `lib/core/*`, `app/api/core/*`, `scripts/reference-school/*`, and the live schema.

**Key findings**: (1) exactly one production path creates a school — `createSchool()` → `POST /api/core/school` → `app/admin/core-schools/new/page.tsx`, a platform-admin-gated internal tool, not a principal-facing signup flow; (2) `createSchool()` auto-creates only `schools` + the creator's `school_users(role='school_admin')` row — every other object (academic year, terms, streams, grade-subject assignment, classes, learners, enrollment) requires a separate manual API call across 5+ route files, with zero orchestrating function anywhere (`grep` for bootstrap/provision/onboard/activate → 0 hits); (3) **no route exists to add a second teacher to a school at all** (`app/api/core/teachers` does not exist); (4) a hard schema-level blocker: `class_assessments.class_id` has a live FK to the *legacy* `teacher_classes` table, not Core's `classes` table (`supabase/marksheet_migration.sql:8`), confirmed independently by the reference-school seed script's own already-documented, worked-around discovery (`scripts/reference-school/05-seed-assessments.ts:9-16`) — this makes Assessment, and everything downstream (Report, End of Term), structurally unreachable for any Core-only school; (5) `createAssessment()` throws for any caller with no legacy `teachers` row, which by construction includes the school's own creator (restates ADR-0002 Part 7's already-named, deliberately-unresolved edge case as a live activation blocker, not a new finding); (6) Projection (`recomputeLearnerProjection`) is not broken by any of this — it degrades cleanly to all-null dimensions for zero evidence by design — but is functionally starved for any Core-only school as a direct consequence of (4). Produced a full Immediate/Before-Pilot/Before-10-Schools/Before-100-Schools/Later/Research roadmap (9 items) ordering these gaps for a future implementation sprint, and flagged the tension between the sprint's own "this is implementation, not audit" framing and its "no code, read only" constraint (both cannot be true — proceeded as a scoped, targeted audit, narrower than the 8A–8C platform-wide series).

**Architectural documents referenced**: `docs/architecture/reference-architecture-specification.md` §3 (Canonical Domain Standards — every domain traced confirmed compliant), §7 (Database Standards — the one pre-existing, not-newly-introduced violation found: `class_assessments.class_id`'s FK contradicts the table `lib/core/assessments.ts` is written against), §9 (Intelligence Standards — Projection's clean zero-evidence behavior confirmed compliant); `docs/architecture/adr/0002-canonical-teacher-identity.md` (Part 7's admin-tier edge case confirmed as the live blocker, not reopened or reversed); `docs/architecture/sprint-8a-operating-system-implementation-blueprint.md` (Part 2's identity-space framing of the same root cause, Part 6/9's prior call to build a reachable activation path).

**ADR**: None — the one RAS §7 non-compliance found (the FK) is pre-existing, already independently discovered by the reference-school script, and resolvable as a straightforward migration completing Class's already-ratified "(evolving)" status per RAS §3 — not a new canonical-domain conflict.

**Tests added**: None (read-only audit). Confirmed as a gap: zero tests exercise the school→academic-year→class→learner→enrollment→assessment creation chain end-to-end from a genuinely empty state (`grep` across `*.test.ts` for the five core creation functions → 0 matches); the closest existing evidence (`scripts/reference-school/integration.test.ts`) is read-only against an already-seeded fixture.

**Rollback considerations**: None — no code or schema was touched; only this log entry and the new architecture document were written.

---

## 2026-07-16 — Sprint 8C: Educational Operating System Validation Against Real Schools (READ ONLY, NO CODE MODIFIED) — CLOSES THE AUDIT SERIES

**What changed**: no code was written. Produced `docs/architecture/sprint-8c-educational-operating-system-validation.md`, validating the full Stage 0.5 → Sprint 8B architecture against real school operation, with repository evidence and external educational research kept strictly separated throughout (`[VERIFIED]`/`[RESEARCH]`/`[FUTURE ARCHITECTURE]` labels on every claim). Covers: the complete school lifecycle (12 stages, one — Promotion — found to be *deliberately* postponed per its own route's code comment, not merely missing), Academic Governance (9 real-school mechanisms compared, 7 absent), a differentiated Student Support Model recommendation (Guidance/Counselling → first-class domain; Special Needs/Gifted Learners → extend Evidence, not new domains; Safeguarding → integration-only, never full decision authority), Teacher Professional Practice (2 of 9 lifecycle stages supported), Parent Partnership (2 of 8 areas meaningfully represented), a Leadership "belongs in software vs. remains human" table, a designed (not implemented) Educational Trust Model, a 16-candidate Future Domain classification (7 Core / 6 Extension / 3 Integration), the EduNexus Philosophy Test (0 of 7 Core candidates fail all four questions — the test's value was ordering priority, not gatekeeping), and a consolidated Principles v2 that reduces 55 prior principle statements (Sprints 7A/7B/7E) to 12 independently-corroborated ones.

**Per the sprint's own recommendation, this closes the architecture audit series**: Structure (6A/6B), Domain Model (7B), Operating Model (6C), Decision Model (6G/7D), Information Flow (6F), Organizational Model (6E), School Workflow (6D), Academic-Year Simulation (8B), and Real-School Validation (this document) have all now been completed.

**Sharpest new finding (Part 1)**: Promotion is the only lifecycle stage across the entire ten-document series with *positive evidence of deliberate absence* — its own route code explicitly cites a confirmed 2026-07-13 scope decision, not an unfinished build. This became the basis for new Principle 12: absence can be a documented scope boundary, not only an unaddressed gap — a distinction the series had been making implicitly all along but never stated as its own rule.

**Trust model design (Part 7, future architecture, not implementation)**: describes Evidence/Projection/Adaptive Learning/Career Intelligence as a hierarchy where trust should flow downward and Career Intelligence is the only layer that breaks the chain — asserting false certainty relative to every layer beneath it. Adds one genuinely new trust-decrease case this series had not previously found evidence for: staleness (a Projection whose underlying Evidence has gone stale, extending Sprint 6F Part 6's "no cache-invalidation policy" finding into the trust model explicitly).

**Principles v2 consolidation (Part 10)**: forty-three of fifty-five prior principle statements collapse into the twelve retained, not because they were wrong but because most restated the same handful of underlying failure modes (unreachable-but-correct code, AI deciding instead of proposing, missing traceability, undocumented absence). The document treats this convergence itself as validation — a platform whose problems are structurally few and repeated, not many and various, which is a more tractable finding for whoever eventually scopes implementation than fifty-five separate rules would be.

**Architectural documents referenced**: the complete Stage 0.5 → Sprint 8B history in full, all cited to origin.

**ADR**: None — this document's one new finding (the intentional-vs-undocumented-absence distinction) sharpens classification, not a new canonical-domain conflict.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-8c-educational-operating-system-validation.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 8B: Full Academic Year Simulation Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-8b-academic-year-simulation-audit.md`, stress-testing the entire Stage 0.5 → Sprint 8A architecture against a full simulated academic year for a hypothetical Kenyan CBC secondary school — beginning of year, one ordinary school day, mid-term, end of term (with an explicit four-way Legacy/Core/Evidence/Production path comparison for report generation), end of year, every actor (15, including three named for the first time — Secretary, Driver, Security), every information object's lifecycle, an Educational Intelligence validation table, a Domain Scorecard, a Gap-to-Roadmap Matrix, an "LMS on Steroids" validation against Moodle/Google Classroom/Canvas/Microsoft Teams (explicitly labeled research, not repository evidence), and an Executive Readiness Report answering directly whether EduNexus can run one classroom, one school, five schools, or fifty schools today.

**No new architecture invented — this was purely a validation exercise**, per its own mandate. Its value is in surfacing patterns only visible when the existing findings are walked through as one continuous narrative rather than read as independent audits.

**Sharpest new pattern surfaced (Part 1/2)**: the legacy path's independence from School-creation's unreachability (it silently falls back to `schoolId: null` rather than failing, per Sprint 6E Part 3) is precisely what allows a real pilot school to function today despite the dependency graph's root node being unreachable — this document is the first to state explicitly that this "silent fallback" is the load-bearing reason the pilot works at all, not an incidental detail.

**Fifth independent confirmation of Career Intelligence's governance gap**: Parts 3, 4, 6, 8, and 12 each re-derive the same finding from a different angle within this single document (mid-term counselling-territory occupation, end-of-term recommendation fan-out, actor-table Counsellor absence, the Intelligence-validation table's only complete governance failure, and the executive "what should absolutely not be built yet" warning against building a second AI decision-maker in the same ungoverned shape) — across the full series this is now the sixth, seventh, eighth, ninth, and tenth independent corroboration (after 6G, 7C, 7D, 7E, 8A).

**One genuine research gap in the audit series itself, named honestly (Part 3)**: no prior sprint (Stage 0.5 through 8A) ever investigated whether Projects or Practicals are tracked distinctly from an ordinary CAT/Assessment — flagged as UNKNOWN rather than assumed, and classified in the Gap-to-Roadmap Matrix as Future Research.

**Executive verdict (Part 12)**: EduNexus can run one classroom and one school today (with caveats — no institutional administration, live Career Intelligence liability); cannot cleanly run five schools (no schema-enforced cross-school data isolation on the legacy path, since `teacher_classes`/`class_assessments` have no `school_id` column in any migration, per Sprint 4E); cannot run fifty schools at all (identity split, Report Card duplication, dead event bus, and total Administration unreachability all become load-bearing simultaneously at that scale).

**"LMS on Steroids" validation (Part 11, research)**: EduNexus's only capabilities no named competitor (Moodle/Classroom/Canvas/Teams) models comparably are the Evidence confidence-tiering/immutability system, Projection's traceable computation, and (once governed) Career Intelligence's capability class itself — every other capability this series found (content delivery, gradebook, attendance, timetable) is commodity LMS territory, correctly triaged in Part 10 as completeness work, not innovation.

**Architectural documents referenced**: the complete Stage 0.5 → Sprint 8A history in full, all cited to origin.

**ADR**: None — this sprint stress-tests already-documented gaps against a realistic narrative; it discovers no new canonical-domain conflict, with the sole exception of honestly flagging Projects/Practicals as unresearched territory (a gap in the audit series, not a canonical conflict).

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-8b-academic-year-simulation-audit.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 8A: Educational Operating System Implementation Blueprint (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-8a-operating-system-implementation-blueprint.md`, turning the complete 6A–7E architecture series plus the pre-6A engineering history (Stage 0.5 through Sprint 5-series, drawn directly from `docs/engineering/implementation-log.md`) into a construction schedule. Covers: a 31-subsystem foundation inventory (COMPLETE/MOSTLY COMPLETE/PARTIAL/FOUNDATIONAL ONLY/DORMANT/MISSING), a School-Created-to-Archive dependency graph classifying each edge as hard/soft/false/cyclic/missing, a per-domain universal-workflow-adoption table, a Human Authority Map across 13 actors, an Intelligence-placement audit, a ten-stage Modular Build Plan, a Technical Debt Prioritization pulling concrete, cited items from the pre-6A sprint history, a nine-layer Educational Operating System model (with a deliberate Workflow/Decision split, evidence-justified), a Five-Year Evolution Roadmap, an Executive Blueprint (diagram/narrative/roadmap/contributor-guide/what-never-changes), and an Educational Value Check table.

**New synthesis this session — dependency graph findings (Part 2)**: two dependencies this series had not previously classified as *false* are named as such — School→Academic Structure (the legacy path runs on a parallel identity with no `school_id` column anywhere, confirmed by Sprint 4E's own grep) and Curriculum→Teaching (the live UI runs off a hardcoded catalogue, not Curriculum's own tables, restated 7B Part 3) — meaning two edges in the "obvious" dependency chain are not actually load-bearing in the live product today.

**Technical debt grounded in concrete pre-6A citations (Part 7)**: pulled forward specific, still-open items from Sprint 4D/4E/4F/4C0/1A/2A rather than re-deriving abstractly — the unratified 76/51/31 vs 75/50/25 grading-boundary conflict (`lib/assessments/gradeCalculator.ts`, actively written on every legacy-gradebook save), `gradeLevelFromScore`'s explicitly-blocked migration (Sprint 4E, reclassified "acceptable duplicate, not migratable in place" pending teacher→school identity resolution), the Report Card publish-guard gap (Sprint 4C0 Part 5, still open through 4C1), and `canManageClass`/`canViewLearner` being built in Sprint 1A but never adopted by any of the 7 route-migration batches that followed — each classified into Critical-before-pilots/10-schools/100-schools/Can-wait/Architectural-only/Research-only.

**Three Research-only items block specific build stages, named explicitly**: `lib/learnerModel/`/`lib/learnerIntelligence/`'s relationship to `lib/projection/` must be resolved before Stage 4/5 (Evidence & Recommendations governance) proceeds; `lib/teachingIntelligence/`'s relationship to the "no unified Teacher Intelligence surface" finding must be resolved before Stage 10; `lib/iam/`'s relationship to `lib/core/permissions.ts` must be resolved before Stage 0 (Organization activation) — each a genuine blocker, not a nice-to-have, per this document's own dependency reasoning.

**Educational Value Check (the sprint's own requested addition)**: found the blueprint's highest-value items (Career Intelligence governance, unified Report Cards, Guidance & Counselling) are exactly the ones an ordinary LMS could not easily replicate, because they depend on the Evidence/Projection engine this series found genuinely differentiated — while lower-but-necessary items (Attendance, Finance) are commodity SIS/ERP capabilities recommended honestly as operational unblockers, not innovation claims. This distinction is proposed as the standard future contributors should use when describing, not just building, each roadmap item.

**Architectural documents referenced**: the complete 6A–7E series in full, plus `docs/engineering/implementation-log.md`'s pre-6A entries (Stage 0.5, Sprints 1A/1B/2A/2B/3A–3E/4A–4I/5D–5I, ADR-0002) — all cited to origin, none re-derived.

**ADR**: None — this document sequences and prioritizes already-documented conflicts and gaps; it discovers no new canonical-domain conflict.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-8a-operating-system-implementation-blueprint.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 7E: EduNexus Educational Operating System Blueprint (FUTURE-STATE SYNTHESIS, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-7e-educational-operating-system-blueprint.md`, the capstone future-state synthesis of the entire 6A–6H/7A–7D series — every claim about EduNexus today is cited to its originating sprint, every claim about what it could become is explicitly labeled **[FUTURE ARCHITECTURE]** and never presented as a repository finding. Covers: OS/LMS/SIS/ERP/Learning-Intelligence-Platform definitions and where EduNexus sits (today and future), the complete school model (25 domains, status-classified), an Educational Intelligence Architecture separating eight Intelligence types by evidentiary scope, a Human Decision Hierarchy table (recommend/approve/own/override), a universal six-stage Educational Workflow Engine (Draft→Review→Approve→Publish→Monitor→Archive) shown fitting seven different domains including one honest limitation case (Medical), a Departments/Organizational Layer table, an Educational Data Flow table, an eleven-stage Learner Life Journey narrative, twenty-five Educational Operating System Laws (five genuinely new, twenty restated from 7A/7B/7D with citation), and a North Star Vision.

**Central synthesized finding**: the universal six-stage workflow shape (Part 5) is not a new invention — it is the generalization of two patterns this series already found working in production (Evidence's lifecycle state machine, Adaptive Learning's draft/approve gate). The vision this document closes with is explicitly framed as extending that one proven discipline to every domain, not adding more AI capability.

**Career Intelligence's ownership gap is now independently corroborated a fourth time** (after 6G, 7C, 7D) — this document's Parts 3, 4, 8, and 9 each re-derive the same finding from a different angle (Intelligence-type scoping, decision-hierarchy table, learner-journey narrative, and a new Law 23 specifically): a career/trajectory recommendation for a minor should remain overridable by the learner themselves, not only by an organizational senior — the one decision in the entire Human Decision Hierarchy table where the subject of the decision is also a legitimate overrider.

**Three learner-journey stages named for the first time in the series** (Part 8): Orientation, Leadership, and Lifelong Learning have no repository presence and were never searched for by any prior sprint, purely because no prior sprint's example list included them — generalized into new Law 24, a methodological note that this series' own example lists have themselves been incomplete, not only that EduNexus's implementation is.

**Architectural documents referenced**: the complete 6A–7D series in full (every today-state claim cited to origin, no re-derivation).

**ADR**: None — this document sharpens the Career Intelligence ownership question a fourth time but does not treat repeated sharpening as a new canonical-domain conflict.

**Tests added**: None (future-state synthesis only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-7e-educational-operating-system-blueprint.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 7D: Educational Decision Model (READ ONLY + RESEARCH, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-7d-educational-decision-model.md`, combining repository evidence (restated from 6G/7A/7B/7C, not re-derived) with clearly-labeled external research (Parts 3 and 9, UNESCO/OECD/responsible-AI-in-education guidance) to build a first-class Educational Decision Catalogue (35 decisions, ED-01 through ED-35, each with a stable ID, category, and status), an AI classification table (Suggest/Recommend/Predict/Warn/Explain/Decides), a description (not design) of how Evidence/Projection/Recommendation/Human-judgement could combine into one explainable decision model, and ten Educational Decision Principles.

**Central finding, sharpened across three sprints now (6G → 7C → 7D)**: Career Intelligence (ED-25) is this series' one confirmed case of an AI subsystem that actually *decides* rather than suggests/recommends/predicts/explains — writing directly to `careers`/`career_matches` with no human gate, no trust marker, and no accountable named reviewer (restated 6G Part 3/9). This sprint's external-research comparison (Part 9) adds that this is not merely a governance gap but sits in direct tension with UNESCO/OECD guidance's consistent emphasis on meaningful (not nominal) human oversight for consequential, individual, minor-affecting decisions — and 7C's organizational research already established that a real school would treat career guidance as *part of* the confidentiality-bound Guidance & Counselling function, which does not exist in EduNexus at all, so there is currently no natural human owner to hand the decision back to.

**Decision Catalogue produced (Part 5)**: 35 decisions across Administrative, Academic, Student Welfare, Leadership, Teacher, Parent, and National categories, each tagged with current status (exists/missing/duplicated/unreachable/incorrectly-owned) and a pointer to its full attribute row where one exists — designed as a stable reference future features should check against before writing code, extending Sprint 6G's Decision Responsibility Matrix with IDs and the fuller welfare/leadership/national categories that matrix did not organize by.

**Decision Intelligence description (Part 7)**: describes, without designing, how the platform's existing well-built pieces (Assessment as raw observation, Evidence as confirmed fact, Projection as interpreted state, Career/Adaptive Learning/Holiday Planner as recommendation-layer outputs) already form most of an explainable decision chain — with two named gaps: Teacher's informal day-to-day observation has no ingestion point into Evidence at all, and Career Intelligence is the one recommendation-layer output that bypasses the human-decision step (d) that closes the loop for every other consumer of Projection.

**Architectural documents referenced**: the full 6A–7C series (all EduNexus-side findings cited back to origin, not re-derived), plus external research explicitly and consistently distinguished from repository evidence throughout (Parts 3 and 9).

**ADR**: None — this sprint sharpens an already-identified governance concern (Career Intelligence's ownership, first found 6G) with external comparison; it does not surface a new canonical-domain conflict.

**Tests added**: None (read-only + research, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-7d-educational-decision-model.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 7C: Educational Organizational Model Research (RESEARCH, NOT A CODE AUDIT)

**What changed**: no code was written and no new repository investigation was performed (Parts 1–7 are external research/reasoning about real school organizational models, explicitly labeled as such throughout — not repository evidence). Produced `docs/architecture/sprint-7c-educational-organizational-research.md`: organizational-structure research across Kenyan public/private, CBC, Cambridge, IB, Finnish, Singaporean, and digital-first schools; academic leadership role research (Principal through Guidance & Counselling); departments/faculties/curriculum-organization/assessment-governance/student-support research; then a Part 8 comparison of every researched organizational unit against EduNexus's already-established (Sprint 6A–7B) findings, and Part 9 adopt/ignore/postpone/configurable recommendations.

**Central comparison finding (Part 8)**: nearly every academic-leadership title EduNexus's Reference School seed data already names (Dean of Studies, Examinations Officer, Registrar/Admissions Officer, the Academics/Administration Deputy Principal split) corresponds to a real, well-documented role in actual Kenyan school practice — the gap this document sharpens is not that EduNexus invented the wrong structure, but that it named the right structure in seed data and then never modeled the authority differences at all, collapsing role after role into `school_admin`/`headteacher`/`deputy_headteacher` with no distinction (restated from 6E Part 4, 7A Part 2, now cross-checked against real-world role definitions rather than only against the codebase's own internal consistency).

**Sharpened finding on Guidance & Counselling**: this sprint's Part 7 research on real student-support governance — confidentiality tiers, human-only judgment requirements, referral/escalation workflows — makes the strongest case yet in this series for why Career Intelligence's current shape (autonomous, persisted, unreviewed, restated 6G Part 3/9) is not merely under-governed but structurally misplaced: a real Guidance function's defining characteristic is categorically incompatible with an ungated AI system occupying its territory, not just missing an approval checkbox.

**New comparison findings not previously named by any prior sprint**: Year Coordinator (a whole-cohort pastoral/academic view distinct from a single class teacher's view) has no EduNexus analogue at all; real-school Promotion is typically a collective, staff-meeting-ratified decision, not the single-actor API-call shape EduNexus's dormant Promotion tables model even in their unreached, aspirational form.

**Recommendations produced (Part 9)**: Adopt — the Deputy Principal Academics/Administration split as real distinguishing authority, activated assessment moderation, a distinct confidentiality tier for any future Guidance domain, collective-decision promotion design. Ignore — Faculty/Programme/Course (mismatched to EduNexus's CBC/Kenyan-secondary scale) and full Singapore-style streaming committees. Postpone — full Departments-with-budget-ownership, Year Coordinator, Medical/Finance domains (already in 7A/7B's Long-term tier). Configurable per school — whether Departments are used at all, whether Guidance is a dedicated role or absorbed duty, the Deputy Principal split, and whether Stream is a meaningful concept for a given school's scale.

**Architectural documents referenced**: the full 6A–7B series (all EduNexus-side findings cited back to origin, not re-derived).

**ADR**: None — this document surfaces no canonical-domain conflict; findings are either restatements of already-established absences or external research with no direct code implication requiring ratification.

**Tests added**: None (research only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-7c-educational-organizational-research.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 7B: EduNexus Domain Architecture Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-7b-edunexus-domain-architecture.md`, applying a bounded-context/domain-driven-design lens to the full 6A–7A evidence base — domain discovery, ownership, boundaries, cross-domain contracts, maturity scoring, an AI domain map, future-domain justification, a dependency graph, twenty architectural laws, and the consolidated Official EduNexus Domain Map.

**New ground truth established this session**: a complete inventory of `lib/`'s 58 subdomain folders and `lib/repositories/`'s 24 repository files (read directly via `ls`), surfacing 19 real domains not named by the sprint's own example list or any prior sprint — most notably `lib/learnerModel/` and `lib/learnerIntelligence/`, whose relationship to the already-extensively-audited `lib/projection/` is genuinely unresolved and flagged as an open question rather than guessed at; `lib/teachingIntelligence/`, whose relationship to Sprint 6H's "no unified Teacher Intelligence surface exists" finding is now provisional pending investigation; and `lib/iam/`, a possible second authorization surface distinct from `lib/core/permissions.ts` that no prior sprint knew existed.

**New boundary/contract findings**: Academic Clinic and Career Intelligence — conceptually distinct (deterministic vs. AI-generative, per Sprint 6E Part 7) — share the same repository (`repos.careers`) with no structural separation at the data-access layer, named as this sprint's one confirmed "leaky abstraction." The Core Reporting pipeline was found to depend on Assessment being publish-locked, but the two domains anchor to different learner-identity spaces (`learners.id` vs. `students.id`) — a hidden dependency that can never actually be satisfied for the vast majority of learners, whose Assessment history lives under the identity space Reporting's Core pipeline does not check.

**Domain maturity scoring (Part 5)** introduces a explicit rule, generalized into Law 11: a domain's maturity is capped by its least-reachable half, not its best-built half — applied concretely to Reporting, Enrollment, and Promotion, each of which has a well-built Core pipeline that does not raise the domain's score because it is unreachable in production.

**Twenty architectural laws produced (Part 9)**, each cited to specific repository evidence rather than asserted abstractly — extending Sprint 7A's ten design principles with ten more, specific to domain boundaries and contracts: notably Law 12 ("two independently-computed artifacts claiming to answer the same question is a defect, even with zero shared code to blame," generalizing the Report Card duplication finding) and Law 15 ("a learner-scoped table must declare which identity space it is anchored to, and every consumer must check," generalizing this session's new Reporting hidden-dependency finding).

**Architectural documents referenced**: the full 6A–6H series and 7A (all restated findings cited back to origin, not re-derived), CLAUDE.md.

**ADR**: None — every finding is a boundary-clarity gap, a contract-health gap, or a newly-surfaced open question about previously-unread `lib/` folders; none contradict an already-ratified canonical decision (ADR-0002, Stage 0.5's Fourth Law, or any Constitution/RAS provision).

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-7b-edunexus-domain-architecture.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 7A: Complete Educational Operating System Blueprint (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-7a-edunexus-operating-system-blueprint.md`, extending the 6A–6H series with exhaustive repository-wide searches for domains and actors never previously audited — Fees, Medical, Transport, Boarding, House/Dormitory, Alumni, Library, Discipline, Certificate/Transcript, and Ministry/KNEC/KICD/County integration — plus a full learner-lifecycle trace, human-actor census (30 actors), educational-object census (30 objects), decision inventory extension, a research-labeled real-school comparison, 10 architectural design principles, and a full Operating System Blueprint (vision/architecture/actors/workflows/philosophy/boundaries/expansion/principles/phases).

**Decisive new finding**: six entire real-school domains — Fees, Medical, Transport, Boarding, House, and Alumni — are VERIFIED absent by exhaustive repository-wide search, with **zero schema, zero code, and zero seed-script fossil of any kind** (a stronger absence than Attendance, which at least left a fossil — `school_report_cards.days_present`/`days_absent`, per Sprint 6G). Several real-school decisions (Suspension, Expulsion, Department-creation, House-assignment) have no code form at all, distinct from decisions like Promotion that at least have a table and a gated route that has simply never fired.

**Second finding**: of 30 human actors investigated, 19 are entirely new territory not covered by Sprint 6E. School Nurse, Librarian, Boarding Master, House Master, Driver, Security, Kitchen, and Storekeeper have zero repository presence of any kind — not even a Reference School seed-script label, a meaningfully deeper absence than the six seed titles (Dean of Studies, Examinations Officer, Finance Officer, Admissions Officer, ICT Administrator, School Secretary) 6E found collapsed into `school_admin`. **Guidance & Counselling is the sprint's most consequential actor finding**: its functional territory is not merely unmodeled — it is actively occupied by Career Intelligence, an AI system with none of the governance (approval gate, trust marker, traceability) Sprint 6G already found missing from that subsystem.

**Third finding**: KNEC and KICD are both confirmed non-integrations — KICD is a static curriculum-content source (correctly used), and the "KNEC export" route (`app/api/teacher/reports/knec-export/route.ts`) produces a CSV formatted to KNEC's CBC level-label conventions with no actual API call, credential, or data submission to any real KNEC system. `nemis_code` exists only as a free-text storage column on `schools`, not an integration with the Ministry's NEMIS system.

**Ten design principles produced (Part 9)**, each grounded in a specific repeated finding across all nine sprints rather than asserted abstractly — most notably Principle 10: "What is not modeled cannot be protected, decided, reported on, or made intelligent — absence is a design decision with consequences, not a neutral default," directly citing this sprint's own six-domain absence finding.

**Architectural documents referenced**: the full 6A–6H series (all restated findings cited back to origin, not re-derived), CLAUDE.md.

**ADR**: None — every finding in this sprint either extends an already-documented absence (Departments, House, Attendance) or newly confirms an absence this series had not previously searched for; per the document's own Principle 10, absences are treated as a distinct, non-ADR-triggering category from canonical-domain conflicts.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-7a-edunexus-operating-system-blueprint.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 6H: School Operating System Blueprint (SYNTHESIS ONLY, NO CODE MODIFIED, NO NEW INVESTIGATION)

**What changed**: no code was written and no new codebase investigation was performed. Produced `docs/architecture/sprint-6h-school-operating-system-blueprint.md`, synthesizing Sprints 6A–6G (structure, reconciliation, operating model, workflow, organization, information flow, decision & authority) into one architectural picture — 13 parts, a Decision-Responsibility-Matrix-informed executive verdict, and a one-page Architecture Map. This closes the 6A–6H audit series.

**Central synthesis finding**: reading all seven prior audits together shows one coherent story, not seven separate ones — the same vertical slice (Academics → Assessment → Evidence → Projection → Learning/Career Intelligence) is independently confirmed, by every one of the seven audits, to be the platform's best-organized (6E), best-flowing (6F), best-decided (6G), and most workflow-complete (6D) subsystem; the same institutional/administrative slice (Organization's admin-tier roles, Core's SIS schema, Promotion/Graduation/Withdrawal/Transfer/Report-Publish/End-of-Term) is independently confirmed by the same seven audits to be fully specified in schema and permission code and almost entirely unpopulated, unreachable, or unexercised in production.

**School lifecycle trace (Part 3)**: constructed the full School Created → Archive lifecycle from prior evidence, marking two genuine break points — the Reports stage (where the entire upstream Evidence/Projection investment is bypassed by the legacy AI report pipeline real parents actually see) and Promotion onward (zero exercised production code path found anywhere in the series, compounded by Graduation being structurally unrepresentable in the legacy identity table and Archive never being implemented for any object).

**Intelligence placement (Part 7)**: determined that School/Administrative/Operational Intelligence are not merely unbuilt but currently *cannot* be built usefully — the admin-tier actor Organization would need to populate as their consumer cannot exist in production (6E), so this is a data/organizational precondition gap, not a missing-feature gap. Learning and Career Intelligence are the only categories with both real computation and a reachable audience.

**Executive verdict (Part 13)**: EduNexus is best described as "a Learning Intelligence Platform with the schema-level foundation of a School Operating System already laid, but not yet activated" — not a plain LMS (undercounts the Evidence-governance engineering), not a SIS (the data model exists but does not operate), not "an AI Tutor" alone (undercounts Evidence/Projection/Assessment), and not yet an "Integrated School Operating System" (only one of the reference model's seven layers has working end-to-end hand-offs).

**Implementation priorities (Part 9)**: grouped only from gaps already discovered in 6A–6G, no new projects invented, per the sprint's explicit constraint — Immediate (Career Intelligence traceability gap, Withdrawal's incompleteness, the duplicated `SCHOOL_ADMIN_ROLES` constant), Near-term (Report Card pipeline consolidation decision, Promotion/Graduation UI-or-deprecate decision), Medium-term (students/learners identity reconciliation, parent-linking consolidation, Subject/Grade duplication), Long-term (Attendance/Timetable/Departments/Discipline/ERP — confirmed absent domains — and an internal school-domain event bus).

**Architectural documents referenced**: all of Sprints 6A–6G in full, plus CLAUDE.md (validating the Evidence-first, thin-routes, pure-engine, and repository-pattern principles extracted in Part 11 against direct prior-sprint evidence rather than restating them as policy).

**ADR**: None — this document is explicitly a synthesis of already-completed audits; no new canonical-domain or authority conflict was discovered in the act of combining them.

**Tests added**: None (synthesis only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-6h-school-operating-system-blueprint.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 6G: Decision & Authority Model Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-6g-decision-and-authority-model.md`, the fourth and final layer of the 6-series audit — who (or what) actually makes every significant decision, across 13 parts plus a requested Decision Responsibility Matrix.

**Decisive new finding**: `learner_evidence`'s lifecycle columns (`reviewed_by`, `reviewed_at`, `review_reason`, `retracted_by`, `retracted_at`, `retraction_reason`, `supersedes`/`superseded_by` full correction lineage, frozen `trust_tier`/`evidence_confidence` snapshot) are, confirmed by direct schema inspection this session, the only fully traceable decision record in the platform. Every other "publish" decision found (`class_assessments.is_published`, `school_report_cards.is_published`, `holiday_plans.is_published`, `class_differentiation_plans.is_published`) records only that a publish happened and when — never who, never why. No table anywhere outside Evidence and Promotion/Transfer (`processed_by`+`reason`) has an actor-attribution column for its central decision at all.

**Second finding**: `school_report_cards` has `days_present`/`days_absent` columns with no producing workflow anywhere in the codebase — the clearest concrete evidence in the six-sprint series that a decision point (attendance recording/review) was designed for at the schema level and never built at the product level. The same table's `headteacher_comment` column has no write path found in any route searched this session — schema evidence of an anticipated Report Approval step that was never implemented, consistent with Sprint 6E's finding that the headteacher role can never be granted in production.

**Third finding**: Career Intelligence is confirmed as the platform's one fully autonomous, unreviewable, untraceable decision — AI persists directly to `careers`/`career_matches` with no approval gate, no reviewer/override mechanism, and no trust/confidence column of the kind Evidence has, in direct contrast to every other AI-touching subsystem audited (Adaptive Learning, Holiday/Remedial Planning, Lesson Plan/SOW), all of which correctly gate AI drafts behind a teacher-approval step before they take effect.

**Educational authority determination (Part 12)**: EduNexus's dominant, near-total authority model is Teacher Authority — every decision that actually executes in production is made by the class teacher, by elimination (Administrative authority is fully specified in schema/permissions but provably unexercisable, restated from Sprint 6E). Career Intelligence is the sole exception where AI Authority operates without a human counterpart.

**Series synthesis (Part 13)**: the same subsystem (Evidence/Projection) is simultaneously the best-organized (6E), best-flowing (6F), and best-decided (6G) part of the platform; the same institutional/administrative layer is simultaneously the least populated (6E), least workflow-reachable (6D), most fragmented (6F), and least exercised (6G) — a consistent finding across four independently-conducted audits, not four separate problems.

**Architectural documents referenced**: Sprints 6A–6F (restated findings cited back to origin, not re-derived), CLAUDE.md (Evidence immutability/lifecycle rules, teacher_id-as-attribution-not-access-gate rule).

**ADR**: None — no new canonical authority conflict discovered; every finding is a traceability, reachability, or lifecycle-completeness gap in decision patterns this series already established the underlying models for.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-6g-decision-and-authority-model.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 6F: School Information Flow Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-6f-school-information-flow-model.md`, tracing how information itself moves through the platform — 13 parts (inventory, flow maps, cross-domain flow, producers, consumers, transformations, dead ends, bottlenecks, duplication, trust levels, Intelligence readiness, lifecycle gaps, OS readiness) plus a requested end-to-end learner journey narrative from admission through archival.

**Decisive new finding**: the platform-wide event system (`lib/events/`) is a write-only audit log for every Core/school-domain event publisher. `publishEvent()` is called from 15+ modules (`lib/core/school.ts`, `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `lib/compass/session.ts`, `lib/holiday/planner.ts`, `lib/academy/missions.ts`, and more) but `registerEventHandler()` — the only function that could wire an internal handler to react to a delivered event — has zero callers anywhere in the codebase, and `event_subscriptions` rows are only ever created through the developer-platform's own per-organization webhook API, structurally separate from the school domain. Every school-domain event published today is inserted into `platform_events` and never delivered to anyone.

**Second finding**: Report Card generation has two independently-computed, non-communicating pipelines — the real, live, parent-facing path is a legacy AI generator reading raw `assessments` directly (no term-average computation, no ranking); the institutionally correct Core pipeline (`lib/core/report-cards.ts` — real per-learner term averaging plus `lib/ranking`'s standard-competition ranking with tie handling) is fully built but only reachable through the dormant `runEndOfTerm` orchestration (restated/extended from Sprint 6D). Neither report path reads Evidence, Projection, or any Recommendation output — Report Cards are computed from raw Marks, bypassing the entire Intelligence chain, identified as the single largest "never reaches downstream" gap in the cross-domain trace.

**Third finding**: Career Intelligence is the platform's one clear "AI-generated content injected back into the system with no trust marker" case — persisted directly to `careers`/`career_matches` with no confirm/reject step of the kind Evidence has, and no code-visible flag distinguishing it from human-entered data once stored, in sharp contrast to Evidence's carefully-tiered confidence/trust system (the one place the platform models AI-generated-ness rigorously).

**Pattern finding (Part 12)**: Archive is the single most consistently missing lifecycle stage across every information object traced — not one object in this audit has a confirmed archival mechanism, including `learners.status = 'archived'`, whose type explicitly anticipates it but which no code path was found to ever set.

**Architectural documents referenced**: Sprints 6A–6E (restated findings cited back to origin, not re-derived), Stage 0.5, CLAUDE.md (Evidence lifecycle/immutability rules, Reasoning-layer citizenship of `capabilityExtractor.ts`).

**ADR**: None — every finding is a reachability, duplication, or lifecycle-completeness gap in already-ratified canonical models, not a newly discovered canonical-information conflict.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-6f-school-information-flow-model.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 6E: School Organizational Operating Model Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-6e-school-organizational-model.md`, answering "who performs the workflows Sprint 6D traced" — every organizational actor, an authority matrix, a real-school comparison, organizational gaps, a role-vs-permission analysis, a future-department exploration, an AI responsibility-boundary classification, organizational boundary-violation search, and an SIS/LMS/ERP readiness assessment.

**Decisive new finding**: Core's institutional admin tier (`school_admin`/`headteacher`/`deputy_headteacher`) is not merely underused, it is **structurally inert in production** — `updateSchoolUserRole` (`lib/core/school-users.ts:44`), the only function that can ever grant `headteacher` or `deputy_headteacher`, has zero callers anywhere under `app/`; `school_admin` is only auto-granted to whoever creates a Core school (`lib/core/school.ts:31`), and Core's own school-creation path has no UI caller either (its own code comment at `lib/core/school.ts:54-58` states Core has no onboarding UI at all). A real, DB-enforced 5-value role enum with a correctly-built permission layer sits on top of a grant path that can never fire. A fourth, entirely separate "admin" concept was also found: a platform-operator role gated by an `ADMIN_EMAILS` env-var allowlist (`app/admin/page.tsx:25`) — founder/operator tooling, not a school role, and notably the only UI page touching Core's school-creation route at all.

**Second finding**: the Reference School seed pipeline (`scripts/reference-school/03-seed-staff.ts:29-38`) names nine real Kenyan-school titles (Principal, two Deputy Principal variants, Dean of Studies, Examinations Officer, Finance Officer, Admissions Officer, ICT Administrator, School Secretary) and collapses all of them into just 3 of the 5 `SchoolUserRole` values — 5 of the 9 identically mapped to `school_admin` with zero distinguishing authority anywhere in `lib/core/permissions.ts`. Classified as "accidentally implied" organizational structure: present as fixture labels, absent from the authority model entirely.

**AI-boundary research (Part 7)**: confirmed `lib/ai/deepseek.ts` is the sole DeepSeek entry point platform-wide (no direct SDK calls found elsewhere). Career Intelligence (`lib/career/matchEngine.ts`, `careerEngine.ts`) is fully autonomous — AI output is persisted directly to `careers`/`career_matches` and served to student/parent with no human review step anywhere in the request path; the Compass chat tutor (`app/api/learn/route.ts`) streams AI text live to students with the same no-review shape. Adaptive Learning/Differentiation has the cleanest human-approval gate found in the platform (explicit teacher-approve endpoint). Three call sites (`lib/career/matchEngine.ts:79,147`, `lib/career/autoReportGenerator.ts:177`) violate CLAUDE.md's "always set max_tokens explicitly" rule.

**Boundary/RLS research**: no cross-domain write violations found in the four categories checked (teacher→admission, parent→academic-content, analytics→report-cards, non-Core→schools). Two structural findings recorded: `SCHOOL_ADMIN_ROLES` is independently, identically defined twice (`lib/core/permissions.ts:42` and `lib/core/context.ts:30` — a direct CLAUDE.md duplicate-constant violation); and the `learner_evidence_own_teacher` RLS policy (`20260707_evidence_domain.sql:126-134`) gates access by who *initiated the ingestion run*, not current teach-relationship — the same anti-pattern CLAUDE.md prohibits at the application-code level, present instead at the database RLS layer (likely inert since ~115 of 126 API routes bypass RLS via the service-role client).

**Architectural documents referenced**: Sprints 6A–6D (restated findings cited back to origin, not re-derived), ADR-0002, Stage 0.5, CLAUDE.md (duplicate-constant rule, AI max_tokens rule, teacher_id-as-attribution-not-access-gate rule).

**ADR**: None — no new canonical-domain question discovered; findings are reachability/authority gaps in an already-ratified model (`SchoolUserRole`, `teachers.id`, `students`/`learners`), not a new identity conflict.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-6e-school-organizational-model.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-16 — Sprint 6D: School Workflow & Responsibility Model Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: no code was written. Produced `docs/architecture/sprint-6d-school-workflow-model.md`, reframing Sprints 6A–6C's entity-level findings as workflows — start/end, actors, data created/consumed, approval points, and Administration↔Academics hand-offs — and tracing three workflows not previously examined in detail: Parent Communication, Withdrawal, and Transfer.

**Key findings**: no workflow-engine or approval-state abstraction exists anywhere in the codebase — every workflow is either a single atomic write or a hard-coded call chain with no persisted intermediate state. Evidence's confirm/reject step is the only genuine second-state approval gate found; Core's End-of-Term orchestration (`lib/core/endOfTerm.ts:46-76`) is the only genuine cross-actor (Academics-must-finish-before-Administration-proceeds) hand-off found, and it has zero UI callers — the best-designed workflow in the platform is completely dormant. Two new defects found: `withdrawLearner()` (`lib/core/learners.ts:90-92`) updates enrollment status only, never `learners.status` (which has no `'withdrawn'` value in its type at all — a withdrawn learner's top-level record still reads `active`); and Parent Communication is three non-communicating linking mechanisms (`students.parent_user_id`, `class_students.parent_id`, Core's `learner_guardians`) feeding two independent notification systems, with the class-code mechanism (`/api/class/join`) bulk-linking a parent to every unlinked classmate, not just their own child. Transfer (`lib/core/transfers.ts`) is the most correctly modeled state transition found (status + enrollment updated atomically) but, like Graduation and End-of-Term, has no UI caller.

**Architectural documents referenced**: Sprints 6A, 6B, 6C (restated findings cited back to origin, not re-derived), Stage 0.5, ADR-0002, CLAUDE.md (Evidence lifecycle rule).

**ADR**: None — audit only, no architecture change proposed or ratified.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. `git checkout -- docs/architecture/sprint-6d-school-workflow-model.md docs/engineering/implementation-log.md` fully reverts this entry if needed.

---

## 2026-07-15 — Security Hotfix SH-001: Report Card IDOR (Broken Object Level Authorization)

**Root cause**: `app/api/core/reports/route.ts`'s `GET` handler validated only that the caller belongs to the `schoolId` query parameter (`requireSchoolMembership`) — it never verified that the `learnerId`/`classId` supplied in the SAME request actually belonged to that school. The underlying repository methods trusted those foreign IDs completely: `lib/repositories/school.repository.ts::findReportCardWithSubjects` filtered only by `learner_id`/`term_id`, and `listClassReportCards` only by `class_id`/`term_id` — neither touched `school_id`. Any authenticated school staff member could therefore read another school's report cards (grades, CBC levels, class rank, learner names) by supplying their own valid `schoolId` alongside a guessed or otherwise-obtained `learnerId`/`classId` from a different school. Confirmed and evidenced by Sprint 5C (`docs/engineering/sprint-5c-service-role-authorization-audit.md`), independently re-verified line-by-line before this fix (not assumed).

**Fix**: added an ownership check to the two vulnerable service functions in `lib/core/report-cards.ts` — `getReportCard(learnerId, termId, schoolId?)` now calls the already-existing, already-school-scoped `repos.learners.findById(learnerId, schoolId)` first (throws if the learner doesn't exist or belongs to a different school — deliberately indistinguishable, so no cross-school existence is leaked); `listClassReportCards(classId, termId, schoolId)` calls the already-existing `repos.teachers.findClassById(classId, schoolId)` first. **No new repository method was created** — both ownership checks already existed, built for other purposes, and were reused exactly as SH-001 required. `school.repository.ts` itself was not modified; `teacher.repository.ts`/`learner.repository.ts` were not modified (only called). `app/api/core/reports/route.ts` now passes `schoolId` through to both calls and catches the thrown ownership failure as an explicit `404` (not `403` — cross-school and nonexistent resources are intentionally indistinguishable). `getReportCard`'s `schoolId` parameter is optional: its second caller, the parent-facing `app/api/reports/report-card/route.ts`, already gates on `requireParent(supabase, learnerId)` — a stronger, per-resource check than school membership — and needed no change.

**New, unrelated bug found and NOT fixed (documented as technical debt per explicit instruction)**: `findReportCardWithSubjects`'s embedded `term_subject_summaries` join has no actual foreign-key relationship between the two tables in the schema — every call fails with Postgres error `PGRST200`, silently swallowed because the function never checks `error`, so `getReportCard`'s `?learnerId&termId` path has returned `{data: null}` for every request, always, regardless of whether a report card exists. Predates this hotfix entirely; proven unrelated to the IDOR since the ownership check runs strictly before this broken query. Flagged here for a future, separate fix — not touched, per SH-001's explicit "do not fix unrelated findings" instruction.

**Architectural documents referenced**: Constitution, RAS §4/§7, `docs/engineering/sprint-5c-service-role-authorization-audit.md`, Phase B Engineering Rules.

**ADR**: None — no schema, table, migration, repository-ownership, or identity change; reuses two pre-existing, unmodified repository methods from within the service layer.

**Tests added**: `lib/core/reportCardOwnership.security.test.ts` — 12 live tests against real (throwaway) Supabase data, two separate schools: same-school access permitted (published and draft reports, both `getReportCard` and `listClassReportCards`), cross-school access blocked (learner, class, and draft-report variants), nonexistent learner/class blocked, malformed UUID blocked, the parent-facing no-`schoolId` path confirmed unchanged, and `generateReportCards` (untouched) confirmed still working. All 12 pass. `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the two edits (`lib/core/report-cards.ts`, `app/api/core/reports/route.ts`). `getReportCard`'s `schoolId` parameter is optional and `listClassReportCards`'s new parameter has exactly one caller (this route), so rollback requires no other file changes.

---

## 2026-07-15 — Sprint 5C: Service Role & Authorization Boundary Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing — this was a read-only security-posture audit, opening a new chapter after the Grading Domain series (Sprints 4A-4I) and Report Card Publication Integrity series (5A-5B), both now closed. Investigated whether `createServiceClient()` (which bypasses RLS entirely — confirmed from `utils/supabase/service.ts` itself, uses `SUPABASE_SERVICE_ROLE_KEY`) is contained to cron/webhooks as one CLAUDE.md rule states, or is the de-facto default server-side pattern as CLAUDE.md's other rule ("always use createServiceClient()") states — and, given the latter, whether app-layer/permission checks are the only thing standing between an authenticated wrong-school user and another school's academic records. Sampled representative routes across Core/legacy-teacher/parent/student/school-intelligence/cron domains and 4 of 24 repository classes; did not read all ~210 route files line-by-line — coverage is stated explicitly per section in the output doc. Produced `docs/engineering/sprint-5c-service-role-authorization-audit.md` (7 parts: service-role inventory, authorization boundary trace, defense-in-depth classification, academic-records risk ranking, repository audit, minimum hardening, executive verdict). No code, schema, or migration was written, edited, or proposed.

**Headline finding — new, not previously documented**: `GET /api/core/reports?schoolId=<own school>&classId=<any UUID>&termId=<any>` (and the `learnerId` variant) lets any authenticated school staff member read **another school's** full report cards — grades, CBC levels, class rank, learner names — because `lib/repositories/school.repository.ts:348-365` (`findReportCardWithSubjects`) and `:410-417` (`listClassReportCards`) never filter by `school_id`, while the route's own authorization check (`app/api/core/reports/route.ts:43`) validates a `schoolId` query parameter that is never cross-checked against the `classId`/`learnerId` actually queried. Classified Critical — confirmed exploitable today, not a hypothetical "if a check breaks" scenario (the strongest classification used in the audit). Two sibling methods in the same repository file (`updateReportCard`, `publishReportCards`) do filter by `school_id` correctly, showing the gap is inconsistent method-by-method discipline, not a systemic absence of the pattern.

**Systemic finding confirming/extending Sprint 5A's Part 4.6**: service-role usage is not cron/webhook-contained — 175 files reference `createServiceClient` directly, and all 24 `BaseRepository` subclasses (including the entire Core/school-scoped domain, which has zero *direct* `createServiceClient` imports precisely because it's routed through repositories) use it unconditionally. RLS provides zero protection anywhere this pattern is used — CLAUDE.md's "always use createServiceClient()" rule is the one actually governing the codebase, not the "reserve for cron/webhooks" rule; the two were never reconciled in code or docs. No ESLint rule restricts service-role usage outside cron/webhook contexts (only an unrelated Evidence-domain read guardrail exists in `eslint.config.mjs`). Repository-level tenant scoping (an `.eq('school_id', ...)` or `.eq('teacher_id', ...)` filter inside the query itself) is the dominant, and safer, pattern found — confirmed present in `learner.repository.ts`, `teacher.repository.ts`, `assessment.repository.ts` — but enforced only by individual-method discipline, not any structural guarantee.

**Architectural documents referenced**: `docs/engineering/sprint-5a-report-card-lifecycle-audit.md` (Part 4.6, re-verified and found systemic rather than report-card-specific), CLAUDE.md's Architecture/Security Rules sections, `lib/core/permissions.ts`, `eslint.config.mjs`.

**ADR**: None — audit only, no architecture change proposed or made.

**Tests added**: None (read-only sprint; no code changed).

**Rollback considerations**: None — no file outside the one new audit doc and this log entry was touched.

---

## 2026-07-15 — Sprint 5B: Report Card Publication Integrity Guard

**What changed**: closed the Critical finding from Sprint 5A — `generateReportCards` (`lib/core/report-cards.ts`) now refuses to run if any `school_report_cards` row for the requested class/term is already published, checked via the existing `repos.schools.listClassReportCards(classId, termId)` (no new repository method). The check runs before any read/write in the function, so a mixed class (some published, some draft) is refused entirely — all-or-nothing, no partial regeneration. On refusal, throws a plain `Error` (matching this file's existing convention — not the `EduNexusError` hierarchy, since this is a state conflict, not an authorization failure) with a message naming the count of already-published cards and stating no records were modified. Both callers of `generateReportCards` — `app/api/core/reports/route.ts`'s `POST` Generate action and `lib/core/endOfTerm.ts::runEndOfTerm` (called from `app/api/core/school/end-of-term/route.ts`) — gained a `try/catch` at the route layer returning `409 Conflict` with the guard's message, so the explicit-error requirement reaches the client instead of falling through to a generic 500. `lib/core/endOfTerm.ts` itself was left untouched (already a thin orchestrator with no error-normalization for any of its other underlying calls — consistent, not a special case).

**Consequence for End-of-Term, stated explicitly, not hidden**: running End-of-Term twice for the same class/term now fails at the `generateReportCards` step instead of silently regenerating-then-republishing (Sprint 5A's own finding that this path "self-healed" the publish flag while still silently overwriting the underlying grades first). This is the guard working as designed on every caller of the shared generation path, not a redesign of the End-of-Term workflow itself.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, `docs/engineering/sprint-5a-report-card-lifecycle-audit.md` (Parts 4, 6, 7), Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no new table, repository, lifecycle state, migration, or ownership change; reuses an existing read method inside the same service function.

**Tests added**: `lib/core/reportCardPublicationGuard.integration.test.ts` — 5 live tests against real (throwaway) Supabase data: first generation (no existing rows) allowed, regenerating an all-draft class allowed, regenerating a class with a published card refused, a mixed published+draft class refused in full with both rows verified byte-for-byte unchanged afterward (proving no partial write), and publication state (`is_published`, `overall_score`, `overall_cbc_level`) proven unchanged after a refused attempt. All 5 pass. `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the guard clause in `lib/core/report-cards.ts` and the two route-level `try/catch` additions. No schema/data changes were made, so rollback has zero data-integrity impact — it simply restores the pre-Sprint-5B (unsafe) behaviour.

**Report Card lifecycle status**: the single Critical finding from Sprint 5A (silent overwrite of published grades + publication-status reset) is closed. Sprint 5A's Medium/Low findings (service-role RLS bypass as a single point of failure for parent-visibility, `updatePdfUrl` dead code, the separate legacy AI report pipeline's lack of any publication concept) remain open and out of this sprint's scope.

---

## 2026-07-15 — Sprint 5A: Report Card Publication Lifecycle Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing — this was a read-only architecture audit opening a new chapter after the Grading Domain series (Sprints 3D, 4C0-4I, now closed). Traced the complete Core `school_report_cards` lifecycle (generate → draft → publish → parent view → regeneration) and, for comparison, the separate legacy AI clinic-report pipeline (`student_clinic_reports`). Produced `docs/engineering/sprint-5a-report-card-lifecycle-audit.md` (7 parts: lifecycle diagram, state machine, transition audit table, integrity audit, domain invariants, smallest future fixes, executive verdict). No code, schema, or migration was written, edited, or proposed.

**Headline finding — re-verified, still live**: Sprint 4C0 Part 5.4's "re-generation overwrites a published report card" gap is confirmed unchanged against current code. `generateReportCards` (`lib/core/report-cards.ts:8-93`) still has no guard against overwriting an already-published row — line 86 unconditionally sets `is_published: false` on every generated row, and `upsertReportCards`'s `ON CONFLICT (learner_id, term_id)` (`lib/repositories/school.repository.ts:297-313`) means a second Generate call for the same class/term silently overwrites `overall_score`/`overall_cbc_level` and resets publication status, reachable via `POST /api/core/reports` (`app/api/core/reports/route.ts:100-112`, admin-gated but otherwise unguarded). No later Grading-chapter work (Sprints 4C1-4I) added a guard. `generateReportCards` also emits no audit event distinguishing first generation from regeneration (only `publishReportCards` emits `teacher.report_card.published`).

**New findings this sprint** (not previously documented): (1) all `school_report_cards` repository access goes through the service-role client (`lib/repositories/base.ts:8`), so the table's RLS policies — including `school_report_cards_parent_published` — are bypassed for all app traffic; the *only* real enforcement of "parents see published reports only" is a single `if (!report.is_published)` check in `app/api/reports/report-card/route.ts:47`, a single point of failure with no defense-in-depth. (2) `updatePdfUrl`/`updateReportPdfUrl` is dead code — never called anywhere in the app — so the "stale cached PDF" corruption scenario does not currently materialize for the Core system. (3) `runEndOfTerm` (`lib/core/endOfTerm.ts:65-66`) calls generate and publish back-to-back with no separate confirmation step, leaving "publication is explicit" only Partially Proven. (4) the legacy `student_clinic_reports` table has no publication/state concept at all, and its two upsert call sites use two different, inconsistent `onConflict` keys (`career.repository.ts:310` vs. `:443`) with no confirmed unique constraint backing either — flagged as `UNKNOWN`, out of this sprint's primary scope.

**Architectural documents referenced**: `docs/engineering/sprint-4c0-grading-policy-integration.md` Part 5 (prior finding, re-verified not re-derived), `docs/architecture/deprecation-registry.md` entry #6 (legacy vs. Core report-card duplication, still "Not Yet Decided"), `docs/engineering/sprint-5a-report-card-lifecycle-audit.md` (this sprint's own output).

**ADR**: None — audit only, no architecture change proposed or made.

**Tests added**: None (read-only sprint; no code changed).

**Rollback considerations**: None — no file outside the one new audit doc and this log entry was touched.

---

## 2026-07-15 — Sprint 4I: Analytics/Cohort Grading → Canonical Grading Engine (Grading Migration Complete)

**Note on sprint numbering**: this sprint's brief referenced "Sprint 4H" as an accepted prerequisite audit; no such document or log entry exists. Flagged to the user before implementation began; the user's guidance was to treat Sprint 4G's own live-tested findings as sufficient and proceed, with a readiness check as this sprint's own first step rather than a separate audit sprint. That check (below) found no blocking gap, so implementation proceeded.

**What changed**: closed the last open item from Sprint 4E's blocker. Deleted `assessment.repository.ts::gradeLevelFromScore` (hardcoded 75/50/25, no boundaries parameter) and replaced its 7 call sites (inside `getAssessmentAnalytics` and `getCohortData`) with `buildCbcScale()`/`toCbcGrade()`, delegating to `lib/grading::gradeScore()` — the same pattern Sprint 4C1 used for `computeTermSummaries`/`generateReportCards`. Both repository methods gained an optional `gradeBoundaries: Record<string, {min:number}> = {}` parameter (backward compatible — omitting it reproduces the exact old 75/50/25 default), threaded through their thin service wrappers (`lib/assessments/analytics.ts`, `lib/assessments/cohortQueries.ts`). `app/api/teacher/analytics/route.ts` and `app/api/teacher/cohort/[grade]/route.ts` now resolve real boundaries via a new shared function, `lib/core/school.ts::resolveTeacherGradeBoundaries(teacherId)`, which composes Sprint 4G's `findSchoolIdByTeacherId` with the already-existing `findSettings` — falling back to `{}` for an unbridged teacher or a bridged school with no `school_settings` row yet (never throwing). This one shared function, not duplicated per-route, satisfies this sprint's explicit "do not duplicate lookup logic" constraint.

**Readiness check performed before implementation** (in lieu of the missing "Sprint 4H"): confirmed `getAssessmentAnalytics`/`getCohortData`'s call sites could accept a new optional trailing parameter without breaking any existing caller, and confirmed `SchoolRepository::findSettings(schoolId)` already exists and returns `grade_boundaries` — no new repository method needed beyond Sprint 4G's own `findSchoolIdByTeacherId`. No gap found; proceeded.

**Both call sites' raw scores were not, and are still not, guaranteed to be 0-100** (`subject_scores`/`mean_score` can exceed 100 if an assessment's `max_score` does) — this was already true of the deleted `gradeLevelFromScore`, which tolerated it silently (any score ≥ 75 simply returned `'EE'`, however large). Preserved exactly via the same `Math.min(100, Math.max(0, score))` clamp Sprint 4C1 established, so `gradeScore()`'s stricter range validation doesn't introduce a new crash on an input the old code already handled (if crudely) — not a grading-policy fix, a defensive necessity of switching engines.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #5 (updated — 5 of ~7 implementations now migrated, see below), `docs/engineering/sprint-4f-teacher-school-identity-audit.md`, Sprint 4G/4C1 implementation-log entries, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no new repository, table, schema, or ownership change; reuses `SchoolRepository`'s existing identity/settings ownership exactly as Sprint 4G established it.

**Tests added**: `lib/repositories/gradeLevelFromScore.grading.regression.test.ts` (3 tests: default-boundary parity with the deleted function, newly-correct custom-boundary behaviour the old function structurally couldn't support, defensive clamp), `lib/repositories/gradingCrossPathParity.test.ts` (3 tests proving Report Cards/Term Summaries/Analytics/Cohorts agree with each other for identical inputs, for both default and custom boundaries, plus exact-boundary-edge agreement), `lib/core/resolveTeacherGradeBoundaries.integration.test.ts` (3 live tests against real Supabase: a bridged teacher with custom `grade_boundaries` resolves those exact values, an unbridged teacher resolves `{}`, a nonexistent `teacherId` resolves `{}` without crashing). All pass; Sprint 4G's own integration test re-run clean (3/3, after one transient network retry unrelated to this sprint's code). `tsc --noEmit -p .` clean. Full grep confirms zero remaining references to `gradeLevelFromScore` outside comments explaining its removal.

**Rollback considerations**: revert the commits touching `assessment.repository.ts`, `lib/assessments/analytics.ts`, `lib/assessments/cohortQueries.ts`, `lib/core/school.ts`, and the two route files. All new parameters are optional with defaults matching pre-sprint behaviour, so a partial rollback (e.g. reverting only the route files) degrades gracefully to the old 75/50/25-only behaviour rather than breaking.

**Grading domain status**: Report Cards, Term Summaries, Analytics, and Cohorts — the 4 production-facing grading surfaces identified across Sprints 3-4 — are now all canonical, provably in agreement for identical inputs. Remaining, deliberately out of this sprint's scope: `gradeCalculator.ts`'s legacy gradebook scale (76/51/31, unresolved vs. 75/50/25 correctness question), Evidence Domain's `cbcScale.ts` (different type/domain, permanently out of scope), `ke-cbc.ts` (dead code), and the Assignments/Notifications duplicate sets (not yet scoped to any sprint).

---

## 2026-07-15 — Sprint 4G: Reverse Teacher→School Identity Lookup

**What changed**: added exactly one new method, `SchoolRepository::findSchoolIdByTeacherId(teacherId)`, resolving a legacy `teachers.id` to a Core `schools.id` — the reverse of the already-existing `findTeacherUserIdsBySchoolId`/`findTeachersBySchoolId` (school→teacher direction). Walks `teachers.user_id → school_users.user_id → school_users.school_id`, the exact bridge Sprint 4F confirmed already exists and is already populated by `scripts/reference-school/06-seed-legacy-bridge.ts`. Returns `null` for the common case (a teacher never bridged to a `school_users` row). No new table, foreign key, schema change, migration, or repository — added inside `SchoolRepository`, which already owned both halves of this identity space (it already queries both `teachers` and `school_users` for the forward direction). This is an identity capability only — nothing yet calls this new method; grading, analytics, cohorts, and report cards are untouched.

**Validation**: the actual "Mwatate Ridge Senior School" reference fixture was confirmed NOT seeded in this environment's linked Supabase project (checked live before writing any test, not assumed) — so validation used a throwaway dataset built with the identical linkage pattern the reference-school bridge script uses (a real `schools` row via `repos.schools.create`, a real `school_users` row via `repos.schools.addSchoolUser`, and a real legacy `teachers` row sharing the same `auth.users.id`), run against the live, real Supabase project (not mocked), then cleaned up — cleanup verified with a separate live query confirming zero leftover synthetic rows.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, `docs/engineering/sprint-4f-teacher-school-identity-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no new canonical identity, ownership, table, or repository; the method lives inside the repository that already owns both tables it reads.

**Tests added**: `lib/repositories/findSchoolIdByTeacherId.integration.test.ts` — 3 tests against real (throwaway) Supabase data: a bridged teacher resolves to the correct school, an unbridged teacher resolves to `null`, a nonexistent `teacherId` resolves to `null`. All 3 pass. `tsc --noEmit -p .` clean.

**Grading behaviour**: unchanged — confirmed via `git diff`, only `lib/repositories/school.repository.ts` was touched; `gradeLevelFromScore` and every grading/report-card/cohort code path remain exactly as Sprint 4E left them.

**Rollback considerations**: delete the one new method — nothing calls it yet, so rollback has zero blast radius.

---

## 2026-07-15 — Sprint 4F: Teacher → School Identity Resolution Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing in code, schema, or data — a read-only identity-resolution trace, not a grading audit and not an implementation sprint. Sprint 4E found that `gradeLevelFromScore`'s callers (`getAssessmentAnalytics`, `getCohortData`) have no path from `teacherId` to a `schools.id` because `teacher_classes`/`class_assessments` have no `school_id` column. Sprint 4F traced every FK-shaped column on `teachers`, `teacher_classes`, and `class_assessments` to completion (confirmed against the live generated schema in `lib/database.types.ts`, not just migration grep) and inventoried every production code path, anywhere in the repository, that can resolve a teacher to a school.

**Key finding**: the bridge between the two identity systems already exists and is live in production — just in the opposite direction from what grading needs. `teachers.user_id` and `school_users.user_id` share the same `auth.users.id` value space, and `lib/repositories/school.repository.ts`'s `findTeacherUserIdsBySchoolId`/`findTeachersBySchoolId`/`findTeacherClasses` already join `school_users` → `teachers` → `teacher_classes` (school → teacher direction), used today by `lib/school/intelligence.ts::computeSchoolIntelligence()` for the Principal Dashboard. No function exists that starts from a bare `teacherId`/`userId` and discovers its school (teacher → school direction) — every existing membership function (`resolveMembership`, `buildSchoolContext`) requires `schoolId` supplied by the caller, it only confirms membership, never discovers it. `scripts/reference-school/06-seed-legacy-bridge.ts` concretely proves the two systems can coexist for one real person: `bridgeTeachers()` inserts a `teachers` row using the *same* `user_id` as an existing `school_users` row.

**Missing link, precisely**: not a missing column — a missing guaranteed row. `teachers.user_id` → `school_users.user_id` is schema-supported today, but resolves to nothing for any teacher who was never onboarded into Core's `school_users` table (presumed to be most/all of the legacy install base, which predates Core; no production row count was queried, per this sprint's read-only scope).

**Classification**: Legacy subsystem isolation (not missing FK, not missing repository, not identity duplication, not data model inconsistency) — `teachers`/`teacher_classes`/`class_assessments` predate `schools`/`school_users` entirely (no `CREATE TABLE` for the legacy tables exists in tracked migration history at all), and the bridge that would connect them was only ever built in one direction.

**Executive verdict**: the legacy gradebook does not currently know its School. This is historical technical debt, not documented intentional architecture — no document found (Canonical Domain Registry, RAS, Deprecation Registry, or any Sprint 3-series audit) argues for permanently keeping the systems unlinked; all treat it as an open, unresolved migration boundary. Full trace, evidence, and file/line citations in `docs/engineering/sprint-4f-teacher-school-identity-audit.md`.

**Architectural documents referenced**: `docs/architecture/deprecation-registry.md` entry #5, `docs/architecture/canonical-domain-registry.md`, `docs/architecture/reference-architecture-specification.md`, this log's Sprint 4E entry (2026-07-15).

**ADR**: None — no code, schema, identity, or ownership change occurred; audit only.

**Tests added**: None — no code changed.

**Rollback considerations**: None — read-only sprint. Only new artifact is `docs/engineering/sprint-4f-teacher-school-identity-audit.md`, freely deletable with no code or data impact.

---

## 2026-07-15 — Sprint 4E: `gradeLevelFromScore` Migration Attempt — BLOCKED, Reclassified (NO CODE MODIFIED)

**What changed**: nothing in source code. Sprint 4E was authorized to bring `assessment.repository.ts::gradeLevelFromScore` onto the canonical `lib/grading` pipeline, "same mechanical pattern as Sprint 4C1." Before writing any code, traced `gradeLevelFromScore`'s two callers — `getAssessmentAnalytics` and `getCohortData` (both `assessment.repository.ts`) — and found the assumption behind "same pattern" doesn't hold: both are scoped entirely by `teacherId` over `teacher_classes`/`class_assessments`, and **neither table has a `school_id` column in any migration, ever** (confirmed via grep across `supabase/migrations/*.sql`). Sprint 4C1's migration worked mechanically because `computeTermSummaries`/`generateReportCards` already received `schoolId`/`gradeBoundaries` as parameters from their Core-routed callers — `gradeLevelFromScore`'s callers have no equivalent, because the legacy teacher-gradebook path has no school concept at all (already an accepted fact from the original Sprint 3 domain audit) and runs parallel to, not linked with, the Core `school_users`/`school_settings` system. Closing this would require inventing a teacher→school identity resolution that doesn't exist anywhere today — a new abstraction, not a parameter-thread, and explicitly forbidden by this sprint's "no new abstractions, no redesign" constraints.

**Decision, presented to and confirmed by the user before any implementation**: stop, do not implement, reclassify `gradeLevelFromScore` in the Deprecation Registry from "not yet migrated" to "acceptable duplicate, not migratable in place" — see `docs/architecture/deprecation-registry.md` entry #5, updated alongside this entry. The report-card-vs-analytics grading inconsistency for schools with a customized `grade_boundaries` value remains open, but is now understood to require a separate, larger scoping effort (resolving teacher→school identity across the legacy/Core divide) — not a mechanical fix.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #5 (updated), `docs/engineering/sprint-4d-grading-engine-completion-audit.md`, `docs/engineering/implementation-log.md`'s Sprint 4C1 entry, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no code, schema, identity, or ownership change occurred; this entry documents a blocked attempt and a classification update, not an implementation.

**Tests added**: None — no code changed, nothing to test.

**Rollback considerations**: None — no code was modified. Only this log entry and the Deprecation Registry classification are new.

---

## 2026-07-15 — Sprint 4D: Grading Engine Completion Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing in code, schema, or grading boundary values — this was a read-only architecture audit closing out the Sprint 4A→4C1 Grading Domain series. Re-verified every grading-related implementation in the repository from scratch against live code (not trusting prior docs' line numbers), confirmed `lib/grading` remains zero-dependency and pure, confirmed the 2 Sprint 4C1 migrations (`lib/core/assessments.ts::computeTermSummaries`, `lib/core/report-cards.ts::generateReportCards`) still delegate correctly to `gradeScore()` with no new DB coupling, and confirmed `SchoolRepository` remains the sole reader of `school_settings.grade_boundaries`. Produced a full 7-part audit: canonical-flow diagrams for the now-diverged migrated vs non-migrated paths, a duplicate-logic classification table (Canonical/Acceptable duplicate/Technical debt/Dead code/Architectural violation) for every implementation found, a boundary-consistency table, a repository-boundary audit, a ranked production-risk list, a per-implementation retirement plan, and an executive verdict.

**Key finding — Critical, newly real (not merely theoretical)**: the Sprint 4C1 partial migration means `computeTermSummaries`/`generateReportCards` now honor a school's custom `grade_boundaries` override, while `lib/repositories/assessment.repository.ts::gradeLevelFromScore` (feeding `/api/teacher/analytics`, `/api/teacher/cohort/[grade]`, `/api/teacher/cohorts`) still hardcodes 75/50/25 unconditionally. Before 4C1 every implementation ignored the setting, so all views coincidentally agreed; after 4C1, any school that sets a custom boundary will see disagreeing letter grades between report cards and cohort/analytics dashboards for the same student and score. Currently latent — Sprint 4C0's original finding that no school has actually set a custom value yet still holds — but the divergence is now mechanically live, one settings write away from firing.

**New finding not previously catalogued**: `lib/curriculum/regional/ke-cbc.ts`'s `GRADING_SCALE`/`markToGrade`/`normalizeToCBCLevel` (75/50/25, same values as the Core/legacy set) is dead code — the `KE_CBC` object is imported live by 4 routes (`holiday/return`, `holiday/generate`, `teacher/classes/[classId]/differentiation`, `teacher/assessments/topical`) but every call site uses only `KE_CBC.getCurrentTerm()`; zero callers of the grading functions exist anywhere. Sits inside an actively-imported object, inviting future accidental reuse as an 8th boundary implementation.

**Confirmed unchanged by 4C1**: the `76/51/31` vs `75/50/25` unratified conflict in `lib/assessments/gradeCalculator.ts` (still actively written to `learner_marks.mean_grade` on every legacy-gradebook save via `lib/assessments/mutations.ts`); the Assignments-domain 75/55/40 (3 copies) and Notifications-domain 80/60/40 (2 copies) sets, none migrated or scoped to a sprint yet; the `generateReportCards` missing `is_published` overwrite guard (Sprint 4C0 Part 5), re-verified still open and unaffected in mechanism by 4C1; hidden recomputation-on-read, re-verified still absent (stored `cbc_level`/`overall_cbc_level` columns are read verbatim, never recomputed).

**Executive verdict**: EduNexus does **not** yet have a single canonical grading engine. `lib/grading::gradeScore()` is architecturally sound and now powers 2 of the highest-visibility surfaces, but at least 6 other live implementations remain (analytics/cohort path, legacy gradebook, 3 Assignments copies, 2 Notifications copies), plus 1 dead one. The smallest concrete next step to close the Critical gap: give `gradeLevelFromScore` the same `gradeBoundaries` parameter the 2 already-migrated functions accept and have it call `gradeScore()`, mechanically identical in shape to 4C1's migration, just threaded one layer further through `getAssessmentAnalytics`/`getCohortData`/`getTeacherCohorts`. This does not require resolving the harder 76-vs-75 `gradeCalculator.ts` policy conflict, which remains a separate open human decision. No code change was proposed, drafted, or made — see the full audit for details.

**Architectural documents referenced**: `docs/engineering/sprint-4b-grading-policy-ratification.md`, `docs/engineering/sprint-4c0-grading-policy-integration.md`, `docs/architecture/deprecation-registry.md` entry #5, CLAUDE.md's Evidence-ownership rule (governing why `lib/intelligence/cbcScale.ts` stays out of scope).

**ADR**: None — no code, architecture, or ownership model changed; audit only.

**Tests added**: None (no code changed).

**Rollback considerations**: None — read-only sprint. Only new artifact is `docs/engineering/sprint-4d-grading-engine-completion-audit.md`, freely deletable with no code or data impact.

**Full detail**: `docs/engineering/sprint-4d-grading-engine-completion-audit.md`.

---

## 2026-07-15 — Sprint 4C1: Activate `school_settings.grade_boundaries` via `lib/grading` (Option B, minimal integration)

**What changed**: following Sprint 4C0's audit and the human decision to adopt Option B ("activate the dormant capability through the existing grading pipeline," clarified after an initial ambiguity between the report's literal Option A/B labels and the decision text's description — resolved via explicit user confirmation before implementation began), migrated the 2 already-DB-wired grading implementations — `lib/core/assessments.ts::computeTermSummaries`'s inline `toCbcLevel` closure and `lib/core/report-cards.ts::generateReportCards`'s inline `toCbcLevel` closure — to delegate to `lib/grading`'s `gradeScore()`. This is the first time `lib/grading` (built Sprint 4A, zero callers until now) is actually used. The `gradeBoundaries` parameter these two functions already received (sourced from `school_settings.grade_boundaries` via `SchoolRepository`, unchanged) is now converted into a `GradeScale` and passed through the canonical engine instead of a local closure — same values, same 75/50/25 fallback defaults, same source, mechanical migration, no boundary-value change. One defensive addition: scores are clamped to `[0,100]` before calling `gradeScore()`, since the engine's stricter range validation would otherwise throw on a theoretical floating-point summation overshoot the old closure tolerated silently — not a change to any real grading outcome.

**Explicitly NOT done, per instruction**: `assessment.repository.ts::gradeLevelFromScore` (hardcoded, no `gradeBoundaries` parameter) was NOT retrofitted or touched — activating it would require adding a new parameter to a function that doesn't have one today, which is scope beyond "activate the already-wired capability." `gradeCalculator.ts`'s `BUILTIN_CBC_SCALE` (76/51/31) was NOT touched — the 75-vs-76 boundary-value correctness question remains an open human decision (Sprint 4B/4C0), unresolved by this sprint. The `generateReportCards` re-generation/publish-guard gap identified in Sprint 4C0 Part 5 was explicitly NOT fixed — tracked as an independent production-integrity defect per direct instruction, kept isolated, no opportunistic fix.

**Repository boundaries preserved**: `SchoolRepository` remains the sole owner/reader of `school_settings`; no new repository, service, table, or ADR was introduced; no API route, request/response shape, or public function signature changed; `computeTermSummaries`/`generateReportCards` still receive `gradeBoundaries` exactly as before — only their internal computation changed.

**Historical report cards**: unaffected — per Sprint 4C0 Part 5, `overall_cbc_level`/`cbc_level` are stored once at generation time, never recomputed on read; this migration only changes what happens on the *next* generation run for a class/term, identical to the pattern already established in Sprint 3C/3D for ranking.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #5 (updated alongside this entry — see below), `docs/engineering/sprint-4b-grading-policy-ratification.md`, `docs/engineering/sprint-4c0-grading-policy-integration.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — matches Sprint 4C0 Part 3's own conclusion: wiring the existing `school_settings.grade_boundaries` column through `lib/grading` within the existing `SchoolRepository` boundary does not cross any ADR trigger condition (no new canonical identity/ownership/repository-split/versioning introduced).

**Tests added**: `lib/core/toCbcLevel.grading.regression.test.ts` — 6 golden-value tests comparing the deleted closures against the new `gradeScore()`-backed implementation: default (75/50/25) boundaries across representative scores, school-customized boundaries across representative scores, exact-boundary-value checks for both, a partial-override case (only `EE` customized, `ME`/`AE` fall back to defaults), and the new defensive floating-point-clamp behaviour. All pass; full grading + ranking suite re-run clean (81/81: 24 `lib/grading` + 6 `toCbcLevel` regression + 51 ranking-related from Sprint 3). `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the one commit touching `lib/core/assessments.ts` and `lib/core/report-cards.ts`; both functions' signatures and the `gradeBoundaries` parameter contract are unchanged either way, so rollback needs no data-fix — the next `computeTermSummaries`/`generateReportCards` run after a revert simply goes back to the old closure's computation (same values, since nothing about the boundary values themselves changed).

---

## 2026-07-15 — Sprint 4C0: Grading Policy Integration Audit (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing in source code. This sprint was pure evidence-gathering, per explicit instruction, going deeper than Sprint 4B on one specific question it under-investigated: whether `school_settings.grade_boundaries` (`supabase/migrations/20260629_core_foundation.sql:118-119`) is real, exercised production infrastructure or a column nothing meaningfully uses. Full schema/migration-history/read-path/write-path/UI investigation found: the column has no CHECK constraint on shape or monotonicity (only Zod validates it, at the API layer, not the database); its full migration history is exactly one migration, created 2026-06-28, never touched again, including by the later `20260707_senior_secondary_grades.sql` (confirmed "100% additive," silent on grading, and Senior School shares the exact same single per-school column as Junior — no grade-band-specific override exists anywhere in the schema); its only write path is a single, currently UI-less API route (`app/api/core/school/route.ts` PATCH, `type: 'settings'`) with a known pre-existing `deputy_headteacher` authorization gap; and the only real fixture school in the repository (Mwatate Ridge, `scripts/reference-school/*.ts`) never creates a `school_settings` row at all across all 6 of its seed scripts. Verdict: **wired-but-dormant** — real plumbing, genuinely read by 2 of Sprint 4B's 5 boundary sets, but with no UI, no confirmed real-school usage, and (newly found this sprint) a live re-generation-overwrite gap in `generateReportCards` (`lib/core/report-cards.ts`) — no `is_published` guard means a second "Generate" call for the same class/term silently overwrites an already-published report card's `overall_cbc_level`, a data-integrity risk that exists today under the current single-value model, independent of any future grading-policy decision. Traced `overall_cbc_level`/`cbc_level` (`school_report_cards`, `term_subject_summaries`) to be genuinely **stored, computed once at generation time, never recomputed on read** — confirmed via every read path found (`app/(parent)/report-card/page.tsx:135` renders the stored string directly, no recompute logic present) — so a future boundary change does NOT retroactively alter an already-generated, never-regenerated report card. Produced a full dependency graph (7 distinct call-site clusters once Set 2 is split into its DB-backed and hardcoded halves, not Sprint 4B's original 5), a canonical-flow proposal, and a Part 4 Options A/B/C (national-fixed / per-school / per-year-versioned) evaluation grounded in this evidence, with no option clearly favored. Concluded no ADR is required to wire the existing `school_settings.grade_boundaries` column through `lib/grading/gradeScore()` within the existing `SchoolRepository` boundary, but an ADR IS required if a future migration either splits a dedicated `GradeBoundaryRepository` out of `SchoolRepository` or adopts a versioned-policy table (a new canonical domain not listed in RAS §3).

**Full findings**: `docs/engineering/sprint-4c0-grading-policy-integration.md`.

**Architectural documents referenced**: `docs/engineering/sprint-4b-grading-policy-ratification.md` (starting point, re-cited not re-derived), `docs/architecture/reference-architecture-specification.md` §3/§4/§5/§12, `docs/architecture/canonical-domain-registry.md`, `feedback_architecture-guardian-mode.md` (ADR trigger conditions).

**ADR**: None — no code change this sprint. Per Part 3 of the findings doc: not required for the near-term Option A/B wiring; would be required for a dedicated `GradeBoundaryRepository` split or Option C's versioned-policy table.

**Tests added**: None (no code changed, nothing to test).

**Rollback considerations**: None — this sprint touched only `docs/engineering/sprint-4c0-grading-policy-integration.md` (new) and this log entry. No source, schema, or data was modified.

---

## 2026-07-15 — Sprint 4B: Repo-Wide Grading Boundary Sweep (READ ONLY, NO CODE MODIFIED)

**What changed**: nothing in source code. This sprint was pure evidence-gathering, per explicit instruction, to go beyond Sprint 4A's discovery of 2 conflicting CBC boundary sets across 4 files. A repository-wide sweep — `lib/`, `app/`, `_frozen/` (EILS/EIR), `supabase/migrations/`, `docs/` — found **5 distinct live boundary sets, not 2**: `gradeCalculator.ts`'s 76/51/31 (Set 1, teacher gradebook), the Core/report-card path's 75/50/25 (Set 2 — also independently matched by a newly-found `lib/curriculum/regional/ke-cbc.ts` and 4 of its own downstream routes), the Evidence-Domain's 75/50/30 numeric-level scale (Set 3, `cbcScale.ts`, out of scope for letter-grade migration per CLAUDE.md's Evidence-ownership rule but a genuinely third number), a previously-undocumented Assignments-domain 75/55/40 (Set 4, 3 files: `tsc-view/route.ts`, and two `assignments/[assignmentId]/*.tsx` client pages with inline grading logic — a CLAUDE.md "no business logic in components/routes" violation independent of the boundary conflict), and a previously-undocumented Notifications-domain 80/60/40 (Set 5, byte-identical duplicate functions in `notify.ts` and `email/sender.ts` — a plain copy-paste duplication bug). Confirmed the `school_settings.grade_boundaries` DB column (`supabase/migrations/20260629_core_foundation.sql:118`) is real and fully wired end-to-end for Set 2's two Core functions, but `assessment.repository.ts::gradeLevelFromScore` has no such override parameter, so a school that customises its boundary settings today gets inconsistent grading between report cards and cohort views. Found no authoritative KICD/official-CBC reference anywhere in `docs/` confirming either 75/50/25 or 76/51/31 as correct — origin traced via `git log`/`git blame` to two independent May/June 2026 feature commits with no cross-reference between them, and the evidence between those two specific sets remains genuinely inconclusive on correctness grounds.

**Full findings, migration-order ranking (provisional, pending ratification), and Options A/B/C tradeoff analysis**: `docs/engineering/sprint-4b-grading-policy-ratification.md`.

**Architectural documents referenced**: Constitution, RAS §3/§4/§7, Canonical Domain Registry, Deprecation Registry #5, `lib/grading/boundaries.ts`'s own conflict comment, Sprint 4A's implementation-log entry (below), Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no code, schema, identity, ownership, or boundary change; this sprint only documents a pre-existing conflict, it does not ratify or resolve one. A future ADR will be required once Option A/B/C (see the new doc's Part 5) is chosen by a human.

**Tests added**: None — no code changed, nothing to test.

**Rollback considerations**: None — the only artifacts are the new doc and this log entry; deleting either has zero code/data impact.

---

## 2026-07-15 — Sprint 4A: Canonical Grading Engine Foundation

**What changed**: built `lib/grading/` — the canonical grading engine named as a target in Deprecation Registry #5 (previously "stage assignment pending"), which had never been built. A single pure function, `gradeScore(score, maxScore, scale)`, plus reference `GradeScale` constants (`CBC_SCALE_STANDARD`, `CBC_SCALE_CORE_LEGACY`, `SCALE_844_KNEC`) in a standalone, dependency-free module: `types.ts`, `validators.ts`, `boundaries.ts`, `gradingEngine.ts`, `index.ts`. Infrastructure only — no caller was migrated. All 4 existing grading implementations (`gradeCalculator.ts::calculateGradeFromScale`, `lib/core/assessments.ts`'s inline `toCbcLevel`, `lib/core/report-cards.ts`'s inline `toCbcLevel`, `assessment.repository.ts::gradeLevelFromScore`) remain untouched and still run their own logic; migrating them is Sprint 4B+.

**New finding (not previously documented at this granularity)**: while cataloguing the 4 implementations for the engine's design, found a genuine, unresolved boundary conflict — 3 of the 4 (`lib/core/assessments.ts`, `lib/core/report-cards.ts`, `assessment.repository.ts`) use 75/50/25 as the CBC EE/ME/AE floor; the 4th (`gradeCalculator.ts`'s `BUILTIN_CBC_SCALE`, the one Deprecation Registry #5 names as the replacement) uses 76/51/31 — one point higher at every boundary. A score of exactly 75, 50, or 30 grades differently depending on which implementation computes it. Not resolved by this sprint — `lib/grading/boundaries.ts` deliberately keeps both as separately-named `GradeScale` constants (`CBC_SCALE_STANDARD` vs `CBC_SCALE_CORE_LEGACY`) rather than picking a winner; which one becomes canonical is a migration-time policy decision for a future sprint, documented but not silently normalized here.

**Second correction (also new)**: Deprecation Registry #5's stated replacement target (`gradeCalculator.ts`'s `marksToLevel`/`resolveLevel`/`marksToLevelForSchool`) returns a different type (numeric `CBCLevel`, `1-4`, re-exported from the Evidence-Domain-owned `lib/intelligence/cbcScale.ts`) than the 3 string-letter (`'EE'|'ME'|'AE'|'BE'`) duplicates it's meant to replace. The correct same-type target is `calculateGradeFromScale`/`getBuiltinScale('cbc')` in the same file — a different function. This Grading Engine is scoped to the Assessment Domain's letter-grade duplicates only; `cbcScale.ts`'s numeric CBC-level function stays out of scope as a different domain's canonical artifact, per CLAUDE.md's Evidence/Reasoning-layer ownership rules.

**Architectural documents referenced**: Constitution, RAS §3/§4/§7, Canonical Domain Registry, Deprecation Registry #5, Canonical Domain Evolution Blueprint, Architecture Guardian Mode, Phase B Engineering Rules, and this sprint's own catalogue (above).

**ADR**: None — no trigger condition met (no new canonical identity, ownership change, Intelligence-boundary change, repository-responsibility change, security change, or Constitution/RAS conflict; this fills an already-declared target location with zero callers, and documents rather than resolves the boundary conflict it found).

**Tests added**: `lib/grading/gradingEngine.test.ts` — 24 pure unit tests (`node:test`, no DB): boundary scores, minimum/maximum score, invalid scores (`NaN`/`Infinity`/negative/over-max), invalid `maxScore` (zero/negative), decimals, a custom (non-built-in) grade scale, empty configuration, overlapping boundaries, non-descending boundaries, a coverage gap at the bottom of a scale, both discovered CBC boundary sets proven to genuinely disagree at 75/50/30, the full 8-4-4 KNEC scale including points/descriptor, null-vs-undefined for bands without points/descriptor, purity (no mutation), and result-membership invariant. All 24 pass. Confirmed via grep: zero files outside `lib/grading/` import it yet; the module has zero imports from Supabase, repositories, `lib/core/`, `lib/assessments/`, or Intelligence.

**Rollback considerations**: delete `lib/grading/` — nothing else references it, so rollback has zero blast radius.

---

## 2026-07-15 — Sprint 3E (migration 5 of 5, FINAL): saveScores → canonical Ranking Engine — Deprecation Registry #4 CLOSED

**What changed**: migrated the fifth and final duplicated ranking implementation — `assessment.repository.ts::saveScores` — to delegate to `computeRankings()` from `lib/ranking`. This was the audit's most severe finding: `position: i+1` was assigned in raw request-array order, with **no ranking computation at all** (not "missing tie handling" like the other three fixed implementations — genuinely no sort by score). Worst case demonstrated: a request with scores in ascending order would assign the best-scoring learner `position: N` (last) and the worst-scoring learner `position: 1` (first) — a complete inversion. Now correctly rank-derived and tie-aware, matching all four previously-migrated implementations. Callers (`lib/core/assessments.ts::saveScores`, `app/api/core/assessments/route.ts`'s `save-scores` action) are unchanged.

**Historical data**: explicitly untouched, per this sprint's own analysis (no backfill performed or proposed) — only future `saveScores` calls get correct positions; `learner_marks` rows written before this deploy keep their existing (possibly incorrect) `position` until that specific assessment's scores are saved again through this path. Unlike `computeTermSummaries`/`generateReportCards` (naturally re-run on a term/generation cadence), `saveScores` only re-runs on an explicit re-save — flagged as a known follow-up if a one-time historical backfill is ever wanted; not decided or scoped here.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #4 (closed alongside this entry — see below), `docs/engineering/sprint-3-assessment-domain-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no trigger condition met (correctness fix inside an existing method's private algorithm; no ownership/identity/boundary/schema/API/repository-contract change).

**Tests added**: `lib/repositories/saveScores.ranking.test.ts` — 8 tests: ordered request (old coincidentally matches new), unordered request (defect demonstrated and fixed), worst-case ascending-order inversion, ties, duplicate marks, missing marks (`total_marks=0`), large-class (60-learner) random-order invariant check, reverse-sorted order. Full ranking-related suite re-run clean (51/51: 16 `lib/ranking` + 7 `buildPositionMap` + 8 `getCohortData` + 6 `updateClassPositions` + 6 `generateReportCards` + 8 `saveScores`). `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the one commit touching `assessment.repository.ts`; signature and write shape unchanged either way. Reverting restores the defective behaviour, not a regression from a data-integrity standpoint since nothing correct is lost by reverting a not-yet-re-saved row.

**Sprint 3 Assessment Domain ranking consolidation: COMPLETE.** All 5 implementations identified in the Sprint 3 audit (`buildPositionMap`, `getCohortData`, `updateClassPositions`, `generateReportCards`, `saveScores`) now delegate to the single canonical `computeRankings()` in `lib/ranking`. Deprecation Registry #4 closed — see final verification in that entry.

---

## 2026-07-15 — Sprint 3D (migration 4 of 5): generateReportCards → canonical Ranking Engine (parent-facing behaviour change)

**What changed**: migrated the fourth of the 5 duplicated ranking implementations — `lib/core/report-cards.ts::generateReportCards`'s class-position ranking (lines 36-51) — to delegate to `computeRankings()` from `lib/ranking`. Same defect class as Sprint 3C's `updateClassPositions` (old algorithm was `i+1` sequential over a pre-sorted array with no tie comparison), but this is the **highest-visibility instance**: `position_in_class` here feeds published, parent-facing report cards via `school_report_cards`. Tied overall averages — including multiple enrolled learners with zero `term_subject_summaries` rows, who both fall back to `avg=0` — now correctly share a class position instead of receiving arbitrary, enrollment-order-dependent distinct positions. Confirmed the rounding-display path (`overall_score: Math.round(avg*100)/100`) still ranks on the unrounded `avg`, same as before, so this migration does not introduce new "looks tied on the printed card but ranked differently" cases beyond what already existed. `generateReportCards` always writes `is_published: false`, so already-published report cards are unaffected until the next generation + publish cycle for that class/term — flagged as an operational note for whoever owns report-card rollout communication, since the next end-of-term generation will change a number parents see for any previously-tied class.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #4 (updated alongside this entry — see below), `docs/engineering/sprint-3-assessment-domain-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no trigger condition met (correctness fix inside an existing function's private algorithm; no ownership/identity/boundary/schema/API change; both callers — `app/api/core/reports/route.ts`, `lib/core/endOfTerm.ts` — untouched).

**Tests added**: `lib/core/generateReportCards.ranking.test.ts` — 6 tests split into `UNCHANGED` (no-tie, single-learner, empty-class, rounding-collision-without-underlying-tie) and `CHANGED (intentional)` (tied averages, and specifically multiple zero-score learners tying together). Full ranking-related suite re-run clean (43/43: 16 `lib/ranking` + 7 `buildPositionMap` + 8 `getCohortData` + 6 `updateClassPositions` + 6 `generateReportCards`). `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the one commit touching `lib/core/report-cards.ts`; `generateReportCards` is idempotent per term, so no manual data-fix is needed on rollback for unpublished rows — already-published rows from before this deploy simply keep their old values, since publishing and generation are separate steps and this migration touches generation only.

**Remaining implementations documented, not migrated**: only `assessment.repository.ts::saveScores` remains — confirmed the most severe of the five (not ranking at all, `position: i+1` in raw request-array order), scoped to Sprint 3E per the accepted migration order.

---

## 2026-07-15 — Sprint 3C (migration 3 of 5): updateClassPositions → canonical Ranking Engine (first behaviour-changing migration)

**What changed**: migrated the third of the 5 duplicated ranking implementations — `lib/core/assessments.ts::updateClassPositions` — to delegate to `computeRankings()` from `lib/ranking`. Unlike migrations 1 and 2 (mechanical, no output change), this is the **first intentional behaviour-changing migration**: the old algorithm assigned `i+1` sequentially over DB-presorted rows with no tie comparison at all, so two students tied on `weighted_score` within the same class/term/subject received arbitrary, database-row-order-dependent distinct positions. They now correctly share a position (standard competition ranking, matching the rest of the now-migrated ranking surface). A defensive filter excludes any row with a non-finite `weighted_score` from ranking (skipped, not written) rather than crashing the recompute — a theoretical-only case, since the sole writer (`computeTermSummaries`) never produces a null/non-finite weighted score, called out explicitly rather than left as an unhandled exception path. `getClassPerformanceSummary` and `lib/core/report-cards.ts::generateReportCards` were confirmed (by re-reading both this sprint) not to read `position_in_class`, so this fix currently has no downstream UI-visible surface — it corrects the persisted value regardless.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #4 (updated alongside this entry — see below), `docs/engineering/sprint-3-assessment-domain-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no trigger condition met (correctness fix inside an existing function's private algorithm; no ownership/identity/boundary/schema/API change).

**Tests added**: `lib/core/updateClassPositions.ranking.test.ts` — 6 tests explicitly split into `UNCHANGED` (no-tie, single-row, empty-group — identical to the deleted legacy algorithm), `CHANGED (intentional)` (single tie group, multiple tie groups — proven different from the old algorithm on purpose, with an explicit `assert.notDeepEqual` against old output), and `DEFENSIVE (intentional)` (non-finite score skipped, not fabricated). Full ranking-related suite re-run clean (37/37: 16 `lib/ranking` + 7 `buildPositionMap` + 8 `getCohortData` + 6 `updateClassPositions`). `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the one commit touching `lib/core/assessments.ts`; `computeTermSummaries` is idempotent, so no manual data-fix is needed on rollback — the next recompute restores the old (untied) values.

**Remaining implementations documented, not migrated**: `lib/core/report-cards.ts::generateReportCards` (parent-facing, also missing tie handling — same class of fix as this one, but highest-visibility, deferred to its own approved sprint) and `assessment.repository.ts::saveScores` (not ranking at all today — the most severe defect, migrated last per the accepted order).

---

## 2026-07-15 — Sprint 3B.2 (migration 2 of 5): getCohortData ranking → canonical Ranking Engine

**What changed**: migrated the second of the 5 duplicated ranking implementations — the inline cohort-ranking logic inside `assessment.repository.ts::getCohortData` (lines ~843-860) — to delegate to `computeRankings()` from `lib/ranking`. The hand-rolled sort + tie loop was deleted; `getCohortData`'s public signature and its `CohortResult` return shape (including the `topLearners`/`lowLearners` slice points) are unchanged. `CombinedRankRow` has no stable identity field, so a function-local synthetic index is used as the ranking engine's `id` — it never leaves the function. This was the second (and last) of the two implementations already behaviourally identical to the canonical engine's algorithm, so this is a mechanical, no-behaviour-change migration — confirmed by 8 golden-value regression tests, including one asserting the exact `topLearners`(top 20)/`lowLearners`(bottom 10, reversed) slice output is unaffected.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #4, `docs/engineering/sprint-3-assessment-domain-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no trigger condition met (internal algorithm swap inside an unchanged function signature).

**Tests added**: `lib/repositories/getCohortData.ranking.regression.test.ts` — 8 golden-value tests (no ties, single tie group, multiple tie groups, all tied, single row, empty input, 60-learner multi-stream cohort with clustered ties, topLearners/lowLearners slice-point equivalence). All pass; full ranking-related suite re-run clean (31/31: 16 `lib/ranking` + 7 `buildPositionMap` regression + 8 `getCohortData` regression). `tsc --noEmit -p .` clean.

**Rollback considerations**: revert the one commit touching `assessment.repository.ts`; signature and `CohortResult` shape unchanged either way, no persisted state from this computation to fix.

**Remaining implementations documented, not migrated**: both mechanical migrations are now complete. The 3 remaining implementations — `lib/core/assessments.ts::updateClassPositions`, `lib/core/report-cards.ts::generateReportCards`, `assessment.repository.ts::saveScores` — are all genuine behaviour-changing correctness fixes (missing or entirely absent tie handling) and each requires separate, individual approval before migration, per the accepted Sprint 3B order.

---

## 2026-07-15 — Sprint 3B (migration 1 of 5): buildPositionMap → canonical Ranking Engine

**What changed**: migrated exactly one of the 5 duplicated ranking implementations catalogued in Sprint 3A — `lib/assessments/mutations.ts::buildPositionMap` (used by `bulkSaveMarks` and `upsertMarksCSV`) — to delegate to `computeRankings()` from `lib/ranking`. The old hand-rolled sort + tie loop was deleted; `buildPositionMap`'s own signature (`{id, total}[] → Map<id, position>`) is unchanged, so both call sites needed zero edits. This was already behaviourally identical to the canonical engine's algorithm (standard competition ranking, descending), so this is a mechanical, no-behaviour-change migration — confirmed by a golden-value regression test comparing old vs. new output across no-ties/single-tie/multiple-ties/all-tied/single-row/empty/realistic-40-learner cases. 4 implementations remain unmigrated (repository `getCohortData` inline rank; `lib/core/assessments.ts::updateClassPositions`; `lib/core/report-cards.ts::generateReportCards`; `assessment.repository.ts::saveScores`) — the last 3 are behaviour-changing migrations (they currently lack tie handling, or in `saveScores`'s case aren't ranking at all) and are explicitly deferred to separate, individually-approved Sprint 3B sub-migrations, per the audit's finding and this sprint's own migration order.

**Architectural documents referenced**: Constitution, RAS §4/§7, Canonical Domain Registry, Deprecation Registry #4, `docs/engineering/sprint-3-assessment-domain-audit.md`, Architecture Guardian Mode, Phase B Engineering Rules.

**ADR**: None — no trigger condition met (internal algorithm swap inside an unchanged function signature, no ownership/identity/boundary change).

**Tests added**: `lib/assessments/buildPositionMap.regression.test.ts` — 7 golden-value tests comparing the deleted legacy algorithm against the new `computeRankings()`-backed implementation (no ties, single tie group, multiple tie groups, all tied, single row, empty input, realistic 40-learner class with clustered ties). All pass, plus all 16 pre-existing `lib/ranking` tests re-run clean (23/23 total). `tsc --noEmit -p .` clean. The 2 pre-existing integration-test failures (`assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`) are unrelated — they require `.env.local` DB credentials not available in this environment and were already failing identically before this change (confirmed as a baseline before editing).

**Rollback considerations**: revert the one commit touching `lib/assessments/mutations.ts`; `buildPositionMap`'s public signature never changed, so no caller needs touching either way. No DB migration, no data to fix — the function is pure and stateless per call.

**Remaining implementations documented, not migrated**: repository `getCohortData` inline rank (`assessment.repository.ts:843-860`, called via `lib/assessments/cohortQueries.ts`) is next — also mechanically identical, but is the repository-tier implementation so it follows the non-repository one per the stated migration order. Then `updateClassPositions`, `generateReportCards`, and `saveScores` — all three are genuine behaviour-changing correctness fixes (missing or absent tie handling) and require separate approval before touching, per Sprint 3B's explicit instruction not to bundle mechanical and behavioural migrations.

---

## 2026-07-15 — Sprint 3A: Canonical Ranking Engine Foundation

**What changed**: built `lib/ranking/` — the canonical ranking engine named as a target in the Canonical Domain Registry and Deprecation Registry #4, which had never been built. A single pure function, `computeRankings()`, ported the tie-handling semantics of `lib/assessments/mutations.ts::buildPositionMap` (standard competition ranking, 1,2,2,4) into a standalone, dependency-free module: `types.ts`, `comparators.ts`, `ties.ts`, `rankingEngine.ts`, `index.ts`. Infrastructure only — no caller was migrated. All 5 existing ranking implementations catalogued in `docs/engineering/sprint-3-assessment-domain-audit.md` §4 (`buildPositionMap`, `assessment.repository.ts::saveScores`, `lib/core/assessments.ts::updateClassPositions`, `lib/core/report-cards.ts::generateReportCards`, `lib/assessments/cohortQueries.ts`) remain untouched and still run their own logic; migrating them is Sprint 3B.

**Architectural documents referenced**: Constitution, RAS §3/§4/§7, Canonical Domain Registry, Deprecation Registry #4, Canonical Domain Evolution Blueprint, Architecture Guardian Mode, Phase B Engineering Rules, and this sprint's own `docs/engineering/sprint-3-assessment-domain-audit.md`.

**ADR**: None — no trigger condition met (no new canonical identity, ownership change, Intelligence-boundary change, repository-responsibility change, security change, or Constitution/RAS conflict; this fills an already-declared target location with zero callers).

**Tests added**: `lib/ranking/rankingEngine.test.ts` — 16 pure unit tests (`node:test`, no DB): single learner, multiple learners, descending (default) and ascending direction, single tie, multiple tie groups, empty list, negative values, decimal values, already-sorted input, reverse-sorted input, stable ordering, 10,000-entry dataset (correctness + <1s), invalid score (`NaN`/`Infinity`) throws `RankingError`, duplicate ids ranked independently, input-array immutability. All 16 pass. Confirmed via grep: zero files outside `lib/ranking/` import it yet; the module has zero imports from Supabase, repositories, `lib/core/`, or `lib/assessments/`.

**Rollback considerations**: delete `lib/ranking/` — nothing else references it, so rollback has zero blast radius.

---

## 2026-07-15 — Sprint 2B: Authorization Layer Completion & Operating Layer Closure

**What changed**: migrated the 22 routes Sprint 2A identified as remaining Operating-Layer work — the 3-route "Batch H" (`school/intelligence`, `intervention-efficacy`, `strand-health`) plus all 19 previously-unclassified `teacher/**` routes, after reading every one completely and classifying it by responsibility (not filename) against the Constitution's Fourth Law. 14 classified Operating Layer (migrated in full: identity + class-ownership where applicable); 8 classified Intelligence Layer (auth gate only migrated, business logic — Projection recompute, knowledge-graph reasoning, pattern detection, dashboard aggregation — left completely untouched).

**`canManageClass`/`canViewLearner` investigated, not deprecated**: confirmed both are forward-built for the Core-schema Class/Learner evolution the Canonical Domain Evolution Blueprint describes; no route across all 78 now-migrated routes has needed their exact composition, since every real class-ownership question in the live codebase resolves through `teacher_classes`/`requireClassTeacher`, not Core's `classes`/`school_id`-scoped model. Recommendation: retain, do not deprecate — this is "belongs to a future phase," not dead code.

**One new, previously-unknown finding**: `teacher/monday-panel/route.ts` had two spots using the raw auth user ID (`user.id`) as if it were `teachers.id` for `intervention_log`/`monday_panel_cache` writes, inconsistent with every other query in the same file (which correctly use `teacher.id`). Found only because this sprint required a complete read of the file. Preserved exactly, not silently fixed, per "no business logic changes" — recorded as technical debt.

**`class_students.parent_id` ADR drafted, not approved**: `docs/architecture/adr/0001-class-students-parent-id-guardian-mechanism.md` — the mechanism confirmed in 5 files across 3 sprints (B, F, G), with a new correctness question surfaced (`student/join-class/route.ts` writes `parent_id` to the student's *own* user id, suggesting the column may mean "who joined this row" rather than strictly "this child's parent"). Three options presented neutrally; recommendation is to investigate the data before choosing, not to decide now. Explicitly marked DRAFT / NOT APPROVED / NOT IMPLEMENTED.

**Performance measured, not optimized**: the 2x sequential auth-resolution pattern Sprint 2A found in Core routes is confirmed present in 6 of this sprint's 22 routes (every one using `requireClassTeacher`). `RequestContext` adoption remains premature — still zero routes construct one, across all 78 migrated so far.

**Architecture references consulted**: Constitution, RAS, Canonical Domain Registry, Deprecation Registry, Canonical Domain Evolution Blueprint, Phase A Execution Plan, Architecture Guardian Mode, Phase B Engineering Rules, Platform Services Documentation, Sprint 2A Verification Report — all read-only, none modified.

**Tests added**: none new — every canonical function this sprint used was already fully tested. Full 53-test suite re-run after all 22 migrations, passing in full, confirming no regression.

**Permission adoption**: 77 of 209 total route files now import `lib/core/permissions`/`lib/core/identity` directly (~37%, up from 55/~26% before this sprint) — verified by direct count, not estimated.

**No schema, migration, identity redesign, repository redesign, Intelligence modification, optimization, or architecture-document edit performed.**

**Readiness recommendation**: Sprint 2B closes the Operating Layer authorization migration this two-sprint series set out to complete. The `class_students.parent_id` ADR should be ratified (a decision on Options A/B/C, or a Option-C investigation commissioned) before Sprint 3 touches anything guardian-adjacent. Full report: `docs/engineering/sprint-2b-authorization-layer-completion.md`.

---

## 2026-07-15 — Sprint 2A: Operating Layer Consolidation & Verification

**Sprint**: 2A (stabilization/verification, not a migration sprint). **Date**: 2026-07-15.

**Verification completed**: full evidence-backed audit of Sprint 1's actual state — see `docs/engineering/sprint-2a-operating-layer-verification.md` for the complete report. Confirmed: all 55 Batch A-G routes remain correctly migrated (zero raw `auth.getUser()` regressions, verified by direct grep with comment-only false positives checked and excluded); both Stage 0 security gaps remain closed (re-verified by reading the current `app/api/core/assessments` and `app/api/core/reports` files directly, not assumed); the full 53-test suite passes.

**Architecture references consulted**: Constitution, RAS, Canonical Domain Registry, Deprecation Registry, Canonical Domain Evolution Blueprint, Phase A Execution Plan, Architecture Guardian Mode, Phase B Engineering Rules, Platform Services Documentation — all read-only, none modified.

**New discoveries**: `canManageClass` and `canViewLearner` (built in Sprint 1A) have zero call sites across all of Batches A-G — designed but never adopted. Composed permission checks re-derive authentication redundantly (up to 4 sequential `auth.getUser()`-equivalent calls in one request path, e.g. `app/api/core/assessments` POST's save-scores action) because no migrated route actually constructs and passes the `SchoolRequestContext` object `lib/core/context.ts` was built for — every route calls `require*` functions directly instead. `canViewLearner` has four independent, sequentially-awaited resolver calls that are a real `Promise.all` candidate. 19 `app/api/teacher/**` routes and 3 `app/api/school/**` routes remain unmigrated, correctly traced to prior scoping decisions (not silently dropped) but not yet individually classified by file content.

**Technical debt recorded**: full prioritized register in the verification report §5 — highest priority items are the unused `can*` functions (investigate before building more), the `class_students.parent_id` mechanism needing a formal ADR (now confirmed in 5 files across 3 batches), and the unclassified 19 `teacher/**` routes.

**No code changes confirmation**: none. This entry and the verification report are the only artifacts this sprint produced — no route, service, repository, schema, or test file was modified. `git status` before and after this sprint shows an identical working tree for every file outside `docs/engineering/`.

**Readiness recommendation**: proceed to Sprint 2B, with the two conditions in the verification report's Readiness Assessment tracked as the first items of that sprint, not treated as resolved by this verification alone.

---

## 2026-07-15 — Sprint 1B, Batch G: Student Self-Service Route Migration

**What changed**: migrated all 8 routes (`app/api/student/{assignments,home,join-class,submit}`, `app/api/students/{create,list,[studentId]}`, `app/api/class/join`) from inline `auth.getUser()` onto `requireAuthentication`, and where the exact self-only or self-or-parent gate already existed as a canonical function/composition, replaced it: `requireStudent` (self-only) in `join-class` and `submit`; the `isSelfOrParentOf` composition (same pattern introduced in Batch F) in `assignments`' explicit-`studentId` branch.

**Verified before writing anything** (per "verify first — do not assume"): exactly the 8 expected routes exist, no additional student self-service routes were discovered.

**No fourth student-identity mechanism found.** Everything in this batch maps onto the three mechanisms already documented across the series: `students.user_id` (self), `students.parent_user_id` (parent), `class_students.parent_id` (the third mechanism — now confirmed in two more files, `join-class` POST and `class/join` POST, bringing its confirmed-file count to five across Batches B, F, and G).

**Three routes received only the auth-gate migration, ownership/business logic preserved verbatim, with in-file reasoning**:
- `home.ts` — the student-fetch query needs `grade`/`school`/`current_pathway`/`curriculum_type`, fields `resolveStudent` doesn't return; forcing the canonical function in would require a second, redundant query for no behavior change. Also preserves its non-standard `'Unauthenticated'` message text (a recurring, now-familiar pattern across this route family).
- `students/[studentId].ts` (DELETE+PATCH) — a genuinely distinct two-step response contract (404 if the student doesn't exist, THEN 403 if owned by someone else) plus a downstream business read of `added_by`/`parent_user_id` that a blind `requireStudent`/`requireParent` call would collapse. This is the clearest instance yet in this series of "ownership logic containing a business decision" that the rules explicitly say not to rewrite.
- `class/join.ts` — no student-specific ownership gate exists at all; this route links *all* unlinked students in a class to the joining parent via `class_students.parent_id`, a business rule, not an identity check.

**One route's explicit-`studentId` branch composed the canonical self-or-parent gates (`assignments.ts`)**; its no-`studentId`-given fallback branch (picks the caller's first owned student) was left untouched — it's a data default, not an authorization gate.

**Architectural documents referenced**: none of the ratified documents currently name `class_students.parent_id` (the recurring gap already noted in Batches B and F) — now confirmed a fifth time.

**ADR**: None triggered.

**Tests added**: none new. Every canonical function/composition this batch relies on (`requireAuthentication`, `requireStudent`, the self-or-parent composition) was already fully tested by Batches B and F, including cross-student rejection and unauthenticated rejection — the exact scenarios this batch's routes needed. Full existing suite (53 tests) re-run and confirmed passing after this batch's changes, verifying no regression, consistent with the reasoning already established in Batch E.

**Verification method**: typecheck + lint clean across all 8 changed route files; `git diff` confirms only the 8 named routes were touched.

**Rollback considerations**: each of the 8 routes reverts independently; no known security gap was closed this batch, so reverting any one route returns to duplicated auth logic with no new security regression.

---

## 2026-07-15 — Sprint 1B, Batch F: Parent/Guardian Route Migration

**What changed**: migrated all 6 routes under `app/api/parent/**` (`link-student`, `assessments/process`, `career-intelligence`, `whatsapp-optin`, `alerts`, `compass-activity`) from inline `auth.getUser()` onto `requireAuthentication`, and where the same self-or-parent ownership check was duplicated across two routes, composed the already-canonical `requireStudent`/`requireParent` locally rather than reimplementing it a third time.

**Three ownership mechanisms confirmed across this batch, none conflated**:
1. `students.parent_user_id` (+ self via `user_id`) — the dominant mechanism, used by `assessments/process`, `career-intelligence`, `whatsapp-optin`, `compass-activity` (the last via `repos.compass.findOwnedStudents`, verified before assuming — it wraps this same mechanism, not a new one).
2. `class_students.parent_id` — a third, different mechanism, used by `alerts.ts`. First found (and left untouched) in Batch B's `clinic/[reportId]/url` route; **confirmed here in a second file**, still not modeled by any canonical function, still not consolidated, per the Discovery Rule.
3. Core's `learner_guardians` — used by **none** of these 6 routes. Every parent route in this batch is legacy-only.

**No fourth mechanism found.** `repos.compass.findOwnedStudents` was read and verified before use — it's mechanism #1 wrapped in a repository method, not new.

**Two routes deliberately received only the auth-gate migration, ownership logic preserved verbatim, with reasons documented in-file**:
- `career-intelligence.ts` — queries via the request-scoped RLS client (`supabase`), not the service client every other route uses, and returns **401** (not 403) for an ownership failure — a different response contract and a different defense-in-depth posture than every other route in this batch. Composing the canonical `requireStudent`/`requireParent` here would have silently switched to the service client (losing the RLS-layer enforcement this route already has) and required deciding whether to keep 401 or "correct" it to 403 — both are business decisions this sprint's rules say not to rewrite.
- `alerts.ts` — its `class_students.parent_id` mechanism isn't modeled by any Sprint 1A function; forcing it onto `requireParent` would silently drop this mechanism and weaken access, exactly what earlier batches (B, C) already established as the wrong move for a similarly-shaped case.
- `compass-activity.ts` — auth gate only; preserved the **exact** `apiError('Unauthenticated', 401)` response (not the shared `apiUnauthorized()` helper's `'Unauthorized'` text) — a real, previously-easy-to-miss message-text difference caught by reading the file completely before editing.

**One genuinely new composition, tested**: `assessments/process` and `whatsapp-optin` both originally checked `student.user_id === user.id || student.parent_user_id === user.id` inline. Reproduced as a small route-local `isSelfOrParentOf()` helper (not added to `lib/core/permissions.ts` — composing two already-canonical calls locally, not new architecture) in each file. This union (self OR parent) hadn't been tested together before — `requireStudent` and `requireParent` were each tested individually, never combined — so it's the one thing this batch adds real new coverage for.

**Architectural documents referenced**: none of the ratified documents currently name the `class_students.parent_id` mechanism (same gap noted in the Batch B log entry) — this is the second confirmation of that gap, strengthening the case for a future Canonical Domain Registry update.

**ADR**: None triggered.

**Tests added**: `lib/core/permissions.selforparent.test.ts` (4 new tests) — self-access, parent-access, unrelated-account rejection, and unauthenticated rejection, all through the exact composition the two migrated routes use. Suite total across `lib/core/*.test.ts`: 53 tests, all passing against live data, verified zero residual rows.

**Verification method**: typecheck + lint clean across all 6 changed route files; `git diff` confirms only the 6 named routes were touched.

**Rollback considerations**: each of the 6 routes reverts independently; no known security gap was closed this batch, so reverting any one route returns to duplicated auth logic with no new security regression.

---

## 2026-07-15 — Sprint 1B, Batch E: Teacher Students Route Migration

**What changed**: migrated all 4 routes under `app/api/teacher/students/**` (`compass-topic`, `promote`, `remarks`, `timeline`) from inline `auth.getUser()` + raw `teachers` queries onto `resolveTeacher`/`requireAuthentication`. One genuinely duplicated pattern was consolidated: `promote/route.ts`'s local `verifyTeacherOwnsClass` helper — functionally identical to the already-canonical `requireClassTeacher` — was deleted and replaced.

**Two new teacher→student authorization models discovered, documented and explicitly preserved, per the Discovery Rule (not normalized)**:
1. **Compass-domain, student-scoped**: `compass-topic/route.ts` uses `lib/compass/ownership.ts::resolveTeacherOwnership(userId, studentId)` — the same mechanism already found untouched in Batch C's `compass/evidence` route. Only the top-level auth check migrated; the ownership resolver itself is Intelligence Layer, untouched.
2. **Roster-membership, class-mediated**: `promote.ts` (inline, both GET and POST), `remarks.ts` (a named local helper, `verifyTeacherTeachesStudent`, used by both GET and POST), and `timeline.ts` (inline) all independently implement the same query — `class_students` JOIN `teacher_classes` filtered to `teacher_classes.teacher_id = <this teacher>` — to answer "is this student currently enrolled in one of my classes." This is a **third** distinct teacher-visibility mechanism, different from both Compass's student-scoped check (#1 above) and `lib/core/permissions.ts::canViewLearner`'s check (which uses `students.teacher_id` directly, a different table/column entirely). All three could disagree on an edge case (e.g. a student whose `teacher_id` attribution differs from their current class roster). **Not consolidated this sprint, per the explicit Discovery Rule instruction to document and preserve rather than normalize** — flagged as a real candidate for a future ADR (a canonical `requireTeacherOfStudent` or similar), not decided here.

**Architecturally significant repetition**: the roster-membership query above appears identical in 4 call sites across 3 files, all within this one batch. This is exactly the kind of duplication this sprint's mission statement names ("learner visibility" as one of the things to centralize) — but the Discovery Rule's explicit instruction ("STOP trying to normalize it... continue migration only") takes precedence over that framing. Recorded here so the decision not to consolidate is traceable, not silently skipped.

**Architectural documents referenced**: none of the ratified documents currently name this third ownership mechanism — this finding should inform a future update to the Canonical Domain Registry's Class Roster / Learner entries once formally reviewed.

**ADR**: None triggered — no canonical identity, ownership model, or architecture changed; the new pattern was documented, not adopted as canonical.

**Tests added**: none new this batch. Both canonical functions this batch relies on (`resolveTeacher`, `requireClassTeacher`) are already fully tested from Batches A-D, including the exact "wrong teacher rejected" scenario `promote.ts`'s `fromClassId`/`toClassId` checks now use. A redundant test file re-asserting the same primitives under a new name was judged not to add real coverage — full existing suite (49 tests) re-run and confirmed passing after this batch's changes, verifying no regression.

**Verification method**: typecheck + lint clean across all 4 changed route files; `git diff` confirms only the 4 named routes were touched.

**Rollback considerations**: each of the 4 routes reverts independently; no known security gap was closed this batch, so reverting any one route returns to duplicated auth logic with no new security regression.

---

## 2026-07-15 — Sprint 1B, Batch D: Teacher Assessments Route Migration

**What changed**: migrated all 8 routes under `app/api/teacher/assessments/**` from inline `auth.getUser()` + raw `teachers`/`teacher_classes` queries onto `resolveTeacher` (identity.ts) + `requireClassTeacher` (permissions.ts), where applicable. `lib/assessments/**` (marks engine, grading, ranking, evidence, CSV parsing, assessment processing) was not touched — the Absolute Rules named it explicitly, and on inspection it didn't need touching anyway.

**Key finding shaping this batch's scope**: unlike Batches A-C, "assessment ownership" was **not** a duplicated route-layer check to centralize. Every route already delegates assessment-level ownership filtering to `lib/assessments/getters.ts`'s `getAssessmentById`/`getAssessmentContext` and `mutations.ts`'s `updateAssessment` — each takes `teacher.id` and applies the ownership filter internally, already centralized in one place, already correct. This batch's actual duplicated authorization was narrower than the brief's "assessment ownership" framing suggested: only (1) "does this user have a teacher record at all" (all 8 files) and (2) "does this teacher own this specific class" (3 files: `assessments/route.ts` POST, `topical`, `process`'s bulk-mode branch) were genuinely duplicated at the route layer. The correct move was recognizing this rather than inventing a new "assessment ownership" wrapper that would have duplicated what `lib/assessments/getters.ts` already does correctly.

**One quiet correctness dependency introduced, verified by test**: `process/route.ts` previously fetched `teacher.full_name` via a raw query; it now sources the same value from `resolveTeacher().fullName`. Confirmed via a dedicated test that `ResolvedTeacher.fullName` round-trips correctly — a silent gap here would have degraded the WhatsApp/report-generation teacher-name fallback with no other test catching it.

**Architectural finding, documented not fixed**: `process/route.ts`'s single-student mode (`student_id` provided, no `class_id`) performs **no ownership check on that student at all** before calling `runAssessmentPipeline` — pre-existing, not introduced by this migration, left exactly as-is per "leave business logic untouched" and "never introduce new authorization logic beyond what's named."

**Architectural documents referenced**: Reference Architecture Specification §5 (Repository Standards — confirms `lib/assessments/getters.ts` already correctly owns assessment-level ownership filtering, no change needed there); Stage 0 Census / Deprecation Registry #1 (the `createAssessment` service duplication between `lib/assessments/mutations.ts` and `lib/core/assessments.ts` — unaffected by this batch, since Batch D only touches the legacy teacher-facing routes, not the Core path).

**ADR**: None.

**Tests added**: `lib/core/permissions.assessmentbatch.test.ts` (3 new tests) — `resolveTeacher().fullName` correctness (the one new dependency this batch introduced), plus the full two-gate composition end-to-end (not re-testing the individual primitives, already covered by Batches A-C). Suite total across `lib/core/*.test.ts`: 49 tests, all passing against live data, verified zero residual rows.

**Verification method**: typecheck + lint clean across all 8 changed route files; `git diff` confirms only the 8 named routes were touched, `lib/assessments/**` untouched.

**Rollback considerations**: each of the 8 routes reverts independently; no known security gap was closed this batch (unlike Batch A's two), so reverting any one route returns to duplicated auth logic with no new security regression.

---

## 2026-07-15 — Sprint 1B, Batch C: Teacher Classes Route Migration

**What changed**: migrated all 13 routes under `app/api/teacher/classes/**` from inline `auth.getUser()` + raw `teachers`/`teacher_classes` ownership queries onto `resolveTeacher` (identity.ts) + `requireClassTeacher` (permissions.ts), composed in sequence: gate 1 ("does this user have a teacher record at all") then gate 2 ("does this specific class belong to them"). `teacher_classes` remains the operational identity throughout — no attempt was made to migrate onto Core's `classes`, per this sprint's explicit instruction that this belongs to the Canonical Evolution Blueprint's later phases.

**Major finding: three different status-code conventions for "class not owned" existed across these 13 files, each preserved exactly**:
- **404** (`apiNotFound('Class not found')`): `[classId]/route.ts`, `archive`, `insights`, `invite`, `students` (GET+POST), `compass` — 6 files.
- **403** (`apiForbidden()`): `generate-reports`, `reports`, `differentiation` (POST+GET), `differentiation/approve` — 4 files.
- **No class-ownership check at all**: `generate-reports/status` — relies entirely on job-row scoping by `user.id`; flagged in the route's own code comment rather than silently fixed.
- **A third, entirely different, student-scoped ownership mechanism**: `compass/evidence/[evidenceId]` uses `lib/compass/ownership.ts::resolveTeacherOwnership(userId, studentId)` — Intelligence/Compass-domain logic, left completely untouched (only the top-level auth check migrated), per "Do NOT touch Intelligence Layer."

Each route's exact existing status code was preserved by sequencing the two canonical gates and mapping any `requireClassTeacher` failure to that specific route's original response — never a uniform mapping across the batch.

**One local duplication removed**: `differentiation/route.ts` had its own in-file `verifyClassOwnership()` helper (used by both its POST and GET) — replaced by `requireClassTeacher`, the helper deleted, matching the sprint's "never leave wrappers, never leave dead code" rule. Two now-unused `createServiceClient` imports were also removed (in `differentiation/route.ts` and `differentiation/approve/route.ts`) since the only thing they were fetching was the now-centralized ownership check.

**Architectural findings, documented not fixed**:
1. `generate-reports/status` performs no class-ownership check — an inconsistency with its 12 siblings, pre-existing, not introduced by this migration.
2. `compass/evidence/[evidenceId]` uses a third ownership mechanism (student-scoped, Compass-domain) distinct from both the 404-group and 403-group's class-scoped checks.
3. The `teacher/classes/route.ts` list/create routes have no class-ownership check by construction (no specific class exists yet) — expected, not a finding, noted for completeness.

**Technical debt discovered**: none new beyond the above — no schema, repository, ranking, assessment, report-generation, or promotion logic was touched, per the Absolute Rules.

**Architectural documents referenced**: Reference Architecture Specification §3 (Class domain — `teacher_classes` confirmed still the operational identity, unchanged by this batch); Canonical Domain Evolution Blueprint (explicitly NOT applied here — Class Domain Evolution remains future work); Stage 0.5 (confirms `teacher_classes` has no `school_id` at all, which is why "different school rejected" isn't literally testable for this table — the closest equivalent, cross-teacher isolation, is what's tested instead).

**ADR**: None.

**Tests added**: `lib/core/permissions.classownership.test.ts` (5 new tests) — the two-gate composition itself (not just the individual primitives, already tested in Sprint 1A/Batch A): a user with no teacher record fails at gate 1, a real teacher who doesn't own a specific class fails at gate 2, plus a sanity check that the same teacher succeeds on their own class. Suite total across `lib/core/*.test.ts`: 51 tests, all passing against live data, verified zero residual rows.

**Verification method**: typecheck + lint clean across all 13 changed route files; `git diff` confirms only the 13 named routes were touched. Same honest caveat as Batches A/B: no HTTP-level route regression testing performed (no infrastructure exists for it yet).

**Rollback considerations**: each of the 13 routes reverts independently; none of Batch C's changes closed a known security gap (unlike Batch A's two), so reverting any one route returns to duplicated auth logic with no new security regression.

---

## 2026-07-15 — Sprint 1B, Batch B: Report/Assessment (Parent & Student-Facing) Route Migration

**What changed**: migrated all 5 routes under `app/api/reports/**` and `app/api/assessments/**` (parent/student-facing) — `assessments/create`, `assessments/history`, `reports/report-card`, `reports/report-card/mine`, `reports/clinic/[reportId]/url` — from inline `auth.getUser()` plus bespoke ownership queries onto Sprint 1A's canonical services. Response shapes, status codes, and business logic are unchanged.

**Two functions used here for the first time since Sprint 1A**: `requireStudent` (self-ownership — `assessments/create`) and `requireParent` (guardian-link — `reports/report-card`), neither previously exercised by any migrated route, so neither had test coverage until this batch.

**One deliberate partial migration, not a full one**: `reports/clinic/[reportId]/url` has its top-level `auth.getUser()` call migrated to `requireAuthentication`, but its four-branch bespoke ownership check (self/parent via `students`, parent via a **third, previously-undocumented** `class_students.parent_id` link, teacher, admin) is left untouched. Forcing this route onto `requireParent` as-is would have silently dropped the `class_students.parent_id` path — `requireParent` only models `students.parent_user_id` and Core's `learner_guardians` — which would have weakened guardian access, explicitly forbidden by this sprint's rules. Recommend a future sprint fold `class_students.parent_id` into `resolveParent`/`requireParent` as a ratified change, then revisit this route.

**One quiet correctness improvement in `reports/report-card`**: `requireParent` checks both `students.parent_user_id` (legacy) and Core's `learner_guardians`, where the original code checked only the latter. Since `learnerId` here is always a Core `learners.id` — a disjoint UUID space from `students.id` — the extra check can never spuriously match; this is a superset check, not a narrowing, so guardian-link strictness is preserved exactly.

**Architectural documents referenced**: Reference Architecture Specification §6/§9 (parent/student API ownership categories, Intelligence-separation boundary — untouched); Phase A Execution Plan / Sprint 1A (`requireStudent`/`requireParent` design).

**ADR**: None.

**Tests added**: `lib/core/permissions.student-parent.test.ts` (7 new tests) — `requireStudent`/`requireParent` happy paths, a student blocked from another learner's record, and genuine cross-parent isolation (parent B denied student A, with a sanity check that parent B can still access their *own* child B — proving the isolation test isn't trivially "always false"). Suite total across `lib/core/*.test.ts`: 41 tests, all passing against live data, verified zero residual rows.

**Verification method**: typecheck + lint clean across all 5 changed route files; `git diff` confirms only the 5 named routes were touched. Same honest caveat as Batch A: no HTTP-level route regression testing (no test infrastructure exists yet for calling Next.js route handlers directly, since `createClient()` depends on request-scoped `next/headers` cookies) — permission-layer testing plus manual line-by-line response-contract review substitutes for it.

**Rollback considerations**: each of the 5 routes reverts independently; none of Batch B's changes closed a known security gap (unlike Batch A's two), so reverting any one route has no security regression, only a return to duplicated auth logic.

---

## 2026-07-16 — Sprint 6C: Academic Operating Model Audit (READ-ONLY)

**What changed**: nothing in code — a read-only audit, `docs/architecture/sprint-6c-academic-operating-model.md`, tracing the complete academic lifecycle (Admission → Learner → Grade → Class → Teacher Assignment → Subject Assignment → Teaching → Assessment → Evidence → Reports → Promotion → Graduation/Exit) and checking for organizational-structure entities (Departments, Faculties, Subject Heads, Dean of Studies, Exam Office, Timetable, Attendance, Behaviour, Pastoral, House System, Boarding, Academic Coordinators, Class Teachers, Moderation, Invigilation) none of which were previously checked for in this series.

**Headline finding**: every organizational-structure entity checked is **VERIFIED absent** except Class Teacher (present, but as an ownership FK on two competing tables, not a named role with distinct authority) — Departments, Faculties, Subject Heads, Dean of Studies, Exam Office, Timetable, Attendance, Behaviour/Discipline, Pastoral, House System, Boarding, Academic Coordinators, Invigilation: zero tables, zero meaningful code references, confirmed by direct search rather than assumed. One dormant near-miss found: `assessment_quality_flags` (a statistical-anomaly table — the closest thing to "Moderation" in the schema) exists but has zero application-code references anywhere.

**Two decisive, previously-undocumented findings on Graduation/Exit**:
1. **The legacy promotion table cannot represent graduation at all** — `student_promotions.to_grade integer NOT NULL` means every promotion event must specify a next grade; there is no way to record a student leaving the school through this table's schema.
2. **`students` (the 68-file, de-facto-canonical Learner table) has no status/lifecycle column of any kind** — no `status`, `is_active`, `graduated`, or `archived` field; a student is either a row or not. Core's `learners.status` (a real, typed enum including `graduated`/`archived`) exists, and `lib/core/promotions.ts` does implement graduation logic against it — but that pipeline has zero UI, per the legacy promote route's own code comment ("No UI yet — API surface only"). **Net effect**: no real pilot teacher can currently graduate or exit a student through any reachable path in the product.

**Admission finding**: the real, reachable admission path is a class teacher directly adding students to their own class (`app/api/teacher/classes/[classId]/students/route.ts`) — there is no separate registrar/admissions role or approval step; the class teacher is simultaneously the admissions officer, class administrator, subject authority, and assessor, with no domain separation between Administration and Academics anywhere in the live product.

**Explicitly not done**: no entity is recommended for creation — no evidence of unmet need was found for any absent domain (Departments, Timetable, Attendance, etc.); no school operating model is chosen or invented, per the sprint's own scope.

**Architectural documents referenced**: `docs/architecture/sprint-6a-canonical-academic-structure-audit.md`, `docs/architecture/sprint-6b-academic-structure-reconciliation.md`, `docs/architecture/stage-0.5-canonical-identity-resolution.md`, `docs/architecture/adr/0002-canonical-teacher-identity.md` — all extended, none superseded.

**ADR**: None.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-16 — Sprint 6B: Canonical Academic Structure Reconciliation (ANALYSIS ONLY)

**What changed**: nothing in code — a deeper, per-entity granular analysis, `docs/architecture/sprint-6b-academic-structure-reconciliation.md`, extending Sprint 6A's Academic Structure audit with full table/PK/columns/relationships/readers/writers/seeders/routes/repositories/UI inventories for Grade, Subject, Academic Year, and Term.

**Two new findings beyond Sprint 6A**:
1. **`class_assessments.grade_id` already exists as a nullable FK to Core's `grades`** (added by the same 2026-06-29 migration that extended the table with `assessment_type_id`'s siblings), accepted as an optional field by `createCoreAssessment`, but **0% populated** — structurally identical to `assessment_type_id`'s state before Sprint 5F. This means a Grade→Assessment bridge is "ready now" (no schema change needed, only a resolution service), not "needs bridge" like Term/Academic Year.
2. **Subject has a fourth representation**: `lib/curriculum/subjects.ts`, a hardcoded, DB-free TypeScript catalogue (CBC Junior/Senior subject lists, pathway electives) — and it is the **one representation with confirmed, direct, real teacher-facing UI usage** (`app/teacher/classes/page.tsx` and siblings), while Core's `subjects` table, `sow_learning_areas`, and the legacy free-text columns all have zero or indirect UI presence.

**Also newly documented this session**: Core-native `grade_subjects` (48 rows, seeded via `seedGradeSubjectsForSchool`) and `class_subjects` (144 rows, but seed-script-populated only — `scripts/reference-school/03-seed-staff.ts`, never a real production write path) both exist and are populated, but neither has any UI page consuming them, matching the exact "backend complete, frontend nonexistent" pattern found everywhere else in this series. The origin of `sow_grades`/`sow_learning_areas` themselves could not be traced to any tracked migration — flagged explicitly as unknown provenance, not guessed at.

**Curriculum/SOW dependency analysis (§5)**: determined, not assumed — `sow_grades`/`sow_learning_areas` are curriculum-content-authoring structures (proven by shape divergence from Core's tables and the KICD-specific `kicd_subject_data` payload with no Core analog), answering a genuinely different question than Core's institutional Grade/Subject tables. This reframes Sprint 6A's "triplication" finding: real, but not automatically three competing answers to one question — one of the three may be legitimately separate.

**Dependency graph (§6)**: the chain breaks at Assessment — Grade/Subject/Term/Academic-Year all have real data feeding into it, but nothing downstream (Reports, Promotion, Learning Intelligence) consumes Assessment's grade/subject/term/year fields directly. Reconciling upstream without addressing this would leave the same disconnected downstream reality Stage 0.5 and Sprint 6A already documented.

**Migration readiness** (§8): Grade→Assessment — ready now. Term/Academic-Year→Assessment — needs bridge (schema change required, not yet proposed). Core-subjects↔hardcoded-catalogue — needs bridge, gated on an unmeasured name-reconciliation pass. Curriculum/SOW↔Core Grade/Subject — needs ADR (a product decision, not a mechanical migration). Promotion — ready now (both tables empty). Class/Enrollment — blocked, per Stage 0.5's own already-ratified recommendation, not reopened.

**Architectural documents referenced**: `docs/architecture/sprint-6a-canonical-academic-structure-audit.md` (direct prerequisite, extended not superseded), `docs/architecture/stage-0.5-canonical-identity-resolution.md`, `docs/architecture/adr/0002-canonical-teacher-identity.md`.

**ADR**: None — this document identifies where an ADR *would* be needed (curriculum/SOW vs. Core Grade/Subject) but does not itself make that decision.

**Tests added**: None (analysis only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-16 — Sprint 6A: Canonical Academic Structure Audit (READ-ONLY)

**What changed**: nothing in code — a read-only architectural audit, `docs/architecture/sprint-6a-canonical-academic-structure-audit.md`, extending Stage 0/Stage 0.5/ADR-0002's Teacher/Class/Learner identity work to cover Academic Year, Term, Grade, Subject, and Promotion across the full platform, and mapping every entity's downstream dependents (Attendance, Assessments, Assignments, Timetable, Report Cards, Promotion, Learning Compass).

**Headline finding**: the platform's academic structure is **triplicated, not duplicated, for Grade and Subject** — beyond the already-known legacy/Core split, the curriculum/SOW domain has its own independent Grade table (`sow_grades`, 13 rows) and Subject table (`sow_learning_areas`, 195 rows, grade-scoped), consumed directly by Learning Compass's topic selection (`lib/compass/topicSelector.ts`) and curriculum-context building, with zero bridge to either the legacy or Core representations. Stage 0.5 had classified Subject as fully canonical (no duplication) — that classification only examined the Core-vs-legacy split and didn't know about this third structure.

**Two more new findings**: (1) Academic Year/Term has no real entity anywhere production code actually depends on — every Ranking/Grading/Analytics function reads an unvalidated free-text `'1'|'2'|'3'` string and an unconstrained year integer/string, never Core's real `academic_years`/`terms` tables. (2) Promotion has a confirmed duplicate table, `student_promotions` (legacy-anchored, `20260713193000_phase_a_promotions_archival.sql`), built **two weeks after** Core's `learner_promotions` already existed — concrete, dated proof the legacy/Core duplication pattern is still actively recurring in production, not a historical artifact.

**Re-confirmed, unchanged**: Teacher identity (ADR-0002, ratified), Class/Stream (`teacher_classes` vs `classes`) and Learner Enrollment (`class_students` vs `learner_enrollments`) — both already fully mapped by Stage 0.5, re-verified this session with unchanged file-usage/row-count gaps, not re-derived from scratch.

**Confirmed absent, not duplicated**: Attendance and Timetable — no table, no repository, no route, no code reference of any kind found for either domain. Nothing duplicates them because nothing has built them.

**Recommended migration order** (sequencing only, no schema proposed): Phase 1 — reconcile curriculum/SOW Grade/Subject data against Core's, pure analysis, no schema touch (prerequisite for everything after). Phase 2 — Academic Year/Term additive FK backfill on legacy assessment tables, following the exact low-risk pattern already proven twice in this series (`assessment_type_id`, `class_teacher_id`). Phase 3 — Grade/Subject additive FK, gated on Phase 1's findings. Phase 4 — Promotion consolidation, recommended now while both tables have zero live rows (cheapest possible moment). Phase 5 — Class/Enrollment consolidation, per Stage 0.5's own already-ratified recommendation, deliberately listed last and not re-scoped here.

**Architectural documents referenced**: `docs/architecture/stage-0-architectural-census.md`, `docs/architecture/stage-0.5-canonical-identity-resolution.md` (both extended, not superseded), `docs/architecture/adr/0002-canonical-teacher-identity.md` (Teacher identity, confirmed still settled and out of this audit's scope), `docs/architecture/academic-evidence-layer.md` §2 (cited by `student_promotions`' own migration header as its architectural justification).

**ADR**: None — no identity/ownership decision made or needed; this is an audit and sequencing recommendation, not a ratification.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-16 — Sprint 5I: Assessment Type Canonical Mapping Consolidation

**What changed**: created `lib/assessments/assessmentTypeCatalog.ts`, a single pure-function, DB-free module that is now the one canonical source for the 6 platform-seeded assessment labels' display metadata (title label, badge label, badge color) and their Sprint 5H-P-ratified educational-purpose mapping. Migrated 6 duplicate implementations into it, one at a time, with behavior verified identical at each step. No educational policy, business logic, AI behavior, Projection, Evidence semantics, Ranking, Grading, Analytics, schema, or migration was touched.

**Root cause / discovery**: re-verifying Sprint 5G/5H-P's counts from scratch (as instructed — "do not trust previous counts") found the true number of duplicate implementations was **6, not the 2-3 previously catalogued**: two new ones were found in `app/teacher/classes/[classId]/assessments/page.tsx` itself (a `TYPE_LABEL` used for titles and a separately-spelled `TYPE_META` used for badges — never noticed as two, not one, before this sprint), one more in `app/teacher/analytics/page.tsx` (`ATYPE_LABEL`/`ATYPE_ORDER`/`aTypeSort` — the only copy that also encoded a sort order), and one more as a bare inline object literal in `app/teacher/classes/[classId]/page.tsx`'s report-generation flow. Every prior sprint's audit had missed at least 3 of these 6.

**Repair**: migrated all 6 duplicate label/mapping implementations, plus the separate `lib/config/assessmentTypePurposes.ts` purpose-mapping file (deleted, zero remaining consumers after `lib/assessments/mutations.ts::resolveOrCreateAssessmentType` was repointed to the canonical module), plus `lib/assessments/types.ts`'s independently-declared `AssessmentType` union (now re-exported from the canonical module instead of redeclared), plus one Zod enum (`app/api/teacher/assessments/[assessmentId]/route.ts`'s PATCH schema, now built from `KNOWN_ASSESSMENT_TYPES` instead of a literal array — identical accepted-value set).

**Deliberately excluded, confirmed still present and unchanged**: `lib/assessments/evidence.ts`'s `toEvidenceAssessmentType` (maps into a separate, Evidence-Domain-owned 3-value enum, not the label/purpose mapping — touching it risks "change Evidence semantics," forbidden by this sprint) and 8 hardcoded `'assignment'` placeholder literals across Compass/remarks/holiday/etc. (don't read `assessment_type` at all — a different kind of placeholder, not assessment-type-mapping duplication).

**Behavior preservation, explicitly verified per call site**: the two genuinely-different label spellings ("Mid-Term"/"End-Term" in title contexts vs. "Midterm"/"End Term" in badge contexts) are preserved as two distinct fields (`titleLabel`/`badgeLabel`), not silently unified. Each call site's exact fallback behavior for an unknown/custom type name was preserved individually — including one call site (the teacher dashboard's assessment card) whose fallback was "use Exam's full metadata," genuinely different from every other call site's "use the raw string" fallback, and including the analytics page's sort comparator's pre-existing dead-code quirk (`Array.prototype.indexOf`'s `?? 99` never actually triggers, since `indexOf` never returns nullish — reproduced verbatim, not "fixed").

**Tests**: new `lib/assessments/assessmentTypeCatalog.test.ts` (11 pure-function tests, no DB needed) covering every label, every purpose code, invalid/custom labels, case sensitivity, metadata lookup, purpose round-trip, duplicate prevention, and an explicit regression test proving the title/badge spelling split is intentional and preserved. Full pre-existing regression suite re-run (`assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `phaseBMigration.safety.test.ts`, `phaseGMigration.safety.test.ts`, `coreAssessmentTypeIntegrity.test.ts`, `permissions.assessmentbatch.test.ts`, `permissions.classownership.test.ts`) — 30 tests, all still passing. 41/41 total.

**Validation**: live pilot DB unchanged (11 rows, 0 NULL `assessment_type_id`, 0 residual test rows). Repo-wide final search confirms exactly one canonical implementation of the label dictionary remains anywhere in the codebase.

**Risk assessment**: Architecture — low (pure leaf module, no new dependency direction). Migration — none. Backward compatibility — full, verified per call site. Performance — negligible. Rollback — trivial (10 files, each independently revertible). Developer experience — materially improved (one place to change instead of 6, 2 of which no prior audit had even found). Future AI readiness — neutral-to-positive; this sprint deliberately does not wire assessment type into Evidence, Projection, Analytics, or any Intelligence subsystem, per its own stop condition.

**Architectural documents referenced**: `docs/architecture/assessment-type-policy-ratification.md` (Sprint 5H-P, the ratified Hybrid model this sprint mechanically consolidates around), `docs/engineering/sprint-5g-assessment-type-consolidation-audit.md` (prior duplication inventory, now confirmed incomplete and superseded by this sprint's fresh count).

**ADR**: None — no policy or architecture decision made; purely mechanical.

**Tests added**: see above.

**Rollback considerations**: 10 files changed (1 new module, 1 new test file, 1 deleted config file, 7 call-site migrations across `lib/` and `app/`), each independently revertible.

---

## 2026-07-16 — Sprint 5H-P: Assessment Type Policy Ratification (READ-ONLY)

**What changed**: nothing in code — a product-architecture policy document, `docs/architecture/assessment-type-policy-ratification.md`, answering the question Sprint 5G identified as remaining: what does "Assessment Type" mean, educationally, inside EduNexus.

**Decision: Option C (Hybrid) ratified** — teacher-chosen classroom labels (CAT, Exam, Assignment, ...) map to a small, platform-governed educational-purpose vocabulary (diagnostic, formative, summative, practice, practical), which is intended to eventually inform Intelligence/Analytics/Adaptive systems. This is a ratification of an already-existing direction, not a new design: the label→purpose mapping (`lib/config/assessmentTypePurposes.ts`, the Phase G `evidence_purposes` seed) was already built, seeded, and tested — it has simply never been connected to anything downstream.

**Key evidence**:
- A third, previously-uncatalogued duplicate label dictionary found in the teacher-facing UI itself (`app/teacher/classes/[classId]/assessments/page.tsx:32-38`, `TYPE_META`) — the same six-way classification is now known to be independently spelled in three places, not two (Sprint 5G had found only the two `lib/` copies).
- Every downstream subsystem evaluated for whether Assessment Type *should* matter (Ranking, Grading, Evidence, Projection, Adaptive Learning, Career Intelligence, Academic Clinic, Learning Compass, Parent Portal, Teacher Dashboard, School Analytics, Reference School) came back "must care" for only two (Evidence, Teacher Dashboard — both already true today) and "should ignore" or weaker (may/unknown/maybe/too early) for every other — meaning the unbuilt bottom half of the hybrid model (Evidence → Adaptive Learning → Projection → Career Intelligence) is not evidenced as urgent.
- Ownership is confirmed already-decided by existing schema/RLS, not newly assigned: teacher owns the label, platform (service-role-only writes) owns the purpose vocabulary, school-level customization is schema-reserved but has no write path and no evidenced demand.
- A genuine, newly-identified lifecycle inconsistency: Evidence treats purpose as an immutable, frozen-at-capture-time fact (protected by the existing immutability trigger); Reports/PDF rendering read the *current* live value at render time — an edited assessment's regenerated historical report would show today's label, not the label at the time it was created. Flagged, not resolved.

**Policy answers** (Part 6): legacy text column stays permanently (3 live consumers still need it); `assessment_type_id` is canonical for creation/identity (already true since Sprint 5F); both fields coexist indefinitely by design, not by indecision; text is never computed from the FK (the mapping isn't invertible — multiple labels share one purpose); the FK's resolution must remain non-guessing; school-level type customization stays reserved, not built, absent demand; CBC-standard defaults continue to govern the seeded vocabulary.

**Recommendation given**: ratify the direction now; do not build the unbuilt downstream connections speculatively — consistent with this project's standing "start simple, grow later" philosophy. No implementation was proposed or authorized by this document.

**Architectural documents referenced**: `docs/engineering/sprint-5g-assessment-type-consolidation-audit.md` (direct prerequisite), `docs/architecture/learner-record-layer-decisions.md` Decision 2, `docs/architecture/engineering-educational-intelligence-blueprint.md` §11.8 (Instrument Validity Gate, cited as architecturally adjacent precedent for a label-vs-epistemic-standing split).

**ADR**: None — this is a product-policy ratification, not an identity/domain-ownership decision of ADR weight; no conflict with ADR-0002 (out of its scope) was found.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-16 — Sprint 5G: Assessment Type Consolidation Audit (READ-ONLY)

**What changed**: nothing — read-only audit, no code/schema/test/migration touched. Full findings in `docs/engineering/sprint-5g-assessment-type-consolidation-audit.md`.

**Purpose**: with ADR-0002 implemented (Sprint 5F), inventory everything remaining that duplicates, infers, or desynchronizes assessment type before any consolidation work is planned.

**Key findings**:
- **The sprint-brief's assumed call graph doesn't exist.** `assessment_type_id` has exactly one live consumer anywhere in the codebase (`recordAssessmentEvidence`'s `purpose_id` resolution), which is itself a dead end — nothing reads `purpose_id` back. Evidence, Analytics, Reports, Projection, Adaptive Learning, Career Intelligence, and Academic Clinic either don't reference assessment type at all, or (Evidence's `toEvidenceAssessmentType`, Reports/dashboards' label maps) reference the legacy **text** column, never the FK — confirmed fresh this session, unchanged from Sprint 5D.
- **A second, previously-unaudited writer found**: `scripts/reference-school/05-seed-assessments.ts` (the Mathematics CAT seed, distinct from the already-fixed `06-seed-legacy-bridge.ts` Kiswahili seed) writes `assessment_type` but never `assessment_type_id` — the identical defect Sprint 5E fixed in its sibling script, never itself touched. Currently masked/unreachable: its own try/catch skips the insert entirely due to an unrelated, already-known FK mismatch (`class_id` targeting Core's `classes`, which fails the live FK to legacy `teacher_classes`) — confirmed live, 0 of the 11 real `class_assessments` rows are attributable to this script.
- **Live data is clean on every reachable path**: 0 NULL `assessment_type_id`, 0 NULL `assessment_type`, 0 mismatched pairs, 0 orphan FKs (11 total rows, unchanged since Sprint 5D).
- **`assessment_types` is 96% unused** (266 of 276 rows never referenced) — fully explained by the Phase B backfill seeding 6 rows per teacher regardless of use, not an anomaly.
- **`learner_evidence.purpose_id` is 100% NULL (407 of 407 rows)** — fully explained: all 407 rows predate the Phase G migration, which deliberately never backfills existing evidence (`purpose_id` is "captured at write time" only), and **zero evidence rows have been created since Phase G shipped** — meaning the `purpose_id`-resolution code path has real integration-test coverage but zero live production verification to date.
- **Every reachable write path is synchronized** (teacher creation, Core creation, teacher PATCH, the fixed `06-` seed script); the one unsynchronized path (`05-seed-assessments.ts`) is currently inert, not actively producing bad data.

**Migration readiness**: ordered 8 items from safest (fix the second seed script; consolidate the two duplicate label dictionaries; consolidate 8 hardcoded placeholder literals — all pure-mechanical, low blast radius) to riskiest (dropping the legacy `assessment_type` text column — explicitly **not ready**, since Reports and Teacher dashboards still read it directly and haven't been migrated to the FK).

**Recommendation**: **NEEDS POLICY DECISION** — not ready for further migration work, not an ADR-level question, and live data needs no cleanup. Three explicit open policy questions are named (whether to do the mechanical cleanup now independent of the larger question; whether Reports/dashboards should ever migrate to the FK or the text column stays permanent; whether `purpose_id`'s never-backfilled policy should be reconfirmed given its 0% real-world coverage).

**Architectural documents referenced**: `docs/engineering/sprint-5d-assessment-type-audit.md` (baseline, re-verified fresh, no regressions found), `docs/architecture/adr/0002-canonical-teacher-identity.md` (confirmed out of scope for this question, no conflict).

**ADR**: None — no domain/identity/ownership question is open; explicitly ruled out in favor of "needs policy decision."

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-16 — Sprint 5F: Implement ADR-0002 (Core Assessment Creation Teacher Identity Repair)

**What changed**: `lib/core/assessments.ts::createAssessment` and its route caller now resolve and write the real `teachers.id` (ratified canonical Teacher-domain identity, ADR-0002) instead of trusting a caller-supplied `school_users.id`. This is the same fix originally made in Sprint 5E and then reverted for lacking architectural backing — it is now re-applied with that backing in place. No Intelligence, Ranking, Grading, Evidence, Projection, or Report generation logic was touched; no migration was written.

**Root cause** (unchanged from Sprint 5E/5D's findings, now formally closed by ADR-0002): `app/api/core/assessments/route.ts`'s create action resolved `schoolUser.id` (a `school_users.id`, the Permissions domain's identity per RAS §3) and passed it as `teacher_id` into `createCoreAssessment`, which writes to `class_assessments.teacher_id` — a column FK'd to `teachers(id)`, the Teacher domain's canonical identity. Every real Core-created assessment failed outright on that FK, and `assessment_type_id` could never be resolved either, since `assessment_types.teacher_id` has the identical FK.

**Repair**:
- `lib/core/assessments.ts::createAssessment` now takes `userId` (the authenticated caller) instead of a caller-supplied `teacher_id`. It resolves the real teacher via the existing `resolveTeacher()` (`lib/core/identity.ts` — the same function `requireClassTeacher` already calls for authorization), then reuses the existing, exported `resolveOrCreateAssessmentType()` (`lib/assessments/mutations.ts`) for both `teacher_id` and `assessment_type_id` — no new identity logic invented, no lookup duplicated.
- `app/api/core/assessments/route.ts`'s create branch now passes `userId` straight through; the now-unnecessary `getSchoolUser` call in this branch was removed (still used by the sibling `save-scores` action, untouched).
- `lib/repositories/assessment.repository.ts::createCoreAssessment`'s `assessment_type_id` input field, added in the earlier Sprint 5E work, is now actually populated by this caller (previously only used by the reference-school seed script).

**Admin edge case — deliberately not solved, per ADR-0002 Part 7's explicit scope boundary**: when `resolveTeacher(userId)` returns null (a `school_admin`/`headteacher`/`deputy_headteacher` caller with no `teachers` row — confirmed live: 0 of 9 such users have one), `createAssessment` throws a clear, descriptive error (`"createAssessment: no teacher record found for this user — admin-created assessments are a known, unresolved gap (see ADR-0002)"`). The *outcome* is unchanged from before this sprint (creation already failed for every real Core-created assessment, for a different reason) — only the failure's clarity improved, and the gap is now named and traceable via the error message and this log entry, rather than rediscoverable only by reading code.

**Behavior preserved, explicitly confirmed**: teacher-facing (legacy) assessment creation, PATCH drift-prevention, and the reference-school seed script are all untouched by this sprint (they were already correctly resolving/passing `teachers.id` before Sprint 5E even started, or were fixed independently in Sprint 5E's correction). Evidence, Projection, Career Intelligence, Ranking, and Grading remain unaffected — confirmed zero references to `assessment_type_id`/`teacher_id` in any of those systems (ADR-0002 Part 5).

**Tests**: `lib/core/coreAssessmentTypeIntegrity.test.ts` rewritten (8 tests): Core route resolves the real `teachers.id` and `assessment_type_id`; a second same-type Core assessment reuses the same `assessment_types` row (no duplicate lookup); teacher-resolution failure throws a clear error and inserts nothing; teacher-facing path unchanged; a never-before-seen type name is registered, not rejected; PATCH sync and no-drift regression checks; a pre-existing NULL-`assessment_type_id` row still loads. All 8 passing. Full pre-existing regression suite re-run and passing: `assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `phaseBMigration.safety.test.ts`, `phaseGMigration.safety.test.ts`, `permissions.assessmentbatch.test.ts`, `permissions.classownership.test.ts` (22 tests) — 30/30 total, 0 failures.

**Validation**: live pilot DB re-checked post-fix: 0 NULL `assessment_type_id`, 0 orphan `assessment_type_id` FKs, 0 orphan `teacher_id` FKs, 0 residual synthetic test rows.

**Risk assessment**:
- *Architecture risk* — Low. Implements an already-ratified ADR exactly as decided; no new domain, table, or repository.
- *Business risk* — Low, net positive. Core assessment creation was completely non-functional before this fix for every real attempt; it is now functional for every teacher-role Core user (39 of 39 in live pilot data already have a `teachers` row). Admin-tier creation remains non-functional, exactly as before — no regression, and now clearly diagnosable.
- *Migration risk* — None. No migration was written or required.
- *Security risk* — None. No authorization logic changed; `requireCanManageAssessment` still gates the route exactly as before.
- *Performance risk* — Negligible. One additional indexed single-row lookup (`resolveTeacher`) plus the same `resolveOrCreateAssessmentType` cost the teacher path already pays, on a low-frequency, non-loop creation path.

**Architectural documents referenced**: `docs/architecture/adr/0002-canonical-teacher-identity.md` (this sprint's direct authorization and prerequisite).

**ADR**: `0002-canonical-teacher-identity.md` — implemented, not amended.

**Tests added**: see above.

**Rollback considerations**: two production files changed (`lib/core/assessments.ts`, `app/api/core/assessments/route.ts`) plus one rewritten test file; each independently revertible via `git checkout --`. Reverting restores the pre-ADR-0002 (fully broken) Core creation behavior — the Sprint 5E-correction state.

---

## 2026-07-16 — ADR-0002: Canonical Teacher Identity Decision (READ ONLY)

**What changed**: nothing in code, tests, migrations, or repositories. This entry records a ratified architecture decision, `docs/architecture/adr/0002-canonical-teacher-identity.md`, produced to settle the identity question Sprint 5E's closure audit surfaced but explicitly declined to resolve unilaterally.

**Decision**: `teachers.id` is ratified as the canonical Teacher-domain business identity, superseding no prior decision (none existed) and confirming the Reference Architecture Specification's own existing designation (`reference-architecture-specification.md:60`, `teachers (evolving)`), which had never previously been cited or acted on in the Assessment-domain work. `school_users.id` remains canonical for its own, separate domain — Permissions/membership (`reference-architecture-specification.md:73`) — not a competing Teacher identity.

**Evidence, briefly** (full detail in the ADR): `teachers` predates `school_users` by 86 days (git history); Core's foundation migration was explicitly "100% additive — zero modifications to existing OS tables or logic," never intended as a replacement; every subsystem that references teacher identity at all — Academic Clinic, Adaptive Learning, Learning Compass, the Reference School seed pipeline — already independently converged on `teachers.id`, with zero references to `school_users.id` found anywhere in Ranking, Grading, Evidence, Projection, or Career Intelligence; live pilot data shows 39 of 39 `school_users` rows with `role='teacher'` already have a matching `teachers` row, while 0 of 9 admin-tier (`school_admin`/`headteacher`/`deputy_headteacher`) rows do.

**Explicitly not resolved by this ADR**: what a Core assessment-creation request should do when the caller is an admin-tier user with no `teachers` row (9 real, live users, a genuine and currently-unresolved edge case) — deliberately left as a separate, narrower implementation question for whichever sprint designs the fix, not conflated with the identity-canonicity decision itself.

**Architectural documents referenced**: `docs/architecture/reference-architecture-specification.md` (the decisive, previously-ratified evidence), `docs/architecture/stage-0.5-canonical-identity-resolution.md` (independently-derived, consistent prior finding for the same Teacher-School membership question), `docs/engineering/sprint-5e-teacher-ownership-audit.md` (this ADR's direct prerequisite).

**ADR**: `docs/architecture/adr/0002-canonical-teacher-identity.md` — **APPROVED**.

**Tests added**: None (read-only; no code changed).

**Rollback considerations**: None — no code, schema, or data was touched. The ADR itself can be superseded by a future ADR if new evidence emerges, per this repository's existing ADR convention (`0001-class-students-parent-id-guardian-mechanism.md`'s own draft-status precedent).

---

## 2026-07-15 — Sprint 5E Correction: Pre-Implementation Verification Narrowed Scope

**What changed**: the original Sprint 5E entry below (same date) is **partially reverted**, per this log's "never rewrite history, add a new entry" rule. A follow-up pre-implementation-verification pass applied a stricter decision rule — *"if a valid teacherId is not already available at a call site without adding new identity-resolution logic, do not add a lookup; record it as tech debt and leave that caller unchanged"* — retroactively, to the already-implemented fix. Applied honestly, this rule does not endorse everything the original entry did.

**Audit, this pass**: `createCoreAssessment()` (`lib/repositories/assessment.repository.ts:1006`) has two callers, only one of which the original Sprint 5E audit examined:
- **Caller 1** — `app/api/core/assessments/route.ts` → `lib/core/assessments.ts::createAssessment`. No valid `teachers.id` was available at this call site without adding `resolveTeacher()` — a new identity-resolution call in a path that never had one. Under this pass's rule, that addition should not have been made.
- **Caller 2** — `scripts/reference-school/06-seed-legacy-bridge.ts:490`, missed by the original audit entirely. It calls `createCoreAssessment()` directly (bypassing `lib/core/assessments.ts`), and already has a valid `teachers.id` in hand (`legacyTeacherId`, resolved via its own pre-existing `schoolUserIdToLegacyTeacherId` map, `06-seed-legacy-bridge.ts:263`) — no new lookup needed. It was not previously setting `assessment_type_id` at all.

**Decision, presented to and confirmed by the user**: since this directly conflicted with the user's own explicit approval earlier in the same session (to add `resolveTeacher()` for Caller 1, because leaving it out made the whole fix untestable dead code against an already-broken insert path), the conflict was surfaced directly rather than silently resolved either way. The user chose: revert Caller 1 to its original, unfixed state; complete Caller 2, where the rule's "already available" branch applies cleanly.

**Repair, this pass**:
- `lib/core/assessments.ts::createAssessment` — reverted to its pre-Sprint-5E form: takes a caller-supplied `teacher_id` again (not `userId`), no `resolveTeacher()`/`resolveOrCreateAssessmentType()` calls. `assessment_type_id` is not resolved by this function, on purpose, and is documented in-code as a known tech-debt gap alongside the still-present, still-unfixed `teacher_id`/`school_users.id` mismatch.
- `app/api/core/assessments/route.ts` — reverted the create branch to its original form (`getSchoolUser` + `teacher_id: schoolUser!.id`), restoring the exact prior (broken) behavior.
- `scripts/reference-school/06-seed-legacy-bridge.ts` — now resolves `assessment_type_id` via `resolveOrCreateAssessmentType(legacyTeacherId, 'cat')` before its `createCoreAssessment()` call, reusing the already-available, already-resolved `legacyTeacherId` — no new lookup, no new logic.
- `lib/repositories/assessment.repository.ts::createCoreAssessment`'s optional `assessment_type_id` input field is retained (now used by Caller 2; harmlessly unused by the reverted Caller 1).
- `lib/assessments/mutations.ts`'s PATCH drift-prevention fix (Part 3 of the original Sprint 5E) is **unaffected and retained** — its `teacherId` was already available before Sprint 5E even started (resolved by the caller via `resolveTeacher()` in `app/api/teacher/assessments/[assessmentId]/route.ts`, pre-existing), so it was never in the "not available" branch to begin with.
- `lib/core/coreAssessmentTypeIntegrity.test.ts` rewritten: removed tests asserting Caller 1's now-reverted behavior; added a test confirming Caller 1 deliberately leaves `assessment_type_id` NULL; kept the teacher-path and PATCH-sync tests unchanged (still passing, still correct). 5 tests, all passing. Caller 2 relies on the already-tested `resolveOrCreateAssessmentType` contract (covered by `assessmentType.integration.test.ts`) rather than a redundant duplicate test of the same function.

**Explicitly recorded as unfixed technical debt (not silently patched)**: Core assessment creation via the production API route (`app/api/core/assessments/route.ts`) remains completely non-functional — every real attempt still fails on insert, because `class_assessments.teacher_id` is populated from `school_users.id`, not `teachers.id`. `assessment_type_id` for this path remains permanently NULL until that identity mismatch is resolved in its own, separately-scoped sprint.

**Tests**: `lib/core/coreAssessmentTypeIntegrity.test.ts` (5 tests, revised) + full pre-existing regression sweep re-run — `assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `phaseBMigration.safety.test.ts`, `phaseGMigration.safety.test.ts`, `permissions.assessmentbatch.test.ts`, `permissions.classownership.test.ts` (22 tests). 27/27 passing. Live pilot DB re-checked: 0 residual synthetic rows.

**Risk assessment**: *Architecture* — Low; narrows scope, adds nothing new. *Business* — neutral-to-slightly-worse than the reverted state for Caller 1 specifically (Core API-driven assessment creation, already 100% broken before Sprint 5E, remains 100% broken — no regression, but the improvement made in the original entry is undone); net positive for Caller 2 (a previously-missed gap is now closed with zero new risk). *Migration* — none. *Security* — none, no authorization logic touched. *Performance* — negligible (one already-tested function call added to a low-frequency seed script).

**ADR**: None.

**Rollback considerations**: this entry's changes are the rollback of the original entry's Caller-1 portion; reverting *this* entry (`git revert` equivalent) would restore the original Sprint 5E fix for Caller 1. The Caller 2 completion is independently revertible via `git checkout -- scripts/reference-school/06-seed-legacy-bridge.ts`.

---

## 2026-07-15 — Sprint 5E: Assessment Type Integrity Repair

**What changed**: `createCoreAssessment` (Core's assessment creation path) now resolves and stores `assessment_type_id` using the exact same canonical lookup the teacher-facing path already used, and the assessment-edit PATCH now keeps `assessment_type`/`assessment_type_id` synchronized instead of allowing silent drift. No Intelligence, Evidence, Ranking, Grading, or Analytics logic was touched; no migration was written; no ADR triggered.

**Root cause (per Sprint 5D)**: `lib/repositories/assessment.repository.ts::createCoreAssessment` never called `resolveOrCreateAssessmentType` (the resolution step `lib/assessments/mutations.ts`'s teacher-facing `createAssessment` always performs) — it inserted whatever `input` it was given, with no `assessment_type_id` field at all. Every Core-created row was therefore born with it NULL.

**A second, larger defect surfaced while scoping the fix, not part of Sprint 5D's original finding**: `app/api/core/assessments/route.ts` passed `teacher_id: schoolUser!.id` (a `school_users.id`) into `createCoreAssessment`, but `class_assessments.teacher_id` — like `assessment_types.teacher_id` — has a real FK to `teachers(id)`, a completely different id space (confirmed via `information_schema` against the live schema, and via a synthetic-fixture read-only check against pilot data). This meant every Core-created assessment already failed outright on insert, independent of `assessment_type_id` — the true reason zero Core-created rows exist in production (Sprint 5D's "dormant, unexercised" framing undersold it: the path was completely broken, not just unused). Surfaced to the user mid-implementation via two targeted questions before writing any code, since fixing `assessment_type_id` alone — reusing `resolveOrCreateAssessmentType` against the wrong id — would have turned a silent NULL into a hard FK-violation 500 on every Core assessment creation, a worse regression than the defect being repaired. User approved fixing both together, using the same mechanism (`resolveTeacher`) for both.

**Repair**:
- `lib/core/assessments.ts::createAssessment` now takes `userId` instead of trusting a caller-supplied `teacher_id`. It resolves the real teacher via the existing `resolveTeacher()` (`lib/core/identity.ts`, already used by `requireClassTeacher` for the identical purpose), throws a clear, descriptive error if no teacher record exists (previously would have hit an opaque FK/NOT-NULL constraint violation — same outcome, clearer message, no behavior change for that population since the insert already failed for them either way), and passes the resolved id to both `teacher_id` and `resolveOrCreateAssessmentType` — the same function the teacher-facing path calls, re-exported from `lib/assessments/mutations.ts`, no new logic invented.
- `lib/repositories/assessment.repository.ts::createCoreAssessment`'s input type gained an optional `assessment_type_id`; the existing `.insert({...input, ...})` spread already picks it up — no change to the insert logic itself.
- `app/api/core/assessments/route.ts`'s create branch now passes `userId` straight through instead of resolving and forwarding `schoolUser.id` — the HTTP request/response contract (body shape, status codes) is unchanged; only the internal domain-function signature changed, and the now-unnecessary `getSchoolUser` call in this branch was removed (still used by the sibling `save-scores` branch, untouched).
- `lib/assessments/mutations.ts::updateAssessment` (teacher-facing PATCH) now re-resolves `assessment_type_id` via `resolveOrCreateAssessmentType` whenever `assessment_type` is part of the update, closing the drift path where a teacher renames an assessment's type and the FK silently keeps pointing at the old one. No direct way to set `assessment_type_id` exists on this PATCH, so this is the only place drift could be introduced and the only place that needed closing.

**Explicitly out of scope, left untouched**: the legacy `assessment_type` text column (still present, still read by analytics/labels/PDF/evidence exactly as before); the duplicate type→label mappings flagged in Sprint 5D §6; the `save-scores`/`compute` actions in the same route file, which have an analogous `schoolUser.id`-as-`teacher_id` pattern on `learner_marks` — flagged here as a related, out-of-scope finding for a future sprint, not fixed.

**Behavior preserved, explicitly confirmed**: Evidence (`recordAssessmentEvidence`, `purpose_id` resolution) unchanged — still only reachable from the teacher marks/upload routes, never Core; teacher gradebook creation/grading/CSV upload untouched; Ranking (`lib/ranking`) untouched; Grading (`lib/grading`) untouched; `lib/assessments/analytics.ts` untouched (still reads the `assessment_type` text column); Projection/Capability Extraction/Academic Clinic untouched (confirmed zero references to `assessment_type`/`assessment_type_id` in any of those files, per Sprint 5D §4/§8).

**Tests added**: `lib/core/coreAssessmentTypeIntegrity.test.ts` (8 tests, against real synthetic Supabase data): Core creation writes a real `teacher_id` and resolves `assessment_type_id`; a second same-type Core assessment reuses the same `assessment_types` row (no duplicates); a never-before-seen type name is registered, not rejected or left null; a user with no `teachers` record fails with a clear error and inserts nothing; the teacher-facing path is unchanged; PATCH changing `assessment_type` re-resolves `assessment_type_id` (no drift); PATCH not touching `assessment_type` leaves it untouched; a pre-existing row with a NULL `assessment_type_id` still loads via `listAssessments`. All 8 passing. Full pre-existing suites re-run and still passing: `assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `phaseBMigration.safety.test.ts`, `phaseGMigration.safety.test.ts`, `permissions.assessmentbatch.test.ts`, `permissions.classownership.test.ts` (14 + 8 = 22 tests, 0 failures) — confirming teacher-path creation, evidence-purpose resolution, migration safety, and class/teacher authorization are all unaffected.

**Validation**: live pilot DB re-checked post-fix: 0 NULL `assessment_type_id`, 0 orphan `assessment_type_id` FKs, 0 orphan `teacher_id` FKs, 0 residual synthetic test rows.

**Risk assessment**:
- *Architecture risk* — Low. No schema change, no new domain, no ADR-triggering decision; reuses an existing function (`resolveOrCreateAssessmentType`) and an existing identity primitive (`resolveTeacher`) exactly as designed for this purpose elsewhere.
- *Business risk* — Low, net positive. Core assessment creation was completely non-functional before this fix (100% failure rate on any real attempt, for reasons broader than assessment_type_id); it is now functional for every pilot teacher (all of whom have both a `school_users` and a `teachers` record today). A genuinely Core-native user with no legacy `teachers` row still cannot create a Core assessment — same outcome as before, now with a clear error instead of an opaque constraint violation.
- *Migration risk* — None. No migration was written or is required.
- *Security risk* — None. No authorization logic changed; `requireCanManageAssessment` still gates the route exactly as before this sprint.
- *Performance risk* — Negligible. One additional `resolveTeacher` lookup (indexed, single-row) and the same `resolveOrCreateAssessmentType` cost the teacher path already pays, added to a low-frequency, non-loop creation path.

**Architectural documents referenced**: `docs/engineering/sprint-5d-assessment-type-audit.md` (this sprint's direct prerequisite).

**ADR**: None — no canonical identity, ownership model, layer, domain, or Constitution/RAS conflict; reuses an existing, already-ratified identity primitive for its designed purpose.

**Rollback considerations**: four files changed (`lib/core/assessments.ts`, `lib/assessments/mutations.ts`, `lib/repositories/assessment.repository.ts`, `app/api/core/assessments/route.ts`) plus one new test file; each is independently revertible via `git checkout --`. Reverting `lib/core/assessments.ts` alone restores the pre-Sprint-5E (fully broken) Core creation behavior; reverting the PATCH change in `lib/assessments/mutations.ts` alone restores the drift gap without affecting creation.

---

## 2026-07-15 — Sprint 5D: Assessment Type Canonicalization Audit (read-only)

**What changed**: nothing — this was a read-only architectural audit, no code/database/migration touched. Full findings in `docs/engineering/sprint-5d-assessment-type-audit.md`.

**Trigger**: Sprint 3 found Core-created assessments frequently leave `assessment_type_id` NULL. This sprint traced the complete blast radius before scoping any fix.

**Key findings**:
- **Confirmed, structural**: `createCoreAssessment` (`lib/repositories/assessment.repository.ts:1005-1031`, reached via `app/api/core/assessments/route.ts`) never resolves or sets `assessment_type_id` — no lookup, no default. Every Core-created `class_assessments` row is born with it NULL. The teacher-facing path (`lib/assessments/mutations.ts::createAssessment`) always resolves it correctly via `resolveOrCreateAssessmentType`.
- **Currently latent, not yet observed**: live pilot DB has 11 `class_assessments` rows, 0 NULL, 0 orphan FKs, 0 text/FK mismatches — no school has used the Core creation path yet in this environment.
- **Scope-limiting fact**: `assessment_type_id`'s only functional consumer, `recordAssessmentEvidence` (`lib/assessments/evidence.ts:69-71`, resolving `learner_evidence.purpose_id`), is only ever called from the teacher-gradebook marks/upload routes — never from a Core-created assessment. The NULL-`assessment_type_id` defect and the one live consumer do not currently intersect in production. `purpose_id` itself, once written, is read by nothing downstream (Projection, Capability Extraction, and the Learner Record Timeline all have zero references to `assessment_type`/`assessment_type_id`/`purpose_id`, grep-confirmed).
- **A second, separate drift path**: `updateAssessment`'s PATCH lets a teacher change `assessment_type` (text) with no corresponding update to `assessment_type_id`, and no trigger enforces consistency (contrast with `learner_evidence`'s `enforce_evidence_immutability` trigger, which has no equivalent here).
- **The original rollout was never completed**: `docs/architecture/academic-evidence-layer.md` §7 planned to drop the legacy `assessment_type` text column "once … every reader migrated." No reader has migrated except the one narrow purpose lookup above — analytics, display labels, PDF rendering, and Evidence's claim-key derivation all still read the text column. Three-plus duplicate type→label/purpose mappings exist across the codebase (`TYPE_LABEL`, `typeLabel`, `toEvidenceAssessmentType`, 8 hardcoded `'assignment'` placeholders in evidence-producer modules), none sharing a canonical source.

**Risk classification**: no Critical findings. Two Medium (Core-creation gap; PATCH drift with no trigger), one Medium (abandoned rollout midpoint), one Low–Medium (duplicate mappings), one Low (FK has no `ON DELETE`/CHECK/NOT NULL, currently safe by accident), one Informational (unreachable school-scoped RLS policy on `assessment_types`, pre-existing and out of scope), one Informational (live data currently clean — all risks are code-path risks, not yet manifested).

**Architecture compliance**: violates §7's own stated rollout-completion criterion (readers never migrated, column never dropped); the duplicate mappings violate CLAUDE.md's "no duplicate constant definitions across files." No Constitutional Law violation, no security/RLS gap, no learner-identity anchoring issue.

**Migration strategy proposed (not authorized, not started)**: Sprint 5E (fix Core-creation gap), 5F (drift protection), 5G (consolidate duplicate mappings), 5H (explicit product decision on whether to complete or supersede the original §7 rollout plan) — each independently deployable and reversible.

**ADR**: None — audit only, no architecture change proposed or ratified.

**Tests added**: None (read-only, no code changed).

**Rollback considerations**: None — no code, schema, or data was touched.

---

## 2026-07-15 — TD-014: Report Card Retrieval Fix (correctness, discovered during SH-001)

**What changed**: fixed `SchoolRepository::findReportCardWithSubjects` (`lib/repositories/school.repository.ts`), which had silently returned `null` for every call regardless of input. Scope was deliberately limited to this one repository method — no grading, ranking, analytics, publishing, generation, promotion, or authorization logic was touched.

**Root cause**: the method issued a single `.select()` against `school_report_cards` that tried to embed `term_subject_summaries` as a nested resource (PostgREST embedding). Embedding requires an actual foreign-key relationship between the two tables; `term_subject_summaries` and `school_report_cards` only *share* `(learner_id, term_id)` values — neither table has a FK pointing at the other (confirmed by re-reading the only migration that defines both, `supabase/migrations/20260629_core_foundation.sql` §17–18, and confirming no later migration touches either table). Every call therefore failed with PostgREST error `PGRST200` ("Could not find a relationship … in the schema cache"). The method destructured `{ data }` without `error`, so the failure was discarded and the function returned `null` — indistinguishable from "no report card exists." This exact bug had already been identified and documented, but deliberately left unfixed, in `lib/core/reportCardOwnership.security.test.ts`'s SH-001 test comments (predates and is independent of the SH-001 IDOR fix).

**Repair**: split the single query into two — (1) `school_report_cards` embedding `learners` (a real FK, `learner_id → learners.id`, unaffected), fetched with `.maybeSingle()` so "no report card" is a normal `null` result rather than a `.single()` error; (2) `term_subject_summaries` embedding `subjects` (a real FK, `subject_id → subjects.id`), queried separately by `(learner_id, term_id)`. The two results are joined in application code into the same `ReportCardWithSubjects` shape the callers (`lib/core/report-cards.ts::getReportCard`, both `app/api/**/reports` routes) already expect — no caller changes needed. Both queries now check `error` and throw, so a real DB failure surfaces instead of being swallowed. No schema migration — no FK was added, since the two tables have no natural one-to-one relationship to declare (a report card can have zero, one, or many subject summaries by `(learner_id, term_id)`, not by `report_card_id`).

**Tests added**: new `lib/core/reportCardWithSubjects.test.ts` (7 tests, against real synthetic Supabase data) covering: single learner with multiple subjects, published report, unpublished (draft) report, report with zero subject summaries, report with partial subject summaries (one of two subjects), a learner with no report-card row at all (returns `null`, not an error), and a nonexistent learner (rejects via the existing SH-001 ownership check). Updated `lib/core/reportCardOwnership.security.test.ts`'s two same-school tests to assert on returned report content (`learner_id`, `is_published`) now that the query actually returns data, and updated its stale comment block describing the bug as fixed rather than open. Full existing suite (12 tests) re-run and still passing, confirming the SH-001 ownership fix, `listClassReportCards`, and `generateReportCards` are unaffected.

**Performance**: two sequential queries instead of one, but `findReportCardWithSubjects` is only ever called for a single learner/term pair (never inside a loop over multiple learners — confirmed via `grep` over all callers), so this is not an N+1 pattern and adds negligible latency (one extra indexed lookup on `term_subject_summaries(learner_id, term_id)`, both columns already indexed).

**Architectural documents referenced**: none — no canonical-domain, identity, or Constitution/RAS question involved; a data-access bug fix in an already-approved table shape.

**ADR**: None.

**Rollback considerations**: single-file repository change plus two test files; `git checkout -- lib/repositories/school.repository.ts` fully reverts the behavior (back to the always-null bug) with no data or schema impact.

---

## 2026-07-15 — Sprint 1B, Batch A: Core Route Migration

**What changed**: migrated all 11 routes under `app/api/core/**` (classes, assessments, reports, learners, learners/[id], academic-years, promotions, transfers, school, school/end-of-term, subjects) from inline `auth.getUser()` + ad hoc role-array checks onto Sprint 1A's canonical `lib/core/permissions.ts` functions (`requireSchoolMembership`, `requireSchoolAdmin`, `requireClassTeacher` indirectly via `canManageAssessment`, and one new function, `requireSchoolStaff`). Response shapes, status codes, validation, and database writes are unchanged for every route except the two routes the sprint explicitly targeted for a security fix.

**Two Stage 0 security gaps closed**: `app/api/core/assessments`' `save-scores`/`compute`/create actions previously checked only school membership (any active `school_users` row, any role, could save assessment scores school-wide) — now gated by `canManageAssessment` (admin-tier or the assessment's own class teacher). `app/api/core/reports`' `update` action previously checked only membership, inconsistent with its sibling `publish`/generate actions in the same file — now consistently admin-gated via `canEditReport`, conservatively defaulting to admin-only rather than guessing at the still-open "admin-or-class-teacher" product decision flagged in the Phase A Execution Plan.

**One new finding, deliberately not fixed this sprint**: `app/api/core/school`'s PATCH handler uses a narrower role set (`['school_admin', 'headteacher']`, excluding `deputy_headteacher`) than every other admin-gated route in this batch. Preserved exactly, per "business logic must remain IDENTICAL" — this sprint's scope was limited to the two named gaps, not a general admin-role audit. Flagged in the route's own code comment and here for a future sprint.

**One small, justified extension to `lib/core/permissions.ts`**: added `requireSchoolStaff` (admin-tier + `teacher`, excluding `parent`) — `app/api/core/learners/[id]`'s enroll action's existing role set didn't match any Sprint 1A function, and the alternative (leaving a fourth duplicated role array inline) would have violated the sprint's own "never duplicate role arrays" rule.

**Architectural documents referenced**: Reference Architecture Specification §6 (API Standards — one shared authorization check, never per-route); Stage 0 Architectural Census (the two security gaps, now closed); Phase A Execution Plan Stage 1 (the `canEditReport` open decision, resolved conservatively, not arbitrarily).

**ADR**: None — no identity, ownership model, or architecture change; implementation only.

**Tests added**: extended `lib/core/permissions.test.ts` with 10 new tests (`canEditReport` × 3, `requireSchoolStaff` × 3, and 4 genuine cross-school isolation tests using a second synthetic school — the existing suite only tested "no membership anywhere," not "member of a different school," which is the specific case these routes must get right). Suite total: 21 tests in `permissions.test.ts`, 34 across `lib/core/*.test.ts`, all passing against live data, verified zero residual rows.

**Verification method, stated honestly**: typecheck (`tsc --noEmit`) and lint (`eslint`) clean across all 12 changed files; `git diff --stat` confirms only the 11 named Batch A routes were touched, nothing outside scope. Response-contract preservation was verified by careful line-by-line rewrite (not a mechanical diff tool) plus the permission-layer tests above — **full HTTP-level route regression testing (starting the dev server, hitting each route with real requests, asserting byte-identical responses) was not performed**, since no such test infrastructure exists yet in this codebase (the existing test convention calls `lib/` functions directly, not Next.js route handlers over HTTP, and `utils/supabase/server.ts`'s `createClient()` depends on `next/headers`' request-scoped `cookies()`, which isn't available outside a running Next.js request). Flagged as a real gap, not silently claimed as covered.

**Rollback considerations**: each of the 11 routes can be reverted independently (`git checkout -- app/api/core/<route>/route.ts`) with no data/schema impact — the only routes where reverting would *reintroduce* a known security gap are `assessments` and `reports`.

---

## 2026-07-15 — Sprint 1A: Platform Foundation (Identity, Permissions, Context)

**What changed**: built the shared platform infrastructure every future feature depends on — `lib/core/identity.ts` (raw "who is this" resolution), `lib/core/permissions.ts` (all authorization decisions, `require*`/`can*` function families), `lib/core/context.ts` (the composed request context Domain Services should receive), `lib/core/errors.ts` (canonical error hierarchy: `UnauthorizedError`, `ForbiddenError` and its four subclasses, `IdentityResolutionError`), `lib/core/guards.ts` (shared assertion functions). No existing route was modified — this is infrastructure only, per the explicit Sprint 1A scope; route migration is Sprint 1B.

A repository-wide search before writing any code found the duplication this sprint exists to fix: 162 files call `auth.getUser()` independently, 82 re-query `teachers` inline, 89 re-implement student-ownership checks, 49 re-implement teacher-ownership checks, and only 11 routes used the one canonical membership check that already existed. The two authorization gaps found in the Stage 0 census (one sibling route action role-gated, another not) are traced to this root cause: the check was copy-pasted per route instead of shared. `permissions.ts` makes that failure mode structurally impossible going forward.

Two deliberately conservative design decisions, documented in `docs/engineering/platform-services.md`: `requireClassTeacher`/`canManageAssessment` check the de-facto-canonical `teacher_classes` table (not Core's `classes`), per the Evolution Blueprint's usage evidence; `canEditReport` defaults to admin-tier only rather than guessing at the previously-flagged-open "admin-or-class-teacher" product decision.

One gap surfaced and carried forward honestly, not silently worked around: no repository owns `students`/`learner_guardians` reads yet (the RAS's `LearnerRepository` entry currently points at Core's `learners` table). `identity.ts` queries `students`/`learner_guardians` directly via the service client for now, consolidating an existing pattern rather than duplicating it — flagged as the one place to refactor once a `students`-pointed `LearnerRepository` exists.

**Architectural documents referenced**: Reference Architecture Specification §3 (Permissions domain, marked "reserved") and §8 (Security Architecture — the shared authorization function this sprint builds); Canonical Domain Evolution Blueprint §4/§5 (Class evolution direction, reserved `ClassRepository`/`PermissionRepository`); Stage 0 Architectural Census (the two authorization gaps this sprint's design directly addresses); Phase A Execution Plan Stage 1 (the open `canEditReport` product decision).

**ADR**: None — no canonical identity, ownership model, layer, domain, Intelligence boundary, or Constitution/RAS conflict. This fills in two domains the RAS already reserved a place for.

**Tests added**: `lib/core/identity.test.ts` (10 tests), `lib/core/permissions.test.ts` (11 tests), `lib/core/context.test.ts` (3 tests) — 24 total, integration-style against real synthetic rows on the live Supabase project, following the existing `lib/holiday/notify.test.ts` convention. All 24 passing; verified zero residual rows after a full run.

**Rollback considerations**: trivial — five new files, zero existing files modified, nothing imports them yet. Deleting the five `lib/core/*.ts` files and their tests fully reverts this sprint with no data or schema impact.

---

## 2026-07-15 — Phase A: Architecture Planning & Governance Series Complete

**What changed**: no code was written. This entry marks the transition point this log exists to record: Phase A's full planning/audit series concluded — Stage 0 (read-only architectural census), Stage 0.5 (Canonical Identity Resolution), the Canonical Domain Evolution Blueprint, and the Reference Architecture Specification (RAS) were all produced and ratified, alongside the Canonical Domain Registry, Deprecation Registry, and Phase A Execution Plan. The user then declared two standing operating modes: Architecture Guardian mode (assess every canonical-domain request against the ratified architecture before coding) and Phase B Engineering Execution mode (disciplined, small-commit, test-covered implementation of the approved architecture, using a mandatory assessment output format before any implementation work begins).

**Key ratified findings driving all future Phase B work**:
- `students`/`teacher_classes` are the tables that **evolve** to acquire `learners`/`classes`' institutionally-correct fields (`school_id`, `admission_number`, lifecycle status, `academic_year_id`/`stream_id`/`grade_id`) — not the reverse. This reversed the original plan's assumed migration direction, based on real usage evidence (68-vs-3 file references for Learner, 34-vs-1 for Class).
- Two RLS-level cross-tenant security gaps found (`classes`, `assessment_types` tables have unscoped SELECT policies) plus two already-known application-level authorization gaps (`app/api/core/assessments`, `app/api/core/reports`) — all four are Stage 1 candidates, independent of the identity resolution work.
- No dedicated `ClassRepository` or unified `lib/core/permissions.ts` exist yet — both are reserved in the RAS as net-new, not yet built.
- The Learning Evidence/Projection/Intelligence stack (`learner_evidence`, `learner_projections`, `learner_profiles`) is confirmed anchored to `students.id` and must never be re-anchored without proof, per the Ninth Constitutional Law.

**Architectural documents referenced**: all of `docs/architecture/{examination-report-card-system-audit,phase-a-stabilization-plan,phase-a-execution-plan,canonical-domain-registry,deprecation-registry,stage-0-architectural-census,stage-0.5-canonical-identity-resolution,canonical-domain-evolution-blueprint,reference-architecture-specification}.md`.

**ADR**: None — this was the planning phase itself, not a change to an already-ratified architecture.

**Tests added**: None (no code changed).

**Rollback considerations**: None — no code or schema was touched during this entire series; every investigation was read-only.
