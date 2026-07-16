# Sprint 6H — School Operating System Blueprint

**Mode: READ ONLY, SYNTHESIS ONLY.** This sprint modifies no code, schema, migration, route, repository, service, or test. It performs no new codebase investigation — every claim below is drawn from and cited back to Sprints 6A–6G, which were themselves grounded in direct code/schema inspection. Where this document draws a new conclusion by *combining* two or more prior findings, that synthesis is marked **[SYNTHESIS]** to distinguish it from a restated fact.

**Builds on**: 6A (canonical structure), 6B (structure reconciliation), 6C (operating model), 6D (workflow model), 6E (organizational model), 6F (information flow model), 6G (decision & authority model). This document does not repeat those audits — it combines them into one architectural picture.

---

## Part 1 — System Layers

| Layer | Purpose | Major components | Boundaries | Dependencies | Maturity |
|---|---|---|---|---|---|
| **Identity** | Answer "who is this" once, canonically | `lib/core/identity.ts`, `teachers.id` (ADR-0002 ratified), `students`/`learners` (unresolved dual identity, Stage 0.5) | Deliberately separated from authorization (`identity.ts` never decides, only resolves — 6E Part 1) | Underlies every other layer | **Mixed** — Teacher identity fully resolved; Learner identity unresolved (two tables, 68-vs-3 file usage split, restated 6A/6F) |
| **Organization** | Model who holds authority and over what | `SchoolUserRole` enum, `school_users`, `teachers`, three parent-linking mechanisms | Real DB-enforced role taxonomy exists but most of it is unreachable (6E Part 1: `headteacher`/`deputy_headteacher` provably ungrantable) | Identity | **Foundation, largely inert** — schema-complete, population-incomplete |
| **Academic Structure** | Model Grade/Subject/Class/Enrollment/Assessment Type | Core (`grades`, `subjects`, `classes`) vs. legacy (raw int, free text, `teacher_classes`) vs. curriculum (`sow_grades`, `sow_learning_areas`) — three-to-four-way duplication throughout (restated 6B) | No canonical resolution between the competing representations | Identity, Organization | **Legacy-dominant** — the legacy/hardcoded-catalogue representations are what production actually runs on |
| **Workflow** | Sequence multi-step processes with hand-offs | End-of-Term orchestration (`lib/core/endOfTerm.ts`), Evidence lifecycle state machine, Transfer | Almost every workflow found is single-actor, single-write; only two genuine multi-stage/multi-actor workflows exist platform-wide (6D: End-of-Term, Evidence) | Academic Structure, Decisions | **Thin** — well-designed where it exists, mostly absent or unreachable |
| **Information** | Move data from origin to consumption correctly | Assessment→Evidence→Projection spine (6F's one clean chain); a dead-end event bus (`lib/events/`); two non-communicating Report Card pipelines | Evidence/Projection boundary is CLAUDE.md-enforced (never read Evidence directly, only via `recomputeLearnerProjection`) | Academic Structure, Workflow | **Bimodal** — one excellent spine, everything else fragmented or dead-ended |
| **Decisions** | Determine who/what has authority to decide, and record it | Evidence confirm/reject (fully traceable, 6G Part 9), everything else (thin-to-no traceability) | Teacher Authority dominates by elimination (6G Part 12) — Administrative authority exists in code, never exercised | Information, Organization | **Bimodal**, mirroring Information layer exactly |
| **Intelligence** | Compute derived understanding of a learner and act on it | `recomputeLearnerProjection`, `capabilityExtractor.ts` (CLAUDE.md: the Reasoning layer's permanent first citizen), Career Intelligence, Adaptive Learning, Learning Compass | Correctly gated for Evidence-sourced computation; **not** gated for Career Intelligence's output (6G Part 3) | Decisions, Information | **Advanced in computation, inconsistent in governance** |
| **Presentation** | Surface information/decisions to a human | `app/teacher/**` (fully built), `app/(parent)/**` (partial), `app/(student)/**` (partial), `app/admin/**` (platform-operator only, not school-admin) | No UI exists for Core/institutional-administration decisions at all (6E Part 3) | Every layer above | **Teacher-complete, everything-else-partial-to-absent** |
| **Integration** | Connect to external systems / other organizations | `lib/events/` (dev-platform webhook subscriptions, organizations-scoped), Paystack/M-Pesa payment webhooks, WhatsApp sender | Structurally separate from the school domain — the event system serves external developer-platform organizations, not internal cross-module school-domain reaction (6F Part 2) | Everything (nominally); nothing (in practice, for school-domain events) | **Present for payments/dev-platform, absent for internal school-domain integration** |

---

## Part 2 — Operating Model

**[SYNTHESIS]** Reading 6D–6G together as one operating model:

- **Administration** = the Organization layer's admin-tier roles + the Workflow layer's admin-gated actions (Withdrawal, Transfer, Promotion, Report Publish, End-of-Term). **What it constitutes in evidence: a fully-specified, schema-and-permission-complete domain with zero live population and zero reachable UI** (6E Part 1/3, 6D Workflow 15, 6G Part 2/12). Administration does not currently *act* in EduNexus — it exists as a designed-but-dormant capability.
- **Academics** = the Teacher actor + the Class/Assessment/Evidence workflow chain. **What it constitutes in evidence: the entire live product.** Every decision this series found actually executing in production (6G Part 1) is an Academics decision made by a teacher.
- **Intelligence** = the Evidence→Projection→{Career, Blueprint, Holiday Planner, Monday Panel/Parent Pulse} fan-out (6F Part 2/3). **What it constitutes in evidence: a validated core (Evidence/Projection) feeding four independent, non-communicating recommendation silos** (6F Part 3, "branches, does not merge").
- **Communication** = three non-communicating parent-linking mechanisms + two independent notification triggers (email/WhatsApp) (6D Workflow 9, 6E Part 1, 6F Part 1). **What it constitutes in evidence: a working but fragmented capability**, functional for real parents today but structurally uncoordinated.
- **Analytics** = read-only derivations off legacy tables (`app/api/school/**` — strand health, intervention efficacy, intelligence). **What it constitutes in evidence: consistently read-only** — 6E Part 8's exhaustive search found zero analytics routes writing to any report-of-record table.
- **Platform** = the separate developer-platform/organizations context (Phase 8 foundation, `organizations`, `organization_members`, event subscriptions, billing) plus the `ADMIN_EMAILS`-gated founder tooling (`app/admin/**`). **What it constitutes in evidence: structurally distinct from the school domain** — different role vocabulary (`owner`/`admin`/`developer`/`billing_admin` vs. `SchoolUserRole`, 6E Part 8), different identity model, different purpose (external developers building on EduNexus's API, not school staff running a school).
- **AI** = `lib/ai/deepseek.ts`, the confirmed single entry point (6E Part 7), consumed at varying autonomy levels from "advisor, teacher must act" (Lesson Plan/SOW/Remedial) through "gated automation" (Evidence engagement facts, Adaptive Learning) to "fully autonomous, no gate" (Career Intelligence, Compass chat content).

**How they interact [SYNTHESIS]**: Academics is the only domain that reliably hands off to Intelligence (via confirmed Evidence) and to Communication (via alerts/notifications). Administration does not hand off to or receive from anything, because it does not currently operate. Analytics receives from Academics but sends nowhere (no publish authority, 6E Part 8). Platform is entirely disjoint from the other six — it shares no identity, role, or data model with the school domain (6E Part 1's Platform Operator finding, 6F Part 2's event-subscription finding).

**Where responsibilities begin and end [SYNTHESIS]**: Academics' responsibility begins at Admission and, in the live product, effectively ends at Evidence confirmation and Report generation — nothing downstream of Report Cards (Promotion, Graduation, Archive) is reachable (6D Part 3, 6G Part 10). Intelligence's responsibility begins where Academics' confirmed Evidence ends and fans out to four silos with no defined end-state reconciliation. Administration's responsibility, as designed, would begin at School creation and govern the institutional lifecycle end-to-end — but begins nowhere in practice.

---

## Part 3 — School Lifecycle

**[SYNTHESIS, primarily restating Sprint 6F's end-to-end "Amina" narrative and 6D's workflow chain, combined into the specific stage sequence requested]**

```
School Created
  → reachable only via lib/core/school.ts::createSchool, which itself has NO UI caller
    (6E Part 3, "Core has no onboarding UI today" — code's own comment, lib/core/school.ts:54-58)
  ⚠ LIFECYCLE STAGE 1 IS ALREADY UNREACHABLE IN PRODUCTION
    ↓
Teachers
  → self-signup (app/teacher/setup), bridged to a school by NAME MATCH
    (ensureSchoolMembership, lib/core/school.ts:59-86) — since no school was ever created
    through the dormant path above, teachers bridge into whatever school row exists by
    other means (real production schools are NOT created via the Core path at all —
    UNKNOWN exact provenance of live `schools` rows, not re-traced this session, flagged
    as a genuine open question this synthesis surfaces for the first time)
    ↓
Learners
  → admitted in one indivisible write with Class Allocation (6D Workflow 1) — WORKS,
    is the platform's most-exercised action
    ↓
Classes
  → teacher self-service creation, teacher becomes owner by construction, no
    administrative appointment step exists (6D Workflow 4, 6E Part 1) — WORKS
    ↓
Learning
  → SOW/Lesson Plans (teacher-driven, AI-assisted) + Learning Compass (student-driven,
    AI-tutored, live/unreviewed content) — WORKS, is real, is used
    ↓
Assessment
  → teacher creates/marks/publishes, single actor, no second reviewer (6D Workflow 7) — WORKS
    ↓
Evidence
  → confidence-tiered, auto-confirm or teacher-review, DB-trigger-enforced state machine
    (6F Part 2, 6G Part 5) — WORKS, is the platform's best-governed stage
    ↓
Projection
  → pure computation over confirmed Evidence only (recomputeLearnerProjection) — WORKS,
    is the platform's cleanest computation
    ↓
Reports
  → ⚠ LIFECYCLE FORKS HERE, does not merge (6F Part 2/3): the real, parent-facing report
    is generated by a LEGACY AI PIPELINE reading raw Marks directly — bypassing Evidence
    and Projection entirely. The pipeline that WOULD read the Intelligence chain's output
    (ranked, term-averaged, Core-native) is fully built (lib/core/report-cards.ts,
    lib/ranking) but reachable only through the dormant End-of-Term endpoint.
  ⚠ EVERYTHING PRODUCED BY EVIDENCE AND PROJECTION IS DISCARDED AT THIS STAGE FOR THE
    REPORT A REAL PARENT ACTUALLY SEES
    ↓
Promotion
  → ⚠ LIFECYCLE STOPS HERE FOR PRACTICAL PURPOSES: both promotion tables have zero live
    rows anywhere in this codebase's evidence (6D Workflow 10, 6G Part 10) — no learner
    has ever been promoted through any code path this six-sprint series found
    ↓
Graduation
  → ⚠ UNREACHABLE, COMPOUNDING THE PRIOR BREAK: structurally unrepresentable in the
    legacy table (student_promotions.to_grade NOT NULL) and unreachable in Core
    (6C/6D/6E) — even if Promotion worked, Graduation could not follow from it in the
    legacy pipeline that holds every real learner's identity
    ↓
Archive
  → ⚠ NEVER REACHED, NEVER IMPLEMENTED: no code path anywhere in this six-sprint series'
    evidence ever sets learners.status = 'archived', despite the enum value existing
    (6F Part 12 — "Archive is the single most consistently missing lifecycle stage
    across every information object traced")
```

**Where the lifecycle terminates prematurely [SYNTHESIS]**: there are, precisely, **two real break points** and one **near-total stop**: (1) the Reports fork, where the entire upstream Intelligence investment (Evidence, Projection) is bypassed by the pipeline real users see; (2) the near-total stop at Promotion, past which nothing in this six-sprint audit series found a single exercised production code path. Everything from School Creation through Reports is either fully working (Learners → Assessment → Evidence → Projection) or has a working equivalent that real usage happens to route around (Reports). Everything from Promotion onward is, per the combined evidence of 6C/6D/6E/6F/6G, **architecturally present but operationally nonexistent.**

---

## Part 4 — Architectural Strengths

**[SYNTHESIS of 6A–6G's positive findings, gathered here for the first time as a single list]**

- **Evidence** (`lib/intelligence/evidenceLifecycle.ts`, `learner_evidence`): the single strongest subsystem in the platform on every axis this series measured — organizationally correct (teacher review vs. system auto-confirm, cleanly separated by trust tier, 6E Part 7), the one validated information chain (6F Part 2), and the only fully traceable decision in the codebase (`reviewed_by`/`reviewed_at`/`review_reason`, correction lineage via `supersedes`/`superseded_by`, frozen confidence snapshots, 6G Part 9). It is also DB-trigger-enforced, not merely convention (`enforce_evidence_lifecycle_transition`).
- **Projection** (`lib/projection/recompute.ts`): a pure, deterministic computation with a single canonical read path, enforced by both CLAUDE.md convention and (per 6F) actual codebase discipline — zero AI calls in the engine, zero direct reads of raw evidence by any downstream consumer.
- **Ranking** (`lib/ranking/`): correctly separated into `rankingEngine.ts`/`ties.ts`/`comparators.ts`, standard-competition-position tie handling — genuinely well-built, its only weakness being that it sits inside the dormant Report Card pipeline (6F Part 2/6).
- **Authorization** (`lib/core/permissions.ts`/`identity.ts`): a real, well-designed capability-check layer built specifically to prevent the exact failure mode (copy-pasted, inconsistent role checks) that caused two of Stage 0's original security gaps — restated across 6D–6G as the one place `require*`/`can*` functions are consistently composed rather than duplicated.
- **Core schema** (`schools`, `school_users`, `learners`, `learner_enrollments`, Report Cards): a textbook, correctly normalized SIS data model — its weakness is total unreachability (6E Part 3), not design quality.
- **Reference School** (`scripts/reference-school/`): the one place this series found evidence of an intended fuller organizational reality (9 real staff titles, realistic student counts) — valuable precisely because it is the only artifact in the repository that models what a complete Kenyan secondary school's organization actually looks like, even though it never connects to the live authority model (6E Part 4/6).
- **Assessment** (`class_assessments`, marking/publish flow): the platform's most-exercised, most reliable workflow — not architecturally sophisticated, but simple, working, and the true foundation everything else (Evidence, Projection, Intelligence) is built on.
- **Adaptive Learning's draft/approve pattern** (`app/api/teacher/classes/[classId]/differentiation/approve/route.ts`): the cleanest AI/human decision boundary found anywhere in the platform (6E Part 7, 6G Part 3) — worth naming as a strength distinct from Evidence, since it demonstrates the pattern is achievable outside the Evidence subsystem specifically.

---

## Part 5 — Architectural Weaknesses

**[SYNTHESIS]**

- **Administration**: fully specified, zero reachable population or UI (6E Part 1/3) — the platform's largest single gap, because so much else (Report Publish, Promotion, Graduation, Withdrawal, Transfer, End-of-Term) is gated behind it.
- **Attendance**: VERIFIED absent as a domain across three independent audits (6C, 6D, 6E), yet the schema anticipates it (`school_report_cards.days_present`/`days_absent`, discovered 6G Part 6) — a decision point designed for and never built.
- **Workflow Engine**: does not exist — every "workflow" is either a single atomic write or a hard-coded call chain with no persisted intermediate state (6D Executive Summary); the one genuine multi-stage workflow (End-of-Term) has zero UI callers.
- **Archive**: universally missing across every information object this series traced, with no exception found (6F Part 12, restated 6G Part 10) — not a single object (Learner, Assessment, Report Card, Career Profile, Platform Event) has a confirmed archival mechanism.
- **Departments/Subject Heads/Registrar/Examinations Office/Finance Office**: VERIFIED absent, present only as seed-script labels with zero corresponding authority (6C, 6E Part 4).
- **Timetable**: VERIFIED absent entirely (6C, restated 6D/6E).
- **ERP** (finance, HR, procurement, facilities): no evidence found anywhere in the series; `mpesa_payments` is platform subscription billing, not school-fee/finance management (6E Part 9).
- **Communication**: functionally working but structurally fragmented — three non-communicating parent-linking mechanisms, two independent notification systems, no single "who is this parent to this learner" resolution shared across them (6D Workflow 9, 6E Part 1, 6F Part 1).
- **Event/Integration bus**: confirmed dead — `registerEventHandler()` has zero callers, no school-tenant event subscription exists anywhere in the evidence, every `publishEvent()` call across 15+ modules writes to a permanently-unread `platform_events` table (6F Part 2/7, the largest single information dead end found in the series).
- **Report Card duplication**: two independently-computed, non-communicating "this is the learner's term performance" pipelines that could disagree with no mechanism to detect it (6F Part 6) — a duplicate *concept* without duplicate *code*, which the document itself notes is arguably worse than a shared-code bug.
- **AI governance inconsistency**: Career Intelligence operates with none of the traceability, trust-tiering, or approval gating that Evidence has (6G Part 3/9) — the platform's one clear instance of AI authority exceeding every boundary observed elsewhere.

---

## Part 6 — Domain Maturity Map

| Domain | Classification | Support |
|---|---|---|
| Teacher Identity | **Production Ready** | ADR-0002 ratified canonical, zero duplication, used everywhere (6A) |
| Learner Identity | **Legacy** | `students` de facto canonical (68-file usage), `learners` isolated Core equivalent, unresolved (Stage 0.5, restated throughout) |
| Class/Assessment (legacy) | **Operational** | Real, working, exercised daily; not "Production Ready" only because of the still-open duplication with Core's isolated equivalents (6B) |
| Core institutional schema (schools, learners, promotions, report cards) | **Dormant** | Fully built, zero-to-near-zero production rows, no UI (6E, 6F, 6G, consistently) |
| Evidence | **Production Ready** | DB-trigger-enforced, fully traceable, correctly governed (6F/6G) |
| Projection | **Production Ready** | Pure, deterministic, single canonical read path, feeds four real downstream consumers |
| Career Intelligence | **Experimental** | Functionally live and used, but ungoverned — no approval gate, no trust tracking, prior sprints (memory: Sprint 28/29) found calibration issues (near-universal over-specialization, missing Junior/Senior gate on one surface) |
| Adaptive Learning | **Foundation** | Correct draft/approve pattern exists, not established this series how widely it is actually used in production (not re-verified) |
| Learning Compass | **Operational** | Live, used, generates both real-time chat content and gated Evidence — the platform's most-used AI-touching feature by all indications in this series |
| Reference School / Seed Pipeline | **Foundation** | A well-built fixture/testing tool, not a production pathway |
| Report Card (legacy AI pipeline) | **Operational** | The only one real parents see, works, but with no ranking/term-averaging and unclear publish gating (6F/6G) |
| Report Card (Core pipeline) | **Dormant** | Fully built, zero production rows, unreachable UI |
| Promotion/Graduation | **Not Started, operationally** despite code existing | Two dormant tables, zero live rows, structurally incapable of representing graduation in the legacy table (6C/6D) |
| Withdrawal/Transfer | **Foundation** | Correctly built (Transfer especially), API-reachable, zero UI, Withdrawal is incomplete even when called |
| Organization/Authority model (admin-tier roles) | **Dormant** | Schema-complete, DB-CHECK-enforced, provably unpopulated in production (6E) |
| Parent Communication | **Operational, fragmented** | Real, working, used by real parents — but via three non-communicating mechanisms |
| Analytics | **Foundation** | Read-only derivation layer exists, breadth/depth not fully re-verified this series beyond "reads legacy tables, writes nothing" |
| Event/Integration Bus | **Dormant** | Fully built for the developer-platform context, structurally disconnected from the school domain (6F) |
| Attendance | **Not Started** | Zero schema, zero code, only downstream column fossils (`days_present`/`days_absent`) suggesting it was once planned |
| Timetable / Departments / Discipline / ERP | **Not Started** | VERIFIED absent across every relevant audit in this series |
| Platform/Dev-Portal (organizations, billing, API keys) | **Foundation-to-Operational** | A structurally separate, apparently more actively maintained context (not itself audited by 6A–6G, noted only where it intersected — 6E Part 1's Platform Operator, 6F's event-subscription mechanism) |

---

## Part 7 — Intelligence Placement

**[SYNTHESIS]** Using 6F Part 11 and 6G Parts 3/11 combined:

| Intelligence category | Exists today? | Where | Governance |
|---|---|---|---|
| **Learning Intelligence** (Evidence, Projection, Capability Extraction) | **Yes, fully** | `lib/intelligence/`, `lib/projection/`, `lib/career/capabilityExtractor.ts` | Correctly gated — the series' one clear success |
| **Career Intelligence** | **Yes, fully — but ungoverned** | `lib/career/careerEngine.ts`, `matchEngine.ts`, `careerIntelligenceEngine.ts` | No approval gate, no trust marker (6G Part 3/9) |
| **Teacher Intelligence** (something that helps a teacher decide, distinct from a student-facing tool) | **Merely implied** | Lesson Plan/SOW/Remedial/Differentiation generators exist, but no single "Teacher Intelligence" surface synthesizes across a teacher's whole class the way Career Intelligence does for one student — Adaptive Learning is the closest, and it is scoped to grouping recommendations only | Correctly gated where it exists |
| **School Intelligence** (an institutional, cross-class or cross-teacher view for an administrator) | **Merely implied** | `app/api/school/**` (strand health, intervention efficacy, intelligence) exists and is read-only, but per 6E's finding that the admin tier who would consume it cannot be populated, this Intelligence has, in effect, **no reachable consumer** | N/A — nobody with the role to view it can exist in production |
| **Parent Intelligence** | **Partially exists** | `app/api/parent/career-intelligence`, Compass activity summaries — but restated 6F, these are largely read-throughs of Learning/Career Intelligence's output, not a distinct parent-scoped computation | Inherits whatever governance its source (Career Intelligence) has — i.e., weak |
| **Operational Intelligence** (something that helps run the school as an institution — staffing, enrollment trends, capacity) | **Does not exist, not even implied** | No evidence found across 6A–6G of any computation over Organization/Workflow-layer data (as opposed to Academic/Evidence-layer data) | N/A |
| **Administrative Intelligence** | **Does not exist, not even implied** | Same reasoning as School Intelligence — the actor who would need it cannot be populated, and no code computes anything scoped to an admin-tier decision (Promotion, Withdrawal, Report Publish) in the way Projection computes something scoped to a learning decision | N/A |

**[SYNTHESIS] Where Intelligence belongs, per the evidence**: every Intelligence subsystem that exists today is anchored to the **Academics** domain (Part 2) — because that is the only domain with live data flowing through it (Part 3). School/Administrative/Operational Intelligence are not merely unbuilt; per this series' consistent finding that the Administration domain itself has no live actor or data (6E, 6D, 6F, 6G all independently confirm this), there is currently **nothing for those Intelligence categories to be computed over even if they were built** — this is a data/organizational precondition gap, not a missing-feature gap.

---

## Part 8 — School Operating System Readiness

**[SYNTHESIS, extending 6E Part 9 and 6F Part 13]**

| Target system shape | Readiness | Evidence |
|---|---|---|
| **Traditional LMS** | **Largely met** | Content delivery (SOW/Lesson Plans), activity (Compass, Assignments), feedback (Assessment/marking) — this is what the live product already is, functionally |
| **Student Information System** | **Data model ready, operationally not ready** | Core's schema (`schools`, `school_users`, `learners`, `learner_enrollments`, promotions, report cards) is a correct SIS model (6E Part 9) but has near-zero production rows and no UI (Part 6, this document) |
| **School ERP** | **Not ready, minimal evidence of intent** | No finance/HR/procurement/facilities domain found anywhere in the series; "Finance Officer" exists only as a seed-script label (6E Part 4/9) |
| **Learning Intelligence Platform** | **Substantially met, for the Learning-scoped subset** | Evidence/Projection/Career/Compass constitute a genuine, working Intelligence layer (Part 7) — the strongest readiness claim this document can support with direct evidence |
| **Complete School Operating System** | **Not ready** | Requires Organization (6E: inert), Workflow (6D: thin/unreachable outside Academics), Information (6F: fragmented outside the Evidence spine), and Decision (6G: bimodal) layers all functioning together — this series found exactly one vertical slice (Academics→Evidence→Projection→Intelligence) where all four layers cohere, and near-total absence of the same four layers cohering for the institutional/administrative slice |

---

## Part 9 — Implementation Priorities

**[SYNTHESIS — grouped from already-discovered gaps only, per this sprint's explicit instruction not to invent new projects. No project below is new; each cites the sprint that discovered it.]**

**Immediate** (gaps that are cheap to close and block nothing else from being decided correctly):
- Career Intelligence traceability/trust-tier gap (6G Part 9) — the sharpest AI-governance inconsistency found, and the pattern to fix it (Evidence's own schema) already exists in the same codebase.
- Withdrawal's incompleteness (`learners.status` never updated, restated 6D/6G) — a narrow, well-isolated bug with a known fix location.
- The duplicated `SCHOOL_ADMIN_ROLES` constant (6E Part 8) — a one-line CLAUDE.md-rule violation with a trivial, already-identified fix.

**Near-term** (require a product decision, not just a code fix, but the decision itself is narrow):
- Decide whether the Core Report Card pipeline (ranking/term-averaging, fully built, 6F Part 2/6) should be wired into the live parent-facing report, or formally deprecated — closing the "two independently-computed report summaries" duplication (6F Part 6) either way.
- Decide whether Promotion/Graduation should be built a UI at all, given zero production rows across the entire series (6D/6G) — either activate the existing, correctly-scoped routes with a UI, or formally mark the domain out of scope for the pilot phase.

**Medium-term** (require genuine new design work, but the *gap* itself is already fully documented by this series, not newly invented):
- Reconciling the `students`/`learners` identity split (Stage 0.5, restated in every subsequent sprint) — the single root cause this series traced to at least four separate downstream findings (Report Card fork, Promotion's inertness, Withdrawal's incompleteness, the Organization layer's population gap).
- Consolidating the three parent-linking mechanisms into one (6D Workflow 9, 6E Part 1, 6F Part 1) — a genuine design question (which mechanism becomes canonical), not just a bug fix.
- Reconciling the four-way Subject and three-way Grade duplication (6B) — same shape of problem as Learner identity, smaller blast radius.

**Long-term** (require new domains this series confirmed do not exist at all, not fixes to existing ones):
- Attendance, Timetable, Departments/Subject Heads, Discipline, ERP (Finance/HR) — all VERIFIED absent (6C/6E), all explicitly out of scope for this document to design, listed here only as the long-term category this series' evidence points to, per the sprint's own instruction to use only already-discovered gaps.
- An internal event/integration bus connecting the school domain's own modules (distinct from the existing developer-platform event system, 6F Part 7) — needed before Administration, Academics, and Intelligence could ever hand off to each other in real time rather than through direct table reads.

---

## Part 10 — Vision Alignment

**[SYNTHESIS]** Read against CLAUDE.md's stated project overview ("Kenya CBC/CBE AI education platform for teachers, parents, and students... 50 pioneer beta teachers"):

- **Already supported**: the CBC/CBE-focused teacher tooling (SOW, Lesson Plans, Assessment, Evidence, Learning Compass) — this is the vision the live product already delivers, and delivers with genuine architectural quality (Part 4).
- **Requires architectural work** (a design decision, not just more code): the `students`/`learners` identity reconciliation, the Report Card duplication, the parent-linking consolidation — all Part 9 Medium-term items. The vision of a single coherent learner record cannot be delivered by adding more features on top of two competing identity representations.
- **Requires implementation only** (the architecture already supports it, nobody has built the UI): almost everything in the Organization/Workflow layers that this series found "fully specified in code, zero UI" — Promotion, Graduation, Withdrawal, Transfer, End-of-Term, Report Publish. **[SYNTHESIS, notable]**: this is a larger category than might be assumed — a meaningful fraction of what a "School Operating System" vision would need is not an architecture gap at all, but a UI-and-onboarding gap over already-correct `lib/core/*` code.
- **Requires new domains**: Attendance, Timetable, Departments, Discipline, ERP, Operational/Administrative Intelligence (Part 7) — none of these can be delivered by finishing existing work; they do not exist in any form.

---

## Part 11 — Architectural Principles

**[SYNTHESIS]** Extracted from patterns that recur consistently across 6A–6G's evidence, each verified against a specific finding rather than asserted from CLAUDE.md alone:

- **Canonical identity, where achieved, is durable**: Teacher identity (ADR-0002) has never been found duplicated or contested in any of the seven audits — the one fully successful application of this principle.
- **Evidence-first, genuinely practiced, not just stated**: CLAUDE.md's rule ("no hallucinated traits... every insight needs Observation/Evidence/Confidence/Action") is not merely policy — 6F/6G both independently confirmed the schema and trigger layer actually enforce it (immutability, confidence tiers, supersession-not-editing).
- **Thin routes, mostly held**: 6E Part 8's exhaustive boundary-violation search found zero cases of a route containing business logic that belonged elsewhere — routes consistently delegate to `lib/`.
- **Pure engines, held where they exist**: Projection (zero AI calls, confirmed 6E Part 7) and Ranking (deterministic, confirmed 6F Part 6) are both genuinely pure — this principle is real, not aspirational, where the code was actually built to it.
- **Layer separation (identity vs. authorization)**: `lib/core/identity.ts` vs. `lib/core/permissions.ts` is a real, working separation, explicitly designed (per its own code comments) to prevent the exact copy-paste authorization failure Stage 0 originally found.
- **Human-in-the-loop, inconsistently held**: strongly true for Evidence, Adaptive Learning, Holiday/Remedial Planning; **not true** for Career Intelligence and Compass chat content (6G Part 3) — this principle is real where practiced, but not platform-wide, which is precisely why 6G's Decision Responsibility Matrix exists.
- **Teacher authority, the platform's dominant unstated philosophy**: not written down anywhere as a principle in CLAUDE.md, but empirically the single most consistent finding across 6D/6E/6G — every decision that executes in production is a teacher's.
- **Additive migration / no rename-in-place**: restated from the Learner Record Layer decisions and the Evolution Blueprint (not re-verified this session, but consistent with every duplication finding in this series — Core tables were added alongside legacy ones, never replacing them in place, which is *why* the duplication findings in 6B/6F/6G exist at all).
- **Repository pattern, held in the code this series read directly**: every `lib/core/*.ts` module this series inspected (`school.ts`, `learners.ts`, `transfers.ts`, `report-cards.ts`, `endOfTerm.ts`) delegates its actual database access to `repos.*`, never querying tables inline — consistent with CLAUDE.md's "ALL database calls go through `lib/` functions only."

---

## Part 12 — School Operating System Reference Model

```
Organization
  (who exists: teachers real, admin-tier dormant, three parent mechanisms — 6E)
    ↓ [BROKEN HAND-OFF: admin-tier cannot act, so nothing flows from here into
       administrative Workflows in practice]
Workflows
  (what happens: teacher-driven paths work; admin-gated paths (Promotion, Report
   Publish, End-of-Term, Withdrawal, Transfer) exist in code, unreachable — 6D)
    ↓ [WORKING HAND-OFF, Academics only: Assessment → Evidence trigger fires reliably]
Information
  (what flows: the Evidence→Projection spine is clean and validated; the event bus
   that would let Workflows/Decisions/Intelligence react to each other in real time
   is a confirmed dead end — 6F)
    ↓ [WORKING HAND-OFF: confirmed Evidence → Projection, gated correctly]
Decisions
  (who decides: teacher, almost exclusively, by elimination; Evidence is the one
   fully traceable decision; Career Intelligence is the one AI decision with no
   human gate at all — 6G)
    ↓ [WORKING HAND-OFF for Learning Intelligence; NO HAND-OFF for School/
       Administrative/Operational Intelligence, because Organization/Decisions never
       populate an admin-tier actor to decide anything for Intelligence to compute
       over — Part 7, this document]
Intelligence
  (what gets computed: Career, Blueprint, Holiday Planner, Monday Panel/Parent
   Pulse — four independent silos fed from one shared Projection, none aware of
   each other — 6F Part 3)
    ↓ [PARTIAL HAND-OFF: Learning/Career Intelligence reaches Presentation; School/
       Administrative/Operational Intelligence has no Presentation surface with a
       reachable audience]
Presentation
  (teacher-complete; parent/student partial; school-admin UI does not exist at all
   — 6E Part 3, restated Part 1 this document)
    ↓ [NO HAND-OFF FOUND: nothing in the school domain currently reaches External
       Integrations — the one integration layer that exists (lib/events/) serves a
       structurally separate developer-platform context]
External Integrations
  (Paystack/M-Pesa payment webhooks — real and working, but scoped to billing, not
   school-domain events; the developer-platform's own webhook system is unconnected
   to anything above this line — 6F Part 2/7)
```

**How the layers interact, in one sentence [SYNTHESIS]**: information and authority flow cleanly and completely down exactly one vertical path — Academics (Organization) → Assessment/Evidence (Workflow/Information) → confirmed-Evidence-gated computation (Decisions/Intelligence) → teacher/student/parent-facing surfaces (Presentation) — and every other path this reference model could show is either broken at the first hand-off (Administration) or has no Presentation audience to reach even where the computation exists (School/Administrative/Operational Intelligence).

---

## Part 13 — Executive Verdict

**[SYNTHESIS, the sprint's central conclusion]**

EduNexus is currently best described as **a Learning Intelligence Platform with the schema-level foundation of a School Operating System already laid, but not yet activated.**

It is **not** best described as a plain LMS — the Evidence/Projection/confidence-tiering machinery (Part 4, 7) is architecturally beyond what a content-and-activity LMS requires; a plain LMS does not need a DB-trigger-enforced trust-tier state machine.

It is **not** best described as a SIS — the SIS-shaped data model exists (Core) but, per every one of 6A–6G's independent confirmations, does not operate: it has no reachable UI, near-zero production rows, and an organizational layer that cannot be populated (6E).

It is **not** best described as "an AI Tutor" alone — Learning Compass is one genuine subsystem among several (Evidence, Projection, Career Intelligence, Assessment, Reports), not the whole platform; framing it as an AI Tutor undercounts the Evidence-governance work that is this platform's actual architectural achievement.

It is **more** than a generic "School Platform" — that label doesn't distinguish the one place (Learning Intelligence) where this platform's engineering is genuinely sophisticated from the many places (Administration, Workflow, Attendance, Timetable) where it is entirely absent, and this document's whole purpose has been to show that distinction matters.

It is best understood as **"School Operating System Foundation"** — not yet "Integrated School Operating System," because Part 12's reference model shows, with direct evidence from all seven prior sprints, that only one of the model's seven layers (the Academics→Evidence→Projection→Intelligence vertical) currently has working hand-offs end to end. The other verticals a real School Operating System would need (Administration, institutional Workflow, cross-domain Information exchange, Administrative/Operational Decision-making and Intelligence) are, per this series' consistent and repeated finding, **present in schema and permission form and absent in every other respect** — not missing by oversight, but by a pattern this series has now documented seven independent times: build the institutional layer correctly, then never connect it to a live user.

---

## One-Page Architecture Map

```
School
│
├── Organization
│     Primary responsibility:  who holds authority over what
│     Canonical entities:      teachers.id (ratified), school_users/SchoolUserRole,
│                               students.parent_user_id / class_students.parent_id /
│                               learner_guardians (three, unresolved)
│     Main consumers:          lib/core/permissions.ts, every app/api/teacher/** route
│     Current maturity:        Foundation (schema-complete), Dormant (admin-tier)
│     Biggest architectural gap:  admin-tier roles cannot be granted in production —
│                               `updateSchoolUserRole` has zero callers anywhere in app/
│
├── Academic Structure
│     Primary responsibility:  Grade / Subject / Class / Enrollment / Assessment Type
│     Canonical entities:      teacher_classes (de facto) vs. classes (Core, isolated);
│                               4-way Subject duplication; 3-way Grade duplication
│     Main consumers:          SOW, Lesson Plans, Assessment, Career matching
│     Current maturity:        Legacy-dominant, Operational
│     Biggest architectural gap:  no canonical resolution between competing
│                               representations anywhere in this structure
│
├── Workflows
│     Primary responsibility:  sequence multi-step, multi-actor processes
│     Canonical entities:      Evidence lifecycle state machine, End-of-Term orchestration
│     Main consumers:          Report Card generation, Evidence review
│     Current maturity:        Thin — two genuine multi-stage workflows exist platform-wide
│     Biggest architectural gap:  no workflow engine; the one best-built workflow
│                               (End-of-Term) has zero UI callers
│
├── Information
│     Primary responsibility:  move data from origin to consumption correctly
│     Canonical entities:      learner_evidence, learner_projections, platform_events
│     Main consumers:          Projection, Career Intelligence, Blueprint, Holiday Planner
│     Current maturity:        Bimodal — one clean validated spine, one confirmed dead
│                               event bus, two non-communicating Report Card pipelines
│     Biggest architectural gap:  the students/learners identity split, root-causing
│                               most other duplication found in this series
│
├── Decisions
│     Primary responsibility:  determine and record who/what has authority to decide
│     Canonical entities:      learner_evidence's lifecycle columns (the one full
│                               audit trail in the schema)
│     Main consumers:          Evidence confirm/reject UI, Promotion/Transfer routes
│     Current maturity:        Bimodal — Evidence fully traceable, everything else thin
│     Biggest architectural gap:  Career Intelligence decides and executes with zero
│                               approval gate and zero trust/traceability marker
│
├── Intelligence
│     Primary responsibility:  compute derived understanding and recommend/act
│     Canonical entities:      recomputeLearnerProjection, capabilityExtractor.ts
│     Main consumers:          Career Intelligence, Blueprint, Holiday Planner, Monday
│                               Panel/Parent Pulse, Adaptive Learning
│     Current maturity:        Advanced computation, inconsistent governance
│     Biggest architectural gap:  School/Administrative/Operational Intelligence have
│                               no data to compute over, because Organization/Workflow
│                               never populate a live admin-tier actor
│
├── User Experience
│     Primary responsibility:  surface information/decisions to a human
│     Canonical entities:      app/teacher/**, app/(parent)/**, app/(student)/**
│     Main consumers:          teachers (fully served), parents/students (partially),
│                               school admins (not served at all)
│     Current maturity:        Teacher-complete, everything-else-partial-to-absent
│     Biggest architectural gap:  zero UI for any Core/institutional-administration
│                               decision — the entire admin-tier Workflow layer has
│                               nothing to be operated through
│
└── Platform
      Primary responsibility:  cross-cutting infrastructure and external integration
      Canonical entities:      organizations/organization_members (dev-platform,
                               structurally separate), Paystack/M-Pesa webhooks
      Main consumers:          billing, external developer-platform API consumers
      Current maturity:        Foundation-to-Operational, but disjoint from the
                               school domain
      Biggest architectural gap:  no internal event/integration bus connects the
                               school domain's own modules to each other in real time
```

---

## What This Document Does Not Do

Per its own scope: it performs no new codebase investigation, proposes no implementation, and does not design the identity reconciliation, event bus, Report Card unification, or any other gap named in Part 9. It does not choose which Part 9 priority tier to act on first — that is a product decision, not an architectural conclusion this document is positioned to make. No ADR is raised — every conclusion here synthesizes conflicts and gaps 6A–6G already identified and, where relevant, already determined did not rise to the level of a new canonical-domain conflict; this document found no additional conflict in the act of combining them.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only this document and the implementation log entry were written.

## Stop Condition

This document completes the 6A–6H architectural audit series. No Sprint 6I is scheduled or implied by this document. Any future implementation work should be scoped and approved separately, informed by — but not automatically authorized by — the priorities in Part 9.
