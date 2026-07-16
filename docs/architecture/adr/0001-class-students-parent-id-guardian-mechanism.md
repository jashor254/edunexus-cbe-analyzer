# ADR 0001 (DRAFT — NOT APPROVED — NOT IMPLEMENTED): `class_students.parent_id` as a Guardian Mechanism

**Status: DRAFT.** This is a decision candidate prepared per Sprint 2B's Phase 4 instruction. It contains no implementation, proposes no code change, and is not authorized for action until explicitly approved. Per the Reference Architecture Specification §12's ADR process, this becomes a real ADR only on explicit ratification.

## Problem Statement

Three distinct mechanisms currently answer "is this user a parent/guardian of this learner" in the EduNexus codebase:

1. `students.parent_user_id` — a direct column on the legacy `students` table.
2. Core's `learner_guardians` table — a proper join table for the Core `learners` schema.
3. `class_students.parent_id` — a column on the legacy class-roster join table.

`lib/core/identity.ts::resolveParent` and `lib/core/permissions.ts::requireParent` (the canonical services built in Sprint 1A) model only the first two. The third has no canonical representation anywhere in `lib/core/`, despite being a real, actively-used access-control mechanism.

## Evidence Collected

`class_students.parent_id` has been found, read, and left deliberately untouched in **five files across three separate sprints**, each time re-confirming the same gap rather than assuming it from memory:

| # | File | Sprint/Batch | What it does |
|---|---|---|---|
| 1 | `app/api/reports/clinic/[reportId]/url/route.ts` | Batch B | One of four ownership branches for a signed-URL grant |
| 2 | `app/api/parent/alerts/route.ts` | Batch F | The *only* mechanism this route uses — `class_students.parent_id = user.id` scopes the entire query, no fallback to `students.parent_user_id` |
| 3 | `app/api/student/join-class/route.ts` | Batch G | Written (not read) — `class_students.insert({..., parent_id: userId})` when a student self-joins a class via code |
| 4 | `app/api/class/join/route.ts` | Batch G | Written — `class_students.update({parent_id: userId})` for every unlinked student in a class when a parent redeems an invite code |
| 5 | (Referenced in Sprint 2A's verification, not independently re-read this sprint) | Sprint 2A | Confirmed recurrence pattern across the series |

**A specific correctness question raised by entry #3, not previously noted**: `student/join-class/route.ts` writes `parent_id: userId` where `userId` is the *student's own* authenticated user — meaning `class_students.parent_id` is being used to record "who joined this row into the class" (an actor), not strictly "who this child's parent is" (a relationship). This is evidence the column's real semantics may already be broader than "parent" in current usage — a fact this ADR surfaces for the eventual decision-maker, not one this document resolves.

## Occurrences

Five files, three sprints (B, F, G), zero attempts at consolidation (each discovery correctly deferred per the Discovery Rule in effect at the time).

## Architectural Impact

- **Canonical Domain Registry**: the Guardian domain entry currently names `learner_guardians` (Core) and implicitly `students.parent_user_id` (legacy) but does not mention `class_students.parent_id` at all. The registry is incomplete relative to actual system behavior.
- **`lib/core/identity.ts::resolveParent`**: currently returns `{studentIds, coreLearnerIds}` — two arrays, covering mechanisms #1 and #2. A third array (or a different aggregation strategy) would be needed to make this function a complete answer to "who is this person's guardian, everywhere the system might ask."
- **`lib/core/permissions.ts::requireParent`**: would need the same extension, and every existing call site would need to be re-verified against the *new*, broader semantics — a determination that could genuinely widen access at the ~7 files that already call `requireParent`, not merely refactor them.

## Affected Domains

Guardian (primary), Learner (secondary — the ambiguity in entry #3 above touches learner/roster semantics too), Class Roster (the table itself is a Class-domain artifact carrying a Guardian-domain responsibility, which is itself worth noting as a modeling smell independent of this ADR's main question).

## Possible Future Options

Presented neutrally — this ADR does not recommend one over the others without further product input:

**Option A — Fold `class_students.parent_id` into `resolveParent`/`requireParent` as a third checked source.**
- Pro: one function answers the guardian question completely; closes the gap that's been re-discovered five times.
- Con: as entry #3 shows, the column's real-world usage may not be pure "guardian" semantics — folding it in without resolving that ambiguity risks baking a misunderstanding into the canonical service.

**Option B — Formally document `class_students.parent_id` as a permanently separate, third mechanism, with its own named function (e.g. `resolveClassRosterParent`), not merged into `resolveParent`.**
- Pro: honest about the three mechanisms being genuinely different (temporal/contextual — this one seems tied to roster-join events, not a persistent guardian declaration); avoids the ambiguity risk in Option A.
- Con: keeps three mechanisms permanently, which is what created the confusion in the first place.

**Option C — Data investigation first (a Stage-0-style read-only audit): determine how often `class_students.parent_id` actually diverges from `students.parent_user_id` for the same student, and whether entry #3's actor-vs-relationship ambiguity is common or rare.**
- Pro: replaces the current inference-based understanding with real evidence before either A or B is chosen — consistent with this entire project's stated evidentiary discipline.
- Con: takes a sprint's worth of investigation before any decision, on a mechanism that hasn't caused a known incident yet.

## Recommendation

**Option C, then a follow-up decision between A and B once the data is in hand.** This is offered as the evidence-gathering discipline this project has consistently favored over speculative design (see the Constitution's Ninth Law and every Discovery Rule invocation in this series) — not a final architectural recommendation, since that would require the data Option C would produce.

---

**This ADR is a DRAFT. It has not been approved. No code, schema, or canonical service has been changed as a result of preparing it. It requires explicit ratification — including which option to pursue — before any implementation begins.**
