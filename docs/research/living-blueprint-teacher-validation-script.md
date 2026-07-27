# Living Blueprint — Teacher Validation Script

**Phase:** 4B — Experienced Teacher Validation of the Living Blueprint
**Purpose:** a human validation phase, not an implementation sprint. This script is for the founder or another facilitator to run three structured sessions with experienced teachers.

**Product version tested:** git `HEAD` = `b0a2ae75c885cc15265dd639866e51dd69086540`, plus the following uncommitted, already-verified Phase 4A/4A-conformance changes present in the working tree at the time of this validation (recorded exactly so every session tests the identical build — see the Implementation Rules below):

- `lib/learnerBlueprint/coherence/` (new) — the Coherence Engine itself.
- `lib/learnerBlueprint/composeLearningStory.ts` — single-subject weakest-selector fix.
- `lib/learnerBlueprint/actionPlan/lifecycle.ts` — `approveBlueprintAction()` now blocks approval on a coherence FAIL.
- `components/blueprint/BlueprintView.tsx` — `metadata.ownerVersions` removed from teacher-facing wording.
- `docs/architecture/blueprint-intelligence-coherence-engine.md` §11 — the Phase 4A Conformance Audit.
- `scripts/reference-school/08-seed-teacher-validation-cases.ts` (new, this phase) — adds real, additional canonical Evidence for three reference-school learners so this session has genuinely differentiated cases to use (see "Learner Cases" below).

All three teacher sessions must run against this exact state. Do not apply code fixes between sessions (see Implementation Rules).

---

## Learner Cases

All three reference-school (Mwatate Ridge Senior School) learners below were selected after a full scan of all 60 seeded learners found them uniform (one subject, one evidence point, `insufficient_data` trend, no risk, no approved action). Real, additional Evidence was added to three of them through the canonical evidence writer — see `scripts/reference-school/08-seed-teacher-validation-cases.ts` for exactly what was added and why; nothing about a classroom interaction was invented, only assessment-shaped Evidence rows through the same writer the live gradebook uses.

| Case | Learner | Profile | Coherence result (verified) | Blueprint URL |
|---|---|---|---|---|
| 1 — Clear supported challenge | Cheruiyot Gitau (`d3b3249a-7e08-484f-bfeb-55b7f231269f`) | Mathematics: Level 3 → Level 1, declining, n=2. Kiswahili: Level 2, `insufficient_data`, n=1. A real Risk flag ("Below Expectation in mathematics and declining from prior evidence") is now active. | `PASS_WITH_WARNINGS` — one warning: the active Risk flag has no corresponding approved action yet (expected — none has been proposed for this case yet; see Facilitator Pre-Work) | `/student/blueprint/d3b3249a-7e08-484f-bfeb-55b7f231269f` |
| 2 — Strong, needs enrichment | Victor Gitau (`a5b220e5-593a-4153-ac27-75f0c25cfbf5`) | Mathematics: Level 3 → Level 4, improving, n=2. Kiswahili: Level 4, `insufficient_data`, n=1. No active Risk flags. | `PASS_WITH_WARNINGS` — one warning, root-caused below | `/student/blueprint/a5b220e5-593a-4153-ac27-75f0c25cfbf5` |
| 3 — Insufficient / mixed evidence | Chebet Rotich (`f01f9abc-a250-474a-814c-34b8269003fa`) | Kiswahili: Level 3, `insufficient_data`, n=1. Mathematics: Level 2, `insufficient_data`, n=1 — both individually thin, genuinely mixed. | `PASS_WITH_WARNINGS` — same warning as Case 2, same root cause | `/student/blueprint/f01f9abc-a250-474a-814c-34b8269003fa` |

**Root cause of the Case 2/3 warning, checked, not guessed:** `academicRecord.overallTrend` is sourced from `growthProjector.ts`'s "holistic growth" trend, which pools ALL of a learner's evidence across every subject, sorts it chronologically, splits it in half, and compares the average level of the first half to the second half — it does not compute per-subject. For both Case 2 and Case 3, the learner's *earliest*-recorded subject (Kiswahili) happens to sit at a different level than their *later*-recorded subject (Mathematics), which the algorithm reads as "declining," even though no single subject is actually declining (Case 2's Mathematics is `improving`; Case 3's two subjects each have too little evidence, individually, for any trend at all). `composeLearningStory.ts`'s narrative correctly does not claim a decline anywhere, and the Coherence Engine's `narrative_alignment` rule correctly flags that the structured `overallTrend` field and the narrative disagree — this is the engine working as designed, not a coherence-engine defect. The actual root cause lives in `growthProjector.ts` (Projection layer), which this validation phase does not touch (Implementation Rules: no Evidence/Projection/Coherence architecture changes during validation). **This is left in deliberately** as real, honest material for the session — a good test of Task 2 ("is anything stated too confidently?") and Task 5 (can the teacher trace why the system said what it said, and does the disagreement itself get noticed).

**Known, disclosed limitation:** the Phase 3B demo learner (`07cf873b-f7d9-47eb-bb08-926da716adca`) is NOT usable for this validation — his Blueprint currently returns coherence `FAIL` and is withheld from rendering entirely, because his one approved action pre-dates the Phase 4A approval-boundary fix and is now immutable (the DB trigger blocks editing an `approved` row). Do not use him as a case; do not attempt to fix this during the validation (out of scope — see Implementation Rules).

## Pre-Session Setup Verification

Before each session, confirm for that session's assigned learner case:

| Check | How to verify | Status |
|---|---|---|
| Blueprint composition succeeds | Load `/student/blueprint/<learnerId>` as the assigned teacher, confirm it renders (not withheld) | ✅ verified for all 3 cases (see below) |
| Coherence result is visible internally | `composeBlueprint()`'s `coherence.result` field, checked via the same script that seeded the cases | ✅ all 3 cases return `PASS_WITH_WARNINGS` — see "Learner Cases" table below for the exact warning on each; none is a FAIL, none blocks rendering |
| No coherence-FAIL action can be approved | Phase 4A Conformance Audit §11.4/§11.6 — `lifecycle.integration.test.ts` test 11b, 25/25 passing | ✅ verified in code, not specific to these 3 learners (none has a pending action yet) |
| Evidence references are available | Academic Record section on the Blueprint page shows subject/level/trend per subject | ✅ |
| Teacher approval works for a coherent action | Propose one real action for the assigned learner in advance (see "Facilitator Pre-Work" below), confirm it approves cleanly | ✅ done for Case 1 (Cheruiyot Gitau) — a real action ("Strengthen Mathematics foundations through targeted practice") was proposed via the canonical `proposeBlueprintAction`, evidence-grounded in the actual declining Mathematics record; `composeBlueprint()` still returns `PASS_WITH_WARNINGS` (not FAIL) with the action left `proposed`, so Task 4's live approval is untouched for the session. **Cases 2 and 3 still need this same pre-work before their sessions** — not yet done. |
| Assignment or Compass delivery available | `deliverBlueprintActionAsAssignment` / `deliverBlueprintActionToCompass`, reachable once an action is approved | Not independently re-verified per-case (would require actually approving the action, which is reserved for the teacher to do live in Task 4). Generic code path verified via `lifecycle.integration.test.ts` tests 21/22 (25/25 passing). Facilitator should smoke-test this once, on a disposable action, before the very first session. |
| Review Workspace reachable | `/teacher/...` review workspace route lists the approved action | Not independently re-verified per-case, for the same reason as above. Generic code path covered by `review.integration.test.ts`/`reviewWorkspace.integration.test.ts` (not re-run in this phase). |
| Teacher-facing wording contains no internal implementation paths | `metadata.ownerVersions` leak fixed (Phase 4A Conformance Audit §11.2 Area 10) | ✅ |

### Facilitator Pre-Work (before each session)

For the assigned learner, propose ONE real action item as the facilitator/teacher account, using their real evidence — do not write the action's content to make the demonstration look stronger than the evidence supports; let the teacher being tested see the system's actual, unedited proposal quality. Do not approve it yourself — Task 4 asks the participating teacher to make that decision live.

**Case 1 (Cheruiyot Gitau) — already done.** A real action, "Strengthen Mathematics foundations through targeted practice," was proposed as the learner's actual bridged teacher (Achieng Nafula), grounded in the real declining-Mathematics evidence, and left in `proposed` status. Blueprint coherence remains `PASS_WITH_WARNINGS` (not FAIL) with the action left undecided — Task 4 is untouched for this case.

**Cases 2 and 3 — not yet done.** Propose one real action for each before that session, following the same pattern: resolve the learner's real bridged teacher, sign in as them, call `proposeBlueprintAction` with a rationale/action grounded in their actual evidence (Case 2's improving Mathematics record suggests an enrichment-framed action, e.g. extension material; Case 3's mixed record suggests an action that names the uncertainty rather than picking a side). Confirm `composeBlueprint()` still returns `PASS_WITH_WARNINGS`, not `FAIL`, before the session.

### Setup Limitations (recorded honestly, not hidden)

- The reference-school seed data is otherwise extremely uniform — outside the 3 seeded cases above, no learner in this school shows meaningful differentiation. This is a real characteristic of the current dataset, not something to read into a teacher's reaction to a specific case.
- No real (non-reference-school) pilot learner exists yet (zero pilot schools onboarded as of this writing) — every case here is reference-school fixture data, disclosed to the teacher as such if asked, never presented as a real learner's real record.
- Assignment/Compass delivery and Review Workspace reachability were not independently re-verified for these 3 specific NEW cases at authoring time (only the underlying, general lifecycle code paths were, via the existing test suite) — the facilitator must complete "Facilitator Pre-Work" above before each live session and note here if anything doesn't work as expected.

---

## Session Introduction (keep brief — do not explain the Blueprint first)

> "EduNexus tries to help a teacher understand why a learner may be struggling or progressing, and what could be done next. Please use this as you naturally would. We are testing the product, not testing you."

Do not explain how the Blueprint works before the teacher explores it. Do not correct the teacher during Task 1.

---

## Task 1 — Understand the Learner

Ask the teacher to inspect one Blueprint and explain:

- What does EduNexus believe about the learner?
- What is the learner's main need or opportunity?
- How confident does the system appear to be?
- Which evidence seems to support the conclusion?

Do not correct the teacher during this task.

## Task 2 — Evaluate the Recommendation

Ask:

- Do you agree with the recommendation?
- What do you agree with?
- What do you disagree with?
- Is anything missing?
- Is anything stated too confidently?
- Would another reasonable interpretation be possible?

## Task 3 — Evaluate the Proposed Action

Ask the teacher to assess whether the action is:

- specific
- practical
- appropriate for the learner
- realistic within ordinary classroom constraints
- measurable or reviewable
- something they could begin on Monday

## Task 4 — Make a Professional Decision

Ask the teacher to approve, reject, or defer the action using the product itself (not verbally — have them click through it).

Observe whether they understand:

- that the teacher owns the decision
- what approval means
- what happens after approval
- the difference between Assignment and Compass delivery
- how the action will later be reviewed

## Task 5 — Trace the Reasoning

Ask: **"Why do you think EduNexus recommended this?"**

Observe whether the teacher can trace Evidence → Projection → recommendation → action without facilitator explanation.

## Task 6 — Compare Against Current School Tools

Ask:

- Is this different from a report card?
- Is this different from an LMS?
- Is this different from entering the same information into ChatGPT?
- What would make a school pay attention to this?
- What would stop a school from using it?

---

## Validation Questions (ask exactly, or with minimal adaptation)

1. In your own words, what is happening with this learner?
2. What evidence convinced you?
3. What evidence is missing?
4. Is any conclusion stronger than the evidence allows?
5. Do you agree with the proposed next action?
6. Could you use this action in a real classroom next week?
7. How would you know whether the action worked?
8. Did you feel that EduNexus was advising you or deciding for you?
9. What would you change before showing this to another teacher?
10. Would this help you explain the learner to a parent or school leader?
11. What does EduNexus do here that your existing school system does not?
12. What part, if any, felt like generic AI-generated writing?

---

## Success Criteria (validation thresholds, not marketing metrics)

The Living Blueprint is ready for a limited school pilot only if:

- all three teachers can explain the central learner need without facilitator translation;
- at least two of three can identify the supporting evidence;
- all three understand that the teacher remains the decision-maker;
- no teacher identifies a direct evidence/action contradiction that passed coherence validation;
- no coherence-FAIL action can be approved in the live workflow;
- at least two of three judge the proposed action practical enough to attempt;
- at least two of three understand how the action would later be reviewed;
- the product's difference from a report card, LMS, and generic chatbot is understood by at least two teachers;
- there are no unresolved CRITICAL findings.

---

## Implementation Rules for the Facilitator

- Do not change production code before completing all three teacher sessions.
- Do not fix issues after the first teacher and then test a different product with the remaining teachers — all three teachers evaluate the same product version (the git state recorded at the top of this document).
- Record the exact commit/git state actually tested for each session, in the observation template, in case drift occurs.
- Preserve disagreement between teachers rather than averaging it away.
- Separate teacher preference from an actual educational or usability defect.
- Do not treat one teacher's preferred terminology as automatically canonical.
- Do not add AI calls or new schema during this phase.
- Do not expand into parent, principal, or broad-pilot validation during this phase.
- Do not reopen Phase 4A unless a session reveals a confirmed coherence-boundary defect (a FAIL that reached approval/delivery live, not a wording or UX preference).

Use `docs/research/living-blueprint-teacher-validation-observation-template.md` to record each session, and produce `docs/research/living-blueprint-teacher-validation-findings.md` only after all three sessions are complete.
