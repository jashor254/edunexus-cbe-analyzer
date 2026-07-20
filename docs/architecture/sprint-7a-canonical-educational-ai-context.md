# Sprint 7A — Canonical Educational AI Context

## Repository-Wide Audit + Contract Implementation, following ADR-0028

**Status: Contract implemented (`lib/ai/educationalContext.ts`), zero callers migrated — exactly as scoped.**

---

## Executive Summary

The audit's single most important finding is a sixth confirmed instance of this codebase's own repeating pattern (ADR-0028 found three; Sprint 6B found a fourth and fifth): **`lib/ai/ragContext.ts::buildStudentRAGContext` already is a "canonical educational context builder for AI" — and it is dormant, unused, and built on the wrong foundation.** Its own header comment claims it powers "Academic Clinic reports and Career matching"; a repository-wide grep confirms **zero callers anywhere**. Worse than merely unused: it independently computes a learner's "overallLevel"/strongest/struggling subjects from `repos.teachers.findLegacyAssessmentsByStudent` — legacy assessment tables, entirely bypassing Evidence, Projection, Curriculum resolution, and Recommendation. Had it ever been adopted, it would have been a second, competing "summarize this learner for an AI prompt" implementation, parallel to the canonical one this sprint formalizes.

**This sprint does not build a new context system alongside it.** `lib/ai/educationalContext.ts`'s `EducationalAIContext` supersedes `ragContext.ts` by construction: every field is read directly from `buildAdaptiveTask()` (Recommendation, Phase 3 — itself already Evidence→Projection→Curriculum, canonical and tested) — zero new computation, zero new read path into any data source. `ragContext.ts` is named, not deleted, matching this series' own standing discipline for dormant infrastructure (ADR-0027's treatment of `kicd_curriculum_lessons`).

**Recommendation: CONDITIONAL GO** — see §7.

---

## 1. Repository-Wide Audit — Every Production AI Call Site's Context Construction

Traced against the full, corrected 17-site inventory (Sprint 6B's audit, with the `lib/utils/cache.ts` false-positive already excluded and the direct-Gemini category already identified):

| File | Curriculum resolved? | Projection included? | Recommendation band included? | ARDS/precision? | Evidence provenance? | Instructional knowledge? | Safety constraint representation |
|---|---|---|---|---|---|---|---|
| `lib/holiday/planner.ts` | Yes — via `buildAdaptiveTask`'s own `curriculumContext` | Yes — `recomputeLearnerProjection` | Yes — `buildAdaptiveTask` | No (unbuilt) | Indirect — `task.evidence` exists but isn't passed into the prompt itself | No (unbuilt) | Implicit in the already-derived `action`/`observation` text |
| `lib/remedial/planner.ts` (`enrichWithAI`) | No — receives already-derived group-summary strings, not a curriculum node, at the AI-call layer | Indirect — the classification upstream (Sprint 6A) uses Projection; the AI call itself receives only derived English text | Indirect — same reasoning | No | No | No | None represented at this layer — safety already enforced upstream by classification, not by prompt instruction |
| `lib/sow/aiLessonGenerator.ts` | Yes — KICD context (though confirmed empty in the live DB per ADR-0027's own audit) | **No** | **No** | No | No | No | **Automatic**, via `validateLesson()` post-generation — the one call site with a real verification step, not just prompt wording |
| `lib/career/careerEngine.ts`, `careerIntelligenceEngine.ts` | Partial — curriculum-adjacent framing, not a resolved `CurriculumContext` | Yes — `recomputeLearnerProjection` | No — doesn't call `classifyGroup` | No | No | No | None represented explicitly |
| `lib/career/autoReportGenerator.ts` | **Weak** — a bare `curriculum_type` string + grade, not a resolved node | No | No | No | No | No | **Prompt-instruction only**, no automatic check: `"CRITICAL: firstConcept MUST be a topic from the student's ACTUAL grade curriculum — NEVER a lower-grade topic"` — trusted to the model, never verified |
| `lib/teachingIntelligence/weeklyGenerator.ts` | No — via `substrand_health`, a **third, separate** health signal, neither Projection nor `classifyGroup` | No | No | No | No | No | None represented |
| `lib/academy/aiJudge.ts` | Flavor text only ("expert in CBC curriculum") | N/A — teacher-facing, not learner-scoped at all | N/A | N/A | N/A | N/A | None — different in kind, not a learner-context omission |
| `lib/lessonPlan/generator.ts` | Weak — `subjectUtils` helpers, not the canonical resolver | No | No | No | No | No | None represented |
| `lib/kiswahili/inshaEvaluator.ts` | **None** | **None** | **None** | No | No | No | None — grades a raw essay with zero deterministic grounding of any kind |
| `lib/slides/aiSlideGenerator.ts`, `lib/career/matchEngine.ts` | Flavor text only | No | No | No | No | No | None represented |
| `lib/teachingIntelligence/quickCheckGenerator.ts`, `rootCauseClassifier.ts`, `lib/studyGroups/challengeGenerator.ts` | Not traceable at this layer (direct-Gemini path, Sprint 6B) — may receive pre-resolved data from an untraced caller | Not traceable here | Not traceable here | No | No | No | Not traceable here — named as a real limit of this audit's method, not asserted clean |
| `lib/ai/ragContext.ts` (**dormant, zero callers**) | No — bare `curriculum_type` string | **No** — legacy assessment tables, not Projection | No | No | No | No | None — the exemplar of exactly the pattern this sprint exists to prevent from ever being adopted |

**Answering the audit's six mandated questions directly**:
- **Curriculum information**: present and real in exactly one place (`aiLessonGenerator.ts`'s KICD context, itself confirmed empty in production by ADR-0027); resolved-and-typed (`CurriculumContext`) in one place (`holiday/planner.ts`, via `buildAdaptiveTask`); flavor text or absent everywhere else.
- **Projection**: included in 3 of 17 (`holiday/planner.ts`, `careerEngine.ts`, `careerIntelligenceEngine.ts`); absent everywhere else, including the dormant `ragContext.ts`, which computes its own parallel summary instead.
- **Recommendation output**: included in exactly 1 of 17 (`holiday/planner.ts`, via `buildAdaptiveTask`).
- **ARDS/readiness placeholders**: present in **zero** call sites — confirmed, ARDS doesn't exist, and no call site even carries an honest "precision unknown" marker today.
- **Evidence provenance**: never passed into a prompt directly anywhere (correct, per the standing "AI never touches raw evidence" boundary) — but also never surfaced as *context available to the calling code* in a consistent, named field, except implicitly inside `AdaptiveTask.evidence` in the one call site that uses it.
- **Instructional knowledge**: present in **zero** call sites — confirmed, IKL doesn't exist.
- **Safety constraints**: represented **inconsistently** — one real automatic check (`aiLessonGenerator.ts`'s `validateLesson`), one prompt-instruction-only check with no verification (`autoReportGenerator.ts`), and no representation at all in the remaining thirteen.

---

## 2. Duplicated Prompt-Construction Logic — Confirmed

Beyond `ragContext.ts` (§Executive Summary), a second, smaller duplication: `weeklyGenerator.ts`'s use of `substrand_health` is a **third parallel "how is this class/sub-strand doing" signal**, distinct from both Projection (`recomputeLearnerProjection`) and the classification `classifyGroup()` now canonically owns (Sprint 6A). This wasn't named in ADR-0028's original audit and is a genuine, additional open item — not resolved here (this sprint's scope is the context *contract*, not migrating or reconciling every consumer), but recorded so it isn't lost.

---

## 3. The Canonical Contract — `EducationalAIContext`

Implemented in `lib/ai/educationalContext.ts`. The design decision that keeps this "the smallest architecture" rather than a new reasoning layer: **`EducationalAIContext` is not computed independently — it is a typed reshape of `AdaptiveTask`** (Recommendation's own already-canonical output). Every field traces to a value `buildAdaptiveTask()` already produced:

```ts
export type EducationalAIContext = {
  learnerId, subject,
  band,              // AdaptiveTask.groupType — the one canonical instructional band
  academicGrain,      // AdaptiveTask.academicGrain — subStrand/subject/null, honest
  curriculum,         // AdaptiveTask.curriculum — real or null, never fabricated
  curriculumNotice,   // AdaptiveTask.curriculumNotice — the gap stated explicitly
  observation, action,   // AdaptiveTask's own Insight fields
  supportingEvidenceIds,  // AdaptiveTask.evidence — provenance, never dereferenced by the AI
  confidence,
  precision: null,             // reserved — ARDS (ADR-0023), unbuilt, never fabricated
  instructionalKnowledge: null, // reserved — IKL (ADR-0027), unbuilt, never fabricated
  resolvedAt,
}
```

Two functions, following this codebase's own pure-core/thin-IO-wrapper convention (`quizPure.ts`/`quiz.ts`, `recommend.ts`'s own `buildAdaptiveTask`/`recommendForClass` split):

- **`deriveEducationalAIContext(task: AdaptiveTask): EducationalAIContext`** — pure, no DB, directly unit-tested (5 tests, `lib/ai/educationalContext.test.ts`) against synthetic `AdaptiveTask` fixtures.
- **`buildEducationalAIContext(params): Promise<EducationalAIContext>`** — the IO composition: `recomputeLearnerProjection` + `CurriculumService.resolveSubstrandContext` + `buildAdaptiveTask`, then `deriveEducationalAIContext`. Exactly the same three calls `holiday/planner.ts` already makes — no new read path into Projection or Curriculum.

**What this contract deliberately does not touch**, per the brief's own instruction: prompt wording, model selection, and provider routing (`routedCompletion`, Sprint 6B) are entirely independent of this object. A future caller builds an `EducationalAIContext`, then writes whatever prompt it wants from its fields, then calls `routedCompletion` however it wants — the contract is a data shape, not a pipeline.

---

## 4. Why Not Migrate a Caller This Sprint

Per the brief's own explicit instruction ("Do not migrate every AI caller... establish one canonical educational context contract that future migrations can consume incrementally"), no existing call site was rewired to use `buildEducationalAIContext`. This is also the honest, lower-risk choice given §1's findings: of the 17 real sites, exactly one (`holiday/planner.ts`) already assembles context in a shape close enough to migrate trivially; every other site would require a genuine behavior decision (should `autoReportGenerator.ts` gain real curriculum resolution it doesn't have today? should `weeklyGenerator.ts`'s `substrand_health` signal be reconciled with Projection first?) — decisions this sprint's own scope explicitly defers to future, incremental, one-at-a-time migrations, matching the discipline Sprint 6B already established for router adoption.

---

## 5. Workflows That Cannot Yet Adopt the Canonical Context

| Workflow | Why not |
|---|---|
| `lib/kiswahili/inshaEvaluator.ts` | Grades a submitted essay directly — there is no "subject" or "sub-strand" in the Recommendation sense to resolve a band for; a genuinely different shape of educational AI task, not a missing wire-up |
| `lib/academy/aiJudge.ts`, `lib/lessonPlan/generator.ts` | Teacher-facing (reflections, lesson authoring), not learner-scoped — `EducationalAIContext` requires a `learnerId`; these features don't have one to supply |
| `lib/teachingIntelligence/quickCheckGenerator.ts`, `rootCauseClassifier.ts`, `lib/studyGroups/challengeGenerator.ts` | Direct-Gemini path (Sprint 6B) — a different provider call shape entirely; adopting the context contract is independent of but blocked behind that unresolved migration category |
| `app/api/learn/route.ts` (Compass) | Streaming — `EducationalAIContext` itself has no streaming dependency and could be built for a Compass session in principle, but Compass's own architecture is explicitly self-contained (`lib/compass/`, per `ragContext.ts`'s own header note) and out of this sprint's scope to touch |
| `lib/teachingIntelligence/weeklyGenerator.ts` | Blocked on the `substrand_health` reconciliation named in §2 — adopting the canonical context here first requires deciding whether `substrand_health` is superseded by Projection or a genuinely distinct signal, a real open question this sprint doesn't resolve |

---

## 6. Tests

`lib/ai/educationalContext.test.ts` — 5 pure unit tests, no DB: every field traces to its source `AdaptiveTask` field; reserved fields (`precision`, `instructionalKnowledge`) are always `null`; `insufficient_data` band carries honest nulls throughout; a resolved curriculum context flows through exactly; `resolvedAt` is a real current timestamp.

```
lib/ai/educationalContext.test.ts   5 pass, 0 fail
npx tsc --noEmit                    clean
npx eslint lib/ai/educationalContext.ts lib/ai/educationalContext.test.ts   clean
```

---

## 7. Final Recommendation

**CONDITIONAL GO.**

The contract itself is sound and genuinely the smallest possible architecture — it computes nothing Recommendation didn't already compute, and it's real, tested code today, not a design sketch. Conditions:

1. **`lib/ai/ragContext.ts` must never be resurrected or migrated to** — it is superseded, not parallel, infrastructure. Any future work touching Academic Clinic reports or Career matching should reach for `buildEducationalAIContext`, never `buildStudentRAGContext`.
2. **The `substrand_health` vs. Projection question (§2) is real, open work** — named here for the first time in this series, not silently absorbed into this sprint's own success claim.
3. **Adoption is genuinely incremental, not automatic** — of 17 real call sites, only 1 (`holiday/planner.ts`) could migrate today with zero behavior-decision risk; the other 16 each carry their own named reason (§5) or their own real behavior question (§1's per-file findings) that a future sprint must resolve deliberately, one at a time, matching Sprint 6B's own proven discipline.
