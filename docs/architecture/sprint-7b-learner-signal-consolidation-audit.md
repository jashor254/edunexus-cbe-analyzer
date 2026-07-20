# Sprint 7B — Learner Signal Consolidation Audit

## Repository-Wide Inventory — Design Only, No Code, No Migrations

**Depends on**: ADR-0028, Sprint 6A, Sprint 6B, Sprint 7A. **Does not** redesign Projection, ARDS, Recommendation, or `EducationalAIContext` — every finding below is inventory and classification, not a proposed change to any of those four.

**Method note**: every signal below was traced to its actual source file and, where possible, its actual consumers — not inferred from a feature's name. Several findings correct or sharpen claims this series (and this project's own memory) had previously made in passing.

---

## Executive Summary

This platform does not have one legacy system running alongside one canonical system. It has **at least four independently-maintained "what do we know about this learner" architectures**, each with real, live consumers today, none of them fully aware of the others' scope:

1. **Evidence → Projection** (`learner_evidence` → `recomputeLearnerProjection`) — the canonical system every ADR in this series (0024–0028) is built on.
2. **The Permanent Learner Memory** (`learner_profiles`, `lib/learnerModel/`) — an older, still-actively-written, still-actively-read parallel state store (`KnowledgeState`, `CapabilityDimensions`, `RiskFlag`/`RiskLevel`, `PathwayReadiness`, `TermSnapshot`, and more), updated by `lib/learnerModel/updater.ts` ("The Intelligence Bridge") on **the same events** that now also feed Evidence — a confirmed, live dual-write, not a historical artifact.
3. **The Learner Record / Learner Blueprint** (`lib/learnerRecord/timeline.ts`, `lib/learnerIntelligence/blueprint.ts`) — itself named "the canonical Learner Record" in its own header comment, but built from a **third** combination: the Permanent Learner Memory + the career capability engine + the knowledge-graph prerequisite engine — not from Projection directly.
4. **`substrand_health`** (Sprint 7A finding, confirmed again here) — a class/sub-strand-level health signal read by `remedial/planner.ts` and `weeklyGenerator.ts`, computed independently of both Projection and the Permanent Learner Memory.

A fifth, narrower primitive — `lib/learningSignal/didLearningTakePlace.ts` — deliberately duplicates a piece of what Projection's `growth`/`trend` fields already compute (deltas between two timepoints), by its own explicit design ("graph-free... must NEVER import from `lib/knowledgeGraph`"), for reasons that may be legitimate (a universal, dependency-free primitive) but were not reconciled against Projection anywhere in the code.

**None of this is new corruption** — most of it predates the Evidence/Projection/Recommendation work this series has been building on, and several files' own comments show real, deliberate awareness of the overlap (`projectionAdapters.ts`'s "anti-corruption layer," `assessments/evidence.ts`'s explicit dual-write acknowledgment). But it means **`EducationalAIContext` (Sprint 7A) must not be assumed to be "the" learner signal just because it's the newest and best-documented one** — for several features, adopting it without reconciling against the Permanent Learner Memory or the Blueprint would produce a context that silently disagrees with what that same feature shows a teacher or parent elsewhere.

**Recommendation: CONDITIONAL GO** — the registry itself is complete and actionable; broad `EducationalAIContext` adoption is **not** yet safe for every feature named below. See §5.

---

## 1. The Canonical Learner Signal Registry

### Tier 1 — Canonical (Evidence-sourced, this series' own foundation)

| Signal | Computed | Persisted | Consumers | Duplicates? | Authoritative/Advisory | In `EducationalAIContext`? | Classification |
|---|---|---|---|---|---|---|---|
| `learner_evidence` | Ingestion producers (quiz, assessments, Compass, formative signals) | Yes, immutable, trigger-enforced | Every projector | No — the one source everything else should derive from | **Authoritative** | Indirectly (`supportingEvidenceIds`) | **Canonical** |
| Projection (`academic`, `capability`, `knowledge`, `behaviour`, `growth`, `risk`, `completeness`) | `recomputeLearnerProjection()`, zero caching | Persisted (`learner_projections`), recomputed on every call | Recommendation, Career (via adapter), Holiday Planner, Parent Pulse (partially), Remedial Planner (post-6A) | No | **Authoritative** for readiness/level/risk | **Yes** — `EducationalAIContext.band`/`academicGrain` derive from it | **Canonical** |
| Recommendation (`classifyGroup`/`buildAdaptiveTask`) | Pure, from Projection | Not persisted itself (class-level `DifferentiationPlan` is, via `differentiation.ts`) | Holiday Planner, Remedial Planner (post-6A), `EducationalAIContext` | No (post-6A; was duplicated by `remedial/planner.ts` pre-Sprint-6A) | **Authoritative** | **Yes** — is the direct source | **Canonical** |
| `EducationalAIContext` | Pure reshape of `AdaptiveTask` | Not persisted (built fresh per call) | None yet (Sprint 7A, zero migrated callers) | No | **Authoritative**, by construction | — (is the contract) | **Canonical** |
| Learner Record timeline (`getLearnerTimeline`) | Merge of Evidence history + promotion events | Not separately persisted — a read-time merge | Named as "the" entry point for full learner history; live callers not exhaustively traced in this pass | No — explicitly a thin merge of already-canonical sources | **Authoritative** for chronological history specifically | Not currently, and arguably shouldn't be (see §3) | **Canonical** |

### Tier 2 — Legacy, Still Live (real, active writers and readers today)

| Signal | Computed | Persisted | Consumers | Duplicates? | Authoritative/Advisory | In `EducationalAIContext`? | Classification |
|---|---|---|---|---|---|---|---|
| Permanent Learner Memory (`learner_profiles`: `KnowledgeState`, `CapabilityDimensions`, `CareerSignals`, `EngagementPatterns`, `RiskFlag`/`RiskLevel`, `FormativeSignalSnapshot`, `LearningBehaviour`, `GrowthMilestone`, `RiskHistoryRecord`, `ParentObservation`, `PathwayReadiness`, `TermSnapshot`) | `lib/learnerModel/updater.ts` ("The Intelligence Bridge"), fired on assessment/Compass/formative-signal/parent-observation/Academy-mission events | Yes — "always current, never historical" (own header comment); history lives separately in `capability_history` | `parentPulse/builder.ts`, `learnerIntelligence/blueprint.ts`, `remedial/planner.ts` (roster/name lookups, post-6A no longer for classification), `academicClinic` | **Yes, confirmed**: risk (`RiskFlag`/`RiskLevel`) duplicates Projection's `risk` projector; knowledge/capability fields overlap Projection's `knowledge`/`capability` conceptually, computed independently | **Advisory today, treated as authoritative by its own consumers** — a real hazard, not just a naming issue | **No** | **Legacy — active, not retired** |
| `substrand_health` | Written by teacher-facing curriculum tooling (`curriculum.repository.ts`) | Yes | `remedial/planner.ts` (root-cause text only, post-6A), `weeklyGenerator.ts` | Yes — a class/sub-strand-level "health" signal distinct from both Projection's per-learner `academic` value and the Permanent Learner Memory | **Advisory** | No | **Legacy/parallel — unreconciled** (named again from Sprint 7A) |
| `lib/adaptiveLearning.ts` (old, flat module — `analyzePerformance`) | Its own analysis, pre-dating `lib/adaptiveLearning/recommend.ts` | Not itself a store — a computation used by `academicClinic/assessmentPipeline.ts` | Academic Clinic report generation (teacher + parent self-service flows) | **Yes** — a second "analyze this learner's performance" implementation, confirmed by a different file living at a suspiciously similar path to the canonical `recommend.ts` | Treated as authoritative by Academic Clinic | No | **Legacy — active, easy to confuse with the canonical module by name alone** |
| `didLearningTakePlace` (Layer 1 primitive) | Pure, from `learning-signal.repository.ts`'s own `StrandAssessmentSample` reads | Not persisted (computed on demand) | Not exhaustively traced in this pass | **Partially** — computes level-delta/threshold-crossing, conceptually overlapping Projection's `growth`/`trend`, by deliberate design choice ("graph-free... must never import knowledgeGraph") | Unclear — depends on caller | No | **Derived, deliberately independent — reconciliation not attempted here, a real open question** |

### Tier 3 — Composite / Derived (built from Tier 1 + Tier 2 signals together)

| Signal | Computed | Persisted | Consumers | Duplicates? | Authoritative/Advisory | In `EducationalAIContext`? | Classification |
|---|---|---|---|---|---|---|---|
| Learner Blueprint | `learnerIntelligence/blueprint.ts`, from Permanent Learner Memory + `capabilityExtractor` (Projection-adapted) + knowledge-graph quick wins | Yes (`Learner Blueprint v1`, per project memory) | Teacher-facing Blueprint UI | Composite by design, not itself duplicative — but inherits Tier 2's risk-signal duplication through its Permanent-Learner-Memory input | **Advisory**, teacher-facing narrative | No | **Derived — mixed-provenance, real reconciliation dependency** |
| Career Capability Profile (`computeCapabilityProfile`/`extractCapabilityProfile`) | `lib/career/capabilityExtractor.ts`, via the documented anti-corruption adapter onto Projection | Yes, per project memory ("Sprint 23... unified 4 duplicate capability computations") | Career Explorer, Blueprint, Parent Intelligence | Historically yes (4 duplicates, already consolidated per Sprint 23 — confirmed by that memory, not re-verified line-by-line in this pass) | **Authoritative for capability**, by explicit prior consolidation | Not directly — reachable via the adapter, not a native `EducationalAIContext` field | **Canonical for its own domain, deliberately adapted rather than merged into Projection** |
| Parent Pulse | `parentPulse/builder.ts` — reads **both** `getOrCreateLearnerProfile` (Permanent Learner Memory) **and** `recomputeLearnerProjection` (canonical) in the same function | Sent as a message, not itself a durable "signal" store | Parents, via WhatsApp | **Yes, confirmed**: this single feature reads two potentially-disagreeing sources for what should be one coherent weekly message | Unclear which source wins for which field — not resolved in the code itself | No | **Derived — the single clearest example in this audit of a feature that must reconcile before adopting `EducationalAIContext`** |
| Attention Feed | `attentionFeed/aggregate.ts` — aggregates from `getWeeklyIntelligenceItems` (TIE/`weeklyGenerator.ts`), `getStudentAlertItems`, `getLivePrerequisiteAlerts` (knowledge graph), Monday Panel rows (`learner-model.repository.ts`, `projection/eventConsumer.ts`), intervention check-ins, career moments, teaching patterns | Read-time aggregation, not itself persisted | Teacher-facing attention/priority feed | **By construction** — it is explicitly a many-sources aggregator, not a single signal; every duplication named elsewhere in this registry flows into it at once | Advisory (a priority feed, not a score) | No | **Aggregator — inherits every upstream reconciliation gap simultaneously** |
| `getEilsItems` (Attention Feed source) | **Correction to this audit's own initial suspicion**: despite its name, this function calls `lib/attentionFeed/panel.ts::buildTeacherPanel` — **not** the frozen `_frozen/eils` system. Verified by import trace, not assumed from the name. | — | Attention Feed | No live dependency on frozen code confirmed | — | No | **Live, misleadingly named — a real clarity issue, not a frozen-code hazard** |
| Academic Clinic report pipeline | `academicClinic/assessmentPipeline.ts`, via the legacy `lib/adaptiveLearning.ts::analyzePerformance` + `pathwayCalculator` | PDF + saved context, per-report | Teacher-run and parent-self-service report flows | Yes — inherits the `lib/adaptiveLearning.ts` duplication above | Treated as authoritative by its own report output | No | **Legacy pipeline, confirmed not yet migrated (matches prior project-memory finding: "report generators flagged not migrated")** |

### Tier 4 — Activity/Portfolio Domains (evidence of what a learner *did*, not computed readiness)

`lib/learnerAchievement`, `lib/learnerCompetitions`, `lib/learnerInnovation`, `lib/learnerLeadership`, `lib/learnerProjects`, `lib/learnerWellbeing`, `lib/learnerPortfolio` — each its own canonical, ADR-numbered domain (confirmed by header comment on `achievement.ts`: "The canonical Learner Achievement service, Sprint 12W, ADR-0012," with its own frozen lifecycle states). These record **things a learner did** (entered a competition, published a project, took a leadership role), not a computed instructional/readiness judgment. **Classification: canonical within their own narrow domain, correctly independent of Projection/Recommendation, and correctly out of scope for `EducationalAIContext`** — an AI generating an adaptive quiz variant has no legitimate reason to know a learner's competition history. Named here only to confirm they were checked and correctly excluded, not overlooked.

### Tier 5 — Frozen (explicitly retired, kept for completeness)

EILS and EIR (`_frozen/eils`, `_frozen/eir`) — confirmed by project memory as deliberately frozen 2026-07-07, moved out of the live tree. This audit traced one function whose *name* suggested a live EILS dependency (`getEilsItems`) and confirmed it is **not** actually one (Tier 3, above) — the frozen systems themselves have no live callers found in this pass.

---

## 2. Answering the Audit's Own Framing Question

**Does every learner signal belong inside `EducationalAIContext`?** No — and the registry makes the boundary concrete rather than a matter of judgment call:

- **Belongs**: anything already flowing through Projection/Recommendation (Tier 1) — already there by construction.
- **Should remain independent**: Tier 4 (activity/portfolio domains) — a different kind of fact entirely, not instructional readiness.
- **Must be reconciled before it can safely be added, or safely ignored**: Tier 2 and Tier 3 — the Permanent Learner Memory, `substrand_health`, `didLearningTakePlace`, Learner Blueprint, Parent Pulse, and the Academic Clinic pipeline. Adding any of these to `EducationalAIContext` today would either duplicate what Projection already provides (risk, knowledge, capability) or introduce a second, unreconciled opinion about the same learner into one context object — precisely the failure mode ADR-0028 exists to prevent, now found concretely rather than hypothetically.

---

## 3. What This Audit Deliberately Does Not Resolve

Per its own scope: it does not decide whether the Permanent Learner Memory should be retired, merged into Projection, or kept as a genuinely separate concern (its `CareerSignals`/`EngagementPatterns`/`ParentObservation` fields may have no real Projection equivalent at all — not verified field-by-field here). It does not decide whether `didLearningTakePlace`'s deliberate independence from Projection's `growth` trend is a legitimate design choice or an accidental duplicate — that function's own header states a real architectural reason (graph-free, subject-agnostic) that deserves its own reconciliation pass, not a snap judgment here. It does not touch `lib/adaptiveLearning.ts` vs. `lib/adaptiveLearning/recommend.ts` beyond naming the confusion — Academic Clinic's migration to the canonical module is real, named, prior-known work (per project memory), not newly discovered, and not undertaken here.

---

## 4. Summary Table — Reconciliation Priority

| Signal | Reconciliation urgency | Why |
|---|---|---|
| Parent Pulse (dual Permanent-Learner-Memory + Projection read) | **Highest** | One feature, one message, two live sources for the same facts, in the same function, today |
| Permanent Learner Memory's `RiskFlag`/`RiskLevel` vs. Projection's `risk` | **High** | Both claim to represent risk; Sprint 6A already had to fix one confirmed consumer (`remedial/planner.ts`) that used the wrong one — other consumers of the Permanent Learner Memory's risk fields haven't been checked |
| `lib/adaptiveLearning.ts` vs. `lib/adaptiveLearning/recommend.ts` (Academic Clinic) | **Medium** | Real, known, prior-flagged work — not urgent relative to the two above, but a genuine naming/behavior split that should not linger indefinitely |
| `substrand_health` vs. Projection | **Medium** | Two files in this series now depend on it (`remedial/planner.ts`, `weeklyGenerator.ts`) without resolving whether it's redundant with or complementary to Projection's per-learner academic signal |
| `didLearningTakePlace` vs. Projection's `growth`/`trend` | **Low-Medium** | Deliberate design choice, plausibly legitimate, but never explicitly reconciled against Projection in writing |
| Learner Blueprint's mixed provenance | **Low** | Composite by design; the main risk is inherited from the Permanent Learner Memory dependency above, not a new issue of its own |

---

## 5. Final Recommendation

**CONDITIONAL GO** on the registry itself — it is complete, traced to real code (not asserted from names or memory alone, and one specific prior suspicion — `getEilsItems`'s apparent frozen-EILS dependency — was checked and corrected rather than repeated), and directly actionable.

**Explicit condition on broad `EducationalAIContext` adoption**: it must not be extended to, or assumed equivalent to, any Tier 2/Tier 3 signal until that signal's reconciliation (§4) happens. Concretely:

- Safe to adopt today, no reconciliation needed: any future AI workflow that only needs what Projection/Recommendation already provide (the one call site Sprint 7A already identified — `holiday/planner.ts` — remains the correct first migration candidate).
- **Not safe to adopt without reconciliation first**: any future AI workflow for Parent Pulse, Academic Clinic, or anything currently reading the Permanent Learner Memory's risk/knowledge/capability fields directly — building an `EducationalAIContext` for these today would either silently duplicate Projection a second time inside the very contract meant to prevent that, or produce a context that disagrees with what the same feature already shows elsewhere in the product.

This registry is the prerequisite the brief itself anticipated: a stable map of what exists and what it means, before the next sprint decides what — if anything — gets merged, retired, or deliberately left alone.
