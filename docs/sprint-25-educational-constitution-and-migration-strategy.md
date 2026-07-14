# EduNexus — Educational Constitution & Canonical Intelligence Migration Strategy

**Sprint 25 — Educational Constitution & Canonical Intelligence Migration Strategy**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: not a coding sprint — a constitutional document plus a migration strategy that reuses Sprints 22–24's findings, reframed against explicit, CBC-defensible principles. No code changed.

---

## 1. Method

This sprint did not re-derive the platform's technical state from scratch — Sprints 22 (audit), 23 (capability consolidation), and 24 (full trace, six confirmed contradictions) already did that work today, and their findings are verified against file:line citations in the working tree. This sprint's job was different: read what those subsystems *already assume* about good educational judgment — much of it never written down, only enforced in code — and state it as one Constitution, then use that Constitution as the decision criterion for the migration roadmap Sprint 24 left as a priority list.

Every principle below is traced to a real behavior in a real file, not invented. Where a subsystem violates a principle it otherwise embodies elsewhere, that's flagged directly — a constitution is only useful if it can convict the platform's own code.

---

## 2. The Educational Constitution

### Article I — Evidence is the only currency of truth

**"A projection may not exist without supporting evidence."** `lib/projection/types.ts:1-7` states this as the literal contract of the `Projection<T>` type, and `lib/projection/engine.ts`'s projectors return `null` — never a fabricated zero, never a default — when there is nothing to project from. This is not a style choice; it is the single load-bearing invariant the rest of the platform's trust depends on.

*CBC defense:* CBC assessment is criterion-referenced and evidence-based by design (rubric levels 1–4 tied to observable performance, not norm-referenced ranking). A system that infers a score without an observation contradicts the framework it claims to implement.

### Article II — Missing evidence is never poor performance

`refreshPathwayReadiness()` (`lib/learnerModel/updater.ts`) explicitly leaves a subject's pathway readiness untouched — not defaulted toward zero — when no assessment exists for it. Every Projection Engine projector does the same by returning `null` rather than a floor value.

*CBC defense:* A learner who has not yet been assessed in a strand has not "failed" it. Treating absence as failure would punish incomplete data collection rather than the learner — indefensible under any competency framework, and specifically dangerous in a rollout with 50 pioneer beta teachers whose data entry is itself uneven.

### Article III — Confidence measures certainty, not ability

`capabilityMatchEngine.ts`'s `confidenceFromAssessmentCount()` and `lib/projection/coverage.ts`'s evidence-count/conflict-adjusted score are both explicitly separate axes from the capability/score value they annotate — Sprint 22 confirmed Blueprint and Career Intelligence surface both independently rather than collapsing one into the other.

*CBC defense:* A student assessed once at Level 4 is not "less capable" than one assessed five times at Level 4 — they are equally capable but less *certainly known*. Conflating the two teaches learners and parents to distrust an assessment for the wrong reason.

### Article IV — Growth outranks isolated performance

`capabilityExtractor.ts`'s `detectTrend()` requires multiple corroborating data points before it will claim "growing" or "accelerating." Both risk-flag systems (`riskProjector.ts` and `updater.ts`'s `computeOverallRisk()`) require multiple corroborating flags — or a specific missing-prerequisite signal — before escalating past `watch`/`low`; a single low score never alone triggers `critical`/`high`.

*CBC defense:* CBC's stated purpose is competency development over time, not single-sitting ranking. A platform that let one bad day override a trend line would be re-implementing the exam-centric model CBC was built to replace.

### Article V — Risk predicts support needs, never worth

Risk severities across both systems are named `watch` / `at_risk` / `critical` (Projection) and `low`/`medium`/`high` (Learner Model) — action-oriented labels describing what support is needed next, never learner-worth language. `lib/remedial/planner.ts` and `lib/adaptiveLearning/recommend.ts` both consume risk to route *interventions*, never to gate opportunity or visibility.

*CBC defense:* Flagging risk exists to trigger the teacher's next pedagogical move, not to sort learners into fixed tiers — the moment a risk flag reads as a verdict on the child rather than a cue for the adult, it stops being educational and starts being a label.

### Article VI — AI explains evidence; it never invents it

`careerIntelligenceEngine.ts:466` states this as an explicit prompt-level rule, hardened in Sprint 23 after Sprint 22 caught the model inventing "hidden strengths": *"Never claim to reveal something 'hidden,' 'undiscovered,' or a 'natural genius' / 'innate talent' — describe strengths as what the evidence shows... not as claims about hidden or innate ability."* Sprint 23 also wired `assessmentCount`/`confidenceLevel` into the same prompt so the model's hedging language scales with actual evidence volume.

*CBC defense:* This is the platform's core commercial differentiator per the 2026-07-07 evidence-first mandate — but it is also the only defensible way to deploy generative AI in a system making claims about children's abilities. An AI that "discovers" a hidden talent is making an unfalsifiable, unverifiable claim to a parent who has no way to check it.

### Article VII — Evidence needs corroboration before it becomes claimable truth

`lib/compass/autoConfirm.ts:56` contains a hard `throw` guarding against auto-confirming a mastery claim from an AI tutoring session — Compass-sourced evidence enters at trust tier 1, capped confidence, and cannot silently become "the record" without a human or a stronger corroborating signal.

*CBC defense:* An AI tutor's read of a learner's understanding, however good, is a single low-trust observation — treating it as equivalent to a teacher's marked assessment would launder AI inference into the same evidentiary weight as human judgment, without the accountability a human assessor carries.

### Article VIII — A teacher approves before a claim reaches a parent

The Holiday Planner's publish gate (`holiday_plans.is_published`, shipped 2026-07-07) means the Learner Model *proposes* holiday work but a teacher must *approve* it before `buildParentAction()` in `lib/learnerIntelligence/blueprint.ts` will surface it to a parent — with only a 3-day auto-publish fallback so a plan doesn't rot unseen, not as a way to skip the teacher.

*CBC defense:* CBC positions the teacher as the accountable professional judgment in the loop, not a rubber stamp on an algorithm. A platform-generated recommendation reaching a parent without any teacher able to catch an error would substitute software judgment for professional judgment in a context (a child's holiday learning plan) where the school, not the platform, is accountable to the parent.

### Article IX — Every recommendation must be traceable to its evidence

The Projection Engine's `supportingEvidenceIds: string[]` field is non-optional on every `Projection<T>` — there is no code path that produces a projection value without also producing the evidence IDs behind it. The evidence-first mandate's four-layer shape (Observation / Evidence / Confidence / Action) is the same requirement stated as a product rule.

*CBC defense:* A parent or teacher must be able to ask "why does it say this" and get a real answer pointing at specific marks, observations, or sessions — not a black-box score. This is what separates an evidence-based intelligence system from a prediction engine wearing an evidence-based UI.

### Article X — Career guidance recommends possibility, never fixed destiny

The 2026-07-07 mandate's split is explicit: Junior (G7–9) explores broad career *families* with evidence, with no career prediction; Senior (G10–12) gets pathway readiness scored with confidence, still framed as guidance rather than a verdict. `qualifiesForEntrepreneurialTier`'s assessment-count gate (Sprint 23) exists specifically so a single assessment cannot promote a specific career recommendation.

*CBC defense:* Career guidance for a 13-year-old that reads as a prediction rather than an invitation to explore forecloses identity development CBC's own career pathways framework is designed to keep open through Grade 9.

### Article XI (self-critical) — A number without a name is not neutral

Sprint 24 found the platform currently violates its own Article IX in a specific, bounded way: three independent, disagreeing "readiness" formulas (`refreshPathwayReadiness()`, `pathwayCalculator.ts`, `clinicReportBuilder.ts:631`) and two independent, disagreeing risk-flag systems (`riskProjector.ts` vs. `recomputeRiskFlags()`) are both live and reachable on the same student in the same session. Neither is malicious or careless in isolation — each is individually defensible — but presenting two different "readiness %" numbers to the same parent on two pages violates Article IX (traceability implies *one* traceable answer, not a choice of two) even though every individual number is honestly computed.

This article exists so the Constitution cannot be read as declaring victory — it names the platform's current largest gap between principle and practice, which is exactly what the migration roadmap below targets.

---

## 3. Canonical Intelligence Principles (operational form)

Translating Articles I–XI into rules any new or migrated code must satisfy:

1. **No projection without evidence IDs.** Any function that returns a score, level, or flag about a learner must also return the evidence records it was computed from, or return `null`/absent — never a default.
2. **Confidence is a first-class, separate field from the value it annotates** — never blended into the score, never omitted from the response shape.
3. **Multiple corroborating points before a trend or escalation claim.** A single data point may support an *observation*; it may never alone support a "growing," "declining," or "critical" classification.
4. **One evidence taxonomy, one lifecycle.** Evidence enters, is trusted at a tier appropriate to its source, and reaches confirmed status only through the Evidence Domain's lifecycle (`pending_review → auto_confirmed`/`reviewed_confirmed`) — not through a parallel ad hoc write.
5. **One formula per intelligence type, platform-wide.** If two implementations compute "readiness," "risk," or "capability" for the same concept, that is a defect to resolve, not a difference of opinion to preserve — this is the direct operationalization of Article XI.
6. **AI narrates; it does not decide or discover.** Any DeepSeek call touching learner ability must be fed the evidence and confidence it is narrating, and its prompt must forbid claims the evidence doesn't support (per the Article VI grounding-rules pattern already proven in `careerIntelligenceEngine.ts`).
7. **A human checkpoint precedes any claim reaching a parent that the platform generated rather than a teacher entered**, unless the claim is itself raw evidence the teacher/student directly supplied (e.g., a marked assessment needs no extra gate; an AI-drafted holiday plan does).
8. **Consumers read the canonical computation, never re-derive it.** A route or report that needs a capability profile, readiness score, or risk level calls the one canonical function (`computeCapabilityProfile()`, the Projection Engine, etc.) — it does not run its own query + formula, per the exact anti-pattern Sprint 23 fixed four times over.

---

## 4. Duplicate-System Matrix

Built directly on Sprint 24's dependency map (§3) and duplicate reasoning report (§4), scored against the Constitution above.

| # | Duplicate pair | Which satisfies the Constitution better | Canonical candidate | Retire candidate | Consumers to migrate | Migration complexity | Backward compat | Pilot risk | Production risk |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Risk flags: `riskProjector.ts` (Projection) vs. `recomputeRiskFlags()`/`computeOverallRisk()` (Learner Model) | Projection — evidence-id-traced (Art. IX), `null`-safe, action-oriented severity naming (Art. V) already closer to constitutional language | `riskProjector.ts` | `learner_profiles`-sourced flag detail/severity | Monday Panel (flag-detail half), Remedial Planner's roster read, `term-readiness` cron | Medium — requires a taxonomy mapping table (Learner Model's `disengaged`/`no_assessment_data`/etc. have no Projection equivalent yet) before flag *text* can move, not just the badge | Must preserve existing flag reason strings teachers already recognize, or explicitly re-train them | Low — flags are advisory, not gating; a transition period showing both is safe | Medium — Monday Panel is a daily teacher-facing surface; a silent formula change could visibly move who shows as "at risk" |
| 2 | Readiness: `refreshPathwayReadiness()` (Learner Model) vs. `pathwayCalculator.ts` (legacy Academic Clinic) vs. `clinicReportBuilder.ts:631` (legacy Career Report) | None fully — all three are point-in-time weighted averages, none carry trend/longitudinal weighting the way `capabilityExtractor.ts` does (Art. IV violation shared by all three) | New: a `readinessProjector.ts` added to the Projection Engine, built the same way `academicProjector.ts`/`capabilityV2Projector.ts` already were | All three legacy formulas, once the new projector is proven | `/api/academic-clinic/pdf`, `/api/career/intelligence-report`, `/api/parent/assessments/process`, `/parent/career-intelligence-report` | High — this is new projector work, not a swap; the legacy formulas encode specific KJSEA-composite subject-threshold business logic (`pathwayCalculator.ts`) that must be preserved or explicitly deprecated with sign-off, not silently dropped | The three current numbers are all "live" to some parent right now — changing any of them changes what a parent sees mid-term, which needs a communicated cutover, not a silent swap | Medium — Academic Clinic PDF is a real deliverable schools have seen before; changing its readiness number without notice could look like an error | High — this is the confirmed cross-page parent contradiction from Sprint 24; it is also the most technically involved item on this list |
| 3 | Confidence: 4 implementations (ingestion, projection coverage, assessment-count, formerly-triplicated inline — already de-duplicated once in Sprint 24) | Each measures a genuinely different thing (Art. III explicitly treats confidence as multi-dimensional) — this is *not* a true duplicate the way #1/#2 are | N/A — no single winner; needs documentation, not consolidation | None | N/A | Low — this is a docs task per Sprint 24's own finding | N/A | Low | Low — but leaving it undocumented risks a 5th implementation appearing |
| 4 | `CareerSignals.readiness_scores` dead field | N/A — orphaned, unreachable | N/A | Delete | None (only `_frozen/eils`, already dead) reads it | Trivial | None | None | None |
| 5 | Remedial Planner (`lib/remedial/planner.ts`, raw-marks subject level) vs. Adaptive Learning (`lib/adaptiveLearning/recommend.ts`, Projection-only) | Adaptive Learning — reads Projection exclusively, Art. I/IX compliant | Adaptive Learning's Projection read | Remedial Planner's raw-marks subject-level computation (not the planner itself — user has explicitly ruled `adaptiveLearning.ts` a permanent core system, and Remedial Planner's prerequisite-graph traversal is real, working, differentiated functionality worth keeping) | Remedial Planner's subject-level gate only | Low-Medium — swap one internal calculation, keep the prerequisite-graph output (the planner's actual value-add) untouched | Low — the planner's headline feature (prerequisite root-cause) is unaffected | Low | Low — self-documented, pre-existing, bounded to which subjects get flagged as needing remediation |
| 6 | Student home "Future Readiness Score" (`app/api/student/home/route.ts`) vs. Blueprint (Projection) | Blueprint — the FRS has zero evidence-id trace (Art. I/IX violation) | Projection-derived summary | `computeFRS()` | Student home page only | Low — single route, single consumer, no shared state to untangle | The home page currently shows *something* every student expects to see; can't go blank | Low — student-facing only, not parent/teacher | Low — but it's the most visible same-session contradiction a *student* (not just a parent) can personally notice |
| 7 | `student_alerts` table vs. Monday Panel | Neither is inherently wrong — this may be a legitimately distinct manual-alert feature, not a duplicate | Undetermined — needs a product decision (Sprint 24's own conclusion), not an engineering one | Undetermined | N/A until decided | N/A | N/A | Low | Low — no confirmed contradiction, just an undocumented relationship |

---

## 5. Canonical Source-of-Truth Map

| Intelligence domain | Canonical system (post-Sprint-23) |
|---|---|
| Evidence entry, trust tiers, lifecycle | Evidence Domain (`lib/intelligence/evidence.ts`, `evidenceLifecycle.ts`, `confidence.ts`) |
| Academic performance, knowledge state, behaviour, growth, completeness | Projection Engine (`lib/projection/engine.ts` + projectors) |
| Capability profile | `computeCapabilityProfile()` (`lib/career/capabilityExtractor.ts`, Sprint 23) |
| Blueprint, Holiday Planner, Parent Pulse | Projection Engine, direct, uncached — already fully canonical, no action needed |
| Career alignment / matching | `capabilityMatchEngine.ts`, Projection-fed |
| **Not yet canonical (this sprint's targets):** readiness/pathway score, risk flags, student home summary | See Duplicate-System Matrix above |

---

## 6. Recommended Migration Order

Ordered by the mission's stated priority: (1) lowest educational risk, (2) lowest engineering risk, (3) highest consistency gain. Reuses Projection Engine services throughout — no new architecture.

**Stage 0 — zero-risk cleanup (do anytime, no sequencing dependency):**
- Delete dead `CareerSignals.readiness_scores` field (#4).
- Document which of the four confidence computations governs which UI surface (no code change, closes Sprint 24's item #6).

**Stage 1 — Remedial/Adaptive subject-level unification (#5):**
Lowest risk of the substantive items — bounded to one internal calculation, doesn't touch the planner's differentiated prerequisite-graph feature, self-documented in code already so the fix is expected, not a surprise. Swap Remedial Planner's raw-marks subject-level read for the same Projection read Adaptive Learning already uses.

**Stage 2 — Student home "Future Readiness Score" retirement (#6):**
Single consumer, single route, no shared state — lowest engineering complexity of the visible-contradiction items. Replace `computeFRS()` with a Projection-derived summary consistent with what the same student sees on their Blueprint.

**Stage 3 — Risk-flag reconciliation (#1):**
Higher engineering complexity than Stage 1/2 (needs a taxonomy mapping before Learner Model's extra flag types can be represented in Projection's vocabulary) but directly resolves Sprint 24's single confirmed *same-response* contradiction (Monday Panel's own API returning a Projection-sourced badge next to Learner-Model-sourced flag text). Requires a product decision: adopt Projection's `watch/at_risk/critical` scale platform-wide, and either add Learner Model's extra flag types (`disengaged`, `no_assessment_data`, `language_barrier`, `missing_prerequisite`) to `riskProjector.ts` or explicitly decide they're superseded.

**Stage 4 — Readiness/pathway formula unification (#2):**
Highest engineering complexity (new projector, not a swap) and highest consistency gain (resolves the confirmed cross-page parent contradiction) — sequenced last because it requires the most product sign-off (which of `pathwayCalculator.ts`'s KJSEA-composite business rules survive into the new projector) and touches the most parent-facing legacy surfaces (Academic Clinic PDF, Career Intelligence Report).

**Stage 5 (undetermined, needs a product conversation first) — `student_alerts` vs. Monday Panel (#7):**
Not sequenced numerically because it isn't yet known whether this is a duplicate at all — resolve via a product decision, then re-enter this roadmap at whatever stage its answer implies.

---

## 7. Risk Analysis

- **Stage 1–2 are safe to schedule immediately** — bounded blast radius, no parent-visible number changes beyond fixing an already-known internal contradiction, and both have direct code precedent (Sprint 23's consolidation pattern) to follow.
- **Stage 3 carries real teacher-trust risk if done silently** — Monday Panel is a daily-use surface; a risk severity that moves a name from "watch" to "at_risk" (or vice versa) under the new unified formula needs a release note, not a silent deploy, even though the underlying fix is correct.
- **Stage 4 carries real parent-trust risk if done without communication** — three formulas currently produce three different numbers some parents have already seen. Collapsing to one, however more correct, changes what specific families see mid-term. This is the one item on the roadmap that plausibly needs a short heads-up to pilot schools before shipping, not just a changelog entry.
- **Cross-cutting risk**: none of these stages should be batched into one PR. Sprint 23's precedent (four separate capability-computation call sites fixed together) worked because it was one well-scoped concept; readiness and risk are different concepts with different consumers and should ship as independent, separately-verified changes.

## 8. Regression Risks

- Any change to `riskProjector.ts` or `recomputeRiskFlags()` must be re-verified against Monday Panel's existing consumers (`app/api/teacher/monday-panel/route.ts`, the `monday_panel_cache` batch path, `term-readiness` cron) — the cron in particular reads Learner Model directly today and would silently keep doing so unless explicitly repointed.
- Any change to readiness formulas must be re-verified against every route Sprint 24 named as a legacy consumer: `/api/academic-clinic/pdf`, `/api/career/intelligence-report`, `/api/parent/assessments/process`, `/parent/career-intelligence-report`.
- No stage in this roadmap touches the Evidence Domain or Projection Engine's core contract (Article I/IX) — regression surface is bounded to the specific formulas/fields named, not the canonical chain itself, which Sprint 24 already confirmed is internally consistent.

## 9. Engineering Confidence

**High.** Every item in the migration roadmap is a named, file:line-verified, previously-scoped finding (Sprints 22–24) — this sprint added a decision framework (the Constitution) on top of already-solid technical groundwork, not new discovery. The one genuinely new engineering work item (Stage 4's new readiness projector) follows an established, proven pattern (`academicProjector.ts`, `capabilityV2Projector.ts`) rather than inventing a new one.

## 10. Educational Confidence

**High** that the Constitution itself is defensible — every article is traced to a real, already-shipped behavior, not aspirational language, and Article XI's self-critical inclusion means the document doesn't overclaim the platform's current state. **Medium-high** that following this roadmap in order improves educational consistency without introducing new risk — the ordering explicitly sequences the highest-stakes, highest-complexity change (readiness unification) last and behind a product decision, rather than rushing the most parent-visible fix first.

## 11. Go / No-Go

**GO** — on the Constitution as a governing document, effective immediately for all new intelligence work (Principle 8 in particular: no new code may re-derive a computation that already has a canonical source). **GO, staged** — on the migration roadmap, starting with Stage 0–1 (zero/low-risk) as soon as capacity allows, with Stage 3–4 explicitly gated on the product decisions named above rather than scheduled as pure engineering work.

This Constitution does not replace Sprints 22–24's findings — it gives them a name and an ordering principle. Future audits should check new code against Articles I–X directly, and treat any new duplicate computation as a de facto Article XI violation to be logged, not silently tolerated.
