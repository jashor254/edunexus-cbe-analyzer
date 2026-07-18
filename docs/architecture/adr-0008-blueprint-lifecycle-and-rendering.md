# ADR-0008 — Blueprint Lifecycle & Rendering Architecture

**Status: DRAFT — awaiting explicit approval before the first Blueprint implementation sprint (Sprint 12G).** Design-freeze document only. No code, UI, PDF, rendering engine, repository, service, route, database change, AI implementation, QR generation, notification, or integration was created or modified in producing it — confirmed: this document, `sprint-12f-blueprint-lifecycle.md`, and the implementation-log entry are the only files touched.

**Precedes**: Sprint 12G, the first Blueprint implementation sprint (explicit approval required, per Stop Condition).
**Supersedes**: nothing. **Does not reinterpret** ADR-0005, ADR-0006, or ADR-0007 — only extends them into lifecycle and rendering, the one dimension none of the three addressed.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (structure/ownership), `adr-0006-blueprint-educational-experience.md` (educational meaning), `adr-0007-blueprint-layout-and-experience.md` (layout/rendering surface), `adr-0004-attendance-integration-principles.md` (derived-data discipline, the direct precedent for §3's snapshot rule), `adr-0003-attendance-domain.md`, `reference-architecture-specification.md` §9/§10.7/§10.8, `docs/sprint-25-educational-constitution-and-migration-strategy.md`.

---

## Why This ADR Exists

ADR-0005 defined what Blueprint is and who owns each section. ADR-0006 defined what it means and how it should feel. ADR-0007 defined what it looks like and how it's laid out. None of the three answered a question that becomes unavoidable the moment implementation starts: **when does Blueprint's content actually change, and by what mechanism** — does opening the Blueprint compute it, does an event push an update to it, is there a "current" Blueprint distinct from a "snapshot," and what happens to a learner's Blueprint after they leave the school. Without this answered first, an implementation sprint would either invent a caching/refresh strategy under build pressure (risking exactly the kind of silent staleness or duplicate-computation problem `sprint-12c-academic-clinic-hardening.md` already found in the older Academic Clinic pipeline) or conflate Blueprint with Report Cards' own already-correct immutable-snapshot model without checking whether the same model actually fits a document ADR-0005 explicitly said is never a report card. This ADR answers the lifecycle and rendering question once, permanently — the fourth and final freeze in this series before implementation.

---

## Core Question

**How does the Learner Blueprint live from admission until graduation — and beyond?**

**Answer**: the Blueprint is never a document that is created, filled in, and finalized. It is a **continuously current composition** over evidence and state that already exists across canonical domains, from the moment a learner is admitted (Identity exists, everything else begins empty-but-valid, never broken) through every educational event that occurs, remaining perpetually "current" for as long as the learner is active — and, at defined moments (report card publication, term end, graduation), a **snapshot** of that current composition is frozen, immutable, and added to the learner's permanent historical record. After graduation, the "current" Blueprint stops changing (no new canonical events arrive) but does not disappear — it becomes the learner's final state, retained as an alumni record, with its own historical snapshots preserved exactly as they were during enrollment. This is the permanent operating model: **one continuously live composition, periodically frozen into immutable snapshots, never itself a report that gets "generated and filed."**

---

## Part 1 — Blueprint Lifecycle (frozen)

**Admission → First Evidence → Continuous Updates → Snapshots → Historical Timeline → Current Blueprint → Graduation → Alumni → Lifelong Learning**

Full stage-by-stage detail (what triggers each transition, what's true and false at each stage) is in the companion document §1. Summary rule: at every stage from Admission onward, "the Blueprint" refers to the same one composition — it does not get replaced, recreated, or regenerated at any transition. What changes across stages is only how much evidence exists to compose from, and, after Graduation, whether new evidence can still arrive at all.

**Binding rule**: Blueprint must never become "another report" — a document produced once and filed. Every stage in this lifecycle describes a state of an always-existing, always-current composition, never a new artifact.

---

## Part 2 — Blueprint State Model (frozen, minimal)

Rejecting the mission's illustrative state list down to exactly the states that describe a genuinely distinct condition of the *current* Blueprint (snapshots are not states of the current Blueprint — they are immutable artifacts it produces, see Part 3):

| State | Meaning | Rejected alternative and why |
|---|---|---|
| **Not Yet Active** | Learner admitted, Identity exists, no other evidence yet | "Not Started" / "Initializing" rejected as two states describing one condition — there is no meaningful transition between "not started" and "initializing" a composition that isn't run as a job |
| **Active — Building Evidence** | At least one educational event has occurred; some sections still show insufficient-evidence placeholders (per ADR-0006 §9, ADR-0007 §3) | "Evidence Growing" rejected as a synonym of this same state, not a distinct one |
| **Active — Established** | Every section has sufficient evidence to render meaningfully (no placeholders required) | — |
| **Alumni** | Learner has graduated/left; Current Blueprint stops accepting new evidence but remains viewable in its final state | "Retired" rejected as a duplicate of Alumni with worse connotation for an educational record |
| **Archived** | Retention-policy-driven read-only state, distinct from Alumni only in access/retention terms (a school-leaver may still access their own record; "Archived" is an operational/compliance state, not an educational one) | kept, narrowly, as an access-control state — not decided further this sprint (retention policy is out of scope) |

**Explicitly rejected**: "Teacher Verified" (verification belongs to Teacher Reflection's own approval workflow, ADR-0007 §7 — it is a property of one section, not a state of the whole Blueprint), "Snapshot Published" and "Historical Snapshot" (these describe snapshots, not the current Blueprint's state — conflating the two was the exact mistake Part 3 exists to prevent).

**Rule**: a state describes the *current* Blueprint's evidence-completeness or lifecycle phase, never a section-level property and never a snapshot property — those are separate concepts (Part 3).

---

## Part 3 — Snapshot Philosophy (frozen, permanent)

**Blueprint changes continuously. Report Cards never change. Snapshots freeze history. The Current Blueprint continues evolving.**

This is the single most important relationship this ADR fixes, and it is stated as a permanent, non-negotiable rule:

- **Report Cards** are, and remain, the official term assessment snapshot — owned entirely by the Report Cards domain, immutable once published, exactly as already established (ADR-0005 §5: "Blueprint... must never recompute or duplicate the report card's own scoring/ranking logic").
- **The Current Blueprint** is never immutable — it is defined by this ADR as continuously live, recomposed at read time (or read-adjacent time, per Part 6) from whatever canonical domain state currently exists.
- **A Blueprint Snapshot** is a new concept this ADR introduces: an immutable, timestamped freeze of the Current Blueprint's composition, taken at defined moments (report card publication, term end, graduation — never taken silently or on an arbitrary schedule). Once taken, a Snapshot never changes, exactly like a Report Card. A Snapshot is not a second Report Card and does not replace one — it exists because a longitudinal record (Growth Timeline, alumni history) needs frozen points to show change against, which "always current" data cannot provide by itself.
- **Relationship**: Report Card answers "what was this term's official result." Blueprint Snapshot answers "what did the learner's whole educational picture look like at this moment." Current Blueprint answers "what is true right now." All three can coexist for the same learner at the same moment without contradiction, because each answers a different question — this is the same non-competing-truths discipline RAS §10.6 already established for report pipelines generally, extended here to a third artifact type rather than treated as a duplicate.

---

## Part 4 — Educational Update Events

Blueprint changes only because a canonical domain event occurred — never because Blueprint itself decides to update. Full event catalog in the companion document §4 (Assessment recorded, Attendance recorded, Teacher Reflection submitted, Learning Compass progress, Career Discovery, and eleven further reserved future-domain events). **Binding rule**: Blueprint owns zero event-producing logic — every event in the catalog is emitted by its owning domain's own existing (or future) write path; Blueprint is purely a downstream reader of domain state, never a publisher, never a source, exactly mirroring RAS §9's Intelligence read-direction discipline.

---

## Part 5 — Rendering Philosophy

**Blueprint owns no calculations.** For every section, the rendering approach is to ask the owning domain three fixed questions, never to compute an answer to any of them itself:

1. **What happened?** (the evidence/fact — e.g., Attendance's own trend, Compass's own readiness label)
2. **Why does it matter?** (the domain's own meaning/interpretation of that fact — e.g., Attendance's own Health statement, Career Intelligence's own Outlook)
3. **What should happen next?** (the domain's own recommendation — e.g., Compass's own Recommended Action, Attendance's own Support Recommendation)

Every Blueprint section, without exception, must be answerable from its owning domain's own output to these three questions — never from a Blueprint-internal computation. This generalizes and makes permanent what ADR-0006 Principle Two already stated ("Blueprint composes, never duplicates, never recalculates") into an enforceable per-section test.

---

## Part 6 — Rendering Pipeline (conceptual, no implementation)

**Canonical Domains → Projection Engine (Academic Record's path per ADR-0005 §2.2; other domains' own canonical read functions for their sections) → Blueprint Composition → Audience Filter (ADR-0007 §14) → Paper Renderer / Digital Renderer (ADR-0007 §15/§16) → PDF → QR Links (ADR-0007 §11) → Interactive Experiences (each QR destination's own owning domain surface)**

Full flow-stage detail, including what each stage is and is not responsible for, is in the companion document §2. **Binding rule**: composition happens once, before the Audience Filter — the filter changes *visibility*, never re-triggers computation (restates ADR-0007 §14's rule at the pipeline-architecture level, not just the display-table level).

---

## Part 7 — Audience Rendering

Extending ADR-0007 §14's five audiences (Teacher/Parent/Learner/University/Employer) with two more the mission names: **School Leader** and **Government**. Both are pure additions to the existing visibility-filter model — full detail in companion document §3.

- **School Leader**: aggregate/comparative context beyond ADR-0007's per-learner audiences is explicitly **not** part of Blueprint's scope (a School Leader viewing one specific learner's Blueprint sees the same content a Teacher sees, since a Blueprint is always one learner's record — any cross-learner aggregate view is a separate, not-yet-designed Analytics concern, per ADR-0005 §3's "Analytics: No" row, not a Blueprint audience view).
- **Government**: reserved audience, no visibility rules decided this sprint (compliance/reporting requirements are undetermined) — included in the model as a named future slot, not designed.

**Rule restated from ADR-0007**: nothing is recalculated per audience, ever — only visibility changes.

---

## Part 8 — Paper vs. Digital (frozen, permanent)

**Paper answers: "what matters today?" Digital answers: "what else should I explore?"**

This generalizes ADR-0007 §15's printing rules into the permanent philosophical rule beneath them: paper is inherently a today-scoped, decision-relevant summary (exactly why Parent Summary, Attendance's paper fields, and the cover page's headline fields were each scoped the way ADR-0007 scoped them); digital is inherently exploratory and always-available (exactly why Learning Compass and Career Intelligence get QR codes rather than full inline content, per ADR-0006 §11). **QR codes are educational doorways, never shortcuts to a duplicate rendering of the same paper content** — a QR code must always lead to a genuinely deeper/different experience (the owning domain's own live surface), never to a digital copy of what the paper page already said.

---

## Part 9 — Evidence Traceability (frozen, permanent)

Every rendered statement in Blueprint must be traceable to exactly one owning domain and, ultimately, to evidence that domain owns. Blueprint may never contain: AI guesses, personality assumptions, unsupported recommendations, duplicated calculations, or hidden confidence. This is not new — it restates Educational Constitution Articles I, VI, IX, and XI, and ADR-0006 Principle Two — made explicit here as a rendering-time enforcement rule: **if a sentence cannot be traced to an owning domain's own function, it does not render.** No exceptions, no "the Blueprint layer smooths this over" fallback.

---

## Part 10 — Educational Intelligence Pattern (mandatory, universal)

Every Blueprint section, present and future, follows one fixed pattern, restating Part 5's three questions as the section-authoring rule every future section (including all nineteen reserved future modules in the canonical list, `sprint-12e-blueprint-layout-design.md` §17) must satisfy before it can be added to Blueprint:

**Evidence → Meaning → Action**, answering **What happened? → Why does it matter? → What should happen next?**

A proposed future section that cannot supply all three from its owning domain's own output is not ready to join Blueprint — this is the permanent admission test for every future module, stated once here rather than re-derived per future ADR.

---

## Part 11 — Future Compatibility

The rendering pipeline (Part 6) and the Educational Intelligence Pattern (Part 10) are deliberately domain-agnostic — neither names a specific domain's calculation, only the shape every domain must supply. This is why the nineteen reserved future modules (the canonical list frozen in `sprint-12e-blueprint-layout-design.md` §17: Behaviour, Wellbeing, Portfolio, Innovation, Projects, Community Service, Leadership, Entrepreneurship, Competitions, Sports, Arts, AI Skills, Digital Literacy, Scholarships, Global Certifications, future AI tutors, future University pathways, future Employment Record, lifelong learning) can be added later without redesigning Blueprint: each, when built, becomes one more canonical domain feeding the same pipeline, answering the same three questions, subject to the same audience-filter and paper/digital rules already frozen. Full per-domain compatibility notes in companion document §5. **No redesign is anticipated to be needed** — the pipeline's only dependency on a new domain is that the domain expose its own Evidence/Meaning/Action, exactly as every existing domain already does or will.

---

## Part 12 — Architectural Invariants (permanent, binding on all future Blueprint work)

1. Blueprint owns nothing.
2. Blueprint composes everything it displays; it originates nothing.
3. Blueprint never duplicates logic.
4. Blueprint never recalculates a value another domain already owns.
5. Blueprint never stores a second copy of another domain's data.
6. Snapshots are immutable, once taken.
7. The Current Blueprint is always live — never itself frozen except by taking a Snapshot.
8. Evidence precedes Intelligence; Meaning follows Evidence; Action follows Meaning (Part 10, permanent order, never reversed).
9. One canonical owner per educational fact (RAS §10.7/§10.8, restated as a Blueprint-specific invariant).
10. No educational statement without evidence (Educational Constitution Article I).
11. No AI claim without traceability (Educational Constitution Article VI, Article IX).
12. No recommendation without an owning domain (Part 5's three-question test).

---

## Constitutional / RAS Compliance

- **Educational Constitution Article I** (Evidence is the only currency of truth) — Part 9, Part 12 invariant 10.
- **Article II** (Missing evidence is never poor performance) — Part 2's "Active — Building Evidence" state exists precisely to represent this without treating incompleteness as failure.
- **Article VI** (AI explains evidence; it never invents it) and **Article IX** (every recommendation must be traceable) — Part 5, Part 9, Part 12 invariants 11-12.
- **Article XI** (a number without a name is not neutral) — Part 3's explicit three-artifact naming (Report Card / Snapshot / Current Blueprint) exists so no reader ever confuses which kind of "truth" they're looking at.
- **RAS §9** (Intelligence Standards) — Part 4's read-only event model, Part 6's pipeline sourcing Academic Record via the Projection Engine, restate and extend §9's existing rule rather than create an exception.
- **RAS §10.6** (One Report Pipeline) — Part 3 explicitly reasons from this rule to justify why three coexisting artifacts (Report Card, Snapshot, Current Blueprint) is not a violation: each answers a distinct, named question, never presenting two of them as interchangeably canonical for the same question.
- **RAS §10.7/§10.8** — Part 12 invariants 3-5, 9.
- **ADR-0003/ADR-0004** — Part 4's Attendance event entry and Part 6's pipeline remain presentation/read-only over Attendance's own summary, unchanged.
- **ADR-0005/0006/0007** — explicitly extended, not reinterpreted, throughout; every Part above cites the specific prior-ADR rule it builds on.

---

## Verification Against Mission's Checklist

- Full lifecycle defined — Part 1.
- No contradiction with ADR-0005 — every ownership/composition rule restated, not altered (Part 12 invariants 1-5 are verbatim extensions of ADR-0005 §3).
- No contradiction with ADR-0006 — Educational Intelligence Pattern (Part 10) is the same Evidence-first discipline ADR-0006 already required, made mandatory and universal.
- No contradiction with ADR-0007 — audience/paper-digital rules (Part 7, Part 8) extend ADR-0007 §14/§15 without changing them.
- No duplicated ownership introduced — Snapshot (Part 3) is explicitly a new *artifact type*, not a new owner of any existing domain's data; it owns only its own frozen-copy existence, which is Blueprint-composition-owned, not domain-owned, exactly as a Report Card's own snapshot precedent already works.
- No new canonical domain introduced — confirmed; School Leader/Government (Part 7) are audiences, not domains; Snapshot is an artifact, not a domain.
- Rendering pipeline fully defined — Part 6.
- Future extensibility preserved — Part 11.
- Educational Constitution compliance confirmed — above.
- RAS compliance confirmed — above.

---

## Stop Condition

This ADR, the companion lifecycle document, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** Do not begin the Blueprint rendering engine, PDFs, UI, APIs, repositories, services, or QR generation. Wait for explicit approval before Sprint 12G.
