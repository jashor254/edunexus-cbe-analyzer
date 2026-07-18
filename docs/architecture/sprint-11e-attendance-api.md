# Sprint 11E — Attendance API Layer

**Status:** Complete — API routes only. No UI, Intelligence, Report Card integration, or analytics was written. **Awaiting explicit approval before Sprint 11F.**

**Implements**: thin HTTP routes over `lib/core/attendance.ts` (Sprint 11D), per ADR-0003.

**Files**: `app/api/core/attendance/route.ts`, `app/api/core/attendance/[id]/route.ts`, `app/api/core/attendance/[id]/records/route.ts` — all new.

---

## Route Inventory

| Method | Path | Calls | Notes |
|---|---|---|---|
| `POST` | `/api/core/attendance` | `createAttendanceSession` | Returns the session only (201). |
| `GET` | `/api/core/attendance` | `listAttendanceSessionsForClass` / `listAttendanceSessionsByDateRange` / `listAttendanceSessionsForSchool` | Filter precedence: `classId` present → class listing; else `from`+`to` both present → date-range listing; else → whole-school listing. No new query shape invented — each branch maps to exactly one existing Sprint 11D method. |
| `GET` | `/api/core/attendance/[id]` | `getAttendanceSession` | `schoolId` required as query param. |
| `PATCH` | `/api/core/attendance/[id]` | `updateAttendanceSession` | Body accepts only `markedByTeacherId` — metadata-only, matching the service's own `AttendanceSessionMetadataUpdate` restriction exactly. |
| `DELETE` | `/api/core/attendance/[id]` | `deleteAttendanceSession` | `schoolId` required as query param. |
| `GET` | `/api/core/attendance/[id]/records` | `listAttendanceForSession` | `[id]` is the session id; `schoolId` required as query param. |
| `POST` | `/api/core/attendance/[id]/records` | `recordAttendance` (single) or `bulkRecordAttendance` (bulk) | Dispatches on whether `body.records` is an array — no separate bulk endpoint, per the mission's "POST should support single record and bulk record using the existing service API." |
| `PATCH` | `/api/core/attendance/[id]/records` | `updateAttendanceRecord` | `recordId` in the body (no `[recordId]` URL segment exists, matching the sprint's literal route list); a route-layer check confirms the record actually belongs to session `[id]` before updating. |
| `DELETE` | `/api/core/attendance/[id]/records` | `deleteAttendanceRecord` | `schoolId`/`recordId` as query params; same path/record consistency check as PATCH. |

Exactly the routes named in the mission — no extra endpoint, no summary/history/report/notification/export route.

---

## Request / Response Shapes

### `POST /api/core/attendance`
Request: `{ schoolId, academicYearId, termId, classId, attendanceDate, sessionType? }` (all UUIDs except `attendanceDate`/`sessionType`, camelCase on the wire).
Response: `{ data: AttendanceSessionRow }`, status 201. On a duplicate session: `{ error: "createAttendanceSession: a session already exists for class ... on ... (session_type=daily)." }`, status 422.

### `GET /api/core/attendance?schoolId=&classId=&from=&to=`
Response: `{ data: AttendanceSessionRow[] }`.

### `GET /api/core/attendance/[id]?schoolId=`
Response: `{ data: AttendanceSessionRow }`. Not found: `{ error: "getAttendanceSession: no session ... found for school ..." }`, status 404.

### `PATCH /api/core/attendance/[id]`
Request: `{ schoolId, markedByTeacherId: string | null }`.
Response: `{ data: AttendanceSessionRow }`.

### `DELETE /api/core/attendance/[id]?schoolId=`
Response: `{ data: { success: true } }`.

### `POST /api/core/attendance/[id]/records` (single)
Request: `{ schoolId, learnerId, status, arrivalTime?, departureTime?, notes? }`.
Response: `{ data: AttendanceRecordRow }`, status 201. Invalid status: `{ error: "Invalid attendance status \"...\" — must be exactly one of: present, absent, late, excused..." }`, status 422.

### `POST /api/core/attendance/[id]/records` (bulk)
Request: `{ schoolId, records: [{ learnerId, status, arrivalTime?, departureTime?, notes? }, ...] }`.
Response: `{ data: AttendanceRecordRow[] }`, status 201.

### `PATCH /api/core/attendance/[id]/records`
Request: `{ schoolId, recordId, status?, arrivalTime?, departureTime?, notes? }`.
Response: `{ data: AttendanceRecordRow }`. Mismatched session: `{ error: "Record ... does not belong to session ..." }`, status 400.

### `GET` / `DELETE /api/core/attendance/[id]/records`
`GET` → `{ data: AttendanceRecordRow[] }`. `DELETE` → `{ data: { success: true } }` (query params `schoolId`, and for `DELETE`, `recordId`).

Every error response is `{ error: string }` (or, for a Zod failure, `{ error: parsed.error.flatten() }`, matching every other Core route's existing convention) with the correct HTTP status code, per CLAUDE.md.

---

## Authorization Model

Every route's only gate is `requireSchoolStaff(supabase, schoolId)` — admin-tier (`school_admin`/`headteacher`/`deputy_headteacher`) or `teacher`, excluding `parent` (matching the mission's explicit "no parent endpoints, no student endpoints"). This is a **coarse** gate: "does this user have any active staff role in this school." The **fine-grained** rule — "a teacher may only act on their own class; admin-tier may act across the school" — is enforced entirely inside `lib/core/attendance.ts`'s `assertOwnershipChain` (Sprint 11D), never re-checked or duplicated in a route.

This split is deliberate, not incidental: the mission's "No new role logic. No inline permission checks. Always reuse existing authorization helpers" is satisfied by having the route call exactly one existing helper (`requireSchoolStaff`) and nothing else — every route file in this sprint contains zero role arrays, zero `class_teacher_id` comparisons, and zero admin-tier checks of its own. Grep-confirmed: no route references `class_teacher_id`, `SCHOOL_ADMIN_ROLES`, or any role string literal.

`membership.userId` (from `requireSchoolStaff`'s `ResolvedMembership` return value) is the one piece of identity every route passes into the service — never a raw request body field, matching CLAUDE.md's Security Rule ("NEVER trust userId from a request body — always verify against auth.getUser()").

---

## Service Composition

Every route file imports only from `@/lib/core/attendance` (the Sprint 11D service), `@/lib/core/permissions` (`requireSchoolStaff`), `@/lib/core/errors` (`UnauthorizedError`/`isEduNexusError`), `@/utils/supabase/server` (`createClient`, for auth resolution only — the same import every other Core route already makes), and `zod`. Grep-confirmed zero occurrences of `@/lib/repositories` or `@supabase/supabase-js` in any of the three files — no repository, no raw Supabase client, anywhere in the API layer.

One deliberate design choice worth calling out: **status is never validated by Zod as an enum** — every schema types `status` as a plain `z.string()`. Enforcing the four-value set at the route layer would duplicate `lib/core/attendance.ts`'s own `assertValidStatus`, which the mission explicitly forbids ("Do not duplicate validation"). An invalid status string passes Zod, reaches the service, and is rejected there with a 422 — confirmed structurally (see Verification) by the fact a bulk request containing an invalid status string still passed request-shape validation and reached the authentication check, rather than being rejected by Zod first.

---

## ADR-0003 Compliance

| ADR-0003 section | This API |
|---|---|
| §4 Domain Model | Routes return `AttendanceSessionRow`/`AttendanceRecordRow` exactly as the service produces them — no summary field added at the API boundary either. |
| §5 Ownership Model | Enforced entirely via `assertOwnershipChain` inside the service; routes contribute only the coarse `requireSchoolStaff` gate. |
| §6 Status Model | Never re-validated or coerced at the API layer — the service is the single source of truth for what a valid status is. |
| §9 Integration Boundaries | No route touches Evidence/Report Cards/Compass/Intelligence/Notifications — grep-confirmed. |
| §13 Decision | Attendance still consumes nothing; the API is a pure read/write surface over the Attendance service's own two tables. |

## Constitution / RAS Compliance

- **Every API route calls auth first**: `requireSchoolStaff` (which itself calls `requireAuthentication`) is the first meaningful line of every handler, before any body/query parsing that would touch the service.
- **Never trust `userId` from the body**: confirmed — no schema in any of the three files has a `userId`/`actorUserId` field; the acting user always comes from `membership.userId`.
- **API routes return `{ error }` with the correct status code**: 401 (`UnauthorizedError`), the `EduNexusError` subclass's own `statusCode` (403/404), 404 for the two "not found" message patterns this sprint's service produces, 422 for every other business-rule violation or Zod failure, 400 for a missing required query/body parameter caught before any service call.
- **No `select('*')`, no direct Supabase, no business logic in routes**: satisfied by construction — every DB interaction happens inside `lib/core/attendance.ts`/`AttendanceRepository`, never in these files.
- **Zod validates all API route inputs**: every route validates its body (or required query params) before calling the service.

---

## Verification

| Check | Result |
|---|---|
| All routes compile | `tsc --noEmit` clean. |
| `eslint` | Clean, zero warnings, all three files. |
| Service called (not repository/Supabase bypassed) | Grep-confirmed: zero occurrences of `@/lib/repositories`, `@supabase/supabase-js`, or `createServiceClient` in any of the three route files. |
| Repository registered correctly (inherited from 11D) | Unchanged this sprint — not touched. |
| Manual API smoke tests | Performed live against the actual Next.js dev server (see below). |
| 404 handling | Verified live for the auth-gated case is out of live-test reach this sprint (see Known Limitation) — verified by code inspection: `getAttendanceSession`/`getAttendanceRecord`'s "no session/record found" messages are matched by each route's `errorResponse` and mapped to 404. |
| Permission failures | **Verified live**: every route returns `{"error":"Authentication required."}` with **401** when called with no auth cookie — `POST`/`GET /api/core/attendance`, `GET /api/core/attendance/[id]`, and both single and bulk `POST /api/core/attendance/[id]/records`, all confirmed by direct `curl` against a running dev server. |
| Duplicate session behaviour | Verified by code inspection only this sprint (see Known Limitation) — `createAttendanceSession`'s existing-session check (built and live-traced in Sprint 11D) is called unmodified. |
| Invalid status behaviour | **Structurally verified live**: a bulk POST containing one row with `status: "bogus"` passed Zod (confirmed by receiving a 401 — meaning it cleared request-shape validation and reached the auth gate — rather than a 422 from Zod), proving the route does not pre-reject invalid statuses; the service's own rejection of that exact value was already verified live in Sprint 11D. |
| Bulk validation behaviour | **Dispatch verified live**: a `POST` with a `records` array correctly routed to the bulk path (confirmed via the same 401-not-422 observation above, meaning `BulkCreateSchema` parsed the array successfully and the request reached auth). The service-level bulk business rules (in-batch duplicate, roster membership) were verified live in Sprint 11D and are unmodified here. |

### Manual smoke test transcript (live, against `http://localhost:3000`)

```
POST /api/core/attendance {schoolId:"not-a-uuid"}                          → 422, field errors listed
GET  /api/core/attendance (no schoolId)                                    → 400 "schoolId required"
POST /api/core/attendance (valid shape, no auth)                           → 401 "Authentication required."
GET  /api/core/attendance/[id] (no auth)                                   → 401 "Authentication required."
GET  /api/core/attendance/[id]/records (no schoolId)                       → 400 "schoolId required"
POST /api/core/attendance/[id]/records (single, no auth)                   → 401 "Authentication required."
POST /api/core/attendance/[id]/records (bulk incl. invalid status, no auth) → 401 "Authentication required."
DELETE /api/core/attendance/[id]/records (no recordId)                     → 400 "recordId required"
```

### Known Limitation

Exercising the routes **past** authentication — real 404s for a nonexistent session/record, a real duplicate-session 422, a real invalid-status 422 reached *through* the service rather than inferred structurally, real ownership-chain rejections — requires both a real authenticated session (a logged-in user, which this environment has no interactive way to establish) and Sprint 11B's migration actually applied to a reachable Supabase-compatible database (still not done, per that sprint's own deliberate decision not to push schema changes to the real project without separate approval; the local Supabase dev stack's `db` container remains missing, a pre-existing condition unrelated to this work). This is the same limitation carried forward from Sprint 11B and 11D, now one layer further from the database. The business logic these deeper checks depend on was already verified live at the service layer in Sprint 11D; this sprint additionally confirms the routes correctly reach that layer without adding, weakening, or duplicating any of it. **Recommend**: once the migration is applied somewhere real, a full end-to-end smoke pass (real login, real school/class/term fixtures, real session/record lifecycle through the actual HTTP routes) should be run before Sprint 11F builds a UI on top of this API.

**Process note**: while starting a dev server for the smoke tests above, an overly broad `pkill -f "next dev"` momentarily killed a dev server that was already running (not one this session had started) on port 3000. It was restarted immediately (`npm run dev`, confirmed responding within 1 second) and is left running — flagged here, and to the user directly, for transparency, since the process PID changed.

---

## Future Extension Points Reserved for Sprint 11F+

- **Teacher UI (Sprint 11F)**: every route already returns exactly the shape a form/table needs (`AttendanceSessionRow`/`AttendanceRecordRow`) — no route shape change anticipated.
- **Report Card integration (Sprint 11H)**: no route here computes or exposes `days_present`/`days_absent` — that remains a `school_report_cards`-side concern, reading Attendance data through a future Attendance Summary function (per ADR-0003 §4), not through these routes.
- **Evidence integration**: no route constructs or reads an `EvidencePayload` — deferred entirely, per ADR-0003 §9.
- **Broader teacher-class ownership**: if a future sprint extends `assertOwnershipChain` (e.g. to recognize `class_subjects`-based teaching relationships), no route in this sprint needs to change — the service boundary absorbs that entirely.
- **Session locking**: if Sprint 11D/11F introduces a lock concept, `PATCH /api/core/attendance/[id]` is already the natural place to expose it, provided the service adds the corresponding metadata field first (not assumed here).
