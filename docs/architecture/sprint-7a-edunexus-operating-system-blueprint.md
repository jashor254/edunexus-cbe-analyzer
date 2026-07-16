# Sprint 7A — Complete Educational Operating System Blueprint

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim is marked VERIFIED (confirmed by direct code/schema inspection this session, or restated unchanged from Sprints 6A–6H and cited back to them), LIKELY (strong indirect evidence, not exhaustively confirmed), UNKNOWN (flagged rather than guessed), or **[RESEARCH]** (Part 7 only — general educational-systems knowledge, not repository evidence, explicitly labeled per that Part's own instruction to compare against real schools rather than code).

**Builds on**: the full 6A–6H series (canonical structure, reconciliation, operating model, workflow model, organizational model, information flow model, decision & authority model, and the synthesized Operating System Blueprint). This sprint asks a new question none of the prior eight addressed: **what would EduNexus need to do to run a brand-new school from Day 1 to Graduation**, including domains (Fees, Medical, Transport, Boarding, House, Library, Discipline, Alumni, external Ministry/KNEC/KICD/County integration) never previously exhaustively searched for.

**New exhaustive searches performed this session** (case-insensitive, repository-wide, `app/`, `lib/`, `supabase/migrations/`, `types/`, excluding `node_modules`): fee/tuition/invoice, medical/health/allergy/immunization, transport/school-bus/route, boarding/dormitory/house-master/house-id, alumni, library/library-book, discipline-case/behavior-record/suspension/expulsion, certificate/transcript, KNEC/KICD/Ministry/county-officer/NEMIS, nurse/librarian/security-guard/storekeeper/kitchen-staff. Results integrated into Parts 1–4 below.

---

## Part 1 — Complete Learner Life Cycle

| Stage | Current implementation | Missing implementation | Dormant implementation | Duplicate implementation | Impossible implementation |
|---|---|---|---|---|---|
| **Prospective learner** | **VERIFIED absent** — no application, inquiry, waitlist, or "prospective" status of any kind found anywhere this session or in 6A–6H. A person becomes a learner the instant a teacher submits the admission form; there is no pre-admission state. | An application/inquiry stage, an admission decision distinct from the enrollment write | — | — | — |
| **Admission** | Single indivisible write by a class teacher, restated 6D Workflow 1 — `app/api/teacher/classes/[classId]/students/route.ts` | An admissions officer/registrar decision distinct from a teacher's classroom action (restated 6E) | Core's `app/api/core/learners/route.ts` — institutionally correct, zero UI caller (restated 6D/6E) | Legacy (`students`) vs. Core (`learners`) — restated Stage 0.5 | — |
| **Enrollment** | Same write as Admission — restated 6D | A distinct enrollment *decision* separate from admission | Core's `learner_enrollments` (restated 6B) | `class_students` (legacy) vs. `learner_enrollments` (Core) — restated 6B | — |
| **Fees** | **VERIFIED absent, exhaustively confirmed this session** — no `fee`/`tuition`/`invoice`-shaped table found anywhere in `supabase/migrations/*.sql`; the only payment-shaped table found repository-wide is `mpesa_payments`, which (per Sprint 6E's RLS research, `20260525_rls_policies.sql:156-164`) is scoped to the platform's own token/subscription billing (`user_id = auth.uid()`), not school-fee management | A fee structure, invoice, balance, or payment-plan concept of any kind for a learner's *school* fees (as opposed to a teacher's platform subscription) | — | — | Fee-linked admission/enrollment holds are **impossible** — there is no fee-status column on `students`/`learners` to gate anything against |
| **Medical** | **VERIFIED absent, exhaustively confirmed this session** — zero matches for medical/health/allergy/immunization anywhere in the repository | A medical record, allergy flag, emergency contact, or health-incident concept | — | — | A school nurse role cannot be modeled — no actor, no table |
| **Transport** | **VERIFIED absent, exhaustively confirmed this session** — the only "transport" hits are an unrelated career-catalogue entry (`lib/career/seedCareers.ts`) and an idempotency-key module name collision (`lib/idempotency/reserveKey.ts`) | Route assignment, bus tracking, transport fee linkage | — | — | — |
| **Boarding** | **VERIFIED absent, exhaustively confirmed this session** — every "boarding" hit repository-wide is a false-positive substring of "onboarding" (`markOnboardingComplete`, `has_seen_onboarding`, layout onboarding checks) | Any boarding-status concept | — | — | — |
| **House** | **VERIFIED absent, exhaustively confirmed this session** — zero real hits for `house_master`/`house_id`; restated from Sprint 6E's exhaustive School-Entity Gap Analysis (House System: VERIFIED absent) | Any house assignment/points/competition concept | — | — | — |
| **Class allocation** | Teacher self-service, `teacher_classes` — restated 6D Workflow 3 | Administrative class-assignment as a distinct decision from teacher self-creation | Core `classes` (restated 6B) | `teacher_classes` vs. `classes` | — |
| **Subject allocation** | Never persisted — implicit in content creation, restated 6D Workflow 5 | A persisted "Teacher X teaches Subject Y for Class Z" record | — | Four representations (Core `subjects`, legacy free text, `sow_learning_areas`, hardcoded catalogue) — restated 6B | — |
| **Assessment** | Full CRUD + self-publish, the platform's most-exercised workflow — restated 6D Workflow 7 | A second-reviewer/moderation step | `assessment_quality_flags` — restated 6C/6E, zero application-code references | — | — |
| **Evidence** | Confidence-tiered, DB-trigger-enforced state machine — the platform's strongest subsystem, restated 6D/6F/6G | — | — | — | — |
| **Promotion** | Two tables, zero live rows anywhere in this codebase's evidence, restated 6D Workflow 10/6G Part 10 | A recommending-vs-certifying actor split, a UI | Both `learner_promotions`/`student_promotions` | Two tables, unreconciled | — |
| **Career Guidance** | AI generates and persists directly, no human gate — restated 6E Part 7, 6G Part 3 | A confirm/reject step of the kind Evidence has | — | — | — |
| **Graduation** | `lib/core/promotions.ts:38-42` sets `learners.status='graduated'`, Core-only, unreachable — restated 6C/6D/6E | A UI, a certificate/transcript-issuance step | The Core graduation code path itself | — | **Structurally impossible in the legacy table** — `student_promotions.to_grade NOT NULL` (restated 6C) means the table every real learner's identity lives in cannot represent this event at all |
| **Alumni** | **VERIFIED absent, exhaustively confirmed this session** — zero matches anywhere in the repository | Any post-graduation record, contact-retention, or alumni-network concept | — | — | Structurally impossible to reach in practice, since Graduation itself is never reached (compounding the finding above) |
| **Archive** | **VERIFIED absent, exhaustively confirmed this session, restated from 6F Part 12/6G Part 10** — `learners.status='archived'` is a valid enum value with no code path anywhere in this repository's evidence (across all nine sprints in this series) that ever sets it | Any archival mechanism for any object audited in this entire series | — | — | — |

**New findings this session, not previously covered by 6A–6H**: Fees, Medical, Transport, Boarding, House, and Alumni are **all six VERIFIED absent**, exhaustively confirmed by repository-wide search rather than restated from a prior sprint's narrower entity search (Sprint 6C's School-Entity Gap Analysis covered House but not the other five). **The complete learner lifecycle a real Kenyan boarding or day secondary school would need has six entirely unmodeled stages sitting between Admission and Promotion** — none of them merely underused like Promotion/Graduation; all six have no schema, no route, no actor, and no seed-script fossil at all (contrast with Attendance, which at least left a fossil — `days_present`/`days_absent` on `school_report_cards`, per 6G Part 6 — these six leave none).

---

## Part 2 — Human Actors

For actors already fully covered by Sprint 6E's Part 1/Part 2, findings are restated with a citation, not re-derived. New actors (everything past Class/Subject Teacher in the sprint's list) are researched fresh this session.

| Actor | Decisions made | Information owned | Workflows begin with them | Workflows end with them | Modeled? |
|---|---|---|---|---|---|
| **Parent** | Guardian linking (self), WhatsApp opt-in, teacherless-child data entry (edge case) | Own linked learner's contact/notification prefs | Guardian linking, teacherless assessment entry | Alert consumption, report viewing | **Partially** — restated 6E Part 1, three non-communicating mechanisms |
| **Guardian** | Same as Parent, via Core's isolated `learner_guardians` | Same, Core-scoped | Same | Same | **Partially**, isolated variant |
| **Student** | Compass interaction, career search trigger, academy submissions | Own session content | Learning, self-directed career search | Own submission review (partial — Academy AI Judge, UNKNOWN per 6E Part 7) | **Fully**, for the surface that exists |
| **Teacher** | Admission, Class/Subject allocation (implicit), Assessment (full), Evidence confirm/reject | Class roster, assessment/mark data | Nearly every live workflow | Nearly every live workflow | **Fully** — the one actor this entire series found fully modeled and fully exercised |
| **Class Teacher** | Same as Teacher, ownership-scoped (`teacher_classes.teacher_id`) | Own class's data | — | — | **Fully**, but restated 6E Part 5: this is an ownership relationship, not a distinct role/permission |
| **Subject Teacher** | **VERIFIED does not exist as a distinct actor** — restated 6D/6E | — | — | — | **Not at all** |
| **Head of Department** | **VERIFIED absent, re-confirmed this session** — zero `head_of_department`/`department_id` matches anywhere in `supabase/migrations/*.sql` | — | — | — | **Not at all** — restated 6C/6E; Reference School's seed labels (`03-seed-staff.ts`) imply "Dean of Studies," none for HOD specifically |
| **Dean of Studies** | **VERIFIED present only as a seed-script title, mapped to `school_admin` with zero distinct authority** — restated 6E Part 4 | — | — | — | **Not at all**, beyond a fixture label |
| **Deputy Principal** | `deputy_headteacher` — real enum value, provably ungrantable in production (`updateSchoolUserRole` has zero callers) — restated 6E Part 1 | — | — | — | **Not at all**, in practice — schema-modeled only |
| **Principal / Head Teacher** | `headteacher` — same finding as Deputy Principal | — | — | — | **Not at all**, in practice |
| **Registrar** | **VERIFIED absent as a distinct role** — no route, table, or permission tier separates registration/records-office authority from `school_admin`'s generic tier; the closest analogue is the Reference School's "Admissions Officer" seed title, also mapped to `school_admin` | — | — | — | **Not at all** |
| **Admissions Officer** | Same finding as Registrar — a seed-script label only, restated 6E Part 4 | — | — | — | **Not at all** |
| **Finance Officer** | **VERIFIED absent as a distinct role, and absent as a domain** — a seed-script label mapped to `school_admin`, with (per Part 1 above) no fee/invoice domain for it to have authority over even in principle | — | — | — | **Not at all** |
| **Secretary** | Seed-script label only (`School Secretary` → `school_admin`), restated 6E Part 4 | — | — | — | **Not at all** |
| **Exam Officer** | Seed-script label only (`Examinations Officer` → `school_admin`); the closest functional analogue is the dormant `assessment_quality_flags` moderation table (restated 6C/6E) | — | — | — | **Not at all** |
| **ICT Officer** | Seed-script label only (`ICT Administrator` → `school_admin`), restated 6E Part 4 | — | — | — | **Not at all** |
| **School Nurse** | **VERIFIED absent, exhaustively confirmed this session** — zero matches for `nurse` anywhere in the repository, including career-catalogue seed data | — | — | — | **Not at all — no fossil of any kind, not even a seed label** |
| **Guidance & Counselling** | **VERIFIED absent as a formal role**, though its functional territory is partially covered by Career Intelligence (AI, restated 6E Part 7) and Compass (AI tutoring) — no human counsellor actor exists anywhere | — | — | — | **Not at all as a human actor; functionally substituted by ungoverned AI** (restated 6G Part 3's Career Intelligence governance-gap finding, now reframed as "this AI is standing in for a human role that has no other representation at all") |
| **Librarian** | **VERIFIED absent, exhaustively confirmed this session** — zero matches for `library_book`/librarian anywhere; unrelated hits are all a curriculum-content "verb library" module (`lib/sow/verbLibrary.ts`) | — | — | — | **Not at all** |
| **Games Teacher** | **VERIFIED absent as a distinct role**; "Creative Arts & Sports" exists only as a curriculum subject label (`app/api/teacher/reports/knec-export/route.ts:13`), not an actor | — | — | — | **Not at all** |
| **Boarding Master** | **VERIFIED absent, exhaustively confirmed this session** — no boarding domain exists for this role to have authority over (Part 1) | — | — | — | **Not at all** |
| **House Master** | **VERIFIED absent, exhaustively confirmed this session** — restated 6E's House System finding, extended to the actor level | — | — | — | **Not at all** |
| **Driver** | **VERIFIED absent** — no transport domain exists (Part 1) | — | — | — | **Not at all** |
| **Security** | **VERIFIED absent** — zero matches for a security/gate/visitor-log concept anywhere | — | — | — | **Not at all** |
| **Kitchen** | **VERIFIED absent** — zero matches for kitchen/meal/feeding-program concept | — | — | — | **Not at all** |
| **Storekeeper** | **VERIFIED absent** — zero matches for inventory/store/asset-tracking concept | — | — | — | **Not at all** |
| **Support Staff (general)** | **VERIFIED absent as a distinct category** — `SchoolUserRole`'s five values have no "support staff" tier at all | — | — | — | **Not at all** |
| **County Officer** | **VERIFIED absent** — zero matches for county-level education-office integration | — | — | — | **Not at all** |
| **Ministry (of Education)** | **VERIFIED absent as an integration** — `NEMIS` (the Ministry's National Education Management Information System) has zero matches anywhere; `nemis_code` exists as a single free-text column on `schools` (`20260629_core_foundation.sql`, confirmed via the Core schema fields cited across this series) — a place to *store* a NEMIS code, not an integration *with* NEMIS | The school's own `nemis_code` field, if ever populated | — | — | **Not at all as an integration; a storage field only** |
| **KNEC** | **VERIFIED: export-format labeling only, not an integration** — `app/api/teacher/reports/knec-export/route.ts` produces a CSV formatted to KNEC's CBC level-label conventions (`Below/Approaching/Meets/Exceeds Expectations`), confirmed this session by reading the route directly; there is no API call, credential, or data submission to any real KNEC system anywhere in the repository | The CSV export format, teacher-triggered, teacher-downloaded | — | — | **Not at all as a live integration; a compatible export format only** |
| **KICD** | **VERIFIED: curriculum content source, not an integration** — extensive references (`lib/cbcCurriculum.ts`, `lib/curriculum/`, `app/api/sow/kicd-context/route.ts`) are all reads of KICD's *published curriculum content*, statically encoded or fetched into EduNexus's own curriculum tables — not a live system-to-system integration with any KICD platform | Curriculum reference data (subjects, strands, sub-strands, learning outcomes) | SOW generation, lesson planning, career-subject matching | — | **Content is present; the institution (KICD-as-actor, e.g. curriculum revision notifications) is not modeled at all** |

**New findings this session, not previously covered by 6A–6H**: of the 30 actors this sprint asked about, **19 are entirely new territory** (School Nurse, Guidance & Counselling, Librarian, Games Teacher, Boarding Master, House Master, Driver, Security, Kitchen, Storekeeper, Support Staff, County Officer, Ministry, KNEC, KICD, plus formal confirmation of HOD/Registrar/Admissions Officer/Finance Officer/Secretary/Exam Officer/ICT Officer as *not even reaching seed-script-label status independently* — several of those six were already found as seed labels by 6E, restated not re-derived, but School Nurse/Librarian/Boarding Master/House Master/Driver/Security/Kitchen/Storekeeper have **zero repository presence of any kind, not even a fixture label** — a meaningfully deeper absence than the six Reference-School titles 6E found collapsed into `school_admin`. **Guidance & Counselling is the sprint's most consequential actor finding**: its functional territory is not merely unmodeled, it is actively occupied by an ungoverned AI system (Career Intelligence, restated 6G Part 3) with no human counsellor anywhere in the loop.

---

## Part 3 — Educational Objects

Restated from prior sprints where already inventoried (6A "Grade/Subject/Class" duplication census, 6F Part 1's full information inventory, 6E Part 4's entity gap analysis); new objects from this sprint's list are researched fresh.

| Object | Canonical source | Duplicates | Lifecycle | Owner | Consumers | Missing relationships |
|---|---|---|---|---|---|---|
| School | `schools` (Core only) | None | Create → indefinite, no archive (restated 6F Part 1) | Whoever calls `createSchool`, unreachable (restated 6E) | Every Core table | No link to Fees/Medical/Transport domains, since none exist |
| Campus | **VERIFIED absent** — no multi-campus concept found anywhere; `schools` has no `parent_school_id`/`campus_id` shape | — | — | — | — | A school with multiple physical sites cannot be represented |
| Department | **VERIFIED absent, re-confirmed this session** | — | — | — | — | — |
| Faculty | **VERIFIED absent** — restated 6E | — | — | — | — | — |
| Grade | 3 representations (Core `grades`, legacy int, `sow_grades`) — restated 6B | True duplication | No single lifecycle | Varies | SOW, Report Card boundaries, Career gating | No canonical resolution |
| Stream | **UNKNOWN, not independently traced beyond Grade/Class in 6B** — restated as an open question, not newly resolved this session | — | — | — | — | — |
| House | **VERIFIED absent** — restated 6C/6E, extended Part 1 above | — | — | — | — | — |
| Dormitory | **VERIFIED absent, exhaustively confirmed this session** | — | — | — | — | — |
| Class | `teacher_classes` (de facto) / `classes` (Core, isolated) — restated 6B | True duplication (34-vs-1 file usage) | Create → indefinite | Teacher (self-service) / admin-tier (Core) | Assessment, Enrollment, Report Cards | No canonical resolution |
| Subject | 4 representations — restated 6B | True duplication | No single lifecycle | Varies | SOW, Assessment, Career matching | No canonical resolution |
| Learning Area | `sow_learning_areas` — one of Subject's four representations, restated 6B | Same as Subject | — | Curriculum module | SOW | Same as Subject |
| Teacher | `teachers.id` — ADR-0002 ratified canonical | **None — the one fully resolved identity in this series** | Self-signup → active indefinitely, no offboarding path found (restated 6F Part 1) | Self | Nearly every module | No deactivation/offboarding workflow |
| Student | `students` (de facto, 499 rows) / `learners` (Core, 405 rows, isolated) — restated Stage 0.5 | True duplication, the series' root-cause finding | Create → rarely withdraw/transfer/graduate, mostly incomplete (restated 6D/6F) | Teacher/school-staff | Nearly every module | Fees, Medical, Transport, Boarding, House — all absent, so no relationship to model in the first place |
| Guardian | Three tables (`students.parent_user_id`, `class_students.parent_id`, `learner_guardians`) — restated 6D/6E/6F | True duplication | Create (redemption) → indefinite, no unlink path found | Parent (self) | Alerts, Report Card (mine), Notifications | No reconciliation between the three |
| Assessment | `class_assessments` — single physical table | None found at the table level (the *type* mapping has known duplication per memory, not re-verified this session) | Create → mark → publish → consumed | Teacher (or admin-tier, unreachable) | Evidence, both Report Card pipelines | No second-reviewer relationship |
| Assignment | Separate from Assessment — `assignments`/`assignment_submissions` (confirmed present via Sprint 6E's teacher-route table-inventory research: `app/api/teacher/**` writes to `assignments`, `assignment_submissions`) | Not investigated for duplication this session — flagged UNKNOWN | UNKNOWN beyond create/mark, not re-traced | Teacher | Student, Parent (notification) | UNKNOWN whether Assignment evidence flows into the same `learner_evidence` pipeline as Assessment — not verified this session |
| Lesson | `scheme_lessons`/lesson-plan-shaped tables (restated 6D/6F, SOW domain) | Not independently duplicated | Generate (AI-assisted) → teacher use | Teacher | Teaching | — |
| Scheme (of Work) | `schemes_of_work` | Not independently duplicated | Generate → teacher review → use | Teacher | Lesson delivery, Record of Work | — |
| Record of Work | `records_of_work`/`row_entries` | Not independently duplicated | Auto-generated from lesson plans (cron: `generate-record-of-work`, restated 6E Part 8) or manual | Teacher/System | Compliance/reporting | — |
| Report Card | Two independent pipelines (Core `school_report_cards`/`term_subject_summaries`, zero production rows; legacy AI report off `assessments`, the only live one) — restated Stage 0.5/6F | **Duplicate concept, not duplicate code** (restated 6F Part 6) | Generate → publish (Core) / generate-only, unclear gate (legacy) | Admin-tier (Core) / AI generator (legacy) | Parent Portal | Report↔Promotion (restated 6F Part 3: does not flow at all) |
| Attendance | **VERIFIED absent as a domain, with a schema fossil** — `school_report_cards.days_present`/`days_absent` exist with zero producing workflow (restated 6G Part 6) | N/A — the fossil itself is not duplicated | N/A | N/A | N/A | The report card *references* attendance data that nothing ever produces |
| Timetable | **VERIFIED absent** — restated 6C/6D/6E | — | — | — | — | Teaching/Class/Subject have no time-slot dimension at all |
| Behavior Record | **VERIFIED absent, exhaustively confirmed this session** — restated 6C's finding that the only near-misses (`learner_projections`' `'behaviour'` category enum value, `learner_profiles.learning_behaviour`) are learning-style descriptors, not incident records | — | — | — | — | — |
| Medical Record | **VERIFIED absent, exhaustively confirmed this session** | — | — | — | — | — |
| Fee Invoice | **VERIFIED absent, exhaustively confirmed this session** | — | — | — | — | — |
| Payment | `mpesa_payments` exists, but scoped to platform subscription/token billing, not school fees (restated 6E Part 1's RLS research) | Not a duplicate of a school-fee Payment object — there is no school-fee Payment object to duplicate | Create (webhook) → indefinite | Webhook/service-role | Subscription/token balance | No link to any school-fee concept, since none exists |
| Library Book | **VERIFIED absent, exhaustively confirmed this session** | — | — | — | — | — |
| Discipline Case | **VERIFIED absent, exhaustively confirmed this session** | — | — | — | — | — |
| Career Profile | `careers`/`career_matches` — restated 6F Part 1/6G | Not duplicated at the table level | Generate (AI) → persist immediately → served, no review (restated 6E/6F/6G) | AI | Student, Parent | No trust/confidence marker (restated 6G Part 9) |
| Projection | `learner_projections` — restated 6F Part 1 | Not duplicated (a V2 orphaned variant was found and its persistence stopped, per memory) | Recompute-on-demand, cached | System (`recomputeLearnerProjection`) | Career, Blueprint, Holiday Planner, Monday Panel/Parent Pulse | No history/versioning table found |
| Evidence | `learner_evidence` — restated extensively | Not duplicated (anchored consistently to `students.id`) | Full lifecycle, the series' best-modeled object | Teacher / system account | Projection exclusively | None found — the one object with no missing-relationship finding anywhere in this series |
| Recommendation | No single object — fragmented across Career/Blueprint/Holiday/Monday-Panel (restated 6F Part 1/3) | By definition, fragmented rather than duplicated | Varies per domain | Varies | Varies | No cross-recommendation relationship exists (restated 6F Part 11) |
| Certificate | **VERIFIED present only for the Academy (teacher continuing-education) feature** — `app/teacher/academy/certificate/`, confirmed this session; **VERIFIED absent for any student/learner academic certificate (a CBC/8-4-4/IGCSE completion certificate)** | Not applicable to the absent student-certificate concept | Academy: complete modules → certificate issued | Student-as-learner (the Academy's "student" is actually the teacher, in continuing-ed context) | The teacher themself | No relationship to the learner Graduation event at all — these are two entirely separate uses of "certificate" in the same codebase |
| Transcript | **VERIFIED absent for learners, exhaustively confirmed this session** — the only "transcript" hits are the same Academy certificate feature | — | — | — | — | — |
| Graduation Record | The Core `learners.status='graduated'` + `graduation_date` write, restated 6C/6D/6E | Not duplicated (only one representation, since the legacy table cannot represent it at all) | Never actually executed in production (restated 6D/6G) | Nobody, in practice | Nobody, in practice | No downstream Certificate/Transcript/Alumni relationship exists, compounding — even if Graduation fired, nothing would consume it |
| Archive | **VERIFIED absent for every object in this series** — restated 6F Part 12/6G Part 10, re-confirmed for the new objects investigated this session (none of Fees/Medical/Transport/Boarding/House/Library/Discipline/Alumni have an archive concept, because none of them exist to be archived in the first place) | — | — | — | — | — |

**New findings this session**: of the 30 objects this sprint asked about, roughly half were already inventoried by 6A–6H and are restated here; the other half (Campus, Faculty, House, Dormitory, Attendance, Timetable, Behavior Record, Medical Record, Fee Invoice, Library Book, Discipline Case, Certificate, Transcript) are **newly, exhaustively confirmed absent or narrowly-present-for-a-different-purpose** (Certificate exists, but only for the Academy teacher-training feature — a genuine naming collision worth flagging distinctly, since a future "student certificate" feature could easily be confused with, or accidentally reuse, this unrelated existing table).

---

## Part 4 — Decisions

Restated extensively from Sprint 6G's Decision Inventory (Part 1) and Decision Responsibility Matrix — not re-derived. New decisions from this sprint's list (departments, streams, houses) are researched fresh.

| Decision | Decision owner (evidence) | Approval chain | Audit history | Missing traceability |
|---|---|---|---|---|
| Who admits? | Class teacher, single write | None | `created_at`/`teacher_id` only | No `admitted_by`-shaped record beyond the row's own attribution — restated 6G Decision Responsibility Matrix |
| Who promotes? | Nobody, in practice (restated 6G Part 10) | Nominally admin/teacher-gated | `processed_by`+`reason` exist on the tables, never populated by a real event | The decision has never fired, so "audit history" is moot |
| Who graduates? | Nobody, in practice | Same as Promotion | Same | Same, plus structurally impossible in the legacy table |
| Who withdraws? | School-admin-tier, Core only, API-reachable, no UI (restated 6D Workflow 12) | Admin-gate only, no second party | Minimal — updates enrollment only | No actor/reason column confirmed for the withdrawal action itself (restated 6G Decision Responsibility Matrix) |
| **Who suspends?** | **VERIFIED absent, exhaustively confirmed this session** — no discipline domain exists (Part 3) for this decision to belong to | — | — | The decision has no home at all |
| **Who expels?** | **VERIFIED absent**, same finding as Suspension | — | — | Same |
| Who publishes reports? | Admin-tier only (`canPublishReport`), deliberately narrower than assessment-publish, unreachable in production; the legacy live pipeline has **no distinct publish gate found** (restated 6G Part 5/6) | Single-actor | `is_published`/`published_at`, no `published_by` (restated 6G Part 9) | Who published a given report is unrecoverable from the schema |
| Who edits reports? | UNKNOWN whether post-publish edits are possible at all — flagged, not re-verified this session (restated 6G Part 5) | — | — | — |
| Who approves AI? | **Nobody, for Career Intelligence** (restated 6G Part 3/7) — the platform's one AI decision with no approval concept at all. For every other AI subsystem (Evidence extraction, Adaptive Learning, Holiday/Remedial Planning), a teacher approves before the output takes effect. | Teacher (all except Career Intelligence) | Full (Evidence) to none (Career) | Career Intelligence has zero trust/confidence/reviewer column (restated 6G Part 9) |
| Who approves career recommendations? | **Nobody** — restated above, the same finding | — | — | — |
| Who creates assessments? | Class teacher (or admin-tier, unreachable) | None | `teacher_id` attribution | — |
| Who creates subjects? | **No single answer** — four independently-maintained representations (Core admin route, legacy free text entered ad hoc, curriculum-module data, a hardcoded source file only a developer can change) — restated 6B | None — each representation is authored independently | Varies, mostly absent | No cross-representation traceability at all |
| **Who creates departments?** | **Nobody — the decision has no home**, since Departments are VERIFIED absent (restated 6C/6E, re-confirmed this session) | — | — | — |
| Who creates classes? | Teacher (self-service, legacy) / admin-tier (Core, unreachable) | None | `created_at` only | — |
| Who assigns teachers? | Self-assignment — a teacher who creates a class becomes its teacher; no administrative appointment exists (restated 6D Workflow 4) | None — there is no appointing party | N/A | The concept of "assigning" a teacher (as opposed to a teacher self-selecting) is absent |
| Who assigns students? | Same actor/action as Admission (restated 6D) | None | Same as Admission | — |
| **Who assigns streams?** | **UNKNOWN** — Stream was not independently traced by 6B beyond noting it alongside Grade/Class; not resolved this session either, flagged as a genuine open question rather than guessed | — | — | — |
| **Who assigns houses?** | **Nobody — the decision has no home**, since House is VERIFIED absent | — | — | — |

**New findings this session**: Suspension, Expulsion, Department-creation, and House-assignment are decisions with **no home anywhere in the codebase** — not merely unreachable like Promotion (which at least has a table, a route, and gated permission logic that has simply never fired), but entirely absent at every level (no table, no route, no permission check, no seed-script fossil). This is a *stronger* absence than anything Sprint 6G's Decision Inventory previously catalogued, because 6G's inventory was scoped to decisions that exist in some code form; this sprint's exhaustive search found several real-school decisions with zero code form of any kind.

---

## Part 5 — Information Flow (Repository Information Graph)

**[Restated in full from Sprint 6F, extended with this sprint's six newly-confirmed-absent domains]**

Where information originates: Admission (teacher write), Assessment (teacher write/CSV upload), Compass sessions (student+AI interaction) — restated 6F Part 1/2. **This session confirms no information originates from Fees, Medical, Transport, Boarding, House, Alumni, Library, or Discipline, because none of these domains produce any data anywhere in the repository** — they are not merely low-volume, they are non-existent sources.

Where it is transformed: Marks → Term Average → Ranking (Core Report Card pipeline only, dormant); Evidence → Projection (the platform's one validated transformation chain) — restated 6F Part 2/6.

Where intelligence is produced: `lib/projection/`, `lib/career/`, `lib/adaptiveLearning/`, Learning Compass — restated 6F Part 1, 6G Part 3.

Where intelligence is consumed: Student/Parent (Career Intelligence, unreviewed), Teacher (Adaptive Learning, Holiday/Remedial Planning, reviewed) — restated 6F Part 5, 6G Part 7.

Where information terminates (dead ends): the platform event bus (`registerEventHandler` has zero callers, `publishEvent` calls from 15+ modules write to a permanently-unread `platform_events` table) — the largest confirmed dead end in the series, restated 6F Part 7. Promotion/Graduation tables (zero live rows). `assessment_quality_flags` (zero application-code references).

Where it is archived: **nowhere, for any object, confirmed across this entire nine-sprint series** — restated 6F Part 12/6G Part 10, and re-confirmed this session for the newly-investigated absent domains (there being nothing to archive, this is a vacuous but consistent extension of the same finding).

Where it is duplicated: Learner (2 tables), Class (2 tables), Grade (3), Subject (4), Enrollment (2), Promotion (2), Guardian (3), Report summaries (2 independently-computed) — restated 6F Part 9.

Where information disappears entirely (**new framing this session, distinct from "terminates"**): information about a learner's fee status, medical needs, transport arrangements, boarding/house assignment, library usage, and disciplinary history **does not disappear after being captured — it is never captured at all.** This is a stronger and different finding than 6F Part 7's "dead ends" (which are about captured-but-unread information); this sprint's contribution is that an entire category of real-school information — everything outside the academic/evidence core — has no capture mechanism to even produce a dead end from.

---

## Part 6 — Educational Intelligence Audit

**[Restated in full from Sprint 6E Part 7 and 6G Part 3, reorganized per this sprint's specific input/output/consumer/trust/approval/storage/lifecycle framing; no new AI code investigation was performed this session — all findings below are prior-sprint citations]**

| System | Input | Output | Consumers | Trust | Human approval | Storage | Lifecycle |
|---|---|---|---|---|---|---|---|
| **Learning Compass** (chat) | Student message, session history | AI tutoring text, streamed live | Student (direct, unreviewed) | None modeled | **No** | `compass_messages` | Create (session) → messages → end; no archive |
| **Learning Compass** (evidence extraction) | Same session content | Evidence claims | Teacher (review), then Projection | Confidence score, trust-tier capped | **Yes**, for mastery claims | `learner_evidence` | Full lifecycle (confirm/reject/retract), immutable once confirmed |
| **Projection** | Confirmed Evidence only | `learner_projections` | Career, Blueprint, Holiday Planner, Monday Panel/Parent Pulse | Inherits Evidence's trust tiering | N/A (pure computation) | `learner_projections` | Recompute-on-demand, cached, no history/versioning found |
| **Evidence** (lifecycle system itself) | Teacher marking, Compass extraction | `review_status`, `verification_state` | Projection exclusively | Full — `trust_tier`, `evidence_confidence`, frozen snapshot | **Yes**, DB-trigger-enforced | `learner_evidence` | The series' most complete lifecycle |
| **Career Intelligence** | Confirmed Evidence via Projection/capability extraction | Career matches, narrative report — **persisted directly** | Student, Parent | **None modeled — no trust/confidence column found on `career_matches`/`careers`** | **No** | `careers`/`career_matches` | Generate → persist → serve; regeneration behavior UNKNOWN |
| **Academic Clinic** | Assessment data | Deterministic report backbone | Career Intelligence (as an input layer), Teacher/Parent (as a report) | N/A — no AI in this pipeline | N/A | `student_clinic_reports` | Generate on demand |
| **Adaptive Learning** | Class roster/assessment data | Grouping proposals | Teacher | N/A — no AI call found in the grouping logic itself | **Yes**, explicit draft/approve endpoint | `class_differentiation_plans` | Draft → teacher-approve/adjust → publish |
| **Recommendations (Holiday/Remedial)** | Projection | Draft plans | Teacher (approve), Student (consume) | None modeled distinctly from the plan's own publish flag | **Yes**, with a 3-day auto-publish timeout fallback (Holiday only) | `holiday_plans` | Draft → approve or timeout → publish |
| **School Intelligence** | **In theory: Organization/Workflow-layer data** | `app/api/school/**` (strand health, intervention efficacy) | School-admin-tier — **but this actor cannot be populated in production** (restated 6E/6G) | N/A | N/A | Read-only, no persistence of its own findings beyond source tables | **No reachable consumer — restated 6H Part 7** |
| **Teacher Intelligence** | **Merely implied** — no single cross-class synthesis surface exists distinct from the per-feature generators (Lesson Plan/SOW/Remedial/Differentiation) | Fragmented, per-tool | Teacher | N/A | Varies per tool | Varies per tool | No unified lifecycle — restated 6H Part 7 |
| **Parent Intelligence** | Career Intelligence + Compass activity summaries | Read-throughs of Learning/Career Intelligence's own output | Parent | Inherits Career Intelligence's weak trust model | Inherits Career Intelligence's lack of approval | No independent storage — restated 6H Part 7 | No independent lifecycle |
| **Operational Intelligence** | **VERIFIED does not exist, not even implied** — restated 6H Part 7; and this session's Part 1/2/3 findings (Fees, Medical, Transport, Boarding, House all absent) confirm there would currently be **no institutional data of this kind for it to compute over even if built** | — | — | — | — | — | — |

**New finding this session**: 6H Part 7 already concluded School/Administrative/Operational Intelligence "cannot currently be built usefully" because their consumer (an admin-tier actor) cannot be populated. This sprint's Part 1–3 research adds a second, independent reason for the same conclusion: **even their *input* data (Fees, Medical, Transport, Boarding, House, Discipline) does not exist either** — the gap is not merely "nobody would read this Intelligence," it is "there is currently nothing for this Intelligence to be computed from."

---

## Part 7 — Comparison Against Real Schools **[RESEARCH — general educational-systems knowledge, not repository evidence]**

*This Part is explicitly research/reasoning, per the sprint's own instruction ("Research—not code"). It should not be read as a repository finding — it is included to give the blueprint's later parts (8–10) an external reference point, and is clearly labeled as such throughout.*

**Workflow comparison**: a typical Kenyan CBC secondary school (day or boarding) runs on a workflow chain this repository partially, then almost entirely, fails to model: Application → Admission Interview/Placement Test (where used) → Fee Payment (often a hard admission gate) → Medical Form → Uniform/Boarding Allocation → Class/Stream Placement → Subject Selection (especially at Senior School, where CBC's pathway system — STEM/Social Sciences/Arts & Sports — requires a genuine, consequential choice) → Term-by-term Teaching/Assessment → **End-of-Term Reporting with Principal sign-off** → **Discipline handled through a graduated system (warning → guidance & counselling → suspension → Board of Management-level expulsion, per Kenya's Basic Education Act)** → Promotion (usually automatic within a cycle, gated at cycle boundaries — e.g., Grade 9 to Grade 10 is a genuine national transition point under CBC, not a routine internal promotion) → Graduation with a certificate and school-leaving record → informal Alumni relationship. EduNexus's live, working chain (Admission→Assessment→Evidence→Projection→Reports) covers the *middle* of this chain well and has no modeled equivalent for the fee gate, medical/boarding intake, the CBC pathway-selection decision at Senior School, the discipline escalation ladder, or the Grade-9-to-10 national transition's distinct significance.

**Organizational comparison**: a real Kenyan secondary school's authority structure is genuinely layered — Board of Management (governance), Principal (chief executive authority, including expulsion), Deputy Principal Academics / Deputy Principal Administration (a real split this repository's seed data names but its permission model does not distinguish, per Part 2 above), Heads of Department (subject-cluster authority, entirely absent here), class teachers (pastoral + administrative, closest to what EduNexus models), subject teachers (instructional only, not separately modeled here), and a Guidance & Counselling department mandated by the Ministry for every registered secondary school — the one gap this document flags most strongly, since its territory is currently filled by an ungoverned AI system rather than left simply empty.

**International comparisons, briefly**: Cambridge/IB-affiliated schools in Kenya layer an *additional* compliance and moderation structure on top of the national one (internal moderation before external exam-board submission, coordinator roles per subject group) — a heavier version of the Exam Officer/moderation gap this document already found dormant (`assessment_quality_flags`). The Finnish model's most relevant contrast is philosophical, not structural: significantly less standardized testing and more teacher-held, low-stakes formative assessment — closer in spirit to EduNexus's Evidence-first design than to a rigid report-card cycle, worth noting as the one place this repository's actual architecture (not just its unbuilt schema) already resembles a specific international model's philosophy. Singapore's model is notable for its structured, data-driven streaming and pathway decisions — CBC's Senior School pathway split is Kenya's closest analogue, and it is precisely the decision point (Part 1's "Subject allocation," never a real institutional decision in this codebase) that Singapore's system treats with the most institutional weight.

**Educational philosophy comparison**: EduNexus's actually-built core (Evidence requiring confirmation, corrections-as-new-rows rather than edits, confidence-tiered trust) is philosophically closer to a *formative, evidence-based* assessment culture than to a *summative, gatekeeping* one — this is a genuine strength, not a gap, and it is consistent with CBC's own stated philosophy (competency-based, not purely exam-based). The gap this comparison surfaces most sharply is not that EduNexus's philosophy is wrong, but that it is **only implemented for the academic core** — the same evidence-and-confirmation discipline that governs a mastery claim does not extend to a career recommendation, a promotion decision, or (because it does not exist) a discipline case.

---

## Part 8 — Where EduNexus Could Become Better Than a Traditional LMS

**[SYNTHESIS — reasoning from the repository evidence gathered across all nine sprints in this series, not a new investigation]**

- **Evidence-gated reporting, if the two Report Card pipelines were reconciled** (6F Part 2/6): a report card computed from confirmed, trust-tiered Evidence and Projection — rather than raw marks, as today's live pipeline does — would be a genuine structural improvement over a traditional LMS's report generator, which typically has no equivalent confidence layer at all. The dormant Core pipeline (ranking, term-averaging, `lib/ranking`) is most of the way there already.
- **Extending Evidence's confirm/reject discipline to Career Intelligence** (6G Part 3/9): would turn the platform's weakest-governed AI decision into an example of exactly the pattern (AI proposes, human confirms, correction-by-superseding-row, full traceability) that a traditional LMS's bolted-on "AI features" almost never have.
- **Knowledge-graph-driven prerequisite awareness** (per memory context: the Lean Intelligence Layer's prerequisite engine on `knowledge_nodes`/`knowledge_edges` for Grade 7 Maths) — if extended beyond its current narrow scope, this is a genuinely different capability from what a traditional LMS content library offers: not just "here is the next lesson" but "here is what this learner has and has not demonstrated mastery of, and what that implies is learnable next."
- **The Adaptive Learning draft/approve pattern, generalized**: 6G Part 3 already identified this as the cleanest AI/human boundary in the platform. Applying the same pattern to School/Administrative/Operational Intelligence (Part 6, this document) — once Organization/Workflow populate real admin-tier actors and real institutional data — would let EduNexus offer school-leadership decision support (e.g., "these three classes show a consistent evidence-confidence drop this term") in a way a traditional SIS's static dashboards do not.
- **Automation of the End-of-Term hand-off** (6D Workflow 15): the orchestration already exists, correctly sequenced and lock-gated — activating it (UI + reachable admin actor) would give EduNexus a genuinely automated Administration↔Academics hand-off, which most real schools currently do manually and most traditional school software does not automate at all.

**What this Part deliberately does not do**: propose which of these to build, in what order, or with what design — that is Part 9/10's and any future implementation sprint's job, not this synthesis.

---

## Part 9 — Ten Core Design Principles

Extracted from the combined evidence of all nine sprints in this series (6A–6H plus this sprint), each grounded in a specific repeated finding rather than asserted abstractly:

1. **Evidence before assertion.** No claim about a learner enters the system as fact until it is confirmed — by a human, or by a system rule operating within a documented trust tier. *Grounded in*: `learner_evidence`'s lifecycle, the one place this principle is fully, verifiably real (6D/6F/6G).
2. **AI proposes; a human with educational authority disposes.** Every AI output that can affect a real decision about a real learner must pass through an approval gate before it takes effect — no exceptions carved out for convenience. *Grounded in*: the sharp, repeated contrast between Adaptive Learning/Holiday Planner (compliant) and Career Intelligence (the one violation found, 6G Part 3) — this principle is not aspirational, it is the platform's own demonstrated norm with one gap.
3. **Corrections are new facts, never rewritten history.** A wrong claim is superseded by a new, better claim — the old one remains legible. *Grounded in*: `supersedes`/`superseded_by`, DB-trigger-enforced immutability (6D/6G).
4. **One canonical table per real-world entity, reached before a second is built.** Every duplication this series found (Learner, Class, Grade, Subject, Enrollment, Promotion, Guardian) exists because a second, "more correct" table was added without first reconciling or retiring the first. *Grounded in*: the consistent shape of every duplication finding across 6A/6B/6F/6G — always additive, never resolved.
5. **A decision is not real until it has a reachable actor and a reachable UI.** Code that is correctly gated to an unpopulated role is not a working decision — it is a specification. *Grounded in*: the Organization layer's admin-tier inertness (6E), and this sprint's finding that several real-school decisions (Suspension, House assignment) have no code form at all, which is a different failure from having code nobody can reach.
6. **Routes are thin; `lib/` holds the logic; repositories hold the queries.** *Grounded in*: 6E Part 8's exhaustive boundary-violation search finding zero cases of a route containing business logic that belonged elsewhere, and every `lib/core/*.ts` module this series read directly delegating to `repos.*`.
7. **Teacher authority is the platform's real, if unstated, governing philosophy — design for it explicitly rather than assuming Administration will absorb the gap.** *Grounded in*: 6D/6E/6G's independent, repeated confirmation that every production-executing decision is a teacher's, by elimination rather than by design intent.
8. **Identity and authorization are separate concerns, resolved in that order.** *Grounded in*: `lib/core/identity.ts` vs. `lib/core/permissions.ts`'s explicit, working separation, built specifically to prevent a documented prior failure mode (Stage 0's copy-pasted authorization gaps).
9. **A workflow is not complete until it has a persisted, visible transition state — not merely a call chain that happens to execute in order.** *Grounded in*: the contrast between Evidence's real state machine and Promotion/End-of-Term's "correct code, no persisted intermediate state, no visibility" shape (6D Executive Summary, 6G Part 10).
10. **What is not modeled cannot be protected, decided, reported on, or made intelligent — absence is a design decision with consequences, not a neutral default.** *Grounded in*: this sprint's central finding — Fees, Medical, Transport, Boarding, House, Discipline, and Guidance & Counselling are not merely "not yet built," their absence means EduNexus currently has no way to represent, gate, or reason about an entire category of real-school responsibility, including one (Guidance & Counselling) whose territory is instead being filled by an AI system with none of this document's other nine principles applied to it.

---

## Part 10 — The EduNexus Operating System Blueprint

*A blueprint, not an implementation plan — answering "if a team of 100 engineers joined tomorrow, what exactly are we building," using only what this nine-sprint series has established as evidence.*

### Vision
EduNexus is, per 6H Part 13's verdict (restated as this blueprint's starting premise), **a Learning Intelligence Platform with the schema-level foundation of a School Operating System already laid, but not yet activated.** The vision this blueprint describes is the activation of that foundation — not a rewrite, and not a new product — governed throughout by Part 9's ten principles, most importantly Principle 1 (Evidence before assertion) and Principle 2 (AI proposes, human disposes), which are already real and working for the Academic/Evidence core and need to be *extended*, not invented, to every other domain this document found missing.

### Architecture
Seven layers, per 6H Part 1/12: Identity → Organization → Academic Structure → Workflow → Information → Decisions → Intelligence → Presentation → Integration. This sprint's contribution is naming the domains (Fees, Medical, Transport, Boarding, House, Discipline, Alumni) that would need to be added as new *Academic-Structure-adjacent* object families, each requiring its own pass through every layer above it — a new object family is not complete until it has an Organization-layer owner, a Workflow-layer process, an Information-layer flow, a Decision-layer authority, and (only where Part 9's principles justify it) an Intelligence-layer computation.

### Actors
Part 2's full table is this blueprint's actor registry. The one immediately actionable structural observation: **the Reference School's nine seed-script titles (6E Part 4) are not fictional — they are the closest thing this repository has to a target org chart**, and any future Organization-layer work should treat that seed data as a design input, not merely a test fixture.

### Workflows
6D's full workflow model, extended by this sprint's confirmation that Suspension/Expulsion/Department-creation/House-assignment have no workflow to extend at all — these would be net-new, not activations of dormant code (a materially different, larger scope of work than, say, activating the existing End-of-Term orchestration).

### Educational Philosophy
Formative, evidence-based, competency-oriented — genuinely aligned with CBC's own stated philosophy (Part 7 **[RESEARCH]**), and genuinely implemented for the academic core. The blueprint's central philosophical commitment, restated from Principle 1/2: this philosophy is not a marketing description, it is an architectural constraint every new domain must satisfy before it ships.

### System Boundaries
EduNexus is a **school-of-record and learning-intelligence system**, not (today, per Part 1/3's exhaustive findings) a finance system, a health-records system, a transport-logistics system, or a facilities-management system. Whether it should become any of those is explicitly outside this document's evidence-only mandate — this blueprint records only that it currently is not, and that the six absent domains this sprint found are the boundary line as it stands today.

### Future Expansion
Directly bounded by Part 1/2/3's absence findings: Fees, Medical, Transport, Boarding/House, Library, Discipline, Alumni, and a genuine Guidance & Counselling function (human-led, not AI-substituted, per Principle 10) are the concrete expansion surface this series has evidence for — not a speculative list, but the specific gap this document's exhaustive search actually found.

### Operating Principles
Part 9's ten principles, in full.

### AI Principles
Principle 2, specifically: every future AI capability must be checked against Sprint 6G's Decision Responsibility Matrix before it ships, and must not repeat Career Intelligence's shape (autonomous, unreviewed, untraceable) — restated here as the blueprint's single most concrete, immediately-checkable AI governance rule.

### Human Authority Principles
Principle 7: design explicitly for teacher authority as the platform's real center of gravity, while building the Organization layer's admin-tier and the new absent-domain actors (Part 2) as *genuine, reachable* authorities from day one — not as schema-complete, UI-absent placeholders repeating the pattern this entire series found in every institutional domain audited.

### Implementation Phases
This blueprint does not sequence implementation — 6H Part 9 already produced an evidence-grounded priority grouping (Immediate/Near-term/Medium-term/Long-term) from the 6A–6H series, and this sprint's new findings (Fees/Medical/Transport/Boarding/House/Alumni/Discipline/Guidance & Counselling, all VERIFIED absent with zero code fossil) belong in that same document's **Long-term** tier, alongside Attendance/Timetable/Departments/ERP — confirmed, not newly proposed, additions to an already-produced roadmap. This document deliberately does not re-sequence or re-prioritize that roadmap; it only supplies the additional evidence Sprint 6H did not yet have.

---

## What This Document Does Not Do

Per its own scope: it performs no new implementation, schema design, or migration. It does not design a Fee/Medical/Transport/Boarding/Discipline data model, a Guidance & Counselling workflow, or an org-chart implementation for the Reference School's nine titles. Part 7's real-school comparison is explicitly research/reasoning, not repository evidence, and is not to be cited elsewhere in this series as if it were a code-grounded finding. No ADR is raised — every finding in this sprint extends an already-documented absence (Departments, House, Attendance) or newly, exhaustively confirms an absence this series had not previously searched for (Fees, Medical, Transport, Boarding, Alumni, Library, Discipline, Certificate/Transcript, Ministry/KNEC/KICD/County integration) — none of these are canonical-domain *conflicts*, they are canonical-domain *absences*, which this document's own Principle 10 explicitly treats as a distinct, non-ADR-triggering category.

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

STOP after this document. No implementation, schema, or migration performed. No recommendation beyond documented evidence. This closes the current architectural investigation series (6A–6H, 7A). Any future implementation work requires separate scoping and explicit approval.
