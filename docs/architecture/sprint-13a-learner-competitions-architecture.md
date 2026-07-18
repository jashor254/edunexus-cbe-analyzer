# Sprint 13A — Learner Competitions Domain (Architecture Only)

Architecture-only sprint, per explicit mission instruction: produces `adr-0014-learner-competitions-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, UI, or integration code was written. Blueprint, Portfolio, Achievement, Parent Portal, Report Cards, Career Intelligence, Learning Compass, Projects, and Evidence were not touched — only read, for ownership verification, exactly as scoped.

---

## Phase 1 — Audit First (done, before any design work)

Searched the entire codebase for every term the mission named: `competition`, `contest`, `olympiad`, `challenge`, `hackathon`, `science fair`, `exhibition`, `tournament`, `robotics`, `debate`, `music festival`, `drama festival`, `sports event`, `championship`, `coding competition`, `innovation challenge`, `spelling bee`, `quiz`, `academic competition`, `awards`, `certificates` — plus a direct read of the Achievement, Portfolio, Projects, Evidence, and Blueprint domains for any hidden or partial Competition concept.

Full findings are in ADR-0014 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType` includes `'competition'` | **The one real, partial implementation.** A flat enum value carrying only `title`/`description`/`awardingOrganization`/`awardDate`/`verifyingDocumentReference` — no team, mentor, judges, registration, preparation period, level, or real position field. Correctly scoped to what Achievement can represent (a verified outcome claim); not a competition-process implementation. Resolved architecturally (Achievement references the new domain going forward), not by rewriting Achievement's shipped code. |
| `adr-0013-learner-projects-domain.md` Phase 6 — "Competition verified" | A named Project-verification category (an organizer's confirmation a Project was completed) — confirms a competition can be a Project's verification source, but Projects owns that record itself. Not touched by this sprint. |
| `lib/learnerPortfolio/types.ts` — "Achievement domain (...Competitions...)" comment | Confirms Portfolio has never owned Competitions in shipped code — ADR-0011's original provisional row was already superseded by ADR-0012 before Portfolio's first implementation sprint. |
| `docs/architecture/learner-record-layer-decisions.md` — "Competitions evidence sources (build on demand)" | Confirms Competitions-as-an-Evidence-source was already flagged and deliberately deferred, never built. |
| `lib/ranking/*`, `lib/pathwayCalculator.ts`, `lib/academicClinic/careerEngine.ts`, `lib/career/seedCareers.ts`, study-group "challenges" (`lib/studyGroups/challengeGenerator.ts`), Academy's teacher certificate (`app/teacher/academy/certificate/*`) | All read in full — generic English usage, career-guidance demo copy, or unrelated adjacent systems (gamified study groups, teacher professional-development certificates) already flagged once each in ADR-0012's own audit. No competitive-event concept in any of them. |
| Every other searched term | No matching table, module, or feature. No `competitions`, `competition_entries`, `contests`, or `events` table exists anywhere in the migrations directory. |

**Conclusion: no canonical Learner Competitions domain exists. The only real hit is Achievement's own correctly-scoped, provisional `competition` claim type — the exact same "provisional assignment, no other domain existed yet" situation ADR-0012 found for Portfolio's Competitions row, and ADR-0013 found for Portfolio's `projects` category. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0014-learner-competitions-domain.md` freezes:

- **Definition** (Phase 2) — a real, external, time-bound competitive process, explicitly distinguished from Project, Achievement, Portfolio Item, Assessment, and Evidence; "Activity" and "Event" both rejected as separate concepts for v1 (folded into "Preparation" and "Competition" respectively).
- **Ownership** (Phase 3) — every concept (Competition, Entry, Team Membership, Mentor, Level, Category, Position, Results, Certificates, Judges, Feedback, Media) owned once by Learner Competitions; every cross-domain field (Evidence, Portfolio, Achievement, Blueprint references) explicit about which domain owns the reference field and which direction it points.
- **Lifecycle** (Phase 4) — the full nine-state main line (Opportunity → Registration → Preparation → Participation → Judging → Results → Verification → Published → Historical), each adjacent pair checked and confirmed not redundant, plus three named terminal branches (Rejected, Withdrawn, Revoked) mirroring Achievement's own non-linear exit states.
- **Relationships** (Phase 5) — one direction only per row, for Achievement, Portfolio, Projects, Blueprint, Parent Experience, Career Intelligence, Evidence, Report Card, and Learning Compass. Projects explicitly and deliberately not redesigned — the eventual evolution of its own "Competition verified" field is named and reserved for a future Projects-led decision, never decided here.
- **Paper vs. Digital vs. QR** (Phase 6) and **Audience Matrix** (Phase 7) — extending ADR-0011 Phase 9's and Phase 10's established table patterns to every Competitions field group.
- **Risks and protections** (Phase 8) — eleven named risks (duplicate achievements, duplicate certificates, fabricated rankings, unverifiable awards, AI-generated accomplishments, event duplication, ownership drift, historical mutation, Portfolio overlap, Achievement overlap, Blueprint inflation), each with a specific architectural protection already frozen in the ownership/lifecycle phases above — no risk left "to be figured out during implementation."
- **Constitutional/RAS compliance** (Phase 9) — every claim cited against a specific governing ADR or Constitution article.

---

## What This Sprint Explicitly Did Not Do

- Did not design a single table or column.
- Did not write a migration.
- Did not modify `lib/learnerAchievement/`, `lib/learnerPortfolio/`, `lib/learnerProjects/`, `lib/learnerBlueprint/`, `lib/parentExperience/`, `lib/career/`, `lib/compass/`, or any Evidence module — all were only read, to verify ownership assumptions, per the mission's explicit instruction.
- Did not build a repository, service, API route, UI component, upload mechanism, certificate renderer, or QR flow.
- Did not decide the exact data model for a future shared Event catalog, the exact verifying-party data model for Judges, or how Projects' own "Competition verified" field should evolve — all three are named, reasoned, and explicitly reserved for future, separately-approved sprints, not decided here under schedule pressure.

**Sprint 13A is complete. Per the STOP CONDITION, Sprint 13B (Learner Competitions implementation) was not started — waiting for explicit approval.**
