# EduNexus — ADR-0028

# Learning Intelligence Reasoning Engine (LIRE)

## Constitutional Architecture Document — Design & Audit Only, No Code, No Migrations

**Depends on**: ADR-0022, ADR-0023 (ARDS), ADR-0024 (Canonical Curriculum Foundation), ADR-0025 (AATE), ADR-0026 (IIF), ADR-0027 (IKL), Sprint 4A→4C, Sprint 5A.

**Method note**: every claim below was checked against the live repository — file paths, line-level behavior, and actual caller graphs (`grep` across the full tree, not the design documents' own descriptions of themselves) — including two places where this correction actually **overturns a claim a prior ADR in this same series made**. Those are called out explicitly, not smoothed over.

---

## Executive Summary

**A reasoning engine does not exist today, implicitly or otherwise — but three of its future components already do, in isolation, none adopted by the others.** The audit's first and most important finding is a pattern, confirmed three separate times: this codebase repeatedly builds well-shaped, deterministic infrastructure for exactly this kind of problem, and then nothing ever calls it.

1. `lib/ai-orchestration/router.ts::routedCompletion` — a real, working, mode-aware, cost-tracked, multi-provider AI routing function — **has zero callers anywhere in this repository.** Every one of the 17 live AI-call sites found in this audit calls `lib/ai/deepseek.ts::callDeepSeek` directly instead.
2. `kicd_curriculum_lessons` (a table) and `sow_strands.kicd_data`/`sow_learning_areas.kicd_subject_data` (jsonb columns) — confirmed by ADR-0027 to be empty and unread, respectively.
3. (Named again here, not re-derived): ADR-0022/0023's own instructional variant concepts remain 100% unimplemented after five design sprints (4A→4C, 5A) building toward them.

**LIRE's central risk is becoming a fourth entry in this list.** Every design decision below is shaped by that fact, and the Final Recommendation (§13) makes real adoption — not just a correct design — a non-negotiable exit condition.

**Second finding, of a different kind**: reasoning is not merely "not yet centralized" — it is **actively duplicated** in one confirmed, concrete place. `lib/remedial/planner.ts` (a live, shipped feature) maintains its own independent gap-severity classification logic (`StudentData`, raw marks-based) alongside a *partial*, bolted-on use of `recomputeLearnerProjection()` (used only to override the "critical" gate, not the primary classification) — while `lib/adaptiveLearning/recommend.ts::classifyGroup()` (Phase 3, curriculum-aware, the canonical Recommendation layer this whole ADR-0025→5A series is built on) does the conceptually identical job for a different feature, fully. Two independently-maintained "which severity band is this learner in" implementations exist in production right now, not in design documents.

**Third finding**: an existing claim in ADR-0023 is only partially correct, and this document corrects it because it is directly load-bearing for §5's confidence-degradation design. ADR-0023 states Projection's confidence computation applies no contradiction penalty. **This is now false** — `lib/projection/coverage.ts::computeProjectionConfidence()` already halves confidence when any supporting evidence carries `verification_state === 'contradicted'`. Trust-weighting-by-source and recency-decay are still genuinely absent, confirmed — but the contradiction penalty is real, live, and shared by every projector today.

**Recommendation: CONDITIONAL GO** — see §13.

---

## 1. The Six Audit Questions — Answered Directly

### Does a reasoning engine already exist implicitly across multiple services?

**No single one — but fragments of every layer it would need already exist, unconnected.** Evidence confidence (`lib/intelligence/confidence.ts::computeConfidence`, evidence-row-scoped, applied at ingestion) and Projection confidence (`lib/projection/coverage.ts::computeProjectionConfidence`, projection-scoped, aggregating evidence) are two distinct, correctly-separated deterministic layers — not a duplicate of each other, a genuine two-stage confidence pipeline that already exists. Curriculum anchoring (`resolveCurriculumContext`) exists and is reused correctly by every canonical-curriculum-aware consumer (Projection's `bySubStrand`, Recommendation's `academicGrain`, and every Sprint 4B/4C/5A design). Model routing/fallback exists twice, redundantly (see Executive Summary, finding 1). What's missing is the thing that would make these fragments "a reasoning engine": one canonical **order** in which they're consulted, and one canonical **gate** deciding whether an AI call is even allowed to happen yet.

### Where are reasoning rules duplicated?

**Confirmed, concretely, in one place**: `lib/remedial/planner.ts`'s inline gap-severity classification vs `lib/adaptiveLearning/recommend.ts::classifyGroup()`. Both answer "how severe is this learner's gap," independently coded, reading overlapping-but-different inputs (raw marks + legacy `learner_profiles` vs Projection alone). **Not confirmed, but structurally likely and named as an open item**: `lib/career/careerEngine.ts`, `lib/career/careerIntelligenceEngine.ts`, and `lib/career/matchEngine.ts` all live in the same domain folder and all touch career reasoning — whether they duplicate a capability/readiness judgment among themselves was not traced line-by-line in this pass (scope discipline — see §12) and should be a named follow-on audit item, not asserted here as either duplicated or clean.

### Where are AI calls made without deterministic grounding?

Of the 17 files calling `callDeepSeek`/`callGemini`/`streamDeepSeek` directly (confirmed by direct grep, not inferred): only **four** demonstrably call `recomputeLearnerProjection`, `resolveCurriculumContext`/`CurriculumService`, or `recommendForClass` themselves — `lib/career/careerEngine.ts`, `lib/career/careerIntelligenceEngine.ts`, `lib/holiday/planner.ts`, `lib/remedial/planner.ts` (the last one only partially, per the duplication finding above). `lib/sow/aiLessonGenerator.ts` grounds itself in curriculum (KICD context) but **not** in learner evidence/readiness — a real, different, and legitimate axis (a lesson plan is curriculum-grounded by design, not learner-grounded), named here so it isn't miscounted as "ungrounded." The remaining eleven — `lib/academy/aiJudge.ts`, `lib/lessonPlan/generator.ts`, `lib/teachingIntelligence/weeklyGenerator.ts`, `quickCheckGenerator.ts`, `rootCauseClassifier.ts`, `lib/career/autoReportGenerator.ts`, `lib/studyGroups/challengeGenerator.ts`, `lib/slides/aiSlideGenerator.ts`, `lib/kiswahili/inshaEvaluator.ts`, `lib/career/matchEngine.ts` — show **zero** direct reference to any deterministic grounding function at the generation-call layer itself. This does not prove they are ungrounded (a caller several layers up could resolve and pass grounding data in as plain arguments, which this grep-based pass cannot see) — it proves **grounding, where it exists at all today, is not consistently wired at one auditable layer**, which is itself the exact problem LIRE exists to fix, independent of how many of those eleven turn out to already be grounded once traced individually.

### Which services already satisfy parts of the reasoning pipeline?

| Stage | Service | Status |
|---|---|---|
| Evidence provenance + confidence | `lib/intelligence/evidenceLifecycle.ts`, `lib/intelligence/confidence.ts` | **Live, correct, reusable as-is** |
| Curriculum-linked readiness | `lib/projection/recompute.ts` + `academicProjector.ts` (`bySubject`/`bySubStrand`) | **Live, correct, reusable as-is** — including the just-corrected contradiction-penalty behavior (§Executive Summary) |
| Curriculum anchoring | `lib/curriculum/curriculumContext.ts`, `CurriculumService` | **Live, correct, reusable as-is** |
| Instructional banding | `lib/adaptiveLearning/recommend.ts::classifyGroup`/`buildAdaptiveTask` | **Live, correct, curriculum-aware (Phase 3), reusable as-is** |
| Precision/confidence gating before fine-grained generation | ARDS (ADR-0023) | **Not built.** Recommendation's own `academicGrain` fallback (subject-level when sub-strand evidence doesn't exist) is the only live analog, and it is a binary fallback, not ARDS's proposed continuous Precision Level/Confidence pair |
| Instructional transformation rules | ADR-0026 (IIF) | **Philosophy only, not enforced by any code path** — genuinely correct as written (§ prior reconciliation), but nothing today checks a generated variant against it, because nothing generates variants yet |
| Human-authored pedagogy | ADR-0027 (IKL) | **Design only, no rows exist** |
| Model routing/fallback | `lib/ai/deepseek.ts` (used) + `lib/ai-orchestration/router.ts` (unused) | **Duplicated, one path adopted, one dormant** |

### Which components should become reasoning stages rather than independent systems?

`lib/remedial/planner.ts`'s classification logic should be retired in favor of calling `classifyGroup()` directly — not reimplemented as a "stage," **replaced**, since a second implementation of the same judgment is exactly the duplication this document exists to name and end. `lib/ai-orchestration/router.ts` should become **the** stage every AI call in LIRE routes through (assuming its dormancy is a wiring gap, not a rejected design — confirmed nothing in its own code is wrong, it is simply unconnected) rather than building a third provider-routing mechanism. Everything else in §1's "already satisfy parts of the pipeline" table already has the right shape to become a stage without modification — this is a wiring problem, not a redesign problem, for four of the six rows.

### Which architectural boundaries must never be crossed by AI?

Restated, not re-derived, from what this series has already committed to and verified against real code:
- AI never computes learner readiness (Projection's job, `recomputeLearnerProjection`, exclusive).
- AI never determines whether evidence is sufficient for fine-grained precision (ARDS's job, once built; until then, the honest binary fallback already in `recommend.ts` is the ceiling — no AI call may claim finer precision than that fallback allows).
- AI never resolves curriculum identity (`resolveCurriculumContext` is the only path; confirmed zero AI call site in this codebase invents a strand/sub-strand name).
- AI never mutates `learner_evidence` directly (`evidenceLifecycle.ts`'s four sanctioned functions are the only write path, DB-trigger-enforced).
- AI never self-approves generated instructional content (ADR-0025/Sprint 4B's teacher-approval gate, once built).
- AI never invents a misconception (ADR-0026/0027) — until IKL exists, this is a stated principle with no enforcement mechanism yet, an honest gap, not a solved one.

---

## 2. Canonical Reasoning Order

```
1. Evidence           — confirmed learner_evidence only (never pending/rejected)
2. Projection          — recomputeLearnerProjection() — the ONLY read path into
                         "what does this learner currently know" — deterministic
3. Curriculum Anchor    — resolveCurriculumContext()/CurriculumService — the ONLY
                         read path into "which real Strand/Sub-strand/Learning
                         Outcome" — deterministic
4. Recommendation      — recommendForClass()/classifyGroup() — the ONLY read
                         path into "which instructional band" — deterministic,
                         consumes stages 2+3 exactly as they exist, computes
                         neither independently
5. Precision Gate       — ARDS, once built — the ONLY point permitted to decide
                         "how much fine-grained confidence is this deserving of
                         right now" — until built, gate defaults to Recommendation's
                         own academicGrain fallback (subject-level ceiling)
6. Instructional Knowledge Lookup — IKL, once built — approved Misconceptions/
                         Scaffolding for this curriculum node + band, read-only
7. AI Transformation    — the ONLY stage permitted to call a language model —
                         receives stages 1-6's output as immutable context,
                         produces a proposal, never a decision
8. Teacher Approval     — the ONLY stage permitted to make a generated proposal
                         real/servable
9. Evidence (again)     — a learner's completed work re-enters at stage 1,
                         closing the cycle (ADR-0026's Continuous Learning
                         Principle, already verified against the real
                         Evidence→Projection→Recommendation chain in Sprint 4B/4C)
```

**No stage may be skipped, and no stage may compute what an earlier stage already owns.** This is not a new rule invented for LIRE — it is the exact discipline every one of ADR-0024 through Sprint 5A already followed individually; LIRE's contribution is making the *order* itself a checkable, named artifact rather than an implicit convention each sprint had to independently re-derive (as this document's own §1 findings show happened inconsistently across the 17 live AI call sites).

---

## 3. Mandatory Deterministic Inputs Before Any AI Call

An AI call under LIRE is **structurally invalid** — not merely discouraged — without all of the following already resolved and passed in as immutable context:

1. A `learnerId` with at least one piece of **confirmed** Evidence (or an explicit, honest `insufficient_data` state — never a silent empty-context call).
2. A resolved `CurriculumContext` (or an explicit, honest "no sub-strand assigned" notice — matching `buildAdaptiveTask`'s existing `curriculumNotice` pattern, reused, not reinvented).
3. A `groupType`/band from Recommendation (never computed by the AI call site itself).
4. A precision ceiling from stage 5 (ARDS's eventual output, or the existing `academicGrain` fallback in the interim).

If any of 1–4 is unavailable, the correct behavior is the same graceful, honest degradation this entire series already practices (`insufficientEvidenceInsight`, `curriculumNotice`, `academicGrain: 'subject'`) — never a fabricated substitute.

---

## 4. Confidence-Aware Degradation Rules

Reuses the corrected finding from the Executive Summary directly: Projection's confidence already degrades on contradiction (halved) and on thin coverage (count factor, reaching 1.0 only at 3+ corroborating pieces of evidence) — **LIRE does not need to invent a new confidence formula, it needs to make consulting the existing one mandatory before stage 7.** Concretely: low Projection confidence (or, once ARDS exists, a low ARDS Confidence within a given Precision Level) must widen the instructional band's tolerance — e.g., prefer the `academicGrain: 'subject'` fallback over a thin, low-confidence `subStrand` reading, exactly mirroring `resolveAcademicSignal()`'s existing unconditional-fallback logic in `recommend.ts` (Phase 3, this session) rather than a new threshold LIRE would have to invent and justify from scratch.

---

## 5. Curriculum Anchoring Requirements

Restated as a hard LIRE invariant, not re-derived: every stage-7 AI call must carry the exact `sub_strand_id`/`learning_outcome` pair Recommendation resolved at stage 3, verbatim — never a second resolution, never a model-invented substitute. This is the same rule ADR-0025 §4 and Sprint 5A §4 already committed to structurally (a variant's curriculum fields are copied from the assignment's own resolution, no alternate path exists) — LIRE's job is to make this the rule for **every future AI consumer**, not just the ones this specific series already designed.

---

## 6. Evidence Provenance

Confirmed unchanged from every prior sprint's own finding: Evidence's schema (`learner_evidence`) needs and gets **zero new fields** from any layer of this reasoning pipeline (Sprint 4C §6 already established this for variant grading specifically; the same reasoning holds generally — provenance of *why an AI call happened* belongs to the reasoning pipeline's own logs/context, not to the Evidence domain, which only ever needs to know a score happened, from what source, at what trust tier).

---

## 7. Explainability Requirements

Every stage-7 output must be traceable back through stages 1–6 in one render pass — literally the same chain ADR-0026's own Explainability section already specifies (why support increased, what evidence supported it, which curriculum node was used) and the same chain Sprint 4B/4C's `served_variant_map` + `resolved_band` design already makes concretely queryable. LIRE adds no new explainability mechanism; it requires that every future AI consumer produce the same chain these two already do, instead of each inventing its own explanation format.

---

## 8. Transformation Boundaries

Identical to ADR-0025/ADR-0026's already-established rule, generalized beyond assessment content: AI may change *how* something is presented (wording, scaffolding, representation, sequencing) and must never change *what* it is measuring or teaching (the curriculum node, the learning outcome, the correct concept). This is not new to LIRE — it is the one rule every document in this series has independently arrived at from a different angle (grading mechanics in Sprint 5A, philosophy in ADR-0026, curriculum integrity in ADR-0024) — LIRE's role is naming it once, centrally, so a twelfth future ADR doesn't have to re-derive it a sixth time.

---

## 9. AI Safety Invariants

Restated as the fixed, non-negotiable list every stage-7 call must satisfy, drawn from this document's own §1 boundary list: never computes readiness, never determines evidence sufficiency, never resolves curriculum identity, never mutates Evidence, never self-approves, never invents a misconception without flagging it as an unreviewed proposal. Each of these already has a real enforcement mechanism named somewhere in this series (DB triggers for Evidence immutability, the teacher-approval state machine for self-publishing, the graceful-fallback pattern for curriculum/precision) — LIRE's job is requiring every future AI consumer to use the *existing* mechanism, not invent a seventh.

---

## 10. Model Independence

**Already effectively solved, unadopted.** `lib/ai-orchestration/router.ts::routedCompletion` already provides mode-aware provider chains (`fast`/`quality`/`standard`), health-aware fallback, and cost tracking — exactly what "model independence" requires. **LIRE's model-independence requirement is: route every stage-7 call through this existing function, and delete or explicitly retire the redundant path** (`callDeepSeek`'s own internal Gemini fallback, currently duplicating what the router's chain already does one layer up) rather than maintaining two provider-fallback mechanisms indefinitely. This is the cheapest, most concrete win available in this entire audit — the infrastructure exists, is correct, and needs zero new design, only a wiring decision.

---

## 11. Extension Points for Future Instructional Capabilities

Because stages 1–6 are already general-purpose (Evidence/Projection/Curriculum/Recommendation don't know or care whether their consumer is a quiz variant, a Learning Compass hint, or a future essay-marking feature), a new instructional capability extends LIRE by adding a new stage-7 consumer only — never a new stage 1–6. This is the concrete mechanism behind ADR-0026's own "Future Extensions... without changing its educational philosophy" claim and ADR-0027's §13 — LIRE is what makes that claim mechanically true rather than aspirational.

---

## 12. Scope Discipline — What This Audit Did Not Do

In the interest of an honest, verifiable document rather than a padded one: the career-domain trio (`careerEngine.ts`/`careerIntelligenceEngine.ts`/`matchEngine.ts`) was not traced line-by-line for internal duplication (§1's answer to "where are rules duplicated" names this as an open item, not a finding). The eleven ungrounded-at-the-generator-layer AI call sites were not individually traced up their full caller chains to confirm whether a caller grounds them indirectly — this would require reading roughly a dozen additional files in full and was judged out of scope for a constitutional-level document whose job is to establish the *rule*, not audit every existing violation of it exhaustively. Both are named, explicitly, as real follow-on work — not silently assumed clean.

---

## 13. Final Recommendation

**CONDITIONAL GO.**

The design itself (§2–§11) requires no new invention — every stage LIRE names already has a correct, deterministic, reusable implementation somewhere in this codebase, confirmed by direct reading, not by trusting the prior ADRs' own descriptions of themselves (and in one case, ARDS's confidence-formula claim, correcting them). LIRE's actual job is naming the canonical order and making adoption of the existing pieces mandatory, not building new reasoning machinery.

**Conditions, all aimed at the one real risk this audit surfaced three times over**:

1. **LIRE must not become a fourth entry in the "well-built, never-adopted" list** (`routedCompletion`, `kicd_curriculum_lessons`, `kicd_data`). The first real implementation step following this ADR must be **retiring `lib/remedial/planner.ts`'s duplicate classification in favor of `classifyGroup()`**, and **wiring at least one live AI call site through `routedCompletion`** — not a new design document, an actual migration of existing, already-shipped code. If the next artifact in this series is another design-only ADR rather than one of these two concrete migrations, treat that as the pattern repeating, not progressing.
2. **The corrected ARDS confidence claim (Executive Summary, §1) must be carried forward into ADR-0023 itself** the next time that document is touched — it currently asserts something the repository no longer supports, and this series has held every other document to "verified against the repo, not assumed" rigor; ARDS should not be the one exception left uncorrected.
3. **The career-domain duplication question (§12) must be resolved by actually reading those three files**, not left open indefinitely — named here as a real, bounded follow-on audit, not a permanent asterisk.
4. **`lib/ai-orchestration/router.ts` and `lib/ai/deepseek.ts`'s internal fallback must not both persist long-term** — one is redundant with the other; this document recommends keeping the router (mode-awareness + cost tracking are real capabilities `callDeepSeek`'s internal fallback doesn't have) and retiring the duplicate path, but the decision itself, and its execution, is out of this design-only document's scope.

With these four conditions treated as real commitments rather than aspirational footnotes, LIRE is architecturally sound as the single foundation for every future educational AI capability this platform builds — the gap between "sound design" and "actually the foundation" is entirely a wiring and migration gap, not a missing idea.
