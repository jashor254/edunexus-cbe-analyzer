# Sprint 6D — School Workflow & Responsibility Model Audit

**Mode: READ ONLY.** No code, schema, migration, route, repository, service, or test was modified. Every claim below is marked VERIFIED (confirmed by direct code/schema inspection this session, or restated unchanged from a prior sprint's VERIFIED finding), LIKELY (strong indirect evidence, not exhaustively confirmed), or UNKNOWN (flagged rather than guessed). No workflow step is inferred without a corresponding file, route, or table reference.

**Builds on**: Stage 0, Stage 0.5, ADR-0002, Sprints 5D–6C. Sprint 6C traced the lifecycle chain node-by-node (entity by entity) and inventoried missing organizational *entities* (Departments, Timetable, etc.). This document reframes the same territory as **workflows** — start, end, actors, data created/consumed, approval points, and Administration↔Academics hand-offs — and covers three workflows 6C did not examine in detail: **Parent Communication, Withdrawal, and Transfer**. Findings already established as VERIFIED in 6A/6B/6C are restated, not re-derived, and cited back to their origin.

---

## Executive Summary

EduNexus has **no workflow engine, no approval-step abstraction, and no cross-domain hand-off mechanism anywhere in the codebase** (VERIFIED — no state-machine table, no "pending admin action" queue, no workflow-status column of the shape `pending_review`/`approved`/`rejected` on any school-domain table other than assessment publish/report-card publish booleans). Every "workflow" in this platform is, structurally, either (a) a single API route performing one atomic database write with no downstream consumer, or (b) a short, hard-coded call chain inside one `lib/core/*.ts` file with no persisted intermediate state. There is no workflow in this codebase where Administration starts something, Academics is notified, and Academics explicitly acts on it — the closest approximation, End-of-Term (see below), is a single admin-triggered function that does the entire hand-off (lock-check → aggregate → generate → publish) in one call with no waiting state in between.

**Two new findings this session change the picture from 6C's "graduation is unreachable" to a broader claim**: (1) **Withdrawal is a partial, silently-incomplete workflow** — `withdrawLearner()` (`lib/core/learners.ts:90-92`) sets the learner's *enrollment* status to `'withdrawn'` but never touches `learners.status`, which has no `'withdrawn'` value in its own type at all (`types/core.ts:33-38`: `active | transferred | graduated | archived | deceased`) — a withdrawn learner's top-level record still reads `active`. (2) **The best-designed workflow in the entire platform, Core's End-of-Term orchestration (`lib/core/endOfTerm.ts:46-76`), has zero UI callers** — it is a fully sequenced, lock-gated, idempotent Administration→Academics→Administration hand-off (block on unpublished assessments → aggregate scores → generate report cards → publish → prepare next term) that nothing in `app/` ever invokes outside its own API route.

**Parent Communication is not one workflow but at least three non-communicating linking mechanisms** feeding into two independent notification systems, none of which share a common "communication" abstraction or audit trail.

---

## Workflow-by-Workflow Trace

Each entry: **Start → End**, **Actor(s)**, **Data created**, **Data consumed**, **Approval point(s)**, **Ownership transition**, **Admin vs. Academics**.

### 1. Admission
- **VERIFIED**, restated from Sprint 6C §Admission (not re-derived): real path is `app/api/teacher/classes/[classId]/students/route.ts` — a class teacher adds students directly, writing `students` + `class_students` in one request. A second, isolated Core path exists (`app/api/core/learners/route.ts`, `learners` table, school-staff-tier gated).
- **Start**: teacher opens "add student to class" form. **End**: row(s) exist in `students`/`class_students` (or `learners`, Core path) — no further step, no confirmation, no review.
- **Actor**: class teacher (legacy path) or any school-staff-tier user (Core path, per `requireSchoolStaff`, Sprint 1B).
- **Data created**: `students` row, `class_students` row (legacy); `learners` row (Core).
- **Data consumed**: none — no prior "applicant" or "pending admission" record exists in either pipeline; admission is a first-write, not a state transition.
- **Approval point**: **none** (VERIFIED — no `pending`/`approved` status column on either table, no second-actor sign-off anywhere in either route).
- **Ownership transition**: none — the same actor creates and immediately owns the record.
- **Admin vs. Academics**: **VERIFIED, not separated** — the class teacher performs what would institutionally be an Administration act (enrolling a learner in the school) using an Academics-scoped route (adding to *their own class*), per 6C's determination.

### 2. Learner Onboarding
- **VERIFIED**: there is no distinct "onboarding" step beyond Admission above — no welcome sequence, no orientation record, no parent-notification-on-admission trigger found (`grep` for any post-insert side effect in `app/api/teacher/classes/[classId]/students/route.ts` and `app/api/core/learners/route.ts` shows plain inserts, no `publishEvent`/notification call in either). The only "onboarding" artifact in the platform is the **parent invite** (`student_invites` table, Workflow 9 below), which is opt-in and separately triggered by the teacher, not automatic.
- **Determination**: "Learner Onboarding" as a named workflow **does not exist separately from Admission** — it is the same single write.

### 3. Class Allocation
- **VERIFIED**, restated from Sprint 6B (not re-derived): `teacher_classes` (legacy, de-facto canonical, 34-file usage) vs. `classes` (Core, isolated, 1 repository + few callers). A learner is allocated to a class via `class_students` (legacy) or `learner_enrollments` (Core) — two non-communicating enrollment tables (Stage 0.5).
- **Start**: teacher/admin adds a student to a class row. **End**: `class_students`/`learner_enrollments` row exists with `status = 'active'`.
- **Approval point**: none.
- **Admin vs. Academics**: not separated — same actor, same request, as Admission.

### 4. Teacher Assignment
- **VERIFIED**, restated from Sprint 6B/ADR-0002: `teachers.id` is the ratified canonical teacher identity. Assignment to a class is `teacher_classes.teacher_id` (a class *has one* teacher, set at class-creation time by the teacher creating their own class — self-assignment, not an administrative appointment). No separate "HR assignment" workflow, no admin-initiated "assign teacher X to class Y" route was found (`grep` for `teacher_id` writes in any `app/api/core/**` route other than `teacher_classes` self-creation returns none).
- **Determination**: **Teacher Assignment is self-service, not administratively granted** — there is no workflow where an Administration actor assigns a teacher to a class; a teacher creates their own class and is, by construction, its teacher.

### 5. Subject Allocation
- **VERIFIED**, restated from Sprint 6B: four representations (Core `subjects`, legacy free text on `students.selected_subjects`, curriculum `sow_learning_areas`, hardcoded `lib/curriculum/subjects.ts` catalogue driving the real teacher UI). Subject "allocation" to a class/teacher is implicit in which subject a teacher selects when creating content (SOW, lesson plan, assessment) against the hardcoded catalogue — there is no persisted "Teacher X is allocated Subject Y for Class Z" row anywhere (**VERIFIED absent** — no such table found in schema search).
- **Determination**: Subject Allocation is **not a tracked workflow at all** — it is re-declared, implicitly, on every content-creation action, with no canonical record of who teaches what.

### 6. Teaching
- **VERIFIED**, restated from Sprint 6C: not a distinct tracked entity — the composite of Teacher Assignment + Class + Subject Allocation. No "lesson delivery," "period," or attendance-of-teaching-occurring concept exists.

### 7. Assessment
- **VERIFIED**, restated from Sprint 5D–5I/6B/6C: `class_assessments`, correctly resolving `teacher_id`/`assessment_type_id` since Sprint 5F. `grade_id` FK 0% populated. `is_published` boolean gates report-card generation (see Workflow 8) but has no second-actor review — the same teacher who creates and marks an assessment also publishes it.
- **Approval point**: **VERIFIED, single-actor self-publish** — `is_published` is teacher-set with no distinct reviewer role (no `approved_by` column, no admin-side publish-override route found for the legacy assessment pipeline; Core's `app/api/core/assessments/route.ts` publish action is `canManageAssessment`-gated to admin-tier-or-class-teacher, i.e. still one of the same two roles that created the data, per Sprint 1B).
- **Admin vs. Academics**: Academics-only; Administration never touches assessment content, consistent with 6C Q1/Q2.

### 8. Evidence
- **VERIFIED**, restated from Stage 0.5/6C: `learner_evidence` anchored to `students.id`. Evidence rows are produced automatically as a side effect of Assessment marking/upload (`lib/intelligence/evidenceLifecycle.ts`), not a separately actor-initiated workflow. Mutation only via the four lifecycle functions (`confirmReview`, `rejectReview`, `retractEvidence`, `eraseEvidence`) enforced by a DB trigger (CLAUDE.md, Constitution).
- **Approval point**: **VERIFIED, exists and is real** — `confirmReview`/`rejectReview` are genuine second-step actions distinct from evidence creation, making Evidence the **one workflow in this audit with a real, enforced two-state approval gate** (`pending_review` → `confirmed`/`rejected`). Actor for both steps: the same teacher (no distinct reviewer role found).

### 9. Parent Communication — three non-communicating mechanisms
This workflow was not examined in detail by 6A–6C. Traced fully this session.

- **Mechanism A — `student_invites` + `parent-link-student`** (`app/api/parent/link-student/route.ts`): teacher generates an invite token (write path not shown in this file — token presumably created alongside student add, `app/api/teacher/classes/[classId]/students/route.ts`); parent redeems it, setting `students.parent_user_id`. **VERIFIED**: single-use (`used_at` check), expiring (`expires_at` check), idempotent for the same user.
- **Mechanism B — `class_invites` + `/api/class/join`** (`app/api/class/join/route.ts`): teacher shares one reusable class-level invite code; any parent who redeems it gets bulk-linked, via `class_students.parent_id`, to **every currently-unlinked student in that class** (`.update({ parent_id: userId }).eq('class_id', ...).is('parent_id', null)`, lines ~65-70). **VERIFIED, notable risk shape**: this mechanism cannot target a specific child — the first parent to redeem a class code is linked to *all* unlinked classmates, not just their own child. No code-level restriction prevents a parent from linking to a class they have no actual child in, beyond possessing the code.
- **Mechanism C — Core's `learner_guardians`**: used by `app/api/reports/report-card/mine/route.ts` (`repos.schools.listGuardianLearners`) — a third, Core-native linking table, isolated from both A and B (consistent with Stage 0.5's finding that Core tables are functionally isolated from the legacy pipeline).
- **VERIFIED, three parent-identifier columns simultaneously live and non-communicating**: `students.parent_user_id` (Mechanism A), `class_students.parent_id` (Mechanism B, explicitly flagged in the route's own code comment as "a third mechanism... not modeled by any Sprint 1A canonical function... left completely untouched, per the Discovery Rule"), and Core's `learner_guardians` (Mechanism C). A parent linked via one mechanism is not visible to code paths reading another.
- **Notification layer**: `lib/notifications/notify.ts` fires email + WhatsApp (`lib/whatsapp/sender.ts`) in parallel, gated per-student on `notification_whatsapp && whatsapp_opted_in && parent_phone` (`app/api/parent/whatsapp-optin/route.ts` sets the opt-in flag). This is **VERIFIED functionally separate from all three linking mechanisms above** — it fires off `students` row flags directly, regardless of which linking mechanism connected the parent.
- **Approval point**: none in any mechanism — redemption is immediate and irreversible (no "pending parent link, awaiting teacher confirmation" state).
- **Admin vs. Academics**: entirely Academics-side (teacher-initiated invites); Administration has no visibility into or control over parent linking in any of the three mechanisms.

### 10. Promotion
- **VERIFIED**, restated from Sprint 6A/6B/6C: two tables (`learner_promotions` Core, `student_promotions` legacy), both zero live rows, both API-only with explicitly documented "no UI yet" (`app/api/teacher/students/[studentId]/promote/route.ts` code comment, cited in 6C). `student_promotions.to_grade NOT NULL` makes graduation structurally unrepresentable in the legacy table.
- **Approval point**: **UNKNOWN, cannot be determined** — no UI exists to know what a real approval flow would look like; the API schema requires no reviewer/co-signer field in either table.

### 11. Graduation / Exit
- **VERIFIED**, restated from Sprint 6C: `lib/core/promotions.ts:38-42` sets `learners.status = 'graduated'` inside the Core pipeline only, unreachable by UI. The legacy pipeline cannot represent this event at all (`to_grade NOT NULL`). **No pilot teacher today has any reachable way to graduate a student.**

### 12. Withdrawal — NEW this session
- **VERIFIED**: `withdrawLearner(learnerId, termId)` (`lib/core/learners.ts:90-92`) → `repos.learners.updateEnrollmentStatus(learnerId, termId, 'withdrawn')`, reachable via `app/api/core/learners/[id]/route.ts:86` (Core pipeline only — no legacy/`students`-table equivalent found anywhere in the codebase; `grep` for `'withdraw'` across `lib`/`app` returns only the five files cited at the top of this session's research, all Core).
- **VERIFIED, silent incompleteness**: `updateEnrollmentStatus` writes `'withdrawn'` to `learner_enrollments.status` only. `learners.status` (the learner's top-level lifecycle field, `LearnerStatus` enum `active | transferred | graduated | archived | deceased` — **no `'withdrawn'` member exists in the type at all**, `types/core.ts:33-38`) is never touched by this function. **A withdrawn learner's own record continues to read `status: 'active'`** — any code path that filters learners by top-level `status` (e.g. an active-roster query) will not exclude a withdrawn learner; only a query that separately checks `learner_enrollments.status` would catch it.
- **Approval point**: none. **Admin vs. Academics**: Core-gated to school-admin-tier (per the route's use of `requireSchoolAdmin`-family checks established in Sprint 1B for this route group) — the one lifecycle-exit workflow that is actually Administration-owned, but it is unreachable (no UI found calling `app/api/core/learners/[id]` withdraw action — `grep` for this endpoint outside `app/api` returns nothing) and incomplete even when called directly.

### 13. Transfer — NEW this session
- **VERIFIED**: `transferLearner()` (`lib/core/transfers.ts:4-31`), reachable via `app/api/core/transfers/route.ts`, Core pipeline only (no legacy equivalent — `find`/`grep` for "transfer" across the repo returns only `lib/core/transfers.ts` and its route). School-admin-gated (`requireSchoolAdmin`) with explicit cross-school ownership check (`assertLearnerOwnership`).
- **Data created**: a `LearnerTransfer` audit row (`from_school_id`, `to_school_id`/`to_school_name`, `direction`, `reason`, `document_urls`, `processed_by`) — **this is the only workflow in the audit that records a document trail** (`document_urls: z.array(z.string().url())`).
- **Side effects, direction `'out'` only**: `learners.status = 'transferred'` **and** `withdrawActiveEnrollments(learnerId, 'transferred')` (both correctly applied — contrast with Withdrawal's incompleteness above; Transfer-out is internally consistent because it updates both the top-level status and the enrollment status in the same call, `lib/core/transfers.ts:24-28`).
- **Approval point**: none beyond the admin-tier gate itself (no second-signer, no receiving-school confirmation for direction `'in'`, no accept/reject step — a `to_school_id` transfer-in is recorded unilaterally by whichever school's admin calls the route).
- **Admin vs. Academics**: **VERIFIED, cleanly Administration-owned** — this is the one workflow in the entire audit gated to school-admin-tier with no teacher-equivalent path, and it is the most correctly modeled state transition found (status + enrollment updated together, atomically, at the `lib/` layer). It shares Graduation's and Withdrawal's problem, however: **no UI caller was found** (`grep` across `app/**/*.tsx` for `core/transfers` returns nothing) — correctly designed, unreachable in practice, same as End-of-Term.

### 14. Report Generation
- **VERIFIED**, restated from Stage 0.5/6C, extended this session: two independent pipelines. (a) Legacy AI auto-report off `assessments` — the only one producing real parent-facing output today. (b) Core's `school_report_cards`/`term_subject_summaries`, driven by `generateReportCards`/`publishReportCards` (`lib/core/report-cards.ts`), zero production rows.
- **NEW this session**: Core's report generation is not actually standalone — it is one stage inside the End-of-Term orchestration (`lib/core/endOfTerm.ts:60-66`), which is the best-designed workflow found in this audit and is detailed as its own entry below (Workflow 15) because it is the only true multi-stage, gated, cross-cutting workflow in the codebase.
- **Approval point**: `publishReportCards` is a distinct step from `generateReportCards` (generate → review (implicitly) → publish), but no code enforces a human review in between — `runEndOfTerm` calls both back-to-back with no waiting state (Workflow 15 below).

### 15. End-of-Term Orchestration — the platform's only real multi-stage workflow
- **VERIFIED**: `runEndOfTerm()` (`lib/core/endOfTerm.ts:46-76`), reachable via `app/api/core/school/end-of-term/route.ts`, `requireSchoolAdmin`-gated.
- **Sequence, all in one synchronous call**: (1) **lock check** — every assessment for the class/term must already be `is_published`; if not, the whole call fails and returns the list of unpublished assessments (a genuine, code-enforced Academics-must-finish-first gate, per the route's own comment: *"a teacher must explicitly publish every assessment first"*). (2) aggregate scores (`computeTermSummaries`). (3) generate report cards. (4) publish report cards. (5) prepare next term (idempotent re-use if the term already exists, guarding the unique-constraint race).
- **This is, structurally, the one workflow in the codebase that models a real Academics→Administration hand-off**: Academics (teachers) must complete and publish all assessments; Administration (school admin) then triggers the aggregation/report/next-term cycle, which is *blocked* until Academics' side is done. It is the single clearest example of the "approval point" and "ownership transition" concepts this sprint was asked to find.
- **VERIFIED, zero UI callers**: exhaustive `grep` for `end-of-term`/`endOfTerm` across all `.tsx` files under `app/` returns only marketing-copy text on the public landing page (`app/(marketing)/page.tsx:416,512,700` — plain English sentences about "end-of-term averages" and "end-of-term exam," not references to the route or function). **No admin dashboard, button, or form anywhere in the product calls this endpoint.** The best-designed workflow in the platform is completely dormant.

---

## Specific Questions

**1. Which workflows currently exist (reachable, in a real UI, today)?**
**VERIFIED**: Admission (legacy path), Class Allocation, Teacher Assignment (self-service), Assessment (create/mark/publish), Evidence (create/confirm/reject), Parent Communication Mechanisms A and B, Legacy Report Generation (AI auto-report). Seven workflows reachable by a real pilot user.

**2. Which workflows are partially implemented?**
**VERIFIED**: Withdrawal (updates enrollment status, silently leaves `learners.status` unchanged — no `'withdrawn'` state exists at all); Report Generation Core pipeline (generate/publish functions exist and are correct, but zero production adoption, per Stage 0.5). **LIKELY**: Subject Allocation (no persisted allocation record — every read re-derives it from content, so "partial" understates it; see Q3).

**3. Which workflows are completely absent?**
**VERIFIED**: Learner Onboarding as a concept distinct from Admission does not exist. A genuine "Teacher Appointment" workflow (administration assigning a teacher to a class) does not exist — assignment is self-service only. A persisted Subject Allocation record does not exist anywhere. Promotion and Graduation, while their tables and functions exist, have zero reachable entry point (restated from 6C) and are functionally absent from the live product. Transfer and End-of-Term, while both correctly built and reachable via API, have zero UI entry point — functionally absent for any real user who is not calling the API directly.

**4. Which workflows incorrectly combine multiple responsibilities?**
**VERIFIED**: Admission — a single class-teacher action performs what should be an Administration act (enrolling a learner in the school) and an Academics act (assigning them to a specific class) in one indivisible write, with no institutional admission decision in between. Assessment publish — the same actor who creates and marks an assessment also publishes it with no second reviewer, combining "produce" and "certify" into one role.

**5. Which workflows have no defined owner?**
**VERIFIED**: Subject Allocation (no table, no actor formally responsible — implicitly whoever picks a subject off the hardcoded catalogue when creating content). Promotion (API-only, and the code comment documenting "no UI yet" does not name a future owning role either). Parent Communication as a *whole* — no single actor or route owns reconciling the three non-communicating linking mechanisms; each was built independently (per the `parent/alerts/route.ts` code comment: "First found in Batch B's clinic/[reportId]/url route; confirmed here in a second file... left completely untouched, per the Discovery Rule").

**6. Which workflows end without a proper lifecycle completion?**
**VERIFIED**: Withdrawal (enrollment marked withdrawn, learner status never updated — the record never reaches a terminal, consistent state). Admission (no confirmation, no downstream onboarding trigger — the workflow just stops after the insert). Promotion/Graduation (both, restated from 6C, have functions that would complete the lifecycle correctly but are unreachable, so *in practice* no real learner's lifecycle ever completes through them).

**7. Where should Administration hand work to Academics?**
**VERIFIED example that already exists, correctly, in code**: End-of-Term's lock check — Academics (teachers publishing assessments) must finish before Administration's aggregation stage can run. This is the one clean, code-enforced example of a hand-off direction the audit found. **LIKELY, not currently modeled**: Admission — institutionally, Administration should register a learner into the school (assign UPI, confirm documents) before Academics assigns them to a class/subject roster; today these are the same single write by the same actor, so no such hand-off exists to observe.

**8. Where should Academics hand work back to Administration?**
**VERIFIED example that already exists, correctly, in code**: End-of-Term's report-generation/publish stage is itself the hand-back — once Academics' assessments are locked, Administration receives the aggregated output. **LIKELY, not currently modeled**: Promotion/Graduation — a real school would expect Academics (a class teacher, having observed a full year's evidence) to *recommend* a promotion or graduation, with Administration then formally recording/certifying it; today's promotion functions take no recommending-actor field distinct from the recording actor, so no such recommend→certify hand-off can be observed in code.

**9. Which workflows will become foundational for future Intelligence features?**
**VERIFIED**: Evidence (already the anchor for the entire Learner Record Layer/Projection stack, per CLAUDE.md and `docs/architecture/learner-record-layer-decisions.md`) and Assessment (Evidence's sole producer today) are unambiguously foundational — restated, not new. **LIKELY**: Withdrawal/Transfer/Graduation, once actually reachable, would be the first source of *lifecycle-boundary* evidence (a clean "this learner's record ends here, for this reason" signal) that the current Learner Record Timeline (`lib/learnerRecord/timeline.ts`) has no equivalent input for today — worth flagging for a future sprint, not claimed as built.

---

## Cross-Workflow Pattern Summary

- **No workflow in this codebase has more than one true approval gate.** Evidence's confirm/reject step is the only genuine second-state approval found; End-of-Term's assessment-publish lock is the only genuine cross-actor block found. Every other workflow is single-actor, single-write, immediate.
- **The three best-designed workflows (Evidence lifecycle, Transfer, End-of-Term) are all Core-pipeline or lifecycle-function code with little-to-no UI reachability**, while the three most-used workflows (Admission, Class Allocation, Parent Communication Mechanism B) are the least structurally sound (no approval point, silently combined responsibilities, non-communicating parallel mechanisms). Correctness and reachability are, in this codebase, close to inversely correlated.
- **Every "hand-off" this audit could point to concretely (End-of-Term's two directions) exists within a single function call, not as a persisted, waiting, cross-session state.** There is no `pending_admin_action` or equivalent table anywhere — "hand-off" today means "the next line in the same function," never "notify a different actor and wait."

---

## What This Document Does Not Do

Per its own scope: it does not propose a workflow engine, approval-state schema, or notification-unification design — no evidence gathered here shows which of these gaps the pilot's 50 teachers have actually hit versus which are latent risks with zero production consequence so far (Withdrawal's incompleteness, for example, has caused zero known incidents — no withdrawn learner has been reported as still appearing "active" — this is a code-shape risk, not a confirmed production bug). It does not recommend an implementation order for closing any gap found.

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

STOP after this audit. No implementation performed. No workflow engine or approval-state model proposed for building. No entity or table recommended for creation without direct evidence of need. Awaiting further instruction before any Sprint 6E.
