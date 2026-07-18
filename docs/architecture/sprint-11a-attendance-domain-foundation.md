# Sprint 11A — Attendance Domain Foundation

**Status:** Audit only. Phase 1 complete via full-repository search (findings below), Phases 2–8 are design/documentation, no code written. **Awaiting explicit approval before any implementation.**

**Mission:** Establish Attendance as a canonical, reusable Core operational domain, with the same architectural discipline as Sprint 9/10 — not an Intelligence, Evidence, or Reporting sprint. This document only.

---

## Phase 1 — Architecture Audit (read-only, full repository search)

| # | Item | Finding |
|---|---|---|
| 1 | Attendance tables | **None exist.** `lib/database.types.ts` has zero tables or columns matching `attendance`/`attend` beyond §1a below. |
| 1a | Attendance-adjacent columns elsewhere | `days_present: number \| null`, `days_absent: number \| null` on `school_report_cards` (`lib/database.types.ts:7136-7137`, repeated in Insert/Update variants). These have existed since the report-card table's own migration — not a dedicated attendance feature. No per-day, per-lesson, or per-class attendance table anywhere. |
| 2 | Attendance API routes | **None.** No route path contains "attendance." The only touchpoint is `app/api/core/reports/route.ts`'s existing `action:'update'` branch (lines 95-112), which accepts `days_present`/`days_absent` alongside comments — fully permission-gated (`requireSchoolMembership` + `canEditReport`) and functional end-to-end, but see §15. |
| 3 | Attendance UI | **No functional UI anywhere.** 5 total hits, all copy/labels: marketing page explicitly attributes attendance to the school's *existing SMS*, not EduNexus (`app/(marketing)/page.tsx:828,843`); privacy policy claims EduNexus Core collects "Attendance (days present/absent)" (`app/(marketing)/legal/privacy/page.tsx:236`) — a copy/reality gap since nothing populates it; parent report card renders an always-empty `— present / — absent` row (`app/(parent)/report-card/page.tsx:144-146`); Sprint 10H's static "Planned future module" placeholder (`app/teacher/core-office/academic/page.tsx:323`). No entry in `TeacherSidebar.tsx`/`TeacherBottomNav.tsx`. |
| 4 | Attendance repositories | **None.** `lib/repositories/` has zero attendance-specific files. `school.repository.ts` only carries `days_present`/`days_absent` as plain columns in its `REPORT_COLS` select list (line 27) and `updateReportCard()` signature — not an attendance repository. |
| 5 | Attendance services | **None** in `lib/core/`, `lib/intelligence/`, `lib/learnerRecord/`, `lib/projection/`. Only incidental, unrelated hits in `lib/career/seedCareers.ts` (career-seed copy describing attendance-SaaS as a *career idea*, not a platform feature). |
| 6 | Other references | `types/core.ts`'s `SchoolReportCard` type carries `days_present`/`days_absent` (lines 298-299); `lib/core/report-cards.ts:118` types `updateReportCard()`'s param as `Pick<SchoolReportCard, 'class_teacher_comment' \| 'headteacher_comment' \| 'days_present' \| 'days_absent'>`. No other type or config references attendance. |
| 7 | Landing-page claims | Deliberate, consistent positioning: attendance is explicitly framed as something the school's own SMS already handles ("Your SMS manages... Attendance tracking"), not an EduNexus feature. No false claim of attendance as a shipped EduNexus capability. |
| 8 | Documentation claims | Two recent architecture docs already classify attendance explicitly: `docs/architecture/academic-evidence-layer.md:282` — "Attendance \| **Net-new.** No table anywhere in the schema. Out of scope — no evidence this is needed before a real school asks." `docs/architecture/learner-record-layer-decisions.md:32-39,303` reserves a *future* `EvidencePayload` union member (`{ kind: 'attendance'; status: 'present'\|'absent'\|'late'; date: string }`) as explicitly not-yet-implemented, and separately reconfirms attendance/behaviour as deliberately excluded from that phase ("build on demand"). `docs/pilot-readiness-review.md` treats attendance as an operational domain schools may run externally in "Hybrid mode," needing no engineering before pilot. Vision/blueprint docs (`docs/edunexus-canonical-architecture.md`, `docs/developer-platform.md`, `docs/dx-ecosystem-blueprint.md`) mention attendance only as future-ERP-integration or aspirational copy, never as built. **No doc falsely claims attendance is currently shipped.** |
| 9 | Evidence integration | **None today.** `evidenceLifecycle.ts`, the `learner_evidence` table, and `getLearnerTimeline()` do not reference or ingest attendance in any form. The only place attendance is modeled as a future evidence shape is the dormant discriminated-union stub in §8 — designed, never constructed or read anywhere. |
| 10 | Report-card integration | **The one place attendance has real schema/type/API presence** — `days_present`/`days_absent` on `SchoolReportCard`, write-capable via the existing `action:'update'` path, but with no write UI (see §15). |
| 11 | Parent integration | `app/(parent)/report-card/page.tsx:144-146` displays the row; always shows `—` since nothing writes the underlying fields. No other parent-facing file mentions attendance. |
| 12 | Teacher workflow | **No "mark attendance" action exists anywhere.** The near-miss is the dormant `action:'update'` API capability — no teacher page ever calls it (confirmed: grepping for `days_present`/`days_absent`/`action.*'update'` across `.tsx` files returns only the parent read-side). |
| 13 | Student workflow | **None.** No student-facing file references attendance. |
| 14 | School/admin workflow | **None.** No file under `app/admin/` references attendance. |
| 15 | Dormant/dead code | `lib/core/report-cards.ts:118`'s `updateReportCard()` + `app/api/core/reports/route.ts`'s `action:'update'` branch: fully built, schema-validated, permission-checked, repository-wired — **zero UI callers**, confirmed by grep. A teacher cannot record attendance today even though the column, type, Zod schema, permission check, and repository write path already exist end-to-end. The `EvidencePayload` attendance union-member stub (§8) is likewise designed-but-unimplemented, referenced nowhere else. The `FutureModule` label (Sprint 10H) is inert by design (no href/onClick), consistent with that sprint's own scope. |

**Bottom line**: there is no canonical Attendance domain today. What exists is one orphaned pair of report-card columns with a fully-built-but-uncalled write path, a static nav placeholder, a privacy-policy claim that overstates what's actually populated, and pre-existing architecture docs that already independently recommend building attendance "on demand" via the generic Evidence-source shape rather than a bespoke table.

---

## Phase 2 — Domain Model (design only, not implemented)

Following the Core domain's existing shape (`schools` → `school_users` → `academic_years` → `terms` → `classes` → `class_students`), the canonical Attendance model, if built:

| Concept | Definition | Notes |
|---|---|---|
| **Attendance Session** | One instance of attendance-taking for one class, on one school day (date + class_id + school_id + term_id). The unit a teacher marks. | Analogous to how `school_assessments` scopes to `class_id` + `term_id` + `year`. |
| **Attendance Record** | One row per learner per session: `{ session_id, learner_id, status, marked_by, marked_at }`. | The atomic fact — mirrors `learner_evidence`'s one-row-per-observation shape, not a summary. |
| **Attendance Status** | Enum: `present`, `absent`, `late`, `excused`, `early_departure`. Matches the reserved `EvidencePayload` stub's `'present'\|'absent'\|'late'` plus two additions the sprint brief itself lists (Late Arrival, Early Departure). | Must be a fixed enum, not free text — matches `is_published`-style boolean/enum conventions used elsewhere in Core. |
| **Attendance Summary** | Derived, not stored: counts of each status per learner per term (feeds `days_present`/`days_absent` on `school_report_cards`, already reserved for exactly this). | Computed on read from Records, same pattern as `fetchClassTermStatuses()` computing from `school_assessments`/`school_report_cards` rather than a separate stored summary table. |
| **Attendance History** | The Summary computed across multiple terms/years for one learner. | No new storage — same derivation pattern, wider date range. |
| **Attendance Exceptions** | Records with status `late`, `excused`, `early_departure`, or `absent` with a reason. Not a separate table — a query filter over Records. | Avoids a second write path for "exceptions," matching the Ten Engineering Rules ("never create another write path"). |
| **Late Arrival** | `status = 'late'`, optionally with an arrival time. | Sub-case of Attendance Status. |
| **Early Departure** | `status = 'early_departure'`, optionally with a departure time. | Sub-case of Attendance Status. |
| **Excused Absence** | `status = 'excused'`, with a required reason field. | Sub-case of Attendance Status. |
| **Unexcused Absence** | `status = 'absent'` with no reason recorded. | Default absence case. |

**Key design decision to validate before Phase 8 commit 1**: one `attendance_records` table (session concept folded into `class_id + date`, no separate `attendance_sessions` table) vs. two tables (`attendance_sessions` + `attendance_records`). The two-table shape matches `school_assessments`/assessment-scores more closely and supports "was attendance taken at all today" as a distinct fact from "who was present," which a single-table design cannot express cleanly. Recommend the two-table shape for that reason — but this is a decision for Phase 8, not settled here.

---

## Phase 3 — Lifecycle (documentation only)

```
Academic Year
  └─▶ Term
        └─▶ School Day (a date within the term's range — no new table; derived from term.start_date/end_date)
              └─▶ Class (existing `classes` table)
                    └─▶ Attendance Session (new — one per class per day)
                          └─▶ Attendance Marking (teacher records Attendance Records for each learner in the class)
                                └─▶ Daily Summary (derived, not stored — counts per status, per class, per day)
                                      └─▶ Historical Archive (derived — Records accumulate; Summary/History are always computed on read, matching fetchClassTermStatuses()'s existing pattern, never a second stored truth)
```

This mirrors the Assessment→Report Card lifecycle already built in Core (`school_assessments` → locked → `computeTermSummaries` → `school_report_cards`), reusing the same shape rather than inventing a new one.

---

## Phase 4 — Role Inventory (reuse only, no new roles)

| Role | Attendance responsibility |
|---|---|
| `teacher` | Marks Attendance Records for the classes they currently teach (ownership resolved via `class_students`/class-teacher assignment, same access-control principle as evidence — **never** via "who marked this row," per the CLAUDE.md `teacher_id` rule). |
| `school_admin` / `headteacher` / `deputy_headteacher` (admin-tier) | Read school-wide Attendance Summary/History across all classes — same tier already gating Academic Office. |
| `parent` | Read their own child's Attendance Summary/History only (existing parent-learner relationship, no new visibility rule). |
| `student` | No student-facing platform login model exists for this in Core today (confirmed in Phase 1 — no student workflow anywhere); out of scope until a student-facing surface exists at all. |

No new role (`discipline_master`, `registrar`, `attendance_officer`) is needed or proposed — every responsibility above maps onto the six existing roles.

---

## Phase 5 — Integration Audit (future integration points, none built this sprint)

| Integration | Current state | Future shape (not built) |
|---|---|---|
| Attendance → Report Cards | `days_present`/`days_absent` columns already exist and are already wired for write via `updateReportCard()` — genuinely just needs a real value computed from Attendance Records instead of manual entry. **Lowest-friction integration; the seam already exists.** | Populate the two existing fields from computed Attendance Summary at report-generation time. |
| Attendance → Evidence | The `EvidencePayload` union already reserves an `attendance` variant (`learner-record-layer-decisions.md:39`). | Attendance Records could emit Evidence rows of `kind:'attendance'` through the existing `evidenceLifecycle.ts` domain functions — reuses the existing write path, doesn't duplicate it. |
| Attendance → Parent Communication | Parent report-card page already renders the (currently empty) row. | A populated Summary would make that existing display correct; a push notification ("your child was marked absent") is a distinct future feature, not assumed here. |
| Attendance → Guidance & Counselling | No Guidance & Counselling domain exists in the codebase today (not found in Phase 1 or prior sprint audits). | Deferred entirely — no current integration point to design against. |
| Attendance → Academic Clinic | Academic Clinic (`app/(parent)/career-report` era code, per memory) is career/capability focused, not attendance-adjacent today. | Deferred — would need its own audit before any real integration design. |
| Attendance → Career Intelligence | No mechanical link found; Career Intelligence consumes capability/evidence, not attendance. | Deferred — plausible only as a soft signal (e.g. consistency), not committed to here. |
| Attendance → Promotion | `lib/core/promotions.ts`'s `runAnnualPromotion` currently has no attendance input (confirmed — no attendance reference in that file per Sprint 10H's audit). | Deferred — a real promotion policy question (attendance thresholds for promotion) belongs to a future sprint with its own approval, not assumed here. |
| Attendance → Behaviour | No Behaviour domain exists in the codebase at all. | Deferred entirely — nothing to integrate with yet. |

None of these integrations are built in Sprint 11A. Listing them only confirms the domain model in Phase 2 doesn't foreclose any of them.

---

## Phase 6 — Repository Audit (pattern only, no implementation)

- **Canonical repository pattern** (confirmed from `lib/repositories/school.repository.ts`, `teacher.repository.ts`, `learner.repository.ts`): one class extending `BaseRepository` (`lib/repositories/base.ts`) per domain, explicit `_COLS` constants (never `select('*')`), one method per query/mutation, registered in `lib/repositories/index.ts`.
- **Where Attendance would live**: a new `lib/repositories/attendance.repository.ts` — a new file, not a new pattern. This is additive (a new repository *instance* of the existing pattern), not a repository-pattern redesign, and is explicitly allowed by the Ten Engineering Rules ("never duplicate repositories" — a new domain's repository is not a duplicate).
- **Ownership**: Attendance Records belong to the learner (via session → class → `class_students`), not the marking teacher — per the CLAUDE.md `teacher_id` rule already codified for evidence. Read access must be resolved the same way: "does this teacher currently teach this class," never "did this teacher mark this row."
- **Read/write boundary**: writes go through `lib/core/attendance.ts` (a new service module, following the `lib/core/assessments.ts`/`report-cards.ts` shape) calling the repository; no direct Supabase calls from routes or components, per CLAUDE.md's architecture rules.

No repository code is written in this sprint.

---

## Phase 7 — Security (audit only)

| Concern | Finding / requirement |
|---|---|
| Ownership model | Attendance Records must be scoped to `school_id` + `class_id`, with access resolved via current `class_students` membership — same principle already enforced for evidence (`docs/architecture/academic-evidence-layer.md` §3) and required by CLAUDE.md's `teacher_id` rule. |
| School isolation | Must reuse `requireSchoolMembership`/`requireSchoolAdmin` (`lib/core/permissions.ts`) exactly as every other Core route does — no new isolation mechanism needed or proposed. |
| Teacher ownership | A teacher may write Attendance Records only for classes they currently teach (same check as assessment-locking); may never gate *read* access to a learner's attendance history by "did I mark this," per the same standing rule. |
| Parent visibility | A parent may read only their own child's Attendance Summary — reuses the existing parent-learner relationship already enforced for report cards; no new relationship model needed. |
| Student visibility | Not applicable — no student login surface exists in Core today (Phase 1/Phase 4 finding). |
| RLS | Any new `attendance_sessions`/`attendance_records` tables must have RLS enabled with explicit policies per CLAUDE.md's Database Rules — this is a requirement for Phase 8 commit 1, not evaluated further here since no table exists yet. |

No security code is written in this sprint; this section states requirements for Phase 8 to satisfy.

---

## Phase 8 — Implementation Plan (documentation only — not started)

1. **Commit 1 — Domain model**: `attendance_sessions` + `attendance_records` tables (per Phase 2's two-table recommendation), migration, RLS policies, indexes on `school_id`/`class_id`/`term_id` per CLAUDE.md's required-index rule. No app code.
2. **Commit 2 — Repository**: `lib/repositories/attendance.repository.ts` extending `BaseRepository`, explicit `_COLS`, registered in `index.ts`. No business logic.
3. **Commit 3 — Core service**: `lib/core/attendance.ts` — `openSession`, `markAttendance`, `getSessionRecords`, `getClassSummary`, `getLearnerHistory`, following the `assessments.ts`/`report-cards.ts` shape (thin functions over the repository, explicit return types, no `any`).
4. **Commit 4 — Routes**: `app/api/core/attendance/route.ts` — thin, Zod-validated, `auth.getUser()` + `requireSchoolMembership`/`requireSchoolAdmin` first, calling only the Commit 3 service.
5. **Commit 5 — Teacher UI**: a "Mark Attendance" screen under `app/teacher/core-*` (exact path TBD at design time), reusing the existing class-picker pattern from `core-term/page.tsx`.
6. **Commit 6 — School Office / Academic Office integration**: replace the inert `FutureModule` "Attendance" placeholder (`app/teacher/core-office/academic/page.tsx:323`) with a real `WorkflowCard` linking to Commit 5's screen, following Sprint 10H's "one canonical entry" convention exactly.
7. **Commit 7 — Tests**: unit (repository), integration (service against real synthetic rows, matching the `lib/core/*.test.ts` convention), authorization (teacher-can't-mark-other-class, parent-can't-read-other-child), edge cases (empty class, re-marking same day).
8. **Commit 8 — Documentation**: update this doc's "Status," `docs/engineering/implementation-log.md`, and correct the privacy-policy copy gap found in Phase 1 §3/§8 if Commit 1-6 lands (the claim becomes true instead of aspirational).

No commit above has been started. This is a plan, pending approval.

---

## Architecture Guardian Assessment

### 1. Architectural Assessment
- **Affected canonical domains**: a new domain — Attendance — plus a read/write touchpoint on the existing Report Cards domain (populating already-reserved `days_present`/`days_absent`) and a documented-but-deferred touchpoint on Evidence (the reserved `EvidencePayload` variant). No existing domain's identity or ownership changes.
- **Constitutional compliance**: compliant as designed — new domain gets its own repository/service/routes rather than being bolted onto an existing one; ownership resolved via current class membership, not marking-actor id, per the standing `teacher_id` rule.
- **RAS compliance**: compliant — follows the exact Core domain shape (`schools`→`terms`→`classes`→domain table→repository→service→route→UI) already ratified for Assessments/Reports.
- **ADR required?** **Yes, conditionally** — introducing a new canonical domain (Attendance) is one of the explicit ADR trigger conditions ("introduces a new architectural layer or canonical domain"). Recommend a short ADR at Phase 8 Commit 1, not because the design is contested, but because the trigger condition is met literally, and Sprint 9/10's own precedent (`sprint-10g-school-office-activation.md`) explicitly reasoned through *not* needing one only because no new domain was created — this sprint does create one.

### 2. Engineering Assessment
- **Files likely affected (future, not this sprint)**: new migration; new `lib/repositories/attendance.repository.ts`; new `lib/core/attendance.ts`; new `app/api/core/attendance/route.ts`; new teacher UI page; one edit to `app/teacher/core-office/academic/page.tsx` (swap placeholder for real card); possible edit to `lib/core/report-cards.ts`'s generation step to populate `days_present`/`days_absent` from computed Attendance Summary (only if that integration is explicitly approved — Phase 5 lists it as future, not committed).
- **Repositories affected**: one new repository, zero changes to existing ones.
- **Services affected**: one new service module; `report-cards.ts` only if the Report Card integration is separately approved.
- **API routes affected**: one new route; zero changes to existing ones (the dormant `action:'update'` path on `/api/core/reports` stays as-is unless a future sprint explicitly decides to compute those fields instead of manual entry).
- **Database impact**: two new tables + RLS + indexes (real migration required — first migration this sprint touches, since everything through Sprint 10H was UI-only).
- **Security impact**: must reuse `requireSchoolMembership`/`requireSchoolAdmin` and class-membership-based ownership exactly as Assessments does; no new authorization primitive.
- **Testing impact**: full test category set required per Phase B mode (unit/integration/authorization/edge-case) — none written yet.
- **Deployment risk**: low-to-moderate — first real schema change since Sprint 9, but additive (new tables, no existing table altered except the already-reserved report-card columns being populated rather than schema-changed).
- **Backward compatibility**: preserved — nothing existing is removed; the privacy-policy claim (currently overstated) becomes accurate rather than needing to be walked back.

### 3. Risks
- **Architectural**: low — shape matches an already-ratified pattern; main risk is scope creep into the 8 listed future integrations before the foundation itself is proven, which this sprint's own mission text explicitly forbids.
- **Business**: low — closes a real, already-existing privacy-policy/reality gap (§3/§8) rather than opening one.
- **Migration**: moderate — first live schema migration since the Core buildout; needs the Add→Backfill→Verify→Observe→Deprecate→Delete discipline even though this is a pure Add (no existing data to backfill).
- **Security**: low if the existing ownership/permission patterns are reused exactly as designed above; would become high risk only if a shortcut introduced a second authorization path.
- **Performance**: low — one new session+records pair per class per school day is a small, bounded write volume; needs the required indexes per CLAUDE.md (`teacher_id`/`student_id`/`class_id`/`week_number`-equivalent) at Commit 1.

### 4. Approval
⚠ **Needs ADR** before Phase 8 Commit 1 (new canonical domain — trigger condition literally met), but the audit itself and this document require no approval beyond what's being requested now. Recommend: approve this audit, then require a short ADR (`docs/architecture/adr/NNNN-attendance-domain.md`) covering just the one open design decision flagged in Phase 2 (one-table vs. two-table shape) before any code is written. No other aspect of this plan is architecturally contested.

**Awaiting explicit user approval before any implementation begins.**
