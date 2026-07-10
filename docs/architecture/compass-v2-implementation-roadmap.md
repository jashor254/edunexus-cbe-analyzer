# Compass v2 — Implementation Roadmap

Status: PLAN — engineering roadmap only. No code, schemas, or API contracts
are defined here (those are each phase's own implementation work, done
against this plan).

Authoritative, frozen inputs (not renegotiated here): the Engineering
Constitution, Learner Intelligence Engineering Principles, Evidence Domain
Model, Intelligence Ingestion Engine, Learner Intelligence Projection
Engine, Migration Ledger, Compass Audit, [Compass v2 Design](compass-v2-design.md).

**Resolved scoping decision (see note below):** Compass v2's identity
convergence targets the **legacy schema** (`students`, `class_students`,
`teacher_classes`) — the same identity space the Evidence Domain and
Projection Engine already operate in for real pilot data today. Full Core
convergence remains the Learning Intelligence Migration Strategy's own
Phase 11, downstream of that document's Phase 0/3/4/6, and is explicitly
**out of scope** for this roadmap. This correction was made against the
Compass v2 Design doc (§2/P2) before this roadmap was written, to keep the
two documents consistent — see that document's revision note.

---

## 0. How to read this roadmap

Twenty-one phases, ordered so that **every phase leaves the app in a
working, deployed state** — no phase depends on a later phase already
being live, and every phase has a real rollback (a revert of that phase's
diff, nothing more). Phases 0–15 are the August pilot; 16–21 are named,
scoped, and explicitly deferred.

Each phase lists exactly what it touches. Where a phase says "no schema
change," that's a deliberate constraint, not an oversight — schema changes
are concentrated into as few phases as possible (9, and optionally 11) so
that rollback never means an undo migration.

---

## PHASE 0 — Fix the Live Schema-Mismatch Bug

**Objective:** `CompassRepository.findRecentSessionsByStudent` queries
`student_id`/`topic` columns that don't exist on `compass_sessions` (real
columns are `learner_id`, no `topic`). It's called from
`lib/parentPulse/builder.ts:39` and throws on every invocation today.

**Why this phase exists:** This is a production bug, independent of
anything else in this roadmap. It must not wait behind identity
convergence or any other phase — fixing it first also means Phase 4
(ownership convergence) isn't the first place this repository method gets
touched, keeping that phase's diff smaller.

**Files expected to change:**
- `lib/repositories/compass.repository.ts` (the query itself)

**Existing files to reuse:** `lib/database.types.ts` (source of truth for
the real column names).

**New files to create:** None.

**Dependencies:** None. Can start immediately.

**Risks:** Low. The method currently always throws, so any correct query
is a strict improvement; the risk is only in getting the intended
semantics right (recent sessions *by student*, ordered), which should be
confirmed against how Parent Pulse actually uses the result.

**Validation checklist:**
- [ ] Unit test: `findRecentSessionsByStudent` returns real rows for a
      known `learner_id` in the Reference School / test fixture.
- [ ] Integration check: `lib/parentPulse/builder.ts` no longer throws
      when this path is exercised.
- [ ] No other caller of this method exists that assumed the old (broken)
      signature.

**Exit criteria:** Parent Pulse builds successfully for a student with
Compass session history; the method has a passing test.

---

## PHASE 1 — Dead Code Removal in Session State

**Objective:** Remove `isSessionExpired()` (exported, unused),
`consecutiveRight`/`consecutiveWrong` (round-tripped, never incremented),
and the unreachable `sessionState.currentSubject` reference in
`learn/route.ts`.

**Why this phase exists:** Pure cleanup, zero behavior change, de-risks
every later phase that touches `session.ts` and `learn/route.ts` by
shrinking their surface area first.

**Files expected to change:**
- `lib/compass/session.ts`
- `app/api/learn/route.ts`
- `CompassSession` type wherever declared

**Existing files to reuse:** None new — same files, less code.

**New files to create:** None.

**Dependencies:** None. Independent of Phase 0.

**Risks:** Very low. Verify via grep that nothing outside these files
imports the removed fields/function before deleting.

**Validation checklist:**
- [ ] `grep -r isSessionExpired` returns zero results after removal.
- [ ] `grep -r consecutiveRight\|consecutiveWrong` returns zero results.
- [ ] TypeScript compiles clean (removing fields from a type surfaces any
      missed reference as a compile error, which is the point).
- [ ] A full Compass session (start → turns → end) still behaves
      identically in manual testing.

**Exit criteria:** Build passes, no behavior change observed in a manual
session walkthrough.

---

## PHASE 2 — Consolidate Triplicated `tierToLevel()`

**Objective:** One shared `tierToLevel()` function, imported by
`session.ts`, `learn/route.ts`, and `learn/student/route.ts` — replacing
three independent copies.

**Why this phase exists:** A silent-drift risk today (three copies can
diverge without anyone noticing) and a prerequisite for Phase 13 (pointing
tier displays at Projection) — easier to swap one call site's data source
later if there's only one function to begin with.

**Files expected to change:**
- `lib/compass/session.ts` (keep the canonical implementation here, or
  move to a shared location — see below)
- `app/api/learn/route.ts`
- `app/api/learn/student/route.ts`

**Existing files to reuse:** N/A.

**New files to create:** `lib/compass/tier.ts` (or similar) if the
function is promoted out of `session.ts` to avoid a route importing from
another route's neighbor file — a judgment call for whoever implements
this, not specified further here per this plan's own scope limits.

**Dependencies:** Phase 1 (smaller diff surface first), not strictly
required but sequenced for cleanliness.

**Risks:** Low — this is a pure extraction; the function's logic doesn't
change, only its location and import graph.

**Validation checklist:**
- [ ] All three call sites produce identical output for the same input
      (covered by a shared unit test against the one function).
- [ ] No remaining inline `function tierToLevel` definitions outside the
      one canonical location.

**Exit criteria:** One implementation, three importers, tests pass.

---

## PHASE 3 — Build the Ownership-Resolution Function (Additive, Unused)

**Objective:** Introduce one function — call it
`resolveCompassLearnerAccess(actor, studentId)` — that answers "can this
authenticated user act on Compass data for this student, and how
(teacher-of-class / teacher-direct / student-self / parent-linked)?" It
is built and unit-tested in isolation. **No existing route calls it yet.**

**Why this phase exists:** This is the direct fix for the audit's central
finding (§19): three incompatible ownership checks exist today
(`class_students` roster, `students.teacher_id` direct match,
`students.user_id`/`parent_user_id`). Building the one resolver as its
own additive, untouched-by-callers phase means Phase 4/5/6 (below) are
each a small, mechanical "swap one call site" change instead of one large
"rewrite three routes at once" change — directly satisfying the
instruction to avoid big-bang phases.

**Decision this function must encode** (a product decision already made
in the Compass v2 Design, not re-litigated here): a teacher's access is
authoritative via **either** direct roster membership (`class_students`)
**or** `students.teacher_id`, reconciled as one check, not two competing
ones — whichever roster relationship exists is sufficient; a personal
student login (`user_id`) or parent link (`parent_user_id`) is an
*additional*, independent access mode on the same student row, never a
gate that excludes a teacher-linked student from having a session.

**Files expected to change:** None (additive only).

**Existing files to reuse:** `lib/repositories/index.ts` (repos pattern),
existing `students`/`class_students`/`teacher_classes` query shapes
already used across the three routes being converged next.

**New files to create:**
- `lib/compass/access.ts` (or equivalent) — the resolver and its return
  type.
- Unit tests for the resolver, covering all four legacy scenarios found
  in the audit (roster-only, teacher_id-only, personal-login-only,
  parent-linked-only) plus the "none apply → deny" case and the
  previously-unguarded case (arbitrary `studentId`, no relationship at
  all → must deny).

**Dependencies:** None on Phases 0–2 functionally, but sequenced after
them so the codebase this new function is tested against is already
cleaned up.

**Risks:** Low, precisely because nothing calls it yet — this phase
cannot break production. The risk is entirely in getting the access
matrix right, which is why it ships with its own full test matrix before
any route depends on it.

**Validation checklist:**
- [ ] Unit tests cover all identity combinations found in the audit
      (§13, §16, §19), including the previously-unguarded no-relationship
      case.
- [ ] Function is pure with respect to routing — takes IDs/user, returns
      a decision, has no `NextResponse`/route-shaped dependencies, so it's
      reusable across all three call sites without adaptation.

**Exit criteria:** Function exists, fully tested, zero callers, zero
production impact.

---

## PHASE 4 — Migrate the Class-Wide Compass Tab to the Resolver

**Objective:** `app/api/teacher/classes/[classId]/compass/route.ts` calls
`resolveCompassLearnerAccess()` instead of its own inline
`teacher_classes`/`class_students` check.

**Why this phase exists:** First of three small, independent call-site
swaps (this one, Phase 5, Phase 6) — chosen first because this route's
existing check (roster membership) is the *correct* model per the
resolver's design, so this swap is closest to a no-op behaviorally and is
the safest one to ship first.

**Files expected to change:**
- `app/api/teacher/classes/[classId]/compass/route.ts`

**Existing files to reuse:** `lib/compass/access.ts` (Phase 3).

**New files to create:** None.

**Dependencies:** Phase 3.

**Risks:** Low — this route's existing behavior and the resolver's
behavior should be identical for this route's actual usage pattern
(class-scoped teacher). Regression risk is in edge cases the manual class
tab has never actually hit (e.g., a student in `class_students` but with
a `teacher_classes` row owned by a different teacher).

**Validation checklist:**
- [ ] Existing manual QA path (open a real class's Compass tab) shows
      identical data before/after.
- [ ] A teacher not on the class roster still gets 403/404 as before.
- [ ] Integration test added for this route using the resolver.

**Exit criteria:** Route uses the shared resolver; behavior unchanged for
every real class in the pilot school's data.

---

## PHASE 5 — Migrate the Compass Topic Picker to the Resolver

**Objective:** `PATCH /api/teacher/students/[studentId]/compass-topic`
uses `resolveCompassLearnerAccess()` instead of its bespoke
`students.teacher_id === teacher.id` check.

**Why this phase exists:** Second call-site swap. This route's current
check is *narrower* than the resolver's (it only recognizes direct
`teacher_id`, not roster membership) — meaning this phase actually widens
who can assign a topic (any teacher with a valid relationship to the
student, not just the direct-link one), which is the intended fix for
audit §13's "different ownership check than the class-tab route" finding.

**Files expected to change:**
- `app/api/teacher/students/[studentId]/compass-topic/route.ts`

**Existing files to reuse:** `lib/compass/access.ts`.

**New files to create:** None.

**Dependencies:** Phase 3, Phase 4 (sequenced after the safer swap to
build confidence in the resolver against real usage first).

**Risks:** Medium-low. This is a genuine behavior *widening* — a
teacher who previously couldn't assign a topic (roster-linked but not
`teacher_id`-linked) now can. Confirm this widening is actually desired
(it is, per the Compass v2 Design's §2 P2 unification) before shipping,
and confirm no other part of the app relied on the narrower check as an
implicit permission boundary.

**Validation checklist:**
- [ ] A teacher with only roster membership (no direct `teacher_id` link)
      can now successfully assign a topic — new behavior, intentionally
      tested.
- [ ] A teacher with neither relationship is still denied.
- [ ] Manual QA: assign a topic, confirm it still reaches
      `student_learning_context.compass_bridge` as before.

**Exit criteria:** Route uses the shared resolver; the intended
permission widening is verified, not accidental.

---

## PHASE 6 — Migrate `learn/student/route.ts` and Close the Unguarded Gap

**Objective:** Replace the `user_id`/`parent_user_id` `.or()` query *and*
the completely unguarded explicit-`studentId` branch with the shared
resolver.

**Why this phase exists:** This closes the audit's one live
**authorization vulnerability** (§2): "any authenticated user supplying an
arbitrary `studentId` gets that student's full learning context back."
Sequenced third (not first) so the resolver has already been proven
against two lower-stakes routes before it becomes the fix for a real
security gap — but it should not be delayed past this point; it is the
single highest-priority item in this entire roadmap from a risk
standpoint.

**Files expected to change:**
- `app/api/learn/student/route.ts`

**Existing files to reuse:** `lib/compass/access.ts`.

**New files to create:** None.

**Dependencies:** Phase 3, Phase 4, Phase 5.

**Risks:** Medium. This route currently has two branches (a
"picker" default and an explicit `?studentId=`); the audit notes an
explicit `TODO` acknowledging the picker branch is the intended primary
path. Converging both branches onto one resolver call removes that
ambiguity, but requires confirming the multi-student "picker" UX
(parent/family accounts with multiple linked students) still works
identically once both branches share one access-check path.

**Risks — security note:** Treat this as a security fix being shipped,
not a refactor — verify with an explicit negative test (authenticated
user A, arbitrary `studentId` belonging to unrelated user B, must now be
denied) before considering this phase done.

**Validation checklist:**
- [ ] Negative test: arbitrary `studentId` with no relationship to the
      authenticated user → 403, not 200.
- [ ] Existing multi-student parent/family picker flow still works
      end-to-end.
- [ ] Existing single-student flows (own login, teacher-added-only
      student accessed by their linked parent) still work.

**Exit criteria:** The unguarded branch no longer exists; a negative
authorization test passes; all three Compass ownership checks in the app
now go through one function.

---

## PHASE 7 — Extract Inline Business Logic from `learn/end/route.ts`

**Objective:** Move `calcXp()`, week-boundary math, weekly/total session
bookkeeping, and the group-bonus-points side effect (with its anti-farming
check) into `lib/`, per CLAUDE.md's own architecture rule and the audit's
§2 finding.

**Why this phase exists:** Mechanical refactor, not a redesign — but it's
a prerequisite for Phase 9 (Evidence enrichment), because the richer
Evidence shape needs to read some of the same session-close data these
inline computations already touch. Doing the extraction first means Phase
9 adds to a clean `lib/` function instead of adding more inline logic to
an already-overloaded route.

**Files expected to change:**
- `app/api/learn/end/route.ts` (shrinks to auth + validation + delegate)

**Existing files to reuse:** Existing Zod schema in this route (already
correct, per audit §2 — this route is the one of the four with real
validation).

**New files to create:**
- `lib/compass/sessionClose.ts` (or similar) — houses `calcXp()`, the
  week-boundary/bookkeeping logic, and the group-bonus side effect.

**Dependencies:** Phase 1–2 (cleaner session.ts to build against), not
functionally dependent on Phase 3–6.

**Risks:** Low-medium. This is the phase most likely to introduce a
subtle regression purely from moving code, since none of this logic has
tests today (per the audit, error-swallowing and undocumented XP/bonus
math). Mitigate by writing characterization tests *before* moving the
code — capture current input/output pairs, then verify the extracted
function produces the same outputs.

**Validation checklist:**
- [ ] Characterization tests written against current behavior before any
      code moves.
- [ ] Same tests pass after extraction, unchanged.
- [ ] Manual QA: end a real session, confirm XP/level/group-bonus numbers
      match pre-change behavior exactly.

**Exit criteria:** `learn/end/route.ts` is a thin route per CLAUDE.md;
all session-close business logic lives in `lib/`, covered by tests.

---

## PHASE 8 — Extract Inline Business Logic from `learn/route.ts`

**Objective:** Move Kenya CBC term-calendar `detectMode()`, keyword-based
subtopic-compatibility matching, and pathway normalization out of the
route into `lib/`. (The hidden-eval-block parser and the SSE transform
stream are left in place for now — see Risks.)

**Why this phase exists:** The single largest cleanup target the audit
found (§2) — "by far the least thin" of the four routes. Scoped narrower
than "fix everything in this file at once": this phase moves the
derivations that are safe to extract mechanically, and deliberately does
**not** touch subject resolution (that's Phase 14, post-pilot, tied to
curriculum-path consolidation) or the SSE/streaming mechanics (out of
scope for this roadmap — no functional complaint was raised about it).

**Files expected to change:**
- `app/api/learn/route.ts` (shrinks, but remains the thickest of the four
  routes even after this phase — intentionally not fully resolved here)

**Existing files to reuse:** N/A.

**New files to create:**
- `lib/compass/mode.ts` (or similar) — `detectMode()`.
- Pathway normalization helper, colocated with `PATHWAY_SUBJECTS` (already
  in `session.ts` — keep these together rather than splitting a small,
  related concept across two files).

**Dependencies:** Phase 2 (shared `tierToLevel` already consolidated, so
this phase doesn't also have to deal with that).

**Risks:** Medium — this is the biggest, most turn-by-turn-grown file in
the system; the audit found no tests reference its inline logic today.
Same mitigation as Phase 7: characterization tests before moving code.
**Explicitly scope this phase down if it starts growing** — if
`detectMode()` extraction alone proves large, ship it alone and split
pathway normalization into its own follow-up phase rather than let this
phase grow into the "giant phase" this roadmap is designed to avoid.

**Validation checklist:**
- [ ] Characterization tests for `detectMode()` across real term-calendar
      dates (holiday vs school-day boundaries) before extraction.
- [ ] Manual QA: a full chat turn, both school-mode and holiday-mode,
      behaves identically before/after.
- [ ] `max_tokens` and other AI-call parameters unchanged (this phase
      does not touch `lib/ai/deepseek.ts`).

**Exit criteria:** `detectMode()` and pathway normalization live in
`lib/`; route file shrinks measurably; no behavior change observed.

---

## PHASE 9 — Enrich the `compass_session` Evidence Shape

**Objective:** `recordCompassSessionEvidence()` (`lib/compass/evidence.ts`)
carries the richer behavioral signal the legacy `updateFromCompass()` path
already computes — persistence, engagement pattern, help-seeking, concepts
touched — not just subject + abandoned-flag.

**Why this phase exists:** Per the Compass v2 Design §6: today's Evidence
record is a functional downgrade from what the legacy path captures for
the same event (audit §7, §12). Enriching the shape now, *before* the
confirm path exists (Phase 10), means Phase 10 immediately has something
substantive to confirm rather than a thin placeholder.

**Decision this phase must respect** (already made, not re-litigated):
this stays Trust Tier 1, capped confidence, per LI-3 and the Evidence
Domain's trust-tier rules — enrichment is about the *shape* of the claim,
not its trust level.

**Files expected to change:**
- `lib/compass/evidence.ts`

**Existing files to reuse:**
- `lib/learnerModel/updater.ts` (`updateFromCompass`) — read as the
  reference for what signals are actually computable at session-close
  time; do not duplicate its computation, extract a shared helper if the
  same derivation (e.g., persistence-from-consecutive-wrong) is needed in
  both places.
- `lib/repositories/evidence.repository.ts` (`persistEvidenceBatch`) —
  unchanged write path.

**New files to create:** None — this is a shape change to an existing
producer, not a new pipeline.

**Dependencies:** Phase 7 (session-close data this phase reads should
already be flowing through the cleaned-up `lib/compass/sessionClose.ts`,
not scattered inline in the route).

**Risks:** Low-medium. Schema question: does `learner_evidence`'s
existing `Json`-typed fields already accommodate a richer payload, or does
this require a column/shape addition? This phase's implementer must
check `lib/database.types.ts`'s `learner_evidence` shape before assuming
either way — if a schema change is needed, it should be additive
(nullable new fields) so existing rows and existing readers are
unaffected. No existing consumer reads this Evidence today (per audit
§8), so there is no reader to break regardless.

**Validation checklist:**
- [ ] New Evidence rows for a real Compass session carry the enriched
      signal, verified by inspection after a real session end-to-end.
- [ ] Existing dual-write to `learner_profiles` via `updateFromCompass`
      is unaffected — this phase adds to Evidence, it does not touch the
      legacy write.
- [ ] Trust tier / confidence cap unchanged (still Tier 1, still capped
      at 60, still always `pending_review` at this point).

**Exit criteria:** Compass Evidence rows are shape-complete relative to
what the legacy path already knows about the same event; still
`pending_review`; no downstream consumer yet reads them (that's Phase 10).

---

## PHASE 10 — Build the Evidence Confirm/Promote Surface

**Objective:** A teacher-facing review affordance inside the existing
class-wide Compass tab: see pending Compass evidence for their roster,
confirm or reject it, using the already-built (but zero-production-caller)
`confirmReview()`/`rejectReview()`/`getPendingReview()` functions in
`lib/intelligence/evidenceLifecycle.ts`.

**Why this phase exists:** This is the audit's single clearest structural
gap (§8) and the Compass v2 Design's named policy decision (§7): a real
producer and a real consumer exist and agree on the contract; only the
promotion mechanism between them is missing. This phase builds exactly
that mechanism — nothing else.

**Scope discipline for this phase:** Teacher-reviewable confirm/reject
for the mastery-shaped claim (`genuine_progress`) only. The conservative
engagement-only auto-confirm exception is **Phase 11**, kept separate
because it's a different mechanism (no human in the loop) with its own,
narrower risk profile — bundling them would make this phase's rollback
boundary unclear.

**Files expected to change:**
- `app/api/teacher/classes/[classId]/compass/route.ts` (extend to surface
  pending evidence alongside existing roster data)

**Existing files to reuse:**
- `lib/intelligence/evidenceLifecycle.ts` (`confirmReview`, `rejectReview`,
  `getPendingReview`) — already built, already tested via integration
  tests, zero production callers today. This phase is their first real
  caller.
- Existing Compass tab UI shell (extend, don't replace).

**New files to create:**
- One new route for the confirm/reject action itself (e.g.
  `PATCH /api/teacher/classes/[classId]/compass/evidence/[evidenceId]`),
  thin, delegating entirely to `evidenceLifecycle.ts`.
- A small UI addition to the existing Compass tab component.

**Dependencies:** Phase 6 (ownership resolver — this new route needs the
same access check every other Compass teacher route now uses), Phase 9
(enriched evidence to actually review).

**Risks:** Medium. This is new teacher-facing surface, not just a
refactor — UX risk (does a busy teacher actually use this) is real and is
exactly why the Design doc's §18 names "teacher review load" as a risk to
monitor, and why Phase 11 exists as a release valve for the lowest-stakes
claim type.

**Validation checklist:**
- [ ] A pending Compass evidence row, confirmed by a teacher, transitions
      to `reviewed_confirmed` with the reviewer and reason recorded
      (existing `confirmReview()` contract — verify it's called
      correctly, not that its internals need testing again).
- [ ] A rejected row transitions to `reviewed_rejected`, is not deleted,
      and does not appear in future Projection recomputes.
- [ ] The confirm action's access check goes through the same resolver as
      every other Compass teacher route (Phase 6) — no new bespoke
      ownership check introduced.
- [ ] Manual QA with a real pilot-shaped class: teacher sees pending
      Compass evidence, confirms one, rejects another, both visible with
      correct state on reload.

**Exit criteria:** A teacher can confirm or reject real pending Compass
evidence through the UI; confirmed rows are indistinguishable in
downstream shape from any other `reviewed_confirmed` evidence.

---

## PHASE 11 — Narrow, Conservative Auto-Confirm for Engagement Facts

**Objective:** A tightly-scoped auto-confirm path for engagement-only
Compass evidence claims (e.g., "learner engaged with N minutes of
practice on subject X") — never mastery claims — per the Compass v2
Design §7's named policy decision.

**Why this phase exists:** Realistic teacher review bandwidth (50
pioneer teachers, full class loads) means not every session will get
reviewed promptly. This phase gives low-stakes engagement facts a path
into Projection without waiting on a human, while leaving every
mastery-shaped claim exactly as Phase 10 left it (teacher-reviewable,
never auto-promoted).

**Files expected to change:**
- `lib/compass/evidence.ts` (the claim-type branch that decides
  auto-confirm eligibility)

**Existing files to reuse:**
- `lib/intelligence/evidenceLifecycle.ts` — the auto-confirm path already
  exists in the lifecycle state machine for evidence that meets its
  confidence threshold at creation; this phase is about which claim
  *types* Compass tags as eligible, not a new lifecycle mechanism.

**New files to create:** None.

**Dependencies:** Phase 10 (the review surface must already exist and be
in real use before narrowing what needs review — otherwise there's no
baseline to compare "how much review load did this remove" against).

**Risks:** This is the single risk the Compass v2 Design calls out by
name (§18): scope creep from "engagement facts" to "mastery claims" would
silently violate LI-3 and the Evidence Domain's "silence is not consent"
invariant. **Any change to which claim types qualify for this path is a
named, reviewed decision — not a parameter tweak done casually.**

**Validation checklist:**
- [ ] Only engagement-shaped claims (no `genuine_progress`/mastery
      content) are eligible for this path — verified by an explicit test
      asserting a mastery-shaped claim is *never* auto-confirmed
      regardless of confidence score.
- [ ] Auto-confirmed rows are visibly labeled as machine-confirmed if a
      teacher later inspects them (per the Design doc's explicit
      transparency requirement).
- [ ] Confidence ceiling for Tier 1 evidence is still respected — this
      path does not bypass the trust-tier cap, it only changes which
      claims can reach `auto_confirmed` at that already-capped confidence.

**Exit criteria:** Engagement-only Compass evidence can reach
`auto_confirmed` without a human; every mastery-shaped claim still
requires the Phase 10 review path with zero exceptions.

---

## PHASE 12 — Validate Behaviour Projection Activation End-to-End

**Objective:** Confirm, against real pilot data, that `behaviourProjector.ts`
now actually returns non-null projections for learners with confirmed
Compass evidence — closing the loop the audit found completely dormant
(§8, §18).

**Why this phase exists:** This is a validation phase, not primarily a
code-change phase — the audit found the projector-consumer side was
already correctly built and dormant only for lack of confirmed evidence.
Phases 9–11 are what make evidence reach confirmed states; this phase is
where the team confirms the whole chain actually closes, with real data,
before building anything downstream that assumes it does (Phase 13).

**Files expected to change:** None expected — if this phase finds a bug,
it becomes its own follow-up phase, not a silent fix folded into this
one's scope.

**Existing files to reuse:**
- `lib/projection/behaviourProjector.ts` (unchanged — already correct).
- `lib/projection/recompute.ts` (the call path every Projection consumer
  uses).

**New files to create:**
- An integration test exercising the full path: Compass session → Phase
  9's enriched evidence → Phase 10/11's confirm path → `recomputeLearnerProjection`
  → non-null `behaviour` field.

**Dependencies:** Phase 9, 10, 11 all complete and deployed with real
pilot usage generating at least some confirmed evidence.

**Risks:** Low as a code change (mostly test-writing), but this is the
phase most likely to *reveal* an unexpected gap — e.g., the Migration
Ledger's documented Projection Engine limitations (no substrand-level
knowledge, no 6-dimension capability) might affect behaviour projection
in ways not yet observed with zero real confirmed evidence to test
against. **If this phase finds such a gap, stop and report it — do not
silently patch around a Projection Engine limitation inside Compass**,
per LI-1 and the Migration Ledger's own stated practice of naming engine
gaps rather than working around them.

**Validation checklist:**
- [ ] At least one real (or realistic fixture) learner with confirmed
      Compass evidence produces a non-null `behaviourProjector` output.
- [ ] `observationCount`/`distinctSources` reflect the actual confirmed
      evidence, not stale or cached state.
- [ ] No other Projection consumer (Blueprint, Career Intelligence,
      Attention Feed, Principal Dashboard) regresses from this evidence
      now being present in their recompute inputs.

**Exit criteria:** Documented proof (test + manual verification) that a
Compass session's evidence, once confirmed, is visible in at least one
real Projection recompute — the first time this has ever been true in
production.

---

## PHASE 13 — Point Compass Tab Displays at Projection Where Possible

**Objective:** Where the class-wide Compass tab currently derives a
tier/confidence badge from raw `compass_sessions.session_state`, and
Projection can now supply the same concept (subject-level mastery, risk),
read from Projection instead.

**Why this phase exists:** Reduces the "two sources of truth for the same
badge" problem named in audit §12/§13, but scoped narrowly per the
Migration Ledger's own documented limits — **not** attempting to migrate
`class_mastery_heatmap`, `hidden_misconceptions`, `acceleration_candidates`,
or peer-helper matching, all of which the Ledger explicitly states need
substrand-level knowledge the frozen Projection Engine v1.0 doesn't
compute. This phase touches only what Projection genuinely already
supports (subject-level mastery/risk), leaving the rest exactly as-is —
a partial migration, matching the Ledger's own "Partial (mixed)" pattern
already established for Attention Feed and Principal Dashboard.

**Files expected to change:**
- `app/api/teacher/classes/[classId]/compass/route.ts`

**Existing files to reuse:**
- `lib/projection/recompute.ts` (`recomputeLearnerProjection`) — same
  call pattern every other Projection consumer already uses.

**New files to create:** None.

**Dependencies:** Phase 12 (proof the pipeline actually produces real
projections before the UI depends on reading them for real students).

**Risks:** Medium — a partial migration inherently means the tab now
shows some fields from Projection and some from legacy `session_state` in
the same view; this must be visually/conceptually coherent to a teacher,
not a jarring mix. Flag any UI inconsistency found here rather than
absorbing it silently.

**Validation checklist:**
- [ ] Subject-level mastery/risk badges match Projection's output exactly
      for a real class.
- [ ] Fields not yet migrated (heatmap, misconceptions, acceleration)
      remain functionally unchanged from legacy behavior.
- [ ] No regression in load time — this route now does a Projection
      recompute per student per request; verify this stays within
      acceptable latency for a full class roster (the Migration Ledger's
      own Attention Feed migration already validated this pattern at
      similar scale).

**Exit criteria:** Compass tab's subject-level badges are Projection-
sourced; everything else is unchanged and explicitly still legacy, named
as such in code comments the same way the Ledger names it elsewhere.

---

## PHASE 14 — Deep-Link Attention Feed / Alerts into a Scoped Compass Session

**Objective:** The teacher alerts page's "Open Compass" link
(`app/teacher/alerts/page.tsx:187-192`) becomes a deep link carrying the
specific flagged student and topic, landing the teacher directly in a
pre-scoped Compass session rather than a generic `/chat` navigation.

**Why this phase exists:** Named in the Compass v2 Design (§4, §19) as
the single highest-leverage "reduce teacher workload" feature for the
pilot — turning "I noticed Amina is struggling" into "hand her a session
about exactly that, right now," in one action.

**Scope discipline:** Per the Design doc's own risk note (§18), this
phase deep-links **only** into Attention Feed fields already sourced from
Projection today (`students_needing_attention`, per the Migration
Ledger) — not `hidden_misconceptions` or `acceleration_candidates`,
which remain legacy-sourced and would deep-link to potentially stale
data.

**Files expected to change:**
- `app/teacher/alerts/page.tsx`
- `/learn` (or the canonical session-start entry point) — accept an
  optional pre-scoping parameter (student + subject/topic).

**Existing files to reuse:**
- `lib/compass/session.ts` (`getOrCreateSession`, `getNextSubject`) —
  extend the existing "teacher recommendation first" precedence
  (`NextSubject.reason: 'teacher_recommendation'`) already built into
  `getNextSubject()`, rather than building a second subject-selection
  path.

**New files to create:** None expected — this is primarily a routing/
parameter-passing change on top of existing session-start logic.

**Dependencies:** Phase 6 (ownership resolver — the deep link still must
resolve through the one access model), Phase 13 (Attention Feed's
Projection-sourced fields, which this phase's scope discipline depends
on being reliably Projection-sourced, not legacy).

**Risks:** Low-medium. Main risk is scope creep into deep-linking
legacy-sourced Attention Feed fields, explicitly called out above as
out of bounds for this phase.

**Validation checklist:**
- [ ] Clicking "Open Compass" from a real flagged student's alert lands
      the teacher in a session already locked to that student/subject —
      no manual re-selection needed.
- [ ] The deep link only fires for Projection-sourced risk entries; a
      legacy-only-sourced entry (if distinguishable in the UI) does not
      offer this deep-link path yet, or is clearly labeled as
      general-navigation only.
- [ ] Existing generic "Open Compass" behavior (no flagged student
      context) is unaffected.

**Exit criteria:** A teacher can go from a real risk flag to a scoped
Compass session for that exact learner/topic in one click, for every
flag sourced from Projection today.

---

## PHASE 15 — Parent Feed Insight-Formatted Summary Layer

**Objective:** The existing parent activity feed (`fetchCompassActivity`
→ `GET /api/parent/compass-activity`) gains an `Insight`-shaped summary
block (observation / evidence / confidence / action, per
`lib/learnerIntelligence/insight.ts`) instead of only a raw session-count
list.

**Why this phase exists:** Directly serves the Design doc's explicit
"parents should not receive another dashboard full of numbers" goal, at
low implementation cost, reusing an already-built primitive
(`Insight`/`confidenceFromScore`/`insufficientEvidenceInsight`) rather
than inventing new parent-facing copy logic.

**Files expected to change:**
- `app/api/parent/compass-activity/route.ts`
- `app/dashboard/page.tsx` (render the new summary block)

**Existing files to reuse:**
- `lib/learnerIntelligence/insight.ts` (the whole point of this phase —
  no new explainability format).
- Same Projection read path as Phase 13, for whatever backs the
  "what's happening" observation.

**New files to create:** None expected — a rendering/composition change
on top of existing data sources.

**Dependencies:** Phase 12 (real confirmed Compass evidence and
Projection data to summarize meaningfully) — this phase is low-value
before there's anything real to report on.

**Risks:** Low. Primarily a presentation change; the underlying data
sources (Projection, confirmed evidence) are already validated by earlier
phases.

**Validation checklist:**
- [ ] A parent viewing a real linked student's activity sees a plain-
      language observation, its evidence, a confidence label, and a
      parent-phrased action — not raw session counts alone.
- [ ] Low-confidence cases correctly use
      `insufficientEvidenceInsight()`'s pattern rather than a
      plausible-sounding guess.
- [ ] Both ownership models the parent feed already supports
      (`user_id`-based student login and `parent_user_id`-based
      parent-only account) still both render correctly.

**Exit criteria:** Parent feed shows an Insight-shaped summary for every
student with enough evidence to support one, and an honest
"not enough evidence yet" state otherwise.

---

## PILOT-READY MILESTONE

**Reached after Phase 15.** At this point:

- Every Compass route uses one ownership model; the live authorization
  gap is closed.
- The one live production bug (Parent Pulse crash) is fixed.
- Dead code and triplicated logic are gone.
- The two largest inline-business-logic routes are cleaned up.
- Compass evidence is shape-complete and has a real, working path to
  `reviewed_confirmed`/`auto_confirmed` — the first time in this
  system's history that Compass evidence reaches Projection.
- Behaviour Projection is proven live with real data.
- Teachers get a Projection-grounded Compass tab and a one-click deep
  link from a real risk flag to a scoped session.
- Parents get an Insight-formatted summary instead of a raw session
  count.

This is a materially different, safer, more honest system than the one
the audit described — without a single big-bang rewrite, and with every
phase independently revertible.

---

## POST-PILOT ROADMAP (named, scoped, deliberately deferred)

## PHASE 16 — Canonical Single Entry Point (`/learn` vs `/chat`)

**Objective:** Resolve audit §14's finding — reconcile the two
historically-separate chat URLs into one canonical entry point (P6 of the
Design doc).

**Why deferred:** Real value, but every pilot-relevant teacher/parent/
learner touchpoint (Phases 4–6, 14, 15) can be built and function
correctly regardless of which URL the learner ultimately lands on — this
is a routing-consistency cleanup, not a pilot blocker.

**Files expected to change:** `app/(auth)` routing, `app/dashboard/learning-compass/page.tsx`,
`app/teacher/alerts/page.tsx`, `app/student/page.tsx` link targets.

**Existing files to reuse:** Whichever of `/learn`/`/chat` is confirmed
(during this phase, not assumed now) to be the superset implementation.

**New files to create:** None expected.

**Dependencies:** None from this roadmap's pilot phases — can start any
time post-pilot.

**Risks:** The audit explicitly could not determine from code alone
whether `/chat` is a superset, subset, or separate implementation of
`/learn` — this phase's first task is answering that question with a
real trace, before deciding which URL survives.

**Validation checklist:**
- [ ] Confirmed (not assumed) functional relationship between `/learn`
      and `/chat` before any consolidation code is written.
- [ ] Every existing link into either URL (alerts, parent splash, student
      dashboard) updated to the surviving canonical path.
- [ ] No dead link left pointing at a removed URL.

**Exit criteria:** One URL, every entry point updated, no broken links.

---

## PHASE 17 — Curriculum Topic-Selection Consolidation

**Objective:** Resolve audit §10 — collapse the three curriculum-data
paths (`lib/compass/topics.ts` RPC, `lib/compass/topicSelector.ts`'s
`sow_*` tree, and the live keyword-fallback in `resolveSubject()`) into
one, reviving the architecturally-sounder orphaned strand/substrand
picker per the Design doc §11/§13.

**Why deferred:** The audit flagged (not resolved) whether the two
existing query paths return consistent data — that data-integrity
question must be answered first, and is genuinely unknown work, not
pilot-appropriate to discover mid-pilot.

**Files expected to change:** `app/api/learn/route.ts` (subject
resolution), `components/compass/TopicSelector.tsx`/`TopicChoice.tsx`
(revive), `lib/compass/topicSelector.ts`, `lib/compass/topics.ts`
(one of these is retired).

**Existing files to reuse:** Whichever path is confirmed as the actual
source of truth after the data-integrity check.

**New files to create:** None expected — this is consolidation, not new
capability.

**Dependencies:** None from pilot phases.

**Risks:** Data-integrity risk is the whole point of this phase's first
step — if the two paths disagree for real curriculum data, that's a
separate bug to fix before consolidation, not something to paper over.

**Validation checklist:**
- [ ] Data-integrity check: both existing query paths compared against
      the same real curriculum data; documented result.
- [ ] Keyword-fallback subject resolution removed once the curriculum-
      accurate picker is live.
- [ ] `LessonOutcome`/milestones references in `TopicChoice.tsx` either
      get a real producer or are removed — no shipped UI referencing a
      data shape nothing produces.

**Exit criteria:** One curriculum-topic path, verified correct, live in
`/learn`'s actual flow.

---

## PHASE 18 — Remove the Dashboard Splash Redirect Page

**Objective:** `app/dashboard/learning-compass/page.tsx` (a 1.5-second
branded redirect to `/chat`) is removed once Phase 16 makes it
functionally redundant.

**Why deferred:** Explicitly gated behind Phase 16 — removing it earlier
would break whatever currently links to it.

**Files expected to change:** Delete `app/dashboard/learning-compass/page.tsx`;
update any remaining links to it.

**Dependencies:** Phase 16.

**Risks:** Very low — this is a pure deletion once nothing points at it.

**Validation checklist:**
- [ ] `grep` confirms zero remaining links to this route before deletion.

**Exit criteria:** Route deleted, no dead links remain.

---

## PHASE 19 — Full Mastery-Mechanism Consolidation

**Objective:** Resolve audit §11 — the four loosely-coupled mastery
mechanisms (prompt-declared tier, AI self-report, session-state
`masteredConcepts`, orphaned milestone UI) collapse into Projection as the
single source of starting-state truth, per the Design doc §8's adaptive
learning model.

**Why deferred:** Per the Design doc's own P5 and §17.4 — deciding the
*right* consolidated model is easier with real pilot data (from Phases
9–15 actually running) than by design alone. Attempting this before the
pilot generates real usage risks over-designing against a guess.

**Files expected to change:** `lib/compass/session.ts`,
`app/api/learn/route.ts`, `lib/adaptiveLearning.ts` relationship (if any
emerges from pilot data — the audit found none exists today, confirm
this is still true).

**Dependencies:** Real pilot usage data from Phases 9–15.

**Risks:** The main risk is starting this before enough real data exists
to know what "consolidated" should actually mean — explicitly gate this
phase's start on having at least one full pilot term's worth of
Projection-integrated Compass usage.

**Validation checklist:**
- [ ] Pilot data reviewed before design work starts on this phase.
- [ ] Whatever consolidated model emerges is validated against real
      pilot learners' actual session history, not synthetic data.

**Exit criteria:** One mastery-progression model, Projection-grounded,
replacing the four found in the audit.

---

## PHASE 20 — Widen Auto-Confirm Scope (Governed Decision)

**Objective:** Per the Design doc §20, widen which claim types qualify
for auto-confirm (Phase 11) based on real pilot review-load and
data-quality observations.

**Why deferred:** Cannot be designed before Phase 11 has run against
real teachers for real time — this is explicitly a data-informed
decision, not a speculative one.

**Files expected to change:** `lib/compass/evidence.ts` (claim-type
eligibility list, same location as Phase 11).

**Dependencies:** Phase 11, plus a full pilot term of real usage.

**Risks:** This is the risk the Design doc names by title (§18, "Auto-
confirm scope creep") — any widening must be an explicit, reviewed
decision citing real pilot evidence, never a quiet parameter change.

**Validation checklist:**
- [ ] Pilot review-load data reviewed and documented before any widening.
- [ ] Widening proposal explicitly reviewed against LI-3 before shipping.

**Exit criteria:** Either the scope is deliberately widened with a
documented rationale, or deliberately left unchanged with a documented
rationale — either outcome is a valid exit, silence is not.

---

## PHASE 21 (External, Not Compass-Owned) — Migration Strategy Phase 0

**Objective:** Not a Compass v2 phase at all — noted here only because
it is the eventual precondition for the Learning Intelligence Migration
Strategy's own Phase 11 ("Port Compass," full Core identity convergence).

**Why noted, not scheduled:** This roadmap deliberately does not
schedule platform-wide Core migration — that decision, timeline, and
resourcing belongs to the Migration Strategy document and whoever owns
that initiative, not to a Compass-scoped implementation plan. Listed here
only so a future reader tracing "when does Compass actually move to
Core" finds the answer: after Migration Strategy Phases 0, 3, 4, and 6
complete, independent of anything in this roadmap.

---

## Dependency Graph

```
Phase 0 (bug fix)         ── independent
Phase 1 (dead code)       ── independent
Phase 2 (tierToLevel)     ── after 1 (sequencing only)

Phase 3 (resolver, additive) ── independent of 0-2, sequenced after for cleanliness
Phase 4 (class tab → resolver)      ── needs 3
Phase 5 (topic picker → resolver)   ── needs 3, 4
Phase 6 (learn/student → resolver, security fix) ── needs 3, 4, 5

Phase 7 (extract learn/end logic)   ── needs 1, 2
Phase 8 (extract learn/route logic) ── needs 2

Phase 9  (enrich Evidence shape)     ── needs 7
Phase 10 (confirm/promote surface)   ── needs 6, 9
Phase 11 (narrow auto-confirm)       ── needs 10
Phase 12 (validate Behaviour Projection) ── needs 9, 10, 11 + real usage
Phase 13 (Compass tab reads Projection)  ── needs 12
Phase 14 (deep-link Attention Feed)      ── needs 6, 13
Phase 15 (parent Insight summary)        ── needs 12

── PILOT-READY MILESTONE ──

Phase 16 (canonical entry point)     ── independent, post-pilot
Phase 17 (curriculum consolidation)  ── independent, post-pilot
Phase 18 (remove splash page)        ── needs 16
Phase 19 (mastery consolidation)     ── needs real pilot data (post 9-15)
Phase 20 (widen auto-confirm)        ── needs 11 + real pilot data
Phase 21 (Core migration)            ── external, Migration Strategy-owned
```

**Critical path to the pilot milestone:** 3 → 4 → 5 → 6 → 10 → 11 → 12 →
13/14/15. Phases 0, 1, 2, 7, 8, 9 can run in parallel with the early part
of that chain (different files, no shared dependency) as team capacity
allows.

---

## Testing Strategy

**Per-phase, not end-of-project:** every phase above lists its own
validation checklist — these are the actual test plan, not a separate
document. The general shape repeated across phases:

1. **Characterization tests before extraction** (Phases 7, 8) — capture
   current behavior as a test *before* moving code, so "identical
   behavior" is provably true, not asserted.
2. **Negative tests for every ownership change** (Phases 4, 5, 6) — every
   access-check phase needs an explicit "this should be denied" test, not
   just "this should be allowed" — Phase 6 in particular ships with a
   security regression test as its primary exit criterion.
3. **Integration tests for the Evidence→Projection chain** (Phases 9–12)
   — this is the one path in the whole system that has never worked
   end-to-end in production; it needs a real integration test proving it
   now does, not just unit tests of its individual pieces.
4. **Manual QA against the Reference School / real pilot-shaped data**
   for every teacher/parent-facing UI change (Phases 4, 5, 13, 14, 15) —
   automated tests catch regressions, manual walkthroughs catch "this is
   technically correct but confusing" issues automated tests can't see.
5. **No test suite runs against production data during development** —
   the Reference School fixture and existing integration-test patterns
   (`evidenceDomain.integration.test.ts`, `projectionPersistence.integration.test.ts`)
   are the right place to exercise the confirm/promote path before it
   touches real pilot students.

---

## Rollback Strategy

Because every phase is scoped to touch a small, named set of files with
no schema changes except Phase 9 (additive-only) and optionally Phase 10
(one new route, no destructive schema change), rollback for any phase is
**a revert of that phase's diff**, with two specific notes:

- **Phase 6** (closing the unguarded `studentId` gap): if a rollback is
  ever needed after this ships, it must not silently reopen the
  authorization gap — a rollback here means reverting to the *previous
  phase's* resolver-based check (Phase 5's state), never all the way back
  to the original unguarded branch. Treat "revert past Phase 6" as
  forbidden, not just unlikely.
- **Phase 11** (auto-confirm): the safest rollback for this specific
  phase, if real pilot data shows it was a mistake, is not a code revert
  but a configuration/eligibility-list change (remove all claim types
  from the auto-confirm list) — reverting to "everything requires human
  review" is a one-line change, not a deploy of old code, precisely
  because Phase 11 was built as a narrow eligibility filter on top of
  Phase 10's mechanism rather than a separate code path.

No phase in this roadmap requires an irreversible data migration —
Evidence's own immutability invariant (Evidence Domain §3) means even
Phase 9's shape enrichment only adds fields going forward; it never
rewrites existing rows.

---

## Risks to Monitor During Implementation

1. **Ownership convergence (Phases 3–6) is the highest-leverage and
   highest-risk work in this roadmap** — it touches every Compass route.
   Do not parallelize Phases 4/5/6 across multiple engineers without a
   shared understanding of the resolver's exact semantics; a subtle
   disagreement between two engineers' mental models of "who owns this
   student" is exactly the failure mode that created the original three
   incompatible checks.
2. **Phase 6 is a live security fix.** Prioritize it appropriately —
   don't let it slip behind lower-risk phases for schedule convenience.
3. **Teacher review load (Phase 10) is unproven.** Watch real usage
   closely once it ships; Phase 11's existence is the planned release
   valve, but only widen it (Phase 20) with real data, not anticipatory
   guessing.
4. **Auto-confirm scope creep (Phase 11)** is the single named risk in
   the Design doc — treat any proposal to widen it outside Phase 20's
   governed process as a stop-and-discuss moment, not a routine PR.
5. **Phase 12 may surface a Projection Engine limitation**, not a
   Compass bug. If it does, stop and report rather than building a
   Compass-local workaround — per LI-1, this is a decision for whoever
   owns the Projection Engine roadmap, not something to route around
   silently inside Compass.
6. **Phase 13's partial migration (Projection for some fields, legacy for
   others, in the same view)** needs a UI/UX pass to stay coherent to a
   teacher — don't let "technically migrated" become "confusingly
   inconsistent."
7. **Schema drift risk is otherwise low** — this roadmap deliberately
   avoids schema changes except one additive one (Phase 9). If any phase
   discovers it actually needs a non-additive schema change, that is
   itself a signal to stop and re-scope that phase rather than proceed.

---

## Recommended Implementation Order (Summary)

1. Phase 0 (bug fix) — anytime, immediately
2. Phase 1, 2 (cleanup) — anytime, immediately, parallel with 0
3. Phase 3 (resolver, additive) — as soon as capacity allows
4. Phase 4 → 5 → 6 (ownership convergence, in this order — 6 is the
   security fix, prioritize reaching it)
5. Phase 7, 8 (extraction) — parallel with 3–6, different files
6. Phase 9 (evidence enrichment) — after 7
7. Phase 10 (confirm surface) — after 6 and 9
8. Phase 11 (narrow auto-confirm) — after 10, with real usage observed
   first if schedule allows
9. Phase 12 (validate Behaviour Projection) — after 9, 10, 11, with real
   pilot data
10. Phase 13, 14, 15 (Projection-grounded UI, deep-linking, parent
    summary) — after 12, can run in parallel with each other

**Pilot-ready at the end of step 10.**

---

## Final Recommendation

**This plan is ready to begin, with one explicit precondition already
satisfied:** the identity-model contradiction between the original
Compass v2 Design draft and the frozen Migration Strategy/live Projection
code was found, surfaced, and resolved (legacy-schema convergence,
confirmed) before this roadmap was written — not discovered mid-
implementation. That is the one genuine architectural risk this planning
pass could have missed, and it didn't.

Beyond that: every phase is small, independently testable, has a named
rollback, and leaves the app working. The critical path (ownership
convergence → evidence enrichment → confirm surface → Projection
validation → teacher/parent-facing wins) is the correct order because
each step is a real precondition for the next, not an arbitrary
sequencing choice — you cannot meaningfully build a confirm surface
before evidence is shape-complete, and you cannot meaningfully point UI
at Projection before the confirm path has proven Projection actually
receives anything.

**Recommendation: begin with Phases 0–3 immediately** (independent,
zero-risk, unblocks everything else), **treat Phase 6 as the priority
security fix it is**, and **do not start Phase 12 until Phase 11 has had
real pilot usage to validate against** — that phase's value is entirely
in proving the chain works with real data, and starting it early with
synthetic data only would understate the risk Phase 18 of the Design
doc's own risk list names explicitly (teacher review load).

The August pilot milestone (end of Phase 15) is realistic within this
plan's scope, provided ownership convergence (Phases 3–6) starts
immediately and isn't deprioritized for feature work — it is the
foundation every subsequent phase in this roadmap sits on.
