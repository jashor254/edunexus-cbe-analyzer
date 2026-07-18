# Sprint 13C — Learner Leadership Domain (Architecture Only)

Architecture-only sprint, per explicit mission instruction: produces `adr-0015-learner-leadership-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, UI, election, voting, or messaging mechanism was written. Achievement, Portfolio, Projects, Competitions, Blueprint, Parent Experience, and Career Intelligence were read only, for ownership verification, never modified.

---

## Phase 1 — Audit First (done, before any design work)

Searched the entire codebase for every term the mission named: `prefect`, `captain`, `leader`, `leadership`, `council`, `committee`, `monitor`, `representative`, `club offices`, `student government`, `responsibility` — plus a direct read of Achievement, Portfolio, Projects, Competitions, Blueprint, Parent Experience, and Career Intelligence for any hidden or partial Leadership concept.

Full findings are in ADR-0015 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType`/`AchievementCategory` both include `'leadership'` | **The one real, partial implementation** — the identical situation ADR-0014 found for `'competition'`. A flat claim carrying only `title`/`description`/`awardingOrganization`/`awardDate`, despite ADR-0012 Phase 2's own text describing Leadership as carrying "a role title, scope, and duration" — none of which the shipped schema actually stores. Correctly scoped to what Achievement can represent (a recognition); not a service-process implementation. |
| `lib/repositories/project.repository.ts` — `ProjectCategory` includes `'leadership'` | A free-text Project category (the *work* a leader did), not the responsibility itself. Confirmed adjacent, not overlapping — no change to Projects. |
| `lib/learnerPortfolio/types.ts` — "Achievement domain (...Leadership...)" comment | Confirms Portfolio has never owned Leadership in shipped code, superseded by ADR-0012 before Portfolio's first sprint — identical to the Competitions precedent. |
| `app/student/groups/*`, `components/academy/CohortView.tsx` | Unrelated gamified study-group engagement and Academy teacher cohort views — already flagged once in ADR-0012's own audit. | 
| Every other searched term | No matching table, module, or feature. No `leadership_roles`, `student_council`, `class_monitor`, or `prefect_body` table exists anywhere. |

**Conclusion: no canonical Learner Leadership domain exists. The only real hit is Achievement's own correctly-scoped, provisional `leadership` claim type — the same "provisional assignment, no better domain existed yet" situation this whole ADR series has now resolved four times (Achievement, Projects, Competitions, and now Leadership). A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0015-learner-leadership-domain.md` freezes:

- **Definition** (Phase 2) — demonstrated responsibility held and exercised over time, never popularity or a title alone; explicitly distinguished from Achievement (recognition), Portfolio Item, Project, Competition Entry, Assessment/Evidence, Disciplinary Record, and Election/Voting Mechanism (the last two both explicitly rejected as Leadership-owned concepts).
- **Ownership** (Phase 3) — every concept (Position, Appointments, Responsibilities, Acting Appointments, Completed Service, Leadership Reflections, Mentor Verification, Evidence References, Recognition, Historical Record) owned once by Learner Leadership, with Leadership Reflections explicitly disambiguated from the unrelated, pre-existing Teacher Reflection domain (`lib/teacherReflection/`) to prevent a real terminology-collision risk.
- **Lifecycle** (Phase 4) — the full eight-state main line (Nomination → Selection → Active Service → Review → Completion → Verification → Published → Historical), each adjacent pair individually checked and confirmed not redundant, plus four named terminal branches (Not Selected, Discontinued, Rejected, Revoked) — the same proportionate complexity ADR-0014 froze for Competitions.
- **Blueprint relationship** (Phase 5) — summary-only field budget (current role, verified completed roles, service summary, leadership URL), explicitly excluding meeting logs, disciplinary records, and staff evaluations/review notes.
- **Portfolio relationship** (Phase 6) — Portfolio references Leadership, one direction; honestly notes Portfolio has no `leadership` category slot today (permanently reassigned to Achievement by ADR-0012), deferring any schema change to a future Portfolio-led decision.
- **Achievement relationship** (Phase 7) — the mission's central distinction, frozen explicitly: leadership *recognition* (a discrete award, Achievement-owned) versus leadership *service* (the ongoing responsibility, Leadership-owned) — neither implies the other, and Achievement's `leadership` type gains an optional reference field going forward, not built this sprint.
- **Career relationship** (Phase 8) — Career may read verified Leadership as evidence input; Leadership never computes employability; identical one-directional rule already proven for Portfolio and Competitions.
- **Audience matrix** (Phase 9) and **reserved extensions** (Phase 10) — nine named future sub-types (Student Parliament, House Leadership, Club Executive, Community Leadership, Faith Leadership, Sports Leadership, Digital Leadership, Peer Mentorship, Alumni Leadership), reserved only, no schema, no premature taxonomy commitment.
- **Risks and protections** (Phase 11) — eight named risks (popularity bias, duplicated achievement, duplicated portfolio, disciplinary overlap, unverifiable appointments, title inflation, missing evidence, long-term history), each with a specific architectural protection already frozen in the ownership/lifecycle phases above.

---

## What This Sprint Explicitly Did Not Do

- Did not design a single table or column.
- Did not write a migration, repository, service, or UI component.
- Did not modify `lib/learnerAchievement/`, `lib/learnerPortfolio/`, `lib/learnerProjects/`, `lib/learnerCompetitions/`, `lib/learnerBlueprint/`, `lib/parentExperience/`, or `lib/career/` — all were only read, to verify ownership assumptions, per the mission's explicit instruction.
- Did not build an election, voting mechanism, dashboard, analytics, leaderboard, badge, messaging, notification, certificate, parent feature, or AI summary.
- Did not decide the exact Position title vocabulary, the exact verifying-party data model, or how Achievement's `leadership` field evolves — all three are named, reasoned, and explicitly reserved for future, separately-approved sprints, not decided here under schedule pressure.

**Sprint 13C is complete. Per the STOP CONDITION, Sprint 13D (Learner Leadership implementation) was not started — waiting for explicit approval.**
