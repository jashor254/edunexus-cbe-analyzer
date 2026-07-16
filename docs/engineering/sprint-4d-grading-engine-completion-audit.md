# Sprint 4D — Grading Engine Completion Audit

**Type:** Read-only architecture audit. No code, schema, or grading boundary was modified during this sprint.
**Date:** 2026-07-15
**Scope:** Verify, from scratch against live code, the state of the Grading Domain after Sprint 4C1's migration of 2 call sites onto `lib/grading::gradeScore()`. Closes out the Sprint 4A→4C1 series.
**Predecessor docs:** `docs/engineering/sprint-4b-grading-policy-ratification.md`, `docs/engineering/sprint-4c0-grading-policy-integration.md`, `docs/engineering/implementation-log.md` ("Sprint 4C1" entry), `docs/architecture/deprecation-registry.md` entry #5.

---

## Part 1 — Canonical flow (post-4C1)

There are now **three structurally different flows** producing "a CBC grade," not one. They diverged further with 4C1 because 2 of the ~7 known implementations now read a per-school setting that the others still ignore.

### Flow A — Migrated: Core report/summary path (goes through `lib/grading`)

```
school_settings.grade_boundaries (jsonb, per-school override)
        │  read only by SchoolRepository (lib/repositories/school.repository.ts:18,125)
        ▼
lib/core/school.ts::getSchoolSettings()  /  app/api/core/school/route.ts (settings.grade_boundaries)
        │
        ├──► app/api/core/assessments/route.ts:120
        │        └──► lib/core/assessments.ts::computeTermSummaries()  (assessments.ts:113-199)
        │                 └──► builds local GradeScale (assessments.ts:158-166)
        │                 └──► gradeScore() from lib/grading  (assessments.ts:172-173)
        │                 └──► writes term_subject_summaries.cbc_level (STORED, repos.assessments.upsertTermSubjectSummaries)
        │
        └──► app/api/core/reports/route.ts:111
                 └──► lib/core/report-cards.ts::generateReportCards()  (report-cards.ts:8-94)
                          └──► builds local GradeScale (report-cards.ts:42-50)
                          └──► gradeScore() from lib/grading  (report-cards.ts:52-53)
                          └──► writes school_report_cards.overall_cbc_level (STORED, repos.schools.upsertReportCards)

Also reachable via: lib/core/endOfTerm.ts:62-65 (end-of-term batch job) → same computeTermSummaries/generateReportCards.
```

**Production consumers reading the stored result:** `app/api/core/reports/route.ts` (GET), `app/api/reports/report-card/route.ts`, `app/api/reports/report-card/mine/route.ts` — all `select` the already-stored `overall_cbc_level`/`cbc_level` column, never recompute.

### Flow B — Not migrated: Assessment Repository / cohort & analytics path (hardcoded, ignores school setting)

```
lib/repositories/assessment.repository.ts::gradeLevelFromScore()  (line 45-50, hardcoded 75/50/25, no parameter)
        │
        ├──► getAssessmentAnalytics() (line 493+, uses at 648, 653)
        │        └──► lib/assessments/analytics.ts::getAssessmentAnalytics() (line 59-63, passthrough)
        │                 └──► app/api/teacher/analytics/route.ts:28
        │
        └──► getCohortData() (line 689+, uses at 788, 826, 839, 859, 882)
                 └──► lib/assessments/cohortQueries.ts::getCohortData()/getTeacherCohorts() (line 51-64, passthrough)
                          └──► app/api/teacher/cohort/[grade]/route.ts:36
                          └──► app/api/teacher/cohorts/route.ts:22
```

This path never reads `school_settings.grade_boundaries` at all — no `gradeBoundaries` parameter exists on `gradeLevelFromScore` or any caller in this chain.

### Flow C — Not migrated: independent gradebook path (`lib/assessments/gradeCalculator.ts`, 76/51/31)

```
lib/assessments/gradeCalculator.ts::BUILTIN_CBC_SCALE (76/51/31, gradeCalculator.ts:43-52)
        │
        └──► calculateMeanGrade() (gradeCalculator.ts:120-126)
                 └──► lib/assessments/mutations.ts:139,194 (writes learner_marks.mean_grade at score-save time — STORED)
                          └──► app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx (client display)
                 └──► lib/assessments/cohortQueries.ts (uses gradeCalculator's re-exported marksToLevel, separate from calculateMeanGrade)
```

This is a **live write path**, not dead: every time a teacher saves marks through the legacy (non-Core) gradebook, `mutations.ts` calls `calculateMeanGrade()` and stores the resulting letter grade directly onto `learner_marks.mean_grade` — the same column `gradeLevelFromScore` (Flow B) later falls back to reading (`assessment.repository.ts:859`: `m.mean_grade ?? gradeLevelFromScore(...)`) when present. So a single mark can be graded by the 76/51/31 scale at write time and never touched by 75/50/25 logic at all, unless `mean_grade` is null.

### Flow D — Not migrated, out of scope: Evidence Domain (`lib/intelligence/cbcScale.ts`, 75/50/30, numeric `CBCLevel`)

```
lib/intelligence/cbcScale.ts::marksToLevel() (numeric 1-4 CBCLevel, 75/50/30 thresholds)
        └──► lib/assessments/gradeCalculator.ts re-exports (gradeCalculator.ts:140-141) — kept for backward-compat callers
        └──► lib/intelligence/pipeline.ts (Evidence/Projection pipeline — per CLAUDE.md, never bypassed by feature code)
```
Deliberately a different type (`CBCLevel` 1-4, not `'EE'|'ME'|'AE'|'BE'` strings) and a different domain (Evidence, not Assessment/Core). Confirmed unchanged by 4C1 — no imports of `lib/grading` found in `lib/intelligence/`.

### Flow E — Not migrated: Assignments domain (75/55/40), 3 independent copies

```
app/api/lesson-plans/[planId]/tsc-view/route.ts:12-18   (server, cbcLevel())
app/teacher/assignments/[assignmentId]/results/page.tsx:49-72  (client, toCbcLevel())
app/teacher/assignments/[assignmentId]/page.tsx:293-295  (client, inline)
```
All 3 independently hardcode `pct>=75→4, pct>=55→3, pct>=40→2, else 1`. No shared import between them — genuinely 3 separate copies of the same 3-line function, not 1 function with 3 callers.

### Flow F — Not migrated: Notifications domain (80/60/40), 2 independent copies

```
lib/notifications/notify.ts::deriveCbcLevel() (line 56-62) + getLevelDisplay() (line 18-53, multi-curriculum, unused — see Part 2)
lib/email/sender.ts::deriveCbcLevel() (line 199-205)
```
`lib/notifications/notify.ts` imports functions from `lib/email/sender.ts` (`sendAssignmentMarkedEmail`, `sendAlertCreatedEmail`) but does **not** import `sender.ts`'s `deriveCbcLevel` — each file has its own byte-identical private copy. Consumers: `app/api/teacher/alerts/route.ts`, `app/api/teacher/assignments/[id]/mark/route.ts`.

### Flow G — NEW FINDING this sprint: `lib/curriculum/regional/ke-cbc.ts` (75/50/25, dead grading logic)

```
lib/curriculum/regional/ke-cbc.ts::GRADING_SCALE (line 17-22, 75/50/25 — same values as Flow B/Legacy Core)
        └──► markToGrade() / normalizeToCBCLevel() (line 60-69)
                 └──► NO CALLERS FOUND ANYWHERE IN THE REPOSITORY
```
`KE_CBC` itself is imported by 4 live routes (`app/api/holiday/return`, `app/api/holiday/generate`, `app/api/teacher/classes/[classId]/differentiation`, `app/api/teacher/assessments/topical`) — but every one of those call sites uses only `KE_CBC.getCurrentTerm()`. Grep for `markToGrade`/`normalizeToCBCLevel` outside `lib/curriculum/regional/*.ts` returns zero matches. This scale exists, is wired into an actively-used curriculum-adapter object, and is dead code for grading purposes specifically. Not previously catalogued in Sprint 4B's 5-set inventory — it's an 8th boundary implementation, coincidentally sharing 75/50/25 with Flow B/Legacy-Core.

---

## Part 2 — Duplicate logic table

| # | File:line | Purpose | Duplicate? | Classification | Evidence |
|---|---|---|---|---|---|
| 1 | `lib/grading/gradingEngine.ts:13` (`gradeScore`) | Canonical, pure grading function | N/A — the canonical implementation | **Canonical** | Zero DB/Supabase imports (verified Part 4b); only entrypoint documented as public API in `lib/grading/index.ts`. |
| 2 | `lib/core/assessments.ts:172-173` (`toCbcLevel` closure in `computeTermSummaries`) | Term-subject-summary grading, honors per-school override | Was a duplicate; now delegates | **Canonical (delegated)** | Calls `gradeScore()` directly (line 173); local `cbcScale` object is a config adapter, not independent grading logic. |
| 3 | `lib/core/report-cards.ts:52-53` (`toCbcLevel` closure in `generateReportCards`) | Report-card overall grading, honors per-school override | Was a duplicate; now delegates | **Canonical (delegated)** | Same pattern as #2, calls `gradeScore()` at line 53. |
| 4 | `lib/repositories/assessment.repository.ts:45-50` (`gradeLevelFromScore`) | Cohort/analytics grade-band computation | Yes — hardcoded 75/50/25, no school-setting parameter | **Technical debt** | 7 internal call sites (lines 648, 653, 788, 826, 839, 859, 882); feeds 3 production routes (Part 1 Flow B). Explicitly scoped out of Sprint 4C1 per implementation-log's "not migrated... explicitly out of this sprint's scope." Not dead — actively read on every analytics/cohort request. |
| 5 | `lib/assessments/gradeCalculator.ts:43-52` (`BUILTIN_CBC_SCALE`, 76/51/31) | Legacy gradebook mean-grade computation, **written to `learner_marks.mean_grade` at save time** | Yes — different boundary values (76/51/31 vs 75/50/25) | **Architectural violation** (boundary-value conflict, not just duplication) | `calculateMeanGrade()` (line 120-126) called from `lib/assessments/mutations.ts:139,194`, a live write path. This is more than "technical debt" — a mark graded at 75.0% is 'ME' under this scale but 'EE' under Flow A/B's 75/50/25 scale (see Part 3). Unratified 1-point boundary conflict, flagged since Sprint 4A, still unresolved. |
| 6 | `lib/intelligence/cbcScale.ts:29-33` (`DEFAULT_MARKS_THRESHOLDS`, 75/50/30) | Evidence-Domain marks→CBCLevel(1-4) mapping | No — different type (numeric `CBCLevel`, not string grade), different domain, explicitly out of scope per CLAUDE.md's Evidence-ownership rule | **Acceptable duplicate** | CLAUDE.md: "Learner intelligence state... read via `recomputeLearnerProjection` only... never read... directly from a feature module" — `cbcScale.ts` is Evidence-Domain-owned infrastructure the Grading Engine must not absorb. |
| 7 | `app/api/lesson-plans/[planId]/tsc-view/route.ts:12-18` (`cbcLevel`) | TSC-inspector-modal assignment result summary | Yes — 3rd independent 75/55/40 copy | **Technical debt** | Server-side inline function, no shared import. Not previously migrated; unratified boundary set (75/55/40, unique to Assignments domain). |
| 8 | `app/teacher/assignments/[assignmentId]/results/page.tsx:49-72` (`toCbcLevel`) | Client-side marks-entry preview | Yes — same 75/55/40 set as #7, different implementation shape (handles CBC-level/letter-grade/percentage input types) | **Technical debt** | Client component; duplicate boundary values, not duplicate code shape (this one also handles non-percentage inputs), so a naive dedup can't just delete it — genuinely does more than #7. |
| 9 | `app/teacher/assignments/[assignmentId]/page.tsx:293-295` (inline) | Client-side results table color-coding | Yes — 3rd copy of 75/55/40 | **Technical debt** | Simplest of the 3, inline in a JSX conditional block, no named function. |
| 10 | `lib/notifications/notify.ts:56-62` (`deriveCbcLevel`) | WhatsApp/email notification level tag | Yes — 80/60/40, byte-identical to #11 | **Technical debt** (borderline dead — see below) | Called from `notifyAssignmentMarked`/`notifyAlertCreated` (line 69, 174), consumed by `app/api/teacher/alerts/route.ts`, `app/api/teacher/assignments/[id]/mark/route.ts`. |
| 10b | `lib/notifications/notify.ts:18-53` (`getLevelDisplay`) | Multi-curriculum (CBC/844/IGCSE) display-label helper | N/A internally, but function itself is unreachable | **Dead code** | Line 55: `void getLevelDisplay // available for callers` — explicitly marked as unused with no actual caller anywhere in the repo (grep confirms zero call sites outside its own declaration). The `void` marker is doing the same job a `// eslint-disable` would; the function is unreferenced dead code, not merely underused. |
| 11 | `lib/email/sender.ts:199-205` (`deriveCbcLevel`) | Email-template CBC level | Yes — 80/60/40, byte-identical to #10 | **Technical debt** | Not migrated despite `notify.ts` already importing 2 other functions from this same file — the two `deriveCbcLevel` copies were never consolidated even though the files already share an import edge. |
| 12 | `lib/curriculum/regional/ke-cbc.ts:17-22` (`GRADING_SCALE`) + `markToGrade`/`normalizeToCBCLevel` (line 60-69) | Kenya CBC curriculum-adapter grading scale (75/50/25) | Yes — same values as #4, but zero callers | **Dead code** | New finding this sprint. `KE_CBC` object is imported live by 4 routes but only for `getCurrentTerm()`; grep for `markToGrade`/`normalizeToCBCLevel` outside `lib/curriculum/regional/` returns nothing. |
| 13 | `lib/curriculum/regional/tz-necta.ts`, `ug-ncdc.ts` | Tanzania/Uganda curriculum adapters, own grading scales | Not a Kenya-CBC duplicate — different national curricula entirely | **Out of scope / Acceptable duplicate** | Confirmed not part of the 75-vs-76 Kenya conflict; mentioned for completeness of the "any NEW numbers" sweep, not a finding requiring action. |

---

## Part 3 — Boundary consistency (post-4C1)

| Scale | Values (EE/ME/AE, BE always floor 0) | Where it lives (file:line) | Status |
|---|---|---|---|
| CBC Standard | 76/51/31 | `lib/grading/boundaries.ts:23-31` (`CBC_SCALE_STANDARD`, canonical constant, ported from) `lib/assessments/gradeCalculator.ts:43-52` (`BUILTIN_CBC_SCALE`, still live, feeds `learner_marks.mean_grade` writes) | **Accidental/unresolved** — genuinely different letter grade at exactly 75%, 50%, 30% vs the 75/50/25 group below. Named in Sprint 4A/4B as an open human decision; still open. |
| CBC Core/legacy | 75/50/25 | `lib/grading/boundaries.ts:33-41` (`CBC_SCALE_CORE_LEGACY`, canonical constant) · `lib/core/assessments.ts:161-163` (via `gradeBoundaries` param, migrated) · `lib/core/report-cards.ts:45-47` (via `gradeBoundaries` param, migrated) · `lib/repositories/assessment.repository.ts:46-48` (hardcoded, **not migrated**) · `lib/curriculum/regional/ke-cbc.ts:18-21` (hardcoded, dead code) | Internally self-consistent set of values, but split across migrated (reads school override) and non-migrated (hardcoded, ignores override) implementations — **this split is the accidental, newly-real part**, not the boundary values themselves. |
| Evidence Domain | 75/50/30 | `lib/intelligence/cbcScale.ts:29-33` (`DEFAULT_MARKS_THRESHOLDS`) | **Intentional** — different domain (Evidence), different type (numeric `CBCLevel`), explicitly ratified as out of scope in Sprint 4A's correction and CLAUDE.md's Evidence-ownership rule. |
| Assignments domain | 75/55/40 | `app/api/lesson-plans/[planId]/tsc-view/route.ts:14-16` · `app/teacher/assignments/[assignmentId]/results/page.tsx:67-69` · `app/teacher/assignments/[assignmentId]/page.tsx:293-295` | **Accidental/unresolved** — 3 independent copies, no ratification found, not scoped to any migration sprint yet (confirmed still true post-4C1). |
| Notifications domain | 80/60/40 | `lib/notifications/notify.ts:59-61` · `lib/email/sender.ts:202-204` | **Accidental/unresolved** — 2 independent copies, no ratification found, not scoped to any migration sprint yet. |
| 8-4-4 KNEC | Full 12-point scale (80/75/70/65/60/55/50/45/40/35/0) | `lib/grading/boundaries.ts:46-61` (`SCALE_844_KNEC`, canonical) · `lib/assessments/gradeCalculator.ts:55-71` (`BUILTIN_844_SCALE`, still live) | **No conflict found** — values match exactly between the canonical constant and the live implementation (confirmed by re-reading both this sprint). Not migrated to call `gradeScore()`, but not diverging either. |

**Newly-found scale this sprint:** none beyond `ke-cbc.ts`'s 75/50/25 (Part 1 Flow G) — already covered by the Core/legacy row above since values match exactly. The broader threshold sweep (Bash grep across all `pct >=`/`score >=`/`minPct` literals) found no additional CBC-grading-shaped boundary sets; other numeric thresholds found (`app/api/student/home/route.ts:104-107`'s 82/68/52/38 "Leading/Strong/Growing/Emerging", `lib/learnerIntelligence/insight.ts`'s 0.7/0.4 confidence bands, `lib/career/clinicReportBuilder.ts`'s 3.5/2.5/1.5 rubric-score bands, `lib/knowledgeGraph/traversal.ts`'s mastery threshold) are semantically different constructs (engagement scores, confidence scores, rubric scores, mastery gates) — not CBC percentage-to-letter-grade mappings, and out of this audit's scope.

---

## Part 4 — Repository boundary audit

**(a) Is SchoolRepository still the sole reader of `school_settings.grade_boundaries`?**
Yes, confirmed. Repo-wide grep for `grade_boundaries` finds exactly one raw-column reference outside test/type-generation files: `lib/repositories/school.repository.ts:18` (the `SCHOOL_SETTINGS_COLS` select-list constant). Every other hit is either (i) a downstream parameter name (`gradeBoundaries` argument threaded through `computeTermSummaries`/`generateReportCards`/`endOfTerm.ts`), (ii) the Zod schema in `app/api/core/school/route.ts:39` validating write payloads (not a read), or (iii) `lib/database.types.ts` (generated types). No file bypasses `SchoolRepository` with a direct Supabase call to read this column.

**(b) Does `lib/grading` perform grading logic only — zero DB/Supabase/repository imports?**
Confirmed still true. Full contents of `lib/grading/` re-read this sprint: `types.ts`, `validators.ts`, `gradingEngine.ts`, `boundaries.ts`, `index.ts` — no `import` statement anywhere in the directory references `@supabase`, `utils/supabase`, `lib/repositories`, or any `lib/core`/`lib/assessments` service. All 5 files import only from each other. Confirmed unchanged since Sprint 4A.

**(c) Did Sprint 4C1's migration introduce any new direct DB access, or does it still go through `repos.assessments`/`repos.schools`?**
Confirmed no new DB access. `computeTermSummaries` still calls only `repos.assessments.*` (lines 119, 124, 128, 197 — `findPublishedAssessmentsByClass`, `findMarksByAssessmentIds`, `findSubjectsByCodeList`, `upsertTermSubjectSummaries`). `generateReportCards` still calls only `repos.schools.*` (lines 14, 21, 91 — `findActiveEnrollmentsByClass`, `findTermSubjectSummaries`, `upsertReportCards`). The `gradeBoundaries` parameter is still passed in from the caller (the API route, sourced from `getSchoolSettings`), not fetched internally — the migration changed only the grading computation inside these functions, not their data-access surface.

**(d) Any hidden persistence coupling — does `lib/grading` or its 2 callers implicitly assume a DB schema shape beyond `GradeScale`/`GradeBand`?**
No. `gradeScore()`'s signature (`score, maxScore, scale`) is schema-agnostic. The 2 callers construct `GradeScale` objects from `gradeBoundaries.EE?.min ?? 75` etc. (assessments.ts:161-163, report-cards.ts:45-47) — this shape (`{ EE: { min: number }, ME: ..., AE: ... }`) is the same shape `school_settings.grade_boundaries` already had before 4C1 (per Sprint 4C0's audit); 4C1 did not change what shape is expected from that jsonb column, only what function consumes the converted `GradeScale`. One soft coupling worth naming: both callers independently duplicate the identical 4-line `GradeScale` object-literal construction (assessments.ts:158-166 and report-cards.ts:42-50 are textually identical) — this is a *new*, small duplication introduced by 4C1 itself (not present before, since there was no shared conversion step). Not a schema assumption, but a candidate for a future `buildCbcScaleFromBoundaries(gradeBoundaries)` helper in `lib/grading` (not implemented here — this is an audit, not a proposal to act on).

---

## Part 5 — Production risks

| Risk | Rank | Detail |
|---|---|---|
| **Inconsistent grading: a school with customized `grade_boundaries` now gets genuinely different letter grades on report cards (migrated, honors override) vs cohort/analytics views (not migrated, hardcoded 75/50/25) — this divergence is newly REAL, not merely theoretical, as a direct result of the partial 4C1 migration.** | **Critical** | Before 4C1, *every* implementation ignored `grade_boundaries` (it was "wired but dormant" per Sprint 4C0), so all views agreed by coincidence — everyone was wrong the same way. After 4C1, `computeTermSummaries`/`generateReportCards` honor a school's custom `EE/ME/AE` minimums; `gradeLevelFromScore` (Flow B, feeding `/api/teacher/analytics` and `/api/teacher/cohort/[grade]`) still hardcodes 75/50/25 unconditionally. Any school that sets a non-default `grade_boundaries` value will see, for the *same student, same score, same term*, one letter grade on their official report card and a *different* letter grade on the teacher cohort/analytics dashboard. Quantified exposure: Sprint 4C0 found `grade_boundaries` has "no UI/CHECK-constraint/real-fixture-usage" — i.e., no school in the current pilot has actually set a custom value yet (all get the 75/50/25 fallback default on both paths), so **today, zero schools are actually affected in practice** — but the divergence is now live latent risk with no code guard preventing it the moment any school (via direct DB write or a future UI) sets a custom value. This is the single most severe finding of this sprint: a correctness gap that used to be purely theoretical is now mechanically real, waiting on one settings write to trigger. |
| **Boundary-value conflict: 76/51/31 (`gradeCalculator.ts`, feeds live `learner_marks.mean_grade` writes) vs 75/50/25 (Core path) — a mark scoring exactly 75.0% is graded 'ME' by one path and 'EE' by the other.** | **High** | Unlike the school-setting divergence above (currently dormant), this one fires on *every* mark saved through the legacy gradebook (`lib/assessments/mutations.ts:139,194`) — any score in the (75, 76) or (50, 51) or (25, 31) percentage windows gets a materially different letter grade depending only on which of the two live write paths touched it. Flagged since Sprint 4A, still unratified. |
| **3 unconsolidated Assignments-domain copies (75/55/40) and 2 unconsolidated Notifications-domain copies (80/60/40) — pure code duplication risk, not yet a proven behavioral divergence (all copies within each domain currently agree with each other).** | **Medium** | Duplication itself is the risk: a future edit to one copy without the others silently reintroduces exactly the kind of divergence Flow A vs Flow B now demonstrates is real. No evidence any of the 5 copies currently disagrees with its siblings. |
| **`ke-cbc.ts`'s `GRADING_SCALE`/`markToGrade`/`normalizeToCBCLevel` — dead code with zero callers, silently invites a future developer to "just use the curriculum adapter's own grading function" and reintroduce a 9th boundary set.** | **Medium** | New finding this sprint. Not currently executed, so zero live risk today, but its presence inside an actively-imported (`KE_CBC`) object makes it an attractive, wrong entry point for future code — exactly the failure mode this whole Grading Engine effort exists to close off. |
| **`generateReportCards`'s missing `is_published` overwrite guard (Sprint 4C0 finding) — unchanged by 4C1, still present.** | **High (unchanged from Sprint 4C0's own ranking, re-verified not escalated or de-escalated by 4C1)** | Re-verified this sprint: `upsertReportCards` (`school.repository.ts:296-311`) does a plain `upsert(rows, { onConflict: 'learner_id,term_id' })` with no `is_published`-guard clause; `publishReportCards` (`school.repository.ts:330-345`) is a separate function with its own `.eq('is_published', false)` filter that only governs the *publish* action, not generation. A second `generateReportCards` call after publication silently overwrites a parent-visible, published report card's grades — including, now, whichever `cbc_level`/`overall_cbc_level` the (possibly newly-migrated-vs-not) grading path produced at regeneration time. 4C1 does not change this gap's severity or mechanism; it only means the overwritten grade could now come from the school-setting-aware path, which if the school's `grade_boundaries` changed between the two generation calls, is a **second, compounding way to silently alter a published grade** without any audit trail — worth noting as a mild severity increase in *effect*, though the root gap itself (no publish guard) is unchanged. |
| **Hidden recomputation: confirmed still absent post-4C1 — `overall_cbc_level`/`cbc_level` are stored once at generation time and never recomputed on read.** | **Low (confirmed non-issue, not a new risk)** | Re-verified: `findTermSubjectSummaries` (`school.repository.ts:283-296`) and the report-card read routes select the stored columns directly (`cbc_level`, `overall_cbc_level`) with no join, view, or computed-column logic. This matches Sprint 4C0's original finding exactly — 4C1 did not add or remove any recompute-on-read behavior. Listed for completeness, not because it's newly risky. |
| **API inconsistency: `/api/teacher/analytics`, `/api/teacher/cohort/[grade]`, `/api/teacher/cohorts` (Flow B, hardcoded) vs `/api/core/reports`, `/api/reports/report-card*` (Flow A, migrated) can now return disagreeing grades for the same conceptual score, for the reasons above.** | **Critical (same root cause as the first row — listed separately because it's the externally-visible symptom, not a distinct mechanism)** | Directly follows from the first row; called out separately since it's the form a developer or support engineer would actually observe (two API responses disagreeing) rather than the underlying cause. |

---

## Part 6 — Retirement plan

| Implementation | Recommendation | Justification |
|---|---|---|
| `lib/grading` (canonical engine) | **Keep permanently** | The intended single source of truth; zero DB coupling, fully tested (`gradingEngine.test.ts`). |
| `lib/core/assessments.ts`'s `toCbcLevel` / `lib/core/report-cards.ts`'s `toCbcLevel` | **Keep permanently** | Already migrated (4C1); thin adapters over `gradeScore()`, not independent logic. |
| `lib/repositories/assessment.repository.ts::gradeLevelFromScore` | **Migrate later** | Same 75/50/25 values as the Core path — mechanically similar to the 4C1 migration, but requires threading a `gradeBoundaries` parameter through `getAssessmentAnalytics`/`getCohortData`/`getTeacherCohorts` and their 3 route callers, explicitly deferred as out of scope for 4C1. This is the fix that would close the Part 5 Critical finding. |
| `lib/assessments/gradeCalculator.ts`'s `BUILTIN_CBC_SCALE` (76/51/31) + `calculateMeanGrade`/`calculateGradeFromScale` | **Migrate later — blocked on a boundary-value ratification decision first** | Cannot be mechanically migrated like 4C1's 2 call sites, because 76/51/31 vs 75/50/25 is a genuine, unresolved *value* conflict, not just a code-location duplicate. Migrating the code without first deciding which value is correct would silently change live-scored grades. Needs a human/curriculum-authority decision before any code change. |
| `lib/intelligence/cbcScale.ts` (75/50/30, Evidence Domain) | **Keep permanently** | Ratified out-of-scope, different type/domain, protected by CLAUDE.md's Evidence-ownership rule. Not part of this consolidation's target set at all. |
| `app/api/lesson-plans/[planId]/tsc-view/route.ts`, `results/page.tsx`, `[assignmentId]/page.tsx` (75/55/40, Assignments domain) | **Migrate later** | 3 low-complexity copies, internally consistent with each other, no known ratification of 75/55/40 as intentionally different from CBC's 75/50/25 — worth consolidating once someone confirms whether 75/55/40 is deliberate (Assignments may intentionally use a stricter mid-band) or just an unexamined historical fork. |
| `lib/notifications/notify.ts::deriveCbcLevel`, `lib/email/sender.ts::deriveCbcLevel` (80/60/40) | **Migrate later** | Same reasoning as Assignments domain — 2 copies, mutually consistent, unratified whether 80/60/40 is deliberate for notification-tier framing or accidental drift. |
| `lib/notifications/notify.ts::getLevelDisplay` (unused, multi-curriculum) | **Delete** | Confirmed zero callers anywhere in the repository; explicitly marked `void getLevelDisplay // available for callers` but no caller exists. Dead code, not a migration candidate. |
| `lib/curriculum/regional/ke-cbc.ts`'s `GRADING_SCALE`/`markToGrade`/`normalizeToCBCLevel` | **Delete** (or, if a future curriculum-adapter grading use case is genuinely planned, migrate to wrap `gradeScore()` instead of hand-rolling) | Confirmed zero callers; same boundary values as the Core/legacy set, so no unique information would be lost by deletion — but if kept for the curriculum-adapter's own future use, it should be rebuilt on `lib/grading` rather than left as an 8th hand-rolled implementation. |
| `lib/curriculum/regional/tz-necta.ts`, `ug-ncdc.ts` grading scales | **Keep permanently** | Different national curricula, not part of the Kenya CBC boundary conflict at all. |

---

## Part 7 — Executive verdict

**(1) Does EduNexus now have a single canonical grading engine?**
**No.** `lib/grading::gradeScore()` exists, is architecturally sound (pure, zero DB coupling, tested), and is now the actual computation for 2 of the highest-visibility surfaces (term summaries, report cards). But it is not yet *the* single engine in practice — at least 6 other implementations remain live and reachable in production: `gradeLevelFromScore` (analytics/cohorts), `gradeCalculator.ts`'s `BUILTIN_CBC_SCALE` (legacy gradebook writes), the 3 Assignments-domain copies, and the 2 Notifications-domain copies. One additional implementation (`ke-cbc.ts`) is dead but still present and importable.

**(2) What specifically prevents that statement from being true — the remaining gaps:**
- **Gap 1 (Critical, newly real):** `gradeLevelFromScore` ignores `school_settings.grade_boundaries` entirely, while the 2 migrated Core functions now honor it — a school that sets a custom boundary gets disagreeing grades between report cards and cohort/analytics views. Currently latent (no school has set a custom value yet) but structurally live.
- **Gap 2 (High, longstanding):** `gradeCalculator.ts`'s 76/51/31 scale is a genuine unratified value conflict with the 75/50/25 group, actively written to `learner_marks.mean_grade` on every legacy-gradebook mark save — cannot be closed by code migration alone; needs a curriculum-authority decision on which value is correct.
- **Gap 3 (Medium):** 5 further unconsolidated copies across Assignments (3×) and Notifications (2×) domains, each internally consistent but never verified against each other or against CBC's canonical 75/50/25.
- **Gap 4 (Medium, new finding):** dead grading logic in `lib/curriculum/regional/ke-cbc.ts` sits inside an actively-imported object, inviting future accidental reuse as a 9th implementation.
- **Gap 5 (unchanged, tracked separately, not part of engine completeness per se):** `generateReportCards`'s missing `is_published` overwrite guard remains open; not caused by or fixed by the Grading Engine work, but it means even a fully-consolidated engine could still silently overwrite a published, parent-visible grade.

**(3) Smallest future change required to achieve a fully canonical grading architecture:**
The single smallest concrete step that would eliminate the *worst* (Critical) gap is: give `gradeLevelFromScore` (and its 3 downstream API routes) the same `gradeBoundaries` parameter the 2 already-migrated functions already accept, and have it call `gradeScore()` with `CBC_SCALE_CORE_LEGACY`-shaped boundaries exactly as `computeTermSummaries`/`generateReportCards` already do — mechanically identical in shape to the 4C1 migration, just threaded one layer further (`getAssessmentAnalytics`/`getCohortData`/`getTeacherCohorts` → their 3 route callers → `getSchoolSettings`). This alone would make Flow A and Flow B agree again, closing the one gap capable of producing a currently-live (if not yet triggered) parent-report-vs-teacher-dashboard disagreement. It does **not** require resolving the 76-vs-75 `gradeCalculator.ts` conflict (Gap 2), which is a separate, harder, policy-level decision this audit does not attempt to make. No code change is proposed or drafted here, per this audit's read-only mandate — this is a description of the smallest scope, not an implementation.

---

*This document is a point-in-time audit (2026-07-15). Read-only — no code, schema, or grading boundary value was changed while producing it. See `docs/engineering/implementation-log.md`'s Sprint 4D entry for the formal closure record.*
