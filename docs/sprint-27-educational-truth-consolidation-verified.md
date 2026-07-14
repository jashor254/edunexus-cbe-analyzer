# EduNexus — Educational Truth Consolidation (Verified Pass)

**Sprint 27 — Educational Truth Consolidation, re-issued under a "trust no previous report" standard**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: this document **supersedes** `docs/sprint-27-educational-truth-consolidation.md` (the same-day earlier pass, which synthesized Sprints 22-26 without independently re-executing code against live data). This pass re-verified every claim directly in code and, where possible, against the live Supabase project with real students. It found something the earlier, reading-only passes could not have found: **the canonical chain does not currently work in production for real evidence-bearing students.**

---

## 1. Executive Summary

Every prior sprint in this series (22–27) audited EduNexus's intelligence layer by reading code and reasoning about call sites. That work was real and its findings mostly still hold. But this sprint's instruction — "trust no previous report, verify every claim directly in code," including running real functions against real data — surfaced a class of finding static reading cannot reach: **`recomputeLearnerProjection()`, the single function Blueprint, Holiday Planner, Monday Panel, and Remedial Planner all depend on, currently throws for every student with confirmed evidence in a V2-projectable dimension.** Root cause: `learner_projections`'s database CHECK constraint (`supabase/migrations/20260707_learner_projections.sql`) was never widened when Projection V2 (`capabilityV2`, `trendV2`, `knowledgeV2`) was added to the projector list in `lib/projection/recompute.ts`. This was verified against the live database's actual constraint definition, not inferred.

This is not an architectural duplication or a contradiction between two truths — it is the **absence of any truth at all** for real students, in the platform's flagship canonical surfaces, discovered only because this pass executed the real functions instead of reading about them.

Beyond that headline, this pass also found: a confirmed evidence-fabrication bug in Career Intelligence's `buildHiddenStrengths`/`buildGrowthBarriers` (zero-evidence dimensions can be narrated as real strengths/weaknesses); that Sprint 23's "capability pipeline unified" claim no longer holds (Blueprint and Career Intelligence read two different tables again); a fully independent third capability/readiness pipeline (`clinicReportBuilder.ts`) feeding three live consumers including a parent-facing PDF; a not-yet-migrated cron job (`term-readiness`) still reading the legacy risk field; a new same-page contradiction on the teacher dashboard; and a real (if contained) Compass reward-inflation bug. Full detail below.

**Verdict: NO-GO on the canonical chain's current production readiness for evidence-bearing students, CONDITIONAL GO on everything else.** Detail in §15.

---

## 2. Canonical Intelligence Map

| Intelligence type | Intended canonical source | Actual current production state |
|---|---|---|
| Evidence entry, lifecycle | Evidence Domain (`lib/intelligence/`) | Working — 407 confirmed `learner_evidence` rows verified live across 406 students |
| Academic/capability/risk/growth projections | Projection Engine (`lib/projection/engine.ts`) | **Computation is correct** (verified by calling the pure function directly and inspecting output); **persistence is broken** (`recomputeLearnerProjection()`'s DB write throws — see §3.1) |
| Blueprint | Projection Engine | **Throws for real evidence-bearing students** (depends on the broken call above) |
| Holiday Planner | Projection Engine | **Throws for real evidence-bearing students**, same root cause |
| Monday Panel (risk badge) | Projection Engine | **Throws when building the class-wide projection map**, same root cause |
| Career Intelligence — capability-matches | `computeCapabilityProfile()` reading legacy `assessments` table | Working, but reads a different, often staler table than Blueprint (§3.2) |
| Career Intelligence — Report | `clinicReportBuilder.ts`, fully independent | Working, but is a third pipeline, not Projection-derived at all (§3.4) |
| Remedial Planner | Raw marks, Projection only for the critical-gate | Working (untested end-to-end live due to missing `scheme_of_work` fixture, but code path confirmed) |

---

## 3. Duplicate Reasoning Inventory (re-verified, includes this pass's new findings)

### 3.1 [NEW, CRITICAL] Projection persistence is broken for V2 projector types

`lib/projection/recompute.ts`'s `PROJECTOR_TYPES` includes `capabilityV2`, `trendV2`, `knowledgeV2`, but the live `learner_projections_projector_type_check` CHECK constraint (confirmed via `pg_get_constraintdef` against the live DB) only permits the 7 V1 types. Every real student with evidence that produces a non-null V2 projection causes `upsertProjection()` to throw inside a `Promise.all`, which rejects the entire `recomputeLearnerProjection()` call. **Classification: not a duplicate-truth problem — a no-truth problem.** This is more severe than anything the "duplicate truths" framing in Sprints 24–27 anticipated, because a duplicate at least produces *an* answer; this produces none, for Blueprint, Holiday Planner, and Monday Panel simultaneously, for what this sprint's live query showed is the large majority of evidence-bearing students (essentially all 406 reference-school-fixture students carry V2-triggering evidence).

### 3.2 [SHARPENED] Sprint 23's "unified capability pipeline" claim does not currently hold
Sprint 23 (`docs/sprint-23-canonical-intelligence-consolidation-report.md`) reported consolidating four duplicate capability computations into one `computeCapabilityProfile()`. Live-data tracing this sprint shows **Blueprint does not call that function** — it uses `projectionToScoreHistory()` (`lib/learnerIntelligence/projectionAdapters.ts`, explicitly labeled "TEMPORARY COMPATIBILITY SHIM"), reading Evidence Domain data, while Career Intelligence's `getCapabilityProfile()` reads a **persisted row** ultimately sourced from the legacy `assessments` table via `computeCapabilityProfile()`. For a real student (Evans Ndege), this produced visibly different facts: Evidence Domain said Mathematics CBC level 3 (July 10 evidence), the legacy assessments table said raw score "1/4" (May 28 assessment) — a live, reproducible divergence on the same student's math ability, sourced from two different tables at two different points in time. **Classification: user-visible contradiction, educational risk.** This is a confirmed regression or drift from what Sprint 23 believed it had fixed — worth noting explicitly as an instance of "trust no previous report" paying off.

### 3.3 [NEW] Confirmed evidence-fabrication bug in Career Intelligence's Hidden Strengths / Growth Barriers
`careerIntelligenceEngine.ts:226` (`if (profile[dim].raw_score < 0.35) break`) and `:266` (`if (profile[dim].raw_score > 0.60) break`) gate on `raw_score` alone. The zero-evidence fallback score computed by `capabilityExtractor.ts:112-114` is exactly `0.35` — not `< 0.35` — so a dimension with **zero evidence and `confidence: 0`** passes the guard and gets narrated as a "Hidden Strength" ("Quietly strong at breaking complex problems...") or a "Growth Barrier" ("...needs development"), neither function checking `.confidence` anywhere. The same unguarded `raw_score` flows into `capabilityMatchEngine.ts`'s `scoreCareer()` (lines 233-262), producing full gap narratives from fabricated evidence. **Classification: educational risk — direct violation of Constitution Article I and Objective 4 of this sprint ("Missing evidence ≠ poor performance," and its mirror, missing evidence ≠ a strength either).** This is new; no prior sprint's static read caught it, because the bug requires knowing the exact fallback constant (0.35) and the exact guard boundary (< 0.35) don't overlap — a one-character-away miss, not visible from function names or comments.

### 3.4 [RE-CONFIRMED, sharpened] `clinicReportBuilder.ts` is a fully independent third pipeline
Queries `assessments` directly for the single most recent row, computes its own `overall_score`, `overall_level`, `readinessScore`, and narrative — zero confidence/evidence-count gating anywhere in the file, zero contact with Projection or Evidence Domain. Confirmed **three live consumers**: `app/api/career/clinic-report/route.ts`, `lib/career/autoReportGenerator.ts` (automated parent PDF generation), and `careerIntelligenceEngine.ts` (as the "deterministic backbone" for the whole Career Intelligence Report, including the fabrication-prone Hidden Strengths section above). **Classification: user-visible contradiction, educational risk.** A parent can see a different readiness number in the Academic Clinic PDF than in the Blueprint PDF for the same student on the same day.

### 3.5 [RE-CONFIRMED] Risk flags — two systems, and one migration gap not previously named
Monday Panel's risk badge (Projection) vs. flag-detail text (`learner_profiles`) split is accurate and, per its own in-code comment, deliberate — re-confirmed, not new. **New this pass**: `app/api/cron/term-readiness/route.ts` still reads `learner_profiles.overall_risk_level` directly (lines 125-138, 189-207) and was never migrated to Projection, unlike Monday Panel, Remedial Planner, and Attention Feed, which all explicitly moved off that field. **Classification: user-visible contradiction.** The weekly WhatsApp "Term Readiness Brief" sent to teachers can state a different risk status than Monday Panel or Parent Pulse for the same student in the same week.

### 3.6 [NEW] Teacher dashboard: hero stat tile vs. Attention Feed, same page
`app/teacher/dashboard/page.tsx`'s "Needs Attention" hero tile counts `student_alerts WHERE is_resolved=false` — a legacy table populated only from raw-score-position logic in the marks-entry route, with zero Projection/risk-engine involvement — while the `<AttentionFeed />` component directly below it on the same page is Projection-sourced. **Classification: user-visible contradiction, freshly confirmed on a specific page not previously named in this pairing.**

### 3.7 [NEW, contained] Compass XP-bonus bug
`app/learn/page.tsx:700-706` sets `genuineProgress=true` whenever an AI eval block exists at all, without reading the AI's actual `genuine_progress` boolean inside it (the destructure at line 683 discards that field). This client-computed flag is POSTed to `/api/learn/end` and directly drives a +60 XP "genuine progress" bonus (`app/api/learn/end/route.ts:23-28`), which fires on essentially every normal session completion regardless of the AI's real verdict. **Containment**: the Evidence Domain's actual mastery-claim gate (`lib/compass/evidence.ts:111`) is unaffected — it correctly reads the server-side `masteredConcepts` array, built from the AI's real per-exchange `genuine_progress` field, not from this buggy client flag. So the Learner Intelligence chain stays correct; only the XP number shown to the student is a false claim. **Classification: educational risk, narrow blast radius** — this is exactly the class of finding Sprint 26 flagged in principle (unhedged claim reaching a child) and this pass found a second, concrete instance of it, independent of the XP/level-up gating gap Sprint 26 already named.

### 3.8 [NEW, dead code, low risk] "Level up!" feature is inert
`compass_sessions.ending_level` is written nowhere in the codebase (only `starting_level` is ever set). `levelGained` is therefore always `false`; the "Level up!" badge and the same-day "level gained" indicators on `/api/parent/compass-activity` and `/api/student/home` can never fire. **Classification: harmless duplication (fails safe)** — flagged because it means part of the reward system Sprint 26 scrutinized has actually been non-functional the whole time, not because it produces a wrong claim.

### 3.9 [RE-CONFIRMED, exactly as documented] Remedial Planner vs. Adaptive Learning
`lib/remedial/planner.ts` computes subject level from raw marks (lines 86-93), Projection used only for the critical-gate; `lib/adaptiveLearning/recommend.ts` reads Projection exclusively and explicitly documents not calling the Remedial Planner. Verified fresh, matches its own in-code comments exactly — **not** a hidden divergence, a tracked and intentional one. **Classification: architectural duplication, bounded educational risk**, unchanged from prior sprints.

### 3.10 Everything else from Sprints 24–27 not contradicted this pass
Confidence-computed-then-dropped pattern (Career Report, Parent Pulse, Remedial Planner types with no confidence field), the three-formula readiness split, `student_alerts` vs. Monday Panel's undetermined status, and the dead `CareerSignals.readiness_scores` field were all spot-checked in this pass's research and found unchanged — no new contradiction, no resolution either.

---

## 4. User-visible Contradiction Matrix

| Contradiction | Teacher | Parent | Learner | Admin | API/Export | Cron/Notification |
|---|---|---|---|---|---|---|
| Projection persistence broken (§3.1) | Blueprint/Holiday/Monday Panel unusable | Blueprint PDF unusable | Blueprint unusable | Any admin view built on Projection unusable | `recomputeLearnerProjection` throws for any caller | N/A directly, but any cron calling Projection would also fail |
| Blueprint vs. Career capability tables (§3.2) | Sees Blueprint's evidence-sourced level | Sees Career Intelligence's assessments-sourced level on a different screen | N/A directly | N/A | Both API routes return real, disagreeing data | N/A |
| Fabricated Hidden Strengths (§3.3) | Not directly exposed to teacher UI (career report is parent/student-facing) | **Yes** — reads a fabricated strength/weakness in the Career Intelligence Report | **Yes**, same report if student-facing | N/A | `CareerIntelligenceReport` API response | N/A |
| `clinicReportBuilder.ts` third pipeline (§3.4) | Possibly, if teacher views Academic Clinic PDF | **Yes** — different readiness number in two PDFs same day | N/A | N/A | Clinic Report API, auto-generated parent PDF | `autoReportGenerator.ts` |
| `term-readiness` cron stale risk (§3.5) | **Yes** — WhatsApp brief vs. Monday Panel | Possibly, if parent sees related risk framing | N/A | N/A | N/A | **Yes** — the cron itself |
| Teacher dashboard hero vs. Attention Feed (§3.6) | **Yes**, same page, same moment | N/A | N/A | N/A | Two different API routes rendered on one page | N/A |
| Compass XP bug (§3.7) | N/A (invisible to teacher) | N/A | **Yes** — sees an inflated/false reward | N/A | `/api/learn/end` response | N/A |

---

## 5. Educational Constitution Compliance Matrix

| Article | Status this pass |
|---|---|
| I — No projection without evidence | **Held at the computation layer, violated at the persistence layer** — the computed projection is correct but cannot be saved/read for most real students (§3.1); separately, **violated** in Career Intelligence's Hidden Strengths (§3.3), a fresh finding |
| II — Missing evidence ≠ poor performance | Held everywhere previously verified; **newly found to be violated in the positive direction too** — missing evidence can become a fabricated *strength*, not just a fabricated weakness (§3.3), which the Constitution's original framing didn't explicitly anticipate but clearly forbids under Article I |
| III — Confidence ≠ ability | Held where confidence reaches the response; `scoreCareer()`'s dimension loop (§3.3) doesn't check confidence at all, which is the same violation from a different angle |
| IV — Growth over isolated performance | Held; no new violation found |
| V — Risk predicts support, not worth | Held in labeling; weakened by the `term-readiness` cron discrepancy (§3.5) undermining trust in any single risk statement |
| VI — AI explains, never invents | The AI narrative layer (`careerIntelligenceEngine.ts`) is well-grounded at the prompt level, but is now confirmed to be **fed pre-fabricated deterministic content** (§3.3) — the AI isn't inventing, but it's narrating something the deterministic layer already invented, which is arguably worse since it launders the fabrication through confident AI prose |
| VII — Evidence needs corroboration | Held in the Evidence Domain; Compass's XP bug (§3.7) is a second, independent instance of this Article being honored in the durable record and bypassed in the immediate UX, alongside Sprint 26's XP/level-up gating finding |
| VIII — Teacher approves before parent sees | Held, unchanged |
| IX — Traceable to evidence | **Cannot currently be evaluated for most real students** — there's no projection to trace to (§3.1) |
| X — Career guidance is possibility, not destiny | Undermined specifically by §3.3 — a "Hidden Strength" narrated from zero evidence is the sharpest possible violation of "recommend possibility, not destiny," since it asserts a destiny-shaped trait from nothing |
| XI — A number without a name is not neutral | The Sprint 25/26/27 framing assumed a number always exists, just sometimes untraceable; this pass found the more severe case — sometimes **no number exists at all**, and the system throws rather than silently degrading, which is at least honest failure, but still a Constitution gap since "throwing" isn't a defined audience-specific explanation of anything |

---

## 6. Confidence Verification (Objective 5)

Re-verified: everywhere the Projection Engine's computation actually runs (bypassing the broken persistence to inspect pure output), lower confidence changes phrasing/hedging only, never the underlying value — confirmed in Blueprint, Holiday Planner, Parent Pulse, Adaptive Learning, Career Intelligence's `capability-matches` endpoint. **One clear violation found**: `careerIntelligenceEngine.ts`'s Hidden Strengths/Growth Barriers (§3.3) don't check confidence at all before emitting a claim — this isn't "low confidence became low ability," it's worse: confidence isn't consulted, so the claim's certainty is entirely unrepresented regardless of whether it's 0 or 100.

## 7. Evidence Traceability Verification (Objective 4/6)

Held everywhere the canonical chain successfully executes. **Cannot be verified for the majority of real students right now**, because the chain doesn't execute (§3.1) — this is reported as its own category rather than folded into "held/not held," since "cannot answer because there's no answer" is a different failure mode than "answer exists but isn't traceable."

## 8. Explainability Verification (Objective 8)

Unchanged from Sprint 26's findings for the surfaces that do execute. Newly unanswerable: nothing in Blueprint/Holiday Planner/Monday Panel can currently explain "why am I seeing this" for a real student, because for most real students there is nothing to see — the API throws before producing a response at all. This is explainability's worst-case: not a bad explanation, an absent one.

## 9. Compass Verification (Objective 7)

Full re-scrutiny performed. Findings:
- **XP/level-up gating gap** (Sprint 26's original finding) — re-confirmed, unchanged: `masteredConcepts` correctly gates the durable evidence record, but the immediate reward feedback shown to the student doesn't wait for review.
- **NEW: XP-bonus computed from the wrong flag** (§3.7) — a second, distinct bug in the same area, contained to the reward number, not the evidence record.
- **NEW: "Level up!" is dead code** (§3.8) — inert, not a false claim, but worth knowing the feature has never worked.
- **Badges/streaks checked and cleared**: session-count milestones and daily streaks are pure engagement facts (session counts/dates), require no evidence gate, and were confirmed accurate.
- **No other learner-facing Compass statement was found to bypass evidence review** beyond what's listed above.

## 10. Projection Consistency Verification (Objective 2/9 combined)

This is the section most directly answering "select several learners, trace assessment → evidence → projection → truth → every consumer, everything should agree." **Result: it currently cannot be tested end-to-end for real students, because step 3 (Projection) fails before producing output.** The pure computation (bypassing persistence) was verified correct and internally consistent for 3 real students (Evans Ndege, Cheruiyot Gitau, Kiprop Ochieng) — academic levels and risk levels computed sensibly from their real evidence. Risk level agreed between the pure Projection output and the legacy Learner Model field for all 3 students (`normal`/`normal` in each case) — but this is not strong evidence of consistency, since evidence volume was too low (0-2 items per student) for either system's risk logic to escalate past baseline. The capability-pipeline divergence (§3.2) *was* reproduced with real, printed, disagreeing numbers for Evans Ndege — the strongest empirical confirmation in this entire report series that a duplicate-truth contradiction is not merely theoretical.

## 11. Recommended Safe Consolidation Order

Reordered from the earlier same-day report given this pass's findings. No architecture changes; every item is additive or a narrow fix.

1. **[P0, do first, ahead of everything else in this series]** Widen `learner_projections_projector_type_check` to include `capabilityV2`, `trendV2`, `knowledgeV2` via a follow-up migration. This is a single additive `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` — the smallest possible safe fix, and the only one in this entire report series that restores function rather than improves consistency. Nothing else in this roadmap matters if the chain can't execute.
2. **Add a `confidence`/`raw_score > 0` guard to `buildHiddenStrengths`/`buildGrowthBarriers`** (`careerIntelligenceEngine.ts:226,266`) and to `scoreCareer`'s dimension loop (`capabilityMatchEngine.ts:233-262`) — mirrors the exact guard `buildLearnerBlueprint` already applies (`confidence === 0` check), just needs to be copied into the sibling file.
3. **Gate Compass's XP/level-up feedback behind evidence-lifecycle state** (Sprint 26's original recommendation, unchanged) and **fix the client-side `genuineProgress` flag to read the AI's actual `genuine_progress` field** (§3.7) — both land in the same PR naturally since they touch the same code path.
4. **Re-point `cron/term-readiness` from `learner_profiles.overall_risk_level` to Projection's risk**, matching the migration Monday Panel/Remedial/Attention Feed already made.
5. **Decide whether `clinicReportBuilder.ts` is retired or explicitly relabeled as a non-canonical legacy report** — this is the same recommendation the earlier same-day pass made, now with confirmed evidence of three live consumers rather than an inferred risk.
6. **Reconcile the teacher dashboard's hero tile with Attention Feed** — either source both from Projection or clearly separate them in the UI as different concepts (manual alerts vs. computed risk).
7. **Delete or fix the dead `ending_level` write path** — low priority, but a one-line fix once someone is in that file for item 3.
8. Everything in the prior same-day report's §9 items 2, 4, 6, 7, 8, 9 (Monday Panel evidence threading, Remedial Planner type fields, student home FRS retirement, Parent Pulse structured type, confidence documentation, `student_alerts` product decision) remains valid and unblocked by this pass's findings — proceed after items 1-7 above.

## 12. Educational Risk Ranking (harm order, not engineering order)

1. **Absence of any educational truth for real students (§3.1)** — worse than a learner being understood differently; they are not understood *at all* by the platform's flagship surfaces right now.
2. **Fabricated Hidden Strengths/Growth Barriers from zero evidence (§3.3)** — a learner being told something false and specific about themselves, reaching a parent as confident AI prose.
3. **Capability pipeline divergence, confirmed with real data (§3.2)** — a learner genuinely understood differently by two systems, the platform's core anti-pattern per this sprint's guiding principle.
4. **`clinicReportBuilder.ts` third pipeline (§3.4)** — parent misunderstanding, confirmed reachable.
5. **`term-readiness` cron discrepancy (§3.5)** — teacher misunderstanding, weekly cadence, real but lower stakes than a same-moment same-screen contradiction.
6. **Teacher dashboard same-page contradiction (§3.6)** — teacher misunderstanding, immediate but bounded to one page.
7. **Compass XP bug (§3.7)** — learner-facing but contained (doesn't corrupt the durable record); still a false claim reaching a child.
8. **Everything carried forward from the earlier same-day report unchanged** — architectural duplication tier, per that report's own ranking.

## 13. Regression Results

- **TypeScript** (`npx tsc --noEmit`): same 2 pre-existing errors as every prior sprint in this series (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`), plus one new error in this pass's own throwaway verification script (`scripts/trace-consistency-audit.ts:112`, a type mismatch against `CapabilityMatchReport` — script-only, not application code, left as-is per repo convention of keeping verification scripts). **Zero new errors in any application file.**
- **ESLint**: zero errors/warnings across every audited directory, including the newly-checked `app/api/teacher/monday-panel`, `app/api/cron/term-readiness`, `app/api/learn`.
- **Production build** (`npx next build`): compiles successfully; type-check step fails only on the same pre-existing `scripts/` file, outside the application bundle.
- **Note**: these checks validate that the *code* is well-typed and lint-clean — they cannot and did not catch the Projection persistence bug (§3.1), because that is a live database constraint mismatch, invisible to static analysis. This is itself worth recording: **static validation passing is not sufficient evidence that the canonical chain works** — this sprint's live-data verification found what `tsc`/`eslint`/`next build` structurally cannot.

## 14. Method Note — what changed versus the same-day earlier Sprint 27 report

The earlier same-day pass synthesized Sprints 22–26's findings into one document without re-executing any code. This pass, following the explicit "trust no previous report" instruction, ran three independent research passes: two re-read code fresh (finding §3.2, §3.3, §3.6, §3.7, §3.8, and the `term-readiness` cron gap that the earlier pass didn't check), and one executed real functions against real live Supabase data for real students, which is what surfaced §3.1 — the finding no amount of additional code reading would have found, since the bug is a live database schema/constraint mismatch invisible from the application source alone. This is the concrete justification for this sprint's review standard: reading code and running code found different, non-overlapping classes of bug.

## 15. Final Verdict

**NO-GO on the canonical intelligence chain's current production readiness for evidence-bearing students. CONDITIONAL GO on the platform's architecture, design principles, and everything not blocked by §3.1.**

This is a harder verdict than any prior sprint in this series reached, and it should be. Sprints 22–26 correctly found that the *design* of the Evidence Domain and Projection Engine is sound, and that duplicate/legacy systems around it are a bounded, well-understood, well-ranked cleanup problem. This sprint found that the design's *implementation* has a live gap that means, right now, for most real students with real evidence, the flagship canonical surfaces (Blueprint, Holiday Planner, Monday Panel's risk computation) do not produce any output at all. That is not a duplicate-truth problem — it's an absent-truth problem, and it sits upstream of every other finding in this entire report series: none of the consolidation work recommended in Sprints 25–27 matters until §3.1 is fixed, because there is currently nothing for those subsystems to be consistent *about*.

The fix itself is small, safe, and additive (§11 item 1) — this is not a NO-GO on the platform's direction, it is a NO-GO on declaring the canonical chain production-ready before verifying it against real data, which this sprint did and the prior six did not. Recommend: apply the migration fix immediately, re-run this sprint's live-data trace against the same three students to confirm resolution, then resume the consolidation order in §11 starting from item 2.
