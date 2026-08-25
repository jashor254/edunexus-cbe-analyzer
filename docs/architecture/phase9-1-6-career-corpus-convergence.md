# Phase 9.1.6 — Career Corpus Convergence

**Type:** Additive convergence, not a rewrite. Zero database changes.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`

## 1. Verdict

```
PHASE 9.1.6 COMPLETE WITH NAMED LIMITATIONS
```

The convergence goal — a canonical Postgres career reaches Academic Clinic without a code edit — is achieved and proven. The limitation is scope, not failure: full behavioral parity for the 40 *existing* CAREER_DATABASE careers was deliberately not attempted, because it isn't safely achievable without either fabricating data or changing their scores (see §7).

## 2. Pre-fix corpus map — corrected from the Phase 9 framing

`scripts/migrate-academic-careers-to-supabase.ts` (a completed one-off migration, read in full) revealed the split is narrower than "two independently-authored 40-vs-43 corpora": **all 40 `CAREER_DATABASE` entries already have a corresponding Postgres row** — 15 under a pre-existing slug (its `ALIAS_MAP`), 25 migrated directly from `CAREER_DATABASE` itself by that script. The real gap is that `CareerEngine.matchCareers()` still iterates the **frozen snapshot**, so anything published to Postgres *after* that migration (career #44 onward, or an edit to an existing row) is invisible to Clinic — confirmed and reproduced.

## 3. Corpus inventory

- `CAREER_DATABASE`: exactly 40 entries (confirmed by test, `Guard C`).
- Identity mapping: 15 exact aliases (`ALIAS_MAP`) + 25 auto-slugged (`id.replace('_','-')`) = 40/40 accounted for. No ambiguous cases — the migration script's own mapping is the ground truth, not inferred.

## 4. Clinic field dependency (exhaustive, traced not assumed)

`matchCareers()`'s scoring (`scoreCareer()`) is load-bearing on exactly four fields: `pathway`, `matchRequirements.primarySubjects`, `matchRequirements.minimumLevels`, `kenyaShortageScore`. Everything else (`marketReality.*`, `cbeReadiness.*`, `aiImpact.*` beyond what feeds display, `realityCheck.*`) is cosmetic — read only by `enrichWithMarket`/`buildParentSummary`/`assessKenyaAIDisruption`, never by the ranking algorithm itself.

## 5/6. Canonical field mapping — see `lib/academicClinic/canonicalCareerAdapter.ts`

| Clinic field | Canonical source | Classification |
|---|---|---|
| `pathway` | `career.pathway`, normalized (`'Arts & Sports Science'`→`'Arts & Sports'`) | Direct match |
| `matchRequirements.primarySubjects` | `career.required_subjects` | Direct match |
| `matchRequirements.minimumLevels` | `career.subject_importance` (critical→4/important→3/helpful→1) | Safe adapter — **omits** subjects with no `subject_importance` entry rather than guessing (proven never treated as pass/fail — `Object.entries(...).every(...)` skips omitted keys) |
| `kenyaShortageScore` | `career.kenya_demand` (critical_shortage=90/undersupplied=65/balanced=40/saturated=15/unknown=0) | Safe adapter — real signal, coarser precision, documented |
| `marketReality.kenyanContext`, `realityCheck.typicalDay`, `aiImpact.timeline/survivalStrategy/pros` | `kenya_market_outlook`, `description`, `ai_impact.*`, `future_skills` | Direct/safe adapter — genuine canonical fields |
| `cbeReadiness.tvetOptions`, `marketReality.jobSecurity`, `aiImpact.growthPercentage` | *none exists* | **Missing** — honest neutral default (empty array / `'moderate'` / `0`), never fabricated precision |

## 7. Convergence strategy: Option A (adapter), additive only — not a rewrite

Rewriting the 40 existing careers to read from Postgres was evaluated and rejected: `kenyaShortageScore` was **never written to Postgres at all** by the original migration, and `minimumLevels`' exact numeric values only survive as a lossy 3-tier `subject_importance` bucket — switching them over would silently change their match scores, violating the explicit "preserve semantics" requirement. `lib/academicClinic/careerEngine.ts`'s own header comment independently confirms this catalog was *already* deliberately left as-is once, calling a full migration "a larger migration, not a hardening fix." The adapter therefore only converts canonical careers `CAREER_DATABASE` does **not** already represent, and `matchCareers()` scores `[...CAREER_DATABASE, ...additionalCareers]` — a pure array concatenation, zero mutation of the original 40.

## 8. Career #44 proof

`lib/academicClinic/careerConvergence.test.ts` — a synthetic canonical-only career (never in `CAREER_DATABASE`) is adapted and fed into the real `matchCareers()` and the real `generateSeniorGuidance()` (the PDF-facing function): it scores correctly, respects pathway filtering, and appears in `topCareers` when it qualifies on merit — **without any code or deploy change**, exactly the acceptance criterion. **5/8 tests in this file are dedicated to this and the semantics-preservation proof (§9); all pass.**

## 9. Teacher & parent Clinic proof

Both `app/api/teacher/assessments/process/route.ts` and `app/api/parent/assessments/process/route.ts` call the same `runAssessmentPipeline()`, which now fetches (`repos.careers.getAllCareersWithCOS()`) and adapts canonical careers once, then threads them through **both** of `generateSeniorGuidance()`'s and `analyze()`'s internal `matchCareers()` calls (they share one implementation) — so both the parent-visible and teacher-visible report paths converge identically, by construction, not by separately verifying two code paths that happen to agree. Existing-career ranking is proven byte-identical (§7 test).

## 10. Partial-data behavior — no fabricated defaults

Every honest-default choice is documented inline in `canonicalCareerAdapter.ts` and covered by `canonicalCareerAdapter.test.ts`: missing `subject_importance` entries are **omitted** (not defaulted); unknown `kenya_demand` gets `0`, not a guessed middle value; fields with no canonical equivalent at all (`tvetOptions`, `jobSecurity`) get an explicitly-neutral, clearly-commented placeholder that is never read by the scoring algorithm.

## 11–13. Pathway authority, hardcoded corpus status, historical reports

- **Pathway:** `career.pathway` (text) confirmed authoritative — it's the only field any application code reads; `pathways` (legacy jsonb) is never resurrected here.
- **`CAREER_DATABASE` status: STILL REQUIRED FOR NAMED FIELDS** — `kenyaShortageScore` and precise `minimumLevels` have no canonical source; the array is unmodified and remains the sole source for its 40 careers. Not a candidate for removal.
- **Historical reports:** `assessmentPipeline.ts`'s report generation was traced — it builds a fresh `report` object per run and hands it to `generateAcademicClinicPDF()`/notification senders; nothing re-reads or rewrites a *previous* stored report. This phase's change only affects reports generated from this point forward — old PDFs already sent are untouched (unread by this phase entirely).

## 14–17. Boundary regressions (proven, not asserted)

- **Career Signals:** untouched — no file in `lib/career/careerSignals.ts` or its dependents was modified.
- **Interest boundary:** `saveCareerInterest()` untouched.
- **Blueprint:** untouched — Blueprint's career reads go through `lib/learnerIntelligence/careerIntelligenceOrchestration.ts`, which imports nothing from `lib/academicClinic/**` (confirmed, unchanged).
- **Compass:** untouched — the existing `blueprintCompassConvergence.architecture.test.ts` (already in the standard suite) still passes; this phase added no import between `lib/compass/**` and `lib/academicClinic/**`.

## 18. Query / performance impact

One additional `repos.careers.getAllCareersWithCOS()` call per pipeline run, gated behind `if (!isJunior)` (Seniors only, the only branch that ever calls `generateSeniorGuidance`) — a single bulk read, not one query per matched career. No N+1 introduced.

## 19. Architecture guard

`lib/academicClinic/careerConvergence.architecture.test.ts`, 5 tests: adapter purity (no Supabase/repository import), `CareerEngine` purity (zero I/O — unchanged), `CAREER_DATABASE` untouched (exact entry count + content spot-check), the adapter never returns raw `CAREER_DATABASE` entries, and the pipeline's failure path is explicit/logged, not silent.

## 20. Tests

New: `canonicalCareerAdapter.test.ts` (8/8), `careerConvergence.test.ts` (8/8), `careerConvergence.architecture.test.ts` (5/5) — **21 new tests, all passing**, added to `scripts/standard-tests.json`. Full standard suite: **1048/1048**. `tsc --noEmit` clean. `eslint` clean on every touched/new file. `next build` exit 0.

This is also the **first automated test coverage `lib/academicClinic/**` has ever had** — confirmed zero pre-existing tests for this subsystem before this phase.

## 21. Files changed

- `lib/academicClinic/canonicalCareerAdapter.ts` (new) — the pure adapter
- `lib/academicClinic/canonicalCareerAdapter.test.ts` (new)
- `lib/academicClinic/careerConvergence.test.ts` (new)
- `lib/academicClinic/careerConvergence.architecture.test.ts` (new)
- `lib/academicClinic/careerEngine.ts` — `matchCareers()` gained an optional 5th param, default `[]`, byte-identical behavior when omitted
- `lib/academicClinic/reportGenerator.ts` — `generateSeniorGuidance()` gained the same optional param, threaded through
- `lib/academicClinic/assessmentPipeline.ts` — fetches + adapts canonical careers once (Seniors only), passes to `generateSeniorGuidance()`; explicit logged fallback to `[]` on fetch failure
- `scripts/career-corpus-audit.ts` — header comment updated to describe what changed (documentation only, no logic)
- `scripts/standard-tests.json` — 3 new entries

## 22. Database changes

```
NONE
```
Confirmed: the connected Supabase project was queried read-only before and after this phase and is unchanged.

## 23. Named limitations

Two disconnected career corpora — **narrowed, not eliminated**: the 40 existing overlapping careers remain two independently-scored authorities; only *net-new* canonical careers are unified · no aliases · no semantic dedup · no career lifecycle beyond `pending/published/rejected` · no structured per-field provenance model · no web research · silent pathway fallback (unchanged) · prompt injection into career generation (unchanged) · no CAREER/ROLE/SPECIALISATION/SKILL taxonomy · slug identity fragility · **new, scoped to this phase**: `analyzeDreamCareer()`/`findCareerByName()` (the free-text "dream career" lookup) were deliberately left unconverged — still `CAREER_DATABASE`-only — to keep this phase's surface area proportionate to its zero-prior-test-coverage risk.

## 24. Open-discovery readiness

```
NO — telemetry observation window still required.
```
This phase makes the platform's own canonical data reach one more previously-blind surface. It adds no evidence about real learner demand for careers outside the existing corpus and doesn't change Phase 9.1's observation-window recommendation.
