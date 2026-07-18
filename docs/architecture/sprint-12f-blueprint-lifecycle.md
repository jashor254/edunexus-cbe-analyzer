# Sprint 12F — Blueprint Lifecycle and Rendering Architecture

**Status: architecture only. No rendering engine, PDF, UI, API, repository, service, QR generation, or integration was created or modified in producing this document.**

**Companion to**: `adr-0008-blueprint-lifecycle-and-rendering.md` (the binding decision — read that first). This document is the reference detail, diagrams, and extension analysis beneath it; the ADR governs wherever the two conflict.

---

## 1. Lifecycle Diagram (text)

```
ADMISSION
  Identity exists (school/class/guardian, per ADR-0005 §2.1).
  State: Not Yet Active.
  No academic, attendance, compass, or career evidence yet — every
  other section renders its insufficient-evidence placeholder
  (ADR-0006 §9, ADR-0007 §3), never a blank/broken page.
      |
      v
FIRST EVIDENCE
  Any one canonical domain event occurs (first assessment recorded,
  first attendance session, first Compass activity — see §4).
  State transitions: Not Yet Active -> Active - Building Evidence.
      |
      v
CONTINUOUS UPDATES
  Every further educational event (§4) updates what the Current
  Blueprint would compose, without Blueprint itself doing anything —
  Blueprint has no update job, no cron, no write path of its own
  (ADR-0008 Part 4). Once every section has sufficient evidence:
  State transitions: Active - Building Evidence -> Active - Established.
      |
      v (at defined moments only — never silently, never on a schedule)
SNAPSHOTS
  Report card publication, term end, or graduation triggers a
  Blueprint Snapshot: an immutable freeze of the Current Blueprint's
  composition at that moment (ADR-0008 Part 3). The Current Blueprint
  itself is untouched by taking a snapshot — it keeps evolving.
      |
      v
HISTORICAL TIMELINE
  Snapshots accumulate over the learner's enrollment, forming the
  read side of the Growth Timeline (ADR-0006 §10, ADR-0007 §10) —
  Timeline entries and Snapshots are related but distinct: a Timeline
  entry is one milestone; a Snapshot is a full composition freeze.
      |
      v
CURRENT BLUEPRINT (parallel, ongoing, not a lifecycle "stage" so much
  as the persistent state this whole diagram orbits — it exists from
  First Evidence onward and continues through every stage below,
  including Alumni.)
      |
      v
GRADUATION
  Learner's final Snapshot is taken. State transitions:
  Active - Established -> Alumni. No new canonical domain events
  arrive after this point for this learner (they are no longer
  enrolled), so the Current Blueprint stops changing — but it is
  NOT deleted, archived-by-default, or converted into a static PDF
  only. It remains the same live composition object, simply with no
  further events to compose from.
      |
      v
ALUMNI
  Current Blueprint (frozen in fact, though architecturally still
  "live" in the sense of Part 3 — it would resume updating if the
  platform ever gains a mechanism for post-graduation evidence, e.g.
  a future "Employment Record" domain, per ADR-0008 Part 11) plus the
  full accumulated Historical Timeline of Snapshots remain accessible.
      |
      v
LIFELONG LEARNING (future extension point only, not implemented)
  If a future domain (Employment Record, further certifications,
  continuing education) ever produces evidence for this learner post-
  graduation, it becomes one more canonical domain event feeding the
  same unchanged pipeline (ADR-0008 Part 11) — Alumni state would
  need a defined transition back toward "Active" or a new "Alumni -
  Continuing" state, not decided in this sprint, flagged as the one
  lifecycle question deliberately left open for whenever that future
  domain is actually scoped.
```

---

## 2. Rendering Flow (text diagram)

```
Canonical Domains (Assessments, Attendance, Learning Compass,
Career Intelligence, Teacher Reflection, future modules)
      |
      v
Projection Engine (for Academic Record specifically, per ADR-0005
§2.2 / RAS §9 — every other section reads its owning domain's own
canonical function directly, not through Projection, since Projection
is Academic-evidence-specific, not a universal Blueprint bus)
      |
      v
Blueprint Composition
  - Applies the Evidence -> Meaning -> Action pattern per section
    (ADR-0008 Part 5/Part 10) by calling each owning domain's own
    "what happened / why does it matter / what's next" output.
  - Produces one composed object representing the Current Blueprint
    (or, if triggered at a snapshot moment, one immutable Snapshot).
  - This is the ONLY stage that touches domain data. Every stage
    below only reshapes/filters what Composition already produced.
      |
      v
Audience Filter (ADR-0007 §14, ADR-0008 Part 7)
  - Applies the visibility matrix per audience (Teacher/Parent/
    Learner/University/Employer/School Leader/Government).
  - Never recalculates; only hides/shows already-composed sections.
      |
      v
   +--------------------+--------------------+
   |                    |                    |
   v                    v                    v
Paper Renderer      Digital Renderer     (future renderers, same
(ADR-0007 §15,      (ADR-0007 §16,        input contract)
 "what matters       "what else should
 today?", ADR-0008    I explore?",
 Part 8)              ADR-0008 Part 8)
   |                    |
   v                    v
  PDF               QR Links (ADR-0007 §11)
                          |
                          v
                    Interactive Experiences
                    (each QR's owning domain's
                     own live surface — Compass,
                     Career Intelligence, Portfolio,
                     etc. — NOT a Blueprint-owned
                     page, per ADR-0007 §11's rule)
```

**Binding note repeated from the ADR**: Composition is the single point where domain data enters the pipeline. Every stage after it is a pure function of what Composition already produced — Audience Filter, Paper Renderer, Digital Renderer, and PDF generation are all reshaping/filtering steps, never re-fetching or recomputing.

---

## 3. Audience Flow

Extending ADR-0007 §14's five-audience matrix with the two the mission adds:

| Audience | Entry point (unchanged from ADR-0007 §12/§18 unless noted) | Note |
|---|---|---|
| Teacher | Academic Record / Attendance detail | unchanged |
| Parent | Parent Summary | unchanged |
| Learner | Learning Compass / Career Intelligence (motivational) | unchanged |
| University | Academic Record (historical) | unchanged |
| Employer | Career Intelligence snapshot | unchanged |
| **School Leader** (new) | same view as Teacher, for one specific learner | Blueprint is always single-learner scoped (ADR-0005 §1) — a School Leader opening one learner's Blueprint sees what a Teacher sees for that learner; any cross-learner aggregate/comparative view is out of Blueprint's scope entirely (it would be Analytics, which ADR-0005 §3 already marks "No" for Blueprint consumption) |
| **Government** (new) | reserved, undecided | no visibility rules defined this sprint — compliance/reporting scope is undetermined; named as a future audience slot only |

**Rule unchanged from ADR-0007**: this table governs visibility only; Composition (§2) runs once regardless of which audience eventually views the result.

---

## 4. Educational Event Map

Every event capable of updating what the Current Blueprint would compose, by owning domain — Blueprint itself emits none of these:

| Event | Owning domain | Existing or future |
|---|---|---|
| Assessment recorded | Assessments | Existing |
| Attendance recorded | Attendance | Existing |
| Teacher Reflection submitted | Teacher Reflection (per ADR-0007 §7's approval workflow — only counts as an event once the teacher confirms, never on draft save) | Existing (per ADR-0006 §6) |
| Learning Compass progress | Learning Compass | Existing |
| Career Discovery | Career Intelligence | Existing |
| Competition result | Competitions (reserved) | Future |
| Innovation entry | Innovation (reserved) | Future |
| Leadership record | Leadership (reserved) | Future |
| Achievement recorded | no single owner yet — likely distributed across whichever domain produced it (Academic, Competition, etc.) rather than a standalone "Achievements" domain; not decided this sprint | Future / undecided |
| Behaviour record | Behaviour (reserved) | Future |
| Community Service record | Community Service (reserved) | Future |
| Portfolio item added | Portfolio (reserved) | Future |
| Project completed | Projects (reserved) | Future |
| Scholarship awarded | Scholarships (reserved) | Future |
| Entrepreneurship milestone | Entrepreneurship (reserved) | Future |
| Global Certification earned | Global Certifications (reserved) | Future |
| Future AI tutor session | Future AI tutors (reserved) | Future |
| Future University pathway update | Future University pathways (reserved) | Future |
| Future Employment Record entry | Future Employment Record (reserved) | Future |

**Rule**: an event only updates Blueprint by virtue of its owning domain's own state changing — there is no Blueprint-side event listener, subscription, or trigger table. The "update" is simply that the next time Composition runs (read time, or the next snapshot moment), it reads the domain's now-changed state. This is deliberately the simplest possible model — no event bus, no denormalized cache to keep in sync — consistent with ADR-0004 §5's "compute fresh, never cache across requests" precedent, generalized here to every domain, not just Attendance.

---

## 5. Future Compatibility Analysis

For each reserved future module, confirming it fits the existing pipeline (§2) and Educational Intelligence Pattern (ADR-0008 Part 10) without requiring pipeline redesign:

| Future domain | Evidence (what happened) | Meaning (why it matters) | Action (what's next) | Fits without redesign? |
|---|---|---|---|---|
| Behaviour | an incident/record its own domain owns | its own domain's interpretation | its own domain's recommendation | Yes — reserved slot already anticipated (ADR-0005 §2.6, ADR-0007 §17) |
| Wellbeing | a check-in or indicator | its own read of learner wellbeing | its own suggested support | Yes — same shape as Attendance's own Trend/Health/Support pattern |
| Portfolio | an item added | why it's notable | what to explore next in it | Yes — already has a reserved QR destination (ADR-0007 §11) |
| Innovation | an entry recorded | its significance | next step/opportunity | Yes — same QR pattern |
| Projects | a project completed/in progress | its educational relevance | recommended next project or skill | Yes — same QR pattern |
| Community Service | hours/activity recorded | its educational value | next opportunity | Yes |
| Leadership | a role/record | its significance | growth recommendation | Yes |
| Scholarships | an award | its significance | next eligible opportunity | Yes |
| Competitions | a result | its significance | next opportunity | Yes |
| Entrepreneurship | a milestone | its significance | next step | Yes |
| Global Certifications | a certification earned | its significance | next certification path | Yes |
| Future AI tutors | a session/outcome | its educational meaning | next recommended session | Yes — mirrors Learning Compass's existing shape exactly |
| Future Career Intelligence enhancements | enhanced match data | enhanced outlook | enhanced next step | Yes — extends the existing Career Intelligence section, not a new one |
| Future University pathways | a pathway match/update | its significance | next step toward it | Yes — likely folds into the existing University audience view (§3) rather than a new section |
| Future Employment Record | a post-graduation record | its significance | next step | Yes, **with the one open lifecycle question from §1** — requires deciding the Alumni-state re-activation question before implementation, not a pipeline redesign |
| Lifelong Learning generally | any of the above, indefinitely | — | — | Yes, contingent on the same open question above |

**Conclusion**: every reserved future module — now the single canonical 19-item list frozen in `sprint-12e-blueprint-layout-design.md` §17 (Sprint 12J correction to this table's own prior, differently-counted list) — fits the existing Composition → Audience Filter → Renderer pipeline (§2) and the Evidence → Meaning → Action pattern (ADR-0008 Part 10) without requiring a new pipeline stage, a new artifact type, or a change to any already-frozen ADR. The one genuinely open question is not architectural but lifecycle-specific: whether/how an Alumni-state Blueprint reactivates if a post-graduation domain (Employment Record, continuing certifications) begins producing evidence — flagged in §1 and here, deliberately left for whenever that domain is actually scoped, not resolved by guessing now.

---

## 6. Verification

- Full lifecycle defined — §1.
- No contradiction with ADR-0005 — Part 12 invariants (ADR-0008) are verbatim restatements of ADR-0005 §3's ownership rules; Snapshot is a new artifact type, not a reassignment of any ADR-0005 section owner.
- No contradiction with ADR-0006 — Educational Intelligence Pattern (ADR-0008 Part 10) is the same Evidence-first discipline ADR-0006 introduced, made mandatory and universal rather than restated per-section.
- No contradiction with ADR-0007 — Audience Filter (§2, §3) and Paper/Digital philosophy (ADR-0008 Part 8) extend ADR-0007 §14/§15/§11 without altering any already-decided field, budget, or QR destination.
- No duplicated ownership introduced — Snapshot and Current Blueprint are Blueprint-composition-owned artifacts (their existence, not their content), never a second owner of any domain's underlying data; §4's event map assigns zero events to Blueprint itself.
- No new canonical domain introduced — School Leader and Government are audiences (§3), not domains; Snapshot is an artifact (§1, ADR-0008 Part 3), not a domain.
- Rendering pipeline fully defined — §2.
- Future extensibility preserved — §5, with one flagged open question (Alumni reactivation) rather than a false claim of total resolution.
- Educational Constitution compliance confirmed — inherited from ADR-0008's own compliance section, unchanged here.
- RAS compliance confirmed — inherited from ADR-0008, unchanged here.

---

## 7. Known Extension Points (deliberately left open)

1. **Alumni-state reactivation** (§1, §5) — whether/how a post-graduation domain event reopens an Alumni Blueprint to "Active" — deferred to whenever Employment Record or a similar future domain is actually scoped.
2. **"Achievement recorded" ownership** (§4) — no single domain named yet; likely distributed rather than centralized, not decided this sprint.
3. **Government audience visibility rules** (§3) — reserved slot only, no content decided; compliance/reporting requirements are undetermined.
4. **Retention policy behind the "Archived" state** (ADR-0008 Part 2) — access-control/compliance question, out of scope for this architecture sprint.

None of these four block Sprint 12G's start on their own — they are lifecycle/policy refinements, not pipeline redesigns — but should be resolved (or explicitly deferred again, with reasons) before any implementation work that would touch them directly (e.g., building the Alumni state transition, or Government-facing views).

---

## Stop Condition

Per explicit mission instruction: this document, ADR-0008, and the implementation-log entry are the complete deliverable. **Stop here.** Do not begin the Blueprint rendering engine, PDFs, UI, APIs, repositories, services, or QR generation. Wait for explicit approval before Sprint 12G.
