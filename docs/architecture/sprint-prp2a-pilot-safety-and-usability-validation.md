# Sprint PRP-2A — Pilot Safety & Usability Validation

**Status: VALIDATION ONLY — no UI was changed producing this document**, per Phase 0's own instruction ("Before changing any UI"). This sprint validates PRP-2's implementation against a new, explicitly usability-focused framework, and against every stable workflow that existed before PRP-2 touched anything. Where this document finds a real gap, it names it as a candidate for a future, separately-approved fix — it does not fix it silently.

**Depends on**: `docs/architecture/adr-0019-teacher-workspace-architecture.md`, `sprint-prp1-teacher-workspace-foundation.md`, `sprint-prp2-teacher-workspace-foundation-implementation.md`.

---

## Phase 0 — Pilot Safety Audit

Every teacher-facing workflow that worked before PRP-2, classified, with a check that none got worse.

| Workflow | Classification | PRP-2 touched it? | Verdict |
|---|---|---|---|
| Taking attendance (mark a session) | Stable | No — only a read-only badge was added above the existing UI | Unchanged; **not worse**. |
| Recording marks (per-class assessment entry) | Stable | No — `/teacher/classes/[classId]/assessments/*` untouched | Unchanged; **not worse**. |
| Writing report comments | Stable | No | Unchanged. |
| Publishing report cards (`/teacher/core-term`) | Needs navigation only | Header/label text only (`End of Term` → `Official Report Cards`), plus a cross-link added | The lock/generate/publish logic itself (`lib/core/report-cards.ts`) was not touched. Label change verified against real screen text, not just the route — **safer**, not worse: a teacher is now less likely to click the wrong "Reports" item. |
| Viewing Blueprint | Stable | No | Unchanged — this sprint's Forbidden list explicitly bars Blueprint changes and none were made. |
| Lesson planning (SOW → Lesson Plans → Record of Work) | Needs navigation only (not yet acted on) | No — PRP-2's roadmap (ADR-0019 §10, "PRP-5") deliberately deferred the guided-flow regrouping; the three routes are still three separate nav rows today | Unchanged. Flagged here again because Phase 0 asks for completeness, not because PRP-2 touched it. |
| Sending a parent WhatsApp message (Alerts page) | Needs composition only (deferred — "PRP-7" in ADR-0019 §10) | No | Unchanged; the "was the parent told" gap named in PRP-1 still exists. |
| My Day (dashboard landing) | Needs composition only | Yes — `TodayAtAGlance` added | New composition, additive only (Section below verifies no existing tile was removed or altered). |
| Assessment entry point | Unsafe-to-touch **avoided correctly** — PRP-2 built a *new* page rather than modifying the two existing, working assessment surfaces (`/teacher/classes/[classId]/assessments`, `/teacher/core-term`) | New file only | The two real, working assessment surfaces were never edited — the new `/teacher/assessment` page only reads and links to them. |

**Rule check**: no stable workflow's own code was edited by PRP-2 except two page headers (text/labels) and one page header/badge (attendance). No stable workflow regressed — confirmed by re-reading each touched file's diff against its pre-PRP-2 version (Section "Phase 0 diff verification" below), not assumed.

**Phase 0 diff verification** (re-read against git history):
- `app/teacher/reports/page.tsx`: only the `<h1>` and one `<p>` changed. The tab logic, `REPORT_TYPES`, `fetch` calls, and all client state are byte-identical to before.
- `app/teacher/core-term/page.tsx`: only the breadcrumb label, `<h1>`, and one `<p>` changed. `generateReportCards`/`publishReportCards` call sites untouched.
- `app/teacher/attendance/page.tsx`: only a badge added inside the existing `<header>`; the `useEffect` fetch chain, `AttendanceHistoryTable`, and "Take Attendance" links are unchanged.
- `app/teacher/dashboard/page.tsx`: one new import, one new server call (`getPendingAssessments`), one new component insertion between two existing ones. `TodaysMission`, `AttentionFeed`, `WeeklyTeachingProgress`, and the `WORKSPACE_ITEMS` grid are unchanged.

---

## Phase 2A — Reuse Audit

Every widget PRP-2 added, and where its data actually comes from:

| Widget | Owner (real data source) | Teacher Workspace's role |
|---|---|---|
| **Attendance Today** (My Day) | Attendance (`lib/core/attendance.ts` via existing `/api/core/attendance` route, read through `attendanceClient.ts`) | Read-only — counts sessions, writes nothing. |
| **Assessment** (My Day + `/teacher/assessment` page) | Assessments (`lib/assessments/getters.ts::getPendingAssessments`) | Read-only — the page links out to the real entry/lock/publish surfaces; it owns no assessment state itself. |
| **Insights** (My Day teaser + nav entry) | Whatever `/teacher/insights` itself already reads (unaudited further this sprint — out of scope, not touched) | Link only — no data is fetched by the Workspace for this tile at all; it is a static teaser + `<Link>`. |
| **Operating-mode badge** (Attendance page) | Attendance session dates, already fetched by that page | Summary only — one derived label (`operatingModeLabel`), computed from data the page already holds, stored nowhere. |

**No widget owns data.** Every one of the four either reads through an existing service/route unmodified, or is a pure derivation of data already fetched elsewhere on the same page. None writes to any table. This matches ADR-0019 §5 ("the Workspace owns navigation, presentation, and composition, never educational truth") verified concretely, not just asserted.

---

## Phase 3A — "Less Than 30 Seconds"

Walked `/teacher/dashboard` as a first-time-today load:

1. **Today's Mission** (0–5s) — name, date, term/week, active class count. Immediate, no interaction needed.
2. **Today at a Glance** (5–15s, once client fetches resolve) — three tiles: attendance status, pending marks, an Insights link. This is the one new thing PRP-2 added, and it directly answers "what needs doing today" without a click.
3. **Continue Working / Attention Feed** (15–25s) — in-progress work and the top 3 priority items, already the correct pattern from before PRP-2.

**Verdict: passes**, with one caveat. `TodayAtAGlance`'s attendance tile shows "Checking…" until its client-side fetch chain resolves (membership → classes → N session calls, Section Phase 8A). On a fast connection this is sub-second and invisible; on a weak connection (Phase 5A) this could visibly delay past the 30-second bar for that one tile specifically, while the rest of the page is already interactive. This is a real, named risk, not a pass with no caveats — see Phase 5A/8A.

---

## Phase 4A — Intelligence Visibility (concrete presentation levels)

ADR-0019 §6 described this abstractly ("presentation confidence and prominence vary by readiness tier"). This sprint makes it concrete, without building the tier-detection mechanism itself (that remains future, separately-scoped work — no readiness-tier field exists anywhere in the schema, confirmed in PRP-1):

| Tier | What a teacher sees | Concrete example |
|---|---|---|
| **Paper-first** | One line, no chart, no trend, no click required to understand it | "Two learners may benefit from additional support today." |
| **Hybrid** | One line plus a short reason and a single suggested action | "Two learners are behind on fractions this week — consider a 10-minute recap before Thursday's test." |
| **Digital-first** | Full panel: trend over time, comparison across the class, a direct link into Compass/Insights for the underlying evidence | A chart-backed panel with a "View in Insights" link, showing the same two learners plus the evidence trail behind the flag. |

**The underlying computation is identical at every tier** — this table only varies wording and panel richness, not the flagged learners or the confidence behind the flag. No tier-selection mechanism was built this sprint (naming it here fulfills Phase 4A's documentation requirement; building the actual tier switch is future work, consistent with PRP-1's original scoping).

---

## Phase 5A — Kenyan Reality Validation

| Condition | Current state | Verdict |
|---|---|---|
| **Weak internet** | `TodayAtAGlance` makes 2 sequential + N parallel (one per class) client-side fetches on every My Day load, with no caching and no request de-duplication across page loads. For a teacher with 1–3 classes this is fast; for a teacher with 6+ classes on a slow connection, this is a real, measurable risk to the Phase 3A 30-second bar. | **Named gap, not fixed this sprint** — a candidate for a future PRP (batch this into one request, or cache client-side per session). |
| **Old Android phones** | No heavy client library was added — `TodayAtAGlance` and the attendance badge use the same `fetch`/`useState`/`useEffect` patterns already used throughout `/teacher/*`, no new dependency. | **No new risk introduced.** Cannot verify actual low-end-device render performance without a real device test — stating this explicitly rather than claiming it's proven fast. |
| **Teachers sharing devices** | Sign Out remains a visible, one-tap action in both the sidebar footer and the mobile "More" sheet (unchanged by this sprint). `RoleSwitcher` only navigates between `/teacher` and `/dashboard` for the same authenticated user — it does not change who is signed in, so it carries no additional shared-device risk. | **No new risk introduced; pre-existing mitigation (visible Sign Out) confirmed still present.** |
| **Power interruptions** | No client-side draft-saving or offline queue exists anywhere in the touched surfaces (pre-existing gap, not created or worsened by this sprint). Marks entry, attendance marking, and report generation all require a live connection at the moment of submission, exactly as before PRP-2. | **Unchanged pre-existing gap** — out of this sprint's scope (offline sync is explicitly Forbidden for PRP-2 per its own mission brief). |
| **Schools where only the deputy has a laptop** | `core-office`/`core-team`/`core-admissions` remain admin-tier-gated and separate from the Teacher Workspace nav (Phase 7, PRP-2) — a deputy with the one laptop reaches School Office tools through their own admin-tier nav item, not by fighting through teacher-facing screens. Ordinary teachers on phones are not blocked by anything requiring a laptop. | **Consistent with the existing design; not worsened.** |
| **Schools printing report cards from one office** | `/teacher/core-term`'s PDF/print path was not touched by PRP-2; the relabeling (`Official Report Cards`) makes it easier, not harder, for whoever prints centrally to find the right screen from a teacher's description of what they clicked. | **Slightly improved via labeling, not otherwise changed.** |

---

## Phase 6A — Zero Duplicate Entry

Traced the named chain against real code (not assumed):

- **Attendance → Blueprint**: confirmed — `lib/learnerBlueprint/composeAttendance.ts` exists and reads Attendance data into Blueprint. Not new; pre-existing reuse, verified present.
- **Attendance → Reports**: confirmed — `lib/core/report-cards.ts` imports `getAttendanceStatusCountsForClass` from `lib/core/attendance.ts` and derives `days_present`/`days_absent` from it (the code's own comment: *"Cards is the consumer here, Attendance the owner"*). This is exactly Sprint 11G/ADR-0004's originally-planned integration, and it is live, not still-pending as PRP-1's roadmap table implied — **PRP-1's characterization of this as purely future work is corrected here**: it already existed before PRP-2 and was verified, not built, this sprint.
- **Attendance → Parent Experience**: confirmed — `lib/parentExperience/growthTimeline.ts` and `actions.ts` both reference attendance data.
- **No re-typing was found anywhere in this chain.** A teacher who marks attendance once never re-enters it for Blueprint, Parent Experience, or Report Cards.

**Widgets PRP-2 itself added** (Attendance Today, Assessment pending count) are read-only compositions per Phase 2A — they collect nothing from the teacher, so they cannot introduce a duplicate-entry point by construction.

---

## Phase 8A — Performance Budget (measured, not guessed)

Measured directly against the touched files, not estimated:

| Target | Measurement | Result |
|---|---|---|
| Reuse existing fetches, not add new ones where data is already available | `DashboardDataProvider` still issues exactly 2 fetches per My Day load (`/api/teacher/attention-feed`, `/api/sow/list`) — confirmed unchanged, byte-diffed against pre-PRP-2 version. `TodayAtAGlance` adds `2 + N` new client fetches (membership, classes, one per class for sessions), where none of that data was fetched anywhere else on the page before. | **New fetches are additive, not duplicative** — but the `2 + N` count itself is the Phase 5A weak-internet risk; "not duplicated" and "not expensive" are different claims, and only the first is true here. |
| Avoid duplicate Blueprint composition | Grepped every file this sprint touched for `learnerBlueprint`/`composeBlueprint` imports. | **Zero matches — confirmed, not assumed.** |
| Avoid duplicate Compass summaries | Grepped every file this sprint touched for `compass` imports. | **Zero matches — confirmed.** |
| Avoid duplicate Career summaries | Grepped every file this sprint touched for `career`/`careerIntelligence` imports. | **Zero matches — confirmed.** |
| No query-in-a-loop (server-side) | `getPendingAssessments` was already batched before this sprint (no `.map()` + query per item); PRP-2 added no server-side loop. | **Confirmed — no server-side loop introduced.** The `TodayAtAGlance` `Promise.all` loop is client-side, parallel (not sequential), and reuses an existing per-class API route — the same pattern the pre-existing Attendance workspace page already used before PRP-2, not a new anti-pattern. |

**Net measured verdict**: no duplicate composition anywhere (three grep-confirmed zeros), but one real, named cost — `TodayAtAGlance`'s `2 + N` client fetch count — that should be batched in a future PRP if the pilot's real classroom counts make it visibly slow. Not fixed this sprint per Phase 0's "validate before changing UI further" framing.

---

## Phase 9A — Kanggai Pilot Simulation: One Full Week

| Day | Scenario | Does the Workspace hold up? |
|---|---|---|
| **Monday** | Normal teaching — arrival, attendance, 3–4 lessons | My Day shows attendance/assessment/insights status at a glance (Phase 3A). Teaching flow still requires navigating SOW/Lesson Plans/Record of Work as three separate items (unchanged, deferred to PRP-5). |
| **Tuesday** | CAT (a timed assessment day) | Teacher now has a real "Assessment" nav entry and My Day tile showing pending marks — previously this required knowing to drill into a specific class. **Genuinely improved** by this sprint. |
| **Wednesday** | Remedial teaching (targeted at struggling learners) | This depends on Insights/Attention Feed correctly flagging which learners need remedial attention — unchanged computation, now at least reachable via a real Insights nav entry instead of a dead URL. The remedial-planning workflow itself (`lib/remedial`) was not touched and not audited further this sprint — out of scope. |
| **Thursday** | A parent concern arises | The "was the parent told" gap (PRP-1 finding) is still open — a teacher has no single screen to check delivery status. **Not solved this sprint; explicitly still open.** |
| **Friday** | Weekly review | `WeeklyTeachingProgress` (pre-existing, unchanged) still anchors this. No new weekly-review composition was added — worth naming as a possible future My Day addition, not built here. |

**Net Phase 9A finding**: PRP-2's real, measurable improvement lands on Tuesday (Assessment) and generally on "any day" (My Day's at-a-glance status). Thursday's parent-communication gap and Wednesday's deeper remedial-workflow question remain open, named, future work — consistent with, not contradicting, PRP-1's original backlog.

---

## Additional Success Criterion

**Would a teacher who has never used EduNexus before be able to teach for one week without needing a manual?**

**Answer: closer than before PRP-2, but not yet fully yes.** The improvements this sprint made (honest Reports/End-of-Term labels, a real Assessment entry point, an at-a-glance My Day) remove several places a new teacher would previously have had to be told "actually, click there instead." Three things would still send a brand-new teacher looking for help, unprompted:

1. The Teaching flow (SOW → Lesson Plans → Record of Work) still requires understanding the sequence themselves — nothing on screen states "do this, then this, then this" (PRP-5, not yet built).
2. No screen answers "did the parent get my message" — a new teacher would eventually ask a colleague or assume, incorrectly, that the WhatsApp button confirms delivery.
3. Attendance's operating-mode badge is honest but passive — it tells a teacher "catching up" without telling them what to do about it (e.g., no explicit "mark today's attendance now" call-to-action beyond the existing "Take Attendance" button already on that page).

None of these three are regressions — they are the next honest items for a PRP-3-and-onward backlog.

---

## Permanent Principle Adopted

**The Teacher Workspace should reduce decisions, not increase them.** Every new panel, button, card, alert, or widget must eliminate a teacher decision somewhere else (e.g., "which of these two Reports items do I click" resolved by relabeling) — if a proposed addition doesn't remove a decision, it does not belong in the Workspace, regardless of how useful the underlying data might be. This is adopted as a standing governing principle for the Pilot Readiness Program, alongside the existing Guardian Principles in ADR-0019, effective for PRP-3 onward. Applied retroactively to this sprint's own additions as a self-check:

- Relabeling Reports/End-of-Term: **removes** the "which one do I click" decision. Passes.
- Assessment nav entry: **removes** the "which class did I leave marks pending in" search. Passes.
- My Day's Attendance/Assessment tiles: **removes** the "do I need to check anything today" uncertainty. Passes.
- Insights nav entry: **removes** the "does this even exist" uncertainty (it existed, unreachable). Passes.
- Attendance operating-mode badge: **partially** passes — it answers "how stale is this," but (per the Additional Success Criterion above) doesn't yet turn that answer into a clear next action. Flagged as the one addition this sprint that only partially satisfies the new principle.

---

## Summary of Findings for Future (Separately-Gated) Work

Carried forward and refined from PRP-1/PRP-2, now with concrete validation evidence:

1. `TodayAtAGlance`'s `2 + N` client-side fetch chain should be batched into fewer requests before relying on it under real Kanggai-grade connectivity (Phase 5A/8A — new finding this sprint).
2. Teaching flow (SOW/Lesson Plans/Record of Work) still needs the guided-sequence UI named in ADR-0019 §10 as PRP-5.
3. "Was the parent told" remains unanswered anywhere in the UI (PRP-1, reconfirmed Phase 9A Thursday).
4. Attendance's operating-mode badge should grow a concrete next-action, not just a status label, to fully satisfy the new "reduce decisions" principle.
5. PRP-1's roadmap table should be corrected: Attendance→Report Cards integration (originally "Sprint 11G, future") is **already live** — verified in Phase 6A. This is a documentation correction, not a code change.
