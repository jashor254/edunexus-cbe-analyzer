# Sprint 12Z — Learner Projects Domain Foundation (Canonical Implementation)

The first implementation sprint of ADR-0013. Guardian Architect role: optimized for architectural correctness over speed throughout.

---

## Phase 1 — Mandatory Audit (done first)

Re-verified ADR-0013's own Phase 1 audit against the current repo state (Sprint 12Y had landed since it was written — a genuine re-check, not a rubber stamp), plus the mission's own specific instruction to read Portfolio's implementation in full:

- **`lib/learnerPortfolio/`, `composePortfolio()`, `portfolio_items`, `category="projects"`** — read in full. Confirmed exactly what ADR-0013 Phase 1 already found: a raw artefact label, no goal/lifecycle/team/mentor/verification, `project_id` column did not exist before this sprint.
- **`Project`, `Projects`, `project`, `group_project`, `team`, `mentor`, `innovation`, `capstone`** — no canonical domain, table, or module found. `mentor` hits are all static career-advice prose (`careerEngine.ts`, `seedCareers.ts`, `clinicReportBuilder.ts`, `lib/learnerIntelligence/blueprint.ts`'s own recommendation-text string) — none a data concept.
- **`portfolio_items.category`, `project_id`** — confirmed `project_id` did not exist on `portfolio_items` before this sprint's own migration.
- **`assignment`, `assignment_submission`** — re-read; still legacy scored classwork (Sprint 12W's own audit conclusion re-confirmed), untouched.
- **`competition`, `innovation`** — no table; `innovation` exists only as a Project *category* value (this sprint) and, separately, as an Achievement Phase 2 sub-type (ADR-0012) — two different domains legitimately using the same English word for two different concepts, exactly as ADR-0013 Phase 4 already anticipated and distinguished.

**No canonical Projects domain existed. Proceeded to build — did not duplicate anything.**

---

## Architectural Goal — Satisfied

Projects now owns: lifecycle, metadata (title/description/goal/category/dates), mentors, teams, progress (via `project_updates`), evidence links (`supporting_evidence_ids`, reference-only), verification, publication. It does not own, and no code added this sprint touches: Achievements, Portfolio's own curation, Blueprint, Evidence's own rows, Career, Report Cards, Compass, Attendance.

---

## Phase 2 — Database

`supabase/migrations/20260718100000_learner_projects.sql` — **applied only after explicit user approval**, per this sprint's own verification checklist (a deliberate departure from Sprints 12V/12W's practice, followed exactly as instructed).

Five tables: `learner_projects` (the work itself — ADR-0013 Phase 5's frozen ten-state lifecycle, Phase 4's frozen sixteen-category enum, Phase 6's six verification types), `project_members` (team), `project_mentors` (a named supporting adult, explicitly distinct from Verifier), `project_updates` (the progress log), `project_artifacts` (link-out only, no file bytes). Plus one additive column on an existing table: `portfolio_items.project_id` (nullable FK), executing ADR-0013's own frozen "Relationship to ADR-0011" resolution.

Immutability: the identical three-layer pattern (repository/service/DB trigger) already proven for Report Cards, Teacher Reflections, Blueprint Snapshots, Portfolio, and Achievement — `rejected`/`cancelled`/`archived` fully terminal, `published` permitting only the one named transition to `archived`, no DELETE once a project has left `draft`.

No unrelated schema touched.

---

## Phase 3 — Repository

`lib/repositories/project.repository.ts` — `ProjectRepository`, registered as `repos.projects` (deliberately distinguished, in code comments and naming, from the pre-existing unrelated `repos.projections`). One named method per lifecycle transition: `createDraft`, `updateDraft`, `moveToPlanning`, `startInProgress`, `submit`, `review`, `verify`, `reject`, `publish`, `archive`, `cancel`, `findById`, `listForLearner`, `listPublished`, `listInProgress`, plus member/mentor/update/artifact helpers. No generic `update()`. No `delete()` at all.

---

## Phase 4 — Domain Service

`lib/learnerProjects/project.ts`. Lifecycle exactly as ADR-0013 Phase 5 froze it — ten states, not the mission brief's own simplified five-state restatement (Draft/Submitted/Verified/Published/Archived) — because the mission's own Constitutional Rules section requires "must comply with... ADR-0013, no exceptions," and ADR-0013's actual frozen lifecycle includes Planning, In Progress, Reviewed, Rejected, and Cancelled as named, reasoned states the brief's shorthand omitted. Teacher verification required (`requireSchoolStaff` on every write, reusing the existing shared permission service — never invented another). No AI, no automatic scoring, no rubric anywhere in this module.

**One deliberate, ADR-grounded difference from Achievement worth flagging explicitly**: Evidence is *optional* at `verifyProject()` (ADR-0013 Phase 7: "Projects MAY reference Evidence"), unlike Achievement's non-negotiable Evidence-or-verifying-document requirement (ADR-0012 Phase 5). This is proven by a passing test, not just asserted in a comment.

---

## Phase 5 — Blueprint Integration

`lib/learnerBlueprint/composeProjects.ts` reads `getProjectsSummary()` only. Returns exactly the ADR-0013 Phase 2/6 field budget: `projectCount`, `latestPublishedProject`, `currentActiveProject`, `featuredProject`, `projectsUrl` — never internal lifecycle state (no `status`, no `verificationType` anywhere in the returned shape — proven by an explicit key-set assertion in the test suite). No project editing, no progress editing, no artifact rendering anywhere in this file. Wired into `composeBlueprint.ts` alongside `portfolio`/`achievement`/`teacherReflection`, degrading to `unavailable` on any failure without affecting sibling sections.

---

## Phase 6 — Portfolio Relationship

Implemented exactly the canonical relationship, nothing more:

- `portfolio_items.project_id` — nullable, additive, `projects`-category-only in practice (enforced by `linkItemToProject()`'s own check, not a DB constraint, matching the service-owns-business-rules discipline every prior domain in this series already follows).
- `lib/learnerPortfolio/portfolioProjectLink.ts`'s `resolveProjectReference()` — the one function that answers "what does this Portfolio item's `projects` category point at": `linked` (with a minimal highlight, never a full Project record), `reserved` (category set, no link yet — or a link that no longer resolves in-school-scope), `not_applicable` (any other category). **Never fabricates a reference.**
- Portfolio never stores project data — `portfolio_items` gained exactly one new nullable column, no duplicated title/description/goal/team/mentor/verification field anywhere in Portfolio's own tables.

---

## Phase 7 — Achievement Relationship (verified, not built)

Confirmed, by reading `lib/learnerAchievement/` in full this sprint: Achievement owns no project data today, and nothing in this sprint's code gives it any. The mission's own Forbidden list bans "Achievement redesign" and "Achievement integration" beyond this relationship's confirmation — so no `project_id`-style link was added to `learner_achievements` this sprint. Achievement's existing `supporting_evidence_ids` pattern already provides the general mechanism a future Achievement-references-Project link would extend, when that future sprint is explicitly approved. **Projects never owns an achievement. Ownership never reversed.**

---

## Phase 8 — Evidence Relationship

`learner_projects.supporting_evidence_ids uuid[]` — reference-only, identical pattern to every other domain in this series. Never a copy of an Evidence row's payload, confidence, or lifecycle state.

---

## Phase 9 — Security

Every write action calls `requireSchoolStaff` — reused, not reinvented, the same shared permission service every prior domain in this series already uses. Teachers/School Staff can write; Learners and Parents have no direct write or read path to `learner_projects` this sprint, because no route or UI exists to exercise one (the mission's own Forbidden list bans building either) — consistent with, not a regression from, Portfolio's and Achievement's identical posture at their own foundation sprints. See "Known Gaps" below for what a future learner-facing sprint still needs.

---

## Phase 10 — Testing

`lib/learnerProjects/project.integration.test.ts` — 8 tests, all passing against real synthetic Supabase data (cleaned up via `after()`): full lifecycle with both immutability layers, reject-vs-cancel as distinct terminal states with genuinely different reachability rules, canonical category enforcement, Blueprint composition (asserting the exact field budget, including that no internal lifecycle field leaks through), the Portfolio-references-Projects relationship (all three reference states, plus the "can't link a non-projects-category item" rule), cross-school isolation, and permission checks. Two existing fixture-based pure tests updated for the new required `LearnerBlueprint.projects` field — full regression suite re-run and passing (see Verification below).

---

## Known Gaps (documented honestly, not silently deferred)

- **No learner- or parent-facing access path.** ADR-0013's own Core Question frames a Project as "the learner's own" undertaking, but this foundation sprint gates every write behind school staff, matching the codebase's established precedent (Portfolio/Achievement did the same at their own foundation sprints) and the mission's explicit Forbidden-UI constraint. A future sprint building any learner-facing Projects surface must design the actual learner-authoring permission path then — reusing `requireStudent`/`requireParent` where a Core-learner-scoped equivalent exists, or flagging the gap if one doesn't (Core-space self-access parity with the legacy `students.id` space is an existing, separately-tracked platform gap, not something this sprint invented).
- **No curation/pinning mechanism** for `featuredProject` — the most recently published project stands in, matching Portfolio's identical honest gap (ADR-0011).
- **External/Competition verification's exact data model** is reserved, per ADR-0013 Phase 6 itself, for whichever future sprint actually needs it — `verifying_document_reference` exists on the schema today but no workflow exercises the `competition_verified`/`external_verified` values yet beyond what the enum permits.

---

## Verification (all checked before considering this sprint complete)

- ✓ One canonical Projects domain — Phase 1's audit, unchanged conclusion re-confirmed.
- ✓ No duplicated ownership — Phase 6/7/8, confirmed against Portfolio and Achievement directly.
- ✓ Blueprint composes only — `composeProjects()`, proven by the explicit field-budget assertion in tests.
- ✓ Portfolio references Projects — `project_id` + `resolveProjectReference()`, all three states tested.
- ✓ Achievement relationship preserved — verified by reading, no code added, no ownership crossed.
- ✓ Evidence referenced only — `supporting_evidence_ids`, never copied.
- ✓ Publish immutable — three layers, proven by a raw-client bypass attempt in tests.
- ✓ No generic `update()` — `ProjectRepository` exposes only named transition methods.
- ✓ No generic `delete()` — none exists at all.
- ✓ `tsc --noEmit` clean.
- ✓ ESLint clean.
- ✓ Full regression passes (Projects: 8/8; full existing suite re-run, see implementation-log entry).
- ✓ New tests pass — 8/8.
- ✓ Migration applied only after explicit approval — asked first, applied only after the user said yes.
- ✓ Documentation complete — this document + implementation-log entry.

---

## Stop Condition

Per explicit mission instruction: **stop here.** Projects domain, repository, service, Blueprint summary integration, documentation, and tests are complete. Not begun: Competitions, Innovation, Portfolio UI, Project UI, uploads, QR, Parent Portal enhancements, or any Sprint 13 work. Waiting for explicit approval before the next sprint — and, per the user's own stated recommendation, a full architecture audit of Sprints 12A–12Z (checking for duplicated ownership or diverging calculations across Blueprint/Portfolio/Achievement/Projects) is the right next step before any of Sprint 13's domains (Competitions, Community Service, Wellbeing) begin.
