# ADR-0025 — Adaptive Assignment Intelligence (Curriculum-Equivalent Differentiated Learning)

**Status: SUPERSEDED — replaced by `adr-0025-adaptive-assessment-transformation-engine.md` (AATE) in the same session. Kept on disk, not deleted: its audit findings and the 3-band tier collapse independently converged with AATE's own audit and are cited there. Do not build against this document — use the AATE version.**

**Status: DRAFT — design pass only, per this project's standing practice for any AI-content-generation surface with a real correctness bar (see ADR-0022, ADR-0023). No code, schema, or migration was written in producing this document.**

**Supersedes/extends**: ADR-0022 (Adaptive Quiz Generation, DRAFT, unbuilt) — that ADR's 3-band MCQ-variant design is subsumed here as the narrower case of this document's 4-variant model. Reuses ADR-0022's audit findings rather than re-deriving them, re-verified below.

**Depends on / consumes, unmodified**:
- `lib/adaptiveLearning/recommend.ts` — `classifyGroup`/`buildAdaptiveTask`, now curriculum-aware (Phase 3, this session). The **sole** source of a learner's band and curriculum node.
- `lib/projection/recompute.ts` (`recomputeLearnerProjection`) — the sole read path into learner readiness.
- `lib/curriculum/service.ts` (`CurriculumService.resolveSubstrandContext`) — the sole source of real Strand/Sub-strand/Learning Outcome data.
- `lib/quiz/` (Phase 3a delivery/grading) and `lib/quiz/quizEvidence.ts` (Sprint C — quiz results now emit `learner_evidence`, closing ADR-0022's Open Question 1).
- `lib/ai/deepseek.ts` (`callDeepSeek`) — the sole AI call surface — plus the structured-validate-before-accept pattern already used by `lib/sow/aiLessonGenerator.ts` (`validateLesson`).
- `lib/adaptiveLearning/differentiation.ts`'s draft → teacher-review → approve interaction shape — the same shape Holiday Planner's publish gate uses — reused for the teacher review flow, not reinvented.

---

## 1. Adaptive Assignment Audit

Confirmed by direct file reading:

| Piece | Status | Where |
|---|---|---|
| Learner band + curriculum node, per subject/sub-strand | **Built, tested, curriculum-aware** | `lib/adaptiveLearning/recommend.ts` — `classifyGroup`, `buildAdaptiveTask`, `academicGrain` (this session) |
| Class-level draft/approve interaction shape | **Built**, no live caller | `lib/adaptiveLearning/differentiation.ts` |
| Fixed-set MCQ assignment, auto-graded, feeds Gradebook | **Built** (Phase 3a) | `lib/quiz/quiz.ts`, `assignment_questions`, `assignment_submissions` |
| Quiz auto-grade → `learner_evidence` | **Built** (Sprint C) | `lib/quiz/quizEvidence.ts` — Tier 2 `quiz_auto_grade` source, curriculum-anchored via `resolveCurriculumContext` |
| Per-student/per-band **question content variants** | **Does not exist** | `assignment_questions` is one shared row set per assignment; no variant table in `lib/database.types.ts` |
| AI-generated instructional content with structured validation | **Precedent exists, no owner for this domain** | `lib/sow/aiLessonGenerator.ts` (`generateValidatedLesson` + `validateLesson`) — reusable *pattern*, not reusable *code* (lesson-plan shape, not question shape) |
| Teacher review/approval gate for AI-generated content before learner exposure | **Precedent exists** (Holiday Planner publish gate, Differentiation draft/approve) — no instance for question-level content |
| Cost/token accounting for generation features | **Built, single source of truth** | `lib/payments/config.ts` (`TOKEN_COSTS`) — needs one new entry, not a new mechanism |

**Conclusion, matching ADR-0022's own**: the grouping, curriculum-resolution, delivery, grading, and evidence-emission pieces are all built and correctly reusable as-is. The one genuinely new piece is AI-generated, per-band **question content** with the full explainability fields this mission requires (curriculum node, learning outcome, cognitive intent, difficulty rationale, misconceptions, teacher/learner explanations) — nothing in the codebase owns that today, and nothing should be duplicated to build it.

**Reusable as-is (zero modification)**: `recommendForClass`, `resolveCurriculumContext`, `gradeQuiz`, `recordQuizAutoGradeEvidence`, `callDeepSeek`, `TOKEN_COSTS` mechanism, differentiation's draft/approve shape.

**Duplicate-risk flagged**: none found — there is no second "generate per-learner question content" pipeline anywhere to converge with (confirmed by the same grep sweep ADR-0022 ran, re-run for this document).

---

## 2. Variant Architecture

The mission's 4-variant model (Foundation / Supported Practice / Independent Practice / Extension) replaces ADR-0022's 3-band model — **but the same principle holds**: `on_track` was never a stored variant there, and here **Independent Practice is the base `assignment_questions` row** — no fourth duplicate-content variant needed for the tier that already equals the base content. Only Foundation, Supported Practice, and Extension are ever generated and stored.

```
CREATE TABLE assignment_question_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id         uuid NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  variant_tier        text NOT NULL CHECK (variant_tier IN ('foundation','supported_practice','extension')),
  -- 'independent_practice' is NOT a stored value — assignment_questions IS that tier's content.
  question_text       text NOT NULL,
  choices             text[] NOT NULL,
  correct_index       int  NOT NULL,
  cognitive_intent    text NOT NULL,          -- e.g. "recall", "apply", "analyse", "transfer" — Bloom-aligned, curriculum-sourced verb, not invented
  difficulty_rationale text NOT NULL,          -- why this tier's cognitive load fits this band — teacher-facing
  expected_misconceptions text[] NOT NULL DEFAULT '{}',
  teacher_explanation  text NOT NULL,          -- how to use this variant, what to watch for
  learner_explanation  text NOT NULL,          -- warm, learner-facing "why this version" copy — never a raw score/band
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  generated_by         text NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai','teacher_edited')),
  learning_outcome     text NOT NULL,          -- copied verbatim from CurriculumContext.learningOutcomes[n] at generation time — display-only, never re-resolved
  sub_strand_id        uuid REFERENCES sow_substrands(id),  -- nullable: honest when curriculum grounding was itself a subject-level fallback (Phase 3 academicGrain === 'subject')
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
```

`assignment_submissions.served_variant_map jsonb` (`{ questionId: variantId | null }`), recorded at the moment a student opens the assignment — same rationale as ADR-0022: grading must check the answer against the exact variant actually served, and a regenerated/edited variant must never retroactively alter what a past submission is graded against (append-only; a regeneration creates new `draft` rows, never mutates an `approved` row a submission already references — same immutability discipline as `learner_evidence`).

**Never a fifth taxonomy.** `variant_tier` reuses `AdaptiveGroupType` band semantics one-to-one:

| Band (`recommend.ts`) | Variant tier |
|---|---|
| `critical_gap` | `foundation` |
| `prerequisite_gap` | `foundation` |
| `concept_confusion` | `supported_practice` |
| `on_track` | *(none stored — served the base question)* |

This collapses the mission's four *instructional* tiers onto the three *already-frozen* readiness bands plus the existing base-question tier, deliberately — inventing a fourth readiness band that Projection/Recommendation don't produce would violate "consume the architecture already established," and `Extension` needs its own trigger: **only generated when a class roster actually has `on_track` learners who should be offered transfer/synthesis work beyond the base question** (an enrichment layer on top of, not a replacement for, the base tier).

Every stored variant carries `sub_strand_id` and `learning_outcome` verbatim — satisfying Principle 1's full chain — and is honestly nullable when the class's `academicGrain` was `'subject'` (Phase 3 graceful fallback), never guessed.

---

## 3. AI Generation Flow

1. Teacher clicks "Generate Adaptive Variants" on an existing assignment (extends the Phase 3a quiz builder — not a new page).
2. Server calls `recommendForClass(roster, subject, { subStrandId })` — **unmodified** — to get each learner's band and `academicGrain` for the assignment's curriculum node.
3. For each base question × each *distinct tier actually present in the roster* (never all three unconditionally — matches ADR-0022's cost discipline), one `callDeepSeek` call generates one variant, prompted with: the base question, the resolved `CurriculumContext` (strand/sub-strand/learning outcome), the target cognitive intent for that tier, and Principle 2/3's constraints verbatim ("same learning outcome, never an easier subject, only more/less scaffolding").
4. Structured-output validation before acceptance — same pattern as `validateLesson`: a malformed or incomplete AI response (missing any of the required explainability fields) is rejected and flagged for manual teacher authoring, never partially stored, never silently defaulted.
5. All variants land `status = 'draft'`. Nothing is servable.
6. New `TOKEN_COSTS.adaptive_assignment_variant_generate` entry (`lib/payments/config.ts`) — cost scales with `questions × distinct tiers present`, not `questions × students`, same generate-once-and-cache principle as Sessional/`career_market_cache`.

---

## 4. Teacher Review Flow

Extends `lib/adaptiveLearning/differentiation.ts`'s draft/approve shape (Review → Adjust → Approve), applied at question-variant grain instead of class-grouping grain:

- Each variant renders next to its base question with its full explainability fields visible (curriculum node, learning outcome, cognitive intent, difficulty rationale, misconceptions, teacher explanation).
- Teacher can edit any field directly (`generated_by` flips to `teacher_edited`), regenerate a single variant, or approve per-question or in bulk.
- **No AI-generated variant is ever auto-approved** — least negotiable rule, carried over from ADR-0022 verbatim, now applying to a richer content shape with a higher fabrication surface (rationale/misconceptions text, not just an MCQ answer key).
- An unapproved variant's band silently falls back to serving the base question — the safe default, never a blocking error, never a partially-reviewed variant reaching a learner.
- On take: the student-facing route resolves the student's band (one cheap Projection read) and serves the approved variant for their tier if one exists, recording `served_variant_map` immediately, before any answer is submitted.
- Grading (`gradeAndSubmitQuiz`) extends to grade against the variant recorded in `served_variant_map`, not unconditionally the base `correct_index` — direct reuse of ADR-0022's Open Question 3 resolution.

---

## 5. Curriculum Traceability Review

Every stored variant satisfies Principle 1's chain by construction, not by convention:
`Grade`/`Learning Area` — inherited from the assignment's own class/subject (unchanged, pre-existing columns). `Strand`/`Sub-strand` — `sub_strand_id`, copied from the same `CurriculumContext` Phase 3's `buildAdaptiveTask` already resolves for this class+subject (no second resolution). `Learning Outcome` — `learning_outcome`, verbatim text, never re-resolved after generation (matches `SubStrandPerformance.subStrandTitle`'s "display-only, never re-resolved" discipline). `Assignment` → `Evidence` → `Projection` → `Recommendation` → `Adaptive Variant` is the literal data-flow of steps 2–3 above: nothing here computes a learner-ability value independently; the variant only ever *renders* the band `recommendForClass` already computed.

No step in this design reads `learner_profiles`, computes a level independently, or introduces a second curriculum resolver — the two invariants both prior phases established stay intact.

---

## 6. Safety Review

- **Correctness bar is the same as ADR-0022's, raised**: an AI-generated `correct_index` reaching a graded learner score is the least negotiable failure mode on this platform — teacher approval gate is mandatory and un-bypassable in code, not just in UI (the serving route must check `status = 'approved'`, not merely "exists").
- **Fabrication surface is larger than ADR-0022's MCQ-only design**: `difficulty_rationale`, `expected_misconceptions`, and both explanation fields are free text that could plausibly claim a false pedagogical justification. Mitigation: these fields are teacher-reviewed exactly like the question itself before approval — no field is exempted from the review gate because it "isn't graded."
- **Learner-facing copy never carries a raw band/score** — `learner_explanation` is constrained the same way `neutralGroupLabel` already is (warm, outcome-oriented, no internal taxonomy name, no numeric confidence) — reuse that existing constraint literally, don't re-derive it.
- **Regeneration is append-only** — an approved variant already referenced by a `served_variant_map` is never mutated or deleted; regeneration creates new draft rows. Needs a DB-level guard (a trigger, matching `learner_evidence`'s immutability trigger, not just app-level discipline), before this ships, not after.
- **No new identity or read path** — confirmed no violation of the `teacher_id`-is-not-ownership rule (§ CLAUDE.md) or the Projection-read-path rule; this design adds zero new consumers of raw evidence tables.

---

## 7. Performance Review

Generation cost is bounded by `questions × distinct tiers actually present in the roster` (typically 2–3, not 4, since `on_track` needs no stored variant unless Extension is explicitly requested) — same bound discipline as ADR-0022, extended with one more field-rich prompt per call, so per-call token cost rises modestly; call *count* does not. Serving path is one cheap Projection read per student per attempt — no new uncached hot-path computation, respecting ADR-0023's named constraint that `recomputeLearnerProjection()` must never gain an uncached companion.

---

## 8. Tests (planned — none written; no code exists yet)

- Pure: variant-tier mapping from `AdaptiveGroupType` (three-band-to-tier collapse, `on_track` → no stored variant unless Extension requested).
- Pure: structured-validation rejection path for a malformed/incomplete AI response (missing any required explainability field).
- Integration: draft → approve → serve → grade round-trip, asserting grading uses `served_variant_map`, not the base question, once a variant was served.
- Integration: regeneration after a variant was already served does not alter the already-graded submission's correctness.
- Safety: an unapproved variant is never returned by the student-facing serving route, even if `draft` rows exist.

---

## 9. Exit Criteria Assessment

Not yet buildable as a one-shot implementation — this document *is* the audit + design deliverable the mission itself requires before code ("Audit first. Implement second."; CLAUDE.md's "Before Building Any New Feature" gate: DB schema named above awaits approval, reusable `lib/` functions identified, new `lib/` functions scoped, API routes and components not yet named pending schema sign-off).

## 10. Recommendation

**Conditional Go, staged.** Build order, matching ADR-0022's own discipline: (1) schema + append-only/immutability trigger for `assignment_question_variants` and `served_variant_map`; (2) generation flow for one pilot class, teacher-review gate enforced server-side; (3) serving + grading integration; (4) Extension-tier generation as a distinct, explicitly-requested enrichment layer, not bundled into (2). Do not build serving/grading (3) before the immutability trigger (1) exists — a regenerated variant silently invalidating a past grade is exactly the failure ADR-0022's Open Question 3 already named and this document must not repeat unresolved.

**Awaiting your review** — tell me what to change (schema, tier collapse, generation triggers, or build order) before any code, migration, or route is written.
