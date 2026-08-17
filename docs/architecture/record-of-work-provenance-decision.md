# Record of Work Provenance — Architecture Decision (H5B)

**Phase**: H5B. **Depends on**: H5A-0 → H5A-3 (`docs/architecture/curriculum-identity-invariants.md`), ADR-0032 (Teaching Document Identity Contract). **Status**: decision-blocked — see §6. **Database/production impact**: NONE. This is a read-only architecture audit; no migration, no code change.

---

## 1. What a `row_entries` record represents today — and the central finding

H5A-3 left Record of Work provenance unresolved and asked H5B to determine, from code, what a `row_entries` record actually means. The audit found the code gives **two different, currently-contradictory answers** rather than one clear one.

**Answer A — as coded in `lib/row/recordOfWork.ts`**: `strand`/`substrand` are declared `MACHINE_OWNED_ENTRY_FIELDS` — "Automation owns these and may refresh them on every synchronisation." They are written by `seedRecordOfWorkEntries()`'s upsert every time the weekly cron (`app/api/cron/generate-record-of-work/route.ts`, "Monday 06:00 EAT") runs `syncRecordOfWorkForScheme`, unconditionally overwriting whatever was there before, refreshed from the scheme's currently-authoritative planning source. Under this model, `strand`/`substrand` mean **"the planned curriculum, kept in step with the teaching documents."**

**Answer B — as built in `app/teacher/record-of-work/[id]/page.tsx`**: the UI's own code comment reads `/* Work Done — strand + substrand editable */`. Both fields are `contentEditable`, and an edit `PATCH`es `app/api/teacher/records-of-work/[id]/route.ts`, whose `allowed` field list is `['date_taught', 'strand', 'substrand', 'reflection']`. Under this model, `strand`/`substrand` mean **"what the teacher confirms was actually covered."**

**These two models conflict, and nothing reconciles them.** `date_taught` and `reflection` — the two fields the module header explicitly calls "teacher-authored evidence... never machine-written" — are protected by `convergeTeacherEvidence()`'s optimistic-guard mechanism: once a teacher writes a value, no later sync can overwrite it. `strand`/`substrand` have no equivalent protection. A teacher who edits "Fractions" to "Decimals" via the Record of Work UI today has that correction silently overwritten the next time the weekly cron re-syncs the scheme — because `strand`/`substrand` are in the unconditional-overwrite upsert payload, not behind a convergence guard.

This is a **live, pre-existing inconsistency in current production behavior**, not something introduced by this audit. It is the decisive reason this phase cannot answer §13 of its own brief ("when a teacher records 'Fractions taught today,' what should `sub_strand_id` mean?") from code alone — the code currently encodes both "A: originally planned" and "C: teacher-confirmed actual" for the same two columns, unreconciled.

---

## 2. Lifecycle trace

| Stage | Source object | Row identity | Curriculum identity carried | Editable fields | Deletion behavior |
|---|---|---|---|---|---|
| SOW created | `schemes_of_work` | `id` | `curriculum_mode` (string) only | teacher, via SOW UI | `DELETE /api/schemes/[id]` — teacher-initiated |
| Lessons generated | `scheme_lessons` | `(scheme_id, week, lesson)` unique | `sub_strand_id` (H5A-2) | `strand`/`substrand` text via `PATCH /api/schemes/[id]` (not `sub_strand_id`) | `ON DELETE CASCADE` from `schemes_of_work` |
| Lesson plans generated | `lesson_plans` | `(sow_id, week_number, lesson_number)` unique | `sub_strand_id` (H5A-3) | none found (no PATCH route for `lesson_plans` text) | `sow_id` `ON DELETE SET NULL` — **survives** scheme deletion |
| Record of Work header created | `records_of_work` | `id`, `UNIQUE(scheme_id)` | none (`curriculum_mode` string only) | teacher: school/grade/term/year at creation | `scheme_id` `ON DELETE SET NULL` — **survives** scheme deletion |
| Record of Work seeded | `row_entries` | `(row_id, week, lesson)` unique | none — `strand`/`substrand` text only | `strand`, `substrand`, `date_taught`, `reflection` via `PATCH /api/teacher/records-of-work/[id]` | `row_id` `ON DELETE CASCADE` from `records_of_work` |
| Weekly re-sync (cron, indefinitely) | re-runs `seedRecordOfWorkEntries` + `convergeTeacherEvidence` | same `row_entries` rows, upserted | n/a | `strand`/`substrand` **unconditionally overwritten**; `date_taught`/`reflection` **converge-guarded** (teacher value wins permanently once set) | n/a |
| Inspection / export | `app/teacher/record-of-work/[id]/page.tsx`'s print/export view | reads `row_entries` as-is | n/a | read-only in this view | n/a |

## 3. Database ownership (schema truth, not TypeScript)

| Table | PK | Key FK | ON DELETE | Curriculum ID field |
|---|---|---|---|---|
| `schemes_of_work` | `id` | `teacher_id → teachers` | `CASCADE` (teacher deletion) | none (string `curriculum_mode`) |
| `scheme_lessons` | `id`, `UNIQUE(scheme_id,week,lesson)` | `scheme_id → schemes_of_work` | `CASCADE` | `sub_strand_id → sow_substrands`, `ON DELETE RESTRICT` |
| `lesson_plans` | `id`, `UNIQUE(sow_id,week_number,lesson_number)` | `sow_id → schemes_of_work` | **`SET NULL`** | `sub_strand_id → sow_substrands`, `ON DELETE RESTRICT` |
| `records_of_work` | `id`, `UNIQUE(scheme_id)` | `scheme_id → schemes_of_work` | **`SET NULL`** | none |
| `row_entries` | `id`, `UNIQUE(row_id,week,lesson)` | `row_id → records_of_work` | `CASCADE` | none |

`row_entries` inherits historical-independence from its parent transitively (`records_of_work.scheme_id` survives scheme deletion, and `row_entries` cascades only from `records_of_work`, never directly from the scheme) — consistent with `lesson_plans`' pattern.

## 4. Seeding source rule — why lesson_plans wins when present

`seedRecordOfWorkEntries()`'s own comment states the reason directly: *"production contains both shapes... some schemes have `scheme_lessons` rows, some have only `lesson_plans` (where `/api/sow/save`'s swallowed insert error left `scheme_lessons` empty)"* — i.e., the priority rule exists **partly to compensate for a historical data-integrity bug**, not purely a "richer source" preference (the comment cites both reasons: bug-compensation for missing `scheme_lessons`, and "richer — carries planning metadata" when both exist). That specific swallowed-insert bug was hardened away in a later `app/api/sow/save/route.ts` revision ("R3" — the normalized `scheme_lessons` insert is now part of the save contract, not swallowed) — so for schemes created going forward, the bug-compensation reason is moot; `scheme_lessons` should always exist. The "richer content" reason still holds for schemes where lesson plans have actually been generated.

**Classification**: **LEGACY, with a still-valid secondary INCIDENTAL reason.** Not purely canonical, not purely accidental — a real bug-workaround from before H5A-2/H5A-3, sitting alongside a genuinely reasonable richness preference.

**Important consequence for curriculum identity specifically**: since H5A-2 and H5A-3, `scheme_lessons.sub_strand_id` and `lesson_plans.sub_strand_id` for the same `(week, lesson)` of the same scheme are populated from the exact same in-memory `GeneratedLesson.substrandId` at generation time, and neither is ever independently re-resolved afterward (§11 of the H5A-3 closeout's duplicate-truth analysis). So **for curriculum identity specifically — unlike for planning-metadata richness — it should not matter which of the two sources wins**: both should already agree.

## 5. Mixed-source coverage gap

Lesson plans generate **incrementally, one week at a time** (`generateWeeklyPlans(sowId, teacherId, currentWeek)`), while `scheme_lessons` are generated **all at once** at SOW save time. `seedRecordOfWorkEntries()` checks only "do any `lesson_plans` rows exist for this scheme" — if yes, it uses **lesson_plans only**, for the **whole scheme**, ignoring `scheme_lessons` entirely, even for weeks that have no lesson plan yet.

**Classification**: **MIXED_SOURCE_BUG, self-healing.** As soon as a scheme has even one generated lesson plan, every other week that doesn't yet have one is silently excluded from the Record of Work skeleton — not wrong content, but missing entries — until that week's own lesson plan is generated and the next weekly cron re-sync picks it up. Coverage grows monotonically toward complete as the term progresses (assuming the weekly generation cron runs reliably), so this doesn't corrupt data, but it does mean a Record of Work viewed mid-term can be silently incomplete for reasons unrelated to whether the teacher has taught those lessons yet. Not fixed this phase (scope lock).

## 6. Historical classification

**HYBRID**, confirmed by the central finding in §1 — this is not an unresolved unknown, it's a live split:
- `date_taught`, `reflection`, `remarks` (`TEACHER_OWNED_ENTRY_FIELDS`): **HISTORICAL_SNAPSHOT** — converge-guarded, permanent once written, matches the module's own stated intent exactly.
- `strand`, `substrand`, `learning_outcomes`, `key_inquiry_questions`, `learning_resources`, `activities_summary`, `status` (`MACHINE_OWNED_ENTRY_FIELDS`): **LIVE_DERIVED_VIEW** by code, but exposed to the teacher as if editable/historical by the UI, with no convergence protection — an unintentional hybrid, not a designed one.

## 7. Source & curriculum provenance recoverability

**Source provenance** (which of `lesson_plans`/`scheme_lessons` a given `row_entries` set was seeded from): **NO** — never persisted anywhere (`records_of_work`/`row_entries` have no column for it; the seeding function's own `source` return value is discarded by every caller).

**Curriculum provenance** (a stable `sub_strand_id`): **NO** — `row_entries` has no such column today. But per §4's finding, if added, it would very likely agree regardless of which upstream source it's sourced from, which meaningfully lowers the risk of adding it compared to how ambiguous this looked at the end of H5A-3.

## 8. Architecture options, scored

| | A: direct `sub_strand_id` snapshot | B: parent source FK only | C: dual nullable parent FKs | D: source FK + snapshot | E: no change |
|---|---|---|---|---|---|
| Semantic accuracy | Depends entirely on resolving §1's conflict first | Same dependency | Same | Same, plus more surface | Honest about the gap, resolves nothing |
| Historical integrity | Matches `MACHINE_OWNED` intent (re-synced); contradicts UI's implied "confirm actual" intent | Cleanest if "recover from currently-correct parent" is the real model | Resolves "which source" but adds polymorphic-FK complexity for a distinction that, per §4, mostly doesn't change the answer | Most complete, most state | No new risk, no new value |
| No fabricated identity | Safe — always derived from a real FK, never text | Safe | Safe | Safe | N/A |
| Source traceability | Lost (same as `strand`/`substrand` today) | Preserved | Preserved | Preserved | N/A |
| Edit behavior | Inherits the unresolved §1 conflict directly — would a teacher's `sub_strand_id` "correction" persist or get overwritten weekly, same as text today? | Same open question | Same | Same | No new edit surface |
| Schema simplicity | Simplest — mirrors existing precedent exactly | Simple | More complex (2 nullable FKs, exactly-one-populated invariant) | Most columns | None |
| Queryability | Direct, immediate | Requires a join | Requires a join + branch on which FK is set | Direct + traceable | None |
| Consistency with existing precedent | **Highest** — literally the same pattern already used for `strand`/`substrand`, just add `sub_strand_id` to `MACHINE_OWNED_ENTRY_FIELDS` | New pattern (no existing polymorphic-parent precedent found anywhere in the repo) | New pattern, no precedent | New pattern | N/A |
| Cross-curriculum safety (later) | Fine — same shape as every other `sub_strand_id` FK | Fine | Fine | Fine | Fine |

## 9–15. Option analyses (condensed)

- **Option A** is the technically simplest and most consistent with existing code (extends `MACHINE_OWNED_ENTRY_FIELDS`, the exact mechanism already proven for `strand`/`substrand`). Its correctness is entirely contingent on §1's conflict being resolved first — if the product intent is "planned, kept in sync," A is right and low-risk. If the intent is "teacher-confirmed actual," A alone is wrong (it would silently re-overwrite a teacher's correction, exactly like `strand`/`substrand` already do today).
- **Option B/C** (source parent FK, single or dual) has no existing precedent anywhere in this repository (checked: no polymorphic/dual-nullable-FK pattern found in any migration). Per §4's finding that both sources should agree on curriculum identity in practice, the extra traceability this buys is real but low-value relative to its complexity.
- **Option D** compounds B/C's complexity without resolving §1.
- **Option E** (no change) is honest but leaves Record of Work — arguably the highest-value place for curriculum identity, being the closest thing to "what was actually taught" — permanently text-only.

None of A–D can be soundly chosen without §1 being resolved first, because every option's correctness (not just its complexity) depends on what `sub_strand_id` is supposed to mean.

## 16. Recommended architecture

**Conditional on resolving §1's conflict**: **Option A** (direct `sub_strand_id` snapshot, added to `MACHINE_OWNED_ENTRY_FIELDS`, refreshed on every weekly sync exactly like `strand`/`substrand` already are) — **provided** the founder decision in §21 confirms "planned curriculum, kept in sync" is the intended meaning, and **provided** the pre-existing `strand`/`substrand` convergence bug (§1) is fixed in the same pass (giving it the same never-overwrite-a-teacher-edit protection `date_taught`/`reflection` already have, or explicitly deciding teachers should not edit these fields at all).

If the founder instead confirms "teacher-confirmed actual" is the intended meaning, the correct architecture is materially different: `sub_strand_id` would need to be a **teacher-owned, converge-guarded** field requiring an explicit curriculum picker UI for teachers to select/confirm — not something this phase is scoped to design (§14 of the phase brief: "Do NOT build that picker this phase").

## 17. Decision rationale

Educationally: a Record of Work is supposed to be the professional record of *actual teaching*, per this codebase's own module-header comment. But its two curriculum-shaped columns are currently governed by machine-sync code that treats them as *planned* curriculum, while its UI invites teachers to treat them as *actual* curriculum, with no reconciliation. Attaching a stable `sub_strand_id` to a design that hasn't resolved this would either inherit the same silent-overwrite bug (if machine-owned) or require net-new UI/UX work this phase isn't scoped for (if teacher-owned). The responsible outcome is to name the conflict precisely — which is what §1 and this document do — rather than pick a schema and hope it fits whichever intent turns out to be correct.

## 18. CUR-ROW-001 (proposed final statement, not yet adopted)

> A Record of Work entry's curriculum identity, wherever it is ultimately stored, must derive only from a canonical `sub_strand_id` already resolved upstream (in `scheme_lessons` or `lesson_plans`) — never re-resolved from `strand`/`substrand` text, and never fabricated when no canonical id is available upstream.

This holds regardless of which architecture option is eventually chosen — it constrains *how* identity may be populated, not *where* it lives.

## 19. CUR-ROW-002 (proposed final statement, not yet adopted)

> A Record of Work entry seeded from a source with no canonical curriculum identity (a manually-created Record of Work with `scheme_id: null`, or a scheme predating the H5A-2/H5A-3 FK retrofits) must remain unresolved (`sub_strand_id: NULL`) rather than infer one from `strand`/`substrand` text.

## 20. Planned vs. actual teaching

**No — the current architecture does not cleanly distinguish them**, and that is the central finding of this phase (§1). `date_taught`/`reflection`/`remarks` are true actual-teaching evidence, converge-guarded. `strand`/`substrand` are coded as planned-curriculum sync targets but exposed to teachers as if they were actual-teaching confirmation, with no protection either way. Any future `sub_strand_id` inherits this exact ambiguity until §1 is resolved.

## 21. Product decision required

**Exact question for the founder**: *When a teacher edits the Strand/Sub-Strand fields on a Record of Work entry, should that edit (a) be preserved permanently, the same way a `reflection` edit is — meaning "the teacher is confirming what was actually taught, which may differ from what was planned" — or (b) be expected to be overwritten by the next weekly sync, the same way the field is documented as `MACHINE_OWNED` today — meaning "this text is just a mirror of the current plan, and any teacher edit to it was never meant to stick"?*

This is not a hypothetical for the future — it describes what happens to a teacher's edit *today*, right now, and the two plausible readings of the existing code disagree about which behavior is intended. Resolving it is the prerequisite for any `sub_strand_id` design, not an optional nicety.

## 22. Proposed schema (documentation only — NO MIGRATION)

If §21 resolves to "planned, machine-synced" (Option A):
```sql
-- FUTURE — NOT APPLIED THIS PHASE
ALTER TABLE row_entries
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid
  REFERENCES sow_substrands(id) ON DELETE RESTRICT;
```
Populated by `seedRecordOfWorkEntries()`'s existing upsert, added to `MACHINE_OWNED_ENTRY_FIELDS`, refreshed on every sync exactly like `strand`/`substrand`.

If §21 resolves to "teacher-confirmed actual" (a variant of Option A, but teacher-owned): the same column, but moved to `TEACHER_OWNED_ENTRY_FIELDS`, populated only by an explicit teacher curriculum-picker action (not designed this phase), and given the same converge-guard protection `date_taught`/`reflection` already have.

## 23. Historical policy

Whichever option is chosen, existing `row_entries` rows would remain `sub_strand_id = NULL` — no backfill, matching every prior `sub_strand_id` migration in this codebase (`assignments`, `learner_evidence`, `blueprint_action_items`, `scheme_lessons`, `lesson_plans`).

## 24. Backfill policy

**NO GUESSING**, confirmed. No `ILIKE`, no text-equality join, no AI inference — consistent with every prior phase's rule.

## 25. Future implementation scope

Once §21 is answered: a scoped phase mirroring H5A-3's pattern exactly — one migration (`row_entries.sub_strand_id`), threading the id through `seedRecordOfWorkEntries()`'s existing upsert (Option A) or the teacher-edit PATCH route with a converge-guard (teacher-owned variant), a handful of DEEP_PR tests proving exactness/collision-resistance/null-safety identical in shape to `lib/lessonPlan/lessonPlansSubStrandId.integration.test.ts`, and — if "teacher-confirmed actual" is chosen — a separate, explicitly out-of-scope-here follow-up to design the curriculum-picker UI teachers would use to make that confirmation.

## 26. Cross-curriculum impact

Not designed here, per the freeze — but worth naming why this matters later: Record of Work is the artifact closest to "ground truth of delivery," the kind of record a future cross-curriculum equivalence system would most want to anchor to. Leaving it text-only, or attaching an ambiguous `sub_strand_id` to it before resolving what that id actually asserts, would propagate exactly the kind of unreliable identity H5A-0 found across the rest of the platform into the one place future work would most want to trust.

## 27. Production impact

NONE.

## 28. Database impact

NONE.

## 29. Files changed

`docs/architecture/record-of-work-provenance-decision.md` (this file, new). No other files.
