# Migration Ledger — Learner Intelligence Projection Engine

Authoritative, single-glance status of every learner-intelligence consumer in EduNexus. Updated as each consumer migrates. This is the first thing a future phase should read to know what's left.

## States

- **Projection** — reads learner intelligence only from `lib/projection/` (via `recomputeLearnerProjection`/`recomputeLearnerProjections` or `getPersistedProjections`). No direct reads of `learner_profiles` capability/knowledge/risk fields.
- **Legacy** — unmigrated; reads `learner_profiles.capability_dimensions`/`knowledge_state`/`risk_flags` directly, or computes capability live via `lib/career/capabilityExtractor.ts` against raw assessment history.
- **Dual-write** — writes to both the legacy `learner_profiles` store and Evidence (temporary, transitional; has a stated exit condition).
- **Deferred** — explicitly out of scope for the current phase; still Legacy in practice, but a deliberate scope decision rather than an oversight.

## Ledger

| Consumer | State | Notes |
|---|---|---|
| Blueprint (`lib/learnerIntelligence/blueprint.ts`) | Projection | Capability sourced via the temporary `projectionToScoreHistory` shim feeding the unchanged `extractCapabilityProfile()` formula; risk sourced via `projectionRiskFlags`. `confirmed_gaps` (teacher-authored, not computed) still read from `learner_profiles` — that's data, not duplicated intelligence, and stays. |
| Career Intelligence (`lib/learnerIntelligence/careerIntelligence.ts`) | Projection | Same capability-adapter pattern as Blueprint. |
| Compass (`lib/learnerModel/updater.ts` `updateFromCompass`) | Dual-write | Landed: `lib/compass/evidence.ts` emits `compass_session` Evidence (tier 1, always `pending_review` per LI-3) from `app/api/learn/end/route.ts`, alongside the still-live `learner_profiles` write. Exit condition: once every Deferred consumer below is migrated to Projection, delete the `learner_profiles` write and emit Evidence only. |
| Teacher Dashboard (`lib/attentionFeed/panel.ts` `buildTeacherPanel`) | Partial (mixed) | `students_needing_attention` (risk) and `class_trajectory` (growth) sourced from Projection. Migrated in Teacher Intelligence Sprint 2: `findPeerHelper` and `detectAccelerationCandidates` no longer branch on legacy `overall_risk_level` — both now check `projections.get(id)?.risk?.value.overallRiskLevel`, the same risk engine as the attention list itself (one risk engine, no exceptions, within this file). `class_mastery_heatmap`, `hidden_misconceptions`, the *content* of acceleration candidates (capability_dimensions, knowledge_state), and `getWeeksAtRisk` (risk_history duration) remain on legacy `learner_profiles` — they need substrand-level `knowledge_state`, 6-dimension capability, and consecutive-weeks duration, none of which the frozen v1.0 Projection Engine computes. Documented engine gap, confirmed with user before implementing. |
| Principal Dashboard (`lib/school/intelligence.ts` `computeSchoolIntelligence`) | Partial (mixed) | School-wide and per-grade risk distribution now sourced from Projection (`projection.risk`). `persistent_risk_count` (needs consecutive-weeks duration, which Projection doesn't track) and `avg_capability_dimensions` (needs the 6-dimension breakdown, which `projection.capability` doesn't compute — only per-subject level) remain on legacy `learner_profiles`. `avg_capability_dimensions` deliberately does NOT reuse the Blueprint/Career Intelligence capability adapter — that shim is scoped to those two consumers only. |
| Holiday Planner (`lib/holiday/planner.ts`) | Projection | Migrated per Adaptive Learning v2 Architecture §4/§11 (docs/architecture/adaptive-learning-v2-architecture.md, FROZEN) — `generateHolidayPlan` now reads `recomputeLearnerProjection` + the Recommendation Layer (`lib/adaptiveLearning/recommend.ts`) and Career Intelligence, not `learner_profiles`/`career_signals` directly. Priority gaps are subject-level only (see "Known gaps" below — unchanged). |
| Parent Pulse (`lib/parentPulse/builder.ts`) | Projection | Migrated in Parent Intelligence Sprint 1: knowledge and risk now read `recomputeLearnerProjection` (subject-level knowledge, and the same risk engine as Blueprint/Career Intelligence/Adaptive Recommendation). `career_signals` (no `careerProjector` exists) and `engagement_patterns` (`behaviourProjector` has no wired evidence source yet) remain on `learner_profiles` — not computed duplicates, no equivalent to migrate to. Substrand-level wording ("Strong this week: fractions") is now subject-level ("Strong this week: Mathematics") since `knowledgeProjector` is subject-level only — accepted tradeoff, confirmed with user. |
| Remedial Planner (`lib/remedial/planner.ts`) | Partial (mixed) | Migrated in Teacher Intelligence Sprint 2: the "critical group" gate now uses `projection.risk.value.overallRiskLevel === 'critical'` (`isProjectionCritical`) instead of the legacy `risk_flags.length >= 2` count — one risk engine. Per-assessment CBC `level` (1–4, derived from *this* assessment's raw marks) is intentionally left as-is — it answers "who failed this specific test," a different question from `knowledgeProjector`'s aggregate current-state view, not a duplicate. Prerequisite graph traversal unchanged (Task 8 constraint). Confirmed with user: this is a rough proxy, not numerically identical to the old flag count — small number of students may shift group at the margin. |
| Monday Panel (`app/api/teacher/monday-panel/route.ts`) | Partial (mixed) | Migrated in Teacher Intelligence Sprint 2: `risk_level`, class-wide risk counts (critical/at_risk/watch/normal), the at-risk sort order, and peer-pairing eligibility now read `recomputeLearnerProjection` — same risk engine as everywhere else. `top_flags`/`buildAction()` deliberately stay on legacy `risk_flags` — Projection's `RiskFlag` has no `type` taxonomy (`missing_prerequisite`/`disengaged`/`language_barrier`/`no_assessment_data`/`multiple_weak_substrands`/`declining_performance`) or `substrand`, and 4 of 6 legacy categories are not things Projection can detect from evidence alone. `weeks_at_risk` (duration), capability-dimension-driven peer-pairing *content*, `compass_suggestion` (substrand knowledge), `career_moments` (milestone-crossing log), and `prerequisiteAlerts` (substrand, shared `findPrerequisiteAlerts`, left unchanged per Task 5) remain on legacy — all documented engine gaps. Cache behaviour unchanged — it caches the panel output either way, which now happens to contain Projection-sourced risk fields. Confirmed with user: risk taxonomy/text stays legacy rather than forcing an incomplete mapping. |
| Prerequisite Readiness (`app/api/teacher/prerequisite-readiness/route.ts`) | Legacy | Audited in Teacher Intelligence Sprint 2 — no migration needed. The entire route is substrand-prerequisite matching via the shared `findPrerequisiteAlerts()` (Task 5: left unchanged); `readiness_pct`/`ready` are derived directly from those alerts, not a separate duplicated computation. No Projection equivalent exists (no substrand mastery). |
| Parent Career Intelligence (`app/api/parent/career-intelligence/route.ts`) | Projection | Migrated in Parent Intelligence Sprint 1: now uses the same `recomputeLearnerProjection` → `projectionToScoreHistory` → `extractCapabilityProfile` path as Blueprint/Career Intelligence, replacing the separately-stored, potentially-stale `career_capability_profiles` snapshot (`getCapabilityProfile`). Third approved caller of the `projectionToScoreHistory` shim — see "Compatibility shims" below. |
| Career Explorer (`app/api/career/capability-matches/route.ts`) | Projection | Migrated in Implementation Wave 3: GET and POST's match computation now use `recomputeLearnerProjection` → `projectionToScoreHistory` → `extractCapabilityProfile`, the same shim as Blueprint/Career Intelligence/Parent Career Intelligence, instead of `getCapabilityProfile()`. POST still also calls `recomputeAndSaveCapabilityProfile` for its side effect of refreshing the `students.capability_profile` snapshot the profile bars (`/api/career/capability`) and growth trend (`/api/career/growth`) read — **as of Phase H (capability-store consolidation), that snapshot is itself Projection-sourced** (blended with the legacy `assessments` table — see below), not an independent third computation. |
| Career Intelligence Report (`app/api/career/intelligence-report/route.ts`) | Projection | Migrated in Implementation Wave 3: capability profile now sourced via the same `projectionToScoreHistory` shim as every other consumer, replacing `getCapabilityProfile()`. Still uses `buildClinicReport`/`clinicReportBuilder.ts` for the single-latest-assessment sections (readiness snapshot, education chains) — that remains a deliberately separate question (see Reporting Sprint 3 below), unchanged by this migration. |
| Clinic Report Builder (`lib/career/clinicReportBuilder.ts`) | Legacy | Audited in Reporting Sprint 3 — no migration performed, by design. `overall_score`/`overall_level`/`subjectStatus`/`top_subjects`/`weak_subjects` are computed from the single **latest assessment** (`assessments[0]`), not aggregate evidence — a different question from what `knowledgeProjector`/`academicProjector` answer (current aggregate state). Migrating would silently change grading logic (which subjects surface as strengths/weaknesses whenever the latest assessment disagrees with the aggregate) — forbidden by the sprint's constraints. Career matching (`getMatchesForStudent`/`generateCareerMatches`) is a third independent career-matching path (see Career Intelligence Report above); Career Intelligence's output shape (`CareerMatchInsight`) has no `skill_timeline`/`subject_importance`/`required_subjects`/gap-row fields this report renders, so routing through it would mean inventing new fields or dropping report content — both forbidden. Confirmed with user: accept audit, no code changes this sprint. |
| Auto Report Generator (`lib/career/autoReportGenerator.ts`) | Legacy | Audited in Reporting Sprint 3 — no migration performed. `generateCompassBridge` reads `student_learning_context.overall_tier`/`subject_tiers`/`top_careers`, all legacy/single-assessment-scoped (same reasoning as Clinic Report Builder above). These fields also steer the *next* Compass session (`first_subject`/`session_goal`/`guided_topics`) — forward-looking session guidance, not a report of current state, so Task 5's "leave session-state alone" rule applies independent of the single-assessment issue. |
| Academic Clinic (`lib/academicClinic/reportGenerator.ts`, `assessmentPipeline.ts`, `careerEngine.ts`) | Legacy | Audited in Reporting Sprint 3 — a third, fully independent report pipeline (own 40-career static database, own CBC tier vocabulary — Emerging/Developing/Proficient/Exemplary — own `analyzePerformance`-based tiering), live in production via `runAssessmentPipeline` (called from both teacher and parent assessment-processing routes). Same single-assessment-scope reasoning as above applies to every tier/level field. No migration performed — confirmed with user. Frontend (`app/academic-clinic/page.tsx`) was audited for Task 4 (client-side intelligence): clean — it re-runs the shared server-side `calculateVitals` pure function for a live pre-submission preview and applies `resolveLevel` for teacher-override display, neither of which is an independent intelligence computation. |
| Blueprint Action Plan (`lib/learnerBlueprint/actionPlan/candidateGeneration.ts`) | Projection | New consumer, Phase 1 of `docs/architecture/blueprint-living-action-plan-audit.md` (2026-07-25). `generateActionCandidate` reads `recomputeLearnerProjection()` and reuses `buildAdaptiveTask()`/`classifyGroup()` (`lib/adaptiveLearning/recommend.ts`, the same classifier Holiday Planner and Remedial Planner already share) — no new classification logic, no `learner_profiles` read. Never a Legacy or Dual-write consumer at any point; this domain does not write Evidence either (see `docs/architecture/blueprint-action-plan-phase1.md`). |

## Reporting Sprint 3 — why two report pipelines were left as-is

`clinicReportBuilder.ts` and `academicClinic/reportGenerator.ts` both compute "academic performance" tiers directly from a single assessment event, entirely independent of both `learner_profiles` and Projection. This is architecturally different from the Sprint 1/2 pattern (a stale second engine duplicating Projection's *aggregate* state) — these reports answer "what did this specific assessment show," which Projection's aggregate-evidence model doesn't answer at all. Forcing either onto Projection would require one of: inventing Projection-shape fields the engine doesn't compute, changing report wording/layout, or changing which subjects/careers a report surfaces — all explicitly forbidden by this sprint's constraints. Confirmed with the user: audit stands, no code changed.

## Known gaps in the frozen Projection Engine (v1.0)

Surfaced during Phase 4 implementation, confirmed with the user rather than silently worked around:

- **No substrand-level knowledge.** `knowledgeProjector` is subject-level only. Blocks full migration of Teacher Dashboard's mastery heatmap, hidden misconceptions, and peer-helper matching.
- **No 6-dimension capability breakdown.** `capabilityProjector` produces per-subject level/score, not the `analytical_reasoning`/`communication`/`creative_thinking`/`technical_aptitude`/`social_intelligence`/`resilience` dimensions the career-matching engine and Principal Dashboard's `avg_capability_dimensions` need. Bridged for Blueprint/Career Intelligence only via the temporary `projectionToScoreHistory` shim (feeds the legacy formula instead of duplicating it) — not extended to other consumers.
- **No duration/consecutive-weeks tracking.** `riskProjector` reflects current state only, not how long a student has been at a given severity. Blocks migrating `persistent_risk_count` (Principal Dashboard) and `weeks_at_risk` (Teacher Dashboard).

These are candidates for a future Projection Engine version, not this phase's problem to solve.

## Compatibility shims (temporary, tracked for removal)

- `lib/learnerIntelligence/projectionAdapters.ts` — `projectionToScoreHistory()`/`projectionToTimestampedScoreHistory()` bridge Projection data into `capabilityExtractor.ts`'s formula. **Reworded 2026-07-14 (Reasoning promotion, `learner-record-layer-decisions.md` Decision 6)**: `capabilityExtractor.ts` is not "legacy code being bridged, temporary, tracked for removal" — it is the Reasoning layer's first citizen and permanent architecture, proven by five real callers. What retires is the *adapter*, once `capabilityExtractor.ts` is rewritten to consume Projection's shape natively — the function itself does not retire. Approved callers: Blueprint, Career Intelligence, Parent Career Intelligence (Parent Intelligence Sprint 1), Career Explorer (`app/api/career/capability-matches/route.ts`) and the Career Intelligence Report (`lib/career/careerIntelligenceEngine.ts`) as of Implementation Wave 3, and — as of Phase H — `lib/career/careerEngine.ts`'s `recomputeAndSaveCapabilityProfile` (via `projectionToTimestampedScoreHistory`, needed to blend chronologically with the legacy `assessments` table rather than overwrite it — see Phase H below).

## Implementation Wave 3 — Academic Clinic write-path gap closed

`app/api/assessments/create/route.ts` (the standalone "Academic Clinic" bulk score-entry endpoint, distinct from the `class_assessments`/`learner_marks` teacher gradebook) wrote directly to the `assessments` table with **no downstream side effect at all** — no Evidence Domain row (unlike `lib/assessments/evidence.ts`'s `recordAssessmentEvidence`, which the gradebook path does call), no `learner_profiles` update, and no capability recompute. A student's `students.capability_profile` stayed stale after this route until something else happened to trigger `recomputeAndSaveCapabilityProfile` (e.g. the Career Explorer's "Update" button). Fixed by calling `recomputeAndSaveCapabilityProfile` fire-and-forget after insert, matching every other assessment-entry path. This route still does not emit an Evidence Domain row — extending it to do so is a deliberate future decision (trust tier, identity resolution), not done in Wave 3 per "do not redesign architecture."

## Phase H — capability-store consolidation (2026-07-13)

Closed the third independent capability computation identified in
`docs/architecture/learner-record-layer-final-challenge.md`: three stores
(`learner_profiles.capability_dimensions`, `students.capability_profile`,
`learner_projections.capabilityProjector`) existed simultaneously,
disagreeing legitimately. `recomputeAndSaveCapabilityProfile()`
(`lib/career/careerEngine.ts`) no longer independently queries `assessments`
via `computeCapabilityProfile()` — it now sources from
`recomputeLearnerProjection()` via `projectionToTimestampedScoreHistory()`,
**blended chronologically with the legacy `assessments` table** (not
switched to Projection alone — this Wave 3 section's Academic Clinic route
still doesn't emit an Evidence Domain row, so Projection alone is blind to
it; switching purely to Projection, as the architecture's Decision 8
originally specified, would have silently dropped capability signal for
every Academic-Clinic-only student — caught during implementation, amended
with the user's sign-off, see `learner-record-layer-decisions.md` Decision
8). `learner_profiles.capability_dimensions` is untouched — already
separately tracked legacy, not this phase's problem. `computeCapabilityProfile()`
itself is untouched and still used by `lib/learnerModel/updater.ts` for a
different, unrelated write path.

## Production Hardening Audit — closed (2026-07-14)

Final pass before Learner Record Layer merge. Fixed the one production
blocker and 4 high-priority findings from the Production Hardening Audit;
nothing else reopened. Migration: `20260714120000_production_hardening.sql`
(additive only — one new table, one new index, one new CHECK, no existing
row touched).

- **IDOR (blocker) — Promote API.** `POST /api/teacher/students/[studentId]/promote`
  verified the *student* belonged to the requesting teacher but never
  verified `fromClassId`/`toClassId` did — a teacher legitimately teaching
  the student could pass any `teacher_classes.id` on the platform and have
  the student enrolled into it, or have an arbitrary class recorded as the
  "from" class in the permanent promotion history. Fixed in
  `app/api/teacher/students/[studentId]/promote/route.ts` with a
  `verifyTeacherOwnsClass` check (same `teacher_classes.teacher_id` shape
  `promotion.repository.ts`'s `archiveClass` already uses), rejecting with
  403 before either class id reaches `promoteStudent`.
- **Idempotency — Teacher Remarks & Student Promotions.** Both write
  permanent, evidence-shaped records with no dedup: a retried request
  (double-click, network retry) silently created a second, indistinct
  remark or promotion forever (evidence is immutable; promotions are
  append-only). Added a generic `idempotency_keys(scope, key)` table and
  `lib/idempotency/reserveKey.ts`'s `reserveIdempotencyKey()` — deliberately
  its own table, not a column on `learner_evidence`/`student_promotions`
  (both ratified, closed schemas; idempotency is a transport concern, not a
  learner fact). Both routes accept an optional `Idempotency-Key` header;
  omitting it keeps prior behavior exactly, so this is backward compatible
  with any caller that predates it.
- **Missing index — `assessment_types.default_purpose_id`.** Added in
  Phase G, read on every assessment evidence write
  (`lib/assessments/evidence.ts`'s `findById(...)?.default_purpose_id`
  lookup) with no supporting index. Added
  `idx_assessment_types_default_purpose_id`.
- **Missing CHECK — `assessment_types` ownership.** `teacher_id`/`school_id`
  were both independently nullable: a row with neither is invisible to
  every RLS policy (silent orphan), a row with both is ambiguously owned.
  Added `assessment_types_exactly_one_owner` (`teacher_id IS NOT NULL XOR
  school_id IS NOT NULL`). Safe as a hard constraint, not `NOT VALID`: this
  migration and Phase B/G were never applied to the remote project
  (confirmed via `list_migrations` — remote stops at
  `20260713031529_sprint15_corrections`), so there is no existing data to
  violate it; every row the Phase B backfill produces is teacher-scoped.

All 6 pending migrations (Phase -1, A, B, G, C, and this hardening pass)
were applied to the linked Supabase project with user sign-off, since none
had ever been pushed (`list_migrations` previously stopped at
`20260713031529_sprint15_corrections`). Running the DB-backed integration
tests against real state surfaced 2 further **objectively demonstrable**
bugs in the already-"ratified" Phase C/G migrations themselves — fixed
under the same "confirmed production bug" exception, nothing else
reopened:

- **`ingestion_runs.source` missing `'teacher_remark'`.** Phase C widened
  `learner_evidence.evidence_source`'s CHECK but missed the separate,
  identically-shaped CHECK on `ingestion_runs.source` — the exact
  two-constraints-must-move-together gap `20260708_holiday_return_evidence_source.sql`
  already fixed once before, for `'holiday_return'`. Every teacher-remark
  write called `createIngestionRun()` first and failed outright. Confirmed
  by `evidence.integration.test.ts` failing against the live DB with
  `ingestion_runs_source_check` violated on every remark. Fixed additively
  in `20260714121500_fix_ingestion_runs_teacher_remark_source.sql`, applied.
- **New teachers never got a `default_purpose_id`.** Phase G's backfill
  `UPDATE` only reached `assessment_types` rows that existed at migration
  time. `lib/assessments/mutations.ts`'s `resolveOrCreateAssessmentType` —
  the only path that creates a row for any teacher onboarded after Phase
  G — never set `default_purpose_id`, so every teacher signing up from now
  on would get `purpose_id: null` on all their evidence forever, silently
  defeating Phase G's entire purpose. Confirmed by
  `evidencePurpose.integration.test.ts`'s "cat resolves to formative" case
  failing against the live DB (`actual: null`). Fixed by centralizing the
  same name→purpose-code mapping the migration used in
  `lib/config/assessmentTypePurposes.ts` and applying it in
  `resolveOrCreateAssessmentType` at creation time — the migration's
  historical backfill is untouched, this only affects rows created from
  now on.

Verification: all 4 no-DB migration `*.safety.test.ts` suites pass (16/16);
`eslint` and `tsc --noEmit` are clean; all 13 DB-backed integration tests
across promotions, remarks, and evidence-purpose resolution pass against
the live, now-migrated database (13/13, 0 failures) — including the IDOR
fix's ownership check path and both bugs found above.

**EduNexus Learner Record Layer: APPROVED FOR MERGE.**
