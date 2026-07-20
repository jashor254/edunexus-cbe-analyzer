# Sprint 4A — Canonical Assessment Foundation: Implementation Audit

**Status: Design review only. No code, no migrations, no files modified in producing this document.**

**Depends on**: ADR-0022 (Adaptive Quiz Generation, DRAFT), ADR-0023 (ARDS, DRAFT), ADR-0024 (Canonical Curriculum Identity, implemented Phases 1–3), ADR-0025 (Adaptive Assessment Transformation Engine, DRAFT — this sprint is its first implementation increment, explicitly *not* the AI-generation part).

Every finding below was confirmed by reading live code, live migrations, and generated types directly — not assumed.

---

## 1. Executive Summary

Two facts change the shape of this sprint from what the brief anticipates:

1. **The Draft/Publish visibility gate for assignments already exists and already works correctly.** `app/api/student/assignments/route.ts:68` filters `.eq('status', 'active')` — a `'draft'`-status assignment is already invisible to students today, with zero new code. `app/api/teacher/assignments/[id]/route.ts` already accepts `PATCH { status: 'draft' | 'active' | 'closed' }`. The only real gap is that **assignment creation hardcodes `status: 'active'`** (`app/api/teacher/assignments/route.ts:143`) — there is no way to create an assignment that starts as a draft.
2. **The actual blocker to "immutable Canonical Questions" is not schema — it's an existing destructive write.** `lib/quiz/quiz.ts::replaceQuestions()` deletes every `assignment_questions` row for an assignment and re-inserts fresh rows (fresh UUIDs) every time a teacher saves the quiz builder. Any future `assignment_question_variants.question_id` foreign key would be **silently cascade-deleted** on every quiz-builder save, and grading itself re-reads `correct_index` from live `assignment_questions` at grade time rather than from a stored per-submission snapshot. This — not a missing table — is the thing that makes "canonical questions" not yet a real concept in this codebase, and it is squarely in Sprint 4A's scope to fix.

Everything else the brief worries about (evidence flow, grading engine, curriculum resolution, recommendation engine) needs **zero changes** — all confirmed reusable as-is.

**Recommendation: CONDITIONAL GO** — the success statement is honestly achievable in Sprint 4A, but only if the `replaceQuestions` rewrite (item 2) is fixed in this same sprint, not deferred. Building draft-gating without fixing the destructive write would produce a foundation that Sprint 4B's variants would immediately break.

---

## 2. Architecture Findings — Full Layer Trace

```
Teacher creates assignment (app/api/teacher/assignments/route.ts, direct DB access — no repository layer)
        │
        ├─▶ assignments row inserted, status hardcoded 'active' (no draft path today)
        │
        ├─▶ assignment_submissions pre-created for every enrolled student, status 'pending'
        │        (unconditional — runs regardless of what the assignment's status will be)
        │
        └─▶ publishEvent('teacher.assignment.created') — dead event bus, zero live consumers
                 (confirmed: grep for a registerEventHandler on this event type returns nothing
                 outside the event type declaration itself — same finding ADR-0023 already made
                 about this bus generally)

Teacher builds quiz questions (app/teacher/assignments/[id]/quiz/page.tsx)
        │
        └─▶ PUT /api/teacher/assignments/[id]/questions → replaceQuestions()
                 → DELETE all assignment_questions for this assignment, INSERT fresh rows
                 (fresh UUIDs every save — no stable question identity across edits)

Student lists assignments (app/api/student/assignments/route.ts)
        │
        └─▶ SELECT ... FROM assignments WHERE status = 'active'   ← draft gate already real, here

Student takes quiz (app/api/student/assignments/[id]/questions/route.ts)
        │
        └─▶ findQuestionsForStudent() — selects id, question_text, choices, order_index
                 explicitly excludes correct_index (server-side column strip, no client RLS
                 read policy exists for students on assignment_questions at all)

Student submits (app/api/student/submit-quiz/route.ts → gradeAndSubmitQuiz())
        │
        └─▶ Re-fetches correct_index from LIVE assignment_questions at grading time,
                 grades immediately (submit and grade are one atomic step today — no
                 asynchronous window, so this re-fetch is currently harmless, but it is
                 exactly the pattern that breaks once "served variant ≠ current live row"
                 becomes possible)
        │
        └─▶ recordQuizAutoGradeEvidence() (lib/quiz/quizEvidence.ts) — Tier 2 evidence,
                 curriculum-anchored via resolveCurriculumContext(substrand_id) — unmodified,
                 reusable exactly as-is

Teacher marks a non-quiz assignment (app/api/teacher/assignments/[id]/mark/route.ts)
        │
        └─▶ recordAssignmentMarkEvidence() (lib/assignments/evidence.ts) — separate,
                 teacher-initiated evidence producer, also unmodified/reusable

Gradebook (lib/gradebook/gradebook.ts)
        │
        └─▶ Reads assignments + assignment_submissions directly, teacher-scoped, NO status
                 filter — a draft assignment already appears in the teacher's own Gradebook.
                 Correct behavior (teacher-facing), not a leak.

Classroom Differentiation (lib/adaptiveLearning/differentiation.ts)
        │
        └─▶ Fully built, fully orphaned — its two API routes have zero UI callers anywhere
                 in app/ or components/ (confirmed by exhaustive grep). Not touched by this
                 sprint; named only because its draft/approve shape is the interaction
                 precedent Sprint 4B's teacher-review screen should copy.
```

**No repository layer exists for the Assignments domain.** Every route above (`app/api/teacher/assignments/*`, `app/api/student/assignments/*`) calls `createServiceClient()` and queries tables directly inline — a live, pre-existing violation of this project's own standing rule ("ALL database calls go through `lib/` functions only... API routes are thin — call `lib/` functions only, no inline business logic"). This predates Sprint 4A and is out of this sprint's scope to fix wholesale, but **Sprint 4A's new logic must not be added to this same pattern** — new draft-gating and canonical-question-locking logic belongs in a new `lib/assignments/` (or extended `lib/quiz/`) function, not inline in a route, so the debt doesn't compound.

---

## 3. Database Findings

### `assignments`
- **Purpose**: one row per teacher-created assignment (quiz or non-quiz).
- **Owner**: no repository — read/written directly by 7 route files (listed in §9).
- **Read locations**: `app/api/teacher/assignments/route.ts` (GET), `[id]/route.ts` (GET/PATCH), `[id]/mark/route.ts`, `[id]/questions/route.ts`, `app/api/student/assignments/route.ts`, `[id]/questions/route.ts`, `lib/gradebook/gradebook.ts`, `lib/holiday/*` (holiday assignments).
- **Write locations**: `app/api/teacher/assignments/route.ts` (INSERT), `[id]/route.ts` (UPDATE — status only, today).
- **FKs**: `class_id → teacher_classes`, `lesson_plan_id → lesson_plans`, `teacher_id → teachers`, `substrand_id → sow_substrands` (added `20260723101000_assignments_substrand_id.sql`).
- **Migration history**: base table (pre-dates this audit's migration window) + `is_quiz` and `is_compass_guided` handling added `20260723093000_lms_quiz_extends_assignments.sql` + `substrand_id` added `20260723101000_assignments_substrand_id.sql`.
- **Generated types status**: **STALE.** `lib/database.types.ts`'s `assignments.Row` is missing `is_quiz` and `substrand_id` entirely, despite both being live, actively-queried columns (`app/api/teacher/assignments/route.ts` selects and inserts both). No compile error results only because `createServiceClient()` (`utils/supabase/service.ts`) never binds `createClient<Database>(...)` to the `Database` generic at all — **every service-role query in the entire codebase is untyped**, not just these two columns. This is a cross-cutting finding beyond Assignments, flagged here because it's what's currently masking the drift.

### `assignment_questions`
- **Purpose**: one shared flat MCQ question set per quiz-type assignment.
- **Owner**: `lib/quiz/quiz.ts` (`replaceQuestions`, `findQuestionsForTeacher`, `findQuestionsForStudent`) — the closest thing to a repository this domain has, though it's a plain module, not a class implementing a repository interface like `AssessmentRepository`.
- **Read locations**: `app/api/teacher/assignments/[id]/questions/route.ts` (GET, teacher, includes `correct_index`), `app/api/student/assignments/[id]/questions/route.ts` (GET, student, excludes `correct_index`), `gradeAndSubmitQuiz()` (grading, re-reads live).
- **Write locations**: `PUT /api/teacher/assignments/[id]/questions` only — full delete-and-recreate, no partial update path exists.
- **FKs**: `assignment_id → assignments`, `ON DELETE CASCADE`.
- **Indexes**: `idx_assignment_questions_assignment_id (assignment_id, order_index)`.
- **Migration**: `20260723093000_lms_quiz_extends_assignments.sql`.
- **Generated types status**: **MISSING ENTIRELY** — this table does not appear anywhere in `lib/database.types.ts`. Same untyped-client root cause as above; still needs a types regeneration pass regardless, since anyone hand-writing types against this table today is working from the migration file, not a generated source of truth.
- **RLS**: teacher-CRUD-only policy; deliberately no student SELECT policy at all (correct_index protection is enforced by "no client policy + service-role route strips the column," not row/column security).

### `assignment_submissions`
- **Purpose**: one row per (assignment, student) — status lifecycle `pending → submitted → marked`.
- **Owner**: no repository; read/written directly by the same route files as `assignments`.
- **Read locations**: teacher `[id]/route.ts` GET, student `assignments/route.ts` GET, `lib/gradebook/gradebook.ts`, `mark/route.ts`.
- **Write locations**: pre-created at assignment-creation time (`route.ts` POST, unconditional), updated by `gradeAndSubmitQuiz()` (quiz) and `mark/route.ts` (manual).
- **FKs**: `assignment_id → assignments`, `class_id → teacher_classes`, `compass_session_id → compass_sessions`, `student_id → students`.
- **Generated types status**: **STALE** — missing `answers` (jsonb, added same migration as `assignment_questions`) and missing `file_path`/`file_name`/`file_type` (added `20260723090000_lms_assignment_file_upload.sql`), both live columns actively selected in `[id]/route.ts` GET.

### `assignment_marks`
- **Does not exist.** Confirmed by exhaustive grep across the entire codebase (migrations, `lib/`, `app/`) — there is no such table. The brief's checklist names it defensively; the real location of a "mark" is `assignment_submissions.score` (auto-graded or manually entered) plus, separately, `lib/assessments/*` + `assessment_repository.ts`'s own `class_assessments`/marks tables for the unrelated formal-assessment domain (CATs/exams), which this sprint does not touch.

### `learner_evidence`
- **Purpose**: canonical, immutable-after-creation Evidence store (out of scope to modify — cited here only to confirm the audit's boundary).
- **Read/write locations relevant to this sprint**: `lib/quiz/quizEvidence.ts::recordQuizAutoGradeEvidence` (INSERT-only, via `persistEvidenceBatch`), `lib/assignments/evidence.ts::recordAssignmentMarkEvidence`. Neither needs modification — Sprint 4A introduces zero new evidence-producing logic; a served-variant submission still calls the exact same `recordQuizAutoGradeEvidence` once graded.
- **Confirmed immutability discipline** (the standard this sprint's own "immutable Canonical Questions" should match): corrections are new evidence rows superseding old ones via `superseded_by`/`supersedes`, enforced by a DB trigger — not an app-level convention. Canonical Question immutability should follow the same "DB-enforced, not just discipline" pattern (see §7).

### Should canonical question identity live inside `assignment_questions`, or a separate `canonical_questions` table?

**Recommendation: inside `assignment_questions`. No separate table.**

`assignment_questions` already *is* the canonical/Independent-tier content — this was true before this sprint and needs no new table to become true. A separate `canonical_questions` table would duplicate identical data (question_text/choices/correct_index) for zero new capability, violating the brief's own "avoid duplicate question systems" and "avoid duplicate storage" constraints. The only real change `assignment_questions` needs is behavioral, not structural: **rows must become immutable once locked** (first approved/published, or once any variant references them), and the current `replaceQuestions()` delete-and-recreate must stop being how edits happen post-lock. Adding an `is_locked boolean NOT NULL DEFAULT false` column (or reusing the assignment's own `status` transition as the lock signal — see §7) plus a DB trigger rejecting `UPDATE`/`DELETE` on a locked row is the smallest correct change, additive to the existing table.

---

## 4. Draft Workflow Audit

Today's real pipeline, traced end to end:

```
Teacher creates assignment → status='active' (hardcoded) → submissions pre-created (unconditional)
    → student sees it immediately (status='active' passes the student query's filter)
    → teacher builds/edits quiz questions any time (delete+recreate, no lock)
    → student submits → graded immediately against live question rows → evidence emitted
```

**Where Draft must interrupt this, concretely:**

1. **At creation**: the POST route must accept a `status` field from the teacher (`'draft'` when the teacher is going to review/generate variants before release, `'active'` for today's default unchanged behavior) instead of hardcoding `'active'`. This is a **minor, additive** change — the Zod schema gains one optional enum field, defaulting to today's behavior when omitted, so no existing caller breaks.
2. **Submission pre-creation must not need to change** — it already doesn't leak anything, because the student list route filters on `assignments.status`, not on the existence of a submission row (§2, §5). A pending submission for a draft assignment is inert data no student-facing code ever surfaces. **Confirmed by tracing every read path against `assignment_submissions`** — none of them is reachable without first passing through an `assignments.status='active'` (or teacher/parent-scoped) filter.
3. **Question locking must happen at Publish (draft → active), not at creation** — a teacher must still be able to freely edit questions while the assignment is in `draft`, exactly like today. The lock trigger fires on the `status: 'draft' → 'active'` transition, matching the existing PATCH endpoint's shape exactly (one more branch in its logic, not a new endpoint).

**Every write that must wait until Publish**: none, actually — the correct design is the reverse framing the audit surfaced: *nothing new needs to wait*, because visibility is already status-gated. What must change is (a) creation defaults to `draft` when the teacher asks for review, and (b) question rows become immutable at the `draft→active` transition, not before.

---

## 5. Publishing Audit

Tracing today's actual side effects of what currently happens at assignment creation (there is no separate "Publish" action today — creation IS publish, since status starts `active`):

| Side effect | Today | Sprint 4A |
|---|---|---|
| Student visibility | Immediate (status='active' at creation) | Gated by teacher's chosen initial status — **no code change needed**, already correct |
| Submission row creation | Immediate, unconditional | **Unchanged** — confirmed harmless while draft (§4.2) |
| Notifications | None fire today (event bus has zero live consumers) | **Unchanged** — no notification exists to move |
| Evidence eligibility | N/A until a submission is graded | **Unchanged** — evidence only ever fires post-submission, already correctly decoupled from creation/publish |
| Analytics | None found referencing assignment creation/publish specifically | **Unchanged** — no analytics side effect exists to relocate |
| Question immutability | None — freely editable via delete+recreate at any time | **New**: locks at the `draft→active` transition (§7) |

**Conclusion**: the brief's "which side effects move from Create to Publish" question has a smaller answer than expected — today, *no* side effect needs to move, because the only side effect that actually matters for learner-facing correctness (visibility) is already gated on a field (`status`) this sprint is already changing the initial value of. The one genuinely new gate this sprint introduces is question-locking, which has no "Create" analog to move from — it's a wholly new behavior at the publish transition.

---

## 6. Canonical Question Audit

`assignment_questions` behaves as a canonical question model **in content shape** (question_text/choices/correct_index/order_index is exactly right) but **not in identity stability** — the `replaceQuestions()` delete-and-recreate means a question's `id` is not a durable identity across a teacher's edits. This is disqualifying for "canonical" in the sense Sprint 4A needs (something a future `assignment_question_variants.question_id` FK, and a `served_variant_map`, can safely reference across the assignment's lifetime).

**Smallest additive fix**: change `replaceQuestions()` from delete-all/insert-all to a diff-based upsert (match incoming questions to existing rows by `id` when the client sends one back, insert new rows only for genuinely new questions, delete only rows the teacher explicitly removed) — *while still in draft*. Once locked (`draft→active`), `replaceQuestions()` must be rejected outright for that assignment (a locked assignment's questions become append-only-elsewhere: a teacher who needs to change a published quiz's questions closes it and creates a new one, matching this domain's own existing "CBC classrooms re-create the assignment for the next class/term" convention already documented in the original migration's comment).

No duplicate question system, no duplicate storage — this is a behavioral fix to the one function that touches this table's write path, plus a DB-level lock.

---

## 7. Variant Persistence Audit

*(Scoped for completeness per the brief's own request — Sprint 4A does not build this table; it only ensures nothing it does this sprint would need to be redesigned when Sprint 4B does.)*

| | **Option A** — `assignment_question_variants` (separate table, FK to `question_id`) | **Option B** — extend `assignment_questions` with nullable variant columns | **Option C** — other (e.g., JSONB blob on `assignments`) |
|---|---|---|---|
| Scalability | Good — one row per (question, tier), bounded by `questions × distinct tiers present`, same bound ADR-0022/0025 already committed to | Poor — one row per question would need N columns or N rows per tier, forces either wide sparse columns or breaks "one shared row set" semantics `assignment_questions` already has | Poor — unindexed blob, can't FK to curriculum nodes, can't be queried per-tier |
| Simplicity | Clean — one clear owner table, mirrors `learner_evidence`'s own "one table, narrow purpose" shape | Muddies `assignment_questions`'s existing meaning (currently unambiguously "the" question set) | Simplest to add, worst to query/validate |
| Migration cost | One new table + one new column (`served_variant_map`) — additive, zero risk to existing rows | Requires altering the table every consumer already depends on (`findQuestionsForStudent`, `findQuestionsForTeacher`, `gradeAndSubmitQuiz`) | Requires new JSON-shape validation everywhere it's read |
| Future AI regeneration | Natural — regenerate by inserting new draft rows, old approved rows stay referenced by past `served_variant_map` entries (append-only) | Awkward — "regenerate" means overwriting columns in place, which is exactly the mutation `learner_evidence`'s own immutability discipline forbids | Awkward for the same reason, worse (no row-level history at all) |
| Grading | Clean — grade against the exact `question_id` variant referenced in `served_variant_map` | Same query complexity as A but against a wider, muddier row | Requires parsing JSON at grade time — fragile |
| Analytics | Clean — `GROUP BY variant_tier` is a real, indexable query | Painful — would need to unpivot sparse columns | Requires JSON extraction in every aggregate query |
| Backward compatibility | Full — `assignment_questions` unchanged, existing quiz-only assignments unaffected | Partial — every existing reader of `assignment_questions` must be updated to ignore/handle new nullable columns | Full, but at the cost of everything else above |

**Recommendation: Option A.** This confirms, independently, the same conclusion both prior-session ADR-0025 drafts already reached. Named here only to close the loop the brief explicitly asked for — **not built in Sprint 4A.**

---

## 8. Teacher Workflow Audit

```
Teacher
  ↓ Create Assignment  — REUSE app/teacher/assignments/new/page.tsx, ADD one control:
  │                       "Save as Draft" vs today's implicit "Publish immediately"
  ↓ Save Draft         — REUSE the existing POST route, MINOR CHANGE (status field, §9)
  ↓ Review Questions   — REUSE app/teacher/assignments/[assignmentId]/quiz/page.tsx as-is;
  │                       its own copy already says "students will see this question set" —
  │                       that copy becomes conditionally true based on status, no redesign needed
  ↓ Future Adaptive Generation — NOT in this sprint (Sprint 4B+, per ADR-0025)
  ↓ Approve            — NEW, minimal: reuses the PATCH status endpoint's shape
  ↓ Publish            — REUSE PATCH /api/teacher/assignments/[id] (status→'active'),
                          ADD the question-lock trigger firing on this same transition
```

**Reusable UI, unmodified**: the quiz builder page, the assignment list page, the assignment detail/results pages. **Reusable UI, minor addition**: the "new assignment" form gains one radio/toggle for Draft vs Active initial status — a single new form field, not a new page.

---

## 9. Repository Audit

| Repository | Change needed | Why | Size | Migration risk | Backward compat |
|---|---|---|---|---|---|
| *(none exists for Assignments domain)* | **New**: extract a `lib/assignments/` (or extend `lib/quiz/quiz.ts`) module owning `assignments` + `assignment_questions` writes | Sprint 4A's new logic (draft-default creation, question locking) must not be added as more inline route SQL, compounding the existing CLAUDE.md violation named in §2 | Medium — mostly relocating existing inline queries from 2–3 route files into named functions, plus the new lock/upsert logic | Low — pure refactor of existing working queries, covered by existing integration tests (§13) before behavior changes are added | Full — route response shapes unchanged |
| `lib/quiz/quiz.ts` | `replaceQuestions()` → diff-based upsert; reject writes once locked | §6, §7 — the actual foundation-breaking issue this sprint exists to fix | Small-medium — one function's internals change, callers (the PUT route) unchanged | Low-medium — needs a real integration test proving IDs survive an edit (none exists today) | Full — API contract (`QuestionInput[]` in, `TeacherQuestionRow[]` out) unchanged |
| `lib/repositories/assessment.repository.ts` | None | Unrelated domain (formal CATs/exams, not Assignments) — confirmed no overlap | — | — | — |
| `lib/quiz/quizEvidence.ts`, `lib/assignments/evidence.ts` | None | Confirmed reusable exactly as-is (§3) | — | — | — |

---

## 10. API Audit

| Route | Classification | Why |
|---|---|---|
| `POST /api/teacher/assignments` | **MINOR CHANGE** | Add optional `status` to the Zod schema (default `'active'`, preserving every existing caller's behavior byte-for-byte); delegate the insert to the new `lib/assignments/` function instead of inline SQL |
| `GET /api/teacher/assignments` | **UNCHANGED** | No new fields needed for the list view in this sprint |
| `GET /api/teacher/assignments/[id]` | **UNCHANGED** | Detail view already returns full assignment row via `select('*')` |
| `PATCH /api/teacher/assignments/[id]` | **MINOR CHANGE** | Same status-update endpoint, now also triggers the question-lock check when the transition is `draft→active` (delegated to the new `lib/assignments/` function, not new inline logic in the route) |
| `PUT /api/teacher/assignments/[id]/questions` | **MAJOR CHANGE** | `replaceQuestions()` internals change from delete-all/insert-all to upsert-and-lock-aware (§6) — the route itself barely changes, but the function it calls does, and its behavior contract (stable IDs, rejects writes when locked) is new |
| `GET /api/teacher/assignments/[id]/questions` | **UNCHANGED** | Read path unaffected |
| `GET /api/teacher/assignments/substrands` | **UNCHANGED** | Curriculum picker, untouched domain |
| `POST /api/teacher/assignments/[id]/mark` | **UNCHANGED** | Manual marking, untouched |
| `GET /api/student/assignments` | **UNCHANGED** | Already filters `status='active'` — the exact behavior this sprint relies on, confirmed correct already |
| `GET /api/student/assignments/[id]/questions` | **UNCHANGED** | Already strips `correct_index`; no variant awareness needed until Sprint 4B |
| `POST /api/student/submit-quiz` | **UNCHANGED this sprint** | Grading-against-live-questions is currently harmless (submit-and-grade is atomic); flagged as a future dependency for Sprint 4B (grading must switch to `served_variant_map`), not a Sprint 4A change |
| `app/api/teacher/classes/[classId]/differentiation*` | **UNCHANGED / not touched** | Confirmed orphaned (§2); out of this sprint's scope |
| *(new)* none | **NO NEW ROUTE** | Every workflow step in §8 maps onto an existing route with a minor/major internal change — Sprint 4A needs zero new endpoints |

---

## 11. Validation Audit

- `CreateAssignmentSchema` (`app/api/teacher/assignments/route.ts`): add `status: z.enum(['draft','active']).optional()` — deliberately excluding `'closed'` here (closing happens via the existing PATCH path, never at creation).
- `UpdateAssignmentSchema` (`[id]/route.ts`): unchanged shape; the new lock-check is a side effect inside the function it delegates to, not a new field.
- `QuestionInput` (`lib/quiz/quiz.ts`): needs an optional `id` field added so the upsert can distinguish "existing question being edited" from "new question being added" — the one real shape change in this sprint.
- **Permissions**: no change. `requireClassTeacher`/`resolveTeacher` ownership checks already gate every write path correctly; the new lock check is an additional business-rule rejection (409-style "assignment is published, questions are locked"), not a new authorization dimension.

---

## 12. Generated Types Audit

Confirmed mismatches between `lib/database.types.ts` and live schema (via migrations):

| Table | Missing from generated types |
|---|---|
| `assignments` | `is_quiz`, `substrand_id` |
| `assignment_submissions` | `answers`, `file_path`, `file_name`, `file_type` |
| `assignment_questions` | **entire table missing** |

**Root cause, confirmed**: neither `utils/supabase/service.ts` nor `utils/supabase/client.ts` binds `createClient<Database>(...)` — the `Database` generic is never applied anywhere in this codebase's Supabase client factories, so no query against any table is compile-time-checked against the generated types regardless of drift. This predates and is broader than Sprint 4A; flagged, not fixed, here.

**Recommended regeneration timing**: run `mcp__supabase__generate_typescript_types` **before** writing the `lib/assignments/` repository extraction in Sprint 4A-1 (§14) — even though the untyped clients mean it won't be enforced by the compiler, the generated file should stop lying about what the schema actually contains before new code is written against it, and should be re-run again after Sprint 4A's own migration (question-lock column) lands.

---

## 13. Testing Audit

Existing coverage: `lib/quiz/quiz.integration.test.ts`, `quiz.pure.test.ts`, `quizEvidence.integration.test.ts`, `lib/curriculum/assignmentSubstrandId.integration.test.ts` — none of these currently assert question-ID stability across an edit (confirmed by reading `quiz.integration.test.ts`'s scope), which is exactly the gap this sprint closes.

| Test | Type | Invariant protected |
|---|---|---|
| Draft assignment excluded from student list | Integration | The one gate this whole sprint depends on already working — must have an explicit regression test, not just be trusted from this audit |
| Assignment created with no `status` field defaults to `'active'` | Unit/Integration | Backward compatibility — every existing caller of the create endpoint must keep working unchanged |
| `replaceQuestions()` preserves `id` for an edited (not removed) question | Integration | The core Sprint 4A fix — a question's identity must survive a teacher's edit |
| `replaceQuestions()` rejects a write once the assignment is locked | Integration | Immutability — the actual foundation "future variants can trust" |
| `draft → active` transition locks existing questions | Integration | The lock must fire at exactly the transition point, not before (teacher must be able to edit while drafting) and not never |
| `active → closed` does **not** re-lock or unlock questions | Unit | Guards against an over-broad lock implementation accidentally keying off the wrong status values |
| A pre-created `pending` submission for a draft assignment never appears in any student-facing query | Integration (regression) | Confirms §4.2's audit finding stays true as code changes around it |
| Grading still reads live `assignment_questions` correctly post-fix (no regression from the upsert change) | Integration | The upsert rewrite must not break today's working grade path |

---

## 14. Risks

| Category | Risk | Mitigation |
|---|---|---|
| Architectural | New logic added inline in routes, compounding the existing no-repository debt (§9) | Extract `lib/assignments/` in this same sprint, not deferred |
| Migration | `replaceQuestions()` upsert logic shipped without the ID-stability test, silently reintroducing the delete/recreate bug | Test named in §13 is non-negotiable before merge |
| Curriculum | None identified — no curriculum-resolution code path is touched this sprint | — |
| Security | None new — existing RLS (`assignment_questions` teacher-CRUD-only, no student policy) is unaffected; the lock is an app-level business rule on top of existing ownership checks | Confirm the lock check happens server-side in the function, not trusted from the client |
| Teacher workflow | A teacher who starts a quiz as Draft, adds questions, then can't find how to Publish (if the UI toggle is unclear) | Reuse the existing status-PATCH UI affordance rather than inventing new copy/UX |
| Data consistency | A locked assignment's `assignment_questions` rows are edited via some other future code path that doesn't know about the lock | Enforce the lock as close to the data as practical — a DB constraint/trigger, not only an app-level check in one function, mirroring `learner_evidence`'s own trigger-enforced immutability |
| Concurrency | Two rapid PATCH requests both hitting `draft→active` — double-lock is harmless (idempotent), but a race between a question edit and a lock-transition is possible | Lock check + question write should happen inside one transaction/RPC, not two round-trips |
| Publishing | None new — confirmed no side effect needs relocating (§5) | — |
| Rollback | A migration adding a lock column/trigger is trivially reversible (`DROP COLUMN`/`DROP TRIGGER`) since no data migration/backfill is involved — additive only | Keep the migration additive-only, as every other migration in this initiative already has been |

---

## 15. Implementation Plan

### Sprint 4A-1 — Extract the Assignments repository (no behavior change)
- **Objective**: move existing inline SQL from `app/api/teacher/assignments/*` and `app/api/student/assignments/*` into a new `lib/assignments/` module (or extend `lib/quiz/quiz.ts`), byte-for-byte same behavior.
- **Files expected**: new `lib/assignments/assignments.ts` (or similar); the 7 route files updated to call it instead of `createServiceClient()` directly.
- **Database changes**: none.
- **Tests**: existing integration tests must pass unmodified — this sprint's own success criterion is "no observable behavior change."
- **Exit criteria**: all existing tests green; no route file constructs raw Supabase queries against `assignments`/`assignment_questions`/`assignment_submissions` anymore.
- **Rollback**: revert the extraction commit — pure refactor, zero data risk.

### Sprint 4A-2 — Draft-capable creation
- **Objective**: assignment creation accepts an optional initial `status`.
- **Files expected**: `CreateAssignmentSchema` (Zod), the new repository's create function, the "new assignment" UI form (one added control).
- **Database changes**: none (column already exists).
- **Tests**: default-to-active backward-compat test; draft-created assignment excluded from student list (regression-proofing §4.2's finding).
- **Exit criteria**: a teacher can create an assignment that does not appear to students; existing create-flow callers unaffected.
- **Rollback**: revert the Zod/UI change; underlying data unaffected either way.

### Sprint 4A-3 — Canonical question identity + lock
- **Objective**: `replaceQuestions()` becomes an ID-preserving upsert; a DB-level lock (trigger + `is_locked` column or equivalent) rejects writes once the assignment transitions `draft→active`.
- **Files expected**: `lib/quiz/quiz.ts` (or its new repository home), one migration (`ALTER TABLE assignment_questions ADD COLUMN is_locked...` + trigger, or a trigger keyed off the parent `assignments.status`), the PATCH status endpoint wired to trigger the lock check.
- **Database changes**: one additive migration — new column and/or trigger, no backfill, no destructive change to existing rows.
- **Tests**: the four `replaceQuestions`/lock tests named in §13.
- **Exit criteria**: a question's `id` survives a teacher edit; no write to a locked assignment's questions succeeds, enforced at the DB layer.
- **Rollback**: `DROP TRIGGER` / `DROP COLUMN` — additive-only migration, fully reversible.

**Sprint 4A ends here.** Sprint 4B (per ADR-0025) is the first sprint permitted to touch `assignment_question_variants`, AI generation, or `served_variant_map` — none of that is in scope for this sprint, per the brief's own instruction.

---

## 16. Constraints — Confirmed Respected

No new learner model, curriculum model, recommendation engine, evidence pipeline, or grading engine is introduced anywhere in this plan. Every reused component (`resolveCurriculumContext`, `recordQuizAutoGradeEvidence`, `recordAssignmentMarkEvidence`, `gradeQuiz`) is cited above as unmodified. The one new repository module is an extraction of existing logic, not a new architectural layer with new responsibilities.

---

## 17. Exit Criteria Assessment

> "EduNexus can store immutable canonical assessment content in Draft, without exposing it to learners, while preserving complete backward compatibility and providing a stable foundation for future adaptive variants."

**Achievable within Sprint 4A as scoped above — with one honest caveat**: "immutable" only becomes true *after* Sprint 4A-3's lock ships. Sprints 4A-1 and 4A-2 alone would satisfy "stored in Draft, not exposed to learners, backward compatible" but **not** "immutable" — a teacher could still silently blow away question IDs via the unfixed `replaceQuestions()`. All three increments are required together for the exit statement to be honestly true; 4A-1/4A-2 without 4A-3 should not be reported as meeting this sprint's success definition.

---

## 18. Recommendation

**CONDITIONAL GO.** Proceed with Sprint 4A-1 → 4A-2 → 4A-3 in that order, as one sprint (they're small individually and 4A-3 is the part that actually matters — splitting it out further would just create a window where "draft" exists without "immutable" actually being true). Do not begin Sprint 4B (variant persistence, AI generation) until 4A-3's lock is merged and its four tests are green — a variant table built against `assignment_questions` rows that can still be silently deleted out from under it would inherit exactly the failure mode this audit exists to prevent.
