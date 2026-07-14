# EduNexus — Educational Intelligence Verification Report

**Sprint type:** Educational Intelligence Verification (not a code-quality audit, not a redesign)
**Date:** 2026-07-11
**Reviewer stance:** judged as a senior Kenyan CBC/CBE educator would judge it — does this intelligence actually help a teacher make a better decision in a real classroom, using evidence the school already produces?

---

## Executive Summary

EduNexus's newer Evidence Domain / Projection Engine (`lib/intelligence/`, `lib/projection/`) is well-designed and does the hard things right: it never fabricates a score from absent data, it caps confidence on thin evidence, it ranks sources by trust tier, and it degrades gracefully when a learner only has opener/midterm/end-term exam evidence. Junior vs Senior career framing is genuinely different and appropriately hedged. Parent Pulse enriches rather than overrides teacher evidence, and cannot bypass human review to enter the Learner Model.

But the platform is running **two learner-intelligence systems at once**, and the older one (`lib/learnerModel/` + `lib/academicClinic/`) has real gaps the newer Projection Engine already solved — most seriously, a live bug where a single-subject topical check (the highest-volume real teacher workflow, ~7,300 rows) overwrites a learner's pathway-readiness scores using a fabricated "zero" for every subject *not* covered by that check, rather than leaving those subjects untouched. This directly violates the sprint's core mandate: "the system should never confuse no evidence with poor performance." It is currently confusing them, at scale, on every topical check.

The legacy `academicClinic` career-report pipeline is also still live in parallel with the new Career Intelligence engine, on every assessment submission, and uses more assertive, less-hedged language ("an excellent match," "Booming — excellent future") than the new system allows. A parent could see two different career narratives about the same child computed independently, with no reconciliation.

None of this requires new architecture, new AI models, or new workflows to fix — every issue traces to code that either doesn't read a value that's already computed (staleness, confidence, evidence count) or overwrites state it should be merging.

---

## Intelligence Consistency Score: **6.5 / 10**

The core Evidence Domain is a strong foundation (would score 8.5+ alone). The score is pulled down by dual-system drift: the legacy Learner Model and legacy Career Engine still run on the primary write path and don't inherit the newer system's evidence discipline.

---

## Evidence Progression Analysis

**Verified working:** the Projection Engine's `computeProjectionConfidence` (`lib/projection/coverage.ts:57-62`) applies a real corroboration rule — confidence is capped at 1/3 of its base value for a single evidence row, reaching full weight only at 3+ pieces of evidence. This is used consistently by every V1/V2 projector (capability, knowledge, academic). A learner with opener-only evidence and a learner with opener+midterm+end-term+topical evidence will produce visibly different confidence, exactly as the sprint mandate expects.

**Gap (medium):** `assessment_type` (`term_exam | cat | assignment`) is stored on every evidence row but never actually used to weight anything — a single CAT and a single term exam contribute identically to trend, confidence, and "current level." Topical assessments get no special weight either, despite the codebase's own comment (`lib/assessments/topicalEvidence.ts:1-6`) explicitly calling them "the fastest and by far the highest-volume real teacher workflow" — the intelligence layer doesn't yet know that.

**Gap (medium):** the legacy `lib/learnerModel/updater.ts` tracks `validation_count` per substrand specifically to reward corroboration, but nothing reads it back into the `confidence: 'high'|'medium'|'low'` field — that field is purely `level >= 3 ? 'high' : ...`, a function of the latest score only, not how many times it's been confirmed. The Projection Engine already solved this problem; the legacy model, still dual-written on every assessment, didn't inherit the fix.

---

## Confidence Model Assessment

The sprint asked whether the platform distinguishes insufficient / conflicting / strong / outdated evidence.

| Case | Status | Evidence |
|---|---|---|
| Insufficient evidence | **Handled correctly** | `projectCapability`/`projectKnowledge`/`projectAcademic` return `null` on empty evidence rather than a fabricated value (`lib/projection/knowledgeProjector.ts:20`, `capabilityProjector.ts:29`); `computeProjectionConfidence([])` returns `0`, not a mastery score. |
| Strong/consistent evidence | **Handled correctly** | Count-factor and source-diversity tracking reward corroboration (`coverage.ts:24,57-62`). |
| Conflicting evidence | **Not handled — critical gap** | `verification_state: 'contradicted'` exists in the schema (`evidence.repository.ts:49`) and `updateVerificationState()` exists, but is never called outside a test literal. Two confirmed sources disagreeing on the same subject/term are silently averaged/latest-picked with no flag. |
| Outdated evidence | **Not handled in the confidence that reaches consumers — critical gap** | `freshnessDays` is correctly computed (`coverage.ts:18-33`) but the mastery/capability confidence formula never reads it — only a separate `completenessProjector` does (`completenessProjector.ts:30-36`), and that projection is computed, persisted, and **never read by any consumer** (Blueprint, Holiday Planner, Parent Pulse, Career Intelligence all skip it — confirmed by grep, zero imports outside the engine itself). `lib/learnerModel/types.ts:31` literally documents the intent ("confidence degrades when not validated for 60+ days") but no code implements it. |

**"No evidence" vs "poor performance" — the platform's single most important guarantee — is upheld in the new Projection Engine and broken in the legacy Learner Model.** See Findings §1 below for the concrete, live bug.

---

## Educational Authenticity Review

Judged as a CBC teacher would use it:

- The Learner Blueprint's hedged, evidence-cited language ("insufficient evidence to conclude...", confidence tiers) reads like something a careful HOD would actually say in a parent meeting. Good.
- The **old** career report (still reachable via `/api/academic-clinic/pdf`) says things like *"an excellent match"* and *"Booming — excellent future"* without a confidence qualifier attached to that sentence. A CBC teacher reading this to a parent would be making a claim the evidence doesn't support — this is the kind of overclaiming that damages trust in the platform the first time reality disagrees with it.
- Holiday Planner assigns the same two-week, two-session-a-week "critical gap" remedial pack to a learner with one shaky topical rating as to a learner with ten corroborating data points. A real teacher calibrates workload to how sure they are, not just to the raw score — a single low check should probably prompt "let's watch this" language and a lighter task, not a full diagnostic sprint. This is the most educationally-relevant gap found: it risks over-prescribing for kids who are simply under-assessed, not actually struggling.
- Career Intelligence's Junior/Senior split (broad families vs specific matches) matches how a real Kenyan CBC career-guidance teacher would talk to a Grade 8 vs a Grade 11 — verified correct and a genuine strength.

---

## Topical Assessment Evaluation

Topical checks are correctly ingested as `teacher_upload` (trust tier 3, the highest tier — a teacher personally rating a specific strand/topic), and correctly carry real `strand`/`subStrand` granularity into the Evidence Domain (`lib/assessments/topicalEvidence.ts`). That part is right and philosophically sound — a topical check *should* outrank a CSV-imported exam score in principle.

In practice, though, no projector currently gives topical evidence extra weight over a term exam — they're both just "evidence," averaged/latest-picked the same way. And separately, traditional opener/midterm/end-term exams do still produce meaningful intelligence on their own (verified: `projectAcademic` only requires `cbc_level !== null`, doesn't care about `assessmentType`) — a school that never runs a single topical check still gets a working Learner Model, Blueprint, and Holiday Plan. Graceful degradation is real, not aspirational.

One stale doc comment: `lib/projection/knowledgeProjector.ts:6-10` says "today's evidence carries no strand/topic granularity... a future evidence source... would let this projector go deeper" — but `topicalEvidence.ts` already supplies exactly that, and has since before this comment's last edit. Cosmetic, but worth a one-line fix so the next engineer doesn't build the "future" work that already shipped.

---

## Parent Intelligence Review

**Verified working as intended.** `parent_observation` sits at trust tier 1, the lowest tier, which caps its confidence at 60 (`confidence.ts:16-22`) — always below the 85 auto-confirm threshold, so a parent-reported claim always requires a teacher to manually confirm it before it can enter the Learner Model at all (`evidence.repository.ts:242-248` only reads `auto_confirmed`/`reviewed_confirmed` rows). A parent cannot silently outrank a teacher.

`buildParentPulse` (`lib/parentPulse/builder.ts`) reads the same trust-tier-gated Projection output every other consumer reads and only *selects* what to say in plain language — it does not independently compute a mastery claim that could contradict the teacher's. This is enrichment, not a second source of truth, exactly as the mandate requires.

Minor nuance (low severity): once a teacher *does* manually confirm a parent observation, the academic projector picks "latest by timestamp" with no tier-aware tie-break — so a freshly-confirmed parent claim can outrank an older teacher exam result purely on recency. Acceptable given the human-review gate, but worth knowing.

---

## Career Intelligence Review

The new engine (`lib/career/capabilityMatchEngine.ts`, `lib/learnerIntelligence/careerIntelligence.ts`) scales appropriately with evidence: `rawScore` is capped at 0.65 for fewer than 2 assessments and 0.80 for fewer than 3, correctly keeping thin evidence out of the confident "primary match" tier (threshold 0.70) most of the time. Junior mode never names a specific career — verified.

**Gap (medium):** at exactly 2 assessments the score can still reach 0.80, crossing into "primary" tier language: *"`{career}` is a natural fit for your current capability profile"* — assertive phrasing for two data points, without an explicit hedge attached to that sentence the way the rest of the new system requires.

**Gap (critical, architectural):** the old `lib/academicClinic/careerEngine.ts` still runs on every assessment submission alongside the new engine (`app/api/teacher/assessments/process/route.ts` and `app/api/parent/assessments/process/route.ts` both call it), and its report is still servable via `/api/academic-clinic/pdf`. Two independently-computed career narratives can disagree for the same student, and the older one uses less-hedged, more assertive language. This is a real, currently-live consistency risk, not a theoretical one.

---

## Blueprint Review

**Verified working as intended, with a nuance.** `buildLearnerBlueprint` genuinely reconstructs the full confirmed-evidence timeline for trend and resilience — this is real accumulation, not last-assessment-only. The nuance: the headline "current level" is deliberately the *most recent* snapshot, not an average — a design choice the code documents as "the trend IS the signal." That's defensible (a student's most recent demonstrated level is what a teacher cares about today), but it means a learner with 1 assessment at level 2.5 and a learner with 10 assessments averaging 2.5 (last one also 2.5) get an identical headline — only the trend/resilience/confidence framing around it differs. Worth knowing, not worth changing without a product conversation.

---

## Holiday Planner Review

The three previously-reported bugs (term/year never passed, batch AI response misparsed, nonexistent `students.first_name` column) are **confirmed fixed** in the current code — verified directly, not just trusted from memory.

**Gap (medium):** workload sizing is driven purely by `latestLevel <= 2`, never by the confidence behind that level. A learner with one weak topical check and a learner with ten corroborating weak data points get the identical fixed two-week remedial structure. The confidence value needed to fix this already exists on the academic projection and is simply never read by the planner.

Graceful degradation is real: exam-only evidence (no topical checks, no observations, no compass, no parent pulse) still produces a complete, non-empty holiday plan with generic-but-sensible fallback language — verified no throws, no blank plans.

---

## Findings (ranked by severity)

### CRITICAL

**1. Pathway readiness is corrupted by every single-subject update (topical checks especially) — live, high-frequency bug.**
`lib/learnerModel/updater.ts:129,550-585` (`refreshPathwayReadiness`) is called with only the *current signal's* `subjectScores` — for a topical check this is exactly one subject (`lib/assessments/topical.ts:57`: `subjectScores: { [input.subject]: r.rating }`). Inside, every one of the 7 CBC subject buckets (`mathematics`, `integrated_science`, `english`, `kiswahili`, `creative_arts`, `pre_technical`, `social_studies`) is looked up with `?? 0` (`updater.ts:558-564`), and `norm(0) = round(((0-1)/3)*100) = -33`. STEM/Social/Arts/Technical pathway scores are then **hard-overwritten** (`patchPathwayReadiness`, `updater.ts:530`, not merged with the prior value) using -33 as the contribution from every subject not touched by *this specific check* — even though that subject may have strong, recent, fully-confirmed evidence from a different assessment. Since topical checks are reported elsewhere in this codebase as the dominant real-world workflow (~7,300 rows vs ~400 for everything else), this means pathway readiness is, in practice, frequently overwritten toward large negative contributions from subjects that were simply not part of that day's check — not subjects the learner is failing. This is the exact "no evidence read as poor performance" failure the sprint mandate calls out, and it is currently live, not latent.
*(Note: a related `?? 0` fallback at `updater.ts:60` for the per-substrand mark was also flagged during research — verified directly against all three call sites and confirmed unreachable in current code, since every caller always includes the subject key it's iterating over. Not a live bug, but a footgun for any future caller that doesn't follow that pattern; worth a defensive `throw` instead of a silent `0` if touched.)*

**2. Two independently-computed career/report narratives are simultaneously live for the same student.**
`lib/academicClinic/careerEngine.ts` + `reportGenerator.ts` still run via `runAssessmentPipeline` on every teacher and parent assessment submission (`app/api/teacher/assessments/process/route.ts`, `app/api/parent/assessments/process/route.ts`), fully in parallel with the new `lib/career/` + `lib/learnerIntelligence/careerIntelligence.ts` pipeline that also runs on the same submissions. The old PDF report is still servable at `/api/academic-clinic/pdf`. A parent can see one career narrative in the app's new Career Intelligence UI and a different one, computed independently with different confidence handling, in an old PDF report.

**3. Conflicting evidence is never detected.** `verification_state: 'contradicted'` and `updateVerificationState()` exist in the schema/repository but are never invoked outside a test. Two confirmed, trust-tier-3 sources that disagree on the same subject/term are silently resolved by "latest wins," with no flag surfaced anywhere.

**4. Staleness never reaches the confidence teachers/parents actually see.** `freshnessDays` is computed correctly but only consumed by `completenessProjector`, and that projection has zero downstream consumers — Blueprint, Holiday Planner, Parent Pulse, and Career Intelligence all skip it. A learner whose only evidence is 18 months old currently gets exactly the same confidence framing as one assessed last week.

### HIGH

**5. Old career-report language overclaims relative to its evidence.** `academicClinic/careerEngine.ts`'s `matchLabel` ("an excellent match" at ≥70%) and `outlookMap.booming` ("Booming — excellent future") are stated as flat fact with no attached confidence/evidence-count qualifier — the exact overclaiming the new `Insight` type (`lib/learnerIntelligence/insight.ts`) was built to prevent. Compounded by Finding 2: this is the language actually reaching parents via the still-live PDF path.

**6. Misconceptions are overwritten, not tracked.** `SubstrandMastery.root_cause` (the closest thing to a misconception record) is a single string, replaced on every assessment, and silently cleared to `undefined` the moment a score crosses above level 2 (`updater.ts:72`) — with no history of what the misconception was or how it was resolved. A dedicated `eir_misconceptions` table exists but belongs to the frozen EIR system and has no live writer.

### MEDIUM

**7. Holiday Planner ignores evidence confidence when sizing workload.** Covered above — the fix is to read the confidence value that's already computed, not to build new infrastructure.

**8. Topical assessments carry no extra weight** despite being the platform's own stated highest-trust, highest-volume evidence source; `assessment_type` is stored but unused by every projector.

**9. Legacy Learner Model's `confidence: 'high'|'medium'|'low'` ignores `validation_count`**, unlike the Projection Engine's count-factor, which already solved this correctly. Dual-write divergence between the two systems.

**10. Career Intelligence's "primary" match tier can trigger assertive language at exactly 2 assessments**, just above the deliberate evidence-count caps.

### LOW

**11. Stale doc comment** in `knowledgeProjector.ts` claims no strand/topic granularity exists; `topicalEvidence.ts` already supplies it.
**12. No trust-tier-aware tie-break** in academic projection aggregation after a parent observation is manually confirmed by a teacher — acceptable given the human-review gate, but worth knowing if that assumption is ever relied on elsewhere.

---

## Fixes

Not applied in this pass — these touch core scoring/state logic with real blast radius (learner model, career reports parents already see), so they're proposed here for sign-off rather than shipped silently:

- **#1 (critical, do first):** change `refreshPathwayReadiness` to merge per-subject contributions into the existing `PathwayReadiness` state rather than recomputing all 4 buckets from only the current signal's subjects — e.g. carry forward `prev`'s per-subject inputs for any subject not present in this call, instead of defaulting to `norm(0)`.
- **#2 (critical):** pick one career/report pipeline. Given the new system's better evidence discipline (Findings §Career Intelligence Review), the recommended direction is to stop invoking `academicClinic/careerEngine.ts` + `reportGenerator.ts` from the two `assessments/process` routes and retire `/api/academic-clinic/pdf` once Career Intelligence + Blueprint PDF cover the same use case — this is a decommissioning decision, not a design decision, and should be confirmed with product before touching the write path.
- **#3:** wire `updateVerificationState('contradicted', ...)` into `persistEvidenceBatch`'s supersession logic when two auto-confirmed rows for the same claim key disagree beyond a threshold, and surface that flag in Blueprint/Holiday Planner language ("conflicting evidence — a teacher should review this").
- **#4:** feed `coverage.freshnessDays` into `computeProjectionConfidence` (or a sibling function used by Blueprint/Holiday Planner) so old evidence visibly loses confidence, matching the intent already documented at `learnerModel/types.ts:31`.
- **#7:** have `lib/holiday/planner.ts` read `academic.confidence` (already computed) when selecting task intensity — low confidence + low level → lighter/observational task, not full remedial pack.
- **#11:** one-line comment fix in `knowledgeProjector.ts`.

---

## Deferred Items

- Weighting topical vs traditional-exam evidence differently (#8) — real but not urgent; current behavior is safe, just not optimal. Needs a product decision on the actual weight, not just an engineering fix.
- Misconception history/versioning (#6) — a genuine gap but scoped work, not a quick fix; the frozen EIR system already has schema for this if it's ever revived.
- 2-assessment "primary" match tier hedge (#10) — small copy/threshold tweak, low urgency.
- Parent-observation tie-break tier-awareness (#12) — acceptable as-is; revisit only if the human-review assumption changes.

---

## Engineering Confidence: **High**

TypeScript, ESLint, and the codebase's own architecture hold up under close reading — the Evidence Domain, confidence-scoring, and Projection Engine are correctly implemented for what they claim to do. `npx tsc --noEmit` shows 2 pre-existing errors, both in unrelated script/test files (`scripts/create-compass-auto-confirm-account.ts`, `scripts/reference-school/integration.test.ts`), confirmed pre-existing via `git diff` against the last commit — not introduced by anything reviewed here. ESLint is clean (`--quiet`, zero errors) across every file touched by this sprint (`lib/learnerModel`, `lib/learnerIntelligence`, `lib/parentPulse`, `lib/holiday`, `lib/projection`, `lib/career`, `lib/intelligence`).

## Educational Confidence: **Medium**

The philosophy is right and mostly implemented correctly where it matters most (evidence trust tiers, graceful degradation, Junior/Senior career framing, parent-vs-teacher authority). But the pathway-readiness bug (#1) means the platform's single most safety-critical guarantee — never confuse absence of evidence with poor performance — is currently being violated in the dominant real-world workflow (topical checks). A CBC teacher trusting a pathway-readiness score today could be looking at a number corrupted by a check that had nothing to do with that pathway.

## Final Go / No-Go: **Conditional Go**

Safe to continue the 50-teacher pilot as-is — none of the findings here surface directly as an obviously-wrong number in the teacher/parent-facing UI today (pathway readiness is a background signal, not yet a headline metric reviewed elsewhere in this sprint's scope). But Finding #1 should be fixed before pathway readiness is promoted to anything more visible, and Finding #2 (dual career narratives) should be resolved before scaling beyond the pilot cohort, since it's the one finding here that a real parent could actually notice and lose trust over.
