# Sprint 11F — Attendance Teacher Workspace

**Status:** Complete — UI orchestration only. No repository, service, migration, or (non-additive) API change was made. **Awaiting explicit approval before Sprint 11G.**

**Implements**: the teacher-facing UI over the already-complete Attendance backend (Sprints 11B–11E), per ADR-0003.

---

## Workspace Structure

```
app/teacher/attendance/
  page.tsx                — landing workspace (Header, Current Classes, per-class Recent Sessions)
  new/page.tsx             — Take Attendance (Class/Date/Session Type -> Load -> Mark -> Save)
  history/page.tsx         — Attendance History (pick a class, see every session)
  [sessionId]/page.tsx     — Session Detail (metadata, records, edit, delete)

components/attendance/
  attendanceClient.ts       — the one shared fetch layer (types + thin wrappers over existing routes)
  AttendanceStatusBadge.tsx
  AttendanceStatusSelector.tsx
  AttendanceSessionCard.tsx
  AttendanceHistoryTable.tsx
  AttendanceLearnerRow.tsx
  AttendanceToolbar.tsx
```

Navigation: one `Attendance` entry added to `components/teacher/TeacherSidebar.tsx`'s base `NAV` array and one to `components/teacher/TeacherBottomNav.tsx`'s `MORE_NAV` array (both visible to every teacher, not admin-tier-gated — matching where `End of Term` already sits, since attendance-taking is a per-class teacher duty, not a School Office/Academic Office admin concern).

---

## Screen Inventory

| Screen | Route | Purpose |
|---|---|---|
| Workspace landing | `/teacher/attendance` | Header (school, today's date, current academic year/term), Current Classes (grade/stream/name, Take Attendance link, per-class Recent Sessions preview — 3 most recent), link to full History. |
| Take Attendance | `/teacher/attendance/new` | Choose Class → Date → Session Type, Load Learners, mark each Present/Absent/Late/Excused, Save (one bulk API call). |
| Attendance History | `/teacher/attendance/history` | Pick a class, see its full session list — no analytics, no chart, no percentage. |
| Session Detail | `/teacher/attendance/[sessionId]` | Session metadata; every existing record, editable (status/arrival/departure/notes) and deletable; any not-yet-marked roster learner, individually markable; Delete Session. |

---

## Workflow

### Taking Attendance
```
Choose Class + Date (Session Type fixed to "Daily" — the only live CHECK value from Sprint 11B)
  ↓
Load Learners
  — checks for an existing session at this class+date first (GET /api/core/attendance?classId=)
  — if one exists AND already has records → hand off straight to Session Detail (no merge attempted)
  — if one exists with zero records → reuse it
  — otherwise → create it (POST /api/core/attendance)
  — then fetch the class roster (GET /api/core/learners?classId=&termId=)
  ↓
Mark every learner (client-side only — no network call per click)
  ↓
Save — exactly one call: POST /api/core/attendance/[id]/records with a `records` array for the whole roster
  ↓
Redirect to Session Detail
```

The "session already has records → redirect" branch and the "session exists with zero records → reuse it" branch are both deliberate: `bulkRecordAttendance` (Sprint 11D) rejects a learner who already has a record in the target session, so this page never attempts a partial re-submission — that reconciliation belongs to Session Detail, which already supports per-learner marking one at a time.

### Editing
Session Detail loads existing records and lets each be edited (status/arrival/departure/notes) via a per-row **Save**, which calls `PATCH /api/core/attendance/[id]/records` with that one `recordId` — never a bulk call, matching "reuse PATCH."

### Deleting
Both a per-record **Delete** (confirmation via `window.confirm`, then `DELETE .../records?recordId=`) and a session-level **Delete Session** (confirmation, then `DELETE /api/core/attendance/[id]`) are wired — both reuse the existing DELETE endpoints unmodified, no soft-delete/recycle-bin concept introduced.

---

## Reuse Map

| Capability | Reused from | Not duplicated |
|---|---|---|
| Session create/read/list/delete | `POST`/`GET`/`DELETE /api/core/attendance` (Sprint 11E) | No new attendance route. |
| Record create/bulk-create/update/delete/list | `/api/core/attendance/[id]/records` (Sprint 11E) | No new attendance route. |
| Status validity | `lib/core/attendance.ts`'s `assertValidStatus` (Sprint 11D) | The UI never validates status client-side beyond offering exactly the four buttons (`AttendanceStatusSelector`) — there is no separate enum check to duplicate. |
| Ownership ("teacher only own class") | `assertOwnershipChain` (Sprint 11D), reached transparently through the API | The UI never checks `class_teacher_id` itself — if a teacher somehow reaches a class they don't own, the API's existing 403 surfaces as this page's existing error banner. No new permission logic anywhere in `app/teacher/attendance/**` or `components/attendance/**` (grep-confirmed: zero references to `class_teacher_id`, `isSchoolAdmin`, or any role string in these files). |
| Membership/school/term context | `GET /api/core/my-membership` (pre-existing, Sprint 10A) | Unmodified. |
| Class list, grade/stream/name display | `GET /api/core/classes` (pre-existing) | Unmodified; `classLabel()` mirrors `core-term/page.tsx`'s exact `display_name ?? class_name` convention. |
| Class roster | `GET /api/core/learners?classId=&termId=` (pre-existing) | Unmodified — this route already supported the exact filter this sprint needed; no blocker, no new endpoint. |
| Current academic year name | `GET /api/core/academic-years` (pre-existing) | Unmodified. |
| Auth/session gating | `proxy.ts`'s existing `/teacher/*` redirect-to-login | Nothing new — verified live (see Verification) that all four new routes redirect to `/login?returnTo=...` exactly like every other teacher page when unauthenticated. |

**Zero new business logic**: every one of the six new component files and four new pages either renders props/state or calls a function in `attendanceClient.ts`, which itself only shapes `fetch()` calls — no validation, no derived calculation, no ownership decision anywhere in `app/teacher/attendance/**` or `components/attendance/**` (confirmed by inspection: the only conditionals in these files are UI-state branches — loading/error/empty — never a business rule).

---

## API Composition

No existing Attendance API route was modified. One **client-side** consequence of composing the existing routes as-is, not an API change:

- **No additive read endpoint was needed.** The one scoping question raised in Sprint 11E's own "Future Extension Points" — "should a teacher be able to list sessions school-wide" — never came up, because this sprint's landing page only ever calls `listSessionsForClass` (teacher-or-admin-allowed) per class, never the admin-only `listAttendanceSessionsForSchool`/`listAttendanceSessionsByDateRange` branches of `GET /api/core/attendance`. This was a deliberate design choice (see Screen Inventory: "Current Classes" shows *per-class* recent sessions, not a school-wide feed), made specifically to avoid needing an API change.
- **Teacher-name resolution was deliberately left out.** The suggested "Recent Sessions" field list includes "Teacher," but no route reachable by a non-admin teacher resolves a `school_users.id` (the `marked_by_teacher_id` value) to a display name — `GET /api/core/teachers?list=true` is admin-only. Rather than add a new read endpoint for this, `AttendanceSessionCard` shows a plain "Marked" / "Not marked" badge (whether `marked_by_teacher_id` is set at all) instead of a resolved name. This is a genuine, small gap — flagged under Known Limitations, not silently worked around with a new endpoint per the mission's "additive... only if a genuine UI blocker" bar, which this didn't clear (the workspace functions correctly without it).

---

## Verification

| Check | Result |
|---|---|
| Teacher Attendance pages compile | `tsc --noEmit` clean across the whole project. |
| `eslint` | Clean after one fix (see below) — zero errors on every new/modified file. |
| Navigation works, no duplicate entries | Grep-confirmed exactly one `/teacher/attendance` entry in `TeacherSidebar.tsx` and exactly one in `TeacherBottomNav.tsx`. |
| No regressions | Only three files outside `app/teacher/attendance/**`/`components/attendance/**` were touched (`TeacherSidebar.tsx`, `TeacherBottomNav.tsx` — nav array + import only), confirmed by diff; the two pre-existing `eslint` warnings in `TeacherBottomNav.tsx` (lines unrelated to this sprint's edit) predate this sprint (Sprint 10G's `isAdminTier`/`SCHOOL_OFFICE_NAV` code), not introduced now. |
| Pages served without a 500 | **Verified live**: started the project's dev server and requested all four new routes (`/teacher/attendance`, `/new`, `/history`, `/[sessionId]`) unauthenticated — each returned `307` redirecting to `/login?returnTo=...`, exactly matching every other `/teacher/*` page's existing auth-gate behavior (`proxy.ts`, unmodified). A compile error would have produced a 500 here instead; none did. |
| Forms validate / API integration / editing / deleting succeed | **Not verified with a real authenticated browser session** — see Known Limitations. |

### Fix made during verification
`app/teacher/attendance/history/page.tsx` originally called `setSessions(...)` synchronously inside a `useEffect` body, which `eslint`'s `react-hooks/set-state-in-effect` rule flagged (a warning, not an error, but avoidable). Restructured to wrap the logic in a local `async function load()` invoked from the effect — the same shape every existing Core page's `refresh()`-style effect already uses — which cleared the warning without changing behavior.

### Known Limitations

1. **No authenticated end-to-end browser verification was performed.** This environment has no interactive login flow, and (per Sprints 11B/11D/11E's own carried-forward limitation) the Sprint 11B migration has not been applied to any database reachable through the actual Supabase-backed dev server — so even with a session cookie, a real request would 500/404 on the underlying tables today. What *was* verified: every page compiles, is served, and correctly inherits the existing auth gate. **Recommend**: once the migration is applied somewhere real and a real teacher/admin login is available, a full click-through (load classes, take attendance, edit a record, delete a record, delete a session) should be run before this workspace is considered production-ready.
2. **"Teacher" column not resolved to a name** on session cards (see API Composition above) — shows a marked/not-marked badge instead. Closing this cleanly needs a small, separately-approved additive read (e.g. a self-or-admin teacher-name lookup), not built here.
3. **Session Detail's "Not Yet Marked" section is a deliberate addition beyond the sprint's literal screen description**, included to avoid a real dead end: a session created (at "Load Learners" time) but abandoned before Save would otherwise have zero records and no way to add them, since the sprint's literal Session Detail description only covers editing/deleting *existing* records. This addition reuses only the existing single-record `POST` endpoint — no bulk call, no new validation.
4. **Recent Sessions "3 most recent" and History's "full list" both fetch the entire class's session list from the API and slice/sort client-side** — there is no `limit` parameter on `GET /api/core/attendance`, and the mission says "do not invent new query behaviour," so no such parameter was requested or added. For a class with a very long history this means transferring more rows than strictly displayed; acceptable at current pilot scale, flagged for a possible future pagination parameter (a service/API change, not something this UI-only sprint can add).
5. **No offline/optimistic UI** — every action shows a loading/saving state and waits for the real response, matching "No auto-save."

---

## ADR-0003 Compliance

- **§4 Domain Model**: no summary is computed or displayed anywhere — "Recent Sessions"/"History" are raw session lists; a record's fields are shown and edited exactly as stored.
- **§5 Ownership Model**: never re-implemented in the UI — every write goes through the API, which enforces the full chain.
- **§6 Status Model**: the UI offers exactly the four canonical values via `AttendanceStatusSelector`; no fifth option, no free text.
- **§9 Integration Boundaries**: grep-confirmed zero references anywhere in `app/teacher/attendance/**`/`components/attendance/**` to Evidence, Report Cards, Compass, Intelligence, Notifications, Behaviour, or Analytics.
- **§13 Decision**: Attendance still consumes nothing and (as of this sprint) is consumed by nothing outside its own UI — the workspace is a closed loop over the domain's own API.

## Constitution / RAS Compliance

- **Components are UI only — zero business logic**: satisfied by construction (see Reuse Map).
- **No direct Supabase calls in components**: confirmed — every network call in `components/attendance/attendanceClient.ts` is a `fetch()` to an existing Next.js API route, never a Supabase client call.
- **No duplicate validation/ownership/status-checking**: confirmed by grep across every new file.
- **Client-side DB access convention**: not applicable — this sprint has no direct Supabase client usage at all (server-side `createClient()` isn't touched either; it already lives inside the existing API routes).

---

## Future Extension Points Reserved for Sprint 11G+

- **Parent/Student attendance surfaces**: not built; would need their own visibility rule (per ADR-0003 §8, deferred to Sprint 11G in the roadmap).
- **Report Card integration**: `days_present`/`days_absent` are not touched anywhere in this workspace.
- **Evidence/Intelligence integration**: not referenced.
- **Teacher-name resolution on session cards**: a small, separately-scoped additive read, not built here.
- **Pagination/date-range narrowing on session lists**: not built; current scale doesn't need it, flagged for later if a school's history grows large.
