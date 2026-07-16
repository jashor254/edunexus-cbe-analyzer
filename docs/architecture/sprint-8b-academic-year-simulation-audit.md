# Sprint 8B — Full Academic Year Simulation Audit

**Mode: READ ONLY, VALIDATION ONLY.** No code, schema, migration, route, repository, service, or test was modified. This document invents no new architecture — every claim about EduNexus **today** is cited to the sprint (Stage 0.5 through 8A) that established it. Where this document reasons rather than restates (e.g., simulating a specific minute of a school day, or comparing against a named competitor product in Part 11), that reasoning is explicitly labeled **[REASONING]** or **[RESEARCH]**, distinct from **[VERIFIED]** repository citations. No ADR is raised.

**Builds on**: the complete Stage 0.5 → Sprint 8A history. This document performs no new codebase investigation — it is a stress test, walking a hypothetical Kenyan CBC secondary school through one full academic year and checking, at every step, whether the already-documented architecture can carry the load.

---

## Part 1 — Beginning of Year

| Step | Current implementation | Missing implementation | Dormant implementation | Blocked implementation |
|---|---|---|---|---|
| **School opens** | **[VERIFIED]** No reachable creation path — Core's `createSchool` has zero UI callers; the code's own comment confirms "Core has no onboarding UI today" (Sprint 6E Part 3, `lib/core/school.ts:54-58`) | A real onboarding flow | `lib/core/school.ts::createSchool`, correctly coded | **Blocked** — every downstream step in this table structurally assumes a `schools` row exists; per 8A Part 2, this is the graph's root, currently unreachable |
| **Teachers report** | **[VERIFIED]** Self-signup + name-match bridging (`ensureSchoolMembership`, Sprint 6E/7A) | A real administrative "staff reporting for duty" event | N/A | Not blocked — this path works independently of School-creation reachability, because it silently returns `schoolId: null` rather than failing (Sprint 6E Part 3) |
| **Students report** | **[VERIFIED]** Admission = a single teacher write (Sprint 6D Workflow 1) | Orientation, a distinct "reported for the term" event (Sprint 7E Part 8 — a stage this series named for the first time and found zero repository presence for) | Core's `app/api/core/learners/route.ts` | Not blocked for the legacy path; Core path is unreachable |
| **Admissions** | **[VERIFIED]** Same as "Students report" — restated, not a separate step in the live product | A distinct admission decision (Sprint 6D/7B) | Core's admission path | Not blocked, but not truly a distinct decision either |
| **Transfers** | **[VERIFIED]** `lib/core/transfers.ts`, correctly modeled, API-reachable | A UI | N/A | **Blocked** — zero UI callers found (Sprint 6D Workflow 13) |
| **Class placement** | **[VERIFIED]** Teacher self-service class creation (Sprint 6D Workflow 3) | Administrative placement as a distinct decision, Stream as a resolved concept (Sprint 7B/7C's still-open question) | Core `classes` | Not blocked for the legacy path |
| **Subject allocation** | **[VERIFIED]** Never persisted at all — implicit in content creation (Sprint 6D Workflow 5) | A persisted allocation record | N/A | Not applicable — there is no decision to block, because none is made |
| **Timetable preparation** | **[VERIFIED absent]** No timetable domain exists anywhere in the schema (Sprint 6C/6D/6E, restated 7A/7B) | The entire domain | N/A | **Blocked entirely — nothing to activate, no dormant code found** |
| **Academic calendar** | **[VERIFIED]** `academic_years`/`terms`, Core-only, correctly modeled (Sprint 6C) | A legacy-path equivalent — the legacy Assessment pipeline uses free-text `term`/`year`, never FK'd (Sprint 6C) | Core's Academic Year/Term management | Not blocked for Core's own internal logic, but disconnected from the legacy path that carries real usage |
| **Opening assessments** | **[VERIFIED]** Same Assessment pipeline as any other term assessment — restated, no distinct "baseline/opening assessment" concept found | A baseline-assessment concept distinct from an ordinary CAT | N/A | Not blocked — the general Assessment pipeline is the platform's most reliable workflow (throughout this series) |
| **Teaching begins** | **[VERIFIED]** SOW/Lesson Planning, MOSTLY COMPLETE (Sprint 8A Part 1) | N/A | N/A | Not blocked |

**Determination [REASONING]**: of eleven beginning-of-year steps, **six proceed without any structural blocker** (Teachers report, Students report/Admissions, Class placement, Academic calendar for Core's internal use, Opening assessments, Teaching begins) — because they either don't depend on School-creation succeeding (the legacy path's silent fallback) or are themselves the legacy path. **Three are genuinely blocked** (School opens itself, Transfers, Timetable preparation) — the first two by unreachable-but-correct code, the third by total absence. This mirrors 8A Part 2's dependency-graph finding almost exactly: the legacy path's independence from School-creation is precisely what lets a real pilot school function today despite the "root" of the dependency graph being unreachable.

---

## Part 2 — Daily School Operation [REASONING, grounded in cited today-state findings for each named step]

**[REASONING] Simulated ordinary day, a Form 3/Grade 10 Mathematics teacher**:

- **06:30 — Teacher logs in.** **[VERIFIED]** Works — `app/teacher/**` is the platform's one fully-served presentation surface (Sprint 6E Part 3).
- **06:35 — Views timetable.** **[VERIFIED absent]** There is nothing to view — no timetable domain exists (Sprint 6C/6D/6E). In practice, the teacher would rely on a paper/external timetable and simply open the relevant class in EduNexus when the period arrives.
- **07:00 — Opens today's lesson.** **[VERIFIED]** SOW/Lesson Plan surface works, MOSTLY COMPLETE (Sprint 8A Part 1).
- **07:05 — Marks attendance.** **[VERIFIED absent]** No attendance-marking capability exists anywhere — only the downstream `days_present`/`days_absent` schema fossil on `school_report_cards` (Sprint 6G Part 6), which nothing populates.
- **07:10–07:50 — Teaches.** **[REASONING]** Outside any system interaction by nature — a real classroom activity EduNexus does not (and should not attempt to) mediate directly.
- **During class — Records observations.** **[VERIFIED]** No ingestion point exists — Sprint 7D Part 7's explicitly-named gap: "a teacher's informal sense that a learner is struggling has no path into Evidence unless it happens to also be reflected in a mark or a Compass session." The teacher's real-time pedagogical judgment is, today, structurally invisible to the platform.
- **07:50 — Creates a CAT.** **[VERIFIED]** Works — Assessment creation, the platform's most reliable workflow (throughout).
- **Later that day — Marks work.** **[VERIFIED]** Works — manual entry or CSV upload (Sprint 6D/7D Part 2).
- **Evening — Parent communication.** **[VERIFIED]** Works, but fragmented across three non-communicating linking mechanisms and two independent notification triggers (Sprint 6D/6E/6F).
- **Evening — Learner reflection.** **[VERIFIED]** Exists via Academy (`lib/academy/`, Sprint 8A Part 1) and Compass session interaction (Sprint 6E Part 7) — but these are two separate surfaces, not one unified "reflection" concept.
- **Evening — AI recommendations.** **[VERIFIED]** Exists for Career (autonomous, ungoverned — this series' most-repeated finding), Adaptive Learning (correctly gated), Holiday/Remedial (correctly gated, one auto-publish fallback).
- **Evening — Administration.** **[VERIFIED]** Mostly inert — no reachable admin-tier action exists for anything this teacher's day would generate (report review, moderation escalation, discipline referral) per Sprint 6E Part 3 throughout.

**Determination [REASONING]**: of twelve named steps in this simulated day, **six work as a real teacher would expect** (login, lesson, CAT creation, marking, learner reflection via Academy/Compass, AI recommendation generation for the gated subsystems), **two are fragmented-but-functional** (parent communication, which works but inconsistently), and **four have no system support at all** (timetable viewing, attendance marking, informal-observation recording, and any administrative follow-through). This is the same pattern this entire series has found at every level of granularity, now confirmed at the level of a single day: the academic-content loop works; everything institutional around it does not.

---

## Part 3 — Mid-Term

| Item | Status | Evidence |
|---|---|---|
| CATs | **Implemented** | Same Assessment pipeline, restated throughout |
| Assignments | **Implemented, separately** — `assignments`/`assignment_submissions` confirmed present (Sprint 7B Part 3) | Relationship to the Evidence pipeline is UNKNOWN, not previously verified — flagged, not assumed |
| Projects | **UNKNOWN** — no prior sprint distinguished a "Project" assessment type from an ordinary Assessment; may be represented via `grading_type`/free-text assessment-type labeling, not independently confirmed | Genuinely unresolved by this series |
| Practicals | **UNKNOWN**, same reasoning as Projects — CBC's own subject list includes practical-heavy subjects (Sciences, Technical Subjects, per Sprint 7C Part 3), but no prior sprint confirmed whether practicals are tracked distinctly from a written CAT | Genuinely unresolved |
| Remedials | **Implemented, correctly gated** | `lib/remedial/`, teacher-approved, restated Sprint 8A Part 1 |
| Holiday work | **Implemented, correctly gated with a fallback** | `lib/holiday/`, teacher-approve or 3-day auto-publish, restated throughout |
| Parent meetings | **Missing** — no scheduling, agenda, or record-of-meeting concept exists anywhere in this series' evidence | No prior sprint found any trace |
| Behaviour follow-up | **Missing, no code form of any kind** | Sprint 7A Part 4, restated throughout |
| Counselling | **Missing, territory occupied by ungoverned AI (Career Intelligence)** | Sprint 7C Part 7, 7D Part 4, restated throughout as this series' single most-corroborated governance finding |
| Academic intervention | **Partially implemented** — Holiday/Remedial Planning and Adaptive Learning cover part of this territory | The "intervention" concept is fragmented across three tools with no shared record, restated Sprint 6F Part 3 |
| Department review | **Missing operationally, dormant schema fragment** | `assessment_quality_flags`, restated 6C/6E/7A/7B/8A |

**Determination [REASONING]**: of eleven mid-term activities, **four are solidly implemented** (CATs, Assignments, Remedials, Holiday work — the last two notably better-governed than the platform's headline AI feature), **two are genuinely unresolved by this entire series** (Projects, Practicals — a gap in the audit series itself, not a confirmed absence), and **five are missing** (Parent meetings, Behaviour follow-up, Counselling, unified Academic intervention, Department review) — three of which (Behaviour, Counselling, Department review) are domains this series has repeatedly found have no code form at all, not merely unreachable code.

---

## Part 4 — End of Term

```
Final exams
  │ [VERIFIED — same Assessment pipeline, no distinct "final exam" flag
  │  found beyond ordinary assessment_type labeling]
  ▼
Mark entry
  │ [VERIFIED — manual or CSV, works reliably]
  ▼
Moderation
  │ [VERIFIED ABSENT operationally — assessment_quality_flags dormant,
  │  zero application-code references]
  ▼
Ranking
  │ [VERIFIED — lib/ranking, correctly built, tie-handled, but only
  │  reached by the Core Report Card pipeline, which has zero production
  │  rows]
  ▼
Grading
  │ [VERIFIED — lib/grading is sound, but at least 6 live implementations
  │  disagree once a school sets a custom grade_boundaries value
  │  (Sprint 4D/8A Part 7 — Critical-before-pilots finding)]
  ▼
Evidence
  │ [VERIFIED — the platform's one Reference-Quality subsystem]
  ▼
Projection
  │ [VERIFIED — pure, deterministic, correctly gated]
  ▼
Recommendations
  │ [VERIFIED — fans out to Career (ungoverned), Adaptive Learning
  │  (governed), Holiday/Remedial (governed) — no single "recommendation"
  │  feeds into Report generation, per Sprint 6F Part 3's largest gap]
  ▼
Report generation
  │ [VERIFIED — TWO INDEPENDENT PIPELINES, per below]
  ▼
Publishing
  │ [VERIFIED — Core: admin-gated, unreachable. Legacy: unclear gate,
  │  the only one that actually happens]
  ▼
Parent viewing
  │ [VERIFIED — works, via the legacy pipeline's output]
  ▼
Promotion recommendation
  │ [VERIFIED — zero live rows ever, in either table]
```

**Comparing the four paths, per the sprint's specific request**:

| Path | What it is | Reaches Ranking/Grading correctly? | Reaches real parents? | Status |
|---|---|---|---|---|
| **Legacy path** | The AI-generated report off raw `assessments` | **No** — bypasses term-averaging and ranking entirely (Sprint 6F Part 2) | **Yes — this is the only path that does** | Live, used, architecturally the weakest of the four |
| **Core path** | `generateReportCards`/`publishReportCards`, `lib/core/report-cards.ts` | **Yes** — correct ranking, correct term-averaging | No — zero production rows | Well-built, entirely dormant |
| **Evidence path** | What a report *should* be computed from, per this series' own Intelligence architecture (Sprint 7E Part 3) | N/A — this is not currently a report-generation path at all, it is the path Report generation should but does not draw from | No — no report generator reads Evidence/Projection today | **Does not exist as a report path** — this is the gap, not a fourth working option |
| **Production path** (what actually happens for a real pilot school today) | = the Legacy path, exactly | No | Yes | The path that matters for the 50 pioneer teachers today, and the path least aligned with this platform's own architectural strengths |

**Determination [REASONING]**: the report a real parent sees today is produced by the least architecturally sound of the four possible paths, while the most sound path (Core, correctly using Ranking/Grading/term-averaging) has never been used, and the path this platform's own Intelligence investment should feed (Evidence/Projection) is not connected to report generation at all. This is Sprint 6F Part 6's finding, restated here with the explicit four-way comparison the sprint requested.

---

## Part 5 — End of Year

| Item | Implemented? | Reachable? | Tested? | Dead? |
|---|---|---|---|---|
| Promotion | Yes (both tables) | No — zero UI, zero live rows ever | UNKNOWN — no evidence of any test exercising a real promotion event | Effectively dead in production, though the code is not itself deleted |
| Graduation | Yes (Core only) | No | UNKNOWN | Effectively dead; structurally impossible in the legacy identity table regardless |
| Transfer | Yes, correctly modeled | No — API-reachable, zero UI | UNKNOWN | Effectively dead in production despite being the best-built of this group |
| Withdrawal | Yes, incompletely | No — API-reachable, zero UI | UNKNOWN | Effectively dead, and incomplete even if reached (`learners.status` never updated) |
| Archive | **Not implemented for any object in this entire series' evidence** | No | N/A | **Absolutely dead — there is no code to even be dormant** |
| School statistics | Partially implemented — read-only analytics (`app/api/school/**`) | Yes, technically reachable via API, but its intended consumer (an admin-tier actor) cannot be populated (Sprint 6E/6H Part 7) | UNKNOWN | Reachable-but-consumerless, a distinct category from the rest of this table |
| National reporting | Export-format labeling only (KNEC CSV) | Yes — the one item in this table a real teacher can and does reach | UNKNOWN | Not dead, but not a live *integration* either — a formatted download, restated Sprint 7A Part 2 |

**Determination [REASONING]**: of seven end-of-year items, **only one (National reporting's export) is both reachable and actually used** by a real teacher. Everything that would represent a learner's year formally concluding — Promotion, Graduation, Transfer, Withdrawal, Archive — is either unreachable or entirely absent. **No learner's academic year, across this entire codebase's evidence, has ever formally ended.**

---

## Part 6 — Every Actor

Restated and consolidated from Sprints 6E/7A/7C/7D/7E, extended with three actors (Secretary, Driver, Security) this sprint names for the first time alongside the others.

| Actor | Can do today | Can't do today | Should eventually do |
|---|---|---|---|
| **Teacher** | Admit, enroll, create/mark/publish assessments, confirm/reject evidence, differentiate, plan lessons, review Career Intelligence output — no, cannot review it, nothing to review (see Counsellor row) | Access institutional-administration functions (correctly, they shouldn't); moderate their own department's marking (no department exists) | Escalate to a real Department/Dean review when moderation-flagged (Sprint 8A Part 6) |
| **Learner** | Chat with Compass, submit reflections/missions, search careers, receive an AI-generated career report | Override their own career recommendation, see their own Evidence confidence, access any promotion/graduation status | Per Sprint 7E Law 23, override authority over their own career recommendation |
| **Parent** | Link to their child (via one of three mechanisms), receive alerts/notifications, view the legacy report card, opt into WhatsApp | Write to any academic record (correctly, per the zero-violation finding, Sprint 6E Part 8); participate in a Career Guidance *conversation* (only receives the AI's output) | Active participation in a governed Career Guidance workflow (Sprint 7E Part 5) |
| **Principal** | Nothing — the role cannot be granted in production | Everything a real Principal's authority implies (report sign-off, graduation certification, discipline escalation) | The final institutional sign-off role this entire hierarchy structurally needs (Sprint 8A Part 4) |
| **Deputy** | Nothing — same as Principal | Same | Operational execution of Principal-set policy |
| **Dean (of Studies)** | Nothing — exists only as a seed-script label | Assessment calendar oversight, curriculum coherence | Cross-departmental academic policy |
| **Registrar** | Nothing — exists only as a seed-script label, collapsed identically with Dean/Finance/etc. into `school_admin` | Records-of-truth custodianship | Enrollment, transcript issuance, transfer paperwork |
| **Counsellor** | **Does not exist as an actor at all** | Everything real-school Guidance & Counselling implies | Career Guidance review, referral triage, confidentiality-bound support — this series' single most urgent new-actor gap |
| **Secretary** | Nothing — seed-script label only | General administrative support | UNKNOWN — this series never independently researched what a Secretary's specific decision authority (if any, versus pure clerical support) should be, flagged honestly rather than invented here |
| **Finance** | Nothing — no domain exists to hold this authority at all | Fee management, invoicing, admission-hold gating | Everything Sprint 7A/7C/8A already justified for a future Finance domain |
| **ICT** | Nothing — seed-script label only | Infrastructure oversight | Platform-health monitoring, digital-literacy tracking (Sprint 7E Part 6) |
| **Boarding** | Nothing — domain does not exist | Boarding assignment, occupancy tracking | Occupancy/wellbeing pattern Intelligence (Sprint 7E Part 6) |
| **Nurse** | Nothing — zero repository presence of any kind, not even a seed label (Sprint 7A Part 2) | Any medical function | The strongest "AI must never decide" case this series found (Sprint 7C Part 7) — a human-only notification/response role |
| **Driver** | Nothing — zero repository presence | Transport logistics | Route assignment visibility, in a future Transport domain |
| **Security** | Nothing — zero repository presence | Any function | Not independently justified by any evidence this series gathered — the weakest-justified actor in this entire table, included for completeness only |

**Determination [REASONING]**: of fifteen actors in this table, **three can do something today** (Teacher, Learner, Parent — the same three found fully or partially modeled since Sprint 6E), and **twelve can do nothing at all**, including every single actor with institutional or non-academic authority. This is the sharpest single-table confirmation in this entire series of the "Teacher Authority by elimination" finding first made in Sprint 6G.

---

## Part 7 — Every Information Object

| Object | Created | Updated | Reviewed | Published | Archived | Deleted |
|---|---|---|---|---|---|---|
| Learner | ✅ | ✅ (Core) | — | — | ❌ (partial — `graduated`/`transferred` enum values exist, never fully exercised) | UNKNOWN |
| Teacher | ✅ | UNKNOWN | — | — | ❌ (no offboarding path found) | UNKNOWN |
| Assessment | ✅ | ✅ | ❌ (no second reviewer) | ✅ (self-publish) | ❌ | UNKNOWN |
| Evidence | ✅ | — (immutable, corrections are new rows) | ✅ (the platform's one complete review cycle) | N/A (confirmation = usable) | ❌ | ✅ (`eraseEvidence`) |
| Recommendation | ✅ (AI) | UNKNOWN | ❌ (Career) / ✅ (Adaptive Learning, Holiday/Remedial) | ✅ (immediate for Career; gated for the rest) | ❌ | UNKNOWN |
| Report | ✅ (both pipelines) | ✅ | ❌ (no formal review step between generate and publish, Sprint 6G Part 10) | ✅ (legacy) / ❌ reachable (Core) | ❌ | UNKNOWN |
| Promotion | ✅ (schema only, never exercised) | — | — | — | — | — |
| Attendance | ❌ (schema fossil only) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Communication | ✅ | — | — | ✅ (sent = published) | ❌ | UNKNOWN |
| Career Plan | ✅ (AI) | UNKNOWN — regeneration behavior UNKNOWN (Sprint 6F Part 6) | ❌ | ✅ (immediate) | ❌ | UNKNOWN |
| Learning Plan (Holiday/Remedial) | ✅ (AI draft) | ✅ (teacher adjust) | ✅ (approve gate) | ✅ | ❌ | UNKNOWN |
| Behaviour Record | ❌ — domain does not exist | ❌ | ❌ | ❌ | ❌ | ❌ |
| Medical Record | ❌ — domain does not exist | ❌ | ❌ | ❌ | ❌ | ❌ |
| Fee Record | ❌ — domain does not exist | ❌ | ❌ | ❌ | ❌ | ❌ |

**Determination [REASONING]**: Evidence is the only object in this table with a fully checked lifecycle. Every other object is missing at least one stage, and four objects (Attendance, Behaviour, Medical, Fee) are missing every single stage because the object itself does not exist. This restates, at the per-object granularity the sprint requests, Sprint 6F Part 12's "Archive is the single most consistently missing lifecycle stage" finding — extended here to show that for several objects, *every* stage is missing, not only Archive.

---

## Part 8 — Educational Intelligence Validation

Restated and consolidated from Sprints 6G Part 3, 7D Part 6, 7E Part 3/5, 8A Part 5 — the fullest single-table version yet assembled across this series.

| Subsystem | Input | Reasoning | Output | Approves | Consumes | Evidence support | Audit trail |
|---|---|---|---|---|---|---|---|
| Compass (chat) | Student message, session history | LLM generation | Live tutoring text | Nobody | Student (direct) | None required by design (real-time, advisory) | Session log only, no decision-audit |
| Compass (evidence extraction) | Session content | Confidence scoring, claim extraction | Evidence rows | Teacher (mastery) / system (engagement, guarded) | Projection | Confidence score, trust tier | Full — `reviewed_by`/`reviewed_at`/`review_reason` |
| Projection | Confirmed Evidence only | Deterministic computation | `learner_projections` | N/A | Career, Blueprint, Holiday Planner, Monday Panel/Parent Pulse | Inherits Evidence's trail | Traceable to inputs, no independent columns |
| Career Intelligence | Projection, capability extraction | LLM generation, fit scoring | Career matches, narrative, **persisted directly** | **Nobody** | Student, Parent | **None — zero trust/confidence column** | **None** |
| Academic Clinic | Assessment data | Deterministic computation | Diagnostic report | N/A | Teacher, Parent (teacherless edge case) | N/A (not an AI system) | Standard timestamps only |
| Adaptive Learning | Class/assessment data | Grouping logic | Grouping proposals | Teacher (explicit approve/adjust) | Teacher | N/A (no AI call found in the path itself) | `is_published`/`published_at`, no `published_by` |
| Holiday/Remedial Planning | Projection | LLM generation | Draft plans | Teacher, or 3-day timeout | Teacher, Learner | N/A | Same as Adaptive Learning |
| Academy AI Judge | Student reflection/mission submission | LLM scoring | Score | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

**Determination [REASONING]**: eight subsystems audited, **one (Career Intelligence) fails every governance column in this table simultaneously** — no approver, no confidence support, no audit trail. This is the fifth independent time across this series (6G, 7C, 7D, 7E, and now 8B) this exact finding has been reconfirmed from a different angle — at this point, this document treats it not as a new discovery but as the series' single most load-bearing, most-validated conclusion.

---

## Part 9 — Educational Operating System Scorecard

| Domain | Score | Evidence |
|---|---|---|
| Admissions | **Pilot Ready** | Works reliably for a single school's real usage, but no distinct decision/review step exists (Sprint 6D) |
| Enrollment | **Pilot Ready** (legacy) / **Architecturally Ready** (Core) | Duplicated, restated 6B |
| Teaching | **Production Ready** | SOW/Lesson Planning MOSTLY COMPLETE, no major blockers found (Sprint 8A Part 1) |
| Learning (Compass) | **Production Ready** for tutoring; **Pilot Ready** for evidence extraction | Live, used, correctly gated on the evidence-extraction half |
| Assessment | **Production Ready** | The platform's most reliable, most exercised workflow throughout this series |
| Reporting | **Pilot Ready** (legacy, live) / **Architecturally Ready** (Core, dormant) | Two independently-computed pipelines, restated 6F Part 6 |
| Parents | **Pilot Ready** | Real, used, fragmented (Sprint 6D/6E/6F) |
| Administration | **Foundation Only** | Schema-complete, zero reachable production path (Sprint 6E throughout) |
| Curriculum | **Pilot Ready** for content; **Foundation Only** for structural coherence | Four-way duplication, restated 6B |
| Communication | **Pilot Ready** | Works, fragmented, restated throughout |
| Analytics | **Foundation Only** | Read-only, no reachable consumer (Sprint 6E Part 8, 6H Part 7) |
| AI (platform-wide infrastructure) | **Production Ready** | Single confirmed entry point (`lib/ai/deepseek.ts`), correctly used by nearly every caller |
| AI (Career Intelligence specifically) | **Research Only**, by this document's own standard — a capability that is functionally live but has none of the governance a production educational decision requires (Sprint 6G/7D/8B throughout) | The clearest score-vs-liveness mismatch in this table: technically running in production, architecturally not ready to be |
| Workflow (as a generalized engine) | **Foundation Only** | Two working instances (Evidence, Adaptive Learning) prove the shape is achievable; no generalized engine exists (Sprint 7E/8A) |
| Evidence | **Production Ready** | Reference Quality, restated throughout as this series' unambiguous best subsystem |
| Projection | **Production Ready** | Pure, deterministic, correctly gated |
| Governance (platform-wide, across every domain) | **Foundation Only** | Bimodal — Evidence excellent, almost everything else thin-to-none (Sprint 6G Part 9, restated throughout) |
| Attendance | **Absent** | Schema fossil only |
| Timetable | **Absent** | VERIFIED, restated throughout |
| Finance | **Absent** | VERIFIED, restated throughout |
| Medical | **Absent** | VERIFIED, restated throughout |
| Discipline | **Absent** | VERIFIED, restated throughout |
| Guidance & Counselling | **Absent as a domain; Research Only for its AI substitute's governance question** | Territory occupied by ungoverned Career Intelligence |

---

## Part 10 — Gap-to-Roadmap Matrix

Every gap named in Parts 1–9, classified by type and priority tier. Restated and consolidated from 8A Part 6/7, extended with this sprint's own confirmations.

| Gap | Type | Priority |
|---|---|---|
| School creation unreachable | Architecture issue | **Before Pilot** — this document's Part 1 confirms the legacy path's independence is currently masking this, but any Core-dependent feature (Reporting, Promotion) cannot activate without it |
| `students`/`learners` identity split | Canonical identity issue | **Before 10 schools** — tolerable at pilot scale because Core is unreached; becomes central the moment any Core-dependent feature activates (restated 8A Part 7) |
| Grading-boundary conflicts (76/51/31 vs 75/50/25) | Technical debt | **Before Pilot** — restated 8A Part 7's own Critical classification, re-confirmed by this document's Part 4 finding that Grading is one of only two stages in the End-of-Term chain with a live disagreement risk |
| `gradeLevelFromScore` unmigrated | Technical debt | **Before 10 schools** — restated 8A Part 7 |
| Report Card two-pipeline duplication | Architecture issue | **Before 10 schools** — the legacy pipeline works today; the risk compounds once any school's data touches both |
| Career Intelligence governance | AI feature / Policy decision | **Before Pilot** — this document's fifth independent confirmation across the series that this is the single most urgent AI-governance gap; a minor-facing, unreviewed, persisted decision is not a "can wait" item by any classification this series has used |
| Timetable | Commodity LMS feature | **Before 100 schools** — every LMS/SIS has this; EduNexus's absence is not a differentiation gap, it's a completeness gap that matters once schools scale beyond a single-teacher-knows-the-schedule informality |
| Attendance | Commodity LMS feature | **Before 100 schools** — same reasoning |
| Finance | Operating System feature | **Before 100 schools** — restated 7A/8A's justification: a real operational gate for many schools, but not needed to prove the pilot's academic value |
| Medical | Operating System feature | **Before 100 schools**, with a caveat: duty-of-care urgency (Sprint 7C Part 7) argues this should not slip past 10 schools if any pilot school is boarding |
| Guidance & Counselling domain | Operating System feature / Policy decision | **Before 10 schools** — because its absence is *actively causing* a governance failure (Career Intelligence) today, not merely a missing convenience |
| Department/Moderation activation | Operating System feature | **Before 100 schools** — `assessment_quality_flags` is valuable but not yet urgent at pilot/10-school scale where informal moderation (a small staff room) can substitute |
| Projects/Practicals tracking | Research question | **Future Research** — this document's own Part 3 finding that this series never resolved whether these are distinctly tracked |
| `learnerModel`/`learnerIntelligence` vs. `projection` relationship | Research question | **Before 10 schools** — restated 8A Part 7, blocks Stage 4/5 work |
| Event bus activation | Workflow issue / Data issue | **Before 100 schools** — invisible at pilot scale, an operational liability at institutional scale (restated 8A Part 7) |
| Archive (any object) | Data issue | **Before 1000 schools** — genuinely low-urgency at small scale; becomes a real data-governance and storage-cost concern only at volume |
| Alumni | Future vision | **Future Research** — weakest-justified future domain in this entire series (restated 7B Part 7) |
| Transport / Boarding / Library | Operating System feature | **Before 1000 schools**, with the same boarding-urgency caveat as Medical for any pilot school that is itself a boarding school |
| National reporting (real KNEC integration, not export-labeling) | Operating System feature / Policy decision | **Future Research** — depends on an external body's own API/process existing to integrate with, not solely on EduNexus's own readiness |

---

## Part 11 — "LMS on Steroids" Validation [RESEARCH — reasoned comparison against named products, not a repository investigation]

*General knowledge of Moodle, Google Classroom, Canvas, and Microsoft Teams for Education's actual capabilities, compared against this series' EduNexus findings. Not a code audit of those products — reasoning from their well-documented, publicly known feature sets.*

| Capability | Could Moodle/Classroom/Canvas/Teams do this? | Why / What's different |
|---|---|---|
| Course content delivery, assignments, submissions | **Yes** | This is these products' core competency — EduNexus's SOW/Lesson Plan/Assignment surface does not meaningfully exceed them here |
| Gradebook, marks entry | **Yes** | Standard LMS capability |
| Basic report/progress export | **Yes** | Standard capability, arguably more mature in these products than EduNexus's own dual-pipeline confusion (Part 4) |
| AI chat tutor (Compass) | **Increasingly yes** — Canvas and Teams have both been adding AI-assisted tutoring/copilot features; this is a fast-moving competitive space, not a durable EduNexus moat on its own | EduNexus's differentiator is not the chat interface itself, but that the same interaction *also* feeds a governed Evidence pipeline (see below) — a generic AI tutor bolted onto Moodle would not do this |
| **Evidence confirmation with confidence-tiering and DB-enforced immutability** | **No** — none of these four products model a distinct "confirmed vs. pending" trust state for a piece of learning data, with human-in-the-loop review and correction-by-supersession | **This is EduNexus's clearest, most defensible architectural differentiator.** A generic LMS gradebook treats every entered mark as equally true the moment it's saved; EduNexus's Evidence layer treats trustworthiness itself as a first-class, auditable property |
| **Projection (computed capability/risk/knowledge state from confirmed evidence)** | **Partially** — some LMS analytics dashboards compute "at-risk" flags from grade/engagement data, but typically as opaque scoring, not as a transparent computation over an explicitly-confirmed evidence set | EduNexus's advantage is traceability: a Projection value can be walked back to the exact Evidence rows that produced it (restated 7D Part 7) — most competitor "risk score" features cannot show their work this precisely |
| **Career Intelligence, as currently built** | **No product in this list ships an autonomous, persisted, AI-generated individual career-trajectory recommendation with no human review** | This is not a compliment to EduNexus — per this entire series' finding, this is EduNexus doing something *none* of these products do, and doing it in a way this document's own external-guidance research (Sprint 7D Part 9) found is closer to a liability than a differentiator until governed |
| Adaptive Learning / differentiation grouping | **Partially** — Canvas and some Google Classroom extensions offer basic differentiation tooling | EduNexus's draft/approve governance pattern (the cleanest in the platform) exceeds what these products typically offer, which tends toward automated grouping with less explicit human-override framing |
| Attendance, Timetable | **Yes, extensively** — every product in this list either has native attendance/scheduling or integrates with a dedicated SIS that does | **EduNexus's absence here is a real gap relative to the competition, not a deliberate scope choice** — this is precisely why Part 10 classifies these as "Commodity LMS feature," not an EduNexus-specific innovation opportunity |
| CBC-specific competency-based assessment structure | **No** — these are global, curriculum-agnostic products; none has CBC's specific level-labeling (EE/ME/AE/BE), pathway structure, or KICD content baked in | This is a genuine, durable differentiator, but a *market-fit* one, not an *architectural-sophistication* one — it matters because it saves a Kenyan school from configuring a generic product to fit CBC, not because of any Evidence/Projection engineering |
| Institutional administration (SIS-shaped: enrollment records, promotion, graduation) | **Partially** — these four are primarily LMS products, not full SIS products, though Canvas/Teams increasingly integrate with dedicated SIS partners | EduNexus's Core schema is SIS-shaped and *could* exceed a bolted-on SIS integration if activated — but per Part 5/9, it currently does not, so this is a **future** differentiator, not a current one |

**Determination [REASONING]**: EduNexus's genuine, defensible differentiation from "an LMS with AI features" rests on exactly the same evidence this entire series has repeatedly found strongest — the Evidence/Projection engine's confidence-tiering, human-in-the-loop, fully-traceable design. Every capability in this table that a generic LMS could already do (content delivery, gradebook, basic reporting, attendance, timetable) is correctly triaged in Part 10 as a completeness gap to close, not an innovation opportunity to chase. Career Intelligence, ironically, is the one capability *no* competitor product currently offers in this form — but this series' own evidence says that's because doing it *ungoverned* is not a feature worth having, and the version worth having (governed, per Sprint 7E Part 5) would still be a genuine differentiator once built correctly.

---

## Part 12 — Executive Readiness Report [REASONING, synthesizing every prior Part of this document]

**Can EduNexus today operate one classroom?** **Yes, and it already does** — Sprint 8A/8B's own evidence shows the Teaching→Assessment→Evidence→Projection→gated-Recommendation chain works reliably for a single teacher's real class, which is exactly the unit "one classroom" describes.

**Can it operate one school?** **Yes, with caveats** — a single pilot school can and does run on the legacy path (restated Part 1's finding that the legacy path's independence from School-creation reachability is what makes this possible today). The caveats: no real institutional administration exists (Promotion/Graduation/Report-publish are all unreachable, Part 5), and Career Intelligence's governance gap is a live, minor-facing liability regardless of school count (Part 10's "Before Pilot" classification).

**Can it operate five schools?** **Not yet, cleanly** — five schools sharing the legacy path's `school_id`-less identity model (Part 1's finding that `teacher_classes`/`class_assessments` have no `school_id` column in any migration, per Sprint 4E) means cross-school data isolation depends entirely on application-code discipline, not a schema guarantee. This is likely to work in practice at five schools if each school's staff are the only ones touching their own data, but it is not an architecturally guaranteed boundary the way RLS-enforced Core tables would provide.

**Can it operate fifty schools?** **No** — at this scale, every "Before 10 schools" and most "Before 100 schools" items in Part 10 become load-bearing: the identity split, Report Card duplication, the event-bus dead end (cross-school coordination would need real integration, not a diary-entry event table), and Administration's total unreachability (fifty schools' worth of Principals/Registrars needing to do their jobs, with a permission model that structurally cannot grant them the ability to).

**What already exceeds a traditional LMS?** Per Part 11: the Evidence confirmation/confidence-tiering system, Projection's traceable computation, and (once governed) the Career Intelligence capability class itself — none of the four named competitor products model these in a comparable way.

**What should absolutely not be built yet?** Per this document's own Part 10 "Future Research" tier and Sprint 8A's premature-intelligence warning (restated Part 8): Operational/Department/Leadership Intelligence (no institutional data exists yet for them to compute over), Alumni (weakest-justified future domain in the series), a real KNEC integration (depends on an external body's readiness, not EduNexus's), and — most importantly — **any further AI capability built in Career Intelligence's shape** (autonomous, persisted, ungoverned) before that specific subsystem's own governance retrofit (Sprint 8A Stage 5) is complete. Building a second ungoverned AI decision-maker while the first remains unfixed would compound this series' single most-repeated finding rather than resolve it.

---

## What This Document Does Not Do

Per its own scope: it invents no new architecture, proposes no schema, and performs no implementation. Parts 2 and 11 contain explicitly-labeled **[REASONING]**/**[RESEARCH]** content (a simulated day's minute-by-minute walkthrough, and a comparison against named competitor products) that must not be cited elsewhere as a repository finding. No ADR is raised — every gap this document surfaces is already documented by a prior sprint; this document's contribution is stress-testing those gaps against a realistic academic-year narrative, not discovering new ones, with the sole exception of Part 3's honest flag that Projects/Practicals tracking was never previously investigated by this series at all (a research gap in the audit series itself, not a new canonical-domain conflict).

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only `docs/architecture/sprint-8b-academic-year-simulation-audit.md` and the implementation log entry were written.

## Stop Condition

STOP after this document. Wait for explicit approval before Sprint 8C.
