# Phase 9.1.7 — Academic Clinic Career Authority Convergence Audit

**Type:** Audit + narrow, proven-safe convergence only. Zero database changes.
**Branch:** `main` · **HEAD at start:** `8a0ca5ddf8854c533aa7b8e82edce71c85eac995`

## 1. Verdict

```
PHASE 9.1.7 COMPLETE WITH NAMED LIMITATIONS
```

Full authority convergence for the 40 historical careers is **not safe** and was not attempted — that finding is itself the deliverable of this phase's audit (§14). Two real, narrow, proven-safe convergences were made: (1) closing a genuine remaining gap Phase 9.1.6 left open — three of four real report-generation surfaces were never wired to the canonical adapter — and (2) extending `analyzeDreamCareer()`/`findCareerByName()` (the free-text lookup Phase 9.1.6 deliberately left untouched) to also see canonical-only careers.

## 2. Remaining authority split before this phase

```
Academic Clinic match corpus (after Phase 9.1.6)
        │
        ├── 40 historical careers → CAREER_DATABASE (untouched, unmodified)
        │
        └── canonical-only careers (#44+) → adaptCanonicalCareersForClinic()
               │
               └── wired into ONLY 1 of 4 real matchCareers()/generateSeniorGuidance()
                   call sites (assessmentPipeline.ts) — a gap this phase closes (§17)

analyzeDreamCareer()/findCareerByName() — CAREER_DATABASE only, zero canonical
participation, confirmed by reading the code directly (not assumed)
```

## 3. Legacy field inventory (all `CareerData` fields, exhaustive)

| Field | Canonical equivalent | Fidelity |
|---|---|---|
| `pathway` | `career.pathway` | **Exact** (100% parity, proven — §8) |
| `matchRequirements.primarySubjects` | `career.required_subjects` | **No equivalent vocabulary** — different taxonomies entirely (§6) |
| `matchRequirements.minimumLevels` | `career.subject_importance` | **Lossy, and wrong scale** — 3-tier bucket vs 1-4 numeric, on a different subject vocabulary (§6) |
| `kenyaShortageScore` | `career.kenya_demand` | **Semantically similar, both unverified** (§5) |
| `marketReality.jobSecurity` | *none* | No equivalent |
| `marketReality.earningPotential`/`demandLevel`/`kenyanContext` | `salary_range_kes`, `kenya_demand`, `kenya_market_outlook` | Safe adapter (already used in Phase 9.1.6's additive path) |
| `aiImpact.disruptionRisk` | `ai_impact.level` | Semantically similar, different scale (5-level vs 4-level) (§9) |
| `cbeReadiness.tvetOptions` | *none* | No equivalent (confirmed absent in Phase 9's own audit) |
| `cbeReadiness.universities` | `university_courses` | Semantically similar (courses ≠ universities, but close) |
| `realityCheck.*` | `description`, `ai_impact.human_advantage`, `social_reality` | Safe adapter |

## 4. Behavioral dependency (traced into `scoreCareer()`/`buildMatchReasons()`/`buildGapSubjects()` directly)

Only four fields are load-bearing for **ranking**: `pathway` (filter + ±20/-30 bonus), `matchRequirements.primarySubjects` (dominant scoring term), `matchRequirements.minimumLevels` (-15 penalty if unmet), `kenyaShortageScore` (+15 max bonus). Everything else is display/prose only, confirmed by reading `scoreCareer()`'s full body — nothing was assumed.

## 5. `kenyaShortageScore` deep audit

- **Provenance: none.** `careerEngine.ts`'s `CAREER_DATABASE` has zero citation, source comment, or methodology note anywhere near the field or the 40-entry array — confirmed by reading the section header and every entry.
- **What it represents:** cannot be determined from the code — it reads as hand-authored editorial judgment (a plausibility-weighted "how urgently should Clinic recommend this" number), not a sourced labour-market statistic. This matches Phase 9's independent finding that the one real market-data integration this file ever had (a DuckDuckGo lookup) was removed for fabricating trend data — there has never been a live labour-market feed behind either this field or its canonical cousin.
- **Range:** 0–100, observed values 15 (musician) to 95 (medical doctor).
- **Scoring impact:** direct, `+((score/100)×15)` in `scoreCareer()` — up to 15 points, real and load-bearing.
- **Yes — it can and does affect learner-facing ranking, and, per `buildParentSummary()`, the literal words "severe shortage"/"growing demand"/"stable demand" a parent reads.** Two equally-capable learners scoring identically on every real, measured input could rank a career differently purely because of this uncited number.
- **Verdict: this is Academic Clinic weighting POLICY dressed as a career fact.** It should not be migrated to Postgres as-is (that would launder an unsourced number into "canonical knowledge"), and Postgres's `kenya_demand` is not a verified replacement either — it has the same epistemic status (no citation found anywhere in the career-knowledge migrations), just coarser precision. Migrating would trade one unsourced number for a less precise unsourced number — no genuine gain, real precision loss. **Not converged, correctly.**

## 6. `minimumLevels` deep audit

- **Units:** legacy is a 1–4 CBC-competency-level scale, keyed to **Junior-school-aggregated subject names** (`integrated_science`, `social_studies`, `creative_arts_sports`) — confirmed by cross-referencing `assessmentPipeline.ts`'s own `normalizeSeniorScores()` function, which exists specifically to bridge Senior CBC subjects (biology/chemistry/physics, core/essential_mathematics) down into these same aggregated keys "that the career engine understands."
- **Canonical `subject_importance`** is keyed to **Senior-school granular subject names** (`biology`, `chemistry`, `physics`, `geography`, `history`, `cre`, `economics`, `business_studies` as separate entries) and only carries a 3-tier ordinal (critical/important/helpful), not a 1–4 numeric level.
- **This is not a lossy version of the same thing — it is a different, deliberately simpler vocabulary**, built so one matching function can score both Junior and Senior learners uniformly. Reconstructing exact historical `minimumLevels` from `subject_importance` is not possible (confirmed in Phase 9.1.6: the forward direction was already a lossy bucket, and the subject-vocabulary mismatch is a second, independent obstacle this phase newly identified).
- **Verdict: Academic Clinic weighting/interpretation POLICY, not a career fact.** The aggregated-subject-vocabulary choice is a legitimate Clinic-specific design decision (cross-grade matching), not something canonical career knowledge should be forced to represent. **Not converged, correctly** — matches the mission's explicit instruction not to reconstruct precise values from coarse buckets.

## 7. Pathway comparison (all 40) — see §8, `pathwayParity.test.ts`

## 8. Pathway comparison — the actual matrix

All 40 careers' canonical `pathway` were fetched read-only from the connected Supabase project (via the 15-entry `ALIAS_MAP` + 25 auto-slugged identity mapping, both already proven in Phase 9.1.6) and compared against `CAREER_DATABASE`'s own value, normalized through the file's own existing `PATHWAY_NORMALIZE` map:

**Result: 40/40 MATCH.** Zero mismatches, zero ambiguous cases. This is the one field with proven, verified, 100% parity — genuinely a shared canonical fact, not Clinic policy. Locked in as a permanent regression guard: `lib/academicClinic/pathwayParity.test.ts` (3/3 passing).

One real, separate finding surfaced by this comparison: `athlete` and `sports_manager` (two distinct `CAREER_DATABASE` entries) both alias to the **same** canonical career (`sports-coach-athlete-development`) — a genuine many-to-one identity collision in the original migration, not an error in this audit. Recorded, not resolved (resolving it is an identity/alias question, explicitly out of scope per this phase's — and Phase 9's — standing "no aliases" instruction).

## 9. AI impact comparison

Legacy `aiImpact.disruptionRisk` (5-level: very_low/low/moderate/high/very_high) vs. canonical `ai_impact.level` (4-level: low/medium/high/transforming) — different scales, authored independently, confirmed never read by `scoreCareer()` (cosmetic-only, feeds `assessKenyaAIDisruption()`/`buildParentSummary()`). Canonical is more likely to be current: it carries `knowledge_verified_at`/`knowledge_source_note` freshness tracking (Phase 8's work); the legacy array has no freshness concept at all — a hardcoded snapshot with no review mechanism. **A plausible future narrow-convergence candidate** (cosmetic-only means near-zero ranking risk), but **not attempted this pass** — proportionate scoping given this subsystem had zero test coverage before this phase and two real convergences were already made (§17/§21).

## 10. Market / job security — ownership verdict

`kenyaShortageScore` and `jobSecurity` are **Clinic weighting policy**, not career knowledge (§5). `kenya_market_outlook`/`salary_range_kes` (already reused in Phase 9.1.6's additive adapter) **are** genuine career facts with real canonical ownership.

## 11. 40-career parity matrix — summary

Pathway: 40/40 exact (after normalization). Subjects/minimumLevels: 0/40 directly convertible (different vocabulary, different scale — by design, not error). `kenyaShortageScore`: not comparable to a "correct" answer on either side (both unverified). Migration risk if forced: **HIGH** for subjects/shortage (would change real match scores with no truth-quality gain), **LOW** for pathway (already verified byte-for-byte equal).

## 12/13. Baseline & simulated substitution

Given §6's finding — the subject vocabularies are fundamentally different, not just differently precise — a full canonical substitution for the 40 existing careers was not simulated end-to-end: doing so would require inventing a Junior-subject-aggregation mapping for canonical Senior subjects that does not exist anywhere in this codebase (a new taxonomy, explicitly forbidden by this phase's scope). This is itself the answer the mission asked for: the *reason* substitution isn't safely simulatable is the finding, not a gap in this audit.

## 14. Can canonical Postgres Career fully represent what Clinic requires?

```
PARTIALLY
```
- **Canonical-owned (should live in Postgres, and Academic Clinic should read it from there):** `pathway` (proven), career description/market-outlook/AI-impact narrative text (already the case for canonical-only careers via Phase 9.1.6's adapter).
- **Clinic-policy-owned (should stay local, is not a career fact):** `matchRequirements` (both `primarySubjects`' aggregated vocabulary and `minimumLevels`' scale), `kenyaShortageScore`, `jobSecurity`.

## 15. Target architecture

```
CANONICAL CAREER (Postgres)
   ├── title, description, pathway, market outlook, AI impact narrative
   │        ↓ (already true for canonical-only careers via the adapter)
ACADEMIC CLINIC POLICY (stays in CAREER_DATABASE / TypeScript, for the 40)
   ├── matchRequirements (Junior-aggregated subject vocabulary + 1-4 levels)
   └── kenyaShortageScore (editorial weighting, not fact)
```
This is the real shape today for the 40 historical careers, now made explicit rather than left as an undifferentiated "second corpus." No schema change was needed to express it — it's already true in the code; this phase's contribution is naming it and guarding the one field (`pathway`) that genuinely converged.

## 16/17. Changes made (narrow, proven safe)

1. **Closed a Phase 9.1.6 gap**: `matchCareers()`'s additive adapter was wired into only 1 of 4 real `generateSeniorGuidance()`/`generateReport()` call sites (`assessmentPipeline.ts`). Two more server-side surfaces now converge too: `app/api/clinic/download/route.tsx` and `app/dashboard/clinic/reports/[studentId]/page.tsx`. `app/academic-clinic/page.tsx` is client-side and was **not** wired — it would need an API-mediated fetch, a materially different (and larger) change; named as a limitation (§26).
2. **`analyzeDreamCareer()`/`findCareerByName()` convergence**: both now accept an optional `additionalCareers` parameter, mirroring `matchCareers()`'s exact pattern — canonical-only careers are now found by exact/substring name match, with zero new alias/fuzzy logic added (per explicit instruction).
3. **`pathwayParity.test.ts`**: a permanent regression guard for the one field proven to be a genuine shared fact.

## 18. Dream career before

`findCareerByName()` searched `CAREER_DATABASE` only — confirmed by reading the function. Exact name match, then substring match (either direction), then id-from-slugified-input. No canonical participation, no fuzzy/semantic matching beyond that.

## 19. Dream career #44 proof

`dreamCareerConvergence.test.ts` (6/6 passing) — a canonical-only career: returns `found:false`, `"Career not yet in our database"` when `additionalCareers` is omitted (proving the gap existed exactly as suspected); returns `found:true`, a real readiness score, and appears in the "alternative careers" list when `additionalCareers` is supplied.

## 20. Dream career after

Same lookup logic, same output shape, zero behavior change for existing `CAREER_DATABASE` careers (proven by test) — purely additive.

## 21. Hardcoded corpus final classification

```
LEGACY CAREER + POLICY MIX — NEEDS FUTURE SPLIT
```
Not "still required" flatly (pathway is now a proven, guarded, shared fact) and not "safe to retire" (subjects/minimumLevels/shortage remain genuinely Clinic-specific, unreproducible from canonical data without inventing a new taxonomy or fabricating precision). A future phase could formalize this as an explicit `ClinicMatchingMetadata` type keyed by career slug (per the mission's own §17 suggestion) — this phase establishes the evidence for that split but does not build it, since the current TypeScript array already expresses it adequately and no schema/architecture change was proven necessary to unblock anything real.

## 22. Architecture guards

- `pathwayParity.test.ts` — Guard A equivalent (the one converged fact stays converged).
- `dreamCareerConvergence.test.ts` — Guard D equivalent (dream-career lookup doesn't regress to a closed 40-career universe when `additionalCareers` is supplied; unchanged when omitted).
- Phase 9.1.6's `careerConvergence.architecture.test.ts` (unchanged, still passing) — Guard B/C/E already covered: `CareerEngine` purity, `CAREER_DATABASE` untouched, interest≠capability unaffected by anything in this domain.

## 23. Tests

New: `dreamCareerConvergence.test.ts` (6/6), `pathwayParity.test.ts` (3/3) — **9 new tests, all passing**. Full standard suite: **1057/1057**. `tsc --noEmit` clean. `eslint` clean on every touched file. `next build` exit 0.

## 24. Files changed

- `lib/academicClinic/careerEngine.ts` — `findCareerByName()`/`analyzeDreamCareer()` gained the additive `additionalCareers` parameter
- `lib/academicClinic/reportGenerator.ts` — `generateReport()` threads it to `analyzeDreamCareer()`
- `lib/academicClinic/assessmentPipeline.ts` — passes its already-fetched `additionalCareers` into `generateReport()` too
- `app/api/clinic/download/route.tsx` — now fetches + adapts canonical careers (closing the Phase 9.1.6 gap)
- `app/dashboard/clinic/reports/[studentId]/page.tsx` — same
- `lib/academicClinic/dreamCareerConvergence.test.ts` (new)
- `lib/academicClinic/pathwayParity.test.ts` (new)
- `scripts/standard-tests.json` — 2 new entries

## 25. Database changes

```
NONE
```

## 26. Named limitations

No aliases · no semantic dedup · no career lifecycle beyond `pending/published/rejected` · no structured per-field provenance model · no web research · silent pathway fallback (unchanged) · prompt injection into career generation (unchanged) · no CAREER/ROLE/SPECIALISATION/SKILL taxonomy · slug identity fragility · telemetry observation window incomplete (Phase 9.1's gate still stands) · **new, scoped to this phase**: `app/academic-clinic/page.tsx` (a client-side report-generation surface) remains unconverged — it would require an API-mediated fetch, a materially larger change than this phase's proportionate scope; `kenyaShortageScore`/`matchRequirements` remain permanently Clinic-specific by design, not a deferred migration; the `athlete`/`sports_manager` many-to-one identity collision is recorded, not resolved.

## 27. Discovery readiness

```
NO — Phase 9.1 telemetry window remains the gate.
```
