# Sprint PRP-2 — Teacher Workspace Foundation Implementation

**Status: IMPLEMENTED.** ADR-0019 (Teacher Workspace Architecture) is approved. This sprint implements only the composition layer it defines — navigation taxonomy, relabeling, and read-only presentation composed from already-canonical domains. No educational domain was redesigned, no new intelligence was computed, and no ownership moved.

**Depends on**: `docs/architecture/adr-0019-teacher-workspace-architecture.md` (approved), `docs/architecture/sprint-prp1-teacher-workspace-foundation.md` (the audit this sprint executes against).

---

## Phase 1 — Full Workspace Audit (re-verified against live code before writing anything)

Re-read every file this sprint touches before editing, confirming PRP-1's findings still held:

- `app/teacher/layout.tsx` — unchanged foundation, correctly wraps every `/teacher/*` route with a single auth/role check. No duplicated authentication introduced or needed.
- `components/teacher/TeacherSidebar.tsx` / `TeacherBottomNav.tsx` — confirmed two independently-maintained item arrays (`NAV`/`SCHOOL_OFFICE_NAV` vs. `CREATE_NAV`/`MORE_NAV`/`SCHOOL_OFFICE_NAV`), exactly as PRP-1 found. This is the duplicated navigation this sprint resolves.
- `app/teacher/dashboard/page.tsx` — confirmed `DashboardDataProvider` only fetches `/api/teacher/attention-feed` and `/api/sow/list` (each once per load, per its own Sprint 5.5 comment) — no existing fetch this sprint's new composition would duplicate.
- `app/teacher/reports/page.tsx` and `app/teacher/core-term/page.tsx` — confirmed the ambiguous "Reports" vs. "End of Term" labeling PRP-1 flagged, live in the actual header/tab copy, not just in navigation.
- `lib/assessments/getters.ts::getPendingAssessments(teacherId)` — confirmed this already exists, is already batched (no per-class loop), and already returns exactly the "marks not yet entered" set a new Assessment section needs — no new repository method required.
- `components/attendance/attendanceClient.ts` — confirmed this is the one shared client-fetch layer the Attendance workspace page already uses; reused as-is for My Day's attendance composition rather than adding a second fetch layer or a new `lib/core/attendance.ts` function.
- `app/teacher/insights/page.tsx` — confirmed it exists, fully built, with genuinely zero nav entry anywhere — the only change it needed was a nav link, not new code.

**Implementation map** (file → what changed → why):

| File | Change | Why |
|---|---|---|
| `lib/config/teacherWorkspaceNav.ts` (new) | Single canonical nav taxonomy | Replaces two drifted, independently-maintained arrays |
| `components/teacher/TeacherSidebar.tsx` | Consumes shared taxonomy | Removes duplicated item list |
| `components/teacher/TeacherBottomNav.tsx` | Consumes shared taxonomy via `createSheetItems()`/`moreSheetItems()` | Same |
| `app/teacher/reports/page.tsx` | Header/copy relabeled to "Parent Reports", cross-link to Official Report Cards | Resolves PRP-1's sharpest finding |
| `app/teacher/core-term/page.tsx` | Header/copy relabeled to "Official Report Cards", cross-link back | Same |
| `app/teacher/assessment/page.tsx` (new) | Thin composition of `getPendingAssessments()` + a link to `/teacher/core-term` | PRP-1 found no unifying Assessment nav entry existed |
| `app/teacher/dashboard/page.tsx` | Added `TodayAtAGlance` strip + `getPendingAssessments()` call | My Day composition (Phase 3) |
| `components/teacher/TodayAtAGlance.tsx` (new) | Composes attendance-today status, pending assessments, Insights link | Pure composition, reuses existing `attendanceClient.ts` |
| `app/teacher/attendance/page.tsx` | Added operating-mode badge | Phase 5 — Paper/Hybrid/Digital presentation |
| `lib/config/attendanceOperatingMode.ts` (new) + `.test.ts` | Pure recency-heuristic function, extracted for testability | Phase B "every feature must include tests" |

No duplicated loading, authentication, or data fetching was found or introduced. No canonical service was bypassed — every new read calls an existing exported function (`getPendingAssessments`, `attendanceClient.ts`'s existing exports).

---

## Phase 2 — Teacher Workspace Shell

`app/teacher/layout.tsx` is unchanged — per ADR-0019 §8, the working shell was retained, not replaced. The shell now exposes exactly the ADR-0019 sections through `TEACHER_WORKSPACE_NAV` (`lib/config/teacherWorkspaceNav.ts`): My Day, My Classes, Teaching (Scheme of Work / Lesson Plans / Record of Work), Attendance, Assessment, Parent Reports, Official Report Cards, Insights, Teaching Tools (Documents, Booklets, Assignments, AI Slides, Insha Feedback, Analytics, AI Academy), Alerts, Settings. No extras were added and no placeholders were invented — every entry links to a route that already existed and already worked before this sprint (with the sole exception of the new, genuinely-composed `/teacher/assessment` index).

## Phase 3 — My Day

`TodayAtAGlance` (new) composes three already-existing signals into one strip on `/teacher/dashboard`, directly under Today's Mission:

- **Attendance Today** — "Marked for N of M classes," derived by calling the same `attendanceClient.ts` functions the Attendance workspace page already uses (`fetchMembership`, `fetchClasses`, `listSessionsForClass`), comparing session dates to today. No new query path.
- **Assessment** — pending-marks count from the already-existing `getPendingAssessments(teacherId)`.
- **Insights** — a static link, since Insights itself needed no new data, only a way to be found (PRP-1 finding).

No new calculation was written for any of these — every number is either counted/compared from data an existing endpoint already returns, or is a direct pass-through.

## Phase 4 — Insights

`lib/adaptiveLearning`, `lib/projection`, `lib/career`, and `lib/compass` were not touched. The only change is a navigation entry (`/teacher/insights` added to `TEACHER_WORKSPACE_NAV`) and a My Day teaser link — presentation only, exactly as ADR-0019 §6 specifies. No second intelligence engine, no duplicate recommendation logic, no new computed field was introduced anywhere in this sprint.

## Phase 5 — Paper → Hybrid → Digital

Implemented for Attendance only, as a presentation badge (`lib/config/attendanceOperatingMode.ts`, unit-tested — 6 passing tests). The function takes attendance-session dates the Attendance page already fetched and derives a label:

- `Digital — marked live today` (most recent session is today)
- `Hybrid — last entry N days ago` (1–3 days)
- `Catching up — last entry N days ago` (4+ days) / `No sessions recorded yet`

**Attendance's underlying recording mechanism was not touched or redesigned** — it remains exactly the digital-only capture flow PRP-1 found. This badge only names, honestly, how recently that flow has actually been used, so a teacher is never told "live" when entries are in fact lagging (the paper-first-school risk PRP-1 named).

## Phase 6 — Navigation Cleanup

- "Reports" → **"Parent Reports"** (`app/teacher/reports/page.tsx` header + nav label), with a cross-link to Official Report Cards.
- "End of Term" → **"Official Report Cards"** (`app/teacher/core-term/page.tsx` header + nav label + breadcrumb), with a cross-link back to Parent Reports.
- Both nav entries also carry a one-line `hint` (rendered under the label in the sidebar) — "WhatsApp / email / clinic PDF" vs. "Lock, generate, publish" — so the distinction is visible without a click.
- Desktop sidebar and mobile bottom-nav now render from the same `TEACHER_WORKSPACE_NAV` array — no more independently-drifting groupings.
- No route was moved, renamed, or deleted. No dead navigation was found to have been introduced.

## Phase 7 — Admin Separation

`core-office`/`core-team`/`core-admissions` were **not moved** — that relocation is explicitly out of this sprint's scope (ADR-0019 §3/§10, deferred to a future School Office ADR). What this sprint verified: `SCHOOL_OFFICE_NAV_ITEM` is still appended to the nav array only when `isAdminTier` is true (both in `TeacherSidebar` and via `moreSheetItems(isAdminTier)`), exactly as before this sprint — no additional administrative destination was newly exposed to non-admin teachers, and none of the nine primary Workspace sections point at an admin-tier route. `core-term` (a legitimate teacher-facing section, per PRP-1) remains in the main nav, now clearly labeled "Official Report Cards" rather than under the ambiguous School-Office-adjacent "End of Term" name.

## Phase 8 — Performance

Audited for duplicate composition before and after:

- **My Day**: `DashboardDataProvider` still fetches `/api/teacher/attention-feed` and `/api/sow/list` exactly once each (unchanged). `TodayAtAGlance`'s fetches (membership, classes, attendance sessions) are new but not duplicates of anything else fetched on that page — nothing else on `/teacher/dashboard` reads Attendance or pending-assessment data.
- **No Blueprint, Compass, or Career read was added, moved, or duplicated** — this sprint touches none of those modules.
- **No canonical service was bypassed** — every new read goes through an existing exported function (`getPendingAssessments`, `attendanceClient.ts`).
- **No query-in-a-loop was introduced** — `getPendingAssessments` was already batched server-side; `TodayAtAGlance`'s per-class session fetches use `Promise.all` against an already-existing per-class API route, the same pattern the Attendance workspace page itself already uses (not a new anti-pattern, an existing one reused consistently).

## Phase 9 — Kenyan Classroom Walkthrough (re-verified after implementation)

- **Arrival**: My Day now shows Attendance/Assessment/Insights status in one glance, not zero.
- **Before first lesson**: Teaching items are still three routes (unchanged — reordering the actual guided-flow UI inside Scheme of Work/Lesson Plans/Record of Work was named in ADR-0019 §10 as a separate future sprint, PRP-5, not this one's scope).
- **Break, entering marks**: a teacher can now reach marks entry via a real "Assessment" nav item instead of only through a class drill-down.
- **End of term**: the single sharpest risk PRP-1 found — clicking the wrong "Reports" item — is now mitigated by distinct labels, hints, and cross-links between the two pages.
- **"Was the parent told"**: unchanged — this remains a named, separately-gated future gap (PRP-1 finding, not in this sprint's scope).

Every transition a teacher takes through the nine sections now resolves to a page that either already worked, or (Assessment) is a genuinely new but minimal composition — no dead links, no placeholders.

---

## Verification

- `npx tsc --noEmit` — clean, exit 0.
- `npx eslint` on every touched file — 0 errors (3 pre-existing warnings in files this sprint touched, none introduced by this sprint's changes — confirmed by diffing warning locations against the edits made).
- `npx tsx --test lib/config/attendanceOperatingMode.test.ts` — 6/6 passing.
- No duplicated intelligence computation, Blueprint composition, or authentication was introduced (Phase 8, Phase 1).
- No new canonical domain, table, or ownership was introduced.

## Stop Condition Reached

Shell formalized, navigation cleaned, My Day composed, existing domains integrated via composition only, documentation written, verification passed. Per the mission's explicit instruction, PRP-3, mobile optimization, offline sync, notifications, and any further teacher-facing feature work are out of scope and not started.
