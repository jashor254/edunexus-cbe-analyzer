# Sprint 4A.1 — Repository Extraction & Canonical Identity Preservation

## Implementation Readiness Review (Design Only)

**Status: Design Review Only. No code, no migrations, no files modified in producing this document.**

**Depends on**: ADR-0022, ADR-0023, ADR-0024, ADR-0025, and `sprint-4a-canonical-assessment-foundation-audit.md` (the Sprint 4A audit this document narrows and, on one point, corrects).

**Scope discipline confirmed**: this review touches only repository extraction, stable question identity, and infrastructure correctness. No adaptive variants, AI generation, draft-workflow UI, teacher approval, variant persistence, learner delivery, grading, evidence, recommendation, or projection changes are proposed anywhere below.

---

## Executive Summary

Sprint 4A.1 is buildable as scoped, but **one design decision from the Sprint 4A audit does not survive contact with this sprint's narrower scope and must change**: that audit proposed locking questions at the `draft → active` status transition. This sprint explicitly excludes Draft workflow UI, and — confirmed by re-tracing the actual creation flow — **locking on `status` would break the existing, currently-working flow**: `app/teacher/assignments/new/page.tsx:218` redirects a teacher straight to the quiz builder *after* creation, at which point `assignments.status` is already `'active'` (hardcoded, unchanged by this sprint). A status-keyed lock would make it impossible to ever populate a new quiz's first question set.

**Corrected design**: lock keyed off **real submission activity**, not assignment status — specifically, whether any `assignment_submissions` row for the assignment has `status IN ('submitted', 'marked')`. Before any student has actually answered, every submission row is still `'pending'` (pre-created placeholders, confirmed in the Sprint 4A audit as inert), so editing remains exactly as free as it is today. The moment a real answer exists, the questions it was graded against become locked. This needs no draft-workflow concept at all, fits this sprint's scope precisely, and is arguably the more correct invariant anyway — it protects exactly what matters (a graded answer's provenance), not a status label that has nothing to do with whether protection is needed yet.

**Recommendation: CONDITIONAL GO** — see §9 for the two conditions.

---

## 1. Repository Findings

### Every direct-Supabase-write site in the Assignments/Quiz domain

| Route | SQL executed | Business rules embedded in the route | Validation | Transaction boundary | Duplicate logic? |
|---|---|---|---|---|---|
| `POST /api/teacher/assignments` | INSERT `assignments`, SELECT `class_students`, INSERT `assignment_submissions` (bulk) | "quiz is never compass-guided" (`is_compass_guided: is_quiz ? false : ...`), holiday-period nulling, default `max_score: 100`, default `type: 'practice'` | Zod (`CreateAssignmentSchema`) | **None** — three sequential awaited calls, no transaction; a failure after the `assignments` INSERT but before the `assignment_submissions` INSERT leaves an assignment with zero submission rows, silently | No |
| `GET /api/teacher/assignments` | SELECT `assignments` joined `teacher_classes`, then two more SELECTs (`class_students`, `assignment_submissions`) for in-memory counting | Count aggregation logic (student count, submitted count) | None needed (read-only) | N/A | No |
| `GET/PATCH /api/teacher/assignments/[id]` | SELECT `assignments` + `assignment_submissions` joined `students`; UPDATE `assignments.status` | "isOverdue" computed from `due_date` vs now | Zod (`UpdateAssignmentSchema`, status enum) | N/A (single UPDATE) | No |
| `POST /api/teacher/assignments/[id]/mark` | SELECT `assignments`, UPDATE `assignment_submissions`, then `recordAssignmentMarkEvidence` | Score-range validation against `max_score` | Zod (`MarkSubmissionSchema`) + inline range check | **None across the mark-write and evidence-write** — flagged already in the Sprint 4A audit as out of this sprint's scope, since evidence emission is explicitly a non-goal here | No |
| `PUT /api/teacher/assignments/[id]/questions` → `lib/quiz/quiz.ts::replaceQuestions` | DELETE all `assignment_questions` for assignment, bulk INSERT | None beyond "at least one question, all choices filled" (enforced client-side in the page, not server-side in the route) | **None server-side** — the route trusts whatever array the client sends; page-level filtering (`page.tsx:79-86`) is not re-validated by the API | **None** — delete and insert are two separate awaited calls, not one transaction; a failure after DELETE but before INSERT leaves the assignment with **zero** questions | This is the function Sprint 4A.1 rewrites |
| `GET /api/teacher/assignments/[id]/questions`, `GET /api/student/assignments/[id]/questions` | SELECT only | Column-selection difference is the security boundary (`correct_index` omitted for students) | N/A | N/A | No |
| `GET /api/student/assignments` | SELECT `students`, `class_students`, `assignments` (status filter), `assignment_submissions` | Overdue/days-left computation | N/A | N/A | No |
| `POST /api/student/submit-quiz` → `gradeAndSubmitQuiz` | SELECT `assignment_questions` (correct_index), UPSERT-by-hand `assignment_submissions` (SELECT existing → UPDATE or INSERT) | Grading arithmetic delegated to `gradeQuiz` (pure) | None server-side beyond the pure grader's own shape | **None** — the existing/insert branch is two round trips with a race window between the `maybeSingle()` read and the write; out of scope to fix here (grading, non-goal), but recorded since it's the same "no transaction" pattern this sprint is fixing elsewhere |

**Confirmed duplicate logic**: none beyond the pattern itself repeating (inline Supabase access) — no two routes implement the *same* business rule differently. This matters: the recommendation below is a pure extraction, not a reconciliation of conflicting logic.

### Recommended repository

**One `AssignmentRepository`**, covering `assignments`, `assignment_questions`, and `assignment_submissions` together — not three separate repositories. These three tables have no independent lifecycle (a submission cannot exist without its assignment; a question set is meaningless without its assignment); splitting them would just relocate today's inline cross-table sequencing into three files calling each other instead of one file doing it directly. This does **not** duplicate `lib/repositories/assessment.repository.ts` — that repository owns the unrelated formal-assessment/CAT domain (`class_assessments`, `assessment_marks`), confirmed zero table overlap with `assignments`/`assignment_questions`/`assignment_submissions` in the Sprint 4A audit.

**Convention choice**: this codebase has two live repository shapes — class-based `*.repository.ts` files under `lib/repositories/` (e.g. `AssessmentRepository`, `CurriculumRepository`), and plain async-function modules under a domain folder (e.g. `lib/quiz/quiz.ts`, `lib/assignments/evidence.ts`). **Recommend the plain-function-module shape**, extending `lib/assignments/` (a folder that already exists, already owns `evidence.ts` for this exact domain) rather than adding a new class under `lib/repositories/`. This is the closer, more specific precedent — matching the sibling file already governing this same domain's evidence writes, not the generically-named `lib/repositories/` folder that owns a different domain entirely.

---

## 2. Identity Findings

### `replaceQuestions()`'s current lifecycle, traced exactly

```
Teacher edits quiz builder page, clicks "Save Quiz"
        │
        ▼
PUT /api/teacher/assignments/[id]/questions
        │
        ▼
replaceQuestions(assignmentId, questions)
        │
        ├─▶ DELETE FROM assignment_questions WHERE assignment_id = $1
        │        (cascades: any future assignment_question_variants row
        │         FK'd to question_id ON DELETE CASCADE is destroyed here)
        │
        └─▶ INSERT INTO assignment_questions (...) VALUES (...) × N
                 (fresh gen_random_uuid() per row — no relationship to
                 the ids that existed a moment ago, even for a question
                 whose text/choices are byte-identical to before)
```

**Confirmed cascade blast radius**: today, nothing references `assignment_questions.id` from outside the table (no `assignment_question_variants` exists yet), so the delete-and-recreate is currently harmless *in effect*, even though it's already the wrong lifecycle *in principle*. The harm is entirely prospective — it activates the moment Sprint 4B's variant table exists — which is exactly why the Sprint 4A audit and this sprint both treat fixing it now as prerequisite work, not premature optimization.

### Replacement design

```
Teacher submits questions: Array<{ id?: string; questionText; choices; correctIndex }>
        │
        ▼
For the assignment's current (locked?) state:
        │
        ├─ LOCKED  → reject the entire write (see lock condition below);
        │            no partial application, no silent no-op
        │
        └─ UNLOCKED →
                for each incoming question:
                  has id AND id matches an existing row  → UPDATE that row in place
                  has no id (or an id that matches nothing) → INSERT new row
                for each existing row not present (by id) in the incoming array:
                  → DELETE (explicit teacher removal, not implicit wipe)
```

Order of operations must be **one atomic unit** (see §3 — a Postgres function via `.rpc()`, not three sequential JS-side awaited calls), so a failure partway through never leaves the assignment in a mixed or zero-question state — directly closing the "delete succeeds, insert fails" gap already flagged in §1's table for the *current* implementation.

### Corrected lock condition (departs from the Sprint 4A audit's proposal — see Executive Summary)

**A question row is locked once any `assignment_submissions` row for its assignment has `status IN ('submitted', 'marked')`.** Not `assignments.status`. Concretely: `SELECT EXISTS (SELECT 1 FROM assignment_submissions WHERE assignment_id = $1 AND status IN ('submitted','marked'))` — evaluated inside the same atomic operation as the upsert, so there's no check-then-act race between "confirm unlocked" and "write."

This correctly permits the exact flow that exists today and must keep working: create assignment (status already `'active'`) → redirect to quiz builder → populate initial questions freely, because at that point every submission is still `'pending'`. It correctly forbids editing once real student work exists against the current question set, which is the actual invariant Sprint 4B's variants need, regardless of whether "draft" as a workflow concept ever ships.

### Identity Invariants — assessed against this design

| Invariant | Held by this design? | How |
|---|---|---|
| A canonical question UUID is permanent | Yes | UPDATE-in-place for matched ids; INSERT only for genuinely new rows |
| Teacher edits never generate replacement UUIDs | Yes | The diff-by-id logic never re-inserts an already-existing question |
| Every future adaptive variant can safely reference a canonical question | Yes | Lock activates before any variant table would exist to reference it, and stays enforced identically after |
| Analytics remain historically traceable | Yes | Same `id` before/after an edit means any analytics keyed on `question_id` (none exist yet, but this is what makes them possible later) stays valid |
| Evidence references remain valid | Yes, trivially | `learner_evidence` never references `assignment_questions.id` directly (confirmed — it stores a free-text `raw_input_ref` string, `assignment:{id}:score=...`, not a question FK), so this invariant was never at risk from this table specifically; recorded for completeness |
| Future AI regeneration preserves identity | Yes | Regeneration (Sprint 4B, out of scope here) would insert new variant rows referencing a stable `question_id` — this sprint's fix is the precondition, not the regeneration logic itself |

---

## 3. Infrastructure Findings

- **Supabase client typing**: confirmed (Sprint 4A audit) that neither `utils/supabase/client.ts` nor `utils/supabase/service.ts` binds the `Database` generic — every query in the codebase is compile-time unchecked regardless of this sprint. Not fixed here (cross-cutting, out of scope), but the new `AssignmentRepository` module should still hand-annotate explicit return types on every exported function (CLAUDE.md: "All `lib/` functions must have explicit return types") so it doesn't inherit `any` silently just because the client itself is untyped.
- **Generated types**: confirmed stale for exactly this domain (`assignment_questions` missing entirely; `assignments.is_quiz`/`substrand_id` and `assignment_submissions.answers`/`file_path`/`file_name`/`file_type` missing). Regenerate (`mcp__supabase__generate_typescript_types`) before writing the repository module, and again after this sprint's migration lands, per the Sprint 4A audit's own recommendation — repeated here because it's directly load-bearing for writing accurate hand-annotated types in the new module.
- **Migration discipline**: every migration reviewed across this initiative (Sprint A/B/C, LMS quiz extension, file upload) has been additive-only — new nullable columns, new tables, `IF NOT EXISTS` guards, no backfills, no destructive rewrites. This sprint's migration (a lock-check function/trigger, no new column strictly required if the lock condition is computed from `assignment_submissions` at write time rather than cached) should hold the same standard.
- **Repository conventions**: addressed in §1 — plain-function module under `lib/assignments/`, not a new class.
- **Transaction boundaries**: the one infrastructure gap this sprint must close. Existing precedent for atomic multi-step writes already exists in this codebase — `lib/repositories/curriculum.repository.ts`, `billing.repository.ts`, `compass.repository.ts`, and `webhook.repository.ts` all use `.rpc()` to call a Postgres function for operations that need atomicity. **Recommend the same pattern here**: a `replace_assignment_questions(assignment_id, questions jsonb)` Postgres function performing the lock-check + diff-upsert in one statement/transaction, called via `.rpc()` from the repository — not three sequential `.from(...)` calls from JS.
- **Foreign-key strategy**: unchanged — `assignment_questions.assignment_id → assignments.id ON DELETE CASCADE` is already correct and needs no revision.
- **Optimistic concurrency**: **none exists today** for the quiz builder (two teacher tabs/devices saving the same assignment's questions is last-write-wins, no `updated_at`/version check). Recommend explicitly *documenting* this as an accepted limitation for this sprint rather than adding version-column complexity — the realistic collision (one teacher, one device, occasionally two tabs) doesn't justify new machinery at this pilot's scale, and it's orthogonal to identity preservation (the *content* of the last write always keeps stable ids either way).
- **Error handling**: existing pattern (`console.error` + generic `apiError` message) is consistent across every route in this domain; the new repository's lock-rejection should surface as a distinguishable error (e.g. a specific error message/code the route maps to 409, not the generic "Failed to save quiz questions") so a teacher's UI can eventually explain *why* a save failed, even though building that UI copy is not this sprint's job.

---

## 4. Backward Compatibility Demonstration

- **Existing quizzes still edit correctly**: any assignment with zero `submitted`/`marked` submissions (the common case — most quizzes are edited during setup, before any student has answered) hits the UNLOCKED branch, producing the exact same net question set as today's delete-and-recreate, just with preserved ids instead of fresh ones. Observable behavior (what the teacher sees, what students are served) is unchanged.
- **Existing assignments still publish correctly**: "publish" (in the sense of becoming visible, i.e. `status='active'`) is untouched by this sprint — no change to the PATCH endpoint's status-update logic itself.
- **Existing grading remains unchanged**: `gradeQuiz`/`gradeAndSubmitQuiz` are not modified; they still read live `assignment_questions` at grade time (correctly, per the Sprint 4A audit — this only becomes a real problem once variants exist).
- **Existing evidence remains unchanged**: `recordQuizAutoGradeEvidence`/`recordAssignmentMarkEvidence` untouched; confirmed above that `learner_evidence` never references a question id.
- **Existing APIs remain unchanged**: `PUT /api/teacher/assignments/[id]/questions` keeps the same request/response shape (`QuestionInput[]` in, `TeacherQuestionRow[]` out) — the only addition is an optional `id` field on the input items, ignored gracefully by any caller that doesn't send one (a genuinely new question, matching today's `POST`-shaped behavior for a first-time question set).
- **No learner-visible behavior changes**: confirmed — the student-facing routes (`/api/student/assignments`, `/api/student/assignments/[id]/questions`) are untouched by every finding above.

---

## 5. Test Plan

| Test | Type | Invariant protected | Regression prevented |
|---|---|---|---|
| `AssignmentRepository` create/read/update functions match today's route behavior exactly (same rows, same shape) | Repository | Extraction changes nothing observable | A refactor silently altering a default value or join |
| Edited question (same `id` sent back) keeps its original `id` after save | Identity preservation | "UUID is permanent across edits" | The exact bug this sprint exists to fix |
| New question (no `id`, or an unrecognized `id`) gets a fresh row, doesn't collide with an existing one | Identity preservation | INSERT-only-for-new semantics | Accidentally overwriting an unrelated question via id confusion |
| Removed question (present before, absent from the new array) is deleted, and only that one | Identity preservation | Explicit-removal semantics | Silent orphaning or over-deletion |
| A quiz with zero submitted/marked submissions can be freely edited any number of times | Regression | The exact flow `new/page.tsx:218` depends on today | Breaking initial quiz setup — this is the flow the Sprint 4A audit's original (status-based) design would have broken |
| Once one submission is `submitted`/`marked`, a further `replaceQuestions` call is rejected entirely (no partial application) | Identity preservation / Regression | The corrected lock condition | Reintroducing the ability to silently invalidate a graded student's answer |
| Existing route tests (`quiz.integration.test.ts`, `quiz.pure.test.ts`, `quizEvidence.integration.test.ts`) pass unmodified | Route / Regression | Every backward-compatibility claim in §4 | Any behavior drift introduced by the extraction |
| Two concurrent `replaceQuestions` calls against the same unlocked assignment don't corrupt state (last write wins cleanly, no duplicate/missing rows) | Concurrency | The RPC's atomicity | A half-applied diff from two overlapping requests |
| A direct SQL `UPDATE`/`DELETE` against a locked assignment's `assignment_questions` (bypassing the repository entirely) is rejected | Database constraint | "Enforced at the DB layer, not just app discipline" — matching `learner_evidence`'s own `trg_learner_evidence_immutability` precedent | A future, unrelated code path (or a raw SQL console session) silently corrupting locked data |

---

## 6. Performance Review

- **Query count**: today's `replaceQuestions` is 2 round trips (DELETE, INSERT). The corrected design, if written as a single Postgres function called via `.rpc()`, is **1 round trip** from the application's perspective (the diffing and lock-check happen inside the function) — a net improvement, not a regression.
- **Transaction count**: today, 0 (no transaction at all — two independent statements). New design: 1 transaction (implicit, inside the Postgres function) — strictly safer, negligible overhead at this table's realistic size (a quiz's question count is single digits to low tens per the original migration's own framing).
- **Locking behavior**: a single `assignment_id`-scoped write, row-count in the tens at most — no risk of lock contention at pilot scale (50 teachers).
- **Bulk edit behavior**: unchanged in shape (still one full array submitted per save from the quiz builder page) — no new per-question round trip introduced.
- **Teacher editing latency**: expected neutral-to-improved (fewer round trips), not measurable as a regression at this data volume.

**Confirmed**: identity preservation introduces no significant performance regression — if anything, collapsing two round trips into one RPC call is a small net improvement.

---

## 7. Risks

| Risk | Assessment | Mitigation |
|---|---|---|
| Concurrent teacher edits | Low impact at pilot scale (single teacher per assignment in practice); no version check exists or is proposed | Documented as an accepted limitation (§3), not blocking |
| Partial saves | Real risk in today's code (delete-succeeds/insert-fails leaves zero questions); eliminated by the atomic RPC design | Must ship as one transaction, not sequential JS calls — non-negotiable part of this sprint, not an optional nicety |
| Transaction rollback | New surface area (the RPC itself) — must be tested for a deliberately-forced mid-function failure to confirm the transaction actually rolls back rather than partially committing | Explicit test, not just code review |
| Identity corruption | The core risk this sprint exists to close; assessed as fully mitigated by the diff-by-id design, contingent on the RPC actually being atomic (see previous row) | — |
| Historical analytics | No analytics currently key on `question_id` (confirmed — none exist yet), so no present-day risk; this sprint's job is only to make such analytics *possible* later, not to build them | — |
| Future variant references | Directly the point of this sprint; a variant table built before this fix would inherit the cascade-delete hazard | — |
| Future AI regeneration | Depends on stable ids existing, which this sprint provides; no regeneration logic is touched here | — |
| Repository migration risk | Low — Sprint 4A.1's first phase (extraction) is a pure refactor over routes with existing integration test coverage | Run existing tests before and after extraction with zero behavior diff as the acceptance bar |

---

## 8. Implementation Order

1. **Extract `lib/assignments/` repository functions** for `assignments`/`assignment_questions`/`assignment_submissions` reads and writes, replacing inline route SQL 1:1 (no behavior change). Existing tests must pass unmodified.
2. **Write the `replace_assignment_questions` Postgres function** (diff-by-id upsert, lock-check, all in one transaction) and its migration (additive: new function + trigger/constraint enforcing the DB-level rejection on a locked assignment's rows; no new column strictly required since the lock condition is computed from `assignment_submissions` at call time — though a cached `is_locked` boolean maintained by a trigger on `assignment_submissions` status changes is an acceptable alternative if computing the `EXISTS` check per-write proves undesirable; either is additive-only).
3. **Wire the repository's `replaceQuestions` to call the RPC** instead of the old delete/insert pair; add the optional `id` field to `QuestionInput`.
4. **Full test suite** from §5, including the corrected-lock-condition test and the concurrency/rollback tests.

Steps 1–2 can proceed in parallel (independent files); step 3 depends on both; step 4 gates merge.

---

## 9. Exit Criteria Assessment

| Criterion | Met? |
|---|---|
| Assignment persistence has a repository layer | Yes, by design — §1, §8 step 1 |
| Question identity is stable | Yes, contingent on the RPC's atomicity being verified by test (§5, §7) |
| Existing APIs continue functioning | Yes — §4 |
| No learner-visible behavior changes | Yes — confirmed, student-facing routes untouched |
| No architectural invariants from ADR-0022–ADR-0025 violated | Yes — no learner model, curriculum model, recommendation engine, evidence pipeline, or grading engine touched; the one design correction (lock condition) *strengthens* alignment with ADR-0025's `served_variant_map` intent rather than departing from it |

---

## 10. Final Recommendation

**CONDITIONAL GO.**

Conditions, both non-negotiable before merge, not follow-up work:

1. The diff-upsert-and-lock-check must be one atomic database operation (Postgres function via `.rpc()`), not sequential JavaScript-side calls — this is what actually closes the partial-write risk both this document and the Sprint 4A audit identified as the central concern.
2. The lock condition must be **submission-activity-based** (`assignment_submissions.status IN ('submitted','marked')`), not `assignments.status`-based — the latter would silently break the existing create-then-populate-questions flow that every quiz assignment goes through today, confirmed by tracing `app/teacher/assignments/new/page.tsx:218`'s redirect against the hardcoded `status: 'active'` at creation.

With both conditions satisfied, Sprint 4A.1 delivers exactly what it promises — a repository layer and permanent question identity — with zero learner-visible change and a verified-safe foundation for Sprint 4B.
