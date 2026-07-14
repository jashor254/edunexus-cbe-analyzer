# EduNexus — Educational Truth Consolidation Report

**Sprint 27 — Educational Truth Consolidation**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: consolidation audit only — no code changed, no architecture redesign. Governed by the Educational Constitution ([[Sprint 25]]) and builds directly on the exhaustive traces already completed in Sprints 22–26. This sprint's job is to answer one question definitively: **does EduNexus currently produce one educational truth per learner, or more than one?**

---

## 1. Executive Summary

**More than one, in a bounded and now fully-mapped set of places.** The canonical chain — Evidence Domain → Projection Engine → Blueprint / Adaptive Learning / Career Intelligence's `capability-matches` / Holiday Planner / Parent Pulse — is a single, internally consistent source of educational truth everywhere it is the *only* system computing an answer. Five years of feature work predate that chain, however, and four independent calculations of readiness/risk/mastery/status still live alongside it, reachable by real users today. This sprint does not find new instances beyond what Sprints 24 and 26 already traced — its contribution is collapsing those findings into one inventory, classifying each by consequence rather than by which sprint found it, and answering the mission's central question directly: **yes, two different users can see two different educational conclusions about the same learner at the same moment**, in four confirmed, reachable ways (§4).

The single most serious finding, carried forward from Sprint 26 and restated here because it is the sharpest violation of this sprint's guiding principle: Compass's XP/level-up feedback computes its own, unhedged mastery-shaped conclusion about a learner **outside the canonical chain entirely** — a duplicate truth manufactured from a single AI self-assessment, shown to the child before the same claim is allowed to become truth anywhere else in the platform.

**Verdict: CONDITIONAL GO** (detail in §12) — unchanged from Sprint 26's condition, now reaffirmed with a full consolidation ordering behind it.

---

## 2. Canonical Intelligence Map

| Intelligence type | Canonical source (single truth today) | Status |
|---|---|---|
| Evidence entry, trust tiers, lifecycle | Evidence Domain (`lib/intelligence/evidence.ts`, `evidenceLifecycle.ts`, `confidence.ts`) | Canonical, uncontested |
| Academic performance, knowledge state, behaviour, growth, completeness | Projection Engine (`lib/projection/engine.ts` + projectors) | Canonical, uncontested |
| Capability profile | `computeCapabilityProfile()` (`lib/career/capabilityExtractor.ts`, Sprint 23) | Canonical, uncontested |
| Blueprint | Projection Engine, direct, uncached | Canonical, uncontested |
| Career alignment (capability-matches) | `capabilityMatchEngine.ts`, Projection-fed | Canonical, uncontested |
| Holiday Planner, Parent Pulse | Projection Engine, direct, uncached | Canonical, uncontested |
| Adaptive Learning | Projection Engine, direct | Canonical, uncontested |
| **Readiness / pathway score** | **Contested — 3 live formulas** | Not canonical (§3.1) |
| **Risk flags / risk level** | **Contested — 2 live systems** | Not canonical (§3.2) |
| **Mastery / "did learning happen" claim shown to the student** | **Contested — Evidence Domain's gated version vs. Compass's ungated immediate version** | Not canonical (§3.9) |
| **Learner status / "how is this student doing" summary** | **Contested — Blueprint (Projection) vs. student home FRS vs. Monday Panel (mixed)** | Not canonical (§3.6) |

Everywhere in the top block, the mission's chain — Evidence → Projection → Canonical Truth → audience-specific explanation — is real and verified. The bottom block is this report's full scope.

---

## 3. Duplicate Reasoning Inventory

Every remaining place readiness, risk, pathway readiness, confidence, mastery, future readiness, intervention priority, or learner status is computed independently of the canonical chain, classified by consequence:

### 3.1 Pathway/career readiness — three independent formulas
`learnerModel/updater.ts`'s `refreshPathwayReadiness()` (weighted CBC-level average), `lib/pathwayCalculator.ts` (gated KJSEA-composite), `lib/career/clinicReportBuilder.ts:631` (raw average). **Classification: user-visible contradiction, educational risk.** Confirmed reachable: a parent sees different readiness percentages on `/parent/career-intelligence` vs. `/parent/career-intelligence-report` for the same child, same moment. Educational risk because none of the three carry the trend/longitudinal weighting the canonical `capabilityExtractor.ts` chain does — CBC's growth-over-marks principle (Article IV) is honored inconsistently depending on which pipeline a screen happens to use.

### 3.2 Risk flags — two independent systems
`riskProjector.ts` (Projection: `watch`/`at_risk`/`critical`) vs. `updater.ts`'s `recomputeRiskFlags()`/`computeOverallRisk()` (Learner Model: `low`/`medium`/`high`, different taxonomy). **Classification: user-visible contradiction, educational risk.** Confirmed same-*response* split (not just same-session): `monday-panel/route.ts` returns the Projection-sourced risk badge and Learner-Model-sourced flag text in one payload. Sprint 26 sharpened this: neither half individually carries confidence or evidence IDs to the response either, so even resolving the mixing wouldn't alone fix traceability (see §7).

### 3.3 Confidence — four measurement axes
Ingestion confidence, projection coverage confidence, assessment-count confidence, and CBC-level-based confidence (the latter three inline copies partly consolidated in Sprint 24). **Classification: harmless duplication at the computation level** (they measure genuinely different things — source trust, evidence coverage, assessment volume — this is not really four answers to one question) **but an architectural duplication risk going forward**, since nothing documents which one governs which UI surface, inviting a fifth ad hoc implementation.

### 3.4 `CareerSignals.readiness_scores` — dead field
Defined, never written, read only by frozen `_frozen/eils`. **Classification: harmless duplication.** No live consumer, cannot contradict anything.

### 3.5 Remedial Planner vs. Adaptive Learning — subject-level computation
Remedial Planner computes subject level from raw marks percentage; Adaptive Learning reads Projection's level exclusively and explicitly documents not calling the Remedial Planner. **Classification: architectural duplication, bounded educational risk.** Same student's subject level — and therefore which intervention bucket they land in — can differ between the two recommenders. Self-documented in code, not a new discovery, but still live.

### 3.6 Student home "Future Readiness Score" vs. Blueprint
`app/api/student/home/route.ts`'s `computeFRS()` is a fully independent formula over raw assessments, unrelated to Projection. **Classification: user-visible contradiction.** A student can see "Strong" on their home page and "critical" on their own Blueprint in the same session — this is the one contradiction in the inventory a *student*, not just a parent or teacher, can personally notice.

### 3.7 `student_alerts` table vs. Monday Panel
Fully separate teacher-alert surface, own `alert_type` enum, no shared computation with Monday Panel. **Classification: undetermined — likely harmless duplication, pending a product decision** on whether this is a legacy system or a genuinely distinct manual-alert feature. No confirmed contradiction found in either Sprint 24 or 26's trace.

### 3.8 Confidence/evidence computed then dropped before the response (Career Report, Monday Panel, Holiday Planner, Parent Pulse, Remedial Planner)
Not a duplicate *calculation* — a single correct calculation whose result becomes untraceable before it reaches the reader. **Classification: architectural duplication risk** (a value nobody can verify invites a second, differently-computed value later, since no one can confirm the first was ever right) **and, cumulatively, an educational risk**, since it directly weakens Article IX and Constitution Article XI ("a number without a name is not neutral") across five subsystems at once, not one.

### 3.9 Compass's immediate XP/level-up claim vs. the Evidence Domain's gated mastery record
`app/api/learn/end/route.ts` computes and shows an unhedged "leveled up"/XP claim directly from a single AI self-assessment, in the same session, while the Evidence Domain's `autoConfirm.ts` (same subsystem) enforces a hard `throw` against ever auto-confirming that same class of claim. **Classification: educational risk — the most serious in this inventory.** This is a genuine duplicate truth about the same event (did this learner demonstrate mastery just now?) computed twice, disagreeing in principle (one is provisional, one is presented as settled), reaching the most trust-vulnerable audience in the platform first.

---

## 4. User-visible Contradictions — direct answer to Objective 4

**Yes, confirmed, in four independent ways:**

1. **Parent vs. parent (same parent, two tabs):** `/parent/career-intelligence` and `/parent/career-intelligence-report` show two different readiness percentages for the same child at the same moment (§3.1).
2. **Teacher vs. teacher (same teacher, one screen):** Monday Panel's own API response contains a risk badge and flag-detail text computed by two disagreeing systems in the same payload (§3.2) — the contradiction doesn't even require opening two screens.
3. **Student vs. student (same student, two pages, same session):** the student's own home page and their own Blueprint page can disagree on their overall status (§3.6).
4. **Student vs. teacher/parent (same event, different certainty):** a student is told "you leveled up" the moment a Compass session ends; the same claim, in the canonical Evidence Domain, remains `pending_review` and cannot yet be surfaced as confirmed to a teacher or parent. The student and the adults responsible for them can, briefly and correctly-by-current-design, believe different things about the same moment (§3.9) — this is not a bug in either system individually, but it is a truth mismatch across audiences that the mission's guiding principle ("different interfaces may explain the learner differently, they must never understand the learner differently") specifically forbids.

No teacher-vs-parent or admin-vs-teacher contradiction was found beyond what's implied by #1/#2 (an admin viewing the same aggregate surfaces would inherit the same splits) — no distinct admin-only duplicate calculation exists in the traced surfaces.

---

## 5. Explainability Verification

Reaffirms Sprint 26 in full, re-verified against the current tree (no drift since that audit — no commits landed between Sprint 26 and this sprint):

- Blueprint and Adaptive Learning remain the platform's reference implementations — real evidence IDs, real confidence, `insufficientEvidenceInsight()`/`isPlaceholder` guards against fabrication on thin evidence.
- Monday Panel, Remedial Planner, Career Intelligence Report, Parent Pulse, and Holiday Planner's evidence-ID trace remain unable to answer "why am I seeing this?" from their own response shape (Sprint 26 §2, §7).
- No new explainability regression found. No new explainability improvement landed either — this sprint made no code changes.

## 6. Constitution Compliance Matrix

| Article | Compliance | Evidence |
|---|---|---|
| I — No projection without evidence | Held, canonical chain only | §2 top block |
| II — Missing evidence ≠ poor performance | **Held platform-wide, re-verified this sprint (Objective 5)** | See §8 |
| III — Confidence ≠ ability, shown separately | Computed correctly almost everywhere; returned inconsistently | §3.8 |
| IV — Growth over isolated performance | Held in canonical chain; **not held** in the three legacy readiness formulas (§3.1) | Sprint 24 §6 |
| V — Risk predicts support, not worth | Held in labeling language platform-wide; weakened by Monday Panel's untraceable flag text reading as settled fact | §3.2 |
| VI — AI explains, never invents | Held at the prompt-engineering level (Career Intelligence); **not applied at all** in Holiday Planner's `enrichPlanWithAI()` prompt | Sprint 26 §1, §3 |
| VII — Evidence needs corroboration before claimable truth | Held in the durable Evidence Domain; **violated** in Compass's immediate XP/level-up UI (§3.9) | Sprint 26, this sprint §3.9 |
| VIII — Teacher approves before parent sees | Held, unchanged since Sprint 25 | Re-confirmed, no drift |
| IX — Every recommendation traceable | Held in canonical chain; **not held** in Monday Panel, Remedial Planner, Career Report, Parent Pulse (§3.8) | Sprint 26 §2 |
| X — Career guidance is possibility, not destiny | Held | No new findings |
| XI (self-critical) — a number without a name is not neutral | The self-named gap from Sprint 25 is now the largest single category in this inventory (§3.1, §3.2, §3.8) | This sprint's consolidation |

## 7. Confidence Traceability

Per subsystem, whether a computed confidence value reaches the API/UI response a teacher or parent actually sees (condensed from Sprint 26 §8, re-verified, unchanged):

| Confidence computed in | Reaches the response? |
|---|---|
| `riskProjector.ts` | No (`monday-panel/route.ts:82` discards it) |
| `capabilityExtractor.ts` / `computeCapabilityProfile()` | Yes (Blueprint, capability-matches) |
| `careerIntelligenceEngine.ts` (`assessmentCount`/`confidenceLevel`) | No (prompt-only) |
| `lib/adaptiveLearning/recommend.ts` | Yes (Insight, Holiday Planner's `evidence_confidence`) |
| `parentPulse/builder.ts` | No structurally (shapes template text only) |
| `capabilityMatchEngine.ts` | Yes in capability-matches; no once mapped into the Intelligence Report |
| Legacy `pathwayCalculator.ts` | Yes (Academic Clinic report), but the formula itself is non-canonical |
| Compass's Evidence Domain trust tier | Yes, internally; **never surfaced to the student in the XP/level-up UI**, which is the point of failure |

## 8. Evidence Traceability

Direct verification of Objective 5 (missing evidence never read as poor performance) and Objective 8 (every recommendation traces to evidence IDs + confidence):

- **Objective 5 — held, no violations found.** Every projector returns `null` rather than a fabricated floor (`lib/projection/engine.ts`); `refreshPathwayReadiness()` explicitly leaves an unassessed pathway untouched rather than defaulting toward zero; Blueprint's `isPlaceholder` guard and Adaptive Learning's `insufficientEvidenceInsight()` both return an explicit "not enough evidence" state rather than a low score. Re-checked against the current tree this sprint; no code changed since Sprint 26's confirmation, so this holds unchanged.
- **Objective 6 — held in the canonical chain, violated in two identified surfaces.** Uncertainty is represented as lower confidence (not lower ability) everywhere Projection is the sole source. Two exceptions: Monday Panel's flag-detail text (no confidence attached, reads as settled fact — an *under-representation* of uncertainty) and Compass's XP/level-up claim (asserts success with *no* uncertainty at all, the inverse failure — *over*-confidence where genuine uncertainty exists). Both were named in Sprint 26; this sprint reclassifies the second as the more serious of the two under Objective 6 specifically, since it doesn't just under-communicate uncertainty, it actively communicates false certainty to a child.
- **Objective 8 — traceable in the canonical chain (Blueprint, Adaptive Learning, capability-matches, Holiday Planner's confidence field); not traceable in Monday Panel, Remedial Planner, Career Intelligence Report, or Parent Pulse.** Full detail in Sprint 26 §2/§7, unchanged.

---

## 9. Recommended Consolidation Order

Unifies Sprint 25's staged roadmap and Sprint 26's eight recommendations into one ordering — smallest safe consolidation first, no architecture redesign, every item reuses an existing service:

1. **Gate Compass's XP/level-up feedback behind the existing evidence lifecycle state** (`pending_review`/`auto_confirmed`/`reviewed_confirmed`, already computed in `autoConfirm.ts`) — highest priority, the only item touching a live child-facing truth-duplication.
2. **Monday Panel: thread `riskProjector`'s confidence/evidenceIds through instead of discarding them at `route.ts:82`, and add an `evidenceIds` field to `learnerModel/types.ts`'s `RiskFlag`** — does not require resolving which taxonomy is canonical, only that whichever data is shown is traceable.
3. **New `readinessProjector.ts`, following the existing `academicProjector.ts` pattern**, to eventually retire the three disagreeing readiness formulas — highest engineering complexity, sequenced here because it resolves the single most parent-visible contradiction (§4.1) and needs pilot-school communication before cutover.
4. **Remedial Planner: swap subject-level calculation to Projection (matching Adaptive Learning), and add `confidence`/`evidenceIds` fields to `RemedialGroup`/`RemedialStudent`** — reuses Adaptive Learning's own reference pattern.
5. **Career Intelligence Report: thread `assessmentCount`/`confidenceLevel` into the response type; apply the same AI-grounding-rule pattern already proven in the prompt to `holiday/planner.ts`'s `enrichPlanWithAI()`.**
6. **Retire student home `computeFRS()` in favor of a Projection-derived summary** — single route, single consumer, lowest engineering complexity of the remaining contradictions.
7. **Give Parent Pulse a structured `{message, confidence, evidenceIds}` return type** instead of a bare string.
8. **Zero-risk cleanup**: delete dead `CareerSignals.readiness_scores`; document which of the four confidence axes governs which UI surface (closes §3.3 permanently rather than leaving it as a standing invitation for a fifth implementation).
9. **Resolve `student_alerts` vs. Monday Panel via a product decision** — not an engineering task until that decision is made.

## 10. Risk Ranking (educational risk, not engineering elegance)

1. **Compass XP/level-up (§3.9)** — reaches children directly, asserts false certainty, contradicts the platform's own strongest evidence-gating elsewhere in the same feature.
2. **Monday Panel mixed risk truths (§3.2)** — the platform's primary daily teacher-triage tool, contradiction lands in a single API response, not just across screens.
3. **Readiness/pathway three-formula split (§3.1)** — confirmed parent-facing, cross-page, and the one place CBC's growth principle is inconsistently honored.
4. **Remedial vs. Adaptive intervention routing (§3.5)** — same student can be routed to different support depending on which system a teacher opens.
5. **Student home FRS vs. Blueprint (§3.6)** — student-facing, but lower stakes than a mastery claim or an intervention routing decision.
6. **Career Intelligence Report's ungrounded AI narrative (§3.8, career slice)** — a parent reads confident personalized prose with no verifiable evidence behind it.
7. **Holiday Planner's ungrounded AI enrichment (§3.8, holiday slice)** — can overwrite an already-correct hedge with an unhedged one.
8. **Parent Pulse's structural opacity (§3.8, pulse slice)** — real hedging survives into the text a parent reads; the risk is purely that a teacher cannot audit it, not that a parent is misled.
9. **Confidence axis documentation gap (§3.3)** — no live harm, standing risk of a fifth implementation appearing.
10. **`student_alerts` vs. Monday Panel (§3.7)** and **dead field (§3.4)** — no confirmed harm.

## 11. Regression Results

Run this sprint against the current working tree (no code changes made):

- **TypeScript** (`npx tsc --noEmit`): two pre-existing errors, both in `scripts/` (`create-compass-auto-confirm-account.ts`, `reference-school/integration.test.ts`) — identical to the errors Sprint 24 documented as pre-existing and unrelated to any intelligence/audit-touched file. **Zero new errors.**
- **ESLint**: zero errors/warnings across every audited subsystem (`lib/projection`, `lib/intelligence`, `lib/learnerIntelligence`, `lib/career`, `lib/holiday`, `lib/parentPulse`, `lib/attentionFeed`, `lib/compass`, `lib/remedial`, `lib/adaptiveLearning`, `lib/learnerModel`, `lib/core/report-cards.ts`, `lib/academicClinic`).
- **Production build** (`npx next build`): application compiles successfully; the build's type-check step fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error, outside the application bundle and outside this sprint's or any prior sprint's touched files.

**Confirmed: zero regressions.** This sprint made no code changes, so this is a baseline reconfirmation, not a post-change verification — the same baseline Sprint 24 established still holds three sprints later, with no drift.

## 12. Final Go / Conditional Go / No-Go

**CONDITIONAL GO — same condition as Sprint 26, now with a full consolidation order behind it.**

The canonical Evidence Domain + Projection Engine chain produces one truth, consistently, everywhere it is the sole source — confirmed unregressed across four consecutive audit sprints (22, 24, 26, 27). The mission's guiding principle — different interfaces may explain the learner differently, they must never understand the learner differently — **currently does not hold platform-wide**, in four confirmed, named, reachable ways (§4), none of which are new discoveries this sprint but all of which are now ranked, ordered, and ready for scoped, non-architectural fixes.

The condition is unchanged from Sprint 26: **prioritize Compass's XP/level-up gating (§9 item 1) ahead of unrelated Compass feature work**, since it is the only item in this inventory where the platform is actively telling a child something more certain than the platform itself believes. Every other item in §9 is ordinary, independently-shippable backlog — items 2, 4, 6, 7, 8 need no product decision and can proceed in any order; items 3 and 9 are explicitly gated on a product decision (which formula/taxonomy is canonical, whether `student_alerts` is a distinct feature) before engineering work should start, consistent with this sprint's mandate not to redesign architecture ahead of that decision being made.
