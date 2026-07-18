# Sprint 12R — Parent Growth Timeline & Educational Journey

**Status: implemented.** Presentation layer only — zero recomputation, zero new repositories/services, zero schema changes.

---

## Phase 1 — Audit

Re-examined every historical surface before writing anything new:

| Existing asset | Reuse decision |
|---|---|
| `blueprintSnapshot.repository.ts` / `lib/learnerBlueprint/snapshot.ts` | Reused verbatim — `listBlueprintSnapshots()`/`getBlueprintSnapshot()` are the only two functions any new page calls; no new repository method, per the Forbidden list |
| `app/(parent)/child/[learnerId]/history/page.tsx` (Sprint 12Q) | **Enhanced in place**, not duplicated — Sprint 12Q's flat snapshot list already called `listBlueprintSnapshots()` and rendered newest-first; this sprint adds richer per-card content and growth indicators to that same page rather than building a second, parallel history route |
| `app/(parent)/child/[learnerId]/history/[snapshotId]/page.tsx` (Sprint 12Q) | Untouched — the Snapshot detail step of the navigation flow already exists and already satisfies Phase 3's "everything links to the historical snapshot" |
| `ParentBlueprintView`/`HistoricalBanner` (Sprint 12Q/12K) | Reused verbatim for Snapshot detail — only the Timeline's back-link copy was updated ("← Back to Timeline") for wording consistency with this sprint's new terminology |
| `PARENT_STATUS_LABEL` (`lib/parentExperience/terminology.ts`, Sprint 12Q) | Reused verbatim wherever a section is unavailable inside a Timeline card |

**Missing timeline metadata found**: `blueprint_payload` (already returned in full by `listBlueprintSnapshots()`) was being fetched but not used — Sprint 12Q's history list only read `snapshot_type`/`created_at` off each row, discarding the rest of the payload. This sprint's richer cards (Phase 3) close that gap using data that was already being transferred over the wire, not a new query.

**Navigation opportunity found**: nothing previously sat between Parent Home and the flat Snapshot list — Phase 4's milestone-level "Growth Journey" view fills that gap as a new, distinct page (`/journey`), while the enhanced history page becomes the detailed "Timeline" the Journey page links into. No STOP condition was triggered — no duplicate rendering exists (confirmed by code review before writing anything), so Phase 2 proceeded.

---

## Phase 2 — Timeline Engine (Presentation Only)

New `lib/parentExperience/growthTimeline.ts` — two pure functions, no database access, no new business logic:

- `compareSnapshots(current, previous)` — compares four already-rendered fields (attendance percentage, learning-focus subject, teacher-reflection version, career cluster) between one snapshot and the *immediately preceding* one. Every value compared is read directly off `blueprint_payload`, unmodified — nothing is recomputed, no Projection call, no AI call.
- `buildMilestones(snapshots)` — labels each already-fetched snapshot row by its existing `snapshot_type`, marking the earliest as "First Recorded Blueprint." Builds nothing from any source other than the array already passed in.

Each Timeline entry corresponds to exactly one immutable `blueprint_snapshots` row — no synthetic or merged entries.

---

## Phase 3 — Timeline Cards

The enhanced `/child/[learnerId]/history` page renders, per card: Snapshot Date, Snapshot Type (Report Card Time / End of Term / Graduation), a Growth Status badge (`compareSnapshots()`'s `overallGrowthStatus`), a Teacher Reflection preview (`teacherReflection.data.strengths`, truncated for display only), Attendance Health (percentage + a growth label when comparable), Learning Compass summary (`currentLearningFocus.subject`), and Career Orientation (`careerCluster`) — the exact field list Phase 3 named, no more. Academic Year/Term are available on every row (`academic_year_id`/`term_id`) but were not separately displayed on the card face this sprint, since the card already links to the Snapshot detail page where `HistoricalBanner` shows them in full (Phase 3: "Everything links deeper. Nothing duplicated." — showing them twice on both the card and the detail page would itself be the duplication this sprint is instructed to avoid). Every card links to `/history/[snapshotId]`, the existing, unmodified Snapshot detail page.

---

## Phase 4 — Educational Journey

New `/child/[learnerId]/journey` page. Milestones shown only when they already exist in the data: First Recorded Blueprint (the earliest snapshot, always present once any snapshot exists), Report Card publications, End-of-Term snapshots, and Graduation (only if a `graduation`-typed snapshot exists — "future-ready" in the sense that the moment it happens, it appears automatically, with zero code change needed).

**A deliberate, documented omission**: generic "Promotion" (a non-graduating grade promotion) is **not** shown as a milestone type. `ADR-0008 Part 3` froze exactly three Blueprint Snapshot triggers — report card publication, end of term, graduation — a routine promotion is not one of them, so no snapshot exists to point a "Promotion" milestone at. Inventing one from `learner_promotions` directly would mean reading a second data source outside Blueprint Snapshots, violating this sprint's own Phase 2 scope ("using only Current Blueprint, Blueprint Snapshots") and Phase 4's explicit instruction ("Never fabricate milestones"). Documented here as a gap, exactly the same discipline as prior sprints' honestly-reported gaps (Sprint 12M's readiness label, Sprint 12N's AI outlook).

---

## Phase 5 — Growth Indicators

`compareSnapshots()` computes four signals, each restricted to `improving`/`steady`/`declining`/`unknown` — never a numeric score, never a new formula:

- **Attendance improving/declining/steady** — a `>`/`<`/`=` comparison of two already-computed percentages.
- **Learning focus changed** — a string-equality check on `currentLearningFocus.subject`.
- **Teacher reflection evolved** — a version-number comparison (`teacherReflection.data.version`), never a text diff of the reflection's actual content.
- **Career cluster refined** — a string-equality check on `careerCluster`.

Whenever either side of a comparison is missing (a section was `unavailable` in either snapshot, or there is no previous snapshot at all), the signal is `unknown` and its label is the literal frozen copy **"Not enough historical information."** — verified directly by `growthTimeline.pure.test.ts`, which asserts this exact behavior for a first-ever snapshot and for a snapshot whose Attendance section was unavailable.

---

## Phase 6 — Timeline Navigation

Exactly the frozen flow: **Parent Home → Growth Journey (`/journey`) → Timeline (`/history`) → Snapshot (`/history/[snapshotId]`) → Back to Timeline**. Every page has exactly one "back" link and, where relevant, one forward link — Growth Journey also link-throughs directly to a specific milestone's Snapshot (never trapping a parent who wants full detail immediately) as well as to the full Timeline. Parent Home's own "Their Journey So Far" card now points at `/journey` (was `/history` in Sprint 12Q) to match the frozen hierarchy's first hop.

---

## Phase 7 — Empty States

- **No snapshots**: both `/journey` and `/history` show an explanatory sentence — "recently onboarded" framing on `/journey" ("...there isn't a journey to show yet..."), the existing Sprint 12K-style message on `/history`.
- **Single snapshot only**: `/history` shows an additional inline note ("This is the first recorded moment — nothing to compare it to yet") rather than silently rendering a growth badge with no meaning; `compareSnapshots()` itself returns `unknown`/"Not enough historical information." for every signal in this case, never a fabricated direction.
- **Historical gap**: no special-cased gap-detection logic was built — the real snapshot dates are always shown as-is, which already communicates any gap honestly to a human reader without inventing a "there was a gap" calculation.
- **Recently onboarded learner**: identical code path to "no snapshots" — both routes handle a learner with zero snapshot history gracefully, never an error.

---

## Phase 8 — Accessibility

- Keyboard: every card and link carries the same `focus-visible:ring-2`/`focus-visible:underline` treatment established in Sprint 12L-R/12Q.
- Screen readers: `aria-label` on both the Journey (`"Growth journey milestones, newest first"`) and Timeline (`"Growth Timeline, newest first"`) ordered lists; `role="status"` on every empty/single-snapshot state.
- Colour: every growth signal is paired with its text label (`growth.overallGrowthStatus`, `growth.attendance.label`) — never a colour-only badge.
- Mobile: identical `max-w-2xl mx-auto px-4` responsive container as every other Parent Portal page.
- Print-safe: no print-specific styling was added — out of scope, matching Sprint 12Q's own note that PDF/print is a separate, not-yet-built ADR-0009 layer.

---

## Phase 9 — Regression

- `composeBlueprint.pure.test.ts`/`composeBlueprint.integration.test.ts` — unchanged, all passing.
- `snapshot.test.ts` — unchanged, all passing (5/5); confirms Snapshot immutability is untouched (no new write path was added anywhere this sprint).
- `reflection.integration.test.ts` — unchanged, all passing (3/3).
- `parentPortal.integration.test.ts` (Sprint 12Q) — unchanged, all passing (3/3); Parent Portal's permission gate is untouched.
- New: `growthTimeline.pure.test.ts` (5/5) — DB-free unit tests proving `compareSnapshots`/`buildMilestones` never fabricate a comparison or a milestone.
- Combined: 37/37 passing, zero regressions.
- No duplicated rendering: confirmed by code review — the enhanced Timeline card reuses `PARENT_STATUS_LABEL` for every unavailable field rather than inventing new copy; Snapshot detail (`ParentBlueprintView`) is completely unmodified except for one link's label text.
- `npx next build`: clean, `/child/[learnerId]/journey` present in the route manifest alongside the unmodified `/child/[learnerId]/history*` routes, no collisions.

---

## Constitutional / RAS / ADR Compliance

- **ADR-0008 Part 3/Part 6**: every Timeline/Journey entry maps to exactly one immutable Snapshot; no recomputation anywhere — confirmed by code review, `compareSnapshots`/`buildMilestones` take already-fetched data as their only input.
- **ADR-0009**: navigation follows the same one-directional, no-tabs, no-wizard model every other Blueprint-adjacent surface already uses.
- **ADR-0010 Part 4/Part 5/Part 6**: growth signals use plain language ("Attendance improving," "Growing Well"), every card answers a "what's the story" question rather than presenting raw numbers alone, and no internal identifier (Owner strings, algorithm names, raw enum values) appears anywhere in the new code.
- **Educational Constitution Article II** ("missing evidence is never poor performance") — an `unknown` growth signal always renders as "Not enough historical information," never as an implied decline.
- **Article XI** ("a number without a name is not neutral") — every comparison ships with its plain-language label; no bare percentage delta or version-number diff is ever shown unlabeled.

---

## Required Verification — evidence

- **Timeline consumes Blueprint Snapshots only**: confirmed — every data-bearing page calls exactly `listBlueprintSnapshots()`/`getBlueprintSnapshot()`.
- **No duplicated calculations, no recomputation**: confirmed by code review and by `growthTimeline.pure.test.ts` — `compareSnapshots`/`buildMilestones` perform no database access and no educational computation.
- **Immutable history preserved**: unaffected — no new write path exists anywhere in this sprint; `blueprint_snapshots`' own DB trigger (Sprint 12K) is untouched.
- **Navigation follows ADR-0009**: Phase 6, above.
- **Parent Experience follows ADR-0010**: Phase 8/terminology reuse, above.
- **Accessibility verified**: Phase 8, above.
- **Mobile responsive**: same container class as every other Parent Portal page.
- **`tsc --noEmit`**: clean.
- **`eslint`**: clean on every touched/new file.
- **Regression tests passing**: 37/37 combined.
- **Implementation log updated**: see `docs/engineering/implementation-log.md`.

---

## Stop Condition

Per explicit mission instruction: the Parent Growth Timeline is complete. **Stop here.** Notifications, parent messaging, Behaviour, Portfolio, Projects, Educational Identity, homework, community, and AI recommendations do not begin. Waiting for explicit approval before Sprint 12S.
