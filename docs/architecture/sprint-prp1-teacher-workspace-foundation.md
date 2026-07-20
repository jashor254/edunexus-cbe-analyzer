# Sprint PRP-1 — Teacher Workspace Foundation (Pilot Readiness Program, Sprint 1)

**Status: AUDIT + DESIGN ONLY.** No table, migration, repository, service, route, or UI was created or changed in producing this document. This sprint begins the Pilot Readiness Program (PRP) — the shift from building constitutional domains (Sprints 6–13I) to making the platform usable, every school day, by a real Kenyan teacher.

**Precedes**: ADR-0019 (the decision this document resolves into).
**Depends on**: `docs/architecture/canonical-domain-registry.md`, `docs/architecture/reference-architecture-specification.md`, ADR-0003/0004 (Attendance), and the Pilot Readiness Wave 1–5 findings (see project memory).

---

## Phase 1 — Audit Before Building

Eight parallel audits were run against every teacher-facing route, service, and lib module. Findings below are grounded in the actual code as of 2026-07-18, not assumed from documentation.

### 1.1 Dashboard, Navigation, Settings, Setup

- **`app/teacher/dashboard`** is a genuinely mature landing page: `lib/attentionFeed/*` drives `AttentionFeed`, `TodaysMission`, `ContinueWorking`, `WeeklyTeachingProgress`. This is the one place in the codebase that already does "always-on intelligence, quietly presented" correctly. **Core of the future Workspace entry point.**
- **`app/teacher/layout.tsx` + `TeacherSidebar`/`TeacherBottomNav`** is already the de-facto Workspace shell — every `/teacher/*` route is wrapped by it, auth- and role-gated, single nav source. This is the right foundation to formalize, not replace.
- Two structural nav problems exist today: (a) desktop sidebar and mobile bottom-nav group the **same items differently** (bottom-nav collapses items into Create/More sheets that don't match the sidebar's flat list) — "where do I click" already varies by device; (b) a teacher with a parent account is dropped into an **entirely separate navigation shell** (`app/dashboard` + `DashboardNavbar`, ~1400 lines, its own top nav and bottom nav), bridged only by a small banner link. A dual-role user experiences two unrelated apps, not one workspace with a role switch.
- **Settings** (`/teacher/settings`) and **Setup** (`/teacher/setup`) both write overlapping fields to the same `teachers` row via `/api/teacher/profile`. Setup is correctly excluded from the persistent nav (it's a pre-workspace onboarding gate triggered when no `teachers` row exists) — Setup and Settings should share one form definition, not two, to remove the duplicate-entry risk this creates.

### 1.2 Attendance

- Owner: `lib/core/attendance.ts` + `AttendanceRepository`. **The most architecturally mature domain audited** — ADR-0003/0004's promises (Session/Record/Summary split, derived-not-stored summary, write-only-through-service) are verified true in the live code, not just documented. Navigation is correctly wired in both sidebar and bottom-nav.
- **Gap**: no Paper → Hybrid → Digital adoption ladder exists anywhere in the Attendance ADRs or code — it was explicitly out of scope for ADR-0003. Attendance today is **digital-only**: a teacher must open the app and mark a live roster. There is no paper-fallback or delayed-entry workflow. This is the single largest gap between the current build and this sprint's "respect Kenyan classroom reality" mandate — addressed in Phase 5.

### 1.3 Assessment

- Two teacher-visible destinations serve genuinely different jobs, not a UI duplication a teacher notices: **`/teacher/classes/[classId]/assessments`** (marks entry — the only place scores are actually typed in, backed by the legacy `lib/assessments/*`) and **`/teacher/core-term`** (lock/compute/publish, backed by the canonical `lib/core/assessments.ts`). The backend duplication the Canonical Domain Registry already flags (`TARGET (Phase A)`) is real but invisible to a teacher — these two screens don't collide on screen, they're sequential steps.
- `/api/teacher/assessments/process`, fired from the class page, triggers the AI auto-report/capability pipeline (`lib/academicClinic/assessmentPipeline.ts`) — load-bearing for the class page today; the Workspace design must not route around it.
- **No unified "Assessment" nav entry exists** — a teacher reaches marks entry only by drilling into a specific class, and reaches term-close only via a dashboard card or the admin checklist. Nothing on screen tells a teacher these are two steps of one job.

### 1.4 Lesson Planning, Scheme of Work, Record of Work

- These three are a **real, data-enforced pipeline**, not disconnected silos: `schemes_of_work` → `lesson_plans` (requires `sow_id`) → `records_of_work` (populated by a weekly cron from completed lesson-plan weeks). This is confirmed by foreign keys, not inferred from naming.
- The **Record of Work cron deliberately does not gate on the `taught` flag** — its own code comment states teachers "often teach offline and never mark lessons taught." This is the platform already, correctly, assuming offline/paper-first teaching for this one workflow — a pattern to generalize, not an anomaly.
- Despite the real pipeline, the UI presents three **peer sidebar items** with no guided flow between them (partial forward-links exist from the SOW detail page, but a teacher landing on Lesson Plans or Record of Work directly sees no indication of the dependency chain).
- Minor architecture-rule note (not fixed this sprint — audit-only): the cron's Record-of-Work generation logic lives in the route file, not `lib/row/`, a violation of "API routes are thin — call lib/ functions only." Flagged for a future small-fix sprint, not in scope here.

### 1.5 Report Cards

- Two **entirely separate, permanently visible nav items** — "Reports" (the AI/Academic-Clinic path, `lib/academicClinic/assessmentPipeline.ts` + `lib/career/autoReportGenerator.ts`) and "End of Term" (the canonical `lib/core/report-cards.ts` path) — both use the word "report(s)" in their own screen content. A teacher has no way to know which one is "the" report card action. The "Reports" page's "Other Reports" tab additionally bundles KNEC export and a SOW-generator link, diluting the label further.
- This is the sharpest **navigation-honesty problem** found in the audit: two working features, sharing a name, with zero cross-linking, representing genuinely different artifacts (parent-communication PDF vs. official `school_report_cards`).

### 1.6 Intelligence Surfaces (Compass, Career, Insights) — presentation only, not redesigned

- The Attention Feed / Today's Mission pattern on `/teacher/dashboard` is the **one correct reference implementation** of "always-on intelligence, quietly presented" in the whole codebase.
- Everything else is under-surfaced: **`/teacher/insights`** is fully built with zero nav entry (URL-only). **Monday Panel** is buried inside a specific class's detail page rather than being class-agnostic triage. **Career Intelligence** is two drill-down clicks deep (Classes → student → Career Intelligence). **Cohort compare** is correctly a secondary destination off Analytics (no complaint there).
- Two confirmed **fully orphaned "backend exists, no UI caller"** routes: `/api/teacher/prerequisite-readiness` and `/api/teacher/teaching-patterns` — real logic, zero callers anywhere in `app/` or `components/`. This is the same recurring pattern the Wave 1–5 audits already named platform-wide.
- `app/dashboard/learning-compass` is a dead 1.5s redirect stub to a student route — legacy, not a teacher surface at all.

### 1.7 Academic Clinic, Teacher Reflection, Parent Communication

- **Academic Clinic** (`app/academic-clinic`) queries `students` by account owner, not `class_students` — it is a **parent/student self-service** report generator, not a teacher tool, despite living adjacent to teacher-triggered report generation conceptually. It does not belong inside the Teacher Workspace.
- **Teacher Reflection** (`lib/teacherReflection`) is a mature, evidence-first backend with **zero teacher-facing route or UI to create one** — only parent-facing pages read it. A real, confirmed gap: the domain exists, but a teacher cannot currently write a reflection through any screen.
- **No literal "Mwalimu Helper" feature exists anywhere in the codebase** (confirmed by exhaustive grep). The closest match to the mission brief's example is **Academy** (`app/teacher/academy`) — a mature, 8-sprint teacher-training/onboarding product (modules, missions, portfolio, certificate). It is a genuinely separate product surface (upskilling, not daily classroom operation) and correctly stays independent of the Workspace.
- **No single screen answers "was this parent told anything."** WhatsApp sends are scattered: a manual `wa.me` deep-link on the Alerts page (no delivery confirmation shown — the previously-flagged false "sent" badge bug is not present on this specific screen, but the underlying gap, an unread `notification_log`, persists per the Wave 1–5 findings) and automatic fire-and-forget sends from the report pipeline and student-add flow.

### 1.8 Miscellaneous Teacher Tools

- **Classes**, **Documents**, **Assignments**, **Alerts**, **Booklets** are all built, live, and correctly core to daily teaching.
- **Kiswahili Insha** and **AI Slides** are correctly independent, single-purpose standalone tools.
- **`core-office`, `core-team`, `core-admissions` are misplaced** — these are the School/Admin Office console (admission, staff roster, academic checklist), gated by `ADMIN_TIER_ROLES`, self-documented in their own code comments as an "Administrative Workspace," and already excluded from the main (non-admin) sidebar array. They should never be considered part of the classroom-teacher Workspace. **`core-readiness` is dead code** — a pure redirect shim kept for old bookmarks. **`core-term`** (End of Term) is the one exception in this family and correctly belongs to the teacher's daily/termly workflow.
- **Grade Scales** and per-student action routes (`compass-topic`, `promote`, `remarks`, `timeline`) are supporting APIs consumed from within other screens, correctly not standalone nav items.

---

## Phase 2 — Observe a Real Kenyan School Day

No timetable engine exists in this codebase (correctly — building one is Forbidden for this sprint), so the Workspace cannot assume live period-by-period scheduling data. The design below maps *interactions*, not a literal clock the software enforces.

| Time (illustrative) | Moment | What EduNexus should quietly do |
|---|---|---|
| Arrival | Teacher opens the app, often on a phone, often on weak data | Land on **My Day** — attendance for today's first class one tap away, one or two genuinely important nudges (Attention Feed), nothing else competing for attention |
| Before first lesson | Teacher checks what's due today | My Day surfaces: which classes need attendance taken, which lesson plan is "next" per the SOW sequence, any assessment marks still pending entry |
| During a lesson | Teacher is teaching, not on the app | Nothing. The app must not expect real-time interaction during teaching. |
| Between lessons / break | Short window, phone in hand | Mark attendance for the lesson just taught (if not done live); mark a lesson plan "taught"; a 10-second topical quick-rating if relevant — never a multi-screen form here |
| Lunch / games / clubs | Teacher may have 10–20 minutes of real availability | A good moment to enter marks for a completed assessment, or read (not act on) an Insight |
| End of day / staff meeting | Reflective, slower-paced | Teacher Reflection (currently has no entry point — a real gap this design should close), review of the week's Attention Feed, planning tomorrow's lesson |
| Home | Rare, opportunistic | Report card generation/publish, SOW/lesson-plan generation for the coming week — the AI-heavy, higher-latency actions belong here, not squeezed into a 5-minute break |

**Never** "where can AI fit" — every row above starts from what the teacher is already doing, not from a capability EduNexus has.

---

## Phase 3 — Define the Teacher Workspace

The Teacher Workspace is `app/teacher/layout.tsx` + `TeacherSidebar`/`TeacherBottomNav`, formalized and corrected, not rebuilt. Permanent sections, each justified against the audit above:

1. **My Day** (home / landing — already `app/teacher/dashboard`) — Attention Feed, Today's Mission, Continue Working. Kept exactly as built; it is the correct pattern.
2. **My Classes** — existing Classes hub; the entry point into per-class Attendance/Assessment/Teaching actions.
3. **Teaching** (new grouping, not new code) — Scheme of Work → Lesson Plans → Record of Work presented as one guided, sequential flow instead of three peer nav items, matching the real data dependency already enforced by the schema.
4. **Attendance** — stays exactly as is; the most production-ready domain. Gains a Paper/Hybrid/Digital ladder (Phase 5), not a rebuild.
5. **Assessment** — a real nav entry (currently missing) that makes the two-step nature (marks entry per class → lock/publish at `/teacher/core-term`) explicit rather than hidden behind two unrelated entry points.
6. **Reports** — split into two honestly-labeled destinations instead of one ambiguous "Reports": *Parent Communication / Clinic Reports* (the AI path) and *Official Report Cards / End of Term* (the canonical path). KNEC export and SOW tools move out of this section entirely.
7. **Insights** — a real nav entry (currently missing) surfacing what's already built but orphaned: `/teacher/insights`, Monday Panel promoted out of the per-class page, Career Intelligence. Presentation only — no new computation (see Phase 4).
8. **Teaching Tools** (secondary grouping) — Documents, Assignments, Kiswahili Insha, AI Slides, Booklets. These stay reachable but should not compete with the seven sections above for primary nav weight.
9. **Settings** — profile, unified with Setup's form (Phase 8).

**Rejected from the Workspace**: Academic Clinic (parent/student surface, not teacher's), Academy (separate upskilling product, keep a link, not a section), `core-office`/`core-team`/`core-admissions` (a different product — School Office — wrongly nested under `/teacher`, out of scope to move this sprint but explicitly not part of the Workspace's identity), `core-readiness` (dead code, candidate for deletion in a future small-fix sprint).

---

## Phase 4 — Intelligence Integration

**Constitutional and unchanged by this sprint**: Adaptive Learning, Learning Compass, and the Intelligence Engine compute exactly as they do today, for every school, regardless of readiness tier. This sprint does not touch `lib/adaptiveLearning`, `lib/projection`, `lib/career`, or any Intelligence computation.

**What changes is presentation prominence**, using the Attention Feed as the proven template:

- **Paper-first schools** (attendance/marks entered days after the fact, low session frequency): intelligence surfaces should read "as of [last entry date]," not imply real-time freshness it cannot have. Fewer, higher-confidence nudges only — a stale nudge is worse than no nudge for a teacher who trusts the app less.
- **Hybrid schools** (some live entry, some batched): intelligence surfaces as currently built on My Day — this is what Attention Feed already does correctly.
- **Highly digital schools**: room for the currently-orphaned Insights/Monday Panel/Career Intelligence to surface proactively on My Day itself, not just behind a dedicated Insights nav item, since the data backing them is fresher.

The intelligence itself never changes; only how confidently and how prominently it is shown, driven by how recently and how completely the underlying Evidence was actually entered — a presentation-layer readiness signal, not a new intelligence computation.

---

## Phase 5 — Kenyan Adoption Ladder

| Workflow | Paper | Hybrid | Digital |
|---|---|---|---|
| **Attendance** | Teacher keeps a paper register; a school office staffer or the teacher batch-enters it later that day/week. *(Not built — Attendance is digital-only today, per 1.2. This is the concrete design gap this sprint identifies for a future implementation sprint.)* | Teacher marks attendance on their phone shortly after the lesson, not live during it. | Teacher marks attendance live in-app during the lesson (what exists today). |
| **Assessment marks entry** | Teacher marks a paper mark sheet during/after a test; enters scores into EduNexus later, in one batch, during a free period. | Teacher enters scores on a phone shortly after marking, class by class. | Live entry during marking, possibly with a scanner/CSV upload (already built — CSV upload/export exists in the legacy assessment UI). |
| **Teaching (SOW/Lesson Plan/ROW)** | Teacher works from a printed SOW/lesson plan; Record of Work is reconstructed later from what was actually covered (the existing cron already assumes this — see 1.4). | Teacher marks a lesson "taught" on their phone between lessons. | Live lesson-plan tracking, "taught" marked in the moment. |
| **Parent communication** | Notice board / verbal message at pickup — EduNexus has no role here and should not pretend to. | Teacher manually sends a WhatsApp message via the existing deep-link, unconfirmed delivery. | Automated, verified-delivery notification (the `notification_log` already exists as raw data; no UI currently reads it back — a future fix, not built this sprint). |
| **Report Cards** | Printed only, generated in-app then handed out physically — already possible today via PDF export. | Printed and shared via WhatsApp/email, both already built. | Fully digital, parent-portal published (already built — `is_published` gates parent visibility). |

The ladder's purpose is to make explicit, for each workflow, which rung the *code* currently supports (several are Digital-only today) versus which rungs a real Kenyan school actually needs — a gap list for future sprints, not a redesign performed now.

---

## Phase 6 — Configuration Principles

**One constitutional platform, many school personalities.**

**Configurable** (per-school, without touching educational truth):
- Which Workspace sections are pinned/prominent on My Day, driven by the school's readiness tier (Phase 4).
- Nav ordering and default landing tab.
- Whether the manual WhatsApp-send action is shown at all (a school with no parent WhatsApp adoption shouldn't see a dead button).
- Labels/language (English/Kiswahili) on Workspace chrome.

**Constitutional** (never school-configurable):
- The Assessment → lock → `computeTermSummaries` → Report Card pipeline sequence and its authorization gates.
- Evidence lifecycle rules (`confirmReview`/`rejectReview`/`retractEvidence`/`eraseEvidence` — append-only, never silently edited).
- What Adaptive Learning/Compass/Career Intelligence compute, and from what inputs.
- Security boundaries: school isolation, class-teacher-based read access (never `teacher_id`-based, per CLAUDE.md).
- The canonical domain ownership recorded in `docs/architecture/canonical-domain-registry.md`.

No school may configure its way into a different educational truth — only into a different *view* of the same truth.

---

## Phase 7 — Navigation

Recommended permanent structure, extending the existing `TeacherSidebar`/`TeacherBottomNav` rather than replacing it:

```
My Day (home)
My Classes
Teaching          → Scheme of Work / Lesson Plans / Record of Work (guided sequence)
Attendance
Assessment        → Marks Entry (per class) / End of Term (lock & publish)
Reports           → Parent Communication (Clinic) / Official Report Cards
Insights          → (new nav entry — surfaces existing Insights/Monday Panel/Career Intelligence)
Teaching Tools    → Documents / Assignments / Kiswahili / Slides / Booklets
Alerts
Settings
```

Concrete fixes this taxonomy requires (design-level, not built this sprint):
1. Desktop and mobile must share **one grouping**, not two different information architectures for the same shell.
2. "Reports" and "End of Term" must stop sharing the unqualified word "Reports" — relabel per Phase 3.
3. Add real nav entries for **Insights** and **Assessment** (both currently reachable only by drilling into unrelated pages or typing a URL).
4. `core-office`/`core-team`/`core-admissions` should be conceptually and eventually structurally separated from the Teacher Workspace nav — they answer "run the school," not "run my classroom." Not moved this sprint; flagged for a School Office ADR of its own.
5. The parent/teacher dual-role experience needs a real role-switcher affordance, not a banner bridging two unrelated apps — a future UX sprint, not built now.

---

## Phase 8 — Human Factors

| Factor | Current state | Workspace improvement |
|---|---|---|
| Duplicate entry | Settings and Setup write overlapping fields via two separate forms | Share one form definition |
| Screen switching | SOW → Lesson Plans → Record of Work requires manual navigation between three peer menu items | One guided flow (Phase 3 §3) |
| Cognitive load | Two "Reports" entries with no explanation of the difference | Honest, distinct labels (Phase 3 §6) |
| Typing burden | Topical quick-rating (1–4 scale) already exists and is the right pattern | Extend this pattern to other "between lessons" interactions, not new free-text forms |
| Waiting | AI generation (SOW/lesson plans) already has an async status endpoint (`/api/sow/generate/status`) | Correct pattern already; make sure it's not squeezed into break-time UI expectations (Phase 2) |
| Offline interruptions | Attendance and Assessment marks entry are digital-only, no paper fallback | Phase 5's ladder names the gap; building it is future work, not this sprint |
| "Was the parent told" anxiety | No screen answers this; WhatsApp is a fire-and-forget deep-link | Needs a status readback of `notification_log` — a real, small, future fix (matches the standing Wave 1–5 backlog, not new scope invented here) |

---

## Phase 9 — Pilot Readiness Test: Kanggai Junior School, One Day

Walking a single day with the Workspace design above, assuming a phone-first, moderate-connectivity school (a realistic middle rung, not the best case):

- **7:20 arrival**: teacher opens the app, lands on My Day — good, this already exists and works well.
- **Before first lesson**: teacher wants to confirm today's SOW-driven lesson plan. Today, this requires knowing to go to Lesson Plans separately from Scheme of Work — friction Phase 3's guided Teaching flow removes.
- **Marking attendance**: today, this is fine if the teacher has connectivity in the classroom; if not, there is no fallback — a real risk for Kanggai specifically, flagged in Phase 5, not solved this sprint.
- **Break**: teacher wants to enter yesterday's test scores. Today, this means navigating into a specific class's detail page — no single "Assessment" nav entry exists to get there directly. This is real, avoidable friction the Phase 3/7 nav fix addresses.
- **End of term**: teacher needs to generate report cards. Today, a teacher genuinely risks clicking "Reports" (the parent-communication/Clinic path) when they meant "End of Term" (the official path), or vice versa — the single sharpest trust risk found in this audit, because it looks like one feature with two entry points rather than two different things.
- **Any point**: teacher wants to know if a parent was told about a struggling learner. No screen in the app can currently answer this with confidence — the deep-link "send WhatsApp" button gives no feedback on whether it worked.

None of these are computation problems — the underlying intelligence, attendance records, and assessment data are sound (consistent with the Wave 1–5 conclusion that the platform's educational intelligence is trustworthy). Every friction point found here is a **navigation, labeling, or presentation** problem, which is exactly the class of problem a Teacher Workspace redesign should fix, and exactly why this sprint was scoped as architecture-and-navigation, not new intelligence.

---

## Summary of Findings Requiring Future (Separately-Gated) Work

Named here so they are not silently lost, but explicitly **not built in this sprint**:

1. Attendance has no Paper/Hybrid/Digital ladder — digital-only today.
2. Assessment marks entry has no offline/paper fallback.
3. No screen reads back `notification_log` to answer "was the parent told."
4. `core-readiness` is dead code (redirect shim) — deletion candidate.
5. Record-of-Work generation logic lives in a cron route, not `lib/row/` — a CLAUDE.md architecture-rule violation, small fix.
6. Settings/Setup duplicate form fields against the same `teachers` row.
7. `/api/teacher/prerequisite-readiness` and `/api/teacher/teaching-patterns` are fully orphaned dead API surfaces.
8. `app/dashboard/learning-compass` is a dead redirect stub.
9. Teacher Reflection (`lib/teacherReflection`) has no teacher-facing entry point at all — backend-only gap.
