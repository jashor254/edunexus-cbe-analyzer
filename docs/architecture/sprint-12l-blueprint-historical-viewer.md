# Sprint 12L-R — Blueprint Historical Viewer Refinement

**Status: implemented.** Refinement only — no re-implementation of Sprint 12K.

---

## 1. Audit Verification (Phase 1, mandatory before any code)

The mission's own Phase 1 asked to re-verify a prior audit finding: that Sprint 12K
(`sprint-12k-blueprint-snapshots.md`) already shipped everything a naive reading of
"Sprint 12L" would otherwise re-build. Re-checked directly against the current
codebase, not just the prior sprint doc:

| Claim | Verified against |
|---|---|
| Snapshot repository exists, read-only | `lib/repositories/blueprintSnapshot.repository.ts` — `insert`/`findById`/`listForLearner`, no update/delete |
| Snapshot service exists, read-only | `lib/learnerBlueprint/snapshot.ts` — `createBlueprintSnapshot`/`getBlueprintSnapshot`/`listBlueprintSnapshots` |
| Current Blueprint page exists | `app/student/blueprint/[learnerId]/page.tsx` |
| History list exists | `app/student/blueprint/[learnerId]/history/page.tsx` |
| Snapshot detail page exists, reuses `BlueprintView` | `app/student/blueprint/[learnerId]/history/[snapshotId]/page.tsx` |
| `HistoricalBanner` exists | `components/blueprint/HistoricalBanner.tsx` |
| Permissions identical to Current | both history pages call the same `requireAuthentication` + `requireSchoolStaff` pair |
| `BlueprintView` renders both, one render path | `historicalMeta` optional prop |
| Payload never recomputed | both service reads return `blueprint_payload` verbatim |

All nine held. No STOP condition triggered — proceeded straight to the refinement work below, per mission ("do NOT build anything already existing").

---

## 2. `getLatestSnapshot()` (Phase 2)

Added because it genuinely didn't exist — `listForLearner`/`findById` covered "all" and
"by id," not "most recent."

- **Repository**: `BlueprintSnapshotRepository.getLatestForLearner(learnerId, schoolId)` — same `ORDER BY created_at DESC` the existing `listForLearner` already uses, `.limit(1).maybeSingle()`, no new query shape.
- **Service**: `lib/learnerBlueprint/snapshot.ts`'s `getLatestBlueprintSnapshot(coreLearnerId, schoolId)` — a one-line pure read, no computation, no cache.

Not wired into any page this sprint — no consumer needed it yet; adding one prematurely would violate "don't build ahead of a real caller." It exists now for the next feature (e.g. a Current-Blueprint "last snapshot taken on..." note) to call without inventing a duplicate query.

---

## 3. Loading States (Phase 3)

Two new skeleton components added to the existing shared `components/ui/skeletons.tsx` (matching this codebase's established pattern — `app/dashboard/*/loading.tsx` already does the same thing): `BlueprintSkeleton` (Current Blueprint + Snapshot detail — identical section-card layout) and `BlueprintHistoryListSkeleton` (History list). Three `loading.tsx` files added:

- `app/student/blueprint/[learnerId]/loading.tsx`
- `app/student/blueprint/[learnerId]/history/loading.tsx`
- `app/student/blueprint/[learnerId]/history/[snapshotId]/loading.tsx`

`BlueprintSkeleton` is reused by both Current and Snapshot detail (same layout) — no duplicate skeleton for the same shape, per mission ("do not duplicate layout").

---

## 4. Error States (Phase 4)

Previously every failure path in all three pages collapsed into a generic `notFound()`.
New shared `components/blueprint/BlueprintStateMessage.tsx` (one component, reused by
all three pages) renders four distinct, explanatory states: `learner-not-found`,
`snapshot-not-found`, `permission-denied`, `unavailable`. "No snapshots yet" was
already a distinct, explanatory empty state in the History list (Sprint 12K) and was
left as-is rather than forced into the new component.

**Security-preserving distinction, not a relaxation**: `MembershipRequiredError`
(the user has no membership in this school at all) still resolves to `notFound()` —
existence of the learner/school is still not confirmed to a non-member, exactly the
prior behaviour. `PermissionDeniedError` (the user IS a member, per
`requireSchoolMembership` already having succeeded inside `requireSchoolStaff`, but
lacks the staff role) now gets the explicit `permission-denied` message — there is
nothing left to hide from someone already confirmed as a school member, so a clearer
message is strictly more honest, not a bigger attack surface. No ID is ever rendered
by `BlueprintStateMessage` in any state.

`unavailable` wraps `composeBlueprint()` / `listBlueprintSnapshots()` /
`getBlueprintSnapshot()` + the academic-year/term lookups in a try/catch — these are
documented (ADR-0008 Part 6, Sprint 12G) as resilient/non-throwing under normal
conditions, so this is a defensive net for genuine outages, not a new failure mode.

---

## 5. Snapshot Header Completion (Phase 5)

`HistoricalBanner` already showed Snapshot Type, Academic Year, Term, and Created
Date. Added, reading only from data the row/payload already carries — no new schema,
no recomputation:

- **School** — `snapshot.blueprint_payload.identity.data.schoolName` (already composed into every Blueprint payload)
- **Schema Version** — `snapshot.schema_version` (the row column)
- **Blueprint Version** — `snapshot.blueprint_payload.metadata.blueprintVersion` (the payload's own embedded version, a legitimately distinct field from the row's `schema_version` — both already existed, neither was invented)
- **Generated From** — a human sentence keyed off `snapshot.provenance.trigger` (e.g. "Generated automatically when a Report Card was published") — deliberately not the same string as the "Snapshot Type" badge, and never renders `provenance.sourceRecordId` or `provenance.actorUserId` (no ID exposure)

Learner name / Admission Number / Grade were **not** added to the banner — they're
already rendered in the Identity section immediately below it via the exact same
`BlueprintView` body every Current Blueprint view uses, so duplicating them in the
banner would be redundant, not clarifying.

---

## 6. Accessibility (Phase 6)

No redesign — additive only:

- `BlueprintSectionCard`'s expand/collapse button: `aria-expanded`, `focus-visible:ring-2` (previously only had a hover state, invisible to keyboard-only navigation)
- `BlueprintView`'s History link: wrapped in `<nav aria-label="Blueprint history navigation">`, `focus-visible:underline`
- History list: `<ol aria-label="Blueprint snapshot timeline, newest first">` (was a plain `<div>`) so screen readers announce it as an ordered sequence; each entry has a visible "Most Recent" text badge (not colour alone) on top of the existing "Historical" badge
- `BlueprintStateMessage`: `role="alert"`; History list's empty state: `role="status"`
- "Current" badge next to the Current Blueprint's `<h1>` and "Immutable — cannot be edited" (was "Immutable" alone) on the Historical banner — both convey status through text, not colour alone, per ADR-0007's accessibility rule

---

## 7. Timeline Polish (Phase 7)

No new timeline engine — the existing flat, newest-first `listForLearner` ordering
already *is* the timeline (Sprint 12K). Only clarity additions: the newest entry now
carries an explicit "Most Recent" badge, the Current Blueprint page carries an explicit
"Current" badge, and the History list's back link now reads "← Back to Current
Blueprint" (was "← Back to Blueprint") so the Current/Historical distinction is legible
from the link text itself, not just the destination.

---

## 8. Regression Audit (Phase 8)

Full regression suite re-run, unchanged results:

- `lib/learnerBlueprint/snapshot.test.ts` — 5/5 (4 existing + 1 new for `getLatestBlueprintSnapshot`)
- `lib/learnerBlueprint/composeBlueprint.pure.test.ts` / `composeBlueprint.integration.test.ts` — unchanged, all passing
- `lib/core/reportCardOwnership.security.test.ts`, `reportCardPublicationGuard.integration.test.ts` — unchanged, all passing
- `lib/core/endOfTermFullChain.test.ts`, `granularEndOfTermFlow.test.ts` — unchanged, all passing
- Combined: 39/39 passing, zero regressions

No file outside `lib/repositories/blueprintSnapshot.repository.ts`,
`lib/learnerBlueprint/snapshot.ts`, `components/blueprint/*`, `components/ui/skeletons.tsx`,
and the three Blueprint route files was touched — Attendance, Compass, Career, Report
Cards, and Permissions logic are byte-for-byte unchanged.

---

## 9. Constitutional / RAS / ADR Compliance

- **ADR-0008 Part 3, Part 6**: no fourth trigger, no recomputation added anywhere — every new field reads an existing column/payload path
- **RAS §10.7/§10.8**: one repository, one service — `getLatestForLearner`/`getLatestBlueprintSnapshot` are additions to the existing single owner, not a second owner
- **Educational Constitution Article XI**: the expanded banner (School, Schema Version, Blueprint Version, Generated From) strengthens, not weakens, "a number without a name is not neutral" — every one of those fields now has an explicit label
- **No new canonical domain, identity, write path, or business logic** — confirmed; every change in this sprint is either a pure read, a presentational component, or an accessibility/loading-state addition

---

## Verification

- `tsc --noEmit`: clean, project-wide.
- `eslint`: clean on every touched/new file.
- One snapshot repository, one snapshot service — confirmed, no new files created for either.
- One history viewer — confirmed, `BlueprintView` remains the single render path for Current and Historical.
- Immutable snapshots remain immutable — no repository/service method added that could mutate a row; DB trigger untouched.
- `getLatestSnapshot` works — new test passing against real synthetic data.
- Loading states work — three `loading.tsx` files added, reusing two shared skeleton components.
- Permission states work — `permission-denied` now explicit for members without the staff role; `MembershipRequiredError` unchanged (still `notFound()`, preserving existence-hiding for non-members).
- Accessibility preserved/improved — `aria-expanded`, `aria-label`, `role="alert"`/`role="status"`, focus-visible states, text badges alongside every colour cue.
- Regression tests pass — 39/39.

---

## Stop Condition

Per explicit mission instruction: refinement complete. **Stop here.** Sprint 12M (Parent Portal) does not begin in this sprint.
