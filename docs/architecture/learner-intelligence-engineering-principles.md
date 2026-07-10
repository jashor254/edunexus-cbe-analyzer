# Learner Intelligence Engineering Principles

Status: DRAFT — proposed, not yet ratified.

This document sits beneath [The EduNexus Engineering Constitution](../engineering-constitution.md)
and alongside [Architectural Principles](architectural-principles.md). It
does not introduce new values — every rule below is a translation of a
value the Constitution already holds into a concrete, checkable
engineering rule specific to learner intelligence: how evidence becomes
insight, how engines interact, and what a future developer must never do.

Each principle states: the Constitutional value it derives from, the
concrete rule, and — where this session's architecture audits found
one — the live gap in the current system that makes the rule necessary,
not hypothetical.

---

## LI-1 — There Is Exactly One Learner Intelligence Engine

**Derives from**: Constitution Principle 11 (Boundaries Over Coupling),
`architectural-principles.md` P1 (One Source of Truth Per Domain).

**Rule**: A learner's capability, risk, engagement, and knowledge state
live in exactly one place. Every module that produces an insight about a
learner — Blueprint, Career Intelligence, Compass, Attention Feed, Holiday
Planner, future modules — reads that one place. No module computes its
own parallel version of a concept another module already owns.

**Concretely**: `lib/learnerModel` is that one place today. A new feature
that needs to know a learner's capability level calls into
`lib/learnerModel`, it does not write a second computation.

**Live gap this closes**: `lib/career/capabilityExtractor.ts:extractCapabilityProfile`
computes a capability profile independently of `lib/learnerModel/updater.ts`'s
own capability-dimension patching — two separate, divergence-prone
computations of the same concept, found in this session's audit. This
rule doesn't fix that today; it makes it a named violation for whoever
reconciles it.

**Enforcement**: a PR that adds a new capability/risk/mastery computation
outside `lib/learnerModel` requires an explicit justification in the PR
description for why the existing engine cannot express it, reviewed the
same way Constitution 3.2 requires an ADR for a new service boundary.

---

## LI-2 — Every Insight Carries Observation, Evidence, Confidence, and Action

**Derives from**: Constitution line 78 (AI confidence must be honest) and
Principle 5 (Evidence Before Intuition), extended from engineering
decisions to product output.

**Rule**: any function that produces a learner-facing or teacher-facing
insight — a risk flag, a pathway recommendation, a Blueprint statement, a
Career Intelligence match — returns a value shaped to carry all four:
what is being observed, the specific evidence behind it, a confidence
level, and a recommended action. A bare sentence with no evidence
attached is not a valid insight-producing function's return type.

**Concretely**: this should be a shared type in `lib/learnerModel/types.ts`
(or a new `lib/intelligence/evidence.ts`), not a convention each module
reimplements. `RiskFlag`, `CareerSignals`, and similar existing types
should converge on this shape rather than each defining their own ad hoc
version of "here's a claim."

**Live gap this closes**: no shared type like this exists today —
Blueprint's evidence-first structure (Observation/Evidence/Confidence/Action)
was designed correctly but implemented as free-form logic inside
`blueprint.ts`, not as a reusable contract other modules inherit for free.

---

## LI-3 — AI-Inferred State Is Confidence-Tagged Separately From Human-Verified State

**Derives from**: Constitution line 78 (confidence must be honest), 6.4
(human review is mandatory), extended to a case the Constitution didn't
explicitly name.

**Rule**: when the Learner Model is updated from an AI's own judgment
about a learner (Compass's `genuine_progress` eval, an AI-generated
extraction from an imported document) versus a human's direct
assessment (a teacher-entered mark, a teacher-confirmed observation), the
resulting `learner_profiles` entry — or its future Core equivalent —
records which kind it was. Downstream consumers (Blueprint, Career
Intelligence) must be able to weight or disclose that distinction; they
must never present an AI inference with the same unqualified confidence
as a teacher-verified fact.

**Live gap this closes**: traced this session — `updateFromCompass`
writes `knowledge_state` entries from the AI's own in-chat judgment with
no field distinguishing them from teacher-entered assessment data. This
is a concrete, currently-live instance of the exact failure the
Constitution's "confidence must be honest" line warns against.

---

## LI-4 — Human Review Applies to Interpreted Data, Not Just Generated Content

**Derives from**: Constitution 6.4 (Human Review is Mandatory), extended
from "AI-generated content" to "AI-interpreted input."

**Rule**: 6.4 already requires human review before AI-generated lesson
plans, schemes of work, and learner reports reach a screen. This
principle states the parallel case explicitly: when an automated process
*interprets* external data on a learner's behalf — OCR-read marks from a
photographed report card, a fuzzy-matched student identity, an inferred
subject mapping — and that interpretation falls below a defined
confidence threshold, it is held for human review before it becomes
Learner Model input, exactly as 6.4 already requires for generated
content.

**Live gap this closes**: this session's ingestion audit found zero
confidence scoring and zero human-review staging anywhere in the current
import paths — every import writes immediately. The Intelligence
Ingestion Engine design (`intelligence-ingestion-engine.md`) exists
specifically to close this; this principle is what makes closing it
mandatory rather than optional scope.

---

## LI-5 — Evidence Is Traceable From Insight Back to Source

**Derives from**: Constitution Principle 13 (Data Integrity is Sacred),
Principle 21 (Logging Is Observability Infrastructure), applied to
learner evidence specifically.

**Rule**: if Blueprint states a conclusion, it must be possible to trace
that statement back to the specific evidence record(s) that produced it
— not to "the assessment table in general," to specific rows with
timestamps and sources. This requires the Learner Model's write path to
carry evidence identifiers forward alongside the derived state it
computes, not just the derived state itself.

**Live gap this closes**: `learner_profiles.formative_signals` and
`growth_milestones` currently store already-derived snapshots, not
references to the evidence that produced them (found in
`intelligence-ingestion-engine.md` §6). Satisfying this principle is new
work in `lib/learnerModel/updater.ts`, not a byproduct of building an
Evidence Store.

---

## LI-6 — Evidence Quality Gates Are Explicit, Not Implicit

**Derives from**: Constitution 4.4 (When to Say No) and 1.5 (Educational
Correctness Over Technical Elegance).

**Rule**: not every evidence source is equally trustworthy, and the
system must say so out loud rather than silently treating a parent
self-report the same as a teacher-verified assessment. Each
`evidenceSource` (per `intelligence-ingestion-engine.md` §2) has a
declared trust tier. Insight-producing modules may define a minimum
trust tier required before a claim of a given strength is made (e.g.,
Career Intelligence's pathway readiness scoring for Senior School
students — a higher-stakes claim — should require a higher evidence bar
than a Junior School broad-interest exploration).

**Live gap this closes**: this session's audit found Blueprint and
Clinic Report's actual production data source is overwhelmingly a
parent-facing self-report form, with no teacher-verification step and no
tier distinction — the flagship evidence-first report is, in practice,
running on the lowest-trust evidence tier available, unflagged as such.

---

## LI-7 — No Engine Writes Another Engine's Owned State

**Derives from**: Constitution Principle 11 (Boundaries Over Coupling),
extended into a specific rule for the intelligence layer.

**Rule**: Compass may propose that a learner has made progress on a
topic; it does the writing into the Learner Model through
`updateFromCompass` — a defined interface — not by directly mutating
`learner_profiles` columns itself. The same applies to any future engine
(the Ingestion Engine included): every engine that wants to affect
learner state calls into `lib/learnerModel`'s public write functions,
never writes the underlying table directly.

**Live gap this closes**: none found — this is already how
`lib/learnerModel` is structured today (`patchKnowledgeState`,
`patchCapabilityDimensions`, etc. are the only write surface). Stated
here explicitly so it's a named rule new engines are held to, not an
accidental convention that erodes as more engines are added.

---

## LI-8 — Deletion and Retention Have Explicit Rules for Evidence

**Derives from**: Constitution Principle 24 (Privacy Is Proportionality).

**Rule**: every `LearnerEvidence` record's `rawInputRef` (§2 of the
Ingestion Engine doc) — the pointer back to an original photo, PDF, or
CSV row — has a defined retention period and deletion path. Raw input
artifacts are not kept indefinitely by default just because they support
traceability (LI-5); traceability requires the evidence *record*, not
permanent custody of the raw file behind it.

**Live gap this closes**: none found in the current system (there is no
raw-artifact retention today, since there's no ingestion of raw
artifacts at all) — this principle is preventative, written before the
gap can be created, rather than in response to one already existing.

---

## Summary — What Changed and What Didn't

**Unchanged**: the Constitution's values. Every principle above is a
derivation, not a departure — evidence before intuition, human review
before AI reaches a screen, one source of truth per domain, boundaries
over coupling. None of these needed to be invented; they needed to be
pointed at the learner intelligence layer specifically.

**New**: eight concrete, checkable rules that didn't exist as engineering
contracts before this document, several of which the architecture audits
this session found are **currently being violated** in production —
duplicated capability computation, unconfident-confidence Compass
writes, review-free imports, and a flagship evidence-first report
running on its lowest-trust evidence tier. This document doesn't fix any
of those; it names them as violations of principles the Constitution
already holds, so fixing them is a matter of enforcement, not
re-litigating whether they matter.
