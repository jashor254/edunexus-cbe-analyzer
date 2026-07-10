# The Evidence Domain Model

Status: DRAFT — domain design only. No schema, no API, no implementation
decisions are made here. This document exists to answer one question
precisely: *what is Evidence, as a concept, independent of any table,
file format, or pipeline stage that happens to produce it?*

Depends on: [Intelligence Ingestion Engine](intelligence-ingestion-engine.md)
(the pipeline that produces Evidence), [Learner Intelligence Engineering
Principles](learner-intelligence-engineering-principles.md) (LI-2, LI-5,
LI-6, LI-8 — this document is the domain model those principles were
gesturing toward without fully specifying), and the Phase 1 architecture
review (which found that "missing pieces" were not implementation gaps
but missing domain concepts — this document is the response to that
finding).

---

## 0. The Central Reframing

Phase 1 treated Evidence as *data on its way to becoming an assessment
row*. That framing is the root of every gap the review found. The
correct framing:

**Evidence is a permanent, first-class domain object in its own right —
not an import artifact, not a staging record, not a means to an end.**
The Learner Intelligence Engine's current state (capability, risk,
knowledge, engagement) is not a second store Evidence "writes through
to." It is a **projection** — a computed view derived from the
confirmed Evidence that exists for a learner at any point in time.

This single reframing is what makes immutability, lineage, versioning,
and replayability coherent instead of bolted-on: if Evidence is the
source of truth and Learner Intelligence state is derived from it, then
correcting a mistake means adding new Evidence and recomputing the
projection — never editing history. If Evidence were instead a staging
area for a mutable table (Phase 1's design), none of the other nine
concepts below can be made fully consistent, because there would always
be two competing notions of "what's true": the Evidence and the table it
mutated.

Everything that follows assumes this reframing.

---

## 1. Evidence Identity

Every Evidence record has exactly one identity: a permanent identifier,
assigned the moment the record comes into existence, never reused, never
recycled — even if the record is later rejected, retracted, or
superseded. Rejection and retraction are things that happen *to* a
record with a permanent identity; they are not erasures of that identity.

A record is considered to "come into existence" once it is a
**fully-formed claim** — subject mapped, confidence computed, identity
resolution attempted (successfully or not). Raw extraction output that
hasn't reached this point is not yet Evidence in the domain sense; it is
intermediate pipeline state. This gives the domain a clean boundary:
Evidence either exists, permanently, with an identity — or it doesn't
exist yet.

---

## 2. The Evidence Lifecycle

A state machine with two entry paths and two ways to leave "current"
standing — deliberately not the binary confirmed/pending split Phase 1
used:

```
                         ┌─────────────────┐
              (auto)     │  auto_confirmed │──┐
        ┌────────────────►                 │  │
        │                └─────────────────┘  │
 [created]                                     ├──► superseded
        │                ┌─────────────────┐   │    (new evidence
        └────────────────► pending_review  │   │     replaces this
        (below            │                │   │     as "current")
        threshold)        └────────┬────────┘   │
                                    │            ├──► retracted
                          ┌─────────┴─────────┐  │    (formally
                          │                   │  │     withdrawn,
                    reviewed_confirmed   reviewed_rejected  error found
                          │                   │  │     after
                          └─────────┬─────────┘  │     confirmation)
                                    └────────────►┘
```

- **`auto_confirmed`** — confidence met the threshold at creation; no
  human touched it.
- **`pending_review`** — held for a human; every low-confidence record
  lands here and *stays* here until a decision is made (this state has
  no timeout-based auto-promotion — silence is not consent).
- **`reviewed_confirmed`** / **`reviewed_rejected`** — a human decision,
  permanently attributed to that human, with a reason. Rejected evidence
  is not deleted — a rejected claim is itself a fact worth keeping (it
  answers "did someone claim this and was it wrong," which matters for
  understanding a source's reliability over time).
- **`superseded`** — a *later* piece of evidence, sharing the same claim
  key (see §6), has become the current answer. The superseded record's
  content never changes; only this state marker and a pointer to what
  replaced it are added.
- **`retracted`** — distinct from rejection. Rejection is a review
  outcome on evidence that never reached confirmed standing. Retraction
  is the formal, reasoned withdrawal of evidence that *was* confirmed
  and is now known to be wrong (a school reports a data-entry error, a
  fraud is discovered). Retraction always carries an actor and a reason,
  same as rejection, but starts from a different place in the lifecycle
  and has different downstream consequences (§10).

Only `auto_confirmed` and `reviewed_confirmed` records that are not
`superseded` or `retracted` are "current" — the only ones the Learner
Intelligence Engine's projection may read.

---

## 3. Immutability and Versioning

**Invariant: an Evidence record's factual content never changes after
creation.** Subject, score, source, raw input reference, extracted
identity fields, confidence value, and the trust tier snapshot in effect
at creation time are fixed forever. The *only* things permitted to
change post-creation are lifecycle-state fields (§2) and the small set
of fields that record a lifecycle transition (reviewer, reason,
timestamp, superseding pointer) — and each such change is itself a
recorded event (§8), never a silent field update.

**Versioning is not in-place correction — it is supersession.** When a
school re-submits corrected data for something already claimed, the
system does not edit the old record. It creates a new Evidence record
and links it to the old one. The old record transitions to `superseded`;
its content is untouched. Querying "the current truth" means following
the chain to its unsupserseded head; querying "the full history" means
walking the whole chain. Both are always answerable, because nothing was
ever overwritten.

---

## 4. Superseding Rules

Two Evidence records can only supersede one another if they share the
same **claim key**: the same learner, the same subject, the same
assessment context (assessment type, academic year, term). Evidence
outside that key is simply new and independent — it never interacts
with unrelated evidence.

Default rule: when two confirmed records share a claim key, the more
recently created one automatically becomes current, and the older one is
marked superseded. This is a stated policy, not an implicit side effect
of a database write — a future refinement could route *conflicting*
evidence (same key, meaningfully different content) to review instead of
silent auto-supersession, but the base rule must be explicit either way,
because "which fact wins" is an epistemic decision, not a technical one.

---

## 5. Lineage

Every pipeline execution — one CSV upload, one future OCR job, one API
push — is itself a first-class object with its own permanent identity:
an **Ingestion Run**. Every Evidence record produced by that execution
references the Ingestion Run that produced it. This is what makes "which
import produced this claim" an answerable question, which it was not in
Phase 1 (each pipeline call was anonymous).

Lineage has two independent dimensions, and both must be preserved:
1. **Evidence → Ingestion Run**: which batch/process produced this record.
2. **Evidence → Evidence** (via supersession): which prior claim, if any,
   this record replaced.

Together, these fully answer "where did this come from" and "what did
it replace" — the two questions Phase 1 could not answer at all.

---

## 6. Provenance

Distinct from lineage. Lineage identifies the *process*; provenance
identifies the *specific origin* within that process — which row of
which file, which region of which photo, which field of which API
payload. Provenance also records **which extraction method, and which
version of it**, produced the record. This matters because extraction
quality itself evolves — an OCR engine improves, a CSV parser's mapping
rules change — and a record created under an older, less accurate
extraction method should remain honestly interpretable as such, forever,
rather than silently indistinguishable from one created under a better
method next year.

---

## 7. Trust Tiers vs. Confidence — Kept as Two Separate Concepts

The Phase 1 review confirmed this separation was already correctly
modeled; this document makes it a permanent domain rule, not an
implementation detail that happened to be right once:

- **Trust tier** is a property of the *source type* (teacher upload,
  CSV export, AI-inferred observation, etc.), coarse, and changes rarely
  — it represents the platform's institutional judgment about how much
  structural weight a category of evidence deserves. If a source's trust
  tier is ever revised, that revision affects evidence created *after*
  the change only. It never retroactively reinterprets historical
  evidence, because historical confidence values were computed under the
  tier in effect at the time (§3's immutability invariant).
- **Confidence** is a property of the *individual record*, computed once
  at creation from identity-match quality, field-validation quality, and
  the trust-tier ceiling in effect at that moment. It is a frozen
  snapshot, not a live-recalculated score. If the confidence *formula*
  itself changes later, re-scoring existing evidence under the new
  formula is a deliberate act that produces new evidence referencing the
  old (via lineage), never a silent rewrite of the stored value.

Conflating these two into one number was Phase 1's easiest trap to fall
into and this document forecloses it explicitly.

---

## 8. Verification States — A Third, Independent Axis

Distinct again from both trust and confidence, and from review status.
Review answers "did a human check the *extraction* was done correctly."
Verification answers a different question: "does this *claim* hold up
against other, independent evidence."

- **`unverified`** — the default. The claim stands on its source's
  strength alone.
- **`corroborated`** — an independent piece of evidence, sharing the
  same claim key, from a *different* source, agrees. This strengthens
  confidence in the claim without altering either original record.
- **`contradicted`** — an independent piece of evidence disagrees. This
  is a signal worth surfacing (to review, to the Learner Intelligence
  projection as a flagged uncertainty), not silently resolved by
  whichever record happens to be newer.
- **`externally_verified`** — confirmed against an authoritative outside
  system (e.g., a national assessment body), when such an integration
  exists. The strongest verification state, independent of trust tier or
  confidence.

Four axes — trust, confidence, review, verification — each answering a
different question. A design that collapses any two of them into one
field is a design that has quietly stopped being able to explain itself.

---

## 9. Audit History

Because an Evidence record's factual content is immutable (§3), its
audit history is exactly the ordered sequence of lifecycle transitions
it has undergone — nothing more needs to be reconstructed, because
nothing else ever changed. Each transition (`created`, `auto_confirmed`,
`routed_to_review`, `reviewed_confirmed`, `reviewed_rejected`,
`superseded`, `retracted`, `verification_updated`) is its own permanent
record: which evidence, what the transition was, who or what performed
it, when, and why (where a reason applies). This audit trail is not a
log file bolted onto the system for compliance — it *is* the mechanism
by which "how did this record get here" is answerable at all, for as
long as the platform exists.

---

## 10. Relationship to the Learner Intelligence Engine

The Learner Intelligence Engine never receives raw import data, and it
never receives anything below confirmed standing. It consumes exactly
one thing: the set of currently-standing Evidence (auto_confirmed or
reviewed_confirmed, not superseded, not retracted) for a learner, and
computes its projections — capability, risk, knowledge state,
engagement — from that set.

This has a strong, deliberate consequence: **Learner Intelligence state
must be reproducible by replaying a learner's confirmed Evidence
history.** Not as a disaster-recovery afterthought — as the normal
mechanism by which the engine's own logic evolves. When the scoring
logic itself improves, the correct response is to recompute the
projection from Evidence, not to write a one-off migration script that
patches already-derived state. Retraction (§2) works the same way: when
evidence is retracted, the Learner Intelligence projection for that
learner is recomputed from what remains — it is never hand-edited to
"back out" the retracted claim's effect.

This is what makes Evidence and Learner Intelligence genuinely two
first-class domains rather than one domain with an import feature bolted
onto it: Evidence is upstream and authoritative; Learner Intelligence is
downstream and derived, always reconstructible, never a second source of
truth.

---

## 11. Retention Policy and Privacy

Two distinct things are being retained, on two distinct schedules, and
conflating them was Phase 1's privacy gap:

- **The Evidence record** — the structured claim (subject, score,
  confidence, lifecycle, provenance pointers) — is retained for the
  learner's full educational lifetime plus a defined archival period. It
  is the historical record of their evidenced growth; it does not
  casually expire.
- **The raw artifact** behind a provenance pointer — the actual photo,
  PDF, or file — has its own, shorter, explicitly configured retention
  window. After that window, the artifact is purged. The Evidence record
  it produced is untouched; its provenance pointer becomes a reference
  to something that once existed, honestly marked as no longer
  retrievable, rather than either a dangling lie or a reason to delete
  the evidence itself.

This resolves the tension the prior review found: traceability requires
permanent custody of the *evidence*, never permanent custody of the
*raw file* behind it. Extracted personal-identity fields (a name as it
appeared in a raw source, before resolution to a learner) are a policy
lever within this same frame — potentially minimized on a shorter
schedule than the evidence record itself once identity has been
resolved — but the exact tradeoff is a privacy/legal policy decision,
not an architectural one, and this document deliberately leaves it as a
named, explicit decision point rather than defaulting it silently.

---

## 12. Invariants — What Every Implementation Must Obey

1. Every Evidence record has a permanent, unique identity, assigned at
   creation, never reused.
2. Evidence factual content is immutable. Only lifecycle-state fields
   change, and only via a recorded transition.
3. Evidence is never deleted. Rejected, retracted, and superseded
   records remain permanently queryable.
4. A correction is always new Evidence superseding old Evidence — never
   an edit.
5. Every Evidence record traces to exactly one Ingestion Run (lineage)
   and one raw input reference (provenance).
6. Confidence is a frozen snapshot, computed once, under the trust tier
   and formula version in effect at creation. Re-scoring produces new
   evidence, never rewrites the old value.
7. Trust tier is a property of source type, revisable only
   prospectively — never retroactive.
8. Trust, confidence, review status, and verification status are four
   independent axes. None may be conflated into another.
9. The Learner Intelligence Engine consumes only currently-standing
   confirmed evidence, and its state must be reproducible by replaying
   that evidence — it is a projection, not a second source of truth.
10. Raw artifacts may expire on a defined retention window. The
    structured evidence record they produced does not.

A design is faithful to this domain model if and only if all ten hold.
An implementation that satisfies nine of these while violating the
tenth has not built a smaller version of this model — it has built a
different, weaker one.
