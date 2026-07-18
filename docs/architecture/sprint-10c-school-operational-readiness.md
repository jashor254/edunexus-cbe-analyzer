# Sprint 10C — School Operational Readiness Audit

**Type**: read-only architectural audit. No production code, schema, migration, or test was touched in producing this document. No ADR — no canonical conflict was discovered, only the same class of reachability gap Sprint 10B already documented, now confirmed to persist across a larger backend surface.

**Method**: three parallel research passes (screen inventory/navigation; role-by-role/daily-timeline; decision-flow/communication/workload), each gathering file-cited evidence directly from the repository via grep/read, cross-checked against Sprint 10B's and Sprint 9A's prior findings rather than assumed to still hold. Every factual claim below traces to a specific file:line, independently re-verified this session (not carried over from 10B without a fresh check) — several checks (event bus, `core-term` nav absence, `buildPrincipalDashboard` orphan status, promotions/transfers dead ends, attendance table absence) were re-run directly against the current working tree, including the uncommitted diff, before being restated. Parts 8–10 and the Exit Question are synthesis over that evidence, not new research.

**Headline finding, stated up front**: since Sprint 10B, real engineering work landed — a genuine orchestration layer (`lib/core/schoolActivation.ts`, `lib/core/teacherOnboarding.ts`, `lib/core/learnerOnboarding.ts`, `lib/core/academicActivation.ts`) that collapses what Sprint 9A found to be 6+ separate manual API calls across 5 route files into single, idempotent, well-tested orchestrated operations. This is not cosmetic — it is the first evidence in this audit series of the Academic Office capability gap actually shrinking. **But the shrinkage stopped at the API boundary in three of four cases.** School activation is now genuinely reachable through a real, nav-linked screen (`app/admin/core-schools/new` → `POST /api/core/school` → `activateSchool()`, all in one request). Teacher invitation and learner onboarding got the identical backend treatment — fewer calls, same tested rigor — but have **zero `.tsx` callers**: an academic office today can `curl` one orchestrated endpoint instead of three unorchestrated ones, but still cannot invite a teacher or admit-and-enroll a learner through the product. The pattern Sprint 10B named — real backend, no door — has not closed; it has moved one layer deeper and gotten measurably better underneath.

---

## Part 1 — Daily School Timeline

Re-verified stage by stage against the current working tree, including the diff since 10B (`lib/core/{schoolActivation,teacherOnboarding,academicActivation,academicBridge,learnerOnboarding}.ts`, `app/api/core/teachers/`, and the modified `app/api/core/{learners,school}` routes). None of these touch `proxy.ts`, `lib/auth/getRole.ts`, or any nav/UI component — the stage-by-stage picture below is functionally unchanged from 10B except where explicitly noted.

| Stage | UI | API | Actor | Data change | Completes / breaks |
|---|---|---|---|---|---|
| Morning arrival / attendance | **None — table doesn't exist** | — | — | — | **Breaks.** `grep -ni attendance lib/database.types.ts` → 0 hits, re-confirmed this session. Only `days_present`/`days_absent` free-text integers on `school_report_cards`, entered at report-card time (`lib/core/report-cards.ts:118`), not a daily register. |
| Lessons | `app/teacher/scheme-of-work`, `app/teacher/lesson-plans` (nav-linked, Production-ready) | Real, existing | Teacher | Real writes | Completes for planning; no "today's lesson" view exists on the dashboard (10B Part 2, unchanged). |
| Assessment | `app/teacher/*` marks/upload screens | `app/api/teacher/assessments/[assessmentId]/{marks,upload}/route.ts` | Teacher | Real marks + auto Evidence | Completes. `recordAssessmentEvidence` (`lib/assessments/evidence.ts:51`) still fires fire-and-forget from the same three call sites confirmed this session: `.../marks/route.ts:144`, `.../upload/route.ts:121`, `lib/core/academicBridge.ts:300`. No confirm-evidence UI, unchanged. |
| Break / student movement | **None** | — | — | — | No concept exists anywhere in the codebase. |
| Office work (years/terms/subjects/teacher-invite/promotion/transfer) | **None**, except one new reachable screen (see below) | Real APIs, several newly orchestrated | Nobody in practice (no staff role can reach these) | Real, but requires direct API calls | **Breaks for a non-developer.** See Part 4/7. |
| School setup / activation specifically | **New and reachable**: `app/admin/core-schools/new/page.tsx`, linked from `app/admin/page.tsx:244` | `POST /api/core/school` → `activateSchool()` (`app/api/core/school/route.ts:79`) | Platform-admin-email-gated user | Real: school + school_admin + academic year + terms + classes + settings, atomically in one request | **Completes**, gated to `NEXT_PUBLIC_ADMIN_EMAILS`, not a school-facing action. |
| Parent requests | **None** | — | — | — | No two-way channel exists (10B Part 5, unchanged). |
| Staff communication | **None** | — | — | — | No messaging/announcement system exists (see Part 6). |
| End of day / homework | Partial (`app/teacher/assignments`) | Real | Teacher | Real | Assignments exist teacher-side; no parent-facing assignment tracking (10B Part 5, unchanged). |
| Reports | `app/teacher/core-term/{page,status}` — real, still **unreachable from any nav** | `/api/core/{assessments,reports,school/end-of-term}` | Teacher/admin-tier | Real | Completes technically, undiscoverable in practice — re-confirmed: `grep -rn "core-term" app/ components/` still returns only the two files themselves. |
| Notifications | **None for Core path**; legacy WhatsApp/email still real | `lib/academicClinic/assessmentPipeline.ts:237-264` (legacy only) | System (cron/pipeline) | Real sends, legacy schema only | The Core report-card publish path still does not call `reportNotify`/`notifyReport` — re-confirmed zero hits in every file touched by the current diff. |

**Verdict**: the diff since 10B adds real orchestration underneath the "office work" and "school setup" rows but changes the actual lived timeline for a teacher, parent, or student not at all — those experiences are identical to what 10B documented.

---

## Part 2 — Role-by-Role Usability

Evaluated independently for all 21 roles. Grep methodology: role name searched across `lib/`, `app/`, `types/`, `components/`, with every hit manually classified as a real role/permission check vs. unrelated prose (marketing copy, career-seed-data labels, code comments).

| Role | Can log in? | Daily work possible? | Evidence |
|---|---|---|---|
| **Headteacher** | Only as generic `teacher` (`lib/auth/getRole.ts:4`, 3-value `UserRole` enum, unchanged) | **No dedicated work path.** `SchoolUserRole` includes it (`types/core.ts:29`), real permission logic exists (`lib/core/permissions.ts:42-65`, `lib/core/context.ts:30`), reachable only by typing `/teacher/core-term/status`, admin-tier gated, no nav link, no login-time distinction. `app/api/core/school/route.ts:114-120` grants headteacher one action deputy_headteacher is explicitly excluded from. | Real permission tier, zero dedicated UI. |
| **Deputy Headteacher** | Same as above | Same as above, weaker — excluded from the one narrower admin action at `app/api/core/school/route.ts:114-120` | Same tier as Headteacher, one documented asymmetry. |
| **Class Teacher** | As generic `teacher` | Yes, for teaching tasks — but `class_teacher_id`/`class_teachers` (`lib/database.types.ts:1891-1927`) is a **data-ownership field, not an auth role** — no screen or permission check differentiates "the class teacher" from any other teacher viewing the same class. | Real data field, not a differentiated actor. |
| **Subject Teacher** | As generic `teacher` | Same generic teacher dashboard as everyone | 1 grep hit total, a marketing string (`components/demo/kcse/pages/KcseTeacherPage.tsx:32`) — not a role. |
| **Academic Office** | As generic `teacher` (no such role exists) | **No.** Years, terms, subjects, teacher-invite, and the new `getSchoolAcademicReadiness()` report are all real, tested, and API-only, several newly orchestrated but still uncalled from any `.tsx` file. | 1 grep hit for the phrase itself — a code comment describing an unreachable page's intended audience (`app/teacher/core-term/status/page.tsx:5`). |
| **Parent** | Real, working (`UserRole` includes `'parent'`) | **Yes**, for what exists — report card, Compass activity, Career Intelligence (10B Part 5, unchanged) | Genuinely functional, unchanged by the diff. |
| **Student** | Real, working (`UserRole` includes `'student'`) | **Yes** — `/student` dashboard, `/learn` Compass chat (10B Part 6, unchanged) | Genuinely functional, unchanged by the diff. |
| **Dean of Studies** | No | No | **0 hits anywhere** in `lib/`, `app/`, `types/`, `components/`. |
| **Secretary** | No | No | 1 hit, unrelated ("Cabinet Secretary ICT" career-seed label, `lib/career/seedCareers.ts:1535`). |
| **Admissions** | No | No | 2 hits, both marketing prose in `app/(marketing)/legal/privacy/page.tsx`, not a role or screen. |
| **ICT Administrator** | No | No | **0 hits.** |
| **Examinations Officer** | No | No | **0 hits** ("examinations officer", "exams officer" both checked). |
| **Finance Officer** | No | No | 2 hits, both a career-title label in Career Intelligence seed data (`lib/career/seedCareers.ts:1007,1068`), unrelated to any platform role. |
| **Counsellor** | No | No | **0 hits** ("counsellor"/"counselor" both checked; the unrelated "Counselling Psychologist" career-seed entry didn't even match). |
| **Librarian** | No | No | **0 hits.** |
| **Boarding Master** | No | No | **0 hits.** |
| **Driver** | No | No | 2 hits, both unrelated ("driver of repetition" code comment; "primary driver of outcomes" marketing copy). |
| **School Nurse** | No | No | **0 hits.** |
| **Storekeeper** | No | No | **0 hits.** |
| **Security** (staff role) | No | No | **0 hits** as a staff role (application/data "security" is a separate, heavily-used term, correctly excluded from this count). |
| **Kitchen Staff** | No | No | **0 hits.** |

**Summary**: of 21 roles, 4 have any code-level existence at all (Headteacher and Deputy Headteacher as real permission tiers with zero UI; Class Teacher as a data-ownership field, not an auth role) plus Parent and Student, which are the only two roles with genuinely working, reachable, role-appropriate daily paths. The other 17 roles have either zero hits or only unrelated prose/seed-data/comment matches — this is a plain statement of absence, not a judgment on whether EduNexus should build these roles next.

---

## Part 3 — Screen Inventory

70 `page.tsx` files inventoried across teacher, parent, student, admin, and dashboard route trees.

| Surface | Count | Classification | Basis |
|---|---|---|---|
| `app/teacher/**` (dashboard, classes, scheme-of-work, lesson-plans, documents, booklets, record-of-work, assignments, slides, kiswahili/insha, analytics, alerts, reports, academy+5 subpages, settings) | 35 | **Production-ready** | Real queries, all linked from `TeacherSidebar`/`TeacherBottomNav` |
| `app/teacher/core-term/{page,status}` | 2 | **Live but Unreachable/Dormant** | Verified working (Sprint 10A), zero inbound links anywhere; own file comment (`status/page.tsx:11-19`) documents it was *moved* specifically because `/admin/*` is hardcoded to one email, and still received no nav link |
| `app/(parent)/{report-card,career-intelligence,career-intelligence-report,career-report}` | 4 | **Production-ready** | Real data, shared `DashboardNavbar` layout |
| `app/(student)/{blueprint,career,career/[slug],holiday,progress}` + `app/student/{page,groups,groups/[groupId]}` | 8 | **Production-ready** | Internally consistent link graph, real multi-table queries |
| `app/admin/page.tsx` | 1 | **Production-ready** | Real stats, hardcoded-email gate |
| `app/admin/pilot/page.tsx` | 1 | **Production-ready** | Linked from `app/admin/page.tsx:238` |
| `app/admin/cleanup/page.tsx` | 1 | **Live but Dormant** | Zero inbound links, unchanged from 10B |
| `app/admin/core-schools/new/page.tsx` | 1 | **Production-ready, new since 10B** | Linked from `app/admin/page.tsx:244`, posts to the now-orchestrated `POST /api/core/school`, redirects to `/admin` without displaying the returned `activation` result (see Part 7) |
| `app/dashboard/{page,clinic/*,assessments/*,assignments,groups*,alerts,settings}` | 11 | **Production-ready** | Real forms/inserts, nav-linked |
| `app/dashboard/learning-compass/page.tsx` | 1 | **Dead** | `setTimeout` redirect shim, unchanged from 10B |
| `app/dashboard/referrals/page.tsx` | 1 | **Prototype, Dormant** | Zero fetch calls, unchanged from 10B |
| `app/invitations/[token]`, `app/join/[inviteCode]` | 2 | **Production-ready, unrelated to Core** | Developer-Portal org-membership invite and a class-join-code flow respectively — confirmed neither calls `api/core/teachers` or any Core onboarding function |
| **No `principal`, `headteacher`, `office`, or `academic-office` directory exists anywhere under `app/`** | 0 | **Absent** | `find app -maxdepth 1 -iname "*principal*" -o -iname "*headteacher*" -o -iname "*office*"` → no output |

---

## Part 4 — Navigation Audit

Nav components found: `components/teacher/TeacherSidebar.tsx` (15 links, `NAV` array lines 14-30), `components/teacher/TeacherBottomNav.tsx` (`CREATE_NAV`/`MORE_NAV`, lines 16-34), `app/dashboard/components/DashboardNavbar.tsx` (shared by parent/student layouts). **No sidebar/nav component exists for a headteacher/academic-office/principal role** — consistent with no such route tree existing.

`core-term` does not appear in either teacher nav array — re-confirmed directly against `TeacherSidebar.tsx`'s `NAV` list this session (Dashboard, My Classes, Scheme of Work, Lesson Plans, Documents, Booklets, Record of Work, Assignments, AI Slides, Insha Feedback, Analytics, Alerts, Reports, AI Academy, Settings — 15 entries, no End-of-Term entry).

Among the 70 inventoried *pages*, roughly 5 (~7%) are confirmed URL-only/hidden (`core-term` ×2, `admin/cleanup`, `dashboard/learning-compass`, `dashboard/referrals`). But measuring "discoverability" against pages undersells the real gap: **academic-office and teacher-invite/learner-onboarding capability has no page to even count as hidden**, because no `.tsx` was ever built for it. Measured against shipped API capability rather than shipped pages, academic-office operations (years, terms, subjects, teacher invite, learner onboarding via the new orchestrated endpoint, promotions, transfers, `getSchoolAcademicReadiness()`) remain **0% discoverable through the product UI**.

---

## Part 5 — Daily Decision Flow

| Decision | Who makes it | Who approves | Who sees it | Who's notified | Trapped in API? |
|---|---|---|---|---|---|
| Promotion | `runAnnualPromotion`/`previewPromotion` (`lib/core/promotions.ts`) | Nobody (no UI) | Nobody | Nobody | **Yes — confirmed dead end, unchanged by the diff.** Sole importer remains `app/api/core/promotions/route.ts`; the new orchestration modules explicitly scope promotion out (`lib/core/schoolActivation.ts:19`, `lib/core/academicActivation.ts:16` both state it) rather than close the gap. |
| Transfer | `lib/core/transfers.ts` | Nobody | Nobody | Nobody | **Yes — same pattern, unchanged.** Sole importer is its own route. |
| Report/assessment publishing | Teacher, via `app/teacher/core-term` (unreachable) or the legacy Academic Clinic pipeline (reachable) | Admin-tier for the Core path | Parent (legacy path only) | Parent (legacy path only, via WhatsApp/email) | Partially — the Core path publishes correctly but notifies no one (Part 6). |
| Risk/intervention flags | `AttentionFeed` (per-teacher scope) | Nobody | Only the teacher who owns the class | Nobody | No headteacher aggregation exists — unchanged from 10B. |
| **New: school academic readiness** (`getSchoolAcademicReadiness()`, `lib/core/academicActivation.ts:223`) | The function itself, on demand | Nobody | Nobody | Nobody | **Yes — a new dead end.** Rolls up year/term/subjects/teachers/learners into one `overallReady` + `blockingReasons[]` report — genuinely useful decision-support output — with **zero callers anywhere outside its own test file**, confirmed by grep. No route, no page. Same shape as the promotions/transfers pattern, freshly introduced. |

---

## Part 6 — Communication Model

**The event bus is still a confirmed silent no-op**, re-verified directly against the diff: `grep publishEvent` across every new/changed file (`schoolActivation.ts`, `teacherOnboarding.ts`, `academicActivation.ts`, `learnerOnboarding.ts`, `academicBridge.ts`, and the four changed API routes) returns **zero hits** — none of this new orchestration fires an event at all. The only `publishEvent` call touched by the diff is the pre-existing, unchanged one at `lib/core/school.ts:22`. `app/api/cron/events/dispatch/route.ts` remains absent from `vercel.json`'s 4 configured cron entries.

**Full cron inventory** (18 directories under `app/api/cron/`, re-enumerated this session — a fuller picture than 10B's text conveyed):
- **In `vercel.json` (4)**: `friday-generation` (SOW→lesson plans + TIE), `generate-record-of-work` (lesson plans→ROW), `auto-publish-holiday-plans` (3-day auto-publish gate), `ai-log-retention` (90-day anonymization).
- **Scheduled via `.github/workflows/notification-crons.yml`, genuinely wired (a fact 10B under-cited)**: `parent-pulse` (weekly WhatsApp), `term-readiness`, `academy-nudge` — real, `CRON_SECRET`-guarded, not dead.
- **Scheduled nowhere — confirmed unreachable in production**: `events/dispatch`, `dlq-requeue`, `projection-events`, `billing-renewals`, `cleanup-users`, `quota-alerts`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges`, `jobs/process`. `quota-alerts`'s own header comment states it depends on the same dead event bus ("Consumers subscribe to org.quota.warning via event bus") even once scheduled.

**Communication paths, end-to-end status, unchanged by the diff**:
- Legacy assessment→parent WhatsApp/email (`lib/academicClinic/assessmentPipeline.ts:237-264`): **real, working**.
- Core report-card publish → parent: **still silent** — zero `reportNotify`/`notifyReport` calls added anywhere in the diff.
- Parent↔teacher two-way messaging: **does not exist**.
- Headteacher/office→teacher/parent broadcast or announcements: **does not exist**.
- Teacher↔teacher / staff communication: **does not exist** as a platform feature.

---

## Part 7 — Workload Analysis

This is where the diff since 10B produced a real, measurable change — but an asymmetric one.

**School setup**: Sprint 9A found 6+ separate manual API calls across 5 route files, zero orchestration. Now: `activateSchool()` (`lib/core/schoolActivation.ts:407`) composes Academic Year → Terms → Grades (resolved) → Streams → Classes → Settings into one idempotent call, invoked inside the same `POST /api/core/school` request that creates the school (`app/api/core/school/route.ts:79`). That route is called from a real, nav-linked form (`app/admin/core-schools/new/page.tsx:52`, linked from `app/admin/page.tsx:244`). **Net result: school creation went from "1 form + 6 manual follow-up calls" to "1 form, 1 request, fully activated."** This is genuine progress, reachable by an actual (admin-gated) user today — not just a backend improvement.

One gap in this same flow: the admin form discards the response. `app/admin/core-schools/new/page.tsx` reads `data.error` on failure but never reads `data.activation` on success (confirmed by direct read of the page — it calls `router.push('/admin')` immediately after a 201, never inspecting the `activation.status`/`activation.steps` the route now returns). An admin has no way to see, from the UI, whether activation actually completed or partially failed — they would have to check `/admin` or query the API directly.

**Teacher onboarding**: `inviteTeacher()`/`acceptTeacherInvitation()` (`lib/core/teacherOnboarding.ts:59,98`) collapse what would otherwise be several ad hoc writes into 2 calls, correctly wired into a new route (`app/api/core/teachers/route.ts`). **Zero `.tsx` callers exist.** An academic office cannot invite a teacher through the product; they can now `curl` one well-designed endpoint instead of writing raw SQL, which is real progress at the API layer but does not move Sprint 10B's "Academic Office operations are API-only" verdict for this specific workflow.

**Learner onboarding**: `onboardLearner()` (`lib/core/learnerOnboarding.ts:148`) collapses admission + guardian + enrollment into one call, wired into the existing `POST /api/core/learners` route via a payload-shape branch (`class_id` present → orchestrated path, `app/api/core/learners/route.ts:105`). **Zero `.tsx` callers of this route** exist for either the plain-admission or the new orchestrated branch. Same pattern as teacher invite.

**Academic readiness**: `getSchoolAcademicReadiness()` is pure read-only consolidation, not wired to any route at all — the least-reachable of the four new modules (Part 5).

**Assessment, report cards, promotion, transfer, graduation**: unchanged from Sprint 9A/10B — assessment/report cards are reachable only via the still-unlinked `core-term` pages or the legacy pipeline; promotion, transfer, and graduation remain entirely API-only, zero UI, zero orchestration attempted this round.

**Precise verdict**: the manual-step count for a developer operating this platform via API dropped meaningfully (school activation: 7 calls → 1; teacher onboarding: ad hoc → 2; learner onboarding: ad hoc → 1). The manual-step count for a non-developer academic office member using the actual product dropped from "cannot do any of this" to "cannot do any of this, except now create a school if they also happen to be the one hardcoded platform-admin email" — one workflow crossed the reachability line, three did not.

---

## Part 8 — Educational Operating System Score

| Domain | Score | Justification (from Parts 1–7) |
|---|---|---|
| Admissions | 3/10 | `onboardLearner()` is real and orchestrated (Part 7) but has zero UI callers (Part 4); a school cannot admit a learner through the product today. |
| Academics | 3/10 | School/class/term structure is now genuinely activatable in one step (Part 7) — a real improvement — but subjects, terms, and classes still have no CRUD UI (Part 3/4) once the initial activation defaults are insufficient. |
| Assessment | 5/10 | The full Assessment→Evidence→Projection chain is real and tested (10B, unchanged); reachable through the legacy pipeline; the Core path exists but is unreachable (Part 1/4). |
| Reporting | 4/10 | End-of-Term pipeline is correct and tested (Sprint 10A); completely undiscoverable without a direct URL (Part 3/4). |
| Attendance | 0/10 | No table exists at all (Part 1), while still marketed as a live feature on the public site (10B, re-confirmed unchanged this session). |
| Communication | 1/10 | Legacy WhatsApp/email works for one narrow path; the Core publish path, the event bus, and any two-way channel are all silent or absent (Part 6). |
| Leadership | 1/10 | Headteacher/Deputy Headteacher exist as permission tiers only; zero dedicated UI, zero aggregation, `buildPrincipalDashboard` remains orphaned — re-confirmed this session (`grep -rln buildPrincipalDashboard` → only its own service/route file) (Part 2/5). |
| Student Support | 4/10 | AttentionFeed is real but per-teacher scoped; no school-wide risk view, no intervention approval loop (Part 5). |
| Parents | 5/10 | Report card, Compass activity, Career Intelligence are genuinely good; no in-progress grades, homework tracking, or two-way channel (Part 1/6, unchanged from 10B). |
| Administration | 2/10 | The one real improvement this sprint found — school activation is now a single reachable action — sits inside an otherwise near-total UI vacuum for years/terms/subjects/teacher-invite/promotion/transfer (Part 3/4/7). |
| Intelligence | 8/10 | Evidence, Projection, Ranking, Grading, Compass, Career Intelligence are real, evidence-anchored, and untouched by this sprint's findings — the strongest layer in the platform (10B, unchanged). |
| Automation | 2/10 | `activateSchool()`/`onboardLearner()`/`inviteTeacher()` are real automation, but automation nobody outside a developer can trigger is automation the school doesn't experience (Part 7). |
| Workflow | 2/10 | No workflow engine, no approval routing beyond two narrow teacher-side gates (Holiday Plan publish, Differentiation approve — both restated from 10B, unchanged) (Part 5/6). |
| Decision Support | 2/10 | `getSchoolAcademicReadiness()` is a genuinely useful new decision-support report with literally zero callers (Part 5) — decision support that exists in code and nowhere else. |
| Archive | 1/10 | Promotion/transfer/graduation remain fully API-only dead ends; no archive concept beyond raw table state (Part 5). |

---

## Part 9 — Top 25 Bottlenecks

Ranked by combined impact / architectural importance / pilot urgency.

1. **No UI exists to invite a teacher to a school** — `app/api/core/teachers` is real, tested, and has zero `.tsx` callers; a school literally cannot add a second staff member through the product (Part 7).
2. **No UI exists to admit/enroll a learner via the orchestrated path** — `onboardLearner()` is real, tested, zero callers (Part 7).
3. **Attendance does not exist as a system**, while being marketed as live (Part 1/8).
4. **The operational event bus is a complete, silent no-op in production** — 20+ call sites, `platform_events` never applied live, no ADR-level fix attempted this sprint either (Part 6).
5. **A Core-published report card notifies no one** — the only working parent-notification path is legacy-schema-only (Part 1/6).
6. **No headteacher-facing UI exists anywhere** — `buildPrincipalDashboard` remains a fully-built, zero-consumer backend (Part 2/5/8).
7. **`core-term` (the End-of-Term teacher/admin UI) has no nav link**, three sprints after being built and verified working (Part 3/4).
8. **Academic Office has no UI for years, terms, subjects, or classes** beyond the one-shot activation default (Part 3/4/7).
9. **Promotion is a confirmed dead end** — real engine, zero UI, zero orchestration attempt this sprint (Part 5).
10. **Transfer is a confirmed dead end** — same shape as promotion (Part 5).
11. **The new `getSchoolAcademicReadiness()` decision report has zero callers** — a fresh instance of the exact pattern this whole series keeps finding (Part 5).
12. **No role model exists above teacher/parent/student at the auth layer** — `proxy.ts`/`lib/auth/getRole.ts` unchanged across three sprints (Part 1/2).
13. **17 of 21 named school roles have zero code-level existence** (Part 2) — not itself a defect (most may be out of scope), but means any claim of "role-based operations" beyond teacher/parent/student is currently false.
14. **`/admin/*` is hardcoded to one personal email** — no platform-admin role model exists at all (10B, unchanged, re-confirmed this session).
15. **The admin school-creation form discards the activation result** — `app/admin/core-schools/new/page.tsx` never reads `data.activation`, so a partial-activation failure is invisible in the UI (Part 7, new finding this sprint).
16. **No attendance-adjacent daily register of any kind for student movement/break** (Part 1).
17. **No parent↔school two-way communication channel exists** (Part 6, unchanged).
18. **No teacher↔teacher or staff-wide communication/announcement system exists** (Part 6).
19. **Deputy Headteacher is asymmetrically excluded** from one admin action other admin-tier roles get, an unresolved role-scoping gap flagged (not fixed) since Sprint 1B (Part 2/5).
20. **No headteacher/school-wide risk-learner aggregation** — AttentionFeed is per-teacher only (Part 5/8).
21. **Class Teacher is a data-ownership field, not an auth role** — no screen differentiates "the assigned class teacher" from any other teacher (Part 2).
22. **10 of 18 cron jobs are scheduled nowhere** (`events/dispatch`, `dlq-requeue`, `projection-events`, `billing-renewals`, `cleanup-users`, `quota-alerts`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges`, `jobs/process`) (Part 6, new full inventory this sprint).
23. **No workflow/approval engine beyond two narrow, teacher-side gates** (Holiday Plan publish, Differentiation approve) (Part 5/6).
24. **No archive/graduation concept beyond raw table state** (Part 8).
25. **Report-card publication and Assessment lock still require typing a URL** to reach, even for the one school-admin-tier user who could theoretically use them (Part 1/3/4).

---

## Part 10 — Implementation Roadmap

Sequenced over the *existing* architecture (Core schema, `lib/core/*` orchestration already built, existing repositories) only — no new architecture proposed.

**Immediate** (closes the "real backend, no door" gap the diff itself just widened):
1. Build a teacher-invite screen calling the already-built, already-tested `POST /api/core/teachers` (`action:'invite'`/`'accept'`) — this is composition over existing, verified logic, not new business logic (bottleneck 1).
2. Build a learner-admission screen calling the already-built `POST /api/core/learners` orchestrated branch (bottleneck 2).
3. Fix `app/admin/core-schools/new/page.tsx` to display the `activation` result it already receives and currently discards (bottleneck 15) — a one-file change with no backend work required.
4. Link `app/teacher/core-term/{page,status}` into `TeacherSidebar`/`TeacherBottomNav` — zero new code, one nav-array edit (bottleneck 7).

**Pilot blockers**:
5. Wire the Core report-card publish path to a parent-notification call (reuse the legacy `reportNotify` shape or build the equivalent Core-side call) (bottleneck 5).
6. Apply the `platform_events` migration and configure the dispatch cron, or explicitly retire the event-bus mechanism in favor of direct notification calls until it's needed (bottleneck 4) — a decision, not just code.
7. Build a minimal read-only headteacher screen that calls the already-built `buildPrincipalDashboard` (bottleneck 6) and, once built, `getSchoolAcademicReadiness()` (bottleneck 11) — both backends exist and are tested.

**Medium-term**:
8. Academic Office CRUD screens for years/terms/subjects/classes beyond the one-shot activation default (bottleneck 8).
9. A promotion and transfer UI over the existing, correct `lib/core/{promotions,transfers}.ts` engines (bottlenecks 9, 10).
10. A real platform-admin role model to replace the single hardcoded email (bottleneck 14).

**Long-term**:
11. Attendance as a first system, or a public retraction of the existing marketing claim, whichever comes first (bottleneck 3, 16).
12. Parent↔school and staff↔staff communication infrastructure (bottlenecks 17, 18).
13. A role model above teacher/parent/student at the auth-routing layer, closing the gap `SchoolUserRole` already half-answers but `proxy.ts` never consults (bottleneck 12).

**Future vision**:
14. Whichever of the 17 zero-evidence roles (Part 2) the business decides are actually needed for the target school size — this audit deliberately does not recommend which, only states plainly that none currently exist.
15. A workflow/approval engine generalizing the two existing narrow gates (bottleneck 23).

---

## Exit Question

**"If a school adopted EduNexus tomorrow, what would teachers, students, parents, leadership, and administration still need to leave the platform to accomplish?"**

**Teachers** would do real, working daily teaching — scheme of work, lesson plans, record of work, assessment marking, evidence generation — entirely inside the product, exactly as Sprint 10B found. They would leave the platform for attendance (doesn't exist), for any school-wide communication with colleagues or leadership, and — unless someone hands them a direct URL — for the very End-of-Term reporting workflow this platform's own engineering invested three sprints hardening.

**Students** get a genuinely real, working experience: Compass tutoring, XP/levels, Career Intelligence. Nothing here changed this sprint.

**Parents** get real value where it exists (report card, Compass activity, Career Intelligence) and leave the platform for in-progress grades, homework tracking, attendance, and any two-way conversation with the school — a Core-published report card still notifies no one automatically.

**Leadership** — headteacher, deputy headteacher — has almost nowhere to go inside the product at all. A real, sophisticated backend (`buildPrincipalDashboard`) and a brand-new decision-support report (`getSchoolAcademicReadiness()`) both exist in code and have never been wired to a screen. Every leadership decision this audit traced — promotion, transfer, school-wide risk, teacher workload, activation status — happens outside EduNexus, in spreadsheets or memory, today.

**Administration** is the one place this sprint found genuine, measurable progress and its exact limit in the same sentence: a school can now be *created and structurally activated* — year, terms, classes, settings — in one product action, something no prior sprint in this series could say. But inviting a second teacher, admitting a learner through the orchestrated path, opening or closing a term beyond the activation default, and promoting or transferring a learner all still require a developer with API access, not an academic-office staff member with a login. The office leaves EduNexus for nearly everything it does after the day the school is switched on.

**The honest answer, updated from Sprint 10B**: the intelligence layer remains real and untouched. The operational layer around it did not stay flat this sprint — it grew a genuine orchestration tier underneath three of its biggest gaps (school activation, teacher onboarding, learner onboarding) — but only one of those three (school activation) actually crossed into something a real user can click. The other two are further proof of the pattern this whole audit series keeps finding: EduNexus's engineers keep building the right backend before anyone asks them to build the door.
