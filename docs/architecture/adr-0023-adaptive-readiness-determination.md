# ADR-0023 — Adaptive Readiness Determination Specification (ARDS)

**Status: DRAFT — design pass only, per user's explicit request. No code, schema, or migration was written in producing this document.**

**Depends on**: ADR-0022 (Adaptive Quiz Generation, draft), the 2026-07-18 EduNexus System Map, and the 2026-07-18 Adaptive Learning Architecture Audit — all produced the same day, all cited below without re-verifying every claim independently (exceptions marked explicitly in §15).

**Full formatted version** (diagrams, worked-example layout, checklists) published as an artifact; this file is the durable, version-controlled record of the same specification.

---

## 1. Executive Summary

Projection answers *"what is the learner ready to learn."* ARDS answers a different question: *"how much of that answer are we entitled to trust at fine grain."* Keeping these separate stops ARDS from becoming a fourth learner-state system and keeps confidence logic out of Projection's job.

Core finding this spec is built on: the input ARDS needs already exists at real volume — **7,294** strand/topic-level evidence rows are live in production (`lib/assessments/topicalEvidence.ts:4-5`) — but stored as free text (`strand`, `subStrand` as plain strings), not linked to a curriculum ID (`lib/intelligence/evidence.ts:65-68`, `topicalEvidence.ts:75-76`). The volume problem is smaller than the earlier audit worried; the anchoring problem is exactly as real. §7 (Curriculum Anchoring Strategy) is where this ADR does its real work.

ARDS is computed per **learner × learning area (subject)**, never per school or per class — the same learner is provably at different precision in different subjects (Worked Example 3).

## 2. Architectural Decision

Introduce ARDS as a new, narrow, read-only-of-others service (`lib/adaptiveReadiness/`, illustrative) that consumes confirmed `learner_evidence` and persisted `learner_projections` only, computes a **Precision Level** (discrete gate: what grain of personalisation is safe) and an **Intelligence Confidence** (continuous, explainable 0–100 within that gate) per learner × subject, and persists the result so nothing downstream recomputes it inline. `lib/adaptiveLearning/recommend.ts` becomes ARDS's first consumer, unmodified in its own banding logic — ARDS decides *whether* a band's recommendation may be expressed as strand-specific content; `recommend.ts` still decides *which* band a learner is in.

## 3. Core Principles

- ARDS never computes ability — any logic resembling "how good is this learner at X" belongs in Projection, not here.
- ARDS reads exactly two things: confirmed Evidence, persisted Projection. Never `learner_profiles`, never `learner_marks`/`class_assessments`/`assignment_submissions` directly.
- A Precision Level is a ceiling, not a promise — "Sub-strand precision" means the platform *may* generate at that grain where a specific strand also has real, resolved evidence, not that every strand is covered.
- Unresolved curriculum anchoring caps precision — it never gets guessed.
- Every number ARDS produces is explainable in one render pass; no factor that can't be named and shown to a teacher gets to influence the score.

## 4. Data Flow

```
Evidence (confirmed only)  ─┐
                             ├──▶  ARDS.compute(learnerId, subject)
Projection (persisted)     ─┘            │
                                          ├─▶ Precision Level   (A / B / C / D — gate)
                                          ├─▶ Confidence        (0–100, explainable)
                                          └─▶ Strand Breakdown  (per-strand coverage detail)
                                          │
                                          ▼
                              adaptive_readiness  (persisted, learner_id × subject)
                                          │
                                          ▼
                    lib/adaptiveLearning/recommend.ts  (existing, unmodified banding)
                                          │
                                          ▼
                         Adaptive Assignment Generation (ADR-0022)
                    — generates at the strand grain ONLY where Strand
                      Breakdown shows real, resolved evidence for it
```

## 5. Precision Determination Algorithm

**Is the A–D ladder correct?** Mostly — with one correction the original brief didn't anticipate. `recordTopicalEvidence()` — the highest-volume real evidence producer on the platform — always writes `strand` and `subStrand` together, in the same call (`topicalEvidence.ts:75-76`). No producer today records Strand knowledge without Sub-strand knowledge in the same breath. **Level B (Strand precision) is not currently reachable as a distinct, naturally-occurring state** — real evidence jumps A→C. Level B stays in the type system for forward compatibility (a future coarser producer could populate strand-only) but must be visibly flagged as "no live evidence path yet," not silently absent.

| Level | Grain | Gate condition |
|---|---|---|
| **A** | Subject | Default — true whenever ≥1 confirmed Evidence row exists for the subject. Never blocked. |
| **B** | Strand | Reserved, unreachable today. Gate: ≥3 confirmed rows with resolved `strand` and null `subStrand`. |
| **C** | Sub-strand | ≥3 confirmed rows with a `subStrand` that **resolves** via §7 to a real `sow_substrands.id`, not all older than the decay horizon (§6). |
| **D** | Learning Outcome | ≥1 confirmed row resolving via FK to a real `sow_learning_outcomes.id`. Given ~2 of 115 outcome rows currently resolve at all, this will rarely fire today — correctly, not as a bug. |

**Two-layer output, not one.** A single Precision Level per subject either overstates coverage (one good strand implying the whole subject) or understates it (one thin strand blocking everything). ARDS outputs both a **Subject-level Precision Level** (the ceiling) and a **Strand Breakdown** — `{ resolvedStrandId → { evidenceCount, confidence, level } }` for exactly the strands with real, resolved evidence. A strand absent from the breakdown is never targeted for generation, even if the subject ceiling is Level C.

## 6. Confidence Algorithm

Continuous 0–100, lives *within* a Precision Level. Reuses the Evidence Domain's existing primitives (trust tier, identity confidence) and adds three factors Projection confirmed it does **not** apply today: trust-weighting, recency decay, contradiction penalty (`lib/projection/academicProjector.ts:32-42` takes latest evidence unweighted).

```
confidence(learnerId, subject) =
    100 × coverage(n)              // saturating: 1 - e^(-n / COVERAGE_K)
        × trustMix(evidence)       // weighted mean of EVIDENCE_SOURCE_TRUST_TIER, 0-1
        × diversityBonus(sources)  // 1.0 base, +0.05 per distinct EvidenceSource, capped 1.15
        × recencyFactor(evidence)  // exponential decay, half-life = DECAY_HALF_LIFE_DAYS
        × contradictionPenalty     // 1.0 clean · 0.5 if any row is 'contradicted'
                                    //   (reuses evidenceLifecycle.ts's existing flag —
                                    //    never re-detects contradictions itself)

  clamp to [0,100]. Constants live in one config file (lib/config/adaptiveReadiness.ts,
  illustrative) — no hardcoded thresholds scattered across call sites.
```

Evidence age matters: a CBC term is ~4 months; stale sub-strand evidence erodes Confidence, not the Precision Level itself (the anchor stays valid — the platform just gets less sure it reflects the learner *today*). Scoped to Confidence only — Projection's "latest evidence wins" rule is untouched, that's a separate already-flagged fix this ADR doesn't attempt. `trustMix` is also where the still-open ADR-0022 question (what trust tier does an adaptive quiz result get?) becomes load-bearing — a low initial tier is the conservative default until that pipeline has a track record.

## 7. Curriculum Anchoring Strategy

**Recommendation: a conservative hybrid, explicitly excluding AI-based fuzzy matching.** An AI-guessed curriculum anchor is precisely the fabricated connection Principle 1 forbids — guessing which real substrand "Fractions" means isn't meaningfully different from generating with no anchor at all.

- **Going forward**: constrain new evidence capture to a real picker wherever strand/sub-strand is recorded. Cheapest, most deterministic fix; treat as a prerequisite for Level C/D to become common, not a nice-to-have.
- **For existing free-text evidence**: a small, human-curatable alias table — `curriculum_label_aliases(raw_text, normalised_text, resolved_substrand_id, resolved_by, resolved_at)` (illustrative) — seeded by exact/near-exact string match only against real `sow_substrands.title` values. Anything that doesn't match cleanly stays unresolved: still contributes to Subject-level Confidence, never counts toward a Level C/D gate or Strand Breakdown entry. Human-reviewed and slow-growing, not bulk-automated — same discipline this platform already applies to evidence confirmation itself.

## 8. Explainability Model

Every ARDS output carries a `factors` array — the five §6 multipliers rendered as named, signed contributions. No consumer may display a bare number without also being able to show this array.

- **Teacher-facing**: e.g. "✓ Recent topical assessments (6 this term) · ✓ Teacher-verified · ✓ Three independent sources · ✓ Strong sub-strand coverage (5/6 strands) · ⚠ No classroom or parent observations yet."
- **Learner-facing**: no numeric score, no factor list — warm, outcome-oriented copy only ("Your teacher has set up focused practice for you"). A child should never see "confidence 34%" about themselves.
- **Administrator-facing**: aggregated ("% of learners at each Precision Level per subject") — a real signal about a school's own data health, not a per-learner drill-down. Named as a future product opportunity, not built here.
- **Debug/support-facing**: full factor array plus contributing `learner_evidence` row IDs.

## 9. Scalability Strategy

**The one rule this ADR cannot violate**: `recomputeLearnerProjection()` has zero caching and is called synchronously, unconditionally, per learner, with no cross-request coordination (confirmed Critical finding, prior audit). ARDS must not add a second uncached computation on top.

**Design**: `adaptive_readiness` is a real, persisted table (learner_id × subject, one row), read directly by every consumer, never recomputed inline on a hot path. Recompute triggers on the earlier of (a) explicit invalidation when new confirmed Evidence lands, or (b) a TTL expiry (default 24h, configurable) as a safety net.

**Open dependency, flagged not assumed**: `confirmReview()` is documented as "triggers a projection event" — but the same prior audit independently confirmed the platform's event bus has zero live consumers anywhere (`registerEventHandler()` never called, `lib/events/dispatch.ts:134-141`). Whether `confirmReview`'s trigger is a live synchronous call or itself routes through the dead event-bus path was **not independently re-verified for this ADR** — see Open Question 1.

**End-of-term batch warming**: a background job walking every active learner×subject pair for a school, pre-warming `adaptive_readiness` ahead of the actual generation moment, so the live request path only ever reads a cache.

## 10. Risks

| Risk | Mitigation |
|---|---|
| ARDS quietly becomes a fourth learner-state system | Hard read-only boundary (Evidence + Projection only), enforced the same way Adaptive Learning v2 already is, checked in §14 |
| Alias table silently mis-resolves a curriculum label | Exact/near-exact match only, human-reviewed, never AI-fuzzy |
| Level D never firing confuses teachers | Explainability model shows *why* ("0 of 608 outcome rows resolved"), not silent absence |
| Recompute triggering depends on unverified event infrastructure | TTL fallback means correctness never depends on the event bus firing |
| Per-strand breakdown grows unbounded at scale | Stored as JSONB on the single learner×subject row, bounded by real strand count (single digits–low tens), not learner count |

## 11. Future Extension Points (named, not built)

- Prerequisite-path precision, feeding off the existing `knowledge_edges` graph.
- Cross-subject transfer signals — not assumed safe by default, needs a real pedagogical case first.
- School-level data-health benchmarking dashboard, extending §8's administrator view.
- Reserved Level B activation if a future coarser evidence producer appears — no schema change needed.

## 12. Worked Examples

**Example 1 — Grade 8 Mathematics, thin evidence.** 2 confirmed rows (Opening + Mid-Term), Tier 2, no strand data, 95 days old → Level A, Confidence 34. Adaptive behaviour: subject-level differentiated revision only.

**Example 2 — Grade 8 Mathematics, rich evidence.** 17 topical checks (Tier 3) resolving to 5 real sub-strands including Fractions (6 rows) + assignments (Tier 3) + Compass (Tier 1), 4 distinct sources, mostly within 3 weeks → Level C, Confidence 86, Strand Breakdown includes `Fractions: {n:6, confidence:91}` plus 4 other resolved strands. Adaptive behaviour: sub-strand-targeted generation for resolved strands only; unresolved strands fall back to the subject-level base question in the same quiz.

**Example 3 — Same learner, two subjects, same week.** Mathematics as Example 2 (Level C). Science: only Opening + Mid-Term, no topical checks → independently Level A, Confidence 31. Proof that per-school or per-class granularity would misrepresent both subjects.

## 13. Recommendation

**Conditional Go.** The two-layer Precision/Confidence separation is architecturally sound. Build order: (1) the strict-picker fix for new evidence capture + the alias table for existing data — the actual prerequisite; (2) ARDS itself, persisted and TTL-cached from day one; (3) wire `recommend.ts` and Adaptive Assignment Generation to consult it. Do not build (2) or (3) before (1) — a Precision Level computed against unresolved curriculum labels is a number with nothing real underneath it.

## 14. Implementation Readiness Checklist

- [ ] Confirmed: no function inside ARDS computes a learner-ability value — only gates/weights existing Projection/Evidence output
- [ ] Confirmed: zero ARDS imports from `lib/learnerModel/`, `learner_profiles`, or any direct read of `learner_marks`/`class_assessments`/`assignment_submissions`
- [ ] Resolved: whether `confirmReview`'s projection-event trigger is live or routes through the dead event bus (Open Question 1)
- [ ] Decided: the evidence-source trust tier for machine-graded Adaptive Quiz results (inherited from ADR-0022)
- [ ] Built and reviewed: the alias-table seeding pass, with a real resolved-count out of the 7,294 existing topical rows, before any Precision Level depends on them
- [ ] Load-tested: `adaptive_readiness` read/write path at realistic multi-hundred-learner volume
- [ ] Written: a boundary test proving ARDS cannot be called from anywhere that also touches raw evidence tables directly

## 15. Open Questions

1. **Event infrastructure dependency** — does `confirmReview()`'s projection-recompute trigger already work synchronously, or depend on the dead `publishEvent`/`registerEventHandler` path? Decides whether ARDS invalidation piggybacks on an existing mechanism or needs its own trigger added at the same call site.
2. **Is the topical-check UI already picker-constrained?** Not independently re-verified for this ADR — if strand/topic are already selected from a real list rather than free-typed, §7's "going forward" fix may already be partially true.
3. **Decay half-life and coverage constants** — named without proposed numbers; should be set from real teacher usage patterns, not chosen abstractly.
4. **Should a Strand Breakdown entry ever explicitly downgrade**, not just fade via recency decay, when a previously-covered strand gets no new evidence for a full term? A UX decision, not just an algorithm one — not resolved here.
