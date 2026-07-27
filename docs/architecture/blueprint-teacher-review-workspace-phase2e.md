# Blueprint Teacher Review Workspace — Phase 2E

**Date:** 2026-07-26
**Scope:** A teacher-facing UI and thin application-integration layer over the existing Phase 2D review service. No new educational logic, no change to Evidence/Projection ownership, no change to Assignment/Compass behavior, no change to the Blueprint action lifecycle.

---

## 1. Executive verdict

**DONE — GO for the next Blueprint phase.**

An authorized teacher can now open `/teacher/learners/[learnerId]/blueprint/review`, see every approved Blueprint action item for that learner with an "awaiting review" indicator, open one to inspect its Assignment/Compass delivery activity, latest Evidence, current Projection, and full review history, and record one of the five established Phase 2D decisions. Every read goes through `getBlueprintActionReviewSnapshot()` (detail) or a new, thin, learner-scoped list model built on the same repositories (`listReviewableBlueprintActionsForLearner()`); every write goes through the existing `reviewBlueprintAction()` via its existing route — this phase introduces no new writer to `blueprint_action_reviews` or any other table. 24 read-model tests + 36 Phase 2D regression tests + 5 page-level HTTP tests + 26 component tests, all passing; Phase 2A/2B/2C regression suites (38+9+21+18 = 86 tests) re-run clean.

## 2. UI audit findings

Full findings are in the research pass this phase began with; the load-bearing conclusions:

- **No per-learner teacher hub page exists.** The only Blueprint-related page under `app/teacher/` is a legacy-id redirect shim (`app/teacher/reports/blueprint/[studentId]/page.tsx`) to the real, shared Blueprint render at `app/student/blueprint/[learnerId]/page.tsx` (used by teacher, parent, and student viewers alike, gated by `requireLearnerAccess`). There was nowhere existing to bolt a review section onto without either overloading that shared page's own access model or duplicating its shared rendering for a teacher-only concern.
- **No `components/ui/` primitive library exists** (no Card/Badge/Dialog/RadioGroup) — every page hand-rolls Tailwind. New components follow the same ad hoc convention (rounded-2xl cards, teal/amber/green semantic pill colors, `font-black` labels) rather than inventing a design system.
- **No shared status-badge or date-formatting utility exists** — each page defines its own. Phase 2E's own small `reviewFormatting.ts` follows that same "local to the feature" convention rather than trying to retrofit a shared one.
- **Data-fetching convention is mixed** (some pages server components, most are client components fetching via `useEffect`) — this phase followed the Blueprint page's own server-component pattern for the initial page load (auth + one read-model call, no client round-trip needed for first paint), reserving client components for what genuinely needs interactivity (selection, the review form).
- **No component-interaction test infrastructure exists** — the only precedent (`BlueprintView.test.tsx`) is `node:test` + `renderToStaticMarkup`, with no `jsdom`/React Testing Library in this repo. Phase 2E's component tests follow that exact precedent; form *validation logic* is tested as a pure function (`isNoteRequiredForDecision`) rather than via simulated clicks, since no interaction-testing tool exists here and the task brief instructed against adding one.
- **No existing teacher-facing Compass session view exists** — Compass only appears as a class-wide tab inside the class roster page. `CompassActivitySummary` therefore has no safe existing page to deep-link to (see §9).
- **The Phase 2D snapshot does not, by itself, support a multi-action list view** — `getBlueprintActionReviewSnapshot()` is correctly scoped to one action and *throws* `ConflictError` for an undelivered item (correct for a detail view; wrong for a list that must show "not yet delivered" as a normal state). This is the one concrete gap the audit found, and it is what `reviewWorkspace.ts` exists to fill — never by reimplementing the detail gathering, only by a cheaper existence/freshness check reused once per learner (see §5).

## 3. Chosen route and scope

**Learner-scoped, exactly as preferred by the task brief**: `app/teacher/learners/[learnerId]/blueprint/review/page.tsx`, a new route (no existing hub to attach a tab to, per §2). A server component: authentication, the one `listReviewableBlueprintActionsForLearner()` call, and a learner-name header — no business logic in the page itself. A `loading.tsx` sibling follows the Blueprint page's own streaming convention.

**Navigation entry point**: a "Review Actions" link was added to the existing Blueprint page (`app/student/blueprint/[learnerId]/page.tsx`), shown only when the signed-in viewer's primary role is `teacher` (never to the learner or parent viewing the same URL) — the smallest useful integration point, not a new nav section or a redesign of `TeacherSidebar`/`TeacherBottomNav`.

A teacher-wide "all actions awaiting review across every learner" inbox was **not** built — explicitly deferred, per the task's own preferred-scope framing.

## 4. Component architecture

```
components/blueprint/review/
  reviewFormatting.ts            — pure formatting/validation helpers (dates, decision labels/colors, note-required rule)
  BlueprintReviewWorkspace.tsx   — 'use client' orchestrator: selection state, on-demand snapshot fetch, layout
  BlueprintActionReviewList.tsx  — the overview list (or its empty state)
  BlueprintActionReviewCard.tsx  — one list row
  BlueprintActionOverview.tsx    — "Approved action" section (title/learnerAction/intendedOutcome/successIndicator/reviewDate)
  AssignmentActivitySummary.tsx  — Assignment delivery/completion section
  CompassActivitySummary.tsx     — Compass delivery/session section
  EvidenceSummary.tsx            — latest-Evidence section
  ProjectionSummary.tsx          — current-Projection section
  ReviewHistory.tsx              — append-only review history
  BlueprintReviewForm.tsx        — 'use client' decision form, POSTs to the existing Phase 2D route
```

Every summary component takes exactly one already-typed snapshot field as its prop (`AssignmentReviewSnapshot`, `CompassReviewSnapshot`, `EvidenceReviewSnapshot`, `ProjectionReviewSnapshot`, `BlueprintActionReviewRow[]`) — none of them fetch anything themselves, so each is independently unit-testable with a plain fixture object, which is exactly how they're tested (§11).

## 5. Read model

Two read paths, deliberately not merged into one:

1. **Detail** — `getBlueprintActionReviewSnapshot()` (Phase 2D, unmodified), fetched on demand via the existing `GET /api/teacher/blueprint/actions/[actionItemId]/review` route when a teacher selects an action in the list. Never fetched for every action up front.
2. **List** — a new function, `listReviewableBlueprintActionsForLearner()` (`lib/learnerBlueprint/actionPlan/reviewWorkspace.ts`), added because the Phase 2D snapshot cannot serve a multi-action list without either throwing on undelivered items or re-fetching learner-scoped Evidence/Projection once per action item (wasteful for a learner with several action items, since both are learner-scoped, not action-scoped). It:
   - Calls the pre-existing `repos.blueprintActionItems.listApprovedForLearner()` (unmodified, already existed).
   - Reads Evidence (`getLearnerTimeline`) and persisted Projection (`getPersistedProjections`) **once** for the whole learner, reused across every action item's awaiting-review computation.
   - Checks Assignment/Compass delivery *existence* per action (`findByBlueprintActionItemId`) — never throws for "not yet delivered," which is a normal, expected list-row state.
   - Adds one new read-only repository method per side: `AssignmentRepository.getLatestSubmissionActivityAt()` (assignment_submissions' own `submitted_at`/`marked_at` — the `assignments` row's `updated_at` does **not** reflect submission activity, a real bug caught by the integration test suite during development, see §11) and `CompassRepository.summarizeSessionsForSubject()` (already added in Phase 2D, reused here).
   - Never imports `reviewBlueprintAction`, any Evidence/Projection/Assignment/Compass writer, or performs a `.from(table).insert/update/upsert/delete(...)` call anywhere — proven statically, not just by code review (`reviewWorkspace.mapping.test.ts`).

Both paths are read-only; `reviewWorkspace.ts` never duplicates `review.ts`'s detail-gathering logic — it answers a genuinely different, cheaper question ("which of these many items need attention") using the same underlying repositories.

## 6. Authorization

Identical to Phase 2D's own gate, reused verbatim: `canManageLearnerRecordCore(client, schoolId, learnerId)`. No second, weaker check was added. Proven for the read model directly (`reviewWorkspace.integration.test.ts`): unauthenticated → `UnauthorizedError`; unrelated same-school teacher, cross-school teacher, parent, and the learner themself → `ResourceOwnershipError`; only the authorized teacher sees the learner's own actions, and never another learner's.

**A second, pre-existing gate also applies and was proven, not assumed**: every `/teacher/**` route (including this new one) already sits behind `app/teacher/layout.tsx`'s own coarse gate (`getUserRoles().primary === 'teacher'` or admin-tier `school_users` membership) — a parent or learner account is redirected to `/dashboard` before this page's own code ever runs. `reviewWorkspace.page.http.integration.test.ts` proves both layers over real HTTP: the coarse layout redirect (parent), and the page's own fine-grained denial (an unrelated *teacher* who passes the coarse gate but fails `canManageLearnerRecordCore` for this specific learner) — confirming service-role data access never substitutes for either boundary.

The review-submission boundary is Phase 2D's own, unchanged: the form POSTs to the existing route, which re-derives the actor from the session and re-authorizes independently — the UI never trusts a client-supplied learner or action id as authorization, only as a lookup key the server re-checks.

## 7. Review-form behavior

Exactly the five Phase 2D decisions, no synonym, no sixth value (`BlueprintReviewForm.tsx`'s `DECISIONS` array is typed against `BlueprintActionReviewDecision` directly, so a sixth value would be a compile error, not just a convention). Note-required rule implemented as a pure function (`isNoteRequiredForDecision`, unit-tested for all five decisions): Complete/Needs Revision/Reopen/Defer require a note; No Decision does not. The required disclaimer sentence is rendered verbatim above the decision fieldset. On submit, the form POSTs to the unmodified Phase 2D route; on success it clears its own fields (a second review remains fully possible, per Phase 2D's own repeatable-review design) and shows a `role="status"` confirmation plus an `aria-live="polite"` announcement region; on failure the typed note and selected decision are preserved (no state is cleared on a failed submission) and a `role="alert"` error is shown.

## 8. Awaiting-review presentation rule

Implemented as a pure function, `computeAwaitingReview()` (`reviewWorkspace.ts`), unit-tested for every branch (11 tests). The exact rule:

An action is awaiting review if **any** of the following holds:
1. It has never been reviewed (`latestReviewAt === null`).
2. Its `reviewDate` has arrived or passed **and** no review has happened since that date (`reviewDate <= today && reviewDate > latestReviewAt`).
3. Assignment submission activity (`submitted_at`/`marked_at`, not the `assignments` row's own `updated_at`) is newer than the latest review.
4. Compass session activity is newer than the latest review.
5. New learner Evidence exists that is newer than the latest review.
6. The learner's Projection was recomputed more recently than the latest review.

This is a **read-only presentation flag**, computed fresh on every list load from timestamps already present in the read model — it is never persisted, never changes `blueprint_action_items` or `blueprint_action_reviews`, never auto-creates a review, and never claims success or failure (a "Needs attention" label, not a verdict). Proven directly: after a review is recorded the flag clears; after new (real, database-backed) submission activity occurs, the flag reasserts itself while the *latest recorded decision* stays exactly what the teacher chose — the two are never conflated (`reviewWorkspace.integration.test.ts`'s final two tests).

## 9. Privacy boundaries

- `BlueprintActionOverview` renders only `title`/`learnerAction`/`intendedOutcome`/`successIndicator`/`reviewDate` — `teacherNotes`, `parentSupport`, `schoolSupport`, `evidenceBasis`, and every internal identifier are never passed to it at all (not merely hidden — the component's prop type doesn't carry them), proven by a rendering test that plants private-marker strings in both fields and asserts neither appears in the output.
- `CompassActivitySummary` renders only counts and dates from the snapshot's `compass` field, which itself never carries raw session state, model prompts, or conversation content (Phase 2D's own guardrail, unchanged) — proven by a rendering test asserting no prompt/model-related terms appear.
- `ReviewHistory` never offers an edit or delete control — none exists to offer, since `blueprint_action_reviews` is unconditionally append-only at the database level (Phase 2D). Reviewer identity is shown as "Recorded by school staff" rather than a resolved name — resolving `reviewed_by` (a `school_users.id`) to a display name would require a new cross-table read whose only consumer would be this one decorative label; deliberately deferred rather than added, and never fabricated.
- No raw database identifier, service-role error message, or internal projector/implementation detail is rendered anywhere — errors are mapped to short, teacher-facing sentences at the fetch boundary (`BlueprintReviewWorkspace`'s `detail.status === 'error'` branch, `BlueprintReviewForm`'s `submitError` state).
- `ProjectionSummary` shows a confidence **category** (Low/Moderate/High), not the bare numeric confidence presented as a percentage of certainty, paired with an explicit caveat sentence ("Reflects computed confidence based on available evidence — not a determination of success.") — proven by a rendering test asserting the raw `82%` never appears.

## 10. Accessibility and responsive behavior

- Semantic headings throughout (`<h1>` page title, `<h2>`/`<h3>` section headings with matching `aria-labelledby`).
- The action list is a `<nav aria-label="…">` of native `<button>` elements (not clickable `<div>`s) — inherently keyboard-focusable and activatable, with `aria-pressed`/`aria-current` reflecting selection.
- Decision options are native `<input type="radio">` elements inside a `<fieldset>`/`<legend>` — inherently keyboard-operable (arrow-key group navigation, no custom widget to reimplement).
- Submission errors use `role="alert"`; success uses `role="status"` plus a dedicated `aria-live="polite"` region so a screen reader announces it without requiring focus to move.
- The "Needs attention" and decision-status indicators always pair a color with an explicit text label (`DECISION_LABEL`) — never color alone.
- Responsive layout: `grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr]` — list beside detail on desktop/wide layouts, list-then-detail stacked on mobile/tablet, matching the task's preferred structure. No fixed-width tables; no horizontal scroll is introduced by this phase.

Not independently browser-tested (no visual/interaction testing tool exists in this repo, and the task instructed against adding one) — accessibility properties above are structural (semantic HTML, ARIA roles/labels) and verified via the static rendering tests in §11, not via a live screen reader or automated a11y scanner.

## 11. Test results

| Suite | Result |
|---|---|
| `reviewWorkspace.mapping.test.ts` (pure `computeAwaitingReview` + static scans) | 14/14 |
| `reviewWorkspace.integration.test.ts` (real session, real DB) | 10/10 |
| `reviewFormatting.test.ts` (pure form/label logic) | 8/8 |
| `reviewComponents.test.tsx` (static rendering, all summary/list/form components) | 18/18 |
| `reviewWorkspace.page.http.integration.test.ts` (real HTTP, the actual page) | 5/5 |
| **Phase 2E total** | **55/55** |
| `review.mapping.test.ts` + `review.integration.test.ts` (Phase 2D regression) | 36/36 |
| `review.http.integration.test.ts` (Phase 2D regression) | 6/6 |
| `delivery/assignment.integration.test.ts` (Phase 2B regression) | 21/21 |
| `delivery/compass.integration.test.ts` (Phase 2C regression) | 18/18 |
| `lmsRoutes.http.integration.test.ts` + `create.http.integration.test.ts` (Phase 2A regression) | 47/47 |
| `components/blueprint/BlueprintView.test.tsx` (existing Blueprint page, unaffected) | 1/1 |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (39 pre-existing-pattern warnings; 1 new `react-hooks/set-state-in-effect` warning in `BlueprintReviewWorkspace.tsx`, the same warning class already present in ~10 other files in this codebase) |

A real bug was found and fixed during test-writing, not assumed away: the first `computeAwaitingReview` wiring used `assignments.updated_at` for "new assignment activity," but that column is never touched when a submission is marked — only `assignment_submissions.submitted_at`/`marked_at` change. A dedicated integration test caught this (asserted `awaitingReview` should flip after marking a submission; it didn't), which led to `getLatestSubmissionActivityAt()` being added and wired in instead.

## 12. Static ownership inventory

- **Every caller of `reviewBlueprintAction()`**: exactly one, the existing `POST /api/teacher/blueprint/actions/[actionItemId]/review` route (unchanged). `BlueprintReviewForm.tsx` calls that route via `fetch`, never the function directly.
- **Every writer to `blueprint_action_reviews`**: exactly one, `BlueprintActionReviewRepository#insert` (Phase 2D, unchanged) — confirmed via `grep -rn "from('blueprint_action_reviews')"`, two occurrences, both inside that one repository file (`insert` and `listForActionItem`, the latter a read).
- **Every caller of `getBlueprintActionReviewSnapshot()`**: the existing `GET` route, and internally `reviewBlueprintAction()` itself (both pre-existing, Phase 2D). No UI component calls it directly — components only import its *type*.
- **Every caller of the new `listReviewableBlueprintActionsForLearner()`**: exactly one, the new server page.
- **UI entry points**: the new page (`/teacher/learners/[learnerId]/blueprint/review`), and the new "Review Actions" link on the existing Blueprint page.
- **Direct client-side Supabase access introduced**: none. The only `createClient`/Supabase import among the new/touched UI files is `app/teacher/learners/[learnerId]/blueprint/review/page.tsx`'s `createClient()` from `@/utils/supabase/server` — a **server-side** helper, used inside a server component, never shipped to the browser. Every `'use client'` component in `components/blueprint/review/` reaches the database exclusively via `fetch()` against the existing Phase 2D routes.

## 13. Residual risks

- No teacher-wide "all actions awaiting review" inbox — deferred per the task's own preferred scope; the per-learner workspace is the complete MVP surface for this phase.
- No safe teacher-facing Compass session page exists to deep-link to from `CompassActivitySummary` (the audit found none) — the section shows counts/dates only and does not attempt a link, unlike `AssignmentActivitySummary`, which does link to the existing `/teacher/assignments/[assignmentId]` page.
- Reviewer identity in `ReviewHistory` is shown generically ("Recorded by school staff"), not by name — see §9.
- The learner header omits class/grade context — the Core `learner_enrollments`/`classes`/`grades` read path requires an additional academic-year-scoped lookup with more failure surface than this phase's minimal-scope mandate justified; omitted rather than fetched unreliably.
- No browser-based accessibility/visual regression testing exists for this or any other page in the codebase — a pre-existing gap, not introduced or worsened here.

## 14. Recommendation for the next phase

GO. A natural next slice (not started here, not required by this phase's exit condition) would be a teacher-wide "actions awaiting review" list spanning a teacher's classes, reusing `computeAwaitingReview()` and `listReviewableBlueprintActionsForLearner()`'s per-action shape across multiple learners — deferred exactly as the task brief anticipated.

## 15. Update — 2026-07-26: Phase 3A found the "Review Actions" link was unreachable, and fixed it

Phase 3A (`docs/architecture/blueprint-execution-experience-phase3a.md` §3) discovered, through real HTTP testing, that the "Review Actions" link added in §3 of this document was **never actually reachable by a teacher** — two independent, pre-existing gates (`proxy.ts` middleware and `app/student/layout.tsx`) unconditionally redirected any `teacher`-role viewer away from `/student/blueprint/[learnerId]` (the page this link lives on) before the link itself, or anything else on that page, could ever render. This predates both Phase 2E and Phase 3A; it was not caused by either. Phase 3A fixed it with a narrow, precedented carve-out (teacher/admin-tier viewers only, scoped to `/student/blueprint/<id>` specifically) — the "Review Actions" link, and everything else documented in this file, is now genuinely reachable in production. `listReviewableBlueprintActionsForLearner()` also gained four small, additive DTO fields in Phase 3A (`learnerAction`, `successIndicator`, `latestReviewNotes`, `assignmentId`) — no existing field was changed or removed, and this document's own read-model description remains otherwise accurate.
