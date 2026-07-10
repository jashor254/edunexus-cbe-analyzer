# Curriculum Domain v2 — Canonical Curriculum Architecture

Status: ARCHITECTURE — the master reference for how every educational
component in EduNexus consumes curriculum intelligence. Not an
implementation plan; no schema DDL, no route handlers, no pseudocode.
Grounded entirely in the [Curriculum Source Audit](curriculum-source-audit.md)
— every table, row count, and code path cited here was verified in that
audit, not assumed. Bound by (frozen, not renegotiated here): the
[Engineering Constitution](../engineering-constitution.md), [Learner
Intelligence Engineering Principles](learner-intelligence-engineering-principles.md),
the [Evidence Domain Model](evidence-domain-model.md), the [Migration
Ledger](migration-ledger.md), and the [Adaptive Learning v2
Architecture](adaptive-learning-v2-architecture.md) (whose Wave 7,
Curriculum Grounding Layer, is this document's first real consumer and
stays in place — extended, not redesigned, by what follows).

---

## 0. The Reframing

The audit's central finding, restated as the premise of this whole
document: **the problem is not architecture, it is activation.**
EduNexus has a structurally sound five-level curriculum spine (`sow_levels
→ sow_grades → sow_learning_areas → sow_strands → sow_substrands`, real
and correctly used today) and a rich, real, official content source
(`data/kicd-pdfs`: 32 subjects, 156 sub-strands, 693 Learning Outcomes)
that has never been connected to it. What looks like a curriculum-grounding
gap is actually a wiring gap: the knowledge exists; the platform doesn't
know it exists.

This document does not propose a new curriculum model. It proposes making
the existing five-level spine a genuine **domain** — one source of truth,
one write path, one set of consumers reading it the same way Evidence and
Projection already establish for learner intelligence — and activating
the dormant content that already sits on disk and in an empty,
correctly-shaped table (`kicd_curriculum_lessons`).

---

## 1. Canonical Curriculum Model

The full chain, mapped onto what's real today versus what requires
activation:

```
Level                    sow_levels                    REAL, LIVE
  ↓
Grade                    sow_grades                     REAL, LIVE
  ↓
Learning Area             sow_learning_areas             REAL, LIVE
  ↓
Strand                   sow_strands                    REAL, LIVE
  ↓
Sub-strand                sow_substrands                 REAL, LIVE
  ↓
Learning Outcome          kicd_curriculum_lessons.        DORMANT — right-shaped,
                          topic_specific_learning_outcomes 0 rows, needs Phase 2
  ↓
Learning Experiences      kicd_curriculum_lessons.        DORMANT — same table
                          learning_experiences
  ↓
Key Inquiry Questions     kicd_curriculum_lessons.        DORMANT — same table
                          key_inquiry_questions
  ↓
Assessment Opportunities  kicd_curriculum_lessons.        DORMANT, AND the source
                          assessment_methods              data itself is empty at
                                                           this level in every
                                                           parsed KICD PDF — a
                                                           genuine content gap,
                                                           not just a wiring gap
                                                           (see §7)
  ↓
Core Competencies         kicd_curriculum_lessons.        DORMANT, AND no source
                          core_competencies               exists anywhere (DB or
                                                           filesystem) at
                                                           sub-strand granularity
                                                           — a genuine content gap
                                                           (see §7)
  ↓
Values                    kicd_curriculum_lessons.values   Same as Core Competencies
  ↓
PCIs                      kicd_curriculum_lessons.        Same as Core Competencies
                          pci_links
  ↓
Suggested Resources       kicd_curriculum_lessons.        DORMANT, AND empty in
                          learning_resources               every parsed KICD PDF
  ↓
Adaptive Learning          lib/adaptiveLearning/            REAL, LIVE (Wave 7) —
                          curriculumContext.ts             reads the spine + a
                                                           Learning-Outcomes source
                                                           (today: the orphaned
                                                           sow_learning_outcomes;
                                                           target: kicd_curriculum_
                                                           lessons, per Phase 4)
  ↓
Evidence                 learner_evidence                 REAL, LIVE, frozen
                                                           (Evidence Domain Model)
  ↓
Projection                learner_projections               REAL, LIVE, frozen
                                                           (Projection Engine)
```

**One correction to the brief's own chain, stated explicitly rather than
silently implemented**: Learning Outcome → Evidence → Projection is not
literally true today and this document does not make it true — Evidence
and Projection are about *learner performance* (a score, a CBC level),
not curriculum *content* (an outcome's text). What Adaptive Learning does
today (Wave 7) is read Projection for *how the learner is doing* and read
the Curriculum Domain for *what the content actually is*, and combine
them — two axes, never merged into one, per LI-1. This document's
"Learning Outcome → Evidence" arrow means: **evidence can be tagged with
the Learning Outcome/Sub-strand it was assessed against** (a lineage
link, §6), not that Learning Outcomes themselves become learner state.

---

## 2. Curriculum as a First-Class Domain

Per the same domain discipline the Evidence Domain Model established for
learner evidence: **curriculum data has exactly one owner, one canonical
representation, and every consumer reads it, none write their own copy.**

- **Owner**: a new `lib/curriculum/` domain layer (extending the existing
  `lib/curriculum/` directory and `CurriculumRepository`, not replacing
  them) becomes the only code path that resolves Strand/Sub-strand/
  Learning Outcome/Core Competency/etc. data. Today `lib/curriculum/
  curriculumContext.ts` (Wave 7) is the first real instance of this — this
  document generalizes it into the platform's one curriculum read API.
- **No second producer.** The audit found the closest thing to a
  violation of this already in production: `lib/sow/diversityEngine.ts`'s
  hardcoded competency/values rotation *functions as* curriculum content
  in the Scheme Generator's output without being sourced from the
  Curriculum Domain. This document does not rip that out (§8 — pilot
  constraints), but it draws the line: no *new* consumer may repeat that
  pattern, and existing instances are named as migration debt (Phase 3/7),
  not a template to copy.
- **Consumers read, they never fork.** Compass, Blueprint, Career
  Intelligence, Teacher Academy, the Assessment Generator, Holiday
  Learning, and Printable Packs all read the same `lib/curriculum/`
  functions for the same question ("what does this Sub-strand actually
  contain") — never a second SQL query against `sow_*`/`kicd_curriculum_
  lessons` written independently inside a feature module. This is LI-1,
  applied to curriculum instead of learner state.

---

## 3. Knowledge Relationships

The brief asks whether Curriculum Domain v2 should be a knowledge
*graph*. Evaluated, not committed to, per its own instruction:

**What's genuinely graph-shaped:** Learning Outcome ↔ Core Competency,
Learning Outcome ↔ Value, Learning Outcome ↔ PCI are legitimately
many-to-many (one outcome touches several competencies; one competency
spans many outcomes across subjects) — a relational join table models
this correctly and simply. This is graph-*shaped* data, but a handful of
join tables (`learning_outcome_competencies`, `learning_outcome_values`,
`learning_outcome_pcis` — naming illustrative, not a schema spec) express
it without needing a graph database or a new query paradigm. **This is
not, on its own, a reason to build a Knowledge Graph.**

**What would actually require graph traversal, not just joins:**
Learning Outcome ↔ Career Pathway ↔ Blueprint Goal ↔ Adaptive Learning
Activity — multi-hop, weighted, evolving relationships (e.g. "which
outcomes, across which sub-strands, most strongly predict readiness for
this career pathway" is a traversal/ranking question, not a lookup). The
existing Educational Knowledge Graph work (`knowledge_nodes`/
`knowledge_edges`, already live and used by the Prerequisite Intelligence
Engine per prior session memory) is the closest existing analog — and it
already proves the pattern works at EduNexus's scale for prerequisite
relationships specifically.

**Recommendation**: do not build a general Curriculum Knowledge Graph now.
The relational model (§4) fully serves every Phase 1–6 consumer in this
document. Revisit graph modeling specifically for the Career
Pathway/Blueprint Goal layer *after* Phase 6 ships and there's real usage
data showing multi-hop queries are actually needed — the same
"start simple, prove it with real data, generalize later" discipline this
project has applied everywhere else (Adaptive Learning v2 §12, the
Prerequisite Engine's own history). Named as future direction (§12), not
designed further here.

---

## 4. Domain Model (Relational, Not Graph)

```
sow_levels
  └─ sow_grades (level_id FK)
       └─ sow_learning_areas (grade_id FK)
            └─ sow_strands (learning_area_id FK)
                 └─ sow_substrands (strand_id FK)
                      └─ kicd_curriculum_lessons (substrand_id FK)  ── the
                           content record: learning outcomes, learning
                           experiences, key inquiry questions,
                           assessment methods, learning resources,
                           core competencies, values, pci links,
                           is_kicd_official, confidence_score,
                           source_document (already-existing columns,
                           per the audit — this is not a new table)
```

`kicd_curriculum_lessons`'s existing `is_kicd_official` and
`confidence_score` columns are exactly the mechanism Curriculum Integrity
(§7) needs: every content record can honestly distinguish "this came
directly from a parsed official KICD document" from "this was
AI-assisted-filled and needs review" — the schema already anticipated
this distinction; Phase 2 activates it, it does not invent it.

**Explicit non-goal**: this document does not propose changing
`sow_learning_outcomes`'s schema or `scheme_lessons`'/`schemes_of_work`'s
schema. Both stay exactly as they are (§8, §9 — migration is additive and
sequenced, not a rewrite of working systems).

---

## 5. Curriculum Flow

```
data/kicd-pdfs/*-parsed.json (official, real, 32 subjects — Phase 2 source)
        │
        │  reconciliation load (Phase 2): match each parsed sub-strand
        │  title against the REAL live sow_substrands row for that
        │  Learning Area/Strand (not a blind UUID copy — this is exactly
        │  what caused sow_learning_outcomes' near-total FK orphaning,
        │  and Phase 2 must not repeat it)
        ▼
kicd_curriculum_lessons  (canonical content layer, substrand_id-linked)
        │
        │  read-only, via lib/curriculum/'s one API (§2)
        ▼
┌───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐
│ Scheme         │ Adaptive       │ Compass        │ Blueprint /    │ Teacher       │
│ Generator      │ Learning       │                │ Career Intel   │ Academy       │
│ (Phase 3)      │ (Phase 4)      │ (Phase 3)      │ (Phase 5/6)    │ (Phase 6)     │
└───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘
        │
        │  evidence tagged with the Sub-strand/Learning Outcome it was
        │  assessed against (a new, optional lineage field — Evidence
        │  Domain's existing schema is not changed, see §9)
        ▼
learner_evidence  →  learner_projections  (unchanged, frozen)
```

---

## 6. Consumer Map

| Consumer | Current curriculum dependency (per audit) | Target under Curriculum Domain v2 | Migration phase |
|---|---|---|---|
| **Scheme of Work Generator** | `schemes_of_work`, `scheme_lessons`; Core Competencies/Values from `diversityEngine.ts`'s hardcoded rotation | Reads `lib/curriculum/` for the real Sub-strand's Learning Outcomes/Experiences/Inquiry Questions to seed the AI prompt (replacing/supplementing the rotation for content, not for prompt-variety mechanics) | Phase 3 |
| **Lesson Plan Generator** | Same as above, via `schemes_of_work` | Same target | Phase 3 |
| **AI Lesson Generator** (`aiLessonGenerator.ts`) | Accepts `kicdContext` param, currently never supplied by any live caller | `kicdContext` populated from `lib/curriculum/`'s real API | Phase 3 |
| **Adaptive Learning** (`lib/adaptiveLearning/curriculumContext.ts`, Wave 7) | Reads `sow_learning_outcomes` (98% FK-orphaned) | Reads `kicd_curriculum_lessons` | Phase 4 |
| **Compass / Topic Picker** | `sow_grades→...→sow_substrands` only (already correct) | Unchanged structurally; gains Learning Outcome-level detail for the same substrand it already resolves | Phase 3 |
| **Blueprint** | **None today** (confirmed by audit: zero curriculum references) | Reads `lib/curriculum/` to state *which* Learning Outcomes a capability statement traces to, when evidence carries that lineage (§9) | Phase 5 |
| **Career Intelligence** | **None today** | Reads `lib/curriculum/` to connect a capability match to the Sub-strands/Learning Areas that build toward it | Phase 6 |
| **Teacher Academy** | Free-text `strand`/`sub_strand` fields (`lib/academy/types.ts`), copied from `scheme_lessons`, not FK-linked | Same fields, sourced from a real Curriculum Domain lookup instead of a free-text copy | Phase 6 |
| **Assessment Generator** | Not audited in depth here — out of this document's evidence base; treat its curriculum coupling as unknown until inspected in Phase 3 | Reads `lib/curriculum/` | Phase 3 (pending its own quick audit) |
| **Holiday Learning / Printable Packs** | Already Wave 7-wired to Adaptive Learning's curriculum context | Inherits Phase 4's re-point automatically — no separate work | Phase 4 (free) |

---

## 7. Curriculum Integrity — Data-Quality Strategy

Directly enforcing the mandate ("never invent; if unavailable, say so"),
made concrete against what the audit actually found:

- **Core Competencies, PCIs, Values, Assessment Opportunities, Suggested
  Resources have no real source at sub-strand granularity anywhere** —
  not in a table, not in the parsed KICD PDFs (confirmed empty at
  document level across all 32 files, structurally, not by a text grep).
  Phase 2 activating `kicd_curriculum_lessons` **does not manufacture
  this data.** These fields stay honestly empty (`null`) until a real
  acquisition effort sources them (§12 — future, not Phase 1–6). Every
  consumer must keep stating this gap explicitly (Wave 7's
  `curriculumNotice`/`unavailableFields` pattern is the template — this
  document generalizes it, doesn't replace it).
- **`is_kicd_official` / `confidence_score`** (existing, unused columns
  on `kicd_curriculum_lessons`) become the mechanism for the one
  legitimate exception: where a teacher or the platform later
  AI-assists a gap-fill (e.g., a plausible Core Competency suggestion for
  a Sub-strand that has none), that record is inserted with
  `is_kicd_official = false` and a `confidence_score`, and every
  consumer's UI must render that distinction — never presented with the
  same visual/textual confidence as an official record. This is the same
  discipline Evidence Domain's Trust Tiers (LI-6) already apply to
  learner evidence, applied here to curriculum content.
- **Reconciliation, not blind copy, for Phase 2's load.** The exact
  mistake that orphaned `sow_learning_outcomes` (113 of 115 referenced
  substrand_ids don't resolve) must not repeat: the Phase 2 loader
  matches each `data/kicd-pdfs` sub-strand *by title* against the live
  `sow_substrands` table for the correct Learning Area, and only inserts
  a `kicd_curriculum_lessons` row when a confident match is found. Where
  no confident match exists (title drift, a KICD sub-strand not present
  in the current `sow_substrands` seed, or vice versa), that gap is
  logged and surfaced to a human for reconciliation — never guessed.
  This is a data-loading design decision for Phase 2's own implementation
  plan, named here as a hard requirement, not designed further in this
  document (per its own "no implementation" scope).
- **`sow_learning_outcomes` is not deleted in this document.** Per "do
  not rewrite working systems," it is marked deprecated (Migration
  Ledger-style) only once `kicd_curriculum_lessons` is populated and
  re-pointed consumers (Phase 4) are proven — retirement is Phase 7, not
  a side effect of Phase 2.

---

## 8. Migration Strategy

Phased, additive, pilot-aware. No working system is rewritten; every
phase is a sequenced extension, matching the discipline the Adaptive
Learning v2 Architecture already established for its own rollout.

### Phase 1 — Canonical curriculum model (structural, no new data)

Formalize `lib/curriculum/` as the one domain API (§2) over the existing,
already-correct `sow_levels→...→sow_substrands` spine. Mechanically:
consolidate the handful of places that query these tables directly
(`app/api/sow/grades`, `.../learning-areas`, `.../strands` — per the
audit's consumer trace) to call through `CurriculumRepository`/`lib/
curriculum/` instead, where they don't already. No new table, no new data
— this phase is pure API consolidation around what's already correct.

**Pilot impact: can wait.** Existing SOW routes already work; this is
internal consolidation, not a functional change.

### Phase 2 — Import official KICD curriculum content

Build the `data/kicd-pdfs` → `kicd_curriculum_lessons` loader (§7's
reconciliation rule is the hard requirement). Populates Learning
Outcomes, Learning Experiences, Key Inquiry Questions for the 32 parsed
subjects, 156 sub-strands, 693 outcomes. Assessment Opportunities/
Suggested Resources/Core Competencies/PCIs/Values stay empty per §7 (no
source exists) — this phase does not close that gap, it activates what's
real.

**Pilot impact: SHOULD complete before pilot** — this is the one phase
that directly increases what Adaptive Learning (already shipped, Wave 7)
can honestly ground content in in real classrooms during Third Term. Not
a hard blocker (Wave 7 degrades honestly without it, per its own design)
but the single highest-leverage pre-pilot investment this document
identifies.

### Phase 3 — Reconnect existing generators

Scheme Generator, Lesson Plan Generator, AI Lesson Generator, Compass's
Topic Picker (already correct structurally, gains outcome-level detail)
read `kicd_curriculum_lessons` via `lib/curriculum/`. `diversityEngine.ts`'s
rotation lists are **not removed** in this phase — they still serve their
real, distinct purpose (AI prompt variety across a term's worth of
lessons within a sub-strand, which real per-outcome content doesn't
replace) — Phase 3 adds real content alongside them, doesn't delete the
rotation mechanism.

**Pilot impact: can wait until after pilot.** These generators already
work for their current purpose; this improves grounding quality, doesn't
fix a broken pilot-critical path.

### Phase 4 — Migrate Adaptive Learning

`lib/adaptiveLearning/curriculumContext.ts` (Wave 7) re-points from
`sow_learning_outcomes` to `kicd_curriculum_lessons`. Purely a data-source
swap behind the same function signature — `resolveCurriculumContext()`'s
contract (real data or explicit `null`, never fabricated) doesn't change,
only what it reads. Holiday Learning and Printable Packs inherit this for
free (they already consume Wave 7's output, per §6).

**Pilot impact: SHOULD complete before pilot**, contingent on Phase 2.
This is what turns Wave 7's "usually falls back to the honest notice"
current behavior (per the audit: 2 of 115 real substrand IDs resolve
today) into "usually finds real content" — the single most consequential
change to what a teacher actually sees on a printed pack or a
differentiation sheet during the pilot.

### Phase 5 — Migrate Blueprint

Blueprint gains an optional curriculum-lineage field: where the evidence
behind a capability statement carries a Sub-strand/Learning Outcome tag
(§9), Blueprint's Insight can name it ("based on evidence from Fractions,
Numbers strand" instead of just "based on evidence from Mathematics").
Blueprint's existing Projection-sourced capability computation
(Migration Ledger: already Projection) is unchanged — this is additive
narrative detail, not a new computation.

**Pilot impact: can wait until after pilot** — Blueprint already works
without curriculum lineage; this is a genuine improvement with no pilot
urgency.

### Phase 6 — Migrate Career Intelligence and Teacher Academy

Career Intelligence's family/match Insights (`lib/learnerIntelligence/careerIntelligence.ts`)
gain the same optional lineage detail as Blueprint. Teacher Academy's
`strand`/`sub_strand` free-text display fields (`lib/academy/types.ts`)
source from the real Curriculum Domain instead of copying
`scheme_lessons`' free text — a data-quality improvement (real titles,
consistent spelling/casing) with no behavior change to Academy's own
logic (missions, reflections, competency scoring untouched).

**Pilot impact: can wait until after pilot.**

### Phase 7 — Retire duplicated curriculum logic

Only once Phases 2–6 are proven with real pilot data: deprecate
`sow_learning_outcomes` (superseded by `kicd_curriculum_lessons`), and
name (not necessarily remove) `diversityEngine.ts`'s content-rotation
role as legacy once real per-outcome content covers enough of the
curriculum that the rotation's content-filling role is no longer needed
(its prompt-variety role may still be worth keeping — a Phase 7-time
decision, not this document's).

**Pilot impact: strictly post-pilot.** Retirement work by definition
follows proof, and proof requires a full pilot term's real usage.

---

## 9. Integration with the Evidence Domain

**No change to the Evidence Domain Model's ten invariants** (per this
document's own instruction not to redesign frozen systems). One additive,
optional field is proposed for future evidence-producing sources: a
`curriculumSubStrandId` / `curriculumLearningOutcomeId` provenance
pointer, alongside the existing `rawInputRef` provenance pointer
(Evidence Domain Model §6) — recording *which curriculum content* an
assessment was evaluated against, when known (a teacher-set topic, a
Compass session scoped to a specific sub-strand). This is lineage, in the
Evidence Domain's own sense (§5) — it does not change what Evidence *is*,
what triggers confirmation, or how Projection computes from it. Where
absent (most evidence today — general/whole-assessment scoring, per the
existing `strand: 'general', sub_strand: 'general'` convention already
used in `app/api/teacher/assessments/process/route.ts`), evidence behaves
exactly as it does today. Not designed further here — a Phase 5+
implementation detail, named as direction.

---

## 10. Integration with the Projection Engine

**No change.** The Projection Engine (frozen, per the Migration Ledger's
own gaps already named — no substrand-level knowledge, §8 of the Adaptive
Learning v2 Architecture) is not extended by this document. Curriculum
Domain v2 and Projection remain two independent axes, exactly as Wave 7
already established: Projection answers "how is this learner doing,"
Curriculum Domain answers "what does the content actually contain." A
future Projection Engine v2 that computes substrand-level knowledge
(already named as a candidate in the Migration Ledger) would be a natural
consumer of Curriculum Domain v2's real Sub-strand identities instead of
inventing its own — worth naming here as a forward-compatibility note,
not a commitment either document makes.

---

## 11. Integration with Adaptive Learning, Blueprint, Career Intelligence, Teacher Academy

Covered in the Migration Strategy (§8, Phases 4–6) and Consumer Map (§6)
above — repeated here only to state the shared principle once: **every
one of these reads the same `lib/curriculum/` API for the same
questions.** None computes a second notion of "what is this Sub-strand"
or "what Learning Outcomes does it contain." Where a consumer needs
something Curriculum Domain v2 doesn't yet provide (e.g., Career
Intelligence eventually wanting Career Pathway ↔ Learning Outcome
weighting), that's a named future extension (§3's Knowledge Graph
evaluation, §12), not a reason for that consumer to build its own
curriculum lookup.

---

## 12. Post-Pilot Roadmap

1. **Source and load Core Competencies, PCIs, Values, Assessment
   Opportunities, Suggested Resources** — a genuine content-acquisition
   effort (find or produce a real KICD source for these, same rigor as
   the Learning Outcomes parsing already done for `data/kicd-pdfs`), not
   a re-pointing exercise like Phases 2–6. The single largest remaining
   gap this document did not close, named honestly rather than implied
   solved.
2. **Revisit the Curriculum Knowledge Graph question (§3)** once Career
   Intelligence (Phase 6) has real pilot usage data showing whether
   Career Pathway ↔ Learning Outcome traversal queries are actually
   needed, versus the relational join tables already sufficing.
3. **Retire `diversityEngine.ts`'s content-filling role** (keep or retire
   its prompt-variety role separately) once real per-outcome content
   density makes it redundant for that purpose.
4. **Extend the Assessment Generator's curriculum coupling** — named in
   §6 as unaudited; a follow-up source audit of that specific consumer
   before committing it to a phase.
5. **Consider whether Projection Engine v2** (Migration Ledger's own
   named future gap — substrand-level knowledge) should consume
   Curriculum Domain v2's real Sub-strand identities as its dimension
   key, rather than inventing one (§10).

---

## 13. Pilot Impact Summary

**Must complete before pilot:**
- Phase 2 (Import official KICD content) — should complete; not a hard
  blocker, but the highest-leverage investment named in this document.
- Phase 4 (Migrate Adaptive Learning) — should complete, contingent on
  Phase 2; this is what makes Wave 7's real-content path actually fire
  for real classrooms instead of falling back to the honest notice 98%
  of the time.

**Can wait until after pilot:**
- Phase 1 (API consolidation — no functional change)
- Phase 3 (Reconnect generators — existing generators already work)
- Phase 5 (Blueprint lineage — Blueprint already works)
- Phase 6 (Career Intelligence / Teacher Academy lineage — both already
  work for their current purpose)
- Phase 7 (Retirement — by definition follows proof)

**Future architecture, not scheduled:**
- Curriculum Knowledge Graph evaluation (§3, §12)
- Core Competencies/PCIs/Values/Assessment Opportunities/Resources
  content acquisition (§7, §12 — a data problem, not an architecture
  problem, and this document does not claim to solve it)
- Projection Engine v2 substrand-level knowledge (§10, §12)

---

## 14. Risks

- **Phase 2's reconciliation load is the one place this document's
  entire value proposition can silently fail again**, the same way
  `sow_learning_outcomes` silently failed: if the loader falls back to
  fuzzy-matching or blind UUID assumptions instead of confident
  title-matching with explicit gap logging (§7), Curriculum Domain v2
  reproduces the exact orphaning problem it exists to fix, just in a new
  table. This is the single highest-scrutiny implementation detail in
  the eventual Phase 2 build.
- **`diversityEngine.ts` is a live, working system a naive reading of
  this document could mistake for "legacy curriculum logic to delete."**
  It is not, entirely — its prompt-variety mechanism (avoiding repetitive
  AI phrasing across a term) is a real, separate concern from curriculum
  content sourcing, and this document explicitly does not schedule its
  removal (§8 Phase 3, §12).
- **Scope creep into "let's also fix the Assessment Generator's
  curriculum coupling now"** — named explicitly as unaudited (§6) and
  deferred to its own follow-up audit, not folded into this document's
  phases without that groundwork, consistent with how this document
  itself was produced (audit before design, not design then assume).
- **Content-gap fatigue** — if every consumer's honest "Core Competencies
  not available" notice (§7) becomes routine background noise a teacher
  learns to ignore, the Curriculum Integrity mandate's intent (teacher
  trust over AI completeness) is undermined in practice even though the
  architecture is technically compliant. Worth a pilot-time UX check,
  not a redesign of the notice mechanism itself.
