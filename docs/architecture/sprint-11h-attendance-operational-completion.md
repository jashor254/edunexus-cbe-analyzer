# Sprint 11H — Attendance Workflow Completion & Operational Validation

**Status:** Complete. **Awaiting explicit approval before Sprint 11I.**

**Closes**: the two orchestration gaps Sprint 11G's own documentation explicitly flagged under Known Limitations — session completion state, and `marked_by_teacher_id` never being populated — plus a general audit of the teacher/admin workflows for other inconsistencies.

---

## Phase 1 — Operational Audit

Read-only review of every flow named in the mission, against the actual code from Sprints 11B–11G.

### Teacher flows

| Flow | Finding |
|---|---|
| Create session | Correct. `new/page.tsx` checks for an existing session first (`findSessionByUniqueKey` via the list-for-class read), avoiding the duplicate-session 422 in the common path. |
| Load learners | Correct. Uses the class's own `academic_year_id` (not a separately-fetched "current year"), avoiding a mismatch if a class ever belongs to a non-current year. |
| Mark attendance | Correct. Client-side only, no network call per click — matches "no auto-save." |
| Save | Correct — exactly one `bulkCreateRecords` call. **Gap found**: the session's `marked_by_teacher_id` was never set anywhere in this path (Sprint 11E's `POST /api/core/attendance` never accepted it, matching that sprint's own explicit scope; Sprint 11F never called the one route that could set it). **Fixed in Phase 3.** |
| Reopen | Correct in principle (Session Detail is reachable via History or the landing page's Recent Sessions), but **gap found**: nothing on Session Detail told a teacher reopening a partially-marked session *how much* was left — they had to count rows themselves. **Fixed in Phase 2.** |
| Edit records | Correct — `updateRecord`/PATCH, per-row, already worked. |
| Delete records | Correct — per-row DELETE with confirmation, already worked. |
| Delete session | Correct — DELETE with confirmation, already worked. |

### Academic Office / Attendance Administration flows

| Flow | Finding |
|---|---|
| Today's status | **Gap found**: "Completed Today"/"Pending Today" (Sprint 11G) used "has ≥1 record" as "completed" — true for a session with 1 of 30 learners marked, which is not what "completed" means. **Fixed in Phase 5**, using the same completion state as Phase 2. |
| History | Correct — reuses Sprint 11F's History page unmodified, drill-down already worked. |
| Per-class latest session | **Gap found**: "Marked by" showed "Not marked" for every real session (since `marked_by_teacher_id` was never set — see Teacher flows above), which reads as a false negative, not "unknown." **Fixed by Phase 3** (the field is now genuinely populated) **and Phase 5** (the label itself was replaced with completion state, which doesn't depend on `marked_by_teacher_id` at all — see rationale below). |
| Completion state | **Gap found** — this is the mission's Phase 2 finding, restated: no existing read distinguished "created" from "partially marked" from "fully marked" without a teacher manually counting rows. **Fixed in Phase 2.** |

**No other inconsistency points were found.** In particular: ownership enforcement (`assertOwnershipChain`), status validation, session/learner duplicate rejection, and the delete paths were all re-read against their Sprint 11D tests and found unchanged and correct — this sprint does not touch any of that logic.

---

## Phase 2 — Session Completion State

**Decision: no metadata field was needed.** Completion state is computed fresh, on every read, from data that already exists — `attendance_records` (via `listRecordsForSession`) and the class roster (via `getClassRoster`). No table, no column, no stored flag. This is not a compromise; it is exactly what ADR-0003 §4 already requires of Attendance Summary in general ("always computed on read, never a second stored truth"), applied to the one specific question Sprint 11G's own audit found unanswerable without inferring from multiple reads.

### State machine (three-value enum, plus "no session")

```
no session
  │  (createAttendanceSession)
  ▼
created            (session exists, 0 records)
  │  (recordAttendance / bulkRecordAttendance, first successful call)
  ▼
partially_marked   (0 < records < roster size)
  │  (recordAttendance / bulkRecordAttendance, further calls, or one bulk call covering everyone)
  ▼
fully_marked       (records >= roster size)
```

Deleting a record can move a session backwards through this same chain (`fully_marked` → `partially_marked` → `created`) — there is no ratchet; the state is recomputed fresh every time, so it always reflects reality, including reality moving backwards.

### Implementation

`lib/core/attendance.ts` — one new function:

```ts
export type SessionCompletionStatus = 'created' | 'partially_marked' | 'fully_marked'
export type SessionCompletion = { status: SessionCompletionStatus; recordCount: number; rosterSize: number }
export async function getSessionCompletionState(actorUserId, schoolId, sessionId): Promise<SessionCompletion>
```

Composed from `getAttendanceSession` (ownership-checked, unchanged), `repos.attendance.listRecordsForSession`, and `getClassRoster` — three existing calls, zero new ones added to the repository layer.

Exposed via the **existing** `GET /api/core/attendance/[id]` route through a new, purely additive, opt-in query flag: `?includeCompletion=true`. Without the flag, the response is byte-for-byte identical to before (every existing caller's behavior is unchanged). With it, the response nests `completion: SessionCompletion` under the session object. This was the one "necessary API wiring" this sprint's scope allowed for — no new route, no new domain concept, an additive enrichment of an endpoint that already existed.

Client side: `attendanceClient.ts` gained one new function, `getSessionWithCompletion`, alongside the existing `getSession` (left completely unchanged, still used nowhere that needs completion state).

### Where it's shown
- **Teacher — Session Detail** (`[sessionId]/page.tsx`): a badge at the top ("Fully Marked" / "Partially Marked" / "Created — No Records Yet"), plus the raw `x of y learners recorded` count — directly answers Phase 1's "reopen" gap.
- **Admin — Attendance Administration**: each class's latest session shows the same three-state label instead of the old "Marked"/"Not marked" boolean (see Phase 5).

---

## Phase 3 — Marked By

**Root cause** (confirmed during Phase 1's audit): Sprint 11E's `POST /api/core/attendance` create schema never accepted a `markedByTeacherId` field (a deliberate scope decision in that sprint, not a bug), and Sprint 11F's teacher UI never called `PATCH /api/core/attendance/[id]` (the one route that could set it). The field existed in the schema since Sprint 11B but nothing in the built pipeline ever wrote to it.

**Fix, and why it lives in the service, not the API or UI**: `recordAttendance` and `bulkRecordAttendance` (`lib/core/attendance.ts`) now set `marked_by_teacher_id` on the session themselves, immediately after successfully persisting the record(s), to the **acting user's own resolved `school_users.id`** — never a value trusted from the request. This satisfies the mission's explicit constraints:
- **"Do not bypass service ownership validation"**: the identity written is exactly the one `assertOwnershipChain` already resolved and validated (admin-tier or the assigned class teacher) — no new validation path.
- **"Do not duplicate ownership logic"**: `assertOwnershipChain` now returns `{ cls, schoolUser }` instead of just `cls`, so the already-resolved `schoolUser` is reused directly — no second `getSchoolUser` call, no re-derivation.
- **"The API must continue delegating all authorization to the Attendance service"**: the two API routes (`POST /api/core/attendance/[id]/records` for both single and bulk) are **completely unchanged** — they still just call `recordAttendance`/`bulkRecordAttendance` and return the result. The fix is entirely internal to the service; the route layer has no idea this side effect happens.

**Semantics**: `marked_by_teacher_id` means "who most recently recorded attendance in this session" — every successful write (single or bulk) overwrites it with the current actor. This matches ADR-0003 §5/§8's standing rule that this field is provenance only, never used for access control anywhere in this codebase (confirmed: `assertOwnershipChain` still checks `class_teacher_id`, never `marked_by_teacher_id`).

**Deliberate non-decision**: deleting a record does **not** clear or touch `marked_by_teacher_id`, even if the deletion brings the session back to zero records (`created` state). This was considered and rejected: `marked_by_teacher_id` answers "who acted," not "how much is done" — the latter is now Phase 2's completion state, computed fresh and independent of this field. Conflating the two would reintroduce exactly the ambiguity this sprint exists to remove.

---

## Phase 4 — Edit Workflow

Verified against Sprint 11F's actual code (no changes made — this phase was confirmatory):

| Requirement | Where it already lives |
|---|---|
| Reopen session | Session Detail (`[sessionId]/page.tsx`), reachable via History or the landing page's Recent Sessions — now also shows completion state (Phase 2). |
| Edit learner record | The existing per-record `AttendanceLearnerRow` `detail` block → `PATCH` via `updateAttendanceRecord`. |
| Add missing learner | The existing "Not Yet Marked" section (a deliberate Sprint 11F addition beyond its own literal scope, to avoid exactly the dead end this sprint would otherwise have had to fix) → single `POST` via `recordAttendance`. |
| Remove mistaken record | The existing per-record Delete button (confirmation dialog) → `DELETE` via `deleteAttendanceRecord`. |

No bulk-rewrite logic and no shortcut was added or needed — every one of these already used exactly one existing service operation per action.

---

## Phase 5 — Administration Accuracy

`app/teacher/core-office/attendance/page.tsx` (Sprint 11G) changed in two ways:

1. **"Completed Today" / "Pending Today"** now mean `completion.status === 'fully_marked'` / `!== 'fully_marked'` (and only once completion state has actually loaded for that session — see below), replacing the old "has ≥1 record" definition.
2. **Per-class "Marked by" label removed, replaced with the completion label** ("Fully marked" / `Partially marked (x/y)` / "No records yet" / "No sessions yet"). This is deliberately a different signal than `marked_by_teacher_id` — completion state answers "how much," which is what an admin actually needs to supervise attendance-taking, and is accurate regardless of Phase 3's fix.

**"Never guess" applied literally**: while a class's latest-session completion state is still loading, the label reads **"Checking…"**, not "not marked" or "0/x" — the previous code's zero-second gap where `marked_by_teacher_id` defaulted to reading as "Not marked" (a false negative) was exactly the failure mode this phase fixes. The same discipline applies to the School Summary counts: a session whose completion state hasn't resolved yet is counted in neither "Completed Today" nor "Pending Today" until it has — undercounting briefly is preferred over fabricating an answer.

**Scope of the completion fetch, kept bounded** (unchanged principle from Sprint 11G): only two sets of sessions ever get a completion-state fetch — today's sessions (School Summary) and each class's single latest session (Class List), deduplicated. Not the whole school's attendance history.

---

## Phase 6 — UX Polish

Applied, and only these: a loading label ("Checking…") for in-flight completion state; the existing confirmation dialogs (unchanged, already present in Sprint 11F); the existing success/error banners (unchanged); the existing disabled-button states during save (unchanged). No chart, graph, heatmap, or statistic of any kind was added anywhere this sprint.

---

## Marked-By Rationale (summary)

See Phase 3 above for the full reasoning. In one sentence: `marked_by_teacher_id` is now populated by the service itself, using the identity `assertOwnershipChain` already resolved, at the moment a record-write actually succeeds — never trusted from a client, never a second identity lookup, and deliberately left untouched by record deletion since it answers a different question ("who," not "how much") than Phase 2's completion state.

## Completion-State Rationale (summary)

See Phase 2 above. In one sentence: completion state is a pure function of already-existing data (records + roster), computed fresh on every read through one new service function and one additive, opt-in API query flag — never a stored field, never a new table, never inferred by the UI from partial information.

---

## UX Decisions

- **Where the completion badge lives**: Session Detail's header (teacher-facing) and each Class List row (admin-facing) — not a new page, not a new dashboard.
- **Label wording**: "Created — No Records Yet" / "Partially Marked" / "Fully Marked" (teacher-facing, slightly more descriptive since the teacher is actively working the session) vs. "No records yet" / "Partially marked (x/y)" / "Fully marked" (admin-facing, includes the raw count since an admin is comparing across classes, not looking at one session's roster directly).
- **"Checking…" instead of a spinner icon for the admin Class List**: chosen over a loading spinner because the row already has other real content (class name, "Taken today" badge, latest date) — a text label reads more honestly as "we don't know yet" than a generic spinner would, matching Phase 5's "never guess" instruction in spirit as well as substance.

---

## Known Limitations

1. **No transactional guarantee between the record write and the `marked_by_teacher_id` update** in `recordAttendance`/`bulkRecordAttendance` — if the metadata update fails after the record insert succeeds, the error propagates (per this codebase's no-silent-failure convention) but the record(s) remain persisted with a stale `marked_by_teacher_id`. This mirrors the existing lack of transaction support across the whole service (documented already in Sprint 11D as a deliberate, unaddressed limitation) — not a new gap this sprint introduces, and not fixed here since adding transaction support would be an architectural change outside this sprint's "no architectural redesign" constraint.
2. **Completion state for a class with zero enrolled learners** (`rosterSize === 0`) always reports `created` even with zero records, since `recordCount === 0` is checked first — a degenerate case (an empty class), not expected to occur in practice, not specially handled.
3. **No live authenticated verification** of the full teacher/admin round-trip (real login, real marking, real completion-state transitions observed) was possible in this environment — same carried-forward limitation as every prior Attendance sprint (no interactive login here; Sprint 11B's migration still not applied to any reachable database). What was verified: every touched file type-checks and lints cleanly, every route still compiles and serves its existing auth-gate behavior correctly (see Verification), and the completion-state/marked-by logic was traced by hand against the actual code paths, function by function.
4. **`getSessionWithCompletion` issues 3 read calls internally** (session + records + roster) per session — acceptable at the bounded scope Phase 5 applies it to (today's sessions + one latest session per class), not suitable as-is for a page that would need completion state across a school's entire history.

---

## ADR-0003 Compliance

- **§4 Domain Model**: completion state is the textbook case of "Attendance Summary, computed on read, never stored" — this sprint is arguably the *most* faithful application of that rule so far, since it was built specifically to resist the temptation to add a stored `status` column.
- **§5 Ownership Model**: unchanged — `assertOwnershipChain`'s logic is identical; only its return value gained a field.
- **§6 Status Model**: unchanged — no new attendance status value, no coercion.
- **§8 Security Model**: `marked_by_teacher_id` remains provenance-only, never an access-control input, confirmed again in this sprint's own changes.
- **§9 Integration Boundaries**: grep-confirmed zero references to Evidence, Report Cards, Compass, Intelligence, Notifications, Behaviour, Analytics in any file touched this sprint.
- **§13 Decision**: Attendance still consumes nothing; this sprint only makes Attendance's own existing data more legible to Attendance's own existing readers (teacher, admin) — no new consumer domain.

## Constitution / RAS Compliance

- **No new tables, no new repository methods**: confirmed — `lib/repositories/attendance.repository.ts` was not touched this sprint.
- **No duplicate identity/ownership logic**: confirmed — `getSessionCompletionState` reuses `getAttendanceSession` (which itself reuses `assertOwnershipChain`); `marked_by_teacher_id`'s value reuses the same `assertOwnershipChain` call's resolved `schoolUser`, not a second lookup.
- **API routes still delegate to the service**: confirmed — the one route change (`GET /api/core/attendance/[id]`) adds a single conditional call to `getSessionCompletionState`, and the two record routes (`POST .../records`) are byte-for-byte unchanged despite the service behavior underneath them changing.
- **No silent failures**: the `marked_by_teacher_id` update after a record write is not wrapped in a try/catch that swallows its error — a failure there surfaces to the caller like any other.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean across every touched file. |
| `eslint` | Clean, zero warnings, on `lib/core/attendance.ts`, `app/api/core/attendance/[id]/route.ts`, `components/attendance/attendanceClient.ts`, `app/teacher/attendance/[sessionId]/page.tsx`, `app/teacher/core-office/attendance/page.tsx`. |
| All routes compile | **Verified live**: re-requested every Attendance route (`/teacher/attendance`, `/new`, `/history`, `/[sessionId]`, `/teacher/core-office/attendance`) plus the API route with the new `?includeCompletion=true` flag against the running dev server — all returned their expected auth-gated response (307 for pages, 401 for the API), none 500'd. |
| Teacher workflow end-to-end | Traced by hand against the actual code (see Phase 1 table) — not live-tested with real auth (see Known Limitations). |
| Admin workflow end-to-end | Same — traced by hand (see Phase 1 table), not live-tested with real auth. |
| Ownership enforcement | Unchanged code path (`assertOwnershipChain`), only its return type extended — confirmed no call site was left destructuring the old bare-`ClassWithDetails` shape (grep-checked: every call site either ignores the return value or destructures `{ schoolUser }` explicitly). |
| Editing / Deleting / Session lifecycle | Confirmed unchanged and still correct by re-reading `updateAttendanceRecord`/`deleteAttendanceRecord`/`deleteAttendanceSession` — none were modified this sprint. |
| No regressions | `git diff`-equivalent inspection: exactly 6 files touched (`lib/core/attendance.ts`, `app/api/core/attendance/[id]/route.ts`, `components/attendance/attendanceClient.ts`, `app/teacher/attendance/[sessionId]/page.tsx`, `app/teacher/core-office/attendance/page.tsx`) — no repository, migration, or unrelated route changed. |
