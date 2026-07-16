# Sprint 8A — Educational Operating System Implementation Blueprint

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim about EduNexus **today** is cited to the sprint (6A–7E, or the pre-6A engineering history — Stage 0.5, Sprints 1–5) that established it. Every claim about a **future build order or priority** is reasoning applied to that evidence, not a new investigation, and is labeled as such. No ADR is raised.

**Builds on**: the complete 6A–7E architecture series (structure, reconciliation, operating model, workflow, organization, information flow, decision & authority, the two Operating System Blueprints, the domain architecture, real-school research, the Decision Model, and the future-state synthesis) plus the pre-6A engineering history recorded in `docs/engineering/implementation-log.md` (Stage 0.5 through Sprint 5-series — the concrete technical-debt record this sprint's Part 7 draws on directly). This document turns fourteen prior architecture documents into a construction schedule: what gets built first, what depends on what, and what future contributors should read before touching any of it.

---

## Part 1 — Inventory of Existing Foundations

| Subsystem | Maturity | Owner domain | Known blockers | Architectural strengths | Architectural weaknesses |
|---|---|---|---|---|---|
| **Admission** | **PARTIAL** | Academics (de facto) | No distinct decision step exists — a single write does both Admission and Enrollment (6D Workflow 1) | Simple, reliable, exercised daily | No review, no Registrar ownership, no fee/medical intake gate |
| **Enrollment** | **PARTIAL, duplicated** | Academics (legacy) / Administration (Core, dormant) | `class_students` vs `learner_enrollments`, unreconciled (6B) | The legacy half works | Core half has zero production rows |
| **Classes** | **MOSTLY COMPLETE** | Academics | `teacher_classes` vs `classes` duplication (6B) | The platform's most-exercised organizational object after Assessment | Self-service only, no administrative appointment concept |
| **Curriculum** | **PARTIAL, duplicated** | Academics/Curriculum | Four representations, no canonical resolution (6B) | Genuinely rich KICD-sourced content | The UI-driving catalogue is a hardcoded file, not the "real" Curriculum tables |
| **Lesson Planning** | **MOSTLY COMPLETE** | Teaching | None major found | AI-assisted, teacher-reviewed — a correctly-gated pattern (7A Part 2) | Not independently audited in depth by any prior sprint beyond confirming it exists and is teacher-facing |
| **Schemes of Work** | **MOSTLY COMPLETE** | Teaching/Curriculum | Same Curriculum duplication issue at its boundary (7B Part 3) | Real, used, feeds Record of Work | Boundary with Curriculum is blurred in practice (7B Part 3) |
| **Assessment** | **COMPLETE** for its current scope | Academics | No second-reviewer/moderation step (6D/6G) | The platform's most reliable, most exercised workflow | Self-publish with no moderation gate |
| **Evidence** | **COMPLETE** | Learning Intelligence | None found | **Reference Quality** — DB-trigger-enforced, fully traceable, confidence-tiered (6H Part 4) | None found — this series' unambiguous best subsystem |
| **Projection** | **COMPLETE** | Learning Intelligence | None found | Pure, deterministic, single canonical read path | No history/versioning table found (6F Part 6) |
| **Ranking** | **COMPLETE** as an engine, **DORMANT** in its highest-visibility use | Learning Intelligence/Reporting | Core Report Card pipeline unreached (6F Part 2) | Correctly built, tie-handled — closed via Sprint 3A–3E's migration series (implementation log) | Its best-designed consumer (Core Report Cards) has zero production rows |
| **Grading** | **PARTIAL, multiple unresolved implementations** | Academics | **Concrete, cited technical debt**: `gradeCalculator.ts`'s legacy 76/51/31 scale vs. the canonical 75/50/25 scale remains an unratified policy conflict (Sprint 4D, implementation log); `gradeLevelFromScore` was never migrated onto the canonical engine (Sprint 4E — explicitly blocked, reclassified "acceptable duplicate, not migratable in place" pending a teacher→school identity resolution); Assignments-domain (3 copies, 75/55/40) and Notifications-domain (2 copies, 80/60/40) grading sets remain unmigrated and unscoped | `lib/grading`'s core engine is zero-dependency and pure (Sprint 4A) | At least 6 live grading implementations still disagree under a customized `grade_boundaries` value (Sprint 4D's "Critical, newly real" finding) |
| **Report Cards** | **PARTIAL, duplicated pipelines** | Reporting | Two independently-computed pipelines that could disagree with no detection mechanism (6F Part 6) | The Core pipeline (ranking + term-averaging) is correctly built | The live, parent-facing pipeline bypasses Evidence/Projection entirely |
| **Promotion** | **FOUNDATIONAL ONLY** | Academic Administration | Zero live rows ever, no UI (6D/6G) | `processed_by`/`reason` schema exists | Real-world promotion is a collective, staff-ratified decision (7C Part 6); EduNexus's dormant model is single-actor |
| **Graduation** | **FOUNDATIONAL ONLY, structurally broken in the legacy path** | Academic Administration | `student_promotions.to_grade NOT NULL` makes it unrepresentable in the identity space real learners live in (6C) | Core's version (`lib/core/promotions.ts:38-42`) is correctly coded | Unreachable, and even if reached, would not apply to the ~68-file-usage legacy learner population |
| **Teacher Management** | **MOSTLY COMPLETE** for identity, **FOUNDATIONAL** for lifecycle | Identity/Organization | No offboarding/deactivation path found (6F Part 1) | `teachers.id` is the series' one fully resolved canonical identity (ADR-0002) | No appraisal, professional-development, or HOD-line-management concept (7C Part 2/3) |
| **School Management** | **FOUNDATIONAL ONLY** | Organization | No onboarding UI at all — `lib/core/school.ts`'s own code comment confirms this (6E Part 3) | Schema is a correct, normalized SIS model (6E Part 9) | Zero reachable production path to create or manage a school through Core |
| **Parents** | **PARTIAL, fragmented** | Parent Engagement | Three non-communicating linking mechanisms (6D/6E/6F) | Real, used by real parents | No reconciliation between the three; no unlink path found |
| **Communication** | **PARTIAL, fragmented** | Communication | Two independent trigger systems (email/WhatsApp), no shared "who is this parent" resolution (6F Part 1) | Works, used daily | Uncoordinated across the three linking mechanisms above |
| **Career Intelligence** | **PARTIAL, functionally live, structurally ungoverned** | Career Intelligence | **This series' single most-corroborated finding** (6G, 7C, 7D, 7E) — writes directly to `careers`/`career_matches` with zero human gate, zero trust marker | Sophisticated AI generation, genuinely used | No approval, no traceability, occupies a territory (Guidance & Counselling) that does not otherwise exist |
| **Learning Compass** | **MOSTLY COMPLETE** | Learning | Chat content shown live with no review step (6E Part 7) — an intentional design for real-time tutoring, but worth naming as a boundary | The platform's most-used AI-touching feature by all indications; its evidence-extraction half is correctly gated | The chat content itself has no confidence/explanation metadata (7D Part 6) |
| **Adaptive Learning** | **MOSTLY COMPLETE** | Learning Intelligence | Production-usage breadth not independently re-verified (7B Part 5) | **The cleanest AI/human decision boundary in the entire platform** (6G Part 3) | Scope is narrow (grouping only) relative to its governance quality |
| **Academic Clinic** | **MOSTLY COMPLETE** | Academic Clinic | Shares `repos.careers` with the structurally distinct Career Intelligence domain — a leaky repository boundary (7B Part 3/4, new finding) | Deterministic, no AI, correctly scoped (6E Part 7) | Repository-sharing with Career Intelligence blurs its otherwise-clean conceptual boundary |
| **School Intelligence** | **FOUNDATIONAL ONLY, no reachable consumer** | Analytics/School Intelligence | The admin-tier actor it would serve cannot be populated in production (6E, restated 6H Part 7) | Read-only, correctly scoped, no boundary violations found (6E Part 8) | Computes real data with nobody able to act on it |
| **Teaching Intelligence** | **UNKNOWN maturity** | Teaching Intelligence (folder confirmed, `lib/teachingIntelligence/`) | Relationship to the "no unified Teacher Intelligence surface" finding (6H Part 7) is unresolved — this folder was never independently investigated by any prior sprint | UNKNOWN | UNKNOWN — flagged, not guessed |
| **Learner Intelligence** | **UNKNOWN relationship to Projection** | Learning Intelligence (probably, unconfirmed) | `lib/learnerModel/`/`lib/learnerIntelligence/`'s relationship to `lib/projection/` is a genuinely open question this series has surfaced but not resolved (7B Part 1/3) | UNKNOWN | UNKNOWN — flagged, not guessed |
| **Analytics** | **PARTIAL, read-only, thin** | Analytics | No reachable consumer for its output beyond the strand-health/intervention-efficacy surfaces already confirmed to exist | Zero write-authority violations found anywhere (6E Part 8) | Breadth/depth beyond "reads legacy tables" not independently re-verified |
| **Events** | **DORMANT, functionally dead** | Platform/Integration | `registerEventHandler()` has zero callers; no school-tenant subscription exists (6F Part 2/7) | The publish-side contract shape (`publishEvent`) is correctly built | The largest confirmed information dead end in the entire series |
| **Workflow (engine, generally)** | **MISSING as a generalized capability**; **COMPLETE for two specific instances** (Evidence lifecycle, Adaptive Learning approve gate) | Cross-cutting | No persisted, visible transition state for most domains (6D Executive Summary) | The two working instances prove the six-stage shape (7E Part 5) is achievable in this codebase | Every other "workflow" is a single atomic write or a hard-coded call chain |
| **Notifications** | **PARTIAL, fragmented** | Communication | Same as "Communication" above | Cron-driven, real, working (6E Part 8) | No unified trigger, no `notification_log`-equivalent for every channel |
| **Reference School** | **MOSTLY COMPLETE as a fixture** | Testing/Fixture | Never connects to the live authority model (6E Part 4/6) | The richest evidence in the entire repository for what a complete org chart should look like (9 real staff titles) | Purely a seed script — no production pathway |
| **Developer Platform** | **PARTIAL-TO-OPERATIONAL** (provisionally scored, not independently audited in depth by this series) | Platform | Not itself investigated beyond its intersection points (6E Part 1, 6F's event-subscription mechanism) | A structurally separate, apparently more actively maintained bounded context | Its role vocabulary and identity model are entirely disjoint from the school domain — a boundary that must remain deliberate, not accidental (7B Part 4) |
| **Payments** | **OPERATIONAL for platform billing, ABSENT for school fees** | Platform / (Finance, absent) | The two are easily confused by name (`lib/payments/`, `lib/billing/`) but serve entirely different purposes — restated 7A/7B | `mpesa_payments`'s webhook-driven, idempotent design is sound for its actual scope | Zero school-fee concept exists anywhere (7A Part 1) |
| **Academy** | **MOSTLY COMPLETE** | Academy (teacher continuing-education, distinct from the school domain) | AI Judge's review path is UNKNOWN (6E Part 7, restated 7D) | Live, used, gamified, has its own certificate lifecycle | Naming collision with a hypothetical future student "Certificate" (7A Part 3) |

---

## Part 2 — Operating System Dependency Graph

```
School Created
  │ [HARD DEPENDENCY, currently unreachable — 6E Part 3: no code path exists
  │  today that a real user can trigger; School creation is otherwise the
  │  root every downstream node structurally requires]
  ▼
Academic Structure  (Grade/Subject/Class definitions)
  │ [SOFT DEPENDENCY on School in the legacy path — restated 6B: the legacy
  │  Academic Structure representations do not actually check school_id at
  │  all in several cases (Sprint 4E's finding that teacher_classes/
  │  class_assessments have no school_id column in any migration, ever) —
  │  this is a FALSE DEPENDENCY in the live product: real Academic
  │  Structure usage does not actually depend on School Created succeeding,
  │  because it runs on a parallel, unlinked identity path]
  ▼
Enrollment
  │ [HARD DEPENDENCY on Academic Structure — a learner cannot be enrolled
  │  in a class that doesn't exist. HEALTHY.]
  ▼
Classes
  │ [Already required by Enrollment above — listed separately per the
  │  sprint's own example order; no additional dependency beyond Academic
  │  Structure]
  ▼
Curriculum
  │ [SOFT DEPENDENCY, bidirectional in practice — Teaching consumes
  │  Curriculum content, but the live UI's hardcoded catalogue (7B Part 3)
  │  means Curriculum's own tables are not actually a hard blocker for
  │  Teaching to function — another FALSE DEPENDENCY in the live product]
  ▼
Assessment
  │ [HARD DEPENDENCY on Classes/Enrollment — an assessment must be scoped
  │  to a real class with real enrolled learners. HEALTHY, and the
  │  series' most reliably-exercised dependency.]
  ▼
Evidence
  │ [HARD DEPENDENCY on Assessment (or Compass session content) —
  │  restated throughout as CLAUDE.md-enforced. HEALTHY.]
  ▼
Projection
  │ [HARD DEPENDENCY on confirmed Evidence only — restated throughout.
  │  HEALTHY, the series' cleanest crossing.]
  ▼
Recommendations
  │ [HARD DEPENDENCY on Projection for Career Intelligence/Blueprint/
  │  Holiday Planner — but a MISSING DEPENDENCY exists here too: nothing
  │  connects Recommendations back to Evidence's own trust-tiering model,
  │  which is why Career Intelligence can persist output with none of
  │  Evidence's confidence discipline (6G Part 9, restated throughout)]
  ▼
Reports
  │ [HIDDEN DEPENDENCY, previously identified — 7B Part 4: the Core
  │  Reporting pipeline assumes Assessment is publish-locked under
  │  `learners.id`, but live Assessment data is under `students.id`.
  │  This dependency, as coded, can NEVER be satisfied for the vast
  │  majority of real learners — not merely unreached, but unsatisfiable
  │  while the identity split persists]
  ▼
Promotion
  │ [HARD DEPENDENCY on Reports in a working system (a promotion decision
  │  should be informed by the term's results) — but since Reports
  │  (Core) never fires and Promotion never fires, this dependency has
  │  NEVER BEEN EXERCISED in this codebase's evidence (6D/6G) — a
  │  dependency that is architecturally correct and empirically untested]
  ▼
Graduation
  │ [HARD DEPENDENCY on Promotion succeeding repeatedly across grades —
  │  compounds the above: Graduation cannot be exercised until Promotion
  │  is, and Promotion never has been]
  ▼
Archive
  │ [MISSING DEPENDENCY — restated 6F Part 12/6G Part 10: no code path
  │  exists anywhere in this series' evidence that implements Archive for
  │  any object, so this final node has literally nothing pointing into
  │  it today, regardless of whether Graduation ever fires]
```

**Cyclic dependencies**: **none confirmed this session.** The one *risk* of a cycle previously flagged (7B Part 4: the school domain's event-publish calls flowing into the same `platform_events`/`event_subscriptions` infrastructure the Platform domain owns) remains a risk, not a realized cycle, since the school domain currently consumes zero events (restated 6F Part 7) — there is nothing to complete the loop.

**Summary determination**: of the twelve edges in this graph, **five are healthy hard dependencies** (Academic Structure→Enrollment→Classes→Assessment→Evidence→Projection), **two are false dependencies already bypassed in the live product** (School→Academic Structure, Curriculum→Assessment/Teaching), **one is a genuinely missing linkage** (Recommendations lacking Evidence's trust discipline), **one is a hidden, currently-unsatisfiable dependency** (Reports' identity-space mismatch), **two are correct-but-never-exercised** (Promotion→Graduation), and **one terminal node has no dependency pointing into it at all** (Archive).

---

## Part 3 — Universal Workflow Adoption

Per domain, whether the full six-stage workflow (Draft→Review→Approve→Publish→Monitor→Archive, per Sprint 7E) should apply, a simpler workflow should apply, or none should — reasoning grounded in each domain's already-established stakes and cadence.

| Domain | Full 6-stage | Simpler | None | Why |
|---|---|---|---|---|
| Assessment | **Draft→[light Review]→Approve(self)→Publish→[no Monitor]→[no Archive]** | — | — | Full weight is disproportionate to a routine CAT; a moderation-flagged assessment should escalate into the fuller shape (Review by HOD) while a routine one stays light — this is the domain where a *conditional* application of the full workflow (not a uniform one) fits best |
| Report Cards | ✅ **Full** | — | — | Real-school precedent (7C Part 6) already treats this as a genuine Draft→Review(class teacher comment)→Approve(Principal sign-off)→Publish sequence — EduNexus's dormant `headteacher_comment` column is direct schema evidence this was the original intent |
| Promotion | ✅ **Full**, with a collective Review stage | — | — | 7C Part 6's research is explicit that real promotion is staff-ratified, not single-actor — this is the domain where skipping Review would be a regression from real-school practice, not a simplification |
| Discipline | ✅ **Full**, but Publish happens earlier (parent notification cannot wait for a slow Approve cycle on a warning-tier incident) | — | — | Escalation stakes genuinely vary by severity — a warning is closer to the "simpler" column, a suspension recommendation needs the full chain through Principal Approve |
| Medical | — | ✅ **Draft→Review→Notify→Monitor→Archive** (Approve is a poor fit) | — | Restated 7E Part 5's own honest limitation — delay-as-harm outweighs the value of a senior approval gate for most incidents |
| Career | ✅ **Full — currently the platform's clearest violation of not applying it** | — | — | This is this document's single strongest "should apply the full workflow" finding, precisely because it currently applies **none** of the six stages (Draft only, then immediate Publish with no Review/Approve at all) — restated 6G/7D/7E throughout |
| Evidence confirmation | (Already effectively full, minus a distinct Publish stage since confirmation itself is consumption-readiness) | — | — | The existing pattern to generalize from, not a domain needing new design |
| Adaptive Learning | (Already effectively full, Draft→Approve/Adjust→Publish, Monitor/Archive not separately observed) | — | — | The other existing pattern to generalize from |
| Attendance | — | ✅ **Draft(daily mark)→Publish(same-day)→Monitor(pattern detection)** | — | Per 7E Part 5's own reasoning: a daily mark is closer to a fact than a judgment; Review/Approve gates would slow down a high-frequency, low-individual-stakes action for no governance benefit |
| Guardian linking | — | — | ✅ **None — self-service is correct as-is** | A parent linking themselves to their own child is a self-authorizing action by design; imposing Review/Approve would add friction with no real-school precedent requiring it |
| Curriculum/SOW content | — | ✅ **Draft(AI-assisted)→Review(teacher)→Publish(use in class)** | — | Already close to this shape in practice (teacher reviews before using AI-generated content); Monitor/Archive add little value for content that is naturally superseded term-to-term rather than formally retired |
| School creation/Organization changes | ✅ **Full**, once Administration is activated at all | — | — | Institutional-structure changes (a new school, a new admin-tier role grant) are exactly the low-frequency, high-stakes category the full workflow was designed for — restated 7E Part 5's own framing |
| Fee-related actions (Finance, once it exists) | ✅ **Full**, for waivers/exceptions; **simpler** for routine payment recording | — | — | Mirrors the Assessment pattern — routine data entry stays light, exception handling escalates |

---

## Part 4 — Human Authority Map

For every actor across the 6/7-series, what they should own / never own / may delegate / AI may assist / AI must never make — restated and consolidated from 6E Part 2, 6G Part 2, 7C Part 2, 7D Part 4, 7E Part 4.

| Actor | Should own | Should never own | May delegate | AI may assist | AI must never make |
|---|---|---|---|---|---|
| **Teacher** | Marking, class-level pastoral judgment, Evidence confirmation for their own class | Institution-wide policy, another teacher's class's decisions (absent an explicit ownership-transfer, per CLAUDE.md's `teacher_id`-as-attribution rule) | Marking-adjacent tasks to a co-teacher, never Evidence confirmation authority itself | Marking suggestions, differentiation proposals, lesson content drafts | Final grade certification on a moderation-flagged assessment (that escalates to HOD) |
| **Class Teacher** | Same as Teacher, scoped to owned classes (an ownership relationship, not a distinct role — restated 6E Part 5) | Cross-class decisions | N/A — ownership itself, not typically delegated | Same as Teacher | Same as Teacher |
| **Department Head (future)** | Moderation sign-off, curriculum-sequencing consistency within the department, subject-teacher professional-development scheduling | Individual assessment grades (should see patterns, never override a specific mark), cross-department decisions | Moderation review to a senior subject teacher in a small department | Pattern-flagging across the department's evidence-confidence trends | Overriding an individual teacher's grade unilaterally |
| **Dean of Studies** | Assessment calendar, curriculum-coverage tracking, cross-departmental academic policy | Individual learner decisions, discipline, finance | Calendar administration to an Examinations Officer | Coverage-gap detection across departments | Any individual-learner decision |
| **Registrar** | Enrollment records-of-truth, transcript issuance, transfer/withdrawal paperwork | Pedagogical decisions, discipline | Records processing to an Admissions Officer | Records-completeness flagging | Any decision requiring educational judgment |
| **Principal** | Final institutional sign-off (report publish, graduation certification, expulsion jointly with governance), school-wide policy | Day-to-day classroom decisions (delegated to teachers by design) | Day-to-day operations to Deputy Principal(s) | Whole-school pattern summaries (School/Leadership Intelligence) | Nothing — the Principal is this hierarchy's final human authority, by design the one role AI should never substitute for on any institutional decision |
| **Deputy** | Operational execution of Principal-set policy, lower-tier discipline, timetabling | Final institutional certification (Graduation, expulsion) without Principal ratification | Specific operational domains to Dean of Studies/Registrar/HODs | Same as Principal | Same as Principal, for anything requiring final institutional sign-off |
| **Parent** | Their own child's guardian-linking decision, notification preferences, participation in a Career Guidance conversation (per 7E Part 4's future-architecture finding) | Any other learner's records, academic content (marks, evidence) — restated 6E Part 8's exhaustive zero-violation finding | N/A — parental authority is not typically delegable | Read-through summaries of their own child's Learning/Career Intelligence | Any decision about their child requiring professional judgment (should inform, not replace, e.g., a Guidance conversation) |
| **Learner** | Their own Compass interaction, career-search initiation, and — per 7E Part 9 Law 23 — override authority over their own career recommendation | Any decision requiring institutional authority (their own promotion, grading) | N/A | Personalized tutoring content, career-exploration prompts | Grading their own work, deciding their own promotion |
| **Counsellor** (future) | Guidance/Counselling referral triage, confidentiality-bound individual support recommendations, career-guidance review (the currently-missing stage in Career Intelligence's workflow, per Part 3 above) | Academic grading, institutional discipline authority (advisory input only, per 7C Part 2's real-school research) | Case-specific follow-up to a Year Coordinator | Intake/triage flagging only — never the substantive judgment (7C Part 7's strongest "AI boundary" finding in the whole series) | The substantive counselling judgment itself, for anything touching mental health, family circumstances, or safeguarding |
| **System** (cron/automation) | Rule-based, reversible, low-stakes computation (ranking, term-date rollover, notification dispatch) | Any judgment-bearing decision | N/A | N/A — System IS a form of automation, not an assistant to one | Any decision this table assigns to a named human role |
| **AI** | Suggesting, recommending, predicting, explaining — per 7D Part 6's classification scheme | Final approval of any decision in this table assigned to a human | N/A — AI capability itself is not delegated authority, it is a tool applied under a human's existing authority | (This is AI's own column — see "AI may assist" entries throughout this table) | **Deciding** — the single word this entire fourteen-document series keeps finding exactly one violation of (Career Intelligence) |
| **Platform Admin** | EduNexus's own operational tooling (`app/admin/**`, `ADMIN_EMAILS`-gated) — pilot management, cleanup jobs, revenue stats | **Any school-level educational decision** — this actor is structurally outside the school domain entirely (restated 6E Part 1/7B Part 2) and must never be conflated with `school_admin`/Headteacher | N/A | Platform health/usage summaries | Any school-domain decision whatsoever — this is a hard boundary this series found correctly respected today (no Platform Admin route was ever found touching school-domain educational data) |

---

## Part 5 — Intelligence Placement Audit

For every Intelligence subsystem, its actual behavior classified against prediction/recommendation/decision-support/automation/autonomous — restated and consolidated from 6G Part 3, 7B Part 6, 7D Part 6, 7E Part 3.

| Subsystem | Prediction | Recommendation | Decision support | Automation | Autonomous |
|---|---|---|---|---|---|
| Learning (Compass chat) | — | — | — | ✅ (content generation) | ✅ — content shown live, no review |
| Learning (Compass evidence extraction) | ✅ (mastery inference) | — | ✅ (surfaces to teacher for confirm/reject) | ✅ (engagement facts, guarded) | — |
| Career | ✅ (fit scoring) | ✅ | — (no human decision-support step exists — it bypasses this entirely) | ✅ | **✅ — the series' one confirmed exception, restated a fifth time across this document alone (Parts 1/2/3/4/5)** |
| Teaching (per-tool generators; no unified "Teaching Intelligence" surface confirmed) | — | ✅ (content drafts) | — | — | — |
| Academic Clinic | — | — | ✅ (deterministic diagnostic report for a human to read) | — | — |
| School (Analytics) | — | — | ✅ (in principle — no reachable consumer today, 6H Part 7) | — | — |
| Projection | ✅ (capability/risk/knowledge state) | — | ✅ (feeds every downstream Recommendation) | — | — |
| Evidence | ✅ (confidence scoring) | — | ✅ (surfaces to teacher for review) | ✅ (engagement facts, guarded) | — |

**Overlaps identified**: Academic Clinic and Career Intelligence overlap at the repository layer (`repos.careers`, 7B Part 4) despite occupying different columns in this table (deterministic decision-support vs. autonomous) — the shared data access does not currently cause a behavioral overlap, but it means a future change to one domain's persistence layer risks silently affecting the other.

**Missing intelligence**: Attendance pattern-detection (no data source exists to compute over, 7A Part 6), Operational Intelligence entirely (no institutional data exists, 6H Part 7), a unified Teacher Intelligence surface (fragmented across per-tool generators, `lib/teachingIntelligence/`'s relationship unresolved, 7B Part 1).

**Premature intelligence**: **Career Intelligence's autonomy is this document's clearest case of premature intelligence** — not because the underlying prediction/recommendation quality is poor (this series never audited that), but because the *governance* infrastructure (a human decision-support step, an accountable reviewer, a Guidance domain to sit inside) was never built before the autonomous capability shipped. This is the single most repeated finding across all fourteen prior documents.

**Future intelligence** [FUTURE ARCHITECTURE, restated from 7E Part 3]: Department/Leadership/Operational Intelligence, all correctly sequenced *after* their prerequisite domains (Departments, populated Organization, Finance/Facilities data) exist — building any of these ahead of their data source would repeat Career Intelligence's premature-intelligence pattern in a new domain.

---

## Part 6 — Modular Build Plan [FUTURE ARCHITECTURE — reasoning applied to evidence, not a new investigation]

If EduNexus restarted tomorrow, the order below reflects what this series' evidence shows is *foundational to* what — not a re-ranking of feature importance, but a dependency-respecting build sequence derived from Part 2's graph:

**Stage 0 — Foundation** (nothing above this can be trusted without it): Identity (already the series' one fully-resolved success — restated, not rebuilt), Schools (activate the already-correct Core schema with a real, reachable creation/onboarding path — closing the single largest "unreachable, otherwise well-built" gap this series found), Organization (make `school_admin`/`headteacher`/`deputy_headteacher` actually grantable — restated 6E Part 1 as the second-largest such gap).

**Stage 1 — Academic Structure**: resolve the `students`/`learners` identity split (this series' single most-cited root cause — Stage 0.5 through 7B, appearing in nearly every duplication finding), then Grade/Subject/Class consolidation (6B's 3-and-4-way duplications) — because every subsequent stage inherits whichever identity/structure decision is made here.

**Stage 2 — Enrollment**: a single, canonical enrollment record, built on Stage 1's resolved identity — closing the `class_students`/`learner_enrollments` duplication.

**Stage 3 — Teaching & Learning**: this is *already the platform's strongest area* and needs the least new foundational work — SOW/Lesson Planning/Compass are MOSTLY COMPLETE (Part 1). The main Stage 3 work is boundary cleanup (Curriculum vs. Teaching, 7B Part 3), not new capability.

**Stage 4 — Evidence & Projection**: **already built, already Reference Quality** (Part 1) — this stage's only work is *extending its reach* to cover Assessment moderation (activating `assessment_quality_flags`) and Teacher's informal observations (7D Part 7's identified gap), not rebuilding anything.

**Stage 5 — Recommendations, governed**: this is where Career Intelligence's governance retrofit belongs — adding the Review/Approve stages Part 3 above found entirely missing, extending Evidence's own confirm/reject pattern rather than inventing a new one. Adaptive Learning and Holiday/Remedial Planning need no Stage 5 work — they are already correctly governed.

**Stage 6 — Reporting**: reconcile the two Report Card pipelines (6F Part 6) — the Core pipeline's ranking/averaging is already correct; the work is connecting it to real Evidence/Projection data and giving it a reachable UI, not building new computation.

**Stage 7 — Administration**: activate Promotion/Graduation/Withdrawal/Transfer with real UI and the collective-decision shape 7C Part 6's research recommends — this is the stage with the most *new* build work relative to what exists, since the underlying code is closer to a correct starting point than a finished one.

**Stage 8 — Communication, unified**: reconcile the three parent-linking mechanisms into one — a genuine design decision (which becomes canonical), not merely activation.

**Stage 9 — New Domains** [FUTURE ARCHITECTURE, no today-state exists]: Guidance & Counselling first (both because it is this series' most urgent governance gap, per Part 5 above, and because 7A/7B's evidence shows its absence is actively distorting an existing system, not merely leaving a gap), then Attendance (a schema fossil already anticipates it), then Departments (moderation activation depends on it existing as a real organizational unit, not just a permission check), then Finance/Medical/Transport/Boarding/Library/Discipline/Alumni in the priority order 7A/7B already established.

**Stage 10 — Expansion**: Operational/Department/Leadership Intelligence, only once their Stage 9 data sources exist — per Part 5's "premature intelligence" warning, this stage must never be pulled forward ahead of its prerequisites the way Career Intelligence was.

**Note on deviation from the sprint's example order**: the sprint's own example list places "Evidence, Projection, Recommendations" after "Teaching, Learning" and before "Reporting, Administration" — this document's Stage 4/5 placement matches that example closely, with one deliberate difference: this document places **Identity/Schools/Organization activation ahead of Academic Structure resolution** (rather than treating School as a one-line prerequisite), because Part 2's dependency graph found School Created is not merely first in sequence but currently **unreachable** — a different, more severe problem than "comes first," and one that should be solved before, not alongside, the identity-split work.

---

## Part 7 — Technical Debt Prioritization

Every unresolved item cited to its originating sprint (Stage 0.5 through 5-series, per `docs/engineering/implementation-log.md`; 6-series and 7-series per this document's prior parts), classified per the sprint's own five-tier scale.

**Critical before pilots** (blocks trust in what the 50 pioneer teachers are already using today):
- The `76/51/31` vs `75/50/25` unratified CBC grading-boundary conflict in `lib/assessments/gradeCalculator.ts` (Sprint 4D) — actively written to `learner_marks.mean_grade` on every legacy-gradebook save, a live, silent grading-inconsistency risk the instant any school sets a custom `grade_boundaries` value.
- `gradeLevelFromScore`'s divergence from the canonical grading engine (Sprint 4D/4E) — report cards and cohort/analytics dashboards can already disagree on the same student's letter grade once a custom boundary is set; currently latent (Sprint 4C0's finding that no school has set one yet still holds per that sprint's own citation) but one settings write away from firing.

**Critical before 10 schools** (survives one pilot school's idiosyncrasies but breaks under real multi-school variation):
- Teacher→School identity resolution (Sprint 4F/4E) — the legacy gradebook path "does not currently know its School," per Sprint 4F's own executive verdict; this blocks not just grading but any future feature needing school-scoped behavior on the legacy path, including this document's own Stage 1/6 work.
- The Core admission-created-by-admin-tier-user gap (ADR-0002 Part 7, Sprint 5F) — 9 real, live users with no `teachers` row hit a clear but blocking error; needs resolution before Core's admin-tier path (this document's Stage 0/7) can be activated for real schools.
- Report Card publish-guard gap (Sprint 4C0 Part 5, re-confirmed still open through Sprint 4C1) — `generateReportCards` can overwrite an already-published report with no guard; a multi-school environment increases the chance of concurrent/repeated calls exposing this.

**Critical before 100 schools** (fine at small scale, breaks at institutional volume):
- The `students`/`learners` identity split itself (Stage 0.5 through this document's Part 2/6) — tolerable today because Core is unreached; becomes the central blocking issue the moment Stage 0/1 (School/Organization activation) succeeds and real schools start using both paths simultaneously.
- Event bus activation (6F Part 7) — a dead letter-box is invisible at pilot scale; at institutional scale, the absence of real cross-domain notification becomes an operational liability (missed hand-offs, manual polling workarounds).
- `canManageClass`/`canViewLearner` being built (Sprint 1A) but never adopted (Sprint 2A's discovery) — redundant `auth.getUser()`-equivalent calls (up to 4 sequential in one request path) are a performance/scale concern, not a pilot-scale one.

**Can wait**:
- `ke-cbc.ts`'s dead grading code (Sprint 4D) — currently harmless, only a risk if a future developer accidentally reuses it as an 8th boundary implementation; a documentation/removal task, not urgent.
- Assignments-domain (3 copies) and Notifications-domain (2 copies) grading duplication (Sprint 4D) — unmigrated but not yet shown to cause a live disagreement.
- Academy naming collision with a future student Certificate (7A Part 3) — only becomes urgent once a student-certificate feature is actually proposed.

**Architectural only** (no immediate operational risk, but the right decision now avoids a harder migration later):
- The Report Card two-pipeline duplication (6F Part 6) — resolving which pipeline is canonical is exactly the kind of decision this document's Stage 6 depends on, and should happen before either pipeline gets more investment.
- Departments/Faculty/Learning-Area boundary questions (7B/7C Part 4) — deciding the target org-chart shape now avoids retrofitting Departments' permission model twice.
- The Academic Clinic/Career Intelligence shared-repository boundary (7B Part 4) — cheap to separate now, more expensive once more features depend on the shared access pattern.

**Research only** (genuinely unresolved, needs investigation before any decision):
- `lib/learnerModel/`/`lib/learnerIntelligence/`'s relationship to `lib/projection/` (7B Part 1/3) — this document's Stage 4/5 cannot safely proceed without knowing whether these are superseded, parallel, or differently-scoped.
- `lib/teachingIntelligence/`'s relationship to the "no unified Teacher Intelligence surface" finding (6H Part 7, 7B Part 1) — directly relevant to this document's Stage 10, currently un-investigatable from existing evidence alone.
- `lib/iam/`'s relationship to `lib/core/permissions.ts` (7B Part 1) — a possible second authorization surface; must be resolved before this document's Stage 0 Organization-activation work, since building on the wrong authorization layer would be a costly mistake.
- Fairness/bias monitoring across Career Intelligence's output population (7D Part 9) — flagged as genuinely open, no repository evidence either way; relevant to Stage 5's governance retrofit but not answerable without new investigation.

---

## Part 8 — Educational Operating System Layers

The permanent layer model, derived from this series' own repeated findings rather than borrowed from a generic architecture template — each layer justified by a specific, cited pattern this series found actually operating (or, where it does not yet operate everywhere, at least proven achievable in one subsystem):

```
Presentation
  (app/teacher/**, app/(parent)/**, app/(student)/**, app/admin/**)
  — restated 6E Part 3: teacher-complete, everything-else-partial-to-absent
    ↓
Application (thin routes)
  (app/api/**)
  — restated CLAUDE.md/6E Part 8: routes hold no business logic, confirmed
    by an exhaustive zero-violation search
    ↓
Workflow
  (the Draft→Review→Approve→Publish→Monitor→Archive shape, proven by
   Evidence's lifecycle and Adaptive Learning's approve gate)
  — this layer is named explicitly, distinct from "Decision" below,
    because this series found it is the STAGE SEQUENCE that is
    currently missing for most domains, even where the underlying
    Decision logic (who is allowed to decide) is already correct
    ↓
Decision
  (lib/core/permissions.ts's require*/can* functions, and each domain's
   own approval-gate logic)
  — kept distinct from Workflow because 6G/7D found these are
    independently variable: a domain can have correct Decision-layer
    authorization (Assessment does) while having no Workflow-layer
    staging at all (Assessment also has none, beyond self-publish)
    ↓
Evidence
  (learner_evidence, the confirmed-fact layer)
  — its own layer, not folded into "Information" generically, because
    this series repeatedly found Evidence's discipline (confirmation,
    trust-tiering, immutability) is qualitatively different from
    ordinary data storage, and deserves architectural recognition as
    a distinct layer other domains should be built to resemble
    ↓
Projection / Intelligence
  (lib/projection/, lib/career/, lib/adaptiveLearning/, etc.)
  — computation over confirmed Evidence only; kept below Evidence in
    this diagram specifically to make CLAUDE.md's enforcement rule
    (never read Evidence directly, only via recomputeLearnerProjection)
    visible as a structural, not just documented, constraint
    ↓
Repositories
  (lib/repositories/*.ts, 24 files, restated 7B Part 1)
  — the sole data-access layer; every lib/core/*.ts module this series
    read directly delegates here rather than querying tables inline
    (restated 7B Part 11/7E Part 9 Law)
    ↓
Database
  (Supabase/Postgres, RLS-enforced where reached — restated 6E Part 8's
   RLS inventory)
```

**Why these specific layers, not a generic template**: the Workflow/Decision split is this document's one deliberate departure from a textbook layered-architecture diagram, and it is evidence-driven, not aesthetic — Part 3 above found domains where Decision-layer authorization is correct but Workflow-layer staging is entirely absent (Assessment, Career Intelligence before any retrofit), which a generic "Application→Business Logic→Data" diagram would not surface as two independently-broken things needing two independently-scoped fixes.

---

## Part 9 — Five-Year Evolution Roadmap [FUTURE ARCHITECTURE throughout — reasoning, not commitment]

**Year 1 — Activation**: major capabilities: School/Organization reachability (Stage 0), the `students`/`learners` identity resolution (Stage 1), Career Intelligence's governance retrofit (Stage 5's most urgent item). Major architecture: the Workflow layer (Part 8) becomes a real, generalized capability rather than two isolated instances. Major intelligence: none new — this year is about governing what already exists. Major organizational maturity: admin-tier roles become grantable for the first time. Major workflow maturity: the six-stage shape reaches Assessment moderation and Report Card publish. Major AI maturity: every AI subsystem reaches at minimum Evidence's confirm/reject discipline. Major research questions to resolve: the three flagged UNKNOWNs from Part 7 (`learnerModel`/`learnerIntelligence`, `teachingIntelligence`, `iam`) — none of Year 2's work should proceed on these subsystems until resolved.

**Year 2 — Reporting & Administration**: major capabilities: unified Report Cards (Stage 6), Promotion/Graduation/Withdrawal/Transfer with real UI (Stage 7), Guidance & Counselling's first version (Stage 9, the highest-priority new domain per Part 6's ordering). Major architecture: the identity-space mismatch (Part 2's hidden dependency) is fully closed, not merely documented. Major intelligence: Career Intelligence's output is reviewed by a real Counsellor role for the first time. Major organizational maturity: Registrar and Dean of Studies become real, populated roles, not seed-script labels. Major workflow maturity: Promotion's collective-decision shape (7C Part 6) is real. Major AI maturity: a fairness/bias monitoring pass (Part 7's research-only item) is completed before Career Intelligence's governed version scales further. Major research questions: whether Stream is a meaningful concept requiring its own layer (7B/7C's unresolved open question) should be answered by real multi-school usage data collected this year.

**Year 3 — Communication & Departments**: major capabilities: unified parent-linking (Stage 8), Departments as a real organizational unit (Stage 9), Attendance (the schema fossil finally gets a producing workflow). Major architecture: Department Intelligence (Part 5's "future intelligence," now no longer premature since its prerequisite domain exists). Major intelligence: pattern-detection Intelligence for Attendance (7A Part 6's previously-noted "no data source" gap, now closed). Major organizational maturity: HODs are real, with real moderation authority — activating `assessment_quality_flags` at last. Major workflow maturity: moderation sign-off becomes a real Review stage inside the Assessment workflow (Part 3's conditional-application design). Major AI maturity: Teaching Intelligence's relationship to `lib/teachingIntelligence/` (resolved in Year 1's research phase) informs whether a unified Teacher Intelligence surface is built this year. Major research questions: whether a genuine multi-campus (7A Part 3's "Campus" concept, VERIFIED absent) need has emerged from real school growth.

**Year 4 — Institutional Expansion**: major capabilities: Finance (fee structure, invoicing — the highest-justified of the remaining absent domains per 7A/7B/7C), Medical (duty-of-care baseline). Major architecture: Operational Intelligence's data prerequisites (Finance/Facilities data) begin to exist, but the Intelligence layer itself is deliberately built *after*, not alongside, per Part 5's premature-intelligence warning. Major intelligence: School/Leadership Intelligence gains a real, populated consumer for the first time (Principal/Deputy roles, now genuinely reachable since Year 1). Major organizational maturity: the full Reference School org chart (7A/7C's nine titles) has real, distinct authority for every title, not just three collapsed enum values. Major workflow maturity: Medical's Draft→Review→Notify→Monitor→Archive shape (Part 3) is live. Major AI maturity: Operational Intelligence's first version ships, strictly scoped to institutional patterns, never individual-learner decisions (Part 3's organizing rule, restated from 7E Part 3). Major research questions: whether Transport/Boarding/Library (the lower-justified remaining absent domains) have accumulated real demand evidence from the now-larger school base, informing whether Year 5 should include them.

**Year 5 — Full Operating System**: major capabilities: whichever of Transport/Boarding/Library/Discipline/Alumni Year 4's research confirmed real demand for; Government Reporting graduates from export-labeling-only to a real, if still export-based, compliance integration. Major architecture: the seven-layer reference model (6H Part 12) has working end-to-end hand-offs across *every* domain, not just the Academics→Evidence→Projection vertical this series found working in Year 0. Major intelligence: Department/Leadership/Operational/Learning/Career Intelligence all share a common governance shape (the Workflow layer, Part 8) for the first time — no domain's Intelligence output reaches a human without a named, accountable review step, closing this entire series' single most repeated finding. Major organizational maturity: EduNexus's Organization layer is, for the first time, as populated and reachable as its Evidence layer already was in Year 0. Major workflow maturity: every domain in Part 3's table operates at its recommended workflow weight. Major AI maturity: the platform-wide principle this document's Part 4 states for every actor — "AI must never make [the decisions this table assigns to a human]" — is true not by accident (as it mostly is today, Career Intelligence excepted) but by a consistently-applied architectural pattern. Major research questions: at this point, the research questions become forward-looking rather than remedial — e.g., whether a genuine multi-school/district-level Community Layer (Part 1's diagram) has emerged as a real need, a question this document cannot answer today because no evidence yet exists for it.

---

## Part 10 — Executive Blueprint

### One-Page Diagram
```
        PRESENTATION  (teacher-complete; parent/student partial; admin absent)
              │
        APPLICATION  (thin routes — confirmed clean, 6E Part 8)
              │
         WORKFLOW  (Draft→Review→Approve→Publish→Monitor→Archive —
                     proven by Evidence + Adaptive Learning, missing elsewhere)
              │
         DECISION  (lib/core/permissions.ts — correct where it exists,
                     unreachable for admin-tier roles)
              │
         EVIDENCE  (learner_evidence — Reference Quality, the model to extend)
              │
      PROJECTION / INTELLIGENCE  (correct for Learning; ungoverned for Career;
                                   absent for School/Dept/Leadership/Operational)
              │
        REPOSITORIES  (lib/repositories/* — the sole data-access layer, respected)
              │
          DATABASE  (Supabase/Postgres, RLS-enforced where reached)
```

### One-Page Narrative
EduNexus is, today, a Learning Intelligence Platform with an unactivated School Operating System's schema laid beneath it (6H Part 13). One vertical slice — Teacher → Assessment → Evidence → Projection → gated Recommendation — works end to end, is well-governed, and is the model every other domain should be built to resemble. Everything institutional (Organization, Administration, Reporting-of-record, and every domain this series found completely absent — Finance, Medical, Discipline, Guidance) is either unreachable despite correct code, or has no code at all. The single most corroborated, most-repeated finding across all fourteen prior documents is that **Career Intelligence is the one place AI decides rather than recommends** — not because it is technically unsound, but because it was built ahead of the governance layer (a human reviewer, a Guidance domain to belong to) that every other AI subsystem in this platform correctly has. This blueprint's implementation order (Part 6) exists to close that gap first, then extend the same discipline outward, domain by domain, in the priority order this series' own evidence — not speculation — has established.

### One-Page Implementation Roadmap
**Now**: fix the two Critical-before-pilots grading conflicts (Part 7). **Stage 0–1**: make School/Organization reachable; resolve `students`/`learners`. **Stage 5 (can start in parallel with Stage 0–1)**: govern Career Intelligence — this is this series' most urgent single retrofit and does not require the identity-split work to be finished first, since it operates on already-confirmed Evidence/Projection data regardless of which identity space a given learner sits in. **Stage 6–8**: Reporting, Administration, Communication, in that order, each unlocking the next. **Stage 9–10**: new domains and their Intelligence, strictly sequenced (data before computation, per Part 5's premature-intelligence warning) — see Part 9's five-year breakdown for the specific yearly sequencing.

### One-Page Contributor Guide
Before writing any new feature: (1) find its domain in Sprint 7B's Domain Map and its decision(s) in Sprint 7D's Decision Catalogue (ED-01 through ED-35) — if it doesn't have an ID yet, it may be new territory this series never searched for (7E Part 8's Law 24 finding that this has already happened three times). (2) Check whether the domain's Intelligence, if any, follows the Evidence pattern (confirm/reject, trust-tiered) or the Career Intelligence pattern (autonomous, unreviewed) — if the latter, stop and raise it, per 7B Part 11's AI-governance law, before shipping. (3) Use the Workflow layer (Part 8 of this document) — Draft/Review/Approve/Publish/Monitor/Archive, or a documented simpler variant per Part 3's reasoning — rather than a single atomic write, for anything beyond the lowest-stakes, highest-frequency actions (Attendance-shaped, not Promotion-shaped). (4) Never write directly to another domain's canonical table (7B Law 2, confirmed zero violations today — keep it that way). (5) If in doubt about which of `students`/`learners`, or which of the two Report Card pipelines, or which grading-boundary constant to use — stop and ask; these are the platform's three most consequential unresolved-duplication traps, and guessing wrong compounds technical debt this document's Part 7 already found expensive to unwind.

### One-Page "What Never Changes"
The Evidence lifecycle's core discipline — confirmation before consumption, corrections as new superseding facts never rewritten history, confidence as a score never a certainty, a named human accountable for every review — is this platform's one architectural achievement every prior document in this series independently arrived at as the standard to extend, never to relax. `teachers.id` remains the canonical teacher identity (ADR-0002) — this is not open for reconsideration absent a genuine new canonical conflict. `teacher_id` on any evidence-producing row means attribution, never access-control (CLAUDE.md, restated throughout) — this rule exists because relaxing it silently reintroduces exactly the kind of access gap this series' RLS research (6E Part 8) found once already. AI recommends; a named human decides — every domain built from this point forward is checked against this rule before it ships, not after a Career-Intelligence-shaped problem is found in production a second time.

---

## Educational Value Check

For every major capability this blueprint proposes activating or building — reasoned against the sprint's own six questions, not a new investigation:

| Capability | Easier teaching? | Reduces workload? | Improves outcomes? | Improves operations? | Could an ordinary LMS do this? | What makes EduNexus different |
|---|---|---|---|---|---|---|
| School/Organization activation | Indirectly (unblocks everything downstream) | Removes duplicate manual admin work currently absorbed by teachers (restated 6E Part 3's finding that teachers are the de facto admissions/enrollment officers) | Indirectly | **Yes, directly** | An ordinary SIS could model roles; EduNexus's advantage is connecting institutional structure to the same Evidence/Projection engine, not the org chart itself |
| `students`/`learners` identity resolution | No direct teacher-facing effect | Removes the silent risk of disagreeing systems (Part 7) | Indirectly, by making Report Cards trustworthy | **Yes, directly** — this is foundational plumbing, not a feature | Yes, trivially — this is not a differentiator, it is a prerequisite | N/A — this is infrastructure, not a product capability |
| Career Intelligence governance retrofit | No — Teacher is not the actor in this loop | No | **Yes, directly, and this is the point** — an ungoverned AI recommendation is a *worse* outcome than none, per 7D Part 9's external-guidance research | Indirectly (reduces institutional liability) | **No** — an ordinary LMS does not typically ship autonomous, unreviewed career-trajectory AI at all; most either omit career guidance entirely or keep it human-only | EduNexus's advantage, once governed, is that the recommendation is *evidence-grounded* (real confirmed Evidence/Projection, not a generic quiz) — this is the differentiator worth keeping, once the missing human step is added |
| Unified Report Cards | **Yes** — one pipeline instead of two to reason about | **Yes** — currently a teacher-facing risk that two systems disagree | **Yes** — a report grounded in confirmed Evidence/Projection, not raw marks, is a more accurate signal | Yes | An ordinary LMS's report generator has no equivalent confidence/trust layer — this is a genuine differentiator once activated (restated 7A Part 8) | The Evidence-grounding, specifically |
| Guidance & Counselling domain | Indirectly (removes a currently-misplaced burden from Career Intelligence's AI, which is not a substitute for a counsellor) | **Yes, for whichever human ends up in this role** — today, nobody owns this at all, so "workload" is currently just an unhandled gap, not distributed work | **Yes, directly** — per 7C Part 7's research, this is closest to a duty-of-care requirement, not an optional feature | Yes — closes an active governance liability | **No** — this is explicitly a human-staffed function in every real-school model researched (7C); no LMS "does" counselling, and EduNexus should not try to make AI do it either | EduNexus's differentiator here should be that the *AI's role stays correctly scoped* (intake/triage only, per 7C Part 7) — not that AI replaces the counsellor |
| Attendance | Marginal, if entry is friction-free | Marginal | Indirectly, by finally populating the `days_present`/`days_absent` fossil already in the report card | Yes | **Yes, trivially** — attendance tracking is table-stakes for any SIS/LMS, no differentiation here | None claimed — this is correctly a "do the basic thing" item, not an intelligence showcase |
| Departments/Moderation activation | Indirectly (HODs get real tools) | Marginal for classroom teachers, real for HODs | **Yes** — activates a dormant quality-assurance mechanism (`assessment_quality_flags`) this series found evidence a prior design pass believed was needed | Yes | Partially — moderation workflows exist in some LMS/SIS products | The differentiator is connecting moderation directly to the same Evidence-confidence data already computed for every assessment, rather than a separate manual process |
| Finance (Year 4+) | No | No, for teachers specifically | No, directly | **Yes, significantly** — per 7A Part 7's research, fee status is often a hard operational gate | **Yes, trivially** — this is a commodity SIS/ERP capability | None claimed, and none should be — this is explicitly the kind of capability this document recommends building *because* real schools need it operationally, not because EduNexus can do it uniquely |

**The pattern this check surfaces, stated plainly**: this blueprint's highest-value items (Career Intelligence governance, unified Report Cards, Guidance & Counselling) are exactly the ones where an ordinary LMS could **not** easily replicate what EduNexus does, because they depend on the Evidence/Projection engine this series found is genuinely differentiated. This blueprint's lower-value-but-still-necessary items (Attendance, Finance) are exactly the ones where an ordinary LMS/SIS already does this adequately — and this document recommends building them anyway, honestly, as **operational necessities that unblock the differentiated work**, not as capabilities that should be marketed as innovative. This distinction — differentiated-by-Evidence versus commodity-but-necessary — should govern how future contributors talk about, not just build, each item in Part 9's five-year roadmap.

---

## What This Document Does Not Do

Per its own scope: it proposes no schema, no migration, no code, and no specific sprint-by-sprint implementation ticket — Part 9's five-year roadmap is reasoning applied to already-established evidence, explicitly labeled [FUTURE ARCHITECTURE], not a commitment. It does not resolve the three Research-only technical-debt items (Part 7) — those require dedicated investigation sprints before any Stage 0/4/5/10 work in Part 6 can safely proceed on the subsystems they concern. No ADR is raised: this document's findings are prioritization and sequencing reasoning applied to conflicts and gaps already fully documented by Sprints 6A–7E and the pre-6A engineering history — none of them are a newly discovered canonical-domain conflict.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only `docs/architecture/sprint-8a-operating-system-implementation-blueprint.md` and the implementation log entry were written.

## Stop Condition

STOP after this document. Wait for explicit approval before Sprint 8B. This document is the master reference for implementation sequencing — but it authorizes no implementation itself. Any actual code, schema, or migration work proposed against this roadmap requires separate scoping and explicit approval, beginning with the Critical-before-pilots items in Part 7 if and when that approval is given.
