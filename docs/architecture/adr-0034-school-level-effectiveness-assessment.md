# ADR-0034 — School-Level Effectiveness Assessment (Intelligence-owned)

**Status**: Accepted — 2026-10-15 (founder-approved, PE-1 freeze exception).
**Depends on**: RAS §9 (Intelligence separation), RAS Operating-Layer ownership rules (non-null `school_id`, `school_users` RLS pattern), `docs/architecture/learner-record-layer-decisions.md` Decision 5 (canonical read-paths), `lib/core/permissions.ts` (consolidated authorization). Builds on the already-shipped pure model `lib/schoolEffectiveness/` (benchmarks + scorer).
**Scope**: Persisting and computing the CBC-Gatsby **School Effectiveness Check** — a school-level diagnostic. Not a learner-level artifact; no change to any learner Intelligence module, Evidence, or Operating table.

## Context

EduNexus needs to persist a school-level diagnostic (the CBC-Gatsby School Effectiveness Check) that combines two kinds of input:

- **Self-report** answers entered by a school (or by us, on a prospect's behalf) — *new ground-truth data* that does not exist anywhere today.
- **Auto-derived** maturity ratings computed for a school already using EduNexus, from existing canonical learner Intelligence (evidence coverage, Career Intelligence usage, Portfolio/Achievements, Compass, SOW→career links).

This is the first **school-level** (not learner-level) Intelligence artifact in the system, and persisting the self-report answers introduces a new canonical identity — hence this ADR.

## Decision

1. **A new Intelligence-owned table, `school_effectiveness_checks`**, following the `learner_projections` ownership pattern — not a field bolted onto any Operating-Layer table (RAS §9). Non-null FK `school_id`, `created_by`/`updated_by` from the authenticated actor, `created_at`/`updated_at`, and the `school_users` membership RLS pattern (`EXISTS (SELECT 1 FROM school_users WHERE school_id = … AND user_id = auth.uid() AND is_active)`) — never the unscoped pattern, never `teacher_id`-gated.

2. **Self-report answers are new ground-truth owned by this domain.** Auto-derived ratings are a *projection* of existing canonical data and are recomputable; the stored Check records which source produced each rating (`auto` | `self_report`) and caches the computed profile so page views don't recompute.

3. **Auto-derivation reads learner Intelligence only through canonical paths** — `recomputeLearnerProjection` / `getLearnerTimeline` / the projection adapters — never `repos.evidence.*` or `learner_profiles` directly (Decision 5). The derivation aggregates to the school level; no Operating-Layer decision reads raw evidence.

4. **Authorization via `lib/core/permissions.ts`**, keyed on school membership/role (`requireSchoolMembership` to read, school staff to write), never a per-route reimplementation and never `teacher_id`.

5. **`framework_version`** is stored on each Check so the benchmark set (currently the 8 Gatsby-core + 3 EduNexus-beyond, `cbc_gatsby_v1`) can evolve without silently reinterpreting historical Checks.

## Alternatives considered

- **No persistence (compute-only).** Avoids a new table, but loses history, the self-updating story, and any sales record of a prospect's diagnosis. Rejected for the product goal; kept available as a smaller interim if ever needed.
- **Store on an Operating table (e.g. a `schools` column).** Violates RAS §9 (Intelligence must not write Operating tables). Rejected.
- **Learner-level only.** The Check is inherently about the school's provision, not one learner. A school-level artifact is the correct grain.

## Consequences

Establishes the pattern for school-level Intelligence artifacts (a future school diagnostic/recommendation follows this same ownership shape). The auto-derivation fans out reads across a school's learners, so it must aggregate and cache into the stored Check rather than recompute per view. Benchmarks 5 & 6 remain `horizon` (EduNexus has no programme), reported honestly as unaddressed — the persistence does not change that.
