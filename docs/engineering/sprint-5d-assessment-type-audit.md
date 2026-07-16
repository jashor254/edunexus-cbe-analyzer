# Sprint 5D — Assessment Type Canonicalization Audit

**Mode**: READ ONLY. No code, database, or migration changes were made in this sprint. Every finding below is cited to a file:line or migration; no recommendation beyond the migration-order sketch in §11 is made, and §11 is explicitly not to be started without separate approval.

**Trigger**: Sprint 3's audit found Core-created assessments frequently leave `assessment_type_id` NULL. This sprint traces the complete blast radius of that finding — creation, mutation, every consumer, null behavior, duplicate logic, schema integrity, and Evidence Layer impact — before anyone scopes a fix.

**Method**: full repository read across every file matching `assessment_type_id`/`assessment_types`, every INSERT into `class_assessments`/`assessments`, every migration touching either table, cross-checked against a read-only `SELECT` pass on the live pilot database (11 total `class_assessments` rows).

---

## 1. Assessment Type Sources

**The canonical table — `assessment_types`** (`supabase/migrations/20260713200000_phase_b_assessment_types.sql:24-32`):

```sql
CREATE TABLE assessment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id),
  teacher_id uuid REFERENCES teachers(id),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_id, name)
);
```

- Indexes: `idx_assessment_types_teacher_id`, `idx_assessment_types_school_id … WHERE school_id IS NOT NULL` (:34-35); `idx_assessment_types_default_purpose_id` added later (`20260714120000_production_hardening.sql:42-43`).
- `default_purpose_id uuid REFERENCES evidence_purposes(id)` added by `20260713203000_phase_g_evidence_purposes.sql:41-42`, backfilled only for the 6 Phase-B-seeded names (:44-56) — a teacher-registered custom name gets `default_purpose_id = NULL` until someone deliberately sets one, and no UI to do so exists (`lib/repositories/assessmentType.repository.ts:15-16`).
- Ownership CHECK added post-hoc: `assessment_types_exactly_one_owner` (`20260714120000_production_hardening.sql:47-52`) — exactly one of `teacher_id`/`school_id` non-null.
- RLS: teacher-owned rows full RW; school-scoped rows SELECT-only, no write path — `teachers.school` is free text, not FK'd to `schools`, so the school-scoped half of this table has never been reachable in practice (`20260713200000…sql:39-58`).
- Seed data (:67-73): every existing teacher backfilled with 6 rows — `opener(0), cat(1), midterm(2), endterm(3), exam(4), assignment(5)`.

**Independent TypeScript representations of "type" (not derived from the table above):**
- `lib/assessments/types.ts:5` — `AssessmentType = 'exam' | 'cat' | 'midterm' | 'endterm' | 'opener' | 'assignment'`, a closed union still hardcoded despite Phase B's own stated goal of removing hardcoding.
- `lib/config/assessmentTypePurposes.ts:12-19` — `ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE`, the same 6 literals mapped to purpose codes.
- `app/api/teacher/assessments/[assessmentId]/route.ts:41` — `PatchSchema.assessmentType: z.enum(['exam','cat','midterm','endterm','opener','assignment'])` — a **third, independent copy** of the same 6 literals, on the one route that lets an assessment's type be edited post-creation.
- No CSV import, seed script, or fixture exists for `assessment_types` beyond the migration's own `INSERT`.

**Which table actually is "assessments"** — three unrelated tables share the word:
1. `class_assessments` — the real Core+teacher shared table, carries `assessment_type_id` (Phase B). This is the subject of the rest of this audit.
2. `assessments` (legacy, parent/student-facing) — used only by `app/api/assessments/create/route.ts:74-91`. No `assessment_types` FK exists on it at all; the column doesn't exist on this table.
3. `strand_assessments` — used by the topical-assessment path (`lib/assessments/topical.ts`); also has no `assessment_type_id` concept.

---

## 2. Assessment Creation Matrix

| Path | Table | Sets `assessment_type_id`? | Detail |
|---|---|---|---|
| `app/api/teacher/assessments/route.ts:91-93` → `lib/assessments/mutations.ts:54-90 createAssessment` | `class_assessments` | **Always** | Calls `resolveOrCreateAssessmentType(teacherId, input.assessmentType)` (`mutations.ts:35-52`) first: exact `(teacher_id, name)` lookup, else creates a new `assessment_types` row on the fly (`sort_order` appended, `default_purpose_id` resolved via `ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE`). The resolved id is passed into `repos.assessments.createAssessment` (`assessment.repository.ts:88-119`), which inserts `assessment_type_id: input.assessmentTypeId ?? null` (:110). Never null on this path in practice. |
| `app/api/core/assessments/route.ts:124-138` → `lib/core/assessments.ts:50-66 createAssessment` → `lib/repositories/assessment.repository.ts:1005-1031 createCoreAssessment` | `class_assessments` | **Never** | `createCoreAssessment`'s input type (:1005-1018) has no `assessmentTypeId` field at all; it spreads `...input` straight into `.insert()` (:1021-1026). `input.assessment_type` is a free-text `z.string()` (`CreateSchema.assessment_type`, route.ts:14) with no lookup, no `resolveOrCreateAssessmentType` call, no default. **This is the confirmed Sprint 3 defect, structurally**: every Core-created row is born with `assessment_type_id = NULL`. |
| `app/api/assessments/create/route.ts:74-91` | legacy `assessments` | N/A | Column doesn't exist on this table. |
| `app/api/teacher/assessments/topical/route.ts:70-79` → `lib/assessments/topical.ts` | `strand_assessments` | N/A | No `assessment_type_id`/`class_assessments` reference anywhere in this file. |
| `app/api/teacher/classes/[classId]/differentiation/route.ts` | — | — | Reads/generates output after assessment processing elsewhere; performs no assessment insert. |
| `lib/repositories/teacher.repository.ts` | — | — | No assessment-creation method in this file. |

**Live pilot DB** (read-only `SELECT`): `class_assessments` = 11 rows, 0 with NULL `assessment_type_id`. All 11 pre-date any Core-created assessment in this environment — i.e. the defect is real by code inspection but has not yet manifested in live data because no school has used the Core creation path yet. This is the sprint's single most important caveat: **the defect is currently latent, not yet observed.**

---

## 3. Assessment Updates

- `app/api/teacher/assessments/[assessmentId]/route.ts:39-44 PatchSchema` allows `PATCH`-ing `assessmentType` (still the hardcoded 6-value enum) → `lib/assessments/mutations.ts:92-105 updateAssessment` → `lib/repositories/assessment.repository.ts:126-141 updateAssessment`.
- The repository's `updateAssessment` accepts only `{ title?, assessment_type?, term?, year?, max_score?, subjects? }` (:127-135) — **`assessment_type_id` is not a parameter on this method at all**, and `.update({...updates, updated_at})` (:137) cannot touch it.
- **Confirmed drift path**: a teacher can `PATCH` `assessment_type` from `"cat"` to `"exam"`; the free-text column changes but `assessment_type_id` keeps pointing at the original, now-mismatched `assessment_types` row. Nothing recomputes or validates the FK afterward.
- No DB trigger enforces immutability or consistency on `class_assessments.assessment_type_id` (exhaustive grep of every migration touching `class_assessments`). Contrast with `learner_evidence`, which does have an explicit `enforce_evidence_immutability` trigger (`20260713203000_phase_g_evidence_purposes.sql:105-140`) — no equivalent protects this column.
- Live pilot DB: 0 mismatches currently exist between `assessment_type` text and the linked `assessment_types.name` (case-insensitive) — again, the drift path is real by code inspection, not yet observed in data.

---

## 4. Assessment Consumers

| Consumer | Classification | What it does |
|---|---|---|
| `lib/assessments/evidence.ts:69-71` (`recordAssessmentEvidence`) | **Required, but narrow** | The only functional reader of `assessment_type_id`: resolves `assessment_types.default_purpose_id` → `learner_evidence.purpose_id`. Ternary, explicit no-guess: NULL id → NULL purpose. |
| `lib/intelligence/evidenceLifecycle.ts:109` (`persistEvidenceBatch`) | **Write-only, unused downstream** | Persists `purpose_id` onto `learner_evidence`. No reader (see §5). |
| `lib/assessments/reportCardEvidence.ts:44-45,83` | **Unused** | `assessment_type_id` isn't even in the select list; hardcodes `assessmentType: 'term_exam'` regardless of real type. |
| `lib/assessments/topicalEvidence.ts:64` | **Unused** | Hardcodes `'assignment'`; no assessment-row lookup at all. |
| `lib/assessments/analytics.ts`, `lib/repositories/assessment.repository.ts:524-535` | **Legacy — keys off the sibling text column** | Filters on `assessment_type` (free text), never `assessment_type_id`. |
| `lib/repositories/assessment.repository.ts:589-594` (`TYPE_LABEL`), `lib/assessments/pdfRenderer.ts:53-57` (`typeLabel`) | **Legacy, duplicated** | Two independent display-label dicts keyed on `assessment_type` text, not `_id` — already textually diverged ("Mid-Term" vs "Midterm"). |
| `lib/config/assessmentTypePurposes.ts` | **Canonical, but creation-time only** | Consulted once, inside `resolveOrCreateAssessmentType`, to seed a new type row's `default_purpose_id` — not consulted per-assessment at read time. |
| `lib/career/capabilityExtractor.ts`, `lib/projection/recompute.ts`, `lib/projection/engine.ts`, `lib/learnerRecord/timeline.ts` | **Not a consumer** | Zero references to `assessment_type`/`assessment_type_id`/`purpose_id` in any of these files (grep-confirmed empty). |
| `lib/intelligence/evidenceLifecycle.ts:57-66` (`claimKey`) | **Required, but decoupled from `assessment_type_id`** | Uses `assessmentType` (the coarse 3-value evidence enum), itself derived from the `assessment_type` **text** column (`lib/assessments/evidence.ts:35-39`), not from `assessment_type_id`. |

No Academic Clinic, recommendation engine, or dashboard file (teacher or parent) references `assessment_type_id` or `purpose_id` at all.

---

## 5. Null Propagation

- **The one live consumer** (`lib/assessments/evidence.ts:69-71`): `const purposeId = assessment.assessment_type_id ? (…).default_purpose_id ?? null : null` — a clean, explicit ternary. NULL in → NULL out, by design, never a guess (comment at :66-68 states this deliberately).
- **`purpose_id` after being written**: `EVIDENCE_COLS` includes it (`evidence.repository.ts:18`), but no query in `lib/projection/`, `lib/career/`, `lib/learnerRecord/timeline.ts`, `lib/school/`, or any `app/`/`components/` file selects or filters on it. It is write-only, dead-end audit metadata today.
- **Everywhere else** (report cards, topical evidence, analytics, PDF labels, projection, capability extraction, timeline): `assessment_type_id` is never read, so its NULL-ness is a non-event for those paths — not mishandled, simply irrelevant.
- **Net effect of a NULL `assessment_type_id` today**: exactly one observable change anywhere in the product — `learner_evidence.purpose_id` stays NULL instead of populated — and nothing downstream currently reads that field. No consumer throws, defaults incorrectly, or produces wrong learner-facing output as a direct result of this NULL. The risk is entirely about what happens **once** something starts reading `purpose_id` or once Core-created assessments start flowing into `recordAssessmentEvidence` (see §8), not about current live behavior.
- **Scope-limiting fact, confirmed via call-site grep**: `recordAssessmentEvidence` is invoked only from `app/api/teacher/assessments/[assessmentId]/marks/route.ts:144` and `.../upload/route.ts:121` — both teacher-gradebook paths, both always populated per §2. **No call site feeds a Core-created (`app/api/core/assessments`) assessment into the Evidence pipeline at all today.** The NULL-`assessment_type_id` defect and the only live Evidence-purpose consumer therefore do not currently intersect in production.

---

## 6. Duplicate Logic

Three independent, non-shared classification schemes coexist for "what kind of assessment is this":

1. **Display labels** — `assessment.repository.ts:590-593 TYPE_LABEL` vs. `pdfRenderer.ts:53-56 typeLabel`: same 6 keys, already diverged text ("Mid-Term"/"Midterm", "End-Term"/"End Term").
2. **Evidence's narrow 3-way enum** — `lib/assessments/evidence.ts:35-39 toEvidenceAssessmentType`: hand-maps `cat→cat`, `assignment→assignment`, everything else (`exam|midterm|endterm|opener`) → `'term_exam'`. Derived from the `assessment_type` text column, never from `assessment_type_id`/`assessment_types`.
3. **Hardcoded `'assignment'` placeholders with no derivation at all**, each commented "closest-fit placeholder": `lib/remarks/evidence.ts:74`, `lib/formativeSignals/evidence.ts:84`, `lib/compass/evidence.ts:93,124`, `lib/holiday/return.ts:91,113`, `lib/assessments/topicalEvidence.ts:64`, `lib/assignments/evidence.ts:79`, `lib/parentPulse/observationEvidence.ts:73`, `lib/remedial/interventionEvidence.ts:65` — eight separate evidence-producing modules, none of which consult `assessment_types`/`assessment_type_id` at all.

`ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE` (`lib/config/assessmentTypePurposes.ts`) is the only mapping that could be called canonical, but it operates on the type **name** at type-creation time, not on `assessment_type_id` at assessment-read time — structurally separate from the eight duplicate mappings above.

---

## 7. Database Integrity

```sql
-- 20260713200000_phase_b_assessment_types.sql:79-88
ALTER TABLE class_assessments DROP CONSTRAINT IF EXISTS class_assessments_assessment_type_check;
ALTER TABLE class_assessments ADD COLUMN IF NOT EXISTS assessment_type_id uuid REFERENCES assessment_types(id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_assessment_type_id ON class_assessments (assessment_type_id);
```

- **Nullable, no DEFAULT, plain FK with no `ON DELETE` clause** (defaults to `NO ACTION`), **no CHECK constraint**. The pre-existing hardcoded `assessment_type_check` CHECK on the text column was dropped in this same migration and never replaced with any equivalent guard on the new FK column.
- **No trigger** anywhere constrains `assessment_type_id` to be non-null or kept consistent with `assessment_type` (exhaustive grep of every migration referencing `class_assessments`/`assessment_type`).
- **Index exists** (`idx_class_assessments_assessment_type_id`) — lookups are indexed despite many rows potentially being NULL.
- **Backfill was one-time, not standing**: the migration's own backfill (:93-98) matched existing rows by `lower(name) = lower(assessment_type) AND teacher_id` match, filling only rows that existed *when the migration ran*. It does not run again — every row inserted afterward via the Core path (§2) stays permanently NULL with no scheduled re-backfill.
- **Seed coverage**: all 6 hardcoded literals used anywhere in code (types.ts, assessmentTypePurposes.ts, PatchSchema enum) are present in the seed `INSERT`. No literal is missing. `resolveOrCreateAssessmentType` additionally permits arbitrary custom names, which get `default_purpose_id = NULL` by design until manually set.
- **Live pilot DB** (read-only): 0 NULL `assessment_type_id` rows, 0 orphan FKs (`assessment_type_id` pointing at a nonexistent `assessment_types.id`), 0 name/FK mismatches. All consistent with the dataset simply not yet containing a Core-created row or a post-creation PATCH.
- **Original rollout plan not completed**: `docs/architecture/academic-evidence-layer.md` §7 explicitly planned `assessment_type` (text) to be "kept temporarily for backward read compatibility during rollout, dropped in a later migration once assessment_type_id is backfilled and every reader migrated." Per §4/§6 above, **no reader has migrated** except the single narrow purpose-lookup in `recordAssessmentEvidence` — analytics, labels, evidence claim-key derivation, and PDF rendering all still read the text column. The migration has been "IMPLEMENTED" (per the decisions log) in the sense of schema-added, but not in the sense of readers-migrated; it is currently a permanent half-state, not a rollout in progress.

---

## 8. Evidence Layer Impact — Dependency Chain

```
class_assessments row (assessment_type_id = NULL, e.g. a Core-created row)
   │
   ├─ lib/assessments/evidence.ts:69-71
   │    purposeId = NULL                         (explicit, no guess)
   │
   ├─ lib/assessments/evidence.ts:79
   │    assessmentType = toEvidenceAssessmentType(assessment.assessment_type)
   │    ← driven by the sibling TEXT column, NOT assessment_type_id
   │    ← UNAFFECTED by assessment_type_id being NULL
   │
   ├─ lib/intelligence/evidenceLifecycle.ts:109 (persistEvidenceBatch)
   │    learner_evidence.purpose_id = NULL
   │    learner_evidence.assessment_type = 'term_exam'|'cat'|'assignment'  (unaffected)
   │    learner_evidence.evidence_confidence = computeConfidence(...)      (unaffected —
   │        driven by identityConfidence/identityMatchType/fieldIssueCount/source,
   │        never by assessment_type_id or purpose_id)
   │
   ├─ lib/projection/recompute.ts, lib/projection/engine.ts
   │    ZERO reference to assessment_type / assessment_type_id / purpose_id (grep-confirmed).
   │    Projection is computed from cbc_level/subject/trust_tier/evidence_confidence only.
   │
   ├─ lib/career/capabilityExtractor.ts
   │    ZERO reference to assessment_type / assessment_type_id / purpose_id.
   │
   └─ lib/learnerRecord/timeline.ts (getLearnerTimeline)
        ZERO reference to assessment_type / assessment_type_id / purpose_id;
        TimelineEntry surfaces evidenceSource/subject/score/cbcLevel only.
```

**Conclusion**: a NULL `assessment_type_id` produces exactly one observable effect anywhere downstream — `learner_evidence.purpose_id` staying NULL — and per §5, that field is currently read by nothing. Evidence confidence, claim-key supersession, Projection, Capability Extraction, and the Learner Record Timeline are all driven by the `assessment_type` **text** column or by fields unrelated to assessment type entirely. **Evidence confidence/category are not affected by this NULL today** — this reframes the original Sprint 3 concern: the defect is real and structural, but its current blast radius is a single unused metadata column, not a live intelligence-quality problem, *because* Core-created assessments don't yet reach the Evidence pipeline at all (§5's scope-limiting fact).

---

## 9. Architecture Compliance

- **Violates the stated rollout completion criterion** in `docs/architecture/academic-evidence-layer.md` §7: the text column was to be dropped "once … every reader migrated." No such migration of readers has happened; the codebase now permanently carries two parallel, silently-diverging type representations (`assessment_type` text vs. `assessment_type_id` FK) with no plan or trigger keeping them in sync (§3, §6).
- **Consistent with `learner-record-layer-decisions.md` Decision 2's own discipline** ("add the field, don't invent population logic"): `purpose_id` staying NULL for 8 of 9 evidence writers is explicitly the intended, disciplined behavior per that decision — not itself a violation. The violation is narrower: the Core creation path (§2) never even attempts the resolution step that the teacher-facing path always performs, which is a gap in Rule 5's implementation, not a deviation from Decision 2's philosophy.
- **No violation of the Ninth Constitutional Law** (learner evidence must never be re-anchored without proof) — this audit found no anchor-identity issue; the gap is purely about a classification/purpose column, not learner identity.
- **CLAUDE.md's "No hardcoded costs/limits/config" spirit is violated three times over** by §6's duplicate mappings (`TYPE_LABEL`, `typeLabel`, `toEvidenceAssessmentType`, and 8 hardcoded `'assignment'` placeholders) — none of these route through `lib/config/assessmentTypePurposes.ts` or the `assessment_types` table, contrary to "no duplicate constant definitions across files."
- **CLAUDE.md's TypeScript rule ("No `any` types")** is not violated here — all sites reviewed use explicit literal unions.
- No RLS/security violation found in this domain (the `assessment_types` school-scoped RLS policy's unreachability, §1, is a dead-code/functionality gap, not a security hole — it currently permits nothing rather than permitting too much).

---

## 10. Risk Classification

| # | Finding | Section | Risk | Why |
|---|---|---|---|---|
| 1 | Core-created assessments never set `assessment_type_id` | §2 | **Medium** | Structural, confirmed defect — but currently latent (0 live rows affected) and its only consumer (§8) is a single unused metadata column. Escalates to High the moment Core-created assessments are wired into `recordAssessmentEvidence`, or the moment anything starts reading `purpose_id`. |
| 2 | `assessment_type_id` can silently desync from `assessment_type` via PATCH | §3 | **Medium** | No trigger or app-level guard; currently unobserved in data, but a teacher editing an assessment's type today already exercises this gap on every same-teacher edit. |
| 3 | Rollout never completed — text column never dropped, most readers never migrated | §7, §9 | **Medium** | Not a bug per se, but a permanently-abandoned migration midpoint; every future feature choosing which column to read is a coin flip absent this audit. |
| 4 | Three-plus duplicate type-classification mappings, already text-diverged | §6 | **Low–Medium** | Cosmetic today (label text), but the 8 hardcoded `'assignment'` evidence placeholders are a quiet, compounding source of evidence-classification imprecision independent of `assessment_type_id` entirely. |
| 5 | `assessment_type_id` FK has no `ON DELETE` clause, no CHECK, no NOT NULL | §7 | **Low** | No orphan rows exist yet; a future `assessment_types` row deletion (no delete path currently exists in code) would hit default `NO ACTION` and simply fail loudly rather than corrupt data — safe by accident, not by design. |
| 6 | `assessment_types` school-scoped RLS policy is unreachable (no write path) | §1 | **Informational** | Dead capability, not a live risk — `teachers.school` isn't FK'd to `schools` yet; pre-existing, out of this sprint's scope. |
| 7 | Live pilot data shows 0 NULLs, 0 orphans, 0 mismatches | §2, §3, §7 | **Informational** | All risks above are code-path risks proven by static analysis, not yet manifested defects — important context for prioritization, not evidence the risk is unreal. |

---

## 11. Migration Strategy (sketch only — not implemented, not approved)

Presented as independently deployable, independently reversible stages, for future approval. No implementation authorized by this document.

- **Sprint 5E** — Close the Core-creation gap: give `createCoreAssessment` the same `resolveOrCreateAssessmentType` resolution step the teacher path already has (§2, finding 1). Smallest, most isolated fix; touches one function.
- **Sprint 5F** — Add drift protection: either a DB trigger or an application-level check so `updateAssessment`'s `assessment_type` PATCH keeps `assessment_type_id` in sync, or blocks the two from diverging (§3, finding 2).
- **Sprint 5G** — Consolidate the duplicate label/classification maps (`TYPE_LABEL`, `typeLabel`, `toEvidenceAssessmentType`) into one canonical source keyed off `assessment_types`/`assessment_type_id`, decoupling them from the free-text column (§6, finding 4).
- **Sprint 5H** — Decide, explicitly, whether the original §7 rollout plan (drop `assessment_type` text once all readers migrate) is still the intended end-state or should be formally superseded — this is a product/architecture decision, not an engineering task, and should precede any reader migration work.

Each stage above is independently revertible (single-function or single-file changes, no cross-cutting schema change required for 5E–5G).

---

## 12. Deliverables

1. This document — `docs/engineering/sprint-5d-assessment-type-audit.md`.
2. Implementation Log entry — added to `docs/engineering/implementation-log.md` (read-only audit, no code modified).

---

## Stop Condition

Audit complete. No repair, refactor, engine, rename, repository change, route change, or migration was performed. **Sprint 5E is not started** and awaits explicit approval.
