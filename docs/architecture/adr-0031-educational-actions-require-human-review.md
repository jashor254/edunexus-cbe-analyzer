# ADR-0031 — Educational Actions Require Human Review

**Status**: Accepted (Phase 2D of `docs/architecture/blueprint-living-action-plan-audit.md`)
**Depends on**: ADR-0005–0009 (Blueprint architecture/lifecycle), ADR-0030 (context is teacher-confirmed, never calendar-inferred), `docs/architecture/blueprint-review-loop-phase2d.md`.
**Scope**: This is a policy decision that governs every present and future point in the platform where software observes learner activity following a Blueprint-driven intervention. It does not introduce new mechanics beyond Phase 2D's `reviewBlueprintAction()` service; it fixes the rule that service — and everything built after it — must never violate.

## The rule

**Educational actions are never considered successful because software observed activity. They become successful only after a qualified educator reviews the resulting evidence and records a professional judgement.**

Concretely: submission, completion, session-count, inactivity, a new Evidence row, or a new Projection value may never — on their own, without an explicit act by a teacher — mark a Blueprint action item, an assignment, a Compass delivery, or any future educational action as "done," "successful," or "complete." The platform's job stops at organizing and presenting what happened; the judgement of whether it constitutes success belongs to a human educator, every time, with no automatic-success path around them.

## Why this decision exists now

The Blueprint execution cycle this platform has now fully built out is:

```
Evidence -> Projection -> Blueprint -> Teacher Approval -> Blueprint Action
  -> Delivery -> Learner Interaction -> New Evidence -> Teacher Review
```

Every stage before the last already embeds a version of this same principle, independently, without ever having been written down as one rule:

- **Blueprint Action approval** (Phase 1) requires an explicit teacher decision (`approveBlueprintAction`) — a system-generated candidate is never auto-approved, regardless of source.
- **Assignment delivery** (Phase 2B) requires `confirmClassWideDelivery: true` — explicit, never a default.
- **Compass delivery** (Phase 2C) requires `confirmCompassDelivery: true` and creates only a *queued* objective — the learner's own action starts tutoring, never the delivery itself.
- **Evidence confirmation** (`lib/intelligence/evidenceLifecycle.ts`) distinguishes `auto_confirmed` (high-trust-tier, unambiguous sources) from work still needing human review (`findPendingReview`) — the platform already does not treat every signal as equally load-bearing without a human backstop somewhere in the chain.

What was missing was the *last* stage: nothing closed the loop by asking a teacher "given everything that happened, was this action successful?" Without Phase 2D, the architecture had a structural gap where it would have been easy — even natural — to let "the assignment got marked" or "the learner did 4 Compass sessions" silently stand in for "this worked," the exact failure mode this ADR forecloses.

## Why this couldn't be quietly inferred instead

It would be technically straightforward to compute a plausible "looks complete" signal — e.g., "assignment fully marked AND average score above X AND at least one Compass session AND Projection confidence increased." This ADR rejects that path, for the same reason CLAUDE.md already forbids fabricated confidence and this codebase's own Evidence-First Learner Intelligence Mandate insists every insight need an Observation/Evidence/Confidence/Action chain a human can inspect:

- **A rubric like that is itself an unaccountable, invisible decision** — baked into code, not visible to the teacher who owns the outcome, and wrong in ways that only surface much later (a learner who submits confidently-worded work that isn't actually correct; a Compass session count that reflects distraction, not mastery).
- **The people closest to the learner have context no signal captures.** A teacher watching a learner in class knows things "4 sessions, 78% average" cannot: whether the learner was coached through it, whether the apparent improvement reflects a lucky assessment, whether the learner is masking difficulty. Removing the teacher from the final call removes exactly the judgement this platform's Kenyan CBC/CBE audience most needs it to preserve.
- **It would make the platform, not the teacher, the answerable party.** If software silently marks a learner's intervention "successful," and it wasn't, there is no human decision to point to — a fabricated-trust failure mode with real consequences for a learner's education, not a UX inconvenience.

## The rule, operationalized (Phase 2D)

`reviewBlueprintAction()` (`lib/learnerBlueprint/actionPlan/review.ts`) is the sole mechanism by which a review verdict is ever recorded, and it accepts exactly five outcomes, all requiring an authenticated, authorized teacher to choose one explicitly: `Complete`, `Needs Revision`, `Reopen`, `Defer`, `No Decision`. There is no sixth, automatic value. The service:

- **Gathers, never concludes.** It reads (never recomputes) the latest Assignment completion state, Compass session summary, Evidence, and Projection — presenting a snapshot, not a verdict.
- **Writes only what the teacher chose.** The five decisions above are the entire vocabulary; nothing in the codebase can reach a sixth "auto-completed" state.
- **Never mutates the action item's own lifecycle status.** `blueprint_action_items.status` remains `approved` regardless of how many times an item is reviewed — a review is a fact appended to history, not a status transition (Phase 2D doc §5, mirroring Phase 2B/2C's identical "delivery is an event, not a mutation" precedent).

## Consequences

- **No feature may add a "mark complete" button, cron job, or webhook that bypasses `reviewBlueprintAction()`** for any Blueprint-originated action. If a future integration (e.g. an external LMS webhook reporting "assignment graded") wants to influence completion, it may feed data INTO the review snapshot (as another read-only input) — it may never write a verdict on its own.
- **This generalizes beyond Blueprint.** Any future educational-action surface this platform builds (a second delivery channel beyond Assignment/Compass, a parent-initiated intervention, an AI-tutoring outcome) inherits this same rule: software may summarize; only a qualified educator may conclude success. A future ADR narrowing or extending this scope must explicitly amend this one, not silently diverge from it.
- **This does not forbid automation elsewhere.** Ingestion, extraction, evidence confirmation for genuinely unambiguous high-trust sources, and projection computation all remain automated — this ADR is scoped precisely to the single "was this educational action successful" judgement, not to every computation in the pipeline that feeds it.

## Amendment

This ADR is "hard to amend" in the same sense as the EduNexus Constitution: automating any part of the final review judgement requires a new ADR that names this one, states the specific, narrow case being carved out, and the safeguard that prevents the carve-out from silently expanding. A blanket removal of the human-review requirement is not a decision this document anticipates being made lightly.
