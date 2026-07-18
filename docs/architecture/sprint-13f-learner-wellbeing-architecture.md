# Sprint 13F — Learner Wellbeing Domain (Architecture Only, Guardian Mode)

Architecture-only sprint, per explicit mission instruction: produces `adr-0017-learner-wellbeing-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, API, React component, UI, portal, dashboard, notification, evidence ingestion, AI summarizer, wellbeing scoring, or recommendation engine was written. Every sibling domain (Teacher Reflection, Portfolio, Achievement, Projects, Competitions, Leadership, Community Service, Blueprint, Parent Experience, Career Intelligence, Learning Compass, Attendance, Evidence) was read only, for ownership verification, never modified.

---

## Phase 1 — Audit First (done, before a single architectural decision)

Searched the entire codebase for every term the mission named — `wellbeing`, `well-being`, `well being`, `mental`, `wellness`, `support`, `counselling`, `counseling`, `guidance`, `safety`, `risk`, `concern`, `incident`, `health`, `medical`, `emotion`, `mood`, `stress`, `reflection`, `pastoral`, `care`, `guardian`, `bullying`, `welfare` — never assuming the answer in advance. Full findings are in ADR-0017 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `wellbeing`/`well-being`/`well being` (exact terms) | **Zero hits, anywhere.** No table, column, comment, or type uses this vocabulary in any spelling. |
| Teacher Reflection's own migration (`20260717150000_teacher_reflections.sql`) and service (`lib/teacherReflection/reflection.ts`) | **The single most important finding.** Both explicitly and permanently exclude "behaviour, discipline, counselling" and "diagnosis, predictions, personality typing, medical claims" from their own scope — a real, prior architectural decision (Sprint 12O) that this gap was recognized once already and correctly left unfilled. This ADR is the fulfillment of that exclusion. |
| `lib/projection/types.ts` `RiskFlag`/`RiskValue`, `lib/school/intelligence.ts` `top_strand_concerns`, `lib/parentPulse/builder.ts`'s "concern"/"concerning" | All read in full — confirmed purely **academic** risk/concern (declining subject performance), never psychological. A vocabulary-adjacent, not overlapping, system — named explicitly in the ADR so a future implementer never confuses academic "risk" with a wellbeing concern. |
| `_frozen/eils/*` — "concern" hits | Part of the already-retired EILS/EIR intelligence layer, moved to `_frozen/` in a prior sprint — dead code, not a candidate owner, and about academic/engagement concerns even when it was live. |
| Every other searched term (career-guidance demo copy, curriculum vocabulary, generic marketing/UI text, "type-safety" comments) | Incidental word matches only, read and dismissed individually. |

**Conclusion: no canonical Learner Wellbeing domain exists, in whole or in part. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0017-learner-wellbeing-domain.md` freezes:

- **Educational Definition** (Phase 2) — the one truth only Wellbeing can hold: that support was needed, was provided, by whom, with what outcome. Explicitly distinguished from all eleven other named domains, with Teacher Reflection and the (non-existent) Behaviour domain given the most careful treatment since they are the two easiest domains to accidentally conflate this one with.
- **Ownership Matrix** (Phase 3) — fourteen concepts (Support Plan, Wellbeing Check-in, Support Review, Support Conversation, External Referral, Support Goal, Support Outcome, Support Status, Support History, Confidential Notes, Visibility Classification, Support Team, Escalation Status, Closure), every one owned exclusively by Wellbeing, with a deliberate two-tier Plan/Check-in structure (not every concern needs a full formal Plan — forcing one would itself over-medicalize a minor, transient need).
- **Educational Philosophy** (Phase 4) — nine explicitly rejected concepts (diagnosis, psychology engine, medical record, discipline system, attendance replacement, teacher-commentary replacement, AI emotional detector, surveillance system, behaviour/risk score), each with its own stated reason, not a bare list.
- **Lifecycle** (Phase 5) — the mission's own instruction to "reject unnecessary states... never copy blindly" was taken seriously: this domain's lifecycle deliberately has **no Published state at all**, the single biggest structural departure from every prior domain in this series (Achievement/Projects/Competitions/Leadership/Community Service all end in Published because they produce a showcaseable credential; Wellbeing produces nothing meant to be shown to anyone outside a narrow support team, ever). Two terminal branches (No Action Needed, Withdrawn), each justified; Escalation Status is explicitly modeled as a parallel field, not a lifecycle state, because real escalation doesn't happen in orderly sequence.
- **Constitutional Constraints** (Phase 6) — ten frozen, permanent rules, including the mission's own five examples plus five more this ADR judged necessary given the domain's stakes (traceability, permanent separation from discipline, no numeric score ever, visibility only ever tightens).
- **Relationships** (Phase 7) — all thirteen relationships the mission named, explicitly classified as reads/writes/references/none. The result: **Wellbeing has almost no relationships at all** — a deliberate, privacy-protecting outcome. Only two narrow, read-only references exist (Attendance, Evidence); every other domain, including Blueprint and Parent Experience, gets an explicit "none," breaking this whole series' otherwise-universal patterns on purpose.
- **Privacy** (Phase 8) — a closed set of visibility tiers (Core Support Team / School Leadership / General School Staff [no default access] / Parent [none by default] / Learner [reserved] / future Counsellor [reserved] / University-Employer-Public [never, ever]) — the first domain in this series to depart from the standard blanket school-staff-read RLS pattern, justified explicitly by the qualitative difference between a record the school is proud to show and a record of vulnerability.
- **AI Boundary** (Phase 9) — an exhaustive, closed "may"/"must never" list, requiring its own separately-approved ADR to ever expand — no silent scope creep permitted during implementation.
- **Reserved Extensions** (Phase 10) — ten named future capabilities (Peer Support, Counselling, External Specialists, Medical Integration, Support Network, Family Engagement, Crisis Management, Safeguarding, Transition Support, Return-to-School Plans), reserved only, with Safeguarding and Medical Integration flagged as likely needing their own future ADR given regulatory/ethical stakes.
- **Risks and Protections** (Phase 11) — ten named risks, each mapped to a specific protection already frozen in the phases above.
- **Verification** (Phase 12) — checked against the Constitution, RAS, ADR-0003 through ADR-0016, and the full one-owner/evidence-first/no-duplicate-calculation/no-hidden-intelligence/no-AI-invention/no-second-truth checklist.

---

## Rejected Alternatives (explicit, per the mission's instruction to document them)

- **Copying the Achievement/Competition/Leadership/Community-Service lifecycle shape wholesale** (ending in Published) — rejected because Wellbeing has no external audience or showcase purpose; forcing a Published state would misrepresent the domain's actual function and create pressure toward a surface that should never exist.
- **Naming the first lifecycle state "Opportunity"** (matching every sibling domain) — rejected as tonally wrong for a concern-driven domain; "Concern Raised" was chosen instead.
- **A single-tier Support Plan model** (every concern gets a formal Plan) — rejected in favor of a two-tier Plan/Check-in structure, so minor, transient needs are not over-formalized.
- **Reusing the standard blanket school-staff-read RLS pattern** every sibling domain uses — rejected explicitly (Phase 8); Wellbeing needs a Support-Team-scoped model instead, a genuine, justified departure from this series' otherwise-uniform security convention.
- **Wiring Wellbeing into Blueprint's summary composition**, even as a bare existence flag — rejected; even a minimal "has active support" signal on a broadly-read surface was judged too risky given the domain's stakes.
- **Allowing Parent Experience's default "reads X's Blueprint summary" pattern to apply here** — rejected; parent visibility is deferred entirely to a future, explicitly-designed, consent-gated capability.

---

## What This Sprint Explicitly Did Not Do

- Did not design a single table, column, migration, repository, service, route, API, or UI component.
- Did not modify `lib/teacherReflection/`, `lib/learnerPortfolio/`, `lib/learnerAchievement/`, `lib/learnerProjects/`, `lib/learnerCompetitions/`, `lib/learnerLeadership/`, `lib/learnerBlueprint/`, `lib/parentExperience/`, `lib/career/`, `lib/compass/`, or `lib/projection/` — all were only read, to verify ownership assumptions, per the mission's explicit instruction.
- Did not build a portal, dashboard, notification, evidence-ingestion pipeline, AI summarizer, wellbeing scoring mechanism, or recommendation engine.
- Did not decide the exact learner-facing visibility rules, whether verbatim conversation content is ever stored, the exact Support Team access-control implementation, or any detail of the ten reserved future extensions — all are named, reasoned, and explicitly deferred to future, separately-approved sprints, several of which (Safeguarding, Medical Integration) are flagged as likely needing their own ADR given their stakes.

**Sprint 13F is complete. Per the STOP CONDITION, Sprint 13G (Learner Wellbeing implementation) was not started — waiting for explicit approval.**
