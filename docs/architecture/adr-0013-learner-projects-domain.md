# ADR-0013 — Learner Projects Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Projects implementation sprint.** Design-freeze document only. No table, migration, repository, service, API, route, UI, media, upload, or QR mechanism was created or modified in producing it — confirmed: this document, `sprint-12y-learner-project-domain.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Projects implementation sprint (not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: nothing outright. **Touches** `adr-0011-learner-portfolio-architecture.md` Phase 10's `projects` category (see "Relationship to ADR-0011" below) without superseding it — Portfolio's existing category is unchanged today; this ADR only freezes what it becomes once Projects exists.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (Blueprint ownership discipline), `adr-0006-blueprint-educational-experience.md` (Evidence→Meaning→Action pattern), `adr-0007-blueprint-layout-and-experience.md` §11 (QR philosophy), `adr-0008-blueprint-lifecycle-and-rendering.md` (Snapshot/immutability precedent), `adr-0009-blueprint-presentation-architecture.md` (presentation-layer discipline), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern), `adr-0011-learner-portfolio-architecture.md` (Portfolio's own frozen definition and "compose, never own" discipline, and the `projects` category this ADR disambiguates), `adr-0012-learner-achievement-domain.md` (the identical "verifiable claim gets its own domain, raw artefact stays with its originator" split this ADR now applies a layer earlier, to the work itself), `adr-0003`/`adr-0004` (Attendance domain/derived-data precedent, referenced for the same "expiry/trust is computed, not a fabricated stored judgment" discipline), `reference-architecture-specification.md` §3 (Canonical Domain Standards), Educational Constitution.

---

## Why This ADR Exists

Portfolio (ADR-0011) already has a category literally named `projects` — but it is a free-form artefact label, not a project: no goal, no lifecycle, no team, no mentor, no verification, no relationship to Evidence beyond an optional reference. Achievement (ADR-0012) owns the verifiable *claim* a project might earn (a competition placing, an innovation award) but explicitly never the underlying work itself (ADR-0012 Phase 3: "Raw creative/digital artefacts... Learner Portfolio, unchanged"). Neither domain, nor any other in the codebase, owns the actual *thing a learner built*: the CBC project, the STEM prototype, the research paper, the community initiative — its goal, its stages, its team, its mentor, its own evidence trail across weeks or months. Without a frozen owner, a future feature would either bolt project-tracking onto Portfolio (turning its one artefact-label field into an entire domain by accident, the exact naming-collision risk this ADR's own Phase 1 confirms is already live) or invent a second, uncoordinated system — the same failure mode ADR-0011/0012 already prevented once each. This ADR freezes Projects' definition, ownership, and every cross-domain relationship once, before a single table exists.

---

## Core Question

**A learner's Portfolio shows what they made. Achievement shows what was recognized. What owns the actual work in progress — the goal, the plan, the team, the mentor, the weeks of effort — so it never collapses into, or duplicates, Portfolio, Achievement, Evidence, or Blueprint?**

**Answer**: Learner Projects is a new, permanent canonical domain — the learner's structured record of a piece of work undertaken with a goal, from start to completion — that Portfolio *references* (never re-implements), that Achievement *references* (never re-implements), that Blueprint *summarizes* (never renders in full), and that draws its underlying facts from Evidence without duplicating a single one of them. **A Project is the work. Portfolio is the shelf it sits on. Achievement is the medal it might earn.**

---

## Phase 1 — Audit (mandatory, done first)

Searched the entire codebase for every term this mission named, reading implementations, not trusting filenames.

**A naming collision was found — and it is the sharpest one this ADR series has produced yet.** `lib/learnerPortfolio/types.ts` and its migration (`supabase/migrations/20260717160000_learner_portfolio.sql`) already define a Portfolio category literally named **`projects`**. Read closely, this is not a project-tracking system: it is one label among ten (`projects, creative_work, research, presentations, writing, design, photography, programming, media, other`) on a `portfolio_items` row that has a title, description, optional reflection, and an optional Evidence reference — no goal field, no start/completion dates, no team, no mentor, no verification workflow, no lifecycle beyond Portfolio's own generic Draft→Verified→Published→Archived. **Verdict: Portfolio's `projects` category cannot become, and must not be confused with, the canonical Learner Projects domain.** This mirrors ADR-0011 Phase 1's own finding about Academy's unrelated "Portfolio" almost exactly — a real word-collision risk, not an ownership decision by itself. See "Relationship to ADR-0011" below for how this is resolved without a code change today.

**A second, unrelated collision was found and dismissed.** `lib/projection/` (`capabilityProjector.ts`, `riskProjector.ts`, `knowledgeProjector.ts`, `growthProjector.ts`, `trendProjector.ts`, `behaviourProjector.ts`, `academicProjector.ts`, `completenessProjector.ts`, `capabilityV2Projector.ts`, `knowledgeV2Projector.ts`) and the `learner_projections` table are the **Learner Intelligence Projection Engine** — the computed-state layer (capability/risk/knowledge/growth scores derived from Evidence, per `docs/architecture/learner-record-layer-decisions.md`). "Projection" and "Projects" share five letters and nothing else: Projection computes a number from Evidence; Projects will record a learner's own undertaken work. **Not the same domain, not adjacent, not reusable — a pure vocabulary collision, flagged here once so no future document conflates the two.**

**A third near-hit was found and read in full, then dismissed.** `assignments`/`assignment_submissions` (legacy tables, pre-dating the `supabase/migrations/` convention) plus `lib/assignments/evidence.ts` (Sprint 9's Evidence producer for teacher-marked assignments) is a **scored classwork** feature: a teacher issues an assignment, a student submits, a teacher marks it against a `max_score`, and the mark becomes Evidence via `recordAssignmentMarkEvidence()`. It has no goal field, no team, no mentor, no multi-week lifecycle, no artifacts beyond an implicit submission, and its own code comment explicitly rules out "project work" as one of several Evidence-producer candidates it deliberately did *not* build for lack of "a real capture feature in EduNexus today." **Confirms, from the inside, that no project-tracking capability exists — Assignments remains scored classwork, untouched, not a candidate for reuse or renaming.**

**Every other searched term** (`learner_project`, `student_project`, `research_project`, `innovation_project`, `cbc_project`, `capstone`, `submission` beyond Assignments' own, `artifact` beyond Evidence's generic use of the English word, `prototype`, `maker`/`makerspace`, `stem` as a project concept, `digital product`, `coding project`, `project rubric`, `project evidence`, `project assessment`) **returned no matching domain, table, or module.** Confirmed by grepping every migration for `CREATE TABLE.*project` (only `learner_projections`, already dismissed above, and `evidence_projection_events`, an unrelated Projection-Engine event-log table) and by grepping the full `lib/`/`app/`/`components/` tree for each term and reading every hit.

**No canonical Learner Projects domain exists. A new domain is the correct, non-duplicative outcome — verified, not assumed, matching this ADR series' own established discipline.**

| Candidate | Verdict |
|---|---|
| `lib/learnerPortfolio/` `projects` category | Adjacent, naming-collision risk — a raw artefact label, not a project. See "Relationship to ADR-0011." |
| `lib/projection/`, `learner_projections` | Unrelated — pure vocabulary collision ("Projection" ≠ "Projects"), dismissed. |
| `assignments`/`assignment_submissions`, `lib/assignments/evidence.ts` | Adjacent, legacy — scored classwork, structurally distinct, confirmed by its own code comments. Untouched. |
| `lib/academy/` (rubric, aiJudge, missions) | Unrelated — teacher professional-development, already flagged twice (ADR-0011, ADR-0012). |
| Everything else searched | No hit of any kind. |

---

## Phase 2 — Definition (frozen)

**A Learner Project is a structured, evidence-backed record of a piece of work a learner undertakes toward a stated goal — from planning through completion — distinct from a scored assignment (no goal, no lifecycle beyond a mark), a Portfolio entry (a finished artefact with no undertaking-in-progress concept), and an Achievement (a verified *claim about* a project, never the project itself).**

| Relationship | Frozen rule |
|---|---|
| **Evidence** | Projects reference Evidence, never duplicate it (identical discipline to Portfolio/Achievement — see Phase 7). |
| **Blueprint** | Blueprint summarizes Projects (count, latest, featured) exactly as it already summarizes Portfolio/Achievement/Career — never the full record. |
| **Portfolio** | Portfolio *references* Projects — a Portfolio entry may point at a completed Project as its basis, but Portfolio never re-implements project lifecycle/goal/team/mentor fields. Portfolio owns the *curation and presentation choice* ("I want to feature this on my Portfolio"), never the underlying work record. |
| **Achievement** | Achievement *references* Projects the same way — a verified competition result or innovation award may cite the Project it recognizes, never copy the Project's own fields. |
| **Career Intelligence** | Reads Projects (e.g., "this learner has three Technology-category projects") as one more evidence input into orientation-level judgment — never writes to Projects, never asserts a career-relevance score on a Project. |
| **Learning Compass** | Reads Projects for learning-guidance context only (e.g., a project's declared subject/skill area informing what to recommend next) — never verifies, scores, or owns a Project. |
| **Assessment / Marks / Competencies** | Untouched. A Project may *reference* Evidence that happens to originate from an assessment, but Projects never becomes a second marks/competency store — this is the same boundary Portfolio and Achievement already keep from Report Cards. |
| **Attendance** | No relationship. A Project's own dates (start/completion) are project-scoped facts, never derived from or feeding into Attendance. |

---

## Phase 3 — Ownership Matrix (frozen)

One owner per field, no exceptions:

| Field / Concern | Owner |
|---|---|
| Title | Learner Projects |
| Description | Learner Projects |
| Goal | Learner Projects |
| Category | Learner Projects |
| Status (lifecycle) | Learner Projects |
| Start date | Learner Projects |
| Completion date | Learner Projects |
| Artifacts (link-out references, never embedded files — see Phase 8/Forbidden list) | Learner Projects |
| Team info (collaborators, roles) | Learner Projects |
| Reflection (the learner's own reflection on the project) | Learner Projects |
| Mentor (a named supporting adult, distinct from Verifier) | Learner Projects |
| Verification (who confirmed the project happened/was completed as described) | Learner Projects |
| Portfolio organization (which Portfolio section a Project's reference sits under, curation/publish choice) | Learner Portfolio |
| Recognitions (any award/competition-result/certificate tied to a Project) | Learner Achievement |
| Blueprint summary (count/latest/featured/URL) | Learner Blueprint (reads only, computes nothing) |
| Career-relevance interpretation | Career Intelligence (reads only) |
| Learning-guidance interpretation | Learning Compass (reads only) |

**Projects owns only Projects.** It does not own a score (Report Cards'), does not own curated presentation (Portfolio's), does not own verified-claim status of an external recognition (Achievement's), and does not own any interpretive judgment (Career's/Compass's).

---

## Phase 4 — Categories (frozen; open extension point, not open text)

**Frozen, sixteen categories**: Academic, CBC, Research, Innovation, Technology, Creative Arts, Music, Drama, Business, Agriculture, Engineering, Community, Environmental, Leadership, Entrepreneurship, Digital.

Deliberately a closed enum, not free text — matching Portfolio's and Achievement's own already-frozen category discipline (CLAUDE.md: no category free-text explosion). "Open category extension" means future categories are added by a future ADR amendment naming and reasoning each one explicitly (the same discipline ADR-0012 Phase 8 already modeled — three candidate categories rejected there with named reasoning, not silently allowed to proliferate), never by a caller passing an arbitrary string at write time.

**Deliberately excluded from this list, with reasoning**: `Leadership` and `Entrepreneurship` appear here as Project *categories* (the project's subject domain) but must never be confused with Achievement's own `leadership`/`entrepreneurship` achievement-type or category values (ADR-0012 Phase 2/8) — a Leadership-category Project (e.g., "organized a peer-tutoring initiative") is the raw undertaking; if that undertaking earns formal recognition, *that* recognition is a separate Achievement record referencing this Project, never a re-classification of the Project itself into an Achievement.

---

## Phase 5 — Lifecycle (frozen, every state reasoned)

```
Draft → Planning → In Progress → Submitted → Reviewed → Verified → Published → Archived
                                      │            │
                                      └─▶ Rejected  └─▶ (verification fails, terminal)
                          Cancelled reachable from Draft/Planning/In Progress only
```

| State | Meaning |
|---|---|
| **Draft** | The learner (or a teacher on a learner's behalf) has started recording a project idea — not yet a committed undertaking. |
| **Planning** | The goal, category, and team are set; work has not yet started. Distinguishing Planning from Draft matters because a CBC project's planning phase is itself pedagogically meaningful (the Constitution's evidence-first discipline extends to *process*, not only outcome) and deserves its own visible state, not a silent internal flag. |
| **In Progress** | Active work is underway. The project's `start` date is set on entry to this state (frozen: never backdated by a later status change). |
| **Submitted** | The learner considers the work complete and has submitted it for review — mirrors Portfolio's own Submitted-equivalent step (ADR-0011's original brief; Achievement deliberately has no such state per ADR-0012 Phase 4, because Achievement records a claim about work already done elsewhere, while a Project *is* the work, so an explicit "I'm done, please look" moment is meaningful here in a way it wasn't for Achievement). |
| **Reviewed** | A teacher/mentor has looked at the submission and given feedback — distinct from Verified, because review (formative, feedback-oriented) and verification (a factual "this happened as described" confirmation, Phase 6) are different acts with different authority requirements; collapsing them would force every reviewing teacher into a verification role even when they're not the declared Verifier. |
| **Verified** | The declared Verifier (Phase 6) has confirmed the project's core facts (it happened, roughly as described, by this learner/team). Required before Published — no Project skips this state, identical discipline to Achievement's own non-negotiable Verified gate (ADR-0012 Phase 4). |
| **Published** | Visible beyond the school-internal audience per the Phase 8/visibility discipline every prior domain in this series already established. Immutable from this point except the one legal transition to Archived (Phase 9's constitutional-compliance section extends the identical trigger-enforced discipline Portfolio/Achievement/Teacher Reflection/Blueprint Snapshots already have). |
| **Archived** | Retention-only end state — the project is no longer active but remains a permanent record, matching every other domain's now-established Archived meaning in this codebase. |
| **Rejected** | Reachable only from Submitted/Reviewed when verification fails — a distinct terminal state from Cancelled (a Rejected project was completed and *claimed* finished but couldn't be verified as described; a Cancelled project was abandoned before completion — these are different facts worth keeping distinguishable, the same reasoning ADR-0012 Phase 4 used to keep Rejected distinct from Revoked). |
| **Cancelled** | Reachable only from Draft/Planning/In Progress — the learner or teacher stopped the project before submission. Never reachable from Submitted onward (once submitted, the only terminal paths are Verified→Published→Archived or Rejected — a submitted claim doesn't get quietly withdrawn, it gets a real disposition, matching Achievement's "no silent status flip" discipline). |

**Rejected as unnecessary, matching Achievement's own precedent (ADR-0012 Phase 4)**: a separate "Expired" state. A project has no natural expiry the way a certificate does; if this changes for a specific category in a future ADR amendment, it will follow the same "expiry is data, computed at read time, never a stored mutable status" rule already frozen for Achievement.

---

## Phase 6 — Verification (frozen ownership, trust never computed in Blueprint)

| Verification type | Who confirms | Frozen meaning |
|---|---|---|
| **Teacher verified** | The learner's own teacher, internal to the school | The default, lowest-friction path — a teacher directly attests the project happened, mirrors Achievement's own "may be the same school actor" allowance (ADR-0012 Phase 9). |
| **School verified** | A school admin/headteacher, not necessarily the project's own teacher | For projects without a single obvious owning teacher (e.g., a whole-class community initiative). |
| **Competition verified** | An external competition/event organizer's confirmation, evidenced by a document reference (mirrors Achievement's `verifying_document_reference` pattern, ADR-0012 Phase 5) | Used when a Project's completion is confirmed by having been entered into/judged at an external event — this is *completion* verification, never to be conflated with the *separate* Achievement record that would exist if that competition awarded a placing. |
| **External verified** | Any other non-competition external party (a mentor organization, a university partner) with a named identity and reference | Reserved, exact data model deferred to the first implementation sprint — frozen here only as a named, distinct category from Competition verified. |
| **Self only** | The learner's own claim, unconfirmed by any staff or external party | The honest default for a project that hasn't yet been through Submitted→Verified — never conflated with a real verification; a Project in this state can never reach Published (Phase 5's non-negotiable gate). |
| **Pending** | Submitted, awaiting a Verifier's action | A queue state, not a trust judgment — carries no implied confidence level of its own (Constitution Article XI: a bare status is never silently read as a score). |
| **Expired** | **Rejected as a stored verification state**, identical reasoning to Phase 5's rejection of a stored "Expired" lifecycle state — if a verification's validity window matters for some future project category, that is a computed, read-time fact derived from a date field, never a mutable stored status requiring a background job to flip it. |

**Projects owns verification, permanently.** Blueprint never computes, infers, or re-derives a trust/verification judgment about a Project independently — it reads whatever verification state Projects itself already recorded and displays it as-is (or, per Phase 5's summary discipline, doesn't display verification detail at all beyond "this project is Published," since Published already implies Verified was satisfied). This is the identical rule ADR-0012 Phase 9 already froze for Achievement's own confidence-via-lifecycle-state discipline, applied here to a second domain.

---

## Phase 7 — Relationships (frozen, one direction only)

```
Projects → Evidence
Projects → Achievement   (Achievement references a Project; never the reverse write)
Projects → Portfolio     (Portfolio references a Project; never the reverse write)
Projects → Blueprint     (Blueprint summarizes; never the reverse write)
Projects → Career        (Career reads; never writes)
Projects → Learning Compass (Compass reads; never writes)
```

Every arrow is Projects-as-source. **Ownership never reverses.** No other domain may write a Project field, re-derive a Project's status, or store a second copy of a Project's own data — the identical "reference, never copy" discipline ADR-0011 Phase 7 and ADR-0012 Phase 5 already froze for Evidence, applied here one layer earlier, to the work itself. A Project *optionally* references one or more Evidence rows as its supporting basis (mirroring `supporting_evidence_ids`, the pattern every domain in this series now shares) — not every Project needs Evidence backing (a purely creative undertaking may have none), but where Evidence exists for a claim a Project makes, the Project references it rather than restating it.

---

## Phase 8 — Paper vs Digital (frozen, extending ADR-0011 Phase 9's established split)

- **Paper**: summary only — the same small counts/highlights pattern Portfolio and Achievement already carry to Blueprint's paper surface (Phase 9 of this ADR's own Constitutional Review). Never a full project write-up on paper.
- **Digital**: everything — every Project's full record, at full depth. Digital is Projects' native, primary surface, exactly as it is for Portfolio.
- **QR**: reserved, future only (ADR-0007 §11's already-frozen mechanism) — not designed further here, not implemented.

**No implementation of any of this in this sprint** — frozen as target-state architecture only, per this ADR's own Stop Condition.

---

## Phase 9 — Constitutional Review

- **Educational Constitution Article I** (Evidence is the only currency of truth) — Phase 7's reference-not-copy rule keeps Evidence the single source of observational truth; a Project without Evidence backing is still valid (matching Portfolio's identical allowance) but never claims evidentiary weight it doesn't have.
- **Article II** (Missing evidence is never poor performance) — a learner with zero Projects is never treated as deficient; Projects is additive, identical to Portfolio/Achievement's own frozen posture.
- **Article VI/IX** (AI explains, never invents) — satisfied trivially: no AI feature exists in this domain's frozen scope at all (Forbidden list).
- **Article XI** (a number without a name is not neutral) — Phase 6 explicitly rejects a numeric trust/confidence score for verification, expressing it entirely through named states instead, identical to Achievement's own Article XI compliance.
- **RAS §3** (Canonical Domain Standards) — Learner Projects is declared here as a new canonical domain with one repository/service (reserved for implementation), confirmed non-duplicative by Phase 1's audit.
- **RAS §10 rules 7–8** (no duplicated business logic, no cross-domain ownership) — Phase 3/7 satisfy both directly.
- **ADR-0003/0004** (Attendance domain / derived-data discipline) — Phase 5/6's "never a stored Expired state" rules are direct extensions of ADR-0004's own precedent, applied to a third and fourth domain.
- **ADR-0005** (Blueprint ownership) — Phase 3's ownership matrix follows the identical one-field-one-owner discipline ADR-0005 established.
- **ADR-0006** (Evidence→Meaning→Action) — a future Projects summary reaching Blueprint must satisfy this same pattern, exactly as Compass/Career/Portfolio/Achievement already do.
- **ADR-0007 §11** (QR philosophy) — Phase 8 explicitly extends, not reinterprets, the existing QR discipline.
- **ADR-0008** (Lifecycle/Snapshot/immutability discipline) — Phase 5's Published-immutable-except-Archived rule is a direct extension of the identical rule Portfolio/Achievement/Teacher Reflection/Blueprint Snapshots already enforce at three layers (repository/service/DB trigger) — Projects' own future implementation must match that same three-layer enforcement, not a subset of it.
- **ADR-0009** — Projects' own future presentation surface is reserved for a future ADR extension at implementation time, not decided in full here, identical to Portfolio's own posture (ADR-0011 Phase 14).
- **ADR-0010** (Parent Experience) — a future Projects summary reaching Parent Portal does so exclusively via Blueprint, never a direct Parent read of Projects — identical to every prior domain's frozen visibility discipline.
- **ADR-0011** (Portfolio) — see "Relationship to ADR-0011" below; touched, not superseded.
- **ADR-0012** (Achievement) — Phase 2/7's reference-only relationship is the identical discipline ADR-0012 Phase 6 already froze for Portfolio-composes-Achievement, applied here to Achievement-references-Projects.

**Zero conflicts found.**

### Relationship to ADR-0011 (explicit, not a supersession — a frozen future disambiguation)

ADR-0011 Phase 10 named `Projects` as a Portfolio category — correct at the time, since no better-owning domain existed yet (the identical situation ADR-0012's own "Relationship to ADR-0011" section already described for Competitions/Leadership/etc., and resolved the same way). This ADR does **not** supersede that category today — Portfolio's `projects` category remains exactly as-is, unchanged, until a future Projects implementation sprint exists. What is frozen here, for that future sprint to execute rather than decide fresh: **once Learner Projects exists, a Portfolio entry under the `projects` category should reference a Project entity (via a nullable `project_id`-style link) rather than standing alone as a raw, unstructured artefact** — the same "provisional category becomes a reference" pattern ADR-0012 already established for Competitions/Leadership/Certifications/Awards/Innovation/Recommendations. This is named and reasoned now, in advance, specifically so a future implementation sprint does not have to re-litigate it or, worse, silently invent an ad-hoc link between the two domains under schedule pressure.

---

## Phase 10 — Risks (documented, not mitigated by implementation — mitigated by this ADR's own constraints)

| Risk | How this ADR prevents it |
|---|---|
| **Project duplication** (a second Projects-like system invented later) | Phase 1's audit is now the permanent record that none existed at this ADR's writing; Phase 3's ownership matrix is the permanent reference for "does a new feature need its own project store" |
| **Fake verification** | Phase 6's named verification-type discipline plus Phase 5's non-negotiable Verified gate before Published — identical mechanism to Achievement's own "fake certificates" prevention (ADR-0012 Phase 11) |
| **AI-generated work presented as a learner's own** | Not addressed by implementation because it isn't a risk this domain's frozen scope introduces — no AI feature is in scope at all (Forbidden list); every Project's existence and content is human-entered, human-verified |
| **Ownership drift** (Projects slowly absorbing Portfolio/Achievement/Evidence responsibilities, or vice versa) | Phase 3's frozen matrix plus Phase 7's one-directional arrows are the permanent reference a future PR reviewer or architecture-guardian pass checks against |
| **Portfolio duplication** | The explicit "Relationship to ADR-0011" resolution above — Portfolio references, never re-implements |
| **Achievement duplication** | Phase 2's frozen rule — Achievement references a Project, never copies its fields |
| **Evidence duplication** | Phase 7's reference-not-copy rule, mirroring every prior domain's identical `supporting_evidence_ids` pattern |
| **Teacher ownership confusion** (who's accountable for a Project — the Mentor, the Verifier, or the class teacher?) | Phase 3 keeps Mentor and Verifier as two explicitly separate fields/roles, never conflated — a future implementation must resist collapsing them for convenience |
| **External verification abuse** (a learner or teacher fabricating an external verifier) | Named as a first-implementation-sprint concern requiring a real verifying-party data model (Phase 6's "External verified"/"Competition verified" rows), not solved by this ADR alone — flagged explicitly, not silently assumed safe |
| **Storage growth / media lifecycle / future uploads** | Not decided by this ADR (no storage/upload system is in scope, matching Portfolio's own identical deferral in ADR-0011 Phase 13) — Phase 8 freezes only that artifacts are link-out references, never embedded files, until a dedicated future sprint designs storage strategy properly |

---

## Verification Against Mission's Checklist

- One owner — Phase 3.
- No duplicated ownership — Phase 3/7, confirmed against every adjacent domain including the explicit Portfolio disambiguation.
- Portfolio only references Projects — Phase 2/7, and the explicit "Relationship to ADR-0011" resolution.
- Blueprint only summarizes Projects — Phase 2/8, identical discipline to Portfolio/Achievement's own Blueprint treatment.
- Achievement only references Projects — Phase 2/7.
- Career reads only — Phase 2/7.
- Compass reads only — Phase 2/7.
- Constitution compliant — Phase 9.
- RAS compliant — Phase 9.
- No architectural conflicts — Phase 9, zero found.

---

## Stop Condition

This ADR, `sprint-12y-learner-project-domain.md`, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** Do not build UI, uploads, media, repository, services, routes, database, migrations, APIs, QR, or any Blueprint/Portfolio/Achievement/Career/Learning Compass integration. No code. Wait for explicit approval before the first Learner Projects implementation sprint (Sprint 12Z, per the user's own named sequence).
