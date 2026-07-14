# EduNexus — Canonical Learner Intelligence Verification & Convergence Report

**Sprint 24 — Canonical Learner Intelligence Verification & Convergence**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: full learner-intelligence surface — evidence entry, computation paths, persistence, consumers, caches, refresh triggers, staleness, contradiction risk

---

## 1. Executive Summary

EduNexus does **not** have exactly one canonical educational intelligence system today. It has one clearly-designated canonical system — the Evidence Domain + Projection Engine, which is deterministic, evidence-id-traced, and correctly treats missing evidence as absence rather than failure — plus a substantial, still-live constellation of parallel systems that predate it and have not yet been retired or fully bridged onto it: the Learner Model (`learner_profiles`), the legacy Academic Clinic / `pathwayCalculator.ts` pipeline, a from-scratch "Future Readiness Score" on the student home dashboard, a `student_alerts` table wholly disconnected from Monday Panel, and a 24-hour DB-cached Monday Panel endpoint that coexists with three other live-computed views of the same evidence.

This sprint traced all fifteen requested intelligence domains end-to-end and found **six confirmed places where the same fact about the same learner can be asserted differently on two live, reachable screens at the same wall-clock moment**. None of these are new defects introduced this session — all predate this sprint and several are already self-documented in code comments as known, in-progress migrations. What this sprint adds is a complete, verified map of exactly where they are, so future consolidation sprints (like Sprint 23's capability-profile fix) have a precise target list instead of a suspicion.

One safe, in-scope fix was made this sprint: two identical inline confidence-computation ternaries in `lib/learnerModel/updater.ts` (formative "got_it" confirmation and parent "demonstrated" confirmation) were consolidated into one named helper, `confirmedMasteryConfidence()`. Every other finding below requires a product/architecture decision (which system is canonical, whether a legacy pipeline can be retired) that is explicitly out of this sprint's mandate ("do not redesign architecture") — these are reported as prioritized deferred items, not silently left unmentioned.

**Go / No-Go: GO, with a named priority list for the next consolidation sprint.**

---

## 2. Architecture Trace

Two foundational systems coexist by design, per prior sprints' migration ledger:

- **Evidence Domain** (`lib/intelligence/evidence.ts`, `evidenceLifecycle.ts`, `confidence.ts`) — the only system where evidence enters with a lifecycle (`pending_review` → `auto_confirmed`/`reviewed_confirmed`), trust tiers, and an immutable confidence score. This is the canonical entry point for anything the Projection Engine reads.
- **Projection Engine** (`lib/projection/engine.ts` + 10 projectors) — a pure function of `(learnerId, confirmed evidence, now)`. No caching, no AI calls, recomputed fresh on every call. This is the canonical *computation* layer, and every consumer that calls it (Blueprint, Career Intelligence, Holiday Planner, Parent Pulse, Remedial Planner, Adaptive Learning, half of Monday Panel) gets identical, reproducible output for identical evidence.

Layered on top, still live in production:

- **Learner Model** (`lib/learnerModel/`, table `learner_profiles`) — a materialized, directly-written profile updated from four event types (assessment, Compass, formative signal, parent observation). It predates the Evidence Domain and was never fully retired; a documented "TEMPORARY DUAL-WRITE" comment in `updater.ts:154-160` marks Compass's write into it as intentionally provisional, with a named exit condition. Several live consumers (school-wide admin dashboards, the `term-readiness` cron, half of Monday Panel, the Remedial Planner's student list) still read it directly.
- **Legacy Academic Clinic pipeline** (`lib/pathwayCalculator.ts`, `lib/academicClinic/`, `lib/career/clinicReportBuilder.ts`) — a third, independent readiness/pathway computation still wired to live routes (`/api/academic-clinic/pdf`, `/api/career/intelligence-report`, `/api/parent/assessments/process`).
- **Student home "Future Readiness Score"** (`app/api/student/home/route.ts`) — a bespoke formula computed directly from raw `assessments.subject_scores`, with no relationship to any of the above.
- **`student_alerts` table** (`app/api/teacher/alerts/route.ts`) — a fully separate teacher-alert surface with its own `alert_type` enum, unconnected to Monday Panel or the Projection Engine.

This layering is the expected, previously-documented state of an in-progress migration — Sprint 24's contribution is confirming precisely which of these layers is live, who reads what, and where they can disagree.

## 3. Intelligence Dependency Map

| Intelligence type | Canonical source | Still-live parallel source(s) |
|---|---|---|
| Academic readiness | `academicProjector.ts` (Projection) | Learner Model doesn't compute an equivalent; `pathwayCalculator.ts` and `clinicReportBuilder.ts` compute related-but-different numbers |
| Risk flags / risk level | `riskProjector.ts` (Projection) | `learnerModel/updater.ts`'s `recomputeRiskFlags()`/`computeOverallRisk()` — different taxonomy, different formula |
| Capability profile | `computeCapabilityProfile()` (Sprint 23, `lib/career/capabilityExtractor.ts`) | none remaining on the assessment-history side; Projection-derived `extractCapabilityProfile` (Blueprint/Career Intelligence) is a third, still-separate interpretation using confirmed-evidence-only history |
| Confidence | No single canonical function — four independent implementations (see §4) | — |
| Pathway readiness | None fully canonical — three independent formulas live simultaneously (see §4) | — |
| Career readiness | `capabilityMatchEngine.ts`'s `alignment_score` (Projection-fed) | `clinicReportBuilder.ts`'s separate readiness score feeding the Career Intelligence *Report* (different route from Career Intelligence proper) |
| Blueprint | Projection Engine, live, uncached | — (fully canonical) |
| Holiday Planner | Projection Engine, live, uncached | — (fully canonical) |
| Parent Pulse | Projection Engine, live, uncached | — (fully canonical) |
| Monday Panel | Split: `overallRiskLevel` from Projection (live); per-flag detail, `risk_history`, `weeksAtRisk` from `learner_profiles` (materialized); the batch aggregate endpoint additionally has a 24h DB cache layer on top of both | — |
| Compass | Dual-write: `learnerModel.updateFromCompass` (fire-and-forget) + Evidence Domain emission (fire-and-forget), both unawaited in the same request | — |
| Intervention recommendations | Split: Remedial Planner reads Projection only to gate "critical" grouping, but computes its own subject level from raw marks and reads `learner_profiles` for the student roster; Adaptive Learning reads Projection exclusively and explicitly does not call the Remedial Planner (self-documented divergence) | — |
| Teacher alerts | Split: Monday Panel (Projection + `learner_profiles`) vs. `student_alerts` table (fully independent, no shared computation) | — |
| Student dashboard | `/api/student/home` computes its own "Future Readiness Score" from raw assessments; Blueprint page (same student) reads Projection | — |
| Parent dashboard | Split across 4 different pages, 3 different computations (Report Card: raw repos; Career Intelligence: Projection+capabilityMatchEngine; Career Intelligence *Report*: legacy clinicReportBuilder; Career Report: separate `/api/career/match`) | — |

## 4. Duplicate Reasoning Report

Ranked by concreteness of the resulting contradiction risk:

1. **Pathway/career readiness — three independent, disagreeing formulas, confirmed live contradiction.** `learnerModel/updater.ts`'s `refreshPathwayReadiness()` (simple weighted average of normalized CBC levels), `lib/pathwayCalculator.ts` (gated KJSEA-composite formula with subject thresholds, feeding the Academic Clinic PDF and reports), and `lib/career/clinicReportBuilder.ts:631` (`((avg-1)/3)*100` on raw CBC average, feeding the Career Intelligence *Report*) all compute a "readiness" number from related but not identical inputs, with no shared formula. **Confirmed reachable contradiction**: a parent can open `/parent/career-intelligence` (Projection + `capabilityMatchEngine.alignment_score`) and `/parent/career-intelligence-report` (legacy `clinicReportBuilder` readiness) for the same child and see two different percentages, because the two routes are backed by genuinely different pipelines reading different evidence sets.

2. **Risk flags — two independently-formulated systems, confirmed same-screen contradiction.** `riskProjector.ts` (Projection) and `updater.ts`'s `recomputeRiskFlags()` (Learner Model) use different flag taxonomies (Projection has no `disengaged`/`no_assessment_data`/`language_barrier`/`missing_prerequisite`; Learner Model has no "contradicted evidence" flag), different severity scales (`low/medium/high` vs. `watch/at_risk/critical`), and materially different overall-risk formulas (`computeOverallRisk`'s counting/escalation logic vs. `riskProjector`'s plain max-of-severities). **Confirmed same-screen split**: `app/api/teacher/monday-panel/route.ts` itself reads the *overall risk badge* from Projection (line 82) and the *flag detail text* from `learner_profiles` (lines 108-109) in the same response — a single screen can show a risk level computed one way sitting next to flag wording computed the other way for the same student.

3. **Confidence — four non-agreeing implementations of "how sure are we."** `lib/intelligence/confidence.ts` (ingestion-time, 0-100, trust-tier-capped), `lib/projection/coverage.ts` (projection-time, 0-100, evidence-count/conflict-adjusted), `capabilityMatchEngine.ts`'s `confidenceFromAssessmentCount()` (Low/Medium/High from count alone), and three previously-inline copies in `learnerModel/updater.ts` (Low/Medium/High from CBC *level*, not count) — none share a threshold or code path. Two of the three inline copies in `updater.ts` (formative confirmation, parent confirmation) were identical and have been **consolidated this sprint** into `confirmedMasteryConfidence()`. The remaining three implementations (ingestion confidence, projection coverage confidence, assessment-count confidence) are not literal duplicates of each other — they measure genuinely different things (source trust, evidence coverage, assessment volume) — but no document or code comment currently states which one governs when a UI needs to show "confidence" to a teacher/parent, which is itself a gap worth closing in a future sprint even though no single fix is safe to apply now.

4. **`CareerSignals.readiness_scores` — dead field, no live effect.** Defined in `learnerModel/types.ts:184`, never written by any live code path (`refreshCareerSignals()` never populates it), read only by the already-frozen `_frozen/eils` module. Confirmed harmless — cannot contradict anything because nothing live produces or consumes it — but is orphaned code worth deleting in a cleanup pass.

5. **Remedial Planner vs. Adaptive Learning — self-documented, pre-existing divergence.** `lib/remedial/planner.ts` computes subject level from raw percentage marks and reads `learner_profiles` for its roster; `lib/adaptiveLearning/recommend.ts` reads Projection's level exclusively and explicitly documents (lines 9-25) that it does not call the Remedial Planner. This is not a new finding — the codebase already names this as an un-migrated channel — but it means the same student's subject level, and therefore which "next action" bucket they land in, can differ between the two recommenders.

6. **Student home "Future Readiness Score" — a fourth, fully independent computation.** `app/api/student/home/route.ts`'s `computeFRS()` has no relationship to Projection, Learner Model, or capabilityExtractor. A student can see "Strong" on their home page and a "critical" risk flag on their own Blueprint page in the same session, because the two are unrelated formulas over unrelated windows of evidence.

## 5. Consumer Consistency Audit

- **Fully consistent, canonical, and uncached**: Blueprint, Holiday Planner, Parent Pulse, Remedial Planner's critical-gating (Projection-only parts), Adaptive Learning — all call `recomputeLearnerProjection()` live, every time, with no cache layer between recompute and render. Confirmed no `unstable_cache`/`revalidate` directive anywhere in `lib/holiday/`, `lib/parentPulse/`, or `lib/attentionFeed/panel.ts`.
- **One confirmed cache-vs-live inconsistency**: `app/api/teacher/monday-panel/route.ts`'s batch-aggregate path reads a `monday_panel_cache` DB table with a 24-hour TTL and returns it directly when unexpired, skipping recomputation entirely — while the non-batch Attention Feed path and every other Projection consumer for the same student computes live. This is documented in the code (`aggregate.ts:26-28` explicitly calls out the staleness and ranks the cache below live sources in its own dedup priority), so it is a known, intentional performance tradeoff rather than a silent bug — but it does mean two teacher-facing views of the same student, opened seconds apart, can legitimately show data up to 24 hours apart.
- **Async event-consumer path is currently inert for staleness purposes**: `lib/projection/eventConsumer.ts`'s outbox (`evidence_projection_events`, processed every 5 minutes via a GitHub Actions cron) writes to the persisted `learner_projections` table, but no production consumer reads that table — every real consumer calls `recomputeLearnerProjection()` live instead. The 5-minute cron lag therefore has zero effect on what any teacher or parent currently sees; the persisted table exists only for tests and as a future read-cache that isn't wired in yet.
- **Compass dual-write race is real but narrow**: `app/api/learn/end/route.ts` fires `updateFromCompass()` (Learner Model) and the Evidence Domain's Compass evidence emission both unawaited, in the same request, with no coordination between them. Since Compass-sourced evidence enters at trust tier 1 (confidence capped, mastery claims never auto-confirm — enforced by a hard throw in `lib/compass/autoConfirm.ts`), the Projection-based consumers won't reflect a Compass session's mastery claim until a teacher reviews it regardless, which is by design. The narrower, real risk is that `learner_profiles`-sourced disengagement flags (read by Monday Panel's legacy half) depend on the fire-and-forget `updateFromCompass` promise actually completing before the next read — no retry/backoff exists if it fails silently.

## 6. Educational Authenticity Review

Verified against CBC philosophy and the four specific failure modes named in this sprint's mission:

- **Missing evidence mistaken for weak performance**: Not found. Every projector returns `null` rather than a fabricated score on empty evidence (verified in Sprint 22, re-confirmed this sprint — no projector logic changed since). `refreshPathwayReadiness()` in the Learner Model also correctly leaves untouched pathways alone rather than defaulting them toward zero (`updater.ts` comment at the top of that function states this explicitly and the code honors it).
- **Low confidence mistaken for low ability**: Not found in the canonical chain — `capabilityMatchEngine.ts`'s confidence caveats and score caps explicitly separate "how sure are we" from "how good is the score," and Blueprint/Career Intelligence surface both independently rather than collapsing one into the other.
- **One good assessment mistaken for mastery**: Not found — `capabilityExtractor.ts`'s `detectTrend()` requires multiple data points before claiming "growing"/"accelerating," and `computeCapabilityProfile()`'s assessment-count gating (Sprint 23) caps score ceilings below 2-3 assessments across every consumer that uses it.
- **One poor assessment mistaken for inability**: Not found — the same trend/confidence machinery applies symmetrically; a single low score does not, by itself, escalate `overall_risk_level` past `watch` in either risk-flag system (both require multiple corroborating flags or a specific missing-prerequisite signal for anything above `watch`/`at_risk`).
- **Growth, consistency, longitudinal evidence, and confidence as first-class concepts**: Confirmed present and load-bearing in the canonical Projection/capabilityExtractor chain (trend detection, resilience-as-meta-signal, count-gated confidence). The three legacy pathway/readiness formulas (`pathwayCalculator.ts`, `clinicReportBuilder.ts`, `refreshPathwayReadiness()`) do **not** carry trend or longitudinal weighting the same way — they are point-in-time weighted averages. This is the one place where CBC's "growth over marks" principle is honored inconsistently depending on which of the three readiness pipelines a given screen happens to use.

## 7. Regression Validation

- **TypeScript**: `npx tsc --noEmit` — zero new errors from this session's one code change. The same two pre-existing errors (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`) remain, already present on `main`, outside this sprint's touched files.
- **ESLint**: zero errors/warnings on `lib/learnerModel/updater.ts`.
- **Production build**: `next build` compiles successfully; its type-check step fails only on the same pre-existing, unrelated `scripts/` error.

## 8. Engineering Confidence

**High** in the accuracy of this trace — every finding above was independently verified with file:line citations against the current working tree, not inferred from prior sprint memory. **Medium** in the platform's overall consolidation state — the canonical Evidence Domain/Projection Engine chain is solid and internally consistent wherever it is the sole source, but a meaningful fraction of live, teacher/parent/student-reachable screens still sit outside it, and consolidating them (three readiness formulas, two risk-flag systems, one dead-code field, one bespoke home-page score, one disconnected alert table) is real, multi-sprint work — not something safely done piecemeal without risking behavior changes to live pilot-facing screens.

## 9. Educational Confidence

**High** for the canonical chain: growth, longitudinal evidence, and confidence are genuinely first-class, and no missing-evidence-as-negative-evidence violation was found anywhere in this trace. **Lower** for the platform as a whole while three disagreeing readiness formulas remain simultaneously live — a CBC teacher who noticed a parent's two dashboard screens disagreeing on the same student's "readiness" would reasonably lose trust in the number, even though the underlying evidence and each individual formula are each defensible in isolation.

## 10. Deferred Items (priority order for next consolidation sprint)

1. **Reconcile the two risk-flag systems** (`riskProjector.ts` vs. `updater.ts`'s `recomputeRiskFlags()`) — highest priority given the confirmed same-screen split in Monday Panel itself. Requires a product decision on which flag taxonomy and severity scale is canonical before any code change.
2. **Reconcile the three pathway/career readiness formulas** — second priority given the confirmed cross-page parent-facing contradiction. Likely requires deciding whether the legacy Academic Clinic pipeline (`pathwayCalculator.ts`, `clinicReportBuilder.ts`) can be retired in favor of the canonical Projection + `capabilityMatchEngine` path, or must be kept for a specific reporting need.
3. **Decide the fate of the student home "Future Readiness Score"** — either retire it in favor of Projection-derived signals, or explicitly document it as a deliberately simpler, different-purpose metric so it stops reading as a contradiction.
4. **Reconcile or explicitly separate `student_alerts` from Monday Panel** — determine whether `student_alerts` is a legacy system pending retirement or a genuinely distinct manual-alert feature that should be labeled as such in the UI.
5. **Delete the dead `CareerSignals.readiness_scores` field** — low-risk cleanup, no live consumer, safe whenever convenient.
6. **Document which of the four confidence computations governs which UI surface** — not a code fix, a documentation gap; would prevent future contributors from adding a fifth.
7. **Remedial Planner / Adaptive Learning divergence** — already self-documented in-code; re-confirm it's still on the team's migration roadmap rather than forgotten.

None of these are pilot-blocking emergencies for the 50 beta teachers today — each is a real but bounded consistency gap between legacy and canonical systems, not a correctness failure within the canonical system itself.

## 11. Go / No-Go Recommendation

**GO.** The canonical Evidence Domain + Projection Engine chain is deterministic, evidence-first, and educationally sound everywhere it is the sole source of truth for a screen. The confirmed contradictions are all between that canonical chain and specific, named legacy systems that predate it — not defects within the canonical system — and every one is now precisely located and prioritized rather than merely suspected. Recommend the next dedicated sprint target item #1 (risk-flag reconciliation) and #2 (readiness-formula reconciliation) specifically, since those are the only two with confirmed, reachable, same-session contradictions today.
