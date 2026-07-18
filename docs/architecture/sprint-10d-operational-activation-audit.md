# Sprint 10D — Operational Activation Audit (Reachability / Dead-Code Inventory)

**Type**: read-only architectural audit. No production code, schema, migration, or test was touched in producing this document. No ADR — every finding below is a reachability gap (a real capability with no UI path), not a canonical/architectural conflict; per the Architecture Guardian process already established in this repo, reachability gaps are never an ADR trigger on their own.

**Scope note**: this document extends Sprint 10C (`docs/architecture/sprint-10c-school-operational-readiness.md`) rather than replacing it. 10C answered "can people use this day to day" at the UX-quality level (role-by-role usability, daily timeline, decision flow, workload, an OS scorecard, a top-25 bottleneck list, a roadmap). 10D asks the narrower, mechanical question underneath it: for every route and every screen in the repository, is there a real caller? It does not repeat 10C's judgment calls; it enumerates the raw graph 10C's judgment was based on, to full exhaustiveness, and adds exact missing-UI-element detail 10C didn't go into (Part 6).

**State of the working tree**: as of this audit, nothing has been committed since `a367032` (Sprint 10A). Sprint 10B and Sprint 10C's own documents, and every `lib/core/{schoolActivation,teacherOnboarding,learnerOnboarding,academicActivation,academicBridge}.ts` file plus `app/api/core/teachers/`, are **all part of the same uncommitted diff** — i.e., 10C already audited this exact state, not an earlier one. This audit independently re-ran every reachability check below directly against the current tree rather than trusting 10C's citations, and found no drift.

**Method**: for every `app/api/**/route.ts` file (211 total), the route's URL path was grepped (as a literal string, or as a regex with `[param]` segments replaced by a template-literal-matching wildcard) across `app/`, `components/`, and `lib/`, excluding the route file itself, to find real callers. For every `page.tsx`/`layout.tsx` file (110 total), the same technique was applied to its route segment to find inbound `Link`/`href`/`router.push` references. Every "zero hits" result below was manually re-checked by hand (reading the actual grep output, not trusting the automated count) to exclude false positives (e.g. the word "cancelled" inside unrelated state-machine code, or a file's own path appearing in its own header comment) and false negatives (dynamic route segments, relative vs. absolute paths). Numbered citations are file:line where feasible.

---

## Part 1 — Operational Capability Map

Legend: ✅ yes, ⚠️ partial, ❌ no. "Usable by real school" = a non-developer staff member, logged in normally, can complete this without a direct URL or an API client.

| Capability | Backend exists | API exists | UI exists | Navigation exists | Permission model exists | Usable by real school | Pilot ready |
|---|---|---|---|---|---|---|---|
| School activation | ✅ `lib/core/schoolActivation.ts:407` `activateSchool()` | ✅ `POST /api/core/school` (`app/api/core/school/route.ts:79`) | ✅ `app/admin/core-schools/new/page.tsx` | ✅ linked from `app/admin/page.tsx:244` | ⚠️ gated to one hardcoded email, not a real role | ⚠️ only if that person is the operator | ⚠️ works, but not school-self-service |
| Teacher invitation | ✅ `lib/core/teacherOnboarding.ts:59,98` (`inviteTeacher`/`acceptTeacherInvitation`) | ✅ `POST /api/core/teachers` (`app/api/core/teachers/route.ts`) | ❌ zero `.tsx` callers (confirmed this session, see Part 2) | ❌ | ✅ `lib/core/permissions.ts` admin-tier checks | ❌ | ❌ |
| Learner admission / enrollment | ✅ `lib/core/learnerOnboarding.ts:148` (`onboardLearner`) | ✅ `POST /api/core/learners` orchestrated branch (`app/api/core/learners/route.ts:105`) | ❌ zero `.tsx` callers (confirmed this session) | ❌ | ✅ | ❌ | ❌ |
| Transfer | ✅ `lib/core/transfers.ts` | ✅ `app/api/core/transfers/route.ts` | ❌ zero callers of `/api/core/transfers` anywhere | ❌ | ✅ | ❌ | ❌ |
| Promotion | ✅ `lib/core/promotions.ts` (`runAnnualPromotion`, `previewPromotion`) | ✅ `app/api/core/promotions/route.ts` | ❌ zero callers of `/api/core/promotions` anywhere | ❌ | ✅ | ❌ | ❌ |
| Assessment (create/mark/publish) | ✅ real, tested | ✅ `app/api/teacher/assessments/**`, `app/api/core/assessments` | ✅ `app/teacher/classes/[classId]/assessments/**` | ✅ nav-linked via My Classes | ✅ | ✅ | ✅ |
| Evidence generation | ✅ `lib/assessments/evidence.ts:51` fires from 3 call sites | n/a (automatic, fire-and-forget) | n/a by design | n/a | ✅ | ✅ (silent, by design) | ✅ |
| Projection (Learner Record) | ✅ `lib/projection/recompute.ts` | consumed internally | ✅ surfaces inside Blueprint/Compass/Career screens | ✅ | ✅ | ✅ | ✅ |
| Compass (AI tutor) | ✅ | ✅ `app/api/learn/**` | ✅ `app/learn/page.tsx` | ✅ nav-linked (student/parent) | ✅ | ✅ | ✅ |
| Career Intelligence | ✅ | ✅ `app/api/career/**` | ✅ `app/(parent)/career-intelligence*`, `app/(student)/career*` | ✅ nav-linked | ✅ | ✅ | ✅ |
| Academic Clinic (legacy) | ✅ | ✅ | ✅ `app/dashboard/clinic/**`, `app/academic-clinic` | ✅ nav-linked | ✅ | ✅ | ✅ |
| Report Cards (Core / End-of-Term) | ✅ real, tested (Sprint 10A) | ✅ `/api/core/{assessments,reports,school/end-of-term}` | ✅ `app/teacher/core-term/{page,status}` | ❌ zero nav entries (`components/teacher/TeacherSidebar.tsx:15-29`, `TeacherBottomNav.tsx:16-33` — no End-of-Term entry in either array, re-confirmed this session) | ✅ | ❌ URL-only | ❌ |
| Ranking / Grading | ✅ real, tested | consumed internally by report cards | n/a (config, not a screen) | n/a | ✅ | ✅ | ✅ |
| Academic Year mgmt | ✅ `lib/core/*` via activation defaults | ✅ `app/api/core/academic-years/route.ts` | ❌ zero callers | ❌ | ✅ | ❌ | ❌ |
| Terms mgmt | ✅ | same route as above | ❌ | ❌ | ✅ | ❌ | ❌ |
| Subjects mgmt | ✅ | ✅ `app/api/core/subjects/route.ts` | ❌ zero callers | ❌ | ✅ | ❌ | ❌ |
| Classes mgmt | ✅ | ✅ `app/api/core/classes/route.ts` | ⚠️ read-only GET picker inside `app/teacher/core-term/{page,status}` only | ⚠️ same as core-term (unreachable) | ✅ | ❌ | ❌ |
| Parents (report/Compass/Career) | ✅ | ✅ | ✅ `app/(parent)/**` | ✅ | ✅ | ✅ | ✅ |
| Messaging (parent↔school, staff↔staff) | ❌ doesn't exist | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| Notifications (Core path) | ⚠️ legacy path only (`lib/academicClinic/assessmentPipeline.ts:237-264`) | ⚠️ legacy only | n/a | n/a | n/a | ⚠️ legacy schools only | ❌ Core path |
| Attendance | ❌ no table (`grep -ni attendance lib/database.types.ts` → 0 hits, re-confirmed) | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| Timetable | ❌ **0 hits** for "timetable" anywhere in `lib/`, `app/`, `types/` (newly checked this sprint, not covered by 10B/10C) | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| Discipline / behaviour | ❌ no concept anywhere (10B Part 3, re-confirmed) | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| Guidance / counselling | ❌ **0 hits** for "guidance"/"counsel" as a platform feature (newly checked; the one "Counselling Psychologist" career-seed label is unrelated) | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| Headteacher dashboard | ✅ `lib/school/intelligence.ts` `buildPrincipalDashboard()` | ✅ `app/api/school/intelligence/route.ts` | ❌ zero callers (confirmed this session — only its own service/route file import it) | ❌ | ✅ | ❌ | ❌ |
| School academic readiness report | ✅ `lib/core/academicActivation.ts:223` `getSchoolAcademicReadiness()` | ❌ **no route wraps it at all** | ❌ | ❌ | n/a | ❌ | ❌ |
| Strand health | ✅ | ✅ `app/api/school/strand-health/route.ts` | ❌ zero callers | ❌ | ✅ | ❌ | ❌ |
| Intervention efficacy | ✅ | ✅ `app/api/school/intervention-efficacy/route.ts` | ❌ zero callers | ❌ | ✅ | ❌ | ❌ |

---

## Part 2 — Dead APIs

211 route files enumerated. 61 had zero string-level hits on first pass; after regex-correcting for dynamic `[param]` segments (which a naive literal grep misses — e.g. `/api/academy/cohort/[id]/leave` is called as `` `/api/academy/cohort/${id}/leave` ``), the confirmed list is **48 routes with genuinely zero callers**, classified below. (Every entry was individually verified by reading the actual route file's header comment or content, not just the grep count.)

**Cron-only (legitimately backend-only — scheduled invocation, no UI caller expected)**:
- `app/api/cron/academy-nudge`, `ai-log-retention`, `billing-renewals`, `dlq-requeue`, `friday-generation`, `generate-record-of-work`, `projection-events/process`, `quota-alerts`, `sandbox-reset`, `snapshot-metrics`, `study-group-challenges`, `term-readiness` — all correctly cron-shaped (12 of 18 cron directories; the other 6 already have real UI-adjacent callers or are covered by 10B's cron inventory). Note per 10B/10C: of these, only 3 (`friday-generation`, `generate-record-of-work`, plus `auto-publish-holiday-plans`/`ai-log-retention` in `vercel.json`) are actually scheduled in production; `academy-nudge`, `parent-pulse`, `term-readiness` run via `.github/workflows/notification-crons.yml`; the rest (`dlq-requeue`, `projection-events/process`, `billing-renewals`, `quota-alerts`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges`, `jobs/process`) are unscheduled anywhere — dead in production, not merely UI-less. This is a re-confirmation of 10C Part 6, not a new finding.

**Webhook / external-callback (legitimately no in-app UI caller)**:
- `app/api/callback/route.ts` — Supabase/OAuth redirect target, configured in the auth provider console, not clicked from within the app.
- `app/api/whatsapp/inbound/route.ts` — Meta WhatsApp Business webhook.
- `app/api/payments/callback/route.ts`, `app/api/payments/verify/route.ts` — did not appear in the zero-caller list (Paystack SDK/redirect calls these directly from outside the repo's own `.tsx` graph, which is expected and correct).

**Monitoring / ops (legitimately external-caller-only)**:
- `app/api/health/route.ts` — "used by UptimeRobot / monitoring" (own header comment).
- `app/api/platform/health/route.ts`, `app/api/platform/metrics/route.ts` — monitoring/load-balancer targets.
- `app/api/admin/init/route.ts` — one-time `ADMIN_SECRET`-gated bootstrap, ops-script by design.
- `app/api/admin/career/seed/route.ts` — one-time data-seed script, ops-only by design.

**Truly orphaned (no legitimate non-UI reason found; a real caller should exist but doesn't)**:
- `app/api/core/teachers/route.ts` — the teacher-invite orchestration endpoint (Part 1, top bottleneck).
- `app/api/core/learners/route.ts`'s orchestrated branch — same pattern (the plain-admission branch is also uncalled).
- `app/api/core/academic-years/route.ts`, `app/api/core/subjects/route.ts`, `app/api/core/promotions/route.ts`, `app/api/core/transfers/route.ts` — all confirmed zero `.tsx` callers, re-verified this session with corrected regex matching.
- `app/api/core/school/end-of-term/route.ts` — zero callers found by path-string search; the actual End-of-Term UI (`app/teacher/core-term/**`) calls other, narrower Core routes instead (`/api/core/{assessments,reports}`), so this route itself appears to be dead weight or a superseded earlier shape — worth a direct code read before assuming intent, but out of scope for this read-only pass to resolve.
- `app/api/school/intelligence/route.ts` — `buildPrincipalDashboard()`'s only door, zero callers (10B/10C's "single most important finding," re-confirmed).
- `app/api/school/intervention-efficacy/route.ts`, `app/api/school/strand-health/route.ts` — same shape, not previously itemized by name in 10B/10C.
- `app/api/admin/teachers/route.ts` — a second, distinct admin-facing teacher-list endpoint from `/api/core/teachers`, itself uncalled; worth noting as a possible duplicate-intent route, not just a dead one.
- `app/api/auth/verify-email/route.ts` — no caller; email verification appears to happen through Supabase's own flow instead, making this route's own purpose unclear from reachability alone.
- `app/api/beta/teacher-count/route.ts`, `app/api/early-access/register/route.ts`, `app/api/referrals/stats/route.ts` — zero callers; these look like they should back marketing-site widgets (`app/(marketing)/**`) but the marketing pages don't call them.
- `app/api/generate/route.ts` — its own header comment says "Generic generation stub — gate with checkFeatureAccess pending full implementation." Explicitly an unfinished stub, not a completed dead route.
- `app/api/search/route.ts` — a real, non-trivial search implementation (`lib/search`) with zero UI callers; no command-palette or search box exists anywhere to use it.
- `app/api/share/generate/route.ts` — zero callers; no "share" button found anywhere in `app/` or `components/`.
- `app/api/student/join-class/route.ts` — zero callers; the real join flow (`app/join/[inviteCode]/page.tsx:36`) calls `/api/class/join` instead, a different route with the same apparent purpose — a second confirmed duplicate-intent pair.
- `app/api/tokens/check/route.ts` — zero callers; token-balance gating happens via direct server-side `lib/payments/access.ts` imports inside other routes, not through this endpoint.
- `app/api/users/create/route.ts` — zero callers; its own comment says "Called post-signup," but the actual signup page (`app/(auth)/signup/page.tsx:82`) calls `/api/auth/complete-profile` instead — comment is stale, route is orphaned.
- `app/api/users/use-free-analysis/route.ts` — zero callers.
- `app/api/remedial/list/route.ts` — zero callers, while its sibling `app/api/remedial/generate/route.ts` is genuinely called from `app/teacher/classes/[classId]/page.tsx`; `app/api/teaching-intelligence/remedial-bank/route.ts` may have superseded the `list` read path — plausible but unconfirmed from reachability alone.
- `app/api/teacher/teaching-patterns/route.ts`, `app/api/teacher/prerequisite-readiness/route.ts` — both real, sophisticated Knowledge-Graph-backed features (own header comments describe genuine capability: "the closed loop: teacher sees what their OWN formative signals reveal," "Before I teach X, how many students are missing the prerequisites?") with zero UI callers — two more instances of the "real backend, no door" pattern 10B/10C named, not previously itemized by name.
- `app/api/teacher/classes/[classId]/archive/route.ts`, `app/api/teacher/grade-scales/[id]/route.ts`, `app/api/teacher/students/[studentId]/promote/route.ts`, `app/api/teacher/students/[studentId]/remarks/route.ts`, `app/api/teacher/students/[studentId]/timeline/route.ts` — all zero callers; several (`promote`, `timeline`) look like legacy-schema analogues to Core's promotion/transfer gap.

---

## Part 3 — Dead Screens

110 `page.tsx`/`layout.tsx` files enumerated; layouts and the marketing root page excluded (a root layout or a site's own homepage doesn't need an inbound `Link` — it's the entry point). Confirmed dead/dormant, each individually re-verified to rule out false positives from generic word matches:

| Screen | Status | Evidence |
|---|---|---|
| `app/teacher/core-term/page.tsx`, `app/teacher/core-term/status/page.tsx` | **Live but Dormant** | Only cross-references are the two files linking to each other (`page.tsx:185`, `status/page.tsx:107`); zero references anywhere else in `app/`, `components/` — re-confirmed with corrected search (10C's finding stands unchanged) |
| `app/admin/cleanup/page.tsx` | **Live but Dormant** | Only "hit" is `components/admin/CleanupDashboard.tsx`'s own internal `fetch('/api/admin/cleanup-stats')` call, not an inbound page link; zero `Link`/`href` to `/admin/cleanup` anywhere |
| `app/dashboard/learning-compass/page.tsx` | **Dead** | `setTimeout` redirect shim (10B/10C, re-confirmed) |
| `app/dashboard/referrals/page.tsx` | **Prototype, Dormant** | Zero fetch calls, zero inbound links (10B/10C, re-confirmed) |
| `app/organizations/[orgId]/settings/page.tsx` | **Dead — new finding this sprint** | Zero references to an `orgId`+`settings` combination anywhere outside the file itself; the org layout/nav does not link to it |
| `app/(parent)/career-report/page.tsx` | **Dead — new finding this sprint** | Zero inbound references; superseded in practice by `career-intelligence-report`, which the parent nav (`DashboardNavbar.tsx`) and `career-intelligence/page.tsx:331` both actually link to |
| `app/payment/cancelled/page.tsx` | **Not dead — external redirect target** | Zero in-app `Link`s, but this is a Paystack callback-redirect destination (like `payment/success`/`payment/failed`), not clicked from within the app — legitimate absence of inbound navigation, different category from the others in this table |
| `app/preview/career-intel/page.tsx` | **Dead — new finding this sprint** | Zero inbound references anywhere; appears to be a leftover preview/demo route |
| `app/teacher/insights/page.tsx` | **Dead — new finding this sprint** | Zero inbound references; every apparent "hit" for "insights" is actually the unrelated marketing blog (`app/(marketing)/insights/**`) or the per-class `/api/teacher/classes/[classId]/insights` API — a genuine false-positive risk this audit specifically controlled for |

Screens confirmed **not** dead despite an initial zero-hit signal, included here to show the false-positive-control method held: `app/teacher/booklet/[scheme_id]/page.tsx` (linked from `app/teacher/booklets/page.tsx:65`).

---

## Part 4 — Navigation Graph

**Teacher Dashboard** (`components/teacher/TeacherSidebar.tsx:15-29`, `TeacherBottomNav.tsx:16-33` — 15 identical entries in both):
```
/teacher/dashboard (landing)
├── /teacher/classes → [classId] → assessments, students, compass, differentiation, insights (all real, API-backed)
├── /teacher/scheme-of-work → [id] / new
├── /teacher/lesson-plans → [planId]
├── /teacher/documents
├── /teacher/booklets → /teacher/booklet/[scheme_id]
├── /teacher/record-of-work → [id]
├── /teacher/assignments → new, [assignmentId], [assignmentId]/results
├── /teacher/slides
├── /teacher/kiswahili/insha
├── /teacher/analytics
├── /teacher/alerts
├── /teacher/reports → /teacher/reports/{blueprint,career-intelligence}/[studentId]
├── /teacher/academy → cohort/[id], cohort/new, mission/[id], module/[slug], portfolio, certificate
└── /teacher/settings
BROKEN BRANCH: /teacher/core-term and /teacher/core-term/status exist, are fully functional (Sprint 10A), and have no entry in either nav array — real capability, no link (Part 3).
BROKEN BRANCH: /teacher/insights exists and has zero nav entry and zero inbound link from anywhere — orphaned screen, not just missing from nav (Part 3, new finding).
```

**Parent** (`app/dashboard/components/DashboardNavbar.tsx:10-14,18-22`):
```
/dashboard (landing)
├── /learn (Compass)
├── /career-intelligence (overridden label "Careers") → /career-intelligence-report
├── /dashboard/clinic → reports/[studentId]
├── /dashboard/assignments
├── /pricing (Upgrade)
└── /report-card (app/(parent)/report-card) — reachable but not in DashboardNavbar's own array; reached via a different entry point (report-card page itself, confirmed present under app/(parent)/)
BROKEN BRANCH: /career-report exists, has real data wiring, but nothing links to it — career-intelligence-report is what's actually reachable (Part 3).
```

**Student** (`DashboardNavbar.tsx` student-mode links, `app/student/page.tsx`):
```
/student (landing)
├── /learn (Compass)
├── /career → /career/[slug]
├── /blueprint
├── /holiday
├── /progress
└── /student/groups → [groupId]
No broken branches found in this tree.
```

**School Admin** (gated to `NEXT_PUBLIC_ADMIN_EMAILS`, `app/admin/page.tsx:238,244`):
```
/admin (landing)
├── /admin/pilot
└── /admin/core-schools/new
BROKEN BRANCH: /admin/cleanup exists, real data, zero link from /admin or anywhere (Part 3).
No path exists from here to teacher-invite, learner-admission, term/subject management, promotion, or transfer — those capabilities have no page to link to at all (Part 1/2).
```

**Headteacher, Academic Office**: **no landing page exists for either role** — `find app -maxdepth 1 -iname "*principal*" -o -iname "*headteacher*" -o -iname "*office*"` returns nothing (10C Part 3, re-confirmed unchanged). There is therefore no navigation graph to draw for these two roles; every capability that would live under them (`buildPrincipalDashboard`, `getSchoolAcademicReadiness`, years/terms/subjects CRUD, promotions, transfers) is reachable only by direct API call, never by click, from any starting point.

**Platform Admin**: same surface as "School Admin" above — there is no separate platform-vs-school-admin distinction in the codebase; both terms describe the same single hardcoded-email gate.

---

## Part 5 — Operational Workflow Coverage

| Workflow | Classification | Evidence |
|---|---|---|
| Morning arrival / attendance | **Missing** | No table, no route, no screen (Part 1) |
| Lessons (planning) | **Complete** | Scheme of Work / Lesson Plans nav-linked, real writes |
| Attendance (daily) | **Missing** | Same as above; distinct from report-card `days_present`/`days_absent`, which is End-of-Term data entry, not attendance |
| Assessment (create → mark → evidence) | **Complete** | Nav-linked, real, tested, Evidence fires automatically |
| Homework (assignments) | **Partial** | Teacher-side complete (`/teacher/assignments`); no parent-facing tracking (10B/10C, unchanged) |
| Reports (Core End-of-Term) | **Dead End** | Pipeline complete and tested; zero nav path (Part 3/4) |
| Reports (legacy Academic Clinic) | **Complete** | Real, working, parent-notified automatically |
| Parent Communication | **Missing** | No two-way channel anywhere (Part 1) |
| Promotion | **Backend Only** | `runAnnualPromotion`/`previewPromotion` real, zero callers (Part 1/2) |
| Transfer | **Backend Only** | `lib/core/transfers.ts` real, zero callers (Part 1/2) |
| Graduation | **Missing** | No distinct concept beyond promotion's terminal case; no archive/graduation screen or API found |

---

## Part 6 — UX Activation Gaps

For each backend capability confirmed reachable by API only, the exact missing UI element and where it belongs:

1. **Teacher invitation** (`POST /api/core/teachers`) — missing: an "Invite Teacher" button + email/role form + pending-invitation list, on a new Academic Office screen (which doesn't exist yet — see item 7) or, as a minimal stopgap, a card on `app/admin/page.tsx` next to the existing "Create School" card at `app/admin/page.tsx:244`.
2. **Learner admission/enrollment** (`POST /api/core/learners` orchestrated branch) — missing: an "Admit Learner" multi-step form (learner details → guardian → class assignment) with a submit button that posts the `class_id`-present payload shape the route already branches on (`app/api/core/learners/route.ts:105`); belongs on the same not-yet-built Academic Office screen.
3. **School activation result** (`activateSchool()`'s returned `activation.status`/`activation.steps`) — missing: a success/partial-failure summary panel on `app/admin/core-schools/new/page.tsx` itself, which currently calls `router.push('/admin')` immediately on 201 without reading `data.activation` at all (10C bottleneck 15, re-confirmed unchanged this session) — this is the cheapest fix in the whole audit: no new component, just read a field already in the response.
4. **End-of-Term / core-term** (`app/teacher/core-term/{page,status}`) — missing: one `NAV` array entry in `components/teacher/TeacherSidebar.tsx` (after line 27, "Reports") and one entry in `CREATE_NAV`/`MORE_NAV` in `TeacherBottomNav.tsx` — zero new components required, this screen already renders correctly.
5. **Promotion** (`runAnnualPromotion`/`previewPromotion`) — missing: a confirmation-dialog-gated "Run Promotion" action with a preview step (the function already distinguishes preview from run) on the not-yet-built Academic Office/Headteacher screen; needs a progress indicator given it's a batch operation across a cohort.
6. **Transfer** — missing: a learner search + destination-class picker + confirm dialog, same target screen as promotion.
7. **Headteacher dashboard** (`buildPrincipalDashboard`, `app/api/school/intelligence/route.ts`) — missing: the entire screen. This is the single largest gap in the audit — a fully real, auth-correct backend with literally nowhere to render. Needs its own route (e.g. `app/headteacher/page.tsx`), which in turn needs a role check beyond the current 3-value `UserRole` enum (`lib/auth/getRole.ts:5`) to land a headteacher there instead of the generic teacher dashboard.
8. **School academic readiness** (`getSchoolAcademicReadiness()`) — missing both a route (none exists at all, unlike the other orphaned capabilities which at least have an unused route) and a UI card; natural home is a "Readiness" panel at the top of the same not-yet-built Academic Office/Headteacher screen, since it already returns `overallReady` + `blockingReasons[]` shaped exactly for a status banner.
9. **Years/terms/subjects/classes CRUD** — missing: basic list+create+edit tables for each, same target screen.
10. **Prerequisite readiness / teaching patterns** (`app/api/teacher/{prerequisite-readiness,teaching-patterns}`) — missing: these are teacher-facing, not office-facing; the natural home is a card on the existing `app/teacher/dashboard/page.tsx` or `app/teacher/analytics/page.tsx`, both of which already render real per-teacher data and would only need one more `fetch()` + card component, no new page.

---

## Part 7 — Operational Priority Matrix

| # | Item | Educational impact | Pilot importance | Dev effort | Architectural risk | Trust impact | Bucket |
|---|---|---|---|---|---|---|---|
| 1 | Fix `core-schools/new` to display activation result (Part 6.3) | Low | Med | Trivial (1 file) | None | Med — silent partial failure is a trust hazard | **Immediate** |
| 2 | Link `core-term` into teacher nav (Part 6.4) | High | High | Trivial (2 files, nav arrays only) | None | Low | **Immediate** |
| 3 | Teacher-invite screen over `/api/core/teachers` (Part 6.1) | High | High | Low (form + existing endpoint) | None | Low | **Immediate** |
| 4 | Learner-admission screen over `/api/core/learners` (Part 6.2) | High | High | Low-Med (multi-step form + existing endpoint) | None | Low | **Immediate** |
| 5 | Minimal read-only headteacher screen over `buildPrincipalDashboard` (Part 6.7) | High | High | Med (new route + role landing) | Low (touches `lib/auth/getRole.ts`, currently 3-value) | Low | **Before Pilot** |
| 6 | Wire `getSchoolAcademicReadiness()` to a route + card (Part 6.8) | Med | Med | Low (route is trivial, UI is a status banner) | None | Low | **Before Pilot** |
| 7 | Core report-card → parent notification (10C bottleneck 5, unchanged) | High | High | Med (reuse legacy `reportNotify` shape) | Low | High — silent non-notification is trust-eroding | **Before Pilot** |
| 8 | Promotion UI over existing engine (Part 6.5) | High | Med (matters at year-end, not day 1) | Med (form + preview + confirm + progress) | None | Med (irreversible-feeling action needs a confirm step) | **Before Pilot** |
| 9 | Transfer UI over existing engine (Part 6.6) | Med | Med | Med | None | Med | **Before Pilot** |
| 10 | Years/terms/subjects/classes CRUD screens (Part 6.9) | Med | Med | Med-High (4 CRUD surfaces) | None | Low | **After Pilot** |
| 11 | Prerequisite-readiness / teaching-patterns cards on teacher dashboard (Part 6.10) | Med | Low | Low | None | Low | **After Pilot** |
| 12 | Resolve duplicate-intent route pairs (`/api/student/join-class` vs `/api/class/join`; `/api/admin/teachers` vs `/api/core/teachers`; `/api/core/school/end-of-term` unclear purpose) | Low | Low | Low (investigation + deletion, not new build) | Low — deleting the wrong one would be a real regression, needs a careful read first | Low | **After Pilot** |
| 13 | A real platform-admin role model replacing the hardcoded email (10B/10C, unchanged) | High (at scale) | Low (fine for one pilot school) | High | Med | High (single point of failure) | **Can Wait** |
| 14 | Attendance as a system (10B/10C, unchanged) | High | Med | High (new domain entirely) | None | Med (marketing-claim gap) | **Can Wait** |
| 15 | Event bus activation or retirement decision (10C bottleneck 4/6) | Med | Low for pilot scale | Med (apply migration) or Low (retire) | Med — a real architectural decision, not just code | Low | **Can Wait** |
| 16 | Parent↔school / staff↔staff messaging (10B/10C, unchanged) | High | Low for a single pilot school | High | None | Low | **Can Wait** |
| 17 | Timetable, Discipline, Guidance (new-this-sprint zero-hit findings, Part 1) | Unknown — not yet scoped as a requirement | Low | Unscoped | None | None | **Can Wait** |

---

## Part 8 — Minimal Activation Plan

Ordered punch list, reusing only existing APIs/services/permissions — no new backend logic:

1. `app/admin/core-schools/new/page.tsx`: read `data.activation` from the existing `POST /api/core/school` response and render its `status`/`steps` instead of discarding it before `router.push('/admin')`.
2. `components/teacher/TeacherSidebar.tsx` and `components/teacher/TeacherBottomNav.tsx`: add one nav entry each for `/teacher/core-term` (or `/teacher/core-term/status` as the landing sub-page) — zero new components.
3. New form screen (e.g. `app/admin/core-schools/[schoolId]/teachers/new/page.tsx` or a card on the existing admin page) that posts to the already-built `POST /api/core/teachers` with `action:'invite'` — reuse `lib/core/teacherOnboarding.ts` end to end.
4. New form screen for learner admission posting to the already-built `POST /api/core/learners` orchestrated branch (`class_id` present) — reuse `lib/core/learnerOnboarding.ts` end to end.
5. New route `app/api/school/academic-readiness/route.ts` (thin wrapper, auth-gated the same way `app/api/school/intelligence/route.ts` already is) calling the existing `getSchoolAcademicReadiness()` — the only item on this list needing a new route file, and it's a thin pass-through, not new business logic.
6. New minimal read-only screen (e.g. `app/headteacher/page.tsx`) that calls `app/api/school/intelligence/route.ts` (already real) and, once step 5 lands, the new readiness route — this is the first screen for a role that currently has none, so it will also need one addition to whatever function currently decides post-login landing (`app/(auth)/login/page.tsx:41-78`) to route a headteacher-tier `SchoolUserRole` there instead of the generic `/teacher/dashboard`.
7. Wire the Core report-card publish path (`lib/core/report-cards.ts`) to call the existing `lib/whatsapp/reportNotify.ts`/equivalent notify function the legacy pipeline already uses — reuse, not new send logic.
8. Build promotion and transfer forms (preview → confirm → run, with a progress/result state) over the existing `lib/core/{promotions,transfers}.ts`, placed on the same headteacher/academic-office screen from step 6.
9. Years/terms/subjects/classes CRUD tables on the same screen, over the already-real `app/api/core/{academic-years,subjects,classes}` routes.

Everything above reuses an existing, tested `lib/` function or API route; nothing in this plan invents new orchestration, new permission logic, or new database structure.

---

## Part 9 — LMS on Steroids Validation

**Makes EduNexus more like Moodle (commodity/table-stakes — expected of any school platform, not a differentiator)**:
- Teacher-invite screen (item 3)
- Learner-admission screen (item 4)
- Years/terms/subjects/classes CRUD (item 9 / Part 7 #10)
- Promotion/transfer UI (item 8 / Part 7 #8-9)
- Core report-card → parent notification (Part 7 #7)
- Attendance as a system (Part 7 #14)
- Parent↔school / staff↔staff messaging (Part 7 #16)
- `core-term` nav link (item 2) — the workflow itself is table-stakes ("can teachers find end-of-term reporting"); its *design* (Ranking/Grading-derived, evidence-anchored) is differentiated, but reachability alone is a commodity bar

**Makes EduNexus more like an Educational Operating System (strategic differentiator — not something a commodity LMS ships)**:
- Headteacher dashboard wired to `buildPrincipalDashboard()` (item 6) — this function is not a generic admin report; it is decision-support built directly on the Evidence/Projection layer 10B/10C both confirm is the platform's strongest layer
- `getSchoolAcademicReadiness()` wired up (item 5) — a readiness rollup with `blockingReasons[]` is the kind of proactive, evidence-anchored decision support most SIS platforms don't attempt
- Prerequisite-readiness / teaching-patterns cards (Part 7 #11) — Knowledge-Graph-backed, "before I teach X, how many students are missing prerequisites" is a capability no commodity LMS has, currently invisible only for lack of a card
- Activation-result transparency (item 1) — small, but reflects the platform's broader evidence-first/no-silent-failure posture rather than a generic UX nicety

The split is stark: every item that closes a genuine "we don't even have this" gap lands in the Moodle/commodity bucket; every item that is purely "wire an existing, sophisticated backend to a screen" lands in the Operating System bucket. This matches 10B's and 10C's own headline framing — the intelligence layer is real and differentiated; the operational layer around it is what's missing, and closing it first buys table-stakes credibility, not differentiation. The differentiated value is already built and is the cheaper of the two categories to activate.

---

## Part 10 — Exit Question

**"Tracing the exact click sequence a Headteacher, Academic Office staffer, Teacher, Parent, and Student would each attempt during Day 1 / Week 1 / Month 1 — where does each get stuck, and why?"**

**Headteacher** — Day 1: logs in, lands on the generic `/teacher/dashboard` (no role-differentiated landing exists — `app/(auth)/login/page.tsx:41-78` only distinguishes teacher vs. parent/student paths). Clicks through `TeacherSidebar`'s 15 links looking for "my school," finds nothing — no headteacher-scoped screen exists anywhere in `app/`. **Stuck immediately: Missing UI** (the backend, `buildPrincipalDashboard`, is real — Part 1/2 — so this is not Missing Backend). Week 1/Month 1: never returns to look for promotion, readiness, or risk aggregation, because nothing on Day 1 suggested those exist.

**Academic Office staffer** — Day 1: same generic teacher landing, same 15-link sidebar, no "manage school" entry point exists. Trying to open a term, add a subject, or invite a colleague requires typing a raw API URL or having a developer run a `curl` command — no login-reachable path exists at all. **Stuck immediately: Missing UI**, compounded by **Missing Workflow** (no academic-office route tree exists to eventually contain these screens, per Part 4).

**Teacher** — Day 1-Week 1: works well. Scheme of Work, Lesson Plans, marking, Evidence generation all function through real nav-linked screens (Part 4). **Gets stuck at end of term**: the one screen built specifically for this (`/teacher/core-term`) has zero nav entry (Part 3/4) — a teacher would have to already know the URL. **Missing UI** (one nav-array edit away from fixed, per Part 6.4/Part 8 item 2), not missing backend.

**Parent** — Day 1: logs in, sees report card, Compass activity, Career Intelligence — all real (Part 1). **Gets stuck** trying to see in-progress grades (page doesn't exist), message the school (channel doesn't exist), or getting notified when a Core-schema report publishes (silent — Part 5/Part 7 #7). **Missing Workflow / Missing Backend** for the notification specifically (the send function exists for the legacy path only, not a full backend gap, but not reachable for Core either).

**Student** — Day 1-Month 1: works well throughout. Compass tutoring, XP/levels, Career Intelligence are all real, nav-linked, and unchanged by this sprint's findings (Part 1/4). No stopping point found for this persona in this audit.

---

**Headline finding**: 48 API routes and 9 screens are confirmed reachable-by-nobody (Parts 2-3), on top of the pattern 10B/10C already named. The two costliest-to-miss capabilities in the whole platform — `buildPrincipalDashboard()` (a real, evidence-anchored headteacher decision-support engine) and `getSchoolAcademicReadiness()` (a real readiness rollup) — remain fully built and fully unreachable, exactly as 10C found, now confirmed with an exhaustive route-by-route sweep rather than spot checks. Nothing in this sweep contradicts 10C; it sharpens the same finding into a punch list (Part 8) that reuses 100% existing backend.
