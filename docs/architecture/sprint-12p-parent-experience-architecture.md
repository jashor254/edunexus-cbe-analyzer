# Sprint 12P — Parent Experience Architecture

**Status: architecture and documentation only, per explicit mission instruction.** No page, component, route, API, database change, notification, or message was created or modified in producing this document — confirmed: this document, `adr-0010-parent-experience-architecture.md`, and the implementation-log entry are the only files touched.

---

## Phase 1 — Parent Experience Audit

Audited every existing parent-facing feature in the codebase before freezing anything.

### Real, live parent-facing surfaces found

| Surface | What it does | Source data |
|---|---|---|
| `app/(parent)/report-card/page.tsx` | Renders a published Report Card, including `class_teacher_comment` | `school_report_cards` directly (Report Cards domain) |
| `app/(parent)/career-intelligence/page.tsx` | Client page calling `/api/parent/career-intelligence` | `lib/career/parentIntelligence.ts`'s `buildParentIntelligence()` |
| `app/(parent)/career-intelligence-report/page.tsx` | A second, similarly-named career report surface | Not yet reconciled with the page above — same naming pattern (`career-intelligence` vs `career-intelligence-report` vs `career-report`, three near-identical route names) is itself a minor terminology inconsistency worth flagging, not just a data one |
| `app/(parent)/career-report/page.tsx` | A third career-report surface | Same note as above |
| `app/api/cron/parent-pulse/route.ts` + `lib/parentPulse/builder.ts` | Weekly WhatsApp digest per student, built from scratch every run | Projection Engine (knowledge/risk) + legacy `learnerModel` profile (`career_signals`, `engagement_patterns`) + Compass sessions + formative signals + a career-slug lookup |
| `lib/holiday/planner.ts` | Holiday plan's own `parent_action`/`parent_summary`/AI-generated WhatsApp message | DeepSeek AI call (`generateEnrichedPlan`), not deterministic |
| `lib/academicClinic/reportGenerator.ts`'s `buildParentAction()` | Academic Clinic's own parent action generator | Academic Clinic's own subject-progress data |
| `lib/learnerBlueprint/composeParentSummary.ts` | Blueprint's own Parent Summary section | Deterministic templating over Blueprint's already-composed Academic Record + Attendance only — explicitly "no LLM, no generated paragraphs" (Sprint 12G) |
| Attendance (`lib/core/attendance.ts`) | No parent-specific visibility rule exists yet at the Core layer — flagged in the code itself as "Sprint 11G's own" future work | — |

### Duplicated parent information / conflicting terminology / overlapping responsibility — the real finding

**This audit's central finding**: at least **five independently-built systems** currently generate "what should the parent understand" content, each with its own tone, its own data source, and its own vocabulary, with zero shared terminology layer between them:

1. Blueprint's `composeParentSummary` — conservative, deterministic, in-app.
2. `parentPulse/builder.ts` — a narrative WhatsApp message ("Strong this week:", "Needs attention:", "Worth keeping an eye on:"), AI-adjacent tone but deterministic assembly, its own risk/confidence phrasing.
3. `lib/career/parentIntelligence.ts` — capability-dimension conversation starters and support suggestions, a completely separate vocabulary ("analytical_reasoning," "resilience") from Blueprint's own Career section terms ("Emerging Career Cluster").
4. `lib/holiday/planner.ts` — a genuinely AI-generated (DeepSeek) parent WhatsApp message and summary, the only one of the five that is not deterministic.
5. `lib/academicClinic/reportGenerator.ts`'s `buildParentAction` — Academic Clinic's own, a fourth-different phrasing convention.

None of these five read from or agree with Blueprint's own `composeParentSummary`. Two consequences, both real: a parent could receive a WhatsApp pulse saying "Needs attention: Mathematics" the same week Blueprint's in-app Parent Summary says nothing about Mathematics at all (different underlying signals: Projection knowledge-level vs. Academic Record's overall trend), and the terminology a parent learns from one channel (e.g. "Learning Strengths" doesn't exist anywhere yet — no channel currently translates technical terms at all, each just writes its own prose ad hoc) doesn't carry over to the next.

**This is not fixed in this sprint** — per the mission's explicit scope ("architecture and documentation only... no implementation"), reconciling five live systems is a real, separate future migration, not something a design-freeze document does by writing new code. What this sprint *does* do: Part 8 of ADR-0010 freezes, permanently, that any *future* Parent Experience surface reads only from Blueprint — so the reconciliation path is now unambiguous (point future work at Blueprint, retire or bridge the other four over time) rather than an open question. This mirrors exactly how Sprint 12N handled finding a deprecated career-matching pathway: document precisely, fix the one thing in scope (there: Blueprint's own read; here: the frozen future-facing rule), leave the rest for its own scoped sprint.

### Missing educational flow

No existing parent surface currently shows Teacher Reflection (the domain didn't exist until Sprint 12O), Career Intelligence's own cluster-level view (parent surfaces still show job-level detail via `buildParentIntelligence`, not yet aligned with Sprint 12N's cluster-only Blueprint restriction), or any Historical Growth view backed by Blueprint Snapshots (Sprint 12K/12L). The Parent Journey (ADR-0010 Part 2) is frozen precisely to give a complete, ordered answer these fragments don't currently add up to.

---

## Phase 2 — Definition

Frozen in ADR-0010 Part 1: *"Parent Experience is the educational partnership layer through which parents understand, support, and celebrate their child's learning journey."* Explicitly not monitoring, surveillance, teacher-grading, constant alerts, or academic pressure.

---

## Phase 3 — Parent Journey

Frozen in ADR-0010 Part 2 — ten steps, Welcome through School Communication, each with its documented rationale for its position in the sequence.

---

## Phase 4 — Visibility Matrix

Frozen in ADR-0010 Part 3 — every current and near-future Blueprint section classified Yes / Summary only / Partial / Never / Future, plus the explicit rule that a new section is invisible by default until a visibility decision is made for it.

---

## Phase 5 — Educational Language

Frozen in ADR-0010 Part 4 — a twelve-row terminology table (Capability Projection → Learning Strengths, Risk Index → Needs Extra Support, Attendance Percentage → Learning Time, and others), with the explicit rule that no internal term is ever shown verbatim on any Parent Experience screen. This terminology table is the direct answer to Phase 1's "conflicting terminology" finding — it is the one shared vocabulary layer none of the five existing systems currently have.

---

## Phase 6 — Support Actions

Frozen in ADR-0010 Part 5 — every screen answers "what can I do," actions are always specific and small, and an empty source section produces an honest "not enough information yet" rather than an invented action.

---

## Phase 7 — Information Boundaries

Frozen in ADR-0010 Part 6 — the explicit never-list (internal AI confidence, teacher drafting notes, evidence debugging, raw Projection metadata, identity-bridge state, repository/table/version identifiers, audit trails, internal remarks), generalized as a parent-specific corollary of ADR-0008 Part 9's traceability rule.

---

## Phase 8 — Emotional Design

Frozen in ADR-0010 Part 7 — the informed/encouraged/included/hopeful vs. judged/overwhelmed/scared/confused/compared test, applied per-screen, with an explicit rule that Parent Experience never ranks or compares across learners.

---

## Phase 9 — Relationship With Blueprint

Frozen in ADR-0010 Part 8, permanently one-directional: Blueprint feeds Parent Experience, never the reverse. This is the rule that resolves Phase 1's five-systems finding going forward (see above).

---

## Phase 10 — Relationship With Report Cards

Frozen in ADR-0010 Part 9 — three non-competing artifacts (Report Card = official term document, Blueprint = longitudinal record, Parent Experience = daily partnership layer), with the explicit rule that Parent Experience displays a published Report Card's own content as-is, never a re-derived summary of it.

---

## Phase 11 — Future Extensions

Reserved, not designed, in ADR-0010 Part 10: parent messaging, appointments, learning reminders, holiday guidance, homework support, community events, school announcements, fee reminders, transport, health. Noted: holiday guidance already partially exists today via `lib/holiday/planner.ts`'s own WhatsApp message — a future consolidation candidate, not something this ADR resolves.

---

## Phase 12 — Constitutional Review

Verified against the Educational Constitution and ADR-0004 through ADR-0009 in ADR-0010's own Compliance section — no contradictions found. Every Parent Experience rule this ADR freezes is either a direct restriction of an already-frozen ADR-0006/0007 field list, or a parent-specific corollary of an already-frozen ADR-0008 traceability/lifecycle rule — nothing here reinterprets a prior ADR.

---

## Required Verification — evidence

- **One Parent Experience definition exists**: ADR-0010 Part 1, a single frozen sentence.
- **Blueprint remains canonical**: ADR-0010 Part 8 — one-directional, permanently frozen; confirmed no code was written that could violate it (this sprint wrote no code at all).
- **Report Cards remain independent**: ADR-0010 Part 9 — confirmed by design; `lib/core/report-cards.ts` was not touched.
- **No ownership duplication exists**: confirmed — Parent Experience is explicitly named a presentation layer (Architectural Assessment, "no domain ownership changes"), not a new canonical domain; ADR-0010's own header states this.
- **Terminology is standardized**: ADR-0010 Part 4's twelve-row table — the first shared vocabulary layer across what Phase 1 found to be five independently-worded systems.
- **Educational flow is defined**: ADR-0010 Part 2, ten steps with documented rationale for each position.
- **Information boundaries are explicit**: ADR-0010 Part 6 and Part 3's visibility matrix.
- **Constitutional compliance verified**: ADR-0010's Compliance section, cross-referencing every named document.
- **Implementation log updated**: see `docs/engineering/implementation-log.md`.

---

## Stop Condition

Per explicit mission instruction: the Parent Experience architecture is frozen. **Stop here.** Do not build the Parent Portal, notifications, messaging, authentication, Behaviour, Portfolio, Projects, or any UI. Waiting for explicit approval before Sprint 12Q.
