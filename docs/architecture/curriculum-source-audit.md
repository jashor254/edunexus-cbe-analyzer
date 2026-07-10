# Curriculum Source Audit

Status: AUDIT — read-only investigation, no code or data changed. Produced
in response to a challenge to Wave 7 (Curriculum Grounding Layer,
`docs/architecture/adaptive-learning-v2-implementation-plan.md`)'s claim
that Core Competencies / PCIs / Values / Suggested Learning Experiences /
Assessment Opportunities are absent from EduNexus's curriculum data. Every
number below is a fresh, full-table (not sampled) query against the live
database, run during this audit — not carried over from Wave 7.

---

## 1. Which tables each generator actually queries

Traced via `grep -rn "from('<table>')"` across `lib/` and `app/` — not
inferred from type definitions or comments.

| Consumer | Tables actually queried |
|---|---|
| **Scheme Generator** (`app/api/sow/generate`, `lib/sow/lessonPipeline.ts`) | `schemes_of_work` (read/write), `scheme_lessons` (write) |
| **Lesson Plan Generator** (`app/api/lesson-plans/*`) | `schemes_of_work` |
| **AI Lesson Generator** (`lib/sow/aiLessonGenerator.ts`) | **None directly.** Takes `kicdContext` as a parameter from its caller; no caller in the live codebase currently supplies one (see §3). Its `core_competencies`/`values` output fields are sourced from `lib/sow/diversityEngine.ts`'s hardcoded rotation lists, not a query. |
| **Topic Picker** (`lib/compass/topicSelector.ts`) | `sow_grades`, `sow_learning_areas`, `sow_strands`, `sow_substrands` |
| **Adaptive Learning — Curriculum Grounding Layer** (`lib/curriculum/curriculumContext.ts`, Wave 7) | `sow_substrands`, `sow_strands`, `sow_learning_outcomes` |
| **Holiday Learning** (`lib/holiday/planner.ts`) | No curriculum table directly — reads Projection + Career Intelligence (per the Adaptive Learning v2 Architecture, subject-level only) |
| **KICD context route** (`app/api/sow/kicd-context/route.ts`) | `sow_learning_areas.kicd_subject_data`, `sow_strands.kicd_data` — exists, has a real bug (`sow_strands.title ILIKE %subject%`, but strand titles are things like "NUMBERS", not subject names — this filter can never match correctly), and **has no caller anywhere in the codebase** (`grep -rn "kicd-context"` returns only the route file itself) |

**Nothing in the live codebase queries `kicd_curriculum_lessons`.** Zero
references outside `lib/database.types.ts` (the generated type file).

---

## 2. Every table containing the six named fields

Checked by column name across the entire schema (`lib/database.types.ts`),
not just the tables Wave 7 or this audit expected to find them in.

| Field | Tables with a column for it | Populated? |
|---|---|---|
| Core Competencies | `sow_strands.kicd_data` (JSON, unstructured) · `sow_learning_areas.kicd_subject_data` (JSON) · `kicd_curriculum_lessons.core_competencies` · `scheme_lessons.core_competencies` | First three: **empty, verified full-table below.** Fourth: populated, but with a hardcoded generic rotation, not curriculum-sourced (§3). |
| PCIs | `kicd_curriculum_lessons.pci_links` | Table has 0 rows. |
| Values | `sow_strands.kicd_data` · `kicd_curriculum_lessons.values` · `scheme_lessons.values` | First two empty/0-row. Third: same hardcoded-rotation caveat as Core Competencies. |
| Suggested Learning Experiences | `sow_strands.kicd_data` · `kicd_curriculum_lessons.learning_experiences` · `scheme_lessons.learning_experiences` | First two empty/0-row. Third is real per-lesson AI output (not a pre-existing curriculum source — it's generated, then stored). |
| Assessment Opportunities | `sow_strands.kicd_data` · `kicd_curriculum_lessons.assessment_methods` · `scheme_lessons.assessment_methods` | Same pattern. |
| Learning Outcomes | `sow_learning_outcomes.outcome` · `kicd_curriculum_lessons.topic_specific_learning_outcomes` · `scheme_lessons.learning_outcomes` · **`data/kicd-pdfs/*-parsed.json`** (filesystem, not a DB table) | `sow_learning_outcomes`: 608 real rows, but see §4 — near-total FK orphaning. `kicd_curriculum_lessons`: 0 rows. `scheme_lessons`: real, but AI-generated per lesson, not a pre-existing reference. **The JSON files are the richest real source found in this audit — see below.** |

### The one genuinely rich source, previously unexamined: `data/kicd-pdfs/`

66 files (33 subjects × PDF + parsed JSON), each `*-parsed.json` structured
as `{ assessment_methods, learning_resources, non_formal_activities,
strands: [{ strand_title, sub_strands: [{ title, suggested_lessons,
learning_outcomes, learning_experiences, key_inquiry_questions }] }] }`.

Verified by parsing all 32 `*-parsed.json` files in this audit:
- **156 real sub-strands, 693 real Learning Outcomes**, in official KICD
  lettered format (`"a) explain the application of Biology in everyday
  life"`), with real Learning Experiences and Key Inquiry Questions
  per sub-strand.
- **Zero** files contain a `core_competencies`, `pci`, or `values` field
  at any level — confirmed by structural key search across every file,
  not a text grep (an earlier text grep hit on 4 files for "values"/
  "pertinent" was a false positive — plain-English word matches inside
  learning-experience prose, e.g. "values of x" in the mathematics file,
  not a structured field).
- Every file's document-level `assessment_methods`, `learning_resources`,
  and `non_formal_activities` arrays are empty across all 32 files.
- **Nothing in the current codebase loads this data into any table.**
  `grep -rln "kicd-pdfs" lib/ app/ scripts/` returns zero hits. This is
  parsed, structured, real curriculum data sitting entirely unused on
  disk.

---

## 3. Repository/service trace — what "the generators successfully use
Core Competencies..." actually means

This is the load-bearing finding. Traced `scheme_lessons.core_competencies`
and `.values` (the columns that make it look like the generators use real
curriculum metadata) back to their actual source:

```
lib/sow/aiLessonGenerator.ts:295-296
  const valuesStr       = seed?.values           ?? 'Respect, Responsibility, Unity'
  const competenciesStr = seed?.coreCompetencies ?? (isCBC
    ? 'Communication, Critical thinking, Collaboration'
    : 'Problem solving, Critical thinking')
```

`seed` is a `DiversitySeed` from `lib/sow/diversityEngine.ts`:

```
lib/sow/diversityEngine.ts:299-320
  const VALUES_SETS: string[] = [ /* 10 hardcoded sets */ ]
  const COMPETENCY_SETS: string[] = [ /* 8 hardcoded sets */ ]
  ...
  const values       = VALUES_SETS[i % VALUES_SETS.length]
  const competencies = isCBC ? COMPETENCY_SETS[i % COMPETENCY_SETS.length] : '...'
```

`i` is a per-lesson counter. Every lesson in a scheme gets a
deterministically-rotated Core Competencies/Values string from a fixed
8/10-item list — purely to give the AI's prompt output variety (avoid
every lesson saying "Communication, Critical thinking, Collaboration"),
**not because it was looked up for that lesson's specific sub-strand.**
The competency *names* are real, official CBC vocabulary (Communication,
Critical thinking, Collaboration, Creativity, Citizenship, Digital
literacy, Self-efficacy, Learning to learn, Numeracy — the actual 7 CBC
core competencies) — so the output isn't gibberish — but it is generic,
identical in kind for every subject and grade, and not traceable to a
specific curriculum record. It satisfies "looks plausible," not "grounded
in official curriculum data already stored in EduNexus" for a specific
sub-strand.

**Conclusion: the premise "the Scheme Generator and Lesson Plan Generator
successfully use Core Competencies/PCIs/Values/etc." is true only in the
sense that those fields appear, populated, in generated output. It is not
true that they are sourced from a curriculum database or reference file
— confirmed by tracing the actual code path, not by re-checking the same
tables Wave 7 already checked.**

---

## 4. Canonical vs. legacy vs. stale vs. partial

| Table / source | Status | Evidence |
|---|---|---|
| `sow_grades → sow_learning_areas → sow_strands → sow_substrands` | **Canonical, live, correctly used.** | Real structure (1173 strands, 18789 substrands), actively queried by the Topic Picker and now Wave 7. This is the one structural spine everything else should hang off. |
| `sow_learning_outcomes` | **Partially migrated / orphaned.** | 608 real rows, real outcome text — but of 115 distinct `substrand_id` values referenced across all 608 rows, only **2** resolve to a real `sow_substrands.id` (full-table check, not sampled). No seed script for this table exists anywhere in the current repo — it was populated by a process not present in git history, at a different time than (or with different UUIDs than) whatever most recently seeded `sow_substrands`. |
| `sow_strands.kicd_data`, `sow_learning_areas.kicd_subject_data` | **Dead columns.** | Schema exists (migration `supabase/kicd_curriculum_migration.sql` added the column), never populated — 0 of 1173 and 0 of 195 rows respectively, full-table verified. |
| `kicd_curriculum_lessons` | **Built, never wired, never populated.** | Has exactly the right shape for canonical KICD reference data (`core_competencies`, `pci_links`, `values`, `learning_experiences`, `assessment_methods`, `topic_specific_learning_outcomes`, `is_kicd_official`, `confidence_score`, `source_document`, `substrand_id`/`grade_id`/`learning_area_id` FKs) — 0 rows, 0 code references. Looks like it was designed to receive exactly the `data/kicd-pdfs` output but the loading step was never built or was lost. |
| `data/kicd-pdfs/*-parsed.json` | **Real, rich, entirely dormant.** | 32 subjects, 156 sub-strands, 693 real KICD Learning Outcomes + Learning Experiences + Key Inquiry Questions. Never loaded into any table by any script in the current repo. |
| `scheme_lessons` / `schemes_of_work` | **Live, but output, not source.** | Real, heavily-used tables (`grep` shows 20+ call sites) — but they store *generated lesson plans*, not a curriculum reference. Their `core_competencies`/`values`/`learning_experiences`/`assessment_methods` are AI output seeded from `diversityEngine.ts`'s hardcoded rotation, not from a queried curriculum source (§3). |
| `curriculum_configs` (2 rows), `sow_templates` (12 rows), `sow_set_books` (16 rows) | **Unrelated / dormant scaffolding.** | `curriculum_configs` holds CBC/8-4-4/IGCSE grading-system metadata (grade labels, grading system type) — not substrand content. `sow_templates.template_data` sampled rows show empty `learning_experiences`/`assessment_methods` arrays and a single generic placeholder outcome ("...understand basic concepts") — scaffolding, not real content. Neither is queried anywhere in `lib/`/`app/`. |

---

## 5. Did Wave 7 inspect the correct tables?

**Partially — it inspected the correct tables for Strand/Sub-Strand/
Learning Outcomes (the ones actually wired into the Topic Picker and now
Adaptive Learning), and its emptiness finding for `kicd_data`/
`kicd_subject_data` was correct and is reconfirmed here at full-table
scale. It did not know about `kicd_curriculum_lessons` or
`data/kicd-pdfs/` — neither is reachable from the code paths Wave 7
traced (Compass's topic selector, the Recommendation Layer's own needs),
and neither is referenced by any other live consumer either, so this
wasn't a matter of missing an actively-used source — both are dormant for
every consumer in the codebase, not just for Wave 7.**

Net effect on Wave 7's conclusion: **unchanged for Core
Competencies/PCIs/Values/Assessment Opportunities** (confirmed, more
rigorously, still absent everywhere). **Strengthened but not reversed for
Learning Outcomes**: `sow_learning_outcomes` is even less usable than
Wave 7's spot-check suggested (2/115 resolve, not "mostly orphaned but
some work"), but a substantially better, currently-unused source
(`data/kicd-pdfs`) exists and should become the real target, per the
recommendation below.

---

## Recommended Canonical Curriculum Map (not implemented — audit only)

```
STRUCTURE (canonical today, keep as-is):
  sow_grades → sow_learning_areas → sow_strands → sow_substrands

LEARNING OUTCOMES / EXPERIENCES / KEY INQUIRY QUESTIONS (recommend re-pointing):
  data/kicd-pdfs/*-parsed.json  ──[reconciliation + load, NOT done here]──▶  kicd_curriculum_lessons
                                                                              (schema already fits; currently
                                                                               empty and unwired)
  sow_learning_outcomes  →  DEPRECATE once kicd_curriculum_lessons is
                             populated and re-linked; its substrand_id
                             FK is broken for 113 of 115 referenced values
                             and it has no seed script to regenerate from

CORE COMPETENCIES / PCIs / VALUES / ASSESSMENT OPPORTUNITIES:
  No real source exists anywhere (DB or filesystem) at sub-strand
  granularity. Not a Wave 7 gap to close by re-pointing to a different
  table — this is a genuine content gap. Two honest paths forward, a
  future decision, not made here:
    (a) source and load real KICD Core Competency/PCI/Values mappings
        (a new data-acquisition effort, same shape as the kicd-pdfs
        parsing work already done for Learning Outcomes), or
    (b) keep the current diversityEngine.ts rotation for AI lesson-plan
        variety (a legitimate, different use case — prompt variety, not
        claimed learner-facing curriculum grounding) and have Adaptive
        Learning's Curriculum Grounding Layer continue stating this gap
        explicitly (current Wave 7 behavior), never presenting the
        rotation as if it were sub-strand-specific.

DEAD / DORMANT — do not build against these without a decision to revive them:
  sow_strands.kicd_data, sow_learning_areas.kicd_subject_data  (empty, unwired)
  kicd_curriculum_lessons                                       (empty, unwired, right-shaped)
  sow_templates, curriculum_configs (for this purpose)          (unrelated/scaffolding)
```

**Immediate implication for Wave 7, not executed in this audit (per
instruction to only audit):** `resolveCurriculumContext()`'s Learning
Outcomes path should eventually read `kicd_curriculum_lessons` (once
populated from `data/kicd-pdfs`) instead of `sow_learning_outcomes` —
that is a real, well-evidenced improvement, but it is a data-loading +
re-pointing decision for the user to make explicitly, not an
implementation this audit performs.
