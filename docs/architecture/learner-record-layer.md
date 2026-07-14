# The Learner Record Layer

Status: DRAFT — architecture confirmation and gap-closing design only. No
schema or code changes are authorized by this document. Same pilot-first
constraint as [Academic Evidence Layer](academic-evidence-layer.md): build
after the pilot observation window, not before.

**Superseded on open items by [Learner Record Layer — Final Architecture
Decisions](learner-record-layer-decisions.md)**, after
[the review](learner-record-layer-review.md) found real gaps in the
design below (§3's enum choice, §4's remark-storage shape, and the
Core-identity/read-guardrail/Reasoning-layer questions this document
didn't address at all). Read the Decisions document for the settled
version of §3 and §4 specifically — the rest of this document (§1, §2,
§5, §6, §7) stands as written.

**Corrects a material error in that document.** Section 1.5 of
`academic-evidence-layer.md` claimed "no evidence/timeline table exists
anywhere in the schema" and treated every evidence source as a from-scratch
gap. That was wrong — it was checked against a narrow, hand-picked table
list that never included the word "evidence." Re-checked properly this
pass: **the Evidence Domain Model described in
[evidence-domain-model.md](evidence-domain-model.md) is not a draft
concept. It is live production code**, with real data. This document
supersedes §1.5, §4, and §5 of the prior document; §2 (class archival/
promotion), §3 (teacher attribution), §7 (assessment types), and §8 (one
analytics engine) still stand as written there and are not repeated here.

---

## 1. What Is Actually Live (Traced This Pass, Not Assumed)

| Piece | Reality |
|---|---|
| `learner_evidence` | **407 rows.** Full schema: lifecycle_state, trust_tier, evidence_confidence, verification_state, supersedes/superseded_by, strand/sub_strand/knowledge_node_id — every field the Evidence Domain Model (§1–§8 of that document) specifies. |
| `evidence_audit_log` | **814 rows.** Every lifecycle transition (`created`, `auto_confirmed`, `routed_to_review`, `reviewed_confirmed`, `reviewed_rejected`, `superseded`, `retracted`, `verification_updated`) permanently recorded — exactly the audit trail §9 of the domain model calls for. |
| `evidence_projection_events` | **407 rows**, 1:1 with `learner_evidence`. A real outbox: `lib/projection/eventConsumer.ts` drains it, `app/api/cron/projection-events/process/route.ts` runs the drain on a schedule. |
| `lib/intelligence/pipeline.ts`, `evidenceLifecycle.ts`, `evidence.ts` | The full ingestion → confidence → lifecycle → supersession → contradiction-flagging → projection-event pipeline the domain model specifies, implemented and wired, not sketched. |
| `lib/projection/recompute.ts:54` | `repos.evidence.findConfirmedEvidenceForLearner(learnerId)` — **the Projection Engine (which feeds Blueprint, Career Intelligence, Parent Pulse per `migration-ledger.md`) already reads Evidence directly, never assessment-type names.** This is exactly what this sprint's "Assessment Philosophy" section demands. It is not a gap. It is done. |
| **Nine live evidence-writer modules**, each a thin adapter into `learner_evidence`: | |
| — `lib/assessments/evidence.ts` | gradebook marks (`learner_marks`) → `teacher_upload` |
| — `lib/assessments/topicalEvidence.ts` | topical checks → `teacher_upload` |
| — `lib/assessments/reportCardEvidence.ts` | report card evidence → `teacher_upload` |
| — `lib/remedial/interventionEvidence.ts` | **interventions** → `classroom_observation` |
| — `lib/parentPulse/observationEvidence.ts` | **parent observations** → `parent_observation` |
| — `lib/assignments/evidence.ts` | assignments → `teacher_upload` |
| — `lib/holiday/return.ts` | **holiday plan returns** → `holiday_return` |
| — `lib/formativeSignals/evidence.ts` | formative signals → `classroom_observation` |
| — `lib/compass/evidence.ts` | **Compass sessions** → `compass_session` |

**The corrected picture**: of this sprint's evidence-source list
(assessment history, teacher remarks, interventions, holiday plans,
Compass sessions, parent meetings, attendance, behaviour, projects,
practicals, competitions, achievements, future LMS imports), **five are
already live in production** (assessments, interventions, holiday plans,
Compass sessions, parent observations — arguably "parent meetings," see
§4). The genuinely remaining gaps are narrower than either sprint brief
assumed: **teacher remarks, attendance, behaviour, projects/practicals,
competitions/achievements** — and even the first of those reuses 100% of
existing infrastructure once added (§4).

---

## 2. The Center Of Gravity — Already Correctly Placed

The brief's core philosophy ("everything permanently belongs to the
learner... teachers, classes, streams, grades, academic years provide
context, never own history") is not a target state to build toward. It
is **the literal shape of `learner_evidence` today**: `learner_id` is the
only required identity column; `assessment_type`/`term`/`academic_year`
are context; every writer stores `teacher_id`/actor as metadata inside
the evidence row, never as a gating key on any read path (confirmed
across all nine writers — none of them, nor `recompute.ts`, filter by
`teacher_id`). Rule 3 from the prior sprint's brief and this sprint's
"Teacher Identity" section describe an invariant that is **already true
in the schema's foreign-key structure**, not merely in application logic.

This means the honest answer to "is the learner already the permanent
center of this system" is **yes, structurally, for everything that
writes through the Evidence Domain** — the gap is not architectural, it's
that five candidate sources (remarks, attendance, behaviour, projects,
competitions) don't write through it yet, and one real design question
(assessment purpose, §3) hasn't been closed.

---

## 3. The One Real "Assessment Philosophy" Gap — Purpose vs. Name

`learner_evidence.assessment_type` is DB-CHECK-constrained to exactly
three values: `term_exam | cat | assignment`. This is **narrower** than
`class_assessments.assessment_type`'s six values (`exam | cat | midterm |
endterm | opener | assignment` — see `academic-evidence-layer.md` §1.1),
and both are narrower than what Rule 5 of the prior sprint asks for
(school-configurable names like "Baseline," "Weekly Test," "Opening CAT").

This is the one place the brief's "Diagnostic / Baseline / Opening CAT
should all map to the same educational purpose" requirement is genuinely
unmet — **not because there's no taxonomy, but because there are now two
different narrow taxonomies** (`class_assessments`'s 6-value CHECK for
display, `learner_evidence`'s 3-value CHECK for intelligence), and
neither is the "educational purpose" concept the brief describes. A
school-configured name like "Opening CAT" has nowhere principled to map
to today; whoever writes the CSV-import or gradebook-to-evidence bridge
just picks the nearest of three values by hand.

**Proposed fix (illustrative — not applied):** a fourth, canonical,
platform-owned axis, independent of both existing enums:

```sql
-- Canonical, small, platform-owned — NOT school-configurable (that's assessment_types.name, per academic-evidence-layer.md §7)
CREATE TYPE assessment_purpose AS ENUM (
  'diagnostic',    -- baseline / placement / opening assessment
  'formative',     -- CATs, topical checks, in-progress checks
  'summative',     -- midterm/endterm/final exams
  'practice',       -- assignments, homework
  'practical'       -- projects, practicals, performance-based
);

-- assessment_types (from academic-evidence-layer.md §7): add the mapping
ALTER TABLE assessment_types ADD COLUMN purpose assessment_purpose NOT NULL DEFAULT 'formative';

-- learner_evidence: widen the CHECK from 3 hardcoded values to reference purpose instead
ALTER TABLE learner_evidence
  ADD COLUMN assessment_purpose assessment_purpose;
  -- assessment_type (text) column kept for backward compatibility during rollout, same pattern as academic-evidence-layer.md §7
```

Every school names their assessment types freely (`assessment_types.name`,
already designed); every one of those names maps to exactly one of five
canonical purposes at configuration time (a one-time dropdown choice when
a school defines "Opening CAT," not a per-assessment decision). The
Evidence Domain, `recompute.ts`, and every intelligence consumer read
`assessment_purpose`, never the name — closing the gap precisely, without
touching the nine writer modules' actual insert logic (they already pass
through whatever `assessmentType` the caller gives them; only the value's
provenance changes, from "hand-picked nearest of 3" to "resolved from the
school's `assessment_types.purpose`").

**Why this is a small change and not a new engine:** this is one enum,
one column, and one resolution step at the point evidence is created — it
does not touch the lifecycle, supersession, confidence, or audit
machinery, all of which are already purpose-agnostic (they operate on
`claimKey()` = learner+subject+assessmentType+year+term, which works
identically whether `assessmentType` is a hand-picked guess or a resolved
purpose).

---

## 4. Teacher Remarks — Corrected Design

`academic-evidence-layer.md` §4 proposed a **new, standalone**
`teacher_remarks` table. That was the direct consequence of the missed
Evidence Domain finding (§0 above) — with the real infrastructure now
visible, a standalone table would be a second, parallel evidence store,
which is exactly the anti-pattern `migration-ledger.md` and
`intelligence-ingestion-engine.md` §3 both spent real effort warning
against ("there must never be multiple disconnected assessment stores").

**Corrected design:** add `teacher_remark` as a tenth `EvidenceSource`
value and a tenth thin writer module, following the exact pattern the
other nine already establish:

```ts
// lib/intelligence/evidence.ts — add one value
export type EvidenceSource =
  | 'csv_export' | 'excel_import' | 'report_card_photo' | 'report_card_pdf'
  | 'sms_api' | 'lms_api' | 'teacher_upload' | 'parent_observation'
  | 'compass_session' | 'classroom_observation' | 'national_dataset'
  | 'holiday_return'
  | 'teacher_remark'   // NEW

export const EVIDENCE_SOURCE_TRUST_TIER = {
  // ...existing eight entries unchanged...
  teacher_remark: 3,   // same tier as teacher_upload — a teacher directly attests to this
}
```

```ts
// lib/remarks/evidence.ts — new, ~40 LOC, same shape as the other nine
const SOURCE = 'teacher_remark' as const
export async function recordRemarkEvidence(input: {
  studentId: string; teacherId: string; body: string; subject: string | null;
  term: number | null; academicYear: number;
}): Promise<void> { /* builds one LearnerEvidence, calls persistEvidenceBatch — identical pattern to holiday/return.ts */ }
```

**The one real design decision, not a schema decision:** `learner_evidence`'s
default supersession rule (`claimKey()` in `evidenceLifecycle.ts:57` —
learner+subject+assessmentType+year+term) would make a second remark in
the same term **silently supersede** the first, which is exactly wrong
for remarks (§4 of `academic-evidence-layer.md` already identified why —
"quiet learner" in 2026 and "confidence improving" in 2027 are both true).
**Fix: remarks must never share a claim key with another remark.** Since
`claimKey()` already treats `score`/`cbcLevel` as irrelevant to the key
(only learner/subject/assessmentType/year/term matter), the cleanest fix
is giving each remark evidence row a synthetic, always-unique `subject`
value (e.g. `` `remark:${crypto.randomUUID()}` ``) or, more honestly,
adding one narrow carve-out to `claimKey()`: `if (e.evidenceSource ===
'teacher_remark') return null` — the same `null` path `unkeyed` evidence
already takes in `persistEvidenceBatch` (line 121), which explicitly skips
supersession entirely. **This is a two-line change to existing code**,
not new machinery — `evidenceLifecycle.ts` already has the exact branch
this needs.

**Net effect:** Rule 4 (permanent, append-only remarks) is achieved with
one enum value, one new ~40-line writer file, and a two-line guard in
code that already exists — not a new table, not new lifecycle logic, not
a new audit mechanism. Every remark gets the full existing audit trail,
retraction path (§4 of `academic-evidence-layer.md`'s "correction
mechanism" concern is already solved — `retractEvidence()` exists today),
and shows up in `getEvidenceHistoryForLearner()` (§6) automatically.

---

## 5. The Remaining Genuine Gaps — Attendance, Behaviour, Projects, Competitions

Same recommendation as `academic-evidence-layer.md` §5, now on firmer
ground: **don't build these speculatively.** The pattern for adding one
(§4 above) is now proven nine times over in production and costs roughly
one enum value + one ~40-line file each. That cost is low enough that
"wait until a real school asks" is not a hedge against expensive rework —
it's the honest read of YAGNI when the marginal cost of saying yes later
is this small. Projects/practicals/competitions/achievements likely all
map to `evidenceSource: 'teacher_upload'` (a teacher directly attests to
them) with `assessment_purpose: 'practical'` (§3) doing the differentiation
— possibly zero new enum values needed, only a new writer file, when one
of these is actually requested.

Attendance and behaviour are the two that don't obviously fit the existing
`LearnerEvidence` shape (`subject`/`score`/`cbcLevel` don't mean anything
for "was present" or "disrupted class") — if either becomes a real need,
that's the moment to decide whether they're a variant evidence shape or a
genuinely separate domain, not now.

---

## 6. The Canonical Learner Record — Already Exists, Needs A Name

`lib/intelligence/evidenceLifecycle.ts:246` — `getEvidenceHistoryForLearner(learnerId)`
— already returns the full confirmed-and-superseded-and-retracted evidence
history for one learner, across every source, every subject, every year.
This **is** the longitudinal timeline `academic-evidence-layer.md` §6
proposed building. It is not built — it exists.

**What's actually missing is not code, it's discoverability and scope.**
Two gaps, both small:

1. **Not learner-record-complete yet** — it returns Evidence rows only.
   Once `student_promotions` (§2 of `academic-evidence-layer.md`, still
   a real gap, unchanged by this document) exists, the true "one
   continuous story, admission to graduation" (this sprint's timeline
   diagram) is `getEvidenceHistoryForLearner()`'s rows merged with
   promotion events, sorted by date — a thin merge function, not new
   storage, exactly as §6 of the prior document already scoped it.
2. **No one calls it as "the" learner record.** Grepped: only used
   internally by the evidence module itself (lookups, likely an admin/
   review surface). Blueprint, Parent Pulse, and Career Intelligence
   read Evidence *indirectly*, through `recompute.ts`'s aggregate
   Projection — correct for their purpose (they need current-state
   intelligence, not a raw timeline), but it means **no product surface
   today shows a human the raw, chronological "what do we know about
   this learner" view** the brief's diagram describes. That's a UI gap,
   not an architecture gap — the function that would power it already
   exists and is already correct.

**Recommendation, not a schema change:** name
`getEvidenceHistoryForLearner()` (once merged with promotions, per point 1)
as *the* Learner Record API in documentation — the one function a new
engineer is pointed to first, the same way `README.md`'s "Where to Start"
section orders the ten core docs. This is the cheapest, lowest-risk fix
available for this document's own Question 3 (§8).

---

## 7. Revised Roadmap

Replaces `academic-evidence-layer.md` §9's Phase C only (teacher remarks
— now far smaller); adds Phase G (purpose taxonomy). Phases A, B, D, E, F
from that document are unchanged and not repeated here.

| Phase | Delivers | Depends on | Rough scope (revised) |
|---|---|---|---|
| **C (revised)** | `teacher_remark` EvidenceSource + `lib/remarks/evidence.ts` + claim-key carve-out (§4) | Nothing | ~60 LOC total (was ~200 LOC for a standalone table) |
| **G (new)** | `assessment_purpose` enum + `assessment_types.purpose` column + resolution step in evidence writers (§3) | Phase B (`assessment_types`, from `academic-evidence-layer.md` §7) | ~1 migration, ~80 LOC |
| **E (revised)** | Learner Record = `getEvidenceHistoryForLearner()` merged with `student_promotions`, documented as the canonical API (§6) | Phase A (promotions) | ~80 LOC (was ~150 LOC for a from-scratch timeline) |

**Net correction to the prior roadmap's total scope: smaller, not
larger** — the missed discovery in §0 means real infrastructure absorbs
most of what looked like new work.

---

## 8. The Three Strategic Questions

**Will this architecture still feel elegant at 500 schools, not 1?**
Mostly yes, for the reason that matters most: the Evidence Domain's
design (immutable records, claim-key supersession, trust tiers separate
from confidence, an append-only audit log, an outbox-pattern projection
queue) is exactly the shape that scales to many schools without
redesign — none of those mechanisms are per-school or per-teacher scoped
in a way that breaks at scale. **One real elegance risk, worth flagging
honestly**: nine near-identical ~40–130-line writer files
(`lib/assessments/evidence.ts`, `lib/holiday/return.ts`, etc.), each
hand-writing the same "build one `LearnerEvidence`, call
`persistEvidenceBatch`" shape. At 9 sources this is fine. Adding a tenth
(§4) and an eleventh/twelfth (§5) on the same copy-paste pattern is still
fine. Somewhere past ~15–20 sources, this stops being "consistent" and
starts being "the same bug fixed nine different times" if the pattern
ever needs to change. Not worth collapsing into one generic
`recordEvidence()` helper now (premature, per this sprint's own
"avoid speculative complexity" instruction) — worth a one-line note in
`intelligence-ingestion-engine.md` as a named future refactor trigger,
not a current gap.

**Does every decision help schools discover learning problems earlier?**
The purpose taxonomy (§3) directly does — it's what makes a cross-school
"formative assessment trend" signal computable even when School A calls
it "CAT" and School B calls it "Weekly Test." Teacher remarks (§4)
directly do — qualitative signal ("confidence improving") that no score
alone captures, feeding the same Evidence pipeline the quantitative
signals already feed. Attendance/behaviour/competitions being deferred
(§5) is an honest "not yet" — there is no evidence anywhere in this
codebase that any current consumer needs them, and building them
speculatively wouldn't surface problems earlier, it would just be
unused code. Declining to build is itself the answer that best serves
this question right now.

**Would a new team immediately see the learner as the center?**
**Partially — and this is the one honest "not fully yet."** The schema
and the Evidence Domain's foreign-key structure genuinely centers the
learner (§2). But a new engineer exploring the *codebase* would find
Evidence scattered across `lib/assessments/`, `lib/remedial/`,
`lib/parentPulse/`, `lib/holiday/`, `lib/compass/`, `lib/assignments/`,
`lib/formativeSignals/` — organized by *feature*, not by *learner
record*. Nothing currently signals "these nine files are all one thing."
The fix is cheap and doc-only, not a code reorganization: a short index
(this document, plus the §6 recommendation to name
`getEvidenceHistoryForLearner()` as *the* canonical entry point) is
enough to make the existing, already-correct architecture legible. Per
this sprint's own closing instruction — this is a "redesign before
writing code" case only in the narrowest sense: the redesign needed is
documentation and naming, not schema or data flow, because the data flow
already puts the learner at the center. **No code changes follow from
this finding; a documentation-only fix is recommended for Phase E.**
