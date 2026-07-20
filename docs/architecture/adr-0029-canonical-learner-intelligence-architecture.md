# ADR-0029 — Canonical Learner Intelligence Architecture (CLIA)

## Design Only — No Code, No Migrations, No Schema, No New Abstractions

**Depends on**: ADR-0022–0028, Sprint 4A–7B. **Directly builds on and corrects** `docs/architecture/migration-ledger.md` — an existing, detailed, consumer-by-consumer record this audit treats as primary evidence, not something to re-derive from scratch.

**Purpose, restated precisely**: this document does not decide *where data is stored*. It decides **who is allowed to make which educational claim**, and — its one non-negotiable exit requirement — **what happens when two systems disagree about the same learner.**

---

## Executive Summary

The migration ledger already did most of the consumer-by-consumer reconciliation work this ADR was asked to audit — a real prior asset, not a gap. This document's job is to (1) elevate its scattered "confirmed with user" decisions into one formal ownership constitution, (2) correct one place where the ledger is now stale, (3) answer the two objectives it never covered (Weekly Generator/`substrand_health`, and an explicit field-by-field accounting of what the Permanent Learner Memory uniquely owns), and (4) rule, without ambiguity, who wins on conflict.

**The one stale correction, found by re-reading the actual Projection types this session already modified**: the ledger's own "Known gaps in the frozen Projection Engine (v1.0)" section states *"No substrand-level knowledge. `knowledgeProjector` is subject-level only."* **This is no longer true.** ADR-0024 Phase 2 (this series, prior to this conversation's Sprint 4A–7B arc) added `bySubStrand` to both `AcademicValue` and `KnowledgeValue` in `lib/projection/types.ts`. The *engine* gap the ledger names as blocking Teacher Dashboard's mastery heatmap and hidden-misconception detection is closed. **The consumer migration was never revisited** — Teacher Dashboard still reads `learner_profiles.knowledge_state` for exactly the substrand-level detail Projection can now provide. This is a real, actionable, previously-invisible migration opportunity, named here for the first time.

**A correction to this series' own prior work**: Sprint 7B ranked Parent Pulse's "dual read" of the Permanent Learner Memory and Projection as the **highest-priority reconciliation risk**. A full read of `lib/parentPulse/builder.ts` (not just its import list) and the migration ledger's own entry for it shows this was **overstated** — the split is deliberate, documented in the code itself, and already correctly scoped to exactly the two fields (`career_signals`, `engagement_patterns`) that have no Projection equivalent. Corrected here rather than repeated.

**Recommendation: CONDITIONAL GO** — see §6.

---

## 1. The Constitutional Rule — What Happens When Two Systems Disagree

**Stated once, applies everywhere below without exception**:

> **Projection is authoritative for any claim about a learner's current academic level, knowledge state, or risk, for any subject or sub-strand Projection can compute from confirmed Evidence.** When the Permanent Learner Memory, `substrand_health`, a legacy report pipeline, or any other system disagrees with Projection on one of these three claims, **Projection wins** — not because it's newer, but because it is the only one of these systems whose input (confirmed Evidence) is itself governed by an immutability/correction discipline the others don't have.
>
> **For every other claim category — capability's 6-dimension breakdown, risk duration/consecutive-weeks tracking, career/pathway readiness, engagement telemetry, single-assessment "what did this one test show" reporting, teacher-authored data (`confirmed_gaps`), and long-horizon narrative memory (growth milestones, term snapshots, parent observations)** — **Projection does not yet compute these at all, so there is no conflict to resolve; the existing owner (named per-signal below) remains authoritative until a future Projection version computes the same claim, at which point this same rule applies again.**

This single rule, applied consistently, resolves every "who wins" question below — most subsystems don't actually disagree with Projection today; they compute something Projection has no opinion on.

---

## 2. Required Diagrams

### Canonical instructional path

```
Evidence (confirmed learner_evidence only)
      ↓
Projection (recomputeLearnerProjection — academic, knowledge, capability,
            behaviour, growth, risk, completeness; academic/knowledge now
            substrand-aware per ADR-0024 Phase 2)
      ↓
Reasoning (classifyGroup/buildAdaptiveTask — lib/adaptiveLearning/recommend.ts)
      ↓
Educational Context (EducationalAIContext — Sprint 7A, a pure reshape of
                      Reasoning's own output, zero new computation)
      ↓
Instructional AI (routedCompletion — Sprint 6B, one canonical invocation path,
                   one production workflow migrated so far)
      ↓
Teacher
```

Every arrow in this chain is real, tested code as of this series' own prior sprints — not aspirational.

### Where the Permanent Learner Memory intersects

```
Permanent Memory (learner_profiles — capability_dimensions, knowledge_state,
                   risk_flags/risk_history, learning_behaviour,
                   engagement_patterns, career_signals, pathway_readiness,
                   growth_milestones, term_snapshots, parent_observations)
        │
        │  (capability, risk: via projectionAdapters.ts's anti-corruption
        │   shim — Projection's data, adapted, not a second computation;
        │   see §1's rule — these fields are LEGACY where Projection now
        │   has an opinion, and the adapter exists precisely so Blueprint
        │   consumes Projection's answer, not the Permanent Memory's own)
        ▼
Blueprint (lib/learnerIntelligence/blueprint.ts — Composite, see §3.4)
        │
        │  (career_signals, engagement_patterns only — no Projection
        │   equivalent exists yet; NOT a disagreement, a genuine gap)
        ▼
Parent Pulse (lib/parentPulse/builder.ts — knowledge/risk from Projection
              directly, NOT from this Permanent Memory arrow at all)
```

**The intersection is narrower than it looks from the outside.** Both Blueprint and Parent Pulse already route their knowledge/risk claims through Projection (directly, or via the capability adapter) — the Permanent Memory arrow into each is real but scoped to exactly the fields with no Projection equivalent, confirmed by reading both files' actual code, not their import lists.

---

## 3. Subsystem-by-Subsystem Constitutional Ruling

### 3.1 Evidence Domain

**What is authoritative**: `learner_evidence`, confirmed rows only. **Append-only**: yes, enforced by a DB trigger (`trg_learner_evidence_immutability`), not app convention — corrections supersede, never edit in place. **Consumers that read directly**: every Projection projector (the only sanctioned read path). **Consumers that bypass Projection**: none found reading `learner_evidence` directly outside `lib/projection/` and the Evidence domain's own lifecycle functions — this boundary is intact.

**Current owner**: Evidence Domain. **Should owner be**: unchanged. **Migration needed**: none. **Risk**: none identified. **Difficulty**: n/a.

### 3.2 Projection

| Projector | Canonical? | Should never be recomputed elsewhere? |
|---|---|---|
| `academic` (now with `bySubStrand`, ADR-0024 Phase 2) | Yes | Yes — and yet `remedial/planner.ts` did, pre-Sprint-6A (fixed); Teacher Dashboard's mastery heatmap still does (§4) |
| `knowledge` (now with `bySubStrand`) | Yes | Yes |
| `capability` (per-subject only, no 6-dimension breakdown) | Yes, for what it computes | Yes for per-subject; the 6-dimension breakdown is **not** something Projection computes at all — that's `capabilityExtractor.ts`'s own domain (§3.4), not a duplicate |
| `behaviour` (`observationCount`/`distinctSources` only) | Yes, for what it computes | Yes — but this is much thinner than `learner_profiles.learning_behaviour`'s 6-metric persistence/confidence/velocity/help-seeking/reflection/consistency profile, which is a genuinely different, richer claim Projection doesn't make (§3.3) |
| `growth` | Yes | Yes — `didLearningTakePlace` (Sprint 7B) computes something adjacent by deliberate, stated design choice (graph-free primitive); not ruled on here, named as real open work |
| `risk` | Yes | Yes — `learner_profiles.risk_flags`/`overall_risk_level` is the direct legacy duplicate; §1's rule applies: Projection wins |
| `coverage`/`confidence` (shared infrastructure, `lib/projection/coverage.ts`) | Yes | Yes — one formula, already shared by every projector; no duplicate found |

**Current owner**: Projection Engine. **Should owner be**: unchanged — Projection is this platform's one deterministic readiness authority. **Migration needed**: none to Projection itself; consumer migrations are named per-subsystem below. **Risk**: low — the engine itself is sound; the risk is entirely in unmigrated consumers still reading around it. **Difficulty**: n/a for the engine.

### 3.3 Permanent Learner Memory — field-by-field, not assumed

Read in full (`lib/learnerModel/types.ts`) rather than characterized from its own header comment, which claims "the only permanent source of truth... nothing bypasses it" — a claim this ADR formally overrules for the fields Projection now covers.

| Field | Unique, or duplicate? | Ruling |
|---|---|---|
| `knowledge_state` (per-substrand mastery) | **Duplicate** of Projection's `knowledge.bySubStrand` (now that it exists) | §1 rule: Projection wins going forward. Legacy, not yet retired. |
| `confirmed_gaps`/`persistent_gaps` | Derived from `knowledge_state` | Follows `knowledge_state`'s ruling — **except** the ledger notes `confirmed_gaps` is partly teacher-authored data in Blueprint's specific usage, which is not a computation to retire (§3.4) |
| `capability_dimensions` (6-dimension) | **Not a Projection duplicate** — Projection has no 6-dimension breakdown at all | Owned by `capabilityExtractor.ts` (via the Projection-adapted shim for its approved callers), **not** by this raw `learner_profiles` field, which is a separately-maintained legacy copy the ledger already flags as untouched/deferred |
| `learning_behaviour` (persistence/confidence/velocity/help-seeking/reflection/consistency) | **Unique** — Projection's `behaviour` projector is far thinner | **Belongs to the Permanent Learner Memory. Projection should never own this** — it's exactly the "behaviour preferences" category the audit asked to be separated out |
| `career_signals`/`pathway_readiness` | Partially — overlaps conceptually with Career System's own readiness computation | See §3.10 — Career System owns pathway/career readiness; whether this specific cached field should be retired in favor of computing live is a real open question, not resolved here |
| `engagement_patterns` | **Unique** — raw usage telemetry, not readiness | **Belongs to the Permanent Learner Memory. Projection should never own this** |
| `formative_signals` (last-20 snapshot) | Partial — the underlying observation now also flows to Evidence (`lib/formativeSignals/evidence.ts`, confirmed dual-write) | The **snapshot array itself** is a legitimate denormalized display cache, not a competing authority, **provided it is understood as advisory**, not the source of truth its own header comment currently claims |
| `parent_observations` | **Unique, and currently has no other home** | No Evidence Domain producer exists for parent-reported observations yet (confirmed this session). **Ruling: this is the only current home for this signal category. Not because the Permanent Learner Memory should stay authoritative generally — because this one signal has nowhere else to live until a future Evidence producer is built for it (out of this ADR's scope).** |
| `risk_flags`/`risk_history`/`overall_risk_level` | **Duplicate** of Projection's `risk` (current state) — **except** `risk_history`'s temporal record (when a flag first appeared, consecutive weeks, resolution type) | §1 rule: Projection wins on *current* risk state. **`risk_history`'s durational/historical aspect is unique** — Projection recomputes fresh on every call with no transition log; this is a real, named gap (matches the ledger's own "no duration/consecutive-weeks tracking" finding), not resolved by this ADR |
| `growth_milestones` | **Unique** — a permanent, never-deleted event log; Projection is stateless | **Belongs to the Permanent Learner Memory. Projection should never own this** — "historical identity," exactly as the audit asked to separate out |
| `term_snapshots` | **Unique**, for a structural reason: `learner_projections` is upserted in place, no history retained | **Belongs to the Permanent Learner Memory**, for as long as Projection itself keeps no historical rows — this is the actual reason it can't simply be "replaced," not an oversight |
| `learning_style`, `strengths`, `weaknesses`, `interests`, `profile_data` | Self-declared | Already marked "kept for backwards compat, do not use in new code" in the file's own comment — **ruling: deprecated, no new writes, plan removal** (this ADR doesn't schedule it, just confirms the existing self-assessment) |
| Monday Panel output types (`StudentIntelligenceSummary` etc.) | Not stored learner state — computed presentation shapes | Correctly out of scope — these are views over the signals above, not a signal themselves |

**Current owner**: `lib/learnerModel/` ("Permanent Learner Memory"). **Should owner be**: split — Projection owns current academic/knowledge/risk state (§1); the Permanent Learner Memory retains genuine, non-duplicated ownership of behaviour preferences, engagement telemetry, growth milestones, term snapshots, and (until an Evidence producer exists) parent observations. **Migration needed**: retire `knowledge_state`/`risk_flags`/`overall_risk_level` as authoritative reads wherever a consumer still uses them for current state (named per-consumer in the ledger and below); do **not** touch `learning_behaviour`, `engagement_patterns`, `growth_milestones`, `term_snapshots`, or `parent_observations` — they're not duplicates. **Risk**: medium — this file's own header comment actively asserts a founding principle ("nothing bypasses it") that this ADR formally contradicts for a subset of its fields; any future engineer reading that comment without also reading this ADR will get the wrong mental model. **Difficulty**: the retirement itself (once scheduled) is low per-consumer, since the ledger shows most consumers already migrated the current-state fields; the remaining ones are named explicitly (Teacher Dashboard, below).

### 3.4 Learner Blueprint

**Classification: Composite**, not a view, not a second Projection, not an independent model. Confirmed by reading `blueprint.ts` directly: it assembles from (a) Projection, via `projectionToScoreHistory`/`projectionRiskFlags` (the sanctioned adapter into `capabilityExtractor.ts`'s formula), (b) the knowledge-graph prerequisite engine (`computeQuickWins`), and (c) exactly one Permanent-Learner-Memory field the ledger already confirms is legitimate — `confirmed_gaps`, which is **teacher-authored data, not a competing computation**.

**Current owner**: itself, as a composite assembler. **Should owner be**: unchanged — this is the correct shape for a composite; the individual inputs are each already correctly owned (Projection for capability/risk via the adapter, the knowledge graph for prerequisites, the teacher for `confirmed_gaps`). **Migration needed**: none — already Projection-sourced per the ledger. **Risk**: low. **Difficulty**: n/a.

### 3.5 Parent Pulse — every field, source confirmed by reading the actual function

| Field used in the message | Source |
|---|---|
| Knowledge (`knowledgeBySubject`, strong/weak subjects) | **Projection** (`recomputeLearnerProjection().knowledge`) |
| Risk (`riskLevel`, `flags`) | **Projection** (`.risk`) |
| `career_signals` (top career slug) | **Permanent Learner Memory** — no Projection equivalent exists |
| `engagement_patterns` | **Permanent Learner Memory** — fetched, currently unused in the message body (`void engagement // used for future enrichment`) |
| Recent Compass sessions, formative signals this week | **Computed locally**, direct repository reads (`repos.compass`, `repos.learnerModel.findFormativeSignalsForStudent`) — not Projection, not the Permanent Memory's snapshot arrays |

**Correction to Sprint 7B**: this is not an unreconciled dual-read. It is the correct, minimal use of the Permanent Learner Memory for exactly the two fields with no Projection equivalent, already documented in the code's own comment and in the migration ledger. **Current owner**: Projection (knowledge/risk) + Permanent Learner Memory (career/engagement, by necessity, not duplication). **Should owner be**: unchanged. **Migration needed**: none. **Risk**: low — downgraded from Sprint 7B's "highest priority," on re-verification. **Difficulty**: n/a.

### 3.6 Academic Clinic

Per the ledger's own Reporting Sprint 3 finding (confirmed, not re-litigated): a **third, fully independent report pipeline** — its own 40-career static database, its own CBC tier vocabulary (Emerging/Developing/Proficient/Exemplary), its own `analyzePerformance`-based tiering (via the legacy, flat `lib/adaptiveLearning.ts`, confirmed this session to be a different module than the canonical `lib/adaptiveLearning/recommend.ts` despite the near-identical name). This is **not** the same category of problem as `learner_profiles` duplicating Projection's *aggregate* state — Academic Clinic answers "what did this **one specific assessment** show," a question Projection's aggregate-evidence model doesn't answer at all. Migrating it would require either inventing Projection-shaped fields the engine doesn't compute or changing what a report shows — both already ruled out once by the ledger's own Reporting Sprint 3.

**Current owner**: its own independent, single-assessment-scoped pipeline. **Should owner be**: unchanged — this is a genuinely different question from Projection's, not a stale duplicate of it. **Migration needed**: none, confirmed twice now (ledger, this ADR). **Risk**: low, provided nobody mistakes "different question" for "duplicate" and forces a migration that would silently change report content. **Difficulty**: n/a — the ruling is "leave alone," not "migrate."

### 3.7 Holiday Planner

**Confirmed, not just asserted**: `lib/holiday/planner.ts` reads `recomputeLearnerProjection` + the Recommendation Layer (`buildAdaptiveTask`) directly — no `learner_profiles` read for readiness. Already the one call site Sprint 7A identified as ready to adopt `EducationalAIContext` with zero reconciliation debt.

**Current owner**: Projection + Recommendation. **Should owner be**: unchanged. **Migration needed**: none for signal ownership; adopting `EducationalAIContext` itself is a separate, already-scoped future step (Sprint 7A). **Risk**: none. **Difficulty**: n/a.

### 3.8 Weekly Generator / `substrand_health`

Not covered by the prior migration ledger — audited fresh here. Reading `weeklyGenerator.ts` directly: `substrand_health`'s `noStruggleFlag` contributes 25% weight to a **lesson health score**, alongside teacher-confirmed follow-up (55%) and reflection-authenticity (20%) — **this is a class/lesson-level teaching-quality signal, not a per-learner readiness claim.** It answers "how did this lesson go," not "what does this learner know."

**Ruling, answering the brief's own framed question directly**: `substrand_health` should become **neither Projection nor ARDS** — both are per-learner constructs, and this is a class-level aggregate answering a different question. It should not be **removed** either — it's a real, non-duplicated signal feeding a real teacher-facing feature. **It should remain independent, explicitly re-scoped in its own documentation as a class/lesson-quality signal, not a learner-readiness signal** — the risk here is conflation, not duplication; nobody should later mistake `substrand_health` for a Projection-equivalent and try to merge it.

**Current owner**: its own class-level health computation. **Should owner be**: unchanged, but re-labeled to prevent future confusion with per-learner Projection. **Migration needed**: a documentation clarification, not a code migration. **Risk**: low today, medium if left unclarified (the exact confusion this audit exists to prevent). **Difficulty**: trivial (a comment/naming fix, not scheduled by this design-only ADR).

### 3.9 Attention Feed

Effectively the same aggregation the ledger already documents in detail under **Teacher Dashboard** (`lib/attentionFeed/panel.ts::buildTeacherPanel`) and **Monday Panel** — confirmed by `attentionFeed/aggregate.ts`'s own imports (`fetchMondayPanelRows`, `getWeeklyIntelligenceItems`, etc.). Per the ledger: risk level, class-wide risk counts, at-risk sort order, and peer-pairing eligibility are already Projection-sourced ("one risk engine, no exceptions, within this file"). `top_flags`, `weeks_at_risk`, capability-dimension peer-pairing content, `compass_suggestion`, `career_moments`, and prerequisite alerts remain on legacy sources — each with a **named, specific engine gap** (no risk-type taxonomy in Projection's `RiskFlag`, no duration tracking, no 6-dimension capability), not an oversight.

**Does it consume only canonical signals? No — and the ledger already explains exactly which parts don't and why**, which this ADR ratifies rather than re-discovers. One correction made in this pass: `getEilsItems` (a source this aggregator calls) is confusingly named but, verified by import trace, does **not** depend on the frozen EILS system — it calls `attentionFeed/panel.ts` itself (Sprint 7B's own correction, restated here since Attention Feed is this section's subject).

**Current owner**: mixed, per-field, exactly as the ledger documents. **Should owner be**: unchanged — every remaining legacy field has a real, named engine gap, not a lazy non-migration. **Migration needed**: none beyond what a future Projection version would need to add (substrand-level heatmap consumption is now possible per §Executive Summary's correction — see §4). **Risk**: low, well-documented. **Difficulty**: n/a for this ADR's own scope.

### 3.10 Career System — does Projection or Career own readiness?

**Ruling: split, deliberately, and this is not a duplication.** Projection owns per-subject/per-sub-strand **academic** readiness. The Career System (`capabilityExtractor.ts`, `careerEngine.ts`, `careerIntelligenceEngine.ts`, `matchEngine.ts`) owns **pathway and career-specific** readiness — a genuinely higher-level, derived judgment ("is this learner's academic profile a good fit for engineering") that Projection has no concept of (no notion of a CBC pathway or a career slug exists in `lib/projection/`). Per the ledger's Phase H entry, the historical "three independent capability computations" problem (`learner_profiles.capability_dimensions`, `students.capability_profile`, `learner_projections.capabilityProjector`) was already **closed** — `recomputeAndSaveCapabilityProfile()` now sources from Projection via the adapter, blended chronologically with the legacy `assessments` table for one confirmed, deliberate reason (the standalone Academic Clinic score-entry route still doesn't emit an Evidence row, so pure-Projection would silently drop signal for those students — caught during implementation, not now).

**Current owner**: Projection (academic), Career System (pathway/career, Projection-adapted). **Should owner be**: unchanged — this split is correct, not a gap. **Migration needed**: none beyond what the ledger already closed; the Academic-Clinic-route Evidence gap named in Phase H remains a real, deliberate future decision, not this ADR's to schedule. **Risk**: low — already reconciled once, with a documented reason for the one remaining blend. **Difficulty**: n/a.

---

## 4. The One Concrete, Newly-Actionable Finding

Because ADR-0024 Phase 2 added `bySubStrand` to both `academic` and `knowledge` Projection values, and because the migration ledger's "known gap" blocking Teacher Dashboard's mastery heatmap, hidden-misconception detection, and peer-helper *content* was specifically "no substrand-level knowledge" — **that blocking gap no longer exists, and nobody has revisited the consumers it blocked.** This is not a new duplication to fix; it's a closed engine gap whose downstream consequence (a real, available migration) was never noticed because the ledger and the Projection-type change happened in different work streams. Named here for the first time, not scheduled — this ADR does not migrate code.

---

## 5. Summary Table

| Subsystem | Current owner | Should owner be | Migration needed | Risk | Difficulty |
|---|---|---|---|---|---|
| Evidence Domain | Evidence Domain | Unchanged | None | None | n/a |
| Projection | Projection Engine | Unchanged | None | Low | n/a |
| Permanent Learner Memory | Mixed (see §3.3) | Split: Projection for current academic/knowledge/risk; Learner Memory for behaviour/engagement/milestones/snapshots/parent-observations | Retire `knowledge_state`/`risk_flags` as authoritative where still read (Teacher Dashboard) | Medium (header comment contradicts this ruling) | Low per-consumer |
| Blueprint | Composite (correct) | Unchanged | None | Low | n/a |
| Parent Pulse | Split (correct, re-verified) | Unchanged | None | Low (downgraded from Sprint 7B) | n/a |
| Academic Clinic | Independent pipeline | Unchanged | None | Low | n/a |
| Holiday Planner | Projection + Recommendation | Unchanged | None (EducationalAIContext adoption is separate, already scoped) | None | n/a |
| Weekly Generator / `substrand_health` | Independent, class-level | Unchanged, re-labeled | Documentation clarification only | Low today / Medium if unclarified | Trivial |
| Attention Feed | Mixed, per-field (documented) | Unchanged | None beyond what a future Projection version enables | Low | n/a |
| Career System | Split (Projection: academic; Career: pathway/readiness) | Unchanged | None | Low | n/a |

---

## 6. Final Recommendation

**CONDITIONAL GO.**

The constitution itself (§1) is simple and, per this audit, already **mostly lived** in real code — most subsystems either already defer to Projection where it has an opinion, or compute something Projection genuinely doesn't, for a reason each one documents. Conditions:

1. **`lib/learnerModel/types.ts`'s own header comment must be understood as superseded by §1 of this document** for the fields Projection now covers — it currently asserts a founding principle this ADR formally contradicts, and nothing in the codebase itself has been updated to say so.
2. **The migration ledger must be corrected** (§Executive Summary) — its substrand-knowledge gap claim is stale, and the consumers it blocked (Teacher Dashboard's heatmap, hidden misconceptions, peer-helper content) represent real, newly-available migration work this ADR surfaces but does not schedule.
3. **Sprint 7B's Parent Pulse risk ranking should be treated as superseded by this document's re-verification**, not left standing alongside a contradicting finding.
4. **`substrand_health` needs a naming/documentation clarification**, not a migration — the risk is future confusion, not current duplication.

With these four conditions acknowledged, the implementation roadmap the brief itself proposes is sound, with one adjustment this audit requires: **Sprint 8A's "remove the first dual-read (likely Parent Pulse)" should be retargeted** — Parent Pulse is not the dual-read this audit found to be a real problem. The two real, still-open items are (a) Teacher Dashboard's now-closable substrand-knowledge gap (§4), and (b) the Permanent Learner Memory's `knowledge_state`/`risk_flags` fields wherever a consumer still reads them as current-state authority rather than through Projection. Sprint 8A should target one of those two, not Parent Pulse.
