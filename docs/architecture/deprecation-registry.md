# EduNexus Deprecation Registry

Whenever legacy architecture is replaced under Phase A (or any future stabilization work), it is recorded here before deletion. Nothing is silently deleted — every entry exists from the moment a canonical replacement is *designated* (even before the legacy code is actually removed), so the registry always reflects intent as well as final state.

**Removal Status values:** `IDENTIFIED` (canonical replacement designated, legacy code still live and in use) → `MIGRATING` (callers being moved to the replacement) → `OBSERVING` (all callers migrated, legacy code kept unreferenced for an observation window per the Seventh Law) → `REMOVED` (deleted, with commit reference).

---

### 1. `lib/assessments/mutations.ts::createAssessment`

- **Replacement:** `lib/core/assessments.ts::createAssessment`
- **Reason:** Two implementations wrote to the same `class_assessments`/`learner_marks` tables independently, violating the First Law (one canonical service per concept). The Core implementation was chosen as canonical because it already operates under the school-membership/role model and the tables it targets are the ones `school_report_cards`/`term_subject_summaries` depend on downstream.
- **Migration Stage:** Phase A, Stage 4.
- **Removal Status:** `IDENTIFIED`. Not yet migrated or removed.

### 2. `teacher_classes` (table) and its creation path `app/api/teacher/classes/route.ts`

- **Replacement:** `classes` / `streams` (tables), `lib/core/classes.ts::createClass`/`createStream` (service).
- **Reason:** Two non-communicating class-management systems — one teacher-private with no school linkage at all (`teacher_classes` has no `school_id` FK), one school-admin-owned and role-gated (`classes`). Violates the Third Law directly: a class in `teacher_classes` has no School owner. Also violates the CLAUDE.md thin-route rule as written today (creation logic lives inline in the route, not in `lib/`).
- **Migration Stage:** Phase A, Stage 5 (deferred — requires a Supabase-branch dry run before any DROP, per the Seventh Law).
- **Removal Status:** `IDENTIFIED`. No migration has begun; Stage 5 has not started.

### 3. `class_students` — legacy FK space (`class_id → teacher_classes.id`)

- **Replacement:** `class_students` — Core FK space (`class_id → classes.id`).
- **Reason:** Two tables share the exact same name with different foreign-key targets. This is flagged as the single most dangerous latent landmine in the codebase found during the audit: any future query or AI-assisted edit that greps for `class_students` can silently target the wrong FK space with no compiler or runtime signal that it's wrong. Must not be resolved by renaming alone — the underlying `teacher_classes` migration (#2 above) has to land first, since this table's legacy rows only make sense in relation to it.
- **Migration Stage:** Phase A, Stage 5 (bundled with #2, same dry-run gate).
- **Removal Status:** `IDENTIFIED`.

### 4. Ranking implementations: `buildPositionMap`, `getCohortData` inline rank, `updateClassPositions`, `lib/core/report-cards.ts` inline sort, `assessment.repository.ts::saveScores`

- **Replacement:** `lib/ranking` (`computeRankings()`) — built in Sprint 3A (docs/engineering/implementation-log.md, 2026-07-15). Note: the original replacement name in this entry (`rankingEngine.ts`'s `rankByScore`/`combineStreamRankings`) was the planning-time placeholder; the engine actually built exports a single function, `computeRankings()`, with the same responsibility.
- **Reason:** Five independent ranking implementations were confirmed computing the same conceptual thing (Sprint 3 Assessment Domain Audit, `docs/engineering/sprint-3-assessment-domain-audit.md` §4) — not three, as this entry originally estimated. Three of the five (`updateClassPositions`, `lib/core/report-cards.ts` inline sort, `assessment.repository.ts::saveScores`) do not handle ties correctly or, in `saveScores`'s case, do not rank at all — a confirmed correctness bug reaching published, parent-facing report cards via the `report-cards.ts` path. `buildPositionMap`'s tie-handling logic is the one that was preserved as the engine's core algorithm, not discarded.
- **Migration Stage:** Phase A, Stage 2. **Per-implementation status** (updated as each migrates, per this document's own "update whenever a stage completes" rule):
  - `buildPositionMap` (`lib/assessments/mutations.ts`) — **MIGRATED**, Sprint 3B, 2026-07-15. Mechanical (already behaviourally identical), no output change.
  - `getCohortData` inline rank (`assessment.repository.ts`) — **MIGRATED**, Sprint 3B.2, 2026-07-15. Mechanical, no output change.
  - `updateClassPositions` (`lib/core/assessments.ts`) — **MIGRATED**, Sprint 3C, 2026-07-15. **Behaviour-changing**: tied `weighted_score`s within a subject now correctly share a position, where they previously received arbitrary, database-row-order-dependent distinct positions. See implementation log entry for full before/after.
  - `lib/core/report-cards.ts` inline sort (`generateReportCards`) — **MIGRATED**, Sprint 3D, 2026-07-15. **Behaviour-changing, parent-facing**: tied overall averages (including multiple learners with zero scores, `avg=0`) now correctly share a class position on `school_report_cards.position_in_class`, where they previously received arbitrary, enrollment-order-dependent distinct positions. Only affects report cards generated after this deploy — already-published cards are untouched until their next generation+publish cycle. See implementation log entry for full before/after.
  - `assessment.repository.ts::saveScores` — **MIGRATED**, Sprint 3E, 2026-07-15 (**FINAL**). **Correctness repair, not a tie-handling addition**: the deleted implementation assigned `position: i+1` in raw request-array order with no ranking computation at all — the most severe of the five (e.g. ascending-order requests would fully invert positions, ranking the best-scoring learner last). Now correctly rank-derived and tie-aware. Historical `learner_marks.position` values written before this deploy are explicitly untouched (no backfill performed or proposed) — only future `saveScores` calls are corrected.
- **Removal Status:** **`MIGRATED` — CLOSED, 2026-07-15.** All 5 implementations are replaced; `lib/ranking`'s `computeRankings()` is now the sole ranking algorithm in the Assessment domain. Final verification (Sprint 3E, `docs/engineering/implementation-log.md`): grepped for manual `i+1` position-assignment loops, hand-rolled tie-check loops (`if (i > 0 && ...)`), and duplicated descending-sort-for-ranking patterns across `lib/` and `app/` — zero remaining outside `lib/ranking/ties.ts` itself. No further action needed on this entry.

### 5. Duplicated inline `toCbcLevel` closures / grading boundary duplication

- **Location (original scope):** `lib/core/report-cards.ts` and `lib/core/assessments.ts`, both hardcoding the same 75/50/25 CBC-level boundaries verbatim instead of calling a shared module.
- **Superseded finding (Sprint 4B, `docs/engineering/sprint-4b-grading-policy-ratification.md`):** a repo-wide sweep found this is not 2-3 duplicates but **5 distinct live boundary sets** across Assessment, Evidence, Assignments, and Notifications domains, and — more importantly — that the boundary *values themselves* disagree (75/50/25 vs 76/51/31 vs 75/50/30 vs 75/55/40 vs 80/60/40), making this a curriculum/policy question, not just a code-duplication one. No authoritative KICD source was found in-repo to settle correctness between any of them; that remains an open human decision.
- **Corrected replacement target:** `lib/grading` (`gradeScore()`, built Sprint 4A) — the original entry's stated replacement (`gradeCalculator.ts`'s `marksToLevel`/`resolveLevel`/`marksToLevelForSchool`) was itself a wrong-typed target (numeric `CBCLevel` 1-4, Evidence-Domain-owned) for these string-letter (`'EE'|'ME'|'AE'|'BE'`) closures — see the Sprint 4A implementation log entry for the full correction.
- **Reason:** A grading-policy change today would need to be made in multiple places, most of which are silent duplicates or near-duplicates of each other.
- **Migration Stage:** Sprint 4 (4A engine foundation → 4B/4C0 policy-flow audits → 4C1 first migration, below). **Per-implementation status:**
  - `lib/core/assessments.ts`'s inline `toCbcLevel` (`computeTermSummaries`) — **MIGRATED**, Sprint 4C1, 2026-07-15. Mechanical (same `gradeBoundaries` parameter, same 75/50/25 fallback defaults, same source — `school_settings.grade_boundaries` via `SchoolRepository`, unchanged), no boundary-value change. Activates the previously-dormant per-school override through the canonical engine for the first time (Sprint 4C0's Option B decision).
  - `lib/core/report-cards.ts`'s inline `toCbcLevel` (`generateReportCards`) — **MIGRATED**, Sprint 4C1, 2026-07-15. Same mechanical migration, same source, no boundary-value change. Parent-facing surface — see implementation log entry for the explicit note that `generateReportCards`'s known re-generation/publish-guard gap (Sprint 4C0 Part 5) was NOT touched by this migration, per explicit instruction to keep it isolated as a separate production-integrity defect.
  - `lib/assessments/gradeCalculator.ts`'s `BUILTIN_CBC_SCALE` (76/51/31) — **not migrated**. Independent gradebook-domain boundary set; the 75-vs-76 correctness question remains unresolved (Sprint 4B/4C0), so this was not touched.
  - `assessment.repository.ts::gradeLevelFromScore` — **MIGRATED, Sprint 4I, 2026-07-15.** The Sprint 4E blocker (no `school_id` reachable from `getAssessmentAnalytics`/`getCohortData`) was closed by Sprint 4F/4G's reverse identity lookup (`SchoolRepository::findSchoolIdByTeacherId`, reusing the already-existing, already-populated `teachers.user_id ↔ school_users.user_id` bridge — no new table/FK). `gradeLevelFromScore` itself was deleted and replaced with `buildCbcScale()`/`toCbcGrade()`, delegating to `lib/grading::gradeScore()` — same pattern as Sprint 4C1's `computeTermSummaries`/`generateReportCards` migration. `getAssessmentAnalytics`/`getCohortData` gained an optional `gradeBoundaries` parameter (default `{}`, preserving the exact 75/50/25 fallback); `app/api/teacher/analytics/route.ts` and `app/api/teacher/cohort/[grade]/route.ts` now resolve it via a new shared `lib/core/school.ts::resolveTeacherGradeBoundaries(teacherId)` (schoolId → settings → boundaries, `{}` on any missing link — unbridged teacher, or a bridged school with no `school_settings` row yet). All 4 grading surfaces (Report Cards, Term Summaries, Analytics, Cohorts) now provably produce identical CBC grades for identical (score, boundaries) inputs — see `lib/repositories/gradingCrossPathParity.test.ts`.
  - `lib/assessments/gradeCalculator.ts`'s `BUILTIN_CBC_SCALE` (76/51/31) — **not migrated**. Independent gradebook-domain boundary set; the 75-vs-76 correctness question remains unresolved (Sprint 4B/4C0), so this was not touched.
  - Evidence-Domain's `cbcScale.ts` (75/50/30, numeric `CBCLevel`) — **out of scope**, different domain/type per CLAUDE.md's Evidence-ownership rules (Sprint 4A's correction).
  - `lib/curriculum/regional/ke-cbc.ts` (75/50/25) — **dead code**, zero callers found (Sprint 4D finding, not yet acted on).
  - Assignments-domain (75/55/40) and Notifications-domain (80/60/40) sets — **not migrated**, found in Sprint 4B, not yet scoped to any migration sprint.
- **Removal Status:** `MIGRATING` (5 of the ~7 known implementations replaced — `buildPositionMap`-equivalent grading paths for Report Cards, Term Summaries, Analytics, and Cohorts are all now canonical; `gradeCalculator.ts`, Evidence's `cbcScale.ts`, `ke-cbc.ts`, and the Assignments/Notifications sets remain — the underlying 75-vs-76 boundary-value ratification remains an open human decision independent of any code migration; do not mark `MIGRATED`/closed until the remaining implementations are addressed and/or deliberately accepted as permanently out of scope).

### 6. Legacy AI auto-report pipeline vs. Core `school_report_cards`

- **Location:** `lib/career/autoReportGenerator.ts`, `lib/academicClinic/assessmentPipeline.ts`, triggered from `app/api/teacher/assessments/process` and `app/api/teacher/classes/[classId]/generate-reports`, operating on the legacy per-student `assessments` table — versus `lib/core/report-cards.ts`'s `generateReportCards`, operating on `class_assessments`/`term_subject_summaries`.
- **Replacement:** **Not yet decided.** This is intentionally not marked with a designated canonical replacement, because resolving it requires first deciding what the legacy `assessments` table's relationship to School ownership even is (see the `NOT YET DECIDED` note in the Canonical Domain Registry's Report Card entry) — and because the AI auto-report path may be entangled with the Evidence Domain in ways that make a naive "delete one, keep the other" resolution violate the Fourth Law's Official-Records/Learning-Intelligence separation. This needs its own scoping pass, not a decision made in passing here.
- **Migration Stage:** Not assigned. Explicitly out of Phase A's named stages (0-5) as currently scoped.
- **Removal Status:** `IDENTIFIED` as a duplication; not `MIGRATING` — no direction has been chosen yet.

---

*Last updated: 2026-07-15, at Phase A's execution planning stage, before any stage has executed. Update this document whenever a stage completes, per the Quality Gates — every stage's Migrating/Observing/Removed transitions get recorded here, not just the initial identification.*
