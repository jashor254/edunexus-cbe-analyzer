# The Intelligence Ingestion Engine

Status: DRAFT — mission and architecture defined, not yet built. This
document reconciles the vision with what the repository audit
(`docs/architecture/data-migration-strategy.md` and this session's
research) actually found, so the design doesn't repeat mistakes already
discovered in the existing system.

## Mission (restated, unchanged from the brief)

The Intelligence Ingestion Engine is the front door through which every
piece of learner evidence enters EduNexus. It does not store files — it
understands educational evidence. Every source (photo, PDF, CSV, Excel,
SMS export, Compass session, teacher observation, national dataset,
future curriculum provider) ultimately produces the same standardized
evidence model, which feeds one Learner Intelligence Engine, which alone
powers Blueprint, Compass, Career Intelligence, dashboards, analytics,
and developer APIs.

This document does not weaken that mission. It grounds it.

---

## 1. What Already Exists vs. What's Genuinely New

The pipeline in the brief has ten conceptual stages. Mapped against this
session's audit, each stage is at a different starting point — treating
them as uniformly greenfield would misprice the work badly.

| Stage | Current state | Evidence |
|---|---|---|
| Source intake | 3 independent, fragile CSV parsers exist. PDF/photo/Excel: **zero capability, zero dependency.** | `docs/architecture` audit — no `tesseract`/`pdf-parse`/`xlsx` anywhere; only `@react-pdf/renderer` (output-only) |
| Document recognition | **Does not exist.** No code distinguishes input types today — each of the 3 CSV features assumes its own fixed format. | Confirmed via repo-wide search |
| Data extraction | CSV: exists but hand-rolled (`.split(',')`, no quote/escape handling). PDF/photo/Excel: **entirely absent.** | `app/api/teacher/assessments/[assessmentId]/upload/route.ts:12-19` |
| Field validation | Partial — real in one of three CSV features (per-cell numeric/range checks), weak-to-absent in the other two. | Confirmed |
| Subject mapping | Utilities exist (`lib/pathwayCalculator.ts`, `capabilityExtractor.ts:normalizeCBC`) but **none are wired to any import path.** | Confirmed |
| Curriculum mapping | Partial — regional adapters exist (`lib/curriculum/regional/ke-cbc.ts`, `tz-necta.ts`, `ug-ncdc.ts`), each with a working `normalizeToCBCLevel`. Reusable, not wired to import. | Confirmed |
| Learner identification | Weak — three different ad hoc matching strategies (admission-number+teacher, case-insensitive name, form entry), **no shared or robust routine, no dedup logic anywhere.** | Confirmed across all 3 CSV features |
| Evidence normalization | **Does not exist as a concept.** Raw scores go straight into destination tables today with no intermediate evidence representation. | This is the core new abstraction this engine introduces |
| Confidence scoring | **Does not exist anywhere in the codebase.** | Confirmed |
| Human review | **Does not exist anywhere.** Every current import path writes immediately; there is no staging or review-before-commit step. | Confirmed |
| Evidence store | **Does not exist.** See §3 — this is the central open decision. | — |
| Learner Intelligence Engine | **Already exists and is real** — `lib/learnerModel` (`updateFromAssessment`, `updateFromCompass`, `recomputeRiskFlags`, etc.), traced fully this session. | `lib/learnerModel/updater.ts` |
| Blueprint / Career Intelligence | **Already exist**, consume the Learner Model correctly. | `lib/learnerIntelligence/blueprint.ts`, `lib/career/clinicReportBuilder.ts` |
| Compass | **Already exists**, but generates its own evidence live in-app — see §4. | Traced fully this session |
| Teacher/Parent dashboards | Partially exist for existing data; not evidence-aware yet. | — |
| Developer APIs | Exist, but for a **different purpose** (outbound webhook delivery to third-party subscribers of EduNexus's own features) — not evidence ingestion. Would need new work. | Prior devportal audit this session |

**The honest summary**: the *destination* half of this pipeline (Learner
Intelligence Engine → Blueprint/Compass/Career Intelligence) is real,
proven, and doesn't need to be rebuilt. The *source* half (recognition →
extraction → normalization → confidence → review → evidence store) is
almost entirely new — CSV extraction is the only stage with any prior
art, and even that needs replacing, not extending (see Part 3 of the
prior audit: three unescaped hand-rolled parsers, no shared library).

---

## 2. The Evidence Model

Concretely, per the brief's example, every piece of ingested information
becomes a record shaped like:

```ts
type LearnerEvidence = {
  id: string                      // stable, permanent — everything downstream cites this ID, never the raw input
  learnerId: string                // resolved identity — see §5
  institutionId: string | null     // resolved school reference where known; null is a valid, honest state
  subject: string                  // canonical, post-mapping
  score: number | null
  cbcLevel: 1 | 2 | 3 | 4 | null
  assessmentType:
    | 'term_exam' | 'cat' | 'topical_check' | 'compass_session'
    | 'teacher_observation' | 'parent_observation' | 'classroom_observation'
    | 'national_assessment' | 'assignment'
  academicYear: number
  term: number | null
  evidenceSource:
    | 'report_card_photo' | 'report_card_pdf' | 'csv_export' | 'excel_import'
    | 'sms_api' | 'lms_api' | 'teacher_upload' | 'parent_observation'
    | 'compass_session' | 'classroom_observation' | 'national_dataset'
  evidenceConfidence: number        // 0-100
  rawInputRef: string | null        // pointer to the original artifact for audit/traceability, never re-parsed after ingestion
  importedAt: string
  reviewStatus: 'auto_confirmed' | 'pending_review' | 'reviewed_confirmed' | 'reviewed_rejected'
  reviewedBy: string | null
  reviewedAt: string | null
}
```

This is the one new abstraction the current system genuinely lacks.
Nothing in the codebase today represents "a piece of evidence" — it
represents "a row in `assessments`" or "a row in `learner_marks`,"
tightly coupled to its storage table. The Evidence model exists
specifically to decouple "what was learned about a learner" from "which
table it currently lives in," which is what makes the traceability
mandate (§6) achievable at all.

---

## 3. The Central Open Decision: What "Single Source of Truth" Actually Means Here

The brief mandates: *"There must never be multiple disconnected
assessment stores producing conflicting learner conclusions."*

**This is already violated today, before any new work begins.** This
session's audit found four effectively disconnected destinations:
`assessments` (parent-form-fed, the only one Blueprint/Clinic Report
read), `learner_marks`/`class_assessments` (teacher-fed, gradebook-only,
feeds the Learner Model's `knowledge_state` but not Blueprint),
`assignment_submissions` (a fourth destination, entirely disconnected
from the Learner Model), and Core's non-existent assessment pipeline
(`class_assessments.class_id` FKs to legacy `teacher_classes`, so Core
has no working store at all).

There are two honest ways to build the Evidence Store, with very
different cost and risk:

**(A) Evidence Store replaces the existing tables.** A real migration:
`assessments`, `learner_marks`, `assignment_submissions` get consolidated
into or replaced by the new store, every read path in Blueprint/Clinic
Report/Learner Model gets rewired to read evidence instead. This is the
architecturally complete answer to the brief's mandate — and it's a
large, live-production-touching migration, comparable in scope to what
`docs/architecture/learning-intelligence-migration-strategy.md` already
scoped for the Core migration (thousands of LOC, multiple schema
changes, regression risk against real user data).

**(B) Evidence Store is a new upstream staging layer.** Every source
(CSV, future OCR, future APIs) flows through recognition → extraction →
validation → mapping → identification → normalization → confidence
scoring → review, producing `LearnerEvidence` records. Once an evidence
record is confirmed (auto or human-reviewed), the engine writes it
through to the **existing** `assessments` table — the one table already
proven to feed the Learner Model correctly. `learner_marks` and
`assignment_submissions` are left alone for now, out of scope, not
touched.

**(B) does not fully satisfy the brief's "never multiple disconnected
stores" mandate on day one** — those other two tables keep existing,
disconnected, exactly as they are today. What it does is stop the
problem from getting worse: every *new* piece of ingested evidence goes
through one pipeline and lands in one place, and the consolidation of
the pre-existing tables becomes a separate, explicitly scoped Phase 2
migration (informed by real evidence-store usage, not designed blind).

This mirrors the same pattern already used for the Core migration
(`learning-intelligence-migration-strategy.md`, Phase 0 vs. later
phases) and the legacy-first pilot decision
(`data-migration-strategy.md` §4) — smallest correct slice first, full
consolidation once the shape is proven.

**Recommendation: (B).** Not a decision — a recommendation, per the
established pattern of not deciding architecture unilaterally in this
project. This is the single most consequential open question in this
document; everything else can proceed either way, but the Evidence
Store's write target needs to be settled before implementation starts.

---

## 4. Compass and Observations Are a Different Kind of Input

The brief lists "Learning Compass sessions," "parent observations," and
"classroom observations" alongside report card photos and CSV exports as
input sources. Structurally, they're not the same kind of thing:

- Report cards, CSVs, Excel sheets, SMS/LMS APIs, national datasets are
  **external data being transformed into evidence** — the engine's job
  is to understand something that already existed elsewhere.
- Compass sessions are **generated live, inside EduNexus**, already
  structured, already flowing directly into the Learner Model
  (`updateFromCompass`, traced fully this session) — there's no
  recognition/extraction/OCR step needed because nothing needs
  recognizing; the data was never unstructured.

**Open question, not decided here**: should Compass/observation data get
*re-modeled* as `LearnerEvidence` records too — for consistency, and so
Blueprint's traceability claims (§6) can cite a Compass session the same
way they'd cite an imported report card — or should they keep their
current direct-to-Learner-Model path, with the Evidence Store reserved
for genuinely external sources? Both are defensible; this document
doesn't pick one.

---

## 5. Learner Identification and Duplicate Detection

The brief requires trusted evidence. Trust starts with knowing which
learner a piece of evidence belongs to — and this is currently the
weakest link found in the whole audit: three different ad hoc matching
strategies, no shared routine, no duplicate detection anywhere.

The Evidence Store needs **one** identity-resolution routine, used by
every source: given a name, admission number (if present), school
context, and grade, resolve to a learner ID with a confidence score of
its own — high confidence on an exact admission-number match, lower on
fuzzy name matching, flagged for human review below a threshold. This
routine doesn't exist today and needs to be built once, shared, rather
than each new source inventing its own matching logic (the mistake the
three existing CSV features already made independently).

---

## 6. Evidence Traceability — What It Actually Requires

The brief's example — Blueprint's "Language proficiency is slowing
pathway readiness" statement should trace back to imported evidence — is
not automatically satisfied by having an Evidence Store. Today,
`learner_profiles.formative_signals`/`growth_milestones` store derived
snapshots (already-computed summaries), not references back to a source
row. Making a Blueprint statement traceable means the Learner Model's
write path needs to carry an `evidenceId` (or a list of them) alongside
every `knowledge_state`/`capability_dimensions` update it makes, so a
later "why does it say this" query can walk back from the statement to
the evidence records that produced it. This is new work inside
`lib/learnerModel/updater.ts`, not something the Evidence Store provides
by existing.

---

## 7. Phasing — Smallest Correct Slice First

Given OCR/PDF/Excel are entirely greenfield (§1) while CSV has partial,
if fragile, prior art, and given this project's established pattern of
proving a pipeline shape on the cheapest source before expanding:

**Phase 1**: Build the `LearnerEvidence` model, the identity-resolution
routine (§5), and **one** real ingestion path — a single, shared,
library-backed CSV parser replacing the three fragile ones — running the
full recognition→...→review pipeline, writing confirmed evidence through
to `assessments` (decision (B), §3). This proves the entire pipeline
shape end-to-end on the source that's cheapest to get right.

**Phase 2**: Human review UI for low-confidence evidence — currently
absent everywhere, needed before any source with meaningfully uncertain
extraction (i.e., anything past CSV) can be trusted.

**Phase 3**: PDF/photo OCR ingestion — genuinely new work, most likely
backed by a third-party vision/OCR API since there's no in-house
capability to extend. Only attempted once Phase 1's evidence shape is
proven, so OCR output has a settled target to map into rather than the
target being designed twice.

**Phase 4+**: SMS/LMS APIs, national datasets, future curriculum
providers — added incrementally, connector by connector, as real demand
appears — matching the already-established principle in
`docs/architecture/school-integration-pipeline.md` §1 of not building a
connector before a real school asks for it.

---

## Open Questions

1. **Evidence Store write target** (§3): (B) — new upstream layer writing
   through to existing `assessments` — is the recommendation. Confirm,
   or choose (A) knowing its cost is comparable to the already-scoped
   Core migration.
2. **Compass/observations as Evidence** (§4): re-model them as
   `LearnerEvidence` for traceability consistency, or leave their current
   direct path alone and scope the Evidence Store to external sources
   only?
3. **Institution resolution**: `institutionId` in the evidence model —
   does this resolve against legacy's free-text `school` string, Core's
   real `schools.id`, or stay nullable/best-effort until the school
   integration pipeline (already frozen, unbuilt) exists? This affects
   how much of the school-integration work needs to land before Phase 1
   can run against a real (non-Reference-School) institution.
4. **Confidence thresholds**: what score triggers human review vs.
   auto-confirmation? Not a technical question — a trust-policy decision
   that should be made deliberately, not defaulted to an arbitrary
   number.
5. **Phase 1 scope confirmation**: is CSV-only, writing to `assessments`,
   an acceptable first slice — or is there a harder floor requirement
   (e.g., must handle at least one real school's actual export format)
   before this is considered started?

Nothing here should be built until these are settled, consistent with
every other architecture decision made this session.
