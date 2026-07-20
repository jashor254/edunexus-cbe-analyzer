# EduNexus — ADR-0026

# Instructional Intelligence Framework (IIF)

## The Educational Philosophy Behind Adaptive Learning

### Design Only — No Code

**Depends on**

* ADR-0022 Adaptive Quiz Generation
* ADR-0023 Adaptive Readiness Determination (ARDS)
* ADR-0024 Canonical Curriculum Foundation
* ADR-0025 Adaptive Assessment Transformation Engine
* Sprint 5A Adaptive Question Transformation Engine

---

# Purpose

This ADR defines the educational philosophy that governs every adaptive learning decision in EduNexus.

It is intentionally independent of any AI model.

Large Language Models may change.

Instructional Intelligence must not.

This document becomes the permanent educational contract every adaptive engine follows.

---

# Foundational Principle

> Adapt the instructional journey.
>
> Never adapt the curriculum destination.

Every learner works toward the same

Grade

↓

Learning Area

↓

Strand

↓

Sub-strand

↓

Learning Outcome.

Only the instructional pathway changes.

Never the destination.

---

# Second Principle

Adaptive learning is not easier learning.

Adaptive learning is appropriately supported learning.

Support exists to increase understanding.

Support never lowers educational expectations.

---

# Third Principle

Instruction precedes assessment.

The purpose of adaptive assessment is not merely to measure.

It is to teach while measuring.

Every adaptive question should leave the learner knowing more than before attempting it.

---

# Instructional Readiness Levels

These are educational levels.

Not intelligence levels.

Not ability labels.

Not permanent learner identities.

They represent today's instructional readiness only.

A learner may move between levels at any time as new evidence arrives.

---

# Level 1 — Foundation

Educational Purpose

Reduce unnecessary cognitive load.

Increase confidence.

Build prerequisite understanding.

Instructional Characteristics

Simple language.

One reasoning pathway.

Concrete contexts.

Worked hints.

Visual support where appropriate.

Reduced abstraction.

One decision at a time.

Allowed Transformations

Shorter stems.

Simplified wording.

Scaffolded reasoning.

Prompting questions.

Guided examples.

Context familiar to learner.

Never Allowed

Different curriculum objective.

Reduced assessment standard.

Future-grade content.

Different mark allocation.

Multiple gradable questions replacing one canonical question.

Removing essential reasoning.

---

# Level 2 — Supported Practice

Educational Purpose

Develop independence while maintaining structured support.

Instructional Characteristics

Moderate scaffolding.

Less prompting.

Longer reasoning chain.

Familiar academic language.

Hints available but reduced.

Learner expected to connect ideas.

Allowed Transformations

Reduced hints.

Moderate abstraction.

Application inside familiar situations.

Fewer worked examples.

---

# Level 3 — Independent

Educational Purpose

Confirm secure understanding.

Instructional Characteristics

Canonical assessment.

Minimal support.

Normal curriculum language.

Expected independent reasoning.

Questions remain very close to teacher-authored canonical assessment.

Canonical Question becomes the instructional reference.

---

# Level 4 — Extension

Educational Purpose

Promote transfer of learning.

Deep reasoning.

Application.

Generalisation.

Instructional Characteristics

Multi-step reasoning.

Novel contexts.

Comparative thinking.

Evaluation.

Real-world application.

Transfer between ideas already taught.

Allowed

Authentic scenarios.

Multi-concept reasoning.

Higher-order thinking.

Realistic situations.

Never

Future-grade curriculum.

New curriculum objectives.

Unapproved enrichment.

Content outside teacher-selected scope.

---

# Cognitive Load Framework

Adaptive transformation changes instructional load.

Not curriculum scope.

Manage only

Reading complexity

Reasoning chain

Working memory

Hint frequency

Representation

Context familiarity

Visual support

Example availability

Never change

Learning outcome

Correct concept

Assessment objective

Curriculum alignment

---

# Bloom's Taxonomy Alignment

Level 1

Remember

Understand

Simple Apply

Level 2

Understand

Apply

Beginning Analysis

Level 3

Apply

Analysis

Curriculum-standard reasoning

Level 4

Analysis

Evaluation

Transfer

Creation only where curriculum explicitly expects it.

Bloom is guidance.

Curriculum remains authority.

---

# Misconception Framework

Every curriculum node may eventually define

Typical misconceptions

Common learner errors

Instructional responses

Hint strategies

Alternative explanations

Visual supports

Adaptive transformation should prefer these human-authored instructional assets.

AI must never invent misconceptions.

---

# Instructional Transformation Dimensions

AI may adapt only these dimensions.

Vocabulary

Sentence complexity

Number of reasoning steps

Amount of scaffolding

Hint frequency

Context familiarity

Representation

Worked examples

Question framing

Illustrations

Examples

Order of information

Nothing outside this list changes automatically.

---

# Teacher Authority

Teacher remains the instructional owner.

Teacher decides

Canonical assessment

Learning objective

Publication

Approval

Regeneration

Acceptance

Rejection

AI recommends.

Teacher authorises.

---

# AI Responsibilities

AI may

Simplify wording.

Increase scaffolding.

Increase challenge.

Generate examples.

Generate hints.

Suggest distractors.

Generate explanations.

Improve clarity.

AI may never

Invent curriculum.

Lower standards.

Change assessment objective.

Change correct concept.

Change marks.

Override teacher approval.

Self-publish.

Invent learner evidence.

Change historical records.

---

# Educational Integrity Rules

Every learner deserves

The same curriculum.

The same opportunity.

The same assessment standard.

Different instructional support.

Nothing else.

---

# Fairness Principles

Adaptive learning must never become

Ability tracking.

Permanent streaming.

Labelling.

Expectation lowering.

Self-fulfilling prediction.

Readiness is temporary.

Potential is unlimited.

---

# Confidence Principle

Instructional precision depends on evidence quality.

Low confidence

Use broader support.

High confidence

Allow finer adaptation.

The platform never pretends to know more than evidence justifies.

This principle is inherited directly from ADR-0023 (ARDS).

---

# Continuous Learning Principle

Every completed assessment

↓

Evidence

↓

Projection

↓

Instruction

↓

New assessment

↓

New evidence

Adaptive learning is a continuous educational cycle.

Never a one-time classification.

---

# Explainability

Every adaptive recommendation should be explainable.

Teacher should understand

Why support increased.

Why challenge increased.

What evidence supported the decision.

Which curriculum node was used.

Which instructional strategy changed.

No adaptive decision should become a black box.

---

# Future Extensions

This framework should support

Homework

Revision

Practice

Holiday learning

Learning Compass

Career readiness

Parent guidance

Teacher planning

without changing its educational philosophy.

---

# Educational Invariants

These principles must remain true forever.

✓ Curriculum never changes.

✓ Learning outcomes never change.

✓ Canonical assessment remains authoritative.

✓ AI transforms instruction.

✓ Teacher remains final authority.

✓ Evidence drives adaptation.

✓ Confidence limits precision.

✓ Learning history is immutable.

✓ Instruction evolves.

Never history.

---

# Exit Criteria

ADR-0026 succeeds only if

Every future adaptive feature can reference this document instead of inventing its own instructional philosophy.

No adaptive engine independently defines difficulty.

No AI prompt independently defines pedagogy.

Every instructional decision is traceable to these principles.

---

# Final Recommendation

GO

This ADR should become the constitutional document for every adaptive learning capability built inside EduNexus.

Future ADRs should reference ADR-0026 instead of redefining educational philosophy.

It becomes the educational foundation upon which all adaptive intelligence is built.

Design only.

No code.

No migrations.

No implementation.

---

---

# Reconciliation Addendum — checked against Sprints 4A/4A.1/4B/4C/5A, not accepted at face value

Filed alongside the ADR as-authored above (unmodified). This addendum records the consistency pass every other document in this series has gotten before being treated as settled — same discipline, applied to this one too, even though it arrived with its own "GO" already attached.

**Naming, resolved definitively.** This ADR uses `Level 2 — Supported Practice` and `Level 3 — Independent` — matching Sprint 4B's actual stored `variant_type` enum (`foundation` / `supported_practice` / `extension`) and ADR-0025's original four-tier language exactly. Sprint 5A's document introduced "Core" as an alternate name for `supported_practice` in its own Executive Summary. **ADR-0026 is the constitutional authority; "Core" is superseded terminology as of this document.** Every future document in this series should say `Supported Practice` and `Independent`, not `Core`. (Sprint 5A's file has been annotated with a pointer to this resolution — see below.)

**Direct confirmation, not just compatibility, of Sprint 5A's most load-bearing structural rule.** This ADR's Level 1 "Never Allowed" list includes, verbatim in spirit: *"Multiple gradable questions replacing one canonical question."* This is exactly Sprint 5A §3's structural constraint (`gradeQuiz()`'s uniform per-question mark allocation means scaffolding must live inside one question's stem, never by splitting it into several graded rows) — independently arrived at from reading the actual grading code, now independently restated here as educational philosophy. The two documents agree because the constraint is real, not because one copied the other.

**A genuine, worth-tracking tension, not a contradiction.** This ADR's Misconception Framework states: *"AI must never invent misconceptions"* and that transformation *"should prefer human-authored instructional assets"* — implying a curriculum-node-level bank of pre-authored misconceptions, hint strategies, and alternative explanations. **No such bank exists anywhere in the schema today** — confirmed against every curriculum table audited across this entire series (`sow_strands`, `sow_substrands`, `sow_learning_outcomes` carry no misconception data). Sprint 5A's design, as written, has the AI generate `expected_misconceptions` per variant at transformation time — which is the only option available *until* such a human-authored bank exists, but is in real tension with "AI must never invent misconceptions" if read strictly. Recorded here rather than silently reconciled: **Sprint 5A's AI-generated `expected_misconceptions` field should be treated as a stopgap, explicitly inferior to a future human-authored misconception bank, not as this ADR's endorsed steady state.** Building that bank is out of scope for this ADR and every prior sprint in this series — it is named here as a real, tracked gap between the philosophy and what's buildable today, not resolved.

**Everything else checked, no conflicts found**: the Confidence Principle's low/high-confidence gating matches ARDS's (ADR-0023) own Precision Level design exactly, unmodified by anything built so far (ARDS remains unbuilt — this ADR doesn't change that status, it only confirms the eventual integration point). The Continuous Learning Principle's cycle diagram matches the Canonical Relationship Audit chain verified in Sprint 4B §1 and Sprint 4C §1 verbatim. The Fairness Principles ("never ability tracking... labelling") match `neutralGroupLabel`'s existing, already-shipped discipline (`lib/adaptiveLearning/recommend.ts` — internal taxonomy names never reach a learner) exactly, confirming this ADR describes a philosophy already partially *lived* in shipped code, not only aspired to.

**Recommendation on the reconciliation pass: confirmed GO**, concurring with the ADR's own stated recommendation — independently verified, not rubber-stamped.
