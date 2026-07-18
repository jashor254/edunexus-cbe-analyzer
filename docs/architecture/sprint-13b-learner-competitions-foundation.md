# Sprint 13B — Learner Competitions Domain Foundation (Implementation)

Implements ADR-0014 (Approved). Guardian Mode remained active throughout — no deviation from the frozen architecture was needed; every implementation choice below cites the ADR phase it executes.

---

## Phase 1 — Re-Audit Before Writing Code

Re-swept the repository for `competition`/`Competition` and re-read Achievement, Portfolio, Projects, and Blueprint in full before writing any code. Confirmed:

- No `CompetitionRepository`, `lib/learnerCompetitions/`, `learner_competitions` table, or Competition route existed anywhere (`find . -iname "*competition*"` returned only the two Sprint 13A architecture documents).
- No hidden Competition implementation, no duplicated lifecycle.
- Nothing shipped between Sprint 13A and this sprint changed the plan — `git log` showed no intervening commits touching Achievement/Portfolio/Projects/Blueprint; the working tree's only pending changes were Sprint 12AB (Blueprint canonicalization, unrelated) and the 13A documents themselves.
- Re-read `lib/learnerAchievement/`, `lib/learnerPortfolio/`, `lib/learnerProjects/`, `lib/learnerBlueprint/composeBlueprint.ts` in full to confirm ADR-0014's ownership assumptions still hold against real, current code (they did — no drift since the ADR was written).

---

## Phase 2 — Database

`supabase/migrations/20260719090000_learner_competitions.sql` — additive only, applied to the live project after explicit user approval (no destructive operation, no existing table altered except through a new nullable FK — see Phase 8 below).

Four tables, matching ADR-0014 Phase 3 exactly:

- `learner_competitions` — the one main entity. "Competition" and "Competition Entry" are the same row for v1 (ADR-0014 Phase 3: no separate Event catalog). Carries the event's own descriptive facts (name, organizing body, level, category, event date, venue), a nullable `project_id` (Competition → Project reference, ADR-0014 Phase 5), a nullable `mentor_school_user_id`, and the Results/Judging phase output (`position`, `results_summary`, `judges`, `feedback`) as plain columns.
- `competition_members` — team membership, referencing Core `learners.id` directly.
- `competition_media` — link-out media, including certificates (ADR-0014 Phase 3: certificates are media on the Entry, the single copy of record).
- `competition_history` — append-only lifecycle audit trail, mirroring `achievement_verification_history`.

**Deliberately not built** (mission Phase 2: "Do not invent additional tables"): a separate `competition_mentors`, `competition_results`, or `competition_feedback` table. Mentor is a single reference field per ADR-0014 Phase 3 ("not a new identity system, not a new role type"); Position/Results/Judges/Feedback are each a single fact per Entry, not a list, so they are columns — matching the same column-vs-table judgment every sibling domain in this series already makes.

Twelve `status` values, matching ADR-0014 Phase 4 exactly: the nine main-line states (`opportunity`, `registration`, `preparation`, `participation`, `judging`, `results`, `verification`, `published`, `historical`) plus three named terminal branches (`rejected`, `withdrawn`, `revoked`).

---

## Phase 3 — Repository

`lib/repositories/competition.repository.ts` — `CompetitionRepository`, registered in `lib/repositories/index.ts` as `repos.competitions` (with an explicit comment distinguishing it from `repos.achievements`, mirroring the existing `projects`/`projections` naming-distinction comment).

Every mission rule honored:
- **One method, one lifecycle transition.** `register()`, `beginPreparation()`, `beginParticipation()`, `beginJudging()`, `recordResults()`, `queueForVerification()`, `publish()`, `reject()`, `withdraw()`, `revoke()`, `moveToHistorical()` — each a single named method.
- **No generic `update()`.** Only `updateOpportunity()` (field edits, legal only in the earliest state) and `setMentor()` exist as non-status-transition writes.
- **No `delete()`.** No delete method exists at all — the DB trigger is the only enforcement of "delete legal only while `opportunity`," reached (if ever) via Supabase's own `.delete()` client call, never a repository method.
- **No `mutate()`.** Proven by an integration test asserting the method list directly (`competition.integration.test.ts`, "repository behaviour" test).
- **Naming distinct from Projects/Achievement**: `CompetitionRepository`, `competition_*` tables, `CompetitionStatus`/`CompetitionLevel`/`CompetitionCategory` types — no shared identifier with `ProjectRepository`/`AchievementRepository` beyond the identical CRUD shape every sibling repository in this series already uses (this is intentional convergent structure, not a naming collision).

---

## Phase 4 — Domain Service

`lib/learnerCompetitions/competition.ts`. Grepped its own imports to confirm the mission's boundary: it imports only `@/lib/core/permissions` (auth) and `@/lib/repositories` (its own tables) — zero imports of `lib/learnerBlueprint/`, `lib/learnerPortfolio/`, `lib/learnerAchievement/`, `lib/parentExperience/`, or `lib/career/`. The one function Blueprint calls (`getCompetitionsSummary()`) is read *by* Blueprint — Competitions never reads back.

Owns lifecycle only — every transition function does exactly one status change plus its required side-effects (versioning, history row, attribution); none of them compute educational meaning, rank a learner against peers, or generate narrative text.

---

## Phase 5 — Lifecycle

Implemented exactly ADR-0014 Phase 4's states, no more, no fewer. One implementation nuance, not a deviation: **Results → Verification is a real, automatic transition** (ADR-0014 Phase 4: "system-queued... no human actor"), implemented as two repository calls inside one `recordResults()` service function — the row genuinely passes through both `results` and `verification` as stored, auditable statuses (two distinct `competition_history` rows), even though the caller only makes one service call. This is the literal, faithful implementation of "system-queued automatically," not a simplification of it.

Illegal transitions are rejected at the service layer with a clean error before the DB trigger would ever be reached (e.g. `beginPreparation()` throws "Only a registered competition can move to preparation" if called on an `opportunity` row) — proven in the integration test suite for every transition.

---

## Phase 6 — Immutability

All three layers, as the mission required:

1. **Service** — every transition function checks `existing.status` before writing and throws a clean, specific error otherwise.
2. **Repository** — no generic update/delete exists to bypass a check by accident.
3. **Database trigger** — `enforce_competition_immutability()` (mirroring `enforce_achievement_immutability()`/`enforce_learner_project_immutability()` exactly): `rejected`/`withdrawn`/`revoked`/`historical` are fully immutable; `published` allows only `→ historical` or `→ revoked` with every other field frozen via `IS NOT DISTINCT FROM` checks; DELETE is legal only while `status = 'opportunity'`.

**Proven with tests, not just claimed** — the integration suite bypasses the service entirely and issues raw `db.from('learner_competitions').update(...)`/`.delete()` calls directly against a published row, asserting the DB itself rejects them (this is the same "bypass the service, hit the trigger directly" pattern Achievement's own test suite already established as this series' standard proof).

---

## Phase 7 — Blueprint Integration

`lib/learnerBlueprint/composeCompetitions.ts`, wired into `composeBlueprint.ts`/`types.ts`/`validation.ts` following the identical 5-file pattern Sprint 12AA's audit found for every prior domain addition (new composer, `Promise.all` entry, `sections` object key, `LearnerBlueprint` type field, `ALL_SECTIONS` validation entry).

Returns exactly the mission's five fields — `totalCompetitions`, `verifiedCompetitions`, `latestCompetition`, `currentParticipation`, `competitionsUrl` — nothing more. `Object.keys()` assertions in the integration test enforce this shape directly, the same discipline Achievement's own Blueprint test already applies.

- **Never exposes judging or raw feedback**: those fields don't exist anywhere in `CompetitionsData`/`CompetitionHighlight`/`CompetitionsSummary`'s type shape — not filtered out at runtime, structurally absent. Proven by a test asserting the serialized Blueprint section never contains judge/feedback text that was recorded on the underlying row.
- **Never exposes unpublished work**: `totalCompetitions`/`verifiedCompetitions`/`latestCompetition` all read `listPublished()` only. `currentParticipation` is the one field that surfaces something not yet published — matching Projects' own `currentActiveProject` precedent exactly — but it exposes only `{name, level, category}`, never status, position, or any lifecycle detail (`Object.keys()`-asserted in the test).

`verifiedCompetitions` is documented in `types.ts` as deliberately equal to `totalCompetitions` today (publish requires prior verification by construction) — kept as its own named field for the same reason Achievement names `latestVerifiedAchievement` explicitly, not collapsed into one field.

---

## Phase 8 — Achievement Relationship

**Known Gap, deliberately deferred — not a shortcut, a scope decision.** ADR-0014 Phase 3 froze "Achievement references Competition, going forward" as the eventual design. This sprint's own mission explicitly forbids modifying Achievement's schema, lifecycle, or architecture ("Only implement the agreed reference point"). Reading those two instructions together: the correct implementation this sprint is **not** an `ALTER TABLE learner_achievements ADD COLUMN competition_id`, because that is a schema change to Achievement, however small.

What was actually implemented, satisfying "Competition may expose competitionId for Achievement to reference later" literally: `learner_competitions.id` is a real, stable UUID primary key, and `Competition`'s own domain type carries `id` as its first field — nothing further is needed for a *future*, Achievement-domain-led migration to add the reference column and start populating it. This mirrors ADR-0013's own identical deferral of "how Projects' Competition-verified field evolves" to a future Projects-led decision — the same discipline, applied symmetrically to Achievement here.

The regression test suite (Phase 11) explicitly proves Achievement's schema and behavior are completely unaffected by this sprint.

---

## Phase 9 — Portfolio Relationship

Same reasoning as Phase 8, for the identical reason plus one more: Portfolio's own category taxonomy (`projects`, `creative_work`, `research`, `presentations`, `writing`, `design`, `photography`, `programming`, `media`, `other`) has **no `competitions` category at all** — it was permanently reassigned to Achievement by ADR-0012, and Portfolio's `types.ts` header comment states this "deliberately excludes" list by name. There is no existing Portfolio slot a `competition_id` link column would attach to. No column was added to `portfolio_items`; no code in `lib/learnerPortfolio/` was touched.

Portfolio's compose-only relationship to Competitions is satisfied the same way it already reads Achievement's summary — Competitions exposes `getCompetitionsSummary()`, a future Portfolio feature could read it, and Competitions never reads Portfolio (verified: zero imports of `lib/learnerPortfolio/` anywhere in `lib/learnerCompetitions/`).

---

## Phase 10 — Security

`requireSchoolStaff` on every write path, with zero custom permission logic — the identical call Achievement/Projects/Portfolio each use, in the same position (first line of every mutating function). RLS policies on all four new tables are structurally identical to `learner_achievements`'/`learner_projects`' own policies (school-staff-read only, no write policy for the `authenticated` role — every write goes through the service-role client). No weaker, no stronger.

---

## Phase 11 — Tests

`lib/learnerCompetitions/competition.integration.test.ts` — 12 tests against real synthetic Supabase data:

1. Full lifecycle (all nine main-line states) with versioning, full history-order assertion, and DB-trigger-bypass immutability proof on both a published and a historical row.
2. Withdrawn terminal branch — reachable only from Registration/Preparation/Participation, rejected once Judging begins.
3. Rejected terminal branch — reachable only from Verification.
4. Revoked terminal branch — reachable only from Published, removes the entry from `listPublished()`/the Blueprint summary immediately.
5. Canonical level/category enforcement (rejects non-canonical values).
6. Blueprint composition — unavailable-for-zero, `currentParticipation` for an in-flight entry with an `Object.keys()`-asserted narrow shape, `totalCompetitions` never counting unpublished work, judging/feedback text asserted absent from the serialized section.
7. Relationship invariant — a Competition referencing a Project leaves the Project's own row completely untouched (re-read after linking, still `draft`, unmodified).
8. Team membership — references Core learner IDs, no duplicated identity data.
9. Cross-school isolation.
10. Permission checks (outsider rejection).
11. Repository behaviour — asserts no `update`/`delete`/`mutate` method exists on `CompetitionRepository` by reflecting over its prototype.

**Regression test (mission's explicit Phase 11 requirement)** — one test creates a real Achievement, a real Portfolio item, and a real Project in the same fixture as a Competition, drives each through its own normal lifecycle, and asserts all three summaries and `composeBlueprint()`'s full output are correct and mutually undisturbed — proving Portfolio, Achievement, Projects, and the rest of Blueprint are unaffected by this domain's addition, not merely unchanged in the diff.

All 12 tests pass. The full existing `lib/**/*.pure.test.ts` suite (34 tests) and the Sprint 12AB architecture test (4 tests) were re-run and pass unaffected — two Blueprint test fixtures (`composeBlueprint.pure.test.ts`, `growthTimeline.pure.test.ts`) required the same one-line `competitions: na(...)` addition every prior domain's fixture required, per the exhaustive-type discipline Sprint 12AA's audit already documented as the expected, correct signal of a closed `LearnerBlueprint` type.

---

## Phase 12 — Documentation

This document and the implementation-log entry. No other files.

---

## Verification Checklist

- [x] `tsc --noEmit` clean
- [x] `eslint` clean (0 errors on all new/changed files)
- [x] Tests pass (11 integration + 34 pre-existing pure + 4 architecture)
- [x] Migration applied only after explicit user approval
- [x] Repository has no generic `update()`/`delete()`/`mutate()` — proven by test
- [x] Published rows immutable — Service, Repository, DB trigger, all three, proven against raw DB access
- [x] Blueprint returns summary only — five named fields, `Object.keys()`-asserted, no judging/feedback anywhere in the type
- [x] Portfolio unchanged — zero files touched, regression test proves it still works
- [x] Achievement unchanged — zero files touched, regression test proves it still works
- [x] Projects unchanged — zero files touched (Competition→Project reference lives entirely on Competition's own table), regression test proves the referenced Project row is untouched
- [x] Constitution compliant — Position/Results are recorded fact, never computed; no AI anywhere in this module; teacher/staff accountable for every transition
- [x] RAS compliant — single ownership per ADR-0014 Phase 3, no second calculation, reference-not-copy discipline throughout

---

## Known Gaps, Named Rather Than Hidden

- Achievement's `competition_id` reference column and Portfolio's read-surface for Competitions are both deliberately deferred (Phase 8/9 above) — not built this sprint, named as future, domain-owner-led work.
- `moveToHistorical()` exists and is tested but nothing calls it automatically on a time-based schedule — no cron was wired (Stop Condition: no notifications/dashboards).
- No UI, no certificate upload, no QR, no event catalog, no judge portal, no parent portal integration, no analytics, no rankings, no AI recommendations — all explicitly forbidden by the Stop Condition, none built.

**Sprint 13B is complete. Per the STOP CONDITION, Sprint 13C was not started — waiting for explicit approval.**
