# EduNexus — Sprint 4C: Adaptive Assessment Delivery & Variant-Aware Grading Audit

## Design Only — No Code, No Migrations

**Depends on**: ADR-0022, ADR-0023, ADR-0024, ADR-0025, Sprint 4A, Sprint 4A.1, Sprint 4B (`sprint-4b-adaptive-variant-persistence-audit.md`).

**Precondition, stated up front, same posture as every prior sprint in this series**: this design assumes Sprint 4B has shipped — specifically, that `assignment_question_variants` exists with its partial-unique-approved-index and archive-never-delete regeneration discipline, and that `served_variant_map` exists as a column on `assignment_submissions`. This document resolves the one thing Sprint 4B explicitly deferred: how grading actually consumes that map.

---

## Executive Summary

The central design decision this sprint must get right is a single sentence: **variant selection happens exactly once, at first open, is written to durable storage immediately, and every subsequent read — grading, review, regeneration, analytics — trusts that stored record unconditionally, never recomputing or re-deriving it.** Every other answer in this document (retry, regeneration-during-active-assessment, appeals, historical accuracy) falls out of that one sentence directly.

Two live facts from the existing codebase materially shape this design, confirmed by direct reading, not assumed:

1. **A real DB-level unique constraint already exists** on `assignment_submissions (assignment_id, student_id)` (confirmed in `supabase/migrations/20260525_performance_indexes.sql`'s own comment: "Already covered: assessments, assignment_submissions (unique composite)"). This backstops the concurrency story below — even though `gradeAndSubmitQuiz`'s read-then-write isn't wrapped in one transaction, a genuine race can't silently produce two submission rows for the same student.
2. **There is no "retry" or "attempt" concept anywhere in this codebase today.** `gradeAndSubmitQuiz` (`lib/quiz/quiz.ts:78-137`) checks for an existing submission by `(assignment_id, student_id)` and **updates it in place** if found — a second submit call overwrites the first, silently. This reframes the Retry Audit entirely: there is no second attempt to design around, only "what happens if the same single row is written to twice," which the immutability design below already answers.

**Recommendation: CONDITIONAL GO** — see §12 for the four conditions.

---

## 1. Full Execution Lifecycle — Traced and Verified

```
Teacher                          (unchanged — Sprint 4A/4A.1/4B)
   │
   ▼
Canonical Assessment              assignment_questions, locked once real
   │                              submission activity exists (4A.1)
   ▼
Approved Variant                  assignment_question_variants, status='approved',
   │                              at most one per (question_id, variant_type) — 4B's
   │                              partial unique index
   ▼
Learner Recommendation            recommendForClass()/classifyGroup() — UNMODIFIED,
   │                              read-only, called exactly once per learner per
   │                              assignment (see §2 — not per request)
   ▼
Variant Selection                 NEW, this sprint — band → variant_type (frozen
   │                              mapping, ADR-0025 §2) → lookup approved variant
   │                              for (question_id, variant_type)
   ▼
Assessment Delivery               EXTENDS app/api/student/assignments/[id]/questions/
   │                              route.ts — no new route, no parallel pipeline
   ▼
Submission                        assignment_submissions.served_variant_map,
   │                              written once, at first open, before any answer
   ▼
Variant-Aware Grading             EXTENDS gradeAndSubmitQuiz — resolves each
   │                              question's correct_index from served_variant_map
   │                              first, canonical assignment_questions as fallback
   ▼
Evidence                          recordQuizAutoGradeEvidence() — UNMODIFIED,
   │                              confirmed below to need zero new fields
   ▼
Projection                        recomputeLearnerProjection() — UNMODIFIED
   │
   ▼
Recommendation                    Next assignment's variant selection reads this
                                  exactly the same way — no second read path
```

**Reusable, confirmed unmodified**: `recommendForClass`, `classifyGroup`, `resolveCurriculumContext`, `gradeQuiz` (the pure grading arithmetic — only its *inputs* change, per §5), `recordQuizAutoGradeEvidence`, `recomputeLearnerProjection`.

**Missing abstraction, confirmed the one real gap**: a "resolve or fetch this student's variant assignment for this assignment" function — doesn't exist anywhere yet, and is the one new piece of logic this sprint designs.

---

## 2. Variant Selection Audit

**Who performs the mapping?** A new, small server-side function — call it `resolveServedVariants(assignmentId, studentId)` — living beside `gradeAndSubmitQuiz` in the Assignments/Quiz domain (§10), not a new service and not inside `recommendForClass` itself (Recommendation stays ignorant that variants exist, per ADR-0025's own non-negotiable boundary).

**Where?** Inside the existing student-facing questions route (`GET /api/student/assignments/[id]/questions`) — the one place a student's session ever asks "what do I see." No new route.

**When?** **Exactly once** — the first time a student requests this assignment's questions and no `served_variant_map` yet exists on their submission row. Every subsequent request (page refresh, re-opening a tab, returning after closing the browser) reads the already-stored map and skips resolution entirely.

**Can the selected variant ever change after a learner begins?** **No.** This is the load-bearing answer the whole sprint depends on. Once `served_variant_map` is written, it is read-only for that submission's remaining lifetime — including through a regeneration event (§8) and including a resubmission (§7).

---

## 3. Immutable Variant Assignment

**Recommendation: store, never recompute.** `assignment_submissions.served_variant_map jsonb` (already named in Sprint 4B) is written once, at first open. A second column, `resolved_band text` (nullable), is added alongside it — capturing *which* band `recommendForClass` returned at that exact moment, not just which variant ids resulted. This is new relative to Sprint 4B's original sketch; justified below.

| Consideration | Store (recommended) | Recompute every request |
|---|---|---|
| Fairness | A learner's assessment content is fixed the moment they start — no learner can be mid-question when their band changes underneath them because unrelated evidence landed elsewhere | A concurrent Projection change (e.g. another assignment being graded while this one is open) could swap questions mid-attempt — indefensible |
| Auditability | One row answers "what did this learner see and why" forever | Nothing durable to point to — "why did they get this variant" becomes unanswerable after the fact |
| Appeals | `served_variant_map` + `resolved_band` + the (archived-never-deleted) variant row's own content reconstructs the exact experience, permanently | Requires trusting that a recomputed Projection today matches what it was on the day in question — it may not, since Evidence keeps accumulating |
| Analytics | `resolved_band` and the variant ids are real, queryable columns | Would require re-deriving band history from Evidence, unreliable and expensive |
| Historical integrity | Fixed at write time — matches this whole initiative's "Evidence is immutable, corrections supersede" discipline (`learner_evidence`) | Directly contradicts it |
| Performance | One extra read (or one write, on first open only) — negligible | A full `recommendForClass` roster call is expensive (ADR-0023's own named constraint: `recomputeLearnerProjection` has zero caching); recomputing it on every question-list request would be the "second uncached companion" that ADR explicitly forbids |
| Future research | A clean, queryable historical record of every band/variant pairing ever served | No durable record to analyze |

Every axis points the same direction. **Recompute-on-every-request is rejected outright, not just weighed against.**

Why `resolved_band` in addition to the variant ids already in `served_variant_map`: a `null` variant id in the map is ambiguous on its own — it means either "learner was `on_track`, correctly served the canonical question" or "learner was `critical_gap` but no approved Foundation variant existed yet for this question, honest fallback." Both are the *correct* outcome per ADR-0025's graceful-fallback rule, but they are different facts for a teacher reviewing an appeal or an analyst studying fallback frequency. Storing the band removes the ambiguity without duplicating anything Recommendation owns — it is a cached, never-re-resolved copy of one Recommendation call's output for one submission, exactly the same discipline `assignment_question_variants.learning_outcome` already applies to Curriculum Context (Sprint 4B §3).

---

## 4. Delivery Audit

**Today's quiz delivery, traced**: `findQuestionsForStudent()` (`lib/quiz/quiz.ts:58-66`) selects `id, question_text, choices, order_index` — explicitly omitting `correct_index` (the answer-key-hiding boundary is a column-selection choice, not an RLS policy, since `assignment_questions` has no student SELECT policy at all — the service-role route is the only path a student's session can reach it through). Learner state (submission row) lives in `assignment_submissions`, read/written via the same service-role client.

**Where adaptive variant resolution should occur**: inside `findQuestionsForStudent`'s call site (the student questions route), as a preceding step: resolve-or-fetch `served_variant_map` (§2), then build the returned question list by substituting each question's `question_text`/`choices` with its served variant's content when one was assigned, falling back to the canonical row's content otherwise. **`correct_index` remains excluded from the student-facing response in both cases** — the variant row's own `correct_index` must never leak to the student any more than the canonical one does today.

**No duplicate delivery pipeline**: this is an extension of the one existing route, not a second "adaptive delivery" endpoint. A non-adaptive quiz (zero rows in `assignment_question_variants` for its questions) takes the exact same code path, resolves to `served_variant_map = {}` (or entries all `null`), and serves canonical content exactly as it does today — confirmed as the graceful-fallback contract this whole initiative has held since ADR-0024.

---

## 5. Grading Audit

**Trace**: `POST /api/student/submit-quiz` → `gradeAndSubmitQuiz()` (`lib/quiz/quiz.ts:78`) → builds a `questions` array (`{id, choices: [], correctIndex}`) from a live `assignment_questions` SELECT → `gradeQuiz()` (pure, `lib/quiz/quizPure.ts`) → `Results` → `recordQuizAutoGradeEvidence()`.

**Every place requiring variant awareness — confirmed to be exactly one**: the `questions` array construction inside `gradeAndSubmitQuiz`, before it's handed to `gradeQuiz`. Today it unconditionally reads `correct_index` from `assignment_questions`. It must instead: read the submission's own `served_variant_map` (already resolved and stored at first open — **never re-resolved here**, per §2's non-negotiable rule), and for each question, resolve `correct_index` from the referenced `assignment_question_variants` row when the map names one, falling back to the canonical `assignment_questions` row otherwise. **`gradeQuiz()` itself needs zero changes** — it already takes a `{id, correctIndex}[]` shape agnostic to where that data came from; this is genuinely the smallest additive change available, confirmed by reading the pure function's actual signature.

- **Variant-specific answer keys**: required, confirmed again here (restating Sprint 4B §8's conclusion, now grounded in the actual grading code path it applies to) — a Foundation variant's choice set can legitimately differ from the canonical question's, so grading must resolve per-variant, never a shared key.
- **Variant-specific explanations/distractors**: relevant to the results-review UI (a teacher or learner later reviewing *why* an answer was right/wrong), not to grading arithmetic itself. `gradeQuiz` only ever needed `correctIndex`; explanation display is a separate, results-page read concern joining the same `served_variant_map` — named here as an integration point for a future results-page enhancement, not built in this sprint.
- **Partial credit**: **not proposed, explicitly out of scope.** `gradeQuiz` is exact-match MCQ scoring; nothing about variants changes that. Introducing partial credit would be a change to the grading *model*, not to variant-awareness, and must not be conflated with this sprint.
- **Future constructed-response support**: named as a future extension point only — today's entire quiz engine (canonical and variant alike) is MCQ-only; constructed-response grading is a different problem requiring a different grader, not an extension of `gradeQuiz`.

---

## 6. Evidence Audit

**Confirmed**: `quiz_auto_grade` (`recordQuizAutoGradeEvidence`) remains the only producer — nothing in this sprint's design adds a second evidence-emission call site or a second source tag.

**Should Evidence record `canonical_question_id`, `variant_id`, `grading_version`, `generation_version`? No — none of them.**

- `learner_evidence` is already assignment-scoped, not question-scoped — its existing `rawInputRef` (`assignment:{id}:score=X/Y`) has no per-question granularity today, quiz or not, adaptive or not. Adding question/variant ids here would be a scope change to Evidence's own shape unrelated to what this sprint needs to accomplish, and would blur a boundary this entire initiative has held deliberately since Sprint 4B §1's own finding: "Evidence doesn't need to know variants exist, only that a score happened."
- Every fact those four fields would carry is **already permanently recoverable** by joining `assignment_submissions.served_variant_map` (this submission, forever, per §3's immutability) against the referenced `assignment_question_variants` row (archived, never deleted, per Sprint 4B §9 — which itself already carries `model`/`prompt_version`, i.e. exactly "generation_version"). There is no "grading_version" concept anywhere in this codebase (`gradeQuiz` has no version field) and inventing one here would be new scope, not variant-awareness.
- Adding these fields to `learner_evidence` would be a schema change to the one table this entire multi-sprint initiative has been most disciplined about keeping narrow and immutable (CLAUDE.md's own non-negotiable rule: evidence rows are never mutated after creation except through the four sanctioned lifecycle functions). This sprint has no reason to touch it, and confirming that explicitly is itself a finding worth stating, not just an absence to skip past.

**Net Evidence change this sprint: zero.**

---

## 7. Retry Audit

**Reframed by the fact established in the Executive Summary**: there is no multi-attempt concept in this codebase. "Retry" today means calling `POST /api/student/submit-quiz` a second time, which `gradeAndSubmitQuiz` handles by updating the *same* submission row in place.

**Do they receive the same variant, or a newly selected one? The same variant — unconditionally.** `served_variant_map` was written at first open (§2, §3), before any submission existed in a `submitted`/`marked` state; a resubmission re-grades against the *same, already-resolved* map, never re-resolving it. This is both:
- **Educationally correct**: a learner shouldn't be able to change which version of the test they're taking by resubmitting — that would let a learner effectively re-roll for an easier variant mid-attempt, which is a fairness failure, not a feature.
- **Architecturally forced**: §2's rule ("selection happens exactly once") has no carve-out for resubmission; adding one here would be a second, inconsistent selection trigger, undermining the one-sentence design principle this whole document is built on.

If a genuine multiple-attempt feature is ever built (a real `attempt_number`, a fresh submission row per attempt), each new attempt *could* legitimately re-resolve — but that is new product scope requiring its own design pass, not something this sprint should smuggle in as a side effect of fixing grading.

---

## 8. Regeneration Audit

**Variant V2 exists and approved. Some learners complete work against it. Teacher regenerates → V3.**

Per Sprint 4B §9's mechanism (reused verbatim, not re-derived here): the regeneration operation archives V2 (`status: approved → archived`, `superseded_by = V3.id`) and inserts V3 as a fresh `draft` row in one transaction.

- **Which learners stay linked to V2?** Every learner whose `served_variant_map` already recorded V2's id at their first-open moment — permanently, because `served_variant_map` is never rewritten (§2, §3) and V2's row is archived, not deleted (Sprint 4B §9), so its content remains fully readable.
- **Which receive V3?** Only learners whose first-open resolution (§2) happens *after* V3 has been approved. Sprint 4B's partial unique index guarantees at most one `approved` row per (question, tier) at any moment, so "the currently approved variant" is always unambiguous at the instant a not-yet-served learner's resolution runs.
- **Can grading ever silently switch versions? No — and this is the one place this document must be explicit about a subtlety**: the grading-time read (§5) resolves a *specific* `variant_id` already named in `served_variant_map`, and **must not filter on `status='approved'`** when doing so — an archived row must still be fully readable for grading a learner who was served it before it was archived. The `status='approved'` filter applies **only** to the *selection* step (§2, for learners not yet served), never to the *grading resolution* step (for learners already served). These are two different queries against the same table with deliberately different filters, and conflating them into one query would either (a) block grading for anyone linked to an archived variant, or (b) accidentally let a `draft`/`rejected` row be selected fresh — both wrong, for different reasons.

---

## 9. Performance Audit

- **Variant lookup cost**: one indexed query per (question_id, variant_type) at first-open time, batchable across all of one quiz's questions in a single `IN (...)` call — not per-question round trips.
- **Submission lookup cost**: unchanged from today — one row by `(assignment_id, student_id)`, already indexed by the existing unique constraint.
- **Grading overhead**: one additional batch lookup (resolve `served_variant_map`'s non-null variant ids against `assignment_question_variants`) alongside the existing canonical-question fetch — same shape, negligible added cost, and only pays for questions that actually have a variant assigned.
- **Index requirements**: `assignment_question_variants(question_id, variant_type)` from Sprint 4B already covers both the selection and grading lookups; no new index required specifically for delivery/grading.
- **Caching opportunities**: `served_variant_map` **is** the cache — the expensive part (`recommendForClass`'s roster-wide Projection recompute) only runs once per learner per assignment, at first open, never again for that submission. This directly respects ADR-0023's named constraint that `recomputeLearnerProjection()` must never gain an uncached companion call site.
- **Bulk-class execution**: first-open events are naturally spread across whenever each student actually starts the quiz — no single moment forces a whole-class Projection recompute at once (that cost belongs to generation, Sprint 4B/future-4D, not delivery).
- **Concurrency**: the one real new risk — two near-simultaneous first-open requests for the same student (double-click, two tabs) both observing "no `served_variant_map` yet" and racing to resolve-and-write. Must be handled as a single atomic write-if-absent operation (e.g., an `UPDATE ... WHERE served_variant_map IS NULL` guard, or equivalent), not a plain read-then-write — otherwise the second writer could silently overwrite the first's (possibly different, if Projection changed in between) resolution, directly violating §2/§3's immutability guarantee. This is the one condition in §12 that is genuinely new engineering, not just a design restatement.

---

## 10. Repository Audit

| Responsibility | Owner | Change |
|---|---|---|
| `assignments`/`assignment_questions`/`assignment_submissions` reads/writes, the ID-preserving upsert, the submission-activity lock | Assignment Repository (Sprint 4A.1) | Unchanged — gains one caller (the new resolution function reads `assignment_questions` via its existing exported functions, never queries the table directly itself) |
| `assignment_question_variants` CRUD, approval state machine, archive-on-regenerate | Variant Repository (Sprint 4B) | Unchanged — gains one caller (the resolution function's lookup, and the grading-time lookup) |
| Resolve-or-fetch a student's variant assignment for one attempt; grading-time correct-index resolution | **NEW**, thin — `lib/quiz/quizVariants.ts` (sibling to `quiz.ts`, same domain folder, matching this domain's existing plain-function-module convention from 4A.1/4B) | The one new file this sprint's design requires — deliberately small: two functions (`resolveServedVariants`, `resolveCorrectIndexes`), no independent business logic beyond the lookups and the write-once guard |
| Grading arithmetic | `gradeQuiz` (`lib/quiz/quizPure.ts`) | Unchanged — confirmed §5, its input shape already supports this without modification |
| Evidence emission | `recordQuizAutoGradeEvidence` | Unchanged — confirmed §6, zero new fields |

No duplicate service introduced anywhere; the new module composes existing repositories rather than re-implementing any of their responsibilities.

---

## 11. Testing Strategy

| Test | Protects |
|---|---|
| First open with no prior `served_variant_map` resolves and persists a map + `resolved_band` matching `recommendForClass`'s current output | Variant selection correctness |
| A second question-list request for the same submission returns the identical map without calling `recommendForClass` again | The "exactly once" rule (§2) — provable, not just asserted |
| Grading uses the variant's `correct_index` when `served_variant_map` names one, and the canonical question's otherwise | Grading correctness (§5) |
| A resubmission (second call to submit-quiz for the same student+assignment) grades against the *same* `served_variant_map`, even if `recommendForClass` would now return a different band | Immutable submission linkage + retry behavior (§7) |
| Two concurrent first-open requests for the same submission result in exactly one persisted `served_variant_map`, not a last-write-wins overwrite | Race condition (§9) |
| A regenerated variant (V2 archived, V3 approved): a learner served V2 before regeneration still grades against V2's own `correct_index`; a learner opening for the first time after regeneration receives V3 | Regeneration (§8) |
| The grading-time variant lookup succeeds for an `archived` variant referenced by an existing `served_variant_map` (does not filter on `status='approved'`) | The exact subtlety named in §8 — the single highest-value test in this whole plan, since it's the one place a wrong filter silently breaks history |
| A teacher editing a `draft` variant that has never been served to anyone has zero effect on any existing submission | Teacher edits, backward compatibility with 4B's approval rules |
| An assignment with zero `assignment_question_variants` rows serves and grades identically to today, `served_variant_map` resolving to empty/null throughout | Backward compatibility |
| The `resolved_band`/variant-id combination for every submission in a fixture class supports a "variant effectiveness" and "band comparison" aggregate query without further schema changes | Analytics integrity |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Incorrect variant delivery | First-open resolution follows the one frozen band→tier mapping (ADR-0025 §2), read exactly once, tested explicitly (§11) |
| Wrong answer key | Grading always resolves per-question from `served_variant_map`, never a shared/canonical key when a variant was actually served (§5) |
| Variant drift | Same teacher-authority tradeoff named in Sprint 4B §12 — not a delivery/grading risk, restated here only for completeness, not re-solved |
| Grading mismatch | The archived-row-must-still-be-gradable rule (§8) is the specific, named defense; tested explicitly |
| Duplicate submissions | Backstopped by the real DB unique constraint on `(assignment_id, student_id)` confirmed in the Executive Summary — a true duplicate-row race is a DB-level impossibility today, independent of anything this sprint adds |
| Race conditions | The first-open write-once guard (§9) — the one genuinely new piece of concurrency-handling code this sprint requires |
| Teacher regeneration during an active assessment | Fully answered by §8 — no learner already in progress is ever affected, by construction, not by a runtime check that could fail |
| Appeals | `served_variant_map` + `resolved_band` + archived-never-deleted variant content together reconstruct exactly what any learner saw and why, permanently — no new infrastructure needed beyond what §2–§3 already store |
| Historical accuracy | Guaranteed by the combination of immutable `served_variant_map` and archive-never-delete — restated from Sprint 4B, now shown to hold through the grading path specifically (§8's subtlety) |

---

## 13. Exit Criteria — Assessed

| Criterion | Met? |
|---|---|
| Every learner submission permanently references the exact approved variant delivered | Yes — `served_variant_map`, written once, read-only thereafter (§2, §3) |
| Variant-aware grading is deterministic | Yes — resolves from a stored, immutable map, never from live/recomputed state (§5) |
| Evidence preserves variant provenance | Reframed, not literally met as worded — Evidence itself needs and gets zero new fields (§6); provenance is preserved one layer up, in `assignment_submissions` + the archived variant row, which is sufficient for every named use case (appeals, analytics, audit) without polluting Evidence's own boundary |
| Regeneration never changes historical grading | Yes — §8, including the specific archived-row-readable-for-grading subtlety |
| Existing grading architecture is reused wherever possible | Yes — `gradeQuiz` unmodified; only its input construction changes |
| No duplicate assessment engine is introduced | Yes — one route extended, one existing pure grader reused, one new thin module composing existing repositories |

---

## 14. Final Recommendation

**CONDITIONAL GO.**

Conditions:

1. **Sprint 4B must be merged first** — this design depends entirely on `served_variant_map`, the partial-unique-approved index, and the archive-never-delete regeneration mechanism already existing and working.
2. **First-open variant resolution must be a single atomic write-if-absent operation**, not a read-then-write from application code — this is the one place this sprint introduces genuinely new concurrency-sensitive logic, and it's the load-bearing guarantee the entire "selected exactly once" principle rests on.
3. **The grading-time variant lookup must never filter on `status='approved'`** — only the first-open selection lookup does. These must remain two distinct queries in the new module; merging them is the single most likely way this design could silently break historical grading after a regeneration.
4. **No fields are added to `learner_evidence`** — confirmed unnecessary in §6; adding any would be new, unjustified scope against this initiative's most disciplined table.

With these four conditions satisfied, delivery and grading become fully variant-aware while remaining byte-for-byte backward compatible with every non-adaptive quiz already running today.
