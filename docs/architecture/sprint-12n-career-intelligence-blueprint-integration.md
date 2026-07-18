# Sprint 12N — Career Intelligence ↔ Learner Blueprint Integration

**Status: implemented.** Integration only — Career Intelligence's own calculations, matching engine, and evidence pipeline are untouched.

---

## 1. Career Intelligence Architecture Audit (Phase 1)

| Concern | Canonical function | Owner | Notes |
|---|---|---|---|
| Evidence-first capability profile | `extractCapabilityProfile()` | `lib/career/capabilityExtractor.ts` | reads Projection Engine output only |
| Career matching (scoring, tiers, gaps, strengths, narrative) | `computeCapabilityMatches()` | `lib/career/capabilityMatchEngine.ts` | deterministic, AI-free, single source (Sprint 23's consolidation) |
| Confidence label | `confidenceFromAssessmentCount()` | `lib/career/capabilityMatchEngine.ts` | the one confidence ladder every Career consumer already follows |
| Junior-safe cluster grouping | `familiesFromMatches()` | `lib/learnerIntelligence/careerIntelligence.ts` | groups already-computed matches, never re-scores |
| **Grade-gated, single entry point wrapping all of the above** | `buildCareerIntelligence()` | `lib/learnerIntelligence/careerIntelligence.ts` | already consumed by the student Career Explorer, Parent Career Intelligence, Holiday Planner, and `app/api/core/learners/[id]/route.ts` |

**Finding — a genuinely deprecated, divergent second pathway** (the "duplicate calculations / deprecated paths" this Phase 1 explicitly asks to find): `composeCareer.ts` (pre-Sprint-12N) called `careerEngine.getMatchesForStudent()`, which reads the persisted `career_matches` table. That table is written by `matchEngine.ts`'s `generateCareerMatches()` — an **AI-generated** (DeepSeek) match pipeline, entirely separate from the evidence-first, deterministic `computeCapabilityMatches()` pipeline every other live Career surface uses. Two consequences, both confirmed by code reading, not by testing in isolation:

1. **Stale/divergent data**: `career_matches` rows only update when `generateCareerMatches()` is explicitly invoked (an AI call) — nothing keeps them in sync with the Projection Engine the way `buildCareerIntelligence()` does (it calls `recomputeLearnerProjection()` on every read). Blueprint could show a career match that disagrees with what the student sees on the Career Explorer for the same evidence.
2. **No grade gate — a real Career Principle violation**: `composeCareer.ts` unconditionally surfaced `top?.career.title` (a specific predicted job) to every learner regardless of grade. `buildCareerIntelligence()` already correctly enforces the platform's Career Principle (Junior/Grade 7–9 = broad families only, never an individual predicted career — the exact bug my own memory of Sprint 29 records as fixed for the Career Explorer) — but Blueprint was bypassing that gate entirely, on a different, older code path.

**Resolution, not a stop**: since a genuinely canonical, already-correct function (`buildCareerIntelligence()`) exists and is already the platform's real single source of truth for career matching, the correct action per Phase 3 ("replace [multiple reads] with one canonical call") is to switch Blueprint onto it — this fixes both findings as a side effect of using the right function, not by writing any new career logic. The deprecated `getMatchesForStudent()`/`career_matches` pathway itself was **not** touched, removed, or redesigned this sprint (forbidden list: "do NOT redesign Career Intelligence") — it still exists for whatever other legacy consumers use it (`lib/career/clinicReportBuilder.ts`, `app/api/career/[slug]/route.ts`, `app/api/career/match/route.ts`); retiring it is a separate, future decision outside this sprint's scope.

**Confirmed — confidence label already canonical**: unlike Learning Compass (Sprint 12M), Career Intelligence already has a real label export: `confidenceFromAssessmentCount()` → `ConfidenceLevel` ('Low'/'Medium'/'High'), surfaced on every `Insight` Career Intelligence produces. No gap here — Blueprint's `confidence` field is real, not null.

---

## 2. Canonical Read API (Phase 2)

New `getCareerBlueprintSummary(studentId)` in `lib/learnerIntelligence/careerIntelligence.ts` (Career's own owning module — not a Blueprint file, per RAS §10.7 "Career owns assembly"). Calls `buildCareerIntelligence()` exactly once, selects only the top family (Junior) or top match (Senior) — both already sorted descending by the matching engine, so "top" is a selection, not a computation — and returns exactly the mission's Blueprint-safe field set:

```ts
type CareerBlueprintSummary = {
  careerCluster: string          // broad label, never a specific career
  strengthProfile: string        // Career's own Insight.observation, unmodified
  futureDirection: string        // Career's own Insight.action, unmodified
  aiOutlook: string | null       // documented gap — see §5
  confidence: ConfidenceLevel    // Career's own canonical label
  version: string | null         // documented gap — see §5
}
```

Returns `null` when Career Intelligence itself reports insufficient evidence (`buildCareerIntelligence()`'s own `notice` branch) — the caller renders Blueprint's explicit Unavailable state, never a fabricated default. No presentation, no formatting beyond field selection, no QR, no UI — confirmed by code review.

**One minimal, additive change inside Career Intelligence itself** (not a redesign): `CareerMatchInsight` (Senior mode's per-match shape) gained a `careerCategory` field, populated from `CapabilityCareerMatch.career_category` — a value `computeCapabilityMatches()` already computes but `buildSeniorMatches()` previously dropped when mapping into the narrower `CareerMatchInsight` shape. Without this, Senior-mode Blueprint summaries would have no way to know a match's cluster without a second call into `computeCapabilityMatches()` (exactly the "call Compass/Career internals twice" this sprint forbids). `CATEGORY_LABEL` (the cluster-name map `familiesFromMatches()` already used internally) was exported so the new summary function reuses it instead of inventing a second label map.

---

## 3. Remove Duplicate Reads (Phase 3)

`composeCareer.ts` now calls `getCareerBlueprintSummary()` exactly once — the direct `getMatchesForStudent()` call (the deprecated path, §1) is gone. Blueprint performs zero assembly: no sorting, no tier selection, no label lookup — all of that lives inside `getCareerBlueprintSummary()`, inside Career's own module.

---

## 4. Blueprint Composition (Phase 4)

`CareerData` (Blueprint's own type) narrowed to exactly: `careerCluster`, `strengthProfile`, `futureDirection`, `aiOutlook`, `confidence`, `notes` — plus the existing `BlueprintSection` wrapper's `status`/`owner`/`unavailableReason`. Removed: `careerTitle` (a specific job — no longer part of Blueprint's shape at all, a compile-time guarantee, not just a convention) and `strengthSnapshot`/`futureReadiness` (renamed to the mission's field names, `strengthProfile`/`futureDirection`, and `futureReadiness`'s old always-null gap is resolved — see §1).

---

## 5. Confirmed Gaps — left null, not invented (Phase 5's discipline, applied honestly)

- **AI Outlook**: `Career.kenya_market_outlook` is per-specific-career metadata (e.g., "Data Scientist: strong demand..."). Since Blueprint no longer surfaces a specific career (§4), there is no single career left to attach an outlook to, and no canonical *cluster-level* market-outlook function exists anywhere in Career Intelligence. Left `null`, documented in `composeCareer.ts`'s notes array when it occurs — not approximated by picking one representative career's outlook (which would misrepresent the cluster).
- **Version**: no algorithm-version export exists for `computeCapabilityMatches()` (unlike Blueprint's own `BLUEPRINT_VERSION`). Left `null`, not invented.

Neither gap blocks Blueprint from being useful — `careerCluster`, `strengthProfile`, `futureDirection`, and `confidence` are all real, canonical values.

---

## 6. Unavailable State (Phase 6)

Confirmed exact copy, verified by the new integration test (§11): when `getCareerBlueprintSummary()` returns `null` (insufficient evidence), `composeCareer()` returns `status: 'unavailable'`, `data: null`, `unavailableReason: 'More learning evidence is needed before Career Intelligence can provide reliable guidance.'` — the literal mission-specified copy. No fabricated defaults, no empty strings — the pre-Sprint-12N behaviour (returning `'available'` with every field silently `null`) is fixed; this was a real bug the mission's Phase 6 requirement exposed (§1's finding, restated: an "available" section with nothing in it misrepresents whether data exists).

---

## 7. Snapshot Integration (Phase 7)

Verified, no new snapshot code: `createBlueprintSnapshot()` (`lib/learnerBlueprint/snapshot.ts`) calls `composeBlueprint()` — unchanged — which calls the now-updated `composeCareer()` as one of its section composers. Any snapshot taken after this sprint automatically includes the new `CareerData` shape; nothing in the snapshot repository/service needed touching. Confirmed by the full `snapshot.test.ts` suite still passing (5/5) with no snapshot-layer code changed.

---

## 8. Historical Viewer (Phase 8)

Confirmed unchanged: the Historical Viewer (`app/student/blueprint/[learnerId]/history/[snapshotId]/page.tsx`) renders `snapshot.blueprint_payload` through the exact same `BlueprintView` → `CareerSection` component Current Blueprint uses — no second renderer, no recomputation. A snapshot taken *before* this sprint still has the old `CareerData` shape (`careerTitle`/`strengthSnapshot`/`futureReadiness`) frozen inside its `blueprint_payload`; `CareerSection` only reads the new field names, so an old snapshot's career section would render blank fields rather than crash — consistent with Sprint 12K's schema-versioning discipline ("no migration may ever rewrite an existing row... old snapshots keep rendering under their original shape"). No code change was needed to preserve this — it falls out of `blueprint_payload` being untyped JSON at the database layer and `CareerSection` reading optional-shaped fields defensively (`data.aiOutlook &&`, `data.confidence &&`).

---

## 9. Presentation (Phase 9)

`CareerSection` (`components/blueprint/sections.tsx`) now renders exactly: Emerging Career Cluster, Strength Profile, Future Direction, AI Outlook (only if present), Confidence (only if present), notes. No charts, no radar, no occupations list, no salaries, no universities, no verbose explanations — confirmed by code review of the full component. No QR — none exists anywhere in the codebase yet (the same platform-wide gap Sprint 12M documented for Learning Compass); not built here either, per this sprint's own Forbidden list ("do NOT build QR generation").

---

## 10. Architecture Validation (Phase 10)

- Blueprint never owns Career data — confirmed; `CareerData` is a read-shaped projection, Blueprint persists nothing about career beyond what a Snapshot (an existing, unrelated mechanism) freezes.
- Blueprint never computes Career data — confirmed; `composeCareer.ts` contains zero scoring, sorting-by-score, or label-deriving logic — the one `top` selection it makes operates on an array `getCareerBlueprintSummary()` already returned pre-sorted.
- Blueprint never stores Career summaries outside snapshots — confirmed; no new table, no new persistence.
- Career Intelligence owns everything — confirmed; every value in `CareerBlueprintSummary` traces to a `computeCapabilityMatches()`/`confidenceFromAssessmentCount()`/`familiesFromMatches()` output, unmodified except for selection.

---

## 11. Regression Audit (Phase 11)

- `composeBlueprint.pure.test.ts` / `composeBlueprint.integration.test.ts` — updated for the new `CareerData` shape and the corrected Unavailable behaviour (§6), all passing; **new test added**: `composeBlueprint surfaces Career Intelligence as available, cluster-level only, once real evidence exists` — creates a real bridged learner, records a real assessment via `createBridgedAssessment`/`recordBridgedMarks` (the same production path `academicBridge.test.ts`'s own end-to-end test uses), and asserts Career becomes `available` with a real cluster label, a real `confidence` value, a real `futureDirection`, and — a runtime sanity check on top of the compile-time guarantee — no `careerTitle` key anywhere on the object.
- `snapshot.test.ts` — unchanged, all passing (5/5).
- `reportCardOwnership.security.test.ts`, `reportCardPublicationGuard.integration.test.ts`, `endOfTermFullChain.test.ts`, `granularEndOfTermFlow.test.ts` — unchanged, all passing (19/19).
- Combined: 45/45 passing across all suites run, zero regressions.
- No file outside `lib/learnerIntelligence/careerIntelligence.ts` (additive changes only), `lib/learnerBlueprint/types.ts`/`composeCareer.ts`, `components/blueprint/sections.tsx`, and the two composeBlueprint test files was touched — Attendance, Learning Compass, Identity, Report Cards, and every other composer/domain are byte-for-byte unchanged.

---

## Constitutional / RAS / ADR Compliance

- **ADR-0006 §4** ("Career Intelligence integration limited to one snapshot: Emerging Career Cluster, Strength Profile, AI Outlook, Future Readiness, QR") — implemented exactly, with `Future Readiness`'s pre-existing gap resolved into a real `confidence` field and no specific career/job ever surfaced, matching this sprint's explicit Architectural Goal.
- **ADR-0006's corollary** ("summarize/select, never re-derive a new interpretation") — `getCareerBlueprintSummary()` only selects the pre-computed top item; the "categoryLabel" lookup is a label-table read (already-existing `CATEGORY_LABEL`), not a new judgment.
- **RAS §10.7/§10.8** — one Career owner, now called through exactly one function; the deprecated `getMatchesForStudent()` pathway is no longer reachable from Blueprint at all.
- **Educational Constitution Article XI** — the `null` fields (`aiOutlook`, `version`) are documented gaps with explanatory notes, never rendered as fabricated values; `confidence` is a real, named label, never a bare score.
- **No new canonical domain, identity, calculation, or write path** — confirmed; every change is either a consolidating switch to the already-correct canonical function, a minimal field-propagation inside Career's own module, or an honest gap report.

---

## Required Verification — evidence

- **One canonical Career read exists**: `getCareerBlueprintSummary()`, `lib/learnerIntelligence/careerIntelligence.ts` — confirmed by code review, `composeCareer.ts` calls nothing else.
- **Blueprint performs zero Career calculations**: confirmed — no scoring, sorting-by-score, or confidence-deriving code in `composeCareer.ts`.
- **No duplicate Career logic remains inside Blueprint**: confirmed — the only Career-adjacent code inside `lib/learnerBlueprint/` is `composeCareer.ts`'s single call + null-check + field selection.
- **Snapshots still work**: `snapshot.test.ts` 5/5.
- **Historical Viewer still works**: unchanged code path, verified by review (§8); no test needed since no code changed there.
- **Current Blueprint still works**: `composeBlueprint.integration.test.ts` full suite passing.
- **Unavailable state is explicit**: verified directly by the updated bridged-no-evidence test (§6/§11), asserting the exact mission-specified reason string.
- **`tsc --noEmit`**: clean.
- **`eslint`**: clean on every touched/new file.
- **All tests pass**: 45/45 combined.
- **New integration tests added**: one, described in §11.
- **Implementation log updated**: see `docs/engineering/implementation-log.md`.

---

## Stop Condition

Per explicit mission instruction: Career Intelligence integrated into the Blueprint Composition Engine. **Stop here.** Sprint 12O (Parent Portal, Behaviour, Portfolio, QR generation, adaptive learning, or any further Blueprint sprint) does not begin. Waiting for explicit approval.
