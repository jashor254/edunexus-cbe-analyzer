# ADR-0004 — Attendance Integration Principles

**Status: DRAFT — awaiting explicit approval before Sprint 12B.** This ADR is a design decision record only. No table, migration, repository, service, route, UI, or test was created in producing it.

**Precedes**: Sprint 12B onward (every future Attendance integration).
**Supersedes**: nothing.
**Depends on / extends**: ADR-0003 (`adr-0003-attendance-domain.md` — canonical Attendance domain), ADR-0002 (`adr/0002-canonical-teacher-identity.md` — identity), and the Reference Architecture Specification's already-ratified Intelligence Standards (§9), which this ADR generalizes to Attendance rather than reinvents.

---

## Why This ADR Exists

Sprint 11I certified Attendance as production-ready and standalone. Every future sprint that connects Attendance to another domain (Report Cards, Evidence, Intelligence, Parent Portal, Analytics, Notifications, ...) will face the same recurring questions: who owns the resulting number, who's allowed to read what, is a summary allowed to be stored, does the consumer read live or cached. Answering these once, here, means every future integration sprint (12B onward) has a fixed constitutional gate to check against instead of re-litigating the same questions per sprint — exactly the discipline ADR-0002/ADR-0003 already established for identity and for the domain itself.

---

## 1. Attendance Ownership

**Attendance owns Attendance, permanently and exclusively.** `attendance_sessions` and `attendance_records` are written only by `lib/core/attendance.ts`'s exported functions (`createAttendanceSession`, `recordAttendance`, `bulkRecordAttendance`, `updateAttendanceRecord`, `updateAttendanceSession`, `deleteAttendanceRecord`, `deleteAttendanceSession`), called only from `app/api/core/attendance/**`. No other domain's service, repository, or route may write to these two tables under any circumstance — not "usually shouldn't," structurally may not. This is ADR-0003 §13's own decision ("Attendance consumes nothing") restated as a rule that binds every *other* domain, not just Attendance itself: no domain may write Attendance except Attendance.

A consumer that needs an attendance fact to be different (a correction, a re-mark) does not write to Attendance directly under any pretext — it routes the correction back through Attendance's own PATCH/DELETE operations, exactly as a teacher or admin would, never through a side-channel write from Report Cards, Evidence, or anywhere else.

---

## 2. Read Direction

**Every integration is Attendance → Consumer. Never Consumer → Attendance as a write, and never Attendance ← Consumer as a read dependency.** Attendance's own service and repository import nothing from Report Cards, Evidence, Intelligence, Compass, Parent Portal, Analytics, Notifications, Promotion, or any other domain — confirmed true today (Sprint 11I's audit), and this ADR makes it a permanent constraint, not an accident of build order. A future sprint that finds itself wanting Attendance to import from a consumer domain has misdiagnosed the dependency direction and must stop and re-derive the design, not proceed.

**All reads go through `lib/core/attendance.ts`'s exported functions — never `AttendanceRepository` directly, never a raw Supabase query against `attendance_sessions`/`attendance_records`.** This is not a new rule; it is the Repository Architecture Standard already in force for every domain, restated here explicitly because it is the rule most likely to be quietly broken by a consumer sprint reaching for "just a quick join" against the Attendance tables for convenience.

### The one mandatory exception, already ratified: Intelligence never reads Attendance directly, at all

The Reference Architecture Specification's Intelligence Standards (§9) already state: *"No Intelligence module (`lib/projection/`, `lib/career/`, `lib/compass/`, `lib/academicClinic/`, `lib/adaptiveLearning/`) reads an Operating-Layer table (`class_assessments`, `learner_marks`, `school_report_cards`, etc.) directly, ever."* Attendance (`attendance_sessions`, `attendance_records`) is an Operating-Layer table by the same definition Assessments and Report Cards already are. This ADR does not create a new rule for Attendance here — it confirms the existing rule already covers it, and the RAS's own reserved Attendance row (§3, line 69) already anticipated this: *"Evidence (one-way, when built)"* is listed as Attendance's only relationship to the rest of the platform. **Any integration sprint that has Compass, Projection, Career Intelligence, Academic Clinic, or Adaptive Learning read `attendance_sessions`/`attendance_records` directly — even "just for one field" — is in violation of an already-ratified Constitutional rule, not just this ADR.** The only path from Attendance into Intelligence is through Evidence (`learner_evidence`), exactly as Assessments' path into Intelligence already works.

---

## 3. Write Direction

No domain writes Attendance (§1). Attendance itself may, in a future sprint, become a **producer** of Evidence — i.e., Attendance-owned code may call Evidence's own existing write functions (`lib/intelligence/evidenceLifecycle.ts`) to construct `learner_evidence` rows of the already-reserved `{ kind: 'attendance', status, date }` shape (`docs/architecture/learner-record-layer-decisions.md` §32-39). This is the **one** write Attendance is permitted to make outside its own tables, and it is not a violation of "Attendance owns Attendance" because:
- Attendance does not gain write access to any Evidence-internal table or bypass Evidence's own lifecycle rules (confirm/reject/retract/erase) — it only ever calls Evidence's existing, named entry points, exactly as `lib/assessments/` already does today for assessment-sourced evidence.
- Evidence still owns Evidence. Attendance becomes one more *source* of evidence, not a second owner of it.

No other write direction is permitted. Report Cards, Parent Portal, Analytics, Notifications, Intelligence, Promotion, Behaviour — none of these may ever write to `attendance_sessions`, `attendance_records`, or (on Attendance's behalf) to `learner_evidence`.

---

## 4. Derived Data Policy

A **derived value** (e.g., "days present this term" for a report card, "attendance rate" for a hypothetical future analytics view) is computed **by the consumer, from Attendance's raw data, at the moment the consumer needs it.** Attendance itself never computes another domain's derived value and never stores one. Report Cards' `days_present`/`days_absent` columns, once populated, belong entirely to Report Cards' own computation — Attendance supplies the raw session/record facts; Report Cards decides what "days present" means for its own purposes (which sessions count, how partial/excused days are treated) and computes it itself.

This mirrors exactly the pattern ADR-0003 §4 already established *inside* Attendance (Attendance Summary is computed on read, never stored) — this ADR generalizes the same discipline to every domain that will ever sit downstream of Attendance.

---

## 5. Summary Policy

**No summary of Attendance data is ever stored anywhere, by anyone, under any name** — not a `learner_attendance_summary` table, not a cached column, not a materialized view, not a denormalized count on a report card that isn't regenerated fresh. If a future sprint's performance needs genuinely require a stored aggregate, that is itself an architecture decision requiring its own ADR amendment to this one — never a default assumption a consuming sprint reaches for silently. Sprint 11H/11G's own completion-state work is the template every future consumer must follow: compute fresh, every time, from `listRecordsForSession`/roster-equivalent reads — never cache across requests, never persist.

---

## 6. Integration Rules

Every future Attendance-integration sprint must satisfy all of the following before writing any code:

1. **State which of Attendance's existing exported functions it calls.** If the needed read doesn't exist yet (e.g., a future bulk "completion state for every session in a class" read), that is a new **Attendance-owned** service function, added to `lib/core/attendance.ts` by that integration sprint (with Attendance's own review discipline — no repository bypass), never reimplemented inside the consumer.
2. **State the read/write direction explicitly**, using the Integration Matrix template in `sprint-12a-attendance-integration-architecture.md` §3, before implementation begins.
3. **Never duplicate ownership-chain or status-validation logic.** A consumer needing to confirm "is this a valid attendance status" or "does this teacher own this class" calls Attendance's own functions (`getAttendanceSession`, etc.) — it does not re-derive `class_teacher_id` comparisons or status-enum checks itself.
4. **Never bypass RLS or the service layer for a "quick read."** Every read, however trivial, goes through `lib/core/attendance.ts`.
5. **Identity resolution reuses the same canonical Core functions Attendance itself uses** (`getSchoolUser`, `getClass`, `isSchoolAdmin`, etc.) — never a legacy identity bridge, per ADR-0002.
6. **A performance concern is solved by adding a new, purpose-built Attendance-owned read function** (batched, indexed appropriately), never by the consumer looping over an existing single-item read N times, and never by caching the result outside the request.

---

## 7. Future Extension Rules

- Any new consumer domain not named in this ADR's roadmap (§ below, and in `sprint-12a-attendance-integration-architecture.md` §3) that wants to read Attendance must be evaluated against this same ADR before its own integration sprint begins — this ADR is the fixed gate, not a one-time checklist that stops applying after Sprint 12B.
- Any proposal to let Attendance read *from* a consumer domain (inverting the direction in §2) requires a new ADR, not an amendment slipped into an integration sprint's own scope.
- Any proposal to store a summary (§5) requires a new ADR amendment to this one, explicitly, before any code.

---

## 8. Explicit Non-Goals (of this ADR, and of the integrations it will eventually gate)

This ADR does not design, and no integration sprint gated by it may assume:
- Attendance percentages, rates, trends, or streaks, anywhere, ever, without a dedicated future ADR revisiting §5.
- AI-generated attendance insights or risk scoring directly from attendance data (any risk signal must route through Evidence → Projection, per §2's Intelligence rule — never a bespoke "attendance risk model").
- A Behaviour domain (does not exist; out of scope until one is built and its own relationship to Attendance is separately decided).
- Attendance-gated Promotion policy (a real school-policy product decision, not an architecture question this ADR resolves).
- Notifications, SMS, WhatsApp, or any parent-facing alert — each requires its own product/policy decisions (frequency, opt-in, channel) before any architecture is designed for it.
- Exports, imports, PDFs, or CSVs of attendance data.

---

## 9. Rejected Alternatives

| Alternative | Why rejected |
|---|---|
| **Let each consumer read `attendance_sessions`/`attendance_records` directly for "simple" cases** (e.g., Report Cards joining directly in a query) | Reintroduces exactly the repository-bypass risk ADR-0003/the Repository Architecture Standard exist to prevent — "simple" read patterns are exactly how a second, undocumented write path or a stale assumption about status values creeps in later. |
| **Let Intelligence read Attendance directly, treating it as a special case** | Already foreclosed by the RAS's existing, ratified Intelligence Standards (§9) — Attendance is an Operating-Layer table like any other; carving out an exception would contradict a rule that already governs five other Intelligence modules consistently. |
| **Store a "days present" summary on `attendance_sessions` itself, updated by triggers** | Reintroduces exactly the "second stored truth" problem ADR-0003 §4 exists to prevent inside Attendance's own tables — worse than a consumer-side cache, since it would corrupt Attendance's own canonical data with another domain's derived concept. |
| **Let Report Cards own its own copy of "attendance taken" via a foreign key to a specific session id, cached at generation time** | Would go stale the moment a teacher edits a record after report generation — violates the Sprint 11H-established principle that history/state must always reflect live reality, never a snapshot presented as current. |
| **A generic "Attendance Summary Service" shared by all consumers, computing and caching for everyone** | Reintroduces a stored/cached summary by another name, and creates a second service layer with its own ownership ambiguity (is it Attendance's, or a new domain's?) — rejected in favor of each consumer computing its own derived value from Attendance's raw reads, per §4. |

---

## 10. Success Criteria

An integration sprint gated by this ADR is compliant if and only if:
- It names, in its own architectural assessment, exactly which existing Attendance-exported function(s) it calls, or exactly which new Attendance-owned function it is adding (and why the existing set doesn't cover it).
- It never writes to `attendance_sessions`/`attendance_records` from outside `lib/core/attendance.ts`.
- It never stores a computed/derived attendance value inside Attendance's own tables.
- If it touches Intelligence in any form, it does so exclusively via Evidence, never a direct Operating-Layer read.
- It does not introduce a stored summary, cache, or materialized aggregate without a separate ADR amendment to this one.
- It reuses existing Core identity/permission functions for any authorization or ownership question, never re-deriving them.

---

## 11. Roadmap Gated by This ADR

See `docs/architecture/sprint-12a-attendance-integration-architecture.md` §6 for the full roadmap and rationale. Summary:

| Sprint | Integration | Direction |
|---|---|---|
| 12B | Attendance → Report Cards | Read-only; Report Cards computes `days_present`/`days_absent` itself from Attendance's raw sessions/records. |
| 12C | Attendance → Parent Portal | Read-only, scoped to the parent's own learner(s). |
| 12D | Attendance → Intelligence | Via Evidence only (§2's mandatory exception) — this sprint's real first deliverable is Attendance producing Evidence rows; Intelligence then consumes them through the pipeline that already exists, unmodified. |
| 12E | Attendance → Analytics | Deferred pending a real, demonstrated school need — no percentage/trend/rate has been requested by any pilot school yet. |
| 12F | Attendance → Notifications | Deferred pending explicit product/policy decisions (frequency, opt-in, channel) — not an architecture question this ADR resolves. |

**Approval status: DRAFT.** Sprint 12B does not begin until this ADR is explicitly approved.
