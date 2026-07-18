# Sprint 13H — Learner Innovation Domain (Architecture Only)

Architecture-only sprint, per explicit mission instruction: produces `adr-0018-learner-innovation-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, UI, upload mechanism, prototype storage, or AI evaluation was written. Portfolio, Achievement, Projects, Competitions, Career Intelligence, Blueprint, and Learning Compass were read only, for ownership verification, never modified.

---

## Phase 1 — Audit First (done, before any design work)

Searched the entire codebase for every term the mission named: `innovation`, `invention`, `prototype`, `maker`, `makerspace`, `creativity`, `design thinking`, `entrepreneurship`, `startup`, `incubator`, `patent`, `intellectual property`, `research`, `experiment`, `solution`, `hackathon` — plus a direct read of Portfolio, Achievement, Projects, Competitions, Career Intelligence, Blueprint, and Learning Compass for any hidden or partial Innovation concept.

Full findings are in ADR-0018 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `AchievementType`/`AchievementCategory` include `'innovation'` | The *recognition* claim — flat, after-the-fact, no evolution/prototype-history field. |
| `ProjectCategory` includes `'innovation'` | A work-classification label on `learner_projects` — no iteration tracking. |
| `CompetitionCategory` includes `'innovation'` | An event-classification label on `learner_competitions` — no relationship to a learner's own development process. |
| Portfolio's original provisional "Innovation" row (ADR-0011 Phase 3) | Already superseded by ADR-0012 before Portfolio's first sprint — confirms Portfolio never owned this. |
| Career-guidance demo copy, curriculum vocabulary, `assessmentTypeCatalog.ts`'s one "prototype" mention | Incidental word matches, read and dismissed individually. |

**This is the first ADR in the series to find the same word as a bare classification label in three separate sibling domains at once** — Achievement, Projects, and Competitions each apply "innovation" as an adjective to their own content, and none of the three tracks the actual developmental process. **Conclusion: no canonical Learner Innovation domain exists. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0018-learner-innovation-domain.md` freezes:

- **Core Educational Question** (Phase 2) — the evidence-based, falsifiable answer to "what makes something an Innovation": **demonstrated iteration**. A single polished, unchanged final product is evidence of execution, not innovation; a documented trail of problem → idea → prototype → test → refinement is. This test was chosen specifically because it survives contact with a real implementation sprint — it's checkable against actual logged data, not a subjective judgment call.
- **Domain Definition** (Phase 3) — Innovation owns the creation, refinement, and documented evolution of a novel solution; explicitly never owns grades, popularity, awards/recognition, employment, or portfolio artefacts, each mapped to its actual canonical owner.
- **Ownership Matrix** (Phase 4) — sixteen concepts, every one owned exactly once, including a deliberate unified append-only Iteration log (mirroring the pattern already proven for Competitions/Leadership/Community Service/Wellbeing) that captures prototype history, testing evidence, and refinements as one structured, phase-gated stream.
- **Lifecycle** (Phase 5) — an eight-state main line (Idea → Exploration → Prototype → Testing → Refinement → Validation → Implementation → Archived), each state individually reasoned against its neighbors, explicitly **not copied** from Projects/Competitions/Achievement. The key design decision: multiple Prototype/Testing/Refinement cycles are modeled as repeated Iteration-log entries at a fixed status, never as the main lifecycle status looping backward — consistent with every sibling domain's forward-only discipline. No separate Verification/Published pair was added on top of Validation/Implementation — reasoned explicitly as unnecessary bureaucracy, not omitted by oversight. Three terminal branches (Discontinued, Not Validated, Revoked), each justified.
- **Cross-Domain Relationships** (Phase 6) — all eleven relationships the mission named, each classified as owns/references/must-never-compute. Innovation follows the **standard** Blueprint/Parent-Experience pattern (unlike Wellbeing's deliberate departure) since it is a showcase-type domain, not confidential — but gets **zero relationship** to Wellbeing, Community Service, and Leadership, the same "no relationship, named explicitly" protection ADR-0016/0017 already established, reused here to prevent double-counting and domain-family conflation.
- **Evidence Principles** (Phase 7) — the mission's own frozen text, applied: Innovation exists because evidence exists (eight named evidence types); Innovation never exists because AI says it is innovative — absolute, no exception.
- **Educational Principles** (Phase 8) — the mission's own eight principles, each individually reasoned against a specific phase of the ADR, plus one more ("no score, no ranking, ever") explicitly justified by the Phase 10 popularity-bias risk it prevents — not invented speculatively.
- **Constitutional Review** (Phase 9) — checked against Articles I, II, VI, VIII, and X by name, plus RAS §3.
- **Risks and Protections** (Phase 10) — all ten risks the mission named, each mapped to a specific protection already frozen in the phases above, including a genuinely considered answer to "Innovation becoming another upload folder" (a structurally-typed, phase-gated Iteration log, not a freeform media dump).
- **Future Extensions** (Phase 11) — all fifteen named, reserved only, with Patents/Industry mentorship/University collaborations flagged as likely needing their own future ADR given legal/institutional stakes.

---

## Rejected Alternatives (explicit, per this series' established documentation discipline)

- **Copying Achievement/Competition/Leadership's explicit two-step Verification→Published pattern** — rejected; Validation already serves as this domain's evidence-confirmation gate and Implementation already serves as its credential-worthy state, so a fourth confirmation layer would add bureaucracy without new educational meaning.
- **Modeling iteration as the main lifecycle status looping backward** (Testing → Prototype → Testing again) — rejected in favor of the append-only Iteration log absorbing repeated cycles at a fixed status, preserving every sibling domain's forward-only discipline.
- **A single "Failed" terminal branch covering every stopping reason** — rejected in favor of two distinct branches (Discontinued vs. Not Validated), since "stopped for a general reason" and "rigorously tested and specifically disproven" are different, separately meaningful facts.
- **Giving Innovation a relationship to Community Service/Leadership** (e.g. an innovation that also serves a community need) — rejected; any real-world overlap is independently recorded in each domain, never auto-derived, to prevent double-counting exactly as ADR-0016 already established for its own siblings.

---

## What This Sprint Explicitly Did Not Do

- Did not design a single table, column, migration, repository, service, route, API, or UI component.
- Did not modify `lib/learnerPortfolio/`, `lib/learnerAchievement/`, `lib/learnerProjects/`, `lib/learnerCompetitions/`, `lib/learnerBlueprint/`, `lib/parentExperience/`, or `lib/career/` — all were only read, to verify ownership assumptions, per the mission's explicit instruction.
- Did not build an upload mechanism, prototype storage system, innovation scoring, or AI evaluation of any kind.
- Did not decide the exact Iteration-log entry-type vocabulary, the exact Mentor data model, or how Achievement's `innovation` field evolves to reference a real Innovation Entry — all are named, reasoned, and explicitly deferred to future, separately-approved sprints.

**Sprint 13H is complete. Per the STOP CONDITION, Sprint 13I (Learner Innovation implementation) was not started — waiting for explicit approval.**
