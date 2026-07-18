# ADR-0018 — Learner Innovation Domain

**Status: DRAFT — awaiting explicit approval before the first Learner Innovation implementation sprint (Sprint 13I).** Design-freeze document only. No table, migration, repository, service, API, route, UI, upload mechanism, prototype storage, or AI evaluation was created or modified in producing it — confirmed: this document, `sprint-13h-learner-innovation-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Learner Innovation implementation sprint (13I, not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: `adr-0012-learner-achievement-domain.md` Phase 2's `innovation` `AchievementType` entry, **partially and explicitly** — see "Relationship to ADR-0012" below. Achievement's `innovation` type is not removed or renamed; it becomes a *recognition-of-innovation* reference to this domain, going forward — the identical "provisional becomes a reference" pattern ADR-0014/0015/0016 already applied to Achievement's `competition`/`leadership`/`community_service` types. Does not supersede any other prior ADR.
**Depends on / extends**: `adr-0005`–`adr-0009` (Blueprint ownership/composition discipline — Innovation is summary-composed like every domain except Wellbeing), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern — Innovation follows the standard "Parent Experience reads via Blueprint" pattern, unlike ADR-0017's deliberate departure), `adr-0011-learner-portfolio-architecture.md` (Portfolio's frozen definition, its original provisional Innovation row), `adr-0012-learner-achievement-domain.md` (the verifiable-claim/raw-artefact split, and the `innovation` AchievementType this ADR disambiguates), `adr-0013-learner-projects-domain.md` (the `innovation` ProjectCategory this ADR distinguishes itself from, and the reference-not-copy precedent), `adr-0014-learner-competitions-domain.md` (the `innovation` CompetitionCategory this ADR distinguishes itself from, plus its "no separate catalog"/terminal-branch-justification discipline), `adr-0016-learner-community-service-domain.md`/`adr-0017-learner-wellbeing-domain.md` (the "no relationship, named explicitly" protection pattern, reused here for Wellbeing/Community Service/Leadership), `reference-architecture-specification.md` §3, Educational Constitution.

---

## Why This ADR Exists

"Innovation" is the first concept in this entire ADR series to appear as a classification value in **three** sibling domains at once, not one: `AchievementType`/`AchievementCategory` include `'innovation'` (ADR-0012, a flat recognition claim), `ProjectCategory` includes `'innovation'` (ADR-0013, a work-classification label), and `CompetitionCategory` includes `'innovation'` (ADR-0014, an event-classification label). None of the three tracks what actually makes something an innovation rather than ordinary project work: the documented, evidenced *evolution* of a novel solution — an idea tested, refined, tested again, sometimes failing, sometimes succeeding, over real time. Without a frozen owner, "innovation" would remain permanently just an adjective three other domains apply to their own content, never a thing this platform can actually verify happened.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted)

Searched the entire codebase for every term the mission named (`innovation`, `invention`, `prototype`, `maker`, `makerspace`, `creativity`, `design thinking`, `entrepreneurship`, `startup`, `incubator`, `patent`, `intellectual property`, `research`, `experiment`, `solution`, `hackathon`) and read the actual implementation of every plausible hit, not just the filename.

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType`/`AchievementCategory` include `'innovation'` | A flat enum value on `learner_achievements`, carrying only `title`/`description`/`awardingOrganization`/`awardDate`. ADR-0012 Phase 2's own text defines it as "an original idea, invention, or project outcome **recognized as such**" — recognition, not the developmental process. No idea-evolution field, no prototype-history field, no iteration count exists anywhere in the shipped schema. | The *recognition* claim, correctly owned by Achievement (ADR-0012) for what it actually stores — never the process. |
| `lib/repositories/project.repository.ts` — `ProjectCategory` includes `'innovation'` | A free-text-labeled Project category (a project a learner classified as "innovation-themed" work) — no evolution tracking, no iteration log, no testing/refinement concept anywhere in `LearnerProjectRow`. | Confirms adjacent, not overlapping — a Project may be the *deliverable* an Innovation produces, but the category label alone captures none of the developmental history this ADR exists to own. |
| `lib/repositories/competition.repository.ts` — `CompetitionCategory` includes `'innovation'` | A free-text-labeled Competition category (an "innovation challenge" event type) — no relationship to any learner's actual development process, only the event's own subject-matter classification. | Confirms adjacent, not overlapping — a Competition may be *where* an Innovation is entered and judged, never the record of how it was built. |
| `lib/learnerPortfolio/types.ts` header comment: "Achievement domain (Awards, Certificates, Leadership, Competitions...)" and ADR-0011 Phase 3's original provisional "Innovation" row | Confirms Portfolio has never owned Innovation in shipped code — provisionally assigned once (ADR-0011), superseded by ADR-0012 before Portfolio's first implementation sprint, identical to the Competitions/Leadership/Community-Service precedent. | — |
| `lib/career/*`, `lib/academicClinic/careerEngine.ts`, `lib/sow/*` — `creativity`, `design thinking`, `entrepreneurship`, `startup`, `incubator`, `maker`, `hackathon`, `research`, `experiment` | Career-guidance demo/seed copy ("startup founder" as a career title), curriculum competency-verb vocabulary ("design thinking" as a CBC pedagogical term), and generic prose. All read in full. | Incidental word matches, not a domain. |
| `lib/assessments/assessmentTypeCatalog.ts` — `prototype` | A single occurrence naming a possible assessment format ("prototype demonstration" as an assessment type label), not a tracked entity. | Incidental word match. |
| Every other searched term (`invention`, `makerspace`, `patent`, `intellectual property`, `solution`) | No matching table, module, or feature. Re-confirmed against the full migrations directory: no `innovations`, `prototypes`, `inventions`, or `research_projects` table exists anywhere. | — |

**Answer to Phase 1's questions**:
- **Does any existing canonical owner already own Innovation?** No — three sibling domains each hold a bare classification *label* named "innovation," none owns the underlying process.
- **Document every partial overlap**: Achievement (recognition claim), Projects (work-category label), Competitions (event-category label) — all three documented above, all three confirmed non-overlapping with what this ADR actually needs to own.

**Conclusion: no canonical Learner Innovation domain exists. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Core Educational Question (frozen, evidence-based, not motivational)

**What makes something an Innovation rather than merely a Project, an Achievement, or a Competition?**

**Answer: demonstrated iteration.** A Project is bounded work with a goal and a completion. An Achievement is a recognition claim, granted once, after the fact. A Competition is a bounded, externally-judged event. None of the three requires — or can represent — evidence that a solution *changed over time in response to testing*. **An Innovation is distinguished architecturally by the existence of a documented evolution: a problem, an idea, at least one built prototype, at least one recorded test, and at least one recorded refinement made because of that test.** A single, polished, unchanged final product — however impressive — is not evidence of innovation under this definition; it is evidence of execution. A messy, multiply-revised attempt with a clear testing-and-refinement trail is. This is a falsifiable, evidence-checkable test, not a subjective or motivational one, and it is designed to survive contact with a real implementation sprint: "does this record show iteration, or does it show only a finished thing?"

---

## Phase 3 — Domain Definition (frozen)

**Learner Innovation owns the creation, refinement, and documented evolution of a novel educational solution to a real problem — evidenced by iteration, never by declaration, recognition, or the existence of a finished artefact alone.**

**Innovation never owns:**

| Concept | Actual owner |
|---|---:|
| Grades | Academic Record (Projection Engine) |
| Popularity | No domain owns this — it is not a tracked concept anywhere in this platform (Phase 8, Principle 9) |
| Awards / Recognition / Certificates | Learner Achievement (ADR-0012) |
| Employment / career suitability | Career Intelligence (`lib/career/`) — and even there, only as orientation, never certainty |
| Portfolio artefacts (the showcase presentation) | Learner Portfolio (ADR-0011) |

---

## Phase 4 — Ownership Matrix (frozen — every field, exactly one owner; everything else references)

| Concept | Owner | Notes |
|---|---:|---|
| **Problem addressed** | Learner Innovation | Descriptive field on the Entry — the real need the innovation targets. |
| **Idea evolution** | Learner Innovation | The domain's central content — captured as the Entry's status history plus its append-only Iteration log (Phase 5). |
| **Prototype history** | Learner Innovation | Entries in the Iteration log, typed `prototype_version`. |
| **Iterations** | Learner Innovation | The unified append-only log itself (mirrors the pattern already proven for Competitions/Leadership/Community Service/Wellbeing) — every prototype version, test, and refinement, in order, never deleted or edited once written. |
| **Evidence of testing** | Learner Innovation | Iteration log entries typed `testing_note`, optionally referencing Evidence rows (reference-only, Phase 7). |
| **Mentor guidance** | Learner Innovation | A reference field to a school user — not a new identity system, mirroring Competition's/Leadership's identical Mentor field. |
| **Impact evidence** | Learner Innovation | Recorded at Validation/Implementation — measurements, user feedback, teacher verification (Phase 7). |
| **Adoption** | Learner Innovation | A recorded fact at the Implementation phase (Phase 5) — never inferred, never assumed from Validation alone. |
| **Public demonstration** | Learner Innovation | A logged fact that a demonstration occurred (who, when, where) — never a media-hosting or streaming system. |
| **Recognition** | Learner Achievement | Achievement references Innovation, going forward (Phase 6) — Innovation never issues its own award concept. |
| **Awards** | Learner Achievement | Same as Recognition. |
| **Portfolio artefacts** | Learner Portfolio | Portfolio references Innovation, one direction (Phase 6). |
| **Projects** | Learner Projects | Innovation may reference a Project (the deliverable it produced), one direction — never duplicates Project's own goal/stage/verification fields. |
| **Competitions** | Learner Competitions | Innovation may reference a Competition it was entered into, one direction — never duplicates Competition's own judging/results fields. |
| **Career relevance** | Career Intelligence | Innovation never computes this itself — supplies facts only, Career owns interpretation (Phase 6/9). |
| **Blueprint summary** | Learner Blueprint | A future `composeInnovation()`, capped to the standard summary-only field budget (Phase 6) — never a full record. |

No row above has more than one owner. Every cross-domain field is an explicit, one-directional reference, never a duplicate.

---

## Phase 5 — Lifecycle (frozen; not copied from Projects, Competitions, or Achievement — reasoned for this domain specifically)

**Main line**: `Idea → Exploration → Prototype → Testing → Refinement → Validation → Implementation → Archived`

Each state, reasoned individually against "reject unnecessary states":

| State | Why it exists | Why it is not redundant with its neighbor |
|---|---|---|
| Idea | The earliest, editable state — a problem is identified and a candidate solution proposed. | First state; nothing precedes it. |
| Exploration | Feasibility/background investigation before committing to build anything. | Distinct from Idea: Idea is "I have a concept," Exploration is "I am researching whether and how to build it" — a real, common, and educationally meaningful phase that a project jumping straight to construction would skip. |
| Prototype | The first tangible attempt is actually built. | Distinct from Exploration: research versus construction. |
| Testing | The prototype is evaluated against real conditions or users. | Distinct from Prototype: building versus evaluating — this is where iteration evidence (Phase 2's own test) begins to accumulate. |
| Refinement | Changes are made in direct response to testing feedback. | Distinct from Testing: evaluating versus acting on what was learned. |
| Validation | A bounded, evidence-based confirmation that the refined solution actually solves the problem. | Distinct from ongoing Testing: the same "live process vs. bounded confirming act" distinction ADR-0014/0015/0016 already established for their own domains' Review-equivalent phases — this is this domain's Verification-equivalent gate. |
| Implementation | The validated innovation is put into real, adopted use. | Distinct from Validation: confirmed-to-work versus actually-in-use — this is where Adoption (Phase 4) becomes a recorded fact, and functions as this domain's credential-worthy state, the equivalent of every sibling domain's Published. |
| Archived | Time-based dormancy after Implementation, reusing Blueprint's own freshness vocabulary. | Terminal, matching every sibling domain's final archival state. |

**Iteration is not modeled as looping the main status backward.** A real innovation typically cycles through Prototype→Testing→Refinement multiple times before ever reaching Validation. This ADR deliberately does **not** allow the main lifecycle status to move backward (consistent with every sibling domain's forward-only discipline) — instead, **any number of Iteration-log entries may be logged while the status remains at Testing or Refinement**, exactly as Achievement/Competition/Leadership already allow multiple Review-phase log entries without a status change. The status advances once, when the learner/mentor judges the current cycle of iteration complete enough to move to the next named phase; the full record of *how many* cycles happened lives entirely in the append-only Iteration log, never in the status field.

**No separate "Verification" or "Published" state was added**, unlike Achievement/Competition/Leadership/Community Service's explicit two-step Verification→Published pattern. Reasoned, not copied: Validation already **is** this domain's evidence-confirmation gate, and Implementation already **is** the credential-worthy, externally-referenceable state (an innovation that reached Implementation is, by construction, validated and adopted — an unambiguous accomplishment). Adding a fourth confirmation step on top would not add educational meaning, only bureaucracy Phase 5's own "reject unnecessary states" instruction forbids.

**Terminal branches — three, each independently justified:**

| Terminal branch | Reachable from | Why it exists |
|---|---|---|
| **Discontinued** | Idea, Exploration, Prototype, Testing, or Refinement | Real innovation work stops for many legitimate reasons at any pre-Validation stage. Per Phase 8 Principle 2 ("failure is educational evidence"), this branch requires not just a stopping reason but a **lessons-learned field** — failure here is a valid, complete, non-shameful closure, never silently deleted (mirrors every sibling domain's "never a delete path once past the earliest state" rule). |
| **Not Validated** | Validation | The evidence gathered does not actually support that the solution solves the problem — a distinct, more specific outcome than a general Discontinued, reserved for the case where the rigorous check itself is the reason for stopping. |
| **Revoked** | Implementation | A previously validated-and-implemented claim is later found to be inaccurate or fabricated — mirrors every sibling domain's identical Published→Revoked protection. |

Once a record reaches `Archived`, `Discontinued`, `Not Validated`, or `Revoked`, its core facts are immutable — the same three-layer discipline (Service/Repository/DB trigger) every sibling domain in this series requires, reserved here for the future implementation sprint to build.

---

## Phase 6 — Cross-Domain Relationships (frozen, one direction only per row)

| Relationship | Who owns | Who references | Who must never compute |
|---|---|---|---|
| Innovation ↔ Portfolio | Innovation owns its own record | Portfolio references Innovation (mirrors `portfolioProjectLink.ts`'s pattern exactly) | Neither computes anything about the other |
| Innovation ↔ Projects | Projects owns Project's own fields | Innovation may reference a Project (the deliverable it produced), one direction | Projects never reads Innovation; neither computes for the other |
| Innovation ↔ Achievement | Achievement owns recognition | Achievement references Innovation, going forward (not built this sprint, deferred like every sibling) | Achievement must never compute or infer innovation status — only reference an Innovation Entry's real, recorded state |
| Innovation ↔ Competitions | Competitions owns its own entity | Innovation may reference a Competition it was entered into, one direction | Competitions never reads Innovation; neither computes for the other |
| Innovation ↔ Career Intelligence | Innovation owns its own facts | Career Intelligence may read Published/Implemented Innovation as evidence input | Innovation never computes career relevance or employability (Phase 9, Article X) |
| Innovation ↔ Blueprint | Innovation owns its own facts | Blueprint summarizes Innovation (future `composeInnovation()`, standard summary-only field budget: count, latest, current, URL) | Blueprint must never compute Innovation content — only compose what Innovation's own summary function returns |
| Innovation ↔ Parent Experience | Innovation owns its own facts | Parent Experience reads Innovation via Blueprint's summary — the **standard** pattern every domain except Wellbeing follows (Innovation is a showcase-type domain, not confidential) | Parent Experience never computes |
| Innovation ↔ Wellbeing | **No relationship, either direction.** | — | Neither reads, writes, nor infers from the other — different domain families entirely (showcase-oriented vs. confidential support), named explicitly per ADR-0017's own established pattern |
| Innovation ↔ Community Service | **No relationship, either direction.** | — | Prevents double-counting, mirroring ADR-0016's identical Leadership↔Community-Service protection — a single real-world effort that is both a service contribution and an innovation gets independently recorded in each domain, never auto-derived from the other |
| Innovation ↔ Leadership | **No relationship, either direction.** | — | Same reasoning as Community Service |
| Innovation ↔ Report Cards | **No relationship, either direction.** | — | Reaffirms the hard boundary ADR-0008 Part 3 established and every subsequent ADR in this series has upheld without exception |

---

## Phase 7 — Evidence Principles (frozen)

**Innovation exists because evidence exists.** Evidence may include: prototype versions, photos, testing notes, feedback, measurements, iterations, user validation, teacher verification — each a real, human-logged Iteration-log entry (Phase 4/5), optionally referencing Evidence-domain rows (reference-only, never a copy of Evidence's own confidence/lifecycle machinery, identical to every sibling domain's Phase 3/5 rule).

**Innovation never exists because AI says it is innovative.** No field, status, or transition in this domain's ownership matrix (Phase 4) is ever set by an AI judgment of novelty, quality, or impact. An Innovation Entry's status only ever advances because a named human logged evidence and made a judgment call — never because an automated classifier scored the content.

---

## Phase 8 — Educational Principles (frozen, each reasoned)

1. **Innovation is demonstrated, not declared.** Direct application of Constitution Article I — a claimed innovation with no iteration evidence is architecturally indistinguishable from no innovation at all (Phase 2's own test).
2. **Failure is educational evidence.** The Discontinued terminal branch (Phase 5) requires a lessons-learned field, not just a stopping reason — failing to validate is a legitimate, complete, non-shameful closure, never hidden or deleted.
3. **Iteration matters more than perfection.** The lifecycle explicitly models and preserves multiple Prototype/Testing/Refinement cycles (Phase 5) — a single flawless first attempt with no iteration trail is, by Phase 2's own definition, less demonstrably an "Innovation" than a well-documented messy one.
4. **Evidence outweighs claims.** Validation requires real, logged evidence (measurements, user feedback, teacher verification) — never a self-declaration alone (Phase 7).
5. **Recognition does not define innovation.** An Innovation Entry can reach Implementation and be a complete, valid record with zero Achievement recognition ever attached (Phase 6) — Recognition is optional and after-the-fact, never load-bearing.
6. **Innovation is not entrepreneurship.** This domain never tracks revenue, business model, funding, or commercialization status anywhere in its ownership matrix (Phase 4) — a firm boundary that directly prevents the "commercialization bias" risk (Phase 10). Career Intelligence, not this domain, is where any future commercial/career interpretation belongs, and even there only as orientation.
7. **Innovation is not invention alone.** A single novel object with no development history does not meet this domain's evidentiary bar (Phase 2) — it may still be Achievement-worthy as a standalone recognition, but it is not, architecturally, an Innovation Entry.
8. **Innovation belongs to every learner.** The domain's evidentiary bar is iteration, not brilliance, resources, or access to labs/competitions — an equity commitment embedded architecturally: no field in the ownership matrix (Phase 4) requires winning a competition, having expensive materials, or any external validation to reach Implementation.
9. **No score, no ranking, no competitive comparison between learners' Innovations, ever.** *(Justified directly by, and preventing, Phase 10's "popularity bias" risk.)* No field anywhere in this domain's ownership matrix computes a rank, percentile, or comparative score.

No further principles are invented beyond the eight the mission named plus this one, directly justified by a named Phase 10 risk.

---

## Phase 9 — Constitutional Review

- **Article I (Evidence only)**: satisfied — every Innovation fact is a recorded human observation or logged Iteration-entry, never fabricated or inferred (Phase 4/7).
- **Article II (Missing evidence ≠ failure)**: satisfied — an Entry still at Idea or Exploration, with sparse evidence so far, is never treated as a failed or lesser innovation; it is simply early-stage, exactly as this Constitution requires for every other domain.
- **Article VI (AI explains, never invents)**: satisfied — Phase 7's absolute rule (no AI-judged novelty) is the direct, domain-specific application of this article.
- **Article VIII (Teacher accountability)**: satisfied — every lifecycle transition requires a named, attributable human actor (mirrors every sibling domain's identical rule).
- **Article X (Innovation never predicts careers)**: satisfied — Phase 6's Career Intelligence relationship is read-only, interpretation-only, on Career's side; Innovation itself computes nothing career-related.
- **RAS §3 (Canonical Domain Standards)**: satisfied — Phase 4's matrix gives every concept exactly one owner; Phase 6's relationships are all one-directional with zero circular ownership.

---

## Phase 10 — Risks and Architectural Protections

| Risk | Architectural protection |
|---|---|
| Portfolio duplication | Portfolio references Innovation, never stores a second copy of an Entry's fields (Phase 6) — the identical, already-proven pattern. |
| Achievement duplication | Achievement references Innovation going forward, never re-implements iteration/evolution fields itself (Phase 6). |
| Project duplication | Innovation may reference a Project but never duplicates its goal/stage/verification fields; Projects remains untouched and independently ownable (Phase 4/6). |
| Competition overlap | Innovation may reference a Competition entered, never duplicates Competition's own judging/results fields (Phase 4/6). |
| AI-generated innovation claims | Phase 7's absolute rule: AI never declares something innovative; only human-logged, evidence-backed Iteration entries count toward any status advance. |
| Popularity bias | Phase 8, Principle 9 — no score, no ranking, ever. |
| Commercialization bias | Phase 8, Principle 6 — Innovation is not entrepreneurship; no revenue/business-model field exists anywhere in the ownership matrix. |
| Patent confusion | This ADR never claims or manages intellectual-property/patent status — Patents is explicitly named as a reserved, undesigned future extension (Phase 11), never conflated with this domain's own evidentiary record. |
| Teacher ownership drift | Actor/attribution fields (`recorded_by`, mentor references, etc.) are attribution only, never an access gate — the same platform-wide CLAUDE.md rule every sibling domain already follows. |
| Innovation becoming another "upload folder" | The Iteration log is structurally typed (`prototype_version`/`testing_note`/`refinement`/`feedback`/`measurement`, not a generic freeform media dump) and phase-gated (each entry belongs to a specific lifecycle state) — a real record of evolution, never an undifferentiated pile of files. |

---

## Phase 11 — Future Extensions (reserved, not designed, no ownership assigned)

Research, Patents, Open-source work, Community adoption, Innovation showcases, Hackathons, Incubators, STEM fairs, Maker spaces, National competitions, University collaborations, Industry mentorship, International exhibitions, Innovation grants, Peer review.

Each, when a real implementation sprint proposes it, requires its own reasoned ownership decision — several (Patents, Industry mentorship, University collaborations) plausibly deserving their own future ADR given legal/institutional stakes, not a casual extension of this one's frozen scope.

---

## Verification Against Mission's Checklist

- [x] Innovation has one canonical owner (Phase 4)
- [x] No duplicated ownership (Phase 4/6)
- [x] Distinct from Projects (Phase 2/3 — iteration vs. bounded deliverable)
- [x] Distinct from Achievement (Phase 2/3 — process vs. after-the-fact recognition)
- [x] Distinct from Competitions (Phase 2/3 — internal evolution vs. external judged event)
- [x] Distinct from Portfolio (Phase 3 — verified process record vs. curated showcase)
- [x] Constitution compliant (Phase 9)
- [x] RAS compliant (Phase 9)
- [x] Blueprint relationship frozen (Phase 6 — standard summary-only pattern)
- [x] Parent Experience relationship frozen (Phase 6 — standard read-via-Blueprint pattern)
- [x] Career relationship frozen (Phase 6/9 — read-only, interpretation-only on Career's side)
- [x] Educational principles documented (Phase 8, nine principles, each reasoned)
- [x] Risks documented (Phase 10, ten risks, each with a named protection)
- [x] Future extensions reserved only (Phase 11, fifteen named, zero designed)

---

## Stop Condition

This ADR, its companion sprint document, and one implementation-log entry are the only artifacts this sprint produces. No database table, migration, repository, service, API, upload mechanism, prototype storage, innovation scoring, AI evaluation, UI, or integration with Blueprint/Portfolio/Career/Competitions is designed or built here. Sprint 13I (Learner Innovation implementation) requires explicit approval before any of the above begins.
