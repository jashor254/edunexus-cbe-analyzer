# Sprint 10B — School Operations Layer Audit

**Type**: read-only architectural audit. No production code, schema, migrations, or tests were touched. No ADR — no canonical conflict was discovered, only reachability and completeness gaps.

**Method**: three parallel research passes (daily timeline/teacher/headteacher workspaces; academic office/parent/student experience; dashboards/events inventory) gathered file-cited evidence directly from the repository, followed by synthesis and the readiness/classification judgment calls in Parts 9–10 below. Every factual claim in Parts 1–8 traces to a specific file:line; Parts 9–10 are analysis built on that evidence, not new research.

**Headline finding, stated up front**: this audit did not find a missing *engine*. Assessment, Evidence, Projection, Ranking, Grading, and Compass are real and were not touched. What it found is a **reachability gap between real backend capability and any UI a school staff member would actually find** — repeated at almost every layer (academic office operations, headteacher oversight, the very End-of-Term flow Sprint 10A just built) — plus one platform-wide plumbing failure (the operational event bus) that is currently a complete, silent no-op in production.

---

## Part 1 — Daily School Timeline

**There is no headteacher/academic-office/class-teacher/subject-teacher distinction at the authentication layer.** `lib/auth/getRole.ts:5` defines the single canonical role lookup for the whole app as `UserRole = 'teacher' | 'parent' | 'student'` — three values, full stop. `proxy.ts:113-129` gates `/teacher/*` purely on this role; `proxy.ts:98-103` gates `/admin/*` to one hardcoded email (`kariukidennis092@gmail.com`). Nothing in the request-routing layer knows what a headteacher or academic-office staffer is.

A second, narrower role concept — `SchoolUserRole` (`types/core.ts:27-32`: `school_admin | headteacher | deputy_headteacher | teacher | parent`) — exists only inside the Core schema's per-school membership table, checked ad hoc by individual API routes via `lib/core/permissions.ts`'s admin-tier functions, never by `proxy.ts`. It has real authorization logic behind it but no corresponding front-door.

**Practical consequence**: Headteacher, Academic Office staff, Class Teacher, and Subject Teacher all land on the *identical* `/teacher/dashboard` after login (`app/(auth)/login/page.tsx:41-78` only distinguishes `/teacher/dashboard` vs `/dashboard`, nothing finer) and see the identical `TeacherSidebar` nav (`components/teacher/TeacherSidebar.tsx:15-30`). There is no role-differentiated landing experience anywhere in the platform-auth layer.

**Assessment → Evidence is automatic**, not a distinct teacher-visible step. `recordAssessmentEvidence` (`lib/assessments/evidence.ts:51`) fires fire-and-forget from three call sites: `app/api/teacher/assessments/[assessmentId]/marks/route.ts:144`, `app/api/teacher/assessments/[assessmentId]/upload/route.ts:121`, and the Core bridge (`lib/core/academicBridge.ts:300`). No "confirm evidence" screen exists — this is correct per the Evidence-First Mandate's design (evidence generation shouldn't require a separate manual step), but it does mean nothing in the UI ever tells a teacher "evidence was recorded."

**Attendance does not exist as a system.** Zero hits for `attendance` in `lib/database.types.ts` — no table. The only related data is free-text `days_present`/`days_absent` integer columns on `school_report_cards`, typed in manually at report-card time (`lib/core/report-cards.ts:118`), not a daily register. Yet `app/(marketing)/page.tsx:828,843` and the privacy policy page market "attendance tracking" as a live capability. **This is a real product-claim gap, not just a reachability gap.**

**Notifications are real but narrow.** `notification_log` is a genuine table, used by four cron jobs (`app/api/cron/{term-readiness,parent-pulse,academy-nudge}/route.ts`) and two teacher-alert paths (`app/api/teacher/{alerts,assignments/[id]/mark}/route.ts`). This is server-triggered WhatsApp/email dispatch, not an in-app notification center — no bell icon, no notifications page in any sidebar.

**Parent auto-notification exists but is legacy-schema-only.** `lib/academicClinic/assessmentPipeline.ts:237-264` fires WhatsApp and email in parallel when a *legacy*-schema assessment is processed (`app/api/teacher/assessments/process/route.ts:90`). The **new Core `app/teacher/core-term` publish flow does not call this or any equivalent** — grep confirms zero references to `reportNotify`/`notifyReport` from the Core report-cards path. **A Core-schema report card being published today does not reach a parent automatically.** This is a direct, load-bearing gap for Sprint 10A's own work: the pipeline computes, generates, and publishes correctly (verified end-to-end in Commits 1–3), but "publish" does not mean "parent finds out."

---

## Part 2 — Teacher Workspace

`app/teacher/dashboard/page.tsx` renders `TodaysMission`, `ContinueWorking`, a conditional `AttentionFeed` ("Teacher Intelligence"), `WeeklyTeachingProgress`, and a static 4-item tool grid (Scheme of Work, Lesson Plans, Record of Work, AI Slides).

| Checklist item | Status | Evidence |
|---|---|---|
| Today's lessons | Absent | No lesson-of-the-day component; the tool grid is static links, not a calendar |
| Today's assessments | Absent | No component reads today's scheduled assessments |
| Pending marking | Absent | `lib/attentionFeed/sources.ts` item types cover student/substrand attention, misconceptions, prerequisite gaps, intervention follow-ups, career moments, teaching patterns — none reference a marking backlog |
| Remedial students | Present (framed as "at risk," not "remedial") | `AttentionFeed` surfaces items with severity `critical/at_risk/watch/info` (`lib/attentionFeed/types.ts:1-19`) |
| AI recommendations | Present | Attention/Mission items carry `suggestedAction` (`lib/attentionFeed/types.ts:12`) |
| Upcoming deadlines | Absent | No deadline-type item exists anywhere in the attention feed sources |
| Parent requests | Absent | No such category exists |
| End-of-term status | **Present but unreachable** | `app/teacher/core-term/page.tsx` and `.../status/page.tsx` exist and work (verified live, Sprint 10A) — but grep for `core-term` across `app/`, `components/`, `lib/` returns **zero** references outside the two files themselves. Not in the sidebar, not on the dashboard, not linked from anywhere. Reachable only by typing the URL. |

---

## Part 3 — Headteacher Workspace

**No dedicated headteacher page exists anywhere in the codebase.** The only UI that even checks admin-tier Core membership is the two `core-term` pages built this session — and those are unreachable (Part 1/2) and live inside the ordinary teacher route tree, not a separate surface.

| Checklist item | Status | Evidence |
|---|---|---|
| School performance view | Absent | No aggregate cross-class performance page |
| Teacher workload view | Absent | No such feature; grep hits are unrelated prose |
| Classes behind syllabus | Absent | No such concept anywhere |
| Assessment completion tracking | **Present, but scoped and unreachable** | `app/teacher/core-term/status/page.tsx:82-91` computes it correctly (current term only), but the page has no inbound link from anywhere |
| Promotion readiness | **API-only, no UI, dead end** | `lib/core/promotions.ts` (`runAnnualPromotion`, `previewPromotion`) is imported only by `app/api/core/promotions/route.ts` — zero `.tsx` files call it |
| Risk learners view | Present, but per-teacher not school-wide | `AttentionFeed` is scoped to a teacher's own classes; no headteacher aggregation exists |
| Attendance view | Absent | No attendance system exists at all (Part 1) |
| Behaviour tracking | Absent | No behaviour-incident feature anywhere in the codebase |
| Academic trends view | Absent | `app/teacher/analytics` is per-teacher, not school-wide |

**The most significant single finding of this entire audit** is adjacent to this section but belongs to Part 7: a fully-built, real backend for exactly this workspace (`buildPrincipalDashboard`, served at `app/api/school/intelligence/route.ts`) exists, has correct auth, and has **zero frontend callers**. See Part 7.

---

## Part 4 — Academic Office Workspace

Every one of these responsibilities has a real, working API (several built this session) and **no UI**, confirmed by grepping every `.tsx` file in `app/` for each route path:

| Responsibility | API | UI | Notes |
|---|---|---|---|
| Academic year mgmt | `app/api/core/academic-years/route.ts` | **None** | Zero `.tsx` references |
| Term mgmt | same route | **None** | Zero `.tsx` references |
| Subject mgmt | `app/api/core/subjects/route.ts` | **None** | Zero `.tsx` references |
| Teacher invite (Core) | `app/api/core/teachers/route.ts` | **None** | Its own comment calls it "the reserved-but-unbuilt Teacher-domain API surface" (line 3-5). The only invite UI in the app is the *Developer Portal's* org-membership system (`app/organizations/[orgId]/members/page.tsx`) — unrelated |
| Class mgmt | `app/api/core/classes/route.ts` | **Read-only, incidental** | Only consumed as a GET-only class picker inside `app/teacher/core-term/{page,status}.tsx` — no create/edit/delete UI |
| Assessment calendar | — | **Does not exist as a concept** | No date-based scheduling entity anywhere; assessments are created ad hoc |
| Publishing workflow | `/api/core/{assessments,reports}` | **Sprint 10A only** | The only publishing UI in the whole platform is what this session built |
| Report card UI (staff-side) | `/api/core/reports` | **None** | Only the parent-facing viewer exists; no teacher/admin report-editing screen |
| Promotion | `lib/core/promotions.ts` | **None — dead end** | Sole importer is the API route itself |
| Transfer | `lib/core/transfers.ts` | **None — dead end** | Same pattern exactly |
| Moderation (cross-teacher grade review) | — | **Does not exist** | Not a real concept anywhere in the codebase; every grep hit is unrelated confidence-scoring language |

**Reading this table straight: an Academic Office is currently unable to open a term, close a term, add a subject, or promote a cohort through the product at all.** Every one of these requires either a developer running a script or a direct authenticated `curl`/Postman call against the API. Sprint 10A gave teachers a UI for the one workflow (End-of-Term) that already had a UI request behind it; the surrounding administrative surface a real academic office needs day-to-day still doesn't exist.

---

## Part 5 — Parent Experience

Pages under `app/(parent)/`: `report-card`, `career-intelligence`, `career-report`, `career-intelligence-report` (plus the shared auth-gated layout).

| Capability | Status | Evidence |
|---|---|---|
| View published report cards | **Present** | `app/(parent)/report-card/page.tsx`, via `/api/reports/report-card/mine` + `/api/reports/report-card` |
| View ongoing progress/grades | **Absent — dead end** | No route/page exists for in-progress (pre-publication) grades; the report-card page treats a missing current term as an error state |
| Receive notifications | **Partial, legacy-only** | Real sends exist (`lib/holiday/notify.ts`, `app/api/cron/parent-pulse/route.ts`, `lib/whatsapp/reportNotify.ts`) but keyed to the legacy schema (`class_students.parent_id`, per `app/api/parent/alerts/route.ts:8-15`'s own comment documenting this as a third, separate ownership mechanism from `students.parent_user_id` and Core's `learner_guardians`). No Core-schema parent-notification path exists. |
| Two-way communication with school | **Absent** | No messaging/chat/conversation infrastructure for parent↔school exists anywhere; all "conversation" hits are the AI-tutor chat |
| Approve anything | **Absent for parents** | The only approval gates in the codebase (Holiday Plan publish, Differentiation approve) are both teacher-side |
| Comment on anything | **Absent** | Report-card comment fields are teacher-authored, parent-read-only |
| Track attendance | **Absent (system doesn't exist)** — only a static end-of-term field | Same finding as Part 1 |
| Track homework/assignments | **Absent — dead end** | Zero references to assignments under `app/(parent)/` |
| Track Compass usage | **Present** | `app/api/parent/compass-activity/route.ts`, purpose-built for the parent dashboard, deliberately hides raw CBC codes behind plain language |
| Track Career Intelligence | **Present** | Three dedicated, real pages |

**Reading this straight**: the parent experience is genuinely good where it exists (report card, Compass, Career Intelligence — all real, all evidence-backed) and has hard dead ends everywhere else (progress-in-progress, homework, attendance, any two-way channel). A parent today learns about their child's term almost entirely through end-of-term WhatsApp/email pushes from the *legacy* pipeline — a Core-published report card currently reaches no one automatically.

---

## Part 6 — Student Experience

Two route groups: `app/(student)/{progress,holiday,blueprint,career,career/[slug]}` (Compass/Career Explorer, legacy-schema) and `app/student/{page,groups}` (home dashboard + Academy cohorts).

`app/student/page.tsx` is real (XP, CBC levels, capability radar, streaks, sourced from `app/api/student/home/route.ts`'s genuine multi-table query) and links out to `/learn`, the Compass AI-tutor chat (`app/learn/page.tsx`, DeepSeek calls correctly routed server-side per `app/api/learn/route.ts`).

**Where AI appears**: Compass chat (`/learn`) and Career Intelligence report generation (`app/api/career/intelligence-report/route.ts`, one DeepSeek call, but fetched from the *parent's* `career-intelligence-report` page, not a student page — the student-facing career pages use a separate, deterministic capability-matching pipeline).

**Where a teacher can override AI**: two gates found, one genuinely reachable, one a dead end matching Part 4's pattern exactly.
1. **Holiday Plan Publish Gate** (`lib/holiday/planner.ts:212,244`) — real, documented, teacher-approval-before-parent-facing-content.
2. **Differentiation approve** (`app/api/teacher/classes/[classId]/differentiation/{route,approve/route}.ts`) — the route's own comment says nothing ships until `/approve` is called, but grep for `differentiation` across every `.tsx` file returns **zero matches**. Another API-only dead end.

No explicit "reject and regenerate" path exists anywhere near AI-generated content — only "approve" (i.e., publish-gating), never an explicit reject/redo action.

---

## Part 7 — Operational Dashboards Inventory

| Page | Audience | Classification | Why |
|---|---|---|---|
| `app/dashboard/page.tsx` | parent/generic | Live | Real parallel counts across 6 tables; linked from nav |
| `app/teacher/dashboard/page.tsx` | teacher | Live | Real queries, feeds real components, linked from sidebar |
| `app/admin/page.tsx` | 1 hardcoded email | Live | Real stats/user-list/grant-access endpoints |
| `app/admin/pilot/page.tsx` | same | Live | Real join query; linked from `/admin` |
| `app/admin/cleanup/page.tsx` | same | **Live but Dormant** | Real data, but zero inbound links from anywhere |
| `app/student/page.tsx` | student | Live | Real multi-table home endpoint |
| `app/dashboard/clinic/*` | parent/teacher | Live | Heavily cross-linked, multiple real endpoints |
| `app/dashboard/{assessments,groups,assignments}/*` | mixed | Live | Real forms, real inserts, linked from nav |
| `app/dashboard/learning-compass/page.tsx` | — | **Dead** | Entire component is a `setTimeout` redirect shim to `/learn`, no data, no inbound links |
| `app/dashboard/referrals/page.tsx` | — | **Prototype, Dormant** | Zero fetch calls, static placeholder card, unreviewed Sheng-language dev comments still in place, zero inbound links |
| `app/teacher/core-term/{page,status}.tsx` | teacher/admin-tier | **Live but Dormant** | Fully functional (verified this session), zero inbound links from anywhere in the app |
| `app/api/school/intelligence/route.ts` | headteacher/principal | **Dead API — orphaned backend** | Fully real endpoint, real auth, calls a genuine `buildPrincipalDashboard(schoolId)` — and has **zero frontend consumers anywhere**. No principal/headteacher page exists to call it. |

**This last one is the single most important finding in this audit.** Somewhere upstream of this sprint, real engineering work built exactly the headteacher decision-support surface Part 3 found missing — and it has no front door. It is not a stub; it is a dead-ended, real capability. The gap this sprint's mission asks about ("what decisions can a headteacher make today") already has a partial answer sitting unused in the codebase.

---

## Part 8 — Operational Events Audit

**The entire platform event bus is currently a silent no-op in production.** `publishEvent()` (`lib/events/publish.ts:11`) writes to `platform_events`, defined in `supabase/migrations/20260701_phase8_platform_foundation.sql:577-677` alongside `organizations`, `event_subscriptions`, `event_deliveries`, `api_keys`, and more — **none of which appear in `lib/database.types.ts`**, which is generated from the live schema. This confirms the entire migration was never applied live. Every `publishEvent()` call throws inside `WebhookRepository.insertEvent`, matching the `Could not find the table 'public.platform_events'` errors observed repeatedly during this session's own live testing.

**27 call sites, 23 distinct `event_type` strings**, spanning billing, assessments, report cards, holiday plans, lesson plans, school/organization membership, Compass sessions, and parent observations (full table in the research transcript — key ones for this sprint: `teacher.assessment.published` at `lib/core/assessments.ts:117`, `teacher.report_card.published` at `lib/core/report-cards.ts:134`, both fired correctly by Sprint 10A's own pipeline and both currently swallowed). Every call site wraps the failure in a caught, logged `.catch()` — never crashes a caller, never surfaces to a user, never gets noticed without reading server logs.

**Even if the table existed, nothing would consume the events.** `registerEventHandler()` is never called anywhere — the internal-handler registry is permanently empty. `createSubscription()` is never called anywhere — zero subscriptions could ever exist, so `scheduleDeliveries()` would always find zero matches. The one dispatch mechanism that does exist (`app/api/cron/events/dispatch/route.ts`) is **not listed in `vercel.json`**'s 4 configured crons, so it never runs in production regardless.

**Consequence for this sprint specifically**: Sprint 10A's End-of-Term pipeline correctly fires `teacher.assessment.published` and `teacher.report_card.published` at exactly the right moments. Architecturally this was the right instinct — publish an event, let downstream systems (parent notification, academic-office dashboards, audit logs) react. In practice, right now, both events vanish. Nothing downstream reacts because nothing downstream *can* react — the entire mechanism designed for this is unwired end to end.

---

## Part 9 — School Readiness

**One teacher**: Workable today for the *legacy* teaching loop — scheme of work, lesson plans, record of work, assessment marking, evidence generation, and end-of-term reporting via the Academic Clinic pipeline are all real, tested, and already reach parents via WhatsApp/email automatically. The *new* Core End-of-Term flow (Sprint 10A) also technically works end-to-end but is unreachable without a direct URL — a solo teacher would never discover it and would default to the legacy path.

**Five teachers**: Still fine on the legacy path. The Core bridge (Sprint 9F) and this session's permission-isolation tests confirm cross-teacher, same-school correctness holds up (`canManageAssessment`, cross-school isolation tests all passing). No structural blocker for a small staff.

**Twenty teachers / five hundred learners**: This is where the gaps in Parts 4 and 7 stop being edge cases and become blocking. A school this size needs someone to actually *manage* terms, subjects, classes, and promotions across a full academic year — and every one of those is API-only. There is no realistic path for a non-developer academic office to run a 20-teacher school's admin calendar through the product. The attendance gap (Part 1) also stops being ignorable at this scale — a paper register or a separate tool becomes mandatory, not optional.

**One thousand learners / three campuses**: Multi-tenancy exists at the data layer (school-scoped queries, RLS-style checks in most repositories, confirmed cross-school isolation tests), but there is no cross-campus or cross-school *visibility* anywhere — no headteacher dashboard, no academic-office rollup, and the one real principal-dashboard backend (Part 7) has no frontend. Operationally, running three campuses today would mean three separate sets of developer-run scripts, not one product.

**Ten schools**: The `/admin/*` gate being hardcoded to a single personal email (`proxy.ts:98-103`) is disqualifying on its own at this scale — there is no platform-admin role model at all, only one person's account. Combined with the fully non-functional event bus (Part 8), there is no way to operate, monitor, or audit ten schools' worth of activity through the product today.

**Verdict**: EduNexus is genuinely ready for **one to a handful of teachers operating through the legacy path**, technically capable but practically unreachable for the new Core End-of-Term workflow, and **not yet ready** for a real medium-or-larger school's administrative operations — not because the underlying engines are wrong, but because the operational surface around them (academic office UI, headteacher UI, attendance, working notifications, a real admin role model) is either missing or built-but-unlinked.

---

## Part 10 — "LMS on Steroids" Validation

Classified against repository evidence only — no marketing language.

| Workflow | Tier | Why |
|---|---|---|
| Evidence / Projection | **Educational Intelligence** | Evidence-anchored, confidence-scored, recomputed on new data — not present in any commodity LMS |
| Compass (AI tutor) | **Educational Intelligence** | Real DeepSeek-backed tutoring loop, correctly server-routed |
| Career Intelligence | **Educational Intelligence** | Deterministic + AI-augmented capability matching, genuinely differentiated |
| Ranking / Grading engines | **Enhanced LMS** | Canonical, configurable, well-tested — solid, but most serious SIS/LMS platforms have grading engines too |
| Report Cards / Publication (post Sprint 10A) | **Enhanced LMS, capped by reachability** | The pipeline itself is Educational-Intelligence-adjacent (Ranking/Grading-derived, not raw marks), but a workflow nobody can find is not yet delivering that tier's value |
| Academic Office operations (years/terms/subjects/promotions/transfers) | **Below Commodity LMS** | A basic school SIS ships admin screens for these; EduNexus ships an API and nothing else — this is currently a regression relative to a plain LMS, not an enhancement |
| Attendance | **Absent** | Commodity-LMS baseline feature, not present at all, while being marketed as present |
| Headteacher/Principal oversight | **Absent as delivered capability, Educational-Intelligence-tier if wired** | `buildPrincipalDashboard` (Part 7) is real and sophisticated — but zero delivered value at Absent-tier today because there is no UI |
| Notifications / operational events | **Below Commodity LMS** | The general event bus is a complete no-op; only a handful of hardcoded, cron-triggered legacy paths actually send anything. A commodity LMS's basic "email on grade posted" beats this today. |
| Parent communication | **Below Commodity LMS** | No messaging channel of any kind |
| Trust Intelligence (SH-001 fixes, ownership checks, publish guards) | **Trust Intelligence** | Genuinely real: cross-school isolation, publish-overwrite guards, and permission-scoped reads were specifically built and tested this session and in prior sprints — this tier is earned, not aspirational |
| School Operating System (the sprint's own framing) | **Not yet reached** | An Operating System tier requires the operational surface — admin UI, attendance, working notifications, role-differentiated landing — to exist and be reachable. Today the intelligence tiers are real; the operating-system tier around them is the gap this document documents. |

---

## Exit Question

**"If a Kenyan secondary school opened tomorrow using only EduNexus, what would the staff actually do from 7:00 AM to 5:00 PM — and where would they still have to leave EduNexus?"**

**7:00 AM — Teachers log in.** They land on a real, useful dashboard: today's mission, an attention feed of at-risk students with AI-suggested actions, weekly teaching progress, and quick links to Scheme of Work / Lesson Plans / Record of Work. This part works and is not thin.

**During the day — Teaching and assessment.** Teachers plan lessons, record work, and enter marks through the legacy-schema flow. Evidence is generated automatically and silently, exactly as designed. When an assessment is processed, parents are WhatsApp'd and emailed automatically — this genuinely happens, today, without staff intervention.

**End of term — Where the school splits into two paths.** The *product's own newest, most-tested capability* (Sprint 10A's Core End-of-Term: lock → compute → generate → publish, with a real completion-status view) is sitting at `/teacher/core-term`, fully working, and completely undiscoverable — no link, no nav item, nothing. In practice the school would keep using the legacy Academic Clinic reporting pipeline it already knows, because that's the one it can find. The better-architected path (Ranking/Grading-derived, not raw marks; SH-001-hardened; publish-gated) would sit unused unless someone with repository access told the school it existed.

**All day — Attendance.** Staff leave EduNexus immediately. There is no attendance feature — not partial, not hidden, genuinely absent from the schema — despite the marketing site claiming otherwise. A paper register or a third-party app is mandatory from day one.

**All day — The Headteacher.** This is where the gap is starkest. A headteacher opening EduNexus today has nowhere to go. There is no dashboard for school performance, teacher workload, syllabus pace, promotion readiness, or school-wide risk learners. The one screen that comes closest (`/teacher/core-term/status`) is unreachable and term-scoped only; the one *real, sophisticated* backend built for exactly this (`buildPrincipalDashboard`) has never been wired to a screen. Every decision this sprint's mission lists under "what decisions can I make today" — performance, workload, syllabus pace, promotion, risk, attendance, behaviour, trends — sends the headteacher out of EduNexus and into spreadsheets, WhatsApp groups, or memory.

**All day — The Academic Office.** They leave EduNexus for nearly everything structural: opening a term, adding a subject, promoting a cohort, transferring a learner. All four have real, working APIs and zero screens. In practice this means a developer, not office staff, runs the school's academic calendar via scripts — which is not a school operating system, it's a school with an API a developer operates on its behalf.

**All day — Parents.** They get real value where the product delivers it: end-of-term WhatsApp/email pushes (legacy path), a published report card view, Compass activity, and Career Intelligence reports. They cannot see in-progress grades, cannot message the school, cannot track attendance or homework day-to-day, and receive nothing at all when a report is published through the new Core pipeline specifically.

**5:00 PM — Teachers log out.** Nothing closes a loop for anyone above them — no event fires anywhere that anything downstream will ever see, because the entire operational event bus is a silent no-op in production, table and all.

**The honest answer**: today, EduNexus is a genuinely strong *teaching and learning intelligence layer* wrapped around a *school operations layer that mostly doesn't exist as a product surface* — not because the engineering underneath is weak (Evidence, Projection, Compass, Career Intelligence, and now a correctly-sequenced End-of-Term pipeline are all real and tested), but because almost nobody above the classroom teacher — headteacher, academic office, or a parent wanting more than a termly PDF — has a door into any of it. The bridge from "LMS on steroids" to "Educational Operating System" is not more intelligence. It is *doors*: a role model that reaches past `teacher`/`parent`/`student`, a reachable UI for the academic-office and headteacher capability that already exists in code, an attendance system that doesn't yet exist at all, and an event bus that needs one migration applied before any of the "notify the right person automatically" promise this architecture was clearly designed for can start being true.
