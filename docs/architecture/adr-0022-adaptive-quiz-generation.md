# ADR-0022 — Adaptive Quiz Generation

**Status: DRAFT — design pass only, per user's explicit choice (2026-07-18). No code, schema, or route was written or modified in producing this document.**

**Why this document exists**: the user named this "one of the platform's founding dreams" — at end of term, a teacher generates one quiz where every learner answers a version of the same questions pitched at their own real level. That combination — real learner data, AI-generated content, an auto-graded score that gets recorded — is exactly the situation this project's own standing rules say deserves a design pass before code, not during it.

**Depends on / extends**: `lib/adaptiveLearning/recommend.ts` + `lib/adaptiveLearning/differentiation.ts` ("Adaptive Learning v2," `docs/architecture/adaptive-learning-v2-architecture.md`, frozen) — the grouping engine this reuses, unmodified. `lib/quiz/` (today's Phase 3a) — the delivery/auto-grade mechanism this extends. `lib/projection/recompute.ts` (`recomputeLearnerProjection`) — the only sanctioned read path into a learner's real level; this ADR introduces no new read path into that data.

---

## Phase 1 — Audit (what already exists, read before designing anything new)

Confirmed by direct file reading, not assumption:

| Piece | Status | Where |
|---|---|---|
| Reads each learner's real level correctly (Projection-sourced) | **Built, tested, correct** | `recommendForClass()`, `lib/adaptiveLearning/recommend.ts:245-259` — takes a class roster, returns each learner's `groupType` (`critical_gap`/`prerequisite_gap`/`concept_confusion`/`on_track`/`insufficient_data`) per subject, with `learnerId` attached per task (`AdaptiveTask.learnerId`, `recommend.ts:36-50,188-201`) |
| Persists a class grouping as a teacher-reviewable draft | Built, no live caller | `lib/adaptiveLearning/differentiation.ts`, `app/api/teacher/classes/[classId]/differentiation/route.ts` |
| Generates actual differentiated **question content** | **Does not exist** | Group output today is a template prose sentence (`action` field), not a question. Zero AI calls anywhere in `lib/adaptiveLearning/` |
| Fixed-set MCQ quiz, auto-graded, feeds Gradebook | **Built today** (Phase 3a) | `lib/quiz/`, `assignments.is_quiz`/`assignment_questions` |
| Any per-student question variant concept | **Does not exist** | `assignment_questions` has one shared row set per assignment; no student-scoped variant table anywhere in the schema |
| Quiz/assignment results feeding back into `learner_evidence` | **Does not exist** | Grepped `student.assignment.submitted`/`.marked` event consumers — nothing in `lib/intelligence/` or `lib/projection/` reads assignment events. Assignments (quiz or not) are a dead end for the Evidence/Projection loop today |

**Conclusion**: no canonical owner for "AI-generated, per-learner-leveled question content" exists. This is the one genuinely new piece — everything else (grouping, delivery, grading) already has a canonical home and should be reused, not rebuilt.

---

## Phase 2 — Core Educational Question

**What does "tailored to a learner's exact level" mean, concretely and falsifiably?**

**Answer: the same four bands Adaptive Learning v2 already uses — `critical_gap`, `prerequisite_gap`, `concept_confusion`, `on_track` — never a fifth, invented taxonomy.** Reusing the frozen grouping is not a convenience shortcut; it's the same "don't duplicate a canonical concept" discipline this whole initiative has followed all day. A learner in `insufficient_data` (no projection evidence yet — a real, common case for a new transfer student or a subject with no recorded assessments) must get a graceful, explicit fallback, never a blocked quiz and never a silently-wrong guess at their level.

**A quiz question, tailored, is: the same underlying concept and learning objective, expressed at a difficulty appropriate to the learner's band — never a different topic, never an easier *subject*, only an easier or harder *expression* of the same one.** This mirrors Compass's own difficulty-adaptation principle (`lib/learn/engine.ts`) and Adaptive Learning v2's `taskStyle` mapping (foundational/reinforcement/enrichment) — both already-frozen precedents for what "same content, different level" means on this platform.

---

## Phase 3 — Domain Definition

**Adaptive Quiz Generation owns exactly one thing: turning an existing quiz's base question set into per-band question variants, at generation time, with a teacher approval gate before any variant is ever served to a real learner.**

**Never owns:**

| Concept | Actual owner |
|---|---:|
| A learner's real level/band | Adaptive Learning v2 (`recommend.ts`) — read-only, unmodified |
| The base quiz questions | Quiz (Phase 3a) — unmodified, remains the `on_track` variant by convention (no separate "on_track variant" row needed — the base question *is* the on_track content) |
| Auto-grading arithmetic | `lib/quiz/quizPure.ts::gradeQuiz` — reused as-is, called once per served variant |
| Whether a quiz result becomes Evidence | **Not decided here** — see Open Question 1 below |

---

## Phase 4 — Proposed Design (draft — the part that needs your review, not yet approved)

### Schema

```sql
CREATE TABLE assignment_question_variants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id    uuid NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  band           text NOT NULL CHECK (band IN ('critical_gap','prerequisite_gap','concept_confusion')),
  -- 'on_track' is deliberately NOT a band value here — the base
  -- assignment_questions row already IS the on_track content, per Phase 3
  -- above. Storing a fourth identical-tier variant would be a duplicate
  -- write path for the same fact.
  question_text  text NOT NULL,
  choices        text[] NOT NULL,
  correct_index  int  NOT NULL,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  generated_by   text NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai','teacher_edited')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

`assignment_submissions` needs one addition: `served_variant_map jsonb` — `{ questionId: variantId | null }` recorded **at the moment the student opens the quiz**, not at grading time. This is not optional bookkeeping — grading must check the answer against the exact variant a student was actually served, and a teacher reviewing a submission later must be able to see which version their learner answered. Without this, a regenerated or edited variant could silently make a past grade unverifiable.

### Generation flow

1. Teacher clicks "Generate Adaptive Variants" on an existing quiz-type assignment (a new action on the Phase 3a quiz builder page, not a new page).
2. Server calls `recommendForClass()` — **unmodified, reused exactly as it exists today** — to get each enrolled student's band for the assignment's subject.
3. For each base question × each band **actually present in this class roster** (never all four unconditionally — a class with no `critical_gap` students generates zero `critical_gap` variants, both for cost and because there's nothing to review otherwise), one AI call generates one variant. This is **generate-once-per-(question, band)**, not per-student — a class of 40 with 3 bands present and 5 questions is 15 AI calls, not 200.
4. All variants land as `status = 'draft'`. Nothing is servable yet.
5. **Teacher approval screen** (extends the Phase 3a quiz-builder page, same interaction shape as Holiday Planner's publish gate): each variant shown next to its base question, teacher can edit the text/choices/correct answer directly or regenerate, then approves per-question or in bulk. A variant a teacher never approves is never served — the class silently falls back to the base question for that band, which is the safe default, not a blocking error.
6. On take: the student-questions route resolves the student's band (one cheap Projection read, not a full class recompute) and serves the approved variant for their band if one exists, else the base question. The served mapping is recorded immediately, before the student answers anything.
7. Grading (`gradeAndSubmitQuiz`) is extended to grade each answer against the variant recorded in `served_variant_map`, not always the base question's `correct_index`.

### AI cost and quality controls (CLAUDE.md's AI rules, applied here specifically)

- New `TOKEN_COSTS.adaptive_quiz_variant_generate` entry in `lib/payments/config.ts` — the single source of truth, gated the same free/full/token shape as every other generation feature.
- Cost scales with `questions × distinct bands present`, not `questions × students` — the generate-once-and-cache principle already used by this platform's `career_market_cache`.
- Explicit `max_tokens`, structured-output validation (a malformed AI response for one variant must not corrupt the others or crash the batch — skip and flag that one variant for manual teacher authoring instead).
- **No AI-generated variant is ever auto-approved.** This is the least negotiable part of the design: an MCQ silently asserts a "correct" answer with authority, and this platform's whole differentiator is trustable, evidence-based correctness. A wrong AI-generated correct_index reaching a real learner's score is a worse failure than any other AI mistake on this platform, because it's graded, not conversational.

---

## Open Questions (named, not silently resolved)

1. **Should a quiz result (adaptive or not) become `learner_evidence`?** Confirmed today: it currently doesn't, for any assignment. This ADR does not propose changing that — wiring assessment-style evidence emission from `assignments`/`assignment_submissions` is a separate, real architectural decision (touches the Evidence domain's own strict rules) that deserves its own ADR, not a side effect of this one. Named here so it isn't silently forgotten: closing this loop is what would make an adaptive quiz's outcome actually improve *future* adaptivity, which is presumably part of the founding dream, not just this one generation event.
2. **Per-band or fully per-student variants?** This design intentionally stops at four bands, not 40 individual variants for a 40-student class, both for AI cost and because Adaptive Learning v2's whole architecture is band-based, not individual-based. If the real dream is stronger than banding (a literal one-per-learner tailoring), that's a bigger, different design and should be named explicitly before building — flagging rather than assuming.
3. **What happens at re-generation?** If a teacher regenerates variants after some students already have a `served_variant_map` recorded against the old ones, old submissions must keep referencing what was actually served (append-only, never rewrite a past grade) — this needs the same discipline as the Learner-domain ADRs' immutability triggers, scoped down to this table.

---

## Guardian Mode Assessment

- **Affected domains**: Assignments/Quiz (extend), Adaptive Learning v2 (read-only consumer, unmodified), AI/`lib/ai/` (new call site, new cost entry).
- **Constitutional/RAS compliance**: no violation identified — Projection remains read-only via the sanctioned path; no new identity introduced.
- **ADR required?** Yes — this document. Trigger: new AI-content-generation surface with a real correctness bar (an auto-graded score, not a conversational reply), plus a cross-domain integration (Adaptive Learning + Quiz) neither of today's two systems was designed to do alone.
- **Smallest compliant next step, if approved**: build the schema + generation + approval-gate flow for one class as a pilot, with regeneration/immutability handled from day one (Open Question 3), before wiring it into the quiz-builder UI broadly.

**Approval**: ⚠ Awaiting your review — none of Phase 4's design or the three open questions has been built. Tell me what to change before I write a line of code.
