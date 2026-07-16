# Sprint 6F — School Information Flow Audit

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim is marked VERIFIED (confirmed by direct code/schema inspection this session, or restated unchanged from a prior sprint's VERIFIED finding and cited back to it), LIKELY (strong indirect evidence, not exhaustively confirmed), or UNKNOWN (flagged rather than guessed).

**Builds on**: Sprint 6A (canonical entities), 6B (structure reconciliation), 6C (operating model — entities), 6D (workflow model — processes), 6E (organizational model — actors). Sprint 6F asks a fourth, final question in this series: **how does information itself travel** — origin, validation, storage, transformation, consumption, and where it stops.

---

## Executive Summary

EduNexus's information architecture has **one clean, well-designed spine** (Assessment → Evidence → Projection, gated by a real confidence/trust-tier system) running through a **majority of dead-end or single-consumer information paths** around it. The clearest new finding this session: **the platform-wide event system (`lib/events/`) is, in practice, a write-only audit log for every Core/school-domain event publisher** — `publishEvent()` is called from 15+ modules (`lib/core/school.ts`, `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `lib/compass/session.ts`, `lib/holiday/planner.ts`, `lib/academy/missions.ts`, and more), but `registerEventHandler()` — the only function that could wire an internal handler to actually *act* on a delivered event — **has zero callers anywhere in the codebase**, and `event_subscriptions` rows are only ever created through the developer-platform's own API (a structurally separate, per-organization webhook-registration system, Sprint 6E Part 1's "Platform Operator"/organizations context). Every school-domain event published today is inserted into `platform_events` and then, because no matching subscription exists for the school tenant, never delivered to anyone. The events table is a permanent, growing, unread ledger.

The second major finding is that **Report Card generation is a real, multi-stage transformation pipeline (Marks → Term Averages → Rankings → Report Card rows) that is correctly built and only reachable through a dormant endpoint** (Sprint 6D's End-of-Term finding, extended here with the transformation detail itself) — while the actual production-serving report path is a structurally separate, AI-driven pipeline off the legacy `assessments` table with no ranking, no term-average computation, and no shared code with the Core pipeline at all.

The third finding, extending Sprint 6E's AI-boundary research: **Career Intelligence is the platform's one clear "information created but consumed by nobody with review authority" pipeline** — AI-generated career matches are persisted directly to `career_matches`/`careers` and served to the student, with no confirm/reject step of the kind Evidence has, and no downstream consumer other than the same student/parent who triggered the generation.

---

## Part 1 — Information Inventory

| Object | Canonical source | Primary writer | Primary readers | Lifecycle | Downstream consumers |
|---|---|---|---|---|---|
| **Learner** | `students` (de facto, 499 rows, 68-file usage) / `learners` (Core, 405 rows, isolated) — unresolved duality, restated Stage 0.5/6A | Teacher (legacy path), school-staff (Core path) | Nearly every module | Create → (rarely) withdraw/transfer/graduate — restated 6D, mostly incomplete | Assessment, Evidence, Compass, Career, Reports, Parent Portal |
| **Teacher** | `teachers.id` (ADR-0002 ratified canonical) | Self-signup (`app/teacher/setup`) | `lib/core/identity.ts::resolveTeacher`, nearly every teacher route | Create → active indefinitely; no deactivation/offboarding path found this session | Class ownership, Assessment authority, Evidence attribution |
| **Guardian/Parent** | Three non-communicating tables (restated 6D/6E): `students.parent_user_id`, `class_students.parent_id`, Core `learner_guardians` | Teacher (invite generation), parent (redemption) | `resolveParent`, parent-facing routes | Create (invite redemption) → indefinite; no unlink/revoke path found | Alerts, Report Card (mine), Notifications |
| **School** | `schools` (Core only — no legacy equivalent) | Whoever calls `createSchool` — restated 6E, unreachable in production (no UI caller) | `lib/core/identity.ts::resolveSchool`, all Core routes | Create → indefinite; no archive/close path found | `school_users`, `academic_years`, `terms`, every Core table |
| **Class** | `teacher_classes` (de facto canonical) / `classes` (Core, isolated) — restated 6B | Teacher (self-service, legacy) / admin-tier (Core) | `class_students`, `class_assessments`, nearly all teacher routes | Create → indefinite; no archival/closure found | Assessment, Enrollment, Report Cards |
| **Enrollment** | `class_students` (legacy) / `learner_enrollments` (Core) — two tables, restated 6B/6D | Same actor as Admission (single write) | Class roster reads everywhere | Create → (Core only) withdraw/transfer status changes — restated 6D, silently incomplete for legacy | Assessment eligibility, Report Card cohort |
| **Assessment** | `class_assessments` (single physical table, both pipelines write here) | Teacher (create), teacher/admin (mark, publish) | `learner_evidence` (via marking), Report Card generators (both pipelines) | Create → mark → publish (single-actor self-publish, restated 6D) → consumed by Evidence/Reports; no archive | Evidence, legacy AI Report, Core Report Card, Analytics |
| **Assessment Result (Marks)** | Embedded in `class_assessments`/related mark rows — not independently inventoried by a prior sprint; confirmed this session via `lib/core/report-cards.ts:74` (`Average score per learner`) | Teacher (manual entry or CSV upload, `app/api/teacher/assessments/[assessmentId]/upload/route.ts`) | `computeRankings` (`lib/ranking`), Evidence lifecycle | Enter → aggregate (term average) → rank → report card row; **only inside the Core pipeline** (see Part 6) | Report Card, Evidence |
| **Evidence** | `learner_evidence`, anchored to `students.id` (restated Stage 0.5, CLAUDE.md-governed) | Assessment marking/upload pipeline (teacher-attested), Compass session pipeline (AI-inferred) | Projection engine exclusively (per CLAUDE.md architecture rule) | Create (`pending_review`/`auto_confirmed` per confidence tier) → confirm/reject (DB-trigger-enforced) → immutable thereafter, corrections are new superseding rows, never edits | Projection (`recomputeLearnerProjection`), Learner Record Timeline |
| **Knowledge** (`knowledge_nodes`/`knowledge_edges`) | Prerequisite engine, per memory context (Lean Intelligence Layer Refactor) — not re-verified this session, restated as prior context | Seeded/curated, not live-teacher-authored | Prerequisite computation for Grade 7 Maths (per memory) | UNKNOWN — not traced this session, flagged for a future sprint if needed | UNKNOWN downstream reach |
| **Capability** | `learner_profiles`/capability extraction, gated (per CLAUDE.md: never read directly, only via `recomputeLearnerProjection`) | `lib/career/capabilityExtractor.ts` (the "Reasoning layer's first citizen," CLAUDE.md) | Career Intelligence, Blueprint | Computed from confirmed Evidence → feeds Career/Blueprint; no independent lifecycle of its own | Career Intelligence, Learner Blueprint |
| **Projection** | `learner_projections` (V1, live) — restated Sprint 27/31 finding: a V2 projector variant was found fully orphaned (write-into-the-void) and was the actual cause of a prior production crash, since fixed by no-longer-persisting V2 | `lib/projection/recompute.ts::recomputeLearnerProjection` | Blueprint, Holiday Planner, Monday Panel, Parent Pulse (per memory) | Recompute-on-demand (pure function over confirmed Evidence) → cached in `learner_projections` → read by every consumer above | Blueprint, Holiday Planner, Monday Panel, Parent Pulse |
| **Recommendation** | Multiple independent producers — Career matches (`career_matches`), Holiday Planner output, Remedial Planner output, Adaptive Learning groups — **no single canonical "Recommendation" object exists**; each domain has its own | Varies per domain (Part 6) | Varies | Varies — Career matches persist and are shown with no review; Holiday/Remedial are teacher-reviewed | Student/Parent (Career), Teacher (Holiday/Remedial/Adaptive) |
| **Report Card** | Two independent tables: `school_report_cards`/`term_subject_summaries` (Core, zero production rows, restated Stage 0.5/6C) vs. the legacy AI auto-report off `assessments` (the only one producing real parent-facing output today) | `generateReportCards`/`publishReportCards` (Core) vs. the legacy AI report generator | `app/api/reports/report-card/mine/route.ts` (Core-facing selector — reads a pipeline with zero live rows), legacy report viewer | Generate → publish (Core, dormant) vs. generate-only, no distinct publish step found for the legacy AI path (UNKNOWN — not re-verified this session, restated as an open question from Stage 0.5) | Parent Portal |
| **Promotion** | Two tables, `learner_promotions`/`student_promotions`, both zero live rows, both API-only (restated 6D) | Whoever calls the respective unreachable route | Nobody — no live rows exist to read | Create only, in theory; never actually exercised in production | None currently |
| **Attendance** | **VERIFIED absent entirely** (restated 6C/6D/6E) | n/a | n/a | n/a | n/a |
| **Communication/Notification** | `notification_log` (cron-driven), `student_alerts`, WhatsApp send results (not persisted beyond the send call, per `lib/whatsapp/sender.ts`'s return-value-only shape observed in 6D research) | Teacher (`student_alerts`), Cron (`notification_log`) | Parent (`app/api/parent/alerts`), Teacher (`app/api/teacher/alerts`) | Create → resolve (alerts have `is_resolved`) → no archive found | Parent/Teacher alert feeds |
| **Academic Year / Term** | `academic_years`/`terms` (Core-only, no legacy equivalent as a real entity — restated 6C) | Admin-tier, via `lib/core/school.ts` | `getCurrentTerm`/`getCurrentAcademicYear`, End-of-Term orchestration | Create → set-current → (next-term prep inside End-of-Term, restated 6D) | Report Card generation, Assessment term-scoping (loosely — legacy `term`/`year` are free text/int, never FK'd, restated 6C) |
| **Subject** | Four representations (restated 6B): Core `subjects`, legacy free text, `sow_learning_areas`, hardcoded `lib/curriculum/subjects.ts` catalogue (the one actually driving the real teacher UI) | Varies per representation | Varies | No single lifecycle — restated 6B/6E | SOW, Assessment, Career matching |
| **Grade** | Three representations (restated 6B): Core `grades`, legacy raw integer, curriculum `sow_grades` | Varies | Varies | No single lifecycle | SOW, Report Card boundaries, Career gating (Sprint 29's Junior/Senior gate) |
| **Career Profile** | `careers`/`career_matches`, populated by AI generation (`lib/career/careerEngine.ts`, `matchEngine.ts` — restated 6E Part 7) | AI (`callDeepSeek`), triggered by student search/match request | Student, parent (via `parentIntelligence.ts`) | Generate → persist immediately → served; **no review, no expiry/refresh policy found this session** | Student Career Explorer, Parent Career Intelligence panel |
| **Learning Session** (Compass) | `compass_sessions`/`compass_messages` | Student (via `app/api/learn/route.ts`), AI (response turns) | Teacher insights (`app/api/teacher/classes/[classId]/insights`, `.../compass`), Parent (`app/api/parent/compass-activity`), Student home, Admin stats | Create (session start) → message turns → end (`app/api/learn/end/route.ts`) → feeds Evidence extraction (Part 6) | Evidence pipeline, Teacher Compass insights, Parent activity view, Monday Panel |
| **AI Conversation** | Same as Learning Session above — `compass_messages` is the raw AI conversation log; no separate object | AI + student | Same consumers as Learning Session | Same lifecycle | Same |

---

## Part 2 — Information Flow Map (selected objects)

Full origin→validation→storage→consumption→transformation→publication→archive→deletion trace for the objects with the richest, most consequential flows. (Objects with no lifecycle beyond "create, read forever" — School, Class, Academic Year/Term — are not repeated here; their full lifecycle is captured in Part 1's table.)

### Assessment Result (Marks) → Report Card
```
Origin:          teacher manual entry OR CSV upload (app/api/teacher/assessments/[assessmentId]/upload)
   ↓ Validation:  zod schema on manual entry; CSV mime-type + row-shape check on upload
Storage:         mark rows under class_assessments' related structure
   ↓ Consumption: two DIFFERENT downstream paths, branching here —
   ├─ Branch A (legacy, live):  AI auto-report generator reads assessments directly, produces
   │                            parent-facing report text — NO term-average computation, NO
   │                            ranking step found in this branch (not re-verified exhaustively
   │                            this session — restated/extended from Stage 0.5)
   └─ Branch B (Core, dormant): computeTermSummaries → generateReportCards
                                  ↓ Transformation: per-learner average (lib/core/report-cards.ts:74)
                                  ↓ Transformation: computeRankings (lib/ranking/rankingEngine.ts) —
                                    standard-competition-position ranking (ties handled, lib/ranking/ties.ts)
                                  ↓ Storage: school_report_cards / term_subject_summaries
                                  ↓ Publication: publishReportCards (canPublishReport, admin-tier only)
                                  ↓ Consumption: app/api/reports/report-card/mine — ZERO production
                                    rows to actually serve (restated Stage 0.5/6C)
Archive/Deletion: none found in either branch.
```
**Branches merge nowhere** — this is a genuine fork, not a shared pipeline. Branch A is what every real parent has ever seen; Branch B is the institutionally correct, ranked, term-aggregated pipeline that has produced zero real report cards.

### Assessment → Evidence → Projection → Recommendation
```
Origin:          teacher marks/uploads an assessment
   ↓ Validation:  resolveReviewStatus (lib/intelligence/confidence.ts:42-44) — confidence score
                  computed, capped by a per-source trust-tier ceiling
Storage:         learner_evidence, review_status = auto_confirmed (tier ≥3, confidence ≥85) or
                  pending_review (tier-1 AI-inferred sources, capped at ceiling 60 — can never
                  auto-confirm by design)
   ↓ Approval:    (pending_review only) teacher confirmReview/rejectReview — DB-trigger-enforced
                  state transition (enforce_evidence_lifecycle_transition,
                  20260707_evidence_domain.sql:174-194)
   ↓ Consumption: recomputeLearnerProjection reads ONLY confirmed evidence
                  (findConfirmedEvidenceForLearner — auto_confirmed + reviewed_confirmed)
Storage:         learner_projections (pure computation, cached)
   ↓ Transformation → Recommendation: forks into independent consumers —
   ├─ Career Intelligence (capabilityExtractor → careerIntelligenceEngine, AI narrative layered on)
   ├─ Blueprint (learnerModel/capabilityExtractor/quickWins, zero AI calls per memory)
   ├─ Holiday Planner (AI-assisted, teacher-approve gate + 3-day auto-publish fallback)
   └─ Monday Panel / Parent Pulse (per memory, backend built, not re-traced this session)
Archive/Deletion: Evidence is immutable once confirmed (corrections are new superseding rows,
                  DB-trigger-enforced); Projection is recomputed, not archived — old projection
                  values are simply overwritten (UNKNOWN whether any projection history table
                  exists — not found this session).
```
**This is the one object graph in the entire platform with a real, enforced validation gate (confidence/trust tier) before storage becomes consumable** — restated and extended from Sprint 6D Workflow 8 and Sprint 6E Part 7.

### Learning Session (Compass) → Evidence
```
Origin:          student opens Compass chat (app/api/learn/route.ts)
Storage:         compass_sessions (session row), compass_messages (each turn)
   ↓ Transformation: session content is analyzed and evidence claims are extracted
                  (lib/compass/evidence.ts::persistEvidenceBatch)
   ↓ Branch:      mastery claims → pending_review (teacher must confirm, per Evidence flow above)
                  engagement facts ("a session happened," "N of M weeks returned") →
                  auto-confirmed via a system account (lib/compass/autoConfirm.ts,
                  lib/holiday/returnAutoConfirm.ts) — both contain a runtime guard refusing to
                  auto-confirm any mastery-typed row
   ↓ Consumption: the raw chat content itself is ALSO consumed directly and unreviewed by —
   ├─ the student, live, as it streams (app/api/learn/route.ts:371,524 — no teacher step)
   ├─ Teacher Compass insights (app/api/teacher/classes/[classId]/insights, .../compass)
   └─ Parent activity view (app/api/parent/compass-activity) — summary/activity level, not raw transcript (UNKNOWN whether raw messages are ever shown to a parent — not verified this session)
Archive/Deletion: session ends (app/api/learn/end/route.ts) — no deletion or archival policy found for compass_messages content itself.
```

### Platform Event (publishEvent) — the confirmed dead end
```
Origin:          15+ modules call publishEvent() at the moment of a domain action
                 (school.created, assessment lifecycle, report published, mission completed,
                 SOW saved, payment processed, etc.)
   ↓ Validation:  idempotency_key dedup check only
Storage:         platform_events (permanent insert)
   ↓ "Consumption": scheduleDeliveries() queries event_subscriptions for a match —
                  event_subscriptions rows are only ever created via the developer-platform's
                  own webhook-registration API (lib/repositories/webhook.repository.ts),
                  a structurally separate, per-organization system (Sprint 6E's Platform
                  Operator/organizations context) — no school-tenant subscription exists in
                  this codebase's evidence for any Core/school-domain event type
   ↓ Delivery:    for 'internal' delivery_method deliveries, deliverInternal() looks up
                  INTERNAL_HANDLERS[handlerName] — registerEventHandler(), the only function
                  that populates this map, has ZERO callers anywhere in the codebase, so this
                  map is permanently empty at runtime
Archive/Deletion: none — platform_events grows without bound, never read back by anything this
                  session found evidence of for the school domain.
```
**This is the platform's largest confirmed information dead end**, spanning Assessment, Report Card, School creation/membership, Compass sessions, Holiday planning, Academy missions, Lesson Plans, SOW, and payments — every one of these domains dutifully writes a `platform_events` row that nothing currently reads.

---

## Part 3 — Cross-Domain Flow

Tracing the full Admission → Enrollment → Assessment → Evidence → Projection → Recommendations → Reports → Promotion → Graduation → Archive chain, per this sprint's specific request:

- **Admission → Enrollment**: **flows cleanly, but as a single indivisible write**, not two connected stages (restated 6D — the same request creates both `students` and `class_students` rows; there is no separate enrollment decision after admission).
- **Enrollment → Assessment**: **flows cleanly** — every assessment is scoped to a `class_id`, and class roster (`class_students`) is the source of eligible learners. No duplication or loss found.
- **Assessment → Evidence**: **flows cleanly, with a real validation gate** (confidence/trust tier, Part 2) — the strongest link in the entire chain.
- **Evidence → Projection**: **flows cleanly** — restricted to confirmed evidence only, per CLAUDE.md's architecture rule; the one place duplication is structurally prevented (a single canonical read function, `recomputeLearnerProjection`).
- **Projection → Recommendations**: **branches, does not merge** — Career Intelligence, Blueprint, Holiday Planner, and Monday Panel/Parent Pulse each independently consume Projection but produce entirely separate recommendation artifacts with no shared "Recommendation" object (Part 1). Not a loss, but a fan-out with no reconciliation layer.
- **Recommendations → Reports**: **does not flow at all.** No evidence was found this session of any Recommendation object (Career match, Holiday plan, Blueprint insight) feeding into either Report Card pipeline. Report Cards are computed straight from raw Marks (Part 2), bypassing the entire Evidence/Projection/Recommendation chain — **this is the single largest "never reaches downstream" gap found in this sprint.**
- **Reports → Promotion**: **does not flow.** Promotion (both tables) has zero live rows (restated 6D) and no code path was found reading a Report Card as an input to a promotion decision.
- **Promotion → Graduation**: **terminates before reaching Graduation in practice** — restated 6D: the legacy `student_promotions.to_grade NOT NULL` makes graduation structurally unrepresentable, and Core's promotion→graduation path (`lib/core/promotions.ts:38-42`) is real but unreachable (no UI).
- **Graduation → Archive**: **UNKNOWN/moot** — since Graduation itself is never reached in production, no Archive step downstream of it was found or could be traced. `learners.status = 'archived'` is a valid enum value (`types/core.ts:33-38`) but no code path was found this session that ever sets it.

**Summary determination**: information flows cleanly and validates correctly through the *first half* of the chain (Admission → Enrollment → Assessment → Evidence → Projection), then **fans out into disconnected, non-merging Recommendation silos**, and **the second half of the chain (Reports → Promotion → Graduation → Archive) is functionally disconnected from everything before it** — Report Cards are computed from raw Marks, not from the Intelligence layer's output, and nothing after Report Cards is reachable at all in production.

---

## Part 4 — Information Producers

| Producer | Creates | Modifies | Cannot modify |
|---|---|---|---|
| **Teacher** | Students/learners (admission), classes, assessments, marks, evidence (via marking), student_alerts, lesson plans, SOW, records of work | Own class's roster/assessments; evidence only via the four lifecycle functions (confirm/reject/retract/erase — CLAUDE.md-enforced) | Other teachers' classes (ownership-gated); `school_users`/admin-tier role grants (no path found, restated 6E); Report Card publish (admin-tier only, restated 6D) |
| **Parent** | Alert reads (implicitly, via linking), WhatsApp opt-in preference, (edge case) `student_learning_context`/`student_clinic_reports` for teacherless students via the shared assessment pipeline (restated 6E Part 8) | Own linked student's contact/notification preferences | Assessments, evidence, marks, report cards (no write path found anywhere in `app/api/parent/**`, restated 6E Part 8) |
| **Student** | Compass sessions/messages, academy reflections/mission submissions, career searches (triggering AI generation) | Own submission content before completion (UNKNOWN exact edit window — not traced) | Assessments, evidence, own report card, own projection |
| **School Admin / Headteacher / Deputy** | In theory: schools, academic years/terms, promotions, transfers, withdrawals, report publishing | Same, admin-tier gated | **Nothing in practice — this producer cannot act at all in production**, restated 6E Part 1/3 (no reachable grant path for the role, no UI for any of its actions) |
| **Cron** | `monday_panel_cache`, `notification_log`, `generation_jobs`, `substrand_health`, `organization_subscriptions`, `records_of_work`, `row_entries`, `ai_call_logs` (redaction) — restated 6E Part 8 | Same tables, on schedule | Cannot originate a human-approval-required action (e.g. cannot publish a report card — that stays admin-gated even from a cron context, per code inspection this session finding no cron calling `publishReportCards`) |
| **Webhook** (Paystack/M-Pesa payment callbacks) | Payment/subscription state, `platform_events` (`app/api/payments/callback/route.ts` calls `publishEvent`) | Payment records only | Academic/school domain data |
| **AI** | Career profiles/matches (persisted directly, no review — restated 6E Part 7), Compass chat responses (shown live), evidence claims (gated, pending review for mastery), lesson plan/SOW/remedial/holiday-plan drafts (teacher-reviewed before use) | Nothing directly — always via a `lib/` write function, never a direct table mutation from a raw model response | Evidence confirm/reject (human-only, DB-trigger-enforced); assessment/report publish |
| **Seed Scripts** (`scripts/reference-school/*.ts`) | Full reference-school fixture: staff (with the 9 real-world titles collapsed to 3 roles, restated 6E Part 4), students, classes, assessments | Fixture data only — a one-time bootstrap, not a live producer | Anything in a real school's live data (isolated by `school_id`/fixture scope) |
| **CSV Import / Bulk Upload** | Marks, via `app/api/teacher/assessments/[assessmentId]/upload` (confirmed this session: mime-type-gated CSV endpoint) | Existing assessment's mark rows (upsert-shaped, not independently verified this session) | Anything outside the one assessment the upload targets |
| **System Automation** (auto-confirm) | Evidence rows for engagement facts only, under a system account (`COMPASS_AUTO_CONFIRM_CONFIG`) — restated 6E Part 7 | Evidence review_status, engagement-typed rows only, guarded against mastery-typed rows | Mastery evidence — hard runtime guard prevents this |

---

## Part 5 — Information Consumers

| Consumer | Consumes | Canonical? | Legacy? | Duplicated? | Derived? |
|---|---|---|---|---|---|
| **Teacher Dashboard** | `teacher_classes`, `class_students`, `students`, `class_assessments` | Legacy tables, but de-facto canonical per real usage (restated 6A/6B) | Yes, structurally | No | No — mostly raw reads |
| **Parent Portal** | `students` (via one of three linking mechanisms), `student_alerts`, Compass activity, Core report-card selector (reads a pipeline with zero rows) | Mixed — some legacy, some Core (report-card/mine) | Both, simultaneously, in different features | Yes — three parent-linking paths (restated 6D/6E) | Alert feed is a light join, not heavily derived |
| **Student Portal** | Own `students` row, Compass sessions, academy progress, career search results | Legacy | Yes | No | Career results are AI-derived (Part 1) |
| **Learning Compass** | `learner_evidence` (writes), `compass_sessions`/`messages` (writes/reads), student context for prompting | Evidence is canonical; session data is its own canonical store | No | No | AI-generated conversation content itself is not "derived" from anything — it is originated, not transformed |
| **Academic Clinic** | `assessments` (deterministic pipeline, restated 6E Part 7 — no AI in the Clinic pipeline itself) | Legacy | Yes | No | Yes — deterministic derivation, the backbone Career Intelligence layers AI on top of |
| **Career Intelligence** | Confirmed Evidence (via Projection/`capabilityExtractor`), then generates and persists its own `careers`/`career_matches` | Reads canonical (Evidence/Projection); writes its own new canonical-for-itself store with no upstream review | No | No | Fully AI-derived, then treated as if canonical by every downstream reader (no distinct "AI-derived, unverified" flag found on `career_matches` rows — see Part 10) |
| **Adaptive Learning** | Deterministic grouping logic (`lib/adaptiveLearning/recommend.ts`) over class roster/assessment data — no AI call found (restated 6E Part 7) | Legacy | Yes | No | Yes — derived groupings, explicitly draft-then-teacher-approved before reaching a learner |
| **Reports** (both pipelines) | Raw Marks directly — **not** Evidence, Projection, or any Recommendation (Part 3's largest gap) | Legacy (live pipeline) / Core (dormant pipeline) | Both | Yes — two independent report-generation pipelines | Term averages/rankings are derived, but only within the dormant Core pipeline |
| **Analytics** (`app/api/school/**` — strand health, intervention efficacy, intelligence) | Reads-only, restated 6E Part 8 — no write authority | Mixed | Likely legacy-table-based (restated pattern, not re-verified per-route this session) | UNKNOWN | Yes — analytics is inherently derived/aggregated |
| **Promotion** | Would read enrollment/grade state, in theory — no live rows exist to consume, so this consumer is currently **inert** (restated 6D) | n/a | n/a | n/a | n/a |
| **Recommendation Engine(s)** (plural — no single engine, Part 1) | Projection (Career, Blueprint), raw class/assessment data (Adaptive Learning, Holiday/Remedial) | Mixed per engine | Mixed | No | Yes, by definition |
| **Notifications** (email/WhatsApp) | `students`/`class_students` contact fields, alert/assignment/reflection events | Legacy | Yes | No | No — mostly a formatting/delivery layer over already-produced content |

---

## Part 6 — Information Transformations

The one deep, multi-stage transformation pipeline found this session:
```
Marks (raw, per learner per assessment)
  ↓ pure transformation: per-learner average (lib/core/report-cards.ts:74) — Core pipeline only
  ↓ pure transformation: computeRankings (lib/ranking/rankingEngine.ts) — standard-competition
    ranking with tie handling (lib/ranking/ties.ts) — Core pipeline only
  ↓ state mutation: Report Card row created (school_report_cards/term_subject_summaries)
  ↓ state mutation: publish flag set (publishReportCards, admin-tier gated)
```
This is the **only** place in the codebase this session found a genuine Marks→Grade-shape→Rank→Report transformation chain of the kind the sprint prompt's example describes — and, per Part 2/3, it is the dormant branch, never the one real parents see.

Other transformations found, each shallower (single-stage) and independently derived, with no shared transformation code between them:
- **Evidence → Projection**: pure computation (`lib/projection/engine.ts`, confirmed zero AI calls, restated 6E Part 7) — **cached** in `learner_projections`, recomputed on demand, not incrementally updated.
- **Projection → Career Intelligence narrative**: **not** a pure transformation — an AI generation step, non-deterministic, given the same Projection input twice (no caching/memoization found; each request appears to re-generate, per `lib/career/careerIntelligenceEngine.ts` being called fresh from the route with no cache-check step observed this session — **LIKELY**, not exhaustively confirmed).
- **Compass session → Evidence**: a **derived duplication** by design — the same session content produces both (a) the raw stored conversation (`compass_messages`, read directly by teacher/parent UIs) and (b) extracted Evidence claims (read only by Projection) — two independent representations of the same underlying interaction, intentional per the Evidence-first philosophy (memory: "no hallucinated traits," everything traced to Observation/Evidence).
- **Capability Extraction**: `lib/career/capabilityExtractor.ts` — a computed transformation over confirmed Evidence, explicitly documented (CLAUDE.md) as *not* a temporary shim — the platform's stated intent is for this to remain the permanent Reasoning-layer transformation step.

**Cached information found**: `learner_projections` (recompute-on-demand cache over Evidence), `monday_panel_cache` (cron-populated cache, restated 6E Part 1). **No cache-invalidation policy was verified for either this session** — UNKNOWN whether a Projection cache can go stale relative to newly confirmed Evidence without an explicit recompute call.

**Duplicate derivations found**: Term/Grade averaging exists only in the Core Report Card pipeline; the legacy AI report path (Part 2) does not share this computation and, per Stage 0.5's original finding (restated, not re-verified line-by-line this session), derives its report content differently — this is a duplicate *concept* (both claim to summarize a learner's term performance) without duplicate *code*, which is arguably worse than shared code with a bug, since the two summaries could disagree with no mechanism to detect it.

---

## Part 7 — Information Dead Ends

**The platform event system — the largest, most structurally confirmed dead end in this audit** (full trace in Part 2): every `publishEvent()` call from `lib/core/school.ts`, `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `lib/compass/session.ts`, `lib/holiday/planner.ts`, `lib/holiday/notify.ts`, `lib/academy/missions.ts`, `lib/lessonPlan/weeklyGenerator.ts`, `lib/parentPulse/observationPipeline.ts`, `lib/organizations/invitations.ts`, `lib/organizations/update.ts`, `lib/billing/plans.ts`, `app/api/sow/save/route.ts`, `app/api/payments/callback/route.ts`, `app/api/student/submit/route.ts`, `app/api/teacher/assignments/route.ts`, and three cron routes — writes to `platform_events` with no school-tenant subscription ever created and no internal handler ever registered (`registerEventHandler` has zero callers, confirmed this session).

**Other dead ends, restated from prior sprints where already found, not re-derived**:
- `assessment_quality_flags` table — zero application-code references (restated 6C/6E).
- `student_promotions`/`learner_promotions` — zero live rows, no reader (restated 6D).
- `school_report_cards`/`term_subject_summaries` — zero production rows (restated Stage 0.5/6C).
- Legacy `assessment_type` text column vs. `assessment_type_id` FK — per memory context (Sprint 5-series), the original rollout plan to drop the text column once every reader migrated was never completed; most readers still read the text column, and the FK's one real consumer (`purpose_id` resolution) is itself read by nothing downstream (Projection/Capability Extraction/Learner Record Timeline all have zero references to it, per memory).

**New this session — AI outputs with no confirmed downstream reader beyond the immediate requester**: Career Intelligence's persisted `career_matches`/`careers` rows are read back only by the same student's own subsequent requests and the parent panel for that same student — no teacher, analytics, or Intelligence-layer consumer reads them (restated/extended from 6E Part 7's "no human owner in the request path" finding, reframed here as "no *downstream system* consumes this output either" — it is a leaf, not a branch, in the information graph).

---

## Part 8 — Information Bottlenecks

- **The `students`/`learners` identity split is the platform's single largest bottleneck** (restated Stage 0.5, extended here to the information-flow lens): every object anchored to `students.id` (Evidence, the entire Intelligence stack, per CLAUDE.md) is invisible to every Core-anchored object (`learner_enrollments`, `learner_promotions`, Core Report Cards) and vice versa. This one identity mismatch is the root cause of at least four separate findings in this document: the Report Card fork (Part 2/3), Promotion's inert status (Part 3), and half of Part 9's duplication inventory.
- **Missing bridge, Report Card pipeline**: the dormant Core pipeline's only path to real data is `runEndOfTerm`'s own lock check (Sprint 6D) — but that pipeline reads term/assessment state that, per the identity bottleneck above, is only populated for the *Core* `learners`/`learner_enrollments` shape, which itself has near-zero production adoption. The bottleneck is two-layered: no UI reaches the endpoint, **and** even if it did, the data it depends on barely exists.
- **Approval dependency, Evidence → Projection**: by design (not a defect) — a single teacher's confirm/reject action gates whether a piece of AI-inferred evidence ever reaches Projection, Career Intelligence, Blueprint, and every other downstream Intelligence consumer at once. This is a legitimate, intentional bottleneck (the platform's one real quality gate), but it does mean a slow or absent teacher review is a single point of delay for every Intelligence feature simultaneously.
- **Missing publication, event system**: Part 7's dead-end event bus means no downstream system can *ever* react to a school-domain event in real time today — anything that would want to (e.g., a future "notify Intelligence layer when a report is published" feature) would need to poll the source tables directly rather than subscribe, because the subscription mechanism that exists is structurally reserved for the developer-platform's external-org webhooks, not internal cross-module reaction.

---

## Part 9 — Information Duplication

| Object | Duplication type | Evidence |
|---|---|---|
| Grade | True duplication (3 representations) | Restated 6B — Core `grades`, legacy raw integer, `sow_grades` |
| Subject | True duplication (4 representations) | Restated 6B — Core `subjects`, legacy free text, `sow_learning_areas`, hardcoded catalogue |
| Teacher | Resolved — single canonical (`teachers.id`, ADR-0002) | Restated 6A — **not** duplicated, the one identity question this series fully closed |
| Assessment type | True duplication, per memory context — `TYPE_LABEL`, `typeLabel`, `toEvidenceAssessmentType`, 8 hardcoded placeholders, none sharing a canonical source | Restated from Sprint 5-series memory, not re-verified line-by-line this session |
| Promotion | True duplication (2 tables, both dormant) | Restated 6D |
| Guardian/Parent | True duplication (3 tables) | Restated 6D/6E |
| Report summaries | **Duplicate concept, not duplicate code** (Part 6) — two independently-computed "this is the learner's term performance" artifacts that could disagree | New finding this session |
| Enrollment | True duplication (2 tables) | Restated 6B |
| Learner | True duplication (2 tables, 68-vs-3 file usage) | Restated Stage 0.5 |
| Class | True duplication (2 tables, 34-vs-1 file usage) | Restated 6B |
| Projection cache | **Intentional caching**, not duplication — `learner_projections` is a single cache over a single canonical computation | Not a finding, listed to distinguish from the above |
| Compass session content vs. extracted Evidence | **Derived duplication, intentional by design** (Part 6) — two representations of the same interaction serving different purposes (human-readable transcript vs. machine-consumable claim) | New framing this session |

**Determination**: of the ten duplication findings in this table, eight are true/structural duplications (two independent tables/representations with no reconciliation), one is a subtler duplicate-concept case newly surfaced this session (Report summaries), and one is legacy-compatibility-shaped (Teacher, now resolved). None of the duplications found this session are pure "intentional caching" except the Projection cache, which this table lists precisely to show it is *not* part of the duplication problem.

---

## Part 10 — Information Trust Levels

| Classification | Examples | Do downstream systems understand the distinction? |
|---|---|---|
| **Canonical** | `teachers.id`, `learner_evidence` (once confirmed), `schools` | Mostly yes — CLAUDE.md's architecture rules exist precisely to enforce this for Evidence |
| **Derived/Computed** | `learner_projections`, capability extraction, term averages/rankings (Core pipeline) | Partially — Projection's consumers correctly treat it as computed (they call `recomputeLearnerProjection`, not a raw table read, per CLAUDE.md), but no equivalent discipline was found enforcing the Report Card pipeline's derived averages/rankings are re-derived rather than assumed-fresh |
| **Cached** | `learner_projections` (recompute-on-demand), `monday_panel_cache` | UNKNOWN whether consumers know these can be stale relative to their source — no invalidation policy verified this session (Part 6) |
| **Legacy** | `students`, `teacher_classes`, `class_students`, legacy `teachers.role` | Yes, extensively documented across this entire sprint series and in code comments (e.g. `lib/core/identity.ts:51`'s explicit "not to be confused with `SchoolUserRole`") |
| **Seed-only** | Reference School fixture data, the 9 staff titles (restated 6E Part 4) | Yes — confined to `scripts/reference-school/`, no evidence of leaking into production code paths |
| **AI-generated** | Career matches/profiles, Compass chat responses, Evidence claims pre-confirmation | **Inconsistently.** Evidence explicitly tracks this (confidence score, trust tier, review_status) — the one place the platform models AI-generated-ness as a first-class distinct trust level. Career Intelligence output, once persisted to `career_matches`/`careers`, has **no distinguishing flag or trust-tier marker found this session** — it is stored and read back identically to any other row in those tables, with no code-visible signal that it was AI-generated and never human-reviewed. |
| **Human-entered** | Marks (manual/CSV), student_alerts, reflections | Yes — this is the majority case and the implicit default trust level throughout the codebase |
| **System-generated** | `notification_log`, `generation_jobs`, cron-populated caches | Yes, generally — these are operational/audit-shaped tables, not treated as domain-authoritative data by anything found this session |
| **Temporary** | `idempotency_keys`, `student_invites`/`class_invites` (expiring tokens) | Yes — explicit `expires_at`/TTL-shaped columns |

**Central finding**: the platform models trust levels rigorously for exactly one object (Evidence) and implicitly/inconsistently for everything else. Career Intelligence is the sharpest contrast — an entirely AI-generated artifact stored with the same schema-level trust as human-entered data, one table over from Evidence's carefully-tiered confidence system.

---

## Part 11 — Intelligence Readiness

| Intelligence consumer | Correct input point? | Missing inputs | Late inputs | Duplicate inputs | Unused inputs |
|---|---|---|---|---|---|
| **Projection** | **Yes** — the one subsystem receiving information at exactly the intended point (confirmed Evidence only) | None found | N/A — recomputed on demand | None | None |
| **Evidence** | **Yes** — receives from Assessment marking and Compass sessions, both appropriate origin points | Attendance/Discipline data (doesn't exist to feed it — restated 6C/6E) | N/A | None found | None |
| **Career Intelligence** | **Partially** — correctly reads confirmed Evidence via Projection/capability extraction, but its own AI-generation step happens *outside* any gate, so its *output* re-enters the information graph at the wrong trust level (Part 10) | A confirm/reject step of the kind Evidence has | N/A | None found | None — but see Part 7, its own output is largely a leaf, unused by anything else |
| **Academic Clinic** | **Yes** — deterministic, reads Assessment directly, no AI, no gate needed (restated 6E Part 7) | None found | N/A | None | None |
| **Learning Compass** | **Mixed** — the tutoring/chat function receives no gated input at all (it's generative, not consuming a prior fact); the Evidence-extraction half correctly gates through confidence/trust tiers | N/A for chat; none found for evidence extraction | N/A | None | Raw `compass_messages` content is read directly by teacher/parent UIs *in parallel* with the gated Evidence extraction — not wrong, but worth noting as two consumption paths off one origin (restated Part 6) |
| **Teacher Dashboard** | **Yes**, for what it reads (roster, assessments) — but does not surface Projection/Career/Evidence-confidence information anywhere found this session; the dashboard operates on raw legacy tables, one layer *below* where the Intelligence stack lives | Projection/Capability summaries could be a natural dashboard input; not found wired in | N/A | N/A | N/A |
| **Recommendations (plural)** | **No single answer — fragmented by design** (Part 3) — none of Career/Blueprint/Holiday/Monday-Panel/Parent-Pulse feed each other; each reads Projection independently and produces isolated output | Cross-recommendation awareness (e.g. Holiday Planner knowing what Career Intelligence already concluded) | N/A | N/A | N/A |

**Overall determination**: the Intelligence layer's *input* discipline (Evidence → Projection) is genuinely strong — the best-designed part of the entire platform, information-flow-wise. Its *output* discipline is weak: once Projection fans out to Career Intelligence, Blueprint, Holiday Planner, etc., each produces its own artifact with no shared trust-level marking (Part 10) and no cross-consumer awareness (this Part), and at least one of those fan-out branches (Career Intelligence) re-injects AI-generated, unreviewed content back into the system with no distinguishing trust flag.

---

## Part 12 — Information Lifecycle Gaps

| Object | Create | Update | Approval | Publication | Consumption | Archive | Retention | Deletion |
|---|---|---|---|---|---|---|---|---|
| Learner | ✅ | ✅ (Core) | — | — | ✅ | **partial** (`graduated`/`transferred`/`archived` enum values exist, but Withdrawal never sets top-level status, restated 6D) | not found | not found |
| Assessment | ✅ | ✅ | ✅ (self-publish) | ✅ | ✅ | **missing** | not found | not found |
| Evidence | ✅ | — (immutable, corrections are new rows) | ✅ (real, DB-enforced) | N/A (confirmed = usable) | ✅ | N/A (immutable by design) | not found | ✅ (`eraseEvidence`, per CLAUDE.md's lifecycle functions) |
| Projection | ✅ (computed) | ✅ (recompute) | N/A | N/A | ✅ | **missing** — no history table found | not found | not found |
| Report Card | ✅ (both pipelines) | ✅ | ✅ (Core, admin-gated) | ✅ (Core) / **UNKNOWN** (legacy) | ✅ (legacy only, in practice) | **missing** | not found | not found |
| Promotion | ✅ (in theory) | — | — | — | **missing** (zero live rows) | **missing** | not found | not found |
| Career Profile | ✅ (AI-generated) | **UNKNOWN** (regeneration behavior not verified — Part 6) | **missing** | ✅ (immediate) | ✅ | **missing** | not found | not found |
| Platform Event | ✅ | — | N/A | **missing** (Part 7) | **missing** (Part 7) | **missing** | not found | not found |
| School | ✅ | ✅ | — | N/A | ✅ | **missing** | not found | not found |

**Pattern**: **Archive is the single most consistently missing lifecycle stage across every object in this audit** — not one object this session traced has a confirmed archival mechanism, including the one object (`learners.status = 'archived'`) whose type system explicitly anticipates it. Retention and Deletion policies were not found documented or implemented for any object except Evidence's explicit `eraseEvidence` function (CLAUDE.md-governed) and the temporary/expiring objects in Part 10 (invites, idempotency keys).

---

## Part 13 — Future Operating System Readiness

Restated and extended from Sprint 6E Part 9, viewed through this sprint's information-flow lens: **EduNexus behaves today as a Learning Intelligence Platform with an SIS-shaped data model bolted on but not wired up, and an LMS-shaped surface carrying all real production traffic.**

- **Learning Intelligence Platform evidence**: the Evidence → Projection → Recommendation chain (Parts 2, 3, 11) is the most architecturally mature part of the codebase — a real confidence/trust-tier validation system, a DB-trigger-enforced state machine, and a single canonical read function gating every downstream Intelligence consumer. This is not LMS or SIS behavior — it is closer to what a purpose-built learning-intelligence system looks like, and it is the one place this document found genuinely sound information governance.
- **SIS evidence, present but disconnected**: Core's schema (`schools`, `school_users`, `learners`, `learner_enrollments`, `learner_promotions`, Report Cards) is a real SIS data model — but Part 3 found it functionally disconnected from the Intelligence chain (Report Cards read raw Marks, not Projection) and Part 7/12 found its own internal event/publication/archive mechanisms are dead ends or missing entirely.
- **LMS evidence**: the actual, live information flow every real user experiences — teacher enters marks, Compass tutors a student, Career Intelligence generates a profile, a legacy AI report goes to a parent — is a Learning Management System's information shape (content, activity, and feedback loops), not a School Operating System's (institutional record-of-truth, cross-department workflow, audit trail).
- **Not yet a School Operating System**: the two structural requirements a real Operating System would need — a working event/notification bus connecting domains (Part 7: confirmed dead) and a reconciled single source of truth for core entities (Part 9: eight true duplications, unreconciled) — are precisely the two things this sprint found most conclusively broken.

---

## End-to-End Information Journey — One Learner, Admission to Archive

*This section follows a single hypothetical learner, "Amina," through the platform exactly as the code exists today. Every step is grounded in a specific file/route already cited above; where the journey breaks, that break is named explicitly rather than smoothed over.*

**1. Admission.** Amina's teacher opens the "add student to class" form and submits her name, grade, and details in one request. `app/api/teacher/classes/[classId]/students/route.ts` inserts a row into `students` and a row into `class_students` **in the same database transaction-shaped call** (Sprint 6D Workflow 1). There is no separate admissions decision, no registrar, no approval — Amina exists in the system the moment her teacher finishes typing. A parallel, institutionally cleaner path exists (`app/api/core/learners/route.ts`, writing to Core's `learners` table) but nothing in the product ever routes a real admission through it — this session confirmed, again, that Core has no onboarding UI at all (`lib/core/school.ts:54-58`'s own comment). **Amina's canonical identity, for every practical purpose from this point forward, is `students.id`.**

**2. Enrollment.** Already complete — the same write that admitted her also enrolled her in her teacher's class (`class_students`). There is no second "enrollment" event to trace; Admission and Enrollment are, in the live system, one action wearing two names (Sprint 6D).

**3. Parent Linking.** At some point, Amina's parent redeems either an individual invite (`student_invites` → `students.parent_user_id`) or a class-wide code (`class_invites` → `class_students.parent_id`, which — if used — links the parent not just to Amina but to every other classmate who didn't already have a parent linked, Sprint 6D/6E). Whichever mechanism fires, it is now the parent's only channel into Amina's data — a different mechanism (Core's `learner_guardians`) exists but has no relationship to whichever one actually got used, since the three never cross-reference each other.

**4. Teaching and Learning.** Amina's teacher delivers lessons drawn from a Scheme of Work; separately, Amina may open Learning Compass and chat with the AI tutor (`app/api/learn/route.ts`). Every exchange is stored in `compass_sessions`/`compass_messages`, and the same conversation content is simultaneously analyzed for evidence claims (`lib/compass/evidence.ts`). If the AI infers something about Amina's mastery of a topic, that claim lands in `learner_evidence` with `review_status = pending_review` — it does **not** yet count as anything the platform will act on. Meanwhile, the raw chat text is already visible, unreviewed, to Amina herself as it streams (`app/api/learn/route.ts:371,524`) — the one point in this entire journey where something reaches the learner before any adult sees it.

**5. Assessment.** Amina's teacher creates an assessment, marks it (manually or via CSV upload), and publishes it — all as the same actor, with no second reviewer (Sprint 6D). This write lands in `class_assessments`.

**6. Evidence, for real this time.** The marking action itself produces `learner_evidence` rows. Because a teacher directly entered this data (a tier-3, high-trust source), it very likely **auto-confirms immediately** (`resolveReviewStatus`, confidence ≥ 85) — no human click required beyond the marking itself. Amina's Compass-inferred evidence from Step 4, however, is still sitting in `pending_review` unless her teacher has separately opened the Compass evidence review screen and confirmed or rejected it. **This is the journey's first quiet fork**: teacher-entered facts about Amina flow through automatically; AI-inferred facts about her stall until a human acts, and there is no dashboard nudge found in this codebase specifically prompting a teacher to go clear a Compass review queue (student_alerts exists for other purposes, not this one, per this session's research).

**7. Projection.** Assuming her marks-based evidence is confirmed, `recomputeLearnerProjection` can now compute a real capability/risk/knowledge projection for Amina, cached in `learner_projections`. This is the platform's one clean, validated computation — and it is where Amina's raw academic activity finally becomes something an Intelligence feature can use.

**8. Recommendations, plural and disconnected.** From this single Projection, up to four independent systems may each independently generate something for or about Amina: a Career Intelligence report (AI-written, persisted directly to `careers`/`career_matches`, shown to Amina and her parent with **no review step at all** — the one AI output in her entire journey that reaches a person with zero human gate, and the one artifact stored with no trust-level marker distinguishing it from human-entered data); a Blueprint insight; possibly a Holiday Plan (teacher-approved, or auto-published after three days if nobody looks); and possibly a Monday Panel/Parent Pulse entry. **None of these four know about each other.** If Career Intelligence concludes something about Amina that Holiday Planner's remedial suggestions would contradict, nothing in this codebase would notice.

**9. Report Card — where the journey visibly forks and mostly stops.** At the end of term, Amina's actual report card is generated by the **legacy AI pipeline**, reading straight from `assessments` — bypassing Evidence, Projection, and every Recommendation from Step 8 entirely (Part 3's largest gap). The institutionally correct pipeline — the one that would compute her real term average, rank her against her cohort (`lib/ranking`), and publish a `school_report_cards` row — exists, is well-built, and requires her teacher to have already published every assessment for the term (`runEndOfTerm`'s lock check, Sprint 6D). **But nothing in the product ever calls it.** For Amina, in practice, this pipeline does not exist — her real report card is whatever the legacy AI generator produces, computed independently of the ranked, aggregated, Intelligence-informed picture the rest of her journey built.

**10. Promotion.** At year-end, in a real school, someone would decide whether Amina moves to the next grade. Two tables exist to record this (`learner_promotions`, `student_promotions`) and both have zero live rows in this codebase's evidence (Sprint 6D) — **the journey stops here for every real learner today.** There is no confirmed code path by which Amina's grade actually advances in the system, even though she presumably does, in reality, move up a grade next January.

**11. Graduation.** Reachable in theory only through the same unreachable Core promotion path (`lib/core/promotions.ts:38-42`, `promotion_type: 'graduated'` → `learners.status = 'graduated'`). Since Step 10 never fires in production, this never fires either. The legacy table Amina's real identity lives in (`students`) cannot represent graduation **at all**, structurally (Sprint 6C: no status column of any kind).

**12. Withdrawal or Transfer, if applicable.** If Amina instead leaves mid-year, Transfer (`lib/core/transfers.ts`) is the one lifecycle-exit function in the entire journey that is *correctly* built — it updates both her status and her enrollment atomically — but, like every other admin-tier action in this journey, has no UI caller (Sprint 6D/6E). Withdrawal is worse: even if called directly, it updates only her enrollment status, never her top-level `learners.status` (which has no `'withdrawn'` value to set in the first place) — so a withdrawn Amina, in the one table that models this concept at all, would still read as active.

**13. Archive.** No code path was found this session, or in any prior sprint in this series, that ever sets `learners.status = 'archived'` or performs any equivalent action on `students`. **Amina's journey has no confirmed ending.** Her data persists — Evidence immutable, Compass transcripts unarchived, `platform_events` recording every step nobody will ever read back (Part 7) — but nothing in this codebase ever formally closes her record.

**Where it flows smoothly**: Admission→Enrollment (as one action), Assessment→Evidence→Projection (the one validated chain in the platform), and Transfer's internal correctness (when reached at all).
**Where it forks without merging**: Projection→Recommendations (four silos), Report Card generation (two independent, non-communicating pipelines).
**Where it breaks or stops outright**: Report Card→Promotion (never connected), Promotion→Graduation (structurally unreachable in the legacy table, functionally unreachable in Core), Withdrawal (silently incomplete), Archive (never reached by anyone, ever, in any table).

---

## What This Document Does Not Do

Per its own scope: it does not propose an event-bus redesign, a Report Card pipeline unification, an Archive implementation, a trust-level tagging scheme for AI outputs, or any other fix. It does not recommend which dead end (Part 7) or bottleneck (Part 8) to address first. No ADR is raised — every finding in this sprint is a reachability, duplication, or lifecycle-completeness gap in already-ratified canonical models (restated from 6A–6E), not a newly discovered canonical-information conflict.

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

STOP after this audit. No implementation performed. No event bus, CQRS, workflow engine, department, attendance, timetable, schema, permission, or Intelligence change performed. No ADR raised. Awaiting explicit approval before any Sprint 6G.
