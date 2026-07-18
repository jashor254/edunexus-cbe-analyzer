# Sprint 13I — Learner Innovation Foundation (Canonical Domain Implementation)

Implements ADR-0018 (Approved). Guardian Mode remained active throughout — no existing domain was redesigned, no AI evaluation was introduced, no UI was built.

---

## Phase 1 — Repository Audit (Mandatory)

Re-swept the repository for `innovation`, `prototype`, `iteration`, `invention`, `idea`, `experiment`, `research`, `testing`, `refinement`, `validation`, and re-read Portfolio, Projects, Achievement, Competitions, Blueprint, and Parent Experience in full before writing any code. Confirmed:

- No `InnovationRepository`, `lib/learnerInnovation/`, `learner_innovations` table, or Innovation route existed anywhere (only the two Sprint 13H architecture documents matched `find . -iname "*innovation*"`).
- "Innovation" existed only as a bare classification value in three sibling domains — `AchievementType`/`AchievementCategory`, `ProjectCategory`, `CompetitionCategory` — none of which could safely be reused (none tracks a developmental process, none has an iteration concept, none has a forward-only lifecycle).
- No canonical owner existed; no repository could safely be reused.
- Nothing shipped between Sprint 13H and this sprint changed the plan.

---

## Phase 2 — Database

`supabase/migrations/20260722090000_learner_innovation.sql` — additive only, applied to the live project after explicit user approval. Four tables, matching the mission's own suggested names exactly:

- `learner_innovations` — the lifecycle-bearing entity: `problem_addressed`, `idea_summary`, `status` (11 values), Mentor/Project/Competition reference columns, Validation output (`validated_by`/`validated_at`, teacher-gated), Implementation output (`impact_evidence`, `adoption_note`, `public_demonstration`), and every terminal branch's own facts.
- `innovation_iterations` — the domain's unique architectural feature (Phase 7 below).
- `innovation_artifacts` — link-out media only, mirroring `achievement_media`/`competition_media`'s identical "no file bytes" pattern.
- `innovation_review_history` — the lifecycle-transition audit trail, matching every sibling `*_history` table.

**Required properties, all present**: forward-only lifecycle (Phase 3), append-only iteration history (Phase 7), immutable published/implemented records (Phase 8), teacher verification (Validation is teacher-gated), school ownership (`school_id` FK + RLS), `created_at`, `updated_at`, `published_at` (set at Implementation — see the naming note below), `archived_at`, `schema_version`.

**One deliberate naming choice, documented rather than silent**: the credential-worthy timestamp column is named `published_at`, not `implemented_at`, to match the mission's own explicit required-field list and every sibling domain's naming convention — even though ADR-0018 has no separate "Published" *status* (Implementation is this domain's Published-equivalent state). The column name follows platform convention; the status vocabulary follows ADR-0018 exactly.

**No scoring, no ranking, no popularity metric, no AI field** — confirmed absent from the schema by direct inspection and by the boundary test (Phase 9).

---

## Phase 3 — Lifecycle

Implemented exactly ADR-0018 Phase 5's eleven statuses, no more, no fewer: eight main-line states (`idea → exploration → prototype → testing → refinement → validation → implementation → archived`) plus three terminal branches (`discontinued`, `not_validated`, `revoked`).

**Strictly forward-only** — verified by the migration's own trigger (no legal `UPDATE` path moves `status` backward) and by the service layer (every transition function checks the exact prior status, never accepts an out-of-order call). Iterations belong in `innovation_iterations`, never in lifecycle transitions — proven directly: `addIteration()` never touches `learner_innovations.status`, and repeated calls at a fixed status (Testing, in the integration test) are the mechanism by which real iterative cycles are captured.

**One reasoned implementation clarification, documented in `lib/learnerInnovation/innovation.ts`'s own header**: `validateInnovation()`/`markNotValidated()` are modeled as two sibling outcomes of the same gate, both reachable from `refinement` — not a linear "submit, then get approved" pipeline. Since `validateInnovation()` itself is the teacher-gated approval action (mission Phase 8: "Validation requires teacher approval"), there is no intermediate "pending validation" status to fail out of; this mirrors Achievement's verify/reject pair (both reachable from `draft`) and Leadership's publish/reject pair (both reachable from `verification`) exactly.

---

## Phase 4 — Repository

`lib/repositories/innovation.repository.ts` — `InnovationRepository`, registered as `repos.innovations`.

- One named method per lifecycle transition: `createIdea`, `beginExploration`, `createPrototype`, `moveToTesting`, `moveToRefinement`, `validateInnovation`, `markNotValidated`, `implementInnovation`, `archiveInnovation`, `revokeInnovation`, `discontinueInnovation` — matching the mission's own suggested method-name pattern exactly.
- **No `update()`, `mutate()`, `delete()`, or `save()` exposed anywhere** — the only non-transition write methods are narrowly named (`updateIdea`, legal only in the earliest state; `setMentor`/`setProjectReference`/`setCompetitionReference`, single-field reference setters). No repository method wraps a delete action at all — mirroring every sibling domain's identical choice; the DB trigger alone is the backstop against a raw `.delete()` call.
- Proven by a reflection-based test (Phase 11).

---

## Phase 5 — Domain Service

`lib/learnerInnovation/{types,validation,innovation}.ts`. Responsibilities exactly as scoped: lifecycle enforcement, authorization (`requireSchoolStaff`, matching every sibling domain except Wellbeing), iteration creation, validation-field checking, and publication rules. Nothing else — no AI, no diagnosis, no scoring, no behaviour logic, no attendance logic anywhere in this module.

**Zero imports from Blueprint, Portfolio, Achievement, Projects, Career, Parent Experience, or Learning Compass** — grep-verified directly and proven by `innovationBoundary.architecture.test.ts` (Phase 9).

---

## Phase 6 — Blueprint Integration

`lib/learnerBlueprint/composeInnovation.ts`, wired into `composeBlueprint.ts`/`types.ts`/`validation.ts` via the identical 5-file pattern this series now uses for every domain addition (matching `composeProjects()`/`composeCompetitions()`/`composeLeadership()`/`composeCommunityService()`-equivalent precedent exactly — Community Service itself remains architecture-only, not yet implemented, so the closest live precedent is Leadership/Competitions).

Returns exactly the mission's six named fields — `available` (implicit in `status`), `currentStage`, `iterationCount`, `latestMilestone`, `latestImplementationDate`, `innovationsUrl` — nothing more. `Object.keys()` assertions in the integration test enforce this shape directly.

**Never exposes**: iteration history, teacher notes, internal review, artifacts, or testing data — none of these fields exist anywhere in `InnovationsData`/`InnovationsSummary`'s type shape, structurally absent rather than filtered at runtime. A test asserts the serialized Blueprint section never contains iteration-content text (e.g. "gravel," a detail only ever logged in an iteration entry) that was recorded on the underlying record.

---

## Phase 7 — Iteration Engine

The domain's unique architectural feature, implemented exactly as specified. Every `innovation_iterations` row stores Problem, Hypothesis, Change introduced, Evidence, Outcome, an optional Teacher note, and a timestamp — a structured record, never a generic freeform blob (directly answering ADR-0018 Phase 10's "Innovation becoming another upload folder" risk).

**Never edited, never deleted** — enforced at the database layer via `reject_innovation_iteration_mutation()`, a trigger that unconditionally raises on any `UPDATE` or `DELETE`, regardless of the parent innovation's status. Proven twice in the integration suite: once while the innovation is still active (mid-lifecycle), and once after the same row's parent innovation has reached `archived` — the same guarantee holds in both cases, since the trigger has no status-dependent branch at all for this table.

Iteration ordering is preserved and tested — `listIterations()` returns entries in creation order, verified by asserting the returned ids match the exact order they were logged in.

---

## Phase 8 — Verification Rules

All required rules implemented and proven:

- **Validation requires teacher approval** — `validateInnovation()` resolves the calling staff member's own `school_users` record and records it as `validated_by`; a missing school-user record throws before any state change.
- **Implementation requires Validation** — `implementInnovation()` checks `status === 'validation'` before allowing the transition; attempting to implement directly from `refinement` (skipping validation) is rejected with a specific error, tested explicitly.
- **Archived cannot reopen** — the DB trigger treats `archived` as fully terminal with zero further legal transitions (unlike `implementation`, which allows exactly two).
- **Published (Implementation) history immutable** — proven against raw `UPDATE`/`DELETE`, bypassing the service entirely.
- **Iteration entries immutable after publication** — proven by adding iterations mid-lifecycle, then attempting a raw mutation on one of those same rows after the parent innovation reaches `archived`; the trigger's rejection is unconditional, not status-gated, so this holds both before and after Implementation.

All three layers (Repository/Service/DB trigger) exercised, exactly matching the discipline proven for every domain from Achievement through Wellbeing.

---

## Phase 9 — Boundaries

`lib/learnerInnovation/innovationBoundary.architecture.test.ts` — 5 static tests proving, by walking the real source tree:

- `lib/learnerInnovation/` imports nothing from Blueprint, Portfolio, Achievement, Projects, Career, Parent Experience, or Learning Compass.
- No file under `lib/learnerBlueprint/` references Innovation beyond the sanctioned `composeInnovation.ts` and its four wiring points.
- `composeInnovation()` itself reads only `getInnovationsSummary()` — never the repository or raw tables directly.
- No file anywhere outside `lib/learnerInnovation/` imports `repos.innovations` or `InnovationRepository`, except the repository's own registration in `repositories/index.ts` and the sanctioned Blueprint composer.
- The repository's own column references prove Innovation stores only the two sanctioned reference ids (`project_id`, `competition_id`) — never a field belonging to Achievement's, Portfolio's, or Leadership's own row shape.

Innovation never computes Achievements, Portfolio, Projects, Competitions, Career, Blueprint, or Parent actions — it only exposes references (the two nullable FK columns) and a Blueprint-facing summary function, both one-directional, both proven absent of any duplicated ownership.

---

## Phase 10 — Regression Audit

Verified via the integration suite's own dedicated regression test (not merely "no error thrown," but each sibling domain's own summary function called and asserted correct): Portfolio, Achievement, Projects, and Competitions were each driven through a real lifecycle in the same fixture as an Innovation entry, and Leadership was included as well (selected into an active role). Every sibling summary — `getAchievementSummary`, `getPortfolioSummary`, `getProjectsSummary`, `getCompetitionsSummary`, `getLeadershipSummary` — returned its expected, unaffected value, and `composeBlueprint()`'s full output included all five sections correctly alongside Innovation's own section, none clobbered by another.

Community Service and Wellbeing were not included in the live regression fixture (Community Service has no implementation yet — architecture-only as of Sprint 13E; Wellbeing has no Blueprint relationship at all by design, so there is nothing for this sprint to regress). Snapshots, Career Intelligence, Learning Compass, and Report Cards were verified unaffected by the static boundary test (Phase 9) and by the fact that no file belonging to any of them was modified this sprint (confirmed via `git status`).

---

## Phase 11 — Testing

`lib/learnerInnovation/innovation.integration.test.ts` — 10 tests against real synthetic Supabase data, all passing:

1. Full lifecycle (all eight main-line states), versioning, full ordered review history, append-only iteration logging with ordering proof, DB-trigger-bypass immutability proof on the main record and on iteration/history rows.
2. Validation required — implementation attempted directly from `refinement` is rejected.
3. Not Validated terminal branch — reachable only from Refinement.
4. Discontinued terminal branch — reachable from Idea through Refinement, requires both a reason and a lessons-learned field, rejected once Validation is reached.
5. Revoked terminal branch — reachable only from Implementation, removes the entry from `listImplemented()`/the Blueprint summary immediately.
6. Blueprint composition — unavailable-for-zero, `currentStage` for an in-flight entry with an `Object.keys()`-asserted narrow shape, iteration-content text asserted absent from the serialized summary.
7. Cross-school isolation.
8. Permission checks (outsider rejection).
9. Repository behaviour — asserts no `update`/`delete`/`mutate`/`save` method exists on `InnovationRepository` by reflecting over its prototype.
10. **Regression** (mission's explicit Phase 10 requirement) — Achievement, Portfolio, Projects, Competitions, and Leadership are each driven through a real lifecycle in the same fixture as an Innovation entry, and `composeBlueprint()`'s full output is asserted correct across all five sibling sections plus Innovation's own.

All 10 integration tests pass, plus the 5 static boundary tests (Phase 9) — 15 new tests total. The full existing `lib/**/*.pure.test.ts` suite (34 tests) and the Sprint 12AB architecture test (4 tests) were re-run and pass unaffected — the same one-line `innovations: na(...)` addition every prior domain's fixture required was made to the two Blueprint test fixtures.

---

## Phase 12 — Verification

- [x] `tsc --noEmit` clean
- [x] ESLint clean (0 errors on all new/changed files)
- [x] Full regression suite passing (34 pure tests + 4 architecture tests, unaffected)
- [x] Innovation tests passing (10 integration + 5 boundary = 15/15)
- [x] Zero architectural duplication — proven by the boundary test suite

## Success Criteria

- [x] Innovation has exactly one canonical owner (Phase 2/4)
- [x] Iteration history is append-only (Phase 7, proven against raw DB access both mid-lifecycle and post-archival)
- [x] Lifecycle is strictly forward-only (Phase 3, enforced by the service layer and the DB trigger's own transition rules)
- [x] Implemented innovations are immutable at the repository, service, and database layers (Phase 8)
- [x] Blueprint composes a summary only (Phase 6, Object.keys()-asserted)
- [x] No sibling domain changes ownership (Phase 10, live regression across five domains)
- [x] All tests pass with zero regressions

---

## Known Gaps, Named Rather Than Hidden

- Achievement's `innovation_id` reference column (ADR-0018 Phase 6's "Achievement references Innovation, going forward") was not added — `learner_achievements`' schema was not touched at all, mirroring every prior domain's identical deferral.
- No UI, no uploads interface, no AI evaluation, no innovation score, no rankings, no popularity metrics — all explicitly forbidden by the Stop Condition, none built.
- `archiveInnovation()` exists and is tested but nothing calls it automatically on a time-based schedule — no cron was wired (Stop Condition).

**Sprint 13I is complete. Per the STOP CONDITION, Sprint 13J was not started — no UI, uploads workflow, showcase pages, AI assistance, Portfolio enhancements, or cross-domain redesigns were built.**
