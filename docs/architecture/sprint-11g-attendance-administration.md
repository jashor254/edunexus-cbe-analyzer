# Sprint 11G — Attendance Administration Workspace

**Status:** Complete — read-only orchestration only. No schema, repository, service, or attendance-logic change. **Awaiting explicit approval before Sprint 11H.**

**Implements**: a School Office / Academic Office view over the already-complete Attendance backend (Sprints 11B–11F), per ADR-0003.

---

## Workspace Structure

```
app/teacher/core-office/attendance/page.tsx   — new: Attendance Administration

app/teacher/core-office/academic/page.tsx     — edited: the inert "Attendance" Future
                                                 Modules placeholder (Sprint 10H) replaced
                                                 with a real card linking to the page above

app/teacher/attendance/history/page.tsx       — edited: accepts an optional ?classId=
                                                 query param to arrive pre-selected
                                                 (same technique new/page.tsx already used)

components/attendance/attendanceClient.ts     — edited: one new thin wrapper added,
                                                 listSessionsForSchool() — the admin-tier
                                                 branch of GET /api/core/attendance that
                                                 Sprint 11F's teacher workspace deliberately
                                                 never called
```

No new page beyond the one workspace; no new administration hub. Entry point is exactly one level deeper than Sprint 10H's own convention: **School Office → Academic Office → Attendance Administration** — the same three-level breadcrumb pattern `core-term`/`core-term/status` already use (`OperationalBreadcrumb`'s `parent` prop, Sprint 10H).

---

## Reuse Map

| Capability | Reused from | Note |
|---|---|---|
| Admin-tier gating | `ADMIN_TIER_ROLES` (`lib/core/adminTierRoles.ts`) + `/api/core/my-membership` | Identical check to every other School Office page — no new role, no new gating logic. |
| School-wide session list | `GET /api/core/attendance?schoolId=` → `listAttendanceSessionsForSchool` (Sprint 11D/11E, admin-tier only) | This is the exact branch Sprint 11F's teacher workspace deliberately avoided calling (a plain teacher isn't admin-tier). Admin-tier is precisely the audience this branch was built for — no new endpoint needed, just a client wrapper added. |
| Per-session record counts (today only) | `GET /api/core/attendance/[id]/records` → `listRecordsForSession` (Sprint 11E) | Used to distinguish "completed" from "pending" for **today's** sessions only — bounded to the small set of sessions dated today (at most one per class), not the whole history. |
| Academic Year / Term filters + checklist data | `GET /api/core/academic-years` (pre-existing) | Unmodified. |
| "Teachers assigned" / "Classes exist" checklist items | `GET /api/core/academic-readiness` → `getSchoolAcademicReadiness()` (Sprint 10E/10H) | Reused exactly as Sprint 10H's own Academic Office page already does — no new readiness function, no new calculation. |
| Class list + labels | `GET /api/core/classes` (pre-existing) | `classLabel()` reused from `attendanceClient.ts` (Sprint 11F). |
| Drill-down to session history | `/teacher/attendance/history?classId=` (Sprint 11F, minimally extended) | No new viewer — the existing History page now also accepts a pre-selected class via query param, exactly mirroring how `new/page.tsx` already reads `?classId=`. |
| Drill-down to session detail | `/teacher/attendance/[sessionId]` (Sprint 11F, unmodified) | Linked directly to each class's latest session. |

**Zero new business logic, ownership decision, or status check**: grep-confirmed zero references anywhere in `app/teacher/core-office/attendance/page.tsx` to `class_teacher_id`, a new authorization function, or any attendance status validation — every write path is untouched (this page performs no writes at all: no create, update, or delete call anywhere in the file).

---

## API Composition Map

```
Attendance Administration page
  ├─ GET /api/core/my-membership              → admin-tier gate
  ├─ GET /api/core/academic-years              → year/term filters, 2 checklist items
  ├─ GET /api/core/academic-readiness          → 2 more checklist items (teachers, classes)
  ├─ GET /api/core/classes                     → class list, filters
  ├─ GET /api/core/attendance?schoolId=        → whole-school session list (Sprint 11E,
  │                                               admin-tier branch)
  └─ GET /api/core/attendance/[id]/records     → per-session record count, TODAY's
                                                  sessions only (bounded set)
```

No `POST`/`PATCH`/`DELETE` call exists anywhere on this page. Every number shown is a plain `Array.filter(...).length` or a plain existence/max check over data one of the six reads above already returned — confirmed by inspection, no percentage, ratio, or trend computation appears anywhere in the file.

---

## School Summary — What Each Count Means

| Metric | Definition | Scope |
|---|---|---|
| Classes | `visibleClasses.length` (classes matching the current year/class filter) | Filtered |
| Sessions Today | Sessions with `attendance_date === today` | Filtered by year/term/class |
| Sessions This Week | Sessions within the Monday–Sunday window containing today | Filtered by year/term/class |
| Completed Today | Of today's sessions, how many have ≥1 attendance record | Today only |
| Pending Today | Of today's sessions, how many have 0 attendance records yet | Today only |

"Completed"/"Pending" are deliberately scoped to **today's sessions**, not all-time — a session created three weeks ago either has records or was abandoned, and re-litigating that historically isn't what "operational state" (this sprint's stated mission) is asking for. This also keeps the record-count fetch bounded to a small set (at most one session per class, typically), not an N+1 sweep over the school's entire attendance history.

---

## Operational Checklist

| Item | Source |
|---|---|
| ✅ Academic Year exists | `readiness.academicYear.resolved` (`getSchoolAcademicReadiness`) |
| ✅ Current Term exists | `readiness.term.resolved` (`getSchoolAcademicReadiness`) |
| ✅ Classes exist | `readiness.classes.count > 0` (`getSchoolAcademicReadiness`) |
| ✅ Teachers assigned | `readiness.teachers.allActiveTeachersHaveCanonicalIdentity` (`getSchoolAcademicReadiness`) |
| ✅ Attendance sessions created today | `sessionsToday.length > 0` — the one new boolean this sprint adds, and it is a **plain existence check** over already-fetched session data, not a new readiness *function* or calculation. No `getAttendanceReadiness()`-style helper was written — the mission's "do not invent attendance readiness calculations" is satisfied by keeping this inline and trivial rather than promoting it into a named service function. |

Four of five checklist items are 100% reused from Sprint 10H's existing `getSchoolAcademicReadiness()`; only the fifth is Attendance-specific, and it's the simplest possible boolean, not a calculation.

---

## Class List — Field Definitions

| Field | Definition |
|---|---|
| Class | `classLabel(cls)` — unchanged from Sprint 11F. |
| Today's attendance state | "Taken today" / "Not taken today" — based on **session existence** for today's date, matching ADR-0003 §4's own stated semantics ("session existence = was attendance taken"). Deliberately **not** based on `marked_by_teacher_id` — see Known Limitations. |
| Latest attendance date | `max(attendance_date)` across that class's sessions — a plain max, not a trend. |
| Marked by | "Marked" / "Not marked", read directly from the latest session's `marked_by_teacher_id` field. |
| Link to session history | `/teacher/attendance/history?classId=<id>` |
| Link to session detail | `/teacher/attendance/<latest session id>` (only shown if at least one session exists) |

---

## Navigation Map

```
School Office (/teacher/core-office)
  └─ Academic Office (/teacher/core-office/academic)
        └─ Attendance Administration (/teacher/core-office/attendance)   ← new this sprint
              ├─ → /teacher/attendance/history?classId=<id>              (Sprint 11F, extended)
              └─ → /teacher/attendance/<sessionId>                       (Sprint 11F, unmodified)
```

No sidebar/bottom-nav entry was added — grep-confirmed zero references to `core-office/attendance` or "Attendance Administration" in `TeacherSidebar.tsx`/`TeacherBottomNav.tsx`. This matches the sprint's own "do not create another administration hub" instruction and Sprint 10H's established convention: Academic Office is the one canonical entry point for academic-administration screens, and Attendance Administration slots into it exactly the way Promotion/Transfer/Graduation/Timetable/Departments are reserved to, someday, per that same page.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean. |
| `eslint` | Clean, zero warnings, on every new/modified file (one initially-added `eslint-disable` comment was removed after confirming it was unnecessary — the effect's dependency array was simplified instead). |
| All routes compile | **Verified live**: requested `/teacher/core-office/attendance`, `/teacher/core-office/academic`, `/teacher/attendance`, `/teacher/attendance/history?classId=x`, and `/teacher/core-office` against the running dev server — all five returned a clean `307` to `/login?returnTo=...`, none 500'd. |
| Admin gating still works | The page's own `isAdminTier` check (identical `ADMIN_TIER_ROLES` pattern to every other School Office page) was not exercised with a real authenticated non-admin session in this environment — same carried-forward limitation as every prior Attendance sprint (no interactive login available). Verified by code inspection: the gate is structurally identical to `core-office/academic/page.tsx`'s own, already-shipped gate. |
| Teacher workspace unaffected | Confirmed live: `/teacher/attendance`, `/teacher/attendance/history?classId=x` still compile and redirect correctly; `git diff` confirms only `history/page.tsx` and `attendanceClient.ts` were touched in the Sprint 11F surface, both additive (a new optional query-param read, a new exported function) — no existing behavior changed. |
| No duplicate navigation | Grep-confirmed: exactly one link to `/teacher/core-office/attendance` in the entire codebase (the new card in `academic/page.tsx`); zero sidebar/bottom-nav entries added. |
| No duplicate attendance pages | Confirmed: one new page (`core-office/attendance/page.tsx`); the four Sprint 11F pages are unmodified in structure (only `history/page.tsx` gained an optional param). |

### Known Limitations

1. **"Marked by" is, in practice, currently always "Not marked."** Sprint 11E's `POST /api/core/attendance` deliberately does not accept `markedByTeacherId` at session creation (the mission explicitly scoped that route's inputs to `schoolId`/`academicYearId`/`termId`/`classId`/`attendanceDate`/`sessionType` only), and Sprint 11F's teacher workspace never calls `PATCH /api/core/attendance/[id]` (the only route that sets it) either. This sprint surfaces that fact honestly rather than papering over it — "Not marked" on every class's latest session is accurate operational visibility, not a bug in this page. Closing the gap is a Sprint 11F-scoped fix (teaching the "Take Attendance" flow to set `marked_by_teacher_id` to the acting teacher at creation or first-save time), out of scope for this read-only administration sprint.
2. **"Today's attendance state" and "Completed/Pending" use session/record existence, not a resolved teacher name** — for the same reason as above, and because no route reachable here resolves `marked_by_teacher_id` to a display name anyway (unchanged limitation from Sprint 11F).
3. **No live authenticated verification** of the admin-tier gate or the filters' actual behavior against real data — this environment has no interactive login, and (per every prior Attendance sprint) Sprint 11B's migration has not been applied to any database reachable through the real dev server. What was verified: the page compiles, is served, and is gated by the same code path as every other School Office screen.
4. **Sessions-this-week uses a fixed Monday–Sunday window** computed from the client's current date — not configurable, not a school-calendar-aware "school week" (e.g. excluding a mid-week holiday). A plain, honest approximation, not a claim of curriculum-calendar awareness.

---

## ADR-0003 Compliance

- **§4 Domain Model**: no summary table, no new stored aggregate — every number is computed fresh, on read, from `attendance_sessions`/`attendance_records` exactly as ADR-0003 §4 specifies Attendance Summary must always work.
- **§5 Ownership Model**: untouched — this page performs no writes, so no ownership check was ever a candidate for duplication.
- **§6 Status Model**: not referenced by this page at all (no status is displayed or edited here — that's Session Detail's job, unmodified).
- **§9 Integration Boundaries**: grep-confirmed zero references to Evidence, Report Cards, Compass, Intelligence, Notifications, Behaviour, Analytics.
- **§13 Decision**: Attendance still consumes nothing and is still consumed by nothing outside its own UI — this sprint adds a second *reader* (admin-tier, alongside the Sprint 11F teacher reader), not a new consumer domain.

## Constitution / RAS Compliance

- **UI only, zero business logic**: satisfied by construction — every conditional in this page is a display branch (loading/error/empty/filter), never a business rule.
- **No direct Supabase**: confirmed — every read goes through an existing Next.js API route.
- **No duplicate authorization**: confirmed — `ADMIN_TIER_ROLES` reused verbatim, no new role array.
- **No duplicate readiness calculation**: confirmed — four of five checklist items are `getSchoolAcademicReadiness()`'s own fields, reused verbatim; the fifth is a one-line existence check, not a new named calculation.

---

## Future Integration Points Reserved for Sprint 11H+

- **Attendance ↔ Report Card integration (Sprint 11H)**: this page does not read or write `days_present`/`days_absent` — that remains entirely Report Cards' own concern, to be wired from the Attendance side in a later, separately-approved sprint.
- **Parent Attendance (Sprint 11I)**: no parent-facing surface exists; this workspace is admin-tier only.
- **Intelligence & Evidence consumption (Sprint 11J)**: no `EvidencePayload` construction, no Projection/Compass read, anywhere in this sprint's files.
- **"Marked by" resolution to a real name and a real value**: flagged above as a Sprint 11F-scoped fix, not built here.
- **Exports/CSV/PDF**: explicitly forbidden this sprint and not built.
