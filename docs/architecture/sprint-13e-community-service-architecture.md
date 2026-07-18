# Sprint 13E — Learner Community Service Domain (Architecture Only)

Architecture-only sprint, per explicit mission instruction: produces `adr-0016-learner-community-service-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, UI, or upload mechanism was written. Achievement, Portfolio, Projects, Competitions, Leadership, Blueprint, and Career Intelligence were read only, for ownership verification, never modified.

---

## Phase 1 — Audit First (done, before any design work)

Searched the entire codebase for every term the mission named: `volunteering`, `service`, `outreach`, `charity`, `environment`, `clean-up`, `tree planting`, `civic`, `church`, `mosque`, `temple`, `NGO`, `mentorship`, `blood donation`, `social impact`, `community`, `public service` — plus a direct read of Achievement, Portfolio, Projects, Competitions, Leadership, Blueprint, and Career Intelligence for any hidden or partial Community Service concept.

Full findings are in ADR-0016 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `lib/repositories/achievement.repository.ts` — `AchievementType`/`AchievementCategory` both include `'community_service'` | **The one real, partial implementation** — the identical pattern found for Competitions (ADR-0014) and Leadership (ADR-0015). A flat claim carrying only `title`/`description`/`awardingOrganization`/`awardDate`, despite ADR-0012 Phase 2's own text describing Community Service as carrying "hours, activity type, verifying party" — none of which the shipped schema stores. |
| `lib/repositories/project.repository.ts` — `ProjectCategory` includes `'community'` and `'environmental'` | Free-text Project categories (the *work*, e.g. a community clean-up organized as a bounded project), not the ongoing service relationship itself. Confirmed adjacent, not overlapping — no change to Projects. |
| `lib/learnerPortfolio/types.ts` — "Achievement domain (...Community Service...)" comment | Confirms Portfolio has never owned Community Service in shipped code, superseded by ADR-0012 before Portfolio's first sprint — identical to the Competitions/Leadership precedent. |
| ADR-0012 Phase 8 — "Citizenship → folded into Community Service," "Environmental → folded into Community Service" | Classification decisions this ADR inherits and does not revisit — confirms scope, does not create a competing domain. |
| `lib/environment/` (`types.ts`, `context.ts`, `index.ts`) | Pure infrastructure naming collision — the platform's dev/staging/production runtime config module, nothing to do with environmental service. Confirmed by reading. |
| Every other searched term | No matching table, module, or feature. No `community_service`, `service_hours`, `volunteering`, or `outreach` table exists anywhere in the migrations directory. |

**Conclusion: no canonical Learner Community Service domain exists. The only real hit is Achievement's own correctly-scoped, provisional `community_service` claim type — the same "provisional assignment, no better domain existed yet" situation this whole ADR series has now resolved five times. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0016-learner-community-service-domain.md` freezes:

- **Definition** (Phase 2) — verified, sustained contribution beyond personal/academic obligation; explicitly distinguished from Leadership (a role held vs. service rendered), Achievement (recognition vs. the service itself), Projects (bounded work vs. an ongoing relationship), Portfolio Item (a showcase vs. a verified record), a hypothetical future Behaviour domain (explicitly rejected as a concept this domain must never become), and Attendance.
- **Ownership** (Phase 3) — a full matrix of what Community Service owns (Service Activity, Engagement/Entry, Commitment, Active Service period, Review, Completion, Verified Hours, Reflection, Mentor/Verifying Party, Evidence References, Historical Record) *and* an explicit "never owns" table naming every adjacent domain's boundary — the mission's own instruction to define both directions.
- **Lifecycle** (Phase 4) — an eight-state main line (Opportunity → Commitment → Active Service → Review → Completion → Verification → Published → Historical) deliberately shaped like Leadership's (ongoing-relationship structure) rather than Competition's (bounded-event structure), per the mission's own "reflect service over time, not merely participation" instruction. Three terminal branches (Discontinued, Rejected, Revoked), each justified — and a fourth, "Not Undertaken" (mirroring Leadership's Not Selected), explicitly considered and **rejected** with real reasoning: an untaken Opportunity has no third-party decision worth preserving, unlike a Nomination.
- **Cross-domain relationships** (Phase 5) — all ten relationships the mission named (Blueprint, Portfolio, Achievement, Leadership, Projects, Competitions, Career Intelligence, Parent Experience, Report Cards, Snapshots, Evidence), each one direction only, no circular ownership, no duplicated truth. Leadership explicitly gets **no relationship at all**, named as the direct architectural protection against double-counting.
- **Educational Principles** (Phase 6) — the five the mission named, plus one more explicitly justified by a named Phase 8 risk (compulsory-service inflation), not invented speculatively.
- **Visibility matrix** (Phase 7) — Learner/Parent/Teacher/School/University/Employer/Public, with Public explicitly named but reserved (no public-facing surface built or implied), plus paper-vs-digital treatment for the one field group meaningful on paper (completed service).
- **Risks and protections** (Phase 8) — seven named risks (popularity bias, compulsory-service inflation, unverifiable claims, double-counting with Leadership, Portfolio duplication, evidence quality, future AI misuse), each with a specific architectural protection already frozen in the phases above — including an explicit statement that this ADR grants no standing permission for any future AI summarization/verification feature.

---

## What This Sprint Explicitly Did Not Do

- Did not design a single table or column.
- Did not write a migration, repository, service, or UI component.
- Did not modify `lib/learnerAchievement/`, `lib/learnerPortfolio/`, `lib/learnerProjects/`, `lib/learnerCompetitions/`, `lib/learnerLeadership/`, `lib/learnerBlueprint/`, or `lib/career/` — all were only read, to verify ownership assumptions, per the mission's explicit instruction.
- Did not build an upload mechanism, verification workflow, dashboard, report, Blueprint/Portfolio/Achievement integration, or AI summary.
- Did not decide the exact Cause/Organization vocabulary, the exact verifying-party data model, how Achievement's `community_service` field evolves, or the exact compulsory/voluntary flag's data model — all are named, reasoned, and explicitly reserved for future, separately-approved sprints, not decided here under schedule pressure.

**Sprint 13E is complete. Per the STOP CONDITION, Sprint 13F (Learner Community Service implementation) was not started — waiting for explicit approval.**
