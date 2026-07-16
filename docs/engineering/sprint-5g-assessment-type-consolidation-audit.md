# Sprint 5G — Assessment Type Consolidation Audit (READ-ONLY)

**Mode**: READ ONLY. No code, test, migration, schema, route, repository, or service file was modified in producing this report. Only this document and the implementation log entry were written.

**Scope**: with ADR-0002 implemented (Sprint 5F — Core assessment creation now correctly writes both `teacher_id` and `assessment_type_id`), this audit inventories everything that *remains* duplicated, inferred, or inconsistent in the Assessment Type architecture, and whether it's safe to plan consolidation work (Sprint 5H) yet.

---

## 1. Architectural Assessment

**Current canonical representation**: `assessment_types` (table) + `class_assessments.assessment_type_id` (FK) — established by Phase B (`supabase/migrations/20260713200000_phase_b_assessment_types.sql`), now correctly populated by **both** assessment-creation paths (teacher-facing, `lib/assessments/mutations.ts::createAssessment`; Core, `lib/core/assessments.ts::createAssessment`, fixed in Sprint 5F) and kept in sync on edit (`lib/assessments/mutations.ts::updateAssessment`'s PATCH-sync fix, Sprint 5E).

**Legacy representations, still live**:
- `class_assessments.assessment_type` (free-text column) — never dropped. Phase B's own migration comment states it was "kept temporarily for backward read compatibility during rollout, dropped in a later migration once assessment_type_id is backfilled and every reader migrated" (`docs/architecture/academic-evidence-layer.md` §7). No reader has migrated except the one `purpose_id` lookup — confirmed unchanged from Sprint 5D.
- `learner_evidence.assessment_type` (a narrower, hand-derived 3-value enum: `'term_exam'|'cat'|'assignment'`) — entirely independent of `assessment_type_id`, produced by `toEvidenceAssessmentType()` (`lib/assessments/evidence.ts:35-39`) from the *text* column, or hardcoded outright in 8 other evidence-producer modules.
- Two independent display-label dictionaries (`TYPE_LABEL`, `lib/repositories/assessment.repository.ts:591-594`; `typeLabel`, `lib/assessments/pdfRenderer.ts:54-57`), both keyed on the text column, already textually diverged ("Mid-Term" vs "Midterm").

**Constitution / RAS / ADR-0002 / CLAUDE.md compliance, re-checked**:
- **ADR-0002**: fully satisfied for its stated scope (Teacher-domain identity — `teacher_id`). ADR-0002 never addressed `assessment_type`/`assessment_type_id` at all; nothing here contradicts it.
- **RAS**: no RAS section names `assessment_types`/`assessment_type_id` as a distinct domain; it falls under the Assessment domain generally, which the RAS does not detail column-by-column. No conflict found, but also no explicit RAS ruling to cite — this is a genuine gap, not a violation.
- **CLAUDE.md**: "No duplicate constant definitions across files" is still violated by the two label dictionaries and the ad hoc `toEvidenceAssessmentType`/8-hardcoded-placeholder pattern — unchanged from Sprint 5D, not touched by Sprints 5E/5F/ADR-0002 since none of them were scoped to fix it.
- **No new violation was introduced or discovered this session** beyond what Sprint 5D already found, **except** one newly-located writer (§3, `05-seed-assessments.ts`) that has the identical "never sets `assessment_type_id`" defect Sprint 5E fixed in its sibling script — see §3 and §4.

**Is another ADR required?** **Not yet, on current evidence.** The open questions here (whether/when to drop the legacy text column; whether to consolidate the label dictionaries; whether to unify the evidence 3-value enum with `assessment_types`) are consolidation/implementation decisions, not identity/domain-ownership decisions of ADR-0002's kind. They would need one only if a future sprint proposes *removing* the text column while live readers still depend on it (§6 shows several genuinely do) — that removal is the kind of decision this audit recommends **against** attempting yet (§9).

---

## 2. Complete Call Graph

Only verified edges — each arrow below is backed by a direct code reference; no edge is inferred.

```
createAssessment (2 verified production entry points)
  │
  ├─ lib/assessments/mutations.ts::createAssessment (teacher-facing)
  │     └─ resolveOrCreateAssessmentType() → assessment_type_id  [ALWAYS populated]
  │
  └─ lib/core/assessments.ts::createAssessment (Core, fixed Sprint 5F)
        └─ resolveOrCreateAssessmentType() → assessment_type_id  [ALWAYS populated, since 5F]

  (2 additional, NOT going through either createAssessment function — found this session)
  ├─ scripts/reference-school/05-seed-assessments.ts:49-62 — raw .insert(), assessment_type_id NEVER set
  └─ scripts/reference-school/06-seed-legacy-bridge.ts:490-503 — raw .insert(), assessment_type_id set
        via its own resolveOrCreateAssessmentType() call (fixed in Sprint 5E's correction)
        ↓
assessment_type_id writers (all of the above insert paths; no UPDATE path sets it except
  lib/assessments/mutations.ts::updateAssessment's PATCH-sync, Sprint 5E)
        ↓
assessment_type_id readers
  ├─ lib/assessments/evidence.ts:69-71 (recordAssessmentEvidence) → learner_evidence.purpose_id
  │     — the ONLY reader anywhere in the codebase (confirmed by repo-wide grep, unchanged from
  │       Sprint 5D)
  ↓
Evidence pipeline
  └─ lib/intelligence/evidenceLifecycle.ts:109 (persistEvidenceBatch) writes purpose_id onto
        learner_evidence — VERIFIED dead end: no downstream reader of purpose_id anywhere
        (confirmed again this session, §6)
        ↓
Analytics — NO VERIFIED EDGE. lib/assessments/analytics.ts / analyticsStats.ts key exclusively off
        the assessment_type TEXT column (unchanged from Sprint 5D); zero reference to
        assessment_type_id
        ↓
Reports — NO VERIFIED EDGE. lib/core/report-cards.ts, lib/core/endOfTerm.ts,
        lib/assessments/pdfRenderer.ts, lib/assessments/reportCardEvidence.ts: zero reference to
        assessment_type_id (confirmed this session)
        ↓
Projection — NO VERIFIED EDGE. lib/projection/recompute.ts, lib/projection/engine.ts: zero
        reference to assessment_type or assessment_type_id or purpose_id (confirmed this session)
        ↓
Adaptive Learning — NO VERIFIED EDGE. lib/adaptiveLearning/differentiation.ts writes teacher_id but
        has zero reference to assessment_type_id
        ↓
Career Intelligence — NO VERIFIED EDGE. lib/career/* (capabilityExtractor.ts and siblings): zero
        reference, confirmed this session
        ↓
Academic Clinic — NO VERIFIED EDGE. lib/academicClinic/assessmentPipeline.ts references teacher_id
        (Part 5 of ADR-0002) but zero reference to assessment_type_id
        ↓
Reference School — VERIFIED EDGE, but only for teacher_id/creation, not assessment_type_id readback:
        06-seed-legacy-bridge.ts writes assessment_type_id (fixed); 05-seed-assessments.ts does not
        read it back either, it only writes assessment_type (text)
```

**Reading**: the graph the sprint brief sketched (Evidence → Analytics → Reports → Projection → Adaptive Learning → Career Intelligence → Academic Clinic → Reference School, as if `assessment_type_id` flows through all of them) **does not exist as a real chain**. `assessment_type_id` has exactly one live consumer (`purpose_id` resolution), which is itself a dead end (§6). Every other named subsystem either doesn't touch assessment type at all, or touches only the legacy text column. This is unchanged from Sprint 5D's finding, re-verified fresh this session with no new consumer discovered.

---

## 3. Duplication Inventory

| # | File:Line | Purpose | Caller | Canonical? | Duplicate? | Dead? | Unreachable? |
|---|---|---|---|---|---|---|---|
| 1 | `lib/assessments/mutations.ts:35-52` `resolveOrCreateAssessmentType` | Canonical name→row resolution/creation | Both `createAssessment` paths, `updateAssessment`, `06-seed-legacy-bridge.ts` | **Yes — the canonical function** | No | No | No |
| 2 | `lib/repositories/assessmentType.repository.ts` (whole file) | Data access for `assessment_types` | `resolveOrCreateAssessmentType` only | Yes (repository layer) | No | No | No |
| 3 | `lib/core/assessments.ts:52-96` `createAssessment` | Core creation, now resolves both ids (Sprint 5F) | `app/api/core/assessments/route.ts` | Yes | No | No | No |
| 4 | **`scripts/reference-school/05-seed-assessments.ts:49-62`** — raw `.insert()`, sets `assessment_type: 'cat'`, never sets `assessment_type_id` | Reference-school Mathematics CAT seed row | `scripts/reference-school/run-all.ts` (pipeline) | No | **Partial — same defect class as pre-Sprint-5E `06-seed-legacy-bridge.ts`, never itself fixed** | **Effectively yes in this environment** — the script's own try/catch (lines 66-73) catches `class_assessments_class_id_fkey` violations and skips seeding entirely, because (per its own header comment, lines 8-15) `class_id` targets Core's `classes`, which fails the live FK to `teacher_classes`. Confirmed live: 11 total `class_assessments` rows, 0 attributable to this script. | Yes, in the current schema state — will only start writing (and then produce a NULL `assessment_type_id` row) once the separately-known `class_id` FK gap is closed |
| 5 | `scripts/reference-school/06-seed-legacy-bridge.ts:490-503` | Reference-school Kiswahili CAT seed row | Same pipeline | Yes (fixed, Sprint 5E correction) | No | No | No |
| 6 | `lib/assessments/evidence.ts:35-39` `toEvidenceAssessmentType` | Maps 6-value text type → 3-value evidence enum | `recordAssessmentEvidence` (line 79) | No | **Yes — a second, independent classification of "assessment type," derived from the text column, never from `assessment_type_id`** | No — actively used on every teacher-marks/upload call | No |
| 7 | `lib/repositories/assessment.repository.ts:591-594` `TYPE_LABEL` | Display label for report titles | Report-title generation | No | **Yes — duplicate #1 of 2 display-label maps** | No | No |
| 8 | `lib/assessments/pdfRenderer.ts:54-57` `typeLabel` | Display label for PDF rendering | PDF generation | No | **Yes — duplicate #2, already textually diverged from #7** | No | No |
| 9 | 8 hardcoded `assessmentType: 'assignment'` literals: `lib/remarks/evidence.ts:74`, `lib/formativeSignals/evidence.ts:84`, `lib/compass/evidence.ts:93,124`, `lib/holiday/return.ts:91,113`, `lib/assessments/topicalEvidence.ts:64`, `lib/assignments/evidence.ts:79`, `lib/parentPulse/observationEvidence.ts:73`, `lib/remedial/interventionEvidence.ts:65` | Placeholder "closest fit" classification for non-assessment evidence sources | 8 separate evidence-producing modules | No | **Yes — 8-way duplicated inline classification, none consulting `assessment_types`** | No — all actively called from their respective evidence-producing flows | No |
| 10 | `lib/search/index.ts:38,40` `searchAssessments` | Command-palette subtitle text | Teacher dashboard global search | No (reads text column) | No (single reader, not duplicated elsewhere) | No | No |
| 11 | `lib/events/types.ts:104` `assessment_type: string` | Event payload field (`teacher.assessment.created`) | `publishEvent` calls in `mutations.ts` | No (audit/event metadata) | No | No — actively populated on every creation event | No |

**No inline `switch`/`if-else` classification chains were found beyond what's listed** (`toEvidenceAssessmentType`'s 2-branch if-chain, item 6, is the only one; the two `TYPE_LABEL`/`typeLabel` dictionaries are object-lookup maps, not branching logic).

---

## 4. Synchronization Audit

| Write path | Sets `assessment_type` | Sets `assessment_type_id` | Can they diverge? | Classification |
|---|---|---|---|---|
| `lib/assessments/mutations.ts::createAssessment` (teacher INSERT) | Yes | Yes, via `resolveOrCreateAssessmentType` | No | **Always synchronized** |
| `lib/core/assessments.ts::createAssessment` (Core INSERT, Sprint 5F) | Yes | Yes, via `resolveOrCreateAssessmentType` | No | **Always synchronized** |
| `lib/assessments/mutations.ts::updateAssessment` (teacher PATCH) | Yes, if `assessment_type` is in the update payload | Yes, re-resolved via `resolveOrCreateAssessmentType` when `assessment_type` changes (Sprint 5E fix) | No, for this exact update shape | **Always synchronized** — but only because there is no direct way to PATCH `assessment_type_id` alone; if one were ever added, it would immediately become "never synchronized" for that new path |
| `scripts/reference-school/05-seed-assessments.ts` (seed INSERT) | Yes (`'cat'`) | **No** | **Yes — permanently, by omission** | **Never synchronized** (currently masked by the FK-skip in §3 item 4 — not yet observed in live data, but the code path itself is uncorrected) |
| `scripts/reference-school/06-seed-legacy-bridge.ts` (seed INSERT) | Yes | Yes | No | **Always synchronized** |
| CSV import (`upsertMarksCSV`, `lib/assessments/mutations.ts:182+`) | N/A — this path writes `learner_marks` rows against an *existing* `assessment_id`; it never touches `assessment_type`/`assessment_type_id` at all | N/A | N/A | **Not applicable — confirmed no assessment-type field is touched by this path** |
| Assessment cloning / duplication | N/A | N/A | N/A | **Feature does not exist** — confirmed by repo-wide search (`cloneAssessment`/`duplicateAssessment`/`copyAssessment`: zero matches) |
| Bulk creation | N/A | N/A | N/A | No bulk-assessment-creation endpoint found distinct from the single-assessment `createAssessment` paths already covered |
| Migration scripts (schema migrations touching these columns) | N/A (DDL only) | N/A | N/A | Phase B/Phase G migrations are additive DDL + one-time backfills, already audited safe in `phaseBMigration.safety.test.ts`/`phaseGMigration.safety.test.ts` (still passing, Sprint 5F) |

**Net finding**: every *reachable* write path is synchronized. Exactly one write path (`05-seed-assessments.ts`) is structurally unsynchronized, currently masked by an unrelated, separately-known FK gap (Core `classes` vs. legacy `teacher_classes`) that prevents it from ever running to completion in the current schema.

---

## 5. Live Data Audit

All counts from direct, read-only SQL against the live pilot database this session.

| Metric | Value | Note |
|---|---:|---|
| `class_assessments` total rows | 11 | Unchanged from Sprint 5D/5E/5F |
| `assessment_type_id IS NULL` | **0** | |
| `assessment_type IS NULL` | **0** | |
| Mismatched pairs (`assessment_type` text vs. linked `assessment_types.name`, case-insensitive) | **0** | |
| Orphan FKs (`assessment_type_id` pointing at a nonexistent `assessment_types.id`) | **0** | |
| `assessment_types` total rows | 276 | = 46 teachers × 6 seeded names (Phase B backfill), confirms this is expected seed volume, not organic growth |
| `assessment_types` rows with no `default_purpose_id` | 0 | All 276 are among the 6 originally-seeded names, all backfilled |
| `assessment_types` rows never referenced by any `class_assessments` row ("unused types") | **266 of 276 (96%)** | Expected consequence of "seed 6 per teacher whether used or not," not itself an anomaly |
| Duplicate `(teacher_id, name)` groups in `assessment_types` | 0 | DB-enforced `UNIQUE` constraint holds |
| `learner_evidence` total rows | 407 | Unchanged since before Phase G shipped |
| `learner_evidence.purpose_id IS NULL` | **407 of 407 (100%)** | See below — fully explained, not a bug |
| `learner_evidence` rows created after the Phase G migration timestamp, `evidence_source='teacher_upload'` | **0** | |

**The 100%-NULL `purpose_id` finding, explained precisely, not diagnosed further**: 405 of 407 evidence rows are `evidence_source='teacher_upload'`/`assessment_type='cat'` — exactly the shape `recordAssessmentEvidence`'s `purpose_id` resolution targets. All 407 rows predate the Phase G migration (`supabase/migrations/20260713203000_phase_g_evidence_purposes.sql`), which deliberately does **not** backfill existing `learner_evidence` rows (`purpose_id` is documented as "captured at write time," migration lines 72-78 — only `assessment_types.default_purpose_id` is backfilled, lines 59-61). Zero evidence rows have been created since that migration shipped. **This means the `purpose_id`-resolution code path, while verified correct in an isolated integration test (`evidencePurpose.integration.test.ts`), has zero live production verification** — the teacher-marks-upload evidence pipeline that would exercise it appears not to have produced a single new row since before Phase G shipped. This is stated as fact, not as a recommendation to investigate further (out of this audit's scope).

---

## 6. Consumer Audit

| Subsystem | Uses FK (`assessment_type_id`) | Uses text (`assessment_type`) | Classification |
|---|---|---|---|
| Evidence (`lib/assessments/evidence.ts`, `lib/intelligence/evidenceLifecycle.ts`) | Yes — `assessment_type_id → purpose_id` (write only, dead end) | Yes — `toEvidenceAssessmentType()` derives the evidence-domain enum from text | **Both** |
| Projection (`lib/projection/`) | No | No | **Neither** |
| Ranking (`lib/ranking/`) | No | No | **Neither** |
| Grading (`lib/grading/`) | No | No | **Neither** |
| Career Intelligence (`lib/career/`) | No | No | **Neither** |
| Academic Clinic (`lib/academicClinic/`) | No | No | **Neither** (uses `teacher_id`, per ADR-0002, but not assessment type at all) |
| Learning Compass (`lib/compass/`) | No | No | **Neither** |
| Reports (`lib/core/report-cards.ts`, `lib/assessments/pdfRenderer.ts`, `lib/assessments/reportCardEvidence.ts`) | No | Yes — `pdfRenderer.ts`'s `typeLabel` map | **Text only** |
| Teacher dashboards (`lib/search/index.ts`, `lib/repositories/assessment.repository.ts`'s `TYPE_LABEL`/analytics methods) | No | Yes | **Text only** |
| Parent dashboards | No | No | **Neither** — no parent-facing view was found referencing assessment type at all |
| Reference School (`scripts/reference-school/`) | Partial — one of two seed scripts (`06-`) | Both scripts | **Both** (inconsistently — see §3/§4) |

**Confirmed answer to the sprint's central consumer question**: yes, multiple real subsystems (Evidence's evidence-enum derivation, Reports, Teacher dashboards) still depend on the **text** column, not the FK. None of them are broken by this — they were never wired to the FK in the first place, and nothing in Sprints 5E/5F/ADR-0002 touched them. But it does mean the text column is **not** safe to drop or deprecate without migrating at least these three consumer groups first.

---

## 7. Migration Readiness

Ordered safest → riskiest, per the sprint's requested separation. No implementation is proposed — this is a sequencing estimate only.

| Order | Migration | Type | Blast radius | Notes |
|---|---|---|---|---|
| 1 | Fix `scripts/reference-school/05-seed-assessments.ts` to also resolve `assessment_type_id` (mirroring the already-fixed sibling script) | **Pure mechanical** | 1 file, 0 schema, 0 live rows affected today (currently unreachable per §3/§5) | Safest possible change — same pattern already proven twice (teacher path, `06-` script) |
| 2 | Consolidate `TYPE_LABEL` (`assessment.repository.ts`) and `typeLabel` (`pdfRenderer.ts`) into one shared mapping | **Pure mechanical** | 2 files, 0 schema, cosmetic text output only (would need a product decision on which spelling — "Mid-Term" vs "Midterm" — wins) | Low risk, but not risk-free: user-visible text changes for whichever file's spelling loses |
| 3 | Consolidate the 8 hardcoded `'assignment'` placeholders into a shared constant (not necessarily into `assessment_types`, since none of these sources are `class_assessments` rows at all) | **Pure mechanical** | 8 files | Would remove textual duplication without changing behavior, since all 8 already resolve to the same literal value |
| 4 | Migrate `toEvidenceAssessmentType()` to derive from `assessment_type_id`/`assessment_types` instead of the text column | **Behavior-changing** | 1 file directly, but changes what value flows into `learner_evidence.assessment_type` for every future evidence row — a downstream-consumer-facing change | Requires confirming no consumer of `learner_evidence.assessment_type` depends on the current text-derived values first (not audited in this pass — a new, narrower investigation) |
| 5 | Migrate Reports (`pdfRenderer.ts`, `reportCardEvidence.ts`) and Teacher dashboards (`lib/search/`, `assessment.repository.ts` analytics methods) to read `assessment_type_id`/`assessment_types.name` instead of the text column | **Behavior-changing** | 3-4 files, but is exactly the "every reader migrated" precondition Phase B's own rollout plan named before the text column could ever be dropped | This is the actual prerequisite for item 6 below — not optional if item 6 is ever wanted |
| 6 | Drop `class_assessments.assessment_type` (the legacy text column) | **Schema migration** | Unknown until item 5 is complete and re-verified — currently **would break** Reports and Teacher dashboards (§6) | **Not ready.** Do not schedule until item 5 is done and re-audited |
| 7 | Decide whether `learner_evidence.purpose_id` should ever be backfilled for the 407 pre-Phase-G rows, or whether "captured at write time, never retroactive" remains the permanent policy | **ADR-gated** | 0 files today (no code change either way — a policy question) | Genuinely a product/architecture decision, not an engineering task — recommend a policy ruling, not a migration |
| 8 | Decide whether the 8 hardcoded-placeholder evidence sources should ever gain their own real classification (beyond a shared constant, item 3) instead of "closest fit: assignment" | **ADR-gated** | 8 files, but only if a real distinct classification is wanted, which requires product input on what these sources' true "type" even means | Same character as item 7 — a decision, not a mechanical migration |

---

## 8. Risk Assessment

- **Architecture risk**: Low overall. The one new finding (`05-seed-assessments.ts`) is the same, already-solved defect shape as before — no new architectural question raised.
- **Business risk**: Low. Nothing user-facing is currently broken by any finding in this report; the text-column consumers (§6) work correctly today, they just haven't migrated to the FK.
- **Migration risk**: Concentrated entirely in item 6 (dropping the text column) — everything before it in §7's order is low-risk by construction (mechanical or currently-unreachable).
- **Backward compatibility**: At risk only if item 6 is attempted before item 5 — this report explicitly recommends against that ordering.
- **Performance risk**: None identified — no query pattern found that would change cost profile from any of the mechanical items.
- **Rollback risk**: Low for items 1-3 (single-file, revertible); unknown for item 6 until it's actually scoped (not this sprint's job).
- **Testing impact**: `phaseBMigration.safety.test.ts`/`phaseGMigration.safety.test.ts` already assert the additive-only, no-DROP invariant Phase B/G committed to — any future migration touching these columns should extend those suites, not replace them.
- **Developer Experience**: The two-label-dictionary and 8-hardcoded-placeholder patterns are a standing, low-grade DX tax (anyone adding a 7th evidence source will likely copy the 8th's pattern rather than discover a canonical one) — worth consolidating (§7 items 2-3) independent of any larger decision, since both are pure-mechanical and low-risk.

---

## 9. Recommendation

**NEEDS POLICY DECISION.**

Not `READY FOR SPRINT 5H` — dropping or meaningfully restructuring the legacy text column (the natural "consolidation" endpoint) is blocked on §7 items 4-5, which are themselves blocked on product/ownership decisions this audit cannot make (which spelling wins for labels; whether the evidence-domain 3-value enum should be redefined; whether `purpose_id` backfill policy needs to exist at all).

Not `NEEDS DATA CLEANUP` — live data is clean (§5: 0 NULLs, 0 mismatches, 0 orphans on every reachable path); the 96%-unused `assessment_types` rows and 100%-NULL `purpose_id` are both fully explained by design/timing, not corruption, and need no cleanup.

Not `NEEDS ADR` — no domain-ownership or identity question remains open (ADR-0002 already closed the one that existed); the open items are implementation-sequencing and product-copy decisions, not architecture decisions of ADR weight.

**NEEDS POLICY DECISION**, specifically on:
1. Whether the mechanical items (§7 #1-3 — fix the second seed script, consolidate the two label dictionaries, consolidate the 8 placeholders) should proceed now as low-risk cleanup, independent of the larger text-column question.
2. Whether Reports/Teacher-dashboard migration to the FK (§7 #5) is worth doing at all before there's a concrete reason to drop the text column (§7 #6), or whether "text column stays forever, FK is used only for `purpose_id`" becomes the accepted permanent state.
3. Whether `learner_evidence.purpose_id`'s "never backfilled, write-time only" policy (§7 #7) should be reconfirmed explicitly now that live data shows it has 0% real-world coverage after two-plus weeks in production.

---

## Validation

Explicitly confirmed, this session:
- **0** production files modified (`app/`, `lib/`, `scripts/`, `supabase/`)
- **0** schema changes
- **0** migrations
- **0** repository edits
- **0** route edits
- **0** service edits
- **0** tests changed
- Only this document and the implementation log entry were written.

## Statement

READ ONLY.
No implementation performed.
No files modified other than this audit and the implementation log.
Sprint 5H intentionally not started.
