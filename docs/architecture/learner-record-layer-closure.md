# EduNexus — Architecture Closure & Transition to Implementation

Status: **CLOSURE AUDIT.** Architecture treated as frozen per
`learner-record-layer-signoff.md`. This document verifies internal
completeness across all seven prior documents and hands off to
implementation. It does not reopen, redesign, or search for new
architectural flaws.

---

## Verification Pass

Checked against the actual content of all seven documents, not against
memory of them — one real gap found and fixed as part of this closure
(below), everything else verified as consistent.

- **Every architectural decision maps to implementation work** — yes.
  Every Decision (1–8) in `learner-record-layer-decisions.md` and every
  ratified item in the sign-off has a stated schema or code destination.
- **No architectural contradiction remains** — verified. Nothing decided
  late (passes 5–8) reopened anything decided early (passes 1–4); every
  later document was additive to the one before it.
- **Migration phases align with implementation phases — they did not,
  until this audit.** The canonical roadmap table in
  `learner-record-layer-decisions.md` (written at pass 4) was never
  updated after passes 5 and 7 added four blocking schema items. A
  builder following that table alone would have missed all four. **Fixed
  as part of this closure**: added Phase -1 to that table, covering the
  erasure lifecycle state, `learner_evidence.school_id` snapshot,
  person-level identity anchor, and curriculum/scale-version anchor,
  ordered before Phase 0. The roadmap table is now the single place this
  sequencing lives — future changes belong there the same day they're
  decided, not only in the pass that found them.
- **Every deferred decision has an explicit trigger** — verified: Core
  identity migration (triggered by Learning Intelligence Migration
  Strategy Phase 5+), the Academic Clinic pipeline exception (triggered
  by submission-volume parity or a reported discrepancy), Projection
  V1.0's three capability/knowledge/duration gaps (triggered by real
  pilot usage evidence), attendance/behaviour/competitions evidence
  sources (triggered by a real school request). None are open-ended.
- **Every required schema change has a destination migration** —
  verified, now that Phase -1 exists in the roadmap table.
- **Terminology is consistent across documents** — verified with one
  rename tracked explicitly: `assessment_purpose` (pass 4's first draft)
  → `evidence_purposes` (pass 4's Decision 2, stated as a deliberate
  rename, not a silent drift). No other term found used two ways.
- **No document references obsolete decisions** — verified. The
  standalone `teacher_remarks` table (withdrawn at pass 4) and the
  `assessment_purpose` enum (withdrawn at pass 4) are both explicitly
  marked superseded in `learner-record-layer.md`'s own header, not just
  silently replaced.
- **Every permanent source of truth is uniquely defined — with one
  named, accepted exception.** Evidence is the unique source of fact;
  Projection is the unique source of derived state. The Academic Clinic
  pipeline (`assessments` table, `clinicReportBuilder.ts`) remains a
  second, live, accepted exception with its own trigger (above) — this
  is documented and intentional, not a gap this closure needs to fix,
  but it means "uniquely defined" is true for the Evidence/Projection
  system this initiative built, not true platform-wide yet.
- **Every derived state has a recomputation path** — verified:
  Projection via `recomputeLearnerProjection`; Reasoning
  (`capabilityExtractor.ts`) as a pure function of Projection's shape via
  the named adapter; Recommendation (`recommend.ts`) reads fresh
  Projection on every call.
- **Every irreversible decision is explicitly documented** — verified,
  now consolidated into Phase -1 of the roadmap table (previously spread
  across two separate documents with no single canonical list).
- **Every bounded context has clear ownership** — true by file-path
  convention (Evidence: `lib/intelligence/`, `lib/repositories/evidence.repository.ts`;
  Projection: `lib/projection/`; Reasoning: `lib/career/capabilityExtractor.ts`
  and its named siblings; Recommendation: `lib/adaptiveLearning/recommend.ts`),
  but **no single document states this mapping in one place** — listed
  below as documentation debt, since a new engineer currently has to
  infer it from seven documents rather than read it once.
- **Every architectural invariant is testable** — verified; the
  invariant list below states, for each one, what a test or lint rule
  would check.
- **Every architectural decision has an owner** — **not yet, and this is
  a real gap, not a false alarm.** No document assigns a human or team to
  any decision — reasonable for a single-architect design sprint, not
  reasonable for handoff to builders. Listed below as documentation debt.

---

## 1. Architecture Closure Report

**The architecture is internally complete**, with one inconsistency found
and fixed during this audit (the stale roadmap table) and one structural
gap that is process debt, not architecture debt (no named decision
owners — see below). Nothing found in this pass requires a new design
decision. Everything remaining is either documentation (make existing
knowledge easier to find) or engineering (build what's already decided).

---

## 2. Remaining Documentation Debt

Only documentation — none of these change what gets built.

- **A single bounded-context ownership map** — one table: context name,
  owning module path(s), one-sentence contract, in one document (or a
  new short section at the top of `learner-record-layer.md`). Currently
  reconstructable only by reading all seven documents.
- **Named decision owners** — even a placeholder ("Evidence Domain:
  [role/team TBD]") gives future readers something to update instead of
  a silent gap. Cheap, should happen before a second engineer joins.
- **A single canonical "must happen before Phase 0" list** — now fixed
  by this audit's Phase -1 addition to the roadmap table; no further
  action needed, noted here only to close the loop explicitly.
- **CLAUDE.md itself is not yet updated** with Decision 5's read-path
  rule or Decision 6's Reasoning-layer language — both are currently
  only in architecture docs, not in the file engineers are told to treat
  as override-level instruction. Cheap, should happen alongside Phase 0.

---

## 3. Remaining Engineering Debt

Only implementation work — none of this is a design decision.

- **Phase -1's four migrations** (erasure state, school_id snapshot,
  identity anchor, curriculum-version anchor) — not yet written, not yet
  applied. Nothing in this codebase implements them today; every pass in
  this series was design-only.
- **Phase 0's ESLint boundary rule** — config, not yet written.
- **Phases H, A, B, G, C, D, E, F** — each a real migration and/or code
  change, none started.
- **The non-blocking items accepted as recoverable risk** in the
  sign-off: `supersession_reason` field, a scheduled projection-version
  reconciliation job, `payload_version` inside the jsonb shape, bulk
  retraction tooling, `status`/`graduated_at` on legacy `students`. None
  gate Phase -1 or Phase 0; all are real backlog items.
- **A replay-determinism test** for `recomputeLearnerProjection` — the
  sign-off's entire confidence rests on Projection being reproducible;
  this should be the first automated test written, not assumed.

---

## 4. Suggested Order of Implementation

Ordering only — no phase's content is changed from what's already
decided.

1. **Phase -1** — the four foundational schema additions. Nothing else
   should start first; every later phase writes to tables this phase
   touches.
2. **A replay-determinism test for Projection**, written immediately
   after Phase -1, before any feature phase — validates the single fact
   the entire sign-off's confidence depends on, while the codebase is
   still small enough that a failure here is cheap to fix.
3. **Phase 0** — the read-path guardrail. Do this before Phase H, A, B,
   G, or C add any new consumer that could otherwise learn the wrong
   habit from day one.
4. **Phase H** — capability-store consolidation. No dependencies, closes
   an existing live inconsistency, and is a good first real feature
   phase precisely because it's subtractive (removes a duplicate) rather
   than additive (lower risk than introducing new surface area first).
5. **Phases A and B in parallel** — independent of each other and of
   everything after Phase -1.
6. **Phase G**, after B (depends on `assessment_types` existing).
7. **Phase C**, independent, can run alongside G.
8. **Phase D**, independent, can run any time after Phase 0.
9. **Phase E**, after A (needs `student_promotions` to have real rows to
   merge with the evidence timeline).
10. **Phase F and Reasoning promotion** — documentation-only, can happen
    any time, no reason to sequence them last except that they're truly
    zero-dependency and easy to forget once feature work starts.

---

## 5. First Week Checklist

If a new engineering team joined tomorrow, in order:

1. **Read `learner-record-layer-decisions.md`'s roadmap table first** —
   not any other document. It is now the single source of sequencing
   truth (this closure audit's fix).
2. **Write and apply Phase -1's four migrations.** Nothing else touches
   `learner_evidence` or `students` before this lands.
3. **Write the Projection replay-determinism test** — recompute a
   learner's projection twice from the same confirmed evidence set,
   assert identical output. This is the test that would have caught a
   real regression in the single property the sign-off's approval most
   depends on.
4. **Add the ESLint read-path boundary rule (Phase 0)** and the
   corresponding CLAUDE.md line — before writing any new consumer code,
   so the guardrail is live before there's anything to violate it.
5. **Implement Phase H** — the capability-store consolidation. Small,
   self-contained, subtractive, and a good first real PR for a team
   getting oriented in the codebase.
6. **Only then** start Phase A or B, whichever a real pilot need makes
   more urgent.

---

## 6. Architecture Invariants

Permanent engineering rules. Each is testable — how, stated alongside.

1. **Evidence rows are never mutated after creation**, except the
   specific lifecycle-transition fields (reviewer, reason, timestamps,
   supersession/retraction/erasure pointers). *Test: a repository-layer
   test asserting no code path issues an `UPDATE` touching `subject`,
   `score`, `cbc_level`, `payload`, or any other factual column.*
2. **No consumer reads `learner_evidence` or `learner_profiles` directly
   for intelligence purposes** — only `lib/projection/recompute.ts` may.
   *Test: the Phase 0 ESLint boundary rule, enforced at compile time.*
3. **`teacher_id` (or any actor id) on an evidence-producing row is
   attribution only, never a read-access gate.** *Test: a repository
   test asserting no learner-scoped read method accepts or filters by
   `teacherId`.*
4. **Corrections are new Evidence superseding old Evidence, never
   in-place edits.** *Test: existing `claimKey()`/`persistEvidenceBatch`
   behavior, already covered by `evidenceLifecycle.ts`'s own logic —
   extend, don't bypass.*
5. **Trust tier is a property of source type, revised only
   prospectively** — a trust-tier change never re-scores historical
   evidence. *Test: assert `EVIDENCE_SOURCE_TRUST_TIER` changes don't
   trigger any write to existing rows.*
6. **Trust, confidence, review status, and verification status are four
   independent axes** — never conflated into one field. *Test: schema-level — four distinct columns must continue to exist independently.*
7. **Every Evidence record traces to exactly one Ingestion Run and one
   raw input reference.** *Test: `ingestion_run_id` and `raw_input_ref`
   remain `NOT NULL`-equivalent in application-level validation.*
8. **Projection state must always be reproducible by replaying a
   learner's confirmed Evidence** — never hand-edited. *Test: the
   replay-determinism test from the First Week Checklist, kept
   permanently in the suite.*
9. **Structured Evidence records do not expire on the raw-artifact
   retention window** — only explicit, actor-attributed, audited erasure
   (Phase -1) removes PII from a record; nothing silently deletes.
   *Test: assert no scheduled job issues a `DELETE` against
   `learner_evidence`.*
10. **`evidence_purposes` is platform-governed only, never
    school-editable.** *Test: RLS/authorization — no school-scoped role
    may write to this table.*
11. **New non-scored evidence types extend the `payload jsonb` shape**
    (with a `payload_version` tag), rather than adding new nullable
    scalar columns to `learner_evidence`. *Test: schema review checklist
    item, not automatable — the one invariant here that depends on
    human review at PR time.*
12. **Classes are archived, never deleted; promotion is an appended
    event, never an overwrite of `students.grade` alone.** *Test: assert
    no code path issues a `DELETE` against `teacher_classes`, and every
    grade change is accompanied by a `student_promotions` insert.*

---

## 7. Definition of Architecture Complete

This architecture is complete not because every possible future question
has an answer, but because every question that would require a *new
design decision* to answer has already been asked, across eight
adversarial passes, and answered. What remains is exclusively of two
kinds: documentation that makes existing decisions easier to find, and
engineering that builds what's already decided. Neither kind requires
anyone to decide anything new — a builder who disagrees with a naming
choice or wants a prettier abstraction has a legitimate style opinion,
not a reason to reopen this. That is the actual bar for "complete": not
the absence of remaining work, but the absence of remaining decisions.
