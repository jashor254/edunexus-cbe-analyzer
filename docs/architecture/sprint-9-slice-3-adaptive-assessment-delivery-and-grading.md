# Sprint 9, Slice 3 — Adaptive Assessment Delivery & Variant-Aware Grading

## Implementation Report

**Status: Implemented and verified against the live, linked Supabase project.** This completes the pipeline Sprint 9 Slices 1–2 built toward: a learner now actually receives a bound adaptive variant, graded correctly, feeding the existing Evidence/Projection loop with zero new reasoning.

---

## 1. What Was Built

- **Migration** `20260720024215_served_variant_resolution.sql` — one Postgres function, `resolve_served_variants_batch(assignment_id, student_id, pairs)`. A single guarded `UPDATE` is Postgres's standard atomic write-once-merge pattern: under the default READ COMMITTED isolation level, a second concurrent `UPDATE` targeting the same row blocks on the row lock until the first commits, then re-evaluates its own guard against the now-current row (`EvalPlanQual`) — so it only ever merges keys the first call didn't already claim. No explicit `FOR UPDATE` needed; the one `UPDATE` statement is the atomic unit.
- `lib/quiz/quizDelivery.ts` — the one place resolution and delivery happen: `resolveServedVariantsForStudent` (resolve-once, cache-forever), `findServedQuestionsForStudent` (student-facing, never leaks `correct_index`), `resolveGradingQuestions` (variant-aware answer-key resolution).
- `lib/quiz/quiz.ts::gradeAndSubmitQuiz` extended (not replaced) — the only change is which `correct_index` values feed the same, unmodified `gradeQuiz()` pure function.
- `app/api/student/assignments/[id]/questions/route.ts` extended — calls `findServedQuestionsForStudent` instead of `findQuestionsForStudent`; the ownership/auth checks above it are untouched.

---

## 2. Constitutional Rules — Verified Held

| Rule | How it's held |
|---|---|
| No second grading engine | `gradeQuiz()` (`quizPure.ts`) is byte-for-byte unchanged — only its *input* (`correctIndex` per question) now comes from `resolveGradingQuestions` |
| No second evidence pipeline | Confirmed by grep: this slice touches zero files under `lib/intelligence/`, `lib/quiz/quizEvidence.ts` is unmodified, unimported by the new module |
| No second curriculum resolver | `CurriculumService.resolveSubstrandContext` — the same call Slice 2 already makes, called once per first-open, never a second resolver |
| No second recommendation engine | `buildAdaptiveTask()` — the exact function Slice 2 already calls, never a new classification |
| No duplicate learner mapping | `served_variant_map` (Slice 1's own column) is the only mapping; nothing new was added |
| No recomputation after first delivery | Verified by test — Recommendation/Projection are called exactly once per (assignment, student), confirmed by the fast-path early return in `resolveServedVariantsForStudent` when every question already has a map entry |

---

## 3. Variant Resolution Audit

**Implemented exactly once**: `resolveServedVariantsForStudent`'s fast path (every question already resolved) never calls `recomputeLearnerProjection`/`buildAdaptiveTask` — confirmed by the "repeat opens" test, which regenerates the bound variant (archiving it) between two calls and shows the second call still returns the **original** variant id, never re-rolling to reflect the new state. Never upgrade, never downgrade, never re-roll — all one behavior: the map, once set, is the only source of truth for that (assignment, student, question) triple, forever.

---

## 4. Atomicity Audit

The resolve→persist step (`resolve_served_variants_batch`) is one Postgres statement — confirmed safe under concurrent load by the "concurrent first-open requests" test, which fires two simultaneous `resolveServedVariantsForStudent` calls for a never-before-opened (assignment, student) pair and asserts both return the identical variant id, and that the persisted row matches. No race condition can produce two different mappings — the second writer's guard clause (`NOT (map ? key)`) evaluates against the first writer's already-committed state.

---

## 5. Variant Selection Rules

`findApprovedVariant` (Slice 1's own repository function) is the only lookup — `status = 'approved'` exclusively, never `draft`/`rejected`/`archived`. **Verified the fallback policy precisely**: when a learner's tier has no approved variant (the "fallback" test: an `on_track` learner with no approved `extension` variant), the map records an honest `null` — not an error, not a retry, not silently defaulting to a different tier. `null` is itself a sticky, permanent resolution (the "sticky null" assertion in the fallback test) — a later open never re-attempts resolution just because an approved variant might exist by then.

---

## 6. Grading Audit

Confirmed by a test built specifically to distinguish the two possible answer keys: a canonical question with `correctIndex=0` and its approved variant with a deliberately different `correctIndex=1`. Submitting the answer that's correct-per-variant-but-wrong-per-canonical grades as correct — proving `gradeAndSubmitQuiz` reads the variant's own key, never the canonical one, when a variant is bound. `gradeQuiz()`'s uniform per-question mark allocation (Sprint 5A's own finding) is untouched — grades stay comparable in count, only which specific answer counts as correct differs, exactly as designed.

---

## 7. Retry Audit

Second submission, refresh, and late grading all read the same already-persisted `served_variant_map` — `resolveGradingQuestions` never calls the resolution/write path, only a read. Confirmed by the "archived variants remain gradable" test: grading a submission whose bound variant was archived *after* first-open still succeeds against that variant's own answer key — proving late grading and post-regeneration submission both work without ever re-resolving.

---

## 8. Evidence Audit

Confirmed: `recordQuizAutoGradeEvidence` needed zero changes (re-verified, not just cited from Sprint 4C's original finding) — a normal evidence row, sourced `quiz_auto_grade`, with the score `gradeAndSubmitQuiz` computed. Curriculum identity flows through exactly as before (via the assignment's own `substrand_id`, untouched by this slice). Variant identity remains recoverable purely through `served_variant_map` → `assignment_question_variants` — no new `learner_evidence` field was added or considered necessary.

---

## 9. UI Audit

Not built this slice beyond the one required route change (`app/api/student/assignments/[id]/questions`) — the mission's own UI audit named teacher-facing "inspect which variant each learner received" as a nice-to-have, not a blocking requirement; the underlying data (`served_variant_map`, queryable per submission) already supports building that view later without any further backend work. Student experience is unchanged from a plain quiz's perspective: no tier labels, no indication variants exist — `findServedQuestionsForStudent`'s output shape is identical to the pre-existing `findQuestionsForStudent`'s (`id`, `question_text`, `choices`, `order_index`; never `correct_index`).

---

## 10. Failure Audit

| Scenario | Behavior, confirmed |
|---|---|
| No approved variant for the learner's tier | Honest `null`, sticky, canonical served — **confirmed by test** |
| Concurrent first-open requests | One winner, both callers see the same result — **confirmed by test** |
| Archived historical variant | Still fully gradable, still fully servable to the student already bound to it — **confirmed by test** (both delivery and grading) |
| Deleted learner | Not directly exercised; `assignment_submissions.student_id` has no `ON DELETE CASCADE` behavior changed by this slice — out of scope, unaffected |
| Missing mapping (submission row doesn't exist at all) | `resolve_served_variants_batch` raises an explicit exception naming the assignment/student — **surfaced during test development itself**: my own first test run hit exactly this, because my test fixtures inserted assignments directly rather than through the real teacher-facing route (which always pre-creates a submission row per enrolled student). Fixed in the test fixtures, not the code — this is the real, expected behavior for a genuinely missing submission row, which cannot occur via the real creation path |
| Router unavailable | Not applicable — this slice makes zero AI calls |
| Projection unavailable | `recomputeLearnerProjection` throwing would propagate as an error from `resolveServedVariantsForStudent`'s slow path — no new handling added, matching how every other Projection consumer in this codebase behaves |
| Submission after regeneration | Grades against the originally-served (now archived) variant — **confirmed by test** |
| Teacher edits canonical question after learners already served | Blocked structurally by Slice 1's own lock trigger (`assignment_questions` locks once real submission activity exists) — unrelated to but reinforced by this slice, not re-implemented |

---

## 11. Performance Audit

- Variant resolution: once per (assignment, student) — confirmed by test (the fast path never recomputes).
- Subsequent opens: one indexed `SELECT` on `assignment_submissions`, O(1) relative to roster size.
- No Projection recomputation during delivery after first open — confirmed.
- No AI calls anywhere in this slice.
- No repeated classification — `buildAdaptiveTask` runs at most once per (assignment, student), ever.

---

## 12. Tests

`lib/quiz/quizDelivery.integration.test.ts` — 8 tests, all against the real, migrated database, no mocks (this slice makes no AI calls, so nothing needed mocking):

```
first open creates exactly one immutable mapping                                    ✔
repeat opens return the identical variant, even after regeneration                  ✔
concurrent first-open requests never create two different mappings                  ✔
findServedQuestionsForStudent serves the bound (pre-regeneration) text               ✔
grading uses the variant's own answer key, not canonical's                          ✔
archived variants remain gradable                                                    ✔
evidence emission + Projection recomputation unchanged                              ✔
fallback path: no approved variant -> honest sticky null, canonical served           ✔
```

Three real things surfaced and fixed during test-writing, not before: (1) my test fixtures needed to explicitly pre-create `assignment_submissions` rows, since they insert assignments directly rather than through the real route that does this as a side effect — the resulting error message (`resolve_served_variants_batch` explicitly naming the missing row) is exactly the right behavior, not a bug; (2) my first "Projection reflects new evidence" assertion incorrectly assumed evidence history length always increases — the Evidence Domain's own supersede/corroboration semantics for repeated same-subject evidence are a separate, legitimate concern out of this slice's scope, so the assertion was corrected to check the resulting academic level directly, which is what this slice actually needed to prove; (3) a significant one, retroactively affecting Slice 2: re-running Slice 2's own `variantGeneration.integration.test.ts` alongside this slice's regression pass revealed that `node:test`'s experimental `mock.module` (used there to fake `routedCompletion`) intermittently failed to intercept the import — real DeepSeek calls fired (visible as real token/latency log lines) despite the test intending to mock them, causing real, unintended AI spend and non-deterministic failure-path test results. Fixed at the source: `generateAdaptiveVariants`/`regenerateOneVariant` now accept an injectable `callAI` parameter (defaulting to the real router), and the test suite passes a plain fake function directly — no module mocking, no experimental flag, no risk of real AI calls. This slice itself was never at risk (it makes no AI calls of its own), but the fix was made immediately upon discovery rather than left for a future session, since it was actively costing real money each time that test file ran.

Full regression (quiz, identity-lock, variants, variant generation, delivery, panel, remedial, educational context, recommend) re-run clean; `npx tsc --noEmit` and `eslint` clean across every changed file.

---

## 13. Final System Verification — One Complete Learner Journey

```
Teacher creates adaptive assessment       — existing assignment creation, unchanged
        ↓
Variants generated                        — Sprint 9 Slice 2, reused unmodified
        ↓
Teacher approves                          — Slice 1's lifecycle, reused unmodified
        ↓
Teacher publishes                         — existing status mechanism, unchanged
        ↓
Learner opens                             — THIS SLICE: resolveServedVariantsForStudent
        ↓
Variant assigned                          — THIS SLICE: resolve_served_variants_batch, once
        ↓
Learner submits                           — existing submit-quiz route, unchanged
        ↓
Variant-aware grading                     — THIS SLICE: resolveGradingQuestions
        ↓
Evidence stored                           — recordQuizAutoGradeEvidence, unmodified
        ↓
Projection updated                        — recomputeLearnerProjection, unmodified
        ↓
Future adaptive recommendation changes naturally — recommendForClass/classifyGroup,
                                             unmodified, reads the same fresh Projection
                                             every other consumer already does
```

Every transition reuses an existing subsystem. Only three transitions required new code, and each is exactly what this slice's mission named: variant resolution, the atomic persist, and variant-aware grading.

---

## 14. Final Integrity Check

| Question | Answer |
|---|---|
| Does every learner receive only one immutable variant? | Yes — confirmed by test, including under concurrency |
| Can that assignment never change after first delivery? | Yes — confirmed by test (regeneration doesn't affect an already-bound learner) |
| Does grading always use the correct variant answer key? | Yes — confirmed by test, with a deliberately distinguishing fixture |
| Is curriculum identity preserved end-to-end? | Yes — `sub_strand_id` flows from assignment → curriculum resolution → variant, untouched by this slice |
| Is Evidence unchanged? | Yes — zero new fields, zero new call sites, confirmed by test |
| Is Projection unchanged? | Yes — zero changes, confirmed by test reading a real recomputed value |
| Does no new reasoning engine exist? | Yes — `buildAdaptiveTask`/`classifyGroup`/`recommendForClass`, all unmodified |
| Does no duplicate learner mapping exist? | Yes — `served_variant_map` is the only one, Slice 1's own column |
| Can every historical grade always be reproduced from stored data? | Yes — the served variant's id is permanently recorded, and its content is permanently readable (archived, never deleted) |

**Every answer is yes.** The adaptive assessment capability is end-to-end complete: a teacher can author one canonical question, generate and approve real AI variants, publish once, and every learner automatically receives and is permanently bound to the curriculum-aligned version appropriate to their own evidence-grounded readiness — with the existing Evidence, Projection, and Recommendation pipelines continuing to function exactly as they did before this feature existed.
