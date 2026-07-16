# Sprint 4B — Grading Policy Ratification: Repo-Wide Boundary Sweep

**Status: READ-ONLY EVIDENCE GATHERING. NO CODE MODIFIED.** This document catalogues every CBC grading-boundary definition found in the repository as of 2026-07-15, traces live callers, and presents evidence for Parts 5-7. It does not fix, migrate, or normalize anything. `lib/grading/` and the 4 already-known implementations are untouched.

This sprint goes beyond Sprint 4A's discovery (`docs/engineering/implementation-log.md`, Sprint 4A entry; `lib/grading/boundaries.ts`; `docs/architecture/deprecation-registry.md` #5), which found 2 distinct boundary sets across 4 files. This sweep searched the entire repository (`lib/`, `app/`, `_frozen/`, `supabase/migrations/`, `docs/`) and found **5 distinct numeric boundary sets**, not 2, across at least 14 files with independent, live logic.

---

## Part 1 — Full Inventory

### Set 1 — 76 / 51 / 31 / 0 ("Assessments/Gradebook standard")

| File | Function | Boundaries | Purpose | Live? | Duplicated? |
|---|---|---|---|---|---|
| `lib/assessments/gradeCalculator.ts:47-50` | `BUILTIN_CBC_SCALE` (consumed by `calculateGradeFromScale`/`calculateMeanGrade`) | EE≥76, ME≥51, AE≥31, BE≥0 | Teacher gradebook letter-grade calculation, default when no custom teacher grade scale exists | Yes | Sole instance of this exact set; matched only by `lib/grading/boundaries.ts::CBC_SCALE_STANDARD` (the reference-only, zero-caller Sprint 4A engine) |

Live callers of `calculateGradeFromScale`/`calculateMeanGrade` (traced by grep, not hypothetical):
- `app/teacher/classes/[classId]/assessments/page.tsx`
- `app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx`
- `lib/assessments/cohortQueries.ts`
- `lib/assessments/mutations.ts`

Note: teachers can override this with a custom `DbGradeScale` via `lib/assessments/gradeScales.ts` (`getTeacherGradeScales`/`createGradeScale`/`updateGradeScale`, backed by a real `grade_scales`-style table via `repos.assessments.*`), so 76/51/31 is this path's *default*, not its only possible output, for teachers who have configured a custom scale.

### Set 2 — 75 / 50 / 25 / 0 ("Core school-management standard")

| File | Function | Boundaries | Purpose | Live? | Duplicated? |
|---|---|---|---|---|---|
| `lib/core/assessments.ts:148-151` | inline `toCbcLevel` closure inside `computeTermSummaries` | EE≥75, ME≥50, AE≥25, BE≥0 (fallback defaults; overridable via `gradeBoundaries` param) | Term-summary CBC-level computation | Yes | Same set as report-cards.ts, assessment.repository.ts, ke-cbc.ts |
| `lib/core/report-cards.ts:29-32` | inline `toCbcLevel` closure inside `generateReportCards` | Same | Parent-facing report-card CBC level | Yes | Same |
| `lib/repositories/assessment.repository.ts:45-48` | `gradeLevelFromScore` | Same, **hardcoded, no override parameter at all** | Grade-distribution/cohort/mean-grade calculations (called at lines 648, 653, 788, 826, 839, 859, 882 of the same file) | Yes | Same |
| `lib/curriculum/regional/ke-cbc.ts:18-21` | `GRADING_SCALE` / `markToGrade` / `normalizeToCBCLevel` on the `KE_CBC` curriculum adapter | EE 75-100(lvl4), ME 50-74(lvl3), AE 25-49(lvl2), BE 0-24(lvl1) | "Canonical reference implementation" per the file's own header comment, curriculum-adapter abstraction | Yes | Same numeric set as above, independently defined |

Live callers of `KE_CBC`/`normalizeToCBCLevel` (new finding, not previously catalogued):
- `app/api/holiday/return/route.ts`
- `app/api/holiday/generate/route.ts`
- `app/api/teacher/classes/[classId]/differentiation/route.ts`
- `app/api/teacher/assessments/topical/route.ts`

**This is the only one of the 5 sets backed by a real, school-configurable database column.** `supabase/migrations/20260629_core_foundation.sql:118-119` (`school_settings` table):
```sql
grade_boundaries jsonb NOT NULL DEFAULT
  '{"EE":{"min":75},"ME":{"min":50},"AE":{"min":25},"BE":{"min":0}}'
```
The default stored in the database is 75/50/25 — i.e. Set 2, not Set 1. The full wiring chain (traced, not assumed):
- `app/api/core/school/route.ts:39` — Zod schema accepts `grade_boundaries` on school-settings PATCH.
- `lib/repositories/school.repository.ts:18` — `grade_boundaries` is selected as part of the school-settings row.
- `lib/core/endOfTerm.ts:61-65` — `processEndOfTerm` reads `input.gradeBoundaries ?? (await getSchoolSettings(...)).grade_boundaries` and passes it into both `computeTermSummaries` and `generateReportCards`.
- `app/api/core/assessments/route.ts:120` and `app/api/core/reports/route.ts:111` — call `computeTermSummaries`/`generateReportCards` directly with `settings.grade_boundaries`.

So the `gradeBoundaries` parameter on `lib/core/assessments.ts`/`lib/core/report-cards.ts` is **real and fully wired**, not a vestigial/unused parameter — a school administrator changing `school_settings.grade_boundaries` via the school-settings API genuinely changes term-summary and report-card grading for that school. `assessment.repository.ts::gradeLevelFromScore`, however, has **no such parameter** — it cannot honor a school's custom boundaries even though the DB column exists, meaning a school that customises `grade_boundaries` gets inconsistent grading between report cards (respects the setting) and cohort/mean-grade views (silently ignores it, always 75/50/25).

### Set 3 — 75 / 50 / 30 / 0 ("Evidence/Intelligence-domain numeric levels")

| File | Function | Boundaries | Purpose | Live? | Duplicated? |
|---|---|---|---|---|---|
| `lib/intelligence/cbcScale.ts:24-28` | `DEFAULT_MARKS_THRESHOLDS` / `marksToLevel` | level4≥75, level3≥50, level2≥30, else level1 | Evidence-Domain-owned raw-marks→numeric-CBCLevel(1-4) conversion | Yes | Unique to this file (re-exported, not redefined, by `gradeCalculator.ts`'s `marksToLevel`/`DEFAULT_MARKS_THRESHOLDS` re-export per that file's header comment) |

This is a genuinely different **type** (numeric `CBCLevel` 1-4, not a letter grade) and a different **domain** (Evidence/Reasoning layer, per CLAUDE.md and Decision 6 of `docs/architecture/learner-record-layer-decisions.md`), so per Sprint 4A's own scoping and CLAUDE.md's explicit ownership rule, this is out of scope for a letter-grade "grading engine" migration — but it is in scope for this sweep's Part 1 inventory, and it is a **third, distinct** boundary set (25/26 differs from both Set 1 and Set 2 at the AE floor: 31 vs 25 vs 30).

Live callers of `resolveLevel`/`marksToLevelForSchool` (which use this scale, traced by grep, new finding):
- `app/academic-clinic/page.tsx`
- `app/api/clinic/download/route.tsx`
- `lib/assignments/evidence.ts`

### Set 4 — 75 / 55 / 40 / 0 ("Assignments-domain standard") — NEW, not previously catalogued

| File | Function | Boundaries | Purpose | Live? | Duplicated? |
|---|---|---|---|---|---|
| `app/api/lesson-plans/[planId]/tsc-view/route.ts:11-16` | `cbcLevel` | level4≥75, level3≥55, level2≥40, else level1 | TSC-inspector modal's assignment-results summary | Yes (API route) | Identical to the two below |
| `app/teacher/assignments/[assignmentId]/page.tsx:290-296` | `cbcLevel` (inline in a client component) | Same | Assignment marking UI — business logic embedded directly in a page component | Yes (client component) | Identical |
| `app/teacher/assignments/[assignmentId]/results/page.tsx:59-72` | unnamed inline block (also used by `toNumericScore`) | Same | Assignment results/CSV-upload marking UI | Yes (client component) | Identical |

This set is a **fourth** distinct boundary set — it disagrees with Set 2 (75/50/25) at the ME/AE boundaries (55 vs 50, 40 vs 25) despite sharing the EE floor at 75, and disagrees with Set 1 (76/51/31) everywhere. All three instances are byte-identical to each other, so within the Assignments domain there is no internal disagreement — but the Assignments domain disagrees with every other domain. Note also: per CLAUDE.md's "Components are UI only — zero business logic" and "API routes are thin — call `lib/` functions only," two of these three instances are themselves rule violations independent of the boundary-conflict question (inline grading logic in `page.tsx` client components and in a route file, not delegated to `lib/`).

### Set 5 — 80 / 60 / 40 / 0 ("Notifications-domain standard") — NEW, not previously catalogued

| File | Function | Boundaries | Purpose | Live? | Duplicated? |
|---|---|---|---|---|---|
| `lib/notifications/notify.ts:56-63` | `deriveCbcLevel` | level4≥80, level3≥60, level2≥40, else level1 | Fallback CBC-level derivation for assignment-marked notifications, called at line 118 (`notifyAssignmentMarked`) | Yes | Byte-identical duplicate of the entry below |
| `lib/email/sender.ts:199-206` | `deriveCbcLevel` (separately defined, not imported) | Same | Fallback CBC-level derivation for the marked-assignment email template, called at line 72 | Yes | Byte-identical duplicate of the entry above |

This is a **fifth** distinct set — the widest disagreement of all five (EE floor at 80 vs everyone else's 75/76). Both instances are literal function-body duplicates of each other (same name, same body, two files) — a plain copy-paste duplication bug independent of the cross-domain policy conflict, and itself a CLAUDE.md violation ("No duplicate constant definitions across files").

`lib/notifications/notify.ts:18-53` also contains a second, unused function, `getLevelDisplay`, whose CBC branch (lines 48-51) uses **yet another** set — 75/55/40 (matching Set 4) — but it is explicitly marked dead: `void getLevelDisplay // available for callers` at line 54, and grep confirms zero call sites anywhere in the repo. Recorded for completeness (Part 1 requires archived/dead code too) but excluded from the "5 distinct live sets" count since it is provably unreachable.

### Tangential findings — presentational thresholds, not CBC grading (excluded from the 5-set count, flagged for awareness)

These use round-number score thresholds for UI color-coding or generic A/B/C/D distribution buckets, not the CBC EE/ME/AE/BE vocabulary, and do not feed `cbc_level`/report-card/grade fields:
- `lib/assessments/subjectAnalytics.ts:39-42` — generic 80/60/40 A/B/C/D distribution bucket (not CBC-labeled).
- `lib/academicClinic/pdfGenerator.tsx:840,898,987` — 75/60/45 and 75/55 presentational color thresholds for pathway-readiness/alignment scores (a composite career-readiness score, not a raw academic mark).
- `lib/academicClinic/reportGenerator.ts:728,1235,1243` — 40/55/70/75 presentational labels ("Strong"/"Developing"/"Emerging"/"Needs Work") on composite scores, same category.
- `lib/career/capabilityExtractor.ts` — 0.85/0.70/0.50/0.30 capability-tier thresholds, a 0-1 scale in a different domain (career-matching), explicitly out of scope per CLAUDE.md's Decision 6.
- `lib/pathwayCalculator.ts:446,848` — `>= 25` composite-pathway-readiness checks, unrelated numeric domain.
- Various `app/*/page.tsx` UI color thresholds (`app/(student)/career/page.tsx:213`, `app/(parent)/career-report/page.tsx:45,52,255-256`, `app/dashboard/clinic/page.tsx:614-615`, `app/teacher/classes/.../assessments/[assessmentId]/page.tsx:731-733`) — all color-code a *career match score* or *pass rate*, not CBC letter/level grading.

### `_frozen/` (EILS/EIR) — searched, nothing found

`_frozen/eir/` and `_frozen/eils/` were searched for grading-boundary literals. One superficial match (`_frozen/eir/knowledgeBase.ts:314`, `evidenceCount >= 50`) is an evidence-count threshold, not a score/grade boundary. **No grading-boundary definitions exist in frozen code.**

---

## Part 2 — Source of Truth / Origin

Traced via `git log --diff-filter=A` and `git log -p` on each defining file:

| Set | Boundaries | First introduced | Commit | Notes |
|---|---|---|---|---|
| 1 | 76/51/31 | 2026-05-26 | `cb5f49796f340ca2ddbef8d9694512f507faaf4b` — "feat: refocus landing page on parents + add assessments, notifications, and infra 🎯" | Earliest of the two "known" sets. Commit message gives no rationale for the specific numbers; no code comment in `gradeCalculator.ts` explains why 76/51/31 (one point above the round numbers) was chosen over 75/50/25. |
| 2 | 75/50/25 | 2026-06-28 | `025641cfa9fe58c9a09a4410ae73ad554411ccc5` — "feat: EduNexus Core — comprehensive school management foundation 🎯" | Introduced simultaneously in the same commit as `lib/core/assessments.ts`'s `toCbcLevel` **and** the `school_settings.grade_boundaries` DB default — i.e. Set 2 and its DB-configurability were designed together, one month after Set 1 existed, with no code comment cross-referencing or reconciling Set 1. |
| 2 (repository copy) | 75/50/25 | 2026-07-03 | `68bc2ba32462856198646065c2a53f8554072b4b` — "feat: platform foundation — infrastructure, IAM, jobs, observability, billing" | `assessment.repository.ts::gradeLevelFromScore` hardcodes Set 2's numbers again, 5 days later, still no cross-reference. |
| 3 | 75/50/30 | UNKNOWN — no evidence found | — | `lib/intelligence/cbcScale.ts`'s header comment states it is "the one raw-marks-to-CBC-level conversion used by the Evidence Domain" and documents that `gradeCalculator.ts` used to import this (backwards direction, now fixed), but does not explain why 30 (not 25 or 31) was chosen for the AE floor. Not investigated further per this sprint's time-box; flagged as a genuine gap. |
| 4 | 75/55/40 | UNKNOWN — no evidence found | — | No code comment in any of the three Assignments-domain files explains the choice of 55/40 over 50/25 or 51/31. `git blame` on `app/teacher/assignments/[assignmentId]/page.tsx`'s `cbcLevel` function was not run (out of this sprint's time-box) but the function shows no attribution comment. |
| 5 | 80/60/40 | UNKNOWN — no evidence found | — | Both `notify.ts` and `email/sender.ts` copies show no comment explaining 80/60/40; the two are identical, so most likely one was copy-pasted from the other, but which came first was not determined this sprint. |

**Origin summary: only Sets 1 and 2 have a determinable "who/when."** No KICD/official-curriculum reference document exists anywhere in `docs/` that states an authoritative CBC percentage-to-band mapping — `docs/` mentions KICD in passing (`docs/pilot-readiness-review.md`, `docs/engineering-constitution.md`, `docs/dx-ecosystem-blueprint.md`, `docs/architecture/compass-audit.md`, `docs/developer-platform-implementation-blueprint.md`, `docs/architecture/service-layer.md`, `docs/platform-implementation-guide.md`, `docs/the-educational-knowledge-graph.md`, `docs/educational-ai-systems.md`) but none of these files were found (via targeted grep for boundary numbers alongside "KICD"/"CBC"/"curriculum") to assert a specific percentage threshold as policy. `docs/reference-school/` contains no grading-boundary content at all (zero matches). **There is no documented authoritative source for either 75/50/25 or 76/51/31 anywhere in this repository.**

---

## Part 3 — Impact Analysis (traced callers per distinct set)

**Set 1 (76/51/31, `gradeCalculator.ts::BUILTIN_CBC_SCALE`)** feeds `calculateGradeFromScale`/`calculateMeanGrade`, consumed by:
- `app/teacher/classes/[classId]/assessments/page.tsx` — class assessment list/summary view
- `app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx` — single-assessment detail/marking view
- `lib/assessments/cohortQueries.ts` — cohort-level grade aggregation
- `lib/assessments/mutations.ts` — mark-saving mutation path
This is the **teacher gradebook UI's** grading engine — directly visible to teachers viewing/entering marks for individual assessments, but overridable per-teacher via `gradeScales.ts`.

**Set 2 (75/50/25, Core)** feeds `computeTermSummaries`, `generateReportCards`, and `gradeLevelFromScore`, consumed by:
- `app/api/core/assessments/route.ts` (`save-scores`/`compute` actions) → `computeTermSummaries`
- `app/api/core/reports/route.ts` → `generateReportCards`
- `app/api/core/school/end-of-term/route.ts` → `lib/core/endOfTerm.ts::processEndOfTerm` → both of the above
- `assessment.repository.ts` internal callers: grade-distribution charts, cohort mean-grade, class-mean-grade summaries (lines 648, 653, 788, 826, 839, 859, 882)
- `KE_CBC` curriculum-adapter consumers: `app/api/holiday/return/route.ts`, `app/api/holiday/generate/route.ts`, `app/api/teacher/classes/[classId]/differentiation/route.ts`, `app/api/teacher/assessments/topical/route.ts`
This is the **Core school-management/report-card/term-summary path** — the one that reaches parents (`school_report_cards`) and is the only one wired to a real per-school configuration column.

**Set 3 (75/50/30, `cbcScale.ts`)** feeds `marksToLevel`, consumed via `resolveLevel`/`marksToLevelForSchool` by:
- `app/academic-clinic/page.tsx`
- `app/api/clinic/download/route.tsx`
- `lib/assignments/evidence.ts`
Plus, per CLAUDE.md, this is the canonical numeric-level source the entire Evidence/Projection/Intelligence stack should read through (`recomputeLearnerProjection`) — out of scope for letter-grade migration but the widest-reaching set architecturally.

**Set 4 (75/55/40, Assignments)** feeds the three files listed in Part 1 directly — no shared function, each is its own closed implementation. Reaches: the TSC-inspector modal (school-inspector-facing), the assignment marking UI (teacher-facing), and the assignment results/CSV-upload UI (teacher-facing). No parent-facing surface currently traced.

**Set 5 (80/60/40, Notifications)** feeds `notifyAssignmentMarked` (in-app/WhatsApp notification text) and `sendAssignmentMarkedEmail`'s template (email notification text) — both parent-facing, fired whenever a teacher marks a student's assignment submission.

---

## Part 4 — Behaviour Difference Table

Representative scores at every boundary edge found across all 5 sets (25/26, 30/31, 40/41, 50/51, 55/56, 60/61, 75/76, 80/81):

| Score | Set 1 (76/51/31) | Set 2 (75/50/25) | Set 3 (75/50/30, numeric) | Set 4 (75/55/40) | Set 5 (80/60/40) |
|---|---|---|---|---|---|
| 25 | BE | **AE** | Level 1 | Level 1 | Level 1 |
| 26 | BE | AE | **Level 2** | Level 1 | Level 1 |
| 30 | BE | AE | Level 1 | Level 1 | Level 1 |
| 31 | **AE** | AE | **Level 2** | Level 1 | Level 1 |
| 40 | AE | AE | Level 2 | **Level 2** | Level 1 |
| 41 | AE | AE | Level 2 | Level 2 | **Level 2** |
| 50 | AE | **ME** | Level 3 | Level 2 | Level 1 |
| 51 | **ME** | ME | Level 3 | Level 2 | Level 1 |
| 55 | ME | ME | Level 3 | **Level 3** | Level 1 |
| 56 | ME | ME | Level 3 | Level 3 | Level 1 |
| 60 | ME | ME | Level 3 | Level 3 | Level 1 |
| 61 | ME | ME | Level 3 | Level 3 | **Level 3** |
| 75 | ME | **EE** | Level 4 | **Level 4** | Level 2 |
| 76 | **EE** | EE | Level 4 | Level 4 | Level 2 |
| 80 | EE | EE | Level 4 | Level 4 | Level 4 |
| 81 | EE | EE | Level 4 | Level 4 | Level 4 |

**Exact single-point "flip" boundaries across all 5 sets: at least 5 distinct edge scores (25/26, 30/31, 40/41, 50/51, 75/76) plus 55/56 and 60/61 are *within-set-4/set-1* non-edges but *cross-set* edges relative to Set 5/Set 3.** The widest disagreement is at score 75-76: a student scoring exactly 75 is graded EE by Set 2 and Set 4, ME by Set 1, Level 4 by Set 3, but only Level 2 by Set 5 (Notifications) — a single raw mark that could be described to different audiences (teacher gradebook, parent report card, parent notification, TSC inspector) as three different outcomes depending purely on which surface computed it, with no score change and no re-marking involved.

---

## Part 5 — Recommendation

Evidence-only, no personal preference applied:

**Option A — Ratify 75/50/25 (Set 2).**
- *Advantages:* Most live call sites of any set that touches the parent-facing report-card path (`generateReportCards`, `computeTermSummaries`, `gradeLevelFromScore`, plus the independently-defined `ke-cbc.ts` curriculum adapter — 4 separate files already agree on these numbers without coordination). Only set with a real, wired, per-school database override (`school_settings.grade_boundaries`, defaulting to 75/50/25) — ratifying this set requires zero DB migration, since the DB already defaults to it. `assessment.repository.ts::gradeLevelFromScore` would need to gain the `gradeBoundaries` parameter it currently lacks, but the boundary numbers themselves would not change there.
- *Disadvantages:* Would require migrating Set 1 (`gradeCalculator.ts`, the teacher gradebook UI, 4 call sites) to different numbers — a visible behaviour change to teachers viewing assessment grades (a score of 75 would newly show as EE instead of ME under Set 1's old logic). Sets 3, 4, 5 would also need separate migration decisions since they use yet other numbers not identical to 75/50/25.
- *Migration complexity:* Medium — the `gradeBoundaries`-parameter machinery already exists in 2 of the 4-in-scope files; extending it to `assessment.repository.ts` and swapping `gradeCalculator.ts`'s default scale is the main work.

**Option B — Ratify 76/51/31 (Set 1).**
- *Advantages:* This is the set `docs/architecture/deprecation-registry.md` #5 originally named as "the replacement" (though Sprint 4A's own correction flagged that the *named* replacement function, `marksToLevel`, was actually the wrong-typed target — the letter-grade function, `calculateGradeFromScale`, is the correct same-type comparison point, and it does use 76/51/31). `lib/grading/boundaries.ts` names it `CBC_SCALE_STANDARD` (i.e., Sprint 4A's authors implicitly treated it as the "standard" one when naming, though the file's own comment is explicit that this naming is not a decision).
- *Disadvantages:* Zero live database backing — the `school_settings.grade_boundaries` DB column defaults to 75/50/25, not 76/51/31; ratifying Set 1 would require a DB migration changing that default (and likely a data migration for any school that has never touched the column, since JSON defaults don't retroactively update existing rows). Fewer live call sites overall than Set 2 once `ke-cbc.ts`'s 4 downstream routes are counted. Would require migrating the entire Core/report-card path (parent-facing) to different numbers.
- *Migration complexity:* Higher — touches a live DB default plus the parent-report-card path, the platform's most visible/highest-consequence surface per prior sprints' own risk language (Sprint 3D called `generateReportCards`'s position field "the highest-visibility instance... feeds published, parent-facing report cards").

**Option C — Fully school-configurable (no fixed default, or make every consumer read from `school_settings.grade_boundaries`).**
- *Advantages:* The `gradeBoundaries` parameter/DB column machinery is already half-built for exactly this — `lib/core/assessments.ts` and `lib/core/report-cards.ts` already accept and honor a per-school override end-to-end. Sidesteps the "which round number is correct" question entirely, and gives schools the flexibility Kenyan CBC guidance (per this sweep's finding of **no** authoritative in-repo KICD source) may not have settled definitively.
- *Disadvantages:* Highest migration complexity of the three — Sets 1, 3, 4, and 5 would all need the `gradeBoundaries`-parameter pattern retrofitted (Set 3 additionally needs a type reconciliation, since it returns a numeric level, not a letter grade, per CLAUDE.md's Evidence-domain ownership rule — cannot simply be pointed at the same JSON shape as Sets 1/2/4/5 without a translation layer). Introduces a support/QA burden: cross-school comparability breaks (two schools' "ME" could mean different score ranges), which itself needs a product decision, not just an engineering one.

**Evidence-based conclusion:** the evidence found in Parts 1-4 points toward **Option A (75/50/25) has the strongest current live footing** — more independently-defined agreeing files (4: `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `assessment.repository.ts`, `lib/curriculum/regional/ke-cbc.ts`), the only real DB-backed configuration default, and it already reaches the parent-facing report-card surface. However, this sweep found **no authoritative external (KICD/official) reference document anywhere in the repository** confirming 75/50/25 (or any other set) as the objectively "correct" CBC policy — the recommendation above is therefore a statement about **which set has more live engineering investment today**, not a claim that 75/50/25 is pedagogically correct and 76/51/31 is wrong. Between A and B specifically on correctness grounds, **the evidence is genuinely inconclusive** — this sprint did not find a KICD source of truth to settle it, and that gap should be closed (by someone consulting the actual KICD CBC assessment guidelines outside this codebase) before Option A or B is finally ratified, not decided by file-count alone.

---

## Part 6 — Migration Order (provisional, pending human ratification)

Since Part 5 could not fully ratify a single winning set from evidence alone (ambiguous between A/B on correctness; C is a larger product decision), the following ranking of "which of the now-5 known implementations to migrate first, once *a* boundary is chosen" is necessarily provisional, following the same risk/visibility/impact/rollback/test-coverage rigor as Sprint 3's ranking migration order tables:

| Rank | Implementation | Risk | Visibility | User impact | Rollback difficulty | Existing tests | Behaviour-change size |
|---|---|---|---|---|---|---|---|
| 1 | `lib/grading/boundaries.ts` scale naming/comment only | None — zero callers | None | None | Trivial | `lib/grading/gradingEngine.test.ts` (24 tests, already covers both scales) | None — this is a doc/naming clarification, not a runtime change |
| 2 | `lib/notifications/notify.ts::deriveCbcLevel` + `lib/email/sender.ts::deriveCbcLevel` (Set 5) | Low-medium — parent-facing text only, not a persisted grade | Medium (parent notification/email copy) | Low — cosmetic wording ("Level 4" vs correct level) in a fire-and-forget, never-throws notification path | Easy — two small functions, no DB | None specific to these functions | Largest numeric jump (widest disagreement, per Part 4) — highest-value first fix, lowest risk since not persisted |
| 3 | Assignments domain (`tsc-view/route.ts`, `assignments/[assignmentId]/page.tsx`, `assignments/[assignmentId]/results/page.tsx` — Set 4) | Medium — teacher-facing marking UI, also feeds a school-inspector-facing modal | Medium-high | Medium — could change a displayed CBC level while a teacher is actively marking | Easy per-file, but 3 files to keep in sync during migration | None found | Also requires the separate CLAUDE.md fix (move inline logic out of `page.tsx`/route into `lib/`) — bundling that refactor with the boundary fix is efficient but widens the single change's blast radius; consider splitting |
| 4 | `lib/assessments/gradeCalculator.ts::BUILTIN_CBC_SCALE` (Set 1) | Medium-high — teacher gradebook UI, 4 traced call sites | High (teachers actively use this daily) | Medium-high — visibly changes a grade letter shown to teachers for scores 31/50/51/75/76 | Medium — 4 call sites, but scale swap is centralized in one constant | None specific found for boundary values (24 tests exist in `lib/grading/`, none in `gradeCalculator.ts` itself per this sweep) | If Option A wins: EE floor drops 75→76 becomes 75, i.e., *raises* grades at 75 (was ME, becomes EE) |
| 5 | Core path: `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `assessment.repository.ts::gradeLevelFromScore` (Set 2) | Highest — parent-facing report cards, per Sprint 3D's own established risk language for this exact code area | Highest | Highest — a published report card's grade letter | Hardest — `assessment.repository.ts` has no `gradeBoundaries` parameter yet, needs new plumbing; report cards are semi-durable artifacts once generated | Report-card-adjacent tests exist (`lib/core/generateReportCards.ranking.test.ts`) but none target grading boundaries specifically | If Option B wins: this is the largest, most consequential single migration in the whole set — matches Sprint 3D/3E's own precedent that report-card-affecting changes get individually scoped sprints, not bundled |

This ranking is the same regardless of whether Option A or B is eventually ratified — only the *direction* of the final migration (which set the others move toward) depends on that decision.

---

## Part 7 — Engineering Assessment

### 1. Architectural Assessment
- **Affected Domains:** Assessment Domain (`gradeCalculator.ts`, `assessment.repository.ts`), Core Domain (`lib/core/assessments.ts`, `lib/core/report-cards.ts`, `school_settings`), Evidence/Intelligence Domain (`cbcScale.ts` — read-only reference, out of scope for the letter-grade decision per CLAUDE.md), Assignments Domain (3 files, newly found), Notifications Domain (`notify.ts`, `email/sender.ts`, newly found), Curriculum Domain (`ke-cbc.ts` regional adapter, newly found).
- **Constitution Compliance:** No violation introduced by this sprint (read-only). The *existing state* is itself in tension with the spirit of "one canonical truth" implied elsewhere in the Constitution/RAS series (per Sprint 27/31's "two truths" pattern), but documenting a pre-existing conflict is not a new violation.
- **RAS Compliance:** Not assessed for conflict here — RAS §4/§7 (canonical domain ownership) is the right lens for whoever picks up the eventual migration; this sprint only inventories.
- **ADR Required:** Not for this sprint (no code change). **A future ADR will be required** once Option A/B/C is chosen — this is exactly the kind of canonical-policy decision the ADR process exists for (cross-domain numeric-policy ratification affecting parent-facing artifacts).
- **Current Sprint:** Evidence-gathering only, per explicit instruction. No implementation authorized.
- **Future Impact:** Whichever option is ratified will require touching at least 3 domains' worth of files (Assessment, Core, Assignments at minimum; Notifications and Curriculum-adapter if full consistency is wanted) across several sprints, per Part 6's ranking.

### 2. Engineering Assessment
- **Files affected by this sprint:** Only `docs/engineering/sprint-4b-grading-policy-ratification.md` (new) and `docs/engineering/implementation-log.md` (appended). No source file touched.
- **Files that WOULD be affected by a future migration sprint:** `lib/assessments/gradeCalculator.ts`, `lib/core/assessments.ts`, `lib/core/report-cards.ts`, `lib/repositories/assessment.repository.ts`, `lib/curriculum/regional/ke-cbc.ts`, `app/api/lesson-plans/[planId]/tsc-view/route.ts`, `app/teacher/assignments/[assignmentId]/page.tsx`, `app/teacher/assignments/[assignmentId]/results/page.tsx`, `lib/notifications/notify.ts`, `lib/email/sender.ts`, and (only if Option C) `supabase/migrations/*` for a new default/schema.
- **Repositories affected:** None this sprint. Future: `assessment.repository.ts` would need a signature change to accept `gradeBoundaries` if Option A is chosen (currently has none).
- **Services affected:** None this sprint.
- **API routes affected:** None this sprint. Future: `app/api/core/school/route.ts` (already accepts `grade_boundaries`, no change needed for Option A), `app/api/lesson-plans/[planId]/tsc-view/route.ts` (Set 4 migration).
- **Database impact:** None this sprint. Future: Option B or C would require a `school_settings.grade_boundaries` default change and possibly a backfill decision (existing rows would keep their stored value, matching precedent from Sprint 3D's "no backfill" treatment of `position_in_class`).
- **Security impact:** None — read-only research, no auth/RLS/ownership code touched.
- **Testing impact:** None this sprint (no code changed, nothing to test). Future migrations should follow Sprint 3/3D's precedent: `UNCHANGED`/`CHANGED (intentional)` test-split pattern per file, since these are also behaviour-changing correctness fixes, not mechanical refactors.
- **Deployment risk:** None for this sprint. Future: highest for the Core/report-card path (Part 6, rank 5), matching prior sprints' own established risk language for that code area.
- **Backward compatibility:** N/A this sprint.

### 3. Migration Order
See Part 6 above — provisional pending human ratification of Option A/B/C.

### 4. Risks
- **Architectural:** The platform currently has 5 independently-computed "truths" for the same academic fact (a raw score's CBC band), unknown to most of the individual teams/sprints that built each one — consistent with the "two truths" pattern flagged repeatedly in the Sprint 27/29/31 series for other subsystems. Not migrating creates growing risk as new features (e.g. future Assignments-domain features) keep copying whichever nearby file's boundary numbers they find first.
- **Business:** A student's grade letter/level materially depends on which of 5 code paths computed it — at minimum a fairness/trust concern if ever surfaced to a parent or auditor (e.g., a report card says EE at 75 while a notification email about the same score implies Level 2 under Set 5's logic).
- **Migration:** Whichever option is chosen, the report-card path (Set 2's `generateReportCards`) is the highest-consequence single migration in the whole inventory — same caution Sprint 3D/3E already established as precedent for that exact code area.
- **Security:** None identified specific to this conflict.
- **Performance:** None identified — all functions are pure/O(1) or O(n) over already-fetched data; no new query patterns implied by any option.

### 5. Approval
**Evidence gathered, awaiting human ratification of the boundary decision.** This sprint is NOT a green light to implement Option A, B, or C — Part 5 explicitly found the evidence inconclusive between A and B on correctness grounds (no authoritative KICD source located in-repo), and Option C is a larger product decision than an engineering one. SAFE TO IMPLEMENT once a human ratifies a specific option; Part 6's migration order should govern sequencing whichever option is chosen.
