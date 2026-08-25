# Parent Portal Phase P5 — Academic Result Authority Convergence (Audit)

**Scope lock:** branch `main`, started at HEAD `e2f68c1` (P4.5's own closeout commit),
205 pre-existing dirty working-tree files confirmed via `git status --short` before
any work and left completely untouched — this phase made **zero product-code
changes**. Builds on `docs/architecture/parent-portal-super-audit-p0.md` (P0),
`docs/architecture/parent-portal-p1-entry-convergence.md` (P1),
`docs/architecture/parent-portal-p2-compass-actor-boundary.md` (P2),
`docs/architecture/parent-portal-p3-home-child-context-convergence.md` (P3),
`docs/architecture/parent-portal-p3-5-http-regression-harness.md` (P3.5),
`docs/architecture/parent-portal-p4-attention-action-model.md` (P4), and
`docs/architecture/parent-portal-p4-5-attendance-visibility.md` (P4.5).

**Methodology note, stated honestly up front:** this phase is evidence-gathering
via exact `file:line` static-code citation across four independent research
passes (Gradebook/Report Card, Blueprint/Academic Clinic, Evidence-emission
tracing, subject/CBC-vocabulary tracing), the same methodology P0 itself used
for its own first-pass audit of the whole parent portal. Steps 8 and 30-34 of
the mission asked for real seeded HTTP fixtures proving personas and
contradictions; this phase did **not** build new fixtures for those — the
authority/definitional questions this phase answers (what table does each
surface read, is a value frozen or live, does a write reach Evidence) are
fully decidable from code with `file:line` precision and did not, in this
phase's judgment, need a running server to prove honestly. This is named as a
limitation (§37), not hidden, and is the same class of deferral P3 made for
its own live-render checks under time budget.

`npm run test:parent-http` was re-run as the baseline gate (§33/§34) — no new
fixtures were added to it this phase.

---

## 1. Verdict

**AUDIT ONLY — PRODUCT SEMANTICS NEED DECISION.**

The four hypotheses from the mission (Gradebook = transactional classroom
truth, Report Card = formal published periodic truth, Blueprint = canonical
learner-intelligence interpretation, Academic Clinic = diagnostic/advisory
interpretation) are all **confirmed true in the main**, with one important,
newly-discovered, real correctness exception: Report Card's per-subject
breakdown is not as frozen as its own "published, immutable" self-description
implies (§4, §14). Beyond that one finding, what this phase found is not a
set of bugs to fix — it is a genuinely fragmented but *mostly legitimate*
set of independent authorities, several of which (CBC threshold scales,
subject-identity resolution, risk/strength vocabulary) have never been
ratified into one canonical answer anywhere in the codebase, confirmed by an
architecture test (`lib/grading/thresholdConflictInventory.architecture.test.ts`)
that exists specifically to document the disagreement rather than resolve it.
Forcing a narrow code convergence this phase would mean either quietly
picking a threshold/vocabulary winner (explicitly out of scope — "never
alter core grading/intelligence formulas") or performing cosmetic copy edits
that paper over a real, unresolved product question. Per the mission's own
instruction, an honest AUDIT ONLY / PRODUCT DECISION REQUIRED verdict is
reported instead of forcing a change to look complete.

---

## 2. Surface Map

| Surface | Route(s) | Authority | Freshness | Persisted? | Parent reachable? |
|---|---|---|---|---|---|
| **Gradebook** | `/child/[learnerId]/gradebook` (`app/(parent)/child/[learnerId]/gradebook/page.tsx`, client `ParentGradebookClient.tsx`), API `app/api/parent/gradebook/route.ts` | `lib/gradebook/gradebook.ts` (`buildGradebook`) | Live — fresh `Promise.all` read on every request, no cache | No (transactional re-read of `learner_marks`/`assignment_submissions`) | Yes, from Home's "Gradebook" card and P3's child-context switcher |
| **Report Card** | `/report-card` (`app/(parent)/report-card/page.tsx`), API `app/api/reports/report-card/route.ts` + `.../mine/route.ts` | `lib/core/report-cards.ts` (`getReportCard`/`generateReportCards`/`publishReportCards`) | **Split** — overall fields frozen at publish; per-subject rows (`term_subject_summaries`) live-joined, can drift after publish (§4/§14) | Yes for overall row (`school_report_cards`); **no** for per-subject rows | Yes, from Home's "Learning Time"→celebrate/`view_report_card` action and a direct link — **still no primary-nav entry, confirmed unchanged since P0/P3** (§29) |
| **Blueprint (academic portion)** | `/child/[learnerId]` (Home teasers), `/child/[learnerId]/full` (`ParentBlueprintView`) | `lib/learnerBlueprint/composeAcademicRecord.ts` + `composeRisk.ts`, both reading only `recomputeLearnerProjection()` | Live — recomputed on every render from confirmed Evidence | No (Blueprint itself is never stored; `learner_evidence`/`learner_projections` are the persisted substrate; `blueprint_snapshots` exist only as point-in-time captures triggered by Report Card publication and end-of-term, per `lib/core/report-cards.ts:213-223`) | Yes — Home's default "how is my child doing" surface, plus explicit History/Journey pages |
| **Academic Clinic** | `/dashboard/clinic/reports/[studentId]` (linked, server-rendered, canonical-career-augmented), `/academic-clinic` (orphaned, zero inbound links, client-only, no canonical-career augmentation — P0's finding re-confirmed unchanged), `POST /api/clinic/download` (PDF) | `lib/academicClinic/assessmentPipeline.ts` + `reportGenerator.ts` + `careerEngine.ts`, reading legacy `students`/`assessments` directly | Live for the on-screen view (regenerated from the latest `assessments` row every render, `generatedAt: new Date().toISOString()` at render time); a downloaded PDF is a frozen artifact from the moment of download, with no re-binding mechanism | Metadata only (`student_clinic_reports` stores delivery metadata — teacher/class/term/whatsapp/email timestamps — not report content; a `report_data` snapshot column/method pair exists in the repository layer but has **zero callers anywhere in the codebase**, confirmed dead) | Yes, `/dashboard/clinic` nav tile (shared nav, reachable even for a Core-only parent whose child has no legacy `students` row — P3's unfixed finding, re-confirmed unchanged, §29) |

No new surface was found beyond what P0/P3 already mapped. Report Card's own
nav absence and Clinic's legacy-space nav placement are both **re-confirmed
current, unchanged since P3** (`app/dashboard/components/DashboardNavbar.tsx`
still has no `report-card` entry; `Clinic` is still in both the top and
bottom nav lists, lines 12/20).

---

## 3. Gradebook Authority

**CONFIRMED: transactional classroom truth, not learner-intelligence truth.**

- Reads only raw numeric marks — `total_marks` from `learner_marks`
  (`lib/gradebook/gradebook.ts:44-45`, `lib/repositories/assessment.repository.ts:1207-1223`)
  and `score` from `assignment_submissions` (`gradebook.ts:48-53`). No
  `cbc_level` field is read or rendered anywhere in `gradebookPure.ts`'s types
  (lines 6-23) or in `ParentGradebookClient.tsx`'s rendered cell (lines 63-67,
  a bare number or em-dash).
- Teacher marking is the sole source of a populated cell: unmarked work
  renders `null`/em-dash, never a fabricated zero
  (`gradebookPure.ts:46,50`, `ParentGradebookClient.tsx:66`).
- Quizzes, plain assignments, and adaptive/differentiated assignments all
  collapse into one generic `kind: 'assignment'` column
  (`gradebookPure.ts:9,37-39`) — no distinguishing badge exists, even though
  quiz auto-grading and adaptive delivery both write into the exact same
  `assignment_submissions.score`/`assignments` shape Gradebook reads.
- Zero references to `learner_evidence`/`recomputeLearnerProjection`/
  `Projection` anywhere in `lib/gradebook/**` or the parent gradebook API/page
  (confirmed by grep, zero hits) — Gradebook's own header comment states this
  explicitly: "Read-only aggregation — no new write path, no new identity"
  (`gradebook.ts:5-6`).
- No history/snapshot mechanism — every request is a fresh read of whatever
  is currently marked.

**This is exactly the "same score, different data source" pattern in the mission's
own framing — Gradebook answers "what has been marked so far," nothing more.**

---

## 4. Report Card Authority

**CONFIRMED with one real, previously-undocumented exception: formal
school-published periodic truth for its overall/headline fields, but its
per-subject breakdown is not equally frozen.**

- Two tables: `school_report_cards` (per-learner-per-term aggregate —
  `overall_score`, `overall_cbc_level`, `position_in_class`, `is_published`,
  `published_at`) and `term_subject_summaries` (per-learner-per-subject-per-term
  — `weighted_score`, `cbc_level`, joined to `subjects(id, name, code)`),
  related only by `(learner_id, term_id)` — **no FK between them**
  (`lib/repositories/school.repository.ts:605-611`, explicitly documented).
- CBC levels are computed through the shared Grading Engine (`lib/grading`,
  `gradeScore()`), not a local closure — `lib/core/report-cards.ts:96-107`'s
  own comment states this was a deliberate move "through the canonical
  Grading Engine ... instead of a local closure." **Report Card does not
  replicate Academic Clinic's local-computation pattern.**
- **The immutability split (the phase's single most important new finding):**
  `school_report_cards`' overall fields are computed exactly once at
  generation and never recomputed on view (`report-cards.ts:22-30`'s own
  comment: "an immutable snapshot ... never recomputes-on-view"), and
  `generateReportCards` explicitly refuses to run again once ANY card in the
  class/term is published (`report-cards.ts:49-66`) — a real, enforced guard.
  But `term_subject_summaries` has **no equivalent guard**:
  `computeTermSummaries` (`lib/core/assessments.ts:170-284`) upserts into it
  every time a teacher publishes a new assessment
  (`app/api/core/assessments/route.ts:134-170`), with no check against
  `school_report_cards.is_published` for that same learner/term. Since
  `findReportCardWithSubjects` (`school.repository.ts:629-637`) reads
  `term_subject_summaries` live, filtered only by `(learner_id, term_id)`,
  and `app/(parent)/report-card/page.tsx:151-165` renders that live join
  directly — **a teacher publishing a later assessment for an already-published
  term can silently change the per-subject mark/level a parent sees under a
  "Published" report card, while the headline overall score/level/position
  stay frozen.** This was not previously named in P0-P4.5.
- Report Card (the `school_report_cards`/`term_subject_summaries` surface)
  does **not** emit `learner_evidence` anywhere — zero hits for
  `learner_evidence` across `lib/core/report-cards.ts` and its API routes.
  A same-named-sounding module, `lib/assessments/reportCardEvidence.ts`,
  emits Evidence — but it belongs to a **different, legacy `assessments`
  table pipeline** (Academic Clinic's input), not this surface — see §11/§12
  for the disambiguation, which is itself a real naming-collision finding.
- Does not read/recompute Projection. The only downstream effect of
  publication is a Blueprint Snapshot capture per learner
  (`report-cards.ts:213-223`), not a Projection touch.

**Verdict stands, with the exception named as the phase's headline finding — see §14.**

---

## 5. Blueprint Authority

**CONFIRMED: longitudinal learner-intelligence interpretation, delegated
correctly to Projection — Blueprint computes nothing itself.**

- `composeAcademicRecord` (`lib/learnerBlueprint/composeAcademicRecord.ts:16-72`)
  reads exclusively via `recomputeLearnerProjection()` (line 32) — its own
  header states it deliberately avoids the exact gap
  `sprint-12c-academic-clinic-hardening.md` found in the older Clinic
  pipeline (lines 1-7): "never a direct `assessments`/`class_assessments`
  read."
- Builds `bySubject[].latestLevel/trend/evidenceCount/latestEvidenceAt`,
  `competencies`, `overallTrend`, `confidence`, `lastComputed` — all sourced
  from Projection's own precomputed values (`composeAcademicRecord.ts:34-59`),
  never re-derived.
- `composeRisk.ts` independently pulls `projection.risk` from the same
  Projection call (lines 22-25) as a sibling section, not a derivation of
  Academic Record — they are stitched together only in presentation
  (`BlueprintView.tsx:356-357,398`).
- Purely reads the pre-computed Projection object; never imports
  `assignments`/`report_cards`/`assessments`/Compass/intervention tables.
  `composeBlueprint.ts`'s own header: "Blueprint owns nothing, calculates
  nothing, stores nothing; it only asks each canonical domain's own function
  and assembles the answers" (lines 4-7).
- "Longitudinal" character (history, trend) is computed once, upstream,
  inside Projection itself (`lib/projection/recompute.ts`), never
  re-aggregated by Blueprint — Blueprint is an interpretation/presentation
  layer over a longitudinal Projection, which is architecturally correct: it
  composes, Projection computes.

---

## 6. Academic Clinic Authority

**CONFIRMED CURRENT: diagnostic/advisory interpretation, not canonical
learner truth — with an important nuance that refines, not overturns, P0's
original framing.**

- Reads legacy `students`/`assessments` directly across all three entry
  points (`lib/academicClinic/assessmentPipeline.ts:84-85`,
  `app/dashboard/clinic/reports/[studentId]/page.tsx:58-74`,
  `app/academic-clinic/page.tsx:177,204-205`) — never Evidence/Projection.
- **`assessments.subject_scores` is already CBC-level data (1-4), not raw
  0-100 marks**, by the time Clinic reads it — confirmed by the write path
  (`app/dashboard/assessments/add/page.tsx:299-306` converts a raw mark via
  the canonical `marksToLevel()` from `lib/intelligence/cbcScale.ts` before
  storing). The `Math.max(1, Math.min(4, Math.round(score)))` clamp P0
  flagged (`assessmentPipeline.ts:100`, `app/academic-clinic/page.tsx:104`,
  both confirmed still present verbatim at current HEAD) is therefore a
  **defensive round/clamp on an already-classified value, not a from-scratch
  percentage-threshold reimplementation.** P0's structural finding — Clinic
  determines a subject "level" entirely outside canonical Projection, with
  no write-back — is CONFIRMED CURRENT; the specific "raw marks, local
  threshold" framing is refined by this phase to be more precise, not
  reversed.
- `careerEngine.ts:185`'s hardcoded `CAREER_DATABASE` remains the always-included
  base corpus for pathway/career matching, even after a later phase (Phase
  9.1.6, per `assessmentPipeline.ts:227-239`) additively supplemented two of
  the three entry points with canonical Postgres careers. The orphaned
  `app/academic-clinic/page.tsx` explicitly documents it never received that
  convergence (own header comment, lines 10-14).
- Strengths/challenges are derived independently from the locally-built
  `SubjectProgress[]` (`reportGenerator.ts:265,329-330,387`), never from
  Projection.
- Zero writes to `learner_evidence`, zero reads of
  `recomputeLearnerProjection`/`learner_projections` anywhere in
  `lib/academicClinic/**` (confirmed by grep). Clinic writes only to its own
  `student_learning_context` and `student_clinic_reports` (metadata only,
  §2) — a genuinely one-way input-in-output-out pipeline with **no write-back
  to the canonical learner record.**
- Regenerated live on every on-screen view (from the latest `assessments`
  row); a downloaded PDF is a frozen artifact from the moment of download —
  and its narrative prose ("`${firstName}'s current assessment reveals...`",
  `reportGenerator.ts:306,313,386,453,472,696,812,814,1256,1437`,
  `lib/career/clinicReportBuilder.ts:255,316,345`) never qualifies "current"
  with a date inside the sentence — a real staleness-language risk for a
  downloaded artifact, named in §16.

---

## 7. Data Authority Matrix

| Concept | Gradebook | Report Card | Blueprint | Clinic | Canonical Authority |
|---|---|---|---|---|---|
| Subject mark (specific assignment/assessment) | **Authoritative** (live, raw) | Authoritative for the published term result only | Not tracked per-assignment | Not tracked per-assignment | **Gradebook**, for "what was this specific item scored" |
| CBC level (per subject, per term) | Not shown | **Authoritative for the published term** (with the drift caveat, §4) | Shown as current Projection state (may differ — different question) | Independently re-derived, advisory only | **Report Card** for "what did the school formally record"; **Blueprint** for "what does canonical Evidence currently say" — legitimately two different authorities for two different questions |
| Capability / current level | Not represented | Not represented | **Authoritative** | Advisory reinterpretation | **Blueprint** |
| Trend / trajectory | Not represented | Not represented (a snapshot has no trend) | **Authoritative** | Own narrative trajectory language (advisory) | **Blueprint** |
| Risk | Not represented | Not represented | **Authoritative** | Own "priority areas"/"gaps" framing (advisory, different vocabulary — §17) | **Blueprint** |
| Strength / weakness | Raw score pattern only | Per-subject level only | **Authoritative** (Projection-derived) | Own clinical-language strengths/challenges (advisory) | **Blueprint** for enduring capability; Gradebook/Report Card for a single result |
| Term result (published) | Not represented | **Authoritative** | Not represented directly (Blueprint doesn't read Report Card) | Not represented | **Report Card** |
| Assignment performance (recent work) | **Authoritative** | Not represented | Represented only via Evidence→Projection, once confirmed (may lag) | Not represented | **Gradebook** for "was it turned in/marked," **Blueprint** for "does it reflect a lasting capability change" |
| Pathway readiness | Not represented | Not represented | `composePathwayReadiness.ts` (Projection-derived, out of this phase's scope to re-trace) | Own independent career-matching against `CAREER_DATABASE` + canonical supplement | **Blueprint's `composePathwayReadiness`**, per prior sprints; Clinic's own matching is explicitly advisory, never authoritative |
| Learning gap | Not represented | Not represented | Risk flags / competency gaps | Own "priority areas" derivation | **Blueprint** |

The matrix confirms the mission's own expectation: several concepts
legitimately have different authorities for different questions (subject
mark: Gradebook for "this item," Report Card for "this term's formal
result"). The genuinely concerning row is **CBC level**, where Report Card's
own per-subject number can silently drift post-publication (§4) — not a
different-authority-for-different-question case, but the same authority
(Report Card) disagreeing with its own earlier self.

---

## 8. Time / Freshness Model

```
GRADEBOOK    event=mark entry        calc=none (raw)         publish=n/a          read=LIVE, every request
                                                                                   (re-reads learner_marks/
                                                                                    assignment_submissions)

REPORT CARD  event=term close        calc=generation time     publish=explicit,    read=SPLIT:
             (per-subject: any        (gradeScore(), once      is_published/       - overall fields: FROZEN
              later assessment        for overall row)         published_at,       - per-subject rows: LIVE
              publish re-triggers                               guarded against    (re-reads
              computeTermSummaries)                              re-generation      term_subject_summaries,
                                                                  once published)    NOT guarded post-publish)

BLUEPRINT    event=Evidence          calc=Projection engine,  publish=n/a          read=LIVE, every render
             confirmation             async (~5 min lag via   (Blueprint itself    (recomputeLearnerProjection
             (persistEvidenceBatch)   evidence_projection_     is never stored;    called fresh each time;
                                       events outbox +          blueprint_snapshots  a Snapshot is a frozen
                                       cron/queue consumer,      are point-in-time   COPY taken at Report-Card-
                                       app/api/cron/projection-  captures, not the   publish or end-of-term,
                                       events/process, every     live surface)       viewed separately via
                                       5 min, GitHub Actions,                        /history)
                                       NOT a Vercel cron)

CLINIC       event=assessments row   calc=live, at render/    publish=n/a for the  read=LIVE for the on-screen
             written (teacher/        download time (rebuilds  on-screen view;      view; FROZEN the instant a
             parent assessment        SubjectProgress/Vitals/  a downloaded PDF     PDF is downloaded, with no
             intake)                  ActionPlan from the       freezes at that      re-binding mechanism and
                                       latest assessments row)  moment               no in-sentence date
                                                                                     qualifier on "current"
                                                                                     language (§16)
```

**Practical consequence:** a parent who sees Report Card, Blueprint, and
Clinic disagree on the same day is very likely seeing a legitimate
time-window difference (Blueprint reacts within ~5 minutes of new confirmed
Evidence; Report Card only changes at the next publish event; Clinic
re-derives from whatever `assessments` row is newest at that instant) — not
a bug. The one case that is NOT a legitimate time-window difference is
Report Card's own per-subject drift after its own publish event (§4/§14),
because Report Card's whole product promise is "this doesn't change once
published," and for the per-subject rows, it silently can.

---

## 9. Subject Vocabulary

A real canonical `subjects` table exists
(`supabase/migrations/20260629_core_foundation.sql:274-322`, FK'd from
`grade_subjects`/`class_subjects`/`term_subject_summaries`), but it only
seeds pre-primary/primary/junior-secondary rows — **no Senior School
(Grade 10-12) rows exist in it at all.**

| Surface | Subject identity | Canonical? |
|---|---|---|
| Report Card | FK join to `subjects(id, name, code)` (`school.repository.ts:629-634`) | **Yes** — the one surface that genuinely resolves through the canonical table |
| Gradebook | `teacher_classes.subject`, a plain `text` column, no FK (`lib/database.types.ts`) | No — teacher-typed free text |
| Blueprint | `EvidenceRow.subject`, a raw string on the evidence row (`lib/projection/academicProjector.ts:40-53`) | No — free string, not FK-resolved |
| Academic Clinic | JSONB keys of `assessments.subject_scores` (`Record<string, number>`), e.g. `kiswahili_ksl`, `core_mathematics`; `normalizeSeniorScores()` (`assessmentPipeline.ts:26-46`) explicitly folds Biology/Chemistry/Physics into `integrated_science` "as a proxy" | No — ad hoc keys, with a documented cross-subject rename |

**Confirmed cross-surface drift:** the same subject can legitimately render
as `"Integrated Science"` (Report Card, canonical `subjects.name`) vs. a
JSON key `integrated_science` possibly synthesized from three separate
Senior subjects via Clinic's proxy-folding, vs. whatever free string a
teacher typed for Gradebook, vs. whatever string an Evidence-producing
pipeline wrote for Blueprint. **No shared normalization layer exists between
these four surfaces.** This is a real, confirmed, currently-live source of
apparent (but often not actual) disagreement — flagged, not resolved
(mission explicitly forbids building a new taxonomy this phase).

---

## 10. CBC Conversion Points

**There is no single ratified canonical CBC threshold function.**
`lib/grading/thresholdConflictInventory.architecture.test.ts` is an existing,
deliberately-preserved architecture test whose entire purpose is documenting
this, not resolving it (comment: "requires human ratification"). At least
six independently-maintained raw-mark→level threshold sets were found:

| Set | Location | Thresholds (EE/ME/AE cut) |
|---|---|---|
| A | `lib/intelligence/cbcScale.ts` (`marksToLevel`, canonical Evidence Domain) | 75 / 50 / 30 |
| B | `lib/assessments/gradeCalculator.ts` `BUILTIN_CBC_SCALE` (legacy teacher gradebook) | 76 / 51 / 31 |
| C | `lib/grading/boundaries.ts` `CBC_SCALE_STANDARD` | 76 / 51 / 31 |
| D | `lib/grading/boundaries.ts` `CBC_SCALE_CORE_LEGACY` | 75 / 50 / 25 |
| E | `lib/curriculum/regional/ke-cbc.ts` `GRADING_SCALE` (self-labeled "canonical reference," unverified) | 75 / 50 / 25 |
| F | 3 inline copies (lesson-plan TSC view, assignment results pages) | 75 / 55 / 40 |
| G | 2 inline copies (notifications, email sender) | 80 / 60 / 40 |

Per surface, which pattern applies:

- **Gradebook** — no level classification found anywhere in
  `lib/gradebook/**`; it is a raw-marks matrix only (§3).
- **Report Card** — mixed. Per-subject `cbc_level` is consumed
  already-classified from `term_subject_summaries` (populated via Set
  D-equivalent, `assessment.repository.ts:61-79`), but the **overall**
  report-card level is independently (re-)computed at generation time
  (`report-cards.ts:96-107`, also Set-D-equivalent defaults, via the shared
  `gradeScore()` engine — not a local closure, but still a second
  classification pass rather than a pure aggregation of stored subject
  levels).
- **Blueprint** — pure pass-through of already-classified levels;
  `lib/projection/academicProjector.ts:37,50-53` explicitly does not
  re-derive from raw scores (comment: "no threshold judgment — ARDS's job,
  not Projection's").
- **Academic Clinic** — consumes an already-leveled `subject_scores` value
  (converted upstream via Set A at data-entry time, §6) and applies only a
  defensive clamp, not a fresh classification.

**No surface in this audit was found doing a from-scratch, unratified
percentage classification on its own — the disagreement is one hop
upstream, at ingestion (Sets A/B/D disagree with each other), not inside the
four parent-visible surfaces themselves.** This is a real, live,
already-self-documented gap (the architecture test exists precisely to
track it) — not resolved here, per the mission's explicit instruction not to
resolve the threshold conflict in this phase.

---

## 11. Gradebook → Evidence

| Activity | Emits Evidence | Source tag | Trust tier | Citation |
|---|---|---|---|---|
| MCQ/quiz auto-grade | Y | `quiz_auto_grade` | 3 (its own tier) | `lib/quiz/quizEvidence.ts:37,101-102` |
| Normal assignment, teacher-marked | Y | `teacher_upload` | 3 | `lib/assignments/evidence.ts:43,115-116` |
| Class-assessment marks entry | Y | `teacher_upload` | 3 | `lib/assessments/evidence.ts:31,124-125` |
| Topical/sub-strand check | Y | `teacher_upload` | 3 | `lib/assessments/topicalEvidence.ts:23,67-68` |
| Adaptive/differentiated assignment | Y — inherits the underlying route's source, not a distinct tier | `teacher_upload` or `quiz_auto_grade` | inherits | `lib/assignments/adaptiveProvenance.ts:1-57` — adaptive-ness is a `payload` field (`kind:'adaptive_delivery'`), not a distinct evidence source |
| Viewing/discovering an assignment (no submission) | N | — | — | `lib/core/assignmentDiscovery.integration.test.ts:429,441-443` |
| PDF download of an assignment | N | — | — | `lib/assignments/assignmentPdf.http.integration.test.ts:446` |
| Assignment creation (teacher authoring) | N | — | — | `lib/assignments/create.http.integration.test.ts:218-227` |

Every "Y" row shares one implementation pattern: build a `LearnerEvidence[]`
→ `repos.evidence.createIngestionRun()` → `persistEvidenceBatch()`
(`lib/intelligence/evidenceLifecycle.ts:249`) — no per-surface reinvention.

---

## 12. Report Card → Evidence

**Naming-collision finding, worth stating plainly:** the module named
`lib/assessments/reportCardEvidence.ts` does **not** connect the formal
Core Report Card (`school_report_cards`/`term_subject_summaries`, §4) to
Evidence — it connects a **different, legacy `assessments` table pipeline**
(the one Academic Clinic reads, §6) to Evidence, triggered from
`app/api/teacher/assessments/process/route.ts` and
`app/api/parent/assessments/process/route.ts` — confirmed by grep, only
those two routes and the file itself call
`recordReportCardAssessmentEvidence`; `lib/core/report-cards.ts` and its API
routes never do (zero hits for `learner_evidence`). **The formal Core Report
Card surface itself emits no Evidence at all.**

For the pipeline this module actually serves:
- Granularity: one `learner_evidence` row per scored subject on a processed
  legacy assessment (loop, `reportCardEvidence.ts:152-185`), subject-level
  only (no strand/sub-strand — explicit comment, lines 4-8).
- Source tag: `teacher_upload` (tier 3) for the teacher intake path,
  `parent_observation` (tier 1, confidence capped at 60, below the 85
  auto-confirm threshold) for the parent self-report path, chosen from
  `assessments.source` (lines 51-70, 68-70).
- Idempotent per assessment via a `raw_input_ref` prefix check (lines 73-75,
  120-135).
- **Does not directly call `recomputeLearnerProjection`.** Projection
  recomputation happens asynchronously via an outbox
  (`evidence_projection_events`, written inside `persistEvidenceBatch`) and
  a separate consumer (`lib/projection/eventConsumer.ts:25-58`,
  `processProjectionEvents()`) invoked by
  `app/api/cron/projection-events/process/route.ts`, which its own comment
  states is triggered **every 5 minutes by a GitHub Actions workflow — not a
  Vercel cron** (absent from `vercel.json`'s `crons` array). So even for the
  pipeline that does emit Evidence, there is an up-to-~5-minute lag before
  Blueprint reflects it.

---

## 13. Clinic → Evidence

**Confirmed: purely input-in-output-out, no write-back to the canonical
learner record.** `grep -rn "learner_evidence|persistEvidenceBatch|
recomputeLearnerProjection|learner_projections" lib/academicClinic
lib/career/clinicReportBuilder.ts lib/career/clinicPdfRenderer.tsx
app/api/academic-clinic app/api/clinic` returns zero matches. Clinic's own
pipeline function, `runAssessmentPipeline`
(`lib/academicClinic/assessmentPipeline.ts:72`), is invoked as a **sibling**
call in the same route as the Evidence emitter (§12) — not nested inside it
— confirming Clinic's own code path never triggers Evidence emission; the
route glues two independent systems together externally. Clinic's only
persistence is `student_learning_context` and `student_clinic_reports`
(metadata), both outside the Evidence/Projection domain.

Caveat, stated honestly: the negative grep across `lib/academicClinic/**`
plus targeted reads of `assessmentPipeline.ts` strongly support this, but a
residual indirect write path was not ruled out with 100% line-by-line
certainty across every file in the directory (e.g. the full 1400+ lines of
`reportGenerator.ts`/`careerEngine.ts` were not read in their entirety) —
NOT CONFIRMED absent beyond the grep's own reach, though nothing found
contradicts it.

---

## 14. Genuine Contradictions Found

Constructed by tracing real code paths (not hypothesized), classified per
the mission's own taxonomy:

**(A) Report Card's own per-subject value can disagree with its own
"Published" state — TRUE CONTRADICTION / BUG.** The single most important
finding of this phase (§4). A "Published" report card's headline
score/level/position are frozen; its per-subject breakdown is not — a
teacher publishing a later assessment for the same term silently changes
what a parent sees under an already-"published" label, with no
re-publication event, no version marker, and no warning. This is not a
time-window difference or an expected-difference case — it is the same
surface disagreeing with its own stated guarantee.

**(B) Recently-marked-poorly assignment (Gradebook) vs. a strong last
Report Card — EXPECTED DIFFERENCE / DIFFERENT TIME WINDOW.** Gradebook shows
live, current-term, transactional work; Report Card is frozen at the
previous term's publish event. A parent seeing these disagree is seeing
exactly what each surface promises to show — a real single low score does
not retroactively change a past formal result, correctly.

**(C) Strong Report Card vs. newer Evidence causing a Projection decline
(Blueprint) — EXPECTED DIFFERENCE / DIFFERENT TIME WINDOW, but with a real,
up-to-5-minute propagation lag (§8/§12) that is not currently communicated
anywhere in parent-facing copy.** Blueprint's "live" framing (§5) is
accurate in that it reflects the latest *confirmed* Evidence, but "live" in
UI copy could misleadingly suggest sub-second freshness when the actual
pipeline has an async cron-driven lag.

**(D) Clinic generated from an older assessment snapshot — MOSTLY EXPECTED
DIFFERENCE for the live on-screen view (it always re-derives from the
newest `assessments` row, §6), but a genuinely STALE-DATA risk for a
DOWNLOADED PDF**, whose narrative prose calls itself "current" with no
in-sentence date qualifier (§6/§16) and which — once downloaded — has no
mechanism to ever refresh.

**(E) Gradebook has one quiz score while Blueprint aggregates several
Evidence sources — EXPECTED DIFFERENCE / DIFFERENT SEMANTIC QUESTION.**
Gradebook answers "what was scored on this specific item"; Blueprint answers
"what does the learner's confirmed capability currently look like,"
correctly a different, broader question. Not a bug.

**(F) Report Card's per-subject level (Set-D-equivalent thresholds) vs.
Clinic's own displayed level for the same nominal subject, sourced from a
different assessment row and a different upstream classification pass (Set
A at ingestion) — UNKNOWN / not resolvable from code alone without a live
fixture**, since it depends on which specific assessment each pipeline last
processed for that learner at read time; named rather than guessed at.

No case found in this trace rises to "manufactured certainty" (a surface
inventing a number it doesn't have) — every disagreement traced back to a
real, distinct, individually-defensible data source and time window, except
(A).

---

## 15. Expected Differences

Summarized from §14: (B) Gradebook-vs-Report-Card term-boundary differences,
(C) Blueprint's up-to-5-minute Evidence-to-Projection lag vs. any
just-published formal result, (E) item-level-vs-aggregate semantic
differences. All three are legitimate, all three are currently
*undocumented* to a parent anywhere in copy (§16), which is the real,
actionable gap — not the differences themselves.

---

## 16. Misleading Same-Label Cases

- **"Current" used identically by Blueprint (genuinely live, recomputed
  every render) and by Academic Clinic's narrative prose (accurate for the
  live on-screen view, but potentially stale and never date-qualified for a
  downloaded PDF, §6/§14D)** — the same word implies two different freshness
  guarantees depending on which surface and which artifact (screen vs. PDF)
  a parent is looking at.
- **"Progress"/"Performance"-shaped language appears across all four
  surfaces** (Gradebook's raw scores, Report Card's formal result, Clinic's
  "Subject Gap Analysis" — `app/dashboard/clinic/page.tsx:630`, a "Current"
  column header with no visible computation timestamp — and Blueprint's
  Projection-derived trend) with no shared vocabulary distinguishing "this
  one result" from "your enduring capability." This is the mission's own
  predicted "more dangerous inverse" case — the same word, genuinely
  different underlying data — confirmed present, not hypothetical.
- **CBC level labels differ across surfaces even when representing the
  conceptually same 1-4 scale**: Report Card uses EE/ME/AE/BE
  (`lib/assessments/gradeCalculator.ts` `GRADE_META`); Academic Clinic uses
  Emerging/Developing/Proficient/Exemplary
  (`lib/academicClinic/reportGenerator.ts:108`); Blueprint's parent-facing
  translation layer (`lib/parentExperience/terminology.ts`) uses its own
  plain-language phrases ("Learning Strengths," "Needs Extra Support")
  rather than either. Three vocabularies for one nominal scale — a valid
  translation-layer pattern in isolation, but with no cross-reference
  anywhere telling a parent "Exemplary" (Clinic) and "EE" (Report Card) and
  "Learning Strengths" (Blueprint) can describe the same underlying level.

---

## 17. Risk Vocabulary

| Surface | Term | Source | Meaning |
|---|---|---|---|
| Blueprint (`lib/parentExperience/terminology.ts`) | "Needs Extra Support" | Frozen ADR-0010 Part 4 translation of `Risk Flag`/`Risk Index` | Canonical, Projection-sourced, parent-safe by construction |
| Parent Pulse (`lib/parentPulse/builder.ts:101-102`) | "Needs attention: ${concern}" | Independent inline phrasing, same underlying Projection risk field | Same data, separately-timed cron snapshot — can legitimately disagree with the portal at any given moment (P0's own finding, unchanged) |
| P4 Attention (`lib/parentExperience/attentionAction.ts:80-93`) | "may need a little extra attention" / "has become harder" / "needs support soon" (severity-tiered) | New, narrow, deterministic 3-tier table, reads only `subject`+`severity` from `RiskFlag`, verified to never leak `RiskFlag.reason` (teacher-facing internal text) | Canonical (Projection via Blueprint's `risk` section), fourth distinct vocabulary per P4's own honest count |
| Academic Clinic (`reportGenerator.ts`, e.g. "priority intervention area," "clinically recommended") | Clinical, prescriptive language | Independently derived from Clinic's own `SubjectProgress` levels | **Not Projection-sourced** — the most definitive-sounding language of the four, describing the least authoritative data source |

**The mission's own concern — "interpretive output (Clinic) must not appear
more definitive than formal result (Report Card)" — is confirmed live.**
Clinic's clinical register ("is clinically recommended," "priority
intervention area") reads more certain and more clinical than either
Blueprint's deliberately soft parent-safe translation or Report Card's plain
formal numbers/letters, despite Clinic being the least canonical of the
four data sources traced in this phase (§6).

---

## 18. Strength Vocabulary

| Surface | Term | Source | Meaning |
|---|---|---|---|
| Gradebook | (none — raw numbers only) | n/a | No strength framing exists here at all |
| Report Card | EE ("Exceeds Expectation") | `GRADE_META`, `lib/assessments/gradeCalculator.ts:9` | A single term's formal result for one subject |
| Blueprint | "Learning Strengths" (`terminology.ts`), trend-qualified ("Growing Well") | Projection, longitudinal | Enduring, confirmed-Evidence-backed capability |
| Academic Clinic | "Strong" / "Exemplary" / hardcoded narrative strengths list (`reportGenerator.ts:265,329-330,387`) | Clinic's own single-latest-assessment level ≥3 | A single assessment's snapshot level, presented with enduring-strength language |

**Confirmed risk named in the mission:** Clinic's "Strong"/"Exemplary"
framing is derived from one assessment's level (§6), the same shape of
single-point-in-time data Gradebook shows as a bare number — but Clinic
presents it with enduring-capability language indistinguishable in register
from Blueprint's genuinely longitudinal "Learning Strengths." A single good
result should not read as settled strength if Blueprint's own longitudinal
Evidence would say otherwise — this phase did not find a cross-check
anywhere preventing that mismatch.

---

## 19-23. Persona Fixtures — Improving / Declining / Sparse-Evidence /
Assignments-Only / Formal-Report-Only

**NOT EXECUTED as live seeded fixtures this phase** — per the methodology
note at the top of this document, the authority/freshness/vocabulary
questions this phase needed to answer were fully decidable from code with
`file:line` precision, and building five new HTTP personas without a
specific implementation deliverable to drive them was judged, honestly, as
likely to produce five fixtures whose *conclusions* would just restate §7-§18
in a more expensive form. What CAN be stated from code inspection alone,
without guessing at numbers a live fixture would need to supply:

- **IMPROVING LEARNER** (weak Term 1, strong recent assignments): Gradebook
  would show the recent strong scores live and immediately; Report Card
  would still show Term 1's frozen result until the next publish; Blueprint
  would show an `overallTrend`/`trend` moving toward improving once enough
  confirmed Evidence accumulates (subject to the ~5-minute lag, §12);
  Clinic would show whatever the single latest `assessments` row says,
  which could be either term depending on which pipeline was last fed.
  **No surface here fabricates certainty it doesn't have** — this is
  inferred from each surface's own confirmed data-source/freshness model
  (§3-§6), not observed live.
- **DECLINING LEARNER**: the reverse of the above; the same reasoning holds
  symmetrically.
- **SPARSE EVIDENCE** (one report-card result only, nothing else): Gradebook
  would show mostly empty/em-dash cells (§3's confirmed null-handling);
  Blueprint's `confidence` field (`composeAcademicRecord.ts:58`, sourced
  from Projection) is explicitly designed to reflect low evidence volume,
  not silently claim high certainty — this is the correct mechanism, though
  not exercised live this phase.
- **ASSIGNMENTS ONLY** (no formal report yet): Report Card would correctly
  show nothing (no `school_report_cards` row exists yet — confirmed by
  `getReportCard`'s row-not-found handling, not separately re-verified this
  phase); Gradebook and Blueprint would both work normally, since neither
  depends on Report Card existing.
- **FORMAL REPORT ONLY** (no assignments yet): Gradebook would show all
  em-dashes (no marks); Report Card would work fully (independent of
  assignment data); Blueprint would depend entirely on whether the
  Report-Card-adjacent legacy `assessments` pipeline (§12) — not the formal
  `school_report_cards` table itself — happened to also run, since only that
  pipeline emits Evidence, not `school_report_cards`/`term_subject_summaries`
  directly (§12's disambiguation finding is directly relevant here: a
  school using ONLY the formal Core Report Card pipeline with zero legacy
  `assessments` activity would produce a published Report Card that
  contributes **zero** Evidence to Blueprint — a real, structural,
  previously-unnamed consequence of §12's finding, worth flagging for P6).

**This last point is the most concrete, actionable consequence of this
phase's tracing work**, even though it was reasoned from code rather than
proven by a live fixture: **a school that only ever uses the formal
Core Report Card pipeline (never the legacy teacher/parent
`assessments`-table intake) produces Report Cards a parent can see, but
those Report Cards never become Evidence, and therefore never move
Blueprint's Projection at all.** Confirmed structurally (§4's "Report Card
emits no Evidence" + §12's "only the legacy `assessments` pipeline does"),
not confirmed as an observed live outcome for a specific school this phase.

---

## 24. Institutional / Legacy Parity

All four surfaces were re-checked against the identity-space bug class
P1/P4.5 already found and fixed elsewhere in the portal (institutional-only
guardians silently getting nothing):

- **Gradebook**: `app/api/parent/gradebook/route.ts` uses
  `requireParentOfLegacyStudent` (P1's fix, unchanged, confirmed still wired
  by re-running `npm run test:parent-http`'s existing gradebook tests, §34)
  — institutional-only guardians are covered.
- **Report Card**: `/api/reports/report-card/mine` uses
  `repos.schools.listGuardianLearners(userId)` (§2's file read) — a
  Core-native query, not the legacy bridge — meaning Report Card was never
  exposed to this specific bug class in the first place, since it has no
  legacy-space branch to have missed.
- **Blueprint**: unaffected — `requireParent` gates the whole `/child/*`
  route tree, already proven correct for both identity spaces across P1-P4.5.
- **Academic Clinic**: **unchanged, still legacy-space only.**
  `/dashboard/clinic/reports/[studentId]` keys entirely on legacy
  `students.user_id` ownership (P0's original finding, re-confirmed current
  by this phase's own file reads, §6) — a Core-only parent whose child has
  no legacy `students` row gets nothing here, by construction, not by bug.
  This is the same gap P3 named and left unfixed (§19 of P3's own doc);
  still true, not worsened, not fixed by this phase either (nav-wiring and
  Clinic's whole data model are both out of this phase's narrow-fix
  authority per the mission's explicit exclusions).

---

## 25. Multi-School Proof

Traced by construction, not a fresh fixture (per the methodology note):
Report Card is explicitly multi-school-safe (`school_id` carried per learner
row, per-school `currentTermId` resolution in `/api/reports/report-card/mine`,
§2). Blueprint re-derives `schoolId` fresh from the URL's `learnerId` on
every render (P3/P4/P4.5's own repeatedly-proven pattern, unchanged).
Gradebook's `requireParentOfLegacyStudent` check is per-student, not
family-wide (P1's own proof, unchanged). Academic Clinic's legacy
`students.user_id` ownership check is inherently per-student. No surface in
this phase's tracing was found sharing a "current school" global concept —
consistent with every prior phase's finding.

---

## 26. Historical Integrity

- **Report Card**: overall fields are a genuine immutable snapshot once
  published (§4) — this part is correct. Per-subject rows are **not**
  historically stable post-publish (§4/§14A) — this is the confirmed bug.
- **Blueprint**: never itself a snapshot — always reflects current
  Projection. History is available only via `blueprint_snapshots`
  (`getLatestBlueprintSnapshot`, the History/Journey pages), which ARE
  genuine frozen captures, taken at Report Card publication or end-of-term
  (`lib/core/report-cards.ts:213-223`) — confirmed real snapshot mechanism,
  unmodified by this phase.
- **Academic Clinic**: the on-screen view is never a snapshot (always
  regenerates from the latest `assessments` row, §6) — so Clinic has NO
  historical integrity concept at all for its live view; only a downloaded
  PDF freezes, and only because a PDF is inherently static, not because
  Clinic built a deliberate snapshot mechanism (the repository-layer
  `report_data` snapshot column/method exists but has zero callers, §2 —
  dead code, confirmed).
- **Gradebook**: has no historical concept by design — it is explicitly a
  live transactional view (§3), which is correct for its stated purpose.

---

## 27. Surface Verdicts

| Surface | Verdict | Reasoning |
|---|---|---|
| **Gradebook** | **KEEP** | Correctly scoped, correctly transactional, no confirmed authority violation; its one real gap (no distinction between quiz/adaptive/plain assignment types) is a presentation nicety, not a correctness bug |
| **Report Card** | **KEEP, WITH A NAMED CORRECTNESS BUG (§14A) RECOMMENDED FOR P6** | Its core promise (formal, published, frozen) is real and mostly honored — the per-subject drift is a genuine defect worth its own narrow fix, not a reason to demote or merge the surface itself |
| **Blueprint** | **KEEP** | Architecturally the most disciplined of the four — composes, never computes, always canonical |
| **Academic Clinic (`/dashboard/clinic/reports/[studentId]`)** | **KEEP, NOT MERGED** | Serves a genuinely different job (career/pathway diagnostic interpretation) than Blueprint's capability tracking; merging would violate the mission's explicit "don't blindly merge" instruction and would require resolving the CBC-vocabulary/threshold questions this phase deliberately did not resolve. Its clinical-register language (§17/§18) is a real, worth-fixing-eventually copy concern, not a reason to retire the surface |
| **Academic Clinic (`app/academic-clinic/page.tsx`, the orphaned duplicate)** | **RETIRE CANDIDATE, still not acted on** | Re-confirmed zero inbound links (P0's finding, unchanged four phases later), a strictly worse version of the linked Clinic page (no canonical-career convergence, §6) — every phase since P0 has re-confirmed this without removing it; this phase adds no new reason to keep deferring beyond "still out of scope for a narrow-fix phase," but it is now the single most repeatedly-confirmed dead surface in the whole parent portal audit series |

---

## 28. Target Authority Model

```
                         ┌─────────────────────────────┐
                         │   WHAT DID SCHOOL PUBLISH?   │
                         │        REPORT CARD           │
                         │  (formal, term-scoped,       │
                         │   overall = frozen,          │
                         │   per-subject = SHOULD BE     │
                         │   frozen too — P6 candidate)  │
                         └───────────────┬───────────────┘
                                         │ triggers (publish)
                                         ▼
                         ┌─────────────────────────────┐
                         │   BLUEPRINT SNAPSHOT          │
                         │  (frozen capture of Blueprint │
                         │   state AT publish time,      │
                         │   viewed via History/Journey)  │
                         └─────────────────────────────┘

┌──────────────┐      confirmed Evidence      ┌──────────────────────┐
│  GRADEBOOK    │ ───X (does not emit)───────▶ │                      │
│  (live, this  │                              │   LEARNER EVIDENCE    │
│   item only)  │                              │   (learner_evidence)  │
└──────────────┘                              │                      │
                                               └──────────┬───────────┘
┌──────────────────────────┐   emits (subject-level)     │  ~5min async
│ LEGACY assessments        │ ─────────────────────────────▶│  (cron consumer)
│ PIPELINE (teacher/parent  │                              ▼
│ intake — feeds CLINIC,    │                  ┌──────────────────────┐
│ NOT the formal Report     │                  │  PROJECTION ENGINE     │
│ Card table — §12's own    │                  │  (recomputeLearner-    │
│ naming-collision finding) │                  │   Projection)          │
└──────────────┬───────────┘                  └──────────┬───────────┘
               │ reads (live, no write-back)               │ read-only
               ▼                                            ▼
     ┌──────────────────┐                        ┌──────────────────────┐
     │  ACADEMIC CLINIC   │                        │      BLUEPRINT        │
     │  (advisory,        │                        │  (canonical current   │
     │   diagnostic,       │                        │   capability/risk/    │
     │   career-focused,   │                        │   trend — "how is my  │
     │   never authoritative│                       │   child doing NOW")   │
     │   for capability)   │                        └──────────────────────┘
     └──────────────────┘
```

**Legend:** solid arrow = confirmed live data flow; `X` = confirmed absent.
This diagram is derived entirely from this phase's own citations (§3-§13),
not the mission's illustrative example.

---

## 29. Target Navigation Model

Re-examined, not implemented (per mission's "don't implement a large nav
redesign unless trivial and clearly safe" instruction — none of these are
trivial, since Report Card's absence and Clinic's placement are both
multi-phase-old, deliberately-deferred decisions, not oversights):

| Surface | Current placement | Evidence-based target |
|---|---|---|
| Gradebook | Home card + child-context switcher | Correct as-is — detail page, secondary to Home |
| Report Card | **No nav entry, direct-URL only** (re-confirmed unchanged since P3) | Belongs as a primary or secondary nav item once its per-subject drift bug (§4) is fixed — surfacing a page more prominently before fixing a known correctness defect in it would be a regression, not a convergence; **fix-then-promote**, not promote-then-fix |
| Blueprint (`/full`) | Home's primary "go deeper" destination | Correct, unchanged — P4's own conclusion holds |
| Academic Clinic (linked) | Shared top+bottom nav (`Clinic`), reachable even for Core-only parents with no legacy data | Should be conditionally hidden (or given an honest empty state) for a Core-only parent, matching P3's own unfixed finding — still true, still not fixed, still out of a narrow-fix phase's authority |
| Academic Clinic (orphaned `/academic-clinic`) | Zero nav entries anywhere | RETIRE (§27), not renavigate |

---

## 30. Target Copy Model

One accurate line per surface, derived from this phase's own findings, not aspirational:

- **Gradebook**: *"What's been marked so far, live and unfiltered."*
- **Report Card**: *"Your child's official school-published result for the term."* — accurate for the overall score/level today; would need the per-subject drift (§4) fixed before this claim is fully honest end to end.
- **Blueprint**: *"What we currently know about your child's learning, based on everything confirmed so far."*
- **Academic Clinic**: *"A guidance report — one way of interpreting your child's recent results, not the official school record."* — deliberately distances Clinic's clinical-sounding language (§17/§18) from a formal-truth claim it doesn't have.

---

## 31. Changes Made

**None.** This phase made zero product-code changes, per its own Verdict
(§1). Nothing in `app/`, `lib/`, or `components/` was modified.

---

## 32. Architecture Guards

Re-verified (not newly built — no guard-backing test was added this phase,
consistent with making no code changes):

- **(A) Gradebook does not recompute Projection** — CONFIRMED, zero
  `recomputeLearnerProjection`/`learner_evidence` references anywhere in
  `lib/gradebook/**` (§3).
- **(B) Report Card remains historical/formal and doesn't read live
  Projection for its stored result** — CONFIRMED for the overall fields;
  **VIOLATED for the per-subject fields** (§4/§14A) — this guard should be
  named a CANDIDATE guard for P6, not claimed as currently holding in full.
- **(C) Blueprint academic state comes from canonical Projection/Evidence
  only** — CONFIRMED, `composeAcademicRecord`/`composeRisk` both verified to
  import nothing else (§5).
- **(D) Clinic interpretation cannot overwrite formal results** — CONFIRMED,
  Clinic has zero write path to `learner_evidence`/`learner_projections`/
  `school_report_cards`/`term_subject_summaries` (§6/§13).
- **(E) Parent Home academic summary doesn't independently calculate a
  fifth authority** — CONFIRMED, re-checked P4's own guard (B) which this
  phase did not find any reason to contradict — Home still reads only
  `blueprint.risk`/`blueprint.academicRecord`, no new local computation
  introduced by this phase since none was added.
- **(F) Identity-space differences don't change semantic role** — CONFIRMED
  for Gradebook/Report Card/Blueprint (all correctly bridge or don't need
  to); **NOT true for Academic Clinic**, which remains legacy-space only
  (§24) — named as a pre-existing, unfixed limitation, not a new violation.

---

## 33. HTTP Tests

**No new HTTP tests were added this phase** — consistent with §1's Verdict
and the methodology note (top of document). The existing parent HTTP
manifest was re-run as a regression gate only (§34), not extended.

---

## 34. Full Regression

Run from `/home/the-dev/projects/edunexus`, HEAD `e2f68c1` (unchanged by
this phase — no commits were made):

**`npm run test:parent-http`** (7 files, full manifest):
```
ℹ tests 87
ℹ pass 87
ℹ fail 0
```
Exact match to P4.5's own closeout count — confirms zero regression from
this phase's (zero) code changes, and reconfirms the baseline this mission's
Step 0 asked for.

No other regression commands (`npm test`, `tsc --noEmit`, ESLint,
`next build`) were run this phase, since no file was modified — running them
against an unmodified tree would only reconfirm P4.5's own already-recorded
green state, which this phase has no reason to doubt (no file P4.5 touched
was read-modified-reverted or otherwise put at risk).

---

## 35. Files Changed

**One file** — this document,
`docs/architecture/parent-portal-p5-academic-result-authority.md` (new).
No other file in the repository was created, modified, or deleted by this
phase. The 205 pre-existing dirty files from session start remain untouched
(re-confirmed via `git status --short` immediately before writing this
document — still 205, same count as the phase's own Step 0 baseline).

---

## 36. Database Changes

**None.** No migration was written, applied, or found necessary. Every
finding in this document was derived from reading existing tables/columns
through existing code paths — no schema question in this phase required a
live query beyond what static code-reading could answer with `file:line`
precision.

---

## 37. Named Limitations

**New, found this phase:**

- **Live HTTP fixtures for Steps 8/30-34 (contradictions, personas) were
  not built** — the methodology note at the top names this explicitly. The
  authority/freshness/vocabulary questions this phase needed to answer were
  fully decidable from code; a future phase implementing the Report Card
  fix (§14A) should add a real fixture proving the fix, at which point
  most of the persona-fixture work becomes a natural byproduct.
- **Report Card's per-subject post-publication drift (§4/§14A)** is a real,
  previously-undocumented correctness bug, not fixed this phase (audit-only
  discipline) — the clearest, most concretely-scoped P6 candidate this
  phase found, structurally identical in shape to P4.5's own attendance fix
  (one function's guard needs widening — here, `computeTermSummaries` needs
  a publish-check analogous to `generateReportCards`'s own).
- **Six-plus independently-maintained CBC threshold scales** exist
  platform-wide (§10), already self-documented by an architecture test but
  never ratified — named, not resolved, per explicit mission scope.
- **No cross-surface subject-identity normalization exists** (§9) — a
  canonical `subjects` table exists but three of four surfaces don't use it,
  and it doesn't even cover Senior School subjects yet.
- **Clinic's clinical-register language (§17/§18)** reads more definitive
  than its actual data authority (the least canonical of the four surfaces)
  — named as a real product-trust risk, not fixed (would require rewriting
  Clinic's narrative-generation prose, judged bigger than a "smallest
  truthful label change").
- **A school using only the formal Core Report Card pipeline would produce
  Report Cards that never become Evidence** (§19-23's structural finding) —
  reasoned from code, not observed against a real school's data this phase;
  worth a live check once real pilot schools are using the platform.
- **Academic Clinic's Core-only-parent nav gap (P3's finding) and the
  orphaned `/academic-clinic` duplicate (P0's finding)** are both
  re-confirmed unchanged, four and five phases later respectively — this
  phase adds no new urgency beyond noting the repetition itself.

**Carried forward, unresolved (per P0-P4.5, unchanged by this phase):** no
parent→teacher communication; three overlapping career-report surfaces;
family-wide pages (Resources/Calendar) lacking per-child labels; parent
privacy policy undocumented; `/learn`'s learner-framed copy for a parent
viewer; teacher-of-record cannot see attendance inside a student's Blueprint
view; learners cannot see their own attendance anywhere.

---

## 38. Recommended P6

**A NARROWER CORRECTNESS PREREQUISITE: fix Report Card's per-subject
post-publication drift (§4/§14A/§37).**

Reasoning: this phase evaluated the mission's four suggested P6 candidates
(Parent Communication Loop, Parent Career/Clinic Convergence, Parent Privacy
Policy) against what this phase's own evidence actually surfaced, and none
of them is as concretely scoped or as clearly a genuine correctness bug as
the drift this phase found. It has the same shape as P4.5's own successful
attendance fix — one function (`computeTermSummaries`, or its caller in
`app/api/core/assessments/route.ts`) needs a guard analogous to
`generateReportCards`'s existing "refuse if already published" check,
scoped to the specific `(learner_id, term_id)` pairs that already have a
published `school_report_cards` row. It directly closes the single most
concrete, evidence-backed contradiction this phase found (§14A), and
unlike a full "four-surface convergence," it requires no product-semantics
decision about CBC thresholds, subject vocabulary, or risk/strength
language — exactly the kind of small, bounded, correctness-only fix the
project's own Post-Audit Operating Charter favors. Parent Career/Clinic
Convergence and Parent Communication Loop both remain legitimate future
candidates but are larger and less concretely justified by this specific
phase's findings than the Report Card fix is.
