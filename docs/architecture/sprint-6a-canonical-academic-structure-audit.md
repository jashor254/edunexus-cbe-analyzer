# Sprint 6A — Canonical Academic Structure Audit

**Mode: READ ONLY.** No code was modified. No schema change is proposed in this document — per the sprint's own instruction, schema proposals are explicitly deferred to a later phase. This is an evidence-based architectural audit and a phased roadmap recommendation only.

**Method**: direct schema inspection (`information_schema`, live row counts via read-only SQL), migration history (`git log`, migration file headers), and repository-wide code search. Builds on, re-verifies, and materially extends three prior audits already in this repository — `docs/architecture/stage-0-architectural-census.md`, `docs/architecture/stage-0.5-canonical-identity-resolution.md`, and ADR-0002 (`docs/architecture/adr/0002-canonical-teacher-identity.md`) — which covered Teacher and Class/Learner identity in depth but did not examine Academic Year, Term, Grade, Subject, or Promotion with the same rigor, and did not examine the curriculum/SOW domain's own parallel structures at all. Three genuinely new findings are reported here that no prior audit surfaced (§3).

---

## Executive Summary

EduNexus does not have one Academic Structure — it has **three**, not two. Beyond the already-documented legacy/Core split (`teacher_classes` vs. `classes`, `teachers` vs. `school_users`, already resolved for Teacher identity by ADR-0002), a **third, independent structure exists inside the curriculum/SOW domain** (`sow_grades`, `sow_learning_areas`) that Learning Compass and curriculum-context building consume directly, with no bridge to either the legacy or Core representations of Grade or Subject. Academic Year/Term has the same two-world split as everything else (Core's real `academic_years`/`terms` tables vs. free-text `term`/`year` columns on every legacy assessment table). Promotion has a confirmed, concrete duplicate table (`student_promotions`, legacy-anchored) built **two weeks after** Core's `learner_promotions` already existed — evidence this pattern is still actively recurring, not just a historical artifact to clean up. Attendance and Timetable do not exist as domains at all; nothing duplicates them because nothing has built them.

The overall shape matches every prior finding in this series exactly: **the legacy, teacher-first tables are the ones real production data and real code paths depend on; the Core tables are better-designed, better-owned, and functionally isolated.** This audit does not recommend reversing that finding — it extends it across the entities this sprint was scoped to cover, and adds the curriculum/SOW domain as a third party to the reconciliation that any future consolidation must account for.

---

## Part 1 — Canonical Source Identification

| Entity | Representations found | Row counts (live) | Which is canonical *in practice* | Evidence |
|---|---|---:|---|---|
| **Academic Year** | Core `academic_years` (real table, FK'd) vs. legacy free-text `academic_year`/`year` columns on `teacher_classes`, `class_assessments`, `learner_marks`, `student_promotions` (no entity at all) | Core: 1 | **Neither, cleanly** — Core has a real entity with almost no adoption (1 row); legacy has no entity, just scattered untyped strings/integers on every table that needs a year | `supabase/migrations/20260629_core_foundation.sql:20-24` (Core); `supabase/marksheet_migration.sql:14` (`year integer NOT NULL`, no FK); `supabase/teacher_portal_migration.sql:30` (`academic_year TEXT NOT NULL DEFAULT '2025'`) |
| **Term** | Core `terms` (real table, FK'd to `academic_years`) vs. legacy free-text `term` column, `CHECK (term IN ('1','2','3'))`, on every legacy assessment table | Core: 3 | **Legacy, by volume of dependent code** — every ranking/grading/analytics function in `lib/assessments/`, `lib/ranking/`, `lib/grading/` operates on the raw `'1'|'2'|'3'` string, never the Core `terms.id` | `20260629_core_foundation.sql:26-29` (Core); `supabase/marksheet_migration.sql:13` (legacy CHECK) |
| **Grade** | **Three**: Core `grades` (id/name/code/level_order/category, institutional) vs. legacy raw `teacher_classes.grade INTEGER CHECK (grade BETWEEN 7 AND 12)` (no entity) vs. curriculum/SOW `sow_grades` (id/numeric_grade/order_index/level_id, curriculum-content-oriented) | Core: 14; sow_grades: 13 | **Legacy raw integer, for class/roster purposes; `sow_grades`, for curriculum-content purposes** — the two never reconcile, and their row counts already diverge (14 vs. 13), confirming they are independently maintained, not mirrors | `20260629_core_foundation.sql:152-161` (Core); `supabase/teacher_portal_migration.sql:27-28` (legacy); live `information_schema` query, `sow_grades` table (§3) |
| **Stream/Class** | `teacher_classes` (legacy) vs. `classes` (Core) — already fully documented by Stage 0.5, re-confirmed unchanged | teacher_classes: 13; classes: 10 | **`teacher_classes`** — 42-file usage vs. 1-file, per Stage 0.5's census, re-confirmed this session (`teacher_classes` grep count unchanged) | `docs/architecture/stage-0.5-canonical-identity-resolution.md` Part 1, row "Class" |
| **Subject** | **Three**: Core `subjects` (id/name/code, school-agnostic) vs. legacy free-text `subject`/`subjects[]` columns (no entity) vs. curriculum/SOW `sow_learning_areas` (id/grade_id/name/short_name/kicd_subject_data, grade-scoped, curriculum-content-oriented) | Core: 48; sow_learning_areas: 195 | **Core `subjects`, for Assessment-domain purposes; `sow_learning_areas`, for curriculum-content purposes** — again, never reconciled; `sow_learning_areas` is grade-scoped (195 rows, roughly 14 grades × ~14 subjects) while Core's `subjects` is a flat, ungraded list of 48 | `20260629_core_foundation.sql` (Core `subjects`); `supabase/teacher_portal_migration.sql:29,56` (legacy free text); live `information_schema` query, `sow_learning_areas` table (§3) |
| **Teacher Assignment** | `teachers`/`teacher_classes.teacher_id` (legacy) vs. `school_users`/`classes.class_teacher_id` (Core) | teachers: 47; school_users: 48 | **`teachers`, ratified** — ADR-0002 already settled this: `teachers.id` is the canonical Teacher-domain business identity; `school_users` is a different domain (Permissions), not a competing Teacher identity | `docs/architecture/adr/0002-canonical-teacher-identity.md`, APPROVED |
| **Learner Enrollment** | `class_students` (legacy) vs. `learner_enrollments` (Core) — already fully documented by Stage 0.5, re-confirmed unchanged | class_students: 485; learner_enrollments: 405 | **`class_students`** — 32-file usage vs. 3-file, per Stage 0.5's census | `docs/architecture/stage-0.5-canonical-identity-resolution.md` Part 1, row "Class Roster / Enrollment" |

---

## Part 2 — Dependency Map: Administrative Unit → Downstream Systems

Only verified edges are shown. An entity with no arrow into a system means no code reference was found connecting them.

```
                          ┌─────────────────────────────────────────┐
                          │       ADMINISTRATIVE UNIT (School)        │
                          └─────────────────────────────────────────┘
                                            │
        ┌───────────────┬───────────────┬──┴──────────────┬────────────────┬──────────────────┐
        ▼               ▼               ▼                 ▼                ▼                  ▼
  Academic Year      Term          Grade (×3)          Subject (×3)   Teacher Assignment   Learner Enrollment
  (Core: mostly    (Core: mostly   Core/legacy-int/    Core/legacy-    (teachers, ratified  (class_students,
   unused;          unused;         curriculum-SOW      free-text/      ADR-0002)            de facto canonical)
   legacy: free     legacy: free    — 3 independent     curriculum-SOW
   text/int)        text)           tables              — 3 independent
        │               │               │                 │                │                  │
        └───────┬───────┴───────┬───────┴────────┬────────┴────────┬───────┴──────────┬────────┘
                ▼               ▼                ▼                 ▼                  ▼
          ┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌────────────┐    ┌──────────────┐
          │Attendance│   │ Assessments│   │ Assignments │   │ Timetable  │    │ Report Cards │
          │  ABSENT  │   │  (legacy   │   │  (legacy    │   │   ABSENT   │    │ (2 pipelines,│
          │no table, │   │ class_ass. │   │  table,     │   │ no table,  │    │  Stage 0.5)  │
          │no code   │   │ FK'd to    │   │  FK'd to    │   │ no code    │    │              │
          │found     │   │teacher_cl.,│   │ teacher_cl. │   │found       │    │              │
          │          │   │free-text   │   │/teachers,   │   │            │    │              │
          │          │   │term/year)  │   │free-text    │   │            │    │              │
          │          │   │            │   │subject,     │   │            │    │              │
          │          │   │            │   │0 live rows) │   │            │    │              │
          └──────────┘   └────────────┘   └─────────────┘   └────────────┘    └──────────────┘
                                            ▼
                                      ┌───────────┐        ┌──────────────────┐
                                      │ Promotion │        │ Learning Compass │
                                      │(TWO tables│        │ (own curriculum/ │
                                      │ same event│        │  SOW grade+      │
                                      │ type,     │        │  subject tables, │
                                      │ Core+     │        │  bypasses BOTH   │
                                      │ legacy,   │        │  Core grades AND │
                                      │ §3)       │        │  legacy raw int) │
                                      └───────────┘        └──────────────────┘
```

**Edge-by-edge evidence**:
- **Academic Year/Term → Assessments**: legacy edge only. `class_assessments.term`/`.year` are free strings/ints, never FK'd to Core's `terms`/`academic_years`. Every ranking/grading/analytics function (`lib/ranking/`, `lib/grading/`, `lib/assessments/analytics.ts`) reads these raw columns directly.
- **Grade → Assessments/Assignments**: legacy edge only, and even that is indirect — `class_assessments`/`assignments` don't carry `grade` themselves; grade is reached by joining through `teacher_classes.grade` (a raw integer). Core's `grades` table has no edge into Assessments at all (confirmed: `class_assessments`/`assignments` never reference `grades.id`).
- **Grade → Learning Compass**: a **separate, third edge** — `lib/compass/topicSelector.ts:55-64` resolves grade via `repos.curriculum.findGradeIdsByGrade(grade: number)`, which queries `sow_grades`, not Core's `grades` and not `teacher_classes.grade` directly (though the raw integer is what's passed in). Compass's curriculum-topic logic is entirely mediated by the curriculum/SOW grade table.
- **Subject → Assessments**: legacy edge only — `class_assessments.subjects` is a free-text array; Core's `subjects` table has no confirmed edge into `class_assessments` at all (no FK, no join found in `lib/core/assessments.ts` or `lib/assessments/`).
- **Subject → Learning Compass**: a separate, third edge — `topicSelector.ts:63-64` matches subject names (`'Core Mathematics'`, `'Essential Mathematics'`) against `sow_learning_areas`, not Core's `subjects` table.
- **Teacher Assignment → Assessments/Assignments/Report Cards**: legacy edge, ratified canonical by ADR-0002 — `teachers.id` flows through `teacher_classes.teacher_id` into `class_assessments.teacher_id`/`assignments.teacher_id`.
- **Learner Enrollment → Assessments/Report Cards/Promotion**: legacy edge — `class_students` is what real marks-entry and report-card generation actually reads (Stage 0.5); Core's `learner_enrollments` feeds only the functionally-isolated `school_report_cards`/`term_subject_summaries` pipeline (Stage 0.5, confirmed zero production rows there).
- **Promotion**: **two parallel, non-communicating edges** — Core's `learner_promotions` (anchored on `learners`/`classes`/`academic_years`/`school_users`, zero live rows) and legacy's `student_promotions` (anchored on `students`/`teacher_classes`, zero live rows, but the one referenced by `docs/architecture/academic-evidence-layer.md` §2 as *the* source of truth for "how did this student get here"). Both are currently unused in production, but only one of them is the one the ratified Learner Record Layer architecture actually depends on.
- **Attendance, Timetable**: no table, no repository, no route, no reference of any kind found in a repository-wide search. These are not duplicated — they are unbuilt. Consistent with Stage 0.5's identical finding for Attendance; Timetable is a new confirmation this session.
- **Report Cards**: already fully mapped by Stage 0.5 (two pipelines — Core's `school_report_cards`/`term_subject_summaries`, zero production rows; the legacy AI auto-report pipeline via `assessments`, the only one that produces real parent-facing output) — re-confirmed unchanged this session, not re-derived.

---

## Part 3 — Findings Not Previously Documented By Any Prior Audit

1. **A third, independent Grade table exists** (`sow_grades` — `id`, `numeric_grade`, `order_index`, `level_id`, `is_active`), live with 13 rows, consumed directly by `lib/compass/topicSelector.ts` and `lib/curriculum/curriculumContext.ts` via `lib/repositories/curriculum.repository.ts`. It is not a duplicate of Core's `grades` in the sense of "same data, two tables" — it serves a genuinely different purpose (curriculum content structure vs. institutional/reporting structure) — but it means "Grade" has **three** live representations, not two, and Learning Compass's entire topic-selection logic depends on the one Stage 0.5 never examined.
2. **A third, independent Subject table exists** (`sow_learning_areas` — `id`, `grade_id`, `name`, `short_name`, `kicd_subject_data`), live with 195 rows, grade-scoped, consumed by the same two files. Stage 0.5 had classified Subject as `CANONICAL` (no duplication) — that classification examined only the Core-vs-legacy split and did not know about the curriculum/SOW domain's own structure.
3. **Promotion has a confirmed duplicate table built *after* the Core equivalent already existed.** `student_promotions` (`supabase/migrations/20260713193000_phase_a_promotions_archival.sql`, dated 2026-07-13) is a legacy-anchored (`students`/`teacher_classes`) append-only promotion-history table, created **two weeks after** Core's `learner_promotions` (`20260629_core_foundation.sql`, dated 2026-06-29) already existed. The migration's own header is explicit about why: it implements `docs/architecture/academic-evidence-layer.md` §2's Rules 1+2 (learner permanence, class archival) as real schema, deliberately anchored to the tables real production code depends on. This is not an oversight to be embarrassed about — it is the same "evolve the table real code uses, don't migrate onto the isolated one" pattern this entire audit series keeps finding to be the pragmatically correct interim choice — but it is concrete, dated proof that **the duplication pattern is still actively recurring in July 2026, not a historical artifact from before the platform "knew better."** Any consolidation roadmap must treat this as an ongoing risk, not a one-time cleanup.

---

## Part 4 — Architectural Violations, Ranked by Severity

| # | Violation | Severity | Why | Evidence |
|---|---|---|---|---|
| 1 | **Grade and Subject each have three live, populated, non-reconciled representations** | **Critical** | Any future feature needing "what grade/subject is this" has three equally-plausible places to look, with no canonical answer and no bridge between them; row counts already diverge (14 vs. 13 grades; Core's 48 subjects are ungraded while `sow_learning_areas`' 195 are per-grade — not even the same shape) | §1, §3 |
| 2 | **Academic Year/Term has no real entity anywhere real code depends on** | **Critical** | Every date-scoping decision in Ranking, Grading, and Analytics rests on an unvalidated free-text string (`'1'`/`'2'`/`'3'`, arbitrary year integers/strings) with no referential integrity — a typo'd term value is silently accepted, not rejected | §1 |
| 3 | **Duplicate Promotion tables, actively recurring** | **High** | Concrete, dated proof (§3) that new legacy-anchored duplicates are still being built in the same month as this audit, not just inherited from before Core existed — the pattern is not slowing down on its own | §3 |
| 4 | **Class/Stream and Learner Enrollment duplication** | **High** (already known, re-confirmed, not re-scored higher) | Fully documented by Stage 0.5; unchanged this session; the risk profile (Critical there) still applies, repeated here for completeness of this sprint's cross-entity map, not re-litigated | Stage 0.5 |
| 5 | **Learning Compass depends on a third structure invisible to the rest of the platform** | **Medium-High** | Not itself broken (Compass works, per its own audits in this series), but it means a future Grade/Subject consolidation effort that only looks at Core-vs-legacy will silently miss an entire, real, populated dependency — exactly the kind of blind spot this audit exists to prevent | §2, §3 |
| 6 | **Assignments table is fully wired in code but currently empty in production** | **Low-Medium** | Not itself a duplication violation, but worth flagging: `assignments` FKs entirely to the legacy identity space (`teacher_classes`/`teachers`) with free-text subject, matching the same pattern as `class_assessments` — if it's about to see real adoption, it will inherit the identical Grade/Subject/Term ambiguity found above | §2 |
| 7 | **Attendance and Timetable are unbuilt** | **Informational, not a violation** | Nothing is duplicated because nothing exists; flagged so a future build of either domain starts from this audit's Grade/Subject/Term findings rather than inventing a fourth representation of any of them | §2 |

---

## Part 5 — Recommended Migration Order (Risk-Minimizing)

Presented as a sequencing recommendation only — **no schema change is proposed or authorized by this document**, per the sprint's explicit instruction.

**Phase 0 (prerequisite, already satisfied)**: Teacher identity — ratified, ADR-0002. Nothing further needed before the phases below.

**Phase 1 — Lowest risk, highest information value: reconcile the curriculum/SOW Grade and Subject tables against Core's, without touching either.** Produce a mapping (not a migration) from `sow_grades.numeric_grade` ↔ `grades.level_order`/`grades.name`, and from `sow_learning_areas.name` ↔ `subjects.name`, per grade. This is pure data analysis — no schema, no code path change — and is the prerequisite for every later phase, since Phase 2+ cannot safely touch Grade/Subject without knowing whether the curriculum domain's data already agrees or conflicts with Core's.

**Phase 2 — Academic Year/Term: give the legacy tables a real FK, additively.** Following the exact precedent already used for `assessment_type_id` (Sprint 5D-5I) and `class_teacher_id`: add nullable `academic_year_id`/`term_id` FK columns to `class_assessments`/`learner_marks`/`assignments`, backfill by matching the existing free-text values against Core's `academic_years`/`terms`, leave the text columns in place exactly as `assessment_type` was left in place. This is the same low-risk, additive, backward-compatible pattern already proven twice in this series.

**Phase 3 — Grade/Subject: same additive pattern, informed by Phase 1's mapping.** Only attempted after Phase 1 proves the curriculum/SOW data and Core data can be reconciled without contradiction. If Phase 1 finds real conflicts (e.g., a subject present in `sow_learning_areas` for Grade 7 but absent from Core's `subjects`), that becomes a product decision to resolve before Phase 3, not a technical blocker to route around silently.

**Phase 4 — Promotion consolidation.** Both `learner_promotions` and `student_promotions` currently have zero live rows — the cheapest possible moment to consolidate, before either accumulates real data that would need migrating. Recommend deciding *now*, while the cost of choosing wrong is zero, rather than waiting until one of them has real production rows (matching this series' own repeated finding that waiting makes every later consolidation more expensive, never cheaper).

**Phase 5 — Class/Enrollment consolidation.** Deliberately last, and deliberately not re-scoped by this document — Stage 0.5 already produced a full evidence-based analysis and explicit recommendation for this (evolve `teacher_classes`/`class_students` toward `classes`/`learner_enrollments`' institutional shape), and it remains the highest-blast-radius item in the entire Academic Structure (34-vs-1 and 32-vs-3 file usage gaps, real production data). Nothing in this sprint's findings changes that recommendation; it is listed last here only to show where it sits relative to the newly-found Grade/Subject/Term/Promotion items, not to re-open or defer Stage 0.5's own conclusion.

**Not scheduled**: Attendance, Timetable — no migration applies to a domain that doesn't exist; recommend building either only with this audit's Grade/Subject/Term canonical-mapping findings (Phase 1) already in hand, so neither invents a fourth representation of an entity this document has now mapped.

---

## Validation

Explicitly confirmed this session:
- **0** production files modified
- **0** schema changes
- **0** migrations
- **0** repository, route, or service edits
- **0** tests modified
- Only this document (and the implementation log entry) were written.

## Statement

READ ONLY. No implementation performed. No schema changes proposed. Sprint 6B (or whatever phase would begin Phase 1 above) is not started.
