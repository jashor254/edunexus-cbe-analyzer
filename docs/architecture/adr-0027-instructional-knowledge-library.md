# EduNexus — ADR-0027

# Instructional Knowledge Library (IKL)

## The Knowledge Base Behind Instructional Intelligence

### Design Only — No Code, No Migrations

**Depends on**: ADR-0022, ADR-0023, ADR-0024, ADR-0025, ADR-0026 (Instructional Intelligence Framework — the constitutional document this ADR's knowledge model must serve, per its own Misconception Framework's "AI must never invent misconceptions" clause).

---

## Executive Summary

This ADR exists to close a gap ADR-0026's own reconciliation pass named explicitly: Sprint 5A's transformation engine has the AI generate `expected_misconceptions` per variant at the moment of transformation — the only option available until a real, human-authored knowledge base exists. This document designs that base.

**The single most important audit finding, and it changes this ADR's scope directly**: this platform has already tried to build exactly this kind of curriculum-attached instructional content, **twice, and both attempts are dormant**. `sow_strands.kicd_data` and `sow_learning_areas.kicd_subject_data` (jsonb columns) exist in the live schema specifically for Core Competencies, Pertinent and Contemporary Issues, Values, Suggested Learning Experiences, and Assessment Opportunities — but `lib/curriculum/curriculumContext.ts`'s own header comment confirms, against the live database, that **these columns are empty across every row today**. Separately, a whole table — `kicd_curriculum_lessons` (`core_competencies`, `key_inquiry_questions`, `learning_experiences`, `learning_resources`, `pci_links`, `assessment_methods`, `is_kicd_official`, `confidence_score`) — exists in the generated types and is **read by zero code anywhere in the repository** (confirmed by exhaustive grep). Two prior, well-intentioned attempts at "curriculum-attached official instructional content," both abandoned before ever being populated.

**This is not a reason to avoid building IKL — it's a reason to build it smaller than the brief's own checklist suggests.** A twelve-category knowledge library risks becoming a third dormant table. Recommended V1 scope: **Misconception Library and Scaffolding Library only** — the two categories ADR-0026 explicitly named as a safety gap, nothing else. Teaching strategies, context libraries, visual assets, and vocabulary support are real, valuable, and explicitly **not V1**.

**Recommendation: CONDITIONAL GO** — see §12.

---

## 1. Educational Assets Audit — what belongs in Version 1

Of the sixteen categories named in the brief, only two are load-bearing against a real, already-committed safety principle (ADR-0026: "AI must never invent misconceptions... should prefer human-authored instructional assets"):

| Category | V1? | Why |
|---|---|---|
| **Misconception Library** | **Yes** | Directly closes ADR-0026's named gap; the one category with an explicit "AI must never invent" rule already on the books |
| **Scaffolding Library** | **Yes** | Sprint 5A's Foundation/Core transformation rules (§3 of that document) already name specific scaffold *types* (worked examples, guided reasoning, hints) without a structured, reusable, teacher-reviewable source for them — same gap, one tier removed |
| Teaching Strategy Library | No — future | No current consumer needs it; nothing in Sprint 5A's prompt architecture has a slot for "which pedagogy" beyond the tier rule table it already has |
| Context Library, Visual Learning Library, Vocabulary Library | No — future | Quality-of-life enrichments, not safety gates. Building these now, before a single misconception has ever been reviewed and used, repeats the exact pattern that left `kicd_curriculum_lessons` dormant — a broad schema built ahead of a real, proven consumer |
| Question stems, Remediation/Extension activities, Assessment transformations | No — these are already what Sprint 5A's `assignment_question_variants` produces; IKL doesn't duplicate that table, it *feeds* it |
| Parent support guidance, Career relevance, Cross-curricular links | No — no current adaptive-transformation consumer needs them; named for §13 Future Expansion, not designed here |

This is the same "start simple, prove it, then grow" discipline this project has held everywhere else in this series — applied here for the first time against **direct evidence of what happens when it isn't held** (`kicd_curriculum_lessons`).

---

## 2. Knowledge Architecture

```
Curriculum (sow_grades → sow_learning_areas → sow_strands → sow_substrands
            → sow_learning_outcomes) — UNCHANGED, the one source of truth
        │
        ▼
Misconception Library          — curriculum-node-scoped (FK to sub_strand_id,
    │                             per the First Principle: one canonical node)
    │
    ├──────────────▶ Scaffolding Library — NOT curriculum-scoped (see §4 —
    │                 reusable pedagogical patterns, not curriculum content;
    │                 attached to a misconception's recommended_scaffold, or
    │                 directly to a transformation, not owned by a curriculum
    │                 node itself)
    │
    ▼
AI Transformation (Sprint 5A) — consumes both, as approved-only lookups,
    │                            proposes new entries only when none exist
    ▼
assignment_question_variants  — UNCHANGED shape; expected_misconceptions
                                 remains free text for now (see §9's flagged
                                 follow-on migration), but is now populated
                                 by *referencing* an approved Misconception
                                 Library entry's description, not inventing one
```

No new curriculum representation — `sub_strand_id` is the same foreign key every other sprint in this series already uses (Projection's `SubStrandPerformance`, Sprint 4B's variant rows, Sprint 5A's curriculum context). IKL adds a knowledge layer *on top of* the existing curriculum spine; it does not create a second one.

---

## 3. Misconception Library — Structured Model

| Field | Notes |
|---|---|
| `id` | Permanent, never reused |
| `sub_strand_id` | FK → `sow_substrands.id` — the one canonical node this misconception attaches to (First Principle) |
| `description` | The misconception itself, in plain language |
| `observed_learner_behaviour` | What a teacher actually sees (e.g. "adds numerators and denominators separately") |
| `likely_reasoning_error` | The underlying cognitive error, distinct from the surface behaviour |
| `correction_strategy` | Free text — what a teacher does about it |
| `recommended_scaffold_id` | FK → Scaffolding Library (§4) — reuse, not a duplicate free-text description of the same pattern |
| `evidence_indicators` | Free text today, describing what a real answer pattern would look like — **not** wired to `learner_evidence` or `assignment_submissions.answers` automatically in V1 (see §10's honest "not yet measurable" framing) |
| `related_misconceptions` | Array of self-referencing ids — informational only, no enforced graph structure needed at this scale |
| `status` | `proposed \| approved \| rejected \| archived` — **the exact same four-state machine Sprint 4B already designed for variants, reused verbatim, not reinvented** |
| `generated_by` | `ai \| teacher_authored` — same pattern as `assignment_question_variants.generated_by` |
| `supersedes` / `superseded_by` | Same archive-never-delete discipline as `learner_evidence` and Sprint 4B's variants — a correction to a misconception entry is a new version, never an edit-in-place of an already-approved one |
| Timestamps | `created_at`, `approved_at`, `archived_at` — same shape as Sprint 4B §3 |

**Never generated permanently by AI, confirmed structurally, not just by policy**: a `proposed` row is not eligible for use by the AI Transformation lookup (§6) — only `approved` rows are ever read at generation time, mirroring Sprint 4B's `status='approved'` filter for variant selection exactly.

---

## 4. Scaffolding Library — Reusable Patterns

**Deliberately not curriculum-scoped**, and this is a real design decision worth stating explicitly against the First Principle's "every instructional asset must attach to one canonical curriculum node": a scaffold *type* — "worked example," "sentence starter," "leading question" — is a generic pedagogical technique, not curriculum content. It attaches to curriculum only through its *use* (a specific misconception's `recommended_scaffold_id`, or a specific generated variant's own record of which scaffold pattern it applied), never by owning a curriculum FK itself. Treating "sentence starters" as a Grade-8-Fractions-specific fact would be a category error — the same category error that would result from asking "which curriculum node does the DeepSeek API belong to."

| Field | Notes |
|---|---|
| `id` | Permanent |
| `scaffold_type` | `worked_example \| sentence_starter \| guided_reasoning \| visual_cue \| partial_solution \| leading_question \| concrete_example \| manipulative_suggestion \| representation_change` — the brief's own list, taken as the enum |
| `applicable_variant_tier` | `foundation \| supported_practice \| extension` — reuses ADR-0026's own Level taxonomy (as reconciled in the addendum to that ADR — "Supported Practice," not Sprint 5A's "Core"), not a new taxonomy |
| `description` / `template_text` | The reusable pattern itself, e.g. a sentence-starter template with a blank for the specific concept |
| `status`, `generated_by`, `supersedes`/`superseded_by`, timestamps | Identical shape to §3 — one state machine reused across both libraries, not two |

**Volume estimate, directly relevant to the "version explosion" risk (§11)**: the brief's own example list names nine scaffold types. Even generously allowing several variants per type, this table is realistically dozens of rows, ever — nothing like `assignment_question_variants`' per-(question,tier) growth. This is structurally a small, curated table, not a per-generation-event log.

---

## 5. Teaching Strategy / Context / Visual / Vocabulary Libraries — Named, Not Designed

Per §1: these are real future categories, deliberately left undesigned here rather than sketched-and-shelved (the exact failure mode `kicd_curriculum_lessons` already demonstrates). When a real consumer needs one of these — e.g. a future Learning Compass integration needing approved analogies — that consumer's own design pass should specify its shape against its actual use, the same discipline this entire sprint series has followed for every other component.

---

## 6. Adaptive Mapping — How Recommendation and Transformation Use IKL

```
recommendForClass()  →  band (UNCHANGED — IKL never touches this)
        │
        ▼
Sprint 5A's variant_type (foundation/supported_practice/extension)
        │
        ▼
Lookup: approved Misconception Library entries for this sub_strand_id
        │
        ▼
Each misconception's recommended_scaffold_id → approved Scaffolding Library
entry, filtered to scaffold_type appropriate for this variant_tier
        │
        ▼
Both fed into Sprint 5A's transformation prompt (§6 of that document) as a
new, populated "Instructional Library" context block — previously an
implicit static rule table (§3's Foundation/Core/Extension row descriptions),
now a real, curriculum-and-band-specific lookup
        │
        ▼
AI Transformation — assembles, does not invent, when IKL has an entry;
proposes a new draft Misconception/Scaffold entry (never auto-approved,
same gate as everything else) only when none exists yet for this specific
sub-strand
```

**No prompt independently invents pedagogy** (the brief's own Adaptive Mapping requirement) is satisfied exactly the way every other graceful-fallback in this series works: prefer the curated, approved source; fall back honestly (and visibly, flagged for teacher attention) to AI proposal only when the curated source is empty for this specific node — never silently, never pretending the curated source was consulted when it wasn't.

---

## 7. AI Interaction — Assembler, Not Inventor

Inputs to the Sprint 5A transformation call, updated from that document's §6 prompt architecture:

| Input | Source | Changed by this ADR? |
|---|---|---|
| Curriculum | `resolveCurriculumContext()` | No |
| **Instructional Library** | **This ADR — approved Misconception + Scaffolding entries for this sub-strand + tier** | **New slot** |
| Teacher Intent | Existing optional free-text slot | No |
| Learner Readiness | `variant_type` label only, per Sprint 5A §6 | No |
| Canonical Question | `assignment_questions` | No |

The prompt's own instruction changes from "generate a plausible misconception" (Sprint 5A's stopgap, as ADR-0026's reconciliation flagged) to "select and adapt from the supplied Instructional Library entries; propose a new one, marked as a draft proposal requiring approval, only if none apply" — a strictly narrower, more honest AI responsibility than Sprint 5A's original design had, closing exactly the gap ADR-0026 named.

---

## 8. Knowledge Lifecycle — Reconciled Against the Brief's Own Workflow

The brief specifies: `AI Suggestion → Teacher Review → Curriculum Review → Approval → Publication → Version History → Retirement` — seven stages. **One of these — "Curriculum Review," as a step distinct from Teacher Review — assumes a role this platform does not have.** Confirmed against this project's own prior pilot-readiness audit: no HOD, Principal, or curriculum-specialist role exists anywhere in the current user model; every reviewing action in every sprint this series has designed (Sprint 4B's variant approval, Sprint 5A's teacher review) is performed by the same class teacher. Inventing a second reviewer role here, for a knowledge library, before any adaptive feature has a single real user, would be scope creep against this project's own standing practice.

**Recommended V1 lifecycle — five real states, one role**:

```
draft (= AI Suggestion)
  → approved (= Teacher Review AND Curriculum Review, collapsed into one
     step performed by the same class teacher — matches every other
     approval gate this series has built)
  → published (implicit — an approved entry is immediately usable by the
     lookup in §6; no separate publication action, same reasoning Sprint 4B
     used for why variants need no separate "publish" step beyond approval)
  → archived (= Retirement — on regeneration/correction, never deleted,
     supersedes/superseded_by chain — Sprint 4B's mechanism, reused)

rejected (terminal for that specific draft, but the sub-strand can receive
  a fresh AI suggestion later — same as Sprint 4B's rejected-variant
  handling, which permits later regeneration)
```

A distinct curriculum-specialist review step is named in §13 as a real future extension **for when that role exists on the platform**, not designed against a role that doesn't.

---

## 9. Quality Assurance — Honest, Not Fabricated

Following Sprint 5A §11's own precedent (only claim a metric is objective when it actually is):

| Check | Objectively checkable today? | Method |
|---|---|---|
| Curriculum alignment | Yes | Same drift-detection mechanism as Sprint 5A §7 — does the entry's stated concept match the sub-strand's learning outcome |
| Educational accuracy (is this a real, commonly observed misconception, not just plausible AI text) | **No — human judgment only** | This is precisely what "AI must never invent, teachers approve" (ADR-0026) exists to gate — not solvable by a validator |
| Age appropriateness, language quality, inclusivity, accessibility | No | Advisory to the reviewing teacher; no fabricated score, same stance as Sprint 5A's reading-level finding |
| Evidence support (does this misconception actually show up in real learner answer patterns) | **Not yet — a real future signal, not built here** | `assignment_submissions.answers` (existing, Sprint 4C's analytics readiness) could eventually correlate a served variant's distractor choice against a misconception's `evidence_indicators` — named as a genuine, buildable-later validation mechanism once real usage data exists, not fabricated as available today |

---

## 10. Repository Design

| Repository | Owns | New? |
|---|---|---|
| **Instructional Knowledge Repository** (new — `lib/instructionalKnowledge/`, a new domain folder, since this is new business capability, not an Assignment/Quiz concern) | Misconception Library + Scaffolding Library CRUD, the shared five-state lifecycle | New, but thin — one shared state-machine module plus two table-specific read/write functions, following the same plain-function-module convention as every other domain in this series |
| Curriculum Repository (`lib/repositories/curriculum.repository.ts`) | `sow_substrands` resolution | Unchanged — IKL's `sub_strand_id` FK reads through this repository's existing functions, never queries `sow_substrands` directly |
| Evidence Repository | `learner_evidence`/`assignment_submissions` | Unchanged, **read-only if ever touched at all** (§9's future evidence-support signal) — IKL never writes to Evidence, matching every prior sprint's boundary |
| "Teacher Repository" | Not a distinct module — `lib/core/identity.ts::resolveTeacher`, already established | Reused |

**Avoiding a duplicate knowledge store — the actual decision, stated plainly**: `kicd_curriculum_lessons` and the `kicd_data`/`kicd_subject_data` columns are **left alone, not resurrected**. Migrating their unpopulated intent into IKL would mean designing against a schema shaped for a different, broader V1 than this ADR recommends (§1) — cheaper and more honest to build IKL's narrow V1 fresh and leave the two dormant predecessors as a named cleanup decision for later (drop or repurpose), explicitly out of this ADR's scope to decide unilaterally.

---

## 11. Analytics Readiness

| Future report | Requires | Status |
|---|---|---|
| Most effective scaffolds / most successful misconceptions | Correlating a scaffold/misconception's use in a served variant against that variant's actual learner outcomes | **Requires one real schema evolution, flagged not built**: `assignment_question_variants.expected_misconceptions` (Sprint 4B, currently free text) should eventually reference IKL misconception ids rather than storing prose — named here as the concrete follow-on migration this ADR implies, not performed by this document |
| Teacher adoption (approve vs. reject rate on AI-proposed entries) | The `status` field itself | Already sufficient — no new storage |
| Learner improvement attributable to a specific scaffold | `served_variant_map` (Sprint 4C) + `resolved_band` + `assignment_submissions.answers` | Already sufficient — no new storage, same "analytics needs already satisfied by fields required for other reasons" pattern this series keeps confirming |
| Knowledge usage (how often is each entry actually looked up) | A usage log | **Not designed here** — a lightweight future addition, not required for V1's core safety gate to function |

---

## 12. Risks

| Risk | Assessment | Mitigation |
|---|---|---|
| Knowledge becoming stale | Real — curriculum revisions could outpace review | No schema solution; a periodic review-reminder process is a future operational concern, not a V1 architectural gap |
| Conflicting strategies | Low — unlike variant tiers (Sprint 4B's one-approved-per-tier constraint), multiple approved misconceptions/scaffolds can legitimately coexist for one sub-strand; no uniqueness constraint needed, a real and stated difference from Sprint 4B's design |
| Curriculum updates orphaning entries | FK integrity is never broken (a sub-strand isn't deleted, per this whole initiative's additive-only migration discipline) but content could go stale relative to a revised learning outcome — human review dependency, not solvable structurally |
| Regional bias | Real, human risk (Kenyan-context specificity done by a non-representative set of authors) — mitigated by multi-author review process, not by schema |
| AI over-reliance | Same fairness concern ADR-0026 already names — this ADR's own approval gate (§3, §8) is the concrete mechanism, not a new one |
| Version explosion | Structurally bounded — §4's volume estimate (dozens of scaffolds, ever) and §3's per-sub-strand (not per-generation-event) scoping keep this table orders of magnitude smaller than `assignment_question_variants` |
| Duplicate instructional assets | Recommend a soft duplicate-warning at authoring time (text-similarity check against existing entries for the same sub-strand), not a hard DB constraint — misconceptions aren't mutually exclusive the way variant tiers are, so a partial unique index (Sprint 4B's mechanism) doesn't apply the same way here |
| Review bottlenecks | Bounded at pilot scale (50 teachers); a real risk **only if** this scales past pilot without ever building the curriculum-specialist role named in §8/§13 — flagged, not solved |

---

## 13. Future Expansion — Confirmed Not Blocked

Learning Compass, teacher planning, holiday learning, parent guidance, Career Explorer, lesson planning, AI tutoring — none require a schema change to what §3/§4 designs: each would simply become a new *consumer* reading approved Misconception/Scaffolding entries, or eventually prompt the addition of one of §5's named-not-built libraries (Context, Vocabulary, Teaching Strategy) when a real feature actually needs one. A distinct curriculum-specialist review role (§8) is the one named extension that would require new platform capability (a new user role) beyond this ADR's own schema.

---

## 14. Educational Invariants — Assessed

| Invariant | Held? |
|---|---|
| Knowledge belongs to curriculum | Yes — Misconception Library's mandatory `sub_strand_id` FK |
| Teachers remain knowledge owners | Yes — the five-state lifecycle's only actor is the teacher (§8) |
| AI proposes | Yes — `status='proposed'`/`draft`, never auto-approved |
| Humans approve | Yes — structurally gated, same mechanism as every prior sprint's variant approval |
| Every instructional asset is versioned | Yes — `supersedes`/`superseded_by`, archive-never-delete |
| Every asset is curriculum-linked | Yes for Misconceptions (direct FK); Scaffolding is linked *through use*, not direct ownership — a deliberate, stated exception (§4), not an oversight |
| Educational knowledge improves continuously | Partially — the mechanism exists (regeneration, versioning); the continuous-improvement *signal* (§11's evidence-support correlation) is named as a future build, not yet live |

---

## 15. Exit Criteria — Assessed

> "Every future adaptive feature can retrieve instructional knowledge from IKL instead of embedding pedagogy inside prompts. AI becomes a consumer of educational knowledge rather than its primary source."

**Achievable for the two categories this ADR actually designs (Misconceptions, Scaffolding)** — Sprint 5A's transformation prompt gains a real lookup instead of inventing content wholesale, satisfying the exit criterion's letter for the one consumer that exists today. **Not yet true platform-wide** — no other adaptive feature exists yet to test the "every future adaptive feature" claim against, and categories outside V1's scope (§1) remain prompt-embedded wherever they're used, honestly, until a future ADR designs them against a real need.

---

## 16. Final Recommendation

**CONDITIONAL GO.**

Conditions:

1. **V1 scope is Misconception Library + Scaffolding Library only** — the twelve other named categories are future work, not this ADR's deliverable. Building more now repeats the exact pattern that left `kicd_curriculum_lessons` dormant.
2. **`kicd_curriculum_lessons` and the `kicd_data`/`kicd_subject_data` columns are not touched, resurrected, or migrated into** by this build — they are named, left alone, and flagged as a separate future cleanup decision.
3. **"Curriculum Review" collapses into the existing single teacher-approval step** — no new user role is invented for this ADR; a distinct curriculum-specialist reviewer is named in §13 as a future extension contingent on that role existing at all.
4. **Sprint 4B's `assignment_question_variants.expected_misconceptions` free-text field is flagged, not fixed, as a follow-on migration** to reference real IKL ids once this library exists — named explicitly so it isn't silently forgotten the way ADR-0022's Open Question 1 (the evidence loop) nearly was before Sprint C closed it.

With these four conditions held, IKL gives Sprint 5A's transformation engine a real, teacher-owned, versioned source of pedagogy to assemble from — closing the exact gap ADR-0026's own reconciliation named — without repeating this platform's own prior, dormant attempt at the same idea.
