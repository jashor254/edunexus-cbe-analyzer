# EduNexus Canonical Domain Registry

**This is the Constitution of EduNexus.** Every major educational concept is defined here exactly once: its canonical table, canonical service, canonical API, canonical owner, and canonical workflow. Per the Fifth Law, before introducing any new table/API/service/workflow/business rule/column/module, check this registry first — if a canonical implementation already exists, extend it; never duplicate it.

**Status column meaning:** `CANONICAL` = this is the one true implementation, in production use, nothing else should write to this domain. `TARGET (Phase A)` = this is what Phase A's execution plan (`docs/architecture/phase-a-execution-plan.md`) designates as canonical, not yet fully true in production — a legacy competitor still exists and is tracked in the [Deprecation Registry](deprecation-registry.md) until removed. `NOT YET DECIDED` = a genuine open architectural question, flagged rather than silently resolved.

This document is updated at the end of every Phase A stage, per the Quality Gates requirement that no stage completes without the registry being updated.

---

## School (the root of ownership)

- **Canonical Table:** `schools`
- **Canonical Service:** `lib/core/school.ts` / `lib/repositories/school.repository.ts`
- **Canonical API:** `app/api/core/school/**`, `app/api/school/**` (membership/role reads)
- **Canonical Owner:** N/A — School is the owner, not something owned.
- **Canonical Workflow:** School created once (onboarding), then all Academic Years/Terms/Classes/Assessments/Report Cards reference it via `school_id`.
- **Status:** `CANONICAL`.

## Academic Year / Term

- **Canonical Table:** `academic_years`. Term identifier type is **NOT YET DECIDED** — `school_report_cards.term_id` and `term_subject_summaries.term_id` exist but no dedicated `terms` table was confirmed to exist during the audit; Stage 3 of Phase A must confirm this before adding `class_assessments.term_id` (flagged as an open item in the Stage 3 migration draft).
- **Canonical Service:** Not yet centralized — currently read inline wherever `academic_years`/term fields are queried.
- **Canonical API:** None dedicated; embedded in `app/api/core/classes`, `app/api/core/assessments`.
- **Canonical Owner:** School (`academic_years.school_id`).
- **Canonical Workflow:** Not yet formalized.
- **Status:** `NOT YET DECIDED` for the Term concept specifically; `CANONICAL` for Academic Year as a table.

## Class / Stream

- **Canonical Table (target):** `classes`, `streams`.
- **Legacy competitor (to be removed):** `teacher_classes` — see [Deprecation Registry](deprecation-registry.md).
- **Canonical Service:** `lib/core/classes.ts` (`listClasses`, `getClass`, `createClass`, `updateClass`, `assignSubjectTeacher`, `listClassSubjects`, `listStreams`, `createStream`, `listGrades`).
- **Canonical API:** `app/api/core/classes/**`.
- **Canonical Owner:** School (`classes.school_id`).
- **Canonical Workflow:** School-admin/headteacher/deputy-headteacher creates a class → assigns a stream → assigns subject teachers. Teacher-initiated class creation (currently `app/api/teacher/classes/route.ts`, writing directly to `teacher_classes`) is being migrated to call this same canonical service instead of maintaining its own table (Phase A Stage 5).
- **Status:** `TARGET (Phase A)` — not yet true; `teacher_classes` is still live and actively written to as of this registry's creation.

## Class Roster / Learner Membership

- **Canonical Table (target):** `class_students` (Core FK space — `class_id → classes.id`).
- **Legacy competitor (to be removed):** `class_students` (legacy FK space — `class_id → teacher_classes.id`, same table name, different foreign key target — see [Deprecation Registry](deprecation-registry.md) for why this is especially dangerous to leave unresolved).
- **Canonical Service:** `lib/core/classes.ts` (roster operations layered on `repos.teachers`/`repos.schools`).
- **Canonical API:** `app/api/core/classes/**`.
- **Canonical Owner:** School, via the owning `classes` row.
- **Status:** `TARGET (Phase A)`.

## Learner (Student)

- **Canonical Table:** `students`.
- **Canonical Service:** `lib/repositories/learner.repository.ts` / `lib/repositories/teacher.repository.ts` (student CRUD is currently split across these — a candidate for a future canonicalization pass, not scoped into Phase A's named stages, flagged here rather than silently ignored).
- **Canonical Owner:** School — **not yet enforced at the schema level**: `students` has `teacher_id` (nullable) but no `school_id` column was confirmed during the audit. This is a gap relative to the Third Law ("Schools own Learners") that Phase A's named stages (0-5) do not currently address. Flagged as an open item for Phase A+1 scoping, not silently assumed solved.
- **Status:** `NOT YET DECIDED` for school ownership enforcement; `CANONICAL` for the table itself as the one learner record.

## Assessment (Official School Record)

- **Canonical Table (target):** `class_assessments` (extended with `school_id`/`academic_year_id`/`term_id`/`created_by`/`updated_by` per Phase A Stage 3), `learner_marks` for per-student scores.
- **Legacy competitor (partially retained — see below):** `lib/assessments/mutations.ts::createAssessment`, to be deleted in Stage 4 in favor of `lib/core/assessments.ts::createAssessment`. The separate legacy per-student `assessments` table (used by the AI auto-report path) is **explicitly out of scope for Phase A's named stages** and is NOT being consolidated into `class_assessments` — see the Fourth Law note below.
- **Canonical Service (target):** `lib/core/assessments.ts` (`createAssessment`, `saveScores`, `publishAssessment`, `computeTermSummaries`, `getClassPerformanceSummary`).
- **Canonical API:** `app/api/core/assessments/**` (once Stage 1's authorization gap is closed and Stage 4's consolidation lands).
- **Canonical Owner:** School (`class_assessments.school_id`, added Stage 3).
- **Canonical Workflow:** Teacher (acting on the school's behalf, `created_by`) creates an assessment against a class → enters marks → school-admin publishes it → it feeds `computeTermSummaries` → report card generation.
- **Status:** `TARGET (Phase A)` — table shared today but two competing service implementations exist until Stage 4.

## Ranking / Class Position

- **Canonical Table:** `learner_marks.position_rank` (new, Stage 2), `school_report_cards.position_in_class`, `term_subject_summaries.position_in_class`.
- **Legacy competitors (to be removed):** `buildPositionMap` (`lib/assessments/mutations.ts`), the inline sort in `lib/core/report-cards.ts`, `updateClassPositions` (`lib/core/assessments.ts`), the ad-hoc combination in `lib/assessments/cohortQueries.ts` — see [Deprecation Registry](deprecation-registry.md).
- **Canonical Service (target):** `lib/ranking/rankingEngine.ts` (`rankByScore`, `combineStreamRankings`) — built in Stage 2.
- **Canonical Owner:** N/A — a computation, not owned data; the School owns the class the ranking is computed over.
- **Status:** `TARGET (Phase A)` — engine does not exist yet as of this registry's creation.

## Report Card

- **Canonical Table:** `school_report_cards`.
- **Legacy competitor (partially retained, not resolved by Phase A's named stages):** the AI auto-report path (`lib/career/autoReportGenerator.ts`, `lib/academicClinic/assessmentPipeline.ts`, triggered from `app/api/teacher/assessments/process` and `app/api/teacher/classes/[classId]/generate-reports`) generates a *different* report artifact from the legacy `assessments` table. This is flagged here explicitly as an unresolved duplication the Canonical Domain Registry cannot yet mark `CANONICAL` for — see the open item at the end of `phase-a-execution-plan.md`.
- **Canonical Service:** `lib/core/report-cards.ts` (`generateReportCards`, `updateReportCard`, `publishReportCards`, `getReportCard`, `listClassReportCards`).
- **Canonical API:** `app/api/core/reports/**` (generation/publish, admin-gated), `app/api/reports/report-card/**` (parent-facing read, guardian-link + `is_published` gated).
- **Canonical Owner:** School (`school_report_cards.school_id`).
- **Canonical Workflow:** Assessments published → `computeTermSummaries` → `generateReportCards` (unpublished) → school-admin `publishReportCards` → parent-visible.
- **Status:** `CANONICAL` for the Core pipeline itself; `NOT YET DECIDED` for whether/how the AI auto-report path is retired or kept as a genuinely separate artifact.

## Learning Intelligence / Evidence Domain (independent domain, per the Fourth Law)

Listed here **not** because it is being consolidated under the School Core, but precisely because the Fifth Law requires checking this registry before building anything new — and the correct answer for anything Learning-Compass/Adaptive-Learning/Diagnostics/Academic-Clinic/Remediation-shaped is "this already exists, go there, do not build a School-Core equivalent."

- **Canonical Table:** `learner_evidence` (Evidence Domain), plus the projection tables read by `lib/projection/recompute.ts`.
- **Canonical Service:** `lib/intelligence/evidenceLifecycle.ts` (`confirmReview`, `rejectReview`, `retractEvidence`, `eraseEvidence`, `updateVerificationState`), `lib/projection/recompute.ts` (`recomputeLearnerProjection`), `lib/learnerRecord/timeline.ts` (`getLearnerTimeline`).
- **Canonical Owner:** The Learner Profile — explicitly **not** the School, per the Fourth Law. This is the one domain in this entire registry where School ownership does not apply, by design.
- **Canonical Workflow:** Official Assessments (once created via the canonical Assessment service above) write evidence *into* this domain one-way, via `lib/assessments/evidence.ts`/`lib/assessments/reportCardEvidence.ts` — evidence flows from Official Records into Learning Intelligence, never the reverse, and the two domains' tables are never merged.
- **Status:** `CANONICAL` — already stable, already audited in a prior series (Sprints 22-31, see project memory), explicitly untouched by Phase A.

---

*Last updated: 2026-07-15, at the definition of Phase A's execution plan — before any stage has executed. Update this document at the close of every stage, per the Quality Gates.*
