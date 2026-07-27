# ADR-0030 — Blueprint Context Selection Is Teacher-Confirmed, Never Calendar-Inferred

**Status**: Accepted (Phase 0 of `docs/architecture/blueprint-living-action-plan-audit.md`)
**Depends on**: ADR-0005–0009 (Blueprint architecture/lifecycle), `blueprint-living-action-plan-audit.md` §4/§7.
**Scope**: This is a policy decision only. No schema change, no new table, no new column. It governs how a future Blueprint `context` value (`current_term` / `intervention` / `extension` / `end_of_term` / `holiday` — introduced in a later phase) may be set, not the mechanics of storing it.

## Why this decision exists now, before the context field itself

The audit (`blueprint-living-action-plan-audit.md` §4, §7 Phase 0) found two structurally independent "current term" sources that can disagree:

- **Core's DB-driven model** — `academic_years`/`terms` tables, `is_current` admin-set per school (`lib/core/school.ts`'s `getCurrentTerm`/`getCurrentAcademicYear`). Returns `null`, not a throw, when a school hasn't configured a current term.
- **Holiday Planner's hardcoded adapter** — `KE_CBC.getCurrentTerm(date)` in `lib/curriculum/regional/ke-cbc.ts`, a nationwide month-based lookup independent of any individual school's real calendar.

Neither of these was ever designed to gate anything as consequential as "did this learner get assigned holiday work" — they were built to answer "what term is it," not "should this action plan publish." Before a `context` field exists at all, this ADR fixes the rule so that whichever calendar source ends up feeding it can never become an implicit authorization mechanism.

## The rule

### Authoritative context rule

**The Blueprint context is explicitly selected or confirmed by the teacher.** No other actor and no automated process may set or silently change it.

Supported future context values (introduced in a later phase, not this one): `current_term`, `intervention`, `extension`, `end_of_term`, `holiday`.

Calendar and term data may **suggest** a default context. They must never be **authoritative**. Concretely, neither Core's `terms.is_current` nor `KE_CBC.getCurrentTerm()` may, on their own:

- create a holiday action plan;
- change an existing Blueprint's context;
- publish holiday work;
- assign work to a learner;
- override a context the teacher already selected.

This applies even where a superficially similar automatic behavior already exists elsewhere in the codebase — e.g. Holiday Planner's existing 3-day draft-grace auto-publish cron (`app/api/cron/auto-publish-holiday-plans/route.ts`) auto-publishes a plan a teacher already generated and left in draft; it does not auto-*create* a plan or auto-*select* holiday context from a date. That distinction — automating "finish what a teacher started" vs. automating "decide what a teacher would have wanted" — is the line this ADR draws, and any future action-plan context-selection logic must stay on the correct side of it.

### Calendar assistance behavior

Calendar information **may**:

- suggest `current_term` during an active term;
- suggest `end_of_term` near a configured closing period;
- suggest `holiday` after the configured term closes;
- display a warning when Core's term data and the `KE_CBC` adapter disagree.

In every case, the teacher must still confirm the context before it takes effect. A suggestion is a pre-filled UI default, never a value written without a teacher action.

### Missing or conflicting calendar data

If calendar information is missing or inconsistent (e.g. `getCurrentTerm` returns `null`, or Core and `KE_CBC` disagree on what term it is):

- do not infer a definitive context;
- require explicit teacher selection — no default is pre-filled when the underlying signal is absent or contradictory;
- preserve whatever value the teacher selects, regardless of what the calendar signals say;
- log or surface the inconsistency (e.g. as a UI warning or a structured log entry) without blocking the teacher from acting.

A school with incomplete calendar configuration must never be silently blocked from using the action-plan feature — the fallback is "ask the teacher," never "refuse" or "guess."

### Holiday-work rule

Selecting `holiday` as the context does **not**, by itself, automatically approve or create holiday work. Holiday work under this context remains:

- optional;
- teacher-controlled;
- separately reviewed;
- separately approved;
- subject to a later, distinct delivery-mode selection (Compass session, assignment, printable, parent-support-only, or none).

Selecting a context is a classification step. It carries no approval semantics of its own.

## Consequence for a future implementation

Whatever component eventually reads calendar state to power the context-selection UI (§7 Phase 1+ of the audit) must treat `getCurrentTerm()`/`getCurrentAcademicYear()`/`KE_CBC.getCurrentTerm()` purely as *signal for a suggested default*, never as an input to any code path that writes, publishes, or dispatches an action plan. Any code that would make calendar state authoritative over teacher selection is a violation of this ADR, not an acceptable optimization.
