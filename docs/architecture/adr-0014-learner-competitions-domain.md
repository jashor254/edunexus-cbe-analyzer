# ADR-0014 — Learner Competitions Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Competitions implementation sprint (Sprint 13B).** Design-freeze document only. No table, migration, repository, service, API, route, UI, media, upload, certificate, or QR mechanism was created or modified in producing it — confirmed: this document, `sprint-13a-learner-competitions-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Competitions implementation sprint (13B, not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: `adr-0012-learner-achievement-domain.md` Phase 2's `competition` `AchievementType` entry, **partially and explicitly** — see "Relationship to ADR-0012" below. Achievement's `competition` type is not removed or renamed; what changes is that it becomes a *reference* to this domain rather than a free-standing claim, the same "provisional becomes a reference" pattern ADR-0012 already applied to ADR-0011's Portfolio-owned Competitions row, and ADR-0013 already reserved for Portfolio's `projects` category. Does not supersede any other prior ADR.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (Blueprint ownership discipline), `adr-0006-blueprint-educational-experience.md` (Evidence→Meaning→Action pattern), `adr-0007-blueprint-layout-and-experience.md` §11 (QR philosophy), `adr-0008-blueprint-lifecycle-and-rendering.md` (Snapshot/immutability precedent, "Historical" freshness vocabulary), `adr-0009-blueprint-presentation-architecture.md` (presentation-layer discipline), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern), `adr-0011-learner-portfolio-architecture.md` (Portfolio's frozen definition, its original provisional Competitions row, and "compose, never own" discipline), `adr-0012-learner-achievement-domain.md` (the verifiable-claim/raw-artefact split this ADR now applies to competitive events specifically, and the `competition` AchievementType this ADR disambiguates), `adr-0013-learner-projects-domain.md` (the "Competition verified" Project-verification category this ADR is the eventual referent of, and the identical "touches but does not supersede" discipline applied here to ADR-0012), `adr-0003`/`adr-0004` (Attendance domain/derived-data precedent — position/result is recorded fact, never computed by this domain), `reference-architecture-specification.md` §3 (Canonical Domain Standards), Educational Constitution.

---

## Why This ADR Exists

Sprint 12AA's Guardian Audit and every prior domain ADR already found "Competitions" mentioned as a candidate concept three separate times — provisionally assigned to Portfolio (ADR-0011 Phase 3), reassigned to Achievement as a `competition` sub-type carrying only a title/organization/date (ADR-0012 Phase 2/3), and named as the eventual referent of Projects' "Competition verified" verification category (ADR-0013 Phase 6) — without ever becoming its own domain. Each of those was the correct call *at the time*, exactly as ADR-0012 and ADR-0013 themselves say about their own predecessors' provisional assignments. It is no longer correct: a competition is not merely a claim to verify (Achievement) or a raw artefact (Portfolio) — it is a real-time process with its own actors (team, mentor, judges), its own multi-week timeline (registration through results), and its own evidence trail, none of which any existing domain's frozen definition covers. Without a frozen owner, a future feature would either keep bolting fields onto Achievement's flat `competition` type (forcing team membership, mentor, judges, and a live registration/participation timeline into a domain whose entire design assumes a claim is recorded *after* the fact) or invent a second, uncoordinated system — the exact failure mode this whole ADR series exists to prevent. This ADR freezes Competitions' definition, ownership, lifecycle, and every cross-domain relationship once, before a single table exists.

---

## Core Question

**A learner enters a real, live, multi-week competitive process — registering, preparing, competing, being judged. Achievement can record that they won something afterward. Neither Achievement nor Portfolio can represent the process itself, or the team, mentor, and judges involved in it. Who owns that process, and how does every domain that needs its outcome (Achievement, Portfolio, Blueprint, Parent Experience, Career Intelligence) read it without ever storing a second copy of the claim, the certificate, or the result?**

**Answer**: a new canonical domain, **Learner Competitions**, owns the entire competitive-event process a learner (or team) enters — from the moment it's identified as an opportunity through registration, preparation, participation, judging, results, verification, and publication — forever, evidence-backed, immutable once published. Achievement continues to own the *verified accomplishment claim* a competition result may earn, but that claim now references a Competition Entry instead of standing alone. Everything else reads Competitions the same "ask, never compute" way it already reads Portfolio, Achievement, and Projects.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted)

Searched the entire codebase for every term the mission named (`competition`, `contest`, `olympiad`, `challenge`, `hackathon`, `science fair`, `exhibition`, `tournament`, `robotics`, `debate`, `music festival`, `drama festival`, `sports event`, `championship`, `coding competition`, `innovation challenge`, `spelling bee`, `quiz`, `academic competition`, `awards`, `certificates`) and read the actual implementation of every plausible hit, not just the filename.

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType` includes `'competition'` | A flat enum value on `learner_achievements`. A `competition`-type Achievement row carries only the fields every other Achievement type carries: `title`, `description`, `awardingOrganization`, `awardDate`, `verifyingDocumentReference`, `supportingEvidenceIds`. **No** team, mentor, judges, registration date, preparation period, level, or a real position/result field. `sed`-confirmed against `lib/learnerAchievement/types.ts` in full. | This is the *outcome claim*, correctly owned by Achievement (ADR-0012), not the competitive process. The gap this ADR fills is everything Achievement's flat type cannot and should not represent. |
| `lib/learnerPortfolio/types.ts` header comment: "Achievement domain (Awards, Certificates, Leadership, Competitions...)" | A one-line acknowledgment that Portfolio explicitly excludes Competitions, already correctly deferring to Achievement per ADR-0012's supersession of ADR-0011 Phase 3. | Confirms, not contradicts — Portfolio has never owned Competitions in shipped code; ADR-0011's original provisional row was superseded before Portfolio's first implementation sprint, per ADR-0012's own "Relationship to ADR-0011" section. |
| `adr-0013-learner-projects-domain.md` Phase 6 — "Competition verified" | A named *Project verification category*: an external competition/event organizer's confirmation that a Project was completed, evidenced by a document reference. Explicitly distinguished there from "the *separate* Achievement record that would exist if that competition awarded a placing." | Confirms a competition can be the *source event* a Project's verification cites — but Projects owns that verification record itself; this ADR does not touch or redesign it (see Phase 5 Relationships). |
| `docs/architecture/learner-record-layer-decisions.md` — "Attendance/Behaviour/Competitions evidence sources (build on demand)" | A standing, still-open note that Competitions-as-an-Evidence-source was deliberately deferred, not built. | Confirms no Competitions evidence pipeline exists yet — consistent with this being greenfield. |
| `lib/ranking/*`, `lib/pathwayCalculator.ts`, `lib/academicClinic/careerEngine.ts` — word "competition" | Generic English usage ("labour market competition," "competitive pathway") in career-guidance prose, or tie-break ranking logic for assessment leaderboards (`lib/ranking/ties.ts`) — no competitive-event concept. | Incidental word match, not a domain. |
| `lib/career/seedCareers.ts`, `lib/academicClinic/clinicReportBuilder.ts` — `hackathon`, `championship`, `science fair`, `debate`, `quiz`, `robotics` | Demo/seed career-guidance copy (e.g. "robotics engineer" as a career title) and static report-template prose. | Incidental word match, not a domain. |
| `app/api/groups/challenge/route.ts`, `lib/studyGroups/challengeGenerator.ts` | Subject-based **study group** gamified "challenges" (points/streaks) — a Compass-adjacent engagement feature, same family as ADR-0012's already-flagged Academy badge system. | Different domain entirely: no competitive event, no external organizer, no team/judges/results. Already the exact "adjacent system, unrelated domain" pattern ADR-0012 Phase 1 found for Academy/Study Groups. |
| `app/teacher/academy/certificate/*` | Academy's own **teacher** professional-development certificate (course completion), unrelated to learner competitions. | Teacher-scoped, not learner-scoped; a certificate *type*, not a competition. |
| Every other searched term (`contest`, `olympiad`, `tournament`, `exhibition`, `music festival`, `drama festival`, `sports event`, `coding competition`, `innovation challenge`, `spelling bee`, `academic competition`) | No matching table, module, or feature — incidental prose only, or zero hits. Re-confirmed against the full migrations directory: no `competitions`, `competition_entries`, `contests`, or `events` table exists. | — |

**Answer to Phase 1's questions**:
- **Does any Competition domain already exist?** No.
- **Are there competing implementations?** No — there is exactly one adjacent, partial concept (Achievement's flat `competition` type), not two or more rival systems.
- **Is Competition currently hidden inside another domain?** Partially — as a *claim type* inside Achievement, correctly scoped to what Achievement can represent (a verified outcome), never disguising a full competition-process implementation.
- **Are there naming collisions?** None beyond the already-documented, already-resolved Portfolio/Achievement word overlap (ADR-0012's own "Relationship to ADR-0011").
- **Which ownership assumptions from ADR-0012 or ADR-0013 become invalid once Competition exists?** ADR-0012 Phase 2's definition of `competition` as an Achievement sub-type that itself "carries a result field" becomes incomplete once a real Competition Entry exists to carry that result properly — resolved in Phase 3/5 below, not by editing ADR-0012's text (an ADR is never silently rewritten; this ADR names the change and supersedes only the one row it must). ADR-0013 Phase 6's "Competition verified" category remains valid and unchanged — this ADR does not touch it (see Phase 5).

**Conclusion: no canonical Learner Competitions domain exists. A new domain is the correct, non-duplicative outcome — verified, not assumed, matching the identical discipline ADR-0011/0012/0013 each applied one sprint earlier.**

---

## Phase 2 — Definition (frozen)

**A Learner Competition is a real, external, time-bound competitive event or process that a learner (individually or as part of a team) enters, prepares for, participates in, and may be judged and ranked against other entrants for — tracked by EduNexus from the moment it is identified as an opportunity through to a verified, published result.**

**A Learner Competition is NOT:**

| Concept | Why it is not a Competition |
|---|---|
| **Project** (ADR-0013) | A Project is *work a learner builds*, on their own timeline, with no external judge or competitive ranking required to exist. A Project may later be *entered into* a Competition (see Phase 5), but a Project that is never entered anywhere is still a complete, valid Project. A Competition without a learner's work behind it (e.g. a spelling bee, a quiz, a debate) is still a complete, valid Competition. Overlap is real but partial, never total — they are never the same row. |
| **Achievement** (ADR-0012) | An Achievement is the *verified claim* that something noteworthy happened — recorded once, after the fact, with no ongoing process. A Competition is the *process itself*, spanning weeks, with real interim states (registered, preparing, competing) an Achievement was never designed to hold. A Competition Entry may *earn* an Achievement (Phase 5); it is never itself an Achievement row. |
| **Portfolio Item** (ADR-0011) | A Portfolio Item is a learner's own *curated, selected showcase* of something they chose to present — no external judge, no result, no team required. A Competition Entry may be *referenced by* a Portfolio Item the learner chooses to showcase; it is never itself a Portfolio Item. |
| **Assessment** (Core/Evidence domain) | An Assessment is an internal, curriculum-anchored measurement administered and marked by a learner's own teacher, producing Evidence rows that feed the Projection Engine. A Competition is external, not curriculum-anchored, and never produces Projection-Engine-consumed Evidence directly — it may *reference* Evidence rows as supporting context (Phase 5), but a Competition result is never itself an Evidence row and never feeds capability/knowledge computation. |
| **Evidence** (Evidence domain) | Evidence is the atomic, immutable observation record the Projection Engine reads. A Competition result is a *fact about the world outside the classroom*, not an academic-mastery observation — it is recorded, verified, and published entirely within this domain's own lifecycle, never inserted into `learner_evidence`. |
| **Activity** | Rejected as a distinct Competitions concept. Every candidate use of "activity" (a club meeting, a practice session) is either out of this domain's scope entirely (no attendance/participation-log feature is being built here) or already covered by "Preparation" as a lifecycle state (Phase 4), not a separate stored entity. Competitions has no `activity` field, type, or category. |
| **Event** | Rejected as a distinct Competitions concept, separate from Competition itself. See Phase 3 — the external event's own descriptive facts (name, organizer, date, venue) are frozen as fields *on* the Competition Entry for v1, not a separate reusable "Event catalog" entity. Introducing a second "Event" concept alongside "Competition" today would create exactly the kind of premature, unproven abstraction the platform's standing "smallest correct slice first" discipline exists to prevent — a shared Event catalog remains a **named, future** extension point (Phase 3), built only if real duplicate-entry-across-learners evidence justifies it. |

---

## Phase 3 — Ownership Matrix (frozen)

Every row below has exactly one owner. "Owner" means: the one domain that may write this data and that every other domain must read from, never duplicate.

| Concept | Owner | Notes |
|---|---|---|
| **Competition** (the event's own descriptive facts: name, organizing body, level, date, venue) | **Learner Competitions** | Not a separate catalog table for v1 (see Phase 2's "Event" rejection) — descriptive fields live on the Competition Entry itself, the same inline-field pattern Achievement's `awardingOrganization` and Portfolio's own artefact fields already use, not a new pattern. A shared, reusable Competition catalog (so multiple learners entering the same real-world event don't each re-type its name) is a named, future extension point, deferred until real duplicate-entry evidence justifies it — never built speculatively. |
| **Competition Entry** (one learner's or team's specific participation record — the lifecycle-bearing row) | **Learner Competitions** | The concrete owned entity. "Competition" and "Competition Entry" are the same stored row for v1; the two terms are kept conceptually distinct in this ADR because a future Event-catalog extension would split them without changing any other domain's relationship to Competitions. |
| **Team Membership** (which learners share an Entry) | **Learner Competitions** | References Core `learners.id` directly for each member — never duplicates learner identity, name, or grade data (matches Achievement/Portfolio/Projects' own "reference Core, never copy" discipline). |
| **Mentor** | **Learner Competitions** | A reference field to a school user (teacher/staff) who coached/guided the entry — not a new identity system, not a new role type. |
| **Event** | **Learner Competitions** (folded into Competition, not a separate concept — see Phase 2) | — |
| **Level** (school / regional / national / international) | **Learner Competitions** | Descriptive field on the Competition Entry, frozen as a fixed enum at implementation time — never free text, so Blueprint/Achievement can trust it for ranking without inventing their own parsing. |
| **Category** (the competition's own subject/domain — robotics, debate, sports, coding, music, academic, science, other) | **Learner Competitions** | A **separate, richer taxonomy from Achievement's own `AchievementCategory`** (academic/leadership/innovation/community_service/creative_arts/sports/entrepreneurship/research/technology/other) — the two are never merged or aliased. When a Competition Entry later earns an Achievement, the Achievement's own `category` is chosen independently by whoever records that Achievement, informed by but not mechanically derived from the Competition's category. |
| **Position** (placing/rank/result: participated / finalist / placed-Nth / won) | **Learner Competitions** | Recorded fact from the Results lifecycle phase (Phase 4) — never computed, inferred, or estimated by this domain or any consumer. A missing Position is recorded as "results not yet announced," never defaulted to a value. |
| **Results** (the overall outcome record: Position + score/summary + any organizer-published detail) | **Learner Competitions** | Owned and recorded once, at the Results lifecycle phase; immutable after Verification (Phase 4). |
| **Certificates** (the actual certificate artifact — file/image/PDF) | **Learner Competitions** | Stored as media on the Competition Entry — the primary, single copy of record. Achievement's `verifying_document_reference`, when an Achievement later references a Competition Entry, points *at* this same artifact rather than storing a second copy — direct architectural protection against the "duplicate certificates" risk (Phase 8). |
| **Judges** (names/organization of who judged) | **Learner Competitions** | Descriptive field(s) on the Results/Judging phase — external parties, never EduNexus user accounts, never a new identity system. |
| **Feedback** (judges' commentary) | **Learner Competitions** | Owned as part of the Judging/Results phase output — free text, never AI-generated or AI-summarized by this domain (Phase 8). |
| **Media** (photos/videos/documents beyond the certificate) | **Learner Competitions** | Same junction-table pattern already proven three times (Portfolio/Achievement/Projects `*_media` tables: `{url, label}`, no new upload utility invented). |
| **Evidence references** | **Learner Competitions** references **Evidence** | A Competition Entry may cite supporting Evidence rows (e.g. a teacher observation that informed selection) — a reference field only, never a copy of Evidence's own confidence/lifecycle machinery, identical to Achievement's Phase 5 rule. Evidence itself is owned entirely by the Evidence domain; Competitions never writes to `learner_evidence`. |
| **Portfolio references** | **Learner Portfolio** references **Learner Competitions** | Mirrors the Portfolio→Projects reference pattern (`portfolioProjectLink.ts`) exactly — the reference field lives in Portfolio, pointing outward. Competitions never reads or writes Portfolio. |
| **Achievement references** | **Learner Achievement** references **Learner Competitions** | An Achievement of `achievement_type = 'competition'` gains an optional reference field pointing at the Competition Entry that produced it, going forward — the same "provisional category becomes a reference" pattern ADR-0012 already established for Projects/Certifications/Awards. The reference field lives in Achievement, pointing outward. Competitions never reads or writes Achievement. Existing/future `competition`-type Achievement rows with no such reference remain valid (an achievement predating a Competition Entry, or one whose competition was never tracked in this domain) — this is additive, not a required migration. |
| **Blueprint summary** | **Learner Blueprint** | Summary-only composition (`composeCompetitions()`, reserved for Sprint 13B or later — not built in this sprint), identical shape discipline to Portfolio/Achievement/Projects: count, latest, highest-level, URL, availability. Never a full Competition Entry, never a recomputed count. Competitions never reads or writes Blueprint. |

No row above has more than one owner. No row above is owned by a domain this ADR was forbidden to touch.

---

## Phase 4 — Lifecycle (frozen, every state and transition reasoned)

**Main line**: `Opportunity → Registration → Preparation → Participation → Judging → Results → Verification → Published → Historical`

Before freezing this, each adjacent pair was checked for redundancy (per the mission's "reject any redundant states" instruction) against the precedent that Achievement (6 states) and Projects needed far fewer states because both record work *after* the fact. A Competition is different — it is tracked *live*, across real weeks, with genuinely distinct actors and stakes at each step. None were found redundant:

| Check | Verdict |
|---|---|
| Registration vs. Preparation | **Not redundant.** Registration is a discrete, fast administrative act (the entry is formally lodged with the organizer); Preparation is an open-ended period (days to months) during which coaching/evidence may accumulate. Different actors, different durations, different failure modes (a Registration can be rejected by the organizer; a Preparation period cannot). |
| Participation vs. Judging | **Not redundant.** Participation is the learner's own bounded act (competing on the day); Judging is an external process the learner has no further control over and which may conclude days or weeks later. Collapsing them would hide the real-world gap where a Competition Entry has genuinely nothing new to report. |
| Results vs. Verification | **Not redundant.** Results is the moment an external, organizer-published outcome becomes known (a fact entering the system). Verification is the internal governance act — an authorized school actor confirming that fact is trustworthy before it can ever be Published — the exact same distinct-and-necessary split Achievement's own Draft→Verified transition already established. Merging them would let an unverified, potentially fabricated external claim reach Published directly. |

| Transition | Trigger | Actor |
|---|---|---|
| — → Opportunity | A competition is identified as available/upcoming for this learner or school (e.g. a teacher flags an upcoming science fair) | Teacher / School staff |
| Opportunity → Registration | The learner (or team) formally enters | Learner / Teacher on the learner's behalf |
| Registration → Preparation | Registration is confirmed by the organizer (or, for internal/school-run competitions, by the school) | Teacher / School staff records confirmation |
| Preparation → Participation | The competition date arrives and the learner competes | System-recorded on the competition date, or teacher-confirmed |
| Participation → Judging | Participation concludes; results are not yet announced | Automatic on competition-date passing, or teacher-confirmed |
| Judging → Results | The organizer publishes an outcome (Position + any score/detail) | Teacher / School staff records the announced result |
| Results → Verification | A result has been recorded and needs authorization before publication | System-queued automatically on Results entry |
| Verification → Published | An authorized school actor confirms the result is trustworthy (matches Achievement's Verified→Published discipline) | Teacher / School staff (verifying actor) |
| Verification → **Rejected** *(terminal branch)* | The claimed result cannot be confirmed (no evidence, contradicted by the organizer, or found to be fabricated) | Teacher / School staff |
| Published → Historical | A defined dormancy period elapses after Publication (mirrors Blueprint's own "historical" freshness vocabulary, ADR-0008 — reused deliberately, not a new synonym) | System, time-based |
| Published → **Revoked** *(terminal branch)* | A previously verified/published result is later found invalid (mirrors Achievement's Published→Revoked precedent, ADR-0012 Phase 4) | School administrator |
| Registration / Preparation / Participation → **Withdrawn** *(terminal branch)* | The learner or school exits before the competition concludes (illness, event cancelled, team dissolved) | Learner / Teacher / School staff |

Terminal branches (`Rejected`, `Withdrawn`, `Revoked`) are not part of the main line and are not redundant with it — they are the same category of non-linear exit state Achievement (`Rejected`/`Revoked`/`Archived`) and Projects already require, named explicitly here rather than left as an implicit gap a future sprint would have to invent under pressure. Once a record reaches `Published`, `Rejected`, or `Withdrawn`, its core facts (Position, Results, Verification) are immutable — matching Achievement's own database-trigger-enforced immutability precedent (`enforce_achievement_immutability`), reserved as the same protection pattern for this domain's future implementation.

---

## Phase 5 — Relationships (frozen, one direction only per row)

| Relationship | Direction | Detail |
|---|---|---|
| Competition ↔ Achievement | **Achievement references Competition.** Competition never reads or writes Achievement. | A `competition`-type Achievement row optionally cites the Competition Entry that earned it (Phase 3). |
| Competition ↔ Portfolio | **Portfolio references Competition.** Competition never reads or writes Portfolio. | A Portfolio item the learner chooses to showcase may cite a Competition Entry, mirroring `portfolioProjectLink.ts` exactly. |
| Competition ↔ Projects | **Competition Entry may reference a Project** (what was entered), one direction only. Competitions does not read or write Projects' own fields, verification records, or lifecycle. | Whether/how Projects' existing "Competition verified" verification category (ADR-0013 Phase 6) evolves to point at a real Competition Entry, instead of a free-text document reference, is **explicitly reserved for a future Projects-domain-led decision** — this ADR does not decide it, matching ADR-0013's own identical deferral for Portfolio's `projects` category. "Do NOT redesign Projects" is honored: Projects' own fields and lifecycle are untouched. |
| Competition ↔ Blueprint | **Blueprint summarizes Competition.** Competition never reads or writes Blueprint. | `composeCompetitions()`, reserved for a future sprint, not built here. |
| Competition ↔ Parent Experience | **Parent Experience reads Competition** (via Blueprint's summary or a future direct published-entries read, same discipline already applied to Portfolio/Achievement/Projects). Never computes, never writes. | No parent-specific Competition builder — the exact discipline Sprint 12AA Phase 8 already confirmed for every other domain. |
| Competition ↔ Career Intelligence | **Career Intelligence may read Competition** as additional evidence input (e.g. "three robotics entries"). Competition never reads Career, never predicts a career, never stores a career-relevance score. | Identical one-directional rule ADR-0011 Phase established for Career reading Portfolio. |
| Competition ↔ Evidence | **Competition references Evidence.** Evidence never reads or writes Competition. | Reference-only, never a copy of Evidence's confidence/lifecycle machinery — identical to Achievement's Phase 5 rule. |
| Competition ↔ Report Card | **Never reads, never writes, either direction.** | No integration exists or is decided here — Report Cards remain fully independent (ADR-0008 Part 3, reaffirmed by Sprint 12AA Phase 9). If a future sprint proposes surfacing competitions on a report card, that is a new, separately-approved decision, not implied by this ADR. |
| Competition ↔ Learning Compass | **Never reads, never writes, either direction.** | No meaningful overlap identified — Compass is purely academic-subject mastery tracking; Competitions is an external, extracurricular process. Named explicitly so a future sprint does not have to re-derive this from silence. |

---

## Phase 6 — Paper vs. Digital vs. QR vs. Reserved

Extends ADR-0011 Phase 9's established split (the same pattern already applied to Portfolio, Achievement, and Projects sections) to every Competitions concept:

| Section | Paper | Digital | QR | Reserved |
|---|---|---|---|---|
| Competition / Entry details (name, level, category, dates) | Yes — 1–2 lines on a printed report/summary | Yes — full record | Yes (future) | — |
| Registration status | No | Yes | No | — |
| Team Membership | Optional — names listed on paper summary | Yes — full list with links to each member | No | — |
| Mentor | Optional — name on paper summary | Yes | No | — |
| Position / Results | Yes — headline result on paper (e.g. "2nd place, Regional Science Fair") | Yes — full detail | Yes (future) | — |
| Certificates | Yes — the certificate itself is inherently a paper/PDF artifact; digital copy is the canonical stored version | Yes — canonical stored copy | Yes (future, verifies authenticity) | — |
| Judges / Feedback | No | Yes | No | — |
| Media (photos/videos) | No | Yes | No | — |
| Evidence references | No | Yes (internal only, never rendered to a public/paper surface) | No | — |
| Historical archive view | No | Yes | No | Public-facing "verify this certificate" QR flow reserved for a future sprint, following ADR-0007 §11's QR philosophy exactly — not decided in detail here. |

---

## Phase 7 — Audience Matrix

| Field group | Learner | Teacher | Parent | School | University | Employer | Why |
|---|---|---|---|---|---|---|---|
| Competition/Entry details | Yes | Yes | Yes | Yes | Yes (if published) | Yes (if published) | The learner's own record; a published entry is exactly the kind of external-facing fact a graduation/university/employer profile is meant to surface — same rule already frozen for Achievement and Portfolio. |
| Registration/Preparation status (pre-Published) | Yes | Yes | Yes | Yes | No | No | In-progress state is operationally useful to the learner's own support network only — an unfinished process is not yet a verifiable claim external parties should see. |
| Team Membership | Yes (own team) | Yes | Yes (own child's team) | Yes | Yes (if published) | Yes (if published) | Teammates are part of the verifiable record once published; visible earlier only to those actively supporting the entry. |
| Mentor | Yes | Yes | Yes | Yes | Reserved | Reserved | A mentor credit is meaningful context for a school audience; external-party visibility deferred, not yet a frozen need. |
| Position/Results | Yes | Yes | Yes | Yes | Yes (if published) | Yes (if published) | The core verifiable claim — same visibility discipline as Achievement's own published record. |
| Certificates | Yes | Yes | Yes | Yes | Yes (if published) | Yes (if published) | The proof artifact travels with the claim it supports. |
| Judges/Feedback | Yes | Yes | Yes (summary only) | Yes | Reserved | Reserved | Feedback is primarily a coaching/growth signal for the learner and school; full judge commentary is not yet a frozen external-facing need. |
| Media | Yes | Yes | Yes | Yes | Reserved | Reserved | Same reasoning as Judges/Feedback — celebratory/context content for the internal audience first. |

---

## Phase 8 — Risks and Architectural Protections

| Risk | Architectural protection |
|---|---|
| Duplicate achievements (the same win recorded twice — once loosely in Achievement, once properly in Competitions) | Achievement's `competition`-type row references a Competition Entry (Phase 3) rather than standing alone; a future migration/dedup pass (not this ADR) can link existing free-standing rows, but going forward the reference field is the single source of truth for "which competition earned this." |
| Duplicate certificates (a second stored copy of the same file) | Certificates are owned once, as media on the Competition Entry (Phase 3); Achievement's `verifying_document_reference` points at that same artifact rather than storing a second file. |
| Fabricated rankings | Position/Results are recorded facts from the Results lifecycle phase only — never computed, estimated, or inferred by this domain or any consumer (Phase 3), matching the Educational Constitution's prohibition on invented numbers. |
| Unverifiable awards | The frozen Verification lifecycle state (Phase 4) requires an authorized school actor's confirmation before any result can reach Published — no result skips Verification, mirroring Achievement's mandatory Draft→Verified gate exactly. |
| AI-generated accomplishments | This domain has no AI call anywhere in its ownership (Phase 3) — Judges' Feedback is stored verbatim, never AI-summarized or AI-generated, matching Blueprint's own "no AI narrative" discipline (ADR-0006). |
| Event duplication (the same real-world event re-entered many times with slightly different names) | Named explicitly as the reason a shared Event catalog remains a deferred, evidence-justified future extension (Phase 2/3) rather than built speculatively now — the risk is documented, not silently assumed away. |
| Ownership drift | Phase 3's ownership matrix gives every concept exactly one owner, with every cross-domain field explicitly a "reference," never a duplicate — the identical discipline that made ADR-0011/0012/0013 auditable in Sprint 12AA. |
| Historical mutation | Published/Rejected/Withdrawn/Revoked records are immutable at their core facts (Phase 4), reserved to be enforced by a database trigger at implementation time — the same protection Achievement and Blueprint Snapshots already prove works (`enforce_achievement_immutability`, `enforce_blueprint_snapshot_immutability`). |
| Portfolio overlap | Portfolio references Competitions, never stores a second copy of an Entry's fields (Phase 3/5) — identical to the already-proven Portfolio→Projects pattern. |
| Achievement overlap | Achievement references Competitions rather than re-implementing team/mentor/judges/lifecycle fields itself (Phase 3) — the entire reason this ADR exists. |
| Blueprint inflation | Blueprint's future `composeCompetitions()` is capped to the same summary-only shape (count/latest/highest-level/URL/availability) every other domain already uses (Phase 3) — never a full Entry, never a recomputed count, matching ADR-0008 Part 5's discipline exactly. |

---

## Phase 9 — Constitutional & Architectural Compliance

Every claim below cites the governing ADR or Constitution article it honors:

- **Evidence First** (Educational Constitution Article I) — a Competition result is recorded only after the Results/Verification lifecycle phases (Phase 4); a Competition Entry may cite supporting Evidence but never fabricates it (Phase 3, mirroring ADR-0012 Phase 5's identical rule).
- **Numbers require names** — Position/Results are never a bare number; they carry the competition name, level, and category alongside them (Phase 3), matching Blueprint's own "numbers require names" discipline (Sprint 12AA Phase 5).
- **Freshness/immutability** — Published records are immutable, reusing the "Historical" vocabulary Blueprint's own freshness labels already established (ADR-0008), rather than inventing a synonym.
- **Single ownership, no second calculation** (RAS §3, Canonical Domain Standards) — Phase 3's matrix gives every concept exactly one owner; no domain computes a fact another domain already owns.
- **Compose, never own** (ADR-0005/0006, extended by ADR-0011/0012/0013) — Blueprint, Portfolio (for Competitions), and Parent Experience all only read/reference/summarize Competitions, never compute or duplicate it (Phase 5).
- **Reference, never copy, evidence-adjacent data** (ADR-0012 Phase 5, applied here) — Competition's relationship to Evidence is reference-only (Phase 3).
- **Teacher/school accountability, not full automation** — every lifecycle transition from Registration onward requires a named actor (Phase 4); no state is system-inferred without a human confirming it, except the two purely time-based transitions (Participation-date-arrival, Published→Historical), which carry no verifiable claim of their own.
- **Portfolio remains compose-only** (ADR-0011) — reaffirmed unchanged; this ADR adds one new reference field to Portfolio's existing discipline, nothing else.
- **Achievement remains verification-only** (ADR-0012) — reaffirmed unchanged; this ADR adds one new optional reference field to Achievement's existing `competition` type, nothing else.
- **Projects remain independent** (ADR-0013) — reaffirmed unchanged and explicitly not redesigned (Phase 5); this ADR only names, and defers, the eventual evolution of Projects' own "Competition verified" field.
- **Parent Experience remains read-only** (ADR-0010, reaffirmed Sprint 12AA Phase 8) — Competition ↔ Parent Experience is a pure read relationship (Phase 5).

---

## Verification Against Mission's Checklist

- [x] Competition has exactly one owner (Phase 3: Learner Competitions, for every Competition/Entry-level concept)
- [x] No duplicated ownership exists (Phase 3: every cross-domain field is a one-directional reference, never a second copy)
- [x] Portfolio remains compose-only (Phase 5/9, reaffirmed unchanged)
- [x] Achievement remains verification-only (Phase 5/9, reaffirmed unchanged)
- [x] Blueprint remains summary-only (Phase 3/5/9, reaffirmed unchanged — `composeCompetitions()` reserved, not built)
- [x] Projects remain independent (Phase 5/9, explicitly not redesigned)
- [x] Parent Experience remains read-only (Phase 5/9, reaffirmed unchanged)
- [x] Constitution compliant (Phase 9)
- [x] RAS compliant (Phase 9, §3 Canonical Domain Standards)
- [x] Zero implementation (no table, migration, repository, service, or UI file created or modified by this ADR)

---

## Stop Condition

This ADR, its companion sprint document, and one implementation-log entry are the only artifacts this sprint produces. No table, migration, repository, service, API route, UI component, upload mechanism, certificate rendering, or QR mechanism is designed or built here. Sprint 13B (Learner Competitions implementation) requires explicit approval before any of the above begins.
