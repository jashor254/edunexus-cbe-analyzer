# Adaptive Variant Generation Pipeline — Implementation Report

## Sprint 9, Slice 2 (consumes Slice 1 exactly as built, does not redesign it)

**Status: Implemented and verified against the live, linked Supabase project**, using real Evidence/Projection/Recommendation and Sprint 9 Slice 1's real schema.

**Correction, made during Slice 3**: this document originally described the AI call as mocked via `node:test`'s experimental `mock.module`. In practice, that mechanism intermittently failed to intercept this module's import — confirmed by real DeepSeek API calls (real token counts, real latencies) appearing in a test run that was supposed to be fully mocked, a real-money risk and a source of non-deterministic failure-path test results. `generateAdaptiveVariants`/`regenerateOneVariant` were refactored to accept an injectable `callAI` parameter (`RoutedCompletionFn`, defaulting to the real `routedCompletion`), and the test suite now passes a plain fake function directly — no module mocking, no experimental flag, no risk of real AI calls, fully deterministic. See Slice 3's own report for the full account.

---

## 1. What Was Built

- `lib/assignments/variantGeneration.ts` — the pipeline: `resolveTiersForClass` (reuses `recommendForClass`, zero new classification), `generateOneTier` (the one place both AI calls happen), `generateAdaptiveVariants` (new tiers), `regenerateOneVariant` (existing variant, via Slice 1's atomic RPC).
- `lib/assignments/variants.ts` gained `editVariant` — the one new repository function this slice needed (a teacher's manual edit to a draft, flipping `generated_by` to `'teacher_edited'` without touching identity/lineage fields).
- `lib/quiz/quiz.ts` gained `findQuestionById` — a thin read, no new write path.
- 5 new API routes, all thin, all delegating to the pipeline/repository: generate, list, approve, reject, regenerate.
- `app/teacher/assignments/[assignmentId]/quiz/page.tsx` extended (not replaced) with a per-question "Generate Adaptive Variants" action and a review panel (approve/reject/regenerate) — the canonical question editing UI above it is untouched.

---

## 2. Constitutional Rules — Verified Held, Not Assumed

| Rule | How it's held |
|---|---|
| Curriculum resolution | `CurriculumService.resolveSubstrandContext` only — called once per generation pass, never a second resolver |
| Recommendation / instructional classification | `recommendForClass()` only — `resolveTiersForClass` reads its `ClassGroups` output and applies the one frozen band→tier map (`critical_gap`/`prerequisite_gap`→foundation, `concept_confusion`→supported_practice, `on_track`→extension); no independent band computation anywhere in this module |
| `EducationalAIContext` | `deriveEducationalAIContext()` (Sprint 7A) — the pure reshape, called on the representative `AdaptiveTask` `recommendForClass` already produced; this is the first real adopter of that contract |
| AI invocation | `routedCompletion()` only, both calls (generation and verification) — grepped this module and confirmed zero direct `callDeepSeek`/`callGemini` references |
| Variant persistence | `createDraftVariants`/`regenerateVariant`/`editVariant`/`approveVariant`/`rejectVariant` (Slice 1's own repository) only — no `.from('assignment_question_variants')` write anywhere in the generation module or the API routes |
| Evidence | Untouched — confirmed no import of `learner_evidence` or the Evidence lifecycle functions anywhere in this slice |

---

## 3. AI Prompt Audit — What Actually Reaches the Model

Verified by reading `buildGenerationPrompt`/`buildVerificationPrompt` directly: the prompt receives the canonical question, the curriculum node (strand/sub-strand/learning outcome), the target tier and its transformation rules, and a **redacted** context (`subject`, `band`, `academicGrain`, `confidence` only).

**The one real finding this audit surfaced**: `EducationalAIContext.observation` and `.action` (from `AdaptiveTask`) embed the learner's first name (e.g. *"Amina is currently at Level 2..."*) — confirmed by reading `buildAdaptiveTask`'s own template strings (Phase 3, this series). A naive pass-through of the whole context object would have leaked a learner's name into an AI prompt. `redactForPrompt()` exists specifically to strip this — `learnerId`, `observation`, `action`, and `supportingEvidenceIds` never leave the module. No marks, no historical personal data, no evidence IDs reach the model — confirmed by inspecting every string interpolated into both prompts.

---

## 4. Verification Stage

A second, independent `routedCompletion` call (`feature: 'adaptive_variant.verify'`) — a distinct prompt, distinct purpose ("verify only, never generate"), checking: single unambiguous correct answer, same learning outcome as given, exactly one question (not bundled sub-questions). Structural checks (no AI, deterministic) run first and short-circuit before verification is even attempted: required fields present, ≥2 choices, no duplicate choices, `correctIndex` in range. **The "no split into multiple gradable questions" rule is enforced structurally, not by prompt instruction alone**: the persistence schema itself only ever accepts one `question_text`/`choices`/`correct_index` triple per variant row — there is no code path in this module that could insert more than one row per (question, tier) even if the model tried to return multiple questions in one response.

Failure at either stage → the tier is reported in `failed`, nothing is persisted for it. **Never auto-approved** — every successfully generated and verified row lands at `status: 'draft'`, confirmed by test.

---

## 5. Persistence Audit

| Requirement | Verified by |
|---|---|
| Question IDs preserved | Unaffected by this slice — Slice 1's lock/upsert untouched |
| Variant IDs stable | `regenerateOneVariant` creates a new id for the replacement, never reuses or mutates the old one — confirmed by test |
| Approved variants immutable | Slice 1's lifecycle trigger, unmodified — confirmed still enforced (approval-then-edit-attempt tests in Slice 1's own suite, re-run this slice, still pass) |
| Rejected variants editable | Not exercised directly this slice (no test edits a rejected row), but nothing in this slice's code path changes Slice 1's trigger, which already permits it |
| Archived variants readable forever | Confirmed by test — the archived row's `question_text` is still present and correct after regeneration |
| Regeneration archives previous version | Confirmed by test — old row `status='archived'`, `superseded_by` set to the new row's id, in one atomic call |

---

## 6. UI Audit

Reused: the quiz builder page (`app/teacher/assignments/[assignmentId]/quiz/page.tsx`) — question authoring is untouched. Added: a "Generate Adaptive Variants" button and a review panel (approve/reject/regenerate) per already-saved question. **No second quiz editor** — a variant's text is shown as a review artifact; editing it happens through `editVariant` at the repository level (exercised by test), not exposed as a new UI text-editing surface this slice (the mission's own UI audit named only Generate/Review/Approve/Reject/Regenerate as new UI actions — editing wasn't among them, so none was added).

---

## 7. Failure Audit

| Scenario | Behavior, confirmed |
|---|---|
| AI timeout / router failure (both providers down) | Caught inside `generateOneTier`, reported as a per-tier failure; canonical question and any already-created variants for other tiers are untouched — **confirmed by test**, including a byte-for-byte comparison of the canonical question before and after |
| Malformed JSON | `parseJsonResponse` returns `null` → `validateStructure` fails → reported, never persisted — **confirmed by test** |
| Verification failure | Reported, never persisted — **confirmed by test** |
| Teacher rejection | `rejectVariant` — status `'rejected'`, terminal except via regeneration (Slice 1's own trigger) |
| Teacher manual edit | `editVariant` — provenance preserved (same id/question_id/variant_type), `generated_by` flips — **confirmed by test** |
| Regeneration | Atomic archive + insert — **confirmed by test** |
| Duplicate approval attempt | The partial unique index rejects it — **confirmed by test**, at the DB layer, not just app logic |
| Concurrent generation | Not exercised by an explicit concurrency test this slice (would require two simultaneous processes); the underlying risk is bounded by the same partial unique index — two concurrent approvals of two different draft rows for the same tier still can't both succeed, by construction, regardless of timing |
| Archived variant lookup | `findVariantById` is deliberately status-agnostic (confirmed unchanged from Slice 1) — a future grading path can resolve an archived row exactly as it resolves a live one |

---

## 8. Tests

`lib/assignments/variantGeneration.integration.test.ts` — 7 tests, run against the real, migrated Supabase project, the AI call injected as a plain fake function (`callAI`, no real AI spend, no module mocking — see the Correction above), everything else real: 3 synthetic students seeded with real confirmed Evidence at CBC levels 2/3/4 via `recordQuizAutoGradeEvidence` (the same producer this platform already uses elsewhere), a real assignment and canonical question, real Recommendation output, real persistence.

```
lib/assignments/variantGeneration.integration.test.ts   7 pass, 0 fail
Full regression (quiz, variants, panel, remedial, educationalContext)   49 pass, 0 fail
npx tsc --noEmit   clean
eslint (all changed files)   clean
```

---

## 9. Final Integrity Check

| Question | Answer |
|---|---|
| Exactly one canonical question? | Yes — `assignment_questions`, unmodified by this slice, still the one editing surface |
| Exactly one curriculum identity? | Yes — `CurriculumService`/`resolveSubstrandContext`, the only resolver called |
| Exactly one instructional classifier? | Yes — `recommendForClass`/`classifyGroup`, unmodified, the only classification computed |
| Exactly one `EducationalAIContext`? | Yes — `deriveEducationalAIContext`, the only context-shaping function; this slice is its first real adopter |
| Exactly one AI invocation path? | Yes, **for this pipeline specifically** — every call goes through `routedCompletion`. Platform-wide, Sprint 6B's own finding still holds: 10 real `callDeepSeek` sites and 4 direct-Gemini sites remain outside the router elsewhere in the codebase, untouched by this slice |
| Every approved variant immutable? | Yes — Slice 1's lifecycle trigger, re-confirmed still enforced |
| Every learner-served variant traceable to its canonical parent? | Yes, by construction — `question_id` is a real FK, `ON DELETE CASCADE`, never nullable |
| Can regeneration occur without breaking historical grading or evidence? | Yes — archive-never-delete means a served variant's content is permanently intact; Evidence itself was never touched by this slice and needs no variant-awareness (confirmed again, matching Sprint 4C's original finding) |

**Every answer is yes**, with one honest, explicitly-scoped caveat: "one AI invocation path" is true for this pipeline, not yet true platform-wide — a pre-existing, already-documented gap (Sprint 6B), not something this slice introduced or was asked to close.

---

## 10. What Remains

Per the mission's own scope: no student-facing delivery or variant-aware grading (Sprint 4C's design — `served_variant_map` exists as a column but is still unpopulated and unread). Teachers can now generate, review, approve, reject, and regenerate variants for a real canonical question, grounded in real curriculum identity and real Recommendation output — but a student still only ever receives the canonical question until the delivery slice is built. That is the next, and final, piece named in the original Sprint 9 workflow audit.
