# Compass v2 — Product & Architecture Design

Status: DESIGN — product and architectural direction, not an implementation
plan. No schema, no API contracts, no pseudocode. This document is the
required input to a future implementation plan, not a replacement for one.

Depends on and is bound by (frozen, not renegotiated here): the [Engineering
Constitution](../engineering-constitution.md), [Learner Intelligence
Engineering Principles](learner-intelligence-engineering-principles.md)
(LI-1 through LI-8), the [Evidence Domain Model](evidence-domain-model.md),
the [Intelligence Ingestion Engine](intelligence-ingestion-engine.md), the
[Migration Ledger](migration-ledger.md), the [Reference School](../reference-school/README.md)
Core schema, and the [Compass Audit](compass-audit.md) (§0–§19, referenced
throughout by section number — this document does not repeat findings, it
resolves them).

---

## 1. Compass Vision

Compass is the **Learning Intelligence Companion** of EduNexus — the one
surface where a teacher, a learner, a parent, or a principal can have a
conversation with what the platform already knows about a learner's
progress, and where a learner's own live activity can responsibly add to
that knowledge.

Compass is not a tutor product bolted onto a school platform. It is the
conversational and adaptive layer sitting on top of the Projection Engine
— the same evidence-derived intelligence every other surface (Blueprint,
Career Intelligence, Attention Feed, Principal Dashboard) already reads
from. Compass's job is to make that intelligence *actionable in the
moment*: during lesson prep, during a struggling learner's five free
minutes, during a parent's evening check-in, during a principal's weekly
review — without ever knowing something those other surfaces don't, and
without ever guessing at something evidence hasn't earned.

The audit's central finding (§19) is the reason this vision starts here
rather than with features: Compass today behaves as if a learner's own
login is the primary account and the teacher is a secondary viewer. Every
other part of the platform has already inverted that assumption. Compass
v2 is that inversion, applied consistently, with the conversational
product built on top of it rather than around it.

---

## 2. Design Principles

These are Compass-specific translations of the Constitution and the LI
principles — not new values, concrete commitments for this system.

**P1 — Compass is a consumer, never a second producer, of learner
intelligence.** (LI-1) Compass may generate raw signal (a chat turn, a
self-reported eval). It never computes its own capability, risk, or
mastery number that competes with the Projection Engine's. Every "what do
you know about this learner" question Compass answers is answered by
reading a Projection, not by re-deriving one.

**P2 — A learner who never logs in is still a first-class Compass
subject.** The audit found three incompatible ownership models (§13, §16,
§19). Compass v2 has one: a learner is a row the teacher's class roster
already resolves through `class_students`, keyed to legacy `students.id`
— the identity space real pilot data, Evidence, and the Projection Engine
already live in today (Core migration for real users is the Migration
Strategy's own Phase 0, not yet run; porting Compass to Core identity is
that same document's Phase 11, downstream of Phase 0/3/4/6 and out of
scope here). Personal login, parent linkage, and teacher-led operation
are three *access modes* onto the same underlying legacy-schema subject
— never three different subjects, and never a premature jump to Core
ahead of the platform's own migration sequencing.

**P3 — Every Compass-originated claim is honest about what kind of claim
it is.** (LI-3, Evidence Domain §7) A student's own chat turn is Trust
Tier 1 evidence, capped in confidence, defaulting to `pending_review` —
exactly as today (§7 of the audit already got this right). What changes
in v2 is that this evidence has a real path to `reviewed_confirmed`
instead of dead-ending (§8) — see §7 below.

**P4 — Teachers first, always.** A pilot school succeeds or fails on
whether teachers get value without extra work. Every Compass v2 feature
is evaluated first against "does this help a teacher teach," and only
second against "does this help a learner learn directly."

**P5 — Simplicity over sophistication, for this pilot.** (Per the user's
standing engineering philosophy — smallest correct slice, proven with
real data, before generalizing.) Compass v2's pilot scope (§19) is
deliberately narrower than the audit's full list of things that *could*
be fixed. Several real findings are named and deliberately deferred, not
silently dropped.

**P6 — One canonical entry point per audience, not per historical
build.** (Resolves audit §14) There is one Compass conversational surface.
It is reached differently depending on who's using it (teacher-initiated,
learner-initiated, parent-viewed) but it is not two different
implementations of "the chat."

**P7 — Uncertainty is shown, not hidden.** (Constitution: AI confidence
must be honest) Every Compass recommendation — to a teacher, learner, or
parent — is expressible as an `Insight` (`lib/learnerIntelligence/insight.ts`,
already built and used by Blueprint/Career Intelligence): an observation,
the evidence behind it, a confidence level, and a recommended action.
Compass reuses this exact primitive rather than inventing a parallel one.

---

## 3. Core Responsibilities

What Compass v2 owns, stated narrowly on purpose:

1. **Conversational access to existing learner intelligence** — for
   teachers preparing lessons, learners revising, parents checking in.
2. **Structured evidence generation from live learning activity** — a
   session's turns become candidate Evidence, tagged honestly by trust
   tier, routed through the real confirm mechanism.
3. **In-the-moment adaptive teaching support** — Teach/Probe/Remediate/
   Advance behavior, driven by what Projection already knows plus what
   the current session observes, not by a Compass-local mastery model.
4. **Explaining itself** — every recommendation traceable to evidence,
   every uncertainty stated, never hidden.

What Compass v2 explicitly does **not** own: capability computation, risk
computation, knowledge-state computation (all Projection's), curriculum
data modeling (owned by `lib/curriculum/` and the `sow_*` tables — Compass
*reads* them, per audit §10 finding B), and payment/token accounting
(Compass calls the existing token/paywall gate, it doesn't reimplement it).

---

## 4. User Journeys

### Teacher

A teacher's Compass touchpoints happen *around* teaching, not as a
separate destination they have to remember to visit:

- **Before a lesson**: the teacher opens a class and sees, per learner
  where evidence supports it, what Compass would teach next and why —
  drawn from Projection's knowledge/risk state plus any pending
  substrand the teacher has assigned. This is the existing Compass tab
  (audit §13, verdict Keep) re-pointed to read Projection instead of the
  latest raw `compass_sessions.session_state` blob.
- **During class**: for a struggling learner flagged by Attention Feed,
  the teacher can hand that specific learner a Compass session pre-loaded
  with the flagged topic — deep-linked, not the generic "Open Compass"
  link the audit found broken (§13). This closes the concrete gap named
  in the audit: today a teacher can assign a topic and see a risk flag,
  but can't hand the learner a session about that exact thing in one
  action.
- **After class / for planning**: the Compass Topic Picker (Keep, per
  audit §13) remains the mechanism for assigning what a learner works on
  next — now backed by one ownership model (§8 below), not two.
- **Weekly**: nothing new. The Monday Panel and Attention Feed remain the
  weekly-cadence surfaces; Compass is not a second weekly report.

Teacher value in one sentence: *Compass turns "I noticed Amina is
struggling" into "here's what Amina should work on and why, and I can
hand it to her right now" — without the teacher opening a new tool or
re-explaining what they already know.*

### Learner

A learner's Compass experience is a live chat session — largely what
exists today at `/learn` (Keep the shape, per audit §1/§4), reached from
one canonical entry point (P6). Two things change:

- Every session strengthens Projection, not a Compass-local mastery
  model. The four parallel mastery mechanisms the audit found (§11) are
  consolidated into one: Compass reads current mastery from Projection at
  session start, and at session end contributes Evidence back into the
  same pipeline every other evidence source uses.
- A learner with no personal login still gets a session, initiated by
  their teacher handing them a device/link scoped to their own roster
  row (P2) — not gated on `students.user_id` being set.

### Parent

The parent view is *not* a second dashboard of numbers (explicit design
goal). It is a plain-language surface answering three questions, each
grounded in Insight (P7): **what's happening** (an observation drawn from
recent Projection state and recent Compass activity), **why** (the
evidence — a specific session, a specific pattern, a specific assessment),
and **how they can help** (the action, phrased for a parent, not a
teacher — e.g. "ask Amina to explain fractions back to you this week"
rather than "remediate BE-tier numeracy substrand"). The existing parent
activity feed (audit §15, Keep) is the right shape; it gains an
Insight-formatted summary layer instead of a raw session-count list.

### Principal

The principal does not get a Compass dashboard. Compass-originated
evidence simply flows into the same school-wide Projection aggregates
the Principal Dashboard already reads (`lib/school/intelligence.ts`,
already Projection-partial per the Migration Ledger). A principal sees
"school-wide engagement with adaptive learning is up in Form 3 Math" as
one more Projection-derived fact among others — never a Compass-specific
report competing with the one school-intelligence view.

---

## 5. Information Flow

```
Teacher / Learner / Parent
        │
        ▼
   Compass Session (conversational surface)
        │  reads current state
        ▼
   Projection Engine  ◄──────────────┐
        │  (read-only, at session       │  recompute
        │   start and mid-session)      │
        ▼                              │
   Session-local adaptive behavior      │
        │                              │
        │  session ends                │
        ▼                              │
   Evidence (compass_session, Tier 1)   │
        │                              │
        ▼                              │
   Evidence Confirmation Path ──────────┘
   (new — see §7)
```

Compass reads Projection at the *start* of a session (and, for long
sessions, may re-read at a natural checkpoint — not on every turn, to
avoid recomputation cost) and writes Evidence only at natural close-out
points (turn eval, session end) — never a live read-modify-write loop
against Projection itself. This mirrors how every other Projection
consumer already works (Migration Ledger: synchronous recompute at
read-time, not a background stream).

---

## 6. Evidence Flow

Every Compass session turn that the pedagogical loop (Teach/Probe/
Remediate/Advance) evaluates produces, at most, one Evidence candidate per
turn-or-session — not a running log of every message. What becomes
Evidence:

- **Turn-level self-report** (the existing hidden eval block) — Tier 1,
  capped confidence, as today (audit §7 got the mechanism right).
- **Session-level summary** — richer than today's shape (audit §7's
  finding: current Evidence carries only subject + abandoned-flag). v2's
  Evidence record for a Compass session should carry what the *legacy*
  learner-model path already computes for the same event — persistence,
  engagement pattern, help-seeking, concepts touched (audit §12A) — so
  that when the legacy `updateFromCompass` dual-write is eventually
  retired (per the Migration Ledger's stated exit condition), the
  Evidence path is not a functional downgrade from what it replaces.

This is a shape decision, not a schema decision — the actual Evidence
record fields are an implementation detail for the build phase, deferred
per this document's own final instruction.

---

## 7. Projection Integration

This resolves the audit's single clearest structural gap (§8): a producer
and a consumer exist and agree on the contract, but nothing promotes
Compass evidence from `pending_review` to a state Projection will read.

**Decision: build the missing confirm step as a real, human-reviewable
gate — not an auto-promotion shortcut.** Per the Evidence Domain Model
§2, `pending_review` has no timeout-based auto-promotion by design
("silence is not consent"). Compass v2 does not change that invariant.
Instead, it makes the review step *reachable*:

- A teacher reviewing their class's pending Compass evidence is a natural
  extension of the existing Compass tab (§13, Keep) — not a new
  destination. "This session suggested Amina now understands fractions —
  confirm?" is a one-tap action inside a surface the teacher already
  visits, not a new inbox to manage.
- Where a teacher genuinely has no bandwidth to review every session
  (the realistic pilot case, given 50 pioneer teachers with full
  classes), a **conservative, transparent auto-confirm path** is
  reasonable for the lowest-stakes claims only (e.g., "learner engaged
  with N minutes of practice on subject X" — an engagement fact, not a
  mastery claim) — provided it still respects the trust-tier confidence
  ceiling already defined for Tier 1 evidence, and is visibly labeled as
  machine-confirmed if a teacher later inspects it. Mastery-shaped claims
  (`genuine_progress`) remain teacher-reviewable, never auto-promoted,
  because a false "confirmed mastery" is a materially worse failure than
  a false "confirmed engagement."

This is the one place in this document that names a policy decision
rather than deferring it, because §8 of the audit is explicit that this
is the load-bearing gap blocking everything else Compass could
meaningfully contribute to Projection. The exact confidence thresholds
and which claim types qualify for the conservative auto-confirm path are
implementation decisions for the build phase — the principle (teacher-
reviewable by default, narrowly-scoped conservative exception for
engagement-only facts) is the design commitment.

---

## 8. Adaptive Learning Model

**What adapts:** the next question's difficulty, whether to probe a
misconception, whether to advance a topic or hold — i.e., session-local
pedagogical moves. Not a stored, Compass-owned mastery score (that's
Projection's, per P1).

**When:** at each Teach/Probe/Remediate/Advance decision point within a
session — the existing per-turn loop (audit §3/§4, a real design asset,
kept).

**Who drives it — a combination, deliberately not a single actor:**

- **Projection** supplies the *starting point* every session: current
  subject-level mastery, known risk flags, known misconceptions — read
  once at session start (§5). This replaces today's session-local-only
  `subject_tiers`/`session_state` as the sole input (audit §11's
  consolidation).
- **The teacher** supplies *intent* — an assigned topic via the Topic
  Picker, or an implicit intent from which class/lesson context the
  session was launched from. Teacher intent outranks the session's own
  drift when both are present (e.g., a teacher assigning remediation on
  fractions should not have Compass wander to a different topic because
  the learner seems bored).
- **Evidence from the live session** (right/wrong pattern, hesitation,
  the self-reported eval) drives moment-to-moment adaptation *within*
  that session — this is where the existing Teach/Probe/Remediate/
  Advance loop already does real work and should not be redesigned.
- **The learner** has one lever: they can end a session, switch focus
  within teacher-set bounds, or (in self-directed / holiday-mode use)
  pick their own subject — the existing auto-pick-by-weakest-tier logic
  (audit §10A), consolidated to read Projection's tier data instead of
  `student_learning_context.subject_tiers` directly.

This reads as classroom-adjacent rather than individual-tutoring because
the teacher's intent is a first-class input, not an afterthought — a
deliberate difference from a pure one-on-one adaptive tutor model.

---

## 9. Recommendation Engine

Compass does not build a second recommendation engine. Every
recommendation surfaced — "teach this next," "this learner needs
remediation," "this parent action would help" — is an `Insight`
(§2 P7), built from:

- **Observation**: drawn from Projection state (capability/risk/
  knowledge) plus the current or most recent session's evidence.
- **Evidence**: the specific Projection-backing evidence records and/or
  the specific session that produced the observation — never "the system
  suggests," always "based on X."
- **Confidence**: Projection's own confidence handling where the
  recommendation is Projection-derived; the Tier-1-capped confidence
  where it's session-fresh and not yet confirmed.
- **Action**: phrased for the audience receiving it (teacher-actionable,
  parent-actionable, learner-actionable — same underlying Insight, three
  renderings).

No new scoring formula is introduced. Where Compass needs a
recommendation Projection doesn't yet compute (e.g., substrand-level
"which specific misconception to probe next" — blocked today by the
Migration Ledger's documented gap: `knowledgeProjector` is subject-level
only), Compass's session-local Teach/Probe/Remediate/Advance logic
supplies it *within the session*, and that gap is named, not silently
worked around with a parallel Compass-owned substrand model (which would
violate LI-1).

---

## 10. Explainability Model

Every Compass output that reaches a human answers, structurally (not as
prose the model has to remember to include):

1. **What evidence supports this?** → `Insight.evidence` — specific
   session(s), specific confirmed Evidence records, specific Projection
   snapshot.
2. **How confident are we?** → `Insight.confidence`, using the same
   Low/Medium/High labels every other intelligence surface uses
   (`confidenceFromScore`) — a teacher who has seen a Blueprint or Career
   Intelligence insight already knows how to read a Compass one.
3. **What assumptions were made?** → made explicit in `observation`
   phrasing when the underlying data is thin (e.g., "based on one session
   observed this week" is a materially different observation than "based
   on eight weeks of consistent evidence," and the Insight text says so).
4. **What additional evidence would improve confidence?** → `action`,
   when confidence is Low — reusing `insufficientEvidenceInsight()`'s
   existing pattern of naming the gap rather than a plausible-sounding
   guess.

No Compass-specific explainability format is invented; this is the
existing Insight contract applied consistently, which is itself the
point — one coherent system, not several AI tools that each explain
themselves differently.

---

## 11. UI Structure

At the level of structure, not screens:

- **One conversational surface** (resolves §14): a single canonical
  route for the live chat experience, reachable with context (which
  learner, which subject/topic, launched-by-teacher vs
  self-initiated) rather than two separately-evolved URLs.
- **Teacher-facing structural surfaces are existing ones, extended, not
  new destinations**: the per-class Compass tab gains a lightweight
  review affordance (§7) and Projection-backed content instead of raw
  session-state; the Topic Picker is unchanged in position, changed in
  ownership-check consistency (§13 below).
- **Parent-facing structural surface is the existing activity feed**,
  gains an Insight-formatted summary block.
- **The orphaned strand/substrand picker** (`TopicSelector`/
  `TopicChoice`, audit §10B) is architecturally the right shape for
  curriculum-accurate topic assignment and should be the *one* topic-
  selection UI going forward, replacing both the live card-grid's
  keyword-fallback path and the picker's own currently-separate query
  path — collapsing three curriculum-data paths (audit §10's A, B, and
  `topics.ts`) into one.

No new top-level navigation destination is introduced anywhere in the
product for Compass v2 — every touchpoint above lives inside a surface
that already exists in the teacher/parent/learner experience.

---

## 12. API Responsibilities

At the level of responsibility, not routes:

- **Session lifecycle** (start/resume/end) — unchanged responsibility
  from today, cleaned of the dead/duplicated logic the audit found
  (triplicated `tierToLevel`, dead `isSessionExpired`, the schema-
  mismatched `findRecentSessionsByStudent`) as a prerequisite, not a
  side effect, of the redesign.
- **Turn processing** — unchanged responsibility, but the identity/
  ownership check every route in this family performs must be the *one*
  ownership model from §8 below — not the per-route bespoke checks the
  audit found (§13, §19), and the unguarded `studentId` branch (§2 of
  the audit) is a live authorization gap that must close as part of this
  redesign, not deferred alongside cosmetic items.
- **Evidence read/confirm** — a new responsibility surface: whatever
  lets a teacher confirm/reject pending Compass evidence (§7) needs an
  API responsibility that doesn't exist today (the audit found zero
  production callers of `confirmReview`/`getPendingReview` anywhere).
- **Projection read** — Compass session start reads Projection through
  the same `recomputeLearnerProjection(s)` surface every other consumer
  uses (`lib/projection/recompute.ts`) — no bespoke Compass read path
  into Projection internals.

No API contract detail (routes, payloads, status codes) is specified
here, per this document's scope.

---

## 13. Components to Keep

- Session state machine shape (resume windows, lazy stale-session
  cleanup) — audit §1, sound design.
- Teach/Probe/Remediate/Advance pedagogical prompt structure and
  misconception-detection rules — audit §3, a real design asset.
- Turn-processing shape (resolve subject → build prompt → stream → close
  out) — audit §4.
- Three-way state split (session-derived state / client conversation
  history / persisted message log) — audit §5.
- The dual-write-as-documented-migration-strategy pattern at session end
  — audit §6, appropriate for its stated transitional purpose.
- Per-class Compass tab — audit §13, real teacher value, extended not
  replaced.
- Compass Topic Picker — audit §13, extended with the reconciled
  ownership model (§8/§16 audit findings).
- Parent activity feed — audit §15, real value, extended with Insight
  formatting.
- The orphaned strand/substrand picker's *data model* (`sow_*` tree) —
  audit §10B, architecturally sounder than the live keyword-fallback path.

## 14. Components to Modify

- `learn/route.ts` — extract inline business logic to `lib/`, per
  CLAUDE.md's own architecture rule and the audit's highest-priority
  finding (§2).
- `learn/student/route.ts` — close the unguarded `studentId` ownership
  gap (§2, a live authorization issue, not cosmetic).
- Ownership/ID resolution across every Compass route — converge on one
  model (§8 of this document, resolving audit §16/§19).
- Evidence shape for `compass_session` — enrich to carry what the legacy
  learner-model path already computes (§6 of this document, resolving
  audit §7/§12).
- Subject/topic selection — converge the three curriculum-data paths
  into one (§11 of this document, resolving audit §10).
- Alerts "Open Compass" link — deep-link to the specific flagged learner
  and topic (audit §13).
- Compass tab's data source — read Projection-derived state, not raw
  `session_state` JSON, for anything that duplicates what Projection
  already computes (audit §12/§13).

## 15. Components to Remove

- `isSessionExpired()` — dead, unused (audit §1/§17).
- `consecutiveRight`/`consecutiveWrong` fields — dead, never incremented
  (audit §5/§17).
- `sessionState.currentSubject` fallback reference — dead, doesn't exist
  on the persisted type (audit §5/§17).
- Triplicated `tierToLevel()` — consolidate to one shared function
  (audit §3/§17).
- The keyword-regex subject fallback in `resolveSubject()` — replaced by
  the consolidated curriculum-driven topic selection (§11).
- The dashboard splash redirect page (`/dashboard/learning-compass`) —
  vestigial once the single canonical entry point (§11) exists; no
  functional purpose survives the /learn-vs-/chat reconciliation.
- The second, orphaned curriculum-query path (`lib/compass/topics.ts`'s
  RPC) once the `sow_*`-based picker becomes the one path (§11) — keep
  whichever of the two proves to be the actual source of truth; audit
  §10 flags this as needing a data-integrity check before either is
  deleted.

## 16. Components to Build

- The Evidence confirm/promote surface for Compass evidence (§7) —
  currently the single missing link between a real producer and a real
  consumer.
- One ownership-resolution path for "which learner does this Compass
  action concern," used by every Compass route (§8) — replacing the
  three incompatible models the audit found.
- A teacher-facing review affordance inside the existing Compass tab
  (§7, §11) — not a new destination, an extension of one.
- Deep-linking from Attention Feed / alerts into a pre-scoped Compass
  session (§4 Teacher journey, §14).

---

## 17. Migration Strategy

This does not compete with the Migration Ledger — it is one more row in
it, following the same discipline every other consumer already follows:

1. **Fix live bugs first, independent of redesign direction.** The
   schema-mismatched `findRecentSessionsByStudent` call (audit §17) is a
   production bug today, actively called from Parent Pulse — it should
   be fixed on its own, before or in parallel with anything else here,
   because it is broken regardless of what Compass v2 becomes.
2. **Converge ownership/identity before touching evidence or UI.** Every
   other decision in this document (the review surface, the deep-linking,
   the topic-selection consolidation) sits on top of "which learner does
   this concern" being answered one way. Sequencing anything else first
   means building on the exact instability the audit identified as the
   central finding.
3. **Ship the confirm/promote path next.** This is what turns Compass
   from a source that produces Evidence nobody reads (today's actual
   state, per §8) into a real Projection contributor. Everything about
   "Compass makes the platform smarter" depends on this existing.
4. **Consolidate mastery/subject-selection mechanisms last**, once
   there's live confirmed Evidence to observe — deciding the *right*
   consolidated model is easier with real pilot data than by design
   alone, consistent with the "start simple, grow later" philosophy this
   project has followed elsewhere.
5. **Dual-write exit stays governed by the Migration Ledger's own stated
   condition** (all Deferred consumers migrated) — Compass v2 does not
   accelerate or bypass that condition; it just makes the Evidence side
   of the dual-write finally functional, which is a prerequisite for that
   condition ever being satisfiable, not a shortcut around it.

---

## 18. Risks

- **Auto-confirm scope creep.** The conservative auto-confirm exception
  (§7) is deliberately narrow (engagement facts only). The single biggest
  way this design could go wrong in implementation is that exception
  quietly widening to cover mastery claims because teacher review
  capacity is limited in practice — that would silently violate LI-3 and
  the Evidence Domain's own "silence is not consent" invariant. Any
  widening of that exception must be a named, reviewed decision, not
  scope drift.
- **Ownership convergence touches every Compass route at once.** §8's
  fix is structurally the riskiest single change here — it is also the
  one the whole redesign depends on, so it cannot be partially done
  (a mix of old and new ownership checks across routes recreates exactly
  the inconsistency being fixed).
- **Curriculum-path consolidation (§11) may reveal that the two existing
  query paths don't actually return the same data** — audit §10 flags
  this as unverified. If they disagree, that's a data-integrity finding
  to resolve before either is deleted, not after.
- **Teacher review load.** 50 pioneer teachers with full class loads is
  the real constraint the conservative auto-confirm exception exists to
  manage — if even engagement-level review requests feel like burden,
  the pilot will surface that quickly and the threshold should move, not
  the principle.
- **Deep-linking depends on Attention Feed's Projection-partial state**
  (Migration Ledger: `students_needing_attention` is Projection-sourced
  today, but `hidden_misconceptions`/`acceleration_candidates` are not)
  — a deep-link built against the wrong half of that panel would hand a
  teacher a link to a topic derived from stale legacy data. Deep-linking
  should target only the already-Projection-sourced fields until the
  rest of Attention Feed migrates.

---

## 19. Pilot Version Scope

For a successful Third Term pilot at one school, the load-bearing
subset of everything above is:

**In scope:**
- One ownership/identity model for all Compass routes (§8) — this is not
  optional even for a pilot; it's the thing every other pilot feature
  depends on.
- The live schema-mismatch bug fix (§17.1) — a production correctness
  issue, not a redesign choice.
- The Evidence confirm/promote path, teacher-reviewable, for a single
  claim type first (mastery/`genuine_progress`) plus the narrow
  engagement auto-confirm exception (§7) — enough to prove the pipeline
  end-to-end without building every claim type's review UX at once.
- Deep-linking from the Attention Feed's already-Projection-sourced risk
  list into a scoped Compass session (§4 Teacher journey) — the single
  highest-leverage "reduce teacher workload" feature named in the design
  goals.
- Parent feed Insight formatting (§4 Parent journey) — low effort,
  directly serves the stated "not another dashboard of numbers" goal.
- Dead-code removal (§15's dead-code items) — free cleanup, no design
  risk, improves the codebase this pilot ships on.

**Explicitly deferred, not silently dropped:**
- Full curriculum-path consolidation (§11) — the pilot can run on the
  live card-grid path unchanged if the data-integrity question (§18) isn't
  resolved in time; this is a real gap, named, not hidden.
- The dashboard splash page removal (§15) — cosmetic, no pilot risk
  either way.
- Full four-mechanism mastery-model consolidation (§8/§11 of the audit)
  — the pilot can run on Projection-as-source-of-truth-for-starting-
  state without fully retiring every legacy session-local mechanism on
  day one, provided none of them silently override what Projection says.
- Substrand-level knowledge / 6-dimension capability gaps named in the
  Migration Ledger — these are Projection Engine v2 candidates, not
  Compass v2's problem to solve.

---

## 20. Future Evolution

Beyond the pilot, in rough priority order once real usage data exists:

1. **Widen the confirm/promote path** to more claim types as teacher
   review patterns from the pilot show what's actually reviewable at
   scale — informed by real behavior, not designed speculatively now.
2. **Retire the `learner_profiles` dual-write** once the Migration
   Ledger's Deferred consumers (Holiday Planner, Parent Pulse, Remedial
   Planner, Monday Panel, Prerequisite Readiness) migrate to Projection —
   Compass's half of that condition becomes satisfiable once §7 ships;
   the other half is outside Compass's scope.
2a. Continue consolidating the mastery/subject-selection mechanisms
   (§11) into whatever the pilot's real data shows is the right single
   model — deliberately not designed in full here, per P5.
3. **Extend curriculum-framing beyond CBC** (8-4-4, IGCSE) in the prompt
   layer, once a pilot school outside pure CBC is on the roadmap — named
   as a gap (audit §3) but not a pilot blocker.
4. **Revisit the third-party integration question** (Google Classroom
   etc.) only if a real school asks, consistent with the School
   Integration Pipeline's own stated sequencing decision — never ahead
   of demand.
5. **A Compass-specific Projection extension** (e.g., session-frequency/
   engagement as a first-class Projection dimension, not just an
   Evidence input) is a plausible future Projection Engine v2 feature —
   named here as a direction, explicitly not designed, because it
   depends on evidence from a live pilot this document cannot yet have.
