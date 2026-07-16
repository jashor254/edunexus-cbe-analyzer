# Sprint 7B — EduNexus Domain Architecture Audit

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim is marked VERIFIED (confirmed by direct code/schema inspection this session, or restated unchanged from Sprints 6A–7A and cited back to them), LIKELY (strong indirect evidence, not exhaustively confirmed), or UNKNOWN (flagged rather than guessed).

**Builds on**: the full 6A–6H series and 7A (structure, reconciliation, operating model, workflow, organization, information flow, decision & authority, the Operating System Blueprint, and the exhaustive absent-domain census). This sprint applies a new lens to the same evidence base — **bounded-context/domain-driven design** — asking not "what exists" but "what are the natural seams," and adds one new piece of ground truth not previously enumerated by this series: a complete inventory of `lib/`'s 58 subdomain folders and `lib/repositories/`'s 24 repository files, read directly this session (`ls lib/*/`, `ls lib/repositories/*.ts`, `ls app/api/*/`).

---

## Part 1 — Domain Discovery

The sprint's example list is explicitly not assumed correct. Cross-referencing it against `lib/`'s actual 58 subdomain folders surfaces several real domains the example list omitted (Academy, Adaptive Learning, Grading, Ranking, Holiday, Remedial, Study Groups, Learner Record, Learner Model, Learner Intelligence, Formative Signals, Attention Feed, Knowledge Graph, Teaching Intelligence, Parent Pulse, IAM, Events, Jobs, Search, Documents, Sync, Monitoring/Observability, i18n) — these are added to the catalogue below, each marked **[NEW, not in sprint's example list]**.

| Domain | Status | Evidence |
|---|---|---|
| **Identity** | **Exists, partially resolved** | `lib/core/identity.ts` — Teacher identity fully resolved (ADR-0002); Learner identity unresolved (`students`/`learners` split, Stage 0.5) |
| **Organization** | **Exists in schema, dormant in practice** | `school_users`/`SchoolUserRole` — restated 6E: admin-tier roles provably ungrantable in production |
| **Admissions** | **Exists only as a side effect of another domain's write** | Restated 6D/7A Part 1 — no distinct admission decision, table, or actor; a single teacher write that also performs Enrollment |
| **Enrollment** | **Exists, duplicated** | `class_students` (legacy) / `learner_enrollments` (Core) — restated 6B |
| **Academic Administration** | **Exists in schema only, UI-absent** | Core's Term/Academic Year/End-of-Term orchestration (`lib/core/school.ts`, `lib/core/endOfTerm.ts`) — restated 6D Workflow 15, 6E Part 3 |
| **Curriculum** | **Exists, duplicated, content-rich** | `lib/curriculum/`, `lib/cbcCurriculum.ts`, `sow_learning_areas`/`sow_grades`, hardcoded `lib/curriculum/subjects.ts` — restated 6B; genuinely rich KICD content (restated 7A Part 2) |
| **Teaching** | **Exists, not distinctly tracked** | `lib/sow/`, `lib/lessonPlan/`, `lib/row/` — restated 6D Workflow 6: "Teaching" is a composite of Teacher Assignment + Class + Subject, not its own tracked entity, but the SOW/Lesson Plan/Record-of-Work code is a real, distinct domain of its own regardless |
| **Learning** | **Exists, live, AI-mediated** | `lib/compass/`, `app/api/learn/` — restated 6E Part 7: Compass chat is fully autonomous, unreviewed |
| **Assessment** | **Exists, production-grade** | `lib/assessments/`, `class_assessments` — restated throughout 6D–6G as the platform's most-exercised workflow |
| **Evidence** | **Exists, reference-quality** | `lib/intelligence/evidenceLifecycle.ts`, `learner_evidence` — restated throughout as the platform's strongest subsystem |
| **Learning Intelligence** | **Exists, reference-quality (Projection) + governance gap (Career)** | `lib/projection/`, `lib/career/capabilityExtractor.ts` |
| **Career Intelligence** | **Exists, live, ungoverned** | `lib/career/careerEngine.ts`, `matchEngine.ts` — restated 6G Part 3/9: fully autonomous, no trust marker |
| **Academic Clinic** | **Exists, deterministic** | `lib/academicClinic/` — restated 6E Part 7: no AI in this pipeline itself, the backbone Career Intelligence layers onto |
| **Parent Engagement** | **Exists, fragmented** | Three non-communicating linking mechanisms — restated 6D Workflow 9, 6E Part 1 |
| **Student Life** (extracurricular, wellbeing, non-academic) | **Effectively absent**, closest analogue is Academy (see below) | No dedicated domain found beyond gamified Academy content |
| **Attendance** | **Exists only as a schema fossil** | `school_report_cards.days_present`/`days_absent`, zero producing workflow — restated 6G Part 6 |
| **Timetable** | **Completely absent** | VERIFIED, restated 6C/6D/6E |
| **Finance** (school fees) | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1 — distinct from `lib/payments/`/`lib/billing/`, which are platform subscription/token billing, not school-fee management |
| **Communication** | **Exists, fragmented** | `lib/notifications/`, `lib/whatsapp/` — two independent trigger systems, restated 6F Part 1 |
| **Library** | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1/3 |
| **Medical** | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1 |
| **Transport** | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1 |
| **Boarding** | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1 |
| **Discipline** | **Completely absent** | VERIFIED, exhaustively confirmed 7A Part 1/4 — no Suspension/Expulsion decision has any code form |
| **Guidance & Counselling** | **Absent as a human domain; territory occupied by AI** | VERIFIED absent as a role/workflow (7A Part 2); Career Intelligence functionally substitutes without governance |
| **School Leadership** | **Exists in permission schema only** | `SCHOOL_ADMIN_ROLES`, restated 6E Part 1 — headteacher/deputy provably ungrantable |
| **Analytics** | **Exists, read-only, thin** | `app/api/school/**` (strand health, intervention efficacy) — restated 6E Part 8: no write authority anywhere |
| **Reporting** | **Exists, duplicated** | Two independent Report Card pipelines — restated 6F Part 2/6 |
| **Compliance** | **Exists only as export-format labeling** | KNEC-formatted CSV export, no live integration — restated 7A Part 2 |
| **Platform** | **Exists, structurally separate** | `lib/organizations/`, `lib/billing/`, `app/api/platform/**` — restated 6E Part 1/9: a genuinely different bounded context (dev-platform), not the school domain |
| **Developer Platform** | **Exists, structurally separate** | `lib/developer.repository.ts`, `app/api/organizations/**` — the API-key/webhook/marketplace surface documented extensively in prior architecture docs (`docs/architecture/developer-platform-*`), out of this series' school-domain scope except where it intersected (6E Part 1's Platform Operator, 6F's event-subscription mechanism) |
| **AI Infrastructure** | **Exists, single entry point, well-governed at the infra level** | `lib/ai/deepseek.ts` — restated 6E Part 7: confirmed sole DeepSeek call site platform-wide |
| **Operations** (cron, jobs, background processing) | **Exists, real** | `lib/jobs/`, 17 cron routes — restated 6E Part 8 |
| **Academy** [NEW] | **Exists, live, distinct from school-domain Learning** | `lib/academy/` — a teacher-facing continuing-education/gamification product (missions, reflections, certificates), confirmed 7A Part 3 as the source of a naming collision with a hypothetical future student "Certificate" |
| **Adaptive Learning** [NEW] | **Exists, the cleanest AI/human boundary found in the series** | `lib/adaptiveLearning/` — restated 6E Part 7/6G Part 3 |
| **Grading / Ranking** [NEW] | **Exists, pure, reference-quality, dormant in production use** | `lib/grading/`, `lib/ranking/` — restated 6F Part 6: correctly built, sits inside the dormant Core Report Card pipeline |
| **Holiday / Remedial Planning** [NEW] | **Exists, live, correctly gated** | `lib/holiday/`, `lib/remedial/` — restated 6E Part 7: teacher-approve gate + documented auto-publish fallback |
| **Study Groups** [NEW] | **Exists, not audited by any prior sprint in this series** | `lib/studyGroups/` — a cron (`study-group-challenges`) confirmed by 6E Part 8's cron inventory; functional depth UNKNOWN, not investigated further this session |
| **Learner Record** [NEW] | **Exists, the canonical timeline synthesis layer** | `lib/learnerRecord/timeline.ts` — per CLAUDE.md, "the one function that answers 'what do we know about this learner, in order'" |
| **Learner Model / Learner Intelligence** [NEW] | **Exists, overlapping with Projection — relationship UNKNOWN, not resolved by any prior sprint** | `lib/learnerModel/`, `lib/learnerIntelligence/`, distinct repository files (`learner-model.repository.ts`, `learner-intelligence.repository.ts`) from `lib/projection/` — flagged as a genuine open question this document surfaces for the first time, not previously distinguished from Projection by 6F/6G |
| **Formative Signals / Attention Feed** [NEW] | **Exists, not audited by any prior sprint** | `lib/formativeSignals/`, `lib/attentionFeed/`, `attention_feed_dismissals` table (confirmed present, 7A Part 1) — functional depth UNKNOWN |
| **Knowledge Graph** [NEW] | **Exists, narrow scope per memory context** | `lib/knowledgeGraph/`, `knowledge_nodes`/`knowledge_edges` — per memory: prerequisite engine, Grade 7 Maths only, not wired into UI |
| **Teaching Intelligence** [NEW] | **Exists, name suggests overlap with "Teacher Intelligence" (6H Part 7's "merely implied" finding) — relationship UNKNOWN** | `lib/teachingIntelligence/`, `app/api/teaching-intelligence/` — not investigated by any prior sprint; 6H Part 7 concluded no unified Teacher Intelligence surface exists, but did not know this folder existed, so that conclusion should be treated as provisional pending a future targeted pass |
| **Parent Pulse** [NEW] | **Exists, per memory backend-built** | `lib/parentPulse/observationPipeline.ts`, cron `parent-pulse` — restated 6E Part 8, 6F Part 1 |
| **IAM** [NEW] | **Exists as a folder distinct from `lib/core/permissions.ts`/`identity.ts` — relationship UNKNOWN** | `lib/iam/` — not investigated by any prior sprint; flagged as a possible second, parallel authorization surface worth a dedicated future check against Sprint 1A/6E's `lib/core/*` findings |
| **Events / Jobs** [NEW] | **Exists, confirmed dead end (Events) / confirmed real (Jobs)** | `lib/events/` — restated 6F Part 2/7, the largest information dead end found in the series; `lib/jobs/` — real, cron-driven, restated 6E Part 8 |
| **Search / Documents / Sync** [NEW] | **Exist, not audited by any prior sprint** | `lib/search/`, `lib/documents/`, `lib/sync/` — functional depth UNKNOWN |
| **Monitoring / Observability** [NEW] | **Exists, real, used for structured logging** | `lib/observability/logger` — cited throughout 6E/6F/6G's research as the platform's actual logging mechanism (contrasted with ad hoc `console.error` calls found in some AI modules, 6E Part 7) |
| **i18n** [NEW] | **Exists, not audited by any prior sprint** | `lib/i18n/translations.ts` — functional depth/coverage UNKNOWN |

**Classification summary, per the sprint's specific question set**:
- **Fully exist (schema + service + route + reachable UI)**: Assessment, Evidence, Learning Intelligence (Projection), Learning (Compass), Curriculum content, Academic Clinic, Adaptive Learning, Holiday/Remedial Planning, Academy, AI Infrastructure, Operations.
- **Partially built**: Organization (schema-complete, UI-absent), Parent Engagement (works, fragmented), Communication (works, fragmented), Reporting (works, duplicated), Career Intelligence (works, ungoverned).
- **Exist only in schema**: Academic Administration's Core layer (Terms/Academic Years/End-of-Term), Promotion, Graduation, Withdrawal, Transfer.
- **Exist only in UI**: **None found** — this session found no case of a UI surface with no backing schema/service at all; every UI this series encountered had at least a partial data model behind it.
- **Exist only in seed data**: the nine Reference-School organizational titles (Dean of Studies, Examinations Officer, Finance Officer, Admissions Officer, ICT Administrator, School Secretary, and the Principal/Deputy pair) — restated 6E/7A.
- **Completely absent**: Attendance (beyond its schema fossil), Timetable, Finance (school fees), Library, Medical, Transport, Boarding, Discipline, Guidance & Counselling (as a human domain), Student Life, Departments/Faculties.

---

## Part 2 — Domain Ownership

Full ownership tables for the domains with the richest evidence base; domains already exhaustively covered by 6A–7A are restated with citation rather than re-derived in full detail.

| Domain | Purpose | Canonical entities | Canonical services (`lib/`) | Canonical repositories | Canonical routes | Canonical tables | UI | AI involvement | Human ownership | Lifecycle ownership |
|---|---|---|---|---|---|---|---|---|---|---|
| **Identity** | Answer "who is this" once | `CurrentUser`, `ResolvedTeacher`, `ResolvedStudent`, `ResolvedParent` | `lib/core/identity.ts` | `teacher.repository.ts`, `school.repository.ts` | None directly (a library, not a route surface) | `teachers`, `students`, `school_users`, `learner_guardians` | N/A | None | N/A — a resolution layer, not a decision-maker | N/A |
| **Organization** | Model who holds authority | `SchoolUserRole`, `ResolvedMembership` | `lib/core/permissions.ts`, `lib/core/school-users.ts` | `teacher.repository.ts` (`school_users` methods) | `app/api/core/school/**` | `school_users` | `app/admin/core-schools/new` (creation only, platform-operator-gated, not school-role-gated — restated 7A Part 2) | None | Nominally admin-tier; provably unpopulated | N/A — no offboarding/deactivation found |
| **Assessment** | Create/mark/publish assessments | `class_assessments`, marks | `lib/assessments/`, `lib/core/assessments.ts` | `assessment.repository.ts`, `assessmentType.repository.ts` | `app/api/assessments/**`, `app/api/teacher/assessments/**`, `app/api/core/assessments/**` | `class_assessments` | `app/teacher/classes/[classId]/assessments/**` | None in the grading path itself | Class teacher (self-publish) | Create→mark→publish, no archive |
| **Evidence** | Record confirmable facts about a learner | `learner_evidence` | `lib/intelligence/evidenceLifecycle.ts`, `lib/intelligence/confidence.ts` | `evidence.repository.ts`, `evidencePurpose.repository.ts` | `app/api/teacher/classes/[classId]/compass/evidence/**` | `learner_evidence`, `ingestion_runs` | Compass evidence review screen | Confidence-scored input, human/system-account confirm | Teacher (mastery), system account (engagement, guarded) | Full: create→review→confirm/reject→retract/erase, immutable |
| **Learning Intelligence** | Compute derived learner understanding | `learner_projections` | `lib/projection/recompute.ts`, `lib/projection/engine.ts`, `lib/career/capabilityExtractor.ts` | `projection.repository.ts`, `learner-intelligence.repository.ts` (relationship to `learner-model.repository.ts` UNKNOWN) | Consumed internally, not directly routed | `learner_projections` | Surfaced via Blueprint/Career/Holiday Planner UIs, not its own screen | Zero — pure computation | System (`recomputeLearnerProjection`) | Recompute-on-demand, cached, no history table found |
| **Career Intelligence** | Generate career guidance | `careers`, `career_matches` | `lib/career/careerEngine.ts`, `matchEngine.ts`, `careerIntelligenceEngine.ts` | `career.repository.ts` | `app/api/career/**` | `careers`, `career_matches` | `app/(student)/career/**` (path UNKNOWN, not re-verified this session), Parent Career Intelligence panel | Full — generates and persists autonomously | **Nobody** — restated 6G Part 3/9 | Generate→persist→serve, no review, no archive |
| **Academic Clinic** | Deterministic academic diagnostic report | `student_clinic_reports`, `student_learning_context` | `lib/academicClinic/assessmentPipeline.ts` | via `repos.careers` (shared with Career domain — a genuine cross-domain repository sharing, flagged in Part 4) | `app/api/academic-clinic/**`, `app/api/clinic/**` | `student_clinic_reports`, `student_learning_context` | `app/academic-clinic/**` | None — deterministic | Teacher or parent (teacherless-student edge case, restated 6E Part 8) | Generate on demand |
| **Curriculum** | Store/serve KICD-aligned content | `sow_learning_areas`, `sow_grades` | `lib/curriculum/service.ts`, `lib/cbcCurriculum.ts` | `curriculum.repository.ts` | `app/api/sow/kicd-context/**`, `app/api/schemes/**` | `sow_*` tables | `app/sow/**` | Content generation assist (SOW AI lesson generator) | Teacher | Static reference data, versioned by KICD externally, not by EduNexus |
| **Reporting** | Summarize a learner's term performance | Two independent pipelines (Part 1) | `lib/core/report-cards.ts` (Core), legacy AI generator (module not independently named by any prior sprint — flagged UNKNOWN) | `school.repository.ts` (Core) | `app/api/core/reports/**`, `app/api/reports/**` | `school_report_cards`, `term_subject_summaries`, `assessments` (legacy read) | `app/(parent)/report-card/**` | Legacy pipeline is AI-generated narrative; Core pipeline is pure computation (ranking/averaging) | Admin-tier (Core, unreachable); unclear (legacy) | Generate→publish (Core); generate-only, unclear gate (legacy) |
| **Academy** | Teacher continuing-education/gamification | Missions, reflections, certificates | `lib/academy/missions.ts`, `lib/academy/aiJudge.ts` | `academy.repository.ts` | `app/api/academy/**` | `academy_progress`, `academy_reflections` (exact names per 6E Part 7's route research) | `app/teacher/academy/**` | AI Judge scores submissions — downstream review path UNKNOWN (restated 6E Part 7) | Teacher-as-learner (self) | Progress→reflect→complete→certificate, no archive found |
| **Adaptive Learning** | Propose learner groupings | `class_differentiation_plans` | `lib/adaptiveLearning/differentiation.ts`, `recommend.ts` | Not independently named by a prior sprint — flagged UNKNOWN which repository backs this | `app/api/teacher/classes/[classId]/differentiation/**` | `class_differentiation_plans` | Differentiation UI (path not previously cited) | Grouping logic — no AI call found in the path itself (restated 6E Part 7) | Teacher (explicit approve/adjust) | Draft→approve→publish, the cleanest lifecycle in the series |
| **Platform / Developer Platform** | External developer/org infrastructure | `organizations`, `organization_members`, API keys, webhooks | `lib/organizations/`, `lib/billing/` | `organization.repository.ts`, `developer.repository.ts`, `webhook.repository.ts` | `app/api/organizations/**`, `app/api/platform/**` | `organizations`, `organization_subscriptions`, `event_subscriptions` | `app/organizations/**` | None found in this domain's own logic | `owner`/`admin`/`developer`/`billing_admin` role vocabulary — structurally separate from `SchoolUserRole` (restated 6E Part 8) | Full CRUD, own billing lifecycle |

**Domains not given a full ownership row above** (Curriculum's duplication details, Parent Engagement's three mechanisms, Communication's two triggers, Organization's dormancy) are restated at the citation level from Part 1 and prior sprints — repeating their full detail here would duplicate 6B/6D/6E/6F rather than add new synthesis.

---

## Part 3 — Domain Boundaries

| Boundary | Where one stops / other begins | Clean or blurred? | Evidence |
|---|---|---|---|
| **Assessment vs. Evidence** | Assessment produces raw marks; Evidence is the confidence-scored, confirmable claim derived from those marks. Assessment does not know about `review_status`; Evidence does not know about `weight_percent`/`grading_type`. | **Clean** | `resolveReviewStatus` (`lib/intelligence/confidence.ts`) is the one crossing point, and it is a one-directional read (Evidence reads Assessment's marking event, never the reverse) |
| **Evidence vs. Intelligence** | Evidence is the fact; Intelligence (Projection) is the computed interpretation over a set of confirmed facts. Evidence never computes a projection; Projection never writes to `learner_evidence`. | **Clean, CLAUDE.md-enforced** | `recomputeLearnerProjection` is the sole crossing point (restated throughout) |
| **Learning vs. Teaching** | Learning (Compass) is student-initiated, real-time, AI-mediated. Teaching (SOW/Lesson Plan/Record of Work) is teacher-initiated, asynchronous, content-production. | **Clean at the code level, blurred at the evidence level** — both eventually feed `learner_evidence`, but via genuinely separate pipelines (`lib/compass/evidence.ts` vs. the Assessment marking pipeline) | 6D Workflow 6, 6F Part 2 |
| **Teaching vs. Curriculum** | Curriculum is the static, KICD-sourced reference content; Teaching (SOW/Lesson Plan) is what a specific teacher builds *from* that content for a specific class. | **Clean in principle, blurred in practice** — restated 6B: the hardcoded `lib/curriculum/subjects.ts` catalogue that actually drives the live teacher UI is itself a Teaching-domain artifact standing in for what should be Curriculum-domain data, because Curriculum's own representations (`sow_learning_areas`) are not what the UI reads |
| **Organization vs. Identity** | Identity resolves *who*; Organization resolves *what authority they hold*. | **Clean, deliberately designed** — restated 6E Part 1/6H Part 11: `lib/core/identity.ts` vs. `lib/core/permissions.ts`'s explicit separation, built specifically to prevent Stage 0's copy-pasted-authorization failure |
| **Guidance vs. Career Intelligence** | **No boundary exists, because Guidance does not exist** — Career Intelligence has fully absorbed this territory with none of Guidance's implied human judgment | **Not a boundary — a vacancy** | 7A Part 2, this document's Part 1 |
| **Finance vs. Administration** | **No boundary exists, because Finance does not exist** | **Not a boundary — a vacancy** | 7A Part 1 |
| **Reporting vs. Analytics** | Reporting produces a record-of-truth artifact (a report card) for one learner; Analytics produces read-only aggregate views (strand health, intervention efficacy) across many. | **Clean** — restated 6E Part 8: no analytics route was found writing to any report-of-record table | 6E Part 8 |
| **Promotion vs. Enrollment** | Promotion would be the *decision* to advance a learner; Enrollment is the *record* of which class/term they currently occupy. In a working system, Promotion writes a new Enrollment. | **Structurally clean in the schema, never actually crossed** — Promotion has zero live rows, so this boundary has never been exercised (restated 6D/6G) | 6D Workflow 10, 6G Part 10 |
| **Graduation vs. Alumni** | Graduation is the terminal academic-record event; Alumni would be the post-graduation relationship. | **Not a boundary — both sides are unreached/absent** — Graduation never fires in production (6D/6E), and Alumni has zero repository presence of any kind (7A Part 1) | 7A Part 1 |
| **Parent Engagement vs. Communication** | Parent Engagement is *who* the parent is and *what* they're linked to (identity/ownership); Communication is the *delivery mechanism* (email/WhatsApp) once that linkage exists. | **Blurred** — restated 6F Part 1: the two are not independently modeled; a parent's contact/notification preferences live on `students` itself (the learner's own row), not on a separate Parent Engagement entity, so there is no clean data-ownership line between "this is about the parent relationship" and "this is about sending a message" |
| **Academic Clinic vs. Career Intelligence** [additional pair, discovered this session] | Clinic is meant to be the deterministic diagnostic layer Career Intelligence's AI narrative sits on top of. | **Blurred at the repository level** — both call through `repos.careers` (Part 2), meaning Clinic's own repository identity is not independently named; this is the one genuine repository-sharing case found this session, worth flagging as a boundary that is conceptually clean (6E Part 7 confirmed zero AI in Clinic's own pipeline) but not structurally independent at the data-access layer | New finding, this session |
| **Learning Intelligence (Projection) vs. Learner Model / Learner Intelligence** [additional pair, discovered this session] | **UNKNOWN — genuinely unclear from the folder structure alone** whether `lib/learnerModel/`/`lib/learnerIntelligence/` are (a) an older, superseded predecessor to `lib/projection/`, (b) a parallel, still-live system, or (c) a different-scoped concern (e.g., a UI-facing summary view vs. the raw computation) | **Blurred — genuinely unresolved by this document** | New finding, this session — flagged for a dedicated future investigation, not guessed at |

---

## Part 4 — Cross-Domain Contracts

| Domain | Inputs | Outputs | Published events | Consumed events | Repositories called | Shared types/IDs | Classification |
|---|---|---|---|---|---|---|---|
| Assessment | Teacher marking action, CSV upload | Marks, `is_published` flag | `assessment.*` (via `lib/assessments/mutations.ts::publishEvent`, restated 6F Part 2) | None | `assessment.repository.ts`, `assessmentType.repository.ts` | `class_id`, `teacher_id`, `students.id` | **Healthy** — clean one-way produce |
| Evidence | Assessment marking, Compass session extraction | Confirmed/rejected evidence rows | None found (Evidence does not itself call `publishEvent` per this session's search — UNKNOWN, not exhaustively re-verified) | None | `evidence.repository.ts` | `learner_id` = `students.id` (CLAUDE.md-anchored) | **Healthy** — the series' cleanest domain contract |
| Projection | Confirmed Evidence only | `learner_projections` rows | None found | None | `projection.repository.ts` | `learner_id` | **Healthy** |
| Career Intelligence | Projection, capability extraction | `career_matches`/`careers` rows, narrative report | None found | None | `career.repository.ts` | `learner_id`/`student_id` | **Leaky abstraction** — writes directly to shared tables with no gate, and (Part 3) shares `repos.careers` with the structurally distinct Academic Clinic domain |
| Academic Clinic | Assessment data | `student_clinic_reports` | None found | None | Shared `repos.careers` (see above) | `student_id` | **Leaky abstraction** — same repository-sharing finding, from the other side |
| Reporting (Core) | Confirmed assessments (via `is_published` lock) | `school_report_cards`, `platform_events` | `report_card.*` (via `lib/core/report-cards.ts::publishEvent`, restated 6F Part 2) | None | `school.repository.ts` | `learner_id` = `learners.id` (Core) — **a different identity space than Assessment/Evidence's `students.id`** | **Hidden dependency** — the Core Reporting domain nominally depends on Assessment being "locked" (`runEndOfTerm`'s check), but the two domains' learner identity spaces do not match, so this dependency cannot actually be satisfied for any learner whose Assessment history lives under `students.id` (the vast majority, per Stage 0.5) |
| Reporting (legacy) | Raw `assessments` | Generated report text | UNKNOWN | None | UNKNOWN — not independently named by any prior sprint | **Hidden dependency, doubly so** — bypasses Evidence/Projection entirely (restated 6F Part 3), and its own repository/service ownership was never named by any prior sprint, meaning this document cannot even fully specify the contract it should be checked against |
| Organization | School creation call | `school_users` rows | `organization.created`, `organization.member.invited` (`lib/core/school.ts:22-29`, restated 6F Part 2) | None | `teacher.repository.ts`, `school.repository.ts` | `school_id`, `user_id` | **Healthy contract shape, unreachable in practice** — the event publish itself is correctly modeled; the problem (restated 6F Part 7) is downstream, not in this domain's own contract |
| Events (`lib/events/`) | Every domain's `publishEvent()` calls | `platform_events` rows, `event_subscriptions`-matched deliveries | N/A (this domain IS the publication mechanism) | Everything, nominally | `webhook.repository.ts` | `organization_id`, `event_type` | **Confirmed dead end, not merely leaky** — restated 6F Part 2/7 in full; every school-domain producer above has a "Published events" cell in this table precisely because the *contract* is correctly shaped, even though *delivery* never happens |
| Platform/Developer Platform | External API consumers | Webhooks, billing state | Organization-scoped events | None from the school domain | `organization.repository.ts`, `webhook.repository.ts` | `organization_id` — **not** `school_id` | **Circular-dependency risk, not yet realized**: the school domain's `publishEvent()` calls flow into the *same* `platform_events` table and `event_subscriptions` matching logic the Platform domain owns, meaning a future school-domain event-consumption feature would necessarily depend on Platform-domain infrastructure — worth flagging as a boundary to design deliberately rather than discover accidentally |

**Determination**: this series' domains split cleanly into two dependency shapes — **linear-healthy** (Assessment→Evidence→Projection, each with a narrow, well-typed, one-directional contract) and **leaky-or-hidden** (everything touching Reporting or Career Intelligence, both of which either bypass the healthy chain's identity space or write to shared tables with no gate). No genuine circular dependency was confirmed this session (the Platform/school-domain event-table sharing is a *risk*, not a confirmed cycle, since nothing in the school domain currently consumes events at all, per Part 1/6F).

---

## Part 5 — Domain Maturity

| Domain | Level | Evidence |
|---|---|---|
| Evidence | **5 — Reference Quality** | DB-trigger-enforced state machine, full traceability, confidence-tiered trust, correction-by-supersession — restated throughout as this series' unambiguous best subsystem |
| Projection | **5 — Reference Quality** | Pure, deterministic, single canonical read path, zero AI calls in the engine |
| Ranking / Grading | **4 — Intelligence Enabled** (by the sprint's own ladder, computation-grade) but **operationally dormant** | Correctly built, tie-handled, sits inside the unreached Core Report Card pipeline — scored on code quality per the sprint's rubric, with its production-reach caveat stated explicitly |
| Assessment | **3 — Production Ready** | The platform's most-exercised, most reliable workflow — restated throughout; not Level 4/5 because it has no second-reviewer/moderation capability (restated 6D/6G) |
| Adaptive Learning | **3 — Production Ready**, arguably **4** for its governance pattern specifically | Correct draft/approve lifecycle (6G Part 3); production-usage breadth not independently re-verified this session, so held at 3 rather than 4 |
| Career Intelligence | **2 — Functional**, explicitly not higher despite AI sophistication | Live, used, generates real output — but zero governance (no approval, no trust marker, restated 6G Part 3/9) disqualifies it from "Production Ready" by this document's own standard (a production-ready *educational* domain, per Sprint 6G's Decision Responsibility Matrix, requires traceability this domain lacks) |
| Academic Clinic | **3 — Production Ready** | Deterministic, real, restated 6E Part 7 — not Level 4 because it has no AI/Intelligence layer of its own (by design, correctly) |
| Curriculum (content) | **3 — Production Ready** for content depth, **1 — Prototype** for structural coherence | Rich KICD content exists and is used; the 4-way representation duplication (6B) means no single "Curriculum domain" can be pointed to as authoritative |
| Organization | **1 — Prototype** | Schema-complete, DB-CHECK-enforced, but zero live population of its most important roles — restated 6E throughout |
| Academic Administration (Core) | **1 — Prototype** | Same finding — `lib/core/endOfTerm.ts` is well-built, zero UI reach |
| Reporting | **2 — Functional** (legacy) / **1 — Prototype** (Core) | The legacy pipeline works and serves real parents (Functional); the Core pipeline has zero production rows (Prototype) — the domain as a whole cannot score higher than its live half, which itself lacks the ranking/averaging the Core half has |
| Parent Engagement | **2 — Functional** | Real, used by real parents, but fragmented across three mechanisms (restated throughout) — the fragmentation itself is what caps this below Level 3 |
| Communication | **2 — Functional** | Same reasoning — real delivery, two independent uncoordinated triggers |
| Enrollment | **2 — Functional** (legacy) / **1 — Prototype** (Core) | Same duplicated-maturity pattern as Reporting |
| Promotion / Graduation | **0 — Absent**, operationally, despite Level-2-quality code | The sprint's own ladder is about what exists in production, not what exists in a repository unreached by any user — restated 6D/6G: zero live rows, ever, in this codebase's evidence |
| Withdrawal / Transfer | **1 — Prototype** | API-reachable, zero UI, Withdrawal incomplete even when called (restated 6D) |
| Academy | **3 — Production Ready** | Live, used, has an AI Judge component — held at 3 rather than 4 because the AI Judge's governance/review path is UNKNOWN (restated 6E Part 7), the same caveat pattern as Career Intelligence but less severe since it was never confirmed autonomous the way Career Intelligence was |
| Attendance | **0 — Absent** | Schema fossil only, zero workflow — restated 7A |
| Timetable, Finance, Library, Medical, Transport, Boarding, Discipline, Guidance & Counselling, Student Life | **0 — Absent** | VERIFIED, exhaustively confirmed 7A Part 1 |
| Platform / Developer Platform | **3 — Production Ready** (provisionally) | Not itself audited in depth by this series; scored provisionally from its structural completeness (real role vocabulary, real billing lifecycle, restated 6E Part 8) rather than from a full independent investigation — flagged as a lower-confidence score than every other row in this table |
| AI Infrastructure (`lib/ai/deepseek.ts`) | **3 — Production Ready** | Single confirmed entry point, used correctly by every caller this series found except three flagged `max_tokens` violations (restated 6E Part 7) |
| Events | **0 — Absent**, functionally, despite well-formed code | The confirmed dead-end finding (6F Part 7) — a domain whose entire purpose (delivering events) does not happen |
| Operations (cron/jobs) | **3 — Production Ready** | 17 real, working cron routes — restated 6E Part 8 |

---

## Part 6 — AI Domain Map

| AI capability | Primary owner domain | Supporting domains | Inputs | Outputs | Approval | Persistence | Auditability | Trust model |
|---|---|---|---|---|---|---|---|---|
| Compass chat | Learning | Evidence (via extraction) | Student message | Live streamed text | **None** | Not persisted as a "decision," only as raw session content | Session log exists (`compass_messages`), but no decision-audit trail | None modeled |
| Compass evidence extraction | Evidence | Learning (source) | Session content | Evidence claims | **Yes**, mastery claims | `learner_evidence` | Full — `reviewed_by`/`reviewed_at`/`review_reason` | Confidence-tiered, trust-capped by source |
| Projection | Learning Intelligence | Evidence (source) | Confirmed Evidence | `learner_projections` | N/A (computation) | `learner_projections`, no history table | Recomputation is traceable to its inputs (Evidence's own trail), but the Projection row itself has no independent audit columns confirmed this session | Inherits Evidence's trust tiering |
| Career Intelligence | Career Intelligence | Learning Intelligence (source) | Projection/capability extraction | `career_matches`/`careers`, narrative | **None** | Immediate, direct | **None found** — the series' one AI capability with zero audit trail | **None modeled** |
| Academic Clinic | Academic Clinic | Assessment (source) | Assessment data | Diagnostic report | N/A — deterministic, no AI | `student_clinic_reports` | Standard `created_at`/`updated_at` only | N/A |
| Adaptive Learning | Adaptive Learning | Assessment (source) | Class/assessment data | Grouping proposals | **Yes**, explicit draft/approve | `class_differentiation_plans` | `is_published`/`published_at` (no `published_by`, restated 6G Part 9) | Draft vs. approved-and-adjusted are kept distinct — a structural trust signal even without a named column |
| Holiday/Remedial Planning | Teaching (arguably; not cleanly owned by any single domain in Part 1's catalogue) | Learning Intelligence (source) | Projection | Draft plans | **Yes, with a timeout bypass** (Holiday) | `holiday_plans` | `is_published`/`published_at`, actor-of-publish not distinguished from cron-fallback (restated 6G Part 9) | Partial |
| Academy AI Judge | Academy | None found | Student reflection/mission submission | Score | **UNKNOWN** | Presumably `academy_reflections`/`academy_progress` | UNKNOWN | UNKNOWN |
| Future Operational Intelligence | **No domain — does not exist** | Would require Organization + a real institutional-data domain (Finance/Attendance/etc.) to be populated first | N/A | N/A | N/A | N/A | N/A | N/A — restated 7A Part 6/6H Part 7's "no data to compute over" finding |
| Future School Intelligence | **No domain — exists as read-only Analytics, no reachable consumer** | Organization (would need a populated admin-tier actor) | Legacy tables | Aggregate reads | N/A | Not persisted as its own artifact | N/A | N/A — restated 6H Part 7 |
| Future Parent Intelligence | **Partial — a read-through of Career/Learning Intelligence, not independently owned** | Career Intelligence, Learning Intelligence | Same as those domains | Same, presented differently | Inherits Career Intelligence's lack of approval | No independent storage | Inherits Career Intelligence's absence of an audit trail | Inherits Career Intelligence's ungoverned model |
| Future Teacher Intelligence | **No single owner — fragmented across per-feature generators, and `lib/teachingIntelligence/` exists but its relationship to this fragmentation is UNKNOWN (Part 1, new finding)** | Assessment, Curriculum, Evidence | Per-tool | Per-tool | Per-tool | Per-tool | Per-tool | Per-tool |

---

## Part 7 — Future Domains (Justification Only, No Design)

Restated from 7A Part 9/10 with this sprint's domain-ownership framing added — no new absence-search was performed this session (7A's exhaustive search already established these); this Part only justifies *why* each belongs, per the sprint's specific instruction.

- **Finance**: every real-school lifecycle stage this series traced (7A Part 1) assumes fees are a background reality; a school operating system that cannot represent a fee balance cannot answer "can this learner sit the term exam" for any school where that is a real gate — a genuine functional dependency, not a nice-to-have.
- **Medical**: emergency-contact and allergy information is a duty-of-care baseline for any institution responsible for minors; its complete absence (7A Part 1) means EduNexus currently has no way to discharge this responsibility even administratively, let alone digitally.
- **Boarding / Transport**: for any boarding or transport-providing school (a large fraction of Kenyan secondary schools, per 7A Part 7's research context), these are not enrichment features but core daily-operations requirements — a school cannot run without knowing where a boarding learner sleeps or how a day learner gets home.
- **Library**: while lower-stakes than the above, KICD's own curriculum expectations (per 7A Part 7's research) assume access to reading material tracking at the school level; its absence is a genuine, if lower-priority, gap.
- **Attendance**: the schema fossil (`days_present`/`days_absent` on `school_report_cards`, 6G Part 6) is itself the justification — a prior design pass already concluded a report card should carry this data, and never built the domain that would produce it.
- **Timetable**: Teaching (Part 1) currently has no time dimension at all — every other domain that depends on "when does this happen" (Class, Subject, Assessment scheduling) is implicitly assuming a timetable exists somewhere outside the system.
- **Counselling**: justified most strongly by this series' own finding (7A Part 2, restated Part 1/3 this document) that its territory is *already being filled*, ungoverned, by Career Intelligence — the domain is not merely missing, its absence is actively causing a governance problem elsewhere in the system today.
- **Departments**: Curriculum/Subject's 4-way duplication (6B) and the absence of any Subject Head authority (7A Part 2) are both symptoms a Departments domain would structurally address — not by fixing the duplication directly, but by giving a real actor ownership over resolving it, which nothing currently has.
- **Quality Assurance**: `assessment_quality_flags` (6C/6E, restated) is a dormant schema fragment that already anticipated this domain — the justification is, again, that a prior design pass believed this was needed and never finished it.
- **School Operations / School Leadership**: justified by Part 5's maturity finding that Organization and Academic Administration are both "Prototype"-level despite complete schemas — these two domains are the precondition for School Leadership to be a real, actionable domain rather than a permission check nobody can trigger.
- **Alumni**: justified only weakly by this series' evidence — Graduation itself never fires in production (Part 5), so Alumni's justification is forward-looking ("once Graduation works, this will be needed") rather than evidenced by any current gap being actively felt.

---

## Part 8 — Domain Dependency Graph

```
Platform  (structurally separate — organizations/, billing/, developer-facing)
  │
  │  [NO CURRENT DEPENDENCY EITHER DIRECTION — confirmed separate role
  │   vocabulary, separate identity space, Part 4]
  │
Identity  (lib/core/identity.ts)
  ↓  [HEALTHY — identity.ts never authorizes, only resolves]
Organization  (lib/core/permissions.ts, school_users)
  ↓  [HEALTHY IN SHAPE, UNREACHABLE IN PRACTICE — Part 5]
Academic Administration  (lib/core/school.ts, endOfTerm.ts)
  ↓  [HIDDEN DEPENDENCY — Part 4: depends on learners.id identity space
      that Assessment/Evidence do not share]
Teaching  (SOW, Lesson Plan, Record of Work)  ←→  Curriculum  (KICD content)
  ↓  [HEALTHY]
Assessment
  ↓  [HEALTHY — the series' cleanest crossing]
Evidence
  ↓  [HEALTHY, CLAUDE.md-enforced]
Projection  (Learning Intelligence)
  ↓  [HEALTHY]              ↓  [LEAKY — Part 4]
Recommendations              Career Intelligence
(Adaptive Learning,           (writes directly, no gate,
 Holiday/Remedial —            shares repos.careers with
 both correctly gated)         Academic Clinic)
  ↓                            ↓
Reporting  ←──[HIDDEN DEPENDENCY, NEVER SATISFIED: Reporting's Core
              pipeline assumes Assessment-lock under learners.id, but
              live Assessment data is under students.id — Part 4]
  ↓  [DEAD END — Part 4/6F: publishEvent() fires, nothing consumes it]
Communication  (email/WhatsApp — fires independently of the event
                system, via direct lib/ calls, NOT via the dead event bus)
```

**Forbidden dependencies** (none found violated this session, listed as boundaries this graph's evidence shows are currently respected): Assessment must never depend on Intelligence output to determine what a mark *is* (confirmed — restated 6E Part 8's zero-boundary-violation finding); Identity must never make an authorization decision (confirmed — `identity.ts`/`permissions.ts` separation, restated throughout); AI must never be the sole writer of Evidence without a confidence/trust computation preceding it (confirmed — `resolveReviewStatus` always runs first).

**Healthy dependencies**: Identity→Organization, Assessment→Evidence→Projection, Evidence→Recommendations (Adaptive Learning/Holiday/Remedial, via the approval gate).

**Future dependencies** (not yet existing, justified by Part 7): Attendance→Reporting (to populate the `days_present`/`days_absent` fossil), Finance→Enrollment (fee-status gating), Counselling→Career Intelligence (as a human review layer *above* the AI, not a replacement for it), Timetable→Teaching (a time dimension the current graph has no node for at all).

---

## Part 9 — Domain Laws

Twenty permanent architectural laws, each grounded in specific repository evidence gathered across this series (not asserted abstractly):

1. **A domain owns its own lifecycle end to end, or it does not own it at all.** *Evidence*: every domain this series found split across "code exists" and "reachable in production" (Organization, Reporting, Promotion) is a domain that, in practice, owns nothing — restated Part 5's maturity scoring, which caps every such domain below Production Ready regardless of code quality.
2. **No domain writes another domain's canonical table directly.** *Evidence*: 6E Part 8's exhaustive boundary-violation search found zero cases of this happening — the one law this series can say is fully, currently upheld, not merely aspirational.
3. **AI never owns educational truth — it proposes, a human confirms.** *Evidence*: Evidence's confirm/reject gate (upheld) vs. Career Intelligence's total absence of one (violated) — the law is real because both its compliance and its one violation are directly observable in the same codebase.
4. **Evidence precedes Intelligence — no computation runs over unconfirmed claims.** *Evidence*: `findConfirmedEvidenceForLearner`'s exclusive use by `recomputeLearnerProjection`, restated throughout.
5. **Assessment never depends on Intelligence.** *Evidence*: Assessment's marking/publish flow has zero references to Projection/Career/any Recommendation output — confirmed by this series' repeated tracing of the Assessment pipeline in isolation.
6. **Organization owns institutional structure; no other domain invents a role.** *Evidence*: `SchoolUserRole` is the single enum every permission check in `lib/core/permissions.ts` references — no domain this series found maintains its own parallel role vocabulary for the *school* domain (Platform's separate `owner`/`admin`/`developer` vocabulary is a different bounded context, not a violation of this law within the school domain).
7. **Identity never owns educational decisions.** *Evidence*: `lib/core/identity.ts` has zero `require*`/`can*`-shaped functions — restated 6E Part 1's explicit citation of this separation's design intent.
8. **Communication delivers decisions; it never creates them.** *Evidence*: every notification/alert this series traced (6D Workflow 9, 6F Part 1) is triggered by a prior domain event (alert creation, assignment marking) — no case was found of the notification system itself deciding something needed to happen.
9. **A correction is a new fact, never a rewritten one.** *Evidence*: Evidence's `supersedes`/`superseded_by` lineage, DB-trigger-enforced immutability — restated throughout.
10. **A decision without a `published_by`/`decided_by`-shaped column is not a governed decision, whatever else it does.** *Evidence*: 6G Part 9's bimodal traceability finding — Evidence has this column shape, almost nothing else does, and this document's own Part 6 shows the gap tracks exactly with each AI capability's trust classification.
11. **A domain's maturity is capped by its least-reachable half, not its best-built half.** *Evidence*: Part 5's explicit scoring method for Reporting/Enrollment/Promotion — the Core pipelines of each are well-built and score the *domain* down anyway, because a domain a real user cannot reach does not functionally exist regardless of code quality.
12. **Two independently-computed artifacts claiming to answer the same question is a defect, even with zero shared code to blame.** *Evidence*: the two Report Card pipelines (6F Part 6) — flagged in that prior sprint as "arguably worse than a shared-code bug," restated here as a law because the pattern (not the specific instance) is what future domains must avoid.
13. **A repository shared between two conceptually distinct domains is a boundary that has not actually been drawn yet.** *Evidence*: Academic Clinic and Career Intelligence's shared `repos.careers` (Part 3/4, new finding this session) — the domains are conceptually separable (deterministic vs. AI-generative), but their data-access layer does not yet reflect that separation.
14. **An event published with no subscriber is not integration — it is a diary entry.** *Evidence*: the confirmed-dead `lib/events/` system (6F Part 2/7, restated Part 4/8 this document) — the law generalizes the specific finding into a standard future domains must be checked against before assuming `publishEvent()` constitutes real cross-domain communication.
15. **A learner-scoped table must declare which identity space (`students.id` vs. `learners.id`) it is anchored to, and every consumer must check.** *Evidence*: the Reporting domain's hidden dependency (Part 4, new finding this session) — a domain can be internally well-built and still fail entirely at its stated purpose because it silently assumed the wrong identity space.
16. **A seed-script title is not an organizational role until a permission check distinguishes it from every other title mapped to the same enum value.** *Evidence*: the Reference School's nine titles collapsing into three `SchoolUserRole` values with zero distinguishing authority (restated 6E Part 4, 7A Part 2) — the law names the specific failure mode so a future Departments/Registrar/Finance-Officer domain does not repeat it.
17. **A workflow is not a domain capability until it has a persisted, visible transition state — a correct call chain that happens to execute in order is not the same thing.** *Evidence*: End-of-Term's correct sequencing vs. its total absence of any UI-visible intermediate state (restated 6D/6G) — the law distinguishes "the code is right" from "the domain works," the same distinction Law 11 makes at the maturity-scoring level.
18. **AI infrastructure (the model-calling layer) is centralized; AI governance (approval, trust, audit) is not, and must be designed per domain.** *Evidence*: `lib/ai/deepseek.ts`'s single, correctly-centralized entry point (Part 1/5) coexisting with Career Intelligence's total governance vacuum (Part 6) — centralizing the *call* did not centralize the *discipline*, and no future domain should assume it would.
19. **A domain that has no live human actor to consume its output should not be built ahead of that actor existing, even if the underlying computation is easy.** *Evidence*: School/Operational/Administrative Intelligence's "no reachable consumer" finding (restated 6H Part 7, Part 6 this document) — this law is the direct architectural consequence of Law 1 applied to Intelligence specifically.
20. **Absence is a decision with consequences, not a neutral default — an unmodeled domain does not merely fail to help, it can actively cause another domain's governance to fail (as Guidance & Counselling's absence has for Career Intelligence).** *Evidence*: restated 7A Part 9's Principle 10, re-confirmed and sharpened by this sprint's domain-ownership lens (Part 3's "vacancy, not boundary" finding for Guidance/Finance).

---

## Part 10 — The Official EduNexus Domain Map

### Executive Summary
EduNexus currently comprises **one fully coherent, reference-quality domain chain** (Assessment → Evidence → Projection → gated Recommendations), **a wide band of Functional-to-Prototype domains that work but are fragmented, duplicated, or unreachable** (Organization, Reporting, Enrollment, Parent Engagement, Communication, Career Intelligence), **and a substantial set of domains with zero repository presence of any kind** (Finance, Medical, Transport, Boarding, Library, Discipline, Guidance & Counselling as a human domain, Timetable, Departments). This sprint's specific contribution beyond 6A–7A is the **domain-boundary lens**: showing precisely where the healthy chain's boundaries are clean (Assessment/Evidence, Identity/Organization) and where the fragmented domains' boundaries are blurred or actively vacant (Guidance/Career Intelligence, Finance/Administration) — and surfacing, for the first time in this series, several `lib/` subdomains (Learner Model/Learner Intelligence, IAM, Teaching Intelligence) whose relationship to already-audited domains is genuinely unresolved and flagged for future investigation rather than guessed at.

### Complete Domain Catalogue
Part 1's full table, ~40 domains total (21 from the sprint's example list, 19 newly surfaced from `lib/`'s actual folder structure).

### Domain Hierarchy
Platform (separate) — Identity — Organization — Academic Administration — {Teaching, Curriculum} — Assessment — Evidence — Learning Intelligence — {Career Intelligence, Recommendations} — Reporting — Communication, per Part 8's graph.

### Domain Boundaries
Part 3's full table — clean where CLAUDE.md/prior-sprint discipline was deliberately applied (Assessment/Evidence, Identity/Organization); vacant, not merely blurred, where an entire domain (Guidance, Finance) does not exist to have a boundary with anything.

### Dependency Graph
Part 8, including the one hidden-dependency finding new to this sprint (Reporting's identity-space mismatch) and the one leaky-repository finding new to this sprint (Academic Clinic/Career Intelligence sharing `repos.careers`).

### Ownership Matrix
Part 2's full table.

### Current Maturity
Part 5's full table — the series' clearest single-page answer to "is domain X real."

### Future Maturity
Not scored numerically per this sprint's own instruction not to design — Part 7 provides justification for eleven future domains without assigning them a target maturity level, since doing so would be implementation planning this sprint is explicitly not authorized to produce.

### Architectural Laws
Part 9's twenty laws — the permanent reference this document exists to establish.

### Implementation Priorities
Not re-derived — restated pointer to 6H Part 9 and 7A Part 10, both of which already produced evidence-grounded priority groupings (Immediate/Near-term/Medium-term/Long-term) from this same evidence base; this sprint's new findings (the shared-repository boundary, the Reporting identity-space hidden dependency, the Learner Model/Projection relationship question) belong in that existing roadmap's Immediate/Near-term tiers respectively (the first two are narrow, low-risk clarifications; the third requires a dedicated investigation before it can be prioritized at all, since its very nature is currently unknown).

### Vision of EduNexus as an AI-Native School Operating System
Restated and sharpened from 6H Part 13's verdict: EduNexus is a Learning Intelligence Platform with a School Operating System's schema-level foundation laid but not activated. This sprint's domain-boundary lens adds the specific mechanism by which future activation should proceed: **extend the healthy chain's own proven pattern (Law 4, Law 9, Law 10) to each newly-activated domain, rather than building new domains under the looser discipline Reporting/Organization/Career Intelligence were built under.** An AI-native School Operating System, per this series' own evidence, is not defined by how many domains have an AI component — it is defined by how consistently every domain, AI-touching or not, obeys the twenty laws in Part 9.

---

## What This Document Does Not Do

Per its own scope: it designs no new domain, proposes no schema, and does not resolve the Learner Model/Projection relationship, the Academic Clinic/Career Intelligence repository-sharing question, or the Teaching Intelligence/Teacher Intelligence naming overlap — all three are flagged as genuinely open questions this sprint discovered but did not have evidence to resolve, distinct from this series' many *confirmed* findings. No ADR is raised: none of this sprint's findings constitute a canonical-domain *conflict* in the sense that would trigger one — they are boundary-clarity gaps (Part 3), contract-health gaps (Part 4), and open questions about `lib/` folders no prior sprint had read (Part 1), none of which contradict an already-ratified canonical decision (ADR-0002, Stage 0.5's Fourth Law, or any Constitution/RAS provision).

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

STOP after this document. No implementation, schema, or migration performed. This establishes the permanent Domain Map of EduNexus. Any future work — including the three open questions flagged in this document (Learner Model/Projection, Academic Clinic/Career Intelligence repository sharing, Teaching Intelligence naming) — requires separate scoping and explicit approval.
