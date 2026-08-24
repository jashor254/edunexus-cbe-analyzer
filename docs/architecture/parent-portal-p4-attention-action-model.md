# Parent Portal Phase P4 — Attention + Action Model

**Scope lock:** branch `main`, started at HEAD `ab30f1d`, 206 pre-existing
dirty working-tree files confirmed via `git status --short` before any
change and left completely untouched (verified again at closeout — only
the files listed in §33 were staged/committed). Builds on
`docs/architecture/parent-portal-super-audit-p0.md` (P0),
`docs/architecture/parent-portal-p1-entry-convergence.md` (P1),
`docs/architecture/parent-portal-p2-compass-actor-boundary.md` (P2),
`docs/architecture/parent-portal-p3-home-child-context-convergence.md`
(P3), and `docs/architecture/parent-portal-p3-5-http-regression-harness.md`
(P3.5). `npm run test:parent-http` was used from the start of this phase
(baseline run before any change, then re-run repeatedly during
development), per the mission's explicit instruction.

---

## 1. Verdict

**P4 COMPLETE WITH NAMED LIMITATIONS.**

A real "WHAT NEEDS ATTENTION?" and "WHAT CAN I DO?" pair of sections now
render on Parent Home, composed entirely from data `composeBlueprint()`
already produces plus one cheap, batched, already-existing repository read
for assignment overdue/due-soon counts. The regression gate is green:
`tsc --noEmit` clean, ESLint clean on every changed file, `next build`
succeeds, the STANDARD unit suite is 1088/1088 (1069 pre-existing + 19 new
pure unit tests), and the full parent HTTP manifest is 78/78 (70
pre-existing + 8 new). This is "WITH NAMED LIMITATIONS" rather than a bare
"COMPLETE" for two honest reasons: (1) this phase's own fixture work
surfaced a real, previously-undocumented gap — `composeAttendance()` is
gated admin-tier-only, so Attendance is currently **never** available to a
real parent viewer, which silently neuters both the pre-existing "Learning
Time" Home card and the pre-existing `review_attendance` ParentAction, not
just this phase's new Attendance-attention code (§17); (2) several
mission-listed candidate sources (attendance being the main one, plus
returned/resubmission-required work) were evaluated and explicitly
rejected rather than built, per the mission's own "only if evidence
supports it" instruction (§8).

---

## 2. Home Before

`app/(parent)/child/[learnerId]/page.tsx` rendered, top to bottom: a
conditional `ParentActionCard` ("Today's Actions," reading
`blueprint.recommendedNextSteps.data.actions` unfiltered — every
non-empty-state action, no attention/action split, no cap), then 9 flat
teaser cards (This Term, From the Teacher, Learning Time, Career
Exploration, Assignments, Gradebook, Learning Compass, Holiday Plan, How
Has My Child Grown?) — matching P3's own §10/§11 description exactly (P3
merged what had been a 10-card list into 9, no further restructuring).
There was no dedicated "what needs my attention" surface distinct from
"what can I do," no assignment overdue/due-soon count anywhere on Home
(P3 explicitly deferred this, §14 of the P3 doc), and no attendance- or
risk-derived concern rendered anywhere on Home (attendance's own card
showed only a raw percentage or "Not Enough Information Yet," never a
concern framing).

---

## 3. Signal Inventory

| Signal | Authority | Freshness | Parent-safe | Used on Home (before P4) |
|---|---|---|---|---|
| `recommendedNextSteps.data.actions` | `lib/parentExperience/actions.ts` (`composeParentActions`, called once inside `composeBlueprint`) | live | Yes (viewer-gated destinations) | Yes — "Today's Actions," unfiltered |
| `attendance.data.attendancePercentage` | `lib/core/attendance.getLearnerAttendanceHistory` (admin-tier only — see §17) | snapshot | **No, in practice** — always `unavailable` for a real parent actor (new finding, §17) | Yes — "Learning Time" card, always shows fallback text for a parent |
| `risk.data.overallRiskLevel` / `flags` | `recomputeLearnerProjection` via `composeRisk` | live | Only via new translation (raw `RiskFlag.reason` is teacher-facing, never parent-safe) | **No** — Blueprint's `risk` section was never read anywhere in Home before this phase |
| `academicRecord.data.bySubject[].trend` | Projection (`composeAcademicRecord`) | live | Yes, already used by `composeParentSummary`'s trend headline | Indirectly, via "This Term" card's `parentSummary.headline` |
| Assignment overdue/due-soon counts | New in this phase — `repos.assignments.findSubmissionsWithAssignmentsForStudents` (pre-existing, reused unmodified), summarized by a new pure function | live | Yes (counts only, no per-assignment detail) | **No** (P3's own named deferral, now closed — §21) |
| `learningCompass.data.currentLearningFocus` | Compass (`composeLearningCompass`) | live | Yes | Yes — "Learning Compass" card (unchanged this phase) |
| `career.data.careerCluster` | Career Intelligence (`composeCareer`) | live | Yes | Yes — "Career Exploration" card + `explore_career_journey` action (unchanged) |
| `teacherReflection.data` | Teacher Reflection domain | live | Yes | Yes — "From the Teacher" card (unchanged) |
| `latestSnapshot` (Blueprint Snapshot) | `getLatestBlueprintSnapshot` | historical | Yes | Yes — "How Has My Child Grown?" card + `celebrate_achievement`/`view_report_card` actions (unchanged) |
| Teacher-approved adaptive action (`canonical_action_item`) | `toParentView()` projection of an approved, `parent_visible`/`shared` Blueprint action item | live | Yes, by design (P0 confirmed) | Yes, folded into `recommendedNextSteps.data.actions` already |

---

## 4. ParentAction Inventory

All 8 `ParentActionType` values audited by reading `lib/parentExperience/actions.ts` end to end and every call site that constructs a `ParentAction`:

| Type | Classification | Notes |
|---|---|---|
| `continue_holiday_learning` | PARENT ACTION | Links to `/child/{id}/full` |
| `read_teacher_reflection` | PARENT ACTION | Links to `/child/{id}/full`; suppressed from P4's "What Can I Do?" list specifically (not from Blueprint's own section) because the existing "From the Teacher" Home card already covers the same content — dedup, not a classification problem |
| `review_attendance` | PARENT ACTION | Critical when below threshold, `completed` (filtered out of "do" lists) when healthy |
| `celebrate_achievement` | PARENT ACTION (informational/celebratory, not a concern) | Links to a specific snapshot history page |
| `view_report_card` | PARENT ACTION | Links to `/report-card` |
| `explore_career_journey` | PARENT ACTION | Links to `/career-intelligence`; per P0 §9 this route is ALSO reachable by a self-viewing student (not parent-exclusive), but it is never learner-mutating |
| `no_action_needed` | NAVIGATION-ONLY (presentation placeholder) | Filtered out of P4's Action list; used only to keep Blueprint's own section non-empty |
| `canonical_action_item` | PARENT INFORMATION, occasionally PARENT ACTION | The teacher-approved item, projected read-only; genuinely parent-safe by construction (P0 confirmed `toParentView()` strips `teacherNotes`/`evidenceBasis`) |

**Surprising finding:** zero LEARNER, TEACHER, or AMBIGUOUS actions were
found. Every emitted `ParentAction` destination is either a
`requireParent`-gated `/child/{id}/*` route or `/report-card`
(guardian-scoped API) or `/career-intelligence` (parent-or-self-viewing-
student, never learner-mutating). This is not a new finding this phase
manufactured — it reflects P0/P1/P2's own prior cleanup — but it does mean
Step 3/13's classification work (mission-anticipated as potentially
finding a genuine leak) turned up nothing to fix. The dedup decision
(§10) and the `completed`/`no_action_needed` filter (§9) are new,
everything else in this table is unmodified `lib/parentExperience/actions.ts` output.

---

## 5. Attention Definition

Something about the child's current state that deserves parent awareness,
independent of whether a specific action is attached. Rendered in a
dedicated "Needs Attention" section, never mixed into the action list.

## 6. Action Definition

Something appropriate for the parent to do right now — a real, viewer-safe
destination and a parent-framed verb. Rendered in "What Can I Do?", capped
at 3, never including `completed`/`no_action_needed`/suppressed entries.

---

## 7. Attention Sources Chosen

1. **Overdue assignments** — new cheap read (§21), category "genuinely canonical, parent-safe, actionable, not represented elsewhere."
2. **Teacher-originated urgent action** (`canonical_action_item` with `priority: 'critical'`) — already Blueprint-composed, parent-safe by construction.
3. **Persistent learning concern** (`risk.data.overallRiskLevel !== 'normal'`, translated per-subject or generic) — canonical (Projection via Blueprint's `risk` section), never previously surfaced anywhere on Home.
4. **Attendance concern** (`attendance.data.attendancePercentage < 90`, the existing `ATTENDANCE_ATTENTION_THRESHOLD_PERCENT`) — code is real and correctly guarded, but see §17: currently dead for a real parent due to a pre-existing, unrelated access gap.
5. **Due-soon assignments** — same new read as #1, lower priority, secondary-only.

## 8. Sources Rejected

- **Returned/resubmission-required work** — no canonical source exists. `assignment_submissions.status` in this codebase only takes `pending`/`submitted`/`marked` (confirmed by grep across `lib/repositories/assignment.repository.ts`, `lib/gradebook/gradebook.ts`, and every `*.integration.test.ts` seeding this table) — no `'returned'` value or resubmission concept exists anywhere. Rejected outright, not guessed at.
- **Compass state as an attention item** — per mission Step 21, Compass may only ever be informational ("Current focus: X"), never framed as a concern or an action CTA. The existing "Learning Compass" Home card already covers this; not duplicated into Attention.
- **Career "no interest saved yet"** — per mission Step 22, explicitly never a concern. Not included.
- **Raw attendance percentage without a threshold** — a canonical threshold DOES exist (`ATTENDANCE_ATTENTION_THRESHOLD_PERCENT = 90`, shared with `composeParentSummary`), so this was not rejected for lack of a threshold — it is included in the code, but practically inert; see §17 rather than treating it as "rejected."

---

## 9. Priority Algorithm

Fixed, deterministic order (tested in `lib/parentExperience/attentionAction.test.ts`):

```
1. assignments:overdue     (real overdue work — most urgent, most actionable)
2. teacher_action:<title>  (teacher-flagged critical, already approved+visible)
3. academic:<subject>      (Projection-backed persistent concern)
4. attendance               (currently inert in production — see §17)
5. assignments:duesoon      (lower-priority, informational)
```

This matches the mission's own candidate order for the four sources that
have a real implementation, with "returned/resubmission work" dropped
(§8 — no source exists) rather than left as a phantom rank. Tested against
real domain semantics directly (`buildParentHomeAttentionAction`'s
`SOURCE_ORDER` constant + `attentionAction.test.ts`'s "multiple attention
items ordered..." test) — no reason was found in this codebase's actual
data shapes to deviate from the mission's suggested order once the
unsupported source was removed.

## 10. Dedup Rules

One attention item per `key`; first occurrence in priority order wins,
later duplicates of the same key are dropped (`buildParentHomeAttentionAction`'s
`seen`/`deduped` pass). Concrete keys: `assignments:overdue`,
`teacher_action:<title>`, `academic:<subject>` (multiple risk flags for
the same subject collapse to one item, worst severity kept —
`attentionAction.test.ts`'s "two risk flags for the same subject collapse"
test), `academic:overall` (generic, only when no per-subject flag exists),
`attendance`, `assignments:duesoon`. Genuinely distinct obligations are
NOT suppressed by subject-name matching alone — an overdue Mathematics
assignment and a Mathematics academic concern produce two DIFFERENT keys
(`assignments:overdue` vs `academic:Mathematics`) and both render (tested
directly). On the Actions side, `read_teacher_reflection` is suppressed
from the "What Can I Do?" list only (not from Blueprint's own section)
because the existing "From the Teacher" card already covers identical
content — a presentation-layer dedup decision, not a data-layer one.

## 11. Zero-Attention State

"Nothing needs your attention right now" plus a "See the full picture →"
link to `/full`. Never a fabricated celebration. Rendered only when
`zeroAttention === true`, which requires BOTH zero real attention items
AND no assignment-check failure — a genuine read error never collapses
into this state (§15/§30).

---

## 12. Parent Actions Chosen

The existing `composeParentActions()` output, filtered (not replaced): drop
`completed`-priority and `no_action_needed`/`read_teacher_reflection`
types, cap at 3, preserve incoming priority order. No new action type was
invented — per the mission's Step 13 instruction to adapt rather than
duplicate, and because §4's audit found no gap in the existing shape.

## 13. Teacher-Approved Action Semantics

Classified per mission Step 16: a `canonical_action_item` with
`priority: 'critical'` is treated as PARENT INFORMATION surfaced as an
Attention item (via the existing `toParentView()` read-only projection —
nothing new written, nothing new approved/delivered by a parent); any
other priority stays a PARENT ACTION in the Actions list, unchanged from
before this phase. The teacher-mediated approval/delivery architecture is
completely untouched — this phase only decides where an already-approved,
already-parent-visible item is rendered.

## 14. Assignment Integration

**Implemented, quantified.** One new server read on Home: `repos.assignments.findSubmissionsWithAssignmentsForStudents([legacyStudentId])`
— the exact, pre-existing, already-batched (single query, `!inner` join,
no loop) function `lib/core/assignmentDiscovery.ts` already uses for the
learner's own assignment list. A new pure function
(`summarizeAssignmentAttention`) counts `status === 'pending'` rows into
overdue/due-soon buckets client-side of the DB call — no new query shape,
no second read of `assignments`/`class_students`/`assignment_submissions`
beyond this one call. Only summary counts are shown on Home
("N assignments are overdue → View assignments"); the full per-assignment
list stays on `/child/{id}/assignments`, untouched.

## 15. Projection/Risk Integration

**Implemented.** `blueprint.risk` (already composed by `composeBlueprint()`,
previously read by zero Home consumers) is translated through a new,
narrow, deterministic copy table (`RISK_SEVERITY_HEADLINE`/`_DETAIL` in
`lib/parentExperience/attentionAction.ts`) that reads ONLY `subject` and
`severity` from each `RiskFlag` — `RiskFlag.reason` (confirmed
teacher-facing internal text, e.g. "Conflicting evidence... a teacher
should review before relying on this") is never read, never rendered.
Verified directly by a dedicated unit test
(`raw RiskFlag.reason text never appears in any rendered headline or
detail`, asserting against the JSON-serialized output). No Projection
recomputation happens in the Home composition layer — `blueprint.risk` is
consumed exactly as `composeBlueprint()` already produced it.

## 16. Attendance Decision

**Attendance code is implemented but currently inert for real parents —
named, not hidden.** The canonical threshold
(`ATTENDANCE_ATTENTION_THRESHOLD_PERCENT = 90`) genuinely exists and is
already shared with `composeParentSummary`, satisfying the mission's own
bar for inclusion. But tracing `composeAttendance()` → `getLearnerAttendanceHistory()`
(`lib/core/attendance.ts:524-534`) found:

```ts
const admin = await isSchoolAdmin(actorUserId, schoolId)
if (!admin) throw new PermissionDeniedError('Only school admins may read a
  learner\'s full attendance history in this sprint.')
```

A parent's `actorUserId` is never a school admin, so this ALWAYS throws for
a real parent — `composeAttendance()` catches it and returns
`status: 'unavailable'`. This is a **pre-existing gap this phase did not
introduce**, confirmed by direct HTTP-level reproduction in this phase's
own fixture (see the code comment in
`lib/testing/parentAttentionAction.http.integration.test.ts`'s `before()`
hook): seeding real attendance data and a real parent session still yields
`blueprint.attendance.status === 'unavailable'`. It also means the
PRE-EXISTING "Learning Time" Home card and the PRE-EXISTING
`review_attendance` ParentAction (both untouched by this phase) have
NEVER actually shown a real number to a parent — they always render the
`PARENT_STATUS_LABEL` fallback / never reach `critical` priority. This
phase's Attendance-attention code is correct, guarded, and tested
(`attentionAction.test.ts`'s attendance tests pass on synthetic input),
but cannot be exercised by any live parent session until the admin-tier
gate on `getLearnerAttendanceHistory` is revisited — a genuinely bigger
change (widening an access-control function) explicitly out of this
phase's scope. Left in place rather than removed, since it becomes
correct for free the moment that gate changes.

## 17. Compass Decision

**Not surfaced in Attention or Action, per P2's absolute invariant.**
`learningCompass.data.currentLearningFocus` stays exactly where P3 already
put it (the "Learning Compass" card), never duplicated into the new
sections, never phrased as a session-start CTA.

## 18. Career Decision

**Never in Attention, confirmed.** `explore_career_journey` remains
available only in the Actions list (unchanged, inherited from the existing
`composeParentActions()` output) — no new Career Signals surface, no
"no career saved yet" concern framing.

## 19. Holiday Decision

**Unchanged.** `continue_holiday_learning` surfaces only when
`learningCompass.data.holidayProgrammeAvailable` is true — this is the
existing, already-conditional behavior; not made permanent, not
newly time-gated by this phase (no additional relevance-window logic was
added or found necessary).

---

## 20. Home After

```
/child/{learnerId}  (Parent Home)
│
├─ Child name / class            (unchanged)
│
├─ NEEDS ATTENTION                (NEW — zero-to-3 items, primary + up to
│    ├─ primary item                2 secondary; honest zero state)
│    ├─ secondary item(s)
│    └─ [View full picture →]
│
├─ WHAT CAN I DO?                 (NEW heading over the EXISTING
│    ├─ action 1                    ParentActionCard component — filtered,
│    ├─ action 2                    capped at 3 — only rendered if non-empty)
│    └─ action 3
│
├─ This Term                      (unchanged — links to /full)
├─ From the Teacher               (unchanged)
├─ Learning Time                  (unchanged — still shows raw % or
│                                    fallback text, now known to be
│                                    permanently the fallback for a real
│                                    parent, §16)
├─ Career Exploration             (unchanged)
├─ Assignments                    (unchanged — full list still lives here)
├─ Gradebook                      (unchanged)
├─ Learning Compass               (unchanged)
├─ Holiday Plan                   (unchanged)
├─ How Has My Child Grown?        (unchanged)
└─ Full Picture / Growth Journey  (unchanged footer links)
```

---

## 21. Existing Cards

| Card | Verdict | Reason |
|---|---|---|
| "Today's Actions" (`ParentActionCard`) | **MERGE** | Reused verbatim as "What Can I Do?" — same component, filtered `actions` prop, new `title` prop (default preserved for any other future caller) |
| This Term | KEEP | Distinct destination + content (Blueprint headline), not duplicated by Attention (Attention's academic item is conditional/concern-specific; This Term is unconditional) |
| From the Teacher | KEEP | Real distinct content; `read_teacher_reflection` action suppressed from Actions specifically to avoid duplicating this card, not the other way around |
| Learning Time (attendance) | KEEP, flagged | Currently shows a fallback for every real parent (§16) — not this phase's to fix, but named so a future phase doesn't miss it |
| Career Exploration | KEEP | Distinct destination, never touched |
| Assignments | KEEP | The full per-assignment list stays here; Attention's overdue count links here, doesn't replace it |
| Gradebook | KEEP | Untouched |
| Learning Compass | KEEP | Untouched (P3 already merged its one duplicate, "Compass Progress") |
| Holiday Plan | KEEP | Untouched |
| How Has My Child Grown? | KEEP | Untouched |

**No card was removed or demoted.** Every real destination that existed
before this phase is still reachable exactly as before — this phase is
additive (two new sections at the top) plus one presentation-only merge
(Today's Actions → What Can I Do?, same component, same data source,
narrower filter).

**Before/after navigation map:** identical destination set before and
after — `/full`, `/child/{id}/assignments`, `/child/{id}/gradebook`,
`/child/{id}/progress`, `/child/{id}/holiday`, `/child/{id}/journey`,
`/child/{id}/history/{snapshotId}`, `/report-card`,
`/career-intelligence` — every one still reachable from Home exactly as
before P4; the only additions are attention-item links that reuse these
SAME destinations (never a new route).

---

## 22. Learning Summary

**Deferred, per mission Step 27's own preferred outcome.** No new
cross-subject summary was built. "This Term" (unchanged, links to `/full`)
remains Home's answer to "how is my child doing" — deliberately modest,
not converged with Gradebook/Report Card/Academic Clinic's disagreeing
authorities (P0's four-conflicting-surfaces problem stays untouched).

## 23. Recent Change

**Deferred.** `latestSnapshot` (already read, already used by "How Has My
Child Grown?") remains the only recent-change-shaped signal on Home. No
new trajectory/change narrative was generated — the growth-timeline field
P1's audit found "computed but discarded" was evaluated again and still
judged not safely renderable as parent-facing prose within this phase's
"no LLM, no new narrative" constraint.

---

## 24. Identity Proof

Executed via the new HTTP suite (`lib/testing/parentAttentionAction.http.integration.test.ts`,
8/8 passing) against a real fixture: one parent, two Core children (A, B)
at the SAME school (the highest-risk same-parent-sibling case the mission
calls out explicitly), plus a third Core child (D) at a DIFFERENT school,
plus an unrelated parent. Confirmed: Child A's overdue-assignment
attention item never appears on Child B's Home (zero signal → honest
zero-attention state); Child A's own destination link
(`/child/{A}/assignments`) never appears on Child B's page; Child A's
Home shows exactly its OWN overdue count (1), never Child D's (5, a
different school); an unrelated parent receives neither the child's name
nor any attention content for a child that isn't theirs. All new reads
(`resolveLegacyStudentId`, the assignment query) key off the URL's own
already-`requireParent`-verified `learnerId` — no new identity bridge was
introduced (Architecture Guard F, §31).

## 25. Role Safety

Proven both by code construction and by a dedicated HTTP test
(`no learner-mutation CTA anywhere on Home (P2's invariant, re-proven
under P4)`, asserting the rendered HTML never contains "Start a Compass
session," "Start Session," "Submit Assignment," "Answer Quiz," or "Start
learning"). By construction: `buildParentHomeAttentionAction` only ever
consumes `ParentAction[]` from the existing, already-audited
`composeParentActions()` output (§4 found zero LEARNER/TEACHER/AMBIGUOUS
entries in that output today) plus its own hardcoded attention-item
templates (assignment counts, risk copy, attendance copy) — none of which
construct a Compass-session-start, quiz-answer, submit, career-interest-save,
adaptive-approval, delivery, or marking action anywhere in this file.

## 26. Performance

**Before this phase:** Home's server-side cost was exactly one
`composeBlueprint()` call plus `getLatestBlueprintSnapshot()` (unchanged,
P3's own documented baseline).

**After this phase:** `composeBlueprint()` calls: **unchanged, still
exactly 1**. New reads: `resolveLegacyStudentId()` (one query, already
canonical, already called internally by `composeBlueprint()` itself for
its own purposes — this is a second, cheap call to the SAME already-
existing function, not a new lookup mechanism) plus, only when a legacy
bridge exists, ONE call to `repos.assignments.findSubmissionsWithAssignmentsForStudents`
(a single batched query, `!inner` join, no loop, the exact function
`lib/core/assignmentDiscovery.ts` already uses elsewhere in the
platform). **Total: 2 additional small server-side reads, 0 additional
client-side fetches.** This is within the mission's own "one cheap server
read materially improves usefulness" allowance (Step 36) — quantified
here rather than asserted.

## 27. Mobile

**Code inspection only — no live/rendered browser check was performed in
this environment**, stated plainly rather than implied otherwise. Checked
by reading the actual Tailwind classes emitted:
`ParentAttentionSection`/`ParentActionCard` both reuse the exact card
pattern (`rounded-2xl border p-4`, `max-w-2xl mx-auto px-4` container) P3
already reasoned through and shipped for `ChildContextHeader` — no new
layout primitive was introduced. Long headline text
(e.g. "3 assignments are overdue.") and long subject names in risk copy
(e.g. "Integrated Science may need a little extra attention.") wrap
naturally inside the existing card's block-level `<p>` tags (no
`whitespace-nowrap`/fixed-width anywhere in the new components) — verified
by reading the component source, not by rendering it. A long child name
was already handled by `ChildContextHeader` (P3, untouched here) and this
phase's own header block (`{name}` / `{class}`) reuses that same
unmodified markup.

## 28. Low Connectivity

Zero sequential client waterfalls: both new sections are server-rendered
inside the same request that already renders the rest of Home — no
`'use client'` component, no `useEffect`, no client-side `fetch` was
added anywhere in this phase's files (confirmed by `grep -l "use client"`
against every file this phase touched: none match). No LLM call, no
Career Signals fetch, no AI generation — the entire new composition path
(`buildParentHomeAttentionAction`) is a pure, synchronous function.

---

## 29. HTTP Tests [exact count]

**8 new tests**, `lib/testing/parentAttentionAction.http.integration.test.ts`,
added to `scripts/parent-http/parent-http-tests.json`:

```
✔ GET /child/[A]: overdue assignment renders under "Needs Attention"
✔ GET /child/[A]: a real report-card-publication snapshot produces a genuine "What Can I Do?" action
✔ GET /child/[A]: no learner-mutation CTA anywhere on Home (P2's invariant, re-proven under P4)
✔ GET /child[B]: zero signals -> honest "Nothing needs your attention right now", never Child A's overdue item
✔ Sibling isolation: Child A's attention items never appear on Child B's Home (same parent, same school)
✔ Multi-school isolation: Child A's Home shows its OWN overdue count (1), never Child D's (a different school)
✔ Action destination authorization: the overdue attention item's own destination 200s for the same parent
✔ An unrelated parent never sees Child A's identity or attention content
```

Full parent HTTP manifest, `npm run test:parent-http` (6 files): **78/78
passing** (70 pre-existing baseline, confirmed unchanged at the START of
this phase before any code was written, + 8 new).

## 30. Unit Tests [exact count]

**19 new tests**, `lib/parentExperience/attentionAction.test.ts`, added to
`scripts/standard-tests.json`:

```
ℹ tests 19
ℹ pass 19
ℹ fail 0
```

Covering: no signals (zero-attention), exactly one item, multiple items
with correct priority ordering, same-subject risk-flag dedup, distinct
same-subject obligations (no over-suppression), a non-critical teacher
action (action-only, not attention), a generic risk item (no subject),
`overallRiskLevel: 'normal'` never producing an item even with stray
flags, due-soon-only (secondary, not primary), attendance at/above vs.
below threshold, raw `RiskFlag.reason` never leaking into output, every
destination being a safe internal relative path, zero real actions after
filtering, actions capped at 3 with order preserved, an assignment-check
failure producing an honest caveat (not a false all-clear), the same
failure alongside a real signal (no caveat needed, real signal wins), and
`summarizeAssignmentAttention`'s own counting logic (pending-only,
overdue-vs-due-soon split, empty input returning zero counts not null).

## 31. Architecture Guards

- **(A) Prioritizer is pure:** `lib/parentExperience/attentionAction.ts` has zero imports from `@/lib/repositories`, zero `await`, zero AI/LLM calls — verified by reading the file's own import list and by the fact its unit tests need no mocking, no DB, no async setup.
- **(B) No Projection recomputation in the Parent Home presentation layer:** the Home page passes `blueprint.risk` (already composed) directly into `buildParentHomeAttentionAction` — `recomputeLearnerProjection` is never imported by `app/(parent)/child/[learnerId]/page.tsx` or `lib/parentExperience/attentionAction.ts`.
- **(C) No Career capability/matching imports in this new code:** `grep -n "career" lib/parentExperience/attentionAction.ts` matches nothing — Career is untouched by this phase's new module.
- **(D) No Compass mutation path exposed:** confirmed by the dedicated HTTP test (§29) and by the fact `lib/parentExperience/attentionAction.ts` never imports anything from `lib/compass/`.
- **(E) Parent actions use viewer-safe destinations:** every attention/action destination emitted is either an existing `ParentAction.destination` (already gated by `isActionDestinationValidForViewer`/P2's discipline) or a hardcoded `/child/{learnerId}/{assignments|full}` string built from the route's own already-`requireParent`-verified `learnerId` — no new destination-construction logic was added.
- **(F) No new identity bridge:** `resolveLegacyStudentId()` — the ONE existing canonical Core<->legacy resolver — is reused as-is; no per-route bridge, no new lookup mechanism.
- **(G) No LLM calls:** confirmed by reading every new file's imports — zero AI SDK imports anywhere in this phase's changes.
- **(H) Attention is presentation-only, never persisted:** `buildParentHomeAttentionAction` returns a plain object consumed directly by a React server component in the same request — no `INSERT`/`UPDATE` anywhere in this phase's files (verified: `grep -n "\.insert\|\.update" lib/parentExperience/attentionAction.ts app/\(parent\)/child/\[learnerId\]/page.tsx` matches nothing new; the page's only DB calls are the pre-existing `composeBlueprint`/`getLatestBlueprintSnapshot`/`requireParent`/`repos.learners.findSchoolId` plus this phase's two new READ calls).

## 32. Full Regression [exact counts]

- **STANDARD suite** (`npm test`): `tests 1088 / pass 1088 / fail 0` (1069 pre-existing + 19 new).
- **Parent HTTP manifest** (`npm run test:parent-http`): `tests 78 / pass 78 / fail 0` (70 pre-existing baseline + 8 new).
- **Targeted non-HTTP regression** (`lib/compass/compassActorBoundary.integration.test.ts`, `lib/core/identity.test.ts`, `lib/core/permissions.selforparent.test.ts`, `lib/core/permissions.student-parent.test.ts`, against local Docker): `tests 30 / pass 30 / fail 0`, unmodified.
- **`tsc --noEmit`:** clean, zero errors.
- **ESLint** on every file this phase touched: clean, zero warnings/errors.
- **`next build`:** exit code 0, `✓ Compiled successfully`, full route manifest generated, zero new errors (only pre-existing unrelated informational notices, confirmed by grep of the build log for `^Error|Failed to compile|Type error` — zero matches).
- **`node scripts/check-standard-manifest.mjs`:** `STANDARD manifest OK — 132 files verified, zero privileged-infrastructure signals`.

No existing test was weakened, skipped, or had an assertion loosened to
force a pass.

---

## 33. Files Changed

New (4):
- `lib/parentExperience/attentionAction.ts` — the pure prioritizer/composer.
- `lib/parentExperience/attentionAction.test.ts` — 19 unit tests.
- `components/parent/ParentAttentionSection.tsx` — "Needs Attention" rendering.
- `lib/testing/parentAttentionAction.http.integration.test.ts` — 8 HTTP tests.

Edited (4):
- `app/(parent)/child/[learnerId]/page.tsx` — wires the new sections in, adds the one new server read (`resolveLegacyStudentId` + `findSubmissionsWithAssignmentsForStudents`).
- `components/parent/ParentActionCard.tsx` — adds an optional `title` prop (default `"Today's Actions"` unchanged).
- `scripts/standard-tests.json` — adds `lib/parentExperience/attentionAction.test.ts`.
- `scripts/parent-http/parent-http-tests.json` — adds `lib/testing/parentAttentionAction.http.integration.test.ts`, updates the manifest description to mention P4.

**8 files changed total (4 new), 0 deletions of existing functionality.**
Committed in 3 focused commits (`8b5e93c`, `b4704e7`, `c08194e`). No file
from the 206-file pre-existing dirty working tree was touched, staged, or
committed — confirmed by `git diff --stat` scoped to exactly these 8
paths before each commit.

## 34. Database Changes [expected NONE]

**None.** No migration was written, applied, or found necessary. Every
new read composes existing tables (`assignments`, `assignment_submissions`,
`class_students`) through the existing, unmodified
`repos.assignments.findSubmissionsWithAssignmentsForStudents()`
repository function, or reads fields `composeBlueprint()` already produces
(`attendance`, `risk`, `recommendedNextSteps`). The one seeded table in
this phase's own HTTP fixture (`blueprint_snapshots`) is an existing
table, inserted into directly by the test the same way
`createBlueprintSnapshot()` already would — no schema change.

---

## 35. Named Limitations

**New, found this phase:**

- **Attendance is currently inert for real parents** (§16) — a genuine,
  previously-undocumented pre-existing gap (`getLearnerAttendanceHistory`
  admin-tier-only), confirmed by direct fixture reproduction. Affects the
  PRE-EXISTING "Learning Time" card and `review_attendance` action too,
  not just this phase's new code. Not fixed here (widening an
  access-control function is a bigger, separate decision explicitly
  outside this phase's "converge presentation, don't touch access
  control" mandate) — flagged as the most concrete, actionable finding
  for a P5 to pick up.
- **Learning Summary / Recent Change** (§22/§23) — deliberately deferred again, consistent with P3's own reasoning and the mission's explicit preference for deferral over inventing a new conflicting summary.
- **Mobile** (§27) — code inspection only, no live render check (this environment has no browser/screenshot tool available to this session), stated honestly rather than glossed.
- **Risk translation vocabulary is new and narrow** (3 severity levels × subject/no-subject = 6 fixed sentences) — deliberately minimal per the mission's "no new risk-language vocabulary system" instruction, but a future phase adding a 4th risk dimension would need to extend this table by hand, same discipline `lib/parentExperience/terminology.ts` already requires of itself.
- **`explore_career_journey`'s destination (`/career-intelligence`) remains reachable by a self-viewing student**, not exclusively a parent action — this is a P0-documented, pre-existing characteristic of `isActionDestinationValidForViewer`, not introduced or worsened by this phase, carried forward unchanged.

**Carried forward, unresolved (per P0/P1/P2/P3/P3.5, unchanged by this phase):**
four conflicting academic-result surfaces (Gradebook/Report Card/Blueprint/
Academic Clinic); Academic Clinic authority divergence; no parent→teacher
communication; three career-report surfaces, three risk-language
vocabularies (this phase's new risk copy is a FOURTH, narrowly-scoped
vocabulary, specific to Attention items only — not a convergence of the
other three, named explicitly so it isn't miscounted as one); Clinic
reachable from the shared parent nav despite being a legacy-space page;
Report Card missing a nav entry; family-wide pages (Resources/Calendar)
lack per-child labels; parent privacy policy undocumented; `/learn`'s
teacher-suggestion/pending-assignment banners still use learner-framed
copy for a parent viewer (P3's own named gap, no DOM-testing framework
exists to prove a fix cleanly, unchanged).

---

## Recommended P5

**PARENT ACADEMIC-RESULT AUTHORITY CONVERGENCE** was the standing
recommendation carried from P3/P3.5, and nothing found in this phase
overrides it — but this phase's own evidence surfaces a smaller, more
urgent, more concretely-scoped alternative that a P5 should seriously
weigh going first: **closing the Attendance parent-visibility gap
(§16/§35)**. It is narrower than a full academic-authority convergence,
has a precise root cause already identified (`getLearnerAttendanceHistory`'s
admin-tier gate), and directly un-blocks BOTH this phase's own Attendance
Attention source AND two pre-existing, previously-unnoticed dead features
(the "Learning Time" card, the `review_attendance` action) — a
correctness fix with an unusually clear, bounded scope compared to the
four-conflicting-surfaces problem, which remains real but comparatively
open-ended. Recommendation: scope P5 as EITHER the Attendance-visibility
fix (small, precise, unblocks existing dead code) OR the
academic-result-authority convergence (large, foundational) — not both in
one phase — and let the next phase's own audit make that call with fresh
eyes, rather than this document pre-deciding it.
