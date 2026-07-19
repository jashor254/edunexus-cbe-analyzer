# ADR-0024 — Canonical Curriculum Identity (Sprint 1)

**Status: DRAFT — audit + design pass only, per user's explicit sprint framing ("Audit first. Design second. Implement last."). No code, schema, or migration was written in producing this document.**

**Depends on**: ADR-0022, ADR-0023, the 2026-07-18 System Map, and the Adaptive Learning Architecture Audit. Two dedicated research passes for this document traced every curriculum-shaped column in the schema and every teacher-facing curriculum-entry component with direct code citation.

**Full formatted version** (tables, phase cards, checklists) published as an artifact; this file is the durable, version-controlled record of the same specification.

---

## Honest exit-criteria verdict, stated up front

The requested exit statement — *"every future adaptive recommendation can be traced back to a single canonical curriculum identity, with no ambiguity, no duplicate representations, no AI-generated curriculum assumptions"* — **cannot honestly be made today, and this document does not pretend otherwise.** The audit found the problem is materially larger than ADR-0023 assumed: not one free-text producer, but **at least 17 tables** carrying unlinked curriculum text, **three independent subject-naming systems** that don't reliably agree even at the coarsest level, and a canonical spine (the `sow_*` tables) that **isn't tracked in any repository migration at all** — it exists only in the live database. This document delivers the complete map, a canonical decision that avoids inventing a fourth model, and a sequenced roadmap where the exit statement becomes true in stages, honestly marked, not claimed early.

## 1. Executive Summary

Two findings change the shape of everything that follows.

**First**: the assignments' KICD sub-strand picker already resolves a real curriculum ID the moment a teacher clicks a sub-strand — then **silently discards it** before the API call, storing only the title text (`app/teacher/assignments/new/page.tsx:515` — the `form` state has no `substrand_id` field; local `substrandId` state is used only for row-highlighting). The correct data is one field away, not a new feature.

**Second**: even the one flow that looked clean at the UI layer — Scheme of Work generation, genuinely picker-driven against real `sow_strands`/`sow_substrands` — degrades to free text one hop downstream, because `aiLessonGenerator.ts` writes its own independent strand/sub-strand text into `scheme_lessons`/`lesson_plans` with no FK back to the ID that was actually selected. There is currently no fully clean, end-to-end curriculum-ID path anywhere on the platform.

The good news underneath both: fixing them is mostly wiring, not invention. The picker infrastructure, the canonical `sow_*` tree, and even a correct, unused subject-alias precedent (`lib/pathwayCalculator.ts::normalizeSubjectKey()`) already exist.

## 2. Current-State Audit

### Three independent curriculum representations, not one

| Representation | Depth | Status |
|---|---|---|
| **SOW hierarchy** — `sow_grades→learning_areas→strands→substrands→learning_outcomes` | To Learning Outcome, structurally | Real seeded strand/substrand data G7-10 + Form 3/4. Learning Outcomes ~98% FK-orphaned (2 of 115 resolve). **No `CREATE TABLE` for any of these five tables exists in `supabase/*.sql` or `supabase/migrations/`** — created directly against the live database, outside version control entirely. |
| **Knowledge graph** — `knowledge_nodes`/`knowledge_edges` | Stops at Strand | Patchy (Math G7-11 collapsing to 2 nodes by G11; several subjects placeholder-only). No subject has complete G7-12 coverage. |
| **`lib/curriculum/subjects.ts`** — hardcoded subject list | Subject only | A third, fully independent naming system. Confirmed inconsistencies: `'Integrated Science'` (junior) vs `'General Science'` (senior elective) vs bare `'Science'` elsewhere; `'Core/Essential/Advanced Mathematics'` vs plain `'Mathematics'`; `'CRE/IRE/HRE'` combined in one list vs separate entries in another. No normalization ties this list's spellings to `sow_learning_areas.name` or `knowledge_nodes.subject`. |

### At least 17 tables carry curriculum-shaped free text, no FK

`strand_assessments`, `lesson_plans` (two migrations), `scheme_lessons`, `schemes_of_work`/`records_of_work.learning_area`, `row_entries`, `substrand_health`, `intervention_log`, `school_intelligence_snapshots`, `whatsapp_inbound_log.substrand_context`, five `eir_*` tables (frozen domain, rows may persist), `learner_evidence.subject` (a second free-text field beyond the already-known `strand`/`subStrand`), `class_differentiation_plans.subject`, `slide_generations`, `class_assessments.subjects` (text array), `teachers`/`teacher_classes.subject`. Full citations in §3.

Two hybrids worth naming precisely: `remedial_actions` has both a real `substrand_health_id` FK **and** its own duplicate free-text `strand`/`sub_strand` columns. `assignments.topic` is fed by a real picker but stores only resolved title text.

### Every teacher-facing curriculum-entry surface, traced and verdicted

| Surface | Verdict | Evidence |
|---|---|---|
| Topical check (highest-volume real workflow — 7,294 rows) | **FREE TEXT** | Plain `<input>`, no data source at all, not even autocomplete. Blank fields default to the literal string `'general'`. `app/teacher/classes/[classId]/page.tsx:2076-2092` |
| Assignments KICD sub-strand picker | **HYBRID** | Real picker, real `sow_substrands` data via `getTopicsForSubject()` — resolved id is local UI state only, never submitted. `assignments/new/page.tsx:515` |
| Remedial Planner | **FREE TEXT** | Subject is a real `<select>`; Strand and Sub-Strand are plain text inputs. `app/teacher/classes/[classId]/page.tsx:2732-2746` |
| Scheme of Work generation (selection step) | **ID-BACKED** | Genuine closed-list checkboxes against real `sow_strands`/`sow_substrands`, IDs carried into the generation payload. `scheme-of-work/new/page.tsx:300-309` |
| Scheme of Work generation (AI output storage) | **FREE TEXT** | The selected IDs above are never persisted — `aiLessonGenerator.ts` writes its own independent strand/sub_strand text with no FK back. |
| Differentiation engine's `subStrandId` | Unreachable | Confirmed zero live UI callers anywhere in `app/`/`components/` — an orphaned parameter, not a real entry point today. |

### Two precedents already exist — one to reuse, one to retire

**Reuse**: `lib/pathwayCalculator.ts::normalizeSubjectKey()` + `SUBJECT_KEY_ALIASES`, wrapped by `lib/intelligence/subjectMapping.ts::mapSubject()` — a correct, deterministic, human-curated subject-name alias resolver, already handling real Kenyan-school abbreviations (`emat`, `geo`, `csl`, `hisc`). Per its own code comment, it was "never wired to any import path" beyond its original caller. This is the exact pattern §6 needs, extended to strand/sub-strand, not reinvented.

**Retire or migrate**: `lib/repositories/knowledge-graph.repository.ts::findNodeByConceptLike()` — an `ILIKE '%concept%'` fuzzy string match, explicitly used today to resolve free-text sub-strand names to `knowledge_nodes`. A real, existing violation of the "no fuzzy/AI curriculum resolution" principle both ADR-0023 and this sprint's brief state as non-negotiable — named, not grandfathered. See §10 Phase F.

## 3. Curriculum Dependency Map

| Table | Column(s) | Status |
|---|---|---|
| `strand_assessments` | subject, strand, topic | FREE TEXT |
| `lesson_plans` (×2 migrations) | strand, sub_strand | FREE TEXT |
| `scheme_lessons` | strand, substrand | FREE TEXT |
| `schemes_of_work` / `records_of_work` | learning_area | FREE TEXT |
| `row_entries` | strand, substrand | FREE TEXT |
| `assignments` | subject, topic | HYBRID |
| `remedial_actions` | strand, sub_strand + `substrand_health_id` FK | HYBRID (duplicate) |
| `substrand_health` | subject, strand, sub_strand | FREE TEXT |
| `intervention_log` | subject, substrand | FREE TEXT |
| `school_intelligence_snapshots` | subject | FREE TEXT |
| `whatsapp_inbound_log` | substrand_context | FREE TEXT |
| 5× `eir_*` tables (frozen domain) | subject, substrand | FREE TEXT |
| `learner_evidence` | subject (separate from strand/subStrand) | FREE TEXT |
| `class_differentiation_plans` | subject | FREE TEXT |
| `slide_generations` | subject, topic | FREE TEXT |
| `class_assessments` | subjects (text array) | FREE TEXT |
| `teachers` / `teacher_classes` | subject | FREE TEXT |
| `curriculum_versions` | code, label, curriculum_type | ID-BACKED — versions the curriculum *edition* only, not strand/subject content |
| `sow_grades` → `sow_learning_outcomes` | the canonical spine itself | ID-linked internally, but **not version-controlled** |

## 4. Canonical Identity Proposal

**Decision: adopt the existing `sow_*` hierarchy as the one canonical spine. Do not invent a fourth model.** It already has real seeded strand/sub-strand data at the depth that matters for current pilot grades, it's structurally complete to Learning Outcome even where underpopulated, and it's the same spine both ADR-0022 and ADR-0023 already assumed. The knowledge graph's real asset — prerequisite relationships — is kept as a separate, secondary graph, not merged into the identity chain, consistent with ADR-0023 §11.

Two governance prerequisites are part of this proposal, not optional follow-ups:

1. **Bring the `sow_*` tables under version control.** A baseline migration capturing the live schema — every other schema element on this platform is disciplined about migrations; the canonical curriculum spine currently is not, a real operational risk independent of curriculum-identity concerns (a fresh environment cannot reproduce it today).
2. **One canonical subject table, not three lists.** Extend `normalizeSubjectKey()`/`SUBJECT_KEY_ALIASES` — already correct, already proven, currently unwired — into the single resolution point every one of `sow_learning_areas.name`, `knowledge_nodes.subject`, and `lib/curriculum/subjects.ts` must pass through before being compared or joined. Cheapest, highest-leverage fix in this whole document, because the correct code already exists.

## 5. Historical Migration Strategy

At least 7,294 confirmed free-text topical rows, plus an unquantified but likely larger volume across the other 16 tables in §3. Tiered, never bulk-automatic:

| Tier | Method | Auto-applied? |
|---|---|---|
| 1 — Exact match | Case/whitespace-normalised string equality against real `sow_substrands.title` (or `sow_strands.title`) within the same, already-normalised subject | Yes — deterministic, not fuzzy, safe |
| 2 — Near match | Tight edit-distance or known-variant candidates (e.g. "Equivalent Fractions"/"Simple Fractions" as candidates for a "Fractions" sub-strand) queued for a curriculum lead to confirm or reject | **No — human decision required, every time** |
| 3 — Unresolved | No confident candidate | Stays unresolved, permanently visible, contributes to Subject-level Confidence only (ARDS) |

**Reversible by construction**: resolution is additive — a new mapping row plus a nullable `resolved_substrand_id`, never an overwrite of the original text. **Auditable by construction**: every resolution records tier and origin — Tier 1 gets `resolved_by: 'system_exact_match'`, Tier 2 gets `resolved_by: 'human:<user_id>'`.

## 6. Alias Resolution Strategy

```
curriculum_label_aliases (illustrative)
  id                     uuid
  raw_text               text        — exactly as originally typed
  normalised_text        text        — case/whitespace-normalised, Tier 1 matching
  subject_context        text        — resolved via the canonical subject table
  resolved_strand_id     uuid null
  resolved_substrand_id  uuid null
  resolution_tier        text        — 'exact_match' | 'human_reviewed' | 'unresolved'
  resolved_by            text        — 'system_exact_match' | 'human:<user_id>'
  resolved_at            timestamptz
  superseded_by          uuid null   — append-only correction, mirrors the Evidence
                                        Domain's own supersession discipline
```

Aliases exist to support **historical compatibility only**. Canonical IDs remain the single source of truth for anything new (§7). AI never decides curriculum identity anywhere in this table's lifecycle; `findNodeByConceptLike()` is migrated onto this table's Tier 1/2 process rather than continuing to run independently.

## 7. Future Data Entry Strategy

| Surface | Fix | Relative cost |
|---|---|---|
| Assignments KICD picker | Add `substrand_id` to the form state already holding it locally, include it in the POST payload, add the column to `assignments` | **Trivial** — data already exists one step upstream |
| Topical check | Replace free-text inputs with a picker sourced from the same `CurriculumService`/`getTopicsForSubject()` the assignments flow already calls | Moderate — highest value given real volume |
| Remedial Planner | Same picker component, once built for Topical check | Low, once shared component exists |
| SOW generation | Carry the already-selected `strandId`/`substrandId` through `aiLessonGenerator.ts` into real FK columns on `scheme_lessons`/`lesson_plans`, additive alongside existing text fields | Moderate |

**Recommend one shared Curriculum Picker component/hook, built once, reused by all four surfaces** — extends "do not introduce another curriculum model" to "do not introduce another curriculum picker."

## 8. Curriculum Integrity Invariants

- Every adaptive recommendation references a canonical curriculum ID — never a raw label.
- Every generated question resolves to a curriculum node via §6's Tier 1/2 process, or is not generated (ADR-0022 Principle 1, reaffirmed).
- No adaptive activity references an unknown curriculum node. Unresolved evidence gates Precision (ARDS) silently and honestly — never fails loudly, never guesses.
- Subject names always resolve through the one canonical subject table before any cross-system comparison.
- No fuzzy or AI-based curriculum resolution runs outside the explicit Tier 1/Tier 2 pipeline — including `findNodeByConceptLike()`, migrated onto it, not grandfathered.
- The canonical curriculum spine is version-controlled like every other schema element on this platform.

## 9. Risks

| Risk | Why it's real |
|---|---|
| Scope creep into a never-finished migration | 17+ tables is materially larger than ADR-0023 assumed — must be phased and bounded, not attempted as one undertaking |
| Cross-system Subject joins are unsafe *today* | Three independent naming systems with confirmed real spelling divergence |
| "SOW is clean" is a dangerous assumption | True only at the selection UI; false one hop downstream at storage |
| `sow_*` has no reproducible schema | A fresh environment/restore cannot recreate these tables today |

## 10. Implementation Roadmap

- **Phase A — Governance** (no learner-facing change): baseline-migrate `sow_*` into the repo; extend `normalizeSubjectKey()` into the one canonical subject resolution point.
- **Phase B — Cheapest real fix**: assignments picker — add `substrand_id`, wire the already-resolved local ID into the payload. Ship alone.
- **Phase C — Shared picker**: build one Curriculum Picker component; migrate Topical check and Remedial Planner onto it.
- **Phase D — Historical migration**: Tier 1 exact-match pass + `curriculum_label_aliases` + admin review UI for Tier 2, starting with the highest-volume table.
- **Phase E — SOW downstream fix**: carry strand/substrand IDs through `aiLessonGenerator.ts` into real FK columns.
- **Phase F — Retire the violation**: migrate `findNodeByConceptLike()` onto the Tier 1/2 pipeline.

Only after Phases A–F is ADR-0023's ARDS build order actually safe to start on real data.

## 11. Exit Criteria

**Not yet true.** Concrete, checkable conditions for when the requested statement becomes honest:

- [ ] `sow_*` schema exists in a repository migration, matching the live database exactly
- [ ] One canonical subject resolver is the only path any system uses to compare/join subject names
- [ ] All four teacher-facing entry surfaces write real curriculum FKs, not text-only, for newly-created rows
- [ ] `curriculum_label_aliases` exists, populated for at least the highest-volume historical table, with a real Tier 1/2/3 breakdown reported
- [ ] `findNodeByConceptLike()` no longer runs independently of the Tier 1/2 pipeline
- [ ] `aiLessonGenerator.ts`'s output carries real strand/substrand FKs, not text-only

## 12. Recommendation

**Conditional Go.** Go on the canonical identity decision (§4) — adopt `sow_*` as-is, fix its two governance gaps, reuse the existing subject-alias precedent. No-Go on treating this sprint as complete — an audit that reveals a larger problem than assumed is not the same as having solved it. Recommend Phase A + Phase B specifically as the next actual build: cheapest, highest-leverage, lowest-risk, and — because the assignments picker fix genuinely is a one-field wire-up — deliverable fast enough to build real confidence in the roadmap before committing to Phases C–F.
