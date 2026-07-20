# Sprint 8A — Projection Consumer Migration

## Implementation, following ADR-0029

**Status: Implemented.** A real migration, not another audit. `lib/attentionFeed/panel.ts` (Teacher Dashboard) no longer computes class mastery independently — three functions now read Projection's `academic.bySubject`/`bySubStrand` directly instead of legacy `learner_profiles.knowledge_state`.

---

## 1. Explicit Audit — Every Consumer, Before Any Code Touched

### Candidate 1 — Teacher Dashboard (`lib/attentionFeed/panel.ts`)

| Function | Current source | Can Projection replace it today? | If NO — exact missing field |
|---|---|---|---|
| `buildMasteryHeatmap` | Legacy `learner_profiles.knowledge_state`, keyed by free-text `"subject:substrand"` | **YES** — `academic.bySubStrand` (ADR-0024 Phase 2) provides the same per-substrand level, keyed by real `sub_strand_id`, with `subStrandTitle`/`subject` for display | — |
| `findPeerHelper`'s "is this peer strong" check | Legacy `knowledge_state`, per-substrand, requiring every recorded substrand entry for the subject ≥ level 3 | **YES**, at subject grain — `academic.bySubject[subject].latestLevel >= 3` answers the same underlying question ("is this peer strong enough in the subject to help") without the legacy check's fragile requirement that literally every recorded substrand happen to qualify | — |
| `findPeerHelper`'s `weakSubjects` derivation | Legacy `confirmed_gaps` | **NO** | `confirmed_gaps` ("weak across 2+ assessments") has no direct Projection equivalent exposed as a queryable field; deriving one would be a new computation, not a migration — deferred |
| `detectAccelerationCandidates`'s `highScores` (substrand-level-4 count) | Legacy `knowledge_state` | **YES** — `academic.bySubStrand`, filtered to `latestLevel === 4` | — |
| `detectAccelerationCandidates`'s `accelerating` (capability-dimension trend) | Legacy `capability_dimensions` | **NO** | Projection's `capability` projector has no 6-dimension breakdown (`analytical_reasoning`/`communication`/etc.) — a real, previously-documented engine gap (ADR-0029 §3.3), not touched here |
| `detectHiddenMisconceptions` | Legacy `formative_signals` (recent got_it/confused/lost outcomes) + `confirmed_gaps` | **NO** | Projection exposes aggregate *current* mastery level only — no field for "which sub-strands had a recent negative formative-signal outcome across the class." Building one would be new intelligence (a new aggregation rule), forbidden by this sprint's own scope |
| `getWeeksAtRisk` | Legacy `risk_history` | **NO** | Projection recomputes fresh on every call; it has no consecutive-weeks duration tracking (ADR-0029 §3.3, a named, real gap) |
| Every risk-level check (attention list, peer-helper gate, acceleration gate) | Already Projection (`risk.value.overallRiskLevel`) | Already migrated, prior sprint | — |

**Result: 3 of 8 consumer sites in this one file were migratable today with zero new intelligence; migrated all 3. 4 remain on legacy, each with a specific, named, real missing field — not deferred for lack of effort.**

### Candidate 2 — Permanent Learner Memory (`knowledge_state`/`risk_flags` elsewhere)

Repository-wide grep for `.knowledge_state`/`.risk_flags`/`.overall_risk_level` reads, beyond `panel.ts`:

| File | What it reads | In scope for this sprint? |
|---|---|---|
| `lib/school/intelligence.ts` (Principal Dashboard) | Per the migration ledger's own entry: risk distribution already Projection-sourced; `persistent_risk_count`/`avg_capability_dimensions` remain legacy for the same duration/6-dimension gaps named above | Not migrated — same named engine gaps, not this sprint's target (brief named Teacher Dashboard specifically) |
| `lib/knowledgeGraph/prerequisiteAlerts.ts`, `lib/attentionFeed/prerequisiteGaps.ts` | Prerequisite-graph matching, substrand-scoped — per the ledger, has no Projection equivalent (no substrand-prerequisite concept in Projection) | Out of scope — different question entirely, not a knowledge_state duplicate |
| `lib/learnerModel/queries.ts`, `lib/learnerModel/updater.ts` | The Permanent Learner Memory's own read/write layer | Correctly untouched — this is the system being migrated *away from* where duplicated, not itself a consumer to migrate |
| `app/api/cron/term-readiness/route.ts`, `app/api/teacher/monday-panel/route.ts` | Not traced line-by-line this sprint (scope discipline) | **Named as real, unaudited follow-on work**, not silently assumed clean |

**Ruling**: within `panel.ts`, every `knowledge_state` read that could be migrated without new intelligence was migrated (above). No other file was found, in this pass, reading `knowledge_state`/`risk_flags` as current-state authority in a way this sprint's narrow scope covers — the two cron/route files are named as unaudited, not cleared.

### Candidate 3 — Academic Clinic

Per ADR-0029 §3.6 (already ruled, not re-litigated here): Academic Clinic answers "what did this **one specific assessment** show" — a genuinely different question from Projection's aggregate-evidence model, not a stale duplicate of it. **Deferred, per the brief's own instruction** ("Only if it still derives knowledge directly. Otherwise defer.") — it derives a different kind of knowledge, so this sprint does not touch it.

---

## 2. Migration Performed

`lib/attentionFeed/panel.ts`:
- `buildMasteryHeatmap(profiles: LearnerProfile[])` → `buildMasteryHeatmap(projections: Map<string, LearnerIntelligenceProjection>)`. Aggregates `academic.bySubStrand` across the class instead of legacy `knowledge_state`, keyed by real `sub_strand_id` (display via `subStrandTitle`/`subject`), same averaging/threshold math as before — no new computation, only the input source changed.
- `findPeerHelper`'s strength check now reads `otherProjection.academic.value.bySubject[subject].latestLevel >= 3` instead of iterating legacy per-substrand entries.
- `detectAccelerationCandidates`'s `highScores` now reads `projection.academic.value.bySubStrand`, filtered to `latestLevel === 4`, instead of legacy `knowledge_state`.
- `detectHiddenMisconceptions`, the `capability_dimensions`/`accelerating` check, `confirmed_gaps`/`weakSubjects`, and `getWeeksAtRisk` are **untouched** — each has a named, real missing field (§1), not migrated.
- Module header comment rewritten to state the new split precisely, including the coverage caveat below.

**Public API preserved**: `buildTeacherPanel(classId, teacherId, weekOf?)` — same signature, same return shape (`TeacherPanel`). `lib/attentionFeed/sources.ts` (the only other importer) needed zero changes — confirmed by grep, it imports only `buildTeacherPanel` and a type.

**Honest coverage caveat, stated in the code and here**: `academic.bySubStrand` only has entries where confirmed Evidence carries a resolved `sub_strand_id` — a real, pre-existing curriculum-anchoring gap (ADR-0024/0025/0027 all name it), not introduced by this migration. The heatmap may show fewer rows than the legacy version did for classes whose evidence predates canonical curriculum resolution. **No fallback to the legacy field was added** — that would defeat the point of this migration and reintroduce exactly the "computes learner mastery independently" pattern this sprint exists to remove. The honest gap is preferable to a silently-duplicated one.

---

## 3. Tests

New file: `lib/attentionFeed/panel.test.ts` (first ever test coverage for this module), 9 pure unit tests, no DB:
- `buildMasteryHeatmap`: aggregates correctly across students, excludes sub-strands with fewer than 2 data points, handles an empty projections map without throwing.
- `findPeerHelper`: finds a subject-level-strong peer via Projection; never suggests an at-risk peer regardless of academic strength; returns `undefined` when no candidate clears the threshold.
- `detectAccelerationCandidates`: counts level-4 sub-strands from Projection; never flags an at-risk student; **explicitly confirms** the still-legacy `capability_dimensions` path still works (proving the deliberate non-migration didn't silently break).

```
lib/attentionFeed/panel.test.ts   9 pass, 0 fail
npx tsc --noEmit                  clean
npx eslint lib/attentionFeed/panel.ts lib/attentionFeed/panel.test.ts   clean
```

---

## 4. Exit Criteria — Assessed

> "After Sprint 8A, there should be at least one production feature that no longer computes learner mastery independently and instead reads Projection directly because Projection is now constitutionally recognized as the owner of that information."

**Met.** Teacher Dashboard's mastery heatmap and the substrand/subject-level checks inside its acceleration-candidate and peer-helper logic now read `recomputeLearnerProjection`'s own `academic` value directly — no independent mastery computation remains in those three code paths. What remains on legacy in the same file (hidden misconceptions, capability-dimension trend, risk duration) does so for named, real, unmigrated engine gaps, not because the migration was incomplete by oversight.

**Forbidden list, confirmed respected**: no new Projection fields were added (`bySubStrand` already existed, from ADR-0024 Phase 2, before this sprint). No schema changes. No duplicate computation — the legacy `knowledge_state` reads were **replaced**, not kept alongside a new Projection read. No new intelligence — every migrated function keeps its exact prior threshold/averaging logic, only the data source changed.
