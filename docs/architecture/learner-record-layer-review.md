# Architecture Review — The Learner Record Layer

Status: REVIEW — every open question raised here is now resolved in
[Learner Record Layer — Final Architecture Decisions](learner-record-layer-decisions.md).
This document remains as the reasoning/evidence trail for those
decisions — read the Decisions document first for the settled answers.

Critical evaluation of
[learner-record-layer.md](learner-record-layer.md) and
[academic-evidence-layer.md](academic-evidence-layer.md) against the
live codebase, requested and framed as a Principal Architect / DDD / Event
Sourcing / CQRS review. Findings below are grounded in code read this
session (`lib/projection/`, `lib/adaptiveLearning/recommend.ts`,
`lib/career/careerIntelligenceEngine.ts`, `lib/career/capabilityExtractor.ts`,
`lib/remedial/planner.ts`, `migration-ledger.md`, `app/api/assessments/create/route.ts`),
not re-asserted from the documents under review. Design-only, same as the
documents it reviews — no schema or code changes authorized here.

**Headline finding, stated up front because it changes how to read
everything below**: the Learner Record Layer document answered "is
Evidence a real single source of truth" by checking the *write side*
(are there evidence tables, do writers exist) and found yes. It did not
check the *read side* — do all consumers actually read only through
Projection, with no bespoke bypass. They don't. That gap is this review's
main contribution.

---

## 1. Does this architecture truly establish a single source of truth for every learner?

**No — not yet, and this is worse than "not yet migrated," it's
"actively, deliberately not migrated" in three confirmed places:**

1. **The `assessments` table (89 rows) never reaches Evidence at all.**
   `migration-ledger.md`'s "Implementation Wave 3" note confirms this
   route "still does not emit an Evidence Domain row" and calls extending
   it "a deliberate future decision... not done." This is the
   parent-facing "Academic Clinic" intake path — a second, live source of
   assessment truth for the same learners the gradebook (`learner_marks`
   → Evidence) already covers, sitting entirely outside the domain this
   review is evaluating.
2. **Three independent capability stores exist simultaneously today**:
   `learner_profiles.capability_dimensions` (legacy), `students.capability_profile`
   (a JSON snapshot, recomputed by `recomputeAndSaveCapabilityProfile()`,
   called fire-and-forget from `app/api/assessments/create/route.ts:99`
   on every Academic Clinic submission), and `learner_projections`'
   `capabilityProjector` output (the "real" Projection Engine value). Three
   consumers can legitimately disagree about one learner's capability
   profile right now, and none of them is wrong per their own contract —
   they're just genuinely different stores nobody has unified.
3. **`clinicReportBuilder.ts` and `academicClinic/reportGenerator.ts`** are,
   per `migration-ledger.md`'s own "Reporting Sprint 3" section, "a third,
   fully independent report pipeline... live in production," with an
   explicit decision recorded as "audit stands, no code changes this
   sprint" — with **no stated trigger for when that changes**. An accepted
   exception without a revisit condition tends to become permanent by
   default, not by decision.

**Verdict**: single source of truth is real and enforced for the write
path of *migrated* consumers (Blueprint, Career Intelligence, Parent
Pulse, Holiday Planner — all genuinely Projection-only, per the Ledger).
It is not true "for every learner" or "for every product" — three
concrete, currently-running exceptions exist, are documented, and were
each a deliberate scoping call in their own sprint. The Learner Record
Layer document didn't surface any of them, because it was scoped to
"does an Evidence table exist," not "does everything actually flow
through it."

---

## 2. Hidden parallel data models / future duplication risk

Beyond the three in §1, one structural risk that will keep recreating
this pattern if unaddressed:

**Nothing stops a new consumer from reading `learner_evidence` or
`learner_profiles` directly instead of going through
`recomputeLearnerProjection()`.** There is no repository-level, RLS-level,
or lint-level guardrail — the discipline is currently 100% social (a
sprint's own author choosing to call `recompute.ts`). Every migration
recorded in the Ledger was a *person* deciding to route through
Projection; nothing in the architecture *requires* it. At 500 schools and
dozens of future products, relying on every future engineer independently
rediscovering "always go through Projection" is the exact mechanism that
produced the three exceptions in §1 in the first place — each was
presumably also built by someone who, at the time, had a reason to take
the direct path.

**Projection V2 is itself a live instance of this risk, already
happening**: `recompute.ts:20-23` computes `capabilityV2`/`trendV2`/`knowledgeV2`
in memory on every call but **does not persist them** — "no downstream
code reads a persisted V2 row today." This is a second parallel
computation quietly running inside the *same function* that's supposed to
be the single source of truth, not reachable by anything yet, which is
either dead code or a store waiting for its first (unplanned) consumer.

**Recommendation**: an explicit architectural rule, enforced somewhere
firmer than a comment — e.g., `evidence.repository.ts`'s learner-scoped
read methods (`findByLearner`, `findConfirmedEvidenceForLearner`) become
internal-only (not exported from `lib/repositories/index.ts`'s public
surface, or wrapped with a lint rule / import-boundary check) so that a
new product literally cannot compile a direct read without going through
`lib/projection/recompute.ts`. Cheap, prevents the recreation of §1's
pattern a fourth time.

---

## 3. Does the Assessment Purpose model correctly separate terminology from meaning?

**Directionally right, two real problems with the specific design in
`learner-record-layer.md` §3:**

1. **A native Postgres `ENUM` is the wrong storage choice for a concept
   the document itself frames as "the moment a school defines a new type,
   it needs somewhere to map."** Adding a value to a Postgres enum
   (`ALTER TYPE ... ADD VALUE`) is a real migration, can't run inside a
   transaction with other DDL in older Postgres, and can't be removed
   without recreating the type. This project already runs three regional
   curriculum adapters (`ke-cbc`, `tz-necta`, `ug-ncdc` — from
   `intelligence-ingestion-engine.md`'s audit) with the explicit intent to
   support more countries. A fixed five-value enum is a bet that
   "diagnostic/formative/summative/practice/practical" is culturally and
   pedagogically universal across every curriculum EduNexus will ever
   support — a bet with no stated justification. **A small lookup table**
   (`assessment_purposes`, platform-seeded, admin-extendable) gets the
   same "small, canonical, not school-configurable" property this design
   wants, without the migration cost every time it needs a sixth value.
2. **Purpose is scoped only to assessment-shaped evidence** — it doesn't
   exist as a concept for `teacher_remark`, `parent_observation`,
   `holiday_return`, etc. If "educational meaning independent of surface
   label" is the actual principle (and the sprint brief frames it that
   broadly — "It should understand educational meaning instead"), scoping
   it to one `EvidenceSource` subtype is narrower than the stated goal
   and will likely need generalizing the first time a non-assessment
   source needs the same treatment (e.g., is a teacher remark
   "formative" or "diagnostic" in intent? Today, no way to say). Worth
   deciding now whether `purpose` is an assessment-specific field or a
   general Evidence classification axis — retrofitting it onto nine
   already-shipped evidence sources later is more expensive than scoping
   it correctly once.

---

## 4. Is treating Teacher Remarks as Evidence the cleanest long-term design?

**Cleaner than a standalone table (§4 of `learner-record-layer.md` was
right to reject that) — but the specific mechanism (cram a narrative
claim into the same row shape as a scored claim) has a real cost that
should be named, not just accepted.**

`learner_evidence`'s columns — `score`, `cbc_level`, `subject`,
`raw_subject`, `strand`, `sub_strand`, `knowledge_node_id` — are shaped
around *measured* claims. A remark has none of these meaningfully; every
one of them goes `NULL`. This is the first non-scored evidence source;
attendance and behaviour (already named as future candidates in §5 of the
same document) would be the second and third, each adding its own
mostly-`NULL` column set to the same row (`present: boolean`?
`incident_severity`?). **This is the classic "wide nullable table"
trajectory** — fine at one exception, a real schema smell by three or
four.

The `claimKey()` carve-out (`if source === 'teacher_remark' return null`)
has the same shape of problem one level up: it's a source-specific
special case bolted onto a function whose contract ("evidence sharing a
claim key supersedes") was designed for scored claims. The moment
attendance or behaviour needs *their own* different supersession
semantics (does a second "present" record for the same day supersede the
first, or are both facts? — a different question than remarks'), the same
function accumulates a second `if (source === X)` branch. Two carve-outs
is a pattern; a pattern deserves a named concept, not two special cases.

**Recommendation, not a redesign demand**: this is a real fork worth
deciding deliberately, not defaulting into by accretion:
- **(a) Accept it as-is for `teacher_remark` now** (cheap, ships fast, the
  document's own reasoning holds for exactly one non-scored source), but
  **write down explicitly** that the second non-scored source triggers a
  design review of the envelope/payload split below — so it's a planned
  decision point, not a "we'll notice when it hurts" default.
- **(b) Split now**: keep `learner_evidence` as the universal *envelope*
  (id, learner_id, source, trust_tier, confidence, lifecycle_state, audit
  — the fields every evidence record needs regardless of shape) and move
  shape-specific payload fields (`score`/`cbc_level`/`subject` for
  measured evidence; `body` for narrative evidence) into a discriminated
  detail — either a `payload jsonb` column read/written through
  source-specific TypeScript types, or two child tables. This is more
  DDD-correct (Evidence as an aggregate root with a variant payload) and
  scales cleanly to attendance/behaviour without schema churn each time,
  at the cost of touching working code now, pre-pilot.

Given the operating charter (pilot-first, minimal change), (a) is the
right call *for this pilot* — but only if the decision point is written
down somewhere durable (this document), so it isn't silently deferred
forever the way the Academic Clinic exception in §1 was.

---

## 5. Is the Projection Engine sufficiently decoupled from feature modules?

**The engine itself: yes, genuinely.** Verified by reading
`lib/projection/recompute.ts` directly — its only imports are
`lib/repositories` and its own sibling files (`engine.ts`, `types.ts`).
No `lib/career/`, `lib/blueprint/`, `lib/remedial/`, or any feature-owned
module is imported anywhere in `lib/projection/`. This is real,
deliberate, and matches what a projection/read-model layer should look
like — this is the strongest part of the whole architecture.

**The ecosystem around it is a different story, and this is worth
separating clearly**: `careerIntelligenceEngine.ts` reaches back into
`lib/career/capabilityExtractor.ts` — a **feature-owned** module — via a
shim (`projectionToScoreHistory`, `lib/learnerIntelligence/projectionAdapters.ts`)
explicitly commented as "temporary... retire the moment
`capabilityExtractor.ts` is retired or rewritten." **This exists because
Projection V1.0 doesn't compute the 6-dimension capability breakdown
several consumers need** (documented in the Ledger's "Known gaps"
section). So: Projection is decoupled *in isolation*, but five consumers
are structurally forced back into a feature-owned reasoning function
specifically because Projection is incomplete for their needs. That's a
capability gap wearing a "temporary shim" costume — it will look
permanent the moment the pilot's actual usage doesn't happen to demand
the missing dimensions urgently enough to prioritize closing them.

---

## 6. Separation between Evidence / Projection / Reasoning / Recommendation

| Layer | State |
|---|---|
| **Evidence** | Real, single, well-bounded (with §1's three exceptions). |
| **Projection** | Real, single, cleanly decoupled (§5), with three documented capability gaps that are the root cause of most of what follows. |
| **Reasoning** | **Not a named layer — exists de facto, twice, uncoordinated.** (1) `capabilityExtractor.ts`'s `extractCapabilityProfile()`, shared by 5 consumers via the shim — this is *already* a de facto shared Reasoning function, just organized as "legacy code being bridged," not "the Reasoning layer." (2) Bespoke, per-product reasoning baked directly into feature modules: `careerIntelligenceEngine.ts`'s matching logic, `remedial/planner.ts`'s gap-detection, `blueprint.ts`'s own interpretation of Projection output. Nothing here is shared; each product re-derives "what does this evidence mean" independently. |
| **Recommendation** | **Partially named, not unified.** `lib/adaptiveLearning/recommend.ts` explicitly self-documents as "The Recommendation Layer" — real progress, a named architectural concept exists. But its own doc-comment states it deliberately does *not* call `remedial/planner.ts`'s `generateRemedialPlan()`, because that function still sources via legacy `learner_profiles` reads. **Two non-unified recommendation surfaces exist today, by documented design, not oversight**: one Projection-pure (`recommend.ts`, feeding Holiday Journey/Printable Pack/Classroom Differentiation/Parent Delivery) and one legacy-sourced (Remedial Planner's own grouping + intervention logic). |

**This table is the single most important artifact in this review** — it
shows the four-layer separation the sprint brief asks about is real for
two layers, aspirational-but-unnamed for a third, and half-built for the
fourth, and every gap traces back to the same root cause: **Projection
V1.0 doesn't yet compute what several consumers need**, so they route
around it, and each routes around it differently.

---

## 7. Should a dedicated Reasoning Layer become an explicit architectural component?

**Yes — and the right move is promotion, not invention.** The evidence
above shows a Reasoning layer already exists in embryo:
`capabilityExtractor.ts` is functionally the shared Reasoning function
for capability interpretation, used by five consumers, today. It's just
mis-classified as "legacy code temporarily bridged" rather than
"first-class architecture," which has a real consequence: nobody is
investing in it as permanent infrastructure (it's explicitly "tracked for
removal"), so its quality, test coverage, and design get whatever
attention "code we're about to delete" gets, while in practice it's the
single most-reused piece of interpretation logic in the intelligence
stack.

**Concretely**: don't build a new Reasoning module from scratch. Instead:
1. Rename the conversation about `capabilityExtractor.ts` from "temporary
   shim to retire" to "the Reasoning layer's first citizen, currently
   fed via an adapter because Projection V1.0 is incomplete." Same code,
   different intent — this changes whether its next contributor treats it
   as disposable or as the thing to build on.
2. Give Reasoning the same treatment `recommend.ts` already got for
   Recommendation: one file (or small module) with a doc-comment stating
   its contract ("the one place learner evidence/projection state becomes
   an interpreted signal — nothing downstream computes its own version"),
   even before every consumer is migrated to call it.
3. Fold Remedial Planner's gap-detection and Career Intelligence's
   matching logic under this same conceptual boundary over time — not
   necessarily one file, but one documented rule, mirroring how
   `recommend.ts`'s own comment already states "every channel... consumes
   this module's output; none computes its own version."

---

## 8. Does this still feel elegant at 500 schools / millions of evidence records / dozens of products?

**The Evidence→Projection split is genuinely the right foundation for
this scale** — immutable append-only facts, a pure recomputation
function, an outbox for async projection — this is real event-sourcing
discipline (see §9), and event-sourced systems are precisely the ones
that tend to still make sense at 100x the data. Specific risks worth
naming before they're invisible at pilot scale and painful at 500-school
scale:

- **`recomputeLearnerProjection()` reloads a learner's *entire* confirmed
  evidence history on every call** (`recompute.ts:54`,
  `findConfirmedEvidenceForLearner`). Per-learner this is bounded (a
  student accumulates hundreds, not millions, of evidence rows over a
  K-12 career) — fine. But there's no stated policy for what happens when
  it isn't bounded (a very active Compass user, or a school with daily
  attendance evidence once §5 of `learner-record-layer.md` gets built) —
  worth a stated ceiling or a snapshotting strategy *before* it's needed,
  not after a slow query shows up in production.
- **Nine (soon ten, per §4) near-identical writer files** — flagged in
  the prior review, still true, still fine at this count, still worth a
  named trigger ("collapse into one generic `recordEvidence()` helper
  once source count exceeds ~15") rather than an open-ended "someday."
- **`learner_evidence.learner_id` is legacy `students.id`, not Core
  `learners.id`** — the entire Evidence Domain is built on the
  Legacy-first pilot decision (`data-migration-strategy.md`). At 500
  schools, is Evidence still keyed to legacy identity, or does it migrate
  to Core? **Neither document under review answers this** — it's the
  single biggest open question for "does this still feel elegant at
  scale," and it's currently unaddressed, not merely deferred.
- **The Assessment Purpose enum** (§3) is a concrete instance of a
  general risk: fixed taxonomies chosen for one country's curriculum
  patterns tend to need revision the moment a second country's data
  arrives, and revision cost is proportional to how deeply the taxonomy
  is baked into storage (enum) vs. data (lookup table).

---

## 9. Which DDD / Event Sourcing / CQRS / Knowledge Graph principles should inform the next iteration?

- **Event Sourcing — already substantially present, not yet named as
  such.** `learner_evidence` (immutable, append-only, supersession instead
  of update) plus `evidence_projection_events` (an outbox/event log) plus
  `recompute.ts` (a pure, idempotent projector that rebuilds state from
  the log) *is* an event-sourced system in every load-bearing sense.
  Naming it explicitly in architecture docs would help future engineers
  recognize the pattern instead of rediscovering its rules by trial —
  e.g., "never mutate a confirmed evidence row" is currently enforced by
  convention across nine files, not by one documented, named principle
  everyone learns once.
- **CQRS — implicitly present, worth making structural.**
  `evidence.repository.ts` (write path) and `projection.repository.ts`
  (read path) are already separate. The architecture would benefit from
  treating this as a declared boundary — e.g., API routes serving reads
  should only ever import the projection repository, never the evidence
  repository directly, which is exactly the guardrail proposed in §2.
- **DDD — Anti-Corruption Layer is the right name for what
  `projectionToScoreHistory` already is.** It's not "a shim to delete," it's
  an ACL translating between the new Projection bounded context and the
  legacy `capabilityExtractor.ts` context — a completely standard,
  legitimate pattern for a system mid-migration. Naming it correctly
  changes its treatment: an ACL is *expected* to be temporary and is
  *supposed* to be deliberately isolated (which this one already is) —
  the fix isn't to feel bad about it existing, it's to have a clear
  condition for when the context on its far side (`capabilityExtractor.ts`)
  itself gets rewritten to speak Projection natively, retiring the ACL on
  schedule rather than "someday."
- **Knowledge Graph — under-leveraged relative to what's already
  modeled.** `learner_evidence.knowledge_node_id` already exists as a
  column, but per `data-migration-strategy.md` §1, `knowledge_nodes`/
  `knowledge_edges` are scoped to **Grade 7 Math only**. The
  "Concept Mastery"/"Knowledge Gaps" intelligence signals this sprint's
  brief asks for are fundamentally graph-traversal questions (what
  prerequisite chains does this evidence confirm or contradict) — the
  column to support this natively already exists and is already wired
  into the Evidence schema; the gap is curriculum-graph coverage, not
  architecture. This is a concrete, low-risk next step precisely because
  the schema already anticipated it.

---

## 10. If joining as Chief Architect today, what changes before another line of code?

In priority order, each chosen because it's cheap now and expensive
later:

1. **Put a revisit trigger on every "accepted exception," not just a
   record of the decision.** §1's three parallel models were each a
   reasonable call in their own sprint — the missing piece is a condition
   ("revisit when X happens") rather than an open-ended "no code changes
   this sprint." Retrofit this onto the existing Ledger entries, not just
   future ones.
2. **Add the read-path guardrail from §2** before a tenth or eleventh
   consumer gets built — this is the one change that prevents every other
   finding in this review from being rediscovered by a future team the
   same way it was found here (by grepping, not by architecture).
3. **Decide the Evidence envelope-vs-payload question (§4) on paper**
   before the second non-scored evidence source (after `teacher_remark`)
   ships — not before the first, that one's cheap either way, but the
   decision needs to exist before it's made by accretion.
4. **Reconsider `assessment_purpose` as a lookup table, not an enum**,
   and decide explicitly whether it's assessment-scoped or a general
   Evidence axis — before the migration in `learner-record-layer.md` §7
   is written, since this is free to fix now and a real migration to fix
   later.
5. **Rename, don't rebuild, the Reasoning layer** (§7) — promote
   `capabilityExtractor.ts` out of "temporary shim" status in
   documentation and intent, even before any code moves.
6. **Answer the Core-identity question from §8** — not because it needs
   solving now (Legacy-first for the pilot is still the right call per
   `data-migration-strategy.md`), but because "we haven't decided" is a
   different, more honest status than the current silence, and it's the
   one question that most determines whether this architecture is still
   elegant at 500 schools or needs a second migration nobody's planned
   for.

None of these require touching schema or shipping code before the pilot
observation window this sprint's own charter calls for. They're
documentation, naming, and one small guardrail — cheap precisely because
they're caught now.
