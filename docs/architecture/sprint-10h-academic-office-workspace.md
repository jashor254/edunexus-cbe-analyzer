# Sprint 10H — Academic Office Workspace

**Status:** Phase 1 (inventory) and Phase 2 (UI composition) complete, scoped strictly to UI composition per explicit user instruction — no architectural cleanup performed. Phases 3–8 folded into Phase 2's execution below (the "one canonical entry" and "future module placeholder" work was delivered as part of the same commit set).

**Mission:** Sprint 10G activated the School Office and correctly routed `school_admin`/`headteacher`/`deputy_headteacher` into the administrative workspace. Sprint 10H organizes the academic administration layer inside that workspace — information architecture and workflow composition only, no new business logic.

---

## Phase 1 — Full Inventory

### A) Capability Classification

| # | Capability | Classification | Backend (`lib/core/`) | API route | UI | Entry point(s) |
|---|---|---|---|---|---|---|
| 1 | School Structure (one-shot activation: year/terms/grades/streams/classes/settings) | Already Implemented | `schoolActivation.ts:407` `activateSchool()` | `POST /api/core/school` | `app/admin/core-schools/new/page.tsx` | `app/admin/page.tsx:244` (hardcoded-email gate). No re-run/edit-structure screen. |
| 2 | Academic Years | API only (read surfaced, no create/edit UI) | `resolveActiveAcademicYear` (`academicActivation.ts:50`) | `GET`+`POST /api/core/academic-years` (POST has zero UI caller) | Read-only list | `core-office/page.tsx:162` ("Academic Structure" section) |
| 3 | Terms | API only, no dedicated UI | `resolveActiveTerm` (`academicActivation.ts:57`) | folded into `academic-years` route | None dedicated — read via `/api/core/my-membership` | No entry point to open/close/create a term |
| 4 | Subjects | API only, zero UI caller | `lib/core/subjects.ts` | `GET`+`POST /api/core/subjects` | **None** (confirmed by grep) | No entry point |
| 5 | Grades | Read-only surface, no dedicated CRUD | readiness counts in `academicActivation.ts:90` | none dedicated | stat display only | `core-office/page.tsx:238` |
| 6 | Streams | Backend only, no API/UI surface | implicit in activation chain | none | none | No entry point |
| 7 | Classes | API + read-only UI (list/picker), no create/edit UI | `lib/core/classes.ts` | `GET`+`POST /api/core/classes` (POST unused) | GET-only picker | `core-term/page.tsx:77`, `core-admissions/page.tsx:80` |
| 8 | Teacher Assignment (teacher ↔ class/subject) | Absent / Future | none distinct from invitation; subject/grades set at accept-time only | n/a | n/a | No admin screen assigns a teacher to a specific class/subject |
| 9 | Assessment Publication | Already Implemented, UI exists | `lib/core/assessments.ts` | `POST /api/core/assessments` `action:'publish'` | "Lock" button, `core-term/page.tsx:126-133` | via School Office → Assessments card → `/teacher/core-term` |
| 10 | Assessment Locking | Same as #9 — "publish" action *is* the lock (button label "Lock") | same | same | same | same |
| 11 | Assessment Progress | Already Implemented, UI exists | `fetchClassTermStatuses()` (`lib/core/client/termStatus.ts`) | consumes `/api/core/assessments` view=summary | `core-term/status/page.tsx` (per-class pills) | `/teacher/core-term/status`, rolled up on School Office |
| 12 | Report Generation | Already Implemented, UI exists | `lib/core/report-cards.ts` | `POST /api/core/reports` (generate) | button, `core-term/page.tsx:144-151` | `/teacher/core-term` |
| 13 | Report Publication | Already Implemented, UI exists | `lib/core/report-cards.ts` | `POST /api/core/reports` `action:'publish'` | button, `core-term/page.tsx:153-160` | `/teacher/core-term` — publishing does not notify anyone (no call sites for report notify) |
| 14 | End-of-Term (composite workflow) | Already Implemented, UI exists, nav-linked | orchestrates #9/#11/#12/#13 | `/api/core/{assessments,reports}` — note `app/api/core/school/end-of-term/route.ts` is a **separate, uncalled route**, see §C | `core-term/page.tsx` + `.../status/page.tsx` | Both `TeacherSidebar.tsx:30` and `TeacherBottomNav.tsx:33` ("End of Term"), plus School Office card |
| 15 | Promotion | Backend Only, confirmed dead end | `lib/core/promotions.ts`: `runAnnualPromotion`, `previewPromotion`, `getLearnerPromotionHistory` | `GET`+`POST /api/core/promotions` — zero `.tsx` callers | **None** | No entry point |
| 16 | Transfer | Backend Only, confirmed dead end | `lib/core/transfers.ts`: `transferLearner`, `getLearnerTransfers` | `GET`+`POST /api/core/transfers` — zero `.tsx` callers | **None** | No entry point |
| 17 | Graduation | Not a distinct concept — a `promotion_type` value | inside `runAnnualPromotion` (`promotion_type === 'graduated'` branch) | same route as Promotion | **None** | No separate stub exists; architecturally just a branch of the (also dead) promotion flow |

**Corrections to prior sprint docs (10B/10C/10D said these had zero UI — no longer true as of 10E–10G):**
- **Teacher Invitation** now has a real screen: `app/teacher/core-team/page.tsx`, reached via School Office "Teachers" card.
- **Learner Admission/Enrollment** now has a real screen: `app/teacher/core-admissions/page.tsx`, reached via School Office "Learners" card.
- **School Academic Readiness** now has a route (`app/api/core/academic-readiness/route.ts`) and a UI (startup checklist on `core-office/page.tsx:258-295`).
- **The hub page** `core-readiness/page.tsx` was renamed to `core-office/page.tsx` (10G); the old path now redirects — no dead link.
- **Nav**: "School Office" is in both `TeacherSidebar.tsx:34` and `TeacherBottomNav.tsx:37`, gated by `isAdminTier` threaded from `app/teacher/layout.tsx`.

### B) Orphan pages (reachable by URL, in no nav or hub)
- `app/admin/cleanup/page.tsx` — zero inbound links.
- `app/teacher/insights/page.tsx` — zero inbound links; legacy `teacher_classes`-backed analytics, explicitly scoped out of the Core chain.
- `app/(parent)/career-report/page.tsx` — superseded by `career-intelligence-report`.
- **No distinct Headteacher/"Academic Office" route tree exists** — School Office lives inside `app/teacher/*`, not a separate top-level surface. `buildPrincipalDashboard()` (`lib/school/intelligence.ts`) + `app/api/school/intelligence/route.ts` remain fully built with zero consumers — the single largest open gap, untouched by 10E–10G (which explicitly scoped to Core School/Teacher/Learner only).

### C) Duplicate / superseded entry points
- **`app/api/core/school/end-of-term/route.ts`** vs. the real flow's actual routes (`/api/core/assessments`, `/api/core/reports`): the former has zero callers anywhere; the live UI calls the latter two directly. Flagged since 10D, still unresolved.
- **Three separate copies of the admin-tier role array** (already documented in 10G's own "technical debt discovered" section): `teacher.repository.ts`'s `isSchoolAdmin()`, `lib/core/permissions.ts`'s `SCHOOL_ADMIN_ROLES`, `lib/core/adminTierRoles.ts`'s `ADMIN_TIER_ROLES` — values identical, not contradictory, not yet consolidated.
- `app/api/admin/teachers/route.ts` vs. `app/api/core/teachers?list=true` (the one `core-team` actually uses) — the former appears to be an uncalled duplicate-intent route.

### D) Dependency graph

```
School Structure (activateSchool)
  └─▶ Academic Year ──▶ Terms
                          └─▶ Classes (needs Grades/Streams resolved)
                                └─▶ Teacher Assignment (needs Classes + Subjects)
                                └─▶ Subjects (needs Grades in use)
                                └─▶ Learner Admission/Enrollment (needs a Class + current Term)
                                      └─▶ Assessment Publication/Locking (per class, per term)
                                            └─▶ Assessment Progress tracking (reads lock state)
                                                  └─▶ Report Generation (needs locked assessments + summaries)
                                                        └─▶ Report Publication
                                                              └─▶ End-of-Term (= the above 4 steps as one guided flow)

Promotion / Transfer / Graduation depend on Academic Year (to/from), Class (to/from), Learner —
but do NOT depend on End-of-Term being wired to a screen. Backend-complete, independently
dead-ended; reservable as Phase 5 placeholders without touching the chain above.
```

### E) Existing status/readiness functions (reuse only — none new for Phase 4)
- **`getSchoolAcademicReadiness(schoolId)`** — `academicActivation.ts:223` — school-wide rollup (activation status, resolved year/term, grade/class counts, subject/teacher/learner readiness booleans + reasons, `overallReady`, `blockingReasons[]`). Wrapped by `GET /api/core/academic-readiness`. Already the School Office checklist's data source.
- **`getSchoolTeacherReadiness(schoolId)`** — `academicActivation.ts:133`.
- **`getSchoolLearnerReadiness(classes, termId)`** — `academicActivation.ts:170`.
- **`resolveSubjectReadiness(schoolId, classes)`** — `academicActivation.ts:90`.
- **`fetchClassTermStatuses(schoolId, currentTerm)`** — `lib/core/client/termStatus.ts` — the canonical per-class `{assessmentState, reportState}` computation, used by both `core-term/status` and `core-office`. **Do not reimplement.**
- **`getTeacherReadiness(userId, schoolId)`** — `lib/core/teacherOnboarding.ts`.
- **`buildPrincipalDashboard(schoolId)`** — `lib/school/intelligence.ts` — real, tested, zero consumers; natural home for any future Headteacher-scoped rollup, not something to recompute here.
- Nothing computes a school-wide "Assessment Ready" aggregate — deliberately omitted per `core-office/page.tsx`'s own header comment. Building one would be new business logic outside this sprint's composition-only scope.

---

## Architecture Guardian + Phase B Assessment (for Phases 2–8)

### 1. Architectural Assessment
- **Affected canonical domains:** Schools, Classes, Subjects, Assessments, Report Cards (per `canonical-domain-registry.md`). No Learner/Guardian/Evidence/Intelligence domains touched.
- **Constitutional compliance:** Compliant as scoped. Sprint brief forbids new business logic, repositories, orchestration, tables, migrations, roles, permissions — matches Constitution Articles on service-layer/repository discipline.
- **RAS compliance:** Compliant. This is pure UI composition (navigation + reuse of existing `lib/core/` reads), the RAS's "compose, don't duplicate" principle for the Core domain.
- **ADR required?** No — no canonical identity, ownership, layer, Intelligence boundary, repository, security, or migration change. Purely a navigation/IA change inside an existing route tree (`app/teacher/core-office/`).

### 2. Engineering Assessment
- **Files likely affected:** `app/teacher/core-office/page.tsx` (reorganize the existing cards into the Structure→Year→Terms→Subjects→Classes→Progress→Lock→End-of-Term→Report Gen→Report Publish flow), possibly a small new sub-route grouping (e.g. `app/teacher/core-office/academic/page.tsx`) that **renders existing components/links** — no new pages duplicating `core-term`, `core-team`, `core-admissions`.
- **Repositories affected:** None — no repository code changes.
- **Services affected:** None — no `lib/core/*` logic changes; only import/route existing readiness reads.
- **API routes affected:** None new. Existing `academic-readiness`, `assessments`, `reports` GETs are called for status display only.
- **Database impact:** None.
- **Security impact:** None — same `isAdminTier`/School Office gating already enforced in `app/teacher/layout.tsx`; no new roles or permission checks.
- **Testing impact:** Regression tests for nav (no duplicate routes/links), existing lint/typecheck.
- **Deployment risk:** Low — additive navigation reorganization, reversible by reverting the page/nav diff.
- **Backward compatibility:** Preserved — `/teacher/core-term`, `/teacher/core-team`, `/teacher/core-admissions` keep working as direct URLs; only entry-point discoverability changes.

### 3. Implementation Plan (for Phases 2–8, pending approval)
1. **Commit 1** — Add an "Academic Office" section/tab inside `core-office/page.tsx` that groups the existing cards (Structure/Year/Terms/Subjects/Classes/Progress/Lock/End-of-Term/Reports) in the specified order, linking to existing pages only. No new business logic.
2. **Commit 2** — Add "Coming soon" reserved placeholders for Promotion, Transfer, Graduation, Timetable, Departments, Attendance — clearly labelled, non-functional, no click-through.
3. **Commit 3** — Remove/redirect any confirmed duplicate nav entries found in §C (subject to re-confirming no hidden callers before touching `end-of-term/route.ts` or the admin-tier duplicates — these may be left alone if out of scope for pure IA work).
4. **Commit 4** — Regression tests: nav renders once per item, no duplicate routes, teacher (non-admin-tier) workflow unchanged, School Office auth gating unchanged.
5. **Commit 5** — Update `docs/engineering/implementation-log.md` and finalize this doc's Phases 2–8 sections with what actually shipped.

### 4. Risks
- **Architectural:** Low — no domain/identity change.
- **Business:** Low — reorganization only; report-publish-doesn't-notify gap (found above) is pre-existing and out of scope unless the user wants it flagged for a future sprint.
- **Migration:** None.
- **Security:** None — reusing existing gate.
- **Performance:** Negligible — same reads, no new queries added, no loops.

### 5. Approval
✅ **Safe to Implement** as scoped (pure composition/navigation, Phases 2, 3 partial, 4 read-only, 5, 6). Recommend explicitly deferring the `end-of-term/route.ts` dead-route removal and the 3-copy admin-tier-role consolidation to a separate cleanup sprint — touching either is a step beyond "compose existing modules," even though low-risk, and the sprint brief says stop and report before any architectural change.

---

## Phase 2 — Implementation (delivered)

Scope confirmed by the user's Phase 2 instruction: UI composition and navigation only, no architectural cleanup — `end-of-term/route.ts` and the `ADMIN_TIER_ROLES` duplication explicitly left untouched, as recommended above.

### Files touched
- **New**: `app/teacher/core-office/academic/page.tsx` — the Academic Office screen.
- **Edited**: `app/teacher/core-office/page.tsx` — removed the "Classes"/"Assessments"/"End of Term" `WorkflowCard`s and the inline "Academic Structure" section (and their now-unused `academicYears` fetch/state), replaced with a single "Academic Office" card linking to the new page.
- **Edited**: `components/core/OperationalBreadcrumb.tsx` — added an optional `parent: { label, href }` prop (backward compatible; every existing call site with no `parent` renders exactly as before).
- **Edited**: `app/teacher/core-term/page.tsx`, `app/teacher/core-term/status/page.tsx` — breadcrumb now reads "School Office › Academic Office › <page>".

### Screens reused (zero new pages beyond the one Academic Office section, zero new API routes, zero new `lib/core/` functions)
- `/teacher/core-team` (Teachers — unchanged, still linked directly from School Office, not part of Academic Office scope)
- `/teacher/core-admissions` (Learners — unchanged, same reasoning)
- `/teacher/core-term` (Assessment Lock, End of Term, Report Generation, Report Publication — all four already live as buttons on this one screen; Academic Office links to it once, not four times)
- `/teacher/core-term/status` (Assessment Progress)
- `/api/core/academic-readiness` → `getSchoolAcademicReadiness()` (Academic Structure status, Workflow Status)
- `/api/core/academic-years` (Academic Years/Terms display — read-only, matches Phase 1 finding that no create/edit UI exists)
- `lib/core/client/termStatus.ts`'s `fetchClassTermStatuses()` (Academic Operations, Workflow Status)

### Workflow map (as implemented)
```
School Office
  └─▶ Academic Office (app/teacher/core-office/academic)
        ├─ Academic Structure — Years / Terms / Subjects / Classes (status only; no dedicated CRUD UI exists)
        ├─ Academic Operations
        │    ├─ Assessment Progress ──▶ /teacher/core-term/status
        │    └─ Assessment Lock → End of Term → Report Generation → Report Publication ──▶ /teacher/core-term (one link)
        ├─ Workflow Status — Completed / Needs Attention / Next Step (from getSchoolAcademicReadiness + fetchClassTermStatuses only)
        └─ Future Modules — Promotion / Transfer / Graduation / Timetable / Departments / Attendance (labelled placeholders, no actions)
```

### Verification
- `tsc --noEmit`: clean.
- `eslint` on every touched file: clean, zero warnings.
- Regression: re-ran `lib/core/academicActivation.test.ts`, `schoolActivation.test.ts`, `teacherOnboarding.test.ts`, `learnerOnboarding.test.ts` (51 tests) — all passing, none affected since no `lib/core/` code changed.
- Plain-teacher workflow: `TeacherSidebar.tsx`/`TeacherBottomNav.tsx`'s base `NAV` array (visible to every teacher, not just admin-tier) still links `/teacher/core-term` directly — confirmed unchanged. This is intentionally not "duplicate navigation": it serves a teacher managing their own class, a different audience than the admin-tier Academic Office rollup.
- School Office authorization: unchanged — `isAdminTier` gating in `app/teacher/layout.tsx` and the `ADMIN_TIER_ROLES` check on both `core-office/page.tsx` and the new `core-office/academic/page.tsx` are identical to before.
- No duplicate routes: confirmed by grep — `core-term/status` and `core-office/academic` each have exactly one inbound link source in the composed workspace.
- `next build`: timed out in this environment before completing (large project, 3+ min). Not confirmed as a hard failure — flagged as a known limitation rather than claimed as verified.

### Known limitations
- Academic Years, Terms, and Subjects still have no dedicated create/edit screen anywhere in the product — Academic Office surfaces their status honestly (per Phase 1's audit and this sprint's "never fabricate capability" instruction) but does not add one, since that would be new UI beyond composition, arguably bordering on new capability.
- The confirmed-dead `app/api/core/school/end-of-term/route.ts` and the 3-copy `ADMIN_TIER_ROLES`/`SCHOOL_ADMIN_ROLES`/`isSchoolAdmin()` duplication remain, per explicit "do not touch" instruction — still open for a future cleanup sprint.
- `next build` was not run to a clean completion in this environment (timed out); typecheck and lint are clean, and this should be re-verified with a longer-running build before merge if that matters for CI.

### Future placeholders
Promotion, Transfer, Graduation, Timetable, Departments, Attendance are rendered on the Academic Office page as dashed-border, non-interactive cards labelled "Planned future module" — no click targets, no backend calls. Promotion and Transfer already have real, tested `lib/core/` functions and API routes with zero UI; Graduation is not a distinct concept (a `promotion_type` branch inside Promotion); Timetable, Departments, and Attendance have no backend at all. Future work on any of these should plug into this same Academic Office section rather than creating new navigation, per the sprint's closing mandate.
