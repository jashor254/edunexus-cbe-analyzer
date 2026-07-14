# EduNexus — Educational Development Framework Report

**Sprint 30 — Educational Development Framework & Age-Appropriate Intelligence**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit-only, no code changed. Governed by the Educational Constitution ([[Sprint 25]]). Builds directly on [[Sprint 29]]'s finding that the live Career Explorer has no grade gate at all. This sprint's contribution: a full census of every career-related consumer in the platform (not just the two Sprint 29 checked), a grade-awareness sweep of the other eight subsystems, and — the one genuinely good-news finding in this report series — **the correct fix already exists in the codebase, unused on the surface that needs it.**

---

## 1. Executive Summary

The best news in this report: EduNexus already contains a properly-designed, grade-aware career intelligence module — `lib/learnerIntelligence/careerIntelligence.ts`'s `buildCareerIntelligence()`, which explicitly branches Junior (broad, unranked "explore this field" families) from Senior (named, hedged, evidence-proportional matches). It is correctly built and it is correctly consumed by Holiday Planner. **It is not consumed by the actual Career Explorer page students use.** The live student surface (`app/(student)/career/page.tsx`) still calls the older, ungated `computeCapabilityMatches()` Sprint 29 flagged. This sprint's central recommendation is therefore not "build a fix" — it's "point the existing, correct fix at the surface that's missing it," which is the smallest possible safe consolidation this report series has found in six sprints of auditing.

Beyond that, a full census of every career-touching code path in the platform (thirteen consumers, tabulated in §4) found the gap is wider than Sprint 29's two known routes: the **parent-facing Career Intelligence panel** and the **13-section Career Intelligence Report** (an AI-authored PDF explicitly parents read) both call the same ungated function, and both hit the same failure — the Intelligence Report's own AI prompt literally states "You are NOT recommending jobs" while the deterministic section immediately above it in the same document does exactly that. A third, more speculative but live-relevant risk: an automated teacher-triggered batch report generator reads a database column (`top_careers`) that is currently unwritten by any code path — dormant today, but a single future write path away from feeding a named career into an ungated, any-grade AI prompt.

Grade-awareness elsewhere on the platform is inconsistent in an instructive way: the legacy Academic Clinic report generator (`reportGenerator.ts`) genuinely branches Junior vs. Senior guidance language; six of the eight other subsystems audited (Blueprint, Parent Pulse, Progress/report-cards, Monday Panel, Adaptive Learning, and the batch career generator) use grade only for data-availability filtering, never for tone or specificity — meaning a Grade 7 and Grade 12 learner with identical evidence currently receive byte-identical phrasing everywhere except the two places that specifically branch on it.

**Verdict: CONDITIONAL GO**, contingent on wiring the existing `buildCareerIntelligence()` module into the Career Explorer, the Parent Career Intelligence panel, and the Intelligence Report — detail in §9.

---

## 2. Developmental Intelligence Map

| Layer | What exists today | Developmentally aware? |
|---|---|---|
| Evidence Domain, Projection Engine | Grade-agnostic by design (correctly — evidence is evidence regardless of age) | N/A, correctly so |
| `buildCareerIntelligence()` (`lib/learnerIntelligence/careerIntelligence.ts`) | Explicit Junior/Senior branch: `buildJuniorFamilies()` vs `buildSeniorMatches()` | **Yes — the reference implementation** |
| `computeCapabilityMatches()` (`lib/career/capabilityMatchEngine.ts`) | No grade parameter | **No** — this is the gap |
| `clinicReportBuilder.ts` | `grade >= 10 \|\| igcse` gate, correctly applied | Yes |
| `academicClinic/reportGenerator.ts` | `generateSeniorGuidance()` vs `generateJuniorGuidance()`, genuinely different content | Yes |
| `academicClinic/careerEngine.ts`/`assessmentPipeline.ts` | `isSenior = grade >= 10` gate | Yes |
| Everything else audited this sprint (Blueprint, Parent Pulse, report-cards, Monday Panel, Adaptive Learning) | Grade referenced only for data filtering, never tone/specificity | No |

The platform is not starting from zero on this problem — it has solved it correctly twice (`buildCareerIntelligence()`, `reportGenerator.ts`) and left the solution unconnected to the surfaces that most need it.

## 3. Grade-by-Grade Recommendation Model (Objective 13)

Requested staged model, built entirely from existing architecture — no new intelligence engine, no new data source. Every stage below already has a real signal in the codebase to key off: `students.grade`, evidence `assessment_count`/diversity (Sprint 28/29's confidence machinery), and `dominant_cluster`/capability dimensions (`capabilityExtractor.ts`).

| Stage | Grades | Evidence gate (existing signals) | What may be shown | What must never be shown |
|---|---|---|---|---|
| **1 — Curiosity & habits** | 7 | Any evidence, including zero | Learning-habit observations (Compass engagement facts, formative signals), subject interest signals, no capability ranking required | Any named career, any capability ranking presented as a verdict |
| **2 — Strengths & interests** | 7–8 | `assessment_count` ≥ 1, single or multi-subject | `dominant_cluster` (capability dimension labels only — "analytical thinking," "resilience"), Blueprint's existing capability Insight shape | Career families, career clusters, named careers |
| **3 — Career families (broad)** | 8–9 | `assessment_count` ≥ 2 across ≥ 2 subjects (reuses the exact diversity gate Sprint 29 recommended for the confidence fix) | `buildJuniorFamilies()`'s existing output — broad category groupings, "explore this field" framing, no ranking | Named specific occupations, match percentages, "strong fit" language |
| **4 — Career clusters (narrowing)** | 9–10 | `assessment_count` ≥ 3 across ≥ 3 subjects, consistent trend per `detectTrend()` | Grouped occupation clusters within a family (the currently-missing type Sprint 29 identified — this is where it belongs), still unranked | A single named "top" career, entrepreneurial-tier promotion |
| **5 — Specific exploration (hedged)** | 10–11 | `assessment_count` ≥ 3 diverse, `confidenceFromAssessmentCount` at Medium+ | `buildSeniorMatches()`'s existing hedged output — named careers with explicit "current evidence suggests" framing and visible confidence | Any career framed as a verdict, prediction, or the learner's likely future |
| **6 — Transition / readiness** | 11–12 | Full evidence history, multiple terms, cross-subject trend data | Pathway readiness, university/TVET signal, existing Senior Academic Clinic content (`reportGenerator.ts`'s senior path) | Nothing new forbidden here — this stage is where prediction-adjacent language is closest to appropriate, and even here the Constitution's Article X still applies: possibility, not destiny |

This model reuses three pieces of infrastructure that already exist and already work correctly: `buildCareerIntelligence()`'s Junior/Senior split (Stages 3 vs. 5), the confidence/diversity gates Sprint 28–29 already specified as fixes (Stage boundaries), and `capabilityExtractor.ts`'s `dominant_cluster` (Stage 2). The only net-new piece is Stage 4's cluster grouping type, which Sprint 29 already identified as the single missing schema element.

## 4. Career Progression Audit — full consumer census (Objective 4)

| Consumer | Classification | Grade-aware? |
|---|---|---|
| Live Career Explorer (student-facing) | **Recommendation** | **No** (known, Sprint 29) |
| Career detail page (per-career) | Recommendation (inherits ungated match) | No |
| Parent Career Intelligence panel | **Recommendation**, shown directly to parents | **No — new finding this sprint** |
| Career Intelligence Report (13-section AI PDF) | **Recommendation**, despite its own prompt explicitly disclaiming "You are NOT recommending jobs" | **No — new finding**, and internally self-contradictory |
| Academic Clinic PDF (`clinicReportBuilder.ts`) | Senior: Recommendation. Junior: **Exploration** | Yes, correctly gated |
| Legacy `academicClinic/careerEngine.ts` | Recommendation (opens a Compass session naming a specific career) | Yes, `isSenior` gated |
| Batch teacher report generator (`autoReportGenerator.ts`) | Guidance-leaning today (de-fanged by a dormant DB column), **dormant Recommendation risk** | **No gate at all** |
| Compass Focus / WhatsApp copy button | Inherits whichever bridge wrote it | Mixed — one gated path, one not |
| `buildCareerIntelligence()` module | Junior: Exploration. Senior: Recommendation, well-hedged | **Yes — correctly designed**, but its own API route has no live UI caller |
| Holiday Planner's career note | Inherits the above — correctly graded | Yes |
| Parent Pulse's career line | **Guidance/Exploration** in tone, but names a specific career | No grade check, though the softer phrasing mitigates the risk somewhat |
| Monday Panel "Career Micro-Moments" | Exploration (abstract capability/pathway language, no named career) | No, but low risk given the abstraction already protects it |
| `generateParentSummary()` (`careerEngine.ts`) | Recommendation-flavored, but **no live caller found** | Dead code, no risk today |

**No consumer was classified as outright Prediction** (a stated-as-fact future occupation) — every gap found is Recommendation-where-Exploration-was-intended, not the platform's worst-case failure mode. That is a meaningfully better finding than it could have been, and worth stating plainly rather than only cataloguing the gaps.

## 5. Constitution Compliance Matrix

| Principle | Status |
|---|---|
| Exploration before specialization | Violated on the two parent-facing surfaces (§4) and the student Career Explorer (carried from Sprint 29) |
| Potential before prediction | Held — no consumer reaches the Prediction tier |
| Guidance before recommendation | Violated in the same three places — they skip straight to Recommendation regardless of grade |
| Recommendation before commitment | Not implicated — no consumer was found asking a learner to commit to a specific path |
| Educational intelligence grows with the learner | Held only in `buildCareerIntelligence()` and `reportGenerator.ts`; absent in six of eight other subsystems checked (§2) |
| AI supports exploration, never limits a future | The Intelligence Report's self-contradiction (prompt says "not recommending jobs," output does exactly that) is the sharpest instance of this principle being undermined by the deterministic layer feeding the AI layer, not the AI layer itself |
| Corrections propagate automatically (Objective 12) | Held for Blueprint, Holiday Planner, Parent Career Intelligence panel's *Projection* half, Monday Panel's live half. **Violated** for: Career Explorer/Report (known, Sprint 29), **Parent Pulse's career line specifically** (new — reads a persisted `career_signals` field with no `markSuperseded()` hook), and **Monday Panel's 24-hour cache** (new — pure timer-based, no explicit invalidation on correction) |

## 6. Developmental Risk Ranking (harm order)

1. **Parent Career Intelligence panel and Career Intelligence Report both ungated (§4)** — highest priority, both are parent-facing (higher trust weight than a student-only surface), and the Report's internal self-contradiction (disclaiming recommendation while making one) is the platform's clearest instance of AI narrative laundering a deterministic-layer problem it didn't create and can't see.
2. **Live student Career Explorer ungated** — carried from Sprint 29, unchanged severity, now confirmed to share root cause with #1 (same underlying function, three consumers).
3. **Dormant `top_careers` column risk in the batch teacher report generator** — zero live harm today, but flagged because it is a single future write path away from becoming a fourth ungated, any-grade Recommendation surface with no additional review needed to activate it.
4. **Monday Panel's 24-hour cache and Parent Pulse's persisted `career_signals`** — lower severity (neither produces a *wrong-category* claim, both are propagation-lag issues on otherwise-correctly-classified content), but real per Objective 12.
5. **Six of eight subsystems having no grade-aware tone at all** — lowest urgency of the findings in this report, since none of them were found making a career-destiny claim; this is a personalization-quality gap, not a Constitution-severity violation on its own.

## 7. Recommended Safe Consolidations

No architecture redesign — every item wires an existing, already-correct module into a surface that currently bypasses it:

1. **Re-point the student Career Explorer's route (`app/api/career/capability-matches/route.ts`) and page to call `buildCareerIntelligence()` instead of the raw `computeCapabilityMatches()`** — this is the exact fix `buildCareerIntelligence()` already implements for Holiday Planner; extend the same call to the surface it was presumably built for.
2. **Do the same for the Parent Career Intelligence panel** (`app/api/parent/career-intelligence/route.ts`) and the **Career Intelligence Report** (`careerIntelligenceEngine.ts:543`) — both currently call the ungated function directly; both should call the gated module instead, and the Report's prompt's "not recommending jobs" claim should then actually be true for Junior students.
3. **Add the missing Stage-4 cluster-grouping type** (§3) inside `buildCareerIntelligence()`'s existing Senior path, narrowing the current binary Junior-family/Senior-match split into the three-stage ladder this report's model calls for — the smallest schema addition that unlocks the requested progression.
4. **Wire `markSuperseded()` (or a lightweight equivalent) to invalidate `learner_profiles.career_signals`**, matching the fix already recommended for `students.capability_profile` in Sprint 29 — same pattern, second field.
5. **Add an evidence-correction hook to `monday_panel_cache`'s invalidation**, or reduce its blast radius by excluding career-related content from the cached payload specifically (cheaper fix, since career content there is already Exploration-tier per §4 and lower-stakes than the other propagation gaps).
6. **Gate the batch teacher report generator's `top_careers` read path now, before anything writes to it** — costs nothing today (the column is dormant) and closes the risk permanently rather than leaving it as a landmine for whoever adds the write path later.
7. **Carried forward from Sprint 29, unresolved**: the underlying `capabilityMatchEngine.ts` confidence-threshold/diversity gate fix remains valid and complements, rather than duplicates, items 1–2 above.

## 8. Regression Results

- **TypeScript**: same 3 pre-existing errors as the last two sprints (2 long-standing `scripts/` errors plus Sprint 27's own throwaway trace script's type error, all script-only, non-application). Zero new errors.
- **ESLint**: zero errors/warnings across `lib/career`, `lib/learnerIntelligence`, `lib/parentPulse`, `lib/holiday`, `app/api/career`, `app/api/parent/career-intelligence`, `app/api/teacher/monday-panel`, `lib/academicClinic`.
- **Production build**: compiles successfully; type-check step fails only on the same pre-existing `scripts/` file.
- No code changed this sprint; baseline unchanged from Sprints 27–29.

## 9. Final Verdict

**CONDITIONAL GO.**

This sprint's finding is more encouraging than Sprints 27–29's escalating verdicts might suggest, because the fix it identifies is smaller and lower-risk than any prior sprint's: the platform does not need a new grade-aware career module built — it needs the one that already exists (`buildCareerIntelligence()`, already proven correct by its use in Holiday Planner) pointed at the three surfaces (Career Explorer, Parent Career Intelligence panel, Career Intelligence Report) currently bypassing it. This is the textbook definition of "reuse existing services, recommend only the smallest safe consolidation" this entire report series has been asked to favor, and for once the smallest safe consolidation is also the complete fix for the sprint's top two risk items.

The condition: do not consider Sprint 29's Junior-safety finding resolved, or this sprint's parent-facing findings acceptable, until items 1–2 in §7 actually ship — a correctly-designed module sitting unused in the codebase provides no protection to the students and parents currently using the three surfaces that don't call it. Items 3–7 are ordinary, non-urgent backlog appropriate to schedule alongside, not ahead of, the Sprint 27 persistence fix and Sprint 28's confidence-threshold work still open from prior sprints in this series.
