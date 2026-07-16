# Sprint 5I — Assessment Type Canonical Mapping Consolidation

**Mode**: Mechanical consolidation only. No educational policy, business logic, AI behavior, Projection, Evidence semantics, Ranking, Grading, Analytics, database schema, or migration was changed. Sprint 5H-P ratified the Hybrid model (Teacher Label → Canonical Educational Purpose); this sprint eliminates the duplicated implementations of that mapping, with zero behavioral change.

---

## Part 1 — Discovery Verification

Every prior sprint's count was re-verified from scratch, per the instruction not to trust it. **The real count was higher than any prior audit found — 6 duplicate implementations, not the 2-3 previously catalogued.**

| # | File:Line | What it duplicated | Previously known? |
|---|---|---|---|
| 1 | `lib/repositories/assessment.repository.ts:591-594` (pre-migration) `TYPE_LABEL` | Label dictionary ("Mid-Term"/"End-Term" spelling), used in `getAssessmentAnalytics`'s title-building | Yes — Sprint 5D/5G |
| 2 | `lib/assessments/pdfRenderer.ts:54-57` (pre-migration) `typeLabel` | Label dictionary ("Midterm"/"End Term" spelling), used in the PDF metadata row | Yes — Sprint 5D/5G |
| 3 | `app/teacher/classes/[classId]/assessments/page.tsx:19-26` (pre-migration) `TYPE_LABEL` + `buildTitle` | Third independent copy of the title-building dictionary ("Mid-Term"/"End-Term" spelling) | **No — found in Sprint 5H-P, first time** |
| 4 | `app/teacher/classes/[classId]/assessments/page.tsx:32-39` (pre-migration) `TYPE_META` | Fourth copy — badge label ("Midterm"/"End Term" spelling) + Tailwind color classes | **No — found in Sprint 5H-P, first time** |
| 5 | `app/teacher/analytics/page.tsx:433-441` (pre-migration) `ATYPE_LABEL` + `ATYPE_ORDER` + `aTypeSort` | Fifth copy — label dictionary **plus a sort-order concept no other copy had** | **No — found fresh in this sprint's Part 1 re-verification, missed by every prior audit** |
| 6 | `app/teacher/classes/[classId]/page.tsx:463` (pre-migration) inline object literal | Sixth copy — not even a named dictionary, an inline `{...}[atype] ?? atype` title-building expression | **No — found fresh in this sprint's Part 1 re-verification, missed by every prior audit** |
| 7 | `lib/config/assessmentTypePurposes.ts` `ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE` | The label→purpose mapping itself (Sprint 5H-P's ratified Hybrid model's core logic) | Yes — Sprint 5D/5G/5H-P, correctly identified as *the* canonical piece, not a duplicate to eliminate but the thing to consolidate everything else *around* |
| 8 | `lib/assessments/types.ts:5` `AssessmentType` union | A second literal type declaration of the same 6-value set | Not previously flagged as "duplication" (a type, not a runtime dictionary) but eliminated here too, since the mission covers "hard-coded assessment label" broadly |

**Deliberately located, and deliberately excluded from migration** (confirmed still present, unchanged):
- `lib/assessments/evidence.ts:35-39` `toEvidenceAssessmentType` — an if-chain, but it maps the teacher label into a *third, separate* vocabulary (`learner_evidence.assessment_type`'s own 3-value enum), which is Evidence Domain logic, not Assessment Type display/purpose logic. Migrating it risks "change Evidence semantics," explicitly forbidden by this sprint. Left untouched.
- 8 hardcoded `'assignment'` literals across `lib/remarks/`, `lib/formativeSignals/`, `lib/compass/`, `lib/holiday/`, `lib/assessments/topicalEvidence.ts`, `lib/assignments/`, `lib/parentPulse/`, `lib/remedial/` — none of these read `assessment_type` at all; they hardcode a placeholder for evidence sources that have no real assessment type. Not Assessment Type mapping duplication; Evidence Domain placeholder logic. Left untouched.
- `app/teacher/academy/mission/[id]/MissionClient.tsx`'s `TYPE_META` — a *different* domain entirely (Academy mission types: compare/investigate/apply/create/teach/build), unrelated to Assessment Type despite the identical variable name. Confirmed by inspection, correctly excluded.

---

## Part 2 — Canonical Service

**`lib/assessments/assessmentTypeCatalog.ts`** — new module, zero DB/repository/Supabase/route/Intelligence imports, pure data and pure functions only.

Exports:
- `KNOWN_ASSESSMENT_TYPES` — the 6-value canonical tuple (`opener, cat, midterm, endterm, exam, assignment`), also usable directly by `z.enum()`.
- `AssessmentType` — the type, derived from the tuple (`typeof KNOWN_ASSESSMENT_TYPES[number]`), not re-declared.
- `isKnownAssessmentType(value)` — validation predicate.
- `getAssessmentTypeMeta(type)` — full metadata lookup, `null` for unknown.
- `getTitleLabel(type)` / `getBadgeLabel(type)` / `getBadgeClass(type)` — the two distinct label spellings and the badge color, each preserved exactly as their respective prior call sites used them (see Part 4).
- `getDefaultPurposeCode(type)` — the Sprint 5H-P Hybrid-model mapping, replacing `ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE`.
- `buildAssessmentTitle(type, term, year)` — the "Term {term} {label} {year}" formatter, replacing 3 independent implementations (items 1, 3, 6 above).
- `compareAssessmentTypes(a, b)` — the sort comparator, replacing item 5's `aTypeSort`, **including its pre-existing quirk** (see Part 4).

---

## Part 3 — Mechanical Migration

Performed in the requested order, one call site at a time, typechecked after each step:

1. **Duplicate label dictionaries → canonical lookup**: items 1, 2, 3, 4, 5 replaced with `getTitleLabel`/`getBadgeLabel`/`getBadgeClass` calls.
2. **`TYPE_META` → canonical metadata**: item 4's color-coded badge (button group + assessment card) replaced with `getBadgeClass`/`getBadgeLabel`, and its `Object.keys(TYPE_META)` iteration replaced with `KNOWN_ASSESSMENT_TYPES` (same order, confirmed below).
3. **Inline mapping table → canonical mapper**: item 7 (`ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE`) replaced with `getDefaultPurposeCode` in `lib/assessments/mutations.ts::resolveOrCreateAssessmentType`; the now-fully-unused `lib/config/assessmentTypePurposes.ts` was deleted (zero remaining consumers, confirmed by repo-wide search before deletion).
4. **Remaining hardcoded label expression → canonical mapper**: item 6's inline object literal replaced with `buildAssessmentTitle`.

`lib/assessments/types.ts`'s `AssessmentType` union is now imported from, and re-exported from, the canonical module rather than independently declared.

---

## Part 4 — Behavior Preservation

Every migrated caller's output was compared against its exact pre-migration behavior before changing it:

- **Two distinct label spellings preserved, not unified**: "Mid-Term"/"End-Term" (title contexts — repository analytics title, the frontend's `buildTitle`, the frontend's inline object literal) vs. "Midterm"/"End Term" (badge contexts — pdfRenderer's metadata row, the frontend's `TYPE_META` badges, the analytics page's selector buttons). The canonical module's `titleLabel`/`badgeLabel` split exists specifically so these two, previously-diverged spellings continue to diverge exactly as before — this was a deliberate design choice, not an oversight, and is asserted by a dedicated regression test (Part 5).
- **Fallback behavior preserved per call site**: `getTitleLabel`/`getBadgeLabel` fall back to the raw input string for an unrecognized/custom type name, matching every prior `?? x`/`|| x` idiom exactly. The one exception — the assessment card's `TYPE_META[a.assessment_type] || TYPE_META.exam` (falls back to *Exam's full metadata*, not the raw string) — was preserved with its own exact fallback (`getAssessmentTypeMeta(x) ?? getAssessmentTypeMeta('exam')!`), not silently unified with the other, different fallback pattern.
- **Sort order preserved, including its pre-existing quirk**: `app/teacher/analytics/page.tsx`'s `aTypeSort` used `ATYPE_ORDER.indexOf(a) ?? 99` — but `Array.prototype.indexOf` never returns a nullish value (it returns `-1` for "not found"), so the `?? 99` was already dead code before this sprint touched it; an unrecognized type actually sorted *first* (`-1 < 0`), not last as the `?? 99` suggests was intended. `compareAssessmentTypes` reproduces this exact behavior (including the same dead `?? 99`), rather than "fixing" it — this sprint changes no behavior, intentional-looking or not.
- **Iteration order preserved**: `KNOWN_ASSESSMENT_TYPES` is `['opener', 'cat', 'midterm', 'endterm', 'exam', 'assignment']` — the exact same key order as every migrated `Record<AssessmentType, ...>` dictionary had (confirmed by a dedicated test), so the button-group UI's visual order is unchanged.
- **No UI, API, or response shape changed**: every migration replaced an internal computation with an identical one; no component prop, route response field, or HTTP status code was touched.

---

## Part 5 — Tests

**New**: `lib/assessments/assessmentTypeCatalog.test.ts` — 11 pure-function tests, no DB/fixtures required: every teacher label's title/badge/purpose; canonical list order and uniqueness; every purpose code present at least once; invalid/custom label handling (case-sensitive, matching `resolveOrCreateAssessmentType`'s own exact-match semantics); metadata lookup; purpose round-trip determinism; `buildAssessmentTitle` format parity with both prior implementations; and an explicit regression test proving the two label spellings remain distinct rather than accidentally unified. All 11 passing.

**Regression** (proving every migrated caller still produces identical output): full pre-existing suite re-run — `assessmentType.integration.test.ts`, `evidencePurpose.integration.test.ts`, `phaseBMigration.safety.test.ts`, `phaseGMigration.safety.test.ts`, `coreAssessmentTypeIntegrity.test.ts`, `permissions.assessmentbatch.test.ts`, `permissions.classownership.test.ts` — 30 tests, all still passing. These exercise `resolveOrCreateAssessmentType` (now backed by `getDefaultPurposeCode`) end-to-end against real Supabase data and confirm identical resolution behavior for every known and custom type name.

---

## Part 6 — Validation

Explicitly confirmed:
- **No schema changes** — 0 migrations, 0 `supabase/` files touched.
- **No repository edits beyond the mechanical swap** — `assessment.repository.ts`'s `getAssessmentAnalytics` had its inline dictionary replaced with a function call; no query, no filter, no return shape changed.
- **No route behavior changes** — the one route touched (`app/api/teacher/assessments/[assessmentId]/route.ts`'s PATCH) has its Zod enum's *accepted value set* byte-identical (`z.enum(KNOWN_ASSESSMENT_TYPES)` accepts exactly the same 6 strings as the literal array it replaced); rejection behavior for any other string is unchanged.
- **No service-role changes** — no `createServiceClient()`/RLS-touching code was added or modified.
- **No teacher identity changes** — ADR-0002/Sprint 5F's `resolveTeacher()` usage is untouched.
- **No assessment creation changes** — `createAssessment` (both Core and teacher-facing) call `resolveOrCreateAssessmentType` exactly as before; only its internal purpose-code lookup was re-sourced.
- **No Evidence behavior changes** — `toEvidenceAssessmentType`, `recordAssessmentEvidence`, and `purpose_id` resolution are byte-identical, confirmed by the still-passing `evidencePurpose.integration.test.ts`.
- **No Projection/Adaptive Learning/Ranking/Grading changes** — none of these files were touched; confirmed by `git diff` scope.
- **Exactly one canonical mapping implementation remains** — confirmed by a final repo-wide search for the label text ("Mid-Term"/"End-Term"/"End Term") returning matches only in the canonical module and its test file.

Live pilot data re-checked post-migration: 11 total `class_assessments` rows (unchanged), 0 NULL `assessment_type_id`, 0 residual test rows.

---

## Part 7 — Risk Assessment

- **Architecture**: Low. No new domain, no new table, no new dependency direction — the canonical module is a pure leaf, imported by 7 files, importing nothing beyond itself.
- **Migration**: None — no schema/data migration involved; this is a code-only consolidation.
- **Backward compatibility**: Full — every output (labels, colors, titles, sort order, validation acceptance set) is byte-identical to before, verified by dedicated regression tests plus manual trace of every call site's exact prior fallback behavior.
- **Performance**: Negligible — replaced inline object-literal lookups with equivalent function calls; no new I/O, no new loop, no new async boundary.
- **Rollback**: Trivial — 10 files changed (1 new module, 1 new test, 1 deleted config file, 7 call-site migrations), each independently revertible via `git checkout --` / `git revert` of the deleted file.
- **Developer experience**: Materially improved — a developer adding a 7th assessment type, or fixing a label typo, now has exactly one place to change instead of needing to know about (and correctly update) 6 independently-spelled copies, 2 of which this sprint discovered were never even known to exist until this pass's re-verification.
- **Future AI readiness**: Neutral-to-positive — the canonical module is the natural single integration point for any future Evidence/Projection/Analytics consumer of assessment type (per Sprint 5H-P's ratified but explicitly-deferred Hybrid-model bottom half); this sprint does not wire any of that in, per its own stop condition.

---

## Deliverables

1. This document — `docs/engineering/sprint-5i-assessment-type-consolidation.md`.
2. Implementation log entry — `docs/engineering/implementation-log.md`.

## Stop Condition

✓ One canonical mapping service exists (`lib/assessments/assessmentTypeCatalog.ts`).
✓ Every duplicate dictionary removed (6 found and migrated, 2 more than any prior audit had counted).
✓ Behavior identical (verified per call site, regression-tested).
✓ Tests passing (11 new + 30 pre-existing, 41/41).
✓ Documentation updated.

STOP. Assessment Type is **not** wired into Evidence, Projection, Analytics, or any Intelligence subsystem beyond what already existed before this sprint. Sprint 5J (or whatever comes next) is not started.
