# Sprint 4C0 — Grading Policy Integration Audit

**Status: READ-ONLY EVIDENCE GATHERING. NO CODE MODIFIED.** This sprint goes deeper than Sprint 4B (`docs/engineering/sprint-4b-grading-policy-ratification.md`, "READ THIS FILE FIRST" — its 5-set boundary inventory is treated here as established and re-cited, not re-derived) on one specific question Sprint 4B under-investigated: is `school_settings.grade_boundaries` real, exercised production infrastructure, or a column that exists in the schema but nothing meaningfully uses? It also produces the dependency graph, canonical-flow, configuration-strategy, and migration-readiness analysis Sprint 4B deferred. No code, schema, or grading boundary was touched. Every claim below is grounded in a file path and, where feasible, a line number.

---

## Part 1 — `school_settings.grade_boundaries` full investigation

### 1.1 Column definition, datatype, default, constraints

Single migration, `supabase/migrations/20260629_core_foundation.sql:112-124` (table `school_settings`):

```sql
CREATE TABLE IF NOT EXISTS school_settings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  curriculum_type         text        NOT NULL DEFAULT 'cbc'
                            CHECK (curriculum_type IN ('cbc', '844', 'igcse')),
  cbc_levels              jsonb       NOT NULL DEFAULT '["EE","ME","AE","BE"]',
  grade_boundaries        jsonb       NOT NULL DEFAULT
                            '{"EE":{"min":75},"ME":{"min":50},"AE":{"min":25},"BE":{"min":0}}',
  ...
);
```

- **Datatype**: `jsonb`, `NOT NULL`, default `{"EE":{"min":75},"ME":{"min":50},"AE":{"min":25},"BE":{"min":0}}` (Sprint 4B's Set 2 — 75/50/25).
- **CHECK constraint on `grade_boundaries` itself**: **UNKNOWN — no evidence found.** `grep -n "CHECK" supabase/migrations/20260629_core_foundation.sql` (line-numbered above the table) shows CHECK constraints on `curriculum_type`, `term_number`, `category`, `role`, `gender`, `status`, `promotion_type`, `direction`, `grading_type`, `cbc_level`, `overall_cbc_level` — none constrain the *shape* or *monotonicity* of the `grade_boundaries` JSON blob. A PATCH could in principle write `{"EE":{"min":10},"ME":{"min":90}, ...}` (non-monotonic, would silently invert grading) and the database would accept it — the only gate is the Zod schema at the API layer (§1.4 below), not the database. This is a real gap relative to CLAUDE.md's "every table must have... explicit validation" spirit and RAS §7's enforcement-floor principle ("every rule stated in §7/§8 that matters for correctness or security must be enforced here too, not only in application code").
- **No CHECK constraint** ties `grade_boundaries` to `curriculum_type` — a school with `curriculum_type = '844'` or `'igcse'` still carries a `grade_boundaries` column defaulting to CBC's EE/ME/AE/BE shape, with no evident guard against it being read/applied under a non-CBC curriculum. Not traced further (out of this sprint's grading-boundary scope) but flagged.

### 1.2 Full migration history

`grep -rn "grade_boundaries" supabase/migrations/*.sql` across **all 42 migration files** (`ls supabase/migrations/` enumerated, 20260520 through 20260714) returns exactly **one hit**: `20260629_core_foundation.sql:118`. No later migration (`20260701` through `20260714_production_hardening.sql`, `20260707_senior_secondary_grades.sql` included) alters, extends, or adds a CHECK to this column. **Full migration history: created once, 2026-06-28 (commit `025641c`, per Sprint 4B Part 2), never touched again.**

`supabase/migrations/20260707_senior_secondary_grades.sql` (the one migration that extends Core for CBC Senior School, Grade 10-12) is explicitly documented in its own header as "100% additive: widens two CHECK constraints [on `grades.category` and `subjects.category`], adds reference rows. No existing row, column, or constraint value is removed or altered." It does **not** touch `school_settings` or `grade_boundaries` at all — Senior School shares the exact same single `grade_boundaries` column, per-school, as Junior. There is no `grade`- or `category`-scoped grading-boundary override anywhere in the schema (see §4's CBC Senior compatibility discussion).

### 1.3 Every code path that READS `grade_boundaries`/`gradeBoundaries`

`grep -rln "gradeBoundaries\|grade_boundaries" lib/ app/ scripts/ docs/`:

| File | Line(s) | What it does |
|---|---|---|
| `lib/repositories/school.repository.ts` | `SETTINGS_COLS` constant (~line 18) includes `grade_boundaries` | Selects the column as part of the school-settings row read (`findSettings`) |
| `lib/core/assessments.ts` | 148-151 | `computeTermSummaries`'s inline `toCbcLevel` closure — accepts a `gradeBoundaries` param, falls back to Set 2 literals (75/50/25) if a key is absent |
| `lib/core/report-cards.ts` | 29-32 | `generateReportCards`'s inline `toCbcLevel` closure — same shape, same fallback |
| `lib/core/endOfTerm.ts` | 61-65 | `runEndOfTerm`: `const gradeBoundaries = input.gradeBoundaries ?? (await getSchoolSettings(input.schoolId)).grade_boundaries` — the one place the DB value is actually fetched and threaded through, when no explicit override is passed |
| `app/api/core/assessments/route.ts` | 120 | Fetches `settings` via `getSchoolSettings`, passes `settings.grade_boundaries` into `computeTermSummaries` |
| `app/api/core/reports/route.ts` | 111 | Same pattern into `generateReportCards` |
| `lib/database.types.ts` | generated | Type-only, mirrors the DB schema |
| `docs/engineering/sprint-4b-grading-policy-ratification.md`, `sprint-3-assessment-domain-audit.md` | — | Prior documentation, not code |

**`lib/repositories/assessment.repository.ts::gradeLevelFromScore`** (Sprint 4B's finding, re-verified) still has **no `gradeBoundaries` parameter at all** — confirmed again this sprint via `grep -n "gradeLevelFromScore" -A5 lib/repositories/assessment.repository.ts`: it is a hardcoded 75/50/25 function with no override input, called internally at 7 sites in that same file for cohort/mean-grade/distribution views. This is the one Set-2-numbered function that structurally *cannot* read `grade_boundaries` even though it uses the same numbers by coincidence of hardcoding, not by configuration.

### 1.4 Every code path that WRITES `grade_boundaries` — is there a real update path?

- `app/api/core/school/route.ts:34-38` — `UpdateSettingsSchema` (Zod) accepts `grade_boundaries: z.record(z.string(), z.object({ min: z.number() })).optional()` as one field of a PATCH body with `type: 'settings'`.
- `app/api/core/school/route.ts:88-116` (`PATCH` handler) — routes `type === 'settings'` bodies to `upsertSchoolSettings(schoolId, parsed.data)`, which calls `lib/repositories/school.repository.ts::upsertSettings` (`.upsert({ school_id: schoolId, ...settings }, { onConflict: 'school_id' })`).
- **This is the only write path in the entire repository.** `grep -rn "upsertSchoolSettings" app/ lib/ scripts/ --include=*.ts` returns exactly 3 hits: the export in `lib/core/school.ts:99`, its one caller (`app/api/core/school/route.ts:112`), and the repository implementation itself (`lib/repositories/school.repository.ts:138`, inside the error message string). **No other route, script, cron, or seed file ever calls `upsertSchoolSettings`.**
- The `PATCH` route itself has a pre-existing, documented authorization inconsistency (its own code comment, `app/api/core/school/route.ts:94-99`): it checks `['school_admin', 'headteacher']`, excluding `deputy_headteacher`, unlike every other admin-gated Core route — flagged there as a known gap from Sprint 1B, not touched by this sprint.

**Conclusion: the write path is real (a school admin or headteacher could PATCH `grade_boundaries` today via a raw API call), but nothing in the product actually exercises it** — see §1.5.

### 1.5 UI component for editing `grade_boundaries`

`grep -rln "grade_boundaries\|gradeBoundaries\|grade boundar" app --include=*.tsx` returns **zero matches**. No `.tsx` file anywhere in `app/` renders a form, input, slider, or any control referencing grade boundaries. `grep -rln "api/core/school" app --include=*.tsx` finds exactly one caller of the School API from a page component: `app/admin/core-schools/new/page.tsx` — read (via `cat`, confirmed it is the school-*creation* flow, `POST`, not `PATCH type=settings`). **There is no settings/admin page anywhere that lets a school configure `grade_boundaries`.** The Zod-validated PATCH endpoint exists; the UI to drive it does not.

### 1.6 Real production usage — reference-school fixture and seed scripts

- `grep -rn "grade_boundaries\|school_settings\|curriculum_type\|cbc_levels" scripts/reference-school/01-seed-school.ts` — **zero matches.** The reference-school school-creation script (`scripts/reference-school/01-seed-school.ts:29-42`) inserts only a `schools` row (name, type, county, contact info) — it never inserts, upserts, or references `school_settings` at all.
- `grep -rn "school_settings" scripts/reference-school/*.ts` (all 6 files: `01-seed-school.ts` through `06-seed-legacy-bridge.ts`) — **zero matches** across the entire reference-school seeding pipeline.
- `grep -n "computeTermSummaries|generateReportCards|processEndOfTerm|toCbcLevel|cbc_level" scripts/reference-school/05-seed-assessments.ts` (the assessments seed file, the one that would plausibly trigger grade computation) — **zero matches.** The reference-school fixture seeds raw assessment/mark data but never runs the term-summary or report-card generation pipeline that would read `grade_boundaries`.
- **No database trigger auto-creates a `school_settings` row on school insert.** `supabase/migrations/20260629_core_foundation.sql:745-770` shows the only trigger machinery touching `school_settings` is the generic `update_updated_at_column()` trigger applied uniformly to 16 tables (timestamp maintenance only, not row creation).
- **`lib/repositories/school.repository.ts::findSettings` (line 119-127) uses `.single()`**, which throws if zero rows match. Since `createSchool` (`lib/core/school.ts:16-30`) never inserts a `school_settings` row, and no reference-school script ever calls `upsertSchoolSettings`, **the Mwatate Ridge reference school almost certainly has no `school_settings` row at all** — meaning any code path that calls `getSchoolSettings(referenceSchoolId)` (e.g. `runEndOfTerm` without an explicit override) would throw `getSchoolSettings: ...` rather than silently falling back to the JSON default. (This sprint did not run a live query against the actual Supabase project to confirm row-existence with certainty — flagged as **UNKNOWN — confirmable via a single `SELECT` against the live `school_settings` table, not performed this sprint per read-only/no-live-query-tooling-invoked scope**, but the code-path evidence above is unambiguous: nothing in the seeding pipeline creates the row.)

**Verdict for Part 1**: `school_settings.grade_boundaries` is **real, live, correctly-typed, and genuinely wired through 2 of the 5 boundary sets' consumer chain** (`computeTermSummaries`, `generateReportCards`, transitively `runEndOfTerm`) — this is not a dead column. But it is **not exercised by production usage today**: no UI writes it, the only reference-fixture school in the repository never has a row for it, and the write path's sole caller is an unused Zod-validated API surface with a known, un-remediated authorization gap. It is best described as **wired-but-dormant infrastructure** — real plumbing with no faucet handle and, as far as this sprint's evidence shows, no school that has ever turned the tap.

---

## Part 2 — Usage trace / dependency graph

For each of Sprint 4B's 5 sets, origin classification and arrow-graph:

**Set 1 (76/51/31, Assessments/Gradebook)** — origin: **hardcoded literal constant** (`BUILTIN_CBC_SCALE`, `lib/assessments/gradeCalculator.ts:47-50`), no DB read.
```
BUILTIN_CBC_SCALE (hardcoded constant)
  → calculateGradeFromScale / calculateMeanGrade (lib/assessments/gradeCalculator.ts)
    → app/teacher/classes/[classId]/assessments/page.tsx
    → app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx
    → lib/assessments/cohortQueries.ts
    → lib/assessments/mutations.ts
```
(Overridable per-teacher via `lib/assessments/gradeScales.ts`'s `DbGradeScale` — a *second*, teacher-level DB-backed override path, distinct from `school_settings.grade_boundaries`, not investigated further this sprint since Sprint 4B already scoped it as "default, not sole output.")

**Set 2 (75/50/25, Core)** — origin: **school_settings.grade_boundaries (read from DB)** for 2 of 4 files; **hardcoded literal** for the other 2.
```
school_settings.grade_boundaries (DB, jsonb, per-school)
  → getSchoolSettings() (lib/core/school.ts:95-97)
    → runEndOfTerm() (lib/core/endOfTerm.ts:61-65)
      → computeTermSummaries() (lib/core/assessments.ts) [inline toCbcLevel, honors param]
      → generateReportCards() (lib/core/report-cards.ts) [inline toCbcLevel, honors param]
    → app/api/core/assessments/route.ts:120 → computeTermSummaries()
    → app/api/core/reports/route.ts:111 → generateReportCards()

hardcoded literal (75/50/25, no DB read, no override param)
  → gradeLevelFromScore() (lib/repositories/assessment.repository.ts:45-48)
    → 7 internal call sites in the same file (cohort/mean-grade/distribution views, lines 648,653,788,826,839,859,882)

hardcoded literal (75/50/25, independently defined)
  → GRADING_SCALE / markToGrade / normalizeToCBCLevel (lib/curriculum/regional/ke-cbc.ts:18-21)
    → app/api/holiday/return/route.ts
    → app/api/holiday/generate/route.ts
    → app/api/teacher/classes/[classId]/differentiation/route.ts
    → app/api/teacher/assessments/topical/route.ts
```

**Set 3 (75/50/30, Evidence/Intelligence numeric CBCLevel)** — origin: **hardcoded literal** in a curriculum-constant-adjacent Evidence-domain file (out of scope for letter-grade migration per CLAUDE.md's Decision 6/Fourth Constitutional Law).
```
DEFAULT_MARKS_THRESHOLDS (hardcoded constant, lib/intelligence/cbcScale.ts:24-28)
  → marksToLevel() / resolveLevel() / marksToLevelForSchool()
    → app/academic-clinic/page.tsx
    → app/api/clinic/download/route.tsx
    → lib/assignments/evidence.ts
```

**Set 4 (75/55/40, Assignments)** — origin: **inline literal, duplicated 3x independently** (repository-layer/component-layer logic, not a shared function or DB read).
```
inline literal (75/55/40, duplicated verbatim in 3 files, no shared source)
  → app/api/lesson-plans/[planId]/tsc-view/route.ts:11-16 (route-level business logic — CLAUDE.md violation independent of the boundary question)
  → app/teacher/assignments/[assignmentId]/page.tsx:290-296 (client-component business logic — CLAUDE.md violation)
  → app/teacher/assignments/[assignmentId]/results/page.tsx:59-72 (client-component business logic — CLAUDE.md violation)
```

**Set 5 (80/60/40, Notifications)** — origin: **inline literal, duplicated 2x byte-identically** (notification-domain logic).
```
inline literal (80/60/40, byte-identical duplicate)
  → lib/notifications/notify.ts:56-63 (deriveCbcLevel) → notifyAssignmentMarked() (line 118)
  → lib/email/sender.ts:199-206 (deriveCbcLevel, separately defined) → sendAssignmentMarkedEmail() (line 72)
```

**Summary table:**

| Set | Origin classification | DB-backed? |
|---|---|---|
| 1 | Hardcoded literal in function (`BUILTIN_CBC_SCALE`) | No (teacher-level override exists via separate `grade_scales`-style table, not `school_settings`) |
| 2a (Core: assessments.ts, report-cards.ts) | `school_settings.grade_boundaries`, DB read | Yes |
| 2b (`assessment.repository.ts`) | Hardcoded literal, no param | No |
| 2c (`ke-cbc.ts`) | Hardcoded literal, curriculum-adapter constant | No |
| 3 | Hardcoded literal, Evidence-domain constant | No |
| 4 | Inline literal, duplicated 3x, no shared source | No |
| 5 | Inline literal, duplicated 2x, no shared source | No |

**Only Set 2a is genuinely DB-backed.** Every other implementation — including two of the four files that share Set 2's exact numbers — is a hardcoded literal that happens to agree (or not) with the DB default by coincidence of copy-paste, not by configuration.

---

## Part 3 — Canonical flow

### 3.1 What the flow SHOULD look like

```
school_settings.grade_boundaries (DB, one column, School domain)
  → SchoolRepository.findSettings() / .upsertSettings()   [already exists, lib/repositories/school.repository.ts]
    → a Domain Service (e.g. a new GradeBoundaryService, or grade-boundary-reading
       functions folded into the existing lib/core/school.ts, per RAS §5's "never
       duplicate another service — extend the canonical one if it exists")
      → lib/grading/gradeScore(score, maxScore, scale)   [Sprint 4A's pure function, currently zero callers]
        → Assessment  (lib/core/assessments.ts::computeTermSummaries)
        → Report Cards (lib/core/report-cards.ts::generateReportCards)
        → Analytics   (lib/repositories/assessment.repository.ts::gradeLevelFromScore and its 7 internal callers)
        → Promotion   (lib/core/promotions — not traced this sprint, flagged as an unverified consumer)
        → Notifications (lib/notifications/notify.ts, lib/email/sender.ts)
        → Exports     (any CSV/PDF generator reading a cbc_level column, e.g. lib/academicClinic/pdfGenerator.tsx — tangential per Sprint 4B, not a grading consumer)
```

### 3.2 Cross-check against RAS and the Canonical Domain Registry

- **`docs/architecture/reference-architecture-specification.md` §3** lists `Academic Year / Term` as owned by `SchoolRepository`/`lib/core/school.ts` — the same repository/service pair that already owns `school_settings` reads/writes (`grade_boundaries` is a column on a School-domain table, one row per school, exactly like `academic_years`/`terms`). `grep -n "school_settings" docs/architecture/reference-architecture-specification.md docs/architecture/canonical-domain-registry.md docs/architecture/canonical-domain-evolution-blueprint.md` returns **zero matches** — `school_settings` is not explicitly named as a canonical table anywhere in the ratified architecture documents, but by the same pattern already established for `academic_years`/`terms` (a School-domain sub-table read/written through `SchoolRepository`/`lib/core/school.ts`, no dedicated repository), the RAS's own convention implies `school_settings` is School-domain, `SchoolRepository`-owned, by extension rather than by explicit listing. This is a **documentation gap**, not an architectural conflict — flagged for a housekeeping addition to §3's table, not an ADR-triggering issue on its own.
- **RAS §4** ("Repository Standards"): "A repository importing or querying a table outside its named domain is a standards violation... A repository is created when a domain is named canonical in §3 and doesn't yet have one." `grade_boundaries` already has a home (`SchoolRepository`) that matches the existing convention for School-domain settings tables.
- **RAS §5** ("Service Standards"): "Never duplicates another service. Before writing a new service function, check §3's Canonical Service column — if one already exists for the domain, extend it." The School domain's canonical service is `lib/core/school.ts`, which already exports `getSchoolSettings`/`upsertSchoolSettings`.

### 3.3 Does a "GradeBoundaryRepository"/"GradeBoundaryService" fit without an ADR?

**Depends entirely on which shape it takes:**

- **A thin service function that reads `school_settings.grade_boundaries` via the *existing* `SchoolRepository` and calls `lib/grading/gradeScore()`** (i.e., Option B/A framing in Part 4 below, keeping the single-column-per-school model) — **does NOT require an ADR.** It changes no canonical identity, no ownership (still School-domain, still `SchoolRepository`), introduces no new table or architectural layer, does not touch the Evidence/Intelligence boundary, and is squarely "ordinary feature work that stays entirely within an existing canonical domain's established repository/service/API" (RAS §12's own exemption clause). Per the Architecture Guardian Mode trigger list (`feedback_architecture-guardian-mode.md`): none of "changes a canonical identity / changes canonical ownership / introduces a new architectural layer or canonical domain / changes Intelligence boundaries / changes repository responsibilities / changes security architecture / changes migration strategy / changes the Constitution / conflicts with the RAS" is triggered.
- **A dedicated `GradeBoundaryRepository` split out from `SchoolRepository` as a standalone class/file** — this **would** cross "changes repository responsibilities" (a named ADR trigger): it extracts a table currently inside `SchoolRepository`'s domain into a new repository, which RAS §4 explicitly treats as a standards event requiring justification ("A repository importing or querying a table outside its named domain is a standards violation... regardless of how small or convenient"). Whether that specific extraction needs an ADR versus just staying inside `SchoolRepository` is exactly the kind of question RAS §12 exists to gate — **conservatively, this counts as an ADR trigger**, since it changes which repository owns a table's read/write responsibility.
- **Option C's versioned-policy design** (a new `grade_boundary_policies` table with effective-dating, decoupled from the single `school_settings.grade_boundaries` column — see Part 4) — this **definitely requires an ADR**: it introduces a canonical table not listed in §3 (a new canonical domain, per the first ADR trigger bullet verbatim: "Introduces a new canonical domain not listed in §3"), and depending on design, may also change `Report Card`'s existing Dependencies/Allowed-Consumers row in §3's table (a documented Canonical Domain Standards change).

**Conclusion**: **No ADR is required** to wire the *existing* `school_settings.grade_boundaries` column through `lib/grading/gradeScore()` for the currently-Set-2-numbered consumers (Assessment, Report Cards, `assessment.repository.ts`'s cohort views), provided this stays inside the existing `SchoolRepository`/`lib/core/school.ts` service boundary and does not introduce a new table. **An ADR IS required** if the eventual migration (a) splits grade-boundary storage into a dedicated new repository separate from `SchoolRepository`, or (b) adopts Option C's versioned-policy model, since (b) introduces a canonical domain (a new table) not currently listed in RAS §3 — the first, most explicit ADR trigger in the document.

---

## Part 4 — Configuration strategy (Options A/B/C)

Grounded in Parts 1-3's evidence, not preference.

### Option A — Hardcoded national boundaries (collapse to one national scale, no `school_settings` involvement)

- **Architecture fit**: Simplest — removes the `gradeBoundaries` parameter from `computeTermSummaries`/`generateReportCards` entirely, collapses to a single constant like Set 1's `BUILTIN_CBC_SCALE`. No repository/service change beyond deletion.
- **Migration complexity**: Low for the 2 files that already read the DB column (`lib/core/assessments.ts`, `lib/core/report-cards.ts`) — remove the parameter, hardcode. Medium overall since 4 other independently-hardcoded sets (1, 2b, 2c, 3, 4, 5) still need reconciling to the same number regardless of this decision — Option A does not reduce that work at all, it only forecloses the DB-column path.
- **Historical-report preservation**: N/A directly (see Part 5 — `overall_cbc_level` is stored regardless of which option is chosen), but Option A removes any future possibility of a school customizing boundaries, so there is nothing to preserve *against* going forward.
- **Performance**: Marginally better (no DB read for boundaries) — not a measured concern per Sprint 4B (`gradeLevelFromScore` etc. are already O(1)/O(n) pure functions).
- **Maintainability**: Highest — one number, one place, easiest to reason about and test.
- **School flexibility**: None. Directly contradicts the fact that `school_settings.grade_boundaries` was deliberately built as a per-school override (Sprint 4B Part 2: "Set 2 and its DB-configurability were designed together, one month after Set 1 existed" — a documented product intent, not an accident) — Option A would mean **abandoning** already-shipped, if unused, infrastructure (§1.6's finding).
- **CBC compatibility**: Neutral — matches CBC's typical practice of a single national percentage band, if that is in fact KICD's policy (Sprint 4B: **still unresolved, no in-repo authoritative source**).
- **Senior School (Grade 10-12) compatibility**: Neutral to positive — `20260707_senior_secondary_grades.sql`'s header confirms Senior School was deliberately added as "100% additive" to the *same* `school_settings` row/column model as Junior, with no CBC-Senior-specific grading override anywhere in the schema (§1.2). A single national constant naturally continues that "one scale for all grades" pattern with zero additional schema work.

### Option B — Per-school configurable (what `school_settings.grade_boundaries` already nominally supports today, partially)

- **Architecture fit**: Best fit with *existing* infrastructure — the DB column, its default, the `SchoolRepository` read/write path, and 2 of the 5 call sites already work this way (§1.3-§1.4). No new table, no ADR (per Part 3.3's first bullet).
- **Migration complexity**: Medium — the remaining 3 hardcoded call sites in the Core/Assessment path (`gradeLevelFromScore`, `ke-cbc.ts`) would need the `gradeBoundaries` parameter retrofitted (Sprint 4B's Set-2 migration-order rank 5, the highest-risk single migration). Sets 1, 3, 4, 5 (Assessments-gradebook, Evidence, Assignments, Notifications domains) are architecturally separate and would each need their own decision about whether to *also* read `school_settings.grade_boundaries` or keep their own defaults — this sprint found no evidence any of them currently intend to.
- **Historical-report preservation**: **Requires care** — per Part 5, `overall_cbc_level`/`cbc_level` are stored, computed once at generation time, but `generateReportCards` is upsert-based with no guard against a second call using changed boundaries silently overwriting an already-published row (Part 5's central finding). Option B without an additional guard **actively risks** the historical-preservation property Option A doesn't need and Option C would need to solve explicitly.
- **Performance**: One extra `SELECT` per generation batch (already happening today for the 2 wired files) — negligible, not a measured concern.
- **Maintainability**: Medium — one canonical value per school, but now every new grading consumer must remember to thread the parameter through (as `gradeLevelFromScore`'s current omission demonstrates happens in practice).
- **School flexibility**: Full, for the specific dimension of "which score maps to which letter" — but per §1.6, **zero schools currently use this flexibility in the only real fixture the repository has** (the reference school), so this sprint cannot confirm real-world demand for it, only that engineering effort was already spent building the option.
- **CBC compatibility**: Same unresolved-correctness caveat as Option A (Sprint 4B: no KICD source found either way) — plus the added, and also unresolved, question of whether per-school customization is itself CBC-compliant (a national curriculum arguably implies national bands; this sprint found no in-repo evidence either way).
- **Senior School compatibility**: Same table, same column, shared across Junior and Senior grades within a school (§1.2) — Option B doesn't add Senior-specific flexibility; a school choosing custom boundaries gets one scale for Grade 7 and Grade 12 alike. If CBC Senior genuinely needs different bands than Junior (this sprint found **no documented evidence it does or doesn't** — `20260707_senior_secondary_grades.sql`'s header is silent on grading, and `docs/reference-school/02-academic-structure.md` was checked via grep for "grading" and returned no matches), Option B does not solve that; only Option C's finer-grained model could, and even then would need an explicit grade-band dimension added to the schema, which does not exist today.

### Option C — Per-academic-year versioned grading policies

- **Architecture fit**: Requires a new table (e.g. `grade_boundary_policies`, keyed by `school_id` + effective date/term/year) — per Part 3.3, this **introduces a canonical domain not listed in RAS §3**, triggering the ADR process explicitly. Not a small change.
- **Migration complexity**: Highest of the three. Needs: new table + RLS policies + indexes (per CLAUDE.md's "every table must have" baseline), a resolution function ("which policy version applies to term X"), and a decision about what happens to `school_settings.grade_boundaries` itself (deprecate it in favor of the new table's "current" row, or keep it as a cached denormalization — either choice needs its own design pass).
- **Historical-report preservation**: **This is the option's entire purpose**, and it is the only one of the three that structurally guarantees it *without relying on discipline* — an already-generated report card would record which policy-version generated it (or, since `overall_cbc_level` is already stored per Part 5, simply never needs to be regenerated against a newer policy at all, provided the re-generation-overwrite gap identified in Part 5 is also closed). Critically, an effective-dated design must be **explicit** about the point Part 5 raises: a re-generation run after a boundary change, without an explicit "use the policy that was current when this term was open" resolution rule, would use the *wrong* year's policy just as easily as Option B would — versioning alone doesn't prevent this, only a resolution rule keyed to the term/generation-time (not wall-clock "current") does.
- **Performance**: Marginally worse — a resolution query (probably `ORDER BY effective_date DESC LIMIT 1` style) replaces a flat `single()` read. Not a measured concern at current scale (50 pioneer schools).
- **Maintainability**: Lowest of the three short-term (new table, new resolution logic, new tests) but potentially the most maintainable long-term if boundary changes across years turn out to be a real recurring need — this sprint found **no evidence of demand for this** (no school has even used Option B's simpler single-value override yet, per §1.6), so building Option C now would be speculative relative to this sprint's evidence.
- **School flexibility**: Full, plus temporal flexibility (a school could legitimately change its scale between academic years without corrupting history).
- **CBC compatibility**: Same unresolved-correctness caveat as A/B.
- **Senior School compatibility**: This is the only option that could *cleanly* add a grade-band dimension later (Junior vs. Senior having different boundaries) without another schema redesign, since it already generalizes "one fixed value" into "a resolvable policy" — but this sprint found **no requirement anywhere in `docs/` that CBC Senior actually needs different grading conventions than Junior** (checked `docs/reference-school/02-academic-structure.md`, `docs/reference-school/README.md`, `supabase/migrations/20260707_senior_secondary_grades.sql` — all silent on grading-boundary differences by grade band). This is a speculative future-proofing benefit, not a currently-evidenced need.

### Evidence-based conclusion

The evidence in Parts 1-3 does **not** clearly favor one option:
- **Against Option A**: it discards real, deliberately-built (if unused) infrastructure (§1.4, §1.6) and the DB default already encodes Set 2, not a from-scratch national constant — reverting that seems like more, not less, work than keeping it.
- **Against Option B as currently built**: real usage evidence for the flexibility is **zero** (§1.6) — this sprint could not find a single school, including the only reference fixture in the repository, that has ever set a non-default value — and its upsert-without-a-publish-guard behavior (Part 5) makes it actively risky to historical reports without an additional fix that has not been designed yet.
- **Against Option C**: it is the most architecturally correct answer to the historical-preservation question in the abstract, but this sprint found no evidence of the specific need (year-over-year boundary changes, or Junior/Senior divergence) it is designed to solve — building it now would be ahead of demonstrated demand, which conflicts with this codebase's own standing philosophy (`feedback_start-simple-grow-later.md`: "smallest correct slice first, proven with real data, before generalizing").

**If a recommendation must be stated from the evidence alone**: Option B's *infrastructure* is real and closer to production-ready than Option A implies and cheaper than Option C requires, but it needs the Part 5 re-generation guard closed before it can be trusted with historical data, and its "flexibility" benefit is currently unproven by any real school. This sprint does not resolve the A-vs-B correctness question Sprint 4B also left open — that remains a human decision.

---

## Part 5 — Historical data: stored vs. computed-on-read

### 5.1 The tables and columns

`grep -n "CREATE TABLE" supabase/migrations/20260629_core_foundation.sql` locates both tables:

- **`term_subject_summaries`** (`supabase/migrations/20260629_core_foundation.sql:636-652`): `cbc_level text CHECK (cbc_level IN ('EE','ME','AE','BE'))` — a **stored** column, `weighted_score numeric(5,2)` also stored alongside it.
- **`school_report_cards`** (`supabase/migrations/20260629_core_foundation.sql:689-710`): `overall_cbc_level text CHECK (overall_cbc_level IN ('EE','ME','AE','BE'))` — a **stored** column, `overall_score numeric(5,2)` stored alongside it.

Both are plain `text` columns with a CHECK on the 4 valid CBC letters — not generated/computed columns, not views. Confirmed by `grep -n "GENERATED\|AS (" supabase/migrations/20260629_core_foundation.sql` around these two `CREATE TABLE` blocks returning no matches — these are ordinary stored values, written by application code, not database-computed expressions.

### 5.2 Where they are written — computed once, at generation time

`lib/core/report-cards.ts:64` (`generateReportCards`): `overall_cbc_level: toCbcLevel(avg)` — computed **once**, inline in the row-construction step, using whatever `gradeBoundaries` was passed into the function at call time (§1.3's `toCbcLevel` closure, lines 29-32 of the same file). The resulting rows are written via `repos.schools.upsertReportCards(rows)` (`lib/core/report-cards.ts:72`), which (`lib/repositories/school.repository.ts:297-313`) performs `.upsert(rows, { onConflict: 'learner_id,term_id' })` against `school_report_cards`.

`lib/core/assessments.ts:148-151`'s `toCbcLevel` closure inside `computeTermSummaries` writes `term_subject_summaries.cbc_level` the same way — computed once at compute-time, stored.

### 5.3 Where they are read — display, not recompute

`grep -rn "overall_cbc_level|term_subject_summaries|school_report_cards" lib/ app/` (excluding `.test.` files) shows every read path selects the **stored** column directly:
- `lib/repositories/school.repository.ts:27` (`REPORT_COLS` constant) selects `overall_cbc_level` as a plain column.
- `lib/repositories/school.repository.ts:348-365` (`findReportCardWithSubjects`) selects `cbc_level` from `term_subject_summaries` verbatim, joined, no recomputation.
- `app/(parent)/report-card/page.tsx:135` — `<p>...{report.overall_cbc_level ?? '—'}</p>` — **renders the stored string directly**, with no raw-score-to-grade recomputation anywhere in the component. `grep -n "toCbcLevel\|gradeBoundaries\|grade_boundaries" app/\(parent\)/report-card/page.tsx` (traced) returns no matches — the page has no grading logic of its own to recompute anything, by design.

**No code path recomputes `cbc_level`/`overall_cbc_level` from raw scores + current boundaries at render/read time anywhere this sprint could find.** This matches Sprint 3D's own established finding (referenced in this sprint's earlier grep of `docs/engineering/sprint-3-assessment-domain-audit.md`) that `generateReportCards` writes `overall_cbc_level` (and `position_in_class`, per that sprint's ranking work) once at generation time, not on every read.

### 5.4 The critical caveat: re-generation is not guarded

This is the highest-stakes finding of this sprint, and it complicates the otherwise-reassuring "stored, not computed-on-read" conclusion above:

- `generateReportCards` (`lib/core/report-cards.ts:6-73`) has **no check anywhere in its body for `is_published`** — `grep -n "is_published" lib/core/report-cards.ts` returns exactly one match, at line 67, and it is the row-construction step *setting* `is_published: false` on every newly-generated row, not a guard reading the existing value before overwriting.
- `app/api/core/reports/route.ts`'s `POST` handler's default branch (the "Generate" action, lines ~103-116) calls `getSchoolSettings` fresh on every request and passes `settings.grade_boundaries` straight into `generateReportCards` — **there is no check for whether report cards for this `classId`+`termId` already exist and are published** before calling generate again.
- `upsertReportCards` (`lib/repositories/school.repository.ts:297-313`) performs `.upsert(rows, { onConflict: 'learner_id,term_id' })` — the `UNIQUE (learner_id, term_id)` constraint (`supabase/migrations/20260629_core_foundation.sql:710`) means a second `generate` call for the same term **overwrites the existing row**, including its `overall_cbc_level`, `is_published` (reset to `false`!), and `published_at` (implicitly cleared, since the upserted row omits it) — regardless of whether the original row was already published and shown to a parent.

**Conclusion**: `cbc_level`/`overall_cbc_level` are **stored, computed-once-at-generation-time values, not recomputed on read** — so changing `school_settings.grade_boundaries` today does **not** retroactively change what a parent sees on an already-generated report card **unless someone (deliberately or accidentally) re-runs the `generate` action for that same class/term after the boundary change**, in which case the stored value **is silently overwritten** with the new boundary's grading, **even for already-published report cards**, because `generateReportCards`/`upsertReportCards` have no publish-state guard. This is not a "computed on read" drift risk (Sprint 27/29/31's usual "two truths" pattern) — it is a narrower but real **"re-generation drift"** risk: the danger window is not every page view, but every accidental or intentional second `generate` call.

### 5.5 What "version-safe" would require if Option C is chosen

If `school_settings.grade_boundaries` becomes versioned/effective-dated (Option C, Part 4), version-safety requires **both**:
1. **An explicit effective-date resolution rule** tying a specific policy version to the term being computed (e.g., "use the policy that was current on the term's `start_date` or `end_date`," not simply "whatever's marked `current` at generation time") — otherwise a late re-generation (a common, already-supported operation per §5.4) would pick up whichever policy is "current" at generation *wall-clock* time, not the policy that was actually in force during the term, silently reintroducing the exact drift risk Option C exists to prevent.
2. **A publish-state guard on `generateReportCards` independent of the boundary-versioning question** — this is arguably a prerequisite fix regardless of which Option A/B/C is chosen, since §5.4's re-generation-overwrite gap exists today under the *current*, unversioned single-value column, and would not be automatically fixed merely by adding versioning on top of it.

---

## Part 6 — Migration readiness

Sprint 4B's Part 6 ranked 4 implementation clusters (grouping Set 2's 3 files together). This sprint's Part 1/2 findings confirm the count is **not just 4, but effectively 7 distinct call-site clusters** once Set 2 is split into its DB-backed and hardcoded halves and Set 4/5's newly-catalogued files are counted individually by domain:

| Rank | Cluster | Risk | Visibility | User impact | Rollback difficulty | Test coverage | Behaviour-change magnitude | New evidence this sprint |
|---|---|---|---|---|---|---|---|---|
| 1 | `lib/grading/boundaries.ts` naming/comment only | None (zero callers) | None | None | Trivial | 24 tests in `gradingEngine.test.ts` | None | Unchanged from Sprint 4B |
| 2 | Notifications domain (`notify.ts`, `email/sender.ts` — Set 5) | Low-medium | Medium (parent copy) | Low — cosmetic, not persisted | Easy | None specific | Largest single-set numeric jump | Unchanged from Sprint 4B |
| 3 | Assignments domain, 3 files (Set 4) | Medium | Medium-high | Medium | Easy per-file, 3 files to keep in sync | None found | Bundled CLAUDE.md refactor (move logic to `lib/`) widens blast radius | Unchanged from Sprint 4B |
| 4 | `gradeCalculator.ts::BUILTIN_CBC_SCALE` (Set 1) | Medium-high | High (daily teacher use) | Medium-high | Medium (4 call sites, 1 constant) | None specific for boundary values | EE floor 76→75 raises grades at score 75 | Unchanged from Sprint 4B |
| 5 | `assessment.repository.ts::gradeLevelFromScore` (Set 2b) — **newly split out from the old rank-5 cluster** | High — same numbers as Set 2a today (75/50/25) by coincidence, not configuration, so a *silent* behavior gap already exists (§1.3) even before any boundary decision is made: it cannot honor a school's custom `grade_boundaries` today | High (cohort/mean-grade/distribution views, 7 internal call sites) | Medium — currently invisible because Set 2a and 2b happen to agree numerically | Medium — needs the `gradeBoundaries` parameter added, 7 call sites in one file to update together | None found | If Option B is chosen with real school customization, this is where the *existing*, already-live inconsistency (report cards honor a school's custom setting; cohort views silently don't) becomes user-visible for the first time | New: this sprint's §1.3 confirms this gap is live *today*, independent of any future migration — a school that used the existing PATCH endpoint right now would already see this split |
| 6 | `ke-cbc.ts` curriculum-adapter + 4 downstream routes (Set 2c) | Medium-high — feeds Holiday Planner (`app/api/holiday/return`, `/generate`) and differentiation/topical-assessment routes, none parent-facing directly but all teacher-facing planning tools | Medium | Medium | Medium — 1 constant + 4 call sites, but "canonical reference implementation" framing in the file's own header comment (per Sprint 4B) suggests other code may treat it as authoritative, raising coordination risk | None found | Feeds AI-assisted planning tools (holiday plans, differentiation) where a wrong CBC level could skew a generated recommendation, not just a displayed label | New: this sprint traces it as its own rank distinct from Set 2a/2b since its consumers (Holiday/Differentiation) are a different blast radius than Report Cards |
| 7 | Core path: `lib/core/assessments.ts`, `lib/core/report-cards.ts` (Set 2a, the DB-backed pair) | Highest — parent-facing, publish/re-generation-overwrite risk newly confirmed in Part 5 | Highest | Highest — a published report card's grade letter, and per Part 5.4, a *second* generate call silently overwrites it | Hardest — `generateReportCards` has no publish-guard (Part 5.4), so even *today's* single-value model has an unaddressed rollback/safety gap independent of any future boundary migration | `lib/core/generateReportCards.ranking.test.ts` exists but targets ranking/ties, not grading boundaries or the re-generation-overwrite path | Same as Sprint 4B, plus: this sprint's Part 5.4 finding means this cluster now also needs a **publish-state guard fix** before any boundary-value migration, as a logically prior, independently-necessary change | New: the re-generation-overwrite gap (Part 5.4) is a **prerequisite bug fix**, not a boundary-migration concern — recommend it be scoped and fixed on its own, ranked ahead of (or alongside) any Option A/B/C migration work for this cluster specifically |

**This ranking is provisional pending Part 4's policy decision (A/B/C) — it does not authorize migrating any of the 7 clusters.** The one specific escalation from this sprint: rank 7's re-generation-overwrite gap (Part 5.4) is arguably **not** boundary-migration work at all — it is a live data-integrity gap in the *existing* single-value model, independently worth a human decision on urgency regardless of which grading-policy option is eventually ratified.

---

## Part 7 — Engineering Assessment

### 1. Architectural Assessment
- **Affected Domains**: School (`school_settings`, `SchoolRepository`, `lib/core/school.ts`), Assessment (`lib/core/assessments.ts`, `lib/repositories/assessment.repository.ts`), Report Card (`lib/core/report-cards.ts`, `school_report_cards`, `term_subject_summaries`), Assignments (not currently in the Canonical Domain Registry at all — confirmed via `grep -n "Assignment" docs/architecture/reference-architecture-specification.md docs/architecture/canonical-domain-registry.md`, zero matches — a registry gap, not just a grading gap), Communication/Notifications (`lib/notifications/notify.ts`, `lib/email/sender.ts`), Curriculum (`lib/curriculum/regional/ke-cbc.ts`), Learning Evidence/Intelligence (`lib/intelligence/cbcScale.ts`, out of scope per the Fourth Constitutional Law).
- **Constitution Compliance**: No violation introduced by this sprint (read-only, no code touched). The pre-existing state — 5 boundary sets, one DB column wired to 2 of them, a re-generation-overwrite gap on the parent-facing path — remains in tension with the "one canonical truth" principle underlying the Constitution/RAS series, consistent with the Sprint 27/29/31 "two truths" pattern, now joined by a narrower "re-generation drift" variant this sprint newly documents.
- **RAS Compliance**: `school_settings` is not explicitly named in RAS §3's table (a documentation gap, §3.2), though its existing `SchoolRepository`/`lib/core/school.ts` ownership matches the established School-domain pattern used for `academic_years`/`terms`. `assessment.repository.ts::gradeLevelFromScore`'s lack of a `gradeBoundaries` parameter is a live inconsistency inside an otherwise RAS-compliant repository (RAS §4's "never duplicates queries" is not violated — this is a parameter gap, not a duplicate implementation — but it is a correctness gap relative to what School-domain configuration should mean).
- **ADR Required**: **Not for this sprint** (no code change). Per Part 3.3: **not required** to wire the existing `school_settings.grade_boundaries` column through `lib/grading/gradeScore()` for the currently-Set-2-numbered consumers, provided the work stays inside `SchoolRepository`/`lib/core/school.ts`'s existing boundary. **Required** if a future migration (a) creates a dedicated `GradeBoundaryRepository` separate from `SchoolRepository` (crosses "changes repository responsibilities"), or (b) adopts Option C's versioned-policy table (crosses "introduces a new canonical domain not listed in §3" — the most explicit trigger of the two).
- **Current Sprint**: Evidence-gathering only, per explicit instruction. No implementation authorized.
- **Future Impact**: Whichever option is ratified touches at minimum School, Assessment, and Report Card domains; a full-consistency migration (closing all 5 sets) also touches Assignments, Notifications, and the Curriculum adapter — 6+ domains total, consistent with Sprint 4B's own estimate, now sharpened by this sprint's finding that the Core/Assessment path alone splits into 3 independently-rankable clusters (2a/2b/2c), not 1.

### 2. Engineering Assessment
- **Files affected by this sprint**: Only `docs/engineering/sprint-4c0-grading-policy-integration.md` (new) and `docs/engineering/implementation-log.md` (appended). No source file touched.
- **Repositories/Services/API routes that WOULD be affected once implemented**:
  - `SchoolRepository`/`lib/core/school.ts` — no change needed for Option A/B (already exposes `getSchoolSettings`/`upsertSchoolSettings`); Option C needs a new repository method set or a genuinely new `GradeBoundaryRepository`.
  - `lib/repositories/assessment.repository.ts` — needs a `gradeBoundaries` parameter added to `gradeLevelFromScore` and its 7 internal callers (Rank 5, Part 6) for Option B/C to be honored consistently.
  - `lib/curriculum/regional/ke-cbc.ts` — needs either a parameter or a documented decision that it intentionally stays fixed (Rank 6).
  - `app/api/core/school/route.ts` — already accepts `grade_boundaries` on PATCH; would need no route-shape change for Option A/B, but its known `deputy_headteacher` exclusion gap (§1.4) should be considered alongside any work here since it's the same file.
  - A future settings UI (`app/admin/...` or `app/(school)/...`, not currently found anywhere per §1.5) would need to be built from scratch if Option B/C's flexibility is ever meant to be school-facing rather than API-only.
  - `lib/core/report-cards.ts`/`app/api/core/reports/route.ts` — need a publish-state guard added to `generateReportCards` (Part 5.4) independent of any boundary-value decision.
- **Database impact**: None this sprint. Future: Option C requires a new table + RLS + indexes (CLAUDE.md baseline: `id` uuid, `created_at`/`updated_at`, named FK indexes). Option A/B require no schema change (Option A might remove the `gradeBoundaries` parameter but the DB column itself could remain unused rather than dropped, consistent with the "deprecate before deleting" Evolution Policy in RAS §13).
- **Security impact**: None this sprint (read-only). Future: the PATCH route's `deputy_headteacher` exclusion gap (§1.4) is adjacent to but not caused by any grading-policy work — should be flagged, not silently fixed as a side effect of an unrelated migration, per the codebase's own "smallest compliant solution" discipline.
- **Testing impact**: None this sprint. Future migrations should add: (a) a behavior-parity test for `gradeLevelFromScore`'s new parameter (matching Sprint 3's "UNCHANGED/CHANGED (intentional)" split convention), (b) a new re-generation-overwrite regression test for `generateReportCards` (Part 5.4 — currently untested), (c) if Option C, resolution-logic tests proving a late re-generation picks the term's *original* policy, not the wall-clock-current one (Part 5.5).
- **Deployment risk**: None this sprint. Future: highest for the Report Card cluster (Rank 7, Part 6), now compounded by the newly-found re-generation-overwrite gap, which is a live risk independent of any boundary-value change.
- **Backward compatibility**: N/A this sprint. Future: Option A is the only one of the three that could plausibly be a breaking change for any school that has (undetectably, per §1.6) already customized `grade_boundaries` — though this sprint found no evidence any school has.

### 3. Risk Assessment
- **Architectural**: `school_settings` remains architecturally correct (School-domain, `SchoolRepository`-owned per established convention) but undocumented in RAS §3's explicit table — a housekeeping gap, not a conflict. Assignments domain remains entirely absent from the Canonical Domain Registry, a pre-existing gap this sprint surfaces again but does not create.
- **Business**: Unchanged from Sprint 4B's finding — a student's grade materially depends on which of (now 7, not 5) code paths computed it. This sprint adds a second, narrower business risk: the re-generation-overwrite gap (Part 5.4) means a school admin could, today, with zero boundary-policy change at all, accidentally erase a published report card's grade by re-triggering "Generate" — a live data-integrity risk independent of the grading-boundary ratification question entirely.
- **Migration**: Same highest-risk-last-in-sequence conclusion as Sprint 4B, sharpened: the Report Card cluster (Rank 7) now carries an additional, logically-prior bug (Part 5.4) that arguably needs its own fix before any boundary-value migration is layered on top of it.
- **Security**: None newly identified specific to grading. The PATCH route's known role-set inconsistency (§1.4) is adjacent, pre-existing, and out of this sprint's scope.
- **Performance**: None identified — consistent with Sprint 4B; all functions traced remain pure/O(1)/O(n) over already-fetched data.

### 4. Migration Readiness
See Part 6. Provisional, now a 7-cluster ranking rather than Sprint 4B's 4/5-cluster framing, reflecting this sprint's split of Set 2 into its DB-backed (2a) and hardcoded (2b, 2c) halves. **Not an authorization to migrate anything.**

### 5. Approval
**Evidence gathered; SAFE TO IMPLEMENT once Part 4's policy option (A/B/C) and Sprint 4B's boundary ratification (which numeric set — 75/50/25 vs. 76/51/31 vs. other — is correct) are both decided by a human.** This sprint additionally surfaces one finding that may warrant its own, earlier decision independent of the boundary-policy question: Part 5.4's re-generation-overwrite gap in `generateReportCards` is a live data-integrity risk under the *current*, already-shipped single-value `grade_boundaries` model — a human should decide whether that specific gap needs its own prioritized fix ahead of, or independent from, the larger grading-policy consolidation this sprint and Sprint 4B jointly describe. Nothing in this sprint authorizes writing that fix, or any other code, yet.
