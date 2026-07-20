# EduNexus ADR-0025 — Adaptive Assessment Transformation Engine (AATE)

## One Curriculum. Many Learning Pathways.

**Status:** DRAFT — Design Only
**Depends on:** ADR-0022, ADR-0023, ADR-0024, Phase 1–3 Implementation
**Scope:** Adaptive Assignments, Quizzes, Homework, Practice Activities

**Supersedes**: this document replaces the earlier same-session ADR-0025 draft (`adr-0025-adaptive-assignment-intelligence.md`, the "4-variant / 3-band-collapse" design) — kept on disk as a superseded design note, not deleted, since it independently identified the same schema gap this document confirms with a live audit below.

---

# Executive Summary

EduNexus already knows:

* the learner's curriculum-aligned readiness (Projection)
* the teacher's instructional intent
* the exact curriculum node
* the evidence supporting every decision

What does **not** exist is a way to transform one teacher-designed assessment into multiple pedagogically equivalent versions suitable for different learners.

This ADR introduces the **Adaptive Assessment Transformation Engine (AATE).**

AATE is **not** another learner model.

AATE is **not** another recommendation engine.

AATE consumes the intelligence already built and transforms instructional delivery while preserving curriculum integrity.

---

# Educational Philosophy

Every learner deserves the same curriculum.

Not every learner needs the same pathway.

The learning outcome never changes.

The instructional experience adapts.

EduNexus therefore transforms instruction—

never expectations.

---

# Core Principle

A teacher creates **one canonical assessment**.

EduNexus creates multiple instructional variants.

Every variant measures exactly the same curriculum objective.

---

# Canonical Assessment Model

Teacher

↓

Canonical Assessment

↓

Canonical Question Set

↓

Adaptive Transformation Engine

↓

Foundation Variant

↓

Supported Variant

↓

Independent Variant

↓

Extension Variant

↓

Teacher Review

↓

Learners

---

# The Canonical Question

Every adaptive question begins life as a canonical question.

Example

Learning Outcome

> Add fractions with like denominators.

Canonical Question

> Calculate:

> 3/8 + 2/8

Nothing generated afterwards may change the curriculum objective.

---

# Variant Philosophy

## Variant 1 — Foundation

Purpose

Build confidence.

Characteristics

* smaller reasoning steps
* worked examples
* vocabulary support
* visual cues
* explicit hints
* guided thinking

Example

Step 1

Look at the denominators.

Are they the same?

Yes.

Step 2

Add only the numerators.

---

## Variant 2 — Supported

Purpose

Develop independence.

Characteristics

* fewer hints
* partial scaffolding
* reminder prompts
* guided reasoning

---

## Variant 3 — Independent

Purpose

Expected curriculum level.

Characteristics

* normal classroom assessment
* no unnecessary hints
* standard wording

---

## Variant 4 — Extension

Purpose

Deep understanding.

Characteristics

* application
* reasoning
* transfer
* unfamiliar contexts
* synthesis

---

# Transformation Rules

The engine may transform

✓ wording

✓ scaffolding

✓ examples

✓ hints

✓ representations

✓ cognitive supports

✓ context

The engine may NEVER transform

✗ learning outcome

✗ curriculum node

✗ expected concept

✗ evidence trace

✗ assessment objective

---

# Inputs

Projection

↓

Recommendation

↓

Canonical Curriculum ID

↓

Learning Outcome

↓

Teacher Assessment

↓

Teacher Instructions

↓

Teacher Constraints

↓

Question Type

---

# Outputs

Each generated variant contains

Curriculum ID

Learning Outcome

Canonical Question ID

Variant Type

Difficulty Rationale

Scaffolding Strategy

Teacher Notes

Learner Version

Correct Answer

Explanation

Misconception Warnings

Evidence Trace

---

# Variant Selection

AATE never decides learner readiness.

It consumes Recommendation.

Recommendation decides

↓

Foundation

Supported

Independent

Extension

AATE only generates the appropriate instructional version.

---

# Teacher Workflow

Teacher creates assignment.

↓

Teacher chooses

Adaptive

or

Uniform

↓

If Adaptive

↓

Teacher previews every generated variant.

↓

Teacher edits if desired.

↓

Teacher approves.

↓

Only then are variants published.

AI never publishes directly.

---

# Student Experience

Students never see labels such as

Foundation

Supported

Extension

They simply receive an assessment appropriate to their instructional needs.

Two learners may sit beside each other and receive different versions while pursuing exactly the same curriculum outcome.

---

# Explainability

Every adaptive assessment must answer

Why this version?

Example

Projection

↓

Sub-strand:

Fractions

↓

Recommendation

↓

Supported Practice

↓

Variant

Supported

↓

Reason

Recent evidence shows developing understanding of adding fractions.

This explanation is always available to the teacher.

---

# AI Generation Guardrails

Every generated question must be validated against

* Curriculum node
* Learning outcome
* Canonical assessment
* Teacher instructions
* Correct answer consistency
* Pedagogical consistency

Any validation failure blocks publication.

---

# Safety Principles

AI never invents curriculum.

AI never changes learning outcomes.

AI never lowers curriculum expectations.

AI never bypasses teacher approval.

AI never creates evidence directly.

Evidence is generated only from learner performance after completion.

---

# Performance Strategy

Generate once per instructional variant.

Never once per learner.

Example

40 learners

↓

4 variants generated

↓

Learners mapped onto variants

NOT

40 independent AI generations.

This keeps cost predictable while preserving adaptation.

---

# Required Audit Before Implementation — COMPLETED

Every item below was confirmed by reading the live code and live migrations, not assumed. Findings are grouped by the audit's own checklist.

## Existing assignment generator

**Does not exist.** Assignment creation is 100% teacher-authored, no AI in the loop: `app/api/teacher/assignments/route.ts` — teacher submits `title`, `subject`, `topic`/`substrand_id`, `instructions`, `type`, `max_score` directly; the row is inserted with `status: 'active'` **immediately** (line ~142), and `assignment_submissions` rows are pre-created for the whole class at `status: 'pending'` in the same request (lines ~153–164) — **there is no draft-then-publish gate for a normal assignment today.** This matters directly for AATE's "Adaptive or Uniform" choice: it must happen *before* this insert, not after, or students already have visible pending submissions before any variant exists to serve them.

## Existing quiz generator

**Does not exist either — also 100% teacher-authored.** `app/teacher/assignments/[assignmentId]/quiz/page.tsx` is a manual MCQ builder UI; `lib/quiz/quiz.ts::replaceQuestions` writes one shared row set to `assignment_questions`, no AI call anywhere in the path. `lib/quiz/quizPure.ts::gradeQuiz` is pure index-comparison grading — reusable as-is for grading any variant, provided it's told which question set (canonical or variant) to grade against.

## Prompt builders

One real precedent exists: `lib/sow/aiLessonGenerator.ts::buildLessonPrompt()` (line 122) feeding `generateValidatedLesson()`, which calls `callDeepSeek` and then runs the result through `validateLesson()` (`lib/sow/validators.ts`) before accepting it — reject-and-flag on failure, never a partial write. This is a **pattern to replicate** (build-prompt → call → structurally validate → accept-or-flag), not code to reuse directly — its prompt and validator are lesson-plan-shaped, not question-shaped. No existing question-level prompt builder exists anywhere in the codebase (confirmed: `careerEngine.ts` is the only other prompt-construction site, and it's career-narrative-shaped, not assessment-shaped).

## AI providers

`lib/ai/deepseek.ts::callDeepSeek` is the primary, sole-sanctioned call surface (per CLAUDE.md: "All AI calls go through `lib/ai/` only"). `lib/ai/gemini.ts` + `lib/ai/models.ts` define a Gemini fallback path (`GEMINI_PRIMARY`/`GEMINI_FALLBACK`, both currently the same model tier) — `aiLessonGenerator.ts` shows the fallback pattern in practice (DeepSeek first, Gemini non-streaming fallback on failure, line ~195). AATE's generation calls should follow this exact same provider/fallback shape, not a new one.

## Teacher review workflow

`lib/adaptiveLearning/differentiation.ts`'s draft → review → adjust → approve shape (same interaction as the Holiday Planner publish gate) is the direct precedent for "teacher previews every generated variant, edits if desired, approves; only then published." It is currently **orphaned** — its two API routes (`app/api/teacher/classes/[classId]/differentiation/route.ts` and `.../approve/route.ts`) have zero callers anywhere in `app/` or `components/` (confirmed by grep). Reusable as an interaction *shape*; not reusable as working code, since it operates on class-groupings, not on stored question-variant rows.

## Assignment publishing pipeline

`assignments.status` is a real enum (`draft`/`active`/`closed`, enforced in `app/api/teacher/assignments/[id]/route.ts`'s Zod schema) — **but a normal assignment is created directly at `active`**, so `'draft'` exists in the type system without a live producer today (the same "reserved, unreachable" situation ADR-0023 flagged for its own Level B). AATE can be the first real user of `status: 'draft'` as an actual gate: an Adaptive assignment is created `draft`, submissions are *not* pre-created until variants are approved, and only the approval step flips both to `active` and triggers the submission pre-creation that currently happens unconditionally at creation time.

## Question storage schema

`assignment_questions` (migration `20260723093000_lms_quiz_extends_assignments.sql`) is a flat table: `id, assignment_id, question_text, choices, correct_index, order_index` — one shared row set per assignment, **no variant dimension at all.** RLS is teacher-CRUD-only, no student SELECT policy; the student-facing route (`app/api/student/assignments/[id]/questions/route.ts`) serves questions via the service-role client and explicitly omits `correct_index` at the query level (`select('id, question_text, choices, order_index')` in `findQuestionsForStudent`) — this "server strips the sensitive column, no client policy" posture is the exact pattern any variant-serving route must copy for a per-band `correct_index`.

**Confirmed schema drift, unrelated to AATE but worth flagging while in this file**: `assignment_questions` and `assignment_submissions` exist in `supabase/migrations/` but `assignment_questions` does not appear at all in the generated `lib/database.types.ts` — the generated types are stale relative to migrations. Regenerate types (`mcp__supabase__generate_typescript_types`) before writing any TypeScript against a new `assignment_question_variants` table, or the same drift compounds.

## Evidence generation path

Two live, working, reusable-as-is producers: `lib/quiz/quizEvidence.ts::recordQuizAutoGradeEvidence` (Tier 2, `quiz_auto_grade` source, student-initiated, curriculum-anchored via `resolveCurriculumContext`) for auto-graded quizzes, and `lib/assignments/evidence.ts` for teacher-marked assignments. Both already resolve `substrand_id` → real `CurriculumContext` the same way. AATE introduces **zero new evidence-producing logic** — a variant's submission still just calls `recordQuizAutoGradeEvidence` with whichever question set was actually served, satisfying the Safety Principle "AI never creates evidence directly; evidence is generated only from learner performance after completion" by construction (evidence only exists because `quizEvidence.ts` already only fires post-submission).

## Variant persistence strategy

**Does not exist — the one real gap**, confirmed independently by this audit and the prior session's ADR-0025 draft. No table, migration, or type carries a per-band question variant anywhere in the codebase. This is the only net-new schema AATE requires.

### Reusable without modification
`recommendForClass`/`classifyGroup` (band + `academicGrain`), `resolveCurriculumContext`, `gradeQuiz`, `recordQuizAutoGradeEvidence`, `callDeepSeek`/Gemini-fallback pattern, `TOKEN_COSTS` mechanism, the draft/approve interaction shape.

### Net-new required
One table (`assignment_question_variants`, canonical-question-scoped, per the Canonical Question Model above — not a fourth Independent-tier row, since Independent already **is** the canonical question, mirroring ADR-0022's original "on_track needs no separate row" finding), a `served_variant_map` column on `assignment_submissions` (append-only; a served/graded reference must survive regeneration untouched), and a real use of `status: 'draft'` as an actual pre-publish gate at assignment-creation time.

---

# Exit Criteria

ADR-0025 succeeds when the following statement becomes true:

> "A teacher can create one curriculum-aligned assessment, approve multiple curriculum-equivalent instructional variants, and publish them so learners receive adaptive assessments based entirely on the existing Evidence → Projection → Recommendation pipeline without introducing another learner model, another recommendation engine, or another curriculum representation."

**Not yet met** — confirmed not buildable today without the one net-new schema piece named above. No code exists yet toward this exit criterion.

---

# Recommendation

Conditional GO.

The audit above is the "comprehensive architecture audit" this document's own Recommendation calls for — completed against live code and live migrations, not assumed. It confirms every reusable component named in the design (Projection, Recommendation, curriculum resolution, grading, evidence emission, the draft/approve shape) is real, tested, and requires zero modification, and narrows the actual build to exactly two things: the canonical-question-and-variant schema (with append-only serving semantics), and giving `assignments.status = 'draft'` its first real producer.

The first implementation milestone is not AI generation.

It is establishing the **Canonical Assessment** as the immutable source from which every adaptive variant is derived — concretely: the `assignment_question_variants` schema + migration, the `served_variant_map` append-only guarantee (a DB trigger, not app-level discipline, per the same immutability standard `learner_evidence` already holds itself to), and wiring assignment creation's "Adaptive or Uniform" choice to actually gate submission pre-creation on `status`, before any generation code is written.

**Awaiting your review of this audit and the two-piece build scope before any migration, route, or generation code is written.**
