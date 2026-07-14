# EduNexus — Educational Reality & Progressive Evidence Verification

**Sprint 28 — Educational Reality & Progressive Evidence Verification**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit-only, no code changed. Governed by the Educational Constitution ([[Sprint 25]]) and the empirical-verification standard [[Sprint 27]] established (run real code against real/synthetic data, don't just read it). Builds on, and does not resolve, [[Sprint 27]]'s open finding that `recomputeLearnerProjection()`'s database write still throws for real students — this sprint worked around it (documented in §14) rather than blocking on it, since Sprint 28's question (does behavior scale correctly with evidence volume) is answerable from the pure computation layer.

---

## 1. Executive Summary

Kenyan schools mostly operate at the thinnest end of the evidence spectrum, and the live database confirms it: **405 of 406 real students in the reference-school fixture have exactly one confirmed evidence record.** This sprint's job was to verify EduNexus behaves correctly at that reality and every richer tier above it — and to find every place the platform quietly assumes more data than a real school will actually have.

It found one genuinely serious, previously-undiscovered bug, plus two smaller monotonicity gaps, plus one clean bill of health on the question the mission cared about most (administrative-vs-evidence separation):

**The serious finding**: at **Tier 2 — opener, midterm, and endterm exams in one subject, the single most common evidence pattern in Kenyan schools today** — Career Intelligence's `computeCapabilityMatches()` returns a specific career ("Agricultural Scientist / Agritech") at a "Strong Match," **High confidence**, from three same-subject exam scores, and additionally promotes an entrepreneurial-tier recommendation. This is a direct, empirically-confirmed violation of Objective 8 and Constitution Article X ("career guidance recommends possibility, never fixed destiny"). Worse: once this specific pick locks in at Tier 2, it does **not** get revised as richer, more diverse evidence arrives at Tier 3/4 — the wrong conclusion persists rather than converging toward a better one, which is the opposite of what "richer evidence produces richer personalization" (Objective 12) requires.

Two further monotonicity gaps were found (§4): capability confidence can stay flat despite more same-subject evidence arriving (a projector-level dedup issue), and Blueprint's evidence-summary confidence can *drop* at the richest tier tested, because the confidence formula penalizes the inclusion of legitimate lower-trust-tier sources (Compass, classroom observation) rather than rewarding the added signal.

On the question this mission's Kenyan Classroom Reality section cared most about — does Scheme of Work / Lesson Plan / Record of Work content ever leak into learner intelligence — the answer is **no, confirmed clean**, with one naming hazard flagged for future engineers, not a current violation.

**Verdict: CONDITIONAL GO**, with Career Intelligence's Tier-2 over-specialization treated as an urgent fix given how common that exact evidence pattern is in the real pilot base — detail in §13.

---

## 2. Educational Maturity Levels

Defined and tested against real running code (pure `computeLearnerProjection()`, `extractCapabilityProfile()`, `computeCapabilityMatches()`, `generateHolidayPlan()`, `buildLearnerBlueprint()`), using one synthetic learner tracked cumulatively across all four tiers (so the same learner is compared throughout, not four different ones) plus a real-data census of the actual production fixture:

| Tier | Definition | Real-world prevalence (measured) |
|---|---|---|
| **1 — Exam-only** | One end-of-term exam, one subject | **405/406 (99.8%) of real students in the reference-school fixture** — this is not a hypothetical edge case, it is today's default state |
| **2 — Termly exam cadence** | Opener + midterm + endterm, same subject | The standard CBC termly rhythm — every school reaches this within one term |
| **3 — Topical + exams** | Topical assessments layered on top of Tier 2 | Requires a teacher to adopt topical checks consistently — inconsistent today per the mission's own stated Kenyan classroom reality |
| **4 — Continuous evidence** | Multiple subjects, mixed sources (topical, formative, Compass, parent observation) | Not observed in any real student in this pass — purely aspirational today |

This distribution is itself a finding: **almost the entire live evidence-maturity testing surface that matters right now is Tier 1**, with Tier 2 as the near-term horizon as pilot schools complete a first term. Tiers 3–4 are real design targets but not where today's actual educational risk sits.

## 3. Evidence Maturity Matrix

One traced synthetic learner (mathematics level 2→2→3 improving through Tiers 1–3; Tier 4 adds English/Science/Creative Arts), evidence cumulative tier-to-tier:

| Subsystem | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| Projection: academic.confidence | 30 | 83 | 73 | 68 |
| Projection: capability.confidence | 30 | **30 (flat)** | **30 (flat)** | 70 |
| Projection: risk/completeness.confidence | 30 | 83 | 73 | 68 |
| capabilityExtractor: analytical_reasoning.confidence | 0.20 | 0.20 | 0.20 | 0.34 |
| capabilityExtractor: resilience level/confidence | developing / 0.15 | **exceptional / 0.75** | exceptional / 1.00 | strong / 1.00 |
| Career match: primary tier | none | **Agricultural Scientist, 0.847, High** | same | Agricultural Scientist, 1.045, High |
| Career match: entrepreneurial tier | not shown | **promoted, 0.536** | same | promoted, 0.913 |
| Holiday Planner: gaps/sessions | mathematics, 1 session, hedged | none (level rose) | none | none |
| Blueprint: evidenceSummary confidence | Low | High | High | **Medium (drops)** |
| Blueprint: opportunity insight text | "Analytical reasoning..." (Low) | identical (Low) | identical (Low) | identical (Low) |

Full method, script pattern, and cleanup confirmation in §14.

## 4. Confidence Scaling Verification (Objective 6)

**Static formula review** (every confidence-computing function in the codebase, read fresh):

| Formula | Monotonic-safe? |
|---|---|
| `lib/projection/coverage.ts`'s `computeProjectionConfidence()` | Structurally safe in isolation (count factor rises with evidence; the only penalty is a 0.5x multiplier on genuinely `contradicted` evidence — the Constitution-sanctioned case) — **but see the empirical finding below, where its plain-mean-of-source-confidence design produces a real drop when diverse trust-tier sources are added** |
| `lib/intelligence/confidence.ts`'s `computeConfidence()` | Safe — per-record ingestion score, not an accumulation, doesn't claim to aggregate across evidence count |
| `capabilityMatchEngine.ts`'s `confidenceFromAssessmentCount()` | Safe as a step function (non-decreasing in count) — **but the step size itself is the problem found empirically: it jumps straight Low→High at count 3, with no Medium step, and count alone (not diversity) triggers it** |
| `capabilityExtractor.ts`'s `weightedCapability()`/resilience confidence | Safe — both are `min(1, weight_or_count / ceiling)`, strictly non-decreasing |
| `lib/adaptiveLearning/recommend.ts`'s `confidenceFromScore()` | Safe by construction — pure labeling of an already-computed score |
| **`lib/learnerModel/updater.ts`'s `updateFromAssessment()` (line ~79)** | **VIOLATION.** Sets confidence purely from the *latest* assessment's level (`level >= 3 ? 'high' : level === 2 ? 'medium' : 'low'`), ignoring accumulated evidence count entirely. A student with 5 prior level-3 assessments (confidence: high) whose 6th assessment lands at level 2 due to ordinary variance snaps straight to confidence: medium — evidence just grew from 5 to 6 corroborating points, and confidence went down. The same file's `confirmedMasteryConfidence()` correctly floors confidence for cross-source corroboration; that logic was never extended to repeated same-source (assessment) evidence. |

**Empirical findings, only visible by running real code** (not visible from formula reading alone):

1. **Capability projector confidence stays flat despite more evidence** (`lib/projection/capabilityProjector.ts`) — it dedupes to the *latest* evidence per subject before scoring confidence, so a second and third same-subject exam contribute nothing to confidence until a *second subject* appears. Confidence stayed pinned at 30 from Tier 1 through Tier 3 in the live trace, only moving at Tier 4 when a new subject was added. This directly contradicts "confidence always increases with additional evidence."
2. **Blueprint's evidence-summary confidence actively dropped at the richest tier tested** — High (Tier 2) → High (Tier 3) → **Medium (Tier 4)**, the exact opposite of the expected direction, because `computeProjectionConfidence()`'s plain mean-of-source-confidence design treats the arrival of legitimate lower-trust-tier evidence (Compass sessions, classroom observations, topical assignments — trust tiers 2–3) as diluting the average, rather than crediting the added diversity of signal. A learner who now has evidence from four different kinds of classroom activity gets told the platform is *less* sure about them than when only exam data existed.

## 5. Traditional Exam-Only Behaviour (Tier 1, Objective 1/11)

**Confirmed correct where it matters most**: at Tier 1 — the state 405 of 406 real students are actually in — Holiday Planner stayed appropriately light (1 session, explicitly hedged parent language: "Current evidence is limited here... no pressure"), and Career Intelligence correctly returned no match at all rather than a premature specific recommendation (`none` at Tier 1 in §3's table). Blueprint's confidence was correctly `Low`. **This is the single most consequential result in this report given the real evidence distribution**: for the overwhelming majority of today's real students, the platform's behavior at their actual evidence tier is sound. Objective 11's requirement — "every learner can still receive meaningful educational guidance even when the school only records traditional examinations" — is met at Tier 1 specifically.

The gap is not at Tier 1. It's one step later.

## 6. Topical Assessment Behaviour (Tier 2/3, Objectives 2/3)

**Tier 2 (opener/midterm/endterm — Objective 2) is where the confirmed bug lives (§7).** Tier 3 (topical assessments added on top — Objective 3) did not correct it: the career recommendation locked in at Tier 2 carried forward essentially unchanged through Tier 3, because the topical evidence added was in the same subject the Tier 2 pick was already built from — it reinforced rather than diversified the evidence base. Capability confidence also failed to rise meaningfully across this same span (§4, finding 1), so Tier 3's additional evidence bought the learner neither more accurate careers guidance nor visibly more confidence — a double miss on the exact scenario ("teachers administer topical assessments inconsistently, but when they do, evidence should compound") the mission's Kenyan Classroom Reality section describes as the near-term aspiration.

## 7. Progressive Personalization Analysis (Objective 12)

Objective 12 requires richer evidence to produce richer personalization, never a different educational truth. Results are mixed:

- **Blueprint's textual conclusion held constant correctly** — the same opportunity insight text appeared at every tier, which is defensible here since the underlying weakest-dimension ranking didn't genuinely change.
- **Career Intelligence violated this in the more serious direction**: the "different truth" didn't emerge gradually and correctly from richer evidence — it emerged **prematurely and incorrectly at Tier 2**, then failed to self-correct when richer, more diverse evidence became available at Tiers 3–4. This is the sharpest violation of Objective 12 found: richer evidence should be able to *revise* an earlier thin-evidence conclusion, and here it visibly could not — the specific career pick and its confidence only grew stronger (0.847 → 1.045) as more evidence arrived, none of which was in a new domain relevant to reconsidering "Agricultural Scientist" as the top match.

## 8. Kenyan Classroom Compatibility Review (Objectives 13/14)

- **SOW / Lesson Plans / Record of Work — confirmed clean isolation from learner intelligence (Objective 13).** No import from `lib/sow/`, `lib/lessonPlan/`, or `lib/row/` into `lib/intelligence/`, `lib/projection/`, or `lib/learnerModel/`, and no reverse dependency either. The only cross-boundary signal is an administrative event (`teacher.lesson_plan.generated`) with no learner-intelligence subscriber, and a legitimate, correctly-scoped aggregate table (`substrand_health`, class-level, no student ID) that feeds the Remedial Planner from evidence, not from SOW content. One naming hazard flagged: `lib/repositories/learner-intelligence.repository.ts` houses functions (`getEvaluatedPlansForSOW`, `getSubstrandHealth`) that actually serve `lib/teachingIntelligence/` (a *teaching*-quality reporting system, separate from student *learner* intelligence) — the shared repository name invites a future engineer to wire a real learner-intelligence consumer into it without realizing today's boundary depends on nobody having done that yet. Not a current violation; a maintainability risk worth a rename.
- **Digital maturity staging (Objective 14)**: Paper-first schools and exam-only schools (Tier 1) are well-served today (§5). Schools adding topical assessments (Tier 2/3) are the ones current findings say need the Career Intelligence fix before that maturity step is safe to reach. Fully evidence-rich schools (Tier 4) were only tested synthetically — no real student in the fixture has reached that tier, so this report's Tier 4 findings (the confidence-drop bug, §4) are forward-looking rather than urgent by current real-data prevalence, but should be fixed before any pilot school naturally grows into that tier.

## 9. Constitution Compliance Matrix

| Article / Philosophy statement | Status this sprint |
|---|---|
| Missing evidence is not poor performance | Held at Tier 1 — confirmed via Holiday Planner and Career Intelligence's correct "no match yet" behavior |
| Sparse evidence produces lower confidence, not lower ability | Held in the conclusions tested (no subsystem converted absence into a negative score) — but the *confidence* side of this pairing is itself broken in two places (§4), which weakens the pairing's practical value even though the "not lower ability" half held |
| AI explains/organizes/prioritizes evidence, never invents truth | Not implicated this sprint — no AI-narrative code path was exercised in the tier simulation (Career Intelligence's over-specialization bug is in the deterministic scoring layer, upstream of any AI call) |
| More evidence increases confidence | **Violated twice**, empirically confirmed (§4) |
| More evidence increases personalization | Held for Blueprint; **violated for Career Intelligence** (§7) — richer evidence failed to revise an earlier wrong conclusion |
| More evidence does NOT change historical truth | Held — no subsystem was found rewriting a past assessment's recorded value; all findings are about present-moment confidence/conclusion computation, not retroactive rewriting |
| Article X — career guidance recommends possibility, never destiny | **Violated at Tier 2**, the sprint's most serious finding |
| Article XIII (this sprint, Objective 13) — SOW/lesson plans stay administrative | **Held, confirmed clean** |

## 10. Educational Risk Ranking (harm order, not engineering elegance)

1. **Career Intelligence's Tier-2 over-specialization (§6/§7)** — highest priority precisely because Tier 2 (three termly exams) is the evidence state nearly every real school will reach within one term, unlike Tier 4 scenarios which remain hypothetical. A parent could be shown a confident, specific career recommendation built from nothing but three math exam scores.
2. **Blueprint's confidence dropping at the richest tier (§4, finding 2)** — lower real-world prevalence today (no real student has reached Tier 4 yet) but directly undermines trust exactly when the platform has done the most work to earn it, and will become live as pilot schools mature.
3. **Capability projector confidence staying flat across Tiers 1–3 (§4, finding 1)** — a quieter trust erosion: a teacher who enters three terms of exam data and never sees the platform's confidence move has no reason to believe repeated data entry is worth the effort.
4. **`updateFromAssessment()`'s memoryless confidence assignment (§4 static findings)** — real but narrower blast radius, confined to the legacy Learner Model path, already flagged elsewhere in this report series as a system being consolidated away.
5. **The `learner-intelligence.repository.ts` naming hazard (§8)** — no current harm, a documented risk for future contributors.

## 11. Recommended Improvements (ranked by educational value, smallest safe fix first)

No architecture change, no new intelligence model — every item is a formula or gate adjustment to existing code:

1. **Gate `qualifiesForEntrepreneurialTier` and the "Strong Match" primary-tier promotion on genuine cross-subject evidence, not raw assessment count.** `confidenceFromAssessmentCount()` currently treats 3 same-subject exams identically to 3 exams across 3 subjects — add a diversity check (distinct subjects/evidence sources) before allowing a specific career to reach "High" confidence, consistent with what the function's own existing code comment already warns against.
2. **Insert a Medium step into `confidenceFromAssessmentCount()`'s Low→High jump** — softens exactly the Tier-2 cliff this sprint found, independent of fix #1, and is a one-line change.
3. **Gate `computeResilience()` on the presence of more than one subject** before it computes a cross-subject trend claim from single-subject data — currently it will compute a full "resilience" score off one subject's trajectory, which is definitionally not a cross-subject signal.
4. **Fix `capabilityProjector.ts`'s confidence dedup** to credit repeated same-subject evidence (even if it correctly uses only the *latest value*, the *confidence* calculation should still account for how many corroborating observations support that latest value).
5. **Change `computeProjectionConfidence()` from a plain mean to a formula that rewards source diversity** rather than penalizing the inclusion of legitimate lower-trust-tier evidence — the fix should make confidence non-decreasing when a new, valid evidence source is added, per the Constitution's explicit invariant.
6. **Extend `confirmedMasteryConfidence()`'s cross-source floor logic to `updateFromAssessment()`'s same-source path**, or explicitly rename/document that field as "current-level confidence" rather than "evidence confidence" if the memoryless design is intentional.
7. **Carried over from Sprint 27, still unresolved and blocking full end-to-end verification**: widen `learner_projections_projector_type_check` to include the V2 projector types. This sprint worked around it via a monkeypatch to test the pure computation layer, but the persistence layer itself remains broken for real students.

## 12. Regression Results

- **TypeScript**: same 2 pre-existing errors as every prior sprint in this series (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`). Zero new errors in application code.
- **ESLint**: zero errors/warnings across every audited directory, including the newly-checked `lib/sow`, `lib/lessonPlan`, `lib/row`, `lib/teachingIntelligence`.
- **Production build**: compiles successfully; type-check step fails only on the same pre-existing `scripts/` file.
- No code was changed this sprint. Both research passes cleaned up their own synthetic test data (confirmed empty post-run) and left no application-code diffs — only the pre-existing `scripts/trace-consistency-audit.ts` from Sprint 27 remains as an untracked file.

## 13. Final Verdict

**CONDITIONAL GO.**

Tier 1 — the state nearly every real student is actually in today — is handled correctly across every subsystem tested, which directly satisfies this mission's final principle ("meet every school where it is today"). The condition is narrow but urgent: **Career Intelligence's Tier-2 over-specialization (§6, §7, §10 item 1) should be fixed before any pilot school completes a full term of exam data**, since that is the evidence state the bug triggers on, and it is not a hypothetical future state — it is the very next thing that will happen to real students already in the system. This is a smaller, more surgical fix than Sprint 27's persistence bug (a threshold/gating adjustment, not a schema migration) and does not require resolving that open item first, since it lives entirely in the pure computation layer this sprint was able to test independently.

Everything else in this report (§11 items 2–6) is ordinary, non-urgent backlog with no confirmed real-world harm yet, appropriate to schedule alongside — not necessarily ahead of — Sprint 27's still-open persistence fix.

## 14. Method Note

Two parallel research passes ran this sprint: one re-read every confidence formula in the codebase fresh and traced the SOW/Lesson Plan/Record-of-Work boundary; one constructed a real evidence-tier simulation, discovering along the way that 405 of 406 real students in the reference-school fixture sit at Tier 1, so Tiers 2–4 required synthetic data (tagged `school = 'SYNTHETIC_TEST_TIER_AUDIT'`, following the existing repo convention, fully deleted and confirmed empty by end of run). Both passes worked around Sprint 27's still-open Projection persistence bug rather than being blocked by it: the tier-simulation pass monkeypatched `repos.projections.upsertProjection` to swallow only the specific known constraint violation while letting every other write execute for real, which let Blueprint and Holiday Planner — both of which internally call the persisting `recomputeLearnerProjection()` — be tested end-to-end despite the unresolved bug. This is a legitimate verification technique for this sprint's purposes (evidence-scaling behavior lives in the computation layer, not the persistence layer) but does not constitute evidence that Sprint 27's bug is fixed — it remains open and blocking for real production traffic.
