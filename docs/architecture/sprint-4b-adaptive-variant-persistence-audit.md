# EduNexus — Sprint 4B: Adaptive Assessment Variant Persistence Audit

## Design Only — No Code, No Migrations

**Depends on**: ADR-0022, ADR-0023, ADR-0024, ADR-0025, Sprint 4A (`sprint-4a-canonical-assessment-foundation-audit.md`), Sprint 4A.1 (`sprint-4a1-repository-extraction-identity-preservation.md`).

**Precondition, stated up front**: everything below assumes Sprint 4A.1 has shipped — specifically, that `assignment_questions` rows have permanent ids and are locked once real submission activity exists. A variant table built against unstable question ids would inherit the exact cascade-delete hazard both prior audits exist to prevent. This document does not re-litigate that; it depends on it.

---

## Executive Summary

The persistence model this sprint needs is smaller than its own audit checklist suggests, because most of the checklist's concerns (analytics readiness, provenance, learner mapping) are satisfied by **fields already named in ADR-0025's original schema sketch**, not new mechanisms — the real design work is in **lifecycle discipline** (how a variant is superseded without being destroyed) and **one DB constraint** (preventing two "live" variants for the same question+tier from ever existing simultaneously). Both patterns already exist elsewhere in this codebase and are reused, not invented: `learner_evidence`'s `supersedes`/`superseded_by` chain (never overwrite, always supersede) and its DB-trigger-enforced immutability are the direct precedent for variant regeneration; no new pattern is proposed.

**Recommended architecture**: Option A (`assignment_question_variants`, a table separate from but FK'd to `assignment_questions`) — confirmed independently by three separate passes now (the original ADR-0025 draft, the Sprint 4A audit's own variant-persistence section, and this sprint's fresh comparison below). A fourth option considered and rejected here for the first time: a generic, polymorphic `content_variants` table shared across future content types (lesson plans, assignments, etc.) — rejected both on integrity grounds (no real foreign key to a single parent table) and on this project's own standing principle ("Start Simple, Grow Later" — no second consumer exists yet to justify the abstraction).

**Recommendation: CONDITIONAL GO** — see §14 for the specific, non-negotiable conditions.

---

## 1. Canonical Relationship Audit

```
Assignment                    assignments (existing, unmodified)
    │
    ▼
Canonical Question             assignment_questions (Sprint 4A.1 — permanent id, locked
    │                          once real submission activity exists)
    ▼
Variant                        assignment_question_variants (NEW — this sprint's design,
    │                          FK question_id → assignment_questions.id)
    ▼
Learner Submission             assignment_submissions + served_variant_map jsonb (NEW
    │                          column — recorded at serve time, before any answer)
    ▼
Evidence                       learner_evidence via recordQuizAutoGradeEvidence()
    │                          (lib/quiz/quizEvidence.ts — UNMODIFIED; called with
    │                          whichever row — canonical or variant — was actually served)
    ▼
Projection                     recomputeLearnerProjection() (UNMODIFIED — reads only
    │                          confirmed Evidence, has no awareness variants exist)
    ▼
Recommendation                 recommendForClass()/classifyGroup() (UNMODIFIED —
    │                          curriculum-aware since Phase 3 this initiative already built)
    ▼
Future Variant                 next generation cycle reads Recommendation's band output
                               exactly the same way this sprint's serving logic does —
                               no second read path, no second band computation
```

**Every relationship verified against real code, not assumed**:
- `assignment_questions.assignment_id → assignments.id` — real FK, confirmed in the migration.
- `assignment_question_variants.question_id → assignment_questions.id` — proposed, additive, `ON DELETE CASCADE` (a deleted canonical question legitimately takes its variants with it — but per 4A.1, a locked question is never deleted, so this only fires for a still-unlocked, never-submitted-against question, which is safe).
- `served_variant_map` references variant/question ids that already exist by construction (written at serve time, never speculatively) — no FK possible on a jsonb map's values directly, but every id it contains is one this sprint's own serving logic just read from a real row a moment earlier.
- `learner_evidence` → **confirmed, again, to carry no FK to any question or variant id** (`raw_input_ref` is a free-text string: `assignment:{id}:score=...`) — meaning Evidence's own domain boundary is untouched by this entire design. This is a feature, not a gap: Evidence doesn't need to know variants exist, only that a score happened.
- Projection/Recommendation: zero new read paths into either — confirmed by construction, since nothing in this design proposes touching `lib/projection/` or `lib/adaptiveLearning/recommend.ts`.

No duplicate curriculum model, no duplicate learner model, no duplicate evidence pipeline anywhere in this chain.

---

## 2. Variant Storage Audit

| | **Option A** — `assignment_question_variants` | **Option B** — extend `assignment_questions` with a variant dimension | **Option C** — generic polymorphic `content_variants` |
|---|---|---|---|
| Normalization | Clean 1NF — one row per (question, tier), no repeating groups | Forces either sparse wide columns (4 sets of question_text/choices/correct_index) or breaks the table's current unambiguous "the question" meaning by adding a self-referencing tier column with nullable "parent" semantics | Clean in isolation, but the FK becomes `(content_type, content_id)` — no real referential integrity, just an application-enforced convention |
| Performance | One indexed lookup (`question_id`, `variant_type`, `status='approved'`) — cheap at this scale | Same query complexity as A, against a wider/muddier table that every existing reader (`findQuestionsForStudent`, `findQuestionsForTeacher`, `gradeAndSubmitQuiz`) would need to re-learn to filter correctly | Same query shape as A, plus a mandatory `content_type` filter on every query — no actual benefit over A for the one consumer that exists today |
| Teacher editing | A variant's own row can be edited independently of the canonical question — exactly matches "teacher previews, edits per-question" | Editing a variant risks touching the same row a grading path might be mid-read on for the canonical tier — conflates two different mutation lifecycles (question is locked once submitted-against; a variant, being pre-approval, should still be freely editable even after the question itself locks) | Same as A, no added benefit |
| Regeneration | Insert new draft row, mark previous `approved` row `superseded_by` the new one — direct reuse of `learner_evidence`'s pattern | Regeneration means overwriting columns in place — exactly the mutation `learner_evidence`'s own immutability discipline exists to forbid | Same capability as A, no added benefit, more ceremony |
| Analytics | `GROUP BY variant_type` is a real, indexable query against a purpose-built table | Requires unpivoting sparse columns first | Requires an extra `content_type = 'assignment_question'` filter everywhere, for zero analytical benefit today |
| Grading | Grade against the exact `question_id`-or-`variant_id` in `served_variant_map` — one join | Same, against the muddier table | Same, plus the extra type-discriminator join |
| Rollback | `DROP TABLE assignment_question_variants` — fully additive, zero risk to existing data | Requires dropping new columns from a table every existing consumer already depends on — higher blast radius for a rollback | Same rollback ease as A, but see below |
| Migrations | One new table, one new column (`served_variant_map`) — additive only | Alters a table with live RLS policies and five existing readers — every one of them needs re-verification even though only quiz-type assignments would ever populate the new columns | One new table — additive, but paired with an abstraction that has exactly one real consumer |
| Backward compatibility | Full — `assignment_questions` completely unchanged; an assignment with zero variants behaves exactly as it does today (§ ADR-0025's "graceful fallback," unchanged) | Partial — every existing reader must learn to ignore/handle new nullable columns even when they're always null for non-adaptive quizzes | Full, but the abstraction cost buys nothing not already bought by A |

**Recommendation: Option A**, confirmed a fourth time (original ADR-0025 draft → Sprint 4A audit §7 → this document's independent re-comparison → the polymorphic Option C considered and rejected here for the first time). **Option C rejected specifically because**: (1) a polymorphic `(content_type, content_id)` reference gives up a real foreign key for an application-enforced convention, which this codebase avoids everywhere else (every table audited across four sprints now uses real FKs); (2) no second consumer of "content variants" exists anywhere in the codebase today — lesson plans, holiday packs, and every other generated-content surface has no variant concept — building the general case ahead of a second real need is exactly what this project's own standing engineering philosophy warns against (smallest correct slice first, generalize only once a second real case exists, not preemptively).

---

## 3. Variant Identity

| Field | Belongs in persistence? | Reasoning |
|---|---|---|
| Variant UUID (`id`) | Yes | Primary key; permanent for the row's whole lifetime, including after being superseded (never reused, never reassigned) |
| Canonical Question UUID (`question_id`) | Yes | The one real FK this table exists to carry — `→ assignment_questions.id ON DELETE CASCADE` |
| Variant Type (`variant_type`) | Yes | `'foundation' \| 'supported_practice' \| 'extension'` — reuses the already-frozen band-to-tier collapse (ADR-0025 §2); `'independent'` is deliberately never a stored value (the canonical question already is that tier's content) |
| Generation Version (`prompt_version`, `model`) | Yes, as two typed columns, not a JSONB blob | Matches this codebase's own convention of typed fields over opaque blobs for anything a teacher-facing explainability view needs to render (mirrors `RiskFlag`/`CapabilityV2Score` in `lib/projection/types.ts` — real fields, not a bag of JSON) |
| Approval Status (`status`) | Yes | `'draft' \| 'approved' \| 'rejected' \| 'archived'` — see §5 for the full transition table; `'archived'` added here relative to the original ADR-0025 sketch, needed specifically for the supersede-on-regeneration pattern (§9) |
| Created By (`generated_by`) | Yes | `'ai' \| 'teacher_edited'` — already in ADR-0025's schema; flips to `'teacher_edited'` the moment a teacher edits any field post-generation, never silently reset back to `'ai'` |
| Generation Source | Yes, folded into `model` + `prompt_version` above | No separate field needed — "source" *is* "which model, which prompt version" |
| Curriculum context (`sub_strand_id`, `learning_outcome`) | Yes, both, as a nullable FK + a display-only text copy | Mirrors `SubStrandPerformance.subStrandTitle`'s own "display-only, never re-resolved" discipline (`lib/projection/types.ts`) — never re-resolved after generation, honestly nullable when the class's `academicGrain` was subject-level at generation time (Phase 3's own graceful-fallback contract, unchanged) |
| Difficulty rationale, expected misconceptions, teacher/learner explanations | Yes, as typed text/text[] columns | Direct carry-over from ADR-0025's schema — no change proposed here |
| `supersedes` / `superseded_by` (self-referencing) | Yes — new relative to the original ADR-0025 sketch | The mechanism §9 needs; direct structural copy of `learner_evidence.supersedes`/`superseded_by` |
| Timestamps (`created_at`, `updated_at`, `approved_at`, `archived_at`) | Yes, all four | `approved_at`/`archived_at` nullable, set only on the matching transition — needed for the "which timestamps change on regeneration" question §9 asks explicitly |

Nothing here duplicates Evidence's own provenance fields (`ingestion_run_id`, `extraction_method`, etc.) — this table's provenance is about *how a variant of a question was produced*, a category of fact Evidence has no reason to know about.

---

## 4. Teacher Approval Audit

```
Teacher
  │
  ▼ Generate Variants        — bulk INSERT, one row per (question, tier actually
  │                            present in the roster), all status='draft'
  ▼ Preview                  — read-only, no state change
  │
  ├─▶ Edit                   — UPDATE the draft row's content fields; generated_by
  │                            flips to 'teacher_edited'; status stays 'draft' until
  │                            an explicit approve action (editing is not itself approval)
  │
  ├─▶ Approve                — status: draft → approved, approved_at set
  │
  ├─▶ Reject                 — status: draft → rejected; a rejected variant is
  │                            terminal for that tier until Regenerate is used —
  │                            the band silently falls back to serving the
  │                            canonical question, the same safe default as
  │                            "no variant generated at all" (ADR-0025's
  │                            unapproved-variant fallback, unchanged)
  │
  └─▶ Regenerate Individual Variant  — see §9; produces a NEW draft row,
       │                               the old row (whatever its status) becomes
       │                               'archived' with superseded_by pointing at
       │                               the new row
       ▼
     back to Preview/Edit/Approve for the new row

Publish  — NOT a variant-level action. A variant becomes servable the moment it
           is status='approved' AND its assignment is itself visible to students
           (assignments.status — Sprint 4A's existing gate, unmodified). No second
           "publish" concept is introduced at variant grain — that would duplicate
           the one servability signal that already exists at the assignment level.
```

**Legal state transitions** (anything not listed is rejected by the repository layer, not just discouraged by UI):

| From | To | Trigger | Guard |
|---|---|---|---|
| *(none)* | `draft` | AI generation or manual teacher authoring | — |
| `draft` | `draft` | Teacher edits content | `generated_by` → `'teacher_edited'` |
| `draft` | `approved` | Teacher approves | `approved_at` set |
| `draft` | `rejected` | Teacher rejects | — |
| `approved` | `archived` | Regeneration of this (question, tier) pair | `superseded_by` set to the new row's id |
| `rejected` | `archived` | Regeneration of this (question, tier) pair | Same as above — a rejected variant can still be regenerated, producing a fresh draft |
| `approved`/`rejected`/`archived` | *(any other)* | — | **Illegal** — an approved variant cannot be silently un-approved by an edit; editing an approved variant must go through Regenerate (produces a new draft), never an in-place mutation of a row already trusted enough to have been served |

This directly resolves ADR-0025's own Open Question 3 ("what happens at re-generation") with a real, named answer rather than leaving it open into this sprint.

---

## 5. Variant Lifecycle — reconciled against the brief's naming

The brief's lifecycle language (`Draft → Generated → Teacher Edited → Approved → Published → Archived → Regenerated`) names seven stages; **only four are real, distinct persisted states** (`draft`, `approved`, `rejected`, `archived`) — the rest are either transient events, not states (`Generated` is *how* a row entered `draft`, not a state distinct from `draft` itself; `Regenerated` is the *action* §9 describes, not a fifth status value), or already covered by an existing field (`Teacher Edited` is `generated_by='teacher_edited'`, a flag on the row, not a separate lifecycle stage a `draft` row stops being in when edited; `Published` is derived from the assignment's own `status`, per §4, never a fifth variant-level state). Collapsing the brief's seven-stage language onto four real database states is itself a finding: it prevents building a needlessly wide status enum whose extra values would just be redundant restatements of `generated_by` and the parent assignment's own status.

---

## 6. AI Provenance

Stored as real typed columns on the variant row (§3): `model`, `prompt_version`, `created_at` (= generation time), `sub_strand_id` + `learning_outcome` (curriculum context, display-only per §3), `question_id` (canonical question), `variant_type` + `difficulty_rationale` (transformation strategy). **No JSONB blob, no duplicate storage of anything Evidence or Curriculum already own** — `sub_strand_id` is a reference to the same `sow_substrands` row `resolveCurriculumContext()` already resolves for the class, never a second curriculum representation; nothing about a variant's generation is written to `learner_evidence` (confirmed §1 — Evidence only exists post-submission, via the unmodified `recordQuizAutoGradeEvidence`).

---

## 7. Learner Mapping Audit

```
recommendForClass(roster, subject, { subStrandId })   — UNMODIFIED, existing call
        │
        ▼
per-learner AdaptiveGroupType + academicGrain          — UNMODIFIED
        │
        ▼
band → variant_type (the one frozen mapping table, ADR-0025 §2):
        critical_gap, prerequisite_gap  → foundation
        concept_confusion               → supported_practice
        on_track                        → (no row — serve the canonical question)
        │
        ▼
lookup: SELECT * FROM assignment_question_variants
        WHERE question_id = $1 AND variant_type = $2 AND status = 'approved'
        │
        ├─ found     → serve this variant's content; record {questionId: variantId}
        │              in served_variant_map at the moment the student opens it
        │
        └─ not found → serve the canonical assignment_questions row; record
                       {questionId: null} — the same honest, non-fabricating
                       fallback ADR-0025 already specified
```

**No learner-specific question generation anywhere in this path** — the lookup is purely a mapping over already-generated, already-approved rows. This sprint's design introduces zero new "does this learner deserve X" logic; that judgment is entirely `recommendForClass`'s, unchanged.

---

## 8. Grading Audit

**Variant-specific answer keys — not one shared key.** Educational reasoning: a Foundation variant is explicitly permitted (ADR-0025's own Transformation Rules) to change wording, worked-example scaffolding, and representation — which routinely means different distractor choices, a different choice ordering, or an intermediate guided sub-question with its own correct index, none of which is guaranteed to align with the canonical question's `correct_index` by coincidence. A single shared answer key across variants would silently mis-grade any variant whose choice set differs even trivially from the canonical one — a worse failure than any other AI mistake on this platform, per ADR-0025's own Safety Principles, because it's graded, not conversational.

Each `assignment_question_variants` row therefore carries its own `choices`/`correct_index`, exactly as ADR-0025's original schema already specified. **Grading must resolve against whichever row `served_variant_map` names**, never unconditionally against the canonical question — this requires a change to `gradeAndSubmitQuiz()` (`lib/quiz/quiz.ts`), correctly scoped as a *follow-on implementation sprint's* work once this persistence design is built, not something this design-only document builds or silently assumes is already solved.

---

## 9. Regeneration Audit

**Teacher regenerates the Foundation variant for one question, one class, only.**

| | Behavior |
|---|---|
| What changes | A new row: fresh `id`, new `question_text`/`choices`/`correct_index`/`difficulty_rationale`/etc., `status='draft'`, `generated_by='ai'`, `created_at=now()` |
| What never changes | `question_id` (same canonical question — regeneration cannot retarget a different question), `variant_type` (`'foundation'` stays `'foundation'` — regenerating never changes tier), `sub_strand_id`/`learning_outcome` (the curriculum objective — Principle 2, "never a different topic, never an easier subject") |
| Which identities survive | The **old** variant's `id` survives, unchanged, forever — it moves to `status='archived'` with `superseded_by` set to the new row's id, never deleted. Any `served_variant_map` entry already pointing at it (a student who was served it before regeneration) remains fully valid and gradable indefinitely. |
| Which timestamps change | The new row gets its own `created_at`/`approved_at` (once approved). The old row gets `archived_at=now()`. The canonical question's own `created_at` — untouched, per 4A.1's lock discipline, regardless of how many times its variants are regenerated. |
| How audit history is preserved | The `supersedes`/`superseded_by` chain — walk it backward from any variant to see its full generation history, identical in shape to how `learner_evidence` corrections are already walked. No new query pattern to invent; this codebase already has the tooling shape for "walk a supersession chain" via `getLearnerTimeline()`'s own precedent (`lib/learnerRecord/timeline.ts`), reusable as a pattern even though that specific function is Evidence-scoped and not itself extended here. |

This directly answers the brief's four regeneration questions with committed, specific answers rather than leaving any open.

---

## 10. Analytics Audit

| Future report | Requires | Already satisfied by |
|---|---|---|
| Variant effectiveness (score distribution per variant_type) | Knowing which variant a submission was actually graded against | `served_variant_map` (already planned) — no new column |
| Band performance | Joining submission → served variant → variant_type | Same as above |
| Question discrimination (correct-rate across tiers for the same canonical question) | Grouping by `question_id` across variant rows | `question_id` FK (already planned) — no new column |
| Common misconceptions (which distractor was actually picked, not just right/wrong) | The student's actual answer index + the variant's `choices` array | `assignment_submissions.answers` jsonb (already exists, Sprint 3a) joined against the served variant's `choices` — no new storage |
| Regeneration success (did a regenerated variant get approved faster / edited less than its predecessor?) | Walking the `supersedes` chain, comparing `created_at`→`approved_at` deltas per row | `supersedes`/`superseded_by` + the four timestamps (§3) — no new column |

**Every analytics need traced back to a field this sprint's design already carries for an unrelated (grading/approval/curriculum) reason.** Nothing needs adding *speculatively* for analytics alone — confirming the brief's own framing ("what persistence is required today to support tomorrow's analytics") resolves to "what's already here," not a new surface.

---

## 11. Performance Audit

- **Rows per assignment**: `questions × distinct tiers actually present in the roster`, bounded at 3 stored tiers (Independent needs none) — e.g. 5 questions × up to 3 tiers = at most 15 rows, typically fewer (most classes won't have all three bands represented). Matches the generate-once-per-(question,tier) cost discipline ADR-0022/0025 already committed to.
- **Rows per school**: at pilot scale (50 teachers, modest quiz cadence), low thousands total even generously estimated — trivial for Postgres, no partitioning or archival strategy needed yet.
- **Storage growth**: regeneration is append-only (archived rows kept forever) — bounded in practice by how often teachers actually regenerate (an infrequent, deliberate action, not a per-submission event). A future archival/cleanup policy for very old `archived` rows is a named-not-built extension point, not a Sprint 4B requirement.
- **Read amplification**: one indexed query per (question_id, tiers-present) at serving time, batchable across a whole class in one `IN (...)` query — no per-student round trip.
- **Write amplification**: generation is a bulk insert (one transaction, N rows); approval/rejection/archival are single-row status updates. No change to the write pattern `assignment_questions` itself already has (still gated by 4A.1's lock).
- **Index requirements**: `(question_id, variant_type)` for the general lookup, plus a **partial unique index** `UNIQUE (question_id, variant_type) WHERE status = 'approved'` — this is the DB-level guarantee that directly prevents the "duplicate variants" risk named in §12, not just an app-level check.
- **Query strategy**: serve-time lookup batches across the whole class's roster in one query per assignment (all needed question_id/variant_type pairs at once), matching the existing `mapWithConcurrency` batching shape already used in `recommendForClass`.
- **Bulk generation impact**: this sprint doesn't implement generation, but the schema must support a single bulk `INSERT ... VALUES (...), (...), ...` for N draft rows in one statement — no schema feature required beyond a normal table, confirmed.

**Confirmed**: no performance regression risk at this pilot's realistic scale; the one real requirement is the partial unique index, which is cheap to enforce and directly load-bearing for correctness, not just performance.

---

## 12. Repository Audit

| Repository | Responsibility | Reuse |
|---|---|---|
| **Assignment Repository** (Sprint 4A.1, `lib/assignments/`) | `assignments` + `assignment_questions` + `assignment_submissions` reads/writes, including the ID-preserving upsert and submission-activity lock | Unchanged by this sprint — the variant repository *depends on* it (reads `question_id`s, checks lock state indirectly via the same source of truth) but never re-implements canonical-question logic |
| **Variant Repository** (NEW — `lib/assignments/variants.ts`, sibling to `evidence.ts` and the 4A.1 repository module, same domain folder) | `assignment_question_variants` CRUD, the approval state-machine transitions (§4), the archive-on-regenerate operation (§9) | New, but its own internal logic is thin — mostly status transitions and one supersede operation, no independent business logic duplicating anything above |
| **"Question Repository"** | **Not a separate module** — this is the Assignment Repository's existing `assignment_questions` functions from Sprint 4A.1. The brief names it as a distinct concern; the audit's answer is that inventing a fourth module here would fragment one table's ownership across two files for no reason — the Variant Repository calls into the Assignment Repository's exported question-read functions rather than querying `assignment_questions` directly itself | Reuse, not a new module |

---

## 13. Testing Strategy

| Test | Protects |
|---|---|
| Bulk-insert N draft variants for (question × tiers-present) in one transaction | Persistence — the generate-once-per-tier write shape |
| A variant's `id` never changes across its own edit-while-draft cycle | Identity |
| `draft→approved`, `draft→rejected` succeed; `approved→draft` (direct edit-in-place) is rejected | Approval — the state machine in §4 is enforced, not just documented |
| Regeneration: old row becomes `archived` with `superseded_by` set; new row is a fresh `draft` with the same `question_id`/`variant_type` | Regeneration — §9's exact contract |
| A `served_variant_map` entry referencing an now-`archived` variant still resolves correctly for grading purposes (the archived row's content is never deleted) | Regeneration + Grading correctness together |
| The partial unique index rejects a second `approved` row for the same `(question_id, variant_type)` — attempted directly at the DB layer, bypassing the repository | Duplicate-variant prevention, enforced at the DB, not just app discipline |
| An assignment with zero variant rows serves and grades exactly as it does today | Backward compatibility |
| Rollback: dropping the new table and column leaves `assignments`/`assignment_questions`/`assignment_submissions` fully functional, unmodified | Rollback safety |
| A future analytics query (variant effectiveness, question discrimination) can be constructed from the schema using only fixture data seeded in these tests | Analytics readiness, verified concretely rather than asserted |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Duplicate variants (two `approved` rows for the same question+tier) | Partial unique index (§11) — DB-enforced, not app-level |
| Identity loss | Archive-never-delete (§9), direct reuse of `learner_evidence`'s own pattern |
| Approval bypass (a `draft` or `rejected` row served to a learner) | Serving query filters `status='approved'` explicitly (§7) — never "row exists" |
| Race conditions (simultaneous approve + regenerate on the same row) | The archive-on-regenerate operation must itself be one transaction (new-row-insert + old-row-archive together), matching 4A.1's own atomicity requirement for its upsert |
| Concurrent teacher edits (two tabs editing the same draft variant) | Same accepted last-write-wins posture as 4A.1 grants the canonical question — not a new class of risk, no new machinery proposed |
| Storage explosion | Bounded per §11; a future archival policy is named, not built, for when/if it's ever actually needed |
| Variant drift (a teacher's manual edit gradually drifts a variant away from the canonical learning outcome) | Not a schema risk — a teacher-authority tradeoff per ADR-0025 Principle 4. Mitigation is a *review-UI* design note (always show the canonical question + learning outcome alongside the variant being edited), not a database constraint — flagged for the eventual implementation sprint's UI design, out of this document's own scope |
| Incorrect learner mapping | The band→tier mapping is defined exactly once (ADR-0025 §2) and reused verbatim here — no second definition exists anywhere to drift out of sync |
| Future migrations | Every change proposed here is additive (one new table, one new jsonb column) — fully reversible, no backfill, no destructive rewrite, matching every migration reviewed across this entire initiative |

---

## 15. Success Criteria — Assessed

| Criterion | Met by this design? |
|---|---|
| Every canonical question can safely own multiple variants | Yes — Option A's FK relationship, §2 |
| Variant identity is permanent | Yes — archive-never-delete, §9 |
| Teacher approval is fully traceable | Yes — the four-state machine + timestamps, §3–§4 |
| Regeneration never destroys history | Yes — supersede chain, §9 |
| Future adaptive delivery requires no schema redesign | Yes — the serving lookup (§7) and grading resolution (§8) are both fully specified against this schema; only the *generation* logic (Sprint 4B's own explicit non-goal) remains to be built on top, unchanged |
| No duplicate curriculum or learner models introduced | Yes — confirmed at every layer in §1; `sub_strand_id`/`learning_outcome` are references/display copies, never a second curriculum representation; nothing here computes readiness independently of `recommendForClass` |

---

## 16. Final Recommendation

**CONDITIONAL GO.**

Conditions:

1. **Sprint 4A.1 must be merged and its tests green before this schema is built** — a variant table FK'd to an unstable `assignment_questions.id` reintroduces the exact hazard both prior audits exist to prevent. Not a suggestion; a hard sequencing dependency.
2. **The partial unique index (`UNIQUE (question_id, variant_type) WHERE status='approved'`) must ship in the same migration as the table itself**, not as a follow-up hardening pass — it's the one DB-level guarantee this whole design leans on to prevent duplicate live variants, and adding it later means a window where the invariant it protects doesn't actually hold.
3. **The archive-on-regenerate operation (insert new draft + archive old row) must be one transaction**, matching 4A.1's own non-negotiable atomicity condition — a partial failure here would leave a question with either two "live-looking" rows or none, exactly the failure mode this sprint exists to design away.
4. **Grading's update to resolve against `served_variant_map`** (§8) is explicitly **not** part of this sprint's own deliverable — it must be named as a required follow-on before any variant is ever actually served to a real learner, so it isn't silently assumed solved once the schema exists.

With these four conditions satisfied, the persistence model is sound, requires no future redesign to support generation (still not built), analytics (traced to already-present fields), or ARDS integration (once ADR-0023 ships, it slots in as a precision gate ahead of the existing band→tier mapping, without touching this schema at all).
