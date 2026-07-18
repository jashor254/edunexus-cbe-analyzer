# Sprint 13D — Learner Leadership Foundation (Implementation)

Implements ADR-0015 (Approved). Guardian Mode remained active throughout — no deviation from the frozen architecture was needed; every implementation choice below cites the ADR phase it executes.

---

## Phase 1 — Re-Audit Before Writing Code

Re-swept the repository for `leadership`/`Leadership`/`prefect`/`captain`/`council` and re-read Achievement/Portfolio/Projects/Competitions/Blueprint in full before writing any code. Confirmed:

- No `LeadershipRepository`, `lib/learnerLeadership/`, `learner_leadership` table, or Leadership route existed anywhere (`find . -iname "*leadership*"` returned only the two Sprint 13C architecture documents).
- No hidden Leadership implementation, no duplicated lifecycle, no competing repository.
- Nothing shipped between Sprint 13C and this sprint changed the plan — no intervening commits touched Achievement/Portfolio/Projects/Competitions/Blueprint.
- Re-read `lib/learnerAchievement/`, `lib/learnerPortfolio/`, `lib/learnerProjects/`, `lib/learnerCompetitions/`, `lib/learnerBlueprint/composeBlueprint.ts` in full to confirm ADR-0015's ownership assumptions still hold against real, current code (they did — no drift since the ADR was written).

---

## Phase 2 — Schema

`supabase/migrations/20260720090000_learner_leadership.sql` — additive only, applied to the live project after explicit user approval. Two tables, matching ADR-0015 Phase 3 exactly:

- `learner_leadership` — the one main entity. Carries the Position's own descriptive facts (title, scope, body/council, responsibilities), an `is_acting` flag (Acting Appointments, Phase 3 — no second lifecycle), `mentor_school_user_id`, and the Review/Completion phase output (`review_notes`, `completed_notes`) as plain columns. `reflection` is a dedicated column explicitly scoped to this domain (ADR-0015 Phase 3: "explicitly distinct from the... Teacher Reflection domain").
- `leadership_history` — append-only lifecycle audit trail, mirroring `competition_history`/`achievement_verification_history`.

**Deliberately not built** (mirroring Sprint 13B's identical restraint): a separate Position/title catalog, election/voting table, media table, or disciplinary-record table. Leadership's own ownership matrix (ADR-0015 Phase 3) names no multi-valued list beyond history, so two tables is the complete, correct set — no invented additional tables.

Twelve `status` values, matching ADR-0015 Phase 4 exactly: the eight main-line states (`nomination`, `selection`, `active_service`, `review`, `completion`, `verification`, `published`, `historical`) plus four named terminal branches (`not_selected`, `discontinued`, `rejected`, `revoked`).

Preserved, not redesigned: evidence-first (`supporting_evidence_ids uuid[]`, reference-only, identical to every sibling domain), immutable publication (three-layer discipline, Phase 7 below), append-only history (`leadership_history` triggers reject UPDATE/DELETE unconditionally), school ownership (`school_id` FK + RLS), learner ownership (`learner_id` FK to Core `learners`).

---

## Phase 3 — Repository

`lib/repositories/leadership.repository.ts` — `LeadershipRepository`, registered in `lib/repositories/index.ts` as `repos.leadership` (with an explicit comment distinguishing it from `repos.achievements`, mirroring the existing `competitions`/`achievements` distinction comment).

- **One repository.** `LeadershipRepository`, one file, owns `learner_leadership` and `leadership_history` exclusively.
- **Lifecycle methods only.** `select()`, `markNotSelected()`, `beginActiveService()`, `review()`, `discontinue()`, `complete()`, `queueForVerification()`, `publish()`, `reject()`, `revoke()`, `moveToHistorical()` — each a single named method for a single transition.
- **No generic `update()`.** Only `updateNomination()` (legal only in the earliest state), `setMentor()`, and `setReflection()` exist as non-status-transition writes — each a narrowly-scoped, named field update, not a general-purpose mutator.
- **No `delete()`.** No delete method exists at all — the DB trigger is the only enforcement of "delete legal only while `nomination`."
- **No `mutate()`.** Proven by an integration test reflecting over the repository's own prototype.
- **Published records immutable.** Enforced identically to Achievement/Projects/Competitions (Phase 7).

---

## Phase 4 — Domain Service

`lib/learnerLeadership/leadership.ts`. Grepped its own imports to confirm the mission's boundary: it imports only `@/lib/core/permissions` (auth) and `@/lib/repositories` (its own tables) — zero imports of `lib/learnerBlueprint/`, `lib/learnerPortfolio/`, `lib/learnerAchievement/`, or `lib/career/`. The one function Blueprint calls (`getLeadershipSummary()`) is read *by* Blueprint — Leadership never reads back.

Owns lifecycle orchestration only — no educational meaning is computed anywhere; "Discontinued" always carries a caller-supplied, neutral, free-text reason and nothing else (no disciplinary-case field exists on the row at all, per ADR-0015 Phase 2/11).

---

## Phase 5 — Lifecycle

Implemented exactly ADR-0015 Phase 4's twelve states, no more, no fewer:

- Main line: Nomination → Selection → Active Service → Review → Completion → Verification → Published → Historical.
- Terminal branches: Not Selected (from Nomination), Discontinued (from Active Service or Review), Rejected (from Verification), Revoked (from Published).

Completion → Verification is implemented as a real, automatic transition (ADR-0015 Phase 4: "system-queued automatically"), the identical pattern Sprint 13B already established for Competitions' Results → Verification — a distinct `queueForVerification()` repository call and its own `leadership_history` row, callable directly from the service (not silently folded into `complete()` or `publish()`).

Illegal transitions are rejected at the service layer with a clean, specific error before the DB trigger would ever be reached — proven in the integration test suite for every transition (e.g. attempting `beginActiveService()` on a `nomination` row, attempting `markNotSelected()` on a `selection` row).

---

## Phase 6 — Blueprint Integration

`lib/learnerBlueprint/composeLeadership.ts`, wired into `composeBlueprint.ts`/`types.ts`/`validation.ts` via the identical 5-file pattern this whole series now uses for every domain addition.

Returns exactly the mission's four fields — `currentRole` (`{title, scope}` only, from an in-progress Selection/Active Service/Review entry), `completedRoleCount`, `latestCompletedRole`, `leadershipUrl` — nothing more. `Object.keys()` assertions in the integration test enforce this shape directly.

**Never exposes**: review notes, election data, meeting history, mentor comments, or disciplinary information — none of these fields exist anywhere in `LeadershipData`/`LeadershipHighlight`/`LeadershipSummary`'s type shape, structurally absent rather than filtered at runtime. A test asserts the serialized Blueprint section never contains review-note text that was recorded on the underlying row.

Blueprint remains compose-only: `composeBlueprint.ts` was extended by exactly one new composer call, no existing composer's logic was touched.

---

## Phase 7 — Immutability

All three layers, as the mission required:

1. **Service** — every transition function checks `existing.status` before writing and throws a clean, specific error otherwise.
2. **Repository** — no generic update/delete exists to bypass a check by accident.
3. **Database trigger** — `enforce_leadership_immutability()` (mirroring `enforce_competition_immutability()` exactly): `not_selected`/`discontinued`/`rejected`/`revoked`/`historical` are fully immutable; `published` allows only `→ historical` or `→ revoked` with every other field frozen via `IS NOT DISTINCT FROM` checks; DELETE is legal only while `status = 'nomination'`.

**UPDATE and DELETE rejection after publication verified with tests, not just claimed** — the integration suite bypasses the service entirely and issues raw `db.from('learner_leadership').update(...)`/`.delete()` calls directly against a published row, asserting the DB itself rejects them, then repeats the same raw-UPDATE proof against the row once moved to `historical`.

---

## Phase 8 — Tests

`lib/learnerLeadership/leadership.integration.test.ts` — 12 tests against real synthetic Supabase data, all passing:

1. Full lifecycle (all eight main-line states) with versioning, full history-order assertion, and DB-trigger-bypass immutability proof on both a published and a historical row.
2. Not Selected terminal branch — reachable only from Nomination.
3. Discontinued terminal branch — reachable from Active Service or Review, asserts the row carries only a neutral reason string with no disciplinary-case field anywhere on it.
4. Rejected terminal branch — reachable only from Verification.
5. Revoked terminal branch — reachable only from Published, removes the entry from `listPublished()`/the Blueprint summary immediately.
6. Evidence references — reference-only, an empty list is a valid, honest state, never fabricated.
7. Blueprint composition — unavailable-for-zero, `currentRole` for an in-progress entry with an `Object.keys()`-asserted narrow shape, `completedRoleCount` never counting an in-progress role, review-note text asserted absent from the serialized section.
8. Leadership Reflection — scoped to this domain only, distinct from Teacher Reflection.
9. Cross-school isolation.
10. Permission checks (outsider rejection).
11. Repository behaviour — asserts no `update`/`delete`/`mutate` method exists on `LeadershipRepository` by reflecting over its prototype.
12. **Regression (mission's explicit Phase 8 requirement)** — creates a real Achievement, Portfolio item, Project, and Competition in the same fixture as a Leadership entry, drives each through its own normal lifecycle, and asserts all four summaries plus `composeBlueprint()`'s full output are correct and mutually undisturbed.

All 12 tests pass. The full existing `lib/**/*.pure.test.ts` suite (34 tests) and the Sprint 12AB architecture test (4 tests) were re-run and pass unaffected — the same two Blueprint test fixtures (`composeBlueprint.pure.test.ts`, `growthTimeline.pure.test.ts`) required the same one-line `leadership: na(...)` addition every prior domain's fixture required.

---

## Phase 9 — Documentation

This document and the implementation-log entry. No other files.

---

## Verification Checklist

- [x] Migration applied only after explicit user approval
- [x] `tsc --noEmit` clean
- [x] `eslint` clean (0 errors on all new/changed files)
- [x] All existing regression suites pass (34 pure tests + 4 architecture tests)
- [x] New Leadership tests pass (12/12)
- [x] Blueprint unaffected except one composed section (`composeLeadership()` added; no existing composer's logic touched)
- [x] Portfolio unchanged — zero files touched, regression test proves it still works
- [x] Achievement unchanged — zero files touched, regression test proves it still works
- [x] Projects unchanged — zero files touched, regression test proves it still works
- [x] Competitions unchanged — zero files touched, regression test proves it still works
- [x] Constitution compliant — completed service is recorded fact, never computed; no AI, no election, no vote tally anywhere in this module; teacher/staff accountable for every transition
- [x] RAS compliant — single ownership per ADR-0015 Phase 3, no second calculation, reference-not-copy discipline throughout

---

## Known Gaps, Named Rather Than Hidden

- Achievement's `leadership_id` reference column and Portfolio's read-surface for Leadership are both deliberately deferred (identical reasoning to Sprint 13B's Competitions↔Achievement/Portfolio deferrals) — not built this sprint, named as future, domain-owner-led work.
- `moveToHistorical()` exists and is tested but nothing calls it automatically on a time-based schedule — no cron was wired (Stop Condition).
- No UI, no Position/title catalog, no election/voting, no leaderboards, no analytics, no reports, no parent/teacher/student UI, no notifications, no messaging, no certificates, no AI summaries — all explicitly forbidden by the Stop Condition, none built.

**Sprint 13D is complete. Per the STOP CONDITION, Sprint 13E was not started — waiting for explicit approval.**
