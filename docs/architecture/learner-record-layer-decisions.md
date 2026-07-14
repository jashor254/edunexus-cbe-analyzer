# The Learner Record Layer — Final Architecture Decisions

Status: **DECIDED — architecture frozen, with seven additive amendments
required before implementation.** See
[learner-record-layer-final-challenge.md](learner-record-layer-final-challenge.md)
(Principal Architect final review, confidence score 78/100 as specified,
92+ after its Section 4 additions — erasure lifecycle state, evidence
school-id snapshot, person-level identity placeholder, payload version
tag, alumni/graduated status, trust-tier-aware capability projection,
evidence_purposes governance). None of those additions reopen any
decision below — they are new, additive items layered on top. Supersedes
the open questions in [learner-record-layer-review.md](learner-record-layer-review.md).
Implementation still deferred to after the pilot observation window —
this document settles *what* gets built and *why*, not *when* to start
building it. No schema or code changes are authorized by this document.

Reading order for this initiative, going forward: this document (final
decisions + roadmap) → [learner-record-layer.md](learner-record-layer.md)
(the corrected architecture) → [learner-record-layer-review.md](learner-record-layer-review.md)
(why each decision below was necessary) → [academic-evidence-layer.md](academic-evidence-layer.md)
(promotion/archival and assessment-type-name design, unaffected by any of
this).

---

## Decision 1 — Evidence Payload Shape: One JSONB Column, Not New Scalar Columns Per Source

**Decision**: `learner_evidence` gets one additive column,
`payload jsonb NULL`. Measured evidence (assessments) keeps using the
existing scalar columns (`score`, `cbc_level`, `subject`, `strand`, etc.)
unchanged — **zero migration for the nine live writers**. Narrative and
future non-scored evidence (`teacher_remark`, and later attendance/
behaviour if built) write their shape-specific fields into `payload`,
typed in TypeScript via a discriminated union keyed on `evidence_source`:

```ts
type EvidencePayload =
  | { kind: 'remark'; body: string }
  | { kind: 'attendance'; status: 'present' | 'absent' | 'late'; date: string }
  // future variants added here, never as new NULL-able table columns
```

**Why not the full envelope/child-table split** the review's option (b)
proposed: that's real DDD-correct aggregate design, but it means touching
the nine already-shipped, already-working writers and every reader —
real cost, for a benefit (schema purity) that a single `payload jsonb`
column already captures at a fraction of the migration size. **Why not
just accept unlimited new NULL scalar columns** (the review's option (a)
default): that's the trajectory the review correctly flagged as a smell
by the third source. One `jsonb` column is the actual middle path: the
scalar/measured shape stays exactly as-is (nothing about assessments
changes), and every future non-scored source shares one column instead of
each claiming its own.

**Consequence for §4 of `learner-record-layer.md`**: `teacher_remark`'s
`body` field moves from "a new nullable text column" to
`payload: { kind: 'remark', body }`. The claim-key carve-out
(`teacher_remark` never supersedes) is unchanged by this — that's a
`claimKey()` concern, orthogonal to where the content lives.

---

## Decision 2 — Assessment Purpose: A Lookup Table, Scoped as a General Evidence Axis

**Decision**: `assessment_purposes` is a small, platform-seeded,
**admin-extendable lookup table** (not a Postgres `ENUM`), and
`purpose_id` lives on `learner_evidence` itself (nullable — not every
source needs one), not only on `assessment_types`.

```sql
CREATE TABLE evidence_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,        -- 'diagnostic' | 'formative' | 'summative' | 'practice' | 'practical' | ... extendable
  label text NOT NULL,
  applies_to text[] NOT NULL DEFAULT '{}',  -- which evidence_source values this purpose is meaningful for, e.g. {'teacher_upload','csv_export'}
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assessment_types ADD COLUMN default_purpose_id uuid REFERENCES evidence_purposes(id);
ALTER TABLE learner_evidence  ADD COLUMN purpose_id uuid REFERENCES evidence_purposes(id);
```

**Why a lookup table, not an enum** (review §3.1): adding a purpose for a
new curriculum region (this platform already runs three: `ke-cbc`,
`tz-necta`, `ug-ncdc`) becomes an `INSERT`, not a schema migration.
**Why general-scoped, not assessment-only** (review §3.2): the stated
principle — "understand educational meaning, not the surface label" — is
not assessment-specific in the brief that asked for it, and retrofitting
this onto nine already-shipped sources later costs more than scoping it
correctly once, now, while nothing has shipped yet. Renamed from
`assessment_purpose` to `evidence_purposes` to reflect the corrected
scope.

**Resolution behavior, unchanged from `learner-record-layer.md` §3**:
schools still name their own assessment types freely
(`assessment_types.name`); each name maps to a `default_purpose_id` once,
at configuration time, not per-assessment.

---

## Decision 3 — Core Identity: Explicitly Deferred, Not Silently Open

**Decision**: Evidence stays keyed to legacy `students.id` through the
pilot and any subsequent legacy-first phase. Migration of
`learner_evidence.learner_id` (and every table that references it) to
Core `learners.id` is **explicitly bound to the same trigger as the
broader Core migration** — [Learning Intelligence Migration Strategy](learning-intelligence-migration-strategy.md)'s
Phase 5+ (porting Learner Model itself), per
[Data Migration Strategy](data-migration-strategy.md) §4's "these converge
later... not before."

**Why this is a decision, not a non-answer**: the review correctly noted
neither prior document addressed this. The honest architectural answer
isn't "solve it now" (premature — Core has no working assessment pipeline
yet, per `data-migration-strategy.md` §2) — it's naming the specific,
already-existing trigger condition explicitly, so "we haven't decided"
becomes "we've decided to decide later, at this named point," which is a
materially different and more trustworthy state for a future team to
inherit.

---

## Decision 4 — Revisit Triggers for the Three Accepted Exceptions (Review §1)

Every "no code changes this sprint" exception found in the review gets a
named, falsifiable trigger instead of open-ended silence:

| Exception | Revisit trigger |
|---|---|
| `assessments` table never emits Evidence (Academic Clinic intake) | Revisit the first time a pilot school's Academic Clinic submission volume is within 2x of their gradebook (`learner_marks`) volume, **or** the first time a parent/teacher reports a Blueprint/report discrepancy traceable to this gap — whichever happens first. Until then, this reflects real pilot usage patterns (Academic Clinic is the smaller, secondary path) rather than an oversight. |
| Three parallel capability stores (`learner_profiles.capability_dimensions`, `students.capability_profile`, `learner_projections.capabilityProjector`) | **Do not wait for a trigger — schedule the fix now as Phase H (below).** Unlike the other two exceptions, this one has a knowable, bounded fix (stop the third write) with no pilot-learning dependency; there's nothing to observe first that changes the answer. |
| `clinicReportBuilder.ts`/`academicClinic/reportGenerator.ts` as a third report pipeline | Revisit when Reasoning-layer promotion (Decision 6) is complete **and** a pilot school's Academic Clinic report and Blueprint/Career Intelligence report have been directly compared for the same real learner and found to materially disagree. Comparing before that point is comparing against a pipeline (Blueprint) that itself still has known Projection gaps (Decision 6) — an unfair comparison that would misdiagnose which system is "wrong." |

---

## Decision 5 — Read-Path Guardrail (Review §2)

**Decision**: `lib/repositories/evidence.repository.ts`'s learner-scoped
read methods (`findByLearner`, `findConfirmedEvidenceForLearner`,
`findPendingReview`) become **internal to `lib/projection/` and
`lib/intelligence/` only** — enforced two ways, both cheap, neither a
schema or runtime behavior change:

1. **ESLint boundary rule** (illustrative, not applied): a
   `no-restricted-imports` (or `eslint-plugin-boundaries`) rule scoped so
   that any file outside `lib/projection/**` or `lib/intelligence/**`
   importing `evidence.repository.ts` directly fails lint — a compile-time
   guardrail, not a social one.
2. **A documented rule in CLAUDE.md's Architecture Rules section**:
   *"Learner intelligence state is read via `lib/projection/recompute.ts`
   only. No feature module reads `learner_evidence` or `learner_profiles`
   directly."* — the same style as the existing "ALL database calls go
   through `lib/` functions only" rule, extended with this specific case.

**Why now, in the design, even though it's technically a code change**:
this is a lint config + one CLAUDE.md line, not a migration or a behavior
change to any table — it's the cheapest possible guardrail and the review
identified it as the single change that prevents every other finding from
being independently rediscovered by a future engineer. Recommended as the
first thing enabled once implementation resumes, ahead of Phase A, not
gated behind pilot observation the way schema changes are — but not
applied by this document, per the confirmed scope of this session (design
only, no code).

---

## Decision 6 — Reasoning Layer: Promote, Don't Rebuild

**Decision**: `lib/career/capabilityExtractor.ts` is redesignated, in
documentation and in `migration-ledger.md`'s own language, as **the
Reasoning layer's first citizen** — not "temporary shim to retire." Its
existing five callers (Blueprint, Career Intelligence, Parent Career
Intelligence, Career Explorer, Career Intelligence Report) are unchanged.
`projectionToScoreHistory` keeps its Anti-Corruption Layer role (Decision
6 doesn't retire it — that still waits on Projection V1.0 closing its
three documented capability gaps, unchanged from the Migration Ledger).

**What changes concretely, once implementation resumes** (not now):
1. `migration-ledger.md`'s "Compatibility shims" section is reworded from
   "retire the moment `capabilityExtractor.ts` is retired" to "retire the
   *adapter* once `capabilityExtractor.ts` natively consumes Projection's
   shape — the function itself is permanent architecture."
2. `remedial/planner.ts`'s gap-detection and `careerIntelligenceEngine.ts`'s
   matching logic are **not merged into one file** (that would be
   premature consolidation of genuinely different reasoning questions —
   "what should this learner practice next" vs. "what careers fit this
   learner" are different domains, not duplicates of each other). They
   are instead each documented as *a* Reasoning-layer citizen, following
   `capabilityExtractor.ts`'s precedent, so future products know where to
   look for prior art before writing a sixth bespoke interpretation
   function.

**Why promotion over invention**: the review found this already exists,
proven by five real callers — inventing a new module would create a
second, competing "reasoning" concept alongside the one already doing the
job.

---

## Decision 7 — Recommendation Layer: `recommend.ts` Is Canonical; Remedial Planner Stays a Tracked, Not New, Gap

**Decision**: `lib/adaptiveLearning/recommend.ts` remains the single
named Recommendation layer. `lib/remedial/planner.ts`'s legacy-sourced
`top_flags`/`buildAction()` gap is **not new work** — it is already
tracked, with a stated reason, in `migration-ledger.md`'s existing
Remedial Planner row ("Projection's `RiskFlag` has no `type` taxonomy...
4 of 6 legacy categories are not things Projection can detect from
evidence alone"). This document does not reopen that decision. It adds
one thing: **closing this gap is now explicitly downstream of Reasoning
promotion (Decision 6) and Projection V1.0's gaps (Decision 4's third
row)** — not a parallel, independent piece of work someone could pick up
prematurely and re-litigate the same "which risk taxonomy wins" question
Teacher Intelligence Sprint 2 already settled.

---

## Decision 8 — Phase H (New): Collapse the Three Capability Stores

Unlike every other item in this document, this one has no pilot-learning
dependency (Decision 4) — it's added to the roadmap now, not deferred:

**Phase H**: `recomputeAndSaveCapabilityProfile()`
(`lib/career/careerEngine.ts:382`, called from
`app/api/assessments/create/route.ts:99`) stops writing
`students.capability_profile` as an independent computation and instead
becomes a thin cache-refresh: call `recomputeLearnerProjection()`, read
`capabilityProjector`'s value, write *that* into
`students.capability_profile` (keeping the column, since
`/api/career/capability` and `/api/career/growth` still read it per
`migration-ledger.md`'s "Compatibility shims" note — not removing a
consumer, just making its source honest). `learner_profiles.capability_dimensions`
is untouched by this phase (already known-legacy, already tracked
separately in the Ledger) — Phase H closes the newer, less-visible third
store specifically, which is the one nobody had previously flagged as a
duplicate.

**Amended during implementation (2026-07-13), confirmed with the user**:
this decision's original text ("write `capabilityProjector`'s value")
assumed Projection alone was a complete substitute for the prior computation.
It isn't: `app/api/assessments/create/route.ts` (the Academic Clinic intake
path — see `migration-ledger.md`'s Implementation Wave 3) still does not
emit an Evidence Domain row, so Projection has zero visibility into it.
Switching `recomputeAndSaveCapabilityProfile` to Projection alone, as
originally written, would have silently dropped capability signal for
every Academic-Clinic-only student — a real regression against real
production data, not caught by any of the eight prior review passes
because none of them traced this specific function's actual data source
against the Evidence Domain's known write-path gap.
**Implemented instead**: `recomputeAndSaveCapabilityProfile` sources from
**both** `recomputeLearnerProjection()` (via the new
`projectionToTimestampedScoreHistory()`, `lib/learnerIntelligence/projectionAdapters.ts`)
**and** the legacy `assessments` table (`repos.learnerModel.findAssessmentHistory`,
now additionally returning `created_at`), merged into one true
chronological sequence (`mergeChronologicalScoreHistories()`,
`lib/career/careerEngine.ts` — pure, unit-tested independent of any
database) before being fed to `extractCapabilityProfile()`. This still
closes the three-store duplication this decision exists to fix (the
computation's source of truth is now singular — Evidence-derived where
Evidence exists, legacy-derived where it doesn't yet — rather than a
third, independent read of `assessments` alone) without the regression the
literal original text would have caused. `computeCapabilityProfile()`
itself (`lib/career/capabilityExtractor.ts`) is untouched and remains in
use by `lib/learnerModel/updater.ts`, a different, unrelated write path
not in this phase's scope.

---

## Final Consolidated Roadmap

**Amended post-ratification** (closure audit, 2026-07-13) — the four
blocking items found in `learner-record-layer-final-challenge.md` and
`learner-record-layer-adversarial-challenge.md` (erasure lifecycle state,
`learner_evidence.school_id` snapshot, person-level identity anchor,
curriculum/scale-version anchor) were identified two and four passes
*after* this table was first written and were never merged back into it
until now. This table, not any individual pass's own document, is the
single source of truth for implementation sequencing — if a future
change is decided anywhere in this series, it belongs here too, the same
day, not just in the pass that found it.

Merges `academic-evidence-layer.md` §9 (Phases A/B/D/E/F, unaffected),
`learner-record-layer.md` §7 (Phases C/G, revised by Decisions 1–2 above),
this document's Decision 5 and Decision 8, and the four blocking items
ratified in `learner-record-layer-signoff.md`. Ordered by dependency.

| Phase | Delivers | Depends on | Notes |
|---|---|---|---|
| **-1 (new, do first, blocking)** — **✅ IMPLEMENTED 2026-07-13** | `learner_evidence`: add `erased` lifecycle state + PII-purge tombstone pattern; add `school_id` (nullable, captured at write time); add `curriculum_version_id`. `students`: reserve a nullable person-level identity field (`upi`). | Nothing | Migration: `supabase/migrations/20260713190000_phase_minus1_evidence_foundation.sql`. Repository: `EvidenceRepository.erase()`. Domain service: `eraseEvidence()` in `evidenceLifecycle.ts`. Tests: 4 new cases in `evidenceDomain.integration.test.ts` (erasure purge/preservation, double-erasure rejection, immutability-exception scoping, school_id/curriculum_version_id round-trip). **Not yet applied to any database** — local dev environment was unhealthy this session; migration file is reviewed-ready, needs `supabase db reset` (or equivalent) run once the environment is functional, then the integration test suite run to confirm against real Postgres. Writer-side population of `school_id`/`curriculum_version_id` (resolving a teacher's school-text to a real `schools.id`, and picking a default curriculum version) is deliberately **not** wired into the 9 evidence writers yet — no resolution heuristic was ever specified in any ratified document, so none was invented; both fields default to `null` until that's a separate, explicit decision. |
| **0** — **✅ IMPLEMENTED 2026-07-13** | ESLint read-path guardrail + CLAUDE.md rule (Decision 5); replay-determinism and migration-safety tests | Phase -1 (schema, unapplied) | `eslint.config.mjs` (3 `no-restricted-syntax` rules, scoped to the 3 learner-scoped read methods only — verified against a live violation and against all 9 existing writers with zero false positives). `CLAUDE.md` (3 new Architecture Rules lines). Replay-determinism test already existed (`lib/projection/engine.test.ts`) — fixed its fixture for Phase -1's new `EvidenceRow` fields, all 13 tests still pass. New: `lib/intelligence/phaseMinus1Migration.safety.test.ts` (4 tests, DB-free, guards the migration file's CHECK constraints against future narrowing). |
| **H** — **✅ IMPLEMENTED 2026-07-13** | Collapse `students.capability_profile` into a Projection-sourced (blended) computation (Decision 8, amended) | Phase -1 | `lib/career/careerEngine.ts` (`recomputeAndSaveCapabilityProfile` rewritten, `mergeChronologicalScoreHistories` new pure export), `lib/learnerIntelligence/projectionAdapters.ts` (`projectionToTimestampedScoreHistory` new export), `lib/repositories/learner-model.repository.ts` (`findAssessmentHistory` now returns `created_at`). Tests: `lib/career/careerEngine.mergeChronologicalScoreHistories.test.ts` (3 cases, pure, verified passing). Zero new TypeScript errors. **Not verified against a live database** — same environment constraint as Phase -1; `.env.local` was found to point at the production project, so no DB-touching test was run this session. |
| **A** — **✅ IMPLEMENTED 2026-07-13 (API-only, no UI — confirmed scope)** | `teacher_classes.status`/`archived_at` + `student_promotions` table | Nothing | Migration: `supabase/migrations/20260713193000_phase_a_promotions_archival.sql`. Repository: `lib/repositories/promotion.repository.ts` (new). Domain service: `lib/promotions/promote.ts` (`promoteStudent`, `archiveClassForYearEnd`, `getPromotionHistory`) — handles `teacher_classes` being subject-scoped (a student has one row per subject, not one homeroom), a real-schema detail unaddressed by `academic-evidence-layer.md` §2, by operating on one student+one class-transition per call rather than assuming a single from/to class pair. API: `POST /api/teacher/classes/[classId]/archive`, `POST`/`GET /api/teacher/students/[studentId]/promote` — thin, auth-checked, ownership-verified, Zod-validated, matching CLAUDE.md's API rules exactly. Tests: `lib/promotions/promote.integration.test.ts` (3 cases, not yet run against a live DB — same environment constraint as Phase -1/H). **Closure audit's open question #1 resolved 2026-07-13**: API-only for the pilot, no teacher-facing UI yet. |
| **B** — **✅ IMPLEMENTED 2026-07-13 (API-only, no UI — same pattern as Phase A)** | `assessment_types` table + drop hardcoded CHECK/enum | Nothing | Migration: `supabase/migrations/20260713200000_phase_b_assessment_types.sql` (table + RLS + backward-compat backfill for every existing teacher + `class_assessments.assessment_type_id` + CHECK drop + existing-row backfill). Repository: `lib/repositories/assessmentType.repository.ts` (new). Domain service: `resolveOrCreateAssessmentType()` in `lib/assessments/mutations.ts`, wired into `createAssessment`. API: `app/api/teacher/assessments/route.ts`'s Zod `assessmentType` field widened from a 6-value enum to `z.string().min(1).max(50)` — the teacher-facing UI (`app/teacher/classes/[classId]/assessments/page.tsx`) is untouched and still only ever sends one of the 6 known names via its dropdown, so real behavior for today's pilot teachers is unchanged; the API can no longer be the thing that forecloses a different client submitting a genuinely custom name. Tests: `lib/assessments/assessmentType.integration.test.ts` (4 cases: no speculative seeding for post-migration teachers, register-not-reject an unseen name, reuse not duplicate, per-teacher scoping) + `lib/assessments/phaseBMigration.safety.test.ts` (4 cases, DB-free, verified passing). |
| **G (revised)** — **✅ IMPLEMENTED 2026-07-13** | `evidence_purposes` lookup table + `purpose_id` on `learner_evidence` (Decision 2) | Phase B | Migration: `supabase/migrations/20260713203000_phase_g_evidence_purposes.sql` (table + RLS, 5 canonical purposes seeded, `assessment_types.default_purpose_id` + reasonable default mapping for the 6 Phase-B-seeded names, `learner_evidence.purpose_id` + widened immutability trigger). Repository: `lib/repositories/evidencePurpose.repository.ts` (new); `assessmentType.repository.ts` extended with `default_purpose_id` + `findById`. Wired into exactly one writer — `lib/assessments/evidence.ts` (`recordAssessmentEvidence`), the only one with an already-established, non-invented resolution path (`assessment_type_id` → `assessment_types.default_purpose_id`); the other 8 evidence writers are untouched, `purpose_id` stays `null` for them until a real resolution path exists for each, same "add the field, don't invent population logic" discipline as Phase -1's `school_id`/`curriculum_version_id`. Tests: `lib/assessments/evidencePurpose.integration.test.ts` (2 cases: known type resolves correctly, custom type resolves to null not a guess) + `lib/intelligence/phaseGMigration.safety.test.ts` (4 cases, DB-free, verified passing). |
| **C (revised)** — **✅ IMPLEMENTED 2026-07-13** | `teacher_remark` EvidenceSource + `payload jsonb` column (Decision 1) + claim-key carve-out | Nothing | Migration: `supabase/migrations/20260713210000_phase_c_teacher_remarks.sql`. **Bug caught and fixed during implementation, not before**: erasure (Phase -1) only exempted `extracted_name`/`extracted_external_id`/`score` from immutability — a teacher remark's real content lives in `payload`, so "erasing" a remark would have purged an empty field while leaving the actual narrative intact. Fixed in the trigger, `EvidenceRepository.erase()`, and guarded by a dedicated migration-safety test (`phaseCMigration.safety.test.ts`) that specifically checks payload only appears in the erasure-exempt block, not the unconditional one — a first draft of this migration briefly had it in both, which would have made erasure permanently impossible for any row with a payload; caught by that same test before it shipped. `EvidenceSource`/trust tier (3, same as `teacher_upload`)/`claimKey()` carve-out: `lib/intelligence/evidence.ts`, `evidenceLifecycle.ts`. Writer: `lib/remarks/evidence.ts` (`recordRemarkEvidence`, `getRemarksForStudent`) — general remarks use the `'general'` sentinel already established elsewhere in this codebase (`mutations.ts`'s `triggerLearnerModelUpdates`), not a new convention. API: `POST`/`GET /api/teacher/students/[studentId]/remarks`, same API-only pattern as Phase A/B. Tests: `lib/remarks/evidence.integration.test.ts` (4 cases) + `lib/intelligence/phaseCMigration.safety.test.ts` (4 cases, DB-free, verified passing, including the exact regression guard above). |
| **D** — **✅ PARTIALLY IMPLEMENTED 2026-07-14 (minimal scope, confirmed)** | Traditional-analytics engine consolidation | Nothing | **Discovered during implementation, not before**: the "canonical" server-side engine (`getAssessmentAnalytics`) has its own pre-existing bug — `gradeLevelFromScore` is CBC-hardcoded and not normalized against `max_score`, while a third, more correct, curriculum-aware and normalized band function (`gradeCalculator.ts`'s `getBandForScore`/`getSubjectLevels`) already exists and is used elsewhere on the same page. True grade-band unification would mean fixing that pre-existing bug too — out of this phase's ratified scope, and would change real EE/ME/AE/BE numbers teachers see today for 8-4-4 classes or non-100-max_score assessments. **Confirmed with the user: minimal scope only.** Delivered: `median`/`mode`/`meanPoints` added to `ClassOverview` (additive; `lib/assessments/analyticsStats.ts` new pure module, `gradeToPoints` in `gradeCalculator.ts` — standard KNEC 12-point / CBC 4-level mapping, not invented). Class-insights route (`app/api/teacher/classes/[classId]/insights/route.ts`) fixed to average across all of a student's assessments instead of latest-only — **within the same `assessments` table it already queried**, not switched to the gradebook table (`getAssessmentAnalytics` uses a genuinely different table — `class_assessments`/`learner_marks` — confirmed these were never actually the "same aggregate query" this decision's original text assumed; also confirmed with the user). Logic extracted to `computeStudentRiskLevel` (thin-controller compliance). **Deferred, tracked, not done**: `analyzeSubjects()` (client-side Subject Analysis tab) still uses its own generic A/B/C/D bands, independent of both `getAssessmentAnalytics` and `gradeCalculator.ts`'s curriculum-aware bands — full 3-way grade-band consolidation remains open, requires a separate scoped decision. Tests: `lib/assessments/analyticsStats.test.ts` (12 cases, DB-free, verified passing). |
| **E (revised)** — **✅ IMPLEMENTED 2026-07-14** | `getEvidenceHistoryForLearner()` + `student_promotions` merge, documented as the canonical Learner Record API | Phase A | New module: `lib/learnerRecord/timeline.ts` (`getLearnerTimeline`) — a thin chronological merge of `getEvidenceHistoryForLearner()` and `getPromotionHistory()` (Phase A), no new storage or computation, exactly as scoped. Named explicitly as *the* canonical Learner Record API in `CLAUDE.md`, per this document's own "no product surface today shows a human the raw chronological view... name it" finding. API: `GET /api/teacher/students/[studentId]/timeline`, same API-only pattern as Phases A/B/C. Tests: `lib/learnerRecord/timeline.integration.test.ts` (2 cases: true chronological merge across both sources, not concatenation; empty history returns empty, not an error). |
| **F** — **✅ IMPLEMENTED 2026-07-14** | Rule 3 (teacher attribution, not ownership) invariant documented in CLAUDE.md | Nothing | Docs-only. Added to CLAUDE.md's Architecture Rules with a concrete "never do this" example (don't gate reads by `teacher_id`; ownership for access control is `class_students`, checked separately). |
| **Reasoning promotion** — **✅ IMPLEMENTED 2026-07-14** | Reword `migration-ledger.md`'s shim language (Decision 6) | Nothing | Docs-only. `migration-ledger.md`'s "Compatibility shims" entry and `projectionAdapters.ts`'s own file header both reworded from "temporary compatibility shim, retire when capabilityExtractor.ts retires" to "Anti-Corruption Layer between Projection and the Reasoning layer's permanent first citizen — the adapter retires, the function does not." |

**Deliberately still excluded**, unchanged from prior documents: merging
`assessments` vs `class_assessments`/`learner_marks` (bound to Decision
4's Academic Clinic trigger, not scheduled); any LMS/SMS import work
(School Integration Pipeline's own roadmap); Attendance/Behaviour/
Competitions evidence sources (build on demand, per
`learner-record-layer.md` §5, unchanged); closing Projection V1.0's three
capability/knowledge/duration gaps (bound to real pilot usage evidence,
per Decision 4's third row).

---

## What This Document Does Not Decide

Consistent with the confirmed scope for this session: **no migration
runs, no code ships, no `assessment_types`/`evidence_purposes`/
`student_promotions` table is created** as a result of this document.
This is the frozen target architecture and its build order. The
authorization to begin Phase 0 is a separate, later decision — the same
one every prior document in this series has deferred to the end of the
pilot observation window.
