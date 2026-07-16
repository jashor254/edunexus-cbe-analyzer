# Assessment Type Policy Ratification

**Status: READ-ONLY PRODUCT ARCHITECTURE DOCUMENT.** No code, schema, migration, test, repository, route, or service was modified in producing this document. This is a policy decision, not an implementation plan — Sprint 5I (or whatever sprint eventually implements this policy) is a separate, future decision.

**Context**: Sprint 5G confirmed the engineering layer is stable — `assessment_type_id` integrity holds, teacher identity is settled (ADR-0002), live data is clean. What remains is not a bug to fix; it's a question this codebase has never explicitly answered: **what does "Assessment Type" mean, educationally, inside EduNexus?**

---

## Part 1 — Current Reality

**How teachers currently choose it**: a fixed button-group UI, not free text and not a dropdown of school-configured options — `app/teacher/classes/[classId]/assessments/page.tsx:32-38` (`TYPE_META`), offering exactly six choices: Opener, CAT, Midterm, End Term, Exam, Assignment. The backend (`resolveOrCreateAssessmentType`, `lib/assessments/mutations.ts:35-52`) is *capable* of registering a genuinely custom name a teacher hasn't used before, but no UI ever sends one — confirmed by Sprint 5D and re-confirmed here (the button group is a closed set, not an input field).

**Where it is displayed**: three independent, textually-diverging label dictionaries were found across this series' audits:
1. `app/teacher/classes/[classId]/assessments/page.tsx:32-38` `TYPE_META` — "End Term"
2. `lib/repositories/assessment.repository.ts:591-594` `TYPE_LABEL` — "End-Term"
3. `lib/assessments/pdfRenderer.ts:54-57` `typeLabel` — "End Term"

(Items 2 and 3 were catalogued in Sprint 5G; item 1, the frontend's own copy, is a new finding this session — the same six-way classification is independently spelled in *three* places, not two.)

**Where it is stored**: `class_assessments.assessment_type` (free text, the six values above) and `class_assessments.assessment_type_id` (FK to `assessment_types`, populated correctly on every reachable write path as of Sprint 5F).

**Where it is consumed**: exactly one FK consumer exists anywhere in the codebase — `lib/assessments/evidence.ts:69-71`, resolving `assessment_types.default_purpose_id` into `learner_evidence.purpose_id` — and that consumer is itself a dead end (Sprint 5G: nothing reads `purpose_id` back). The text column is read by: Evidence's own coarser 3-value derivation (`toEvidenceAssessmentType`, `evidence.ts:35-39`), Reports/PDF rendering, and Teacher Dashboard search/analytics (Sprint 5G §6).

**Where it is ignored**: Ranking, Grading, Projection, Career Intelligence, Academic Clinic, and Learning Compass — confirmed zero references to either `assessment_type` or `assessment_type_id` in any of these systems' production code (Sprint 5D, 5G).

**Current implementation vs. original design intention — these do not match, and the gap is precise and evidenced**:

- **Original intention** (Phase G migration, `supabase/migrations/20260713203000_phase_g_evidence_purposes.sql:37-43`, and `lib/config/assessmentTypePurposes.ts`): the six teacher-facing labels were *always* meant to map to a smaller, educationally-meaningful vocabulary. The mapping already exists and is already seeded:

  | Teacher-facing label | Maps to purpose |
  |---|---|
  | Opener | `diagnostic` |
  | CAT | `formative` |
  | Midterm | `summative` |
  | End Term | `summative` |
  | Exam | `summative` |
  | Assignment | `practice` |

  A fifth purpose, `practical`, is seeded but has no default mapping from any of the six labels (`evidence_purposes` migration line 42) — reserved for a label that doesn't exist in the UI yet.

- **Current implementation**: this mapping is computed and stored (`assessment_types.default_purpose_id` → `learner_evidence.purpose_id`) but **nothing downstream ever reads it**. The educational-purpose layer was built — schema, backfill, resolution logic, one integration test proving it resolves correctly — and then never wired to anything that acts on it. This is not a missing feature; it is a **built-but-unconnected** feature, which is a materially different starting point for policy-making than "nothing exists yet."

---

## Part 2 — Educational Meaning

**Which model does the existing product most naturally support?**

The evidence points to **Model C (Hybrid) as the model already partially built**, not merely the best fit in the abstract:

- The teacher-facing surface is unambiguously **Model A** in practice — CAT, Assignment, Exam, Opener, Midterm, End Term are classroom labels, not educational-purpose vocabulary. This matches Model A's own example list almost exactly (the sprint's Model A examples include CAT, Assignment, Exam, Quiz).
- The `evidence_purposes` table is unambiguously **Model B** vocabulary — diagnostic, formative, summative, practice, practical are exactly the five terms Model B's example list names (a subset of it: Diagnostic, Formative, Summative, Practice — with "Continuous Assessment," "Remedial," "Baseline," "Checkpoint," "Competency Demonstration" absent from the current 5, a real gap from Model B's fuller vision, not populated).
- The mapping between them (`ASSESSMENT_TYPE_DEFAULT_PURPOSE_CODE`, `lib/config/assessmentTypePurposes.ts`) is **exactly Model C's described flow** — "Teacher selects: Weekly CAT ↓ System classifies: Formative" is not a proposed design, it is the literal, already-shipped behavior of `resolveOrCreateAssessmentType`, verbatim.

**What's missing from Model C being *fully* realized** is the second half of the sprint's own diagram — "↓ Evidence Engine ↓ Adaptive Learning ↓ Projection ↓ Career Intelligence." Today the arrow stops at `learner_evidence.purpose_id` and goes no further (Sprint 5G, Part 1 above). The architecture and the roadmap both point toward Model C; the *implementation* has only completed the first half of it.

**Fit against existing architecture, roadmap, and documents**:
- `docs/architecture/learner-record-layer-decisions.md` Decision 2 explicitly designed `evidence_purposes` as "a small, platform-seeded" lookup — the language of a controlled educational vocabulary, not an open teacher-defined label set. This is Model C's own premise (the top layer is teacher-flexible, the bottom layer is platform-governed).
- The Instrument Validity Gate concept (`docs/architecture/engineering-educational-intelligence-blueprint.md` §11.8) already establishes that the platform's intelligence architecture distinguishes an assessment's *classroom identity* from its *epistemic standing* (whether its evidence should be trusted for confidence-banded claims) — a structurally similar hybrid split to Model C's label-vs-purpose split, in a different subsystem.
- No document reviewed in this series ever proposed Model A (pure label, no purpose layer) as the intended end state — Phase G's own existence is evidence against it.
- No document reviewed proposes Model B in pure form either (replacing the teacher-facing label with purpose vocabulary directly) — the UI evidence (Part 1) shows teachers think and choose in classroom terms (CAT, Exam), not purpose terms, and no UI mockup, roadmap note, or architecture document found in this series suggests changing that.

**Conclusion of Part 2**: **Model C**, already the de facto architectural direction, is the model this product most naturally supports — evidenced by what's already built, not merely argued for in the abstract.

---

## Part 3 — Consumer Analysis

| Subsystem | Should Assessment Type matter? | Evidence |
|---|---|---|
| **Ranking** | **Should ignore** | Ranking computes position from scores within a single assessment/term context (`lib/ranking/`); type doesn't change what "highest score" means. Zero references found (Sprint 5D, 5G), and no evidence anything about ranking depends on whether the underlying assessment was diagnostic vs. summative. |
| **Grading** | **Should ignore** | Grading converts marks to CBC levels via grade boundaries (`lib/grading/`) — a curriculum-defined scale, not an assessment-purpose question. Zero references found. |
| **Evidence** | **Must care** | This is the one subsystem where type already matters by design — `purpose_id` exists specifically so Evidence can record *why* a piece of evidence was collected, which the Instrument Validity / Educational Confidence Model framing (§11.8) treats as foundational to trustworthy claims. Currently built but not fully connected (Part 1) — "must care" describes the intended role, not the current wiring. |
| **Projection** | **May care** | The Projection Engine currently ignores type entirely and is not evidenced to be broken by doing so (Sprint 5D/5G: zero live issues traced to this). But a diagnostic-vs-summative distinction is plausibly relevant to how much a single data point should move a learner's projected state — this is a "may," not a "must," absent a specific evidenced failure mode. |
| **Adaptive Learning** | **May care** | `lib/adaptiveLearning/differentiation.ts` reads `teacher_id` (ADR-0002) but not assessment type. Differentiation groups plausibly benefit from knowing whether a signal came from a diagnostic check vs. a summative exam, but no current evidence shows the existing differentiation logic is wrong without it. |
| **Career Intelligence** | **Should ignore, for now** | `lib/career/capabilityExtractor.ts` and siblings: zero references, and capability profiles are built from projection state, not raw assessment metadata — type would need to flow through Projection first (which itself is only "may care") before Career Intelligence could meaningfully use it. Marking this "should ignore" reflects current architectural distance, not a permanent ruling. |
| **Academic Clinic** | **Unknown** | `lib/academicClinic/assessmentPipeline.ts` references `teacher_id` but not assessment type; this system runs its own independent tiering (`Emerging/Developing/Proficient/Exemplary`) per `docs/architecture/migration-ledger.md`'s own note that it's "a third, fully independent report pipeline." Whether its tiering logic *should* weight diagnostic differently from summative was not evidenced either way in any document reviewed — genuinely unknown, not a "no." |
| **Learning Compass** | **Should ignore** | Compass's ownership/evidence model (`lib/compass/`) is built around conversational sessions, not formal assessments — its own evidence producer hardcodes `assessmentType: 'assignment'` as a "closest fit" placeholder (Sprint 5D/5G), meaning the concept doesn't map cleanly onto what Compass does at all. |
| **Parent Portal** | **Should ignore** | No parent-facing view was found referencing assessment type at all (Sprint 5G). A parent's practical question ("how did my child do") is answered by score/level, not by whether the assessment was diagnostic or summative — no evidence any parent-facing feature needs this distinction. |
| **Teacher Dashboard** | **Must care** | Already does, today — via the text column (label display, search subtitles, report titles) per Sprint 5G's Consumer Audit. This is the one subsystem with an already-live, real dependency. |
| **School Analytics** | **May care** | `lib/school/intelligence.ts` (principal-facing aggregate reporting) currently reports on teacher activity, not assessment type — but a principal plausibly benefits from "how many formative vs. summative assessments has this school run this term" as a pedagogical-health signal. Speculative, not evidenced as needed today. |
| **Reference School** | **Must care, mechanically** | Its own seed scripts must supply a type to satisfy the NOT NULL-adjacent expectations of realistic data (Sprint 5G found one script does this correctly, one doesn't yet) — a data-fixture-fidelity concern, not an educational-meaning one. |

---

## Part 4 — Ownership

**Who owns Assessment Type?** — **Shared, by tier, matching the already-built structure**:
- **Teacher** owns the *label* — the classroom-facing name (CAT, Exam, a custom name they register). Evidenced: `resolveOrCreateAssessmentType` lets any teacher register a new name on the fly, scoped to `assessment_types.teacher_id` (Sprint 5D/5E/ADR-0002's own finding that this table is currently teacher-scoped, with a school-scoped RLS policy present but unreachable — Sprint 5D §1).
- **School** owns nothing distinct today — the school-scoped half of `assessment_types` (a nullable `school_id` column with its own RLS SELECT policy) exists in schema but has no write path (Sprint 5D §1: "no write path exists yet for school-scoped rows"). Ownership here is *reserved*, not exercised.
- **Curriculum/System** owns the *purpose* vocabulary — `evidence_purposes` is explicitly documented as "platform-governed only... readable by everyone, writable by nobody except the service role" (migration comment, `20260713203000_phase_g_evidence_purposes.sql:30-32`). This is a deliberate, already-ratified ownership decision, not an open question.
- **AI** owns nothing today. No code path infers assessment type from content, marks distribution, or any AI call — the resolution is 100% deterministic name-matching (`resolveOrCreateAssessmentType`'s exact-match-then-create logic), never a model inference.

**Can schools define custom types?** Schema allows it (`assessment_types.school_id`), but no write path exists — this is currently a **no**, in practice, despite being schema-ready.

**Should AI ever infer type?** No evidence in this series supports this being needed. A teacher already explicitly names the assessment at creation time (Part 1) — there is no missing-information gap an inference step would close. Not recommended to consider until a concrete gap is evidenced (e.g., bulk-imported assessments with no type metadata at all — see next question).

**Should Evidence overwrite type?** No — this would contradict the Evidentiary Immutability axiom already governing the rest of the Evidence Domain (`docs/architecture/engineering-educational-intelligence-blueprint.md`'s Axiom 5, and the `learner_evidence` immutability trigger, `20260713203000_phase_g_evidence_purposes.sql:80-104`, which already protects `purpose_id` itself as immutable once written). Assessment type is upstream of Evidence, not derived by it; Evidence should read it, never write it back.

**Should imported assessments preserve source type?** This is forward-looking (no import pipeline for external assessment types exists today — the `integration_connections`/`external_id` columns on `class_assessments` support *identity* sync, not type-mapping) but the evidenced-consistent answer is **yes, with a mapping step, not a guess** — matching the existing "never guessed, only resolved or left null" discipline already followed by `resolveOrCreateAssessmentType` and `purpose_id` resolution alike (both explicitly documented as "never guessed" in their own code comments).

---

## Part 5 — Lifecycle

| Stage | Behavior, evidenced |
|---|---|
| **Creation** | Teacher (or Core caller, post-ADR-0002) selects one of 6 labels or, in principle, a custom name; `resolveOrCreateAssessmentType` resolves-or-creates the `assessment_types` row and its `default_purpose_id` in the same step. |
| **Storage** | Both `assessment_type` (text) and `assessment_type_id` (FK) on `class_assessments`; `default_purpose_id` on `assessment_types`; `purpose_id` on `learner_evidence` (a separate, per-evidence-row copy, not a live reference). |
| **Editing** | Teacher-facing PATCH (`updateAssessment`) can change `assessment_type`, which re-resolves `assessment_type_id` (Sprint 5E's synchronization fix) — **mutable**, not immutable, for the assessment record itself. |
| **Evidence** | Once evidence is recorded, `learner_evidence.purpose_id` is a **frozen snapshot** of the purpose *at the time the evidence was captured* — protected by the immutability trigger. If a teacher later edits the assessment's type, previously-recorded evidence's `purpose_id` does **not** retroactively change (confirmed: no trigger or cascade found that would propagate an edit). This is a real, evidenced **immutable-once-derived** property, distinct from the assessment record's own mutability. |
| **Analytics** | Reads the text column live at query time (Sprint 5G) — reflects whatever the assessment's *current* type is, not a historical snapshot. |
| **Archive** | No distinct archival state exists for assessment type — assessments are simply `is_published` or not; no evidence of a separate archive lifecycle affecting type. |
| **Deletion** | No assessment-deletion path was found in this series' audits (only publish/unpublish); type deletion is therefore not a live concern. |
| **Historical reports** | Report generation (PDF, report cards) reads the *current* text value at render time — a report generated today reflects today's type label, not the type as it was when the assessment was created, if it was ever edited in between. This is a real, evidenced potential inconsistency (an edited assessment's historical PDF, if regenerated, would show the new label) — not previously flagged in any prior sprint's audit. |
| **Audit log** | `teacher.assessment.created` events (`lib/events/types.ts:104`) capture `assessment_type` (text) at creation time as an immutable event-log fact — this is the one place a true point-in-time historical record of the *label* (not just the purpose) already exists. |

**Summary determination**: Assessment Type is **mutable** at the source (`class_assessments`), **immutable-once-derived** at the Evidence layer (`learner_evidence.purpose_id`), **not versioned** (no history table tracks prior values of `assessment_type` on an edited assessment, only the append-only event log incidentally captures the value at creation), and **not itself historical** in Reports (reports reflect current state, not point-in-time state) — a genuine, evidenced inconsistency between how Evidence treats it (frozen) and how Reports treat it (live).

---

## Part 6 — Policy Decisions

| Question | Answer | Evidence |
|---|---|---|
| **Should legacy `assessment_type` remain permanently?** | **Yes, for the foreseeable term** | It is the only field three real, live consumers (Teacher Dashboard, Reports, Evidence's own coarse derivation) currently read (Sprint 5G §6). Dropping it requires migrating all three first — not attempted, not scheduled, and no evidence any of them are broken by its continued existence. |
| **Should `assessment_type_id` become canonical?** | **Yes, for creation/identity purposes — it already effectively is** | Every reachable write path already resolves and stores it correctly (Sprint 5F/5G); it is the only field with a real educational-purpose mapping behind it (`default_purpose_id`). "Canonical for creation" and "canonical for every reader" are different claims — this document ratifies the former; the latter requires the reader migrations Sprint 5G's §7 already scoped and explicitly deferred. |
| **Should both exist indefinitely?** | **Yes, until Sprint 5G's §7 items 4-5 (reader migration) are separately completed and re-audited** | This is not indecision — it is the correct state for a Model C hybrid: the label (text) and the resolved identity (FK) are different things serving different consumers, not two representations of the same fact competing for one answer. |
| **Should text become computed** (i.e., derived *from* the FK/purpose, rather than stored independently)? | **No** | The text value is the *teacher's own words* (their classroom label); the purpose is the *system's classification* of that label. Making text computed-from-purpose would lose the teacher's actual chosen label (multiple labels can map to the same purpose — Midterm, End Term, and Exam all map to `summative` today — so the mapping is not invertible). |
| **Should the FK become optional?** | **No — it already correctly is NOT optional at the schema level for `assessment_type_id`'s existence, but the *resolution* must remain non-guessing** | `assessment_type_id` is nullable at the DB level (by design, so a custom name with no chosen purpose doesn't force a guess) but every *reachable* code path resolves it deterministically today. "Optional" in the sense of "sometimes skipped" would reintroduce the exact defect ADR-0002/Sprint 5F just closed — not recommended. |
| **Should schools customize categories?** | **Reserved, not yet exercised — no policy change recommended now** | Schema supports it (`assessment_types.school_id`), no write path exists, no evidence any school has asked for this. Recommend leaving as a reserved capability, not building it speculatively (matches this codebase's own repeatedly-stated "start simple, grow later" discipline, cited across this series' memory). |
| **Should national curriculum (CBC) define defaults?** | **Partially, already, and this should continue** | The 6 seeded labels (Opener/CAT/Midterm/Endterm/Exam/Assignment) already reflect standard Kenyan CBC school-term assessment conventions, and the 5 seeded purposes (diagnostic/formative/summative/practice/practical) are standard pedagogical vocabulary, not EduNexus inventions. No evidence suggests deviating from CBC-standard defaults; no evidence suggests a formal "curriculum authority" table is needed beyond the current seed-and-map approach. |

---

## Part 7 — Future AI

Evaluated without proposing implementation, per subsystem:

| Subsystem | Should Assessment Type eventually influence it? | Why |
|---|---|---|
| **Evidence confidence** | **Maybe** | The Instrument Validity Gate concept (§11.8) already distinguishes an instrument's epistemic standing from its raw score — a diagnostic check plausibly warrants different confidence treatment than a formal exam. But `computeConfidence` (`lib/intelligence/confidence.ts`) today is driven entirely by identity-match/source metadata, not assessment type, and no evidenced failure shows this is currently wrong. "Maybe," not "yes" — the architectural slot exists, the need is not yet demonstrated. |
| **Projection weighting** | **Too Early** | Projection ignores type entirely today with no evidenced problem from doing so (Sprint 5D/5G). Introducing type-weighting before any evidenced miscalibration is solving a problem that hasn't been shown to exist. |
| **Learning Compass** | **No** | Compass's entire evidence model is structurally different (conversational, not formal-assessment-based) — its own placeholder (`assessmentType: 'assignment'`) is an acknowledgment that the concept doesn't fit, not a gap to close by forcing a fit. |
| **Adaptive Learning** | **Maybe** | Same reasoning as Projection — plausible, architecturally adjacent (already reads `teacher_id`), but no evidenced current failure. |
| **Remediation** | **Maybe** | A remedial plan responding to a diagnostic-flagged gap vs. a summative-exam-flagged gap is a plausible distinction with real pedagogical grounding (diagnostic assessments are, by educational-research convention, lower-stakes and intended to surface gaps early) — but "plausible and grounded" is not the same as "evidenced as needed" in this codebase today. |
| **Academic Clinic** | **Unknown** | Consistent with Part 3's finding — this system's independent tiering logic was not evidenced either way in this pass. |
| **Career Explorer** | **Too Early** | Depends on Career Intelligence, which itself depends on Projection (both marked "may care"/"too early" above) — too many unresolved intermediate layers to evaluate this one meaningfully yet. |
| **Teacher Insights** | **Maybe** | A teacher-facing insight like "your CATs are trending down but your exams are stable" is a plausible, valuable product feature — but it requires Analytics to read the FK/purpose (Sprint 5G §7 item 5, not yet done), which is itself a prerequisite, not evidenced as blocking anything today. |
| **School Intelligence** | **Maybe** | Same reasoning as School Analytics in Part 3 — a plausible principal-facing signal, not an evidenced current need. |

**Pattern across Part 7**: nothing rises to a confident "Yes" — every "Maybe" is architecturally plausible (the Instrument Validity Gate, the purpose vocabulary, and the hybrid model all point the same direction) but none is backed by an evidenced current failure or an explicit product request found in this series' documents. This is itself a finding: **the platform has built the scaffolding for assessment-type-aware Intelligence before any subsystem has demonstrated it needs it** — consistent with, not contradicting, this codebase's own stated "start simple, grow later" philosophy, which argues for *not* wiring these connections speculatively.

---

## Part 8 — Ratification

**RECOMMENDATION: OPTION C — Hybrid.**

```
Teacher labels (CAT, Exam, Assignment, ...)
        ↓  (resolveOrCreateAssessmentType — already built, Sprint 5D/5E/5F)
Canonical educational purpose (diagnostic, formative, summative, practice, practical)
        ↓  (purpose_id on learner_evidence — already built, Phase G)
Intelligence / Analytics / Adaptive systems
        ↓  (NOT YET BUILT — every consumer in Part 3/7 is "may/unknown/maybe/too early," none is "must" beyond Evidence itself and Teacher Dashboard's existing text-only use)
```

**This is a ratification of direction, not a mandate to build the unbuilt bottom half now.** The evidence supports Option C as the model this codebase already committed to (Part 2) — it does not, on the evidence gathered in Parts 3 and 7, support treating the unbuilt bottom half as urgent. Every downstream consumer evaluated is "may care" at strongest, none is an evidenced "must" beyond what already works (Evidence's own purpose resolution, Teacher Dashboard's text display).

**Why not Option A**: Option A (metadata only) would mean formally abandoning the `evidence_purposes` layer that already exists, is seeded, is tested, and matches CBC-standard pedagogical vocabulary — there is no evidence anything is wrong with it; it's simply unconnected downstream. Discarding working, correct infrastructure because its consumers haven't been built yet would be a regression relative to the current state, not a simplification.

**Why not Option B**: Option B (assessment type *becomes* educational semantics — i.e., the label itself is replaced by purpose vocabulary) contradicts direct UI evidence (Part 1): teachers choose CAT/Exam/Assignment, not Diagnostic/Formative/Summative. There is no evidence teachers think in, or want to think in, purpose vocabulary directly — Model C's whole value is letting them keep their own words while the system does the classification underneath.

---

## Part 9 — Deliverables

1. This document — `docs/architecture/assessment-type-policy-ratification.md`.
2. Implementation log entry — `docs/engineering/implementation-log.md`.

---

## Validation

Explicitly confirmed, this session:
- **0** production files modified
- **0** repositories modified
- **0** services modified
- **0** routes modified
- **0** schema changes
- **0** migrations
- **0** tests modified
- Only this document and the implementation log entry were written.

**STOP. No implementation performed. Sprint 5I not started.**
