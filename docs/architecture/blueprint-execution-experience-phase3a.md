# Blueprint Execution Experience — Phase 3A

**Date:** 2026-07-26
**Scope:** Turn the existing Blueprint action architecture (Phases 1–2E) into one coherent, pilot-ready, commercially demonstrable teacher workflow. No new intelligence engine, no change to Evidence/Projection calculations, no change to the action/delivery/review lifecycle models, no parent/learner dashboards, no holiday-plan convergence, no teacher-wide analytics, no automatic review conclusions.

---

## 1. Executive verdict

**DONE — GO for the next Blueprint phase.**

An authorized teacher can now open a learner's Blueprint, see a new "Blueprint Action Plan" section listing every approved action with its delivery/activity/review status, deliver it to Assignment or Compass through the existing Phase 2B/2C endpoints via two focused panels, and jump straight into the existing Phase 2E Review Workspace — all from one page, with no manual navigation, hidden identifiers, or internal terminology exposed. All writes still pass through the unmodified canonical services; this phase introduces zero new writers. A real, pre-existing bug that silently blocked teachers from ever reaching this page at all (§3) was found and fixed during this phase's own testing, without which nothing built here — or in Phase 2E — would have been reachable.

## 2. Product-flow audit

- **Every route the teacher currently had to visit** to complete this workflow, before this phase: the class roster (to find the "Blueprint" link), `/teacher/reports/blueprint/[studentId]` (a redirect shim), the shared Blueprint page (read-only), then out to `/teacher/assignments/new` (a full, unrelated page, to manually recreate the action as an assignment by hand — no connection back to the action item at all) or nowhere at all for Compass (no UI existed), then separately to the Phase 2E Review Workspace (a different page, requiring the teacher to remember which action they meant), with no link back showing the result on the Blueprint itself.
- **Manual/hidden steps required**: the teacher had to manually re-type the assignment title/instructions from the action's own text (no prefill existed anywhere), had no way to see whether an action had already been delivered without navigating away, and had no way to send an objective to Compass at all — the only Compass UI in the app (`CompassTopicPicker` inside the class roster) is a different feature entirely (ordinary "recommend a topic," unconnected to Blueprint actions).
- **Delivery APIs existing without UI**: both `POST .../deliver-assignment` (Phase 2B) and `POST .../deliver-compass` (Phase 2C) were fully built, tested, and production-ready, with zero UI calling either — confirmed by grep before this phase began.
- **Fragmentation**: action content lived on the Blueprint page; delivery status lived nowhere visible; review status lived only in the separate Review Workspace; a teacher had no single place to answer "what's the state of this action right now."
- **Smallest UI integration**: add one new section to the existing Blueprint page (not a new hub), reusing the Phase 2E list read (`listReviewableBlueprintActionsForLearner`) that already carries delivery+review state per action, adding two focused delivery panels that call the existing endpoints directly.
- **API response needing a thin DTO enhancement**: yes — `ReviewableActionListItem` (Phase 2E) was missing `learnerAction`, `successIndicator`, `latestReviewNotes`, and `assignmentId`, all already available in the same row the function already reads (§4). No new endpoint was created.
- **Existing forms reusable**: `/api/teacher/classes` (the class-list endpoint behind `app/teacher/assignments/new`) is reused verbatim for the Assignment-delivery panel's dropdown — no new class-list endpoint. The assignment-creation *page* itself was not reused directly (it's a full page, not a panel, and duplicating its markup into a modal would have meant carrying its KICD substrand search/quiz-toggle complexity that this phase's minimal delivery form doesn't need) — its Tailwind conventions were followed instead.

## 3. A confirmed, pre-existing usability blocker found and fixed

Before any of the above could matter, real HTTP testing during this phase found that **a teacher could never reach `/student/blueprint/[learnerId]` at all** — the page Phase 2E's own "Review Actions" link already pointed to, and the page this phase's entire workflow depends on. Two independent, pre-existing gates both unconditionally redirected any `teacher`-role viewer away before the page's own (correct, already-designed-for-teacher-access) `requireLearnerAccess` check ever ran:

1. `proxy.ts` middleware's `/student` branch: `if (roles.primary !== 'student') redirect(...)`.
2. `app/student/layout.tsx` (defense-in-depth, wrapping the same route tree): `if (roles.primary === 'teacher') redirect('/teacher/dashboard')`.

This is a genuine contradiction in the shipped codebase, not a design choice to respect: `app/student/blueprint/[learnerId]/page.tsx`'s own header comment says it was "originally reached only from Teacher Workspace," and its access check (`requireLearnerAccess`) explicitly admits "teacher-of-record" — yet both gates guarding its route unconditionally blocked every teacher. Confirmed via `redirect: 'manual'` fetches during this phase: a real teacher account requesting `/student/blueprint/[learnerId]` received a 307 to `/teacher/dashboard`, every time.

**Fix — the smallest possible carve-out, in both places, narrowly scoped to `/student/blueprint/<id>` and its subpaths only** (never the bare `/student/blueprint` self-service redirect route, which correctly stays teacher-blocked — a pre-existing regression test, `lib/testing/studentPageRouting.http.integration.test.ts`, initially caught this exact over-broad-match mistake and was the reason the path check was narrowed to require a trailing slash):

- `proxy.ts`: when `pathname.startsWith('/student/blueprint/')` and the viewer is a teacher (or admin-tier staff — mirroring the identical, already-existing `/teacher/core-office` carve-out shape in the same file), the request proceeds with a forwarded `x-blueprint-teacher-viewer: 1` request header instead of being redirected.
- `app/student/layout.tsx`: reads that header via `next/headers`'s `headers()` and skips its own teacher-redirect only when the header is present — every other `/student/**` page keeps its unconditional redirect, unchanged.

This is not a new authorization mechanism — `requireLearnerAccess` (page-level) remains the actual, fine-grained, authoritative gate exactly as it already was; the fix only stops two coarse, redundant upstream gates from preventing a legitimately-authorized teacher from ever reaching that check. Proven via the full pre-existing `studentPageRouting.http.integration.test.ts` suite (28/28, unchanged pass) plus this phase's own new end-to-end test.

**A parallel, structurally identical gap exists for `parent`-role viewers** (`app/student/layout.tsx` also unconditionally redirects `primary === 'parent'`, and `requireLearnerAccess` equally admits parents) — deliberately **not fixed here**, staying strictly inside this phase's teacher-only scope ("Do not add parent or learner dashboards"). Flagged in §14 as a residual, pre-existing finding for a future, separately-scoped decision.

## 4. Chosen integration architecture

- **Page**: the existing `app/student/blueprint/[learnerId]/page.tsx` remains the entry point — no new learner hub, no new dashboard. A new, staff-only fetch (`listReviewableBlueprintActionsForLearner`, gated on `primary === 'teacher'`, with its own `ResourceOwnershipError` caught and the section simply omitted rather than breaking the page for a legitimate parent/student viewer) feeds a new `<BlueprintActionPlanSection>`.
- **Component tree**: `components/blueprint/actionPlan/` — `BlueprintActionPlanSection` (client, owns which delivery panel is open), `BlueprintActionPlanCard` (one action, pure presentation), `AssignmentDeliveryPanel` / `CompassDeliveryPanel` (client, each calling exactly one existing endpoint), `actionCardPresentation.ts` (pure derivation helpers, no React, no I/O).
- **Review deep-link**: `BlueprintReviewWorkspace` (Phase 2E) gained an optional `initialSelectedActionId` prop, read from a new `?action=<id>` query param on `/teacher/learners/[learnerId]/blueprint/review` — so a card's "Review progress" link lands the teacher on the exact action they clicked from, not the workspace's default first item. Falls back to the original default behavior exactly when the param is absent or names an action not in the list.

## 5. Action-card presentation model

`components/blueprint/actionPlan/actionCardPresentation.ts` — pure functions over `ReviewableActionListItem`, no persistence, no `blueprint_action_items.status` mutation, no new review decisions:

- `deriveDeliveryPresentation()` → `not_delivered | assignment_only | compass_only | both`, a straightforward read of the two existing booleans.
- `recommendNextAction()` → exactly one of `{ label, kind: 'deliver'|'await'|'review'|'none' }`, priority-ordered per the task's own worked examples (undelivered → "Choose delivery"; delivered with no activity → "Await learner activity"; Needs Revision → "Review or prepare revised action"; Defer → "Review when ready"; activity newer than the latest review → "Review progress"; Complete with nothing newer → "No immediate action"; anything else → "Review progress," never a silent "no action" for a non-Complete decision). Purely navigational — proven by a static scan that this file has no writer imports and never assigns `.status`.
- `deriveActionCardPresentation()` bundles both into one deterministic, idempotent read (two calls on the same item produce `deepEqual` output — tested directly).

**Approval status and latest review are always rendered as two separate, separately labeled facts** (`BlueprintActionPlanCard`: "Approval status: Approved" / "Latest teacher review: Needs Revision") — never merged, proven by a rendering test asserting both substrings appear independently.

## 6. Assignment-delivery experience

`AssignmentDeliveryPanel.tsx` — a modal (`role="dialog"`, `aria-modal`, focus moves to the class `<select>` on open, Escape closes) collecting: class (dropdown from the existing `GET /api/teacher/classes`, already session-scoped to the signed-in teacher's own classes only), an explicit, never-preselected "I confirm this assignment will be issued to the whole selected class" checkbox, title, subject, topic, learner-facing instructions, and a due date (`min` = today). The exact required sentence — "This assignment will be issued to every learner in the selected class." — renders as a standalone `role="alert"` block above the form, never folded into muted helper text.

Title/instructions **prefill** deterministically, mirroring (never re-implementing) `mapActionToAssignmentDraft`'s own formula (`learnerAction || intendedOutcome`, plus a "Success looks like: …" line) — the teacher sees exactly what the server would derive if left blank, and can edit before submitting. Subject/topic are never prefilled — Blueprint has no reliable subject/topic data, matching Phase 2B's own architecture decision, and this form doesn't invent one.

Submits ONLY to `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment` — never calls `createAssignment()` or touches `assignments` directly (proven by static scan). On success (`201` new delivery or `200` idempotent replay, both handled identically — `alreadyDelivered` distinguishes them only for the confirmation message) the parent section updates the card in place, shows a "View assignment →" link to the existing `/teacher/assignments/[assignmentId]` page, and revalidates the server-rendered list via `router.refresh()`.

## 7. Compass-delivery experience

`CompassDeliveryPanel.tsx` — same modal shape, deliberately **no class or learner selector anywhere in the form** (proven structurally: the request body has no such field, and a rendering test asserts no `<select>` exists in this component at all) — the learner is always the action item's own `learner_id`, resolved server-side, never client-supplied. Collects: subject (free text — no reliable Blueprint source, matching Phase 2C's own decision), a learner-facing objective and optional instructions (both prefilled with the identical mirrored formula used by the Assignment panel), and the required, never-preselected confirmation checkbox, with the exact required sentence — "This will make the approved objective available in Learning Compass for this learner. It will not start a tutoring session automatically." — rendered as a standalone alert.

Submits ONLY to `POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass`. A `404` whose body matches `/compass/i` (the `IdentityResolutionError` case — "this learner has no Compass identity yet") is caught and shown as a distinct, honest, non-technical message rather than a generic error. On success the card shows "Delivered to Compass" — no new Compass session viewer was built (none existed to link to, confirmed by the audit; §14).

## 8. Review integration

Every card with at least one delivery shows a "Review progress →" link straight into the existing Phase 2E workspace, deep-linked to the specific action (`?action=<id>`, §4). Where a review exists, the card shows the decision (color-coded pill, reusing Phase 2E's own `DECISION_LABEL`/`DECISION_BADGE_CLASS` — no new vocabulary), its timestamp, and a concise excerpt of the educator's note — all from the same list read, no second fetch. The full append-only history remains one click away in the workspace itself, unmodified.

## 9. Recommended-next-action helper

Covered in full in §5 — `recommendNextAction()`. Confirmed, by explicit unit test, that it never approves, delivers, reviews, writes Evidence, recomputes a Projection, or claims success; its output is display text only, recomputed fresh on every render, never persisted anywhere.

## 10. Authorization and privacy

Every endpoint the UI calls (`/api/teacher/classes`, the Phase 2B/2C/2D routes) continues to authorize independently server-side — the UI is never treated as the boundary. The class dropdown can only ever list classes the signed-in teacher already owns (session-derived, not client-supplied); even if a client attempted to submit an unlisted `classId`, `deliverBlueprintActionAsAssignment`'s own `requireClassTeacher` check (Phase 2B, unchanged, already regression-tested) independently rejects it. The Compass panel has no field capable of naming a different learner at all — proven structurally, not just by convention. `BlueprintActionPlanCard`/`Section`/both panels were statically scanned and contain zero references to `teacherNotes`, `parentSupport`, or `evidenceBasis` — fields the DTO they consume doesn't carry in the first place (TypeScript-enforced, not just a rendering choice).

Real HTTP proof, this phase's own test (`blueprintExecutionExperience.page.http.integration.test.ts`): an authorized teacher sees the Action Plan section and its undelivered state; a parent viewing the identical URL never sees it, or any delivery control; an end-to-end real delivery through the actual Phase 2B endpoint is reflected correctly on the next page load. Every existing Phase 2B/2C/2D authorization matrix (unrelated teacher, cross-school teacher, parent, learner, idempotent-retry isolation) remains proven by its own already-passing suites, unmodified and re-run clean by this phase (§11) — this phase adds a UI on top, not a second copy of that matrix.

## 11. Accessibility and responsive behavior

Semantic headings (`<h2 aria-labelledby>` per section), native `<select>`/`<input type="checkbox">`/`<input type="date">` controls throughout (no custom widgets), labelled form controls (`htmlFor`/`id` pairs via `useId()`), focus moved to the first field when a delivery panel opens, Escape-key close (a deliberate improvement over this codebase's only two prior modal precedents, neither of which had it), `role="alert"` for warnings/errors, `role="status"` + `aria-live="polite"` for success confirmations, and status meaning always paired with text (decision pills, "Needs attention," delivery labels — never color alone). Layout: `grid-cols-1 lg:grid-cols-[...]` in the Review Workspace, and a simple vertical card stack (no side-by-side field requirement, no fixed-width tables) in the new Action Plan section and both delivery panels, scrollable (`max-h-[90vh] overflow-y-auto`) for small viewports.

## 12. Test results

| Suite | Result |
|---|---|
| `actionCardPresentation.test.ts` (pure logic + static scans) | 16/16 |
| `actionPlanComponents.test.tsx` (static rendering, cards + both panels) | 17/17 |
| **Phase 3A UI/logic total** | **33/33** |
| `blueprintExecutionExperience.page.http.integration.test.ts` (real HTTP, the actual workflow end-to-end) | 3/3 |
| `reviewWorkspace.mapping.test.ts` + `reviewWorkspace.integration.test.ts` (Phase 2E regression) | 24/24 |
| `reviewWorkspace.page.http.integration.test.ts` (Phase 2E regression) | 5/5 |
| `review.mapping.test.ts` + `review.integration.test.ts` (Phase 2D regression) | 36/36 |
| `review.http.integration.test.ts` (Phase 2D regression) | 6/6 |
| `delivery/assignment.integration.test.ts` + `.http.integration.test.ts` (Phase 2B regression) | 27/27 |
| `delivery/compass.integration.test.ts` + `.http.integration.test.ts` (Phase 2C regression) | 25/25 |
| `lmsRoutes.http.integration.test.ts` + `create.http.integration.test.ts` (Phase 2A regression) | 47/47 |
| `components/blueprint/review/*` + `BlueprintView.test.tsx` (Phase 2E/pre-existing regression) | 37/37 |
| `lib/testing/studentPageRouting.http.integration.test.ts` (pre-existing routing regression — critical given §3's fix) | 28/28 |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | 0 errors (39 pre-existing-pattern warnings, unchanged count from Phase 2E) |

**269 tests total, all passing.** No connectivity issues this session — no `ETIMEDOUT`/`fetch failed`/`429` encountered; no infrastructure retry was needed.

## 13. Static ownership inventory

- **Direct `.insert`/`.update`/`.upsert`/`.delete` calls anywhere in Phase 3A's files** (`components/blueprint/actionPlan/*`, the Blueprint page edit, `reviewWorkspace.ts`'s additions): **zero** — confirmed by grep across the entire directory.
- **Callers of `deliverBlueprintActionAsAssignment()` / `deliverBlueprintActionToCompass()` / `reviewBlueprintAction()`**: unchanged from Phase 2B/2D — exactly their existing routes. No Phase 3A file calls any of them directly; the panels only `fetch()` the routes.
- **Writers of `assignments`**: unchanged — `AssignmentRepository#createAssignmentRecord`, called only from `lib/assignments/create.ts`.
- **Writers of `blueprint_compass_deliveries`/Compass objective**: unchanged — `setTeacherSuggestedTopic()`, called only from the ordinary `compass-topic` route and the Phase 2C delivery adapter.
- **Writers of `blueprint_action_reviews`**: unchanged — `BlueprintActionReviewRepository#insert`, the sole write path, confirmed by grep (two occurrences, both inside that one repository file — insert and a read).
- **`blueprint_action_items` updates**: zero new call sites — confirmed by grep for `.update`/`updateContent`/`recordDecision` outside `lifecycle.ts`.
- **New learner-scoped reader**: `listReviewableBlueprintActionsForLearner()` (Phase 2E, extended in this phase with four additive DTO fields) — callers unchanged in kind (the Review Workspace page, now also the Blueprint page).
- **New UI entry points**: the "Blueprint Action Plan" section on the existing Blueprint page; no new routes.
- **Direct client-side Supabase access introduced**: none — the only Supabase import among all Phase 3A files is the pre-existing Phase 2E server page's server-side `createClient()`.

## 14. Pilot demonstration instructions

**Update (2026-07-26, Phase 3B, reduced scope):** the abstract sequence below is now also available as a repeatable, idempotent script — `npm run seed:blueprint-demo` — against a real, named reference-school learner. See `docs/architecture/blueprint-pilot-demonstration-phase3b.md` for the concrete version of this section and of §16's demonstration narrative.


**Preparing a demo learner** (using this codebase's existing reference-school seed conventions and normal services — no production-only bypass):

1. Seed or select a learner with real, persisted Evidence (`persistEvidenceBatch`, via the reference-school seed scripts or the normal ingestion path) covering at least one subject.
2. Confirm a persisted Projection exists (`recomputeLearnerProjection`, already triggered by the normal evidence pipeline — no manual step needed beyond having evidence).
3. Propose and approve one Blueprint action item for that learner (`proposeBlueprintAction` → `approveBlueprintAction`, both existing Phase 1 functions, reachable via the normal teacher flow once a UI exists, or directly via the service for seed purposes).
4. Deliver it — via this phase's own new UI — to Assignment or Compass.
5. Generate at least one piece of real learner activity (a real assignment submission, or a real Compass session) so the "learner activity" section of the demo has something honest to show — **this cannot be faked**; the script below states plainly where it's required.
6. Record a real educator review through the existing Review Workspace.

**Five-minute demonstration script** (real functionality only, per the task's own instruction — no fabricated live interaction):

1. Open the learner's Blueprint (`/student/blueprint/[learnerId]`, as the demo teacher account).
2. Point to the Evidence-backed learner need already visible on the Blueprint itself (unchanged, Phase 1-era content).
3. Scroll to "Blueprint Action Plan" — show the approved action card: what was agreed, why.
4. Click "Send to Learning Compass" (or "Create class assignment") — show the required confirmation copy, submit, and the card updating to "Delivered."
5. **(Requires the activity prepared in step 5 above — do not attempt this live without it.)** Point to "Learner activity: Recorded" on the card, or note honestly that it's still "No learner activity recorded yet" if demonstrating a fresh delivery.
6. Click "Review progress" — lands directly in the Review Workspace for that exact action.
7. Walk through the Assignment/Compass activity summary, latest Evidence, and current Projection sections (all Phase 2D, unmodified).
8. Record a decision — show the disclaimer sentence, submit, and the new review appearing.
9. Return to the Blueprint page — show the card now reflecting "Latest teacher review: [decision]," distinct from "Approval status: Approved."

## 15. Residual risks

- **The parallel parent-access gap** (§3) — `app/student/layout.tsx` still unconditionally blocks `parent`-role viewers from the entire `/student/**` tree, including Blueprint, despite `requireLearnerAccess` already admitting them. Deliberately not fixed here (out of this phase's teacher-only scope) — flagged as a real, pre-existing, separately-scoped finding.
- **No safe teacher-facing Compass session viewer exists** to link a delivered Compass action to (confirmed by the audit) — `CompassActivitySummary`/the card show counts and dates only; a future phase could add a minimal, safe session-summary page.
- **The `StudentLayout` chrome** (`DashboardNavbar isStudent`) still renders around the Blueprint page for the newly-admitted teacher viewer — cosmetically imperfect (student-oriented nav wrapping a teacher view) but functionally correct; redesigning that chrome was judged out of scope (risking "redesign the teacher dashboard," explicitly forbidden) and is noted, not fixed.
- **Reviewer identity** on the card (inherited from Phase 2E) still shows generically ("Recorded by school staff"), not by name — unchanged, same reasoning as documented in Phase 2E.
- **No demo-data automation was built** — §14's script relies on existing seed scripts and real service calls; a one-command "prepare a pilot demo learner" script was judged unnecessary scope for this phase (a documented manual sequence over existing services is sufficient and safer than adding a new script surface).

## 16. Commercial demonstration narrative

Before this phase, a school demonstration of the Blueprint architecture required narrating internal machinery ("there's a delivery adapter," "the provenance link," "the review is append-only") because no single screen showed the whole story. After this phase, the same five-minute walkthrough is: *this is what the learner needs → this is what we agreed to do → here's where we sent it → here's whether the learner engaged → here's what the evidence shows → here's the teacher's professional judgement → here's what happens next.* Every one of those seven questions (the commercial experience invariant this phase was scoped against) is answerable from the one page and its one linked workspace, in plain language, without the teacher ever needing to know what a "canonical service" or a "provenance link" is.

## 17. Recommendation for the next phase

GO. The natural next slice — not started here, not required by this phase's exit condition — is the teacher-wide "actions awaiting review" inbox explicitly deferred by Phase 2E, now with a proven, reusable presentation-model pattern (`computeAwaitingReview`, `recommendNextAction`) to build it from. The parent-access gap noted in §15 is a second, independent candidate worth a dedicated, small decision before any parent-facing Blueprint work begins.
