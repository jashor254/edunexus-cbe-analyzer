# Sprint 7E — EduNexus Educational Operating System Blueprint
### Architecture Synthesis — Future-State Design

**Mode: READ ONLY, FUTURE-STATE SYNTHESIS.** No code, schema, migration, route, repository, service, or test was modified. This document builds entirely on Sprints 6A–6H and 7A–7D and never contradicts them. Every claim about EduNexus **today** is cited to the sprint that established it. Every claim about what EduNexus **could or should become** is explicitly labeled **[FUTURE ARCHITECTURE]** and must never be read as a repository finding or an implementation commitment. No ADR is raised.

**Builds on**: the complete 6A–7D series — canonical structure (6A/6B), operating model (6C), workflow (6D), organization (6E), information flow (6F), decision & authority (6G), the first Operating System Blueprint (6H), the exhaustive absent-domain census (7A), domain-driven architecture (7B), real-school organizational research (7C), and the Educational Decision Model (7D). This sprint is the series' capstone: not new investigation, but the future-state vision the preceding thirteen documents were building toward.

---

## Part 1 — What Is a School Operating System?

**Definitions** [FUTURE ARCHITECTURE for the framing; each system-type definition is standard industry usage, not repository-specific]:

- **Operating System**: the substrate every application-level capability runs on top of — in a school context, this means the layers that make every other feature possible: who someone is (Identity), what authority they hold (Organization), how information moves and is trusted (Information), and how decisions get made and recorded (Decisions). An operating system is judged by whether these substrate layers are coherent and complete, not by how many features sit on top of them.
- **Learning Management System (LMS)**: a content-delivery-and-activity system — course material, assignments, submissions, feedback loops. Its natural unit of concern is the lesson/activity, not the institution.
- **Student Information System (SIS)**: a records-of-truth system — who is enrolled, in what class, with what guardian, what their official grade history is. Its natural unit of concern is the learner-as-institutional-record, not the lesson.
- **School ERP**: an institutional-resource system — finance, HR/payroll, facilities, procurement. Its natural unit of concern is the school-as-business, not the learner at all.
- **Learning Intelligence Platform**: a system that computes derived understanding from confirmed evidence about a learner and feeds that understanding back into recommendations. Its natural unit of concern is the learner-as-evolving-competency-profile.

**Where EduNexus sits today** [restated, 6H Part 13]: a **Learning Intelligence Platform with the schema-level foundation of a Student Information System already laid, but not activated**, wrapped around a **Learning Management System surface that carries all real production traffic** (6H Part 8). It is not an ERP in any respect — Finance, Facilities, and HR/Payroll have no repository presence of any kind (7A Part 1, restated 7B Part 1).

**Where it should eventually sit** [FUTURE ARCHITECTURE]: a **Complete School Operating System** in the sense defined above — not by becoming an ERP itself, necessarily (Part 10 returns to this question), but by having every layer beneath its already-excellent Intelligence layer (Organization, Workflow, Information, Decisions — 6H Part 12's reference model) be as coherent and *activated* as the Evidence/Projection spine already is. The gap between today and this future state is, per this series' own repeated finding, not a capability gap — it is an **activation gap**: the code for much of the institutional layer already exists and has simply never been reached by a real user (6D, 6E, 6G throughout).

**Layered diagram, text form**:

```
National Layer
  KICD (curriculum content) — consumed, not decided (7A Part 2, 7C Part 5)
  KNEC (national assessment) — external, export-labeled only (7A Part 2)
  Ministry / TSC / County — [FUTURE ARCHITECTURE: no repository presence today]

Community Layer  [FUTURE ARCHITECTURE — no repository presence today]
  Parent networks, Alumni networks, inter-school benchmarking

School Governance  [today: schema-complete, unpopulated — 6E Part 3]
  Board-equivalent, Principal/Headteacher, Deputy Principal(s)

Administration  [today: Prototype maturity — 7B Part 5]
  Admissions, Enrollment, Academic Year/Term, Finance [FUTURE ARCHITECTURE — absent, 7A Part 1]

Academics  [today: the platform's live, exercised core]
  Curriculum, Departments [FUTURE ARCHITECTURE — absent], Assessment, Teaching

Learning  [today: live, AI-mediated — Compass, 6E Part 7]
  Student-facing activity, self-directed exploration

Intelligence  [today: Reference Quality for Evidence/Projection — 6H Part 4]
  Evidence, Projection, Career (ungoverned — 6G Part 3), Adaptive Learning

Analytics  [today: read-only, thin — 6E Part 8]
  Aggregate views, no write authority, no reachable consumer (6H Part 7)

Infrastructure  [today: real and working]
  AI call layer (lib/ai/deepseek.ts), cron/jobs, Platform/Developer context (structurally separate — 6E Part 1)
```

---

## Part 2 — The Complete School Model

Every domain restated with citation from 7A/7B where already found; each carries the same already-exists/partially-exists/not-modeled classification the sprint requests.

| Domain | Status | Evidence / Explanation |
|---|---|---|
| Admissions | **Partially exists** — a single indivisible write, no distinct admission decision | 6D Workflow 1, 7B Part 1 |
| Student Records | **Partially exists, duplicated** — `students`/`learners` split | Stage 0.5, throughout |
| Academics | **Already exists** — the live product's core | Throughout |
| Curriculum | **Partially exists, duplicated** — 4-way representation | 6B, 7C Part 5 |
| Departments | **Not modeled** — zero table, route, or permission tier | 7A Part 2, 7B Part 1 |
| Timetable | **Not modeled** | 6C/6D/6E, restated throughout |
| Attendance | **Not modeled, schema fossil only** (`days_present`/`days_absent`) | 6G Part 6 |
| Assessments | **Already exists**, production-grade | Throughout |
| Promotion | **Partially exists** — code and permission gates exist, zero live rows ever | 6D/6G |
| Graduation | **Partially exists**, structurally impossible in the legacy identity table | 6C/6D/6E |
| Finance | **Not modeled** — exhaustively confirmed absent | 7A Part 1 |
| Medical | **Not modeled** — exhaustively confirmed absent | 7A Part 1 |
| Transport | **Not modeled** — exhaustively confirmed absent | 7A Part 1 |
| Library | **Not modeled** — exhaustively confirmed absent | 7A Part 1/3 |
| Boarding | **Not modeled** — exhaustively confirmed absent | 7A Part 1 |
| Guidance & Counselling | **Not modeled as a human domain; territory occupied by ungoverned AI** | 7A Part 2, 7C Part 7, 7D Part 4 |
| Discipline | **Not modeled** — no code form of any kind for Suspension/Expulsion | 7A Part 4 |
| Parent Communication | **Partially exists, fragmented** — three non-communicating linking mechanisms | 6D Workflow 9, 6E Part 1 |
| Staff (HR) | **Not modeled** beyond `teachers`/`school_users` — no appraisal, professional-development tracking, or HOD-line-management concept | 7C Part 2/3, restated this document |
| Payroll | **Not modeled** | No repository evidence found by any prior sprint |
| Facilities | **Not modeled** | No repository evidence found by any prior sprint |
| Inventory | **Not modeled** | No repository evidence found by any prior sprint |
| Events (school calendar/functions) | **Not modeled** — distinct from `lib/events/` (the platform event bus, itself a confirmed dead end, 6F Part 7) | New distinction, this document |
| Documents | **Partially exists** — `lib/documents/` folder confirmed present (7B Part 1), functional depth UNKNOWN, not investigated by any prior sprint |
| Alumni | **Not modeled** — exhaustively confirmed absent | 7A Part 1 |
| Government Reporting | **Partially exists as export-format labeling only** — the KNEC-formatted CSV export, no live submission integration | 7A Part 2 |

**Pattern, restated from 7A/7B**: the domains a real school's day-to-day operation depends on split cleanly into two groups — those touching the **academic/learner-competency core** (Academics, Assessments, Curriculum, Parent Communication) are at least partially built, often well; those touching **institutional operations beyond the classroom** (Finance, Medical, Transport, Library, Boarding, Discipline, Staff, Payroll, Facilities, Inventory, Alumni) have essentially zero repository presence.

---

## Part 3 — Educational Intelligence Architecture [FUTURE ARCHITECTURE, grounded in 6H Part 7/7B Part 6/7D Part 6 today-state findings]

| Intelligence type | What it should know | What it must never decide | Today |
|---|---|---|---|
| **Learning Intelligence** | A single learner's confirmed evidence, capability/risk/knowledge state, learning history | A learner's disciplinary status, medical needs, or fee standing — these are outside its evidentiary domain entirely | **Exists, Reference Quality** (Evidence/Projection, 6H Part 4) |
| **Teacher Intelligence** | One teacher's whole-class patterns across subjects/time — which learners are drifting, which grouping strategies worked | Individual learner promotion/graduation (that is a collective, cross-teacher decision per 7C Part 6's research) | **Merely implied — fragmented across per-tool generators, no unified surface; `lib/teachingIntelligence/` exists with an UNKNOWN relationship to this need (7B Part 1)** |
| **School Intelligence** | Cross-class, cross-teacher, whole-institution patterns (strand health, intervention efficacy — the read-only analytics that already exist) | Any individual learner's specific fate — its unit of concern is the institution, not the person | **Exists as read-only analytics, no reachable consumer** (6H Part 7) |
| **Department Intelligence** [FUTURE ARCHITECTURE, no today-state — Departments don't exist] | A subject cluster's moderation patterns, curriculum-coverage consistency across its teachers, professional-development needs | Individual assessment grades (it should see *patterns* across grades, never *override* a specific one) | **Not modeled — the domain itself does not exist** (7A/7B) |
| **Leadership Intelligence** [FUTURE ARCHITECTURE] | Whole-school trends across terms/years, resource-allocation signals, department comparison | Any decision requiring individualized human judgment (discipline cases, SEN classification) — Leadership Intelligence should surface *that a pattern exists*, never adjudicate an individual case | **Not modeled — depends on School Intelligence having a reachable consumer, which it does not** (6H Part 7) |
| **Parent Intelligence** | A read-through, appropriately filtered, of their own child's Learning/Career Intelligence — never another learner's data | Anything about their own child that requires professional judgment (a diagnosis, a placement decision) — it should inform, never replace, the conversation with a teacher/counsellor | **Partially exists** — a read-through of Career/Compass output, no independent computation of its own (6H Part 7) |
| **Career Intelligence** | A learner's demonstrated capability profile, matched against real career/pathway information | **The final career-guidance recommendation itself — this is Sprint 6G/7D's central, three-times-corroborated finding: it currently decides, and per 7D Part 9's external-guidance comparison, this is the one Intelligence category where "never decide" matters most** | **Exists, autonomous, ungoverned** (6G Part 3, 7D Part 4/6) |
| **Operational Intelligence** [FUTURE ARCHITECTURE] | Institutional-resource patterns (once Finance/Facilities/Staff exist) — utilization, capacity, cost trends | Any individual learner-facing decision at all — its unit of concern is the institution-as-business, structurally separate from every Intelligence type above it | **Does not exist, not even implied — restated 6H Part 7, sharpened 7A Part 6: no institutional data exists for it to compute over even if built** |

**The organizing rule across this table** [FUTURE ARCHITECTURE, synthesized from the pattern above]: each Intelligence type's authority should be scoped exactly to its evidentiary unit — Learning Intelligence to the learner, Teacher/Department Intelligence to a bounded group of learners a specific human already has standing over, School/Leadership Intelligence to aggregate patterns only, and Career/Parent Intelligence to advisory content a *different* human (counsellor, parent, the learner themself) ultimately decides on. Career Intelligence is the one place this rule is currently violated, and it is violated specifically because its Intelligence type (career guidance) and its evidentiary unit (one learner's trajectory) both belong, by real-school precedent (7C Part 7), inside a human-judgment-only function that does not exist in EduNexus at all.

---

## Part 4 — The Human Decision Hierarchy [FUTURE ARCHITECTURE, grounded in 7D's Decision Catalogue and 7C's real-school role research]

For a representative cross-section of decisions (not all 35 from 7D's catalogue, to keep this table legible) — Recommend / Approve / Own / Override columns, per the sprint's specific question:

| Decision | Who recommends | Who approves | Who owns | Who can override |
|---|---|---|---|---|
| Assessment mark | Teacher (the act of marking itself) | Nobody today (7D Part 2) — **[FUTURE ARCHITECTURE]** should be self-approved by the marking teacher for routine marks, HOD for moderation-flagged ones | Class/Subject Teacher | Dean of Studies (moderation escalation) |
| Report Card publish | System (Core pipeline) / AI (legacy pipeline) | **[FUTURE ARCHITECTURE]** Deputy Principal Academics or Principal (per 7C Part 6's research finding this is a real-school Principal sign-off point) | Registrar (records-of-truth custodian, per 7C Part 2) | Principal |
| Promotion | Class Teacher (cohort data presentation, per 7C Part 6's "collective, staff-meeting-ratified" finding) | **[FUTURE ARCHITECTURE]** the staff collectively, ratified by Deputy Principal/Principal | Registrar | Principal, in an individual-exception case |
| Graduation | Registrar (records completeness check) | Principal | Principal, jointly with the school's governance body per 7C Part 1's research | Board-equivalent only, in extraordinary cases |
| Discipline escalation to suspension | Class Teacher / Year Coordinator (initial report) | Deputy Principal (lower-tier) → Principal (suspension) | Principal | Board-equivalent (expulsion only) |
| Career recommendation | **AI (today, exclusively — 7D Part 4/6)** | **Nobody, today** — **[FUTURE ARCHITECTURE]** should be Guidance & Counselling, with the learner and parent as active participants, not passive recipients | **[FUTURE ARCHITECTURE]** Guidance & Counselling | The learner/parent themselves — a career decision, uniquely among this table, should ultimately be overridable by its own subject, not just by someone senior to it |
| Guidance/Counselling referral | Any teacher, parent, or self-referral | Guidance & Counselling accepts/triages | Guidance & Counselling | Principal, only for safeguarding escalation |
| Evidence confirmation | Teacher (mastery) / System (engagement, guarded) | Teacher | Teacher-of-record at time of review | A later teacher, via retraction (already real, 6G Part 5) |
| Department curriculum sequencing | HOD | Dean of Studies / Curriculum Coordinator | HOD | Dean of Studies |
| Fee-related admission hold | **[FUTURE ARCHITECTURE — no Finance domain exists]** Finance Officer | Registrar (jointly, since admission and fee status intersect) | Finance Officer | Principal (hardship exceptions) |
| Government/national exam result | KNEC (external) | N/A — external to school authority entirely | KNEC | N/A — no school-level override exists or should exist |

**The one row this table shares with 7D Part 4's sharpest finding, restated once more for emphasis** [not new, cited]: Career recommendation is the sole row where "Who recommends" and "Who approves/owns" are, today, the *same actor* (AI) — every other row in this table already has, or should have per real-school precedent, a distinct recommending party and a distinct, senior, accountable approving party.

---

## Part 5 — Educational Workflow Engine [FUTURE ARCHITECTURE — architecture only, no implementation]

**The universal shape**: Draft → Review → Approve → Publish → Monitor → Archive. This is not a new invention — it is the generalization of the one workflow this series has repeatedly found already works this way: **Evidence's own lifecycle** (create/pending → teacher review → confirm/reject → [implicit publish, since confirmation is consumption-readiness] → consumed by Projection indefinitely → [no Archive stage found, 6F Part 12] ) and **Adaptive Learning's draft/approve pattern** (6G Part 3) are the two existing proof points that this six-stage shape is achievable in this codebase, not a foreign import.

**How each named example would fit** [FUTURE ARCHITECTURE, describing fit — not redesigning the actual domain]:

- **Assessment**: Draft (teacher creates) → Review (self, or HOD moderation-flagged) → Approve (self-approve for routine, HOD for flagged) → Publish (marks visible to learner/parent) → Monitor (does this assessment's evidence continue to look reliable over time — a genuinely new capability) → Archive (end of term/year, currently absent per 6F Part 12).
- **Reports**: Draft (generated from confirmed Evidence/Projection, not raw marks — closing 6F Part 3's largest gap) → Review (class teacher comment) → Approve (Principal/Deputy sign-off, filling the dormant `headteacher_comment` column's original intent, 6G Part 6) → Publish (parent-visible) → Monitor (N/A, a report card is a point-in-time artifact) → Archive (end of term, currently absent).
- **Promotion**: Draft (class teacher's cohort recommendation) → Review (collective staff review, per 7C Part 6's research) → Approve (Deputy/Principal ratification) → Publish (new enrollment record created) → Monitor (does the promoted learner's early performance validate the decision — a genuinely new capability) → Archive (the promotion event itself becomes part of the Learner Record Timeline, per CLAUDE.md's already-existing canonical-history function).
- **Discipline**: Draft (incident report, any staff) → Review (Year Coordinator/Deputy) → Approve (Principal, for anything above a warning) → Publish (recorded, parent-notified) → Monitor (pattern-tracking across a term — the specific place Teacher/Leadership Intelligence, Part 3, could legitimately assist without deciding) → Archive (with a stricter retention/expiry policy than academic records, since a discipline record's relevance should typically fade faster than an academic one).
- **Medical**: Draft (incident occurs, first-responder logs it) → Review (school nurse/designated first-aider) → Approve (N/A for most incidents — approval is not the right verb for "this happened," monitoring and parent-notification are) → Publish (parent notified immediately, not gated on a slower approval cycle — medical incidents should never wait in a review queue) → Monitor (allergy/condition register, ongoing) → Archive (per medical-record retention norms, likely the longest-retained category of all).
- **Career**: Draft (AI-generated capability match, exactly as today) → **Review (Guidance & Counselling — the stage currently entirely missing, per Part 3/4)** → Approve (the learner and parent, actively, not passively receiving) → Publish (delivered as a conversation-starter, not a verdict) → Monitor (does the learner's continued evidence support or complicate the earlier match) → Archive (career guidance history becomes part of the Learner Record Timeline).
- **Attendance**: Draft (daily mark, per period or per day) → Review (N/A — attendance is closer to a fact than a judgment, minimal review needed) → Approve (N/A) → Publish (visible to parent same-day) → Monitor (pattern detection — chronic absence flags, a genuinely valuable future Intelligence input this series has repeatedly noted has no data source today, 7A Part 6) → Archive (per-term, feeding the `school_report_cards.days_present`/`days_absent` fossil this series found, 6G Part 6).

**Where the six-stage shape does not fit uniformly** [FUTURE ARCHITECTURE, honest limitation]: Medical's "Approve" stage is a poor fit, as noted above — some workflows are Draft→Review→**Notify**→Monitor→Archive rather than truly requiring an Approve gate before anything happens, because the stakes of *delay* (a medical notification sitting in a queue) can exceed the stakes of *acting without a senior approval*. A single universal engine should accommodate an optional/skippable Approve stage rather than force one everywhere.

---

## Part 6 — The Organizational Layer (Departments) [FUTURE ARCHITECTURE, grounded in 7C Part 3's real-school research]

| Department | Ownership | Intelligence | Reporting | Goals | KPIs |
|---|---|---|---|---|---|
| Languages | HOD, subject teachers within | Aggregate evidence-confidence trends across English/Kiswahili/foreign-language cohorts | To Dean of Studies | Literacy/competency progression rates | % learners meeting CBC level expectations per term |
| Sciences | HOD | Same pattern, Biology/Chemistry/Physics/Integrated Science cluster | To Dean of Studies | Practical-competency evidence coverage (labs are evidence-rich, per this series' own Evidence-first philosophy) | Evidence-confirmation rate, practical-assessment coverage |
| Mathematics | HOD (or folded into Sciences in smaller schools, per 7C Part 1's research on school-size variation) | Same pattern | To Dean of Studies | Same | Same |
| Humanities | HOD | Same pattern | To Dean of Studies | Same | Same |
| Creative Arts | HOD | Lower evidence-density expected (per this series' Evidence-first design, subjective/creative work is harder to confidence-score than a mathematics answer) | To Dean of Studies | Portfolio-based evidence coverage rather than test-score-based | Participation/completion rather than pure mastery-score metrics |
| Technical Subjects | HOD | Same pattern as Sciences (practical/evidence-rich) | To Dean of Studies | Same | Same |
| Sports | Games Teacher (7A Part 2's confirmed-absent actor, restated here as the natural owner) | Minimal formal Intelligence need — this is the department this series' evidence-first computation model fits least naturally | To Deputy Principal (often folded into pastoral/wellbeing oversight rather than pure academics) | Participation, house/inter-school competition results | Participation rate |
| ICT | ICT Administrator (7A Part 2's confirmed-seed-only actor) | Infrastructure-health Intelligence (a genuinely different kind from every academic department — this is closer to Operational Intelligence, Part 3, than Learning Intelligence) | To Deputy Principal Administration | Platform uptime, digital-literacy coverage | System availability, digital-competency evidence coverage |
| Administration | Deputy Principal Administration / Registrar | Enrollment/records completeness Intelligence | To Principal | Records accuracy, admission-to-enrollment cycle time | % learner records complete, processing time |
| Finance | Finance Officer [FUTURE ARCHITECTURE — no domain exists today] | Fee-collection/arrears Intelligence — the closest thing to Operational Intelligence this table names | To Principal | Fee-collection rate, budget adherence | Collection rate, arrears aging |
| Boarding | Boarding Master [FUTURE ARCHITECTURE — no domain exists today] | Occupancy/wellbeing pattern Intelligence | To Deputy Principal Administration | Occupancy, incident rate | Incident count, occupancy rate |
| Medical | School Nurse [FUTURE ARCHITECTURE — no domain exists today] | Incident-pattern Intelligence (aggregate, never individual-diagnostic — restated Part 3's "must never decide" boundary for this category) | To Principal directly (medical reporting lines are typically kept short and direct, per real-school norms) | Incident response time, register completeness | Response time, register-completeness rate |

**The pattern across this table** [FUTURE ARCHITECTURE, synthesized]: every existing academic department maps cleanly onto EduNexus's already-proven Evidence/Intelligence pattern (aggregate, confidence-scored, human-reviewed); every non-academic department (Finance, Boarding, Medical, ICT-as-infrastructure) maps instead onto the still-entirely-hypothetical Operational Intelligence category (Part 3) — confirming, from yet another angle, this series' repeated finding that the academic core and the institutional-operations layer are architecturally different problems, not the same problem at different stages of completion.

---

## Part 7 — Educational Data Flow [restated where cited, FUTURE ARCHITECTURE for absent entities]

| Entity | Created by | Verified by | Consumed by | Archived by | Destroyed by | AI usage | Audit requirements |
|---|---|---|---|---|---|---|---|
| Assessment | Teacher | Nobody (no second reviewer, 6D/6G) | Evidence pipeline, both Report Card pipelines | **[FUTURE ARCHITECTURE — no archive mechanism exists, 6F Part 12]** | UNKNOWN, not investigated | None in the marking path itself | `teacher_id`/`created_at` only |
| Evidence | Assessment marking / Compass extraction | Teacher (mastery) / system account (engagement) | Projection exclusively (CLAUDE.md-enforced) | **[FUTURE ARCHITECTURE — none exists]** | `eraseEvidence` (a real, CLAUDE.md-governed function, 6G Part 10) | Confidence scoring, claim extraction | Full — the platform's one complete audit trail |
| Projection | System (`recomputeLearnerProjection`) | N/A — pure computation | Career, Blueprint, Holiday Planner, Monday Panel/Parent Pulse | **[FUTURE ARCHITECTURE — no history/versioning table found, 6F Part 6]** | Overwritten on recompute (not destroyed, superseded implicitly) | Zero — deterministic | Traceable to Evidence inputs only, no independent audit columns confirmed |
| Recommendation (Career) | AI | **Nobody — the platform's central gap, 6G/7D throughout** | Student, Parent | **[FUTURE ARCHITECTURE — none exists]** | UNKNOWN | Full — generates and persists autonomously | **None — zero trust/confidence/reviewer column** |
| Promotion | Nobody, in practice (zero live rows) | N/A | N/A | N/A | N/A | None | `processed_by`+`reason` schema exists, never populated |
| Graduation | Nobody, in practice | N/A | N/A | N/A | N/A | None | Same absence pattern as Promotion |
| Medical Record | **[FUTURE ARCHITECTURE — domain does not exist]** School Nurse/first-aider | Same | Parent (notification), Principal (aggregate pattern only) | Per medical-retention norms, likely longest of any category | Per regulatory retention requirements | None appropriate beyond a notification trigger (Part 3's strongest "never decide" case) | Full audit trail required, per the sensitivity of the data category |
| Attendance | **[FUTURE ARCHITECTURE — domain does not exist beyond its schema fossil]** Class Teacher (daily mark) | N/A — closer to fact than judgment | Report Card (`days_present`/`days_absent`, already schema-present), pattern-detection Intelligence | Per-term | UNKNOWN | Pattern-detection only, never the raw mark itself | Daily mark timestamp, minimal further audit needed given low judgment-content |
| Fee Payment | **[FUTURE ARCHITECTURE — domain does not exist]** Parent (payment action) | Finance Officer / payment gateway | Registrar (admission-hold gating), Finance reporting | Per financial-record retention requirements (typically longer than academic records) | Per regulatory requirement, likely never fully destroyed within statutory retention windows | None appropriate — a payment is a fact, not a judgment | Full financial audit trail required by nature of the domain |

---

## Part 8 — The Learner Life Journey [FUTURE ARCHITECTURE narrative, grounded throughout in cited today-state findings, extending 6F's "Amina" narrative to the full life stage list this sprint requests]

**Admission**: today, a single teacher write with no distinct decision (6D Workflow 1). **[FUTURE ARCHITECTURE]** would add a Registrar-owned admission review, a fee-status check (once Finance exists), and a medical-intake form (once Medical exists) — all *before* the learner's first classroom day, none of which delay Academics' own onboarding, which should remain as fast as it is today.

**Orientation**: **[FUTURE ARCHITECTURE, no today-state exists at all]** — a genuinely new stage this series has not previously named; a real school typically has some form of settling-in period (house/stream assignment, meeting the class teacher, an initial baseline assessment) that EduNexus's current single-write Admission has no equivalent of.

**Learning**: today, Compass — live, AI-mediated, unreviewed content shown directly to the student (6E Part 7). This is the journey's strongest system interaction today, and per Part 3/9's "never decide" boundaries, should remain exactly this open and immediate for *tutoring content* specifically, since tutoring is advisory-in-the-moment, not a durable decision about the learner.

**Assessment**: today, the platform's most-exercised, most reliable interaction (6D throughout) — no change to this stage's fundamental shape is implied by this document; it is already close to right.

**Intervention**: today, Holiday/Remedial Planning (AI-drafted, teacher-approved, 6E Part 7) and Adaptive Learning (the cleanest lifecycle in the series, 6G Part 3). **[FUTURE ARCHITECTURE]** would extend this stage with a genuine Learning Support accommodation record (7C Part 7's finding that this is currently unnamed, only functionally partial) so an intervention's *reason* (not just its content) becomes part of the learner's durable record.

**Career Guidance**: today, the journey's most significant interaction failure — AI decides and persists a career trajectory recommendation with zero human step (6G/7D throughout). **[FUTURE ARCHITECTURE]** this becomes the journey's clearest before/after contrast in this entire document: the learner receives an AI-drafted starting point, a Guidance & Counselling conversation happens around it (with the parent present, per Part 4/5), and only *then* does anything resembling a "recommendation" become part of the learner's own record — reachable and revisable by the learner themselves, not merely delivered to them.

**Promotion**: today, never actually happens for any learner in this codebase's evidence (6D/6G). **[FUTURE ARCHITECTURE]** becomes a collective, staff-ratified, Registrar-recorded event (Part 4/5), feeding forward into the Learner Record Timeline (already a real, canonical function per CLAUDE.md) rather than a currently-dormant table nobody writes to.

**Leadership** [FUTURE ARCHITECTURE, no today-state exists at all]: a genuinely new stage — Senior-School-age learners in many real schools take on prefect/leadership roles (house captain, class representative), a form of institutional recognition EduNexus's current model has no representation of whatsoever, and which would naturally belong in the Student Life/House domain this series has repeatedly found absent (7A Part 1).

**Graduation**: today, structurally impossible in the legacy identity table, unreachable in Core (6C/6D/6E). **[FUTURE ARCHITECTURE]** becomes the terminal, Principal-certified academic-record event this document's Part 4/5 describes, with an actual Certificate/Transcript artifact — distinct from the Academy's existing, unrelated "certificate" feature (a naming collision this series already flagged, 7A Part 3) — issued as a genuine record-of-completion.

**Alumni**: today, zero repository presence of any kind (7A Part 1). **[FUTURE ARCHITECTURE]** the weakest-justified future domain in this entire series (7B Part 7 already noted its justification is forward-looking, not evidenced by a current felt gap) — included here for completeness of the life journey, not as a near-term priority.

**Lifelong Learning** [FUTURE ARCHITECTURE, no today-state exists, and arguably outside any single school's proper scope]: the only stage in this journey this document explicitly declines to elaborate architecturally — a school-scoped operating system's proper boundary (Part 1's own SIS/LMS/ERP definitions) does not naturally extend past Alumni into a learner's entire adult life, and this document treats attempting to do so as scope creep beyond what any evidence in this series supports.

**Every system interaction across this journey, summarized**: of the eleven stages the sprint names, **four have a real, working system interaction today** (Learning, Assessment, Intervention, Career Guidance — the last one working but incorrectly owned), **two have code that exists but is never reached** (Admission's distinct-decision-shape, Promotion), **two have zero repository presence** (Graduation reaching its terminal state, Alumni), and **three are entirely new territory this document names for the first time in the series** (Orientation, Leadership, Lifelong Learning) — none of which any prior sprint searched for, because none of the prior sprints' example lists included them.

---

## Part 9 — Twenty-Five Educational Operating System Laws

Extending 7A's ten Design Principles and 7B's twenty Domain Laws (thirty already-established laws) with five genuinely new laws this sprint's future-state synthesis surfaces, and restating the twenty-five most load-bearing of the prior fifty-five in the sprint's own requested count, each grounded in cited evidence:

1. **Nothing should exist without ownership.** *Grounded in*: every domain this series found duplicated or dormant (Report Card, Promotion) traces back to a moment where a second implementation was built without a single owner being assigned to reconcile it with the first (restated 7B Law 1/11).
2. **Every AI recommendation has a human owner.** *Grounded in*: the contrast between Adaptive Learning (owned) and Career Intelligence (unowned) — restated 6G Part 3, 7D throughout.
3. **Every learner action leaves evidence.** *Grounded in*: Evidence's own design intent (CLAUDE.md) — though restated honestly, this is currently true only for Assessment/Compass-sourced actions, not for informal teacher observation (7D Part 7's identified gap).
4. **Every published decision is traceable.** *Grounded in, and currently the exception rather than the rule*: only Evidence fully satisfies this (6G Part 9) — stated as a law precisely because it is violated more often than upheld today.
5. **Authority must follow organizational structure, not the reverse.** *Grounded in*: the Reference School's seed titles naming real authority distinctions that `lib/core/permissions.ts` then flattens (7A Part 4, 7C Part 8) — the platform currently lets its permission model define structure, rather than structure defining permissions, which this law states backwards from how it should work.
6. **Educational intelligence cannot invent evidence.** *Grounded in*: Projection's exclusive read of *confirmed* Evidence, never raw or inferred data (restated throughout) — the one law this series can say is fully upheld today.
7. **Institutional memory outlives individual teachers.** *Grounded in*: CLAUDE.md's own rule that `teacher_id` means "who entered this," never "who owns this" — restated 6E throughout — and the Learner Record Timeline's design intent as a durable, actor-independent history.
8. **A domain's maturity is capped by its least-reachable half.** *Restated, 7B Law 11.*
9. **A decision without a named approver is not a decision — it is an unattended default.** *Restated, 7D Part 8 Law 7.*
10. **AI infrastructure is centralized; AI governance is not, and must be designed per decision.** *Restated, 7B Law 18.*
11. **A correction is a new fact, never a rewritten one.** *Restated, 7B Law 9/7D Part 8 Law 5.*
12. **Confidence is never certainty.** *Restated, 7D Part 8 Law 6.*
13. **National-level decisions are consumed, never re-decided.** *Restated, 7D Part 8 Law 8.*
14. **A dormant governance mechanism is evidence of prior intent — activate before rebuilding.** *Restated, 7D Part 8 Law 9, citing `assessment_quality_flags`/`headteacher_comment`.*
15. **An event published with no subscriber is not integration — it is a diary entry.** *Restated, 7B Law 14, citing the confirmed-dead `lib/events/` system.*
16. **A learner-scoped table must declare which identity space it is anchored to, and every consumer must check.** *Restated, 7B Law 15.*
17. **Communication delivers decisions; it never creates them.** *Restated, 7B Law 8.*
18. **Identity never owns educational decisions.** *Restated, 7B Law 7.*
19. **Assessment never depends on Intelligence.** *Restated, 7B Law 5 — this document's Part 5 workflow design preserves this explicitly (a report is *drawn from* Evidence/Projection, but Assessment's own act of marking does not wait on any Intelligence computation).*
20. **[NEW] Every domain's Intelligence type is scoped exactly to the evidentiary unit a human already has standing over.** *Grounded in*: Part 3's organizing rule, synthesized from this series' repeated finding that Career Intelligence is the one violation of an otherwise-consistent scoping pattern.
21. **[NEW] A workflow's Approve stage is mandatory only where delay is safer than error; where delay itself is the harm (a medical notification), Approve must be skippable in favor of immediate Publish plus retrospective Monitor.** *Grounded in*: Part 5's honest limitation finding for the Medical workflow specifically.
22. **[NEW] Non-academic institutional domains (Finance, Facilities, Boarding) require Operational Intelligence, a structurally distinct category from every learner-facing Intelligence type — the two must never share a scoring or trust model.** *Grounded in*: Part 6's finding that every academic department maps to the Evidence pattern while every non-academic department maps instead to the still-hypothetical Operational Intelligence category.
23. **[NEW] A career or trajectory-shaping recommendation for a minor must remain overridable by the learner themself, not only by someone organizationally senior to them.** *Grounded in*: Part 4's Career recommendation row being the only decision in this document's Human Decision Hierarchy where the subject of the decision is also named as a legitimate overrider — drawn from 7D Part 9's external-guidance research on process-matters-independently-of-accuracy for this specific decision category.
24. **[NEW] A life-stage this series never previously named (Orientation, Leadership, Alumni) is not evidence of a defect — it is evidence the prior audits' example lists were themselves incomplete, and future audits should expect to keep finding these.** *Grounded in*: Part 8's finding that three of eleven learner-journey stages had never been searched for by any prior sprint, purely because no prior sprint's example list included them — a methodological lesson about this series itself, not only about EduNexus.
25. **What is not modeled cannot be protected, decided, reported on, or made intelligent.** *Restated, 7A Part 9 Principle 10 — closing this list exactly as the series' first future-facing document opened its own principles, because this sprint's synthesis confirms it remains the single most load-bearing law in the entire series.*

---

## Part 10 — North Star Vision [FUTURE ARCHITECTURE — pure vision, no implementation, no marketing]

If EduNexus succeeds over the next decade, it becomes an **Educational Operating System whose institutional layer is as trustworthy as its Intelligence layer already is today.** Not a bigger LMS, not a heavier SIS bolted onto an AI feature set, and not an ERP — those are all shapes this series found evidence EduNexus is explicitly *not* becoming (Part 1). The distinguishing outcome, if this vision is realized, is that the same discipline this series found in exactly one place today — Evidence's confidence-tiered, human-confirmed, fully-traceable, correction-by-supersession model — becomes the **default shape every domain is built to**, not the exception one subsystem happens to have achieved.

Concretely, this means: a Principal in ten years can trust a promotion decision the way a teacher today can trust a confirmed Evidence row — because it went through the same kind of gate. A parent can trust a career conversation the way a teacher today trusts Adaptive Learning's grouping proposal — because a human they know reviewed it, adjusted it, and stands behind it. A Ministry inspector can trust EduNexus's institutional records the way this series' own audits have learned to trust `learner_evidence`'s schema — because the audit trail is not an afterthought, it is the record's proof that it happened correctly (7D Part 8 Law 10). And a future engineer joining the team can open any new domain's code and recognize the same six-stage shape (Part 5) this document found already working in Evidence and Adaptive Learning today, because by then it will be the house style, not a proposal in an architecture document.

This is not a vision of EduNexus adding more AI. It is a vision of EduNexus extending the one discipline this entire fourteen-document series found genuinely, verifiably, repeatably working — to every domain a real school actually needs, in the order its own evidence (7A/7B/7D's priority groupings) already points to, governed throughout by the twenty-five laws this document closes with. **The platform's north star is not to be the most intelligent school system. It is to be the most trustworthy one — where trustworthiness is not a marketing claim, but the specific, auditable, human-accountable shape this series has spent fourteen documents proving is achievable, because one part of the codebase already proves it.**

---

## What This Document Does Not Do

Per its own scope: it proposes no schema, no implementation sequencing beyond citing 6H/7A/7B's already-produced priority tiers, and no product roadmap. Every **[FUTURE ARCHITECTURE]** label in this document marks vision and synthesis, not a commitment, a design, or a repository finding — and must be read that way by any future document citing this one. No ADR is raised: this document sharpens, once more, the Career Intelligence ownership question this series has now found independently across 6G, 7C, 7D, and this document's Parts 3/4/8/9 — but sharpening a finding four times is not the same as discovering a new canonical-domain conflict, and this document does not treat it as one.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only `docs/architecture/sprint-7e-educational-operating-system-blueprint.md` and the implementation log entry were written.

## Stop Condition

STOP after this document. This closes the 6A–6H, 7A–7E architectural audit and future-state synthesis series in full. Any future implementation work — on Career Intelligence's ownership, on any absent domain, on the workflow-engine shape described in Part 5, or on anything else this fourteen-document series has found — requires separate scoping and explicit approval, and should begin from 6H/7A/7B's already-evidenced priority tiers rather than this document's Part 10 vision directly.
