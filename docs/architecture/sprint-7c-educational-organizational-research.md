# Sprint 7C — Educational Organizational Model Research

**Mode: RESEARCH, NOT A CODE AUDIT.** Parts 1–7 of this document are general educational-systems knowledge and reasoning — they are **not** repository evidence and must never be cited elsewhere in this documentation series as if they were. Part 8 (the comparison against EduNexus) draws only on the already-established, code-grounded findings of Sprints 6A–7B, cited back to their origin. Part 9's recommendations are synthesis, not implementation. No code, schema, migration, or configuration was touched; no ADR is raised.

**Builds on**: the full 6A–7B series for everything said about EduNexus itself. This document adds no new repository investigation — its sole new contribution is the external research in Parts 1–7 and the comparison/recommendation synthesis in Parts 8–9.

**A note on research method and its limits**: Parts 1–7 draw on general, publicly known facts about how Kenyan and international schools organize themselves (CBC/TSC structures, Cambridge/IB coordination models, and widely-documented features of the Finnish and Singaporean systems), reasoned from first principles about what each system's stated goals imply organizationally. This is not a citation-backed academic literature review, and several specifics (exact TSC title names, exact IB coordinator terminology at a given school) vary by institution and may not be universal — these are flagged inline as **[GENERAL, VARIES BY SCHOOL]** where the variation is material. Where this document is confident a structure is close to universal (e.g., that CBC schools organizationally report to a Principal, not a Head of School), it states so without the qualifier.

---

## Part 1 — Organizational Structures by School Type

**Kenyan Public Secondary Schools**: governed by a Board of Management (BOM) at the institutional-governance level, with a Teachers Service Commission (TSC)-employed Principal as chief executive academic and administrative authority. Below the Principal, a Deputy Principal (sometimes split into Academics and Administration in larger schools) handles day-to-day operations. Academic organization below that point is typically **subject-panel-based rather than department-based** in smaller public schools (a "Mathematics panel" of the school's math teachers, informally led by the most senior teacher, rather than a formally titled Head of Department with budget authority) — formal HOD structures become more common as school size increases. A Senior Teacher or Deputy Principal typically also holds the Examinations Officer function informally, rather than it being a dedicated, differently-titled post in smaller schools **[GENERAL, VARIES BY SCHOOL — larger, better-resourced public schools more closely resemble the fuller structure described under Private Schools below]**.

**Kenyan Private Schools**: tend to have a fuller organizational chart, closer to what the Reference School's seed data (`scripts/reference-school/03-seed-staff.ts`, per Sprint 6E/7A) already anticipated — a Principal, one or two Deputy Principals with a real Academics/Administration split, a formally titled Dean of Studies or Director of Studies, genuine HODs with subject-cluster authority (timetabling input, moderation, professional development), a dedicated Examinations Officer, and often a Registrar/Admissions Officer distinct from general administration. Private schools more frequently have Guidance & Counselling as a named, staffed function (sometimes a full department) rather than an informally absorbed duty.

**CBC Schools** (the curriculum framework, applicable to both public and private schools in Kenya): CBC's structural implication is less about org-chart titles and more about **assessment governance** — the framework's competency-based design assumes continuous, teacher-held formative assessment feeding into a smaller number of summative checkpoints (End of Grade 6/9/12-equivalent national assessments), which places heavier organizational weight on the class/subject teacher's day-to-day judgment than a purely exam-driven system would, and correspondingly lighter weight on a centralized "Examinations Office" than, say, an O-Level-style system. CBC also introduces a genuine **Senior School pathway decision** (STEM / Social Sciences / Arts & Sports) at the Grade 10 transition — an institutional decision point with real stakes, typically involving the learner, parent, a guidance function, and the school's academic leadership together, not a single actor's call.

**Cambridge Schools**: layer an **examination-board compliance structure** on top of whatever base organizational chart the school otherwise has — a Cambridge/Exams Officer role registered with Cambridge International specifically, subject coordinators for each Cambridge syllabus offered (IGCSE, AS/A-Level), and an internal moderation requirement before any coursework component is submitted externally. This is a heavier, more formally audited version of the "moderation" function EduNexus's dormant `assessment_quality_flags` table anticipated (restated 6C/6E).

**IB Schools**: organized around the IB's own required roles — an **IB Coordinator** (often one per programme if a school runs more than one of PYP/MYP/DP), subject-group leaders, and — distinctively — a formal internal-assessment moderation and standardization process that is a *condition of authorization* to run the programme at all, not an optional internal choice. IB schools also typically have a more formally structured "Learning Support"/"Special Educational Needs" coordination role than a typical national-curriculum school, since IB's inclusive-education philosophy is an explicit authorization requirement.

**Finnish Schools**: notable for a **flatter, more teacher-trusted organizational model** — significantly less standardized external testing, more autonomy held at the individual teacher and school level, and a national curriculum framework that is deliberately broad rather than prescriptive. Academic leadership exists (a Rehtori/Principal) but the emphasis on teacher professional judgment over centralized oversight is the structurally distinctive feature, not a different org chart shape.

**Singapore Schools**: notable for the opposite emphasis — a highly structured, data-driven system with formal streaming/subject-banding decisions made with real institutional weight (Ministry-set frameworks, school-level committees, explicit criteria), and a correspondingly more elaborate internal data-and-decision infrastructure to support those decisions than most systems described above.

**High-performing digital schools** (a more recent, less institutionally standardized category — schools built around an LMS/SIS-first operating model rather than adapting digital tools to a pre-existing paper-based structure): tend to compress several traditionally separate administrative roles (registrar, exam office, records) into fewer people supported by more capable software, and correspondingly place *more* organizational weight on the software's own decision-traceability and workflow-completeness than a paper-first school would ever need to — a signal directly relevant to EduNexus's own architecture, since Sprints 6G/7B's traceability findings (bimodal: Evidence excellent, almost everything else thin) suggest EduNexus has the ambition of this category without yet the supporting decision infrastructure.

---

## Part 2 — Academic Leadership

| Role | Responsibilities | Authority | Decision ownership | Reporting line | Interactions |
|---|---|---|---|---|---|
| **Principal** | Chief academic and administrative authority; final institutional sign-off | Full — hiring recommendation, discipline (including expulsion, jointly with BOM in Kenya), external representation | Graduation certification, major discipline, final report-card sign-off | Board of Management (Kenya) / school governing body | Every role below |
| **Deputy Principal** | Day-to-day operations; in larger schools, split Academics vs. Administration | Delegated from Principal, scope varies by school | Timetabling, discipline (lower-tier), academic calendar | Principal | HODs, class teachers, Examinations Officer |
| **Dean of Studies / Director of Studies** | Academic program oversight distinct from discipline/operations — curriculum coherence across departments, exam scheduling oversight | Cross-departmental, non-line-management (usually cannot hire/fire, but sets academic policy) | Assessment calendar, curriculum-coverage tracking, academic-policy questions | Principal or Deputy Principal (Academics) | HODs directly, class teachers indirectly |
| **Academic Registrar** | Records-of-truth custodian — enrollment, transcripts, certification, transfer documentation | Administrative, not pedagogical | Who is formally enrolled, transcript issuance, transfer/withdrawal paperwork | Deputy Principal (Administration) or Principal directly | Admissions, Finance (for fee-clearance-gated processes), Exam boards |
| **Head of Department (HOD)** | Subject-cluster leadership — a group of related subject teachers (e.g., "Sciences" covering Biology/Chemistry/Physics) | Real but bounded — timetable input, moderation sign-off, professional-development scheduling, budget input in better-resourced schools | Internal assessment moderation, scheme-of-work consistency within the department, department-level resource requests | Dean of Studies / Deputy Principal Academics | Subject teachers within the department, other HODs |
| **Subject Head** | **[GENERAL, VARIES BY SCHOOL]** — sometimes synonymous with HOD in a single-subject department (e.g., a school large enough to have a dedicated Mathematics department separate from a broader "Sciences" cluster); sometimes a narrower role beneath an HOD | Narrower than HOD where the two are distinct | Subject-specific curriculum sequencing | HOD or directly to Dean of Studies | Subject teachers |
| **Curriculum Coordinator** | Cross-subject curriculum alignment, often the role that owns "does our scheme of work actually match the national curriculum's coverage requirements" | Advisory/coordinating, not usually line-management | Curriculum-mapping decisions | Dean of Studies | HODs |
| **Examinations Officer** | Exam scheduling, invigilation logistics, results processing, external exam-board liaison (KNEC in Kenya, Cambridge/IB where applicable) | Administrative/logistical, with real gate-keeping authority over exam validity (irregularity reporting) | Exam timetable, moderation-flag escalation | Deputy Principal or Dean of Studies | HODs (for moderation), Registrar (for results-to-transcript flow) |
| **Academic Coordinator** | **[GENERAL, VARIES BY SCHOOL]** — often a catch-all title for cross-cutting academic-support functions not otherwise named (data analysis, intervention coordination) — closest functional analogue to what this series has been calling "School Intelligence"/"Operational Intelligence" | Advisory | Intervention-program design, academic-data interpretation | Dean of Studies | HODs, class teachers, sometimes Guidance & Counselling |
| **Year Coordinator / Level Coordinator** | Pastoral + academic oversight for one grade/year cohort across all subjects — the person who has a whole-learner view of one cohort, as distinct from an HOD's one-subject view | Bounded to their year group | Year-level discipline escalation, year-level pastoral concerns | Deputy Principal or directly to Principal in smaller schools | Class teachers within the year, Guidance & Counselling |
| **Class Teacher** | Primary point of contact for one class; pastoral + light administrative duties (attendance, basic behavior tracking) — this is the role EduNexus's live product most closely and fully models | Bounded to own class | Day-to-day classroom decisions, first-line pastoral concern | Year Coordinator or Deputy Principal | Subject teachers of their class, parents, Guidance & Counselling |
| **Subject Teacher** | Instructional delivery and assessment for one subject across possibly multiple classes | Bounded to instruction and grading of their subject | Marking, subject-specific pedagogical choices | HOD | Class teachers (for pastoral handoff), HOD |
| **Learning Support** | Differentiation and accommodation for learners with identified learning needs | Advisory to subject/class teachers, sometimes direct instructional role in a resource room model | Individual Education Plan (IEP)-style accommodation decisions | Deputy Principal Academics or a dedicated SEN coordinator | Subject teachers, parents, (where present) Medical/Guidance |
| **Guidance & Counselling** | Pastoral, career, and (in Kenya, per Ministry mandate for registered secondary schools) a formally required function — academic guidance, personal/social counselling, career guidance, discipline-adjacent mediation | Confidentiality-bound, advisory rather than line-authority | Individual learner support-plan recommendations, career-guidance input, discipline-mediation input | Principal or Deputy Principal directly (deliberately kept close to top leadership in many models, to preserve independence from subject-teacher line management) | Class teachers, parents, Year Coordinators, (where it exists) a formal discipline committee |

---

## Part 3 — Departments

**How departments are created**: typically an administrative decision by the Principal/Deputy Principal (sometimes formalized through the Board of Management for larger structural changes), driven by school size — a school large enough to have multiple teachers per subject cluster forms a department; a small school with one teacher per subject area often does not formalize departments at all, relying on the informal subject-panel model described in Part 1.

**Typical departments** (Kenyan secondary, CBC-aligned, consistent with the sprint's own example list): Languages (English, Kiswahili, and often a foreign language), Sciences (Biology, Chemistry, Physics, Integrated Science at Junior level), Mathematics (sometimes folded into Sciences in smaller schools, standalone in larger ones), Humanities (History & Citizenship, Geography, CRE/IRE/Social Studies), Creative Arts (Art, Music, sometimes Drama), Technical/Applied Subjects (Agriculture, Business Studies, Computer Studies, Pre-Technical Studies — CBC's own subject list, matching `app/api/teacher/reports/knec-export/route.ts`'s label set found in Sprint 7A), ICT (sometimes a department in its own right, sometimes folded into Technical Subjects), Sports/Physical Education (often paired with a "Games Teacher" role, per Sprint 7A's actor research), Special Needs (where a school has a formal SEN unit rather than ad hoc Learning Support).

**Do departments own**:
- **Teachers**: yes, in the sense of professional/reporting-line ownership (an HOD provides input to a teacher's appraisal, schedules their professional development) — but not employment ownership, which remains with the school/TSC.
- **Subjects**: yes — a department is, structurally, defined by which subjects it clusters; this is its primary organizing principle.
- **Budgets**: partially, and only in better-resourced private schools — a department typically has *input* into a resource-request budget line, rarely full budget authority.
- **Resources**: yes, typically — lab equipment, textbooks, and specialized teaching materials are usually department-tracked.
- **Assessment moderation**: yes, this is one of the department's most consistent real functions across every school type researched — a department reviewing a sample of marked scripts before results are finalized, precisely the function EduNexus's dormant `assessment_quality_flags` table (restated 6C/6E/7B) anticipated and never activated.
- **Curriculum planning**: yes, typically the department's other core consistent function — scheme-of-work coherence within the subject cluster.
- **Professional development**: yes, usually department-coordinated even when school-wide budget-approved.

---

## Part 4 — Faculties, Departments, Learning Areas, and Related Terms

- **Faculty**: a broader grouping than Department, typically used in larger secondary schools or tertiary-adjacent institutions to cluster multiple departments (e.g., a "Faculty of Sciences" containing separate Biology, Chemistry, Physics, and Mathematics departments). **Exists** in larger, more formally structured private/international schools; **rarely exists** as a distinct layer in typical Kenyan public secondary schools, where Department is usually the largest formal academic-organization unit below the whole school.
- **Department**: the standard mid-tier organizational unit, per Part 3 — exists wherever a school is large enough to warrant it, functionally replaced by informal subject panels where it is not.
- **Learning Area**: CBC-specific terminology (matching EduNexus's own `sow_learning_areas` table, restated 6B/6C) for a curriculum content cluster — closer to "Subject" than to "Department," but CBC's own framework sometimes groups several traditional subjects into one Learning Area at Junior level (e.g., "Integrated Science" combining what would separately be Biology/Chemistry/Physics content).
- **Subject**: the standard instructional unit — what a Subject Teacher teaches and a learner is assessed in.
- **Programme**: used in IB contexts specifically (Primary Years Programme, Middle Years Programme, Diploma Programme) — a multi-year curricular structure a school is authorized to run, broader than any single subject or department.
- **Course**: more common in Cambridge/international/tertiary-adjacent contexts than in standard Kenyan secondary terminology — roughly synonymous with Subject at that level, but sometimes denotes a specific syllabus variant (e.g., "IGCSE Mathematics (Extended)" as a distinct course from "IGCSE Mathematics (Core)").
- **Stream**: a parallel section within the same Grade (e.g., "Grade 9 East" vs. "Grade 9 West") — an administrative/logistical grouping, not an academic-content distinction; this is the concept Sprint 7A/7B flagged as an unresolved open question for EduNexus (does EduNexus's `Class` concept already function as Stream, or is Stream a genuinely separate, unmodeled layer — **this document does not resolve that question, restated as still open**).
- **Grade**: the CBC-standard year-of-study label (Grade 7 through Grade 12) — what EduNexus's own 3-way Grade duplication (restated 6B) is attempting to represent.
- **Year**: broadly synonymous with Grade in most terminology contexts, sometimes used in international/Cambridge contexts where "Year 10" is the equivalent label to Kenya's "Grade/Form" system.
- **Class**: the actual teaching group a learner and teacher meet as — in a single-stream school, Class and Grade/Year are effectively the same population; in a multi-stream school, Class is Grade × Stream.

**When each exists, when it doesn't**: Faculty and Programme are the two terms in this list that genuinely do not apply to most Kenyan CBC secondary schools at all (Faculty because of school size, Programme because it is IB-specific terminology) — a research-honest finding this document flags clearly rather than assuming EduNexus needs both concepts. Department, Learning Area, Subject, Stream, Grade, and Class are all either already present or plausibly needed in a CBC Kenyan context.

---

## Part 5 — Curriculum Organization

**CBC**: subjects belong to Learning Areas (a CBC-specific clustering, per Part 4), which are themselves organized by Grade band (Junior: Grade 7–9; Senior: Grade 10–12, with the pathway split). Curriculum ownership sits nationally with KICD (the Kenya Institute of Curriculum Development) — schools implement, they do not author, the curriculum content itself; a school's own curriculum-ownership work is limited to scheme-of-work sequencing and pacing *within* KICD's framework, which is precisely what EduNexus's `lib/curriculum/`/`lib/sow/` modules are built to support (restated 6B/7A). Schemes of Work are organized per subject per term per grade, typically HOD-reviewed for coherence (Part 3). Assessments relate to the curriculum via CBC's competency-based design — assessments are meant to check demonstrated mastery of specific learning outcomes, not just topic coverage, which is philosophically the closest real-world analogue to EduNexus's own Evidence-first design (restated 6H Part 12, 7A Part 7). Progression is tracked via a mix of continuous formative assessment and periodic summative checkpoints, with the Grade 9→10 transition being CBC's one genuinely high-stakes national checkpoint.

**Cambridge**: subjects belong to syllabus groups registered with Cambridge International, each with its own externally-set curriculum content (a school does not author IGCSE Biology's syllabus, it delivers Cambridge's). Curriculum ownership is therefore split — Cambridge owns the syllabus, the school owns the delivery sequencing (scheme of work) within it, subject-coordinator-reviewed. Assessments relate via a mix of school-internal continuous assessment and Cambridge's own externally-set and externally-moderated examinations. Progression is tracked per syllabus stage (IGCSE → AS → A-Level), each a genuine institutional checkpoint requiring registration with the exam board.

**IB**: subjects belong to one of six subject groups within whichever programme (PYP/MYP/DP) the school runs, with IB itself owning the curriculum framework and requiring the school's own curriculum documentation to demonstrate alignment (a genuine authorization/audit requirement, not merely good practice). Schemes of work are organized around IB's own "Units of Inquiry" (PYP) or subject-guide structure (DP), coordinator-reviewed and, distinctively, subject to IB's own external moderation of internal assessment components. Progression is tracked toward the Diploma's own points-based assessment system at DP level, a structurally different model from CBC's competency-checkpoint approach.

---

## Part 6 — Assessment Governance

| Assessment type | Who approves (typical) |
|---|---|
| **CATs (Continuous Assessment Tests)** | Subject teacher creates and marks; HOD-level moderation review in schools with active departments; no formal approval gate in schools relying on the informal subject-panel model |
| **Exams (internal, end-of-term)** | Subject teacher creates/marks; Examinations Officer coordinates scheduling; Dean of Studies/Deputy Principal typically signs off on the exam calendar itself, not individual exam content |
| **Moderation** | HOD (department-internal) for CATs/coursework; Examinations Officer coordinates escalation of irregularities; external-board moderation (Cambridge/IB) sits with the exam board itself, not the school |
| **Report Cards** | Class teacher/subject teachers produce content; typically Deputy Principal or Principal signs off before release to parents — this is the "Principal approval" step this series has already identified EduNexus's `school_report_cards.headteacher_comment` column as a schema fossil for (restated 6G Part 6/7A Part 4), never wired into any actual approval workflow |
| **Promotion** | Typically a whole-school or whole-grade decision made at a staff meeting (class teachers presenting their cohort's data, Deputy Principal/Principal ratifying), not an individual teacher's unilateral call, and not usually a single "approver" in the software-permission sense — closer to a collective academic-board decision |
| **Graduation** | Principal-certified, often with Board of Management awareness for the formal completion record; for national-exam-gated systems (KCSE historically, CBC's own national assessment going forward), also gated on the external exam body's own results release |
| **Assessment schedules** | Deputy Principal Academics or Dean of Studies sets the calendar; Examinations Officer administers it |
| **National exams** | Wholly external (KNEC in Kenya) — the school's role is registration, administration, and invigilation, not approval of content or results |
| **Internal exams** | School-internal, per the "Exams" row above |
| **Continuous assessment** | Subject teacher-owned day to day, department-moderated periodically — this is the CBC-specific governance model closest to what EduNexus's Evidence/confidence-tiering system (restated throughout 6D–6G) already technically implements, without the human moderation layer (HOD sign-off) that a real school would add on top |

---

## Part 7 — Student Support

| Function | Ownership | Workflow | Records | Confidentiality | AI boundaries **[reasoned, not a repository finding]** |
|---|---|---|---|---|---|
| **Guidance** | A named Guidance & Counselling teacher/department, reporting close to top leadership (Part 2) | Referral (self, parent, or teacher-initiated) → session → optional escalation to Principal/Year Coordinator for serious concerns | A guidance case file, typically access-restricted even from most teaching staff | High — guidance records are typically treated as more confidential than academic records, often with explicit consent requirements for sharing beyond the counsellor and school leadership | AI should, at most, be an intake/triage assistant flagging a need for human guidance attention — never a substitute for the human counsellor's own judgment, especially for anything touching mental health, family circumstances, or safeguarding; this is the strongest real-world argument this document can make for why EduNexus's current Career Intelligence (restated 6G/7A/7B as fully autonomous, unreviewed, occupying Guidance's territory) is architecturally in the wrong place even though it is *functioning*, because a career-guidance conversation in a real school is understood as sitting inside the broader, confidentiality-bound Guidance function, not as a separate ungated AI product |
| **Counselling** | Same function as Guidance in most Kenyan schools (a combined "Guidance & Counselling" role); larger international schools sometimes separate academic guidance from personal/psychological counselling | Same referral model | Same confidentiality standard, often higher for counselling-specific notes | Highest | Same reasoning as above, more acute |
| **Learning Support** | A SEN coordinator or the Deputy Principal Academics in smaller schools | Identification (often via a formal assessment) → Individual Education Plan → ongoing subject-teacher accommodation | An IEP-style record, shared with the learner's subject teachers but not the whole staff | Moderate-to-high — shared on a need-to-know basis with a learner's actual teachers | AI-assisted differentiation (EduNexus's own Adaptive Learning, restated 6E/6G/7B as the platform's cleanest AI/human boundary) is a reasonable fit here *if* extended with the explicit accommodation-record concept a real Learning Support function keeps — today it operates on grouping proposals only, not a persisted individual accommodation record |
| **Special Needs** | Same as Learning Support where no separate SEN unit exists; a dedicated SEN department in larger/better-resourced schools | Same | Same, sometimes more formally documented (external assessment reports, therapy records) | Highest among the academic-adjacent functions | Same reasoning, with an even stronger case for human-only judgment on formal SEN classification |
| **Medical** | A school nurse or designated first-aider; Kenyan Ministry guidelines require basic first-aid capacity at minimum | Incident occurs → first-response → parent notification → (if serious) referral | An incident log, allergy/condition register, emergency-contact record | Very high — medical information is among the most sensitive categories a school holds | AI has essentially no legitimate decision role here — at most, a notification-trigger assistant ("this learner's emergency contact should be called"), never a diagnostic or triage function; this is the clearest "AI should never participate" category this entire research effort surfaced |
| **Behaviour** | Class teacher (first-line), escalating to Year Coordinator, then Deputy Principal, then Principal/BOM for the most serious cases (suspension/expulsion) | A graduated escalation ladder, not a single flat decision | An incident record, typically visible to the learner's teaching staff and definitely to school leadership | Moderate — less restricted than medical/counselling records, but not fully open (a discipline record is not typically shared with unrelated staff) | AI could reasonably assist with pattern-flagging ("this learner has three unrelated incidents this term") but the escalation decision itself (is this a warning or a suspension) should remain fully human — a stronger case for "advisor only" than even Learning Support |
| **Pastoral** (general wellbeing, distinct from formal Guidance) | Class Teacher primarily, Year Coordinator secondarily | Ongoing, informal, day-to-day | Rarely formally recorded except where it escalates into a Guidance or Behaviour case | Low for day-to-day pastoral interaction, rising sharply once it becomes a formal case | Minimal AI role — this is the function most resistant to any automation, since its value is specifically the human relationship |
| **House Systems** | A House Master/Mistress, cutting across Class/Grade boundaries | Points/competition tracking, cross-grade pastoral grouping, sometimes a secondary pastoral-support channel alongside Class Teacher | A points/achievement record, low sensitivity | Low | No meaningful AI-boundary question — this function is administrative/motivational, not sensitive-data-bearing |

---

## Part 8 — Comparison Against EduNexus

Every row below cites the specific Sprint 6A–7B finding it draws on; no new repository investigation was performed for this Part.

| Organizational unit | Status in EduNexus | Evidence |
|---|---|---|
| **Principal / Headteacher** | **Mis-modeled** — a real enum value (`headteacher`) exists and is checked correctly by `lib/core/permissions.ts`, but is provably ungrantable in production (`updateSchoolUserRole` has zero callers anywhere in `app/`) | 6E Part 1/3, restated 7A Part 2 |
| **Deputy Principal** | **Mis-modeled**, more severely than Principal — `deputy_headteacher` collapses two real-world distinct titles (Deputy Principal Academics vs. Administration, per Part 2's research and the Reference School's own seed labels) into one enum value with zero distinguishing authority | 6E Part 4/7A Part 4 |
| **Dean of Studies / Director of Studies** | **Absent, mapped only to a seed-script label** | Reference School's "Dean of Studies" title → `school_admin`, no distinct authority — 6E Part 4 |
| **Academic Registrar** | **Absent as a distinct role**, though its functional territory (transcript/enrollment records-of-truth) partially overlaps with the never-populated Core `learners`/`learner_enrollments` schema | 6E Part 4, restated 7A Part 2 (Registrar/Admissions Officer both seed-only) |
| **Head of Department (HOD)** | **Absent, exhaustively re-confirmed** — zero `head_of_department`/`department_id` matches anywhere in the schema | 7A Part 2 |
| **Subject Head** | **Absent** — restated alongside HOD, since EduNexus does not distinguish the two even conceptually | 7A Part 2 |
| **Curriculum Coordinator** | **Absent as a role**; the functional territory (curriculum coherence) is instead served by the hardcoded `lib/curriculum/subjects.ts` catalogue — a code artifact standing in for a human coordinator's judgment | 6B, restated 7B Part 3 (Teaching vs. Curriculum boundary finding) |
| **Examinations Officer** | **Absent, mapped only to a seed-script label**; the closest functional analogue (`assessment_quality_flags`, a moderation-shaped table) is dormant with zero application-code references | 6C/6E, restated 7B Part 7 |
| **Academic Coordinator** | **Absent**, and its closest EduNexus analogue — "School Intelligence"/"Operational Intelligence" — was found to have no reachable consumer even if built | 6H Part 7, restated 7B Part 6 |
| **Year Coordinator** | **Absent entirely** — no cohort-level (as opposed to single-class) pastoral or academic view exists anywhere in this series' evidence | New comparison finding this session, not previously named by any prior sprint since no prior sprint researched this specific role |
| **Class Teacher** | **Fully modeled and fully exercised** — the one organizational role EduNexus's live product actually implements, correctly, as an ownership relationship over `teacher_classes` | 6D/6E/6G, restated throughout |
| **Subject Teacher** | **Absent as a distinct actor** — subject allocation is never persisted; a class teacher who happens to teach a subject is not the same as a real school's separately-appointed subject teacher for larger classes | 6D Workflow 5, restated 7A Part 2 |
| **Learning Support** | **Partially modeled, unnamed** — Adaptive Learning's grouping/differentiation function (restated 6E/6G/7B as the platform's cleanest AI/human boundary) covers part of this territory functionally, without an accommodation-record concept or a named human owner distinct from the class teacher |
| **Guidance & Counselling** | **Absent as a human domain; territory actively occupied by ungoverned AI** — this document's Part 7 research makes the strongest case yet in this series for why that is a structural problem, not merely a governance gap: a real Guidance function's defining characteristic (confidentiality-bound, human-judgment-only for anything sensitive) is categorically incompatible with Career Intelligence's current shape (autonomous, persisted, unreviewed) | 6G Part 3/9, 7A Part 2, sharpened by this sprint's Part 7 research |
| **Departments** (Languages, Sciences, Mathematics, Humanities, Creative Arts, Technical Subjects, ICT, Sports, Special Needs) | **Absent, exhaustively confirmed** — no table, no route, no permission tier; the moderation function departments typically own (Part 3 of this document) maps directly onto the dormant `assessment_quality_flags` table | 6C/6E/7A/7B |
| **Faculty** | **Absent, and per Part 4's research, correctly so for a typical Kenyan secondary school's scale** — this is one of the few gaps this document does not treat as urgent, since the real-world structure it would model rarely applies at this scale in the first place |
| **Learning Area** | **Present, one of four competing representations** — `sow_learning_areas`, restated 6B |
| **Subject** | **Present, four competing representations** | 6B, restated throughout |
| **Programme** | **Not applicable** — EduNexus targets CBC/8-4-4/IGCSE, not IB; per Part 4's research, this concept simply does not belong here |
| **Course** | **Not applicable in the CBC context** — restated with the same reasoning as Programme |
| **Stream** | **Genuinely unresolved open question** — restated 7B Part 4/7C Part 4: it is not established whether EduNexus's `Class` already functions as Stream or whether Stream is a wholly separate, unmodeled layer |
| **Grade** | **Present, three competing representations** | 6B, restated throughout |
| **Class** | **Present, two competing representations (`teacher_classes` vs. `classes`), the most-exercised object in the platform** | 6B/6D, restated throughout |
| **Assessment Moderation** | **Absent operationally, present as a dormant schema fragment** | 6C/6E/6G/7A/7B |
| **Report Card Principal Sign-off** | **Absent operationally, present as a dormant schema column** (`headteacher_comment`) | 6G Part 6, restated 7A Part 4 |
| **Promotion as a collective staff decision** | **Mis-modeled relative to real-school practice** — Part 6's research finds real promotion decisions are typically a collective, staff-meeting-ratified process, not a single-actor API call; EduNexus's dormant Promotion tables model it as the latter even in their unreached, aspirational form | New comparison finding this session |
| **Discipline (Suspension/Expulsion)** | **Absent, exhaustively confirmed, with no code form of any kind** | 7A Part 1/4 |
| **House System** | **Absent, exhaustively confirmed** | 6C/7A/7B |
| **Medical** | **Absent, exhaustively confirmed** | 7A Part 1 |
| **Finance/Fees** | **Absent, exhaustively confirmed** | 7A Part 1 |
| **KNEC/National Exam Integration** | **Absent as a live integration; present only as export-format labeling** | 7A Part 2, restated 7B Part 1 |

---

## Part 9 — Recommendations

**Not implementation — synthesis only, using Part 8's comparison as the sole evidentiary basis.**

**What EduNexus should adopt**:
- **The Deputy Principal Academics/Administration split, as a real distinguishing authority, not just a title collapsed into one enum value.** This is the single clearest structural mismatch this document found between EduNexus's own seed data (which already names the split) and its actual permission model (which does not honor it) — adopting a real split here is a natural next step precisely because the intent already exists in the codebase.
- **Assessment moderation as an activated, not dormant, capability.** Every school type researched in Parts 1–6 treats department-level or exam-board-level moderation as a near-universal, load-bearing governance function — `assessment_quality_flags`'s existence suggests EduNexus's own design already recognized this before this research confirmed how consistently real schools rely on it.
- **A genuine confidentiality tier for Guidance & Counselling records, distinct from ordinary academic-evidence confidentiality**, should any future Guidance domain be built — Part 7's research is unambiguous that this is not merely "sensitive data" in the way a mark is, but a categorically different confidentiality class in every school model researched.
- **Collective/multi-actor promotion decisions**, if Promotion is ever activated — Part 6's research finding that real promotion is typically staff-meeting-ratified, not single-actor, should directly inform any future design, rather than simply activating the existing single-actor API as-is.

**What EduNexus should ignore**:
- **Faculty, Programme, and Course as distinct concepts.** Part 4's research is explicit that these belong to school scales and curricular frameworks (large multi-department institutions, IB, Cambridge-course-variant structures) that do not match EduNexus's stated CBC/8-4-4/IGCSE Kenyan-secondary-school focus. Building these would be modeling a structure the target user base mostly does not have.
- **A fully elaborated Singapore-style formal streaming/banding committee process.** Interesting as a data-governance reference point (Part 1), but disproportionate to a 50-teacher pioneer pilot's actual current scale.

**What EduNexus should postpone**:
- **Departments as a full organizational unit** (with budget/resource ownership, Part 3) — the moderation function specifically is high-value and low-scope; the rest of what a Department "owns" (budget, resources, professional development scheduling) is lower-priority relative to this platform's current academic-core focus, and should wait until the moderation piece alone has proven valuable.
- **Year Coordinator.** A genuinely useful role per Part 2's research, but one this document found no urgent evidentiary pressure for beyond general good practice — unlike Guidance & Counselling, nothing in EduNexus's current architecture is being actively distorted by Year Coordinator's absence the way Career Intelligence is being distorted by Guidance's absence.
- **Medical and Finance domains**, notwithstanding their real-world importance (Part 1/7's research, restated 7A/7B's justification) — both require careful data-sensitivity and payment-integration design respectively that is disproportionate to add opportunistically alongside a Guidance/Moderation-focused near-term effort; they remain correctly placed in 7A/7B's Long-term tier.

**What should remain configurable, per school**:
- **Whether Departments are used at all**, since Part 1's research shows this varies by school size even within the same national system (formal Department vs. informal subject panel) — a rigid Department requirement would misfit smaller schools in EduNexus's own pilot cohort.
- **Whether Guidance & Counselling is a dedicated staffed role or an absorbed duty of the Deputy Principal/Class Teacher** — Part 2's research shows both models are legitimate depending on school size and resourcing; EduNexus should not assume the larger-school model is universal.
- **The Deputy Principal Academics/Administration split itself** — Part 1's research notes this split is more common in larger schools; a small school's single Deputy Principal should not be forced into an artificial two-role structure.
- **Whether Stream is a meaningful concept for a given school** — directly tied to this document's own unresolved open question (Part 4/8): a single-stream small school has no practical use for the concept at all, while a multi-stream school needs it as a first-class dimension.

---

## What This Document Does Not Do

Per its own scope: Parts 1–7 are research and reasoning, not repository evidence, and must not be cited in future architecture documents as if they were code-grounded findings — any future sprint drawing on this document's research should re-state that it is doing so, the same way this document has been explicit throughout. Part 9 recommends postponement, adoption, and configurability categories only — it does not design any schema, permission model, or workflow for anything it recommends adopting. No ADR is raised — this document surfaces no canonical-domain conflict; its findings are either restatements of already-established absences (Part 8, cited throughout) or external research with no code implication requiring ratification.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- **0** configuration changes
- Only this document and the implementation log entry were written.

## Stop Condition

STOP after this document. No implementation, schema, or migration performed. No code-level recommendation beyond the adopt/ignore/postpone/configurable categorization in Part 9. Any future work drawing on this research requires separate scoping and explicit approval.
