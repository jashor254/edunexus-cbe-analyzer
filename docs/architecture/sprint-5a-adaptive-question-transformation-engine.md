# EduNexus — Sprint 5A: Adaptive Question Transformation Engine (AQTE)

## Architecture Audit & Design — Design Only, No Code

**Depends on**: ADR-0022, ADR-0023, ADR-0024, ADR-0025, Sprint 4A, Sprint 4B, Sprint 4C.

**Superseded terminology notice (added by ADR-0026, the series' constitutional document)**: this document's Executive Summary below names the middle tier "Core." ADR-0026 settles this: the constitutional name is **"Supported Practice"** (matching Sprint 4B's actual stored `variant_type` value and ADR-0025's original language). Read "Core" everywhere below as "Supported Practice" — this file is left otherwise unmodified as a historical record of the reconciliation, not silently rewritten.

**Precondition, same posture as every prior sprint in this series**: this design assumes Sprint 4A/4A.1 (stable question identity), 4B (variant persistence + lifecycle), and 4C (delivery + variant-aware grading) are built. This sprint designs the one piece every prior sprint deliberately deferred: what the AI is actually told to do, and how its output is kept honest before a teacher ever sees it.

---

## Executive Summary

Two things had to be resolved before any prompt or rule could be designed responsibly.

**First, a terminology reconciliation.** This brief names three generated tiers — Foundation, Core, Extension — and asks for a teacher review comparing "Canonical → Foundation → Core → Extension" (four things). Sprint 4B already shipped a `variant_type` enum with exactly three stored values (`foundation`, `supported_practice`, `extension`) and an explicit rule that the `on_track`/Independent tier needs **no stored row at all** — the canonical question already is that tier's content. Reconciled here, once, so every later section uses one consistent vocabulary: **"Core" is this sprint's teacher-facing name for `supported_practice`** — Sprint 4B's own schema is not changed, no fourth stored tier is introduced, and the "four-way" comparison the brief describes is Canonical (the one raw, unstored row) plus three generated variants (Foundation/Core/Extension). This preserves every schema decision the last three sprints made and avoids inventing a fourth lifecycle to track.

**Second, a hard constraint the existing grading engine imposes, not a policy choice.** `gradeQuiz()` (`lib/quiz/quizPure.ts:24-33`) computes each question's mark share as `maxScore / total questions` — **uniform, with no per-question weighting field anywhere in the schema.** This means a Foundation variant can never be decomposed into multiple gradable sub-steps (a 3-step scaffolded version of one question becoming three rows) without silently changing that student's effective mark scheme relative to everyone else's. This single fact drives the most important rule in §3: scaffolding must live *inside* one question's presentation, never by splitting one canonical question into several gradable items.

**Recommendation: CONDITIONAL GO** — see §12.

---

## 1. Existing Question Model Audit

`assignment_questions` (confirmed schema, Sprint 4A audit + migration `20260723093000_lms_quiz_extends_assignments.sql`): `id, assignment_id, question_text, choices (text[]), correct_index, order_index, created_at`.

**What exists today**: question structure (stem + choice array), options, correct answer. **What does not exist, anywhere in the schema, today**: mark allocation per question (derived uniformly, §Executive Summary), explanations, media/image support, metadata (cognitive level, difficulty tag, source), or any question type other than MCQ. This is a smaller starting surface than the brief's checklist implies — the honest finding is "most of these fields don't exist yet at all," not "they exist and need reclassifying."

**Canonical Question vs Variant — field ownership**:

| Field | Canonical (`assignment_questions`) | Variant (`assignment_question_variants`, Sprint 4B) |
|---|---|---|
| `question_text`, `choices`, `correct_index` | Yes — the teacher-authored source of truth | Yes — each variant carries its own, independently correct per §Executive Summary's "variant-specific answer keys" rule (Sprint 4B §8/4C §5) |
| `order_index` | Yes — display order within the assignment | Not applicable — a variant doesn't reorder the quiz, it replaces one question's content |
| Explanations, misconceptions, difficulty rationale, teacher/learner explanation | **Does not exist on the canonical row** — never proposed here either; these are variant-only fields (already named in ADR-0025's schema), because they describe *why a transformation was made*, which has no meaning for the untransformed canonical question | Yes — this is new information a variant adds, not information the canonical question was ever missing |
| Learning outcome, sub-strand reference | Lives on `assignments.substrand_id` (assignment-level, existing) | Copied verbatim at generation time as a display-only cache (Sprint 4B §3) — never re-resolved, never a second curriculum representation |
| Media | Does not exist on either today | Out of scope for this sprint — named in §11 as a future extension point only |

---

## 2. Educational Transformation Audit — by question type

| Type | Exists today? | Can it be safely transformed? |
|---|---|---|
| MCQ | **Yes — the only type this platform has** | Yes — this is the entire scope of this sprint. Wording, scaffolding, distractor design, and representation can change; the concept and correct answer's *meaning* cannot. |
| True/False | Not a distinct type — already expressible as a 2-choice MCQ | No new transformation logic needed; treated identically to MCQ. Not a separate question type in this schema and shouldn't become one just for this sprint. |
| Short Answer | Does not exist | **No — cannot be safely transformed because it does not exist to transform.** Building it would be new question-type scope, not adaptive transformation of an existing one; flagged for §11 (Future Readiness), explicitly not built here. |
| Matching, Ordering, Fill-Blank, Scenario, Calculation-as-a-distinct-type | Do not exist | Same finding as Short Answer — no type to transform, and inventing one is out of this sprint's scope. "Calculation" in particular is not a distinct type here; a calculation question is just an MCQ whose choices are numeric answers, already fully supported without new schema. |

**Conclusion**: the brief's eight-question-type checklist resolves to one honest answer — **only MCQ can be transformed, because MCQ is the only question type that exists.** This sprint's entire design scope is MCQ transformation; every other type is a named, not-built future extension.

---

## 3. Transformation Rules

Reconciled against the mark-allocation constraint (Executive Summary) and Sprint 4C's "variant-specific answer keys" rule:

| | **Foundation** | **Core** (= Sprint 4B's `supported_practice`) | **Extension** |
|---|---|---|---|
| Allowed | Smaller reasoning steps *presented within the single question stem/choices* (never split into multiple graded items — see constraint below), simpler wording, vocabulary support, worked-example framing inside the stem, explicit guided-reasoning language, visual/textual cues described in the stem | Wording kept as close to canonical as legitimately possible; light clarity edits only; distractors may be refreshed (different surface numbers/context) without changing the underlying misconception each one represents | Higher reasoning, transfer to a new but still-in-grade context, application, connecting to a second concept the learner has evidence of readiness for, real-world framing |
| Never allowed | A different curriculum objective, a different correct concept, a different misconception being tested, a different mark scheme (see below), a different learning outcome | Same five, plus: never becomes indistinguishable from Foundation or Extension — "as close as possible to canonical" is a ceiling on how much it may change, not permission to drift toward either neighboring tier | New curriculum content, future-grade knowledge, out-of-scope mathematics/content, a concept the learner has no confirmed evidence for (Extension transfers *within* demonstrated readiness, it does not gamble on unconfirmed prerequisite knowledge) |

**The one rule that applies to all three tiers, non-negotiable, enforced structurally, not just by prompt instruction**: a variant is always exactly one `question_text` + one `choices` array + one `correct_index` — the same shape as the canonical question. A Foundation variant showing worked reasoning does so as text *within* the stem (e.g., "Step 1: look at the denominators. Are they the same? Step 2: add only the numerators." as part of one question's presentation), never as multiple separate `assignment_question_variants` rows chained together. This is what keeps `gradeQuiz()`'s uniform per-question weighting honest across every tier without needing a mark-allocation field this schema doesn't have and this sprint doesn't propose adding.

---

## 4. Curriculum Audit

The traceability chain (`Grade → Learning Area → Strand → Sub-strand → Learning Outcome → Canonical Question → Variant`) is **already fully wired by Sprint 4B's schema**, not something this sprint needs to newly construct: `assignment_question_variants.sub_strand_id` + `learning_outcome` (display-only, copied from the same `resolveCurriculumContext()` call already used for the assignment) are the last two links; every link above them (`assignments.substrand_id → sow_substrands → sow_strands → sow_grades/learning areas`) already exists from ADR-0024's Sprint A.

**"No variant may escape curriculum scope"** — enforced two ways, one structural and one AI-time:
- **Structural**: a variant's `sub_strand_id`/`learning_outcome` are copied at generation time from the *assignment's own* resolved curriculum context — there is no code path by which a variant could reference a different sub-strand than the question it was generated from, because the generation call never receives a second curriculum context to choose from.
- **AI-time**: the transformation prompt (§6) includes the resolved learning outcome as immutable context and instructs the model that it may never introduce content beyond it; this is checked automatically before teacher review (§7's curriculum-drift detector), not trusted to the prompt alone.

---

## 5. Difficulty Framework

**Difficulty changes through instruction, never curriculum — the dimensions, assessed for safety**:

| Dimension | Educationally safe to vary? | Why |
|---|---|---|
| Language complexity | Yes | Vocabulary/sentence complexity, not content |
| Number of reasoning steps shown | Yes, **within the single question's presentation only** (§3's structural constraint) | Never via splitting into multiple graded items |
| Amount of scaffolding | Yes | Core lever for Foundation/Core distinction |
| Working memory load (numbers of things held at once) | Yes | E.g. fewer simultaneous sub-quantities in a Foundation word problem |
| Visual support (described textually, since this schema has no media field yet) | Partially — describable in text, not an actual image | Full visual support is a §11 future extension pending media field support |
| Worked examples | Yes | Directly named in the brief's Foundation characteristics |
| Hint frequency | Yes | Embedded in the stem, not a separate hint-delivery mechanism (none exists) |
| Abstractness | Yes | Concrete-to-abstract framing of the same concept |
| Context familiarity | Yes | Familiar-to-unfamiliar context, the core Extension lever ("transfer... unfamiliar contexts") |
| Representation (numeric vs. worded vs. diagram-described) | Yes, text-describable forms only | Full alternate representations (e.g. actual diagrams) are a §11 future extension |

**Not a safe dimension, named explicitly so it's never mistaken for one**: *which concept or curriculum node the question targets*. Every dimension above varies **how** the same concept is presented, never **which** concept it is — this is the literal operational definition of "difficulty through instruction, not curriculum."

---

## 6. Transformation Prompt Architecture

```
┌─ System prompt ──────────────────────────────────────────────┐
│ Fixed, versioned (prompt_version — Sprint 4B's provenance    │
│ field). States the First Principle verbatim: "transform,     │
│ never invent." Never includes learner-specific data.          │
├─ Curriculum context (IMMUTABLE within this call) ────────────┤
│ Resolved once via resolveCurriculumContext() — strand title,  │
│ sub-strand title, the specific learning outcome. The model    │
│ is told this is the one objective every variant must measure. │
├─ Canonical question (IMMUTABLE) ──────────────────────────────┤
│ The teacher-authored question_text/choices/correct_index —    │
│ the one thing every variant must remain equivalent to.        │
├─ Teacher intent (IMMUTABLE, optional) ────────────────────────┤
│ Any free-text instructions a teacher attached at generation    │
│ time (e.g. "focus on real-world Kenyan contexts") — advisory,  │
│ never permitted to override the curriculum context above it.  │
├─ Learner readiness (CONTEXT, not learner-identifying) ───────┤
│ Which variant_type is being generated (foundation/core/       │
│ extension) — a tier label only. No learner id, no name, no    │
│ score ever enters this prompt — generation is per-(question,  │
│ tier), never per-learner (Sprint 4B §11's cost discipline),    │
│ so there is no learner data to leak in the first place.        │
├─ Variant objective (VARIABLE per tier) ───────────────────────┤
│ The specific §3 rule table row for the tier being generated.   │
├─ Output schema (FIXED, machine-validated on return) ─────────┤
│ question_text, choices[], correct_index, cognitive_intent,    │
│ difficulty_rationale, expected_misconceptions[],               │
│ teacher_explanation, learner_explanation — every field         │
│ ADR-0025's schema already named; nothing added, nothing        │
│ dropped.                                                       │
└────────────────────────────────────────────────────────────────┘
```

**Immutable parts** (never vary across a generation run, never influenced by AI output): system prompt, curriculum context, canonical question, output schema shape. **Variable parts**: which tier's rule table applies, the optional teacher-intent free text. This separation is what makes curriculum-drift detection (§7) tractable — the validator can diff the *variable* output against the *immutable* inputs mechanically, because the boundary between "what could legitimately change" and "what must never change" is drawn in the prompt's own structure, not left to the model's judgment alone.

---

## 7. AI Safety Audit — Validation Layers

Following this codebase's own established pattern (`generateValidatedLesson` → `validateLesson`, `lib/sow/aiLessonGenerator.ts`/`validators.ts`): **structural validation happens before a variant ever reaches `status='draft'` in a form a teacher can approve** — a failure here means the row is flagged for manual authoring, never silently defaulted, never partially stored (same discipline ADR-0025 already committed to).

| Check | Layer | Method |
|---|---|---|
| Output schema completeness (every required field present) | Structural, automatic | Reject on parse if any required field is missing — same pattern as `validateLesson` |
| Curriculum drift (does the variant still target the same learning outcome?) | Automatic, pre-approval | Compare the variant's stated concept/keywords against the immutable curriculum context supplied in the prompt; a mismatch blocks the row from reaching `draft`-visible-to-teacher state, flags for manual authoring instead |
| Incorrect answer / multiple correct answers | Automatic, pre-approval | Re-derive the answer independently is not feasible for arbitrary MCQ content without a second reasoning pass — **recommend a second, independent DeepSeek call whose only job is "verify this specific choice is the unique correct answer to this specific question," not regenerate** — a narrow, cheap verification call, not a duplicate generation |
| Broken/duplicate distractors | Automatic, pre-approval | String-equality and near-duplicate check across `choices` — deterministic, no AI call needed |
| Hallucinated facts / wrong mathematics | Automatic, pre-approval, MCQ-scoped | Bounded by the same independent-verification call above — for arithmetic specifically, the actual computation can be checked deterministically (no AI needed) when the question is a calculation-style MCQ |
| Out-of-grade concepts | Automatic, pre-approval | Checked against the curriculum context's own grade/learning-area scope, same mechanism as curriculum drift |
| Unsafe explanations (teacher/learner-facing text) | Automatic, pre-approval | Same content-moderation discipline this platform already applies to other AI-facing learner copy (Compass, career narratives) — reused, not reinvented |

**No validation failure is ever silently downgraded to "approved anyway."** A row that fails any automatic check either never reaches `status='draft'` in a teacher-visible form, or reaches it with the failure explicitly flagged for the teacher's attention (never hidden) — teacher approval remains the final gate regardless (§8), but automatic validation exists so a teacher isn't the *only* check against a fabricated correct answer, which ADR-0025's own Safety Principles already named as the least acceptable failure mode on this platform.

---

## 8. Teacher Review Workflow

Reuses Sprint 4B's state machine (`draft → approved/rejected → archived` on regeneration) exactly — this sprint adds no new lifecycle states, only the generation trigger that populates `draft` rows and the comparison UI's *content*, not its underlying data model.

```
Teacher clicks "Generate Adaptive Variants"
        │
        ▼
For each (question × tier actually present in the roster, per Sprint 4B/ADR-0025's
cost discipline): one prompt call → structural validation (§7) → status='draft'
        │
        ▼
Teacher reviews, side by side:
   Canonical (read-only, the one thing every variant is measured against)
   Foundation │ Core │ Extension  (whichever were generated)
        │
        ├─▶ Edit any variant's fields directly → generated_by: 'teacher_edited'
        ├─▶ Approve → status: draft → approved (Sprint 4B's state machine)
        ├─▶ Reject → status: draft → rejected (falls back to canonical, safe default)
        ├─▶ Regenerate one variant individually → §9
        └─▶ Partial approval → approve Foundation and Extension, leave Core
             pending or rejected — fully supported, since approval is already
             per-row in Sprint 4B's design, not a single all-or-nothing gate
             for the whole generation batch
```

**Locking and history**: inherited unmodified from Sprint 4B (archive-never-delete, `supersedes`/`superseded_by`) and Sprint 4A.1 (canonical question locks once real submission activity exists — generation/review can still happen freely on an unlocked, not-yet-submitted-against assignment, same as today's quiz-builder flow).

---

## 9. Regeneration Behaviour

**Teacher regenerates Foundation only.**

- **Does Core remain?** Yes, completely untouched — regeneration is scoped to exactly the `(question_id, variant_type)` pair the teacher selected; Sprint 4B's archive-on-regenerate operation never touches sibling tiers.
- **Does Extension remain?** Yes, same reasoning.
- **Do IDs change?** The regenerated Foundation gets a fresh `id`; the previous Foundation row's `id` is preserved forever, moved to `status='archived'`, `superseded_by` pointing at the new row — Sprint 4B §9's mechanism, reused verbatim, not redesigned.
- **How are archived variants preserved?** Exactly as Sprint 4B and 4C already specified: never deleted, fully content-intact, and (per 4C §8's specific subtlety) still fully readable at grading time for any learner already served the old version — this sprint adds no new archival mechanism because none is needed.

---

## 10. Explainability

Every generated variant already carries (ADR-0025's schema, unchanged) `difficulty_rationale`, `expected_misconceptions`, `teacher_explanation`, `learner_explanation` — this sprint's contribution is specifying that **the teacher-facing explanation must always state, in order**: why this version exists (the learner's band, from Recommendation — reused, not recomputed), what changed relative to canonical, what remained unchanged (the learning outcome, stated explicitly, not just implied), which of the three tiers' educational strategy was applied (§3's table row, in plain language), and confirmation the curriculum node was validated (§7's check passed). **Teacher-facing only** — `learner_explanation` stays warm/outcome-oriented with zero band/score/strategy language, matching the existing `neutralGroupLabel` discipline (`lib/adaptiveLearning/recommend.ts`) reused, not reinvented.

---

## 11. Quality Metrics

| Metric | Objective scoring available today? | Approach |
|---|---|---|
| Curriculum fidelity | Yes | Binary: did §7's curriculum-drift check pass |
| Answer correctness | Yes | Binary: did the independent-verification call (§7) confirm the stated correct index |
| Duplicate/broken distractors | Yes | Deterministic string comparison (§7) |
| Difficulty consistency (is Foundation actually easier than Core, Core than Extension, for the same concept) | **No objective measure exists today** | Requires real submission data across tiers (correct-rate comparison) — this is the analytics Sprint 4B §10/4C §11 already confirmed the schema supports, but it's a *post-deployment* measure, not something computable at generation time; named honestly as not yet measurable, not fabricated as a generation-time score |
| Reading level | Partially | A standard readability formula (e.g. Flesch-Kincaid) could be computed deterministically on `question_text` — a cheap, real, addable check, though not proposed as blocking in this sprint (advisory only, since CBC-appropriate reading level for Kenyan learners may not match a formula tuned for other contexts) |
| Scaffolding quality, hint usefulness | **No objective measure exists** | Genuinely subjective; left to teacher review (§8) — proposing a fabricated numeric "quality score" here would be exactly the kind of invented certainty this platform's Evidence-first philosophy exists to prevent |
| Misconception preservation | Yes, partially | Checkable that `expected_misconceptions` references the same underlying error type the canonical question's own distractors implied, where those are identifiable — best-effort, not a hard gate |

**Honest conclusion**: only the objectively-checkable metrics (curriculum fidelity, answer correctness, distractor mechanics) are proposed as automatic gates (§7). Everything genuinely subjective is explicitly left to teacher judgment, not disguised as an algorithmic score — this is a finding worth stating plainly rather than inventing a composite "quality score" that would misrepresent how much of this is actually measurable today.

---

## 12. Cost Audit

Reuses ADR-0025's already-committed discipline, restated here only to confirm this sprint's prompt design doesn't violate it: **generate once per (question, tier actually present in the roster)**, never once per learner — a class of 40 with 3 tiers present and 5 questions is 15 calls, not 200. The independent-verification call (§7) doubles the call count per variant (one generation + one verification), which is still bounded by the same `questions × tiers-present` factor, not by learner count — a deliberate, small, named cost increase in exchange for not trusting a single unverified AI pass with a graded correct answer. **Provider strategy**: reuse the existing DeepSeek-primary/Gemini-fallback pattern (`lib/ai/deepseek.ts` + `lib/ai/gemini.ts`/`models.ts`, precedent already established in `aiLessonGenerator.ts`) — no new provider, no new fallback logic.

---

## 13. Future Readiness — confirmed, not built

| Capability | Does this design block it? |
|---|---|
| Additional difficulty bands | No — `variant_type` is already a CHECK-constrained enum (Sprint 4B); adding a value is additive, and §3's rule-table pattern extends to a new row without restructuring |
| Language localisation (Swahili) | No — the prompt architecture (§6) already separates "which language" as something the output schema could carry as a field without touching curriculum context or canonical question resolution; not built here, but nothing in this design assumes English-only |
| Teacher custom prompts | No — §6 already reserves an explicit "teacher intent" slot, advisory and non-overriding; a custom-prompt feature would populate that slot more richly, not restructure the prompt |
| Constructed response | Not blocked, but **not free** — §2 already named this as requiring a different grader, not just a different prompt; this design doesn't need to change for it to eventually exist, but building it is a separate, later design pass |
| Essay marking | Same as constructed response — named, not designed, not blocked |
| Adaptive homework | No — homework is just an `assignments` row with `is_holiday_assignment`/similar flags already in the schema; the variant engine is assignment-type-agnostic by construction (it operates on `assignment_questions`, which any quiz-type assignment already has, homework or not) |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| AI changing curriculum | §4/§7 — structural (curriculum context copied from the assignment's own resolution, no alternate path) plus automatic drift detection before teacher-visible draft |
| Incorrect answer keys | §7's independent-verification call — a second, narrow AI check, not trusting one generation pass alone |
| Teacher over-trust (approving without real review) | Named honestly, not solvable by schema — the review UI showing Canonical alongside every variant (§8) is the best structural nudge available; this remains a genuine human-factor risk this design cannot fully close |
| Variant explosion | Bounded by the same `questions × tiers-present` factor as every prior sprint's cost discipline — no per-learner generation anywhere in this design |
| Cost growth | §12 — the verification call doubles cost per variant but stays bounded by the same factor, not by learner count or class size beyond that |
| Prompt drift (a prompt_version change silently altering past variants' meaning) | `prompt_version` is already a stored, immutable-per-row field (Sprint 4B §3) — a new prompt version only affects newly generated rows; existing approved/archived rows are untouched, per the same never-mutate discipline as everything else in this table |
| Regeneration inconsistency | §9 — fully inherited from Sprint 4B's already-designed, already-tested (per 4B's own test plan) mechanism; nothing new introduced |
| Future model replacement | `lib/ai/models.ts`'s existing single-source-of-truth model-id pattern already isolates this; a model swap changes one constant, not this design |

---

## 15. Exit Criteria — Assessed

| Criterion | Met? |
|---|---|
| AI transforms — not invents — assessments | Yes — First Principle enforced structurally (§4, §6) and by automatic validation (§7), not just by prompt instruction alone |
| Curriculum identity remains immutable | Yes — §4, no alternate curriculum-resolution path exists for a variant to drift onto |
| Learning outcome never changes | Yes — copied verbatim, checked by the curriculum-drift validator |
| Difficulty changes only through instructional design | Yes — §5's dimension table, with the "which concept" axis explicitly named as unsafe-to-vary |
| Teacher approval remains mandatory | Yes — §8, Sprint 4B's state machine, unmodified, un-bypassable by any automatic check (validation gates *what a teacher can see as ready for review*, never substitutes for their approval) |
| Every variant explains its instructional strategy | Yes — §10, teacher-facing only |
| Existing assessment architecture is fully reused | Yes — `gradeQuiz`, the Sprint 4B/4C persistence and delivery design, `lib/ai/deepseek.ts`/`gemini.ts`, the `validateLesson`-pattern precedent — all reused, none rebuilt |
| No duplicate AI generation engine is introduced | Yes — one call surface (`callDeepSeek`/Gemini fallback), one validation pattern, one lifecycle (Sprint 4B's, unmodified) |

---

## 16. Final Recommendation

**CONDITIONAL GO.**

Conditions:

1. **The terminology reconciliation in the Executive Summary is the design's actual contract** — "Core" means `supported_practice`, there is no fourth stored tier, and any future document in this series must keep using this vocabulary consistently or explicitly re-reconcile it again, the same way this document did.
2. **The independent-verification call (§7) is not optional** — a single unverified generation pass producing a graded correct answer is exactly the failure mode ADR-0025 named as least acceptable; this sprint's design only counts as meeting its own Safety Principles with that second, narrow check in place.
3. **The structural constraint that a variant is always exactly one question_text/choices/correct_index (§3)** must be enforced in whatever implementation sprint follows this design — it is what keeps `gradeQuiz()`'s uniform mark allocation honest across tiers, and it is a schema-level discipline, not just a prompt instruction that could be quietly violated by a sufficiently verbose AI response.
4. **Quality metrics that are not objectively measurable (§11) must never be presented to a teacher as a numeric score** — only the binary, mechanically-checkable ones (curriculum fidelity, answer correctness, distractor mechanics) are gates; everything else stays explicitly a matter of teacher judgment, not a fabricated confidence number.

With these four conditions held, this design gives the eventual implementation sprint a complete, internally consistent contract: what the AI may change, what it may never change, how its output is checked before a teacher ever sees it, and how every generated variant remains fully explainable and fully reusing the architecture the last four sprints already built.
