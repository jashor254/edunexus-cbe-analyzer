# Sprint PRP-3 — Teacher Workflow Engine

**Status: IMPLEMENTED.** Scope is exactly PRP-2A's three named gaps — Teaching-flow sequencing, parent-notification confirmation, and Attendance requiring a next-action rather than a status label — plus the weak-connectivity fetch pattern PRP-2A measured and flagged. No educational domain was redesigned; every action here suggests, none decides, publishes, or communicates automatically (Core Principle: "Teacher Workflow suggests. Teachers decide.").

**Depends on**: `docs/architecture/adr-0019-teacher-workspace-architecture.md`, `sprint-prp2-teacher-workspace-foundation-implementation.md`, `sprint-prp2a-pilot-safety-and-usability-validation.md` (the source of this sprint's scope).

---

## Phase 1 — Workflow Audit

Read implementations for every named transition (never inferred):

| Transition | Entry point (before PRP-3) | Exit point | Dead end / friction found |
|---|---|---|---|
| Arrival → Attendance | `/teacher/dashboard` → Attendance tile (label only, PRP-2) | `/teacher/attendance` | No dead end, but the tile only said "Marked for N of M classes" — didn't name which class, so a teacher still had to open Attendance and scan for the unmarked one (PRP-2A's "actionable" gap). |
| Attendance → Teaching | None | None | Real dead end: finishing attendance for a class did not lead anywhere; a teacher had to independently remember to go teach. |
| Teaching (SOW/Lesson Plans/Record of Work) → Assessment | `ContinueWorking` (My Day) surfaces incomplete lesson-plan/ROW tracks | Whichever track link | No connection to Assessment at all — a teacher finishing lesson prep had no signal that marks were also waiting. |
| Assessment → Break/Next lesson | `/teacher/assessment` (PRP-2) lists pending marks | Class assessment entry page | Once marks were entered, the assessment correctly disappeared from `getPendingAssessments()` (verified — no dead end), but nothing told the teacher "you're done, here's what's next." |
| End of day → Weekly review | `WeeklyTeachingProgress` (My Day, unchanged) | itself | No dead end — pre-existing and left alone. |
| Weekly review → End of term | `/teacher/core-term` | Report card publish | The four status rows (locked/generated/published) stayed visible even after everything was done — no "you're finished" moment (PRP-2A's Momentum example). |
| Alert → Parent communication → resolution | `/teacher/alerts` | `wa.me` deep link (opens WhatsApp) or "Mark Resolved" | Real dead end, confirmed: clicking "Send Parent WhatsApp" gave zero feedback inside EduNexus that anything had happened — a teacher re-opening Alerts later had no way to tell if they'd already messaged this parent. |

**Duplicated clicks found**: none beyond what PRP-2A already named (the `2+N` attendance fetch is a duplicated *network call* pattern, not a duplicated *click* — no workflow required a teacher to click the same thing twice).

**Unnecessary navigation found**: Teaching (SOW/Lesson Plans/Record of Work) still requires knowing to check three separate places — confirmed unchanged from PRP-1/PRP-2A. This sprint's Next Action Engine (Phase 3) surfaces the single most-incomplete teaching item on My Day as a workaround, but does **not** rebuild the three pages into a guided in-page flow — that remains a separately-scoped future item (still not this sprint's job; the engine composes a link, it doesn't restructure the Teaching pages themselves).

---

## Phase 2 — Workflow Cards

Implemented as one "What's Next" card on My Day (`TodayAtAGlance`), not as inline cards bolted onto every subpage — a deliberate scope decision. Reasoning: PRP-1's Phase 2 (Kenyan school day) already established My Day as the one place a teacher checks first; adding progression cards to every individual page (Attendance, Assessment, core-term) would mean composing extra facts on pages that don't otherwise need them, working against Phase 7's connectivity goal. Two exceptions, kept minimal:

- **Attendance page**: unchanged except the pre-existing PRP-2 operating-mode badge; no new card added, since the natural "what's next" moment already lives on My Day, one click away.
- **`/teacher/core-term`**: gained a "Nothing left to do here" banner once `reportsPublished` is true (Phase 4, not a progression card to somewhere else — there's nowhere further to go once a report card is published).

The chain from the mission brief (Attendance complete → Teaching → Assessment → Blueprint → Parent Actions) is realized as: My Day's single "What's Next" card follows exactly this priority order (Attendance, then Teaching, then Assessment — see Phase 3), and once nothing is outstanding, the card is replaced by "You're caught up" rather than inventing a Blueprint/Parent-Actions step this sprint has no safe composed fact for (Blueprint and Parent Actions were correctly left untouched per this sprint's Forbidden list).

---

## Phase 3 — Next Action Engine

`lib/teacherWorkflow/nextAction.ts` — a pure, deterministic function, unit-tested (6 tests, all passing). It is explicitly **not** intelligence:

- Takes three fact lists as input: `attendanceGaps` (which classes have no session today — Attendance's own data, read not computed), `teachingGaps` (which SOW/lesson-plan/record-of-work tracks are behind — reused from `ContinueWorking`'s existing `buildContinueItems`, itself just a ratio comparison, not a new calculation), `pendingAssessments` (from the existing `getPendingAssessments()`).
- Orders them: Attendance, then Teaching, then Assessment — matching the literal order these happen in a school day (PRP-1 Phase 2), not a computed priority.
- Returns either the full list (`composeNextActions`) or just the top one (`topNextAction`) for the My Day card.
- Contains no risk score, no confidence value, no educational judgment of any kind — verified by reading the module: every field it touches is a count, a boolean-derived gap, or a pass-through string.

---

## Phase 4 — Teacher Momentum

- **Attendance**: a class leaves `attendanceGaps` (and therefore the Next Action list) the moment a session exists for it today — no explicit "remove" logic needed, it's a natural consequence of the gap being computed fresh each load.
- **Assessment**: `getPendingAssessments()` already filtered to `learner_count === 0` before this sprint — once marks are entered, the assessment was already disappearing from the pending list; this sprint's Next Action Engine inherits that behavior for free, verified by reading the existing filter rather than assumed.
- **Report cards**: `/teacher/core-term` now shows an explicit "Nothing left to do here" banner once locked/generated/published are all true, replacing what used to be four checkmarks a teacher had to re-verify themselves each visit.
- **My Day overall**: when every fact list is empty, the "What's Next" card is replaced by a calm "You're caught up — nothing urgent right now" message rather than showing nothing (silence could read as "still loading" or "broken") — the workspace gets quieter, never noisier, exactly as the mission's example describes.

---

## Phase 5 — Parent Communication Confirmation

Scoped exactly as instructed: no messaging redesign, no notification engine, no new communication channel. What was built: clicking "Send Parent WhatsApp" on `/teacher/alerts` now records, client-side only (`sessionStorage`), that the teacher themselves clicked it, and shows "✓ You sent this at HH:MM" next to the button on future views within the same session. The button also relabels to "Send Again" rather than disappearing — the teacher can always re-send, this sprint never removes their ability to act.

**Deliberately not a delivery claim.** The label says "You sent this," never "Delivered" or "Read" — this is the exact false-promise pattern prior pilot-readiness audits flagged elsewhere in this codebase, and this sprint is careful not to repeat it. EduNexus genuinely cannot know whether the WhatsApp message was delivered (no API integration exists or was added), so it only confirms the one thing it actually can: the teacher's own click happened.

---

## Phase 6 — Attendance Action

`TodayAtAGlance`'s Attendance tile no longer says only "Marked for N of M classes." It now says:

- `"{className} still needs attendance"` when exactly one class is outstanding, or
- `"{N} of {M} classes still need attendance"` when more than one is, or
- `"Marked for all {M} classes"` when done.

The specific class name comes from the same batched fetch (Phase 7) — no new query, just surfacing a field (`classLabel`) that was already being fetched and discarded. Attendance's own domain (`lib/core/attendance.ts`) was not touched beyond the one additive batched-read function (Phase 7) — Teacher Workflow still only links into `/teacher/attendance`, it does not mark attendance itself.

---

## Phase 7 — Weak Connectivity Review

**The documented `2+N` fetch pattern (PRP-2A) was investigated and batched where ownership allowed:**

- Added `AttendanceRepository.listSessionsForClassesOnDate()` (one `.in()` query, `lib/repositories/attendance.repository.ts`) — matches the exact precedent of Sprint 12B's `listRecordsForSessions` (ADR-0004 §6: never loop a per-item query when one batched query will do).
- Added `listAttendanceSessionsForTeacherClassesOnDate()` in `lib/core/attendance.ts` — **ownership is not weakened**: every classId is still individually authorized via the existing `getClass` + `assertClassAccess` (the same checks `listAttendanceSessionsForClass` already used), just against one batched repository call instead of N.
- Extended `GET /api/core/attendance` with a `classIds` + `date` branch, alongside the three existing branches (`classId`, `from`/`to`, whole-school) — no existing branch was changed.
- `TodayAtAGlance` now makes **3 total requests** (membership, classes, one batched session query) instead of `2+N`.

**What was NOT batched, and why**: `fetchMembership()` and `fetchClasses()` remain two separate calls. Combining them would mean creating a new merged endpoint duplicating two already-existing ones (`/api/core/my-membership`, `/api/core/classes`) purely for this one composition's convenience — a real new endpoint for a marginal saving of one round-trip, working against "never duplicate what already works." Documented here as a deliberate non-fix, not an oversight.

**What else was checked and found already fine**: `getPendingAssessments()` was already a single batched server-side call (no loop) before this sprint. `buildContinueItems` (teaching gaps) reuses `schemes` already fetched once by `DashboardDataProvider` — zero new fetches for that fact.

---

## Phase 8 — Kenyan Classroom Walkthrough (One Week)

| Day | Scenario | How PRP-3 changes it |
|---|---|---|
| **Monday** | Routine lessons | My Day's "What's Next" card leads with attendance if any class is unmarked, then the most-behind teaching track — a teacher has one card to check instead of scanning three tiles and guessing. |
| **Tuesday** | CAT | If marks are pending after the CAT, the same card surfaces "Enter marks for [test]" once attendance and teaching are caught up — the priority order means a teacher isn't told to enter marks while a class still hasn't had attendance taken. |
| **Wednesday** | Absent learner | Attendance itself (marking one learner absent) is unchanged — Teacher Workflow does not touch how a status is recorded, only how the "still need attendance" gap is surfaced beforehand. |
| **Thursday** | Parent concern | The teacher clicks "Send Parent WhatsApp" from Alerts; returning to that page later the same day now shows "You sent this at [time]" instead of leaving them to wonder. |
| **Friday** | Weekly review | Unchanged (`WeeklyTeachingProgress`, out of scope) — worth naming again as a possible future My Day addition, not built here. |

---

## Phase 9 — Cognitive Load Review

Counted directly against the same journeys audited in Phase 1, before vs. after:

| Journey | Before PRP-3 | After PRP-3 |
|---|---|---|
| "Which class still needs attendance today?" | 1 click to Attendance + visually scanning a list of classes | 0 clicks — named on My Day directly |
| "What should I do next, generally?" | Scan 3 separate tiles (Attendance/Assessment/Insights) and infer priority yourself | 1 card, pre-ordered — read, don't infer |
| "Did I already message this parent about X?" | No way to know — re-read the alert and guess, or risk messaging twice | 1 glance at the confirmation badge |
| "Is this class's report card fully done?" | Re-read 4 status rows every visit | 1 banner sentence when true |

**Trend: downward on every journey measured**, consistent with the Success Criteria's requirement. No journey got a new click or a new page added — Phase 3's card and Phase 6's label both replace existing UI in place rather than appending new UI on top of it.

---

## Verification

- `npx tsc --noEmit` — clean, exit 0.
- `npx eslint` on every touched/new file — 0 errors, 0 warnings.
- `npx tsx --test lib/config/attendanceOperatingMode.test.ts lib/teacherWorkflow/nextAction.test.ts` — 12/12 passing.
- Grepped every touched file for `learnerBlueprint`/`compass`/`career` imports — none found (one match was descriptive UI text, not a code import, confirmed by inspection).
- Grepped every touched file for new `createClient`/`getUser`/`requireAuth` calls — none found; no duplicated authentication was introduced.
- Every workflow transition (Phase 2/3/6) is a pure function of already-fetched facts — no randomness, no AI call, no external state beyond what was already being read. Deterministic, confirmed by the unit tests' exact-order assertions.
- The teacher retains final control everywhere: the Next Action card is a suggestion with a link, never an automatic navigation; the WhatsApp confirmation only ever records that the teacher clicked, never sends anything itself; the core-term banner only appears after the teacher's own publish action, never triggers one.

## Stop Condition Reached

Workflow transitions implemented, next-action guidance composed, Attendance made actionable, parent-action confirmation clarified, weak-connectivity fetch pattern batched where ownership allowed (and documented where not). Documentation written, verification passed. Per the mission's explicit instruction, PRP-4, offline synchronization, mobile optimization, notifications, and any new educational feature are out of scope and not started.
