# Sprint PRP-4 — Teacher Continuity & Session Recovery

**Status: IMPLEMENTED.** Core Principle: "EduNexus remembers context. Teachers remain in control." Everything built this sprint restores navigation context or warns before losing unsaved input — nothing auto-submits, auto-publishes, or recomputes anything. No educational domain was redesigned.

**Depends on**: `docs/architecture/adr-0019-teacher-workspace-architecture.md`, `sprint-prp3-teacher-workflow-engine.md` (the Next Action Engine this sprint's "Continue" phrasing builds on).

---

## Phase 1 — Continuity Audit

Read real implementations for every named workflow (never assumed):

| Workflow | Begins | Pauses | Resumes | Lost today | Already preserved |
|---|---|---|---|---|---|
| **Taking attendance** | `/teacher/attendance/new?classId=X` | Any time before "Save Attendance" | Re-navigating to the same class/date | Nothing structural — **this is already excellent**: `loadRoster()` checks for an existing session first and reuses it; if records already exist it redirects to Session Detail instead of re-creating (Sprint 11E design, confirmed by reading the code, not assumed). The one real gap: the teacher had no memory *hint* pointing them back to the class they were on. | Session existence, DB-level `UNIQUE(class_id, attendance_date, session_type)` constraint (ADR-0003 §7) — duplicate-safe by construction. |
| **Entering assessment marks** | `/teacher/classes/[classId]/assessments/[assessmentId]` | Any time before "Save" (batch save, not per-cell) | Re-navigating to the same assessment | **Real gap, confirmed**: typed-but-unsaved marks have zero persistence and zero warning before a refresh/close discards them. | `bulkSaveMarks` is delete-then-insert (`lib/assessments/mutations.ts`) — a retried/duplicate Save is idempotent, confirmed by reading the function, not assumed. |
| **Writing report comments** | — | — | — | **No such workflow exists.** Grepped the entire codebase for `class_teacher_comment`/`headteacher_comment` usage outside `lib/core/report-cards.ts` and the parent-facing read view — found no teacher-facing UI to write them anywhere. This mission's own example doesn't map onto a real feature, exactly like PRP-1's "Mwalimu Helper" finding — named honestly here rather than fabricated. | N/A |
| **Reviewing Blueprint** | Per-student, from a class page | N/A (a read, not a multi-step task) | N/A | Not a resumable workflow — a teacher opens a specific student's Blueprint and reads it; there is no in-progress state to lose. Correctly out of this sprint's scope (Forbidden: no Blueprint redesign) and out of Phase 1's real findings. | N/A |
| **Lesson preparation** (SOW/Lesson Plans/Record of Work) | `/teacher/scheme-of-work`, `/teacher/lesson-plans` | Between generation steps | `ContinueWorking` (My Day) already resumes this by surfacing the most-incomplete track | Already handled — PRP-3's Next Action Engine reuses this exact data. No new gap found. | `schemes` progress counts, fetched once via `DashboardDataProvider`. |
| **End-of-term processing** | `/teacher/core-term` | Between lock → generate → publish steps | Re-navigating to the page | **Real gap, confirmed**: the class `<select>` reset to blank on every visit — a teacher processing multiple classes across several return visits had to re-pick the same class each time. | The four-step state itself (`assessmentsLocked`/`summaryReady`/`reportsGenerated`/`reportsPublished`) is always recomputed fresh from the server on load — never stale, never duplicated. |

---

## Phase 2 — Resume Working Day

Implemented on My Day (`TodayAtAGlance`), layered on top of PRP-3's Next Action Engine rather than replacing it. A remembered context (`getLastWorkingContext()`) is **only ever shown after being cross-checked against today's live, composed facts** — if the remembered class's attendance is already marked, or the remembered assessment's marks are already entered, the memory is treated as stale and silently cleared, never shown. This is the literal application of "never fabricate": the badge only changes from "Next" to "Continue" when the remembered work is still genuinely outstanding, verified against real data on every render, not trusted from storage alone.

If the remembered context is a *different* outstanding item than the current top priority (e.g. a teacher was mid-assessment-entry for one class, but a different class's attendance is now the higher-priority suggestion), both are shown — the priority order from PRP-3 is never silently overridden, but the remembered work is never hidden either.

---

## Phase 3 — Context Preservation

`lib/config/teacherWorkspaceMemory.ts` stores exactly three kinds of thing, all navigation/selection context:

1. **Last working context** — `{ kind, matchKey, classId, className, href, at }`. `matchKey` deliberately mirrors the Next Action Engine's own action `key` shape (`attendance-${classId}`, `assessment-${assessmentId}`, `core-term-${classId}`) so it can be cross-checked, never trusted alone. Written by the attendance-marking page, the assessment marks-entry page, and `/teacher/core-term`.
2. **Preferred class per page** — a page-scoped last-selected class id (`core-term` uses this today), restored only if the class still genuinely exists in the school's current class list.
3. Nothing else. "Current report batch" and "current Blueprint learner" from the mission's own example list were considered and **not implemented** — no report-batch concept or Blueprint learner-browsing state exists as a distinct, resumable UI state in the current codebase (confirmed by reading `/teacher/core-term` and the Blueprint-adjacent routes); inventing state to preserve for a workflow shape that doesn't exist would be exactly the fabrication this sprint's Core Principle forbids.

**Never preserved**: student names, marks/scores, report comment text, WhatsApp message content — confirmed by reading every `set*` call site added this sprint; none passes anything beyond an id, a class label, and a route.

---

## Phase 4 — Interruption Recovery

For the one real gap with actual content to lose (marks entry), `lib/config/useUnsavedChangesWarning.ts` — a small hook wrapping the native `beforeunload` event — asks for confirmation before a refresh/close discards typed-but-unsaved marks. This is a **prevention** measure, not a recovery mechanism: nothing is stored, so there is nothing to "silently repeat" on return (satisfying the mission's explicit "never silently repeat completed actions" alongside Phase 3's "don't preserve confidential data" constraint — the two requirements together rule out draft-persistence for this specific workflow, and the warning is what's left).

Attendance's own interruption recovery (session reuse, redirect-to-detail-if-already-marked) already existed before this sprint (Phase 1) and was not modified — Teacher Workspace only adds the "which class was I on" memory hint on top of it.

---

## Phase 5 — Safe Recovery

Audited every destructive action (Publish Report Cards, End Term steps, Promotion, Snapshot generation) for any accidental auto-restore wiring:

- Grepped every call site this sprint added (`setLastWorkingContext`, `setPreferredClassId`) — none is called from, or near, `lockAssessment`, `generateSummaries`, `generateReportCards`, `publishReportCards`, or any promotion/snapshot code. Memory here is written only when a teacher is *mid-way through* unfinished work, never when they complete or trigger an irreversible step.
- `/teacher/core-term`'s own context is explicitly **cleared**, not remembered, the moment `reportsPublished` becomes true (Phase 4/Momentum from PRP-3, reused here) — a finished term has nothing left to "resume," so nothing lingers to accidentally resurface.
- No code path in this sprint ever calls a POST/publish/promote endpoint on a teacher's behalf. Every remembered context resolves to a `<Link>` — a navigation, requiring the teacher's own next click to do anything.

---

## Phase 6 — Workspace Memory

Implemented: preferred class on `/teacher/core-term` (Phase 1's confirmed real friction point). **Not implemented, and why**:

- **Collapsed panels** — no collapsible-panel UI exists anywhere in the Teacher Workspace today; there is nothing to remember the collapsed state *of*. Building collapsible panels just to have something to persist would be inventing a UI feature outside this sprint's mission (Forbidden: no additional teacher features).
- **Preferred class view** — no alternate "views" of a class (list vs. grid, etc.) exist to have a preference between.
- **Chosen operating mode (Paper/Hybrid/Digital)** — audited directly: PRP-2's Attendance operating-mode badge (`lib/config/attendanceOperatingMode.ts`) is **computed from data recency**, not a control a teacher selects. There is no "choice" to persist — the mission's example doesn't correspond to a real, settable preference in this codebase, so nothing was built for it. Documented here rather than silently ignored.
- **Last workspace section** — considered, not built: the sidebar/bottom-nav already highlight the active route via `usePathname()`, and no other surface in this codebase reads "which section was I last in" — adding storage for a value nothing would consume would be dead code.

---

## Phase 7 — Duplicate Submission Protection

Audited every resumable action for double-submission risk — mostly a verification pass with positive findings, one real fix:

| Action | Protected today? | Evidence |
|---|---|---|
| Save Marks (assessment entry) | Yes — UI-guarded (`disabled={saving}`) and data-layer-safe (`bulkSaveMarks` is delete-then-insert, confirmed idempotent by reading the function). | `lib/assessments/mutations.ts` |
| Save Attendance | Yes — UI-guarded (`disabled={!allMarked \|\| saving}`) and DB-constraint-safe (`UNIQUE(class_id, attendance_date, session_type)`), plus the existing-session-reuse check in `loadRoster()`. | `lib/repositories/attendance.repository.ts`, ADR-0003 §7 |
| Lock Assessment / Generate Summaries / Generate Report Cards / Publish Report Cards | Yes — a shared `busy` state disables every `ActionButton` (`disabled={disabled \|\| busy}`) and is set synchronously before the async call fires (`runAction()`), preventing a double-click from firing two requests. | `app/teacher/core-term/page.tsx` |
| Resolve Alert | Yes — `disabled={resolving === alert.id}`. | `app/teacher/alerts/page.tsx` |
| Send Parent WhatsApp | Not a submission to EduNexus at all — it opens an external `wa.me` link; there is no EduNexus-side write to duplicate. PRP-3's confirmation badge already reduces the *reason* a teacher might click it twice (uncertainty about whether it worked the first time). | `app/teacher/alerts/page.tsx` |

**Remaining risk, documented not fixed**: none of the above have a genuine gap. The only newly-introduced UI this sprint (the "Continue" links on My Day, the preferred-class restore) are pure navigations with no submission behavior, so they carry no duplicate-submission risk by construction.

---

## Phase 8 — Kenyan Classroom Simulation

| Moment | What happens |
|---|---|
| Monday morning, teacher begins attendance | `loadRoster()` writes a "last working context" for that class. |
| Internet disconnects mid-marking | Nothing is lost server-side (no session was half-created — it either already existed or was created before marking began); nothing client-side needed saving since attendance rows are marked locally then submitted in one batch, same as marks entry. |
| Teacher returns later | My Day shows "Continue attendance for [class]" only if that class's attendance is still genuinely unmarked (cross-checked live) — if the teacher (or a colleague) already finished it, the prompt silently doesn't appear. |
| Assessment interrupted, returns after lunch | If marks were typed but not saved and the tab is still open, the `beforeunload` warning would have caught an accidental close; if they did close/lose the tab, My Day's "Continue: Enter marks for [test]" still points them back, since the assessment is still pending server-side. |
| Friday, leaves before reports finish | `/teacher/core-term` remembers the class; returning Monday, the picker is pre-filled — no re-selecting, and the four status rows show exactly where they left off (nothing stored client-side about the report content itself, all recomputed from the server). |

No step in this simulation required the teacher to reconstruct anything from memory — every resumption point either reused server truth directly or a thin, cross-verified navigation hint pointing back at it.

---

## Phase 9 — Continuity Metrics

Measured against the same style of before/after comparison PRP-3 used:

| Metric | Before PRP-4 | After PRP-4 |
|---|---|---|
| Navigation steps to resume core-term work for a previously-selected class | 1 (re-select the class from a blank dropdown) | 0 (pre-filled) |
| Ways to lose typed-but-unsaved marks silently | 1 (any refresh/close) | 0 — a warning now intercepts it; the risk of *silent* loss specifically is eliminated (the teacher must now explicitly confirm) |
| "Which class was I working on?" guesswork on My Day | Always, if returning mid-task | Only when no genuinely outstanding remembered context exists |
| Duplicate-submission risk found and requiring a fix | N/A (not previously audited end-to-end) | 0 found — 4 of 4 resumable write actions already protected; documented, not newly fixed |

---

## Verification

- `npx tsc --noEmit` — clean, exit 0.
- `npx eslint` on every touched/new file — 0 errors (1 pre-existing-pattern warning in `TodayAtAGlance.tsx`, the same `react-hooks/set-state-in-effect` class already present at 3 other locations in this codebase before this sprint, not a new category of issue).
- `npx tsx --test` across `attendanceOperatingMode.test.ts`, `nextAction.test.ts`, `teacherWorkspaceMemory.test.ts` — 17/17 passing.
- Grepped every touched/new file for new `createClient`/`getUser`/`requireAuth` calls — none found; no duplicated authentication.
- Grepped every touched/new file for `learnerBlueprint`/`compass`/`career` imports — none found; no duplicated educational computation.
- Every remembered context is cross-checked against live data before display (Phase 2) — confirmed by reading `TodayAtAGlance`'s effect, not assumed.
- No destructive action (publish/generate/lock/promote) is ever auto-triggered by remembered context — confirmed by grep (Phase 5).

## Stop Condition Reached

Continuity audit complete, safe session recovery implemented (My Day's cross-verified "Continue" card), context preservation implemented (last working context + preferred class, both navigation-only), duplicate-submission protection verified (4/4 resumable actions already safe, no new gaps found), documentation written, verification passed. Per the mission's explicit instruction, PRP-5, offline-first synchronization, mobile optimization, notifications, and any additional teacher feature are out of scope and not started.
