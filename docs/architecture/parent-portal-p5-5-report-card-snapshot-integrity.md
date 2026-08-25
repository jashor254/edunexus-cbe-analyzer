# Parent Portal Phase P5.5 — Report Card Subject Snapshot Integrity

**Scope lock:** branch `main`, started at HEAD `fc62e3c` (P5's own closeout
commit), ~205 pre-existing dirty working-tree files confirmed via
`git status --short` before any work and left completely untouched. Builds
on `docs/architecture/parent-portal-p5-academic-result-authority.md` (P5,
§4/§14A — the finding this phase fixes), `docs/architecture/
parent-portal-p3-5-http-regression-harness.md` (P3.5, the HTTP harness used
throughout), and the earlier P0-P4.5 series.

---

## 1. Verdict

**P5.5 COMPLETE WITH NAMED LIMITATIONS.**

The bug P5 found — a published Report Card's overall headline (score/level/
position) is frozen at publish, but its per-subject breakdown was read live
from `term_subject_summaries` and could silently drift after publish when a
teacher published a later assessment for the same term — is fixed. A new
`school_report_cards.subject_snapshot` column, populated once at the moment
of publish (same write as `is_published`/`published_at`), is now the read
path's source of truth for any published card that has one. Proven at three
layers: a repository/lib integration test (real Postgres, no HTTP server),
an HTTP test against a real `next dev` server via `npm run test:parent-http`,
and `next build`/`tsc`/ESLint/STANDARD-suite regression.

Named limitations, honestly: (1) report cards published **before** this
migration have no snapshot and genuinely cannot be retroactively repaired —
they keep falling back to the old live-join behavior, which is the same
drift risk P5 found, now scoped only to historical rows; (2) publish moved
from one atomic bulk `UPDATE` to a per-row loop (matching an existing
in-repo precedent, `updateClassPositions`), trading whole-class publish
atomicity for per-row atomicity — see §20; (3) this phase's own new test
fixtures cannot fully tear down (pre-existing `blueprint_snapshots`
immutability trigger blocks the cascade, same class of gap P3.5 already
named for `learner_evidence`) — a small number of synthetic rows were
cleaned up manually via a one-off local trigger toggle, not through the
test's own `after()` hook.

---

## 2. Pre-Fix Reproduction

Reproduced directly against real local Postgres (not just P5's static
reading), in `lib/core/reportCardSubjectSnapshot.integration.test.ts`
(pre-fix behavior verified by stashing the fix and re-running the identical
scenario before writing it):

1. Learner enrolled, `term_subject_summaries` seeded: Math `ME`/60,
   English `EE`/85.
2. `generateReportCards` → draft card. `getReportCard` correctly shows the
   live values (draft is supposed to be live).
3. `publishReportCards` → `is_published=true`.
4. A later "assessment publish" simulated by directly upserting
   `term_subject_summaries` (the exact operation `computeTermSummaries`'s
   own `upsertTermSubjectSummaries` performs, `lib/core/assessments.ts:282`)
   with new values: Math `BE`/20, English `AE`/40.
5. **Pre-fix**: re-reading the same published report card via
   `getReportCard` returned the NEW drifted values (Math `BE`, English
   `AE`) while `overall_score`/`overall_cbc_level` stayed frozen — exactly
   P5's finding, reproduced.
6. **Post-fix**: the same re-read returns the original frozen values (Math
   `ME`/60, English `EE`/85) — see §15.

---

## 3. Root Cause

`SchoolRepository.findReportCardWithSubjects` (`lib/repositories/
school.repository.ts`) always ran a live join onto `term_subject_summaries`
filtered only by `(learner_id, term_id)`, regardless of the report card's
own `is_published` state — there was no snapshot mechanism for the subject
breakdown at all, only for the overall fields (which are separate columns,
computed once at generation and never touched again by any write path).
`term_subject_summaries` itself is a single, shared, in-place-`UPSERT`ed row
per `(learner_id, term_id, subject_id)` (`UNIQUE` constraint, `supabase/
migrations/20260629_core_foundation.sql:650`) with no history and no FK back
to `school_report_cards` — any later `computeTermSummaries` run for that
term silently overwrote the exact row a published report card's read path
depended on.

---

## 4. Publish Flow Before

```
generateReportCards(actorUserId, schoolId, classId, termId, boundaries)
  → refuses if ANY card for class/term already published (existing guard)
  → aggregates term_subject_summaries into overall_score/overall_cbc_level
  → upserts school_report_cards rows, is_published=false

publishReportCards(actorUserId, schoolId, termId, classId?)
  → repos.schools.publishReportCards(schoolId, termId, classId)
      → ONE bulk UPDATE: is_published=true, published_at=now()
        WHERE school_id/term_id[/class_id] AND is_published=false
  → publishEvent('teacher.report_card.published') [fire-and-forget]
  → for each published card: createBlueprintSnapshot(...) [awaited,
    non-fatal] — a Blueprint Snapshot, NOT a Report Card subject snapshot;
    a different mechanism entirely (composed from Projection, not from
    term_subject_summaries — see §13)

getReportCard(learnerId, termId, schoolId?)
  → repos.schools.findReportCardWithSubjects(learnerId, termId)
      → SELECT school_report_cards (+ learners join)
      → SELECT term_subject_summaries (+ subjects join), LIVE, always
```

---

## 5. Overall Freeze Mechanism

Confirmed exactly as P5 described: `overall_score`/`overall_cbc_level`/
`position_in_class` are computed once inside `generateReportCards`
(`lib/core/report-cards.ts:117-164`) and stored via `upsertReportCards`.
Nothing in the codebase ever recomputes or rewrites these columns after
generation — `updateReportCard` only touches comments/attendance/pdf_url,
never the score/level/position columns. `generateReportCards` itself
refuses to run again once any card in the class/term is published
(`lib/core/report-cards.ts:49-66`), so there is no path back into these
columns post-publish either. This is a real, working "compute once and
never touch again" guard, applied at the generation boundary — extended by
this phase to a second, publish-time boundary for the subject breakdown
(§7), because the subject data's true "last legitimate mutation point"
is publish, not generation (a draft's subjects are meant to keep moving
until publish; the overall score is meant to stop moving at generation
because nothing recomputes it after that point anyway).

---

## 6. Subject Breakdown Before

Read live, unconditionally, via `findReportCardWithSubjects`'s second
`SELECT` (`term_subject_summaries` joined to `subjects`), filtered only by
`(learner_id, term_id)` — with zero reference to `is_published`. Confirmed
by direct reproduction (§2) and by reading every call site: nothing else in
`lib/core/report-cards.ts`, `lib/repositories/school.repository.ts`, or
`app/api/reports/report-card/**` ever conditioned this read on publication
state before this phase.

---

## 7. Fix Strategy

**Chosen: (A) persist a subject snapshot into the existing Report Card row**
(a new `subject_snapshot jsonb` column on `school_report_cards`), populated
once, at the moment of publish, from `term_subject_summaries`'s
then-current state for that learner/term — the exact "computed once,
stored, never recomputed on view" precedent §5 already established for the
overall fields, extended to the subject list.

Rejected alternatives, with reasoning:
- **(B) reuse an existing snapshot mechanism** — evaluated Blueprint
  Snapshots (`blueprint_snapshots`, created by the same `publishReportCards`
  call). Rejected: Blueprint Snapshots are composed from **Projection**
  (canonical Evidence-derived capability), not from `term_subject_summaries`
  (the Report Card's own Set-D-equivalent-threshold classification, per P5
  §10). They can legitimately disagree in both value and even which
  subjects appear — reusing one to answer the other's question would be
  exactly the "second, disagreeing authority" class of bug P5's whole audit
  was about, not a fix.
- **(C) change the read path to resolve an exact assessment version linked
  at publication time** — rejected: no assessment-version id exists
  anywhere in the schema (`class_assessments` has no version/revision
  column, and `term_subject_summaries` has no FK back to the assessment(s)
  that produced a given weighted_score). Building one would be new,
  broader versioning infrastructure — larger than this phase's narrow scope.
- **(D) a schema change** — this is effectively what (A) is; no schema
  question here required speculation, since term_subject_summaries's own
  columns (`weighted_score`, `cbc_level`, `position_in_class`,
  `teacher_comment`) plus the `subjects` join (`name`, `code`) are exactly
  what a snapshot needs to capture — nothing more, nothing invented.

---

## 8. Database Change Decision

**One narrow, additive migration was necessary — not avoidable.**

Exhausted before deciding: no existing snapshot table, publication-item
table, assessment-version id, JSON subject payload, or historical-result
relation already answers this. `term_subject_summaries` has no history
(single row per key, in-place `UPSERT`), `school_report_cards` had no JSON
column, and `blueprint_snapshots` answers a different question (§7).

**Migration:** `supabase/migrations/20260825090000_report_card_subject_snapshot.sql`
```sql
alter table public.school_report_cards
  add column if not exists subject_snapshot jsonb;
```
Nullable, no default, no backfill (§9), no other schema change. Applied to
local Docker Postgres directly (`supabase migration up --local` failed with
an unrelated `.env.local` parse error from the installed CLI version;
applied via `docker exec supabase_db_edunexus psql` instead, confirmed via
`\d school_report_cards`).

---

## 9. Historical Existing-Report Status

**Genuinely unrecoverable for cards published before this migration — not
fabricated.** `term_subject_summaries` has already been mutated in place,
repeatedly, with no history table, no audit log, and no version marker —
there is no data anywhere in the current schema from which a pre-P5.5
published card's true at-publish-time subject state could be reconstructed.
Confirmed by the "LEGACY FALLBACK" test (§21): a published card with
`subject_snapshot IS NULL` falls back to the old live join (the pre-existing
drift-risk behavior), not an error and not a fabricated value. This is named
honestly as a permanent limitation for any report card published before
this phase shipped, not silently accepted or hidden.

---

## 10. Draft Semantics

**Unchanged, confirmed by test** (`DRAFT` test, §21): a draft
(`is_published=false`) card always reads `term_subject_summaries` live,
exactly as before — `subject_snapshot` stays `null` until publish. This
matches P5's own confirmed product intent (Report Card's draft state is
meant to move as marks are entered) and P3's "fix-then-promote, not
promote-then-fix" framing — nothing about draft behavior needed to change.

---

## 11. Published Semantics

Once `is_published=true` **and** `subject_snapshot` is non-null (every
card published from this phase onward), the per-subject breakdown is read
exclusively from the snapshot — the live join is never executed for that
card. Proven end-to-end by the core acceptance fixture (§15) and the HTTP
proof (§17).

---

## 12. Republish/Correction Semantics

**No republish/unpublish/correction lifecycle exists in this codebase, and
this phase did not invent one.** Confirmed: `school_report_cards` has a
`UNIQUE (learner_id, term_id)` constraint, `generateReportCards` refuses to
regenerate once any card in the class/term is published
(`reportCardPublicationGuard.integration.test.ts`, unmodified — combined
count with sibling report-card suites in §23), and no code path anywhere
sets `is_published` back to `false` or clears `subject_snapshot`. The only real,
existing mechanism for "a new later report" is the next term's own report
card — proven by the "NEW-REPORT-AFTER FIXTURE" test (§16), which is
independently stable from the old term's card. Nothing in this phase
changed, blocked, or needed to accommodate a correction flow, because none
exists to test against.

---

## 13. CBC Boundary [confirmed unchanged]

No CBC threshold logic was touched. The snapshot freezes whatever
`cbc_level`/`weighted_score` `term_subject_summaries` already held at
publish time — computed upstream by `computeTermSummaries`'s own existing
`gradeScore()` call (Set-D-equivalent thresholds, per P5 §10), unchanged by
this phase. No new classification, no re-derivation, no touching any of the
6+ CBC threshold implementations P5's audit found.

---

## 14. Evidence Boundary [confirmed unchanged]

Zero new `learner_evidence` writes, zero `recomputeLearnerProjection`
calls, zero Academic Clinic reads/writes introduced. Confirmed by code
review of every line changed (`lib/repositories/school.repository.ts`,
`lib/core/report-cards.ts` untouched except call-site unchanged,
`types/core.ts`) — none imports `lib/intelligence/evidenceLifecycle.ts`,
`lib/projection/**`, or `lib/academicClinic/**`. `publishReportCards`'s
existing `createBlueprintSnapshot` call (a pre-existing side effect,
unrelated to this fix — see §7's rejection of reusing it) is unchanged in
behavior; this phase did not add, remove, or alter it.

---

## 15. Old-Report Fixture (Core Acceptance)

Executed in `lib/core/reportCardSubjectSnapshot.integration.test.ts`,
test `'CORE ACCEPTANCE FIXTURE: a later assessment mutating
term_subject_summaries does NOT change the already-published report card'`:

- Published: Math `ME`/60, English `EE`/85 (frozen in `subject_snapshot`).
- Later mutation (simulating a teacher assessment publish): Math → `BE`/20,
  English → `AE`/40, written directly into `term_subject_summaries`.
- Raw table check: `term_subject_summaries` itself DID change to `BE`/`AE`
  (asserted explicitly — this is correct, expected behavior for whatever
  else legitimately reads that table live).
- Re-read of the SAME published report card: **Math still `ME`/60, English
  still `EE`/85** — byte-for-byte unchanged. `overall_score`/
  `overall_cbc_level` also asserted unchanged (they always were, per §5).

**Result: PASS.**

---

## 16. New-Report-After Fixture

Executed in the same file, test `'NEW-REPORT-AFTER FIXTURE'`:

- A second term (Term 2) generated and published for the same learner with
  the newer values (Math `BE`/20, English `AE`/40).
- Term 2's card correctly shows `BE`/`AE`.
- Term 1's card, re-read afterward, is **unaffected** — still `ME`/`EE`.

No same-term republish path exists to test (§12) — a new term's card is the
real mechanism, and it is proven independently stable from the old one.

**Result: PASS.**

---

## 17. Parent HTTP Proof

`lib/testing/parentReportCardSnapshotIntegrity.http.integration.test.ts`,
run through the real `npm run test:parent-http` harness (real `next dev`
server, real signed-in parent session, real `GET /api/reports/report-card`):

- `GET /api/reports/report-card?learnerId=...&termId=...` returns the
  frozen `ME`/`EE` breakdown for the parent's published child.
- After the same live `term_subject_summaries` mutation as §15, the
  **identical HTTP request** still returns the frozen `ME` for Math, not
  the newly-drifted `BE` — proven through the real route, not just the
  repository function.

**Result: PASS (both tests).**

---

## 18. Multi-School Proof

Same HTTP file: the same parent has a second child at a **different**
school (School B), with a single-subject published card (Math `BE`).
`GET /api/reports/report-card` for Child B returns exactly that one
subject, scoped to School B, and never leaks School A's English row. Proven
as a real cross-school fixture, not reasoned from code.

**Result: PASS.**

---

## 19. IDOR Proof

Same file: an unrelated parent (no `learner_guardians` link to either
child) requesting either child's report card by `learnerId`/`termId`
receives `403`, never subject snapshot data — for both School A's and
School B's children. An unauthenticated request is `401`. This reuses the
existing, unmodified `requireParent`/SH-001 ownership checks (P5's own §24
confirmed these were already correct) — this phase did not touch
authorization logic at all, only what data is returned once authorization
passes.

**Result: PASS (3 tests: IDOR × 2, unauthenticated × 1).**

---

## 20. Atomicity

**Publish is atomic per row, no longer atomic across the whole class/term
in one statement — a deliberate, named tradeoff, not an oversight.**

Before this phase: `publishReportCards` was ONE bulk `UPDATE ... WHERE
school_id/term_id[/class_id] AND is_published=false`, a single SQL
statement — Postgres commits or rolls back the whole class/term as one
unit.

After this phase: publishing now requires a per-learner subject snapshot,
computed from a batched read (`term_subject_summaries` for all candidate
learner_ids in ONE query — never per-learner, per CLAUDE.md's "never query
inside a loop" for reads), then a per-row `UPDATE` (`is_published`,
`published_at`, AND `subject_snapshot` set together, in the SAME statement,
for that one row) — this ordering guarantees no card is ever observably
"published" with a null/stale snapshot, but a crash mid-loop can leave some
cards in a class published and others still draft, where before the whole
class would have succeeded or failed together.

This mirrors an existing precedent already in this codebase
(`updateClassPositions`'s own per-row loop, `lib/core/assessments.ts:308-317`)
rather than inventing a new pattern. No broader transaction/RPC
infrastructure was built, per the mission's explicit instruction not to
over-engineer — reported honestly as a limitation rather than silently
accepted or hidden behind new infrastructure.

---

## 21. Performance

**One fewer query on the published-read path.** Before: every
`findReportCardWithSubjects` call issued 2 queries unconditionally (the
report row, then always a `term_subject_summaries` join). After: a
published card with a snapshot issues exactly 1 query (the report row,
`subject_snapshot` already embedded) — the `term_subject_summaries` query
is skipped entirely for that path. A draft card, or a published card
without a snapshot (§9), is unchanged at 2 queries. This is a direct
structural consequence of the `if (published && snapshot) return early`
branch in `findReportCardWithSubjects` (`lib/repositories/
school.repository.ts`), not separately benchmarked beyond that code-level
guarantee.

Publish itself moved from 1 query (bulk update) to `2 + N` queries (1
candidate-select + 1 batched summaries-read + N per-row updates, N =
learners published in that call) — a real cost increase at publish time,
traded for the correctness fix and the read-time saving above. Publish is a
low-frequency, staff-only action (once per class per term); read is
high-frequency and parent-facing — this tradeoff was made deliberately in
that direction.

---

## 22. Architecture Guards

- **(A) published Report Card subject values never read from "latest
  assessment" state** — CONFIRMED, `findReportCardWithSubjects` returns
  early from the frozen `subject_snapshot` before the live join can run,
  whenever one exists.
- **(B) draft Report Card may remain live** — CONFIRMED, unchanged, §10.
- **(C) Report Card snapshot logic doesn't import/recompute Projection** —
  CONFIRMED, §14.
- **(D) it doesn't depend on Academic Clinic** — CONFIRMED, zero references
  anywhere in the changed files.
- **(E) new assessments cannot mutate previously-published formal subject
  values** — CONFIRMED, §15/§17 (both repository-level and HTTP-level).
- **(F) old and new published cards remain independently stable from each
  other** — CONFIRMED, §16.

---

## 23. Tests [exact counts/results]

- **New repository/lib integration suite**
  (`lib/core/reportCardSubjectSnapshot.integration.test.ts`): **5/5 pass**
  (DRAFT, PUBLISH, CORE ACCEPTANCE FIXTURE, NEW-REPORT-AFTER FIXTURE, LEGACY
  FALLBACK). A 6th `after()` teardown step (`deleteAuthUserOrThrow`) fails
  on a pre-existing `blueprint_snapshots` immutability-trigger gap (§1,
  §24) — the file's own real assertions are unaffected; node's test runner
  reports the file as failed due to the hook, not the assertions
  (`tests 6 / pass 5 / fail 1`, the 1 being the teardown hook).
- **New parent HTTP suite**
  (`lib/testing/parentReportCardSnapshotIntegrity.http.integration.test.ts`,
  added to `scripts/parent-http/parent-http-tests.json`): **6/6 pass**
  (frozen-read, core HTTP proof, multi-school, IDOR × 2, unauthenticated).
  Teardown hits the same pre-existing gap for its 2 school-admin auth users
  — cleaned up manually post-run (§1), not via the test's own hook.
- **`npm run test:parent-http`, full manifest (now 8 files)**:
  `tests 93 / pass 93 / fail 0` (87 baseline + 6 new — exact match to P5's
  own re-confirmed 87/87 baseline, plus this phase's 6).
- **`npm test` (STANDARD)**: `tests 1088 / pass 1088 / fail 0` (unchanged —
  this phase added nothing to the STANDARD manifest).
- **Existing Report Card suites, re-run unmodified, zero regression:**
  `reportCardWithSubjects.test.ts` 7/7,
  `reportCardPublicationGuard.integration.test.ts` +
  `generateReportCards.ranking.test.ts` +
  `reportCardsZeroMark.test.ts` +
  `attendanceReportCardIntegration.test.ts` +
  `reportCardOwnership.security.test.ts` combined: `26/26`.
- **Blueprint/Projection/Grading suites, re-run unmodified, zero
  regression:** `thresholdConflictInventory.architecture.test.ts` +
  `composeBlueprint.pure.test.ts` + `engine.test.ts` +
  `toCbcLevel.grading.regression.test.ts` +
  `gradingCrossPathParity.test.ts` combined: `46/46`.
- **End-of-term chain suites** (`endOfTermFullChain.test.ts`,
  `granularEndOfTermFlow.test.ts`, `schoolTermClosure.test.ts`): all real
  assertions pass (6/6 across the three files' own test bodies); each
  file's `after()` hook hits the same pre-existing teardown gap (§24),
  independently confirmed present on unmodified `main` (stashed this
  phase's changes and re-ran `schoolTermClosure.test.ts` — identical
  failure, proving it predates this phase).
- **`tsc --noEmit`:** clean, zero errors.
- **ESLint** on every file this phase touched (`types/core.ts`,
  `lib/repositories/school.repository.ts`, both new test files): clean,
  zero errors (one expected "no config for .json" warning on the manifest
  file, not an ESLint failure).
- **`next build`:** `✓ Compiled successfully`, full route manifest
  generated, exit code 0.

No assertion was loosened, skipped, or removed to force a pass anywhere in
this phase.

---

## 24. Files Changed

Modified (3):
- `lib/repositories/school.repository.ts` — `publishReportCards` now
  freezes a subject snapshot per row at publish; `findReportCardWithSubjects`
  prefers the frozen snapshot for a published card that has one;
  `REPORT_COLS` includes the new column.
- `types/core.ts` — new `ReportCardSubjectSnapshotEntry` type;
  `SchoolReportCard.subject_snapshot` field added.
- `scripts/parent-http/parent-http-tests.json` — adds the new HTTP test
  file to the manifest (1 line).

New (3):
- `supabase/migrations/20260825090000_report_card_subject_snapshot.sql` —
  the one narrow migration (§8).
- `lib/core/reportCardSubjectSnapshot.integration.test.ts` — 5 repository/lib
  integration tests.
- `lib/testing/parentReportCardSnapshotIntegrity.http.integration.test.ts` —
  6 HTTP integration tests.

**6 files changed total, 0 deletions of existing functionality.** No
pre-existing dirty file from the ~205-file working tree at session start
was touched, staged, or committed — `git status --short` before this
phase's commits: 205 files; after, adding exactly these 6: 211.

---

## 25. Database Changes

**One narrow, additive migration** — see §8. `alter table
school_report_cards add column subject_snapshot jsonb`, nullable, no
default, no backfill, no data migration. Applied to local Docker Postgres
for this phase's own testing; not yet applied to any hosted/production
Supabase project by this phase (out of this phase's own execution — the
migration file is committed and ready for the normal deploy path).

---

## 26. Named Limitations

**New, found this phase:**

- **Historical (pre-P5.5) published report cards cannot be repaired** —
  their subject breakdown keeps reading live (the old, drift-prone
  behavior) forever, because no data exists anywhere to reconstruct their
  true at-publish-time state. Named, not fabricated (§9).
- **Publish is no longer atomic across a whole class/term** — traded for
  per-row atomicity between `is_published` and `subject_snapshot` (§20). A
  crash mid-publish-loop can leave a class partially published, which could
  not happen before this phase (before: all-or-nothing bulk `UPDATE`).
  Judged acceptable given the mission's explicit instruction not to build
  broad transaction infrastructure for this; publish is a low-frequency,
  staff-initiated action with existing retry-ability (unpublished cards can
  simply be published again, since the guard is `is_published=false`).
- **`blueprint_snapshots`' immutability trigger blocks test teardown for
  ANY test that calls `publishReportCards`** (not something this phase
  introduced — confirmed present on unmodified `main`, §23) — this phase's
  own two new test files inherit it and needed manual, out-of-band cleanup
  once. This is the same class of gap P3.5 named for `learner_evidence`'s
  own immutability trigger (`docs/architecture/
  parent-portal-p3-5-http-regression-harness.md` §23); now confirmed to
  independently apply to `blueprint_snapshots` too. Not fixed here — out of
  this phase's narrow scope, and the mission's own Step 22 guidance was not
  to build broad infrastructure for a problem that isn't this phase's actual
  correctness target.

**Carried forward, unresolved (per P0-P5, unchanged by this phase):** 6+
independently-maintained CBC threshold implementations (P5 §10); no
cross-surface subject-vocabulary normalization (P5 §9); the formal Report
Card pipeline still emits zero Evidence directly (only the separate legacy
`assessments` pipeline does, P5 §12) — a school using only the formal Core
Report Card pipeline still produces Report Cards that never move Blueprint's
Projection; Academic Clinic's clinical-register language still reads more
definitive than its actual data authority (P5 §17/§18); Academic Clinic's
Core-only-parent nav gap and the orphaned `/academic-clinic` duplicate (P0,
re-confirmed unfixed through P5).

---

## 27. Recommended P6

**PARENT COMMUNICATION LOOP.**

Reasoning: this phase closed the one concrete, evidence-backed correctness
bug P5's audit surfaced (§14A) — the narrowest, most clearly-scoped
candidate available, and it is now done. Of the two mission-offered
directions for what comes next: PARENT CAREER/CLINIC SURFACE CONVERGENCE
would immediately run into the CBC-threshold and subject-vocabulary
questions P5 explicitly found unratified and declined to resolve (still
true, per §26) — pursuing it now would either force a quiet
threshold/vocabulary decision (out of scope for a narrow-fix phase, same
reasoning P5 itself used) or produce another audit-only phase without new
code. PARENT COMMUNICATION LOOP has no such blocking prerequisite — it is a
genuinely new capability gap (no parent→teacher communication exists at
all, named as unresolved since P0, re-confirmed unresolved through P5) that
can be built without first resolving an unrelated, harder cross-surface
authority question. It is also independent of this phase's own remaining
limitation (§26's atomicity/historical-drift notes concern Report Card
specifically, not communication).
