# EduNexus Examination & School Management System — Full Audit

**Date:** 2026-07-15
**Scope:** Full assessments-to-report-card pipeline (marks entry → moderation → ranking → report generation → publishing), plus class/school management (teacher tools vs. school-admin tools), plus the Learner Record Layer/Evidence Engine as it intersects this pipeline.
**Method:** Direct codebase inventory (file:line citations throughout) + evaluation against `CLAUDE.md` architecture rules and prior audit memory (Sprints 22–31, Pilot Readiness Waves).

**Headline finding, stated up front so it isn't buried:** there is no single "examination system" in this codebase. There are **two**, built at different times, that do not know about each other. One is teacher-private (the original gradebook), one is school-admin-owned (the "Core" schema). They use different tables, different grading math, different ranking algorithms, different publish gates, and — critically — a class created in one is invisible in the other. Everything below has to be read through that lens: most of what looks like "missing intelligence" is actually blocked by this unresolved fork, not by lack of AI features.

---

## Step 1 — Feature Inventory

### 1.1 Class & School Management

**Two non-overlapping systems, plus one unrelated third one.**

**System A — Legacy / teacher-scoped gradebook**
- **Purpose:** Individual teacher manages their own class(es) informally, no school hierarchy required.
- **Tables:** `teacher_classes`, `class_students` (its own FK space, distinct from Core's `class_students` despite the identical name).
- **Create path:** `app/api/teacher/classes/route.ts:87-152` (`POST`) — logic lives *inline in the route*, not in `lib/`. This directly violates the CLAUDE.md rule "API routes are thin — call `lib/` functions only, no inline business logic." `generateClassCode` is defined in the same file (lines 5-9) rather than in `lib/`.
- **Auth:** `auth.getUser()` → 401 (91-93); ownership is `teachers.user_id === user.id` → 403 (100-101). No school/role concept at all — any authenticated teacher can create unlimited classes with no admin oversight.
- **No school-admin equivalent.** A headteacher cannot see, audit, merge, or bulk-manage these classes.

**System B — Core / school-admin-scoped**
- **Purpose:** School-administered class/stream structure, meant to be the institutional source of truth.
- **Tables:** `classes`, `streams`, `class_students` (separate FK space from System A), `academic_years`.
- **Logic:** `lib/core/classes.ts` — `listClasses`(22), `getClass`(29), `createClass`(33), `updateClass`(47), `assignSubjectTeacher`(57), `listClassSubjects`(66), `listStreams`(12), `createStream`(16), `listGrades`(6). Correctly thin wrappers over `repos.teachers.*` — this half follows the architecture rules.
- **Create path:** `app/api/core/classes/route.ts:44-72` — role-gated to `['school_admin','headteacher','deputy_headteacher']` (55, 67). This is the properly-built version of the same feature System A has.

**Verdict on the user's specific question ("is createClass available in the school system?"):** Yes, but as a *structurally separate implementation*, not the same feature exposed at two permission levels. A teacher using System A has no path into System B's institutional records, and a school admin using System B has no visibility into classes teachers privately created in System A. There is no migration, sync, or reconciliation between them. A school onboarding through the admin flow and a teacher onboarding through the individual flow will silently diverge into two different rosters for what a human would call "the same class."

**System C — Organization/developer platform (unrelated)**
- `lib/organizations/create.ts:11` `createOrganization`, `MemberRole` (owner/admin/member/billing_admin/developer/viewer) — this is the developers.edunexus.co.ke multi-tenant API/billing layer. `OrgType` includes `'school'` as a value (types.ts:6-14) suggesting an intended future bridge to real schools, but no code path connects an `organizations` row to a `schools`/`classes` row today. Flagging this so it isn't mistaken for a third class-management system in future work — it is namespace-adjacent, not functionally related.

### 1.2 Assessments / Marks Entry

**Legacy path** (`lib/assessments/`, 13 files) — full inventory:

| File | Purpose |
|---|---|
| `mutations.ts` | `createAssessment`, `updateAssessment`, `bulkSaveMarks`, `upsertMarksCSV`, ranks via `buildPositionMap` |
| `getters.ts` | Read queries: class/teacher/pending assessments, marks |
| `gradeCalculator.ts` | CBC 1-4 level + KCSE letter grade + points, builtin CBC/8-4-4 scales |
| `gradeScales.ts` | Per-teacher custom grade scale CRUD |
| `analytics.ts` / `analyticsStats.ts` / `subjectAnalytics.ts` | Class/subject analytics, median/mode/risk-level stats |
| `cohortQueries.ts` | Cross-stream rank combination for one teacher's own classes |
| `evidence.ts` | Feeds Evidence Domain from the gradebook (`class_assessments`/`learner_marks`) path |
| `reportCardEvidence.ts` | Feeds Evidence Domain from the *other* (legacy `assessments` table) report pipeline — documented as intentionally distinct from `evidence.ts` |
| `topical.ts` / `topicalEvidence.ts` | Strand/topic-level formative checks |
| `pdfRenderer.ts` | Legacy PDF report builder |
| `types.ts` | Shared types |

**Core path** (`lib/core/assessments.ts`) — a second, separate function set: `listAssessments`, `createAssessment`, `publishAssessment`, `getAssessmentScores`, `saveScores`, `computeTermSummaries`, `updateClassPositions`, `getClassPerformanceSummary`. Reuses the *tables* (`class_assessments`/`learner_marks`, per an explicit code comment) but not the *functions* — `lib/core/assessments.ts::createAssessment` and `lib/assessments/mutations.ts::createAssessment` are two different implementations writing the same table.

**Frontend/API surfaces:**
- `app/api/assessments/{create,history}` — legacy `assessments` table, student/parent-facing, correctly auth-scoped.
- `app/api/core/assessments/route.ts` — Core path. `GET` and `POST` (save-scores/create/compute) only check school membership (`getSchoolUser`), **not role** — contrast with `app/api/core/classes` which does role-gate. Any school member with a `school_users` row (including a `parent`-role member) can technically save assessment scores through this route.
- `app/api/teacher/assessments/**` (12 routes) — legacy path; `process/route.ts` chains `runAssessmentPipeline` → `recomputeAndSaveCapabilityProfile` → `updateFromAssessment` → `recordReportCardAssessmentEvidence`.

**Validation:** Zod-level input validation was not directly confirmed in this pass for every route — flagged as a follow-up check, not asserted either way.

**Moderation:** None exists. Zero hits for "moderat"/"approve" across the entire assessments/reports surface. Marks entered by a teacher become visible to Core's downstream aggregation (`computeTermSummaries`) with no second-person review step at any point.

**Locking:** None exists. `bulkSaveMarks`/`upsertMarksCSV` delete-then-reinsert or upsert with no check against a "finalized" state — a teacher (or, per the role gap above, potentially any school member) can rewrite marks after a report card has been generated and published from them, and nothing recomputes the published card.

**Publishing:** Two independent publish flags gate two different things:
- `lib/core/assessments.ts:65` `publishAssessment` — marks a single Core assessment `is_published`, feeding into `computeTermSummaries`. No dedicated role-gated route was found calling it directly in this pass.
- `lib/core/report-cards.ts:70` `publishReportCards` — the actual "make visible to parents" gate, correctly restricted to `isSchoolAdmin` (`app/api/core/reports/route.ts:67-68`).

### 1.3 Report Cards

- **`lib/core/report-cards.ts`** — `generateReportCards`(5): aggregates `term_subject_summaries` per learner, computes CBC level via an inline `toCbcLevel` closure (28-33, hardcoded boundaries EE≥75/ME≥50/AE≥25/else BE), ranks by average score (36-51), upserts `school_report_cards` with `is_published:false`. `updateReportCard`(62) — comment fields only. `publishReportCards`(70) — admin-gated, emits `teacher.report_card.published` event. `getReportCard`/`listClassReportCards`/`updatePdfUrl`.
- **`lib/assessments/reportCardEvidence.ts`** — reads the legacy `assessments` table directly, converts scores to Evidence rows, persists via `lib/intelligence/evidenceLifecycle.ts::persistEvidenceBatch`. This is a write-only tributary into the Evidence Domain; it does not itself read from or write to `school_report_cards`. The Evidence Domain it feeds is later read by `recomputeLearnerProjection`/`getLearnerTimeline` for the *separate* Learner Intelligence stack (Blueprint, Compass, etc.) — i.e. today's marks/report-card pipeline and the Learner Intelligence pipeline are only loosely coupled through this one evidence-writing side door, not architecturally unified.
- **API:** `app/api/reports/report-card/route.ts` — guardian-link ownership check + `is_published` gate, correct. `report-card/mine/route.ts` — correctly pre-scoped by guardian's learner list. `app/api/core/reports/route.ts` — `GET` has **no role gate**, only membership, meaning any school member can list any class/term's report cards school-wide; `POST update` (headteacher/class-teacher comment field) is **also only membership-gated**, not admin-gated, despite the field name implying headteacher authorship — inconsistent with the `publish`/generate actions in the same file, which *are* correctly admin-gated.
- **Frontend:** `app/(parent)/report-card/page.tsx` is the only dedicated report-card page found. No standalone `ReportCard` component exists in `components/` — rendering logic is likely embedded in the page itself, which cuts against reuse if a teacher- or admin-facing report view is ever needed.

### 1.4 Permissions / Roles

Three unrelated role systems coexist:

1. **`lib/auth/getRole.ts`** — `UserRole = 'teacher'|'parent'|'student'`. Its own comment calls this "the single canonical role lookup for the whole app," but it has no admin/headteacher concept whatsoever — it exists purely for navigation/redirect, not for authorization.
2. **`types/core.ts`** `SchoolUserRole = 'school_admin'|'headteacher'|'deputy_headteacher'|'teacher'|'parent'`. This is real, DB-backed, and actually checked (`isSchoolAdmin`, role whitelists on `app/api/core/classes` and `app/api/core/reports` publish/generate). **This corrects a prior audit memory note** ("HOD/Principal roles don't exist") — `headteacher` and `deputy_headteacher` do exist and are enforced. What still doesn't exist: a `hod` (head of department) role — the only trace is a design comment (`lib/school/types.ts:6`, "HoD sees: same, restricted to their subject") describing an unbuilt future view — and "principal" is UI copy over the `headteacher`/`school_admin` mechanism, never an implemented enum value.
3. **`lib/organizations/types.ts`** `MemberRole` — the developer-platform IAM stack (`lib/iam/`), unrelated to classroom data.

**Security spot-check** (CLAUDE.md pattern: `auth.getUser()` → 401, then explicit ownership/role before mutating) across 7 representative routes: 5 compliant, 2 gaps — both in `app/api/core/assessments` (POST, no role gate) and `app/api/core/reports` (`update` action, membership-only where sibling actions are admin-gated). See §2 for detail; this is a real, fixable finding, not a hypothetical.

### 1.5 Reporting / Analytics

- `getAssessmentAnalytics` — single-class overview + subject distribution.
- `getCohortData`/`getTeacherCohorts` — cross-stream combination, but scoped to one teacher's own classes, not school-wide.
- `computeTermSummaries` / `getClassPerformanceSummary` — Core's term-level per-subject aggregation, exposed via `app/api/core/assessments?view=summary`.
- **No term-over-term or year-over-year trend computation exists anywhere** in the codebase — nothing compares term N to term N-1. "Historical comparison," one of the ten stages this audit was asked to check, is entirely unbuilt.
- `app/api/school/{intelligence,strand-health,intervention-efficacy}` exist but were not opened in this pass — flagged for a follow-up read before any roadmap work touches them, since their names suggest overlap with the Learner Intelligence stack this audit didn't re-litigate (already covered by Sprints 22-31 in memory).

---

## Step 2 — Architecture Evaluation

**Duplicate logic (the load-bearing finding of this audit):**
- Two class-management implementations (`teacher_classes` vs `classes`/`streams`), no reconciliation.
- Two `createAssessment` implementations writing the same underlying table, from `lib/assessments/mutations.ts` and `lib/core/assessments.ts`.
- Three independent ranking/position algorithms: `buildPositionMap` (legacy, ties share rank), `report-cards.ts` inline sort (Core report cards, `i+1`, **no tie handling — two learners with identical scores get different positions**), `updateClassPositions` (Core per-subject, also no tie handling). A school with any tied average will see the tie broken arbitrarily by array order, which is a correctness bug wherever it surfaces on a printed report card, not just an inconsistency between systems.
- Two independent CBC-level-boundary implementations: `lib/assessments/gradeCalculator.ts` (the real shared module, with teacher-custom scales) vs. inline `toCbcLevel` closures hardcoded verbatim in both `lib/core/report-cards.ts:28-33` and `lib/core/assessments.ts:147-152`, duplicating the 75/50/25 boundary logic instead of calling the shared function. This means a change to grading policy (e.g. a school wanting different CBC boundaries) has to be made in three places, and two of the three already disagree with the teacher-custom-scale system that exists in `gradeScales.ts` but appears unreachable from the Core boundary logic.

**Tight coupling / poor separation of concerns:**
- `app/api/teacher/classes/route.ts` contains class-creation business logic (including code generation) inline in the route, violating the CLAUDE.md thin-route rule.
- `app/api/core/assessments` and `app/api/core/reports` mix multiple `action`-keyed behaviors (create/save-scores/compute; generate/publish/update) behind a single `POST`, with inconsistent authorization granularity applied per action within the same handler — this is what produced the role-gate gap in §1.4, and it's a pattern worth flagging generally: action-multiplexed routes are where authorization inconsistencies hide, because each branch has to remember to re-check role independently.

**Bad naming:** `class_students` exists as two tables with the same name in different FK spaces (legacy vs. Core). This is close to a landmine — any future engineer (or AI agent) grepping for `class_students` will find both and can easily write a query against the wrong one with no compiler or runtime signal that it's wrong.

**Missing abstractions:** No "moderation" or "locking" concept exists anywhere in the marks pipeline — not partially built, not stubbed, entirely absent. For a system whose stated audit scope explicitly includes "Moderation" and "Subject locking" as workflow stages, this is a genuine gap, not a naming mismatch: a teacher's marks become official (feed into `computeTermSummaries`, then `generateReportCards`) with no review step, and nothing prevents post-hoc editing after a report card referencing those marks has already been published to a parent.

**Future scalability risk:** The legacy/Core fork is the central risk. Every new feature built on top of "assessments" has to choose which of the two systems to extend, and the codebase currently has features on both sides (parent-facing report cards on Core, teacher-facing PDF generation and AI-driven auto-reports on legacy). Left unresolved, this fork will only deepen — exactly the shape of problem the CLAUDE.md `teacher_id`-as-attribution-not-access-gate rule and the Learner Record Layer's "one canonical timeline" principle were designed to prevent, but at the class/assessment layer, not the evidence layer.

**Security issues:** The two role-gate gaps in `app/api/core/assessments` (POST) and `app/api/core/reports` (update action) are real and should be treated as the highest-priority fix in this whole audit — they're small, mechanical, low-risk fixes (add a role check matching the sibling actions already in the same file) with a concrete access-control impact (non-admin school members editing headteacher-attributed comments, or saving assessment scores, school-wide).

**Performance:** Not deeply probed in this pass; the one visible risk is `generateReportCards` doing an in-memory sort/rank over all learners in a class per call rather than a DB-side window function, which is fine at current pilot scale (per Post-Audit Charter: 50 teachers) but worth revisiting before any "school-wide" scale-up.

**Maintainability:** Genuinely uneven. The Core half (`lib/core/*`) is clean, thin, correctly delegates to `repos.*`. The legacy half mixes concerns (inline route logic, PDF rendering next to grade math). A newcomer reading this codebase would reasonably conclude Core is "the real system" and legacy is dead — but legacy is still the live path for teacher-facing PDF reports and AI auto-reports, so it can't be archived without first migrating those specific features.

---

## Step 3 — Examination Workflow, Stage by Stage

| Stage | Status | Evidence |
|---|---|---|
| Exam/assessment creation | **Built (duplicated)** | Two implementations, see §2 |
| Exam scheduling | **Not found** | No scheduling/calendar concept surfaced in either pipeline |
| Subject allocation | **Built (Core only)** | `assignSubjectTeacher` (`lib/core/classes.ts:57`) |
| Teacher assignment | **Built (Core only)** | Same as above; legacy has no equivalent — teachers just own their own classes |
| Marks entry | **Built (duplicated)** | §1.2 |
| Validation | **Partially confirmed** | Auth/ownership validated; input-shape (Zod) validation not confirmed in this pass |
| Moderation | **Not built** | Zero hits, confirmed by grep |
| Subject locking | **Not built** | No finalize/lock concept exists |
| Ranking | **Built (three disagreeing implementations, two with a tie-handling bug)** | §2 |
| Report generation | **Built (duplicated)** | Legacy AI auto-reports vs. Core computed `school_report_cards` |
| Approval workflow | **Partially built** | Report-card publish is admin-gated correctly; nothing upstream of it (marks entry) has approval |
| Publishing | **Built, correct where checked** | `publishReportCards` properly admin-gated and parent-visibility-gated |
| Analytics | **Built, class/term scoped only** | §1.5 |
| Historical tracking | **Not built** | No term-over-term comparison exists |

**Read against the user's original 12-stage checklist:** roughly half the stages have real, working code; a third exist in duplicate/conflicting form; and moderation, locking, scheduling, and historical tracking are simply absent. This is a materially different picture from "mostly built, needs intelligence layered on" — a meaningful fraction of the traditional exam-office workflow itself isn't there yet, independent of any AI ambition.

---

## Step 4 — User Experience

This pass didn't drive the UI (per the audit brief, this was a code-level architecture review, not a UX walkthrough), so the following is inferred from route/page structure, not observed behavior — flagged explicitly rather than asserted as fact:

- **Teacher experience** is fragmented by construction: a teacher using the legacy gradebook UI and a teacher whose school has adopted Core-based class management are using what are, underneath, two different products that happen to share a visual shell. Any UX inconsistency users report ("my class didn't show up," "marks I entered aren't on the report card") is highly likely to be this architectural split surfacing as a support ticket, not a UI bug.
- **Headteacher/exam-office experience**: Core gives them real admin tools (class/stream creation, report publishing), but they have zero visibility into legacy-path classes/marks a teacher may be using instead — meaning a headteacher's picture of "the school's exam data" can be silently incomplete.
- **Parent/student experience**: correctly gated (guardian-link + is_published checks throughout) — this is the one experience layer that reads as solid.
- Mobile responsiveness, navigation, discoverability, error prevention, clarity: not assessed in this pass — would need an actual UI walkthrough (the `verify` or `run` skills, or a live session) to speak to honestly rather than inferred from route names.

---

## Step 5 — Reporting Evaluation

- Report cards: built, correct at the publish/visibility boundary, but the underlying rank/grade math has the tie-handling and boundary-duplication issues in §2.
- Graphs/analytics: exist at class and term-subject granularity (`getAssessmentAnalytics`, `getClassPerformanceSummary`), not at school-wide or cross-term granularity.
- Class/subject summaries: built (Core).
- Teacher/school summaries: not found as a distinct rollup — `getCohortData` gets closest but is teacher-scoped, not school-scoped.
- Pathway/competency reports: exist in the separate Learner Intelligence stack (Career/Compass, per memory — not re-audited here), not integrated into the report-card pipeline itself.
- CBC reports: built, but the CBC-level computation is duplicated (see §2) rather than centralized.
- Historical comparisons: **absent**, confirmed.

---

## Step 6 — Intelligence Opportunities

Per the Post-Audit Operating Charter already in effect for this project ("small trustworthy fixes only, no new intelligence features, observe pilot usage first"), these are listed as *identified opportunities for the roadmap's Future Vision tier*, not as work to start now:

- **Tie-aware, single-source ranking**: today's three ranking implementations should become one shared function (extending `gradeCalculator.ts`, the one module that's already correctly centralized) with proper tie handling — this is closer to a correctness fix than "intelligence," and is the highest-leverage single change in this entire audit.
- **Marks-entry anomaly detection**: given the total absence of moderation, a lightweight "does this mark look implausible given this student's history" flag (using the Evidence Domain that already exists) would substitute cheaply for a full human moderation workflow, if the school-side process genuinely can't support one at pilot scale.
- **Term-over-term trend surfacing**: the historical-comparison gap in §1.5/§5 is both a missing traditional feature and the natural substrate for "is this class/subject/learner trending down" intelligence — but the trend computation has to exist first, as a plain feature, before any inference sits on top of it.
- **Curriculum coverage intelligence, question-difficulty analysis, class mastery projections, promotion readiness**: none of these have any code-level foundation in the assessments/report-card pipeline today (as distinct from the separate Learner Intelligence stack). They belong in Future Vision, not Critical/High — building them on top of a still-forked class/assessment system would mean building them twice, or building them on the wrong half.

The overriding intelligence-layer finding is **not** "which AI feature to add next" — it's that the fork in §1.1/§2 has to close before any new intelligence feature can trust that "this class's marks" means one thing across the whole system.

---

## Step 7 — Benchmark (conceptual only)

Compared against PowerSchool/Blackbaud/Classter-class systems, the single most consequential structural gap isn't a missing feature — those systems assume **one** canonical class/roster/gradebook model that every role (teacher, admin, parent) reads and writes through consistently, with role-scoped views rather than role-scoped *data forks*. EduNexus's forked legacy/Core split is the architectural anti-pattern these systems specifically avoid by having a single source of truth from day one. Google Classroom, by contrast, deliberately stays teacher-scoped and non-institutional (closer to today's "System A") — that's a legitimate design point too, but EduNexus is currently straddling both design philosophies at once rather than choosing one. This is the one place in this audit where "compare against competitors" earned its keep: it's not that a feature is missing, it's that the foundational modeling choice hasn't been made yet, and every competitor in this category has made it one way or the other.

---

## Step 8 — Improvement Roadmap

**Critical**
1. Close the two role-gate security gaps (`app/api/core/assessments` POST, `app/api/core/reports` update action) — small, mechanical, real access-control exposure.
2. Fix the tie-handling bug in report-card/position ranking (`lib/core/report-cards.ts`, `updateClassPositions`) — a correctness bug that reaches a printed, parent-facing document.

**High**
3. Decide and document which of the two class-management systems (legacy `teacher_classes` vs. Core `classes`) is canonical going forward; stop new feature work from silently choosing whichever is convenient.
4. Centralize CBC-level-boundary computation onto the existing `gradeCalculator.ts` module instead of the two duplicated inline closures.
5. Move `app/api/teacher/classes/route.ts`'s inline class-creation logic into `lib/`, per CLAUDE.md's thin-route rule.

**Medium**
6. Design a minimal marks-locking/moderation step — even a single "teacher submits, becomes read-only, admin can unlock" state machine would close the biggest workflow gap found in this audit.
7. Build a school-wide (not just teacher's-own-classes) performance summary, since `getCohortData` currently caps out at one teacher's cross-stream view.

**Low**
8. Rename or namespace the two `class_students` tables so the identical name stops being a silent landmine for future queries.
9. Add a dedicated `ReportCard` component instead of inlining render logic in the parent page, for reuse if a teacher/admin-facing report view is ever needed.

**Future Vision**
10. Term-over-term / year-over-year historical trend computation.
11. Curriculum coverage intelligence, question-difficulty analysis, class mastery projection, promotion readiness — once (and only once) the class/assessment fork is resolved.

Per the entries above, and consistent with the Post-Audit Operating Charter already governing this project, everything in Future Vision and most of Medium should wait until the fork resolution (item 3) and the two security items are done — building on a still-forked foundation multiplies the eventual migration cost.

---

## Step 9 — Detail on the Top 3 (Critical + top High)

**1. Role-gate gaps in `app/api/core/assessments` and `app/api/core/reports`**
- *Problem:* Two `POST` action branches check membership only, not role, while sibling actions in the same files correctly check `isSchoolAdmin`.
- *Impact:* A non-admin school member (a `parent`-role `school_users` row, per the type) could theoretically save assessment scores or edit a headteacher-attributed comment school-wide.
- *Recommended solution:* Add the same role check already used by the sibling actions in each file — this is a same-file, same-pattern fix, not new design work.
- *Technical difficulty:* Low.
- *Estimated time:* Under a day including tests.
- *Priority:* Critical.
- *Dependencies:* None.

**2. Ranking tie-handling bug**
- *Problem:* `report-cards.ts` and `updateClassPositions` assign strictly sequential positions (`i+1`) with no tie check, unlike the legacy `buildPositionMap`, which does handle ties.
- *Impact:* Two learners with identical scores get different class positions on an official, parent-visible, published report card — a factual error on a document families rely on.
- *Recommended solution:* Extract `buildPositionMap`'s tie-aware logic into the shared `gradeCalculator.ts` module and call it from all three ranking sites, deleting the two duplicated inline sorts.
- *Technical difficulty:* Low-Medium (touches three call sites, needs a regression test with tied scores).
- *Estimated time:* 1-2 days.
- *Priority:* Critical.
- *Dependencies:* None — can ship independent of the fork resolution.

**3. Legacy/Core class-management fork resolution**
- *Problem:* Two independent, non-communicating class-management systems.
- *Impact:* Institutional data (a headteacher's view of "the school") can be silently incomplete; any feature built on "classes" going forward has to arbitrarily pick a side.
- *Recommended solution:* Not prescribed here — this is a genuine architecture decision (migrate legacy into Core? keep both with an explicit sync? formally deprecate one path with a teacher-facing migration flow?) that needs the "before building any new feature" approval sequence from CLAUDE.md, starting with "what DB tables/columns does this need" applied retroactively to the existing schema, not a unilateral call from this audit.
- *Technical difficulty:* High (data migration, teacher-facing communication, backward compatibility for any in-flight legacy classes).
- *Estimated time:* Multi-week, needs its own scoping pass.
- *Priority:* High (not Critical, because it's not an active security/correctness bug — but it blocks nearly everything in the Medium/Future tiers).
- *Dependencies:* Should be scoped as its own dedicated sprint, in the pattern of Sprints 22-31 already in project memory, before any Future Vision intelligence work begins.

---

## Step 10 — The EduNexus Examination System Vision (3-Year Horizon)

Stated honestly, given everything above: EduNexus is not fifteen AI features away from a 2030-grade examination platform. It is one unresolved architectural decision away from being able to build toward one at all. The vision below assumes that decision gets made — it is not a substitute for making it.

A 2030-grade version of this system would not have "an examination module." It would have **one continuous record of what a learner has demonstrated**, where a mark entered in a classroom is just one more piece of evidence flowing into the same Evidence Domain that already exists in this codebase for the Learner Intelligence stack (`lib/intelligence/evidenceLifecycle.ts`, `recomputeLearnerProjection`) — not a parallel pipeline that occasionally, manually, feeds evidence sideways through files like `reportCardEvidence.ts`. Ranking, grading, and report generation would be *projections* of that one record, computed on demand, not separately-maintained tables that can drift from the marks that produced them. Moderation would not be a bureaucratic approval queue bolted onto a Google-Forms-era workflow — it would be confidence-scored: marks consistent with a learner's evidence history publish automatically, marks that represent a surprising jump get flagged for a second look, using exactly the confidence machinery this codebase already has for other kinds of evidence. "Historical tracking" would not mean a term-over-term chart bolted on later — it would be the default view, since every mark is already timestamped evidence in a timeline that was designed (per `getLearnerTimeline`) to answer "what do we know about this learner, in order" from day one.

Class and school management would stop being two competing products wearing one UI. A class would be one entity, with role-scoped views — a teacher sees their roster, a headteacher sees the school, a parent sees their child — not two entities that happen to render similarly. Report cards would stop being generated documents and start being live views over the same projection every other part of the platform (Compass, Career Intelligence, the Blueprint) already reads — so a report card and an AI-generated learner insight can never disagree about the same underlying fact, because there would only be one underlying fact to disagree about.

None of that is science fiction relative to what's already built in this codebase — the Evidence Domain, the projection engine, and the canonical timeline already exist for the *other* half of this platform. The examination system's honest 3-year vision is to stop being the last major subsystem still running on a forked, pre-Evidence-Domain architecture, and become the thing that finally makes "one learner, one record" true end to end, from a teacher typing a mark into a spreadsheet-like UI on Monday morning to a parent reading a published report card that afternoon, with nothing in between that isn't the same fact seen from a different angle.
