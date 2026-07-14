# EduNexus Architecture Review — Final Pre-Implementation Challenge

Status: FINAL REVIEW, requested against the frozen architecture in
[learner-record-layer-decisions.md](learner-record-layer-decisions.md).
Every finding below is either a genuine new discovery from re-reading the
live schema and projector code this pass, or an explicit confirmation
that a previously-decided item holds. Nothing already settled in the
Decisions document is reopened unless a new, concrete defect is shown.

---

## 1. Domain Boundaries

**Mostly correct.** Evidence → Projection → Reasoning → Recommendation as
an architectural *tier* ordering is sound and matches what's live.

**One real boundary risk**: Decision 6 names "Reasoning" as a single
layer, but its own first citizen (`capabilityExtractor.ts`, capability
interpretation) and the two things named alongside it (career matching in
`careerIntelligenceEngine.ts`, gap-detection in `remedial/planner.ts`)
don't share a ubiquitous language — capability scoring, career-market
fit, and prerequisite-gap detection are three different domain
vocabularies that happen to sit at the same *tier*, not one bounded
context. Naming them all "the Reasoning layer" risks a future engineer
forcing them into one shared interface because the name implies unity.
**This is a documentation-precision issue, not a code defect** — cheap to
fix by stating explicitly that Reasoning is a tier containing multiple
independent reasoning contexts, not one context. Medium severity only
because the cost of getting this wrong is "an awkward forced merge
someday," not data loss.

**A second, sharper boundary problem**: the School Integration Pipeline
(Core-native: `school_integrations` → Core `learners`/`classes`) and the
Evidence Domain (legacy-native: `learner_evidence.learner_id` = legacy
`students.id`, per Decision 3) are **two different identity bounded
contexts that have never been reconciled**. This isn't new — Decision 3
named it — but this review sharpens the consequence directly against a
goal this brief explicitly asks about (§5 below): **a school cannot
today adopt "only the Intelligence Layer"** while keeping their own
SIS/LMS, because the pipeline built to receive their data (Core) and the
pipeline that turns data into intelligence (Evidence, legacy-keyed) don't
share an identity system yet. Not a flaw in either design — a real seam
between two correct designs that hasn't been bridged, worth stating
plainly rather than implying "integration works" when it doesn't yet for
this specific case.

---

## 2. Data Longevity

**The append-only/supersession pattern itself will age well** — this is
the strongest part of the architecture and nothing here changes that
assessment. Three concrete longevity problems found this pass, all schema
gaps, all cheap now and expensive after real data accumulates:

- **No erasure lifecycle state.** See §8/Critical below — the single
  most important finding in this review.
- **No school-identity snapshot at evidence-write-time.** See §8/High
  below.
- **`term` is CHECK-constrained to `1..3`** (`learner_evidence`,
  `class_assessments` both), hardcoding Kenya's three-term calendar into
  the schema. This is real technical debt for the explicitly-stated
  "multiple countries" goal, but it's inherited platform-wide (Zod
  enums, UI labels, and CHECK constraints across dozens of files, not
  something the Evidence Domain introduced or can fix alone) and cheap
  in isolation — Evidence's own `claimKey()` doesn't interpret `term`,
  it just compares it, so relaxing the constraint later doesn't require
  touching Evidence logic. **Medium severity, worth naming as tracked
  platform debt, not urgent for this initiative specifically.**

---

## 3. Evidence Model

**Can absorb every realistic event named in this brief** — competitions,
portfolios, co-curricular records, AI tutor interactions all fit the
existing `EvidenceSource` + `payload jsonb` pattern (Decision 1) without
new tables. Nothing here feels forced.

**One real gap in Decision 1's design, not yet shipped, cheap to fix
before it is**: the `payload jsonb` column has **no schema-version tag**.
Over a 20-year horizon, with team turnover and evolving product
requirements, the shape written into a narrative/attendance/behaviour
payload will drift — a `{ kind: 'remark', body }` today might become
`{ kind: 'remark', body, sentiment, tags }` in three years, written by
code nobody who wrote the original shape still maintains. Without a
version marker, a future migration or bulk-read has no reliable way to
know which shape a given historical row uses short of runtime shape
detection (fragile) or exhaustive backfill inspection (expensive at
millions of rows). **Fix**: add `payload_version: string` inside every
payload object now, before the first row ships. Trivial now, real cost
to retrofit onto years of unversioned historical `jsonb` blobs later.

---

## 4. Intelligence Pipeline

**Directionally clean — no code found where Reasoning or Recommendation
writes back into Evidence structurally.** The pipeline's data flow is a
real DAG, not a cycle, at the architecture level.

**But a real, currently-live gap changes this assessment materially**:
read `lib/projection/capabilityProjector.ts` directly — it selects
**"latest confirmed evidence per subject," with no trust-tier weighting
on the value it computes.** Confidence (a separate metadata field, per
`coverage.ts`) is discounted for low-trust sources, but the *headline
capability level itself* is not — a single `compass_session` evidence
row (trust tier 1, "AI-inferred... never equated with human-verified
evidence" per the Evidence Domain's own stated rule) can silently become
a learner's displayed "current capability" for a subject, overriding an
older but higher-trust `teacher_upload` exam result, purely because it's
more recent. This is a **present-day correctness gap**, not a
hypothetical one, and it directly undermines the platform's core promise
("never discover problems too late") if a low-trust signal masks a
higher-trust one that actually reflects the learner's real state.

This also **sharpens the feedback-loop risk** the brief asks about:
Recommendation → Compass session (AI-driven) → new `compass_session`
evidence → Projection recompute → next Recommendation. Because that new
evidence isn't trust-discounted at the *value* level, a self-reinforcing
loop is architecturally possible — the system's own recommendations
could quietly bias what "current capability" looks like over years of
compounding, without any single component doing anything individually
wrong. **This is the kind of five-years-later regret the brief is asking
to be found before it's baked into ten million learners' histories.**

---

## 5. School Integration

**Direct answers to the three questions asked:**

- *Can schools with existing SIS/LMS integrate without losing identity?*
  Yes, for roster/class data (School Integration Pipeline's design is
  sound and Core-native with proper `external_id` idempotency).
- *Does the architecture respect school ownership?* Yes — teacher
  attribution-not-ownership (Decision confirmed, structurally enforced)
  and the recommendation to keep `evidence_purposes` platform-governed
  rather than school-editable (§8) both protect this correctly.
- *Can schools adopt only the Intelligence Layer?* **Not yet, concretely
  — see §1's boundary finding.** Evidence identity and Integration
  Pipeline identity are different contexts today. This is not a defect
  in either design; it's an honest "no" that should be stated rather
  than assumed answered.

---

## 6. Performance

**No new urgent finding — the per-learner recompute cost flagged in the
prior review still stands and is still bounded/acceptable** (a K-12
career accumulates hundreds, not millions, of evidence rows).

**One longevity-adjacent note worth naming, not acting on**:
`learner_evidence` and `evidence_audit_log` (which grows faster — 2+
audit events per evidence row, confirmed in `evidenceLifecycle.ts`) have
no stated partitioning strategy. At thousands of schools this is a
real future table-size concern, but premature to design now — the right
move is naming a concrete trigger ("consider partitioning
`evidence_audit_log` by year once it exceeds ~50M rows") rather than
building partitioning infrastructure nobody needs yet.

---

## 7. Future Products

Attendance, behaviour, competitions, co-curricular records, portfolios,
and AI tutor interactions all fit the existing model (§3). Two genuine
gaps for the *other* named products:

- **University readiness / scholarship tracking / employment outcomes /
  alumni records all assume a learner whose record continues to matter
  after they leave the K-12 pipeline** — and the legacy `students` table
  (which Evidence is keyed to, per Decision 3) **has no status or
  graduation concept at all.** Core's `learners` table already solved
  this (`status`, `graduation_date` columns exist there today) — legacy
  never got the equivalent. Without it, there's no clean way to mark "this
  learner has graduated, their record is now an alumni record" versus
  simply having stale data from a student who stopped appearing in any
  class roster. **Cheap fix now** (mirror Core's existing, already-proven
  design: add `status`/`graduated_at` to `students`), **real cost later**
  (retroactively determining which historical students actually graduated
  versus transferred versus were data-entry noise, once nobody remembers).

---

## 8. Architectural Smells — Consolidated

| Smell category | Finding | Severity | Likelihood | Cost now | Cost later | Action |
|---|---|---|---|---|---|---|
| **Migration trap / legal risk** | No `erased` lifecycle state exists for right-to-erasure requests — Evidence Domain's invariant is "never delete." In direct tension with data-protection law (Kenya's Data Protection Act 2019 and equivalents) the moment a real erasure request arrives, in any of the "multiple countries" this platform explicitly targets. | **Critical** | Medium-High over 20 years | Low — add an `erased` lifecycle_state + a defined PII-purge-with-tombstone pattern (keep the row's id/audit chain intact for referential integrity, null out `extracted_name`/`score`/`payload`) before implementation | Very high — retrofitting erasure onto a system whose culture and downstream consumers have spent years assuming "immutable forever" as a hard invariant, potentially under legal deadline pressure | **Fix before implementation begins — the one item in this review that should actually block "frozen" status as currently specified.** |
| **Incorrect source-of-truth / identity** | `learner_evidence` has no snapshotted `school_id`. School context is only derivable transitively via `teacher_id → teachers.school` (free text, mutable) at *read* time, not captured at *write* time. `holiday_plans` already has `school_id`; this table doesn't — an inconsistency, not a deliberate choice. | High | Medium-High (teacher school-field corrections, transfers, onboarding cleanup over 20 years) | Low — add nullable `school_id`/`school_name_snapshot`, captured at evidence-creation time | High — historical school attribution becomes silently and permanently wrong once the mutable source has changed; not a hard migration, an **unrecoverable data loss** of "which school was this evidence really created at" | Add the snapshot column now, before real volume accumulates. |
| **Identity problem** | Legacy `students` has no stable, school-independent identity anchor (no NEMIS UPI-equivalent field — Core `learners.upi` already has this, legacy doesn't). Evidence is permanently keyed to `students.id`, which is really an *enrollment* identity, not a *person* identity. | High | Medium-High, directly for two named 20-year goals (learner transfers between schools, government reporting/longitudinal research needing a person-stable ID) | Low — reserve a nullable person-level identifier field now, even unpopulated | High — reconciling "these three `students` rows across two schools over eight years are actually one person" after millions of evidence rows already exist tied to the wrong granularity of ID | Reserve the field now; population/resolution logic can wait for real transfer cases in the pilot. |
| **Hidden feedback loop / eventual bias** | Recommendation-driven Compass sessions become Evidence with no trust-tier discount at the *value* level (§4) — a self-reinforcing loop is architecturally possible over years of AI-driven practice dominating a learner's evidence mix. | High | Medium, grows with Compass adoption specifically | Moderate — add trust-tier-aware selection (not full schema change, a projector logic fix) to `capabilityProjector` | High — explaining a discovered systemic bias to schools after years of accumulated projections, and recomputing history | Fix the projector's selection rule before broad Compass rollout, not necessarily before pilot (low current volume bounds current risk). |
| **Schema smell** | `payload jsonb` has no version tag (§3). | Medium-High | High (drift is close to guaranteed at 20-year/team-turnover horizon) | Trivial — add `payload_version` to Decision 1 now | Moderate-High — undocumented historical shape drift, fragile runtime detection | Add before Phase C ships. |
| **Missing abstraction** | No alumni/graduated status on legacy `students` (§7), despite Core already having solved this exact problem. | Medium-High | Medium (matters once alumni features are prioritized) | Low — mirror Core's existing field design | Moderate — retroactive status determination | Add now; costs nothing to have an unused nullable column. |
| **Governance gap** | `evidence_purposes` (Decision 2) is described as "admin-extendable" with no stated governance model — could become either an EduNexus bottleneck or, if opened to schools, an ungoverned mess that defeats the cross-school comparability it exists for. | Medium | Medium | Trivial — state explicitly: platform-governed only, never school-editable; add an optional `region` column if country-level variation is ever needed | Moderate — governance chaos is hard to walk back once thousands of schools have accumulated their own divergent purpose lists | Clarify in Decision 2 now. |
| **Eventual consistency** | `evidence_projection_events` outbox + cron drain means a real window exists where Evidence is confirmed but Projection hasn't caught up. Not inspected for an SLA. | Low-Medium | Low | — | — | Confirm the cron's frequency/backlog-alerting is monitored once live; not a design defect, an operational one. |
| **Read/write asymmetry** | Already correctly flagged in the prior review (full-history replay per learner) — still accurate, still bounded, no new information this pass. | Low today | Low today, rising with scale | — | — | No new action; the previously-named partitioning trigger (§6) is the eventual mitigation. |

**Explicitly confirmed as already architecturally correct, no new
concern**: Evidence immutability/supersession design, Projection Engine's
actual decoupling (verified again by re-reading its imports), teacher
attribution-not-ownership, the capability-store consolidation (Phase H),
and the source-agnostic writer pattern for absorbing new evidence types.
Nothing here should be redesigned.

---

## Final Verdict

### 1. Architecture Strengths

The Evidence Domain is genuinely event-sourced — immutable, audited,
replayable from a log, with a real outbox pattern — not a system that
merely resembles one. The Projection Engine is cleanly decoupled from
every feature module, confirmed by directly reading its imports, not
assumed. The write path (nine live evidence sources, soon a tenth)
proves the architecture actually absorbs new event types without schema
churn — this isn't a claim, it's already been done nine times. Teacher
attribution-not-ownership is enforced structurally, not by convention.
The plan to close the three parallel capability stores (Phase H) is a
real, correctly-scoped fix, not a cosmetic one. The read-path guardrail
(Decision 5) is the right preventative fix at the right time — before
more consumers exist to bypass Projection, not after.

### 2. Architectural Risks

In descending severity: (1) **no erasure lifecycle state** — a legal
exposure risk for a platform targeting multiple countries, Critical; (2)
**no school-identity snapshot on Evidence** — silent, unrecoverable
historical corruption risk via a mutable free-text indirection, High;
(3) **no person-level identity anchor on legacy learner identity** —
blocks the "learner survives school transfer" promise at real scale,
High; (4) **capability projection has no trust-tier weighting on its
headline value**, creating both a present-day correctness gap and a
long-horizon self-reinforcing bias risk, High; (5) **`payload jsonb` has
no version tag**, a near-certain drift risk over 20 years, Medium-High;
(6) **no alumni/graduated status on legacy learner identity**, blocking
a named 20-year goal, Medium-High; (7) **`evidence_purposes` governance
unspecified**, Medium; (8) **`term` hardcoded to Kenya's 3-term calendar**,
Medium but largely inherited, pre-existing platform debt; (9) **"Reasoning"
named as one tier risks being read as one bounded context**, Medium,
documentation-only fix.

### 3. Decisions I Would Keep Forever

Evidence immutability and supersession-over-mutation. The Evidence/
Projection separation and the principle that Projection is the only
sanctioned read path for learner intelligence state. Teacher attribution
rather than ownership as a structural (not conventional) rule. The
legacy-first pilot strategy, correctly time-boxed to a named future
trigger rather than left open-ended. The capability-store consolidation.
The source-agnostic thin-writer pattern for onboarding new evidence
types.

### 4. Decisions I Would Reconsider Before Implementation

Not a request to redesign anything already frozen — these are additions,
all schema-additive, none requiring rework of a single decision already
made: (1) add an `erased` lifecycle state and a PII-purge/tombstone
pattern to the Evidence Domain Model before implementation begins — this
is the one item that should genuinely gate "frozen" status as currently
written; (2) add a `school_id` snapshot to `learner_evidence`, captured at
write time; (3) reserve a nullable person-level identity field on
`students` now, even unpopulated; (4) add `payload_version` to Decision
1's jsonb design; (5) add `status`/`graduated_at` to legacy `students`,
mirroring Core's already-proven design; (6) fix `capabilityProjector`'s
value-selection rule to account for trust tier, not only confidence,
before Compass usage scales — this can follow slightly behind the
schema additions since it's a code change, not a migration; (7) state
`evidence_purposes`'s governance model explicitly; (8) clarify in
documentation that "Reasoning" names a tier, not a single bounded
context.

### 5. Final Confidence Score: 78/100

The foundation — Evidence, Projection, the guardrails, the consolidation
work already planned — is genuinely sound and would score in the low
90s on its own. The deduction is concentrated almost entirely in one
place: **an unaddressed erasure/legal-compliance gap that is cheap to
close now and would be a genuine five-years-later regret if it isn't** —
plus a small cluster of identity/attribution gaps (school snapshot,
person-level ID, alumni status) that share the same shape: schema-additive,
low-cost today, unrecoverable-data-loss expensive after real volume
accumulates. None of these require reopening anything already decided.
**After the seven additions in Section 4 — all additive, none requiring
rework — this architecture would score 92+ and be genuinely ready to
serve as EduNexus's permanent foundation.** As specified right now, it is
not quite there, specifically because of item (1).
