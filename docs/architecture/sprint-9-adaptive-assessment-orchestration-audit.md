# Sprint 9 — Adaptive Assessment Orchestration: Workflow, UI, Generation, Fairness & Failure Audit

## Audit Only — No Code Written Yet (see §8 for why)

---

## Executive Summary — The One Correction That Reshapes This Sprint

The brief lists "Existing Systems That MUST Be Reused," including **Variant persistence (Sprint 4B)**, **Variant delivery (Sprint 4C)**, and implicitly the Sprint 5A generation engine and ADR-0025's teacher-review workflow. **Verified against the repository directly, not assumed from the sprint numbers**: none of these exist as code. Sprint 4B, 4C, and 5A were **design-only sprints** — no `assignment_question_variants` table, no `served_variant_map` column, no generation prompt code, no teacher-review UI, and no variant-aware grading path exist anywhere in this codebase today. Only Sprint 6A (Recommendation consolidation), Sprint 6B (one AI-router migration), Sprint 7A (`EducationalAIContext`, zero adopters), and Sprint 8A (Teacher Dashboard mastery migration) produced real code.

**This changes what "integration, not invention" means for this sprint.** The mission statement is correct that no new *intelligence* is needed — Curriculum, Evidence, Projection, Recommendation, `EducationalAIContext`, and the AI Router are all real and reusable exactly as designed. But building the adaptive-assignment workflow itself is **not** wiring together seven already-built pieces — it is the **first real implementation** of three design-only sprints (4B, 4C, 5A) plus new UI, a real schema migration touching the live Supabase project, and a new AI-generation cost surface. That is a large, multi-part build, not an afternoon of integration. This audit proceeds on that corrected premise and ends with a phased plan rather than a single undifferentiated implementation, for the reasons in §8.

---

## 1. Workflow Audit — Every Transition, Traced to Real Code or Named as Not-Yet-Built

```
Teacher clicks Create Assessment
        │  REAL — app/api/teacher/assignments/route.ts (POST), unchanged by this sprint
        ▼
Assignment created
        │  REAL, with one gap: creation hardcodes status: 'active' (Sprint 4A audit's own
        │  finding, never fixed — Sprint 4A.1/4B's "draft-capable creation" was designed,
        │  never implemented). An Adaptive assignment needs to start non-visible to
        │  students until variants are approved — this specific gap is now load-bearing
        │  for Sprint 9 in a way it wasn't for the narrower prior sprints.
        ▼
Canonical question authoring
        │  REAL — lib/quiz/quiz.ts::replaceQuestions(), BUT with the destructive
        │  delete-and-recreate behavior Sprint 4A/4A.1 identified and designed a fix for
        │  (ID-preserving upsert + submission-activity lock) — never implemented. Building
        │  variant persistence (next step) on top of today's replaceQuestions() would
        │  inherit the exact cascade-delete hazard those two audits exist to prevent.
        ▼
Variant generation
        │  DOES NOT EXIST. Sprint 5A designed the transformation rules, prompt
        │  architecture, and safety validation; zero of it is implemented. No
        │  assignment_question_variants table exists (Sprint 4B, design only).
        ▼
Teacher review
        │  DOES NOT EXIST. ADR-0025's approval-gate UI, Sprint 4B's draft/approved/
        │  rejected/archived state machine — design only, no schema, no screen.
        ▼
Approve / Publish
        │  PARTIALLY REAL — assignments.status already supports 'draft'/'active'/'closed'
        │  via PATCH (Sprint 4A audit), but nothing today gates "publish" on variant
        │  approval, because no variant exists to gate on.
        ▼
Student opens assignment
        │  REAL — app/api/student/assignments/[id]/questions/route.ts, serves the
        │  canonical question set only. No variant-resolution branch exists.
        ▼
Variant resolution
        │  DOES NOT EXIST. Sprint 4C designed the exactly-once, write-if-absent
        │  served_variant_map resolution; no served_variant_map column exists.
        ▼
Submission
        │  REAL — app/api/student/submit-quiz/route.ts → gradeAndSubmitQuiz()
        ▼
Variant-aware grading
        │  DOES NOT EXIST — gradeAndSubmitQuiz() reads live assignment_questions.
        │  correct_index unconditionally; the served_variant_map-aware resolution
        │  Sprint 4C designed was never built.
        ▼
Evidence emission
        │  REAL, and correctly needs ZERO changes — recordQuizAutoGradeEvidence()
        │  (lib/quiz/quizEvidence.ts) already fires post-grading regardless of which
        │  question set was graded against; Sprint 4C's own audit already confirmed
        │  Evidence needs no variant-awareness.
        ▼
Projection recomputation
        │  REAL, zero changes needed — recomputeLearnerProjection() already reflects
        │  any new confirmed Evidence automatically, adaptive or not.
        ▼
Future recommendations updated
        │  REAL, zero changes needed — recommendForClass()/classifyGroup() already
        │  read fresh Projection on every call; this is exactly the "continuous cycle"
        │  ADR-0026 describes, and it already works, today, for non-adaptive
        │  assignments — closing the loop on the adaptive path requires nothing new
        │  here once grading/evidence are correctly variant-aware.
```

**Reusable exactly as-is, confirmed**: Curriculum resolution, Evidence emission, Projection, Recommendation, the AI Router (Sprint 6B), `EducationalAIContext` (Sprint 7A, zero adopters yet — this would be its first). **Net-new, in order of dependency**: (1) the ID-preserving question upsert + lock (Sprint 4A.1's design), (2) `assignment_question_variants` + `served_variant_map` schema (Sprint 4B's design), (3) generation (Sprint 5A's design, now with a real `EducationalAIContext` input available that didn't exist when 5A was written), (4) teacher review UI, (5) variant-aware serving + grading (Sprint 4C's design), (6) draft-capable assignment creation (Sprint 4A's design).

---

## 2. UI Audit

| Screen | Exists today? | Disposition |
|---|---|---|
| Create Assessment (`app/teacher/assignments/new/page.tsx`) | Yes | **Extend** — add the Uniform/Adaptive mode toggle; Uniform path must remain byte-for-byte unchanged |
| Quiz builder (`app/teacher/assignments/[assignmentId]/quiz/page.tsx`) | Yes | **Reuse as the canonical-question authoring step**, unchanged for Uniform mode; for Adaptive mode it becomes the step that precedes generation, not itself modified |
| Review screen (Canonical vs. Foundation/Supported/Extension comparison, ADR-0025 §"Teacher Workflow") | **Does not exist** | **New page, unavoidable** — nothing in the current codebase renders a multi-variant side-by-side comparison; the closest precedent (`differentiation.ts`'s draft/approve API, zero UI callers per Sprint 7A/4A findings) is itself unbuilt-on |
| Publish flow | Partially — the status PATCH endpoint exists; no UI action gates it on variant approval | **Extend** the existing assignment detail page's status control, add the approval-gate check server-side |
| Student assignment page (`app/api/student/assignments/[id]/questions`, no dedicated student-facing page found — likely a shared component) | Yes, as an API route; needs a resolution branch | **Extend** — insert variant resolution before returning the question list, per Sprint 4C's design |
| Teacher marking page | Exists for non-quiz assignments (`app/api/teacher/assignments/[id]/mark`) | **Reuse, unchanged** — adaptive quizzes are auto-graded, same as today's quizzes; this page is out of the adaptive path entirely |
| Results page (`app/teacher/assignments/[assignmentId]/results/page.tsx`) | Yes | **Extend** — should show which variant each student was actually served, for teacher transparency (ADR-0026's explainability requirement), not required for a minimal first slice |

**One new page is genuinely unavoidable**: the teacher review/comparison screen. Everything else is an extension of a real, existing screen.

---

## 3. Variant Generation Audit

Per the brief's own requirements, checked against Sprint 5A's design and Sprint 7A's real `EducationalAIContext`:

- **Receives `EducationalAIContext`**: possible today, for the first time — Sprint 7A's contract exists and is real code; this would be its first adopter, exactly as Sprint 7A's own report named as the safe next step (though that report identified `holiday/planner.ts` as the *lowest-risk* candidate — generation is a higher-stakes consumer, addressed in §8).
- **Receives canonical question, curriculum node, instructional tier**: all real and resolvable (`assignment_questions`, `resolveCurriculumContext`, `classifyGroup`'s band → Sprint 5A's frozen tier mapping, reconciled to ADR-0026's "Supported Practice"/"Independent" naming).
- **Produces only the Sprint 5A schema**: the schema itself (`question_text`, `choices`, `correct_index`, `cognitive_intent`, `difficulty_rationale`, `expected_misconceptions`, `teacher_explanation`, `learner_explanation`) is fully specified in ADR-0025/Sprint 5A — real design, zero code.
- **Never bypasses the router**: must call `routedCompletion()` (Sprint 6B), not `callDeepSeek` directly — the second real adopter of the canonical router, if built this way from the start.
- **Never bypasses ADR-0026**: the one-question-one-gradable-item constraint (never split a scaffolded variant into multiple graded rows) and the independent-verification call (Sprint 5A §7) are both design requirements with zero enforcement code today — both must be built, not assumed.

**Conclusion: generation is fully specified, entirely unbuilt.** This is the single largest net-new component in this sprint.

---

## 4. Fairness Audit

| Requirement | Status |
|---|---|
| Every learner assessed on identical curriculum outcome | Guaranteed **by design** (Sprint 4B/5A: a variant's `learning_outcome`/`sub_strand_id` are copied verbatim from the canonical question's own resolution, never re-resolved) — not yet enforceable in practice because no variant exists |
| Difficulty adapted, learning objective unchanged | Same — a real, well-specified design constraint (ADR-0025/ADR-0026), zero enforcement code |
| Marks comparable | **A real, open design question, not yet resolved even on paper**: Sprint 5A ruled variant-specific answer keys are necessary (different distractors per tier), and `gradeQuiz()`'s uniform per-question mark allocation is unchanged — so marks stay comparable *count-wise* (each question is worth the same share regardless of tier), but a Foundation variant's guided/scaffolded question may be easier to get right by construction. This is the same tension every adaptive-assessment ADR in this series has acknowledged (support ≠ lowered standard) but never mechanically verified — worth naming explicitly rather than asserting solved |
| Evidence comparable | Yes — `recordQuizAutoGradeEvidence` is unconditional and already correctly variant-agnostic (Sprint 4C's own finding, confirmed) |
| Projection remains curriculum-grounded | Yes — Projection reads Evidence, which carries `sub_strand_id` regardless of which variant produced the score; no change needed |

---

## 5. Failure Audit

| Scenario | Designed behavior (per prior sprints) | Built today? |
|---|---|---|
| AI unavailable | Router's existing fallback chain + retry (Sprint 6B); generation call itself doesn't exist yet | No — depends on generation being built first |
| Variant generation fails validation | Sprint 5A: reject, flag for manual teacher authoring, never partially stored | Design only |
| Teacher rejects variants | Sprint 4B: `status: 'rejected'`, band falls back to serving the canonical question — the same safe default as no variant existing at all | Design only |
| Teacher edits variants | Sprint 4B: `generated_by → 'teacher_edited'`, still requires explicit approval | Design only |
| Only one variant approved (e.g. Foundation only) | Sprint 4B/4C: per-question, per-tier approval — a class with no approved Extension variant serves canonical to `on_track` learners, exactly the graceful fallback ADR-0025 specifies | Design only |
| Missing Projection (no evidence yet) | `classifyGroup` → `insufficient_data`; Sprint 4C's variant-selection lookup falls back to canonical, honestly | **Real** — this exact fallback already works today for non-adaptive Recommendation consumers |
| Missing curriculum identity | `buildAdaptiveTask`'s `curriculumNotice` — already real, already tested (Phase 3, this session) | **Real** |
| Student refreshes | Sprint 4C: `served_variant_map` read-only after first write — same map returned, no re-resolution | Design only, depends on the column existing |
| Variant archived (regenerated) | Sprint 4B/4C: archived-never-deleted; grading resolves the specific referenced row regardless of its current status | Design only |
| Retry submission | Sprint 4C: resubmission grades against the same already-resolved map, never re-selects | Design only |
| Already-served learner, teacher regenerates | Sprint 4C §8: no effect on already-served learners, by construction (archive, not overwrite) | Design only |

**Every failure mode has a real, previously-reasoned answer.** None of them have code behind them yet — this is the accurate, complete state, not a gap in the audit.

---

## 6. Final Verification — Answered Honestly, Against What Exists Today

| Question | Answer |
|---|---|
| One curriculum identity? | Yes, already true, unconditionally (`resolveCurriculumContext` is the only path) |
| One instructional classifier? | Yes, already true (Sprint 6A closed the last confirmed duplicate) |
| One evidence pipeline? | Yes, already true (`persistEvidenceBatch`, one immutable table) |
| One projection engine? | Yes, already true |
| One recommendation engine? | Yes, already true |
| One AI routing path? | **Not yet** — 10 real `callDeepSeek` sites and 4 direct-Gemini sites remain outside the router (Sprint 6B's own finding); generation, if built, must be the router's second real adopter, not a new bypass |
| Can the teacher treat it as one assessment? | **Not yet buildable** — there is no variant table, no review UI, no publish gate; today a teacher has exactly one flat quiz, not a choice |
| Does the system get smarter after grading, with no extra code path? | **Partially true already, for the parts that exist** — Evidence→Projection→Recommendation already closes this loop for every graded quiz today, adaptive or not. It will remain true once variant-aware grading exists, because Evidence emission needs zero changes (Sprint 4C's own finding) |

**5 of 8 are already true, unconditionally, today — a real, valuable confirmation the architecture holds. The remaining 3 require the net-new build this audit scopes below.**

---

## 7. What Sprint 9 Actually Requires — Named Precisely

1. Sprint 4A.1's design, implemented: ID-preserving question upsert + submission-activity lock (prerequisite — building variant persistence on today's destructive `replaceQuestions()` inherits a real cascade-delete hazard).
2. Sprint 4B's design, implemented: `assignment_question_variants` table (migration, live Supabase project), `served_variant_map` column, the partial-unique-approved index, archive-on-regenerate.
3. Sprint 5A's design, implemented: the generation call (via `routedCompletion`, via `EducationalAIContext`), structural validation, the independent-verification call.
4. A new teacher review/comparison screen (§2) — the one unavoidable new page.
5. Sprint 4A's design, implemented: draft-capable assignment creation, gating student visibility until publish.
6. Sprint 4C's design, implemented: variant resolution at first-open, variant-aware grading.
7. Extensions to 3 existing screens (create, publish/status, results) — no other new pages.

This is a real, multi-part, multi-migration feature — not an integration task measured in hours.

---

## 8. Why This Document Stops Here Instead of Writing All of It

Every one of this project's own prior large builds in this exact series (Sprint 4B's schema, Sprint 4C's delivery/grading, Sprint 5A's generation) was deliberately kept design-only and reviewed before implementation, precisely because each touches a live schema, introduces new AI cost, or changes what a real learner is served. Sprint 9, as scoped by this brief, is **all three of those sprints' implementations at once, plus new UI** — the single largest code change this entire series has approached. Writing a live-database migration, a new AI-generation cost surface, and a brand-new teacher-facing review screen in one uninterrupted pass, without confirming sequencing and blast-radius tolerance first, would be inconsistent with how every smaller piece of this same architecture was actually built (Sprint 6A/6B/8A were each one narrow, low-risk, single-function migration, reviewed as such).

**Recommendation**: implement §7's seven items as a sequence of small, individually-verifiable slices — matching this series' own proven discipline — rather than one undifferentiated sprint. The next message proposes that sequence and asks which slice to start with.
