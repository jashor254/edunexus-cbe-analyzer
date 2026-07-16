# Sprint 6B — Canonical Academic Structure Reconciliation

**Mode: ANALYSIS ONLY.** No code, schema, migration, route, repository, or test was modified. No bridge was created. No canonical entity was touched. This document extends Sprint 6A's findings with the granular, per-entity inventory (table/PK/columns/relationships/readers/writers/seeders/routes/repositories/UI) Sprint 6A did not go into, and adds a fourth representation of Subject that Sprint 6A did not find.

---

## 1. Grade — Full Inventory

### 1a. `grades` (Core)
- **PK**: `id uuid`. **Columns**: `name text NOT NULL`, `code text NOT NULL UNIQUE`, `level_order int NOT NULL UNIQUE`, `category text NOT NULL CHECK (category IN ('pre_primary','lower_primary','upper_primary','junior_secondary'))`, `created_at`, `updated_at`.
- **Relationships (live, confirmed via `information_schema`)**: referenced by `classes.grade_id`, `grade_subjects.grade_id`, and **`class_assessments.grade_id`** (nullable FK — see 1d, a new finding this sprint).
- **Live readers**: `lib/repositories/teacher.repository.ts` (`findGrades`), `lib/core/subjects.ts::seedGradeSubjectsForSchool`, `lib/core/classes.ts`.
- **Live writers**: none in application code — the 14 rows are entirely migration-seeded (`20260629_core_foundation.sql:164-178`, static `INSERT` of the CBC ladder PP1→Grade 9).
- **Seeders**: the migration itself; no repository `create`/`insert` method exists for this table.
- **Routes**: `app/api/core/classes/route.ts`, `app/api/core/subjects/route.ts` (both read `grades` indirectly via `lib/core/*`).
- **Repositories**: `lib/repositories/teacher.repository.ts` (the repository *named* for the legacy Teacher domain also owns this Core-table read — the exact cross-ownership Stage 0.5 already flagged for `classes`).
- **UI pages**: **none** — confirmed by repo-wide search, zero `.tsx` files reference `api/core/classes` or `api/core/subjects`.

### 1b. `teacher_classes.grade` (legacy)
- **PK of parent table**: `teacher_classes.id`. **Column**: `grade INTEGER NOT NULL CHECK (grade BETWEEN 7 AND 12)` — a bare integer, not an entity; no PK/FK of its own.
- **Relationships**: none — it is not a foreign key, it is a scalar column.
- **Live readers**: every teacher-facing class/assessment/analytics route that filters or displays by grade (`app/teacher/classes/**`, `app/teacher/analytics/page.tsx`, `lib/repositories/teacher.repository.ts`'s `teacher_classes` methods) — the de facto real Grade value for essentially all live production code.
- **Live writers**: `app/api/teacher/classes/route.ts` (class creation), `scripts/reference-school/03-seed-staff.ts` and siblings (seed pipeline).
- **Seeders**: reference-school seed scripts; real teacher-facing class-creation form (`app/teacher/classes/page.tsx`).
- **Routes**: `app/api/teacher/classes/route.ts`, `app/api/teacher/classes/[classId]/route.ts`.
- **Repositories**: `lib/repositories/teacher.repository.ts`.
- **UI pages**: `app/teacher/classes/page.tsx` (class creation, grade picker), `app/teacher/classes/[classId]/page.tsx`, `app/teacher/classes/[classId]/assessments/page.tsx`, `app/teacher/analytics/page.tsx` — this is the **only** Grade representation with real, confirmed UI.

### 1c. `sow_grades` (curriculum/SOW)
- **PK**: `id uuid`. **Columns**: `level_id uuid`, `name text`, `numeric_grade integer`, `order_index integer`, `is_active boolean`, `created_at`, `updated_at`.
- **Relationships**: referenced by `sow_learning_areas.grade_id`; `level_id` presumably references a curriculum-level table not examined in this pass (out of this sprint's named scope).
- **Live readers**: `lib/repositories/curriculum.repository.ts` (`findGradeIdsByGrade`, `findGradesByIds`, and 3 other methods matched in Sprint 6A's grep), `lib/compass/topicSelector.ts`, `lib/curriculum/curriculumContext.ts`.
- **Live writers**: none found in application code this pass — presumed migration/seed-populated, consistent with its 13-row, static-looking shape; no `INSERT`/`.insert()` call site located in `lib/curriculum/` or `lib/compass/`.
- **Seeders**: **UNKNOWN** — no `CREATE TABLE sow_grades` was found in any tracked migration file (`git log -S`, `grep -rl`, across every `.sql` file in the repo), yet the table exists live with 13 rows. This means `sow_grades` was created and seeded through a mechanism this audit could not locate in version control — either an untracked migration, a direct Supabase-dashboard change, or a script outside `supabase/migrations/`. **Flagged explicitly rather than guessed at**: this is itself a finding — the curriculum/SOW schema's origin is not fully reconstructable from this repository's history.
- **Routes**: none directly — reached only through `lib/compass/*` and `lib/curriculum/*` service functions, never a dedicated CRUD route.
- **Repositories**: `lib/repositories/curriculum.repository.ts`.
- **UI pages**: none directly manage `sow_grades`; it is consumed indirectly by the Learning Compass chat UI (`app/teacher/**/compass/**`, `app/student/**` compass surfaces — not enumerated exhaustively here since Compass's own UI structure is out of this sprint's named scope).

### 1d. New finding: `class_assessments.grade_id` — a live, unpopulated bridge column
`class_assessments` already has a nullable `grade_id uuid REFERENCES grades(id)` column, added by the same Core-foundation migration that extended this table with `weight_percent`/`grading_type`/`is_published` (`20260629_core_foundation.sql` §16). It is accepted as an optional field by `createCoreAssessment`'s input type (`lib/repositories/assessment.repository.ts:1016`) and by the Core route's `CreateSchema` (`app/api/core/assessments/route.ts:22`) — but **no code path resolves or populates it automatically**; it is purely caller-supplied, and no caller has ever supplied it. Confirmed live: **0 of 11** `class_assessments` rows have a non-null `grade_id`. This is structurally identical to `assessment_type_id`'s state before Sprint 5F — a bridge column that already exists in schema, requiring only a resolution service, not a migration, to start being populated.

---

## 2. Subject — Full Inventory

Sprint 6A found three Subject representations. **A fourth exists, found this session**: a hardcoded, DB-free TypeScript catalogue that is the one actually driving the real teacher-facing UI.

### 2a. `subjects` (Core)
- **PK**: `id uuid`. **Columns**: `name text`, `code text`, `category text`, `is_core boolean` (confirmed via the migration's `INSERT` column list, `20260629_core_foundation.sql:285`).
- **Relationships**: referenced by `grade_subjects.subject_id`, `class_subjects.subject_id`, `term_subject_summaries.subject_id`.
- **Live readers**: `lib/repositories/teacher.repository.ts::listSubjects`/`findSubjectById`/`findAllSubjectsForSeed`, `lib/core/subjects.ts`.
- **Live writers**: none in application code — 48 rows, entirely migration-seeded (`20260629_core_foundation.sql:285+`, static `INSERT`).
- **Seeders**: the migration itself.
- **Routes**: `app/api/core/subjects/route.ts`.
- **Repositories**: `lib/repositories/teacher.repository.ts`.
- **UI pages**: **none** — same finding as `grades`.

### 2b. Legacy free-text columns
- `teacher_classes.subject TEXT NOT NULL`, `class_assessments.subjects text[]`, `assignments.subject TEXT NOT NULL` — none are FK'd to any entity; each is a bare string/array, populated by whatever value the UI happens to send (see 2d).
- **Live readers/writers**: every teacher-facing class/assessment/assignment route and repository method (`lib/repositories/teacher.repository.ts`, `lib/repositories/assessment.repository.ts`, `lib/assignments/*`).
- **UI pages**: `app/teacher/classes/page.tsx`, `app/teacher/classes/[classId]/assessments/page.tsx`, `app/teacher/assignments/**` (not individually enumerated).

### 2c. `sow_learning_areas` (curriculum/SOW)
- **PK**: `id uuid`. **Columns**: `grade_id uuid REFERENCES sow_grades(id)`, `name text`, `short_name text`, `order_index integer`, `kicd_subject_data jsonb`, `created_at`, `updated_at`.
- **Relationships**: FK'd to `sow_grades`; referenced by `sow_strands.learning_area_id` (confirmed live).
- **Live readers**: `lib/repositories/curriculum.repository.ts`, `lib/compass/topicSelector.ts`, `lib/curriculum/curriculumContext.ts`.
- **Live writers**: none found — same **UNKNOWN seeder** finding as `sow_grades` (no tracked migration creates this table either).
- **Routes**: none dedicated — reached only through `lib/compass/*`/`lib/curriculum/*`.
- **Repositories**: `lib/repositories/curriculum.repository.ts`.
- **UI pages**: indirectly, via Learning Compass and SOW-generation UI (out of named scope, not enumerated).

### 2d. New finding: `lib/curriculum/subjects.ts` — a hardcoded, DB-free Subject catalogue
- **Not a table at all** — a plain TypeScript module exporting constant arrays/records: `SENIOR_PATHWAYS`, `SENIOR_PATHWAY_ELECTIVES`, `CBC_SENIOR_PATHWAY_META`, `CBC_JUNIOR_CORE`, `CBC_JUNIOR_RELIGION`, `CBC_SENIOR_CORE`, `F844_SUBJECTS`, plus helper functions (`getSeniorCompulsorySubjects`, `getSubjectsForClass`, `validateSeniorSubjects`).
- **This is the one Subject representation with confirmed, direct, real UI usage**: imported into `app/teacher/classes/[classId]/assessments/page.tsx`, `app/teacher/classes/page.tsx`, `app/teacher/classes/[classId]/page.tsx` — every real teacher-facing subject picker in the product reads from this file, not from `subjects`, not from `sow_learning_areas`.
- **No bridge to any of the other three** — subject *names* here (e.g., `'Kiswahili / Kenya Sign Language'`, `'Core Mathematics'`) are independently hand-typed, with no confirmed guarantee they match `subjects.name` or `sow_learning_areas.name` character-for-character (not exhaustively diffed in this pass — flagged as an open question, not assumed either way).
- **Live readers**: the 3 `.tsx` files above.
- **Live writers**: N/A — it's a static source file, not a database table; "writing" it means editing the file.
- **Seeders/Routes/Repositories**: none — it is not data-layer at all.

---

## 3. Academic Year — Full Inventory

| Representation | Type | Consumers |
|---|---|---|
| `academic_years` (Core) | **Real FK table** — `id`, `name`, `start_date`, `end_date`, `is_current`, `school_id`-scoped | `lib/repositories/school.repository.ts` only. **Zero UI pages** reference `api/core/academic-years` (confirmed by repo-wide `.tsx` search). Live row count: 1. |
| `teacher_classes.academic_year` | **Free text**, `TEXT NOT NULL DEFAULT '2025'` | Every legacy class-scoping read/write in `lib/repositories/teacher.repository.ts` and every teacher-facing class route. |
| `class_assessments.year` | **Free integer**, no FK, no CHECK beyond `NOT NULL` | Every Ranking/Grading/Analytics function (`lib/ranking/`, `lib/grading/`, `lib/assessments/analytics.ts`). |
| `student_promotions.academic_year` | **Free text** | The Learner Record Layer's promotion-history mechanism (`docs/architecture/academic-evidence-layer.md` §2). |

**Determination**: Academic Year is **duplicated** in the literal sense Sprint 6B asks about (a real entity exists) but functionally **free-text and inferred everywhere real code runs** — no legacy write path derives its year value from Core's `academic_years` table; each table's year is independently typed in by whatever the calling code passes (a hardcoded default, a form field, or a computed "current year"). It is not generated (no code computes it from `academic_years.is_current`) and not versioned beyond the raw string/int itself.

---

## 4. Term — Full Inventory

| Representation | Type | Consumers |
|---|---|---|
| `terms` (Core) | **Real FK table** — `id`, `academic_year_id`, `term_number`, `name`, `start_date`, `end_date`, `is_current` | `lib/repositories/school.repository.ts` only. Zero UI pages. Live row count: 3. |
| `class_assessments.term` | **Free text**, `CHECK (term IN ('1','2','3'))` — the *only* legacy representation with any validation at all | Every legacy assessment/ranking/grading/analytics path. |
| `learner_marks` term (implicit) | Not stored directly — `learner_marks` has no own `term` column; term is reached only by joining through `class_assessments.term` | Confirmed via schema: `learner_marks` has no `term`/`year` column of its own. |

**Inconsistency documented**: `class_assessments.term`'s `CHECK (term IN ('1','2','3'))` is real, enforced validation — a genuine partial safeguard the Academic Year column entirely lacks. This means Term and Academic Year, despite being conceptually parallel (both "when did this happen"), have **different levels of data-integrity rigor today**: Term is constrained to 3 valid values; Academic Year accepts any string/int at all. Any future reconciliation must not accidentally *loosen* Term's existing constraint while tightening Academic Year's.

---

## 5. Curriculum/SOW Dependency Analysis — Why Does It Own Its Own Grade and Subject Models?

**Determined, not assumed, from the data**: `sow_grades`/`sow_learning_areas` are **curriculum-specific, not cached and not historical**, based on the following evidence:

- **Shape mismatch rules out "cache"**: a cache of Core's `grades`/`subjects` would be expected to mirror their row counts and structure. It doesn't — `sow_grades` has 13 rows vs. Core's 14 (Core includes PP1/PP2 pre-primary grades that `sow_grades`, oriented around Grade 1–9 CBC Junior content, may not need — not confirmed either way, but the count divergence alone rules out "exact cache"). `sow_learning_areas` has 195 rows, **grade-scoped** (a `grade_id` FK on every row), while Core's `subjects` has 48 rows in a **flat, ungraded list** — these are not even the same *shape* of data, let alone the same values. A cache preserves shape; this doesn't.
- **`kicd_subject_data jsonb` column proves curriculum-specific intent**: `sow_learning_areas` carries a JSON payload of KICD (Kenya Institute of Curriculum Development) curriculum-design data — strand/sub-strand structure, learning outcomes, etc. — that has no analog anywhere in Core's `subjects` table. This is content Core's schema was never designed to hold; it exists because the SOW/Lesson-Plan generation pipeline needs it to produce real curriculum documents, not because someone copied Core's table and forgot to delete the duplicate.
- **Not historical**: no evidence of versioning, deprecation, or "old snapshot" framing was found — both tables are actively read by live code (`topicSelector.ts`, `curriculumContext.ts`) with no fallback path to a newer replacement.
- **Not "unnecessary duplication" in the pejorative sense**: they serve a **different question** than Core's tables do. Core's `grades`/`subjects` answer "what grade/subject exists at this school, for enrollment and reporting purposes." `sow_grades`/`sow_learning_areas` answer "what does the Kenyan national curriculum say should be taught, at what grade, in what subject, with what learning outcomes" — a content-authoring question, not an institutional-record question. The Fourth Constitutional Law's Evidence/Intelligence-vs-Operating-Layer separation (cited throughout this series) draws exactly this kind of "different concern, different table" line elsewhere in the platform; the curriculum/SOW split is structurally the same pattern, not a violation of it.

**Conclusion**: `sow_grades`/`sow_learning_areas` are **canonical for their own, curriculum-content-authoring domain** — they are not a competing representation of the institutional Grade/Subject entity so much as a genuinely separate entity that happens to share a name. This reframes the "triplication" finding from Sprint 6A: it is real (three tables, three purposes, no bridge), but it is not automatically "three competing answers to one question" — one of the three (curriculum/SOW) may be answering a legitimately different question. Whether that justifies permanent separation or merely explains *why* no one has bridged them yet is the open policy question this document surfaces, not resolves.

---

## 6. Dependency Graph

```
Grade (3 tables + 1 hardcoded catalogue for Subject's UI-driving equivalent)
  │
  ├──────────────────────────────────────────────────────────────┐
  ▼                                                                ▼
Subject (4 representations)                              Curriculum/SOW
  │  (sow_learning_areas.grade_id → sow_grades — the only  (sow_grades, sow_learning_areas,
  │   REAL FK edge between any two of the Grade/Subject     sow_strands, sow_substrands —
  │   representations found anywhere in this audit)          content-authoring domain)
  │                                                                │
  ▼                                                                ▼
Assessment (class_assessments: grade_id FK exists but 0% populated;   Learning Compass
            subjects text[], term CHECK'd, year free int;            (topicSelector.ts:
            assessment_type_id FK, populated since Sprint 5F)          reads sow_grades/
  │                                                                    sow_learning_areas
  │  NO EDGE — Core's school_report_cards/term_subject_summaries       directly, bypasses
  │  reference Core's grades/subjects/terms correctly, but have        Grade/Subject
  │  zero production rows (Stage 0.5); legacy report pipeline reads    entirely — reached
  │  class_assessments directly, never joins to grades/subjects        via numeric_grade/
  ▼                                                                    subject-name string
Reports (2 pipelines, unchanged since Stage 0.5/6A — not re-derived)   matching, not FK join)
  │
  │  NO EDGE — no code found linking Report generation to Promotion
  ▼
Promotion (learner_promotions: Core-native, references classes/academic_years/school_users
           correctly, 0 rows; student_promotions: legacy-native, references
           students/teacher_classes, from_grade/to_grade as raw integers — not FK'd to
           ANY of the three Grade tables, 0 rows)
  │
  │  NO EDGE — no code found linking Promotion to any Learning Intelligence system
  ▼
Learning Intelligence (Evidence/Projection/Career Intelligence/Academic Clinic —
                        confirmed in Sprint 5G/6A: zero references to grade_id,
                        subject_id, term_id, or academic_year_id anywhere in
                        lib/intelligence/, lib/projection/, lib/career/)
```

**Every dependency shown above is a verified edge or a verified absence of one** — no arrow is inferred. The single most consequential fact this graph makes visible: **the chain breaks at Assessment.** Grade/Subject/Term/Academic-Year all have real, populated data *above* Assessment (in Core's tables, in `sow_*`, or in real legacy free-text form) and *below* it not at all (Reports/Promotion/Intelligence do not consume any of Assessment's grade/subject/term/year fields directly — they either re-derive from other sources or don't use them at all). Reconciling Grade/Subject/Term/Academic-Year without also addressing this break would produce a cleaner *upstream* structure feeding into the exact same disconnected *downstream* reality already documented in Stage 0.5 and Sprint 6A.

---

## 7. Risk Assessment Per Future Consolidation

| Consolidation | Risk | Why |
|---|---|---|
| **Populate `class_assessments.grade_id` from `teacher_classes.grade` (additive, no schema change — the FK already exists)** | **LOW** | Column already exists, nullable, unused (0% populated) — identical shape to the already-proven `assessment_type_id` pattern (Sprint 5F). No existing reader depends on it being null; populating it can only add information, never remove or contradict any existing behavior. |
| **Add real `term_id`/`academic_year_id` FK columns to `class_assessments`/`learner_marks` (additive)** | **LOW-MEDIUM** | Same additive pattern, but unlike Grade, no such column exists yet — this *would* require a migration (out of this sprint's scope to propose, but flagged as low-risk *when* proposed, since it follows the exact precedent already used twice). Slightly higher than Grade because Term's existing `CHECK` constraint must be preserved exactly, not loosened, during any bridge-building. |
| **Reconcile `subjects` (Core) against `lib/curriculum/subjects.ts` (hardcoded catalogue)** | **MEDIUM** | No schema risk (one side isn't a table), but real risk of silent behavior change if subject *names* don't match exactly between the two — this sprint did not exhaustively diff them, so the actual size of any mismatch is unknown. Must be measured (not assumed) before any bridging is attempted. |
| **Reconcile `sow_grades`/`sow_learning_areas` against Core's `grades`/`subjects`** | **MEDIUM-HIGH** | The two systems answer genuinely different questions (§5) — a naive 1:1 merge risks conflating institutional records with curriculum-content structure, which the Fourth Constitutional Law's Evidence/Operating separation logic would treat as a modeling error, not a simplification. Also blocked on the **unknown seeder** finding (§1c/§2c) — no migration history exists to confirm exactly how or when this data was created, which is itself a risk for anyone touching it. |
| **Consolidate `learner_promotions`/`student_promotions`** | **LOW** (unchanged from Sprint 6A) | Both tables have zero live rows — the cheapest possible moment to decide, restated here for completeness of this sprint's own risk table, not re-derived. |
| **Class/Enrollment consolidation (`teacher_classes`/`classes`, `class_students`/`learner_enrollments`)** | **HIGH** (unchanged from Stage 0.5/6A) | Real production data, 34-vs-1 and 32-vs-3 file-usage gaps — not re-scored, restated for completeness only. |

---

## 8. Migration Readiness Per Entity

| Entity | Readiness | Why |
|---|---|---|
| **Grade → Assessment bridge** (`class_assessments.grade_id`) | **Ready now** | Schema already exists (nullable FK, added 2026-06-29); needs only a resolution service analogous to `resolveOrCreateAssessmentType` — no migration, no ADR, no new bridge table required. |
| **Term → Assessment bridge** | **Needs bridge** | No FK column exists yet on `class_assessments`/`learner_marks`; would need an additive migration (a schema change, explicitly out of this sprint's authority to propose in detail, but the *readiness* classification itself — "needs a bridge column" — is squarely this sprint's job to state). |
| **Academic Year → Assessment bridge** | **Needs bridge** | Same as Term — no FK column exists; additionally, unlike Term, the legacy column has no `CHECK` constraint at all, so a bridge-building effort would also need to handle genuinely malformed existing free-text values (not measured in this pass — a data-quality audit, not assumed clean). |
| **Subject (Core `subjects` ↔ `lib/curriculum/subjects.ts`)** | **Needs bridge, gated on a name-reconciliation pass not yet done** | Structurally two different kinds of thing (a table vs. a code constant) — "bridging" here means either generating one from the other or proving they already agree; neither has been done. |
| **Subject/Grade (curriculum/SOW ↔ Core)** | **Needs ADR** | Per §5, these may be legitimately different entities serving different purposes, not a duplication to eliminate — whether to formally bridge them, formally declare them permanently separate, or something in between is a product/architecture decision, not a mechanical migration; the same category of decision ADR-0002 made for Teacher identity and Sprint 5H-P made for Assessment Type purpose. |
| **Promotion (`learner_promotions` ↔ `student_promotions`)** | **Ready now** | Both empty; a decision (not a migration, since there's no data to migrate) is all that's needed — restated from Sprint 6A. |
| **Class/Enrollment** | **Blocked** | Real production data, highest blast radius in the entire Academic Structure; Stage 0.5 already produced its own full evidence-based recommendation (evolve legacy toward Core's shape) — this sprint does not reopen or reclassify it, only confirms it remains the correctly-blocked item relative to everything else found here. |

---

## Validation

Explicitly confirmed this session:
- **0** production files changed
- **0** schema changes
- **0** migrations
- **0** route changes
- **0** repository changes
- **0** tests modified
- Only this document and the implementation log entry were written.

## Stop Condition

STOP. No implementation performed. No bridges created. No canonical entity modified. Awaiting explicit approval before Sprint 6C.
