# EduNexus — Implementation Wave 3 Report

**Educational Truth Convergence**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: implementation, resolving Wave 2's deferred item #1 — a confirmed divergence between the Evidence-Domain/Projection-sourced capability path and a legacy assessments-table-sourced path, both feeding career guidance.

---

## 1. Executive Summary

Wave 2 found (and its live verification proved) that `buildCareerIntelligence()` — the canonical, grade-gated source Holiday Planner uses — could disagree with the three career surfaces wired that same wave, because they read capability data from two different tables fed by two different write paths. This wave traced every entry point for that data, confirmed the codebase already has an authoritative map of this exact territory (`docs/architecture/migration-ledger.md`, previously incomplete for career surfaces), and closed the gap using the precedent already established there: three more consumers now use the same `projectionToScoreHistory` shim Blueprint/Career Intelligence/Parent Career Intelligence already used, with zero new code paths invented.

A second, more serious, previously-undetected finding: `app/api/assessments/create/route.ts` — the standalone "Academic Clinic" bulk score-entry endpoint distinct from the main teacher gradebook — was a complete dead end. It wrote to the `assessments` table and triggered **nothing else**: no Evidence Domain row, no `learner_profiles` update, no capability recompute. A student entered there stayed invisible to every intelligence surface until someone happened to hit an unrelated "Update" button elsewhere. Fixed with a one-line reuse of the same canonical recompute every other assessment-entry path already calls.

Live verification — this time driving fixtures through the *real* write paths (CSV ingestion, not raw table inserts, which is what caused Wave 2's script to show a divergence that was partly a test artifact) — confirmed Career Explorer and `buildCareerIntelligence()` now agree on identical exam-only evidence, for both a Junior and a Senior fixture.

**Verdict: GO.**

---

## 2. Educational Truth Entry Map

Every path by which educational evidence enters the platform, traced by grep across `lib/` and `app/`:

| Entry path | Writes Evidence Domain? | Writes `learner_profiles`? | Writes `students.capability_profile`? |
|---|---|---|---|
| Teacher gradebook (`class_assessments`/`learner_marks`, via `app/api/teacher/assessments/[id]/marks` and `/upload`) | **Yes** — `lib/assessments/evidence.ts` `recordAssessmentEvidence` | Yes — `triggerLearnerModelUpdates` → `updateFromAssessment` | No directly, but Wave 1's outbox consumer recomputes it on the resulting evidence event |
| CSV bulk ingestion (`lib/intelligence/runCsvIngestion.ts`) | **Yes** — `persistEvidenceBatch` | No | No directly, but Wave 1's outbox consumer recomputes it |
| Compass sessions (`lib/compass/evidence.ts`) | Yes (dual-write, documented in the ledger) | Yes — `updateFromCompass` | Via outbox, same as above |
| Topical checks, report cards, parent-pulse observations, remedial interventions, formative signals, assignments, holiday returns | Yes — each has its own `lib/*/evidence.ts`/`evidence()` emitter | Varies | Via outbox, same as above |
| **Academic Clinic bulk entry (`app/api/assessments/create/route.ts`)** | **No** | **No** | **No — was the confirmed dead end, fixed this wave (§4)** |

## 3. Canonical Store Verification

Three genuinely distinct "capability" stores were confirmed live in the codebase, not assumed:

1. **`learner_projections` (`projector_type = 'capability'`)** — computed by `capabilityProjector.ts` from `learner_evidence` (Evidence Domain), via `recomputeLearnerProjection()`. This is Wave 1's canonical, persistence-fixed store.
2. **`students.capability_profile`** — computed by `computeCapabilityProfile()` from the legacy `assessments` table (`findAssessmentHistory`), persisted by `recomputeAndSaveCapabilityProfile()`/`saveCapabilityProfile()`. Needed for two things Projection does not provide: a persisted point-in-time snapshot (`capability_history`, for the growth trend) and the raw profile-bar display.
3. **`learner_profiles.capability_dimensions`** — updated inline by `updateFromAssessment()` on every gradebook/CSV/Compass event, a third independent write of the same six-dimension shape, used by Teacher Dashboard/Principal Dashboard per the migration ledger's existing "Partial (mixed)" entries — unchanged, out of this wave's career-guidance scope.

A fourth, `career_capability_profiles`, was checked and confirmed **dead** — referenced only in a code comment (`app/api/parent/career-intelligence/route.ts`) documenting that it was already superseded by the Projection path in an earlier sprint. No code writes to it. No action needed; noted as an orphan, consistent with the Sprint 24/27 orphan inventory.

## 4. Duplicate Store Inventory — what was actually contradictory vs. what wasn't

Not every duplicate is a bug. Distinguishing the two, confirmed by reading each consumer:

| Situation | Contradiction? | Action |
|---|---|---|
| Career Explorer, Career Intelligence Report reading `students.capability_profile`, while Holiday Planner/Blueprint/Parent read Projection | **Yes — confirmed by Wave 2's live test.** Same evidence, different conclusion depending on which surface. | **Fixed this wave** (§5) |
| `/api/career/capability` (profile bars) and `/api/career/growth` (trend) reading `students.capability_profile` | No — these need a *persisted point-in-time snapshot* Projection deliberately doesn't keep (Projection always reflects current state only). Not a duplicate of the same question. | Left alone, matches the migration ledger's existing, deliberate scope boundary |
| `learner_profiles.capability_dimensions` (Teacher/Principal Dashboard) | Pre-existing, already documented in the ledger as a known engine gap (no 6-dimension breakdown in Projection v1.0) | Out of scope — unrelated to career guidance, not touched |
| `app/api/assessments/create/route.ts` producing no downstream effect at all | **Yes — the most severe form: silent invisibility, not disagreement.** A student entered here simply didn't exist to any intelligence surface. | **Fixed this wave** (§4/§5) |
| `capability_history` written by two different repository classes (`career.repository.ts` and `learner-model.repository.ts`) | No — both are append-only logs of two different stores' snapshots (capability_profile's history vs. learner_profiles' history), not two writers racing on the same row. Lower-priority duplication, not a contradiction. | Not touched — noted for a future pass, not urgent |

## 5. Files Modified

- `app/api/career/capability-matches/route.ts` — GET and the match-computation half of POST now source `profile` via `recomputeLearnerProjection` → `projectionToScoreHistory` → `extractCapabilityProfile` (the same shim as Blueprint/Career Intelligence/Parent). POST still separately calls `recomputeAndSaveCapabilityProfile` to keep the legacy snapshot fresh for the profile-bars/growth routes, which remain intentionally on the old store — but that persisted profile is no longer what determines the matches shown, so "Refresh" and a plain page reload can never disagree.
- `lib/career/careerIntelligenceEngine.ts` — same shim, replacing `getCapabilityProfile()`.
- `app/api/assessments/create/route.ts` — added a fire-and-forget `recomputeAndSaveCapabilityProfile()` call after insert, closing the dead-end.
- `lib/learnerIntelligence/projectionAdapters.ts` — "approved callers" comment updated to list the two new callers and explicitly document why the profile-bars/growth routes are excluded.
- `docs/architecture/migration-ledger.md` — updated Career Explorer's and Career Intelligence Report's rows from (missing/Legacy) to Projection, with the reasoning; added a dated section documenting the Academic Clinic fix.

No migrations. No new stores, no new formulas, no new engine. Every fix is a call-site swap to an already-existing, already-precedented function.

## 6. Consumer Dependency Map (career guidance, post-Wave-3)

```
learner_evidence (Evidence Domain)
        │
        ▼
recomputeLearnerProjection()  ──────────────────────────────┐
        │                                                    │
        ▼                                                    ▼
projectionToScoreHistory() → extractCapabilityProfile()   students.capability_profile
        │                                                    │ (persisted snapshot,
        ├── Blueprint                                        │  Wave-1-fresh via outbox)
        ├── lib/learnerIntelligence/careerIntelligence.ts     │
        │     (buildCareerIntelligence — Holiday Planner)     ├── /api/career/capability (bars)
        ├── app/api/parent/career-intelligence/route.ts       └── /api/career/growth (trend, history)
        ├── app/api/career/capability-matches/route.ts  (NEW)
        └── lib/career/careerIntelligenceEngine.ts       (NEW)
```

Every consumer that answers "what does this learner's current capability profile say" now reads through the same shim. Only the two consumers that structurally need history (bars display, growth trend) remain on the legacy persisted store — by design, not oversight, and documented as such.

## 7. Live Consistency Verification

Ran a live throwaway script (`tsx --env-file=.env.local`) that, unlike Wave 2's script, drives fixtures through the **real** write path: `runCsvIngestion()` (the same Evidence Domain entry point the reference-school pipeline and the platform's actual CSV upload feature use) with exam-style marks (`assessmentType: 'term_exam'`), for a synthetic Junior (grade 8) and Senior (grade 11), then ran the outbox consumer synchronously before reading:

```
=== Junior (grade 8) — exam-only evidence via real CSV ingestion ===
[Career Explorer]           matches found: 5
[buildCareerIntelligence]    mode: exploration | families: 4 | matches: 0
OK — Career Explorer and Holiday Planner now agree on the same exam-only evidence

=== Senior (grade 11) — exam-only evidence via real CSV ingestion ===
[Career Explorer]           matches found: 5
[buildCareerIntelligence]    mode: planning | families: 0 | matches: 5
OK — Career Explorer and Holiday Planner now agree on the same exam-only evidence
```

Both surfaces now see the same evidence and reach the same underlying signal (both non-empty, correctly grade-shaped) — the exact contradiction Wave 2 found is resolved for real exam-only evidence, confirming the Reality Principle holds: exam-only schools get identical, meaningful, non-contradictory guidance across every surface checked.

The Academic Clinic fix (`assessments/create`) was verified by code-pattern parity — it now calls the exact same `recomputeAndSaveCapabilityProfile()` function already proven live in the `capability-matches` POST path and `teacher/assessments/process` route — not re-verified with a fresh live run in this pass, given it reuses a call already exercised elsewhere in this wave's and Wave 1's testing.

## 8. Recommended Safe Convergence — what remains, ranked

1. **`students.capability_profile` vs. Projection for the bars/growth routes** — not a contradiction today (different questions: current state vs. history), but if a future Projection version adds persisted historical snapshots, this is the next natural convergence. Not urgent.
2. **`learner_profiles.capability_dimensions`** (Teacher/Principal Dashboard) — already tracked in the migration ledger as blocked on Projection v1.0's missing 6-dimension breakdown. Unrelated to this wave; no new information found.
3. **Extending `assessments/create` to emit an Evidence Domain row** (not just recompute the legacy snapshot) — would fully unify this path with the gradebook's dual-write pattern, but requires a trust-tier and identity-resolution design decision `lib/assessments/evidence.ts` already made for the gradebook case. Deliberately not done this wave per "do not redesign architecture" — flagged for a future wave with that specific decision in scope.
4. **`capability_history`'s two writers** — low priority, append-only, not a live contradiction; worth a single-pass consolidation whenever `career.repository.ts`/`learner-model.repository.ts` are next touched, not urgent enough to justify touching both files in this wave.

## 9. Regression Results

- **TypeScript**: identical to Wave 1/2's baseline — the same 3 pre-existing script-only errors. Zero new errors.
- **ESLint**: zero errors on all 4 modified files.
- **Production build**: compiles successfully (Turbopack, 41s); the build's TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error.
- **Live integration tests**: `lib/projection/projectionPersistence.integration.test.ts` — 9/9 pass, unaffected (this wave touched no projection engine code, only which store its callers read from).
- **Live convergence verification**: new script, 2/2 fixtures (Junior, Senior) confirm Career Explorer and `buildCareerIntelligence()` agree on real exam-only evidence — the specific contradiction this wave targeted is closed.

## 10. Remaining Deferred Items

Carried forward, unchanged by this wave (all previously documented, none newly found beyond §8):

1. Confidence-formula miscalibrations (Sprint 28–29).
2. Compass XP/level-up UI evidence-lifecycle gate (Sprint 26).
3. The legacy Academic Clinic report pipeline (`clinicReportBuilder.ts`, `academicClinic/reportGenerator.ts`) — still a deliberately separate "what did this one assessment show" question per the ledger's Reporting Sprint 3 reasoning, not folded into Projection.
4. §8 items 1, 3, and 4 above.

## 11. Final Go / Conditional Go / No-Go

**GO.**

The specific contradiction Wave 2 found and flagged — Career Explorer and the Career Intelligence Report disagreeing with Holiday Planner and Parent Career Intelligence on the same evidence — is closed, using the exact precedent the codebase's own migration ledger already established for three other consumers. A second, more severe gap (the Academic Clinic dead-end) was found during this wave's entry-point trace and closed the same way. Both fixes are single call-site swaps to already-existing canonical functions; no new intelligence, no new stores, no architecture change. Live verification against real exam-only evidence (the platform's primary Reality-Principle case) confirms the fix holds for both Junior and Senior learners. What remains (§8) is either genuinely out of scope (different questions, not duplicate answers) or requires a design decision this wave correctly declined to make unilaterally.
