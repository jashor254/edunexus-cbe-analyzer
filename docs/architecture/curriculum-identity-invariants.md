# Curriculum Identity Invariants — the Preservation Contract

**Phase**: H5A-1. **Depends on**: H5A-0 (Curriculum Intelligence Reality Audit — read-only), ADR-0024 (Canonical Curriculum Identity). **Purpose**: EduNexus's curriculum structure is fragmented across several parallel representations (see H5A-0). This register does not attempt to unify them. It states one narrower, foundational rule and pins down exactly where the codebase already keeps it, and where it does not yet apply because the identity was never known to begin with.

**The foundational rule**:

> **PRESERVE KNOWN IDENTITY. NEVER MANUFACTURE UNKNOWN IDENTITY.**

When EduNexus already resolved a learning object to a canonical `sow_*` row (a real UUID), that identity must not be silently discarded in favor of a free-text label before the last consumer that needs curriculum fidelity. When EduNexus never resolved one — a parent's free-text remark, a teacher's typed strand name — the system must leave that identity explicitly null rather than guess one from string similarity. A `null` canonical identity is safer than a false one.

Format per invariant: ID, statement, why it matters educationally, canonical owner, current proof, CI tier, status, known limitation.

---

## CUR-EVD-001 — Evidence preserves known curriculum identity, exactly

**Statement**: When the originating assignment or quiz carries a real `assignments.substrand_id` (a `sow_substrands.id` FK), the `learner_evidence` row it produces must carry that exact same `sub_strand_id` — resolved by primary key, never re-derived from the assignment's title/topic text.

**Why it matters educationally**: if evidence re-resolved curriculum identity by matching the assignment's topic string against `sow_substrands.title`, an assignment titled "Fractions" could silently attach to the wrong "Fractions" sub-strand should one ever exist under two strands (see CUR-ID-003). Exact-ID passthrough is what makes the FK meaningful instead of decorative.

**Canonical owner**: `lib/assignments/evidence.ts` (`recordAssignmentMarkEvidence`), `lib/quiz/quizEvidence.ts` (`recordQuizAutoGradeEvidence`), both via `lib/curriculum/curriculumContext.ts` (`resolveCurriculumContext`), persisted verbatim by `lib/intelligence/evidenceLifecycle.ts`'s `toNewEvidenceRow` (no re-resolution at the write boundary either).

**Current proof (EXISTING, re-verified in this phase against current code, not assumed from H5A-0)**:
- `lib/assignments/evidence.substrand.integration.test.ts` — "canonical path" test deliberately passes a *wrong* topic string alongside a real `substrandId` and proves the wrong string is never used; the persisted `sub_strand_id` equals the input id exactly.
- `lib/quiz/quizEvidence.integration.test.ts` — identical proof for the quiz producer, same resolver, same exactness guarantee.

**CI tier**: DEEP_PR (`lib/assignments/evidence.substrand.integration.test.ts`, `lib/quiz/quizEvidence.integration.test.ts` — both tier D1 in `scripts/deep-test-classification.json`).

**Status**: EXISTING — NO NEW TEST NEEDED. Already correctly implemented in production code; this phase re-verified it end-to-end (assignment/quiz row → `resolveCurriculumContext` → evidence row) rather than trusting the prior audit's finding.

**Known limitation**: coverage is narrow. Only 2 of the 10 live `learner_evidence` writers (`teacher_upload`, `quiz_auto_grade`) can ever populate `sub_strand_id`, because only `assignments.substrand_id` exists as an upstream FK today. The other 8 writers correctly leave it null (CUR-EVD-002) rather than fabricate — but that means most evidence in the system has no canonical curriculum anchor at all, by construction, not by defect.

---

## CUR-EVD-002 — Unresolved evidence stays unresolved

**Statement**: Evidence producers that have no authoritative curriculum context available (parent observations, classroom observations, formative signals, topical checks, holiday returns, teacher remarks, legacy CSV import) must never promote their free-text `strand`/`subject`/topic fields into a fabricated `sub_strand_id` via fuzzy, substring, or AI-based matching.

**Why it matters educationally**: "Brian struggles with fractions," typed by a parent, is genuine and useful evidence — but it is evidence about a subject area, not a specific KICD sub-strand. Inventing a `sub_strand_id` for it would misrepresent an informal observation as curriculum-grounded assessment, and that false precision would then propagate into Projection/Blueprint as if it were as trustworthy as a marked assignment.

**Canonical owner**: each producer individually — `lib/parentPulse/observationEvidence.ts`, `lib/remedial/interventionEvidence.ts`, `lib/formativeSignals/evidence.ts`, `lib/assessments/topicalEvidence.ts`, `lib/holiday/return.ts`, `lib/remarks/evidence.ts`, `lib/assessments/evidence.ts`, `lib/assessments/reportCardEvidence.ts`.

**Current proof**:
- `lib/assignments/evidence.substrand.integration.test.ts` — "legacy path" test: `substrandId: null` in → `sub_strand_id: null`, `strand: null` out, topic preserved as free text `sub_strand`. Same pattern proven for quiz in `lib/quiz/quizEvidence.integration.test.ts`.
- Direct code inspection this phase (grep across all 8 remaining writers): none call any curriculum-repository resolver at all when no upstream FK exists — they simply do not attempt resolution. `lib/curriculum/curriculumContext.ts`'s own resolver returns `null` rather than a guess for both a truly-missing id (`curriculumContext.integration.test.ts` test 3) and any other lookup failure.

**CI tier**: DEEP_PR (same files as CUR-EVD-001) plus STANDARD-tier unit coverage implicit in `resolveCurriculumContext`'s null-safety.

**Status**: EXISTING — NO NEW TEST NEEDED. Audited exhaustively this phase; zero violations found across all 10 live writers.

**Known limitation**: this is a negative property (absence of fabrication) verified by code inspection across 8 writers that have no dedicated regression test of their own proving they *never* call a resolver — only the 2 writers that *do* have a resolution path are test-covered for the null case. A future writer could regress this by adding an ILIKE-based lookup; nothing in the harness would catch that automatically today (see Future Prerequisites, §29 of the H5A-1 closeout).

---

## CUR-ID-003 — Parent-chain integrity: resolution by primary key, not title

**Statement**: `resolveCurriculumContext()` — the one resolver that establishes curriculum identity on evidence — must resolve a sub-strand's parent strand by FK (`sow_substrands.strand_id → sow_strands.id`), never by matching titles, so that two sub-strands sharing an identical human-readable title under two different strands can never be conflated.

**Why it matters educationally**: KICD content is not guaranteed to have globally unique sub-strand titles (nothing in the schema enforces that). If resolution ever fell back to name matching, a learner's evidence could silently attach to the wrong strand's sub-strand — invisible in the UI, since the title displayed would look correct either way.

**Canonical owner**: `lib/curriculum/curriculumContext.ts` (`resolveCurriculumContext`), `lib/repositories/curriculum.repository.ts` (`findSubstrandById`, `findStrandsByIds` — both `.eq('id', …)`/`.in('id', …)` lookups, no `ILIKE`).

**Current proof (NEW this phase)**:
- `lib/curriculum/curriculumContext.integration.test.ts` — new test *"resolveCurriculumContext resolves by primary key, not title — same-named sub-strands under different strands do not collide"*. Seeds two sub-strands both titled `"Fractions (synthetic)"` under two different synthetic strands (reusing the file's existing synthetic-learning-area fixture, no schema change, no second curriculum introduced) and proves each resolves to its own distinct parent strand.

**CI tier**: DEEP_PR (`lib/curriculum/curriculumContext.integration.test.ts`, tier D1, `mutatesDb: true`, `cleanup: SELF_CLEANING` — unchanged, this phase only added test cases to an already-classified file).

**Status**: COMPLETE — NEW TEST ADDED. The invariant already held by construction (the resolver was never title-based); this phase closes the gap where nothing proved it and would catch a regression.

**Known limitation**: this invariant protects only `resolveCurriculumContext`'s path (i.e., evidence identity). It explicitly does **not** extend to `lib/compass/topicSelector.ts`'s `getTopicsForSubject`/`resolveConceptToDisplayName`, which do use `ILIKE`/substring title matching (`findLearningAreasByGradeIds`, `findSubstrandsByTitle`) — those are UI browse/display functions that return a tree or a beautified label, never write to an evidence or authoritative row, so they sit outside this contract's blast radius. Flagged, not fixed — see CUR-ID-004.

---

## CUR-ID-004 — Curriculum-type scoping at the grade/subject lookup boundary

**Statement (candidate, NOT implemented this phase)**: A grade+subject curriculum lookup should not blend results across curriculum types/frameworks that happen to share a numeric grade and a similarly-named subject.

**Audit finding**: `lib/repositories/curriculum.repository.ts`'s `findGradeIdsByGrade(grade)` filters only on `sow_grades.numeric_grade` — no `level_id`/`curriculum_type` scoping at all, despite `sow_grades.level_id → sow_levels.curriculum_type` existing as a real FK chain. `lib/compass/topicSelector.ts`'s `getTopicsForSubject` receives a `_curriculumType` parameter — the leading underscore is the tell — and never passes it through.

**Why this was NOT fixed this phase**: tracing the actual callers this phase found the fix is not a safe mechanical plumb-through. `app/api/compass/topics/route.ts` reads `curriculumType` from a client-supplied query string, defaulting to the literal `'cbc'` — but `sow_levels.curriculum_type`'s real values (per `lib/curriculum/curriculumMode.ts`'s `MODE_TO_CURRICULUM_TYPE`, the platform's own single source of truth for this mapping) are `'cbc_junior'`, `'cbc_senior'`, `'844'` — none of which is `'cbc'`. Wiring the unused parameter straight into a `sow_levels.curriculum_type` filter today would return **zero** results for every live Compass topic lookup, because the value actually being passed does not, and was never intended to, match the schema's real values. `app/api/teacher/assignments/substrands/route.ts` independently hardcodes the same wrong literal `'cbc'`. Fixing this requires deciding how curriculum type reaches these two routes correctly (resolved from the teacher's actual class/curriculum-mode context, not a client-guessable query parameter) — a real design decision, not a one-line scoping filter, and implementing it blindly would be a regression, not a fix.

**Classification**: **PRODUCT_DECISION_REQUIRED**.

**Current mitigating fact**: not a live defect today. Per H5A-0 and re-confirmed this phase, only CBC/8-4-4 curriculum content exists in seeded `sow_*` data (`MODE_TO_CURRICULUM_TYPE` has no `igcse` entry), so no second curriculum framework currently exists to collide with. This is a latent architectural gap, not a present data-correctness bug.

**Status**: NOT SELECTED FOR IMPLEMENTATION. Documented as a standing future guard per this phase's own instruction (§8: "CUR-ID-004 may remain a documented future guard if implementing it requires premature curriculum-identity architecture").

**Known limitation**: none of the current test suite exercises this boundary at all (no test asserts `findGradeIdsByGrade`/`getTopicsForSubject` scope by curriculum type, because they don't). A future phase introducing a second curriculum framework must treat closing this gap as a prerequisite, not a follow-up — see the Future Cross-Curriculum Prerequisites section of the H5A-1 closeout report.

---

## CUR-SOW-001 — Teacher selection identity survives allocation and persists on scheme_lessons

**Statement**: If a teacher selects a real `sow_substrands.id` in the SOW-generation picker, every `scheme_lessons` row generated from that selection retains that exact canonical id.

**H5A-1 finding**: `SelectedSubstrand` (`lib/sow/types.ts`) already carried real `strandId`/`substrandId` UUIDs from the teacher's picker, but `allocateLessons()` discarded them before any AI call, and none of `scheme_lessons`/`schemes_of_work`/`lesson_plans`/`row_entries` had a compatible column to receive one — reported as `MIGRATION_REQUIRED`, deliberately not implemented pending approval.

**H5A-2 implementation**: `supabase/migrations/20260817120000_scheme_lessons_sub_strand_id.sql` adds `scheme_lessons.sub_strand_id uuid REFERENCES sow_substrands(id) ON DELETE RESTRICT`, nullable, additive, no backfill. `AllocatedLesson.substrandId` and `GeneratedLesson.substrandId` (`lib/sow/types.ts`) thread the id through `lib/sow/lessonAllocator.ts` and `lib/sow/lessonPipeline.ts` unchanged from the picker's value. `app/api/sow/save/route.ts` persists `sub_strand_id: l.substrandId` verbatim — no re-resolution from `l.strand`/`l.substrand` text.

**Canonical owner**: `lib/sow/lessonAllocator.ts`, `lib/sow/lessonPipeline.ts`, `app/api/sow/save/route.ts`.

**Current proof (NEW this phase)**:
- `lib/sow/lessonAllocator.pure.test.ts` — pure, no DB/AI: `SelectedSubstrand.substrandId` survives `allocateLessons()` unchanged.
- `lib/sow/schemeLessonsSubStrandId.integration.test.ts` — a real `sow_substrands.id` persists exactly on `scheme_lessons.sub_strand_id`; a fabricated id is rejected by the live FK constraint (mirrors `assignmentSubstrandId.integration.test.ts`'s proof for `assignments.substrand_id`).

**CI tier**: DEEP_PR — `lib/sow/schemeLessonsSubStrandId.integration.test.ts` is now one of the 21 files in `scripts/deep-pr-tests.json`, the actually CI-enforced gate (154→159 tests). `lib/sow/lessonAllocator.pure.test.ts` is in `scripts/standard-tests.json` (STANDARD).

**Status**: BLOCKED → **PROVEN**. Migration applied to a local disposable Supabase target only (never production); two independent fresh-bootstrap runs produced an identical schema fingerprint (`2607880c5259fa7fd480fb2d9e500f6c`), and DEEP_PR ran green twice consecutively (159/159, 0 residue both times) against it.

**Known limitation**: this closes the loss point for `scheme_lessons` only. `lesson_plans` and `row_entries` still have no compatible column — see CUR-SOW-001's downstream note below and the H5A-3 candidate this phase reports.

---

## CUR-SOW-002 — Unknown SOW identity remains unknown

**Statement**: When no canonical `sow_substrands.id` is available upstream for a generated lesson, `scheme_lessons.sub_strand_id` must persist as `NULL` — never inferred from the lesson's `strand`/`substrand` text.

**Why it matters educationally**: `scheme_lessons.strand`/`substrand` text is AI-generated per lesson (`lib/sow/aiLessonGenerator.ts`), not guaranteed to match `sow_substrands.title` verbatim. Resolving it after the fact would be exactly the guessed curriculum mapping this platform's architecture forbids.

**Canonical owner**: `lib/sow/lessonAllocator.ts` (`substrandId: substrandId ?? null`), `app/api/sow/save/route.ts` (`sub_strand_id: l.substrandId`, direct passthrough, no resolver call).

**Current proof (NEW this phase)**:
- `lib/sow/lessonAllocator.pure.test.ts` — a selection with no canonical id (the defensive path) allocates with `substrandId: null`.
- `lib/sow/schemeLessonsSubStrandId.integration.test.ts` — `sub_strand_id: null` persists as `NULL`, text preserved; a pre-existing-shaped row with the column omitted entirely also remains valid (no backfill).

**CI tier**: DEEP_PR / STANDARD, same files as CUR-SOW-001.

**Status**: PROVEN.

**Known limitation**: today, every real caller of the SOW generation UI (`app/teacher/scheme-of-work/new/page.tsx`) always supplies a real `substrandId` — this audit found no legitimate legacy/custom-text SOW generation path currently reachable in production (`SelectedSubstrand.substrandId` is a required, non-optional field, and the one caller always populates it from real picker data). The `null` path this invariant protects is therefore currently a defensive contract, not something live traffic exercises today — proven correct and ready, should such a path ever exist.

---

## CUR-SOW-003 — AI cannot rewrite canonical curriculum identity

**Statement**: Generated lesson content may alter prose, examples, and instructional activities, but the curriculum identity attached to a generated lesson is always the exact id selected before the AI call — never something the AI call could have influenced.

**Canonical owner**: `lib/sow/lessonPipeline.ts` — `generateSchemePipeline()`'s batch loop reattaches `substrandId` from the allocation `slot` (`const { week, lesson, strand, substrand, substrandId } = slot`), not from `result` (the AI's `ValidatedLessonResult`).

**Proof**: structural, not a mocked-AI test — `ValidatedLessonResult` (`lib/sow/aiLessonGenerator.ts`) has no `substrandId`/`sub_strand_id` field at all, so there is no code path by which AI output could populate or alter it even if it tried; TypeScript itself rejects any attempt to read one off `result`. This codebase deliberately does not use `node:test`'s `mock.module` to fake the AI boundary for exactly this class of test — `lib/assignments/variantGeneration.integration.test.ts`'s own header documents `mock.module` intermittently failing to intercept a module import, letting real DeepSeek calls fire. Proving CUR-SOW-003 via a mocked AI call would have inherited that same unreliability; proving it via the type contract and the reattachment line's source location does not.

**CI tier**: N/A (structural/code-review proof, matching the phase's own instruction not to force a brittle AST/mock test just for coverage count).

**Status**: PROVEN by construction.

**Known limitation**: this is a narrower proof than a live end-to-end AI-call test would be. A future change that starts passing `slot`/`substrandId` into the AI call, or starts trusting a field the AI returns, would silently violate this invariant without a runtime test to catch it. Flagged, not mitigated further this phase — matching the same honest limitation CUR-EVD-002 already carries for its 8 unresolved evidence writers.

---

## Downstream note (H5A-3 candidate, not implemented)

With `scheme_lessons.sub_strand_id` now real, this phase audited (but did not modify) its two downstream readers:

- **Lesson Plan generation** (`lib/lessonPlan/weeklyGenerator.ts`): reads `GeneratedLesson[]` from `schemes_of_work.lessons` (JSONB), not from the `scheme_lessons` table. Since `GeneratedLesson.substrandId` is now part of that type, the id is already present in the JSONB blob at zero migration cost — but `savePlans()` does not currently copy it into `lesson_plans` (which has no compatible column). Classification: **DOWNSTREAM_PROVENANCE_RECOVERABLE** (the value is sitting right there in memory; wiring it in is code-only, once `lesson_plans` gets a column).
- **Record of Work seeding** (`lib/row/recordOfWork.ts`): its `scheme_lessons` select (`week, lesson, strand, substrand, learning_outcomes, key_inquiry_questions, learning_resources`) does not fetch the new `sub_strand_id` column, and `row_entries` has no compatible column to receive it either. Classification: **DOWNSTREAM_SCHEMA_BLOCKED**.

Neither was touched this phase, per the explicit scope lock ("do NOT redesign lesson_plans... do NOT redesign row_entries... unless scheme_lessons alone cannot satisfy CUR-SOW-001" — it can). See the H5A-2 closeout's Next Phase recommendation.

---

## Cross-reference

This register narrows and operationalizes findings from:
- `docs/architecture/curriculum-intelligence-reality-audit.md` (H5A-0, if filed) / the H5A-0 closeout report — established the fragmented-model verdict this register works within, not against.
- `docs/architecture/adr-0024-canonical-curriculum-identity.md` — designated `sow_*` the canonical spine and shipped the `assignments.substrand_id`/`learner_evidence.sub_strand_id`/`blueprint_action_items.sub_strand_id` FK retrofits that CUR-EVD-001/002 depend on.
