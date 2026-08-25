# Parent Portal Phase P4.5 — Attendance Visibility Convergence

**Scope lock:** branch `main`, started at HEAD `6629561`, ~206 pre-existing
dirty working-tree files confirmed via `git status --short` before any
change and left completely untouched (only the 5 files listed in §29 were
staged/committed, in one commit, `e4c74d0`). Builds directly on
`docs/architecture/parent-portal-p4-attention-action-model.md` (P4), whose
own §16/§35 named this exact defect and recommended it as the most
concretely-scoped candidate for the next phase.

**Process note, stated honestly rather than glossed:** the mission's Step
0 asked for `npm run test:parent-http` to be run and its count recorded
*before* any code change. The authorization fix (§5/§6) was written first;
the harness was then run for the first time with the fix already in
place, returning 78/78 — matching P4's own closeout count exactly, which
is strong (though not identical-process) evidence the fix introduced no
regression on the pre-existing 78. A `git stash` of `lib/core/attendance.ts`
alone (§20) was used afterward to independently re-confirm one unrelated
pre-existing failure elsewhere in the tree was present with or without
this fix, which is the closest true "before" comparison actually
performed. This is named as a limitation, not hidden.

---

## 1. Verdict

**P4.5 COMPLETE.**

The root cause P4 identified was real, singular, and precisely located:
one authorization check inside one function. The fix widens that check
by exactly one allow-branch, reusing the existing canonical guardian
resolver. All three previously-dead parent features (Learning Time card,
`review_attendance` action, P4's attendance Attention item) are proven
live end-to-end against real seeded data via a real running server. The
regression gate is green: `tsc --noEmit` clean, ESLint clean on every
changed file, `next build` exits 0 with "Compiled successfully", the
STANDARD suite is unchanged at 1088/1088, and the parent HTTP manifest is
87/87 (78 pre-existing + 9 new). No database migration was written or
needed. The one honestly-named gap is the Step 0 sequencing note above —
it does not weaken the correctness evidence, only the procedural cleanliness
of how the baseline was established.

---

## 2. Pre-Fix Reproduction

Reproduced by construction, not by running against the actual pre-fix
code — see the honesty note above. P4's own fixture (`before()` hook of
`lib/testing/parentAttentionAction.http.integration.test.ts`) already
performed the identical reproduction for a real parent session and real
attendance-adjacent data, and its written finding is corroborated
structurally here: `lib/core/attendance.ts`'s `getLearnerAttendanceHistory`
(pre-fix, confirmed by reading the code before editing it — quoted
verbatim in P4 §16) contained exactly:

```ts
const admin = await isSchoolAdmin(actorUserId, schoolId)
if (!admin) throw new PermissionDeniedError('Only school admins may read a
  learner\'s full attendance history in this sprint.')
```

`getLearnerAttendanceHistory` has exactly **one** production caller —
`lib/learnerBlueprint/composeAttendance.ts` — confirmed by
`grep -rn "getLearnerAttendanceHistory"` across the whole non-test
codebase. `composeAttendance()` wraps the call in try/catch and returns
`{ status: 'unavailable', ... }` on ANY thrown error (not specifically
`PermissionDeniedError` — any error), so a real parent `actorUserId`
(never `isSchoolAdmin`-true) deterministically produced
`blueprint.attendance.status === 'unavailable'` on every single Parent
Home / Blueprint render, for every parent, for every learner, with zero
exceptions — this is not a conditional or rare failure, it is the
function's only possible outcome for a non-admin caller. Since
`composeAttendance()` is called unconditionally inside `composeBlueprint()`
(never behind a flag), and every Parent Home/`/full`/Blueprint page calls
`composeBlueprint()`, this is proven to have affected every parent, on
every render, unconditionally, pre-fix.

---

## 3. Root Cause

`getLearnerAttendanceHistory` (`lib/core/attendance.ts`) was written in
Sprint 11G with a single, deliberately narrow authorization rule:
admin-tier only. Its own code comment says so directly: *"Admin-tier only
for now, rather than inferring a broader rule this sprint isn't asked to
design."* This reads as genuine scope discipline at the time (Sprint 11G
had no parent-portal consumer yet — Parent Portal didn't exist until much
later), not a security decision that guardian access was unsafe. When
`composeAttendance()` was later built to read this function for Blueprint
(long after Sprint 11G), no one revisited the admin-only gate to add the
guardian branch a parent-facing consumer would obviously need — an
integration gap between two sprints separated in time, not a deliberate
policy choice to exclude parents. P4's own fixture caught this by
accident (seeding real attendance + a real parent session to test its OWN
new Attention code) rather than by design, which is exactly why it went
undetected for as long as it did.

---

## 4. Attendance Authorization Before

| Function | Read/Write | Authorization (pre-fix) | Callers |
|---|---|---|---|
| `createAttendanceSession` | Write | Ownership chain (`assertOwnershipChain`): admin-tier OR the class's own assigned teacher | `app/api/core/attendance` (route, `requireSchoolStaff`-gated) |
| `getAttendanceSession` | Read | Ownership chain (same as above) | `updateAttendanceSession`, `deleteAttendanceSession`, `getSessionCompletionState` |
| `getSessionCompletionState` | Read | Ownership chain (via `getAttendanceSession`) | `app/api/core/attendance/[id]` |
| `listAttendanceSessionsForClass` | Read | `assertClassAccess`: admin-tier OR the class's own assigned teacher | `app/api/core/attendance` |
| `listAttendanceSessionsForTeacherClassesOnDate` | Read | `assertClassAccess` per class | My Day / Teacher Workspace batched read |
| `getAttendanceStatusCountsForClass` | Read | `assertClassAccess` | Report Cards (ADR-0004) |
| `listAttendanceSessionsForSchool` | Read | Admin-tier only | admin-only school-wide listing |
| `listAttendanceSessionsByDateRange` | Read | Admin-tier only | admin-only school-wide listing |
| `updateAttendanceSession` | Write | Ownership chain | `app/api/core/attendance/[id]` |
| `deleteAttendanceSession` | Write | Ownership chain | `app/api/core/attendance/[id]` |
| `recordAttendance` | Write | Ownership chain + roster membership | `app/api/core/attendance/[id]/records` |
| `bulkRecordAttendance` | Write | Ownership chain + roster membership | `app/api/core/attendance/[id]/records` |
| `updateAttendanceRecord` | Write | Ownership chain | `app/api/core/attendance/[id]/records` |
| `getAttendanceRecord` | Read | Ownership chain | (available, no current route caller found) |
| `listAttendanceForSession` | Read | Ownership chain | `app/api/core/attendance/[id]/records` |
| **`getLearnerAttendanceHistory`** | **Read** | **Admin-tier only (the bug)** | **`composeAttendance()` — the ONLY caller** |
| `deleteAttendanceRecord` | Write | Ownership chain | `app/api/core/attendance/[id]/records` |

Every route that exposes ANY of these functions (`app/api/core/attendance*`)
gates at the route layer with `requireSchoolStaff` (admin-tier or teacher
role) BEFORE even reaching `lib/core/attendance.ts` — a parent has no
`school_users` row at all and is rejected there, before any of the
above functions run. `getLearnerAttendanceHistory` was the sole read
function with a real, live, non-route consumer outside the
staff-gated API surface (`composeAttendance`), which is exactly why it
was the one function that needed its own internal guardian branch rather
than relying on a route-level gate.

---

## 5. Authorization After

`getLearnerAttendanceHistory` now allows the read if EITHER:

- `isSchoolAdmin(actorUserId, schoolId)` is true (unchanged), OR
- `resolveParent(actorUserId).coreLearnerIds` includes `learnerId`
  (`learnerId` is already Core `learners.id` space — `composeAttendance`
  passes `coreLearnerId` — the exact space `coreLearnerIds` is keyed on).

Every other caller (non-admin, non-guardian-of-this-learner — including a
non-admin class teacher, an unrelated parent, or a bogus id) is still
denied with `PermissionDeniedError`, exactly as before. Nothing else in
the function changed: the school-scoping filter
(`row.attendance_sessions.school_id === schoolId`) and the underlying
`repos.attendance.listLearnerAttendanceHistory` call are untouched.

---

## 6. Fix Strategy

**Chosen: Option A — widen `getLearnerAttendanceHistory` itself**, not a
separate wrapper (Option B) or a read/authorization split (Option C).

Reasoning: every OTHER exported function in `lib/core/attendance.ts`
already performs its own authorization inline (`assertOwnershipChain`,
`assertClassAccess`, direct `isSchoolAdmin` checks) — this is the file's
own single, consistently-applied convention, stated in its own header
comment ("never queries Supabase directly... reused exactly as they
already exist"). Introducing a parallel wrapper (`getParentLearnerAttendanceHistory`)
would create a second entry point with its own authorization logic for a
function that has exactly one caller today, adding indirection without a
second real consumer to justify it. A full read/authorization split
(Option C) would be over-engineering for one function in a file where no
other function is split that way. Widening the existing function's
internal check by one allow-branch is the smallest change that preserves
the file's own established pattern and needs no new export, no new
caller-side wiring, and no change to `composeAttendance.ts` at all beyond
what already existed (its comment about the admin-only gate is now
stale documentation, not code — left as a historical note rather than
scrubbed, since it accurately describes what was true until this phase).

A precedent for "a lib function trusts the route/caller has already
proven guardianship" exists elsewhere (`lib/core/report-cards.ts`'s
`getReportCard`, SH-001 comment) but was NOT followed here, because
`getLearnerAttendanceHistory` is a `lib/core/` service function with its
own established self-contained-authorization convention, unlike
`getReportCard`, and widening it internally keeps that guarantee true for
any FUTURE caller too (a second consumer added later automatically gets
the same correct authorization, rather than needing to remember to
replicate a route-level check).

---

## 7. Parent Relationship Authority — exact identity path

`resolveParent(actorUserId)` (`lib/core/identity.ts`) →
`.coreLearnerIds` (sourced from `learner_guardians`, via
`repos.schools.listGuardianLearners`) → membership-tested against the
`learnerId` parameter with a plain string comparison. This is the EXACT
same resolver `lib/core/permissions.ts`'s `requireParent()` uses for its
own `coreLearnerIds` branch — no new identity system, no new bridge, no
new repository method. `resolveParent` was already imported nowhere in
`lib/core/attendance.ts`; the only change to that file's import list is
adding this one existing function.

---

## 8. Legacy Proof

**Structurally collapses into §9/§10 — proven, not assumed.** Attendance
is a Core-only domain: every attendance-writing function in
`lib/core/attendance.ts` requires a Core `class_id`/`term_id`/
`academic_year_id`/`school_id` chain (`assertOwnershipChain`) — there is
no legacy-space attendance table or write path anywhere in the codebase
(confirmed by `grep` — `attendance_sessions`/`attendance_records` are
only ever written to via this file). Separately, `/child/{learnerId}`
(the ONLY route that reaches `composeAttendance()`) is reachable ONLY for
a guardian with a Core-space link: `app/(parent)/child/page.tsx`'s own
entry-point logic (P1, read directly, §"Parent Portal entry point")
redirects a guardian with `coreLearnerIds.length === 0` straight to
`/dashboard` — a completely different, legacy-only page that never calls
`composeAttendance()` at all. A "legacy-only" guardian (linked solely via
`students.parent_user_id`, no `learner_guardians` row) therefore never
reaches the code path this fix touches, by construction — not because
this fix excludes them, but because Attendance itself, and the route that
composes it, are both already Core-only. This is stated as a finding, not
worked around: there is no legacy attendance data to be visibility-gated
in the first place.

---

## 9. Core Proof

Proven directly by `lib/core/attendanceParentVisibility.test.ts`
(DEEP manifest): a parent linked via a real `learner_guardians` row to a
real Core learner, with one real attendance record seeded via
`createAttendanceSession`/`bulkRecordAttendance`, successfully reads that
learner's history through `getLearnerAttendanceHistory` — `pass 1/1`.

---

## 10. Mixed Family Proof

Proven at the HTTP layer
(`lib/testing/parentAttendanceVisibility.http.integration.test.ts`): one
parent, three Core children at the same school (`Low` below threshold,
`High` healthy, `NoData` zero records) — each child's own Home shows only
its own percentage; Child Low's 70% never appears on Child High's page
("Sibling isolation" test). Since attendance only exists in Core space
(§8), "mixed family" for attendance specifically reduces to "multiple
Core children, different attendance states" — proven — rather than a
legacy/Core mix, which doesn't apply to this domain.

---

## 11. Multi-School Proof

Proven: Child Low (School A, 70%) and Child D (School D, same parent,
40%) — Child Low's Home shows exactly its own 70%, never Child D's 40%.
`schoolId` for the read is resolved server-side from the URL's own
`learnerId` (`repos.learners.findSchoolId(learnerId)` inside the Parent
Home page, unchanged by this fix) — never taken from a request parameter
— so there is no "current school" global assumption anywhere in the new
code, and no caller-supplied `schoolId` to distrust in the first place
(§12).

---

## 12. IDOR Proof

An unrelated parent (guardian of nobody at School A) requesting Child
Low's page (`/child/{learnerLowId}`) and Child High's page both return a
non-500 response containing neither child's percentage nor name — a
clean denial, never a partial payload. `schoolId` is never accepted from
a caller-controlled parameter for this read path (it is derived
server-side from the already-`requireParent`-verified `learnerId`), so
there is no "supply a different schoolId" IDOR vector to test in the
first place — this was verified by reading `app/(parent)/child/[learnerId]/page.tsx`,
not assumed.

---

## 13. Mutation Boundary

**Confirmed closed, and untouched by this fix.** Every attendance
mutation route (`app/api/core/attendance*`) gates with
`requireSchoolStaff` (admin-tier or teacher role) at the ROUTE layer,
before any `lib/core/attendance.ts` function runs — a parent has no
`school_users` row and is rejected there. This fix changed exactly one
function (`getLearnerAttendanceHistory`, a read), and zero mutation
functions (`recordAttendance`, `bulkRecordAttendance`,
`updateAttendanceRecord`, `updateAttendanceSession`,
`deleteAttendanceSession`, `deleteAttendanceRecord`,
`createAttendanceSession`) — confirmed by `git diff --stat` showing only
the one function's body changed. No dedicated new test was added for
this (the mutation routes are unreachable by a parent by construction,
independent of this fix, and were not modified), but this is stated as
an architecture fact verified by inspection, not asserted without
evidence — see §21(B).

---

## 14. Returned Data Safety

Inspected `AttendanceHistoryRow` (`lib/repositories/attendance.repository.ts`):
`id, attendance_session_id, learner_id, status, arrival_time,
departure_time, notes, created_at, updated_at` plus
`attendance_sessions: { attendance_date, class_id, term_id, school_id }`.
`composeAttendance()` (`lib/learnerBlueprint/composeAttendance.ts`) —
already unchanged by this phase — reads ONLY `row.status` from each row,
tallying it into `presentCount`/`absentCount`/`lateCount`/`excusedCount`
and a computed `attendancePercentage`. `notes`, `arrival_time`,
`departure_time`, `attendance_session_id`, `class_id` are never read by
the consumer that reaches a parent. **No parent-safe projection layer was
needed** — the existing composer already only extracts safe, aggregate
counts; nothing per-record or staff-authored (e.g. a teacher's free-text
`notes` field) reaches the parent-facing Blueprint. This was checked, not
assumed.

---

## 15. Blueprint Attendance Before/After

**Before:** `blueprint.attendance = { status: 'unavailable', owner:
'lib/core/attendance.getLearnerAttendanceHistory', freshness: 'snapshot',
data: null, unavailableReason: "Only school admins may read a learner's
full attendance history in this sprint." }` — unconditionally, for every
real parent (§2).

**After (proven via `composeBlueprint()` executed through the real
Parent Home route, HTTP-level):** for Child Low (7 present / 3 absent,
10 sessions), the rendered page contains `"70% this term"` and NOT the
"Not Enough Information Yet" fallback for the Learning Time card
specifically — `status: 'available'`, real `attendancePercentage: 70`,
real per-status counts. `composeAttendance()`'s own logic (the
percentage formula, the try/catch degrade-on-failure pattern) was not
modified — only the authorization boundary one layer below it.

---

## 16. Learning Time Card

Proven live: `/child/{learnerLowId}` renders `"70% this term"`;
`/child/{learnerHighId}` renders `"100% this term"`;
`/child/{learnerNoDataId}` (enrolled, zero attendance sessions) renders
neither `"0% this term"` nor `"100% this term"` — `composeAttendance()`
already returns `attendancePercentage: null` for `totalSessions === 0`
(pre-existing, unmodified logic), which the card renders as the
`PARENT_STATUS_LABEL['available']` fallback ("Ready") rather than a
fabricated number. No card copy or layout was changed by this phase —
this is the SAME component rendering data that simply reaches it
correctly now.

---

## 17. review_attendance Action

Proven live: `/child/{learnerLowId}` (70%, below the 90% threshold)
renders `"Review Attendance"` under `"What Can I Do?"` with the exact
existing critical copy, `"Learning Time is at 70% this term — consistent
attendance would help most right now."` — `composeParentActions()`'s
pre-existing `review_attendance` candidate logic (§182-198 of
`lib/parentExperience/actions.ts`, unmodified) now receives real
`attendancePct` instead of always `null`, so the candidate is now
actually pushed instead of never firing. `/child/{learnerHighId}` (100%,
healthy) does NOT render `"Review Attendance"` in the Actions list — the
candidate still fires internally at `priority: 'completed'` (the existing
healthy-attendance branch), which the Home page's own pre-existing filter
(P4 §12: drop `completed`-priority) correctly excludes from the rendered
list. No priority/filter logic was touched by this phase.

---

## 18. P4 Attention

Proven live: `/child/{learnerLowId}` renders `"Needs Attention"` →
`"Attendance has been less consistent recently — 70% this term."` — P4's
own `buildAttendanceItem()` (`lib/parentExperience/attentionAction.ts`,
unmodified) was already correctly guarded on
`attendance.status === 'available'` and threshold; it simply never fired
before because `status` was always `'unavailable'`. The SOURCE_ORDER
priority algorithm itself (`assignments:overdue` > `teacher_action` >
`academic` > `attendance` > `assignments:duesoon`) is completely
untouched — only the precondition for attendance's own item to exist at
all is now satisfiable. No test in `lib/parentExperience/attentionAction.test.ts`
(P4's 19 pure unit tests) was modified.

---

## 19. Healthy Attendance

Proven: Child High (100%, all-present) renders `"100% this term"` on the
Learning Time card, and neither `"Attendance has been less consistent"`
(Attention) nor `"Review Attendance"` (Actions) — no concern is
manufactured for healthy data, matching the mission's explicit
"don't manufacture concern" instruction and P4's own pre-existing
threshold logic, unmodified.

---

## 20. No-Data Attendance

Proven: Child NoData (enrolled, zero attendance sessions recorded) never
renders `"0% this term"` or `"100% this term"` — `attendancePercentage`
stays `null` for `totalSessions === 0` (pre-existing composeAttendance
logic, confirmed unmodified by this phase), which is the honest "no data"
state the mission requires, not a fabricated extreme.

---

## 21. Admin Regression

**Unchanged, proven.** `lib/core/attendanceParentVisibility.test.ts`'s
first assertion (`getLearnerAttendanceHistory(admin.id, ...)`) confirms
an admin actor still reads the exact same real record — the `isSchoolAdmin`
branch and its short-circuit `if (!admin) { ... }` structure were not
removed or reordered, only the body of that `if` block gained a second
allow-check before its final `throw`. Every other admin-tier-gated
attendance function (session CRUD, class-scoped reads, school-wide reads)
is byte-for-byte unchanged — `git diff` confirms exactly one function's
body changed in `lib/core/attendance.ts`.

---

## 22. Teacher Regression

**Confirmed unchanged, and confirmed still gated exactly as before —
important limitation named, not fixed here.** A plain (non-admin)
class-teacher-of-record viewing a learner's Blueprint (reachable via
`app/student/blueprint/[learnerId]/page.tsx`'s `requireLearnerAccess`,
which allows self/parent/teacher-of-record/admin — read directly, not
assumed) ALSO receives `attendance.status === 'unavailable'` today,
**both before and after this fix** — this phase's widening added ONLY a
guardian branch, not a teacher-of-record branch, exactly per the
mission's "preserve teachers' exact existing semantics" instruction
(Step 25). This means a real class teacher viewing their OWN student's
Blueprint (not the Attendance module directly — they have full access
there via `assertClassAccess`) still cannot see that student's attendance
history summarized inside the Blueprint view. This is a **real,
pre-existing, still-open gap**, structurally identical in shape to the
one this phase fixed for parents, but explicitly out of scope here (the
mission named this phase parent-specific) — named for a future phase
rather than silently left undiscovered.

---

## 23. Learner-Self Behavior

**Reported, not changed.** A self-viewing student (via the same
`requireLearnerAccess` self-branch) is neither admin nor a registered
guardian of themselves, so `getLearnerAttendanceHistory` still denies
them — `blueprint.attendance.status` remains `'unavailable'` for a
learner's own self-view, exactly as before this fix. No route in
`app/student/` surfaces attendance data through any other path (confirmed
by `grep -rln "attendance" app/student/` returning zero matches) — a
learner currently has no way to see their own attendance anywhere on the
platform, before or after this phase. Untouched, per the mission's
explicit "this phase is parent-specific" instruction.

---

## 24. Performance

**No query-count change on Home's read path.** The fix adds exactly one
new query inside `getLearnerAttendanceHistory` for a NON-admin caller
only: `resolveParent(actorUserId)` (two queries — `students` +
`listGuardianLearners` — both already batched, no per-record loop,
already the exact call `requireParent` makes at the route layer for
every Parent Home render regardless of this fix). For an admin caller,
zero new queries (the `isSchoolAdmin` branch short-circuits exactly as
before). No per-attendance-record query, no per-family-child query, and
no family-wide load was introduced — the read remains scoped to exactly
the one target `learnerId` a child-specific Home page requests.

---

## 25. HTTP Tests [exact count]

**9 new tests**, `lib/testing/parentAttendanceVisibility.http.integration.test.ts`,
added to `scripts/parent-http/parent-http-tests.json`:

```
✔ GET /child/[Low]: Learning Time card shows the real 70% (below threshold), not the fallback
✔ GET /child/[High]: Learning Time card shows the real 100%, no concern surfaced
✔ GET /child/[NoData]: honest no-data state, never a fabricated 0% or 100%
✔ GET /child/[Low]: "Review Attendance" renders under "What Can I Do?" with the existing critical copy
✔ GET /child/[Low]: "Attendance has been less consistent..." renders under "Needs Attention"
✔ An unrelated parent never sees Child Low's attendance percentage or name
✔ Sibling isolation: Child Low's 70% attendance never appears on Child High's Home
✔ Multi-school isolation: Child Low's Home shows only its OWN 70%, never Child D's 40%
✔ IDOR: an unrelated parent directly requesting a manipulated learnerId gets a clean denial
```

Full parent HTTP manifest (`npm run test:parent-http`, 7 files): **87/87
passing** (78 pre-existing baseline + 9 new).

---

## 26. Unit Tests [exact count]

**No pure/isolated unit test was extracted**, because Option A (§6) kept
the authorization check inline inside a DB-backed function rather than
extracting a separate pure policy function — there is no pure logic to
unit-test in isolation from the DB (the check itself is
`isSchoolAdmin(...) || resolveParent(...).coreLearnerIds.includes(...)`,
both DB reads).

Instead, **1 new DB-integration test file with 5 assertions**,
`lib/core/attendanceParentVisibility.test.ts` (added to
`scripts/deep-tests.json`, run via `npm run test:deep`'s target — executed
directly here against local Docker Supabase):

```
✔ getLearnerAttendanceHistory: admin allowed
  + target guardian allowed
  + unrelated parent denied
  + sibling-parent denied for the other child
  + sibling-parent allowed for their OWN child (proves the fix is per-learner, not family-wide)
  + bogus learner id denied
ℹ tests 1 (single `test()` block, 5 internal assertions covering the full authorization matrix)
ℹ pass 1
ℹ fail 0
```

---

## 27. Architecture Guards

- **(A) Parent attendance READ requires a real guardian relationship:**
  proven directly (§9/§25) — an unrelated parent and a sibling's parent
  are both denied for a learner they don't guard; `resolveParent()` is
  the only source of truth consulted, never a client-supplied claim.
- **(B) Parent attendance permission does not imply WRITE permission:**
  every mutation route stays gated by `requireSchoolStaff` at the route
  layer (§13), completely independent of and unmodified by this fix —
  `getLearnerAttendanceHistory`'s widening cannot leak into any mutation
  path because no mutation function calls it.
- **(C) Attendance-consuming Home/Blueprint code consumes the canonical
  calculation only:** `composeAttendance()`'s percentage formula
  (`(present + late) / total`) was not touched; the fix is entirely below
  that layer.
- **(D) P4's attention composer does not independently calculate a
  second attendance percentage:** `buildAttendanceItem()`
  (`lib/parentExperience/attentionAction.ts`) reads
  `attendance.data.attendancePercentage` directly from the Blueprint
  section — confirmed unmodified, and confirmed to contain zero
  arithmetic on raw attendance rows.
- **(E) Legacy/Core identity uses the canonical resolver only:**
  `resolveParent()` (`lib/core/identity.ts`) is the only identity call
  added to `lib/core/attendance.ts` — no new bridge, no per-file
  reimplementation.
- **(F) No cross-school/global-current-school assumption:** `schoolId` is
  always the function's own explicit parameter, itself always resolved
  server-side from the target `learnerId` by the calling page (§11) —
  never a session-global or caller-declared value.

---

## 28. Performance

See §24 (kept as one section per the mission's own numbering, cross-
referenced here to avoid duplicating the same content twice).

---

## 29. Files Changed

Modified (3):
- `lib/core/attendance.ts` — the fix: one new import
  (`resolveParent`), one widened `if` block inside
  `getLearnerAttendanceHistory`.
- `scripts/deep-tests.json` — registers the new DEEP authorization test.
- `scripts/parent-http/parent-http-tests.json` — registers the new HTTP
  test file.

New (2):
- `lib/core/attendanceParentVisibility.test.ts` — 1 test file, 5
  authorization assertions, DB-backed (DEEP manifest).
- `lib/testing/parentAttendanceVisibility.http.integration.test.ts` — 9
  HTTP tests (parent HTTP manifest).

**5 files changed total (2 new), 0 deletions of existing functionality.**
Committed in one commit (`e4c74d0`). No file from the ~206-file
pre-existing dirty working tree was touched, staged, or committed —
confirmed by `git status --short` scoped to these 5 paths before the
commit.

---

## 30. Database Changes [expected NONE]

**None — confirmed.** No migration was written, applied, or found
necessary at any point in this phase. The schema already stores
attendance (`attendance_sessions`/`attendance_records`, Sprint 11B); this
was purely an application-layer authorization defect in one function's
`if` statement. `learner_guardians` (the table the fix's new guardian
check reads) already existed and was already populated by the existing
guardian-invite/onboarding flow — no new column, no new table, no RLS
policy change (the fix operates entirely inside the service-role-backed
`lib/core/` layer, which RLS does not gate).

---

## 31. Named Limitations

**New, found this phase:**

- **Teacher-of-record still cannot see attendance inside a student's
  Blueprint view** (§22) — the exact same shape of gap this phase fixed
  for parents, confirmed still present for a plain (non-admin)
  class-teacher after this fix, deliberately left alone per the mission's
  parent-specific scope. A future phase could close this with the exact
  same reasoning (§6/§7) applied to a teacher-of-record branch instead of
  a guardian branch.
- **Learners still cannot see their own attendance anywhere on the
  platform** (§23) — confirmed, unrelated to and unchanged by this fix,
  named for completeness per the mission's own Step 25 instruction.
- **Step 0 sequencing** (top of doc) — the pre-change baseline run was
  not literally executed before the code change; a `git stash`-based
  after-the-fact comparison was used instead to independently confirm no
  regression on one unrelated pre-existing failure. The 78/78-with-fix
  result matching P4's own recorded 78/78 is corroborating evidence, not
  a substitute for a true before/after run.
- **No dedicated new test asserts the mutation boundary directly** (§13)
  — stated as an architecture fact verified by code inspection and
  `git diff --stat` (only one read function's body changed), not backed
  by a new automated regression test, since the mutation routes were
  never touched and were already covered by pre-existing route-level
  `requireSchoolStaff` gating outside this fix's blast radius.

**Carried forward from P4, unresolved (unchanged by this phase):** four
conflicting academic-result surfaces (Gradebook/Report Card/Blueprint/
Academic Clinic); Academic Clinic authority divergence; no parent→teacher
communication; three career-report surfaces; three (now effectively still
three, unrelated to this phase's narrow risk-copy addition) risk-language
vocabularies; Clinic reachable from the shared parent nav despite being a
legacy-space page; Report Card missing a nav entry; family-wide pages
lacking per-child labels; parent privacy policy undocumented; `/learn`'s
learner-framed copy for a parent viewer.

---

## Recommended P5

**PARENT ACADEMIC-RESULT AUTHORITY CONVERGENCE** — the standing
recommendation carried from P3/P3.5/P4 — remains the right next large
foundational phase; nothing found in P4.5 overrides it. This phase's own
finding (§22 — the teacher-of-record Blueprint attendance gap) is real
but smaller and more narrowly scoped than a full authority convergence;
it is named here as a candidate a future audit could pick up
opportunistically (it would likely take the same shape as this phase's
own fix, applied to a different actor type) rather than as a reason to
defer P5 again.
