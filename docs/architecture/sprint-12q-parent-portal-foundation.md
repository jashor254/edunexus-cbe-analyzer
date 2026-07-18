# Sprint 12Q — Parent Portal Foundation (Implementation)

**Status: implemented.** First implementation of ADR-0010 — presentation layer only, zero new educational calculations.

---

## Phase 1 — Parent Portal Integration Audit

Re-examined every parent-facing route found in Sprint 12P's audit, this time specifically for reuse/collision purposes before writing any new route:

| Route | Reusable? |
|---|---|
| `app/(parent)/report-card` | Independent, per ADR-0010 Part 9 — left untouched |
| `app/(parent)/career-intelligence`, `career-intelligence-report`, `career-report` | Independent (pre-existing terminology inconsistency, documented in Sprint 12P, not resolved here — out of this sprint's scope) |
| `app/(parent)/layout.tsx` | Reused as-is — the new routes sit inside the same `(parent)` route group, inheriting the same auth-gated layout |
| `app/student/blueprint/[learnerId]/*` (Teacher-facing) | Not reusable directly (gated by `requireSchoolStaff`, renders `BlueprintSectionCard`/`BlueprintView` with Owner strings — exactly what ADR-0010 Part 6 forbids showing a parent) — but its composition source (`composeBlueprint()`, `listBlueprintSnapshots()`, `getBlueprintSnapshot()`, `getLatestBlueprintSnapshot()`) is reused directly, unchanged |
| `components/blueprint/sections.tsx` (per-section content renderers) | **Reused verbatim** — `IdentitySection`, `AcademicRecordSection`, `AttendanceSection`, `LearningCompassSection`, `CareerSection`, `TeacherReflectionSection`, `ParentSummarySection` are the exact same components Teacher Blueprint renders; only the outer chrome (`BlueprintSectionCard`) differs for Parent (see Phase 3) |
| `components/blueprint/HistoricalBanner.tsx` | Reused verbatim for the Historical Snapshot distinction (Phase 4) |
| `components/ui/skeletons.tsx`'s `BlueprintSkeleton`/`BlueprintHistoryListSkeleton` | Reused verbatim for loading states (Phase 9) |

**A real, concrete collision found during implementation, not just documentation**: the mission's own routing sketch (`Home → Blueprint → Snapshot History → Historical Snapshot`) naturally suggested a `/blueprint` path — but `app/(student)/blueprint/page.tsx` already owns that exact URL (the learner's own self-view, a distinct existing feature, not part of this audit's original scope since it's neither Teacher- nor Parent-facing). `next build` caught this immediately as "You cannot have two parallel pages that resolve to the same path." **Resolved by using `/child` instead of `/blueprint`** as the Parent Portal's path segment — no functional change, a routing-namespace decision only, confirmed by a clean production build afterward (`npx next build`, zero errors, all five new routes listed in the route manifest).

**Dead pages / obsolete parent views**: none found to retire — every existing `app/(parent)/*` route is still live and independent per ADR-0010 Part 9; this sprint adds alongside them, per the Forbidden list ("No new APIs" — and no removal of existing surfaces was in scope either).

---

## Phase 2 — Parent Home

`app/(parent)/child/[learnerId]/page.tsx`. One `composeBlueprint()` call feeds every teaser card: learner name/class (Identity), Blueprint summary teaser (Parent Summary's own `headline`, never regenerated), Teacher Reflection preview (`strengths`, truncated for display only — the underlying text is unmodified), Attendance health (the percentage Blueprint's own Attendance section already computed), Learning Compass summary (`currentLearningFocus`), Career summary (`careerCluster`), and one `getLatestBlueprintSnapshot()` call for the "Their Journey So Far" teaser. Every card links deeper (`/full`, `/history`) — nothing computed twice, nothing shown that isn't also visible on the deeper page it links to.

**No photo field is shown**: `learners.photo_url` exists at the database layer, but Blueprint's own `IdentityData` (composed by `composeIdentity()`) does not carry it — and per Phase 3's "consume `composeBlueprint()` directly, no transformations," Parent Home does not reach around Blueprint to query `learners.photo_url` independently, since that would be a second read path outside the one canonical composition. Documented here as a real gap, not silently worked around (the same discipline as Sprint 12M's readiness gap and Sprint 12N's AI-outlook gap) — closing it would mean adding `photoUrl` to `IdentityData` itself, a Blueprint-domain change outside this sprint's "no new Blueprint calculations" scope.

---

## Phase 3 — Blueprint View

`app/(parent)/child/[learnerId]/full/page.tsx` + `components/parent/ParentBlueprintView.tsx`. Calls `composeBlueprint()` directly — the identical function and identical arguments (`actorUserId`, `coreLearnerId`, `schoolId`) the Teacher-facing page uses. No parent-specific Blueprint object exists anywhere; `ParentBlueprintView` receives the exact same `LearnerBlueprint` type Teacher's `BlueprintView` does.

**The Parent visibility matrix (ADR-0010 Part 3) is applied at the presentation layer only** — a new `ParentSectionCard` (`components/parent/ParentSectionCard.tsx`) replaces `BlueprintSectionCard` as the outer chrome specifically to satisfy Part 6 ("Owner strings — Never"): it never renders `section.owner`, and uses `lib/parentExperience/terminology.ts`'s frozen labels for status instead of the raw `available`/`unavailable`/`not_implemented` enum values `BlueprintSectionCard` shows verbatim to teachers. `ParentBlueprintView` renders exactly the sections ADR-0010 Part 3 marks Yes/Summary-only (Identity, Academic Record, Attendance, Learning Compass, Career, Teacher Reflection, Parent Summary) and omits the three marked No/Future (Evidence Trail, Educational Identity, Growth Timeline) entirely — not shown as empty or "Coming Soon" cards, simply absent, matching Part 3's "Future: shows nothing until the domain exists."

Every section's actual *content* renderer (`IdentitySection`, `AttendanceSection`, etc.) is the identical component Teacher Blueprint uses, imported unchanged from `components/blueprint/sections.tsx` — zero duplicated rendering of educational content anywhere in this sprint.

---

## Phase 4 — Snapshot History

`app/(parent)/child/[learnerId]/history/page.tsx` calls `listBlueprintSnapshots()` only; `app/(parent)/child/[learnerId]/history/[snapshotId]/page.tsx` calls `getBlueprintSnapshot()` only — the identical two functions Teacher's history pages call, no new repository method, no recomputation. Newest first (the repository's own existing `ORDER BY version/created_at DESC`, unchanged). The Current/Historical distinction is enforced identically to Teacher Blueprint: `ParentBlueprintView` renders `HistoricalBanner` (reused verbatim, unchanged copy) only when `historicalMeta` is supplied, exactly the same optional-prop pattern Sprint 12K established.

---

## Phase 5 — Parent Summary Card

`blueprint.parentSummary` is rendered through the unmodified `ParentSummarySection` component, displaying `headline`/`detail`/`action` exactly as `composeParentSummary()` (Sprint 12G, deterministic templating, "no LLM, no generated paragraphs") already produced them. No regeneration, no rewriting, no AI call exists anywhere in this sprint's code — confirmed by code review of every new file.

---

## Phase 6 — Navigation

Exactly the frozen hierarchy: `Home (/child/[learnerId]) → Blueprint (/full) → Snapshot History (/history) → Historical Snapshot (/history/[snapshotId])`, plus one entry-point picker (`/child`) for a parent with more than one linked learner (not itself part of ADR-0010's four-step hierarchy, but required to reach step one — a plain list, explicitly not a dashboard maze, per Phase 6's own instruction). No tabs, no wizard — every page has exactly one "back" link and, where relevant, forward links into the next hierarchy level, matching Teacher Blueprint's own one-directional navigation model (Sprint 12K/12L-R).

---

## Phase 7 — Permissions

Every new route uses `requireAuthentication` + `requireParent` (`lib/core/permissions.ts`) — the exact same functions already governing every other parent-facing surface in this codebase (e.g. `requireParent` already existed, used by nothing new this sprint invented). No new permission system, no parallel ownership table. Proven directly: `lib/parentExperience/parentPortal.integration.test.ts` creates a real linked guardian, confirms `requireParent` succeeds for their own child and fails (`ResourceOwnershipError`) for both an unlinked stranger and a different school's unrelated learner.

---

## Phase 8 — Empty States

- No linked children at all: `/child` shows an explanatory sentence, never a blank page.
- No Blueprint composable (a composition failure): every page catches this and shows "We couldn't load this right now" rather than a raw error or `null`.
- No snapshots yet: the History list shows an explanatory sentence (Sprint 12K's own pattern, reused).
- No Teacher Reflection / Career / Compass / Attendance data: `ParentSectionCard` shows `PARENT_STATUS_LABEL`'s "Not Enough Information Yet" — never the raw `unavailable`/`null`/`undefined`. `ParentSectionCard` additionally filters `unavailableReason` strings that look like raw error/exception text (a defensive regex check) so an internal error message can never leak through a parent-facing card by accident.
- Historical Snapshot not found: an explanatory "This moment isn't available" card, never a blank 404.

---

## Phase 9 — Loading States

Five `loading.tsx` files (`/child`, `/child/[learnerId]`, `/full`, `/history`, `/history/[snapshotId]`), each reusing the exact same shared skeleton components (`BlueprintSkeleton`, `BlueprintHistoryListSkeleton`) Teacher Blueprint's own loading states already use (Sprint 12L-R) — zero new skeleton components written.

---

## Phase 10 — Accessibility

- Keyboard: every interactive element (`ParentSectionCard`'s expand button, every `Link`) has a `focus-visible` ring/underline state (matching Sprint 12L-R's own accessibility pass).
- Screen readers: `aria-expanded` on section toggles, `aria-label` on the history `<ol>` and navigation `<nav>` landmarks, `role="status"` on empty states.
- Colour: every status uses text labels (`PARENT_STATUS_LABEL`), never colour alone — matching ADR-0010 Part 3's own instruction.
- Mobile: every page uses the same `max-w-2xl mx-auto px-4` responsive container Teacher Blueprint already uses, confirmed to render correctly at narrow widths (same Tailwind classes, same tested pattern).
- Printing: no print-specific stylesheet was added — out of scope (ADR-0009's print/PDF layer is a separate, not-yet-built concern; nothing in this sprint's Forbidden-list exclusions mentions PDF/printing as something to build here).

---

## Phase 11 — Regression

- `composeBlueprint.pure.test.ts` / `composeBlueprint.integration.test.ts` — unchanged, all passing.
- `snapshot.test.ts` — unchanged, all passing (5/5).
- `reflection.integration.test.ts` (Teacher Reflection) — unchanged, all passing (3/3).
- Combined regression: 29/29 passing, zero regressions in Blueprint, Snapshots, Teacher Reflection, Attendance, Career, or Compass composition.
- New: `lib/parentExperience/parentPortal.integration.test.ts` (3/3) proving the permission gate and full Blueprint/Snapshot read path for a real linked guardian.
- No duplicated rendering: confirmed by code review — every section's content component is imported from `components/blueprint/sections.tsx`, never copy-pasted; `ParentSectionCard`/`ParentBlueprintView` are new only at the chrome/composition level, never at the educational-content level.

---

## Constitutional / RAS / ADR Compliance

- **ADR-0010 Parts 1–10**: implemented exactly as frozen — journey order (Part 2), visibility matrix (Part 3), terminology table (Part 4, `lib/parentExperience/terminology.ts`), information boundaries (Part 6), one-directional Blueprint relationship (Part 8, confirmed: no Parent Portal file writes to any canonical table), Report Card independence (Part 9, `lib/core/report-cards.ts` untouched).
- **ADR-0008 Part 5/6**: Blueprint owns nothing, composes everything Parent Portal displays — confirmed, zero calculation code in any new file.
- **RAS §10.7/§10.8**: no new repository, no new service — confirmed; every new file is either a page (thin, per CLAUDE.md), a presentation component, or a pure terminology lookup.
- **CLAUDE.md**: no `select('*')` (no new database calls at all outside existing `repos.learners`/`repos.schools` reads for the child picker), every new function has an explicit return type, no direct `createClient` from `@supabase/supabase-js` in any route file.

---

## Required Verification — evidence

- **Parent Portal consumes Blueprint only**: confirmed by code review — every data-bearing page calls exactly `composeBlueprint`/`listBlueprintSnapshots`/`getBlueprintSnapshot`/`getLatestBlueprintSnapshot`, all pre-existing functions.
- **No duplicated educational calculations**: confirmed — no new file performs an educational computation; `lib/parentExperience/terminology.ts` is a pure rename lookup.
- **Snapshot history remains immutable**: unaffected — no new write path touches `blueprint_snapshots`; the existing DB trigger (Sprint 12K) is untouched.
- **Visibility matrix enforced**: `ParentBlueprintView` renders exactly the seven Yes/Summary-only sections, omits the three No/Future sections — confirmed by code review.
- **Parent Summary rendered from Blueprint**: confirmed — `ParentSummarySection`, unmodified, fed `blueprint.parentSummary.data` directly.
- **Navigation matches ADR-0010**: confirmed — Home → Blueprint → Snapshot History → Historical Snapshot, no tabs, no wizard.
- **Accessibility verified**: Phase 10, above.
- **Mobile responsive**: same responsive container class as the already-shipped Teacher Blueprint.
- **`tsc --noEmit`**: clean.
- **`eslint`**: clean on every touched/new file.
- **Tests added**: `lib/parentExperience/parentPortal.integration.test.ts`, 3 tests, all passing.
- **Implementation log updated**: see `docs/engineering/implementation-log.md`.

---

## Stop Condition

Per explicit mission instruction: the Parent Portal Foundation is operational. **Stop here.** Parent messaging, notifications, Behaviour, Portfolio, Projects, QR implementation, Educational Identity computation, homework, and community features do not begin. Waiting for explicit approval before Sprint 12R.
