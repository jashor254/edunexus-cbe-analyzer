# Multi-Level Educational Intelligence Architecture Audit

**Date:** 2026-08-03
**Type:** Architecture definition and duplication audit. Not implementation, not a Blueprint sprint, not a UI redesign, not a migration sprint. No code changed.
**Frozen per this sprint's own foundation, not re-audited here:** School-first operating model, Educational Intelligence Constitution, Canonical Educational Structure, Blueprint (now "Learner Progress Report" per the prior naming audit), Attention Feed, Career Intelligence, Compass, evidence-first reasoning.

---

## 1. Executive Verdict

**The vertical spine already exists and is genuinely sound. One real, live, user-facing contradiction sits outside it.**

`recomputeLearnerProjection()` is already the single canonical reasoning step underneath more surfaces than this audit expected going in — confirmed directly, not assumed: `lib/school/intelligence.ts` (School Intelligence's risk rollup) calls it per-student and reads `projection.risk.value.overallRiskLevel`, the exact same field `composeRisk.ts` (Blueprint) and `lib/attentionFeed/*` ultimately trace back to. Where this audit checked whether School Intelligence's counts and Learner-level projections could ever disagree (Part 5's explicit worry), the answer is **they structurally cannot** — both read the same function, so a discrepancy would require the two calls to happen at different moments with intervening evidence, not a duplicated reasoning path.

The one place this audit found a real, live violation of "no projection invents its own intelligence" is **Career Intelligence, and it is currently shown to real parents**: `app/(parent)/career-report/page.tsx` calls `/api/career/match`, which calls `getMatchesForStudent()` — an explicitly-named-deprecated, AI-generated, persisted-table matching path (`lib/career/careerEngine.ts`) that composeCareer.ts's own header comment already flags as disagreeing with the evidence-first pipeline. Meanwhile the Learner Progress Report's Page 4, Career Explorer, and Holiday Planner all correctly use the canonical deterministic path (`computeCapabilityMatches`). **A parent can see two different career directions for the same child, from the same platform, on the same day** — the exact cross-level contradiction Part 5 asked this audit to check for, found not between hierarchy levels but between two competing implementations at the *same* level.

---

## 2. Intelligence Hierarchy

| Level | Consumes | Answers | Evidence used | Decisions enabled |
|---|---|---|---|---|
| School | Principal, Board | "How is the school doing overall, and where's it trending?" | `school_intelligence_snapshots` rollup (itself sourced from per-learner Projection, confirmed §Part 5) | Resourcing, policy, whole-school interventions |
| Grade/Level | Principal, Deputy | "Which grade needs attention?" | Same snapshot table, `grade`-scoped rows (already schema-supported, confirmed `school_intelligence_snapshots.grade` column) | Grade-level curriculum/staffing decisions |
| Class/Stream | Teacher, Principal | "Which class/subject combination is struggling?" | `class_insights` (teacher workspace projection, per the earlier Application Layer audit) — currently legacy-keyed, not yet Core-native (per the Core Cutover Readiness audit) | Reteaching, regrouping, resource allocation |
| Teacher | Teacher, Principal (in support capacity) | "What does this teacher need help with?" | Teacher Reflection, Attention Feed's teacher-facing items | Coaching, professional development, workload adjustment |
| Learner | Teacher, Parent, Learner, Principal (on demand) | "How is this one learner doing, and what should happen next?" | The full Learner Progress Report — Projection, Evidence, Career, Attendance, Portfolio | Individual intervention, parent conversation, next learning step |
| Parent | Parent | "How is my child progressing, and how can I help?" | Parent Summary + Recommended Next Steps, a filtered view of the Learner level, never a separate computation | Home support, attendance, engagement with school |
| Educational Intervention | Teacher, System | "Did the last thing we tried work?" | Action Plan lifecycle + new Evidence generated after delivery | Continue, adjust, or close the intervention loop |

Every level above Learner is a **rollup or filter** of Learner-level Projection data — none of them is a separate reasoning system. This is the hierarchy's single most important property, and per §1, it mostly already holds in code, not just in principle.

---

## 3. Projection Hierarchy

| Level | Canonical projection | Confirmed source |
|---|---|---|
| School | School Intelligence (`school_intelligence_snapshots`) | `lib/school/intelligence.ts` → `recomputeLearnerProjection()` per learner, aggregated — **confirmed canonical, not duplicated** |
| Grade | Grade Intelligence | Same table, `grade`-scoped — schema-ready, **not yet surfaced in any UI** (confirmed in the prior Principal Workspace audit — zero consumers found) |
| Class | Class Intelligence (Teacher Workspace's class-insights projection) | Currently reads legacy `assessments`/`compass_sessions` directly (per the Application Layer and Core Cutover Readiness audits) — **not yet routed through the same canonical Projection the Learner level uses**, a real, already-named seam, not new to this audit |
| Teacher | Teacher Workspace | `lib/teacherWorkspace/*` (extracted in an earlier sprint this engagement) — correctly a projection, not a second reasoning engine |
| Learner | Learner Progress Report (Blueprint) | `composeBlueprint()` — the canonical composition, confirmed correct across four prior audits this engagement |
| Parent | Parent View | `composeParentSummary()` + `lib/parentExperience/actions.ts` — both correctly derive from Academic Record/Attendance, no independent computation found |
| Educational Intervention | Action Plan (`lib/learnerBlueprint/actionPlan/*`) | Real state machine over the same Blueprint evidence, confirmed in the Decision Experience audit |

**"Ensure every projection derives from the same evidence. No duplicated reasoning."** — true for every row above **except Class Intelligence** (already a known, named gap from the Core Cutover Readiness audit — legacy-keyed, pending the eventual Core-evidence bridge) **and except one competing Career-matching implementation** (§9, not a level-boundary problem, a same-level duplication).

---

## 4. Question Mapping

| Question | Asked by | Answered by |
|---|---|---|
| Which learners need attention? | Principal | Should be: Attention Feed, filtered/prioritized by School Intelligence's grade-level counts. Today: no principal-facing view exists at all (confirmed, prior Principal Workspace audit) |
| Which classes are declining? | Principal | Class Intelligence, rolled up — today only exists per-class, not as a principal-facing cross-class comparison |
| Which interventions are working? | Principal | `school_intelligence_snapshots.interventions_run`/`interventions_effective` — data exists, zero UI consumer (reconfirmed) |
| Who needs support today? | Teacher | Attention Feed (already correctly teacher-facing and real) |
| Which concept is struggling? | Teacher | Class Intelligence / substrand health (`top_struggling_substrands`, already modeled in both the snapshot table and class insights) |
| How is my learner progressing? | Parent | Parent View / Learner Progress Report — real, correct, already audited twice this engagement |
| What should I work on next? | Learner | Learner Progress Report Page 3's single priority action — the strongest single answer in the whole system, per the Decision Experience audit |

The pattern across every "Principal" row: **the question already has a correct, named answering projection — none of them currently reach a Principal-facing screen.** This restates, doesn't re-litigate, the prior Principal Workspace audit's finding; it's included here because Part 3 explicitly asks for the mapping, not because it's new.

---

## 5. Evidence Flow

The loop, checked at every level for a bypass:

```
Observation → Evidence → Projection → Reasoning → Recommendation → Intervention → New Evidence
```

- **School/Grade**: `school_intelligence_snapshots` is itself downstream of per-learner Projection (confirmed §3) — no bypass.
- **Class**: currently reads legacy tables directly rather than through Projection (§3's named exception) — **this is the loop's one confirmed structural gap**, not a new finding but newly placed on this specific diagram.
- **Teacher**: Attention Feed's risk-derived items trace to a `risk_level` field on a `students_needing_attention`-style panel; this session confirmed the field's presence but did not fully trace whether that panel is itself Projection-sourced or independently maintained — **flagged as unconfirmed, not asserted either way**, worth a dedicated follow-up read before treating it as settled.
- **Learner**: the full loop is real and already verified across four prior audits — Evidence → `recomputeLearnerProjection` → Blueprint composers → Recommendation → Action Plan → real Assignment/Compass delivery → (eventually) new Evidence from that delivered work. This is the loop's best-realized instance.
- **Parent**: strictly downstream of Learner, no independent evidence read — no bypass.
- **Career** (cutting across levels, not a hierarchy level itself): **this is where the loop is actually bypassed today** — `getMatchesForStudent()`'s deprecated path reads a persisted table rather than live Projection-derived capability, meaning its "Recommendation" step is disconnected from the current evidence loop entirely (§9).

---

## 6. Decision Ownership Matrix

| Decision | Owner | Educational Intelligence's role |
|---|---|---|
| Whole-school policy/resourcing | Principal | Recommends via School Intelligence trend data — never decides |
| Grade/curriculum adjustment | Principal, Deputy | Recommends via Grade Intelligence — never decides |
| Class regrouping, reteaching | Teacher | Recommends via Class Intelligence — never decides |
| Individual intervention (subject support) | Teacher, with Principal oversight for escalation | Recommends via Blueprint's priority action + Action Plan — never auto-executes without explicit approval (confirmed: `requireCoherentApproval` blocks an incoherent approval, but a human still initiates every approval) |
| Parent engagement / home support | Parent | Informed by Parent View — decision and action entirely the parent's |
| Career direction | Learner, guided by Parent/Teacher | Recommends an early, hedged direction — explicitly, architecturally never a verdict (confirmed: no predictive language found anywhere in rendered Blueprint text, per the Kenyan School Evolution audit) |
| Wellbeing referral | Principal/Teacher, via a separate (non-Blueprint) channel | **Zero involvement by design** — the Sprint 13G architecture boundary (confirmed, prior Decision Experience audit) keeps Wellbeing entirely outside Educational Intelligence's reasoning surface, a correct safeguarding decision, not a gap |
| Promotion/Transfer | School Administration (Core) | Informed by Blueprint's academic picture — the actual decision and record-of-truth lives in `lib/core/promotions.ts`/`transfers.ts`, correctly outside Educational Intelligence's own domain |

**"Educational Intelligence should recommend. Humans should decide."** — holds everywhere checked in this audit. No auto-executing decision path was found anywhere in the four prior audits or this one.

---

## 7. Growth Path

Each named future capability, placed in the existing hierarchy without inventing a new one:

| Capability | Fits at | Why |
|---|---|---|
| Portfolio | Learner | Already modeled (`blueprint.portfolio`), correctly rolls up into nothing above Learner — a portfolio is inherently individual |
| Behaviour | **Does not exist anywhere in the codebase** (confirmed, prior Decision Experience audit) — would need to enter at Learner level first, mirroring Wellbeing's careful, bounded, likely-separate-channel treatment, not folded into the same reasoning surface as academic evidence without a deliberate decision to do so |
| Wellbeing | Learner, but deliberately outside Educational Intelligence's shared reasoning (§6) | Confirmed existing, confirmed correctly boundaried |
| Leadership | Learner, rolls up to Class/School only as an aggregate count, never as individual comparison | Already modeled (`blueprint.leadership`) |
| Projects | Learner | Already modeled (`blueprint.projects`) |
| Community Service | Learner, same shape as Leadership/Projects | Not yet modeled — a straightforward future addition to the same "future evidence" family, no new hierarchy level needed |
| Financial Literacy | Learner (as evidence), potentially Class/Grade as a curriculum-coverage rollup | Would enter exactly like a new subject in Academic Record, not a new intelligence type |
| Teacher Development | Teacher level | Already has a natural home (Teacher Workspace) — professional growth evidence would parallel Learner's Academic Record structurally |
| Future AI capabilities | **Nowhere new — they augment Reasoning, not add a level** | Per the Constitution frozen in this sprint's foundation: capability additions belong inside the existing Evidence→Projection→Reasoning loop (Part 5), never as a bypass or a parallel system, exactly the discipline `capabilityMatchEngine.ts`'s deterministic design already models correctly |

**No named future capability requires a new hierarchy level.** The seven-level structure in §2 is already wide enough; growth is additive evidence within existing levels, not new levels.

---

## 8. Duplication Findings

**Confirmed, live, real** (not hypothetical):

1. **Two competing career-matching implementations, both currently serving real users.**
   - Canonical: `computeCapabilityMatches()` (`lib/career/capabilityMatchEngine.ts`) — deterministic, AI-free, capability-profile-based. Used by: Learner Progress Report (`composeCareer.ts`), Career Explorer, Parent Career Intelligence, Holiday Planner (per `composeCareer.ts`'s own header comment).
   - Deprecated but still live: `getMatchesForStudent()` (`lib/career/careerEngine.ts`) — AI-generated, persisted-table-based, explicitly named as disagreeing with the evidence-first pipeline in `composeCareer.ts`'s own comment. Still actively called by **`app/api/career/[slug]/route.ts`**, **`app/api/career/match/route.ts`**, and **`lib/career/clinicReportBuilder.ts`** — and `/api/career/match` is called directly by **`app/(parent)/career-report/page.tsx`, a real, live, parent-facing page.**
   - **Recommend one canonical owner**: `computeCapabilityMatches()`. `getMatchesForStudent()` and its three live call sites should be migrated onto the same deterministic path the other four consumers already use — this is the single highest-value fix this audit found, because it is the only confirmed case of two different answers reaching a real parent for the same question.

2. **`generateParentSummary()` (`lib/career/careerEngine.ts`)** — a second, independent, AI-based parent career summary generator. Confirmed **zero callers anywhere in the codebase** (grepped directly). Not a live duplication risk, but dead code sitting next to the exact concept `composeCareer.ts`/`getCareerBlueprintSummary()` already owns correctly — recommend removal or explicit archival, since its mere existence is the kind of thing a future engineer could accidentally wire back up, recreating finding #1.

3. **Class Intelligence's evidence source** (§3, §5) — not two implementations disagreeing today, but a real, structural risk: Class Intelligence reads legacy tables directly rather than through the same canonical Projection every other level uses. This isn't a duplication *yet*, but it's the shape duplication always starts from — flagged here as a preventive finding, not a currently-observed contradiction.

**Checked and found clean**:
- School Intelligence's risk rollup — confirmed single-sourced from `recomputeLearnerProjection()`, no duplication.
- `learner_evidence`/`learner_profiles` read paths — confirmed ESLint-enforced single canonical entry point (`recomputeLearnerProjection`), zero live violations, reconfirmed in the Application Layer audit and not contradicted by anything found this session.
- Blueprint's own composers — confirmed, across two prior audits, that each composer reads exactly one canonical domain function, no independent reasoning.

---

## 9. Final Educational Intelligence Operating Architecture

```
                         ┌─────────────────────────┐
                         │   EVIDENCE (learner_     │
                         │   evidence, canonical,   │
                         │   ESLint-enforced         │
                         │   single read path)       │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  PROJECTION               │
                         │  recomputeLearnerProjection│
                         │  (the one reasoning step) │
                         └────────────┬─────────────┘
                                      │
        ┌─────────────┬──────────────┼──────────────┬─────────────┐
        ▼             ▼              ▼              ▼             ▼
   School Intel   Grade Intel   Class Intel*   Learner Progress  Career Match†
   (rollup, real, (schema-ready, (LEGACY-       Report (canonical, (SPLIT — see
   confirmed       unsurfaced)    sourced,       correct, 4x        Duplication
   canonical)                     not yet         audited)          Finding #1)
                                   Projection-
                                   routed)
                                      │                  │
                                      ▼                  ▼
                              Teacher Workspace     Parent View,
                              (correct projection,  Action Plan →
                              legacy-scoped)         real Intervention
                                                     → New Evidence
                                                     (loop closes)

  * = confirmed structural gap, not new to this audit, named again for completeness
  † = the one confirmed live duplication this audit found — two implementations,
      not two hierarchy levels, answering the same question differently
```

**Reading this diagram**: every arrow except the two marked is a rollup or a filter of the same evidence, through the same one reasoning step. The architecture this sprint's mission asks for — Blueprint, Compass, Career, Attention Feed, School Intelligence, Teacher Workspace, Parent View as "different projections of one Educational Intelligence system" — **is already true for six of seven surfaces named in the success criteria.** The seventh, Career, is true for four of its five real consumers and false for one deprecated path three live routes still call.

---

## 10. Answering the Mission Directly

**Should Educational Intelligence appear as separate features?** It already mostly doesn't — this audit's job was to check that claim against real code, not assume it, and it holds up better than expected. `recomputeLearnerProjection()` really is the one reasoning step nearly everything traces to.

**Where the claim is currently false**: one deprecated career-matching path, still wired into a real parent-facing page, disagreeing with the canonical path four other surfaces correctly use. Closing Duplication Finding #1 — migrating `/api/career/match`, `/api/career/[slug]`, and `clinicReportBuilder.ts` onto `computeCapabilityMatches()`, and deleting the now-fully-orphaned `getMatchesForStudent()`/`generateParentSummary()` — is the one change that would make this sprint's success criteria fully, not mostly, true.

Everything else named in this audit (Grade Intelligence's missing UI, Class Intelligence's legacy sourcing, Attention Feed's unconfirmed panel provenance) is a **reach or completeness gap**, not a duplication — real work, already named across this engagement's prior audits, correctly out of this specific sprint's "duplicated reasoning" question.
