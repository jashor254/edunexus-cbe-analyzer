# Sprint 9 — Slice 1: Canonical Question Identity + Variant Persistence

## Implementation Report

**Status: Implemented and verified against the live, linked Supabase project** (`lpxrfbmzncaztpmyqzkc`), with explicit user confirmation before any schema change was applied. Scope, as agreed: Sprint 4A.1's ID-preserving upsert/lock design + Sprint 4B's `assignment_question_variants` schema design. No AI generation, no teacher review UI, no student-facing delivery/grading changes — those remain later slices (see the Sprint 9 audit doc).

---

## 1. What Was Built

### Canonical question identity (Sprint 4A.1 design, now real)

- `enforce_assignment_questions_lock()` — a DB trigger on `assignment_questions` (`BEFORE INSERT OR UPDATE OR DELETE`) that rejects any write once real submission activity (`assignment_submissions.status IN ('submitted', 'marked')`) exists for the parent assignment. Deliberately **not** keyed off `assignments.status` — confirmed against the actual create-assignment flow (`app/teacher/assignments/new/page.tsx` redirects straight to the quiz builder while status is already `'active'`), a status-keyed lock would have broken that already-working flow.
- `replace_assignment_questions(p_assignment_id, p_questions)` — an atomic Postgres function replacing `lib/quiz/quiz.ts`'s old client-side delete-then-insert. Matched questions (sent back with their `id`) are updated in place; new ones (no `id`) are inserted; removed ones are deleted. One transaction — the lock trigger firing anywhere inside it rolls back the whole call, so a locked assignment's edit attempt never partially applies.
- `lib/quiz/quiz.ts::replaceQuestions()` now calls this RPC instead of `.delete()` + `.insert()`. `QuestionInput` gained an optional `id` field.
- `app/teacher/assignments/[assignmentId]/quiz/page.tsx` and its API route now thread that `id` through the full load → edit → save cycle (previously the frontend discarded it on load, which would have silently defeated the backend fix — found and fixed as part of making this real end-to-end, not just in the database).

### Variant persistence (Sprint 4B design, now real)

- `assignment_question_variants` — one row per (canonical question, instructional tier: `foundation`/`supported_practice`/`extension`). `'independent'`/on-track is deliberately not a stored value — the canonical question already is that tier's content.
- A **partial unique index** (`question_id, variant_type WHERE status = 'approved'`) — the one DB-level guarantee this whole design leans on: at most one servable variant per (question, tier) at any moment.
- `enforce_variant_lifecycle_transition()` trigger — an approved or rejected row can only ever become `archived`; an archived row is fully immutable. DB-enforced, not app discipline, mirroring `learner_evidence`'s own immutability trigger.
- `regenerate_assignment_question_variant(p_old_variant_id, p_new_variant)` — archives the old row (`superseded_by` set) and inserts a fresh draft, atomically, in one transaction. A learner already served the old row keeps a permanently valid, gradable reference.
- Teacher-only RLS, same shape as `assignment_questions`' own policy — no student/parent read path.
- `assignment_submissions.served_variant_map jsonb` — additive column, not yet populated or read by any code (that's the delivery slice, later).
- `lib/assignments/variants.ts` — the new Variant Repository: `createDraftVariants`, `findVariantsForQuestion`, `findApprovedVariant`, `findVariantById` (deliberately status-agnostic, for a future grading path that must read an archived row), `approveVariant`, `rejectVariant`, `regenerateVariant`.

### Types

- Regenerated `lib/database.types.ts` from the live schema — closes the exact drift the Sprint 4A audit flagged (`assignment_questions` was missing from generated types entirely; `is_quiz`/`substrand_id`/`served_variant_map` now all present).

---

## 2. Migration Applied

Two migrations, applied to the live project with explicit confirmation, and committed as matching local files:

- `20260720021344_assignment_question_variants.sql` — the schema above.
- `20260720021649_assignment_question_variants_search_path_hardening.sql` — a follow-up fixing a `function_search_path_mutable` advisory finding on the 4 new functions (a pre-existing pattern across dozens of functions in this project; fixed here only for the new ones this slice introduced, not a project-wide sweep).

Both additive-only — no existing row touched, no destructive change, matching every migration precedent in this project's own history.

---

## 3. Tests — All Run Against the Real, Migrated Database

| File | Result |
|---|---|
| `lib/quiz/quiz.integration.test.ts` (pre-existing, unmodified) | 5/5 pass — the RPC-based `replaceQuestions` is a byte-for-byte behavioral match for every pre-existing test |
| `lib/quiz/quizIdentityLock.integration.test.ts` (new) | 5/5 pass — ID preservation across edits, new-question insertion, explicit-removal-only deletion, atomic lock rejection (both for editing an existing question and for adding a brand-new one), and post-rejection state left byte-for-byte unchanged |
| `lib/assignments/variants.integration.test.ts` (new) | 7/7 pass — draft creation, the partial-unique-index constraint actually rejecting a second approval, the lifecycle trigger rejecting an illegal transition, rejection, atomic regeneration (old row archived + `superseded_by` set + still fully readable), and full immutability of an archived row |
| `lib/quiz/quiz.pure.test.ts` (pre-existing) | 2/2 pass |

**22/22 tests pass.** `npx tsc --noEmit` and `eslint` are clean across every changed file, including the regenerated `database.types.ts`.

One real bug caught during this work, not before: the quiz builder page discarded each question's `id` on load (`{questionText, choices, correctIndex}`, no `id`), which would have silently defeated the entire backend fix — every save would have looked like "all new questions" to the RPC. Found and fixed as part of making Slice 1 actually work end-to-end, not just in isolated backend code.

---

## 4. What This Slice Deliberately Does Not Include

Per the agreed scope: no AI generation (Sprint 5A), no teacher review/comparison UI, no draft-capable assignment creation (Sprint 4A's own design), no variant resolution or variant-aware grading (Sprint 4C). `assignment_question_variants` exists, is fully tested, and is ready for the next slice to populate — nothing in it is dormant-by-accident; it's dormant-by-design until generation exists, the same honest state `EducationalAIContext` was left in after Sprint 7A.

---

## 5. Exit Criteria — Assessed

The blocking hazard every prior design doc in this series (Sprint 4A, 4A.1, 4B) identified — a variant table FK'd to `assignment_questions.id` inheriting a cascade-delete hazard from the old delete-and-recreate write path — **no longer exists**, verified by test, against the real database, not asserted from the design docs alone. The next slice (generation) can now build on a foundation proven to hold under exactly the conditions (concurrent edits, regeneration, locked assignments) it was designed to survive.
