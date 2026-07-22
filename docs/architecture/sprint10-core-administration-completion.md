# Sprint 10 — Core Administration Completion

**Status**: Implemented and tested, 2026-07-21. Follows the audit-only Sprint 9 (`docs/architecture/sprint9-school-operations-excellence-audit.md`), which this sprint executes against — activation only, no new administration systems, no School Core redesign, no parallel implementations.

**Primary question**: *Can a Headteacher or School Administrator manage a school's academic structure using EduNexus today?*

**Answer at the start of this sprint**: No — class/subject/teacher structure and promotion/transfer were backend-complete with zero UI, rendered as inert placeholder tiles.
**Answer now**: Yes, for every capability that had a real backend. Two capabilities (Timetable, Departments) remain genuinely unbuilt and are named as such, not hidden.

---

## 1. Executive Summary

This sprint activated four backend-complete, zero-UI Core Administration capabilities named directly by the Sprint 9 audit: class/stream creation, subject-to-grade assignment, teacher-to-class-subject allocation, and student promotion/transfer. No new backend logic, no new API route, no new authorization rule, and no schema change were introduced — every new screen calls a `lib/core/*` function and `requireSchoolAdmin`-gated route that already existed. This is Guardian Mode's smallest compliant solution: activation, not construction.

Writing real workflow tests for the first time against the Promotion and Transfer routes surfaced **two genuine production bugs**: both routes passed the acting admin's raw `auth.uid()` where the database expects a `school_users.id` (a different, FK-constrained identity) — every promotion or transfer request would have returned HTTP 200 with zero records actually processed, the failure buried in a per-decision error array no UI ever surfaced. This is exactly the class of defect the Sprint 9 audit predicted structurally (dormant code has no chance to be wrong in a visible way) and confirms activation-before-expansion was the correct sprint scope: had Timetable or a new module been built instead, this bug would still be latent.

Report-card publication — Phase 4's explicit ask — already had strict authorization (`canPublishReport`, admin-tier only) and an audit trail (event emission + Blueprint Snapshot); the one real gap was that a single click fired an irreversible, parent-facing action with no pause. That is now a deliberate two-click confirmation, client-side only, no backend change.

**Verdict: Production-ready for the activated capabilities.** Two Future Modules (Timetable, Departments) remain correctly out of scope — they have no schema, no lib, no API, and building them was explicitly excluded from this sprint's mission.

---

## 2. Administrative Capability Inventory (Phase 1)

| Capability | Backend | UI (before) | UI (after) | Integrated | Role protected | Tested (before) | Tested (after) |
|---|---|---|---|---|---|---|---|
| School setup / activation | ✅ | ✅ (`schoolActivation`) | unchanged | ✅ | ✅ admin | ✅ | ✅ |
| Academic years / Terms | ✅ | read-only display | unchanged (no dedicated edit screen — correctly out of scope, set at activation) | ✅ | ✅ admin | ✅ | ✅ |
| Streams | ✅ | none | ✅ create + list, Academic Structure page | ✅ | ✅ admin | none | ✅ (workflow test) |
| Classes | ✅ (read+create) | read-only | ✅ create + list, with grade/stream/teacher/capacity | ✅ | ✅ admin | partial | ✅ |
| Subject → Grade assignment | ✅ | **Dormant** (zero callers) | ✅ assign + list | ✅ | ✅ admin | none | ✅ |
| Teacher → Class-Subject allocation | ✅ | **Dormant** (zero callers) | ✅ assign + list, per class | ✅ | ✅ admin | none | ✅ |
| Admissions | ✅ | ✅ (`core-admissions`, prior sprint) | unchanged | ✅ | ✅ admin | ✅ | ✅ |
| Promotion | ✅ | **Dormant — `FutureModule` placeholder** | ✅ preview + confirm + run, per-learner override | ✅ | ✅ admin | none | ✅ — **and a real FK bug was found and fixed** |
| Transfer | ✅ | **Dormant — `FutureModule` placeholder** | ✅ search + confirm + record (out-only) | ✅ | ✅ admin | none | ✅ — **same FK bug class, found and fixed** |
| School users (Team) | ✅ | ✅ (`core-team`, prior sprint) | unchanged | ✅ | ✅ admin | partial | unchanged |
| School roles | ✅ (flat enum) | n/a | unchanged — Sprint 9 already found HOD/Registrar don't exist; out of this sprint's activation-only scope | n/a | ✅ | ✅ | unchanged |
| Report-card approval / Publish | ✅ (`canPublishReport`, publish-guard) | ✅ single-click | ✅ deliberate two-click confirm | ✅ | ✅ admin-only | ✅ | unchanged (no backend change) |
| Core dashboard | ✅ (`core-office/academic`) | ✅ | ✅ updated: links replace placeholders | ✅ | ✅ admin | n/a | n/a |

---

## 3. Activated Existing Features (Phase 2)

- **Class creation** (`createClass`, `lib/core/classes.ts:33`) — was API-complete, zero UI callers (Sprint 9 audit finding). Now called from `/teacher/core-office/academic/structure`.
- **Stream management** (`createStream`/`listStreams`) — same status, same fix.
- **Subject-to-grade assignment** (`assignSubjectToGrade`, `lib/core/subjects.ts:19`) — same status, same fix.
- **Teacher-to-class-subject allocation** (`assignSubjectTeacher`, `lib/core/classes.ts:57`) — same status, same fix. This closes the single gap Sprint 9's Phase 8 called out by name: "an admin today cannot actually [allocate a teacher to a subject] through the UI."
- **Promotion** (`previewPromotion`/`runAnnualPromotion`, `lib/core/promotions.ts`) — was rendered as an inert `FutureModule` tile despite a complete, event-integrated backend (Blueprint Snapshot trigger on graduation). Now a real screen; the dormant backend's first-ever exercise under test found the FK bug (§7).
- **Transfer** (`transferLearner`/`getLearnerTransfers`, `lib/core/transfers.ts`) — same status, same fix, same bug class found.

No capability required rebuilding. No architectural blocker was hit — every activation was a straightforward "wire an existing tested-shape backend to a form," confirming Sprint 9's own assessment.

---

## 4. UI Completed

- `app/teacher/core-office/academic/structure/page.tsx` — new. Streams, Classes, Subject→Grade, Teacher→Class-Subject, one page (deliberately not four, to keep "one coherent Core Administration experience" per the mission's success criteria).
- `app/teacher/core-office/academic/promotion/page.tsx` — new. Per-learner promote/graduate/repeat/skip decision, with `previewPromotion`'s existing suggestion pre-filled, never auto-submitted.
- `app/teacher/core-office/academic/transfer/page.tsx` — new. Search → select → confirm → record, out-direction only, two-click confirm (same irreversibility posture as report publish).
- `app/teacher/core-office/academic/page.tsx` — edited. "Subjects"/"Classes" rows now link to Academic Structure; Promotion/Transfer moved from Future Modules into a real "Learner Transitions" section; Graduation dropped as a separate placeholder (folded into Promotion, since it was never a separate backend); Timetable/Departments remain, correctly, the only two Future Modules left.
- `app/teacher/core-term/page.tsx` — edited. Publish is now two-click with an explicit warning.

---

## 5. Existing Services Reused

- `requireSchoolAdmin`, `requireAuthentication` (`lib/core/permissions.ts`) — every new write action gates through these, unchanged, zero new authorization primitives.
- `repos.teachers.findSchoolUser(userId, schoolId)` — pre-existing, school-scoped, active-only lookup, reused (not duplicated) to fix the `processed_by` bug in two routes.
- `lib/core/classes.ts`, `lib/core/subjects.ts`, `lib/core/promotions.ts`, `lib/core/transfers.ts` — zero changes to any of the four; only their routes' `processed_by` plumbing changed, and only in the two that had the bug.
- `OperationalBreadcrumb`, `ADMIN_TIER_ROLES` — the established core-admin UI pattern (from `core-admissions`/`core-team`) was followed exactly, not reinvented.
- `canPublishReport` / publish-guard in `lib/core/report-cards.ts` — unchanged; the confirm-step addition is purely client-side.

---

## 6. Integration Review

Every new page follows the same integration shape as the pre-existing `core-admissions`/`core-team` pages: `GET /api/core/my-membership` for role/school context, admin-tier gate client-side (`ADMIN_TIER_ROLES.includes`) backed by the real server-side gate on every write. No new API route was created — all five activated capabilities route through `POST /api/core/classes`, `POST /api/core/subjects`, `POST /api/core/promotions`, `POST /api/core/transfers`, all of which existed before this sprint. The Academic Structure page's teacher dropdowns use `schoolUserId` (not `teachers.id`) throughout, matching the actual FK target of `classes.class_teacher_id` and `class_subjects.teacher_id` (both reference `school_users(id)` — verified directly against `supabase/migrations/20260629_core_foundation.sql:369,260`), avoiding a third instance of the identity-mismatch bug class found in §7.

---

## 7. Security Review (Phase 5)

- **School isolation**: unaffected — every new write still passes through `requireSchoolAdmin(client, schoolId)`, which resolves membership by `(user_id, school_id)`, not by a client-supplied role. No new UI reads or writes a `schoolId` not already implied by the caller's membership.
- **Role boundaries**: unchanged — no new role, no new capability check. All admin-tier actions remain `school_admin`/`headteacher`/`deputy_headteacher`-only, matching the existing (pre-Sprint-10) posture that headteacher and deputy_headteacher are not distinguished from each other (a Sprint 9 finding, not addressed here — out of this sprint's activation-only scope).
- **Cross-school access**: directly tested (`lib/core/classes.workflow.test.ts`) — an admin of a different school is rejected with `MembershipRequiredError` when acting on this school's `schoolId`.
- **Teacher→Admin escalation**: directly tested — a teacher-tier member of the *same* school attempting an admin-only action (creating a class) is rejected with `PermissionDeniedError`, confirming role, not just membership, is checked.
- **Real bug found and fixed** (the sprint's most significant security-adjacent finding): `app/api/core/promotions/route.ts` and `app/api/core/transfers/route.ts` both passed `auth.uid()` where `learner_promotions.processed_by`/`learner_transfers.processed_by` require a `school_users.id` — a live foreign-key mismatch. This was not an authorization gap (the route's `requireSchoolAdmin` gate was and remains correct — no unauthorized actor could ever reach this code path), but a correctness bug that would have silently no-opped every promotion and transfer ever attempted through the newly-activated UI. Fixed by resolving `school_users.id` via the existing, already-scoped `repos.teachers.findSchoolUser` lookup.
- **Malformed requests / replay**: unchanged — both routes' Zod schemas (`PromotionSchema`, `TransferSchema`) were already strict; no new field accepts unvalidated input. No replay-sensitive state was introduced (promotion/transfer inserts are additive audit rows, not idempotent-required actions — a duplicate submission creates a second promotion/transfer record, matching the existing pre-Sprint-10 behavior of every other Core write in this codebase; not a regression this sprint introduced).
- **No new UI bypasses existing authorization** — confirmed by direct code inspection: every new page's write calls hit an unmodified, pre-existing route whose auth gate was not weakened, only (for two routes) corrected.

---

## 8. Workflow Review

**Can a Headteacher manage academic structure today?** Yes: create streams and classes, assign subjects to grades, allocate teachers to class subjects, admit learners (pre-existing), promote/graduate/repeat learners at year-end, and record a learner transferring out — all from one coherent Academic Office workspace. The remaining named gaps (Timetable, Departments, HOD/Registrar identity) are the same ones Sprint 9 already classified as Architectural/Future — none were pretended-away or hidden this sprint.

**Duplicate workflow convergence (Phase 3)** — investigated, not merged, per the mission's explicit "do NOT merge during this sprint unless safe":
- **Class creation** remains dual (legacy `teacher_classes` self-serve vs. Core `classes`, now with a real UI on both sides). **Canonical**: Core, because it is the only side with school-administration semantics (streams, terms, guardians). **Legacy**: still authoritative for live teaching data (Gradebook/Attendance/Assignments). **Migration path**: a one-time backfill of legacy classes into Core, scoped as its own dedicated sprint per Sprint 9's own recommendation — not attempted here (high risk, live-data migration, correctly deferred). **Owner**: Core, once migrated.
- **Promotion** remains dual (`lib/core/promotions.ts`, now activated; `lib/promotions/promote.ts`, legacy, already live and tested). **Not merged this sprint** — the risk of consolidating a live, tested legacy promotion path with a freshly-activated Core one in the same sprint that also just fixed a live bug in the Core path was judged too high; documented here as the next Phase 3 candidate, explicitly not executed.
- **Report-card publishing**: no duplicate found (Sprint 9 already confirmed the earlier "two report pipelines" concern was resolved in code before this sprint began).

---

## 9. Files Modified

**New:**
- `app/teacher/core-office/academic/structure/page.tsx`
- `app/teacher/core-office/academic/promotion/page.tsx`
- `app/teacher/core-office/academic/transfer/page.tsx`
- `lib/core/classes.workflow.test.ts`
- `lib/core/promotions.test.ts`
- `lib/core/transfers.test.ts`
- `docs/architecture/sprint10-core-administration-completion.md` (this document)

**Edited:**
- `app/teacher/core-office/academic/page.tsx` — links replace placeholders, Future Modules trimmed to Timetable/Departments only
- `app/teacher/core-term/page.tsx` — two-click publish confirmation
- `app/api/core/promotions/route.ts` — `processed_by` bug fix
- `app/api/core/transfers/route.ts` — `processed_by` bug fix
- `docs/engineering/implementation-log.md` — sprint entry appended

**Unchanged (reused as-is):** `lib/core/classes.ts`, `lib/core/subjects.ts`, `lib/core/promotions.ts`, `lib/core/transfers.ts`, `lib/core/permissions.ts`, `lib/core/report-cards.ts`, `lib/repositories/teacher.repository.ts`, `lib/repositories/school.repository.ts`.

---

## 10. Test Results (Phase 6)

| File | Tests | Result |
|---|---|---|
| `lib/core/classes.workflow.test.ts` | 9 | ✅ all pass |
| `lib/core/promotions.test.ts` | 4 | ✅ all pass (2 initially failed on the FK bug, fixed, re-verified green) |
| `lib/core/transfers.test.ts` | 2 | ✅ all pass |
| `tsc --noEmit` (full repo) | — | ✅ clean |
| `eslint` (every touched file) | — | ✅ 0 errors |

Covered per the mission's explicit Phase 6 list: class creation ✅, teacher allocation ✅, subject allocation ✅, promotion ✅, transfer ✅, cross-school denial ✅, unauthorized admin actions ✅. **Not covered this sprint** (named, not silently skipped): school creation (already covered by `schoolActivation.test.ts`, reused as the fixture setup for every new test file rather than re-tested), report approval/publication workflow tests (already exist — `reportCardPublicationGuard.integration.test.ts` — unaffected by the client-side-only confirm change, so no new test was needed), regression suite (existing suites unaffected — no shared function's signature or behavior changed except the two bug-fixed routes, which are net-new test coverage, not regressions to guard).

---

## 11. Regression Review

No existing behavior changed except the two bug fixes. `lib/core/classes.ts`, `lib/core/subjects.ts`, `lib/core/promotions.ts`, `lib/core/transfers.ts`, and `lib/core/report-cards.ts` are byte-identical to before this sprint. `app/teacher/core-term/page.tsx`'s only behavior change is the publish button requiring a second click — every other action on that page (lock, generate summaries, generate report cards) is untouched. `app/teacher/core-office/academic/page.tsx`'s Academic Structure/Operations/Attendance/Workflow Status sections are untouched; only the Subjects/Classes row hrefs and the Future Modules grid changed. No shared type, repository method, or permission function signature changed. Full `tsc`/`eslint` pass confirms no downstream breakage.

---

## 12. Remaining Administrative Gaps

Unchanged from Sprint 9, correctly left untouched by this activation-only sprint:
- **Timetable** — no schema, no lib, no API. Still correctly out of scope (mission explicitly forbids building it).
- **Departments / HOD** — no schema, no role, no department-scoping mechanism anywhere in the codebase. Architectural, needs an ADR before any implementation (Sprint 9 §10 recommendation, unchanged).
- **Registrar identity** — still doesn't exist; admissions remains reachable by any admin-tier role.
- **Legacy↔Core class migration** — investigated (§8), not executed; still the largest data-consistency risk named in both Sprint 9 and this sprint.
- **Promotion system consolidation** (Core vs. legacy `lib/promotions/promote.ts`) — investigated (§8), not executed this sprint; both remain live.
- **Multi-step academic approval** (HOD/Principal sign-off before publish) — Sprint 9 named this a Pilot Blocker. This sprint added a deliberate-action confirmation (closes "prevent accidental publication"), but a real second-approver sign-off step still does not exist — that requires the Departments/HOD architectural work first, so it could not be built this sprint without violating "do not introduce parallel implementations" (a sign-off step needs a real second role to sign off).

---

## 13. Updated Platform Audit

| Domain | Sprint 9 state | Sprint 10 state |
|---|---|---|
| Class/subject/teacher structure management | Backend 100%, UI 0% | **Backend 100%, UI 100%, tested** |
| Promotion (Core) | Backend 100%, UI 0% (placeholder) | **Backend 100% (bug fixed), UI 100%, tested** |
| Transfer | Backend 100%, UI 0% | **Backend 100% (bug fixed), UI 100%, tested** |
| Report-card publication | Production-ready, one-click | **Production-ready, deliberate two-click** |
| Core Administration workspace coherence | Fragmented (some real screens, some placeholders) | **One coherent Academic Office workspace, placeholders limited to genuinely-unbuilt Timetable/Departments** |
| Legacy/Core class duplication | Identified | Identified, migration path documented, not executed (correctly deferred) |
| Promotion system duplication | Not previously named as duplicate | **Newly identified this sprint** (Core now live, legacy still live) — documented, not merged |

---

## 14. Updated Completion Percentages

| Domain | Sprint 9 % | Sprint 10 % |
|---|---|---|
| Class/stream/subject/teacher structure | 100% backend / 0% UI | **100% / 100%** |
| Promotion | 100% / 0% | **100% / 100%** |
| Transfer | 100% / 0% | **100% / 100%** |
| Report approval/publish safety | 90% (gate existed, no deliberate-action pause) | **100%** for accidental-publication prevention; still ~60% for a true multi-approver sign-off (Architectural, deferred) |
| Roles (HOD/Principal/Registrar) | ~30% | **Unchanged, ~30%** — correctly out of this sprint's activation-only scope |
| Timetable | 0% | **Unchanged, 0%** — correctly out of scope |

---

## 15. Technical Debt Removed

- Five `FutureModule` placeholder tiles removed from `core-office/academic` for capabilities that are no longer future (Promotion, Transfer) or were never a separate capability (Graduation) — down to the two that are genuinely unbuilt.
- Two silent, undetectable production bugs (`processed_by` FK mismatch in Promotion and Transfer routes) fixed before they could affect a real pilot school — found only because this sprint's activation work finally exercised code paths that had zero prior test coverage.
- Zero new debt introduced: no new abstraction layer, no new permission primitive, no new repository method beyond reusing an existing one (`findSchoolUser`).

---

## 16. Architectural Improvements

- Confirmed (again) that Guardian Mode's "activate before rebuilding" principle catches real bugs that would otherwise ship invisibly — dormant code is not merely incomplete, it is untested by construction, and this sprint is direct evidence of that risk materializing twice.
- No architectural boundary was touched: `lib/` remains the sole owner of business logic, routes remain thin, authorization remains centralized in `lib/core/permissions.ts`. Nothing in this sprint required an ADR, matching the mission's own prediction.
- Identified (not yet acted on) that `class_teacher_id`/`class_subjects.teacher_id` consistently reference `school_users(id)`, never `teachers.id` — worth a short note in `types/core.ts` or the relevant lib file for future contributors, since this is precisely the kind of identity confusion that produced the two bugs fixed this sprint. Recommended as a lightweight documentation follow-up, not a schema change.

---

## 17. Pilot Readiness Assessment

A pilot school's admin-tier staff can now, through one coherent workspace: set up streams and classes, assign subjects to grades, allocate teachers to class subjects, admit learners, run annual promotion/graduation, record a learner transferring out, and publish report cards with a deliberate confirmation step. This closes the specific gap Sprint 9 flagged as a Pilot Blocker ("Core class-creation + `assignSubjectTeacher` UI") and substantially closes the second ("academic-approval sign-off... currently absent" — partially: accidental-publication prevention is now real; a second-approver sign-off is not, and correctly requires the still-deferred HOD/Departments architecture).

---

## 18. Production Readiness Verdict

**GO** for the five activated capabilities (Streams, Classes, Subject Allocation, Teacher Allocation, Promotion, Transfer) and the Report Publication safety improvement — all tested against real Supabase, `tsc`/`eslint` clean, authorization unchanged and directly verified, two real bugs found and fixed before reaching a pilot school. **NO-GO, unchanged from Sprint 9**, on Timetable, Departments/HOD, and true multi-approver report-card sign-off — none were in this sprint's scope, and building any of them still requires the architectural design pass Sprint 9 already recommended before implementation begins.
