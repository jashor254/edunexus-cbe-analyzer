# Sprint 9 — School Operations Excellence: Audit & Convergence Report

**Status:** Audit-only. No code written. Verified 2026-07-21 via 5 parallel read-only research passes against the live codebase (corrects two stale claims from the 2026-07-13 Pilot Readiness audit and the 2026-07-18 PRP-1 memory — see inline notes).

**Primary question:** *Can a school realistically operate an academic term inside EduNexus today?*

**Short answer:** For the academic core (admissions → attendance → assessment → report cards → term rollover), **yes, mechanically** — one complete, tested, gated pipeline exists and is reachable by admin-tier staff. For everything an actual Headteacher/Deputy/HOD/Registrar needs beyond that core (timetable, promotion, transfers, department structure, school-wide calendar/notifications, HOD/Registrar identity), **no** — these are either placeholder tiles the product itself labels "future," fully-built-but-unreachable backends, or entirely absent.

---

## 1. Executive Summary

EduNexus's operational layer is not one system in one state of readiness — it is **two schemas at two different maturities wearing one UI**:

- **"Core"** (`schools`/`classes`/`streams`/`school_users`/`learner_enrollments`, `lib/core/*`, `supabase/migrations/20260629_core_foundation.sql`) is the intentionally-designed multi-tenant school-administration schema. Its read paths, admissions, term-lock/publish, and report-card pipeline are real, tested, and reachable via `app/teacher/core-office/*`, `core-team`, `core-admissions`, `core-term`.
- **"Legacy"** (`teacher_classes`/`students`) is what every live day-to-day teaching feature (Gradebook, Attendance, Assignments, Insights, Parent Reports, and a *second*, independently-tested promotion system at `lib/promotions/promote.ts`) actually reads and writes.

Both are alive simultaneously. Core was clearly meant to *replace* the school-administration slice of legacy, but three of its most structurally important capabilities — class/stream creation, teacher-to-class-and-subject allocation, and student promotion/transfer — are backend-complete and API-exposed with **zero UI**, and the product's own admin screen already renders them as inert "Future" placeholder tiles (`app/teacher/core-office/academic/page.tsx:347-350`). This is not a hidden gap; the codebase names its own gap.

The single largest operational blocker is not a missing feature — it's a **missing role model**. HOD, Principal, Deputy Principal, Registrar, and ICT Administrator do not exist as first-class identities anywhere. Principal and Deputy Principal are informally *mapped* onto `headteacher`/`deputy_headteacher` at seed time; Registrar has no analog at all. Because Core's authorization is a flat string-enum (no capability matrix, no department scoping), adding role *values* is mechanically cheap, but the department-scoped access an HOD needs has no existing pattern to extend — that part requires real design, not a migration.

**Timetable does not exist in any form** — no schema, no lib, no API, only a placeholder tile. It should not be Sprint 9's starting point (per the mission brief) and this audit confirms why: Class management, Subject allocation, and Teacher allocation — Timetable's own prerequisites — are themselves unfinished.

**Verdict:** CONDITIONAL GO for continued Core-schema investment; **NO-GO on building Timetable, HOD workflows, or any new operational feature** until the four Pilot-Blocker items in §8 are closed.

---

## 2. Operational Capability Inventory (Phase 1)

| Capability | DB | lib/ | API | UI reachable | Verdict |
|---|---|---|---|---|---|
| Class management (read) | ✅ `classes`/`streams` | ✅ `lib/core/classes.ts` | ✅ GET `/api/core/classes` | ✅ (core-admissions, core-term, attendance) | **Production ready** |
| Class management (create/edit) | ✅ | ✅ `createClass`/`createStream` | ✅ POST/PATCH | ❌ no caller | **Dormant** |
| Subject allocation | ✅ `class_subjects`/`grade_subjects` | ✅ `lib/core/subjects.ts` | ✅ full CRUD | ❌ zero callers anywhere | **Dormant** |
| Teacher allocation (to class+subject) | ✅ | ✅ `assignSubjectTeacher` | ✅ | ❌ zero callers | **Dormant** |
| HOD workflows | ❌ not in schema | ❌ | ❌ | ❌ | **Missing entirely** |
| Principal workflows | mapped to `headteacher` | ✅ `core-office/*` | ✅ | ✅ (admin-tier gated) | **Production ready, but role identity is a mapping, not real** |
| Admissions | ✅ `learner_enrollments` | ✅ `learnerOnboarding.ts` | ✅ | ✅ `core-admissions` | **Production ready** |
| Student promotion (Core) | ✅ `learner_promotions` | ✅ `lib/core/promotions.ts` | ✅ | ❌ rendered as `FutureModule` placeholder | **Dormant — self-labeled "future" by the product** |
| Student promotion (legacy) | legacy tables | ✅ `lib/promotions/promote.ts` | — | partially wired, tested | **Live, but a second, duplicate system** |
| Transfers | ✅ `learner_transfers` | ✅ `lib/core/transfers.ts` | ✅ | ❌ `FutureModule` placeholder | **Dormant** |
| School calendar (school-wide) | ❌ none | ❌ | ❌ | ❌ | **Missing entirely** (only class-scoped `class_calendar_events` exists) |
| Assessment publication (Core) | — | ✅ `publishAssessment` (`lib/core/assessments.ts`) | ✅ | ✅ `core-term` | **Production ready** |
| Report card publication | — | ✅ `lib/core/report-cards.ts` | ✅ | ✅ `core-term` | **Production ready, tested** |
| Academic approvals (multi-step sign-off) | ❌ | ❌ | ❌ | ❌ | **Missing entirely** — only a binary publish-gate exists, no HOD/Principal approval step |
| Term rollover | ✅ `academic_years`/`terms` | ✅ `endOfTerm.ts` | ✅ | ✅ `core-term` | **Production ready, tested** |
| User management | ✅ `school_users` | ✅ `teacherOnboarding.ts` | ✅ | ✅ `core-team` | **Production ready** (invite-to-school only, no allocation) |
| Roles & permissions | partial (see §4) | partial | partial | n/a | **Partial — 2 real roles missing (HOD, Registrar), enforcement scattered** |
| School notifications (broadcast) | ❌ | ❌ | ❌ | ❌ | **Missing entirely** (only class-level `class_announcements` + 1:1 WhatsApp exist) |
| Operational dashboards | ✅ `buildPrincipalDashboard()` exists | ✅ | ✅ `/api/school/intelligence` | ❌ no page renders it | **Dormant** (superseded in practice by `core-office`, which IS live) |
| Timetable | ❌ | ❌ | ❌ | `FutureModule` placeholder only | **Missing entirely** |

**Corrections to prior memory:** the 2026-07-13 Pilot Readiness finding "Principal dashboard, Core admin module all fully built, none reachable" is now **half-stale** — `core-office`/`core-team`/`core-admissions`/`core-term` ARE reachable (admin-tier nav-gated, `lib/config/teacherWorkspaceNav.ts:89-93`), shipped since that audit. `buildPrincipalDashboard()` itself, however, remains genuinely orphaned — it was superseded by `core-office` rather than ever getting its own UI.

---

## 3. Workflow Inventory (Phase 2)

| Role | Can do today | Manual/duplicate/broken |
|---|---|---|
| **Principal** (as `headteacher`) | View core-office academic/attendance summaries, invite staff, admit learners, run term lock→generate→publish | No timetable, no promotion/transfer button (placeholder tile), no approval step before publish — publish IS the approval |
| **Deputy Principal** | Same tier as Principal (`ADMIN_TIER_ROLES` treats both identically) | No distinct capability boundary from Principal at all — role exists in name only, not in permission scope |
| **HOD** | Nothing — role doesn't exist | Cannot be represented; any department-level workflow (subject allocation approval, department reporting) has no owner |
| **Registrar** | Nothing — role doesn't exist; admissions is currently done by whoever holds admin-tier | Admissions, the most registrar-shaped workflow in the product, has no registrar-scoped identity — any headteacher/deputy/school_admin can do it, which may be fine at pilot scale but has no ceiling |
| **Academic Office** | Overlaps entirely with `core-office/academic` (headteacher/deputy) | Same friction as HOD — no distinct identity, everything funnels through the 3 admin-tier roles |
| **Class Teacher** | Self-creates classes via legacy `teacher_classes`, shares a join code for self-enrollment | **Disconnected from Core**: a class a teacher creates in the legacy system is invisible to `core-office`/`core-admissions`/Core reporting — two parallel class universes exist simultaneously with no bridge for creation (only a read-side bridge exists for marks: `computeTermSummariesBridge.test.ts`) |
| **Subject Teacher** | Teaches via legacy classes; has zero path to be *allocated* to a Core class+subject by an admin | `assignSubjectTeacher` exists but nothing calls it — a Principal cannot actually assign a teacher to a subject through the UI today |
| **ICT Administrator** | Mapped informally onto `school_admin` at seed time only | No distinct capability from Principal/Deputy in practice |

**Sharpest workflow break:** class creation is bifurcated. A teacher creating their own class (legacy, self-serve, live) and a Principal creating a class through Core (backend exists, zero UI) are two unconnected paths. Nothing migrates a legacy-created class into Core, so `core-office`'s admin view of "the school's classes" will never actually reflect what teachers are really teaching, unless a teacher also happens to exist as a Core `school_users` row with a Core class independently created — which today, nobody can do through the UI.

---

## 4. Role Matrix (Phase 3)

Two parallel role systems exist, confirmed by direct grep — not a single unified model:

1. **`profiles.role`**: `teacher | parent | student` (+ an undeclared 4th value `admin` used only by platform-superadmin routes, not part of the typed `UserRole` union). Gates top-level dashboard routing only.
2. **`school_users.role`** (Core, CHECK-constrained): `school_admin | headteacher | deputy_headteacher | teacher | parent`. `ADMIN_TIER_ROLES = [school_admin, headteacher, deputy_headteacher]` is the only meaningful permission boundary — headteacher and deputy_headteacher are **not distinguished from each other anywhere in code**, confirmed by grep.

**Missing as first-class roles:** HOD, Principal (mapped→headteacher), Deputy Principal (mapped→deputy_headteacher), Registrar (no mapping at all), ICT Administrator (mapped→school_admin only in seed-script comments, not schema). "Class Teacher" exists only as a per-class FK (`classes.class_teacher_id`), not a role.

**Extensibility:** the mechanism is a flat string-enum + `.includes()` compare, duplicated across a Postgres CHECK constraint, a TypeScript union, an `ADMIN_TIER_ROLES` array, and inline role lists embedded directly in RLS policy SQL. Adding new role *values* (e.g., a literal `'hod'`) is mechanically cheap but touches 4+ places with no single source of truth. **Department-scoped access — the actual thing an HOD needs — has zero existing analog** in the current model (everything is school-scoped, nothing is department/subject-scoped). This is the one place in Sprint 9 that genuinely requires new design, not activation of existing code.

**RLS gap (real, found independent of the role question):** legacy `classes` and `schools` tables carry `"authenticated read"` policies with no school-scoping (`supabase/migrations/20260525_rls_policies.sql:136-138,195-197`) — any authenticated user can read every school's class/school rows. Core's equivalent tables (`learners`, `school_users`, `streams`) are correctly school-scoped. This is inconsistency between old and new schema, not a systemic hole.

---

## 5. Operational Blockers

Ranked by how directly they stop a school from running a real term:

1. **No department/HOD identity or scoping mechanism** — blocks any HOD workflow outright; needs design, not just a role-enum addition.
2. **Class creation and teacher/subject allocation have no UI on the Core side** — a Principal cannot actually build their school's class/subject/teacher structure through Core today; must rely on the disconnected legacy self-serve path.
3. **Two live, disconnected class universes** (legacy `teacher_classes` vs Core `classes`) with no creation-side bridge — Core's admin reporting cannot see what's really being taught.
4. **Two live promotion systems** (`lib/core/promotions.ts`, dormant/placeholder; `lib/promotions/promote.ts`, legacy, live and tested) — a school running promotion today is using the untested-by-Core, non-Core path.
5. **No school-wide calendar or broadcast notification system** — only class-scoped equivalents exist; a Principal has no way to publish a term calendar or a school-wide announcement.
6. **No multi-step academic approval workflow** — publish IS approval; no HOD/Principal sign-off gate exists before a report card goes out, despite Sprint 9's own domain list expecting one.
7. **Timetable does not exist**, and correctly should not be built yet — its prerequisites (2 and 3 above) are themselves unresolved.

---

## 6. Existing Modules Reused (confirmed reusable, do not rebuild)

- `lib/core/report-cards.ts` + `lib/core/endOfTerm.ts` — the full term-close pipeline is real, tested, and should be the backbone any new academic-approval step attaches to (insert a gate *before* `publishReportCards`, don't build a parallel one).
- `lib/core/permissions.ts` (`requireSchoolAdmin`, `requireClassTeacher`, `requireSchoolMembership`) — systematically tested (`permissions*.test.ts` family); any new role work should extend this, not create a second gate mechanism.
- `lib/config/teacherWorkspaceNav.ts` admin-tier gating pattern — already solves "show this nav item only to admin-tier staff"; the same pattern extends cleanly to a future HOD-tier if department scoping is designed.
- `lib/core/learnerOnboarding.ts` — transactional admission+guardian+enrollment pattern is the right template for any Registrar-specific workflow, should one be built.
- `lib/testing/httpAuthTestHelper.ts` — proven pattern (8 files use it for student/parent routes); should be applied to `/api/core/*` before any of those routes are exposed to more roles.

---

## 7. Duplicate Systems Identified

| Duplicate | Live/authoritative today | Orphaned twin |
|---|---|---|
| Class creation | Legacy `teacher_classes` (self-serve) | Core `createClass`/`createStream` (no UI) |
| Student promotion | Legacy `lib/promotions/promote.ts` (tested) | Core `lib/core/promotions.ts` (placeholder tile) |
| "Principal dashboard" | `app/teacher/core-office/*` (live) | `buildPrincipalDashboard()` / `/api/school/intelligence` (no UI, superseded in practice) |
| Report artifacts (per PRP-1 memory, re-verified) | `core-term`'s canonical `school_report_cards` pipeline and the parent-facing `/api/reports/report-card/mine` view of the *same* published data | **No longer a duplicate** — confirmed resolved; parent route reads Core's published output, not a competing PDF generator |

**Convergence recommendation:** Core should become authoritative for both class structure and promotion — not because legacy is wrong, but because Core is the only place school-administration semantics (streams, terms, guardians, multi-school readiness) exist at all. The blocker is UI, not architecture: build the missing create/allocate screens on Core, then plan a one-time migration of legacy `teacher_classes` into Core `classes`, rather than building a second admin surface on legacy.

---

## 8. Pilot-Critical Gaps (Phase 5 classification)

| Gap | Class |
|---|---|
| Academic-approval sign-off step before report-card publish | **Pilot Blocker** — Sprint 9's own domain list names this explicitly; currently absent |
| Core class-creation + `assignSubjectTeacher` UI | **Pilot Blocker** — without it, Core school-administration is unusable for real structure-building |
| Legacy↔Core class bridge (creation-side) | **Major** — not blocking a single school's term, but blocks Core ever becoming trustworthy admin data |
| Consolidate the two promotion systems onto one | **Major** |
| School-wide calendar | **Medium** |
| School-wide broadcast notifications | **Medium** |
| HOD identity + department scoping | **Architectural** — needs a design pass, not implementation |
| Registrar identity | **Quick Win** — if scoped as "just another admin-tier label with no new permission boundary," costs almost nothing; if scoped with real capability limits, becomes Architectural |
| Timetable | **Future Enhancement** — explicitly out of scope per mission brief; correctly gated behind items above |
| `/api/core/*` HTTP integration test coverage | **Quick Win**, should precede any of the above — pattern already exists (`httpAuthTestHelper.ts`), just unapplied |
| Legacy `classes`/`schools` RLS school-scoping gap | **Quick Win**, security-flavored — narrow, mechanical fix independent of everything else |

---

## 9. Risk Assessment (Phase 6)

- **Pilot readiness**: the tested academic-core loop (admissions→term-lock→publish) is trustworthy for a pilot school willing to operate class/subject/teacher structure through the legacy self-serve path. A school expecting to manage structure through `core-office` will hit dead UI (placeholder tiles) mid-term.
- **Authorization risk**: headteacher and deputy_headteacher being functionally identical is low risk at pilot scale (both are trusted staff) but should not be assumed to remain fine if Sprint 9 introduces HOD — department-scoped leakage (an HOD seeing another department's data) has no existing guard to reuse, must be built correctly from the start.
- **Data consistency**: the legacy/Core class split is the single largest consistency risk — any Core-side report that claims to describe "the school's classes" is incomplete by construction today.
- **Cross-school isolation**: solid on Core tables, confirmed weak on legacy `classes`/`schools` RLS (§4) — narrow, fixable, not urgent at current single-tenant-per-pilot scale but should not ship to multiple concurrent pilot schools unfixed.
- **Migration complexity**: consolidating legacy→Core classes is a real data migration (owns live Gradebook/Attendance/Assignments FKs) — should be scoped as its own dedicated sprint, not folded into a UI-building sprint.
- **Performance**: not assessed — no operational capability in this audit showed N+1 or unbounded query patterns; out of scope for this pass.

---

## 10. Recommended Sprint Order (Phase 5/6 synthesis)

1. **Sprint 9a (Quick Wins, do first):** apply `httpAuthTestHelper.ts` pattern to `/api/core/*` admin routes; fix legacy `classes`/`schools` RLS school-scoping gap. Both are narrow, mechanical, and de-risk everything after them.
2. **Sprint 9b (Pilot Blocker):** build the missing Core UI — class/stream creation, `assignSubjectTeacher` allocation screen. This is the highest-leverage single sprint: it turns Core school-administration from schema-complete-but-inert into actually usable.
3. **Sprint 9c (Pilot Blocker):** design and add a real academic-approval step (HOD/Principal sign-off) ahead of `publishReportCards` — reuse the existing publish-gate pattern, add a state, not a new pipeline.
4. **Sprint 9d (Major):** consolidate the two promotion systems onto `lib/core/promotions.ts`, retire the placeholder tile, migrate `lib/promotions/promote.ts` callers.
5. **Sprint 9e (Architectural, separately gated):** design department/HOD scoping — this is the one item in this whole audit that needs an ADR before any code, per Architecture Guardian Mode.
6. **Future:** school-wide calendar, school-wide notifications, Registrar identity, legacy→Core class data migration, Timetable (only after 9b-9d are stable).

---

## 11. Updated Platform Audit / 12. Completion Percentages

| Domain | Prior belief | Verified state | % complete (schema+backend / UI+reachable) |
|---|---|---|---|
| School admin core (admissions, term, report cards) | "fully built, none reachable" (stale) | Reachable, tested, live | **95% / 90%** |
| Class/subject/teacher structure management | assumed part of above | Backend 100%, UI 0% | **100% / 0%** |
| Promotion | "fully built, none reachable" | Core: 100%/0% (placeholder); Legacy: live but parallel | **Core 100%/0%, Legacy live-but-orphaned-from-Core** |
| Transfers | not previously audited | 100% / 0% | **100% / 0%** |
| Roles (HOD/Principal/Registrar) | "don't exist" (confirmed) | Principal/Deputy mapped, HOD/Registrar absent | **~30%** (mapping exists, real boundary doesn't) |
| Timetable | not previously audited | 0% | **0%** |
| School calendar/notifications (school-wide) | not previously audited | 0% (class-level substitute only) | **0%** |

---

## 13. Technical Debt Removed (identified, not yet acted on)

- `buildPrincipalDashboard()` / `/api/school/intelligence` — genuinely dead-in-practice, superseded by `core-office`; candidate for removal once confirmed no external caller depends on it.
- `app/teacher/core-readiness/page.tsx` — confirmed a harmless redirect shim to `core-office`, not dead code, no action needed.
- The parent-facing report-card "duplicate pipeline" concern from the PRP-1 memory is **resolved/was never real** in current code — safe to drop from future backlogs.

---

## 14. Architectural Opportunities (Phase 8)

- **Activate, don't build**: class-creation, subject-teacher allocation, promotion, and transfer UIs are all "wire an existing, tested-shape backend to a form" work, not new design — the fastest path to real operational value this sprint.
- **Remove**: `buildPrincipalDashboard()` is a strong removal candidate once one grep confirms zero remaining callers.
- **Reuse**: `lib/core/permissions.ts` and the admin-tier nav-gating pattern extend directly to any new role tier without new architecture — only department *scoping* (not role *existence*) needs new design.
- **Simplify School Core**: nothing found requires Core to become simpler — its gaps are missing UI, not excess complexity.
- **Simplify Teacher Workspace**: none found — ADR-0019's composition-layer model is holding; `core-office`/`core-team`/`core-admissions` sitting under `/teacher/*` remains a naming/location oddity (flagged in PRP-1) but not a functional problem worth resolving before the Pilot Blockers above.

---

## 15. Final Operational Readiness Verdict

**CONDITIONAL GO.**

A pilot school can run an academic term's assessment-to-report-card cycle today, using the legacy class/teaching path feeding into Core's term-lock/publish pipeline. It **cannot** yet be administered the way a real Headteacher expects — building class structure, allocating teachers to subjects, promoting/transferring students, or requiring sign-off before publication all currently dead-end at either a placeholder tile or an unreachable API. None of these are missing architecture; all are missing UI or missing design (HOD scoping only). Sprint 9 should not touch Timetable and should not introduce new intelligence features — it should finish activating what Core already built, close the one real approval gap, and design (not yet build) department scoping before any HOD feature is attempted.
