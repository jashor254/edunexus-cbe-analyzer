# EduNexus Architecture — Final Ratification

Status: **SIGN-OFF — one additional Critical finding surfaced by a
subsequent adversarial pass.** See
[learner-record-layer-adversarial-challenge.md](learner-record-layer-adversarial-challenge.md):
`learner_evidence` has no curriculum/scale-version anchor, a 4th
blocking-caliber gap this document did not catch. Read that document
alongside this one — it does not reopen anything below, it adds one item
of the same class as this document's three.

Read in full against `learner-record-layer.md`,
`learner-record-layer-review.md`, `learner-record-layer-decisions.md`,
and `learner-record-layer-final-challenge.md`, in that order, later
superseding earlier per instruction. This document does not redesign
anything — it judges whether the architecture as it now stands is ready
to become permanent. Every issue below passed all four tests: objectively
demonstrable, long-term, expensive to repair later, not already resolved
by a later document. Issues that failed any test (raised in earlier
passes, then closed out by later ones — e.g. the standalone
`teacher_remarks` table, the `assessment_purpose` enum, the missed
Evidence Domain implementation) are not repeated here.

---

## Executive Summary

The core architecture — Evidence as an immutable, append-only, four-axis
(trust/confidence/review/verification) source of truth; Projection as the
sole derived-state layer, computed deterministically and reproducibly
from confirmed Evidence; a read-path guardrail preventing future
consumers from bypassing Projection; teacher attribution instead of
ownership enforced structurally — is sound and does not need to change.
Four review cycles produced convergent, not oscillating, conclusions:
each pass either confirmed prior decisions or found something genuinely
new, and nothing found late contradicted anything decided early. That
convergence is itself evidence of a stable design, not a lucky outcome.

Three gaps remain unresolved as of the final-challenge document, and they
share one specific property that elevates them above the rest: **they are
cheap to add only before the first real Evidence row is written, and
genuinely, not just expensively, unrecoverable once real rows accumulate
without them.** Everything else raised in the final-challenge document is
real but does not share that property — it can be added additively,
during or shortly after Phase 0, without any risk of permanent loss.

---

## Blocking Issues

Three. All schema-additive (new nullable columns / a new lifecycle-state
value), none requiring rework of anything already decided, all
implementable in the time it takes to write one migration each.

**1. No erasure lifecycle state.** The Evidence Domain's lifecycle enum
(`auto_confirmed | pending_review | reviewed_confirmed | reviewed_rejected
| superseded | retracted`) has no state for a legally-mandated deletion
request. "Never delete" is correct as a *default* posture for an evidence
system — it is not correct as an *absolute*, unconditional rule for a
platform that intends to operate across multiple countries with data
protection law. This blocks implementation because the alternative is
operating on real personal data, in a legally exposed position, for
however long it takes to notice the gap — and by then, downstream
consumers and operational habits will have hardened around "evidence is
permanent, full stop," making the fix a cultural change, not just a
schema change. Add an `erased` lifecycle state and a defined PII-purge
tombstone pattern (row identity and audit chain survive; `extracted_name`/
`score`/`payload` do not) before Phase 0.

**2. No `school_id` snapshot on `learner_evidence`.** School context is
derivable only transitively, at read time, via `teacher_id → teachers.school`
— a mutable free-text field. `holiday_plans` already snapshots
`school_id`; this table doesn't, which confirms this is an inconsistency,
not a considered choice. This blocks implementation specifically because
of *when* the harm becomes permanent: the moment evidence rows exist
without a captured `school_id`, "which school was this evidence really
created at" is not migratable later — the information was never stored,
and the only source that could reconstruct it (the mutable `teachers.school`
field) may have already changed by the time anyone asks. Add a nullable
`school_id` captured at write time before Phase 0.

**3. No person-level identity anchor on legacy learner identity.**
`students.id` is an enrollment identity, not a person identity — Core's
`learners.upi` (NEMIS UPI) already solved this; legacy never received the
equivalent. This blocks implementation because it directly contradicts
the architecture's own stated first principle — "the learner is the
permanent entity" — for the one scenario that principle most needs to
survive: a learner transferring schools. Reconciling "these N `students`
rows across M schools over a decade are one person" after millions of
evidence rows already exist tied to enrollment-scoped IDs is a research
project, not a migration. Reserve a nullable person-level identifier
field now, even unpopulated — resolution logic can wait for real
transfer cases in the pilot, but the column cannot be backfilled onto
data that was never asked to carry it.

**No other issue in any of the four documents meets the bar for
blocking.** Everything else is real, but recoverable via an ordinary
additive migration or a code-only fix at any later point without
permanent loss — which is precisely what separates it from the three
above.

---

## Non-Blocking Recommendations

Purely additive; none require touching a decision already made.

- **`payload_version` inside the `payload jsonb` shape** (Decision 1) —
  add before Phase C ships, not urgently before Phase 0; no real payload
  rows exist yet to drift.
- **`status`/`graduated_at` on legacy `students`**, mirroring Core's
  already-proven `learners.status`/`graduation_date` design — supports
  the alumni-records/employment-outcomes goal; safe to add any time,
  since a `NULL` status is a legitimate "unknown, backfill later" state
  and nothing currently depends on this column existing.
- **Trust-tier-aware value selection in `capabilityProjector.ts`** — a
  code fix, not a schema change; currently selects "latest evidence per
  subject" without weighting by trust tier, only discounting the separate
  `confidence` metadata. Real, but fixable at any point before Compass
  usage volume makes the resulting bias hard to explain retroactively —
  recommended before broad Compass rollout, not before Phase 0.
- **State `evidence_purposes`' governance explicitly**: platform-owned
  only, never school-editable; add an optional `region` column only if a
  second country's data ever actually needs one. Documentation-only.
- **Document "Reasoning" as a tier containing multiple independent
  reasoning contexts** (capability, career, remedial), not one bounded
  context — prevents a future engineer from forcing an unnatural shared
  abstraction across genuinely different domain vocabularies.
  Documentation-only.
- **Name a partitioning trigger** for `learner_evidence`/`evidence_audit_log`
  (e.g., "reconsider partitioning past ~50M rows") — no action now, just
  a documented threshold so nobody has to rediscover the question cold.

---

## Decisions That Should Never Be Reopened

- **Evidence as an immutable, append-only, four-axis** (trust tier /
  confidence / review status / verification state) **source of truth**,
  with correction expressed as supersession, never in-place mutation.
- **Projection as the sole legitimate derived-intelligence layer**,
  computed deterministically and reproducibly from confirmed Evidence —
  and the principle that no future consumer reads Evidence directly for
  intelligence purposes (the read-path guardrail).
- **Teacher attribution, not ownership** — `teacher_id` on any
  evidence-producing row means "who entered this," never "who may read
  or gate this downstream." Structural, not conventional.
- **Legacy-first identity for the pilot**, with Core-identity migration
  explicitly and deliberately deferred to Learning Intelligence Migration
  Strategy Phase 5+ — a named trigger, not an open question.
- **Class archival, not deletion**, with `student_promotions` as an
  append-only promotion history separate from the fast-read
  `students.grade` current value.
- **School-configurable assessment type names**, separated from a
  platform-governed, lookup-table-based `evidence_purposes` axis
  representing educational meaning — not a Postgres enum, not
  hand-mapped per assessment.
- **A single shared `payload jsonb` column** as the mechanism for
  absorbing new non-scored evidence types (remarks now; attendance,
  behaviour, competitions later, if and when a real school asks) —
  neither a new table per source nor unbounded new nullable scalar
  columns on `learner_evidence`.
- **The Reasoning layer as a promotion of `capabilityExtractor.ts`**,
  not a new invention — its five existing callers are unaffected, and
  the Anti-Corruption Layer (`projectionToScoreHistory`) bridging it to
  Projection retires on its own schedule, tied to Projection's V1.0 gaps
  closing, not to this ratification.
- **`recommend.ts` as the canonical Recommendation layer**, with Remedial
  Planner's legacy-sourced gap remaining a tracked, not reopened,
  question, already explained in the Migration Ledger.
- **The capability-store consolidation (Phase H)** — collapsing
  `students.capability_profile` into a Projection-sourced cache, leaving
  `learner_profiles.capability_dimensions` as separately-tracked legacy.
- **Traditional analytics and Intelligence as separate layers**, with the
  traditional-analytics engine consolidation (mean/median/mode/pass-rate/
  grade-distribution) scoped independently from anything Projection
  computes.
- **The School Integration Pipeline's CSV/API-push design** (rosters,
  classes, idempotent external-ID upsert) — unaffected by, and not part
  of, this Evidence/Projection initiative.

---

## Architecture Readiness

**Ready after Blocking Issues are Addressed.**

Not "Ready for Implementation" outright, because three gaps are real,
demonstrable, and specifically time-sensitive in a way nothing else in
four review passes was: each becomes unrecoverable, not merely
expensive, the moment real Evidence rows accumulate without them. Not
"Not Ready," because the fix for all three is three additive schema
changes — not a redesign, not a rework of anything settled, and not a
delay measured in more than the time to write and apply three migrations
before Phase 0 begins.

---

## Final Confidence Score: 80/100

- **−8 for the erasure lifecycle gap.** The most severe of the three
  blocking issues — legal exposure compounds with every real user added
  before it's fixed, and unlike the other two, the harm here isn't only
  "data we can't reconstruct," it's operating a real platform out of
  compliance with law in markets it explicitly intends to serve.
- **−5 for the missing `school_id` snapshot.** Silent, permanent,
  unrecoverable historical mis-attribution risk, for the cost of one
  nullable column.
- **−5 for the missing person-level identity anchor.** Directly
  contradicts the architecture's own first principle for its most
  important scenario (school transfer), for the cost of one reserved,
  even-if-unpopulated column.
- **−2, collectively, for the five non-blocking items.** Real but genuinely
  minor — each is additive, none risks permanent loss if delayed, and
  together they represent polish on an already-sound design, not gaps in
  it.

**Five years from now, with millions of learners across multiple
countries, the version of this team that inherits whatever ships today
would want to have been told, before the first row was written, exactly
these three things — and nothing else.** Every other finding across four
review passes turned out to be either already fixed by a later document
or fixable without loss at any later point. That is what a score in the
80s, not the 50s or the high 90s, should mean here: a fundamentally sound
architecture, three specific and cheap pre-implementation additions away
from the 92+ it would otherwise earn.
