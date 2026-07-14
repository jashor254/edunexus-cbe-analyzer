# EduNexus Architecture — Final Adversarial Challenge

Status: ADVERSARIAL REVIEW, post-ratification. Read against all five prior
documents (`learner-record-layer.md`, `-review.md`, `-decisions.md`,
`-final-challenge.md`, `-ratification.md`). The three previously-identified
blocking issues (erasure lifecycle state, `learner_evidence.school_id`
snapshot, person-level identity anchor) are **not re-reported here** — they
are already found, already tracked, still open as of this document, and
re-listing them would not meet this pass's own bar ("nobody else has
noticed"). This document reports only what six prior passes missed.

---

## Executive Verdict

The architecture does not break. Every deliberate attempt to find a
structural failure — in identity, in the Evidence→Projection→Reasoning→
Recommendation pipeline, in operational scenarios (duplicate imports,
offline sync, conflicting edits, school mergers) — either failed to find
one, or found something the *existing* primitives can absorb without a
redesign. That is a genuine, positive result, not a failure to try hard
enough.

But one real, previously-unnoticed gap survived every round of prior
review and does meet this pass's strict bar: **nothing on `learner_evidence`
captures which curriculum edition or grading-scale version was in effect
when the evidence was created.** This is not cosmetic. CBC has already
been revised multiple times since 2017, in the same country this
architecture is piloting in — this is not a hypothetical 20-year risk, it
has historical precedent within the platform's own first country. Left
unaddressed, a future curriculum revision would make historical evidence
literally uninterpretable without external, undocumented knowledge of
"what did `cbc_level: 3` mean in 2026" — directly the "will evidence
become impossible to interpret" failure mode this review was asked to
hunt for.

Two further findings are real and worth acting on, but — unlike the
above — are recoverable at any later point using machinery the
architecture already has, so they do not block implementation.

---

## Critical Findings

**1. No curriculum/scale-version anchor on Evidence.**

`learner_evidence.cbc_level`, `subject`, `strand`, `sub_strand`, and
`knowledge_node_id` are all implicitly scoped to "the curriculum
framework as understood at write time." Nothing on the row says *which*
framework. Notably, the same table already has `confidence_formula_version`
— proof the designers understood "version the thing whose meaning can
drift over time" as a necessary pattern — but didn't apply it to the one
dimension most likely to actually drift across a 20-year, multi-country
horizon: the curriculum scale itself.

**Why this is objectively real**: CBC's own structure has already
changed multiple times in Kenya since introduction. **Why it matters at
the stated scale**: "multiple curricula," "multiple countries," and
"curriculum revisions" are named directly in this review's own 20-year
assumptions — this isn't a remote edge case, it's one of the explicitly
stated conditions the architecture is being judged against. **Why it's
expensive later, not just now**: once evidence rows exist without a
captured curriculum version, reconstructing "which framework produced
this `cbc_level` value" requires inferring it from `created_at` date
ranges against an external, separately-maintained timeline of curriculum
revisions — fragile, and actively wrong the moment two revisions overlap
a transition period, or the external timeline itself is lost to
institutional memory over 20 years. **Why it's not already addressed**:
none of the five prior documents mention curriculum versioning on
Evidence at all — Decision 2's `evidence_purposes` axis addresses
*assessment-type meaning*, not *curriculum-scale meaning*; they are
different questions.

**Fix**: add a `curriculum_version` (or `curriculum_edition_id`,
referencing a small platform-governed reference table, same shape as the
already-decided `evidence_purposes`) column to `learner_evidence`,
captured at write time, before Phase 0. Additive, cheap now,
unrecoverable later — the same class of fix as the three already-known
blocking issues.

---

## High-Risk Findings

**2. Supersession conflates three different real-world events into one
undifferentiated mechanism.**

`claimKey()`-based supersession treats "newer evidence for the same
claim key replaces older evidence" as a single case. In reality, at
least three distinct events produce that exact same database
transition, with no field distinguishing which occurred: **(a)** a
genuine correction (a teacher re-grades and resubmits); **(b)** a
duplicate or retried import (a real risk given "offline schools" and
"offline synchronization" are named as scenarios to survive — a
retry-happy sync client re-transmitting an already-ingested batch after
an unacknowledged network failure would create a new evidence row that
silently "supersedes" its own identical predecessor); **(c)** a
conflicting concurrent submission from two different authorized people
for the same claim key (e.g., a substitute and the regular teacher both
submitting marks), where "latest wins" reflects submission timing, not
correctness. The existing contradiction-flagging mechanism only fires
for large disagreements (a 2+ CBC-level gap) — two submissions close in
value but genuinely in conflict, or a pure duplicate, both pass through
identically and silently.

This does not corrupt any individual record — every row remains
immutable and true to what it says. What it threatens is exactly the
standard this review named: "what actually happened," not "what do we
think happened" — at scale, with real offline-sync retries and multiple
staff able to submit for one class, a supersession chain becomes
ambiguous as to *why* it exists, and that ambiguity compounds, unrecoverable
after the fact, the longer the platform runs without capturing it.

**Not blocking, because recoverable going forward without touching
historical rows**: add a `supersession_reason` enum (`correction` |
`duplicate_detected` | `concurrent_submission` | `unspecified`) captured
at the moment of supersession, going forward. Historical ambiguity prior
to the fix is a real, permanent gap for that period only — worth
accepting for the pilot's low volume, worth closing before broader
rollout increases the volume of undifferentiated supersessions
accumulating.

**3. Projection-version drift accumulates silently for inactive/graduated
learners.**

`recompute.ts` correctly stores `projection_version` per projection —
good foresight — but recomputation is triggered only by new evidence.
A learner who stops generating evidence (graduated, transferred out,
simply inactive) keeps whatever projection was last computed, frozen at
whatever formula version was current then. Over 20 years and multiple
projector-formula revisions, a cohort query spanning "all alumni from
2020–2030" (a named 20-year use case: alumni records, longitudinal
research) would silently mix projections computed under different,
methodologically incompatible formula versions, presented as if directly
comparable.

**Not blocking, because the fix requires no schema change and the
architecture already has the tool**: `recomputeLearnerProjections()`
already accepts a batch of learner IDs. What's missing is a scheduled
job that finds `learner_projections` rows whose `projection_version`
lags the current version and recomputes them — an operational addition,
not an architectural one, safe to build any time before it's needed for
a real cross-cohort analytical product.

---

## Confirmed Architectural Strengths

These decisions were explicitly attacked this pass — offline sync,
concurrent edits, database corruption/partial restore, duplicate
imports, school mergers/closures, AI-generated evidence at scale,
twenty-year formula evolution — and none produced a finding requiring
their redesign:

- **Immutable, append-only Evidence with claim-key supersession** — the
  *mechanism* held under every attack; what's missing (finding 2) is
  metadata about *why* a supersession happened, not a flaw in the
  supersession primitive itself.
- **Projection as the sole derived-intelligence layer, deterministic and
  replayable from confirmed Evidence** — this is precisely what makes
  finding 3 recoverable rather than catastrophic. A system without this
  property would have no way to fix version drift at all; this one does,
  by design.
- **Teacher attribution, never ownership** — survived every operational
  scenario tested (teacher transfer, substitute conflicts, concurrent
  submissions) without needing to become a gating concept anywhere.
- **The read-path guardrail principle** — nothing found this pass
  required a consumer to read Evidence directly instead of through
  Projection.
- **Legacy-first migration with a named Core-identity trigger** — school
  mergers/closures were attacked directly; nothing found requires the
  Core-identity migration to happen before it's already scheduled to.
- **The shared `payload jsonb` mechanism** — attacked against every named
  future evidence type (AI tutor interactions, competitions, portfolios)
  and absorbed all of them without a schema change.

---

## Things I Explicitly Would NOT Change

**The core immutability/supersession primitive.** Every attempt to find
a scenario that breaks "never mutate, always append, correct via
supersession" instead found gaps in what metadata accompanies a
supersession (finding 2) — the primitive itself is exactly right and
should never become mutable.

**Projection's deterministic-replay design.** The version-drift finding
(3) is only a *monitoring* gap precisely because replay-from-evidence
already works correctly — this is the strongest evidence in this entire
six-pass review that the Evidence/Projection split was the right call.
A system that couldn't replay wouldn't have a recoverable version-drift
problem; it would have an unrecoverable one.

**Trust tier as a source-type property, revised only prospectively.**
Attacked directly via the government-audit/fraud scenario named in this
review — found that *bulk* retroactive retraction has no dedicated
tooling yet, but confirmed this is buildable at any time on top of the
existing per-record `retractEvidence()` primitive without touching the
trust-tier invariant itself. The invariant stands; only tooling is
missing, and only for a scenario (systemic fraud discovery) with no
current evidence of being an actual risk yet.

---

## Final Confidence Score: 79/100

The base architecture — Evidence, Projection, the guardrails, the
promotion/archival/consolidation decisions — remains genuinely sound
after six review passes and one dedicated adversarial attempt to break
it, and nothing found this pass required reopening a single frozen
decision. That result on its own would justify a score in the
mid-90s.

The deduction reflects one substantive new discovery and two real,
non-blocking gaps, plus the three still-open items from the prior
ratification:

- **−6** for the new critical finding (no curriculum/scale-version
  anchor) — comparable in class to the three already-known blocking
  issues: cheap now, unrecoverable once real evidence accumulates
  without it, and directly threatens one of this review's own named
  failure modes ("will evidence become impossible to interpret").
- **−4** for supersession's missing reason/type metadata — a real,
  demonstrable gap against named operational realities (offline sync,
  concurrent edits), not blocking, but a genuine erosion of "what
  actually happened" over enough scale and time.
- **−3** for projection-version drift on inactive learners — real, but
  the architecture's own replay design makes it fully recoverable
  whenever addressed, which is exactly why the deduction is small.
- **−2** for the three previously-identified blocking issues (erasure
  state, evidence school-id snapshot, person-level identity anchor)
  remaining open as of this document — already known, already scheduled,
  a small residual deduction rather than a fresh one.

**This is not a verdict that the architecture is unsound.** It is the
expected, honest result of asking "what would someone inheriting this in
20 years wish they'd been told" four separate times and getting smaller,
more specific answers each time — which is what convergence toward a
mature architecture actually looks like, rather than a system that
either passes trivially or collapses under scrutiny. With the
curriculum-version fix added alongside the three already-scheduled
blocking items, this would be a 92+, for the same reason stated in the
ratification: nothing left would be irrecoverable, only incomplete.
