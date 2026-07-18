# ADR-0010 — Parent Experience Architecture

**Status: DRAFT — awaiting explicit approval before the first Parent Experience implementation sprint (Sprint 12Q).** Design-freeze document only. No page, component, API route, database table, notification, message, or authentication change was created or modified in producing it — confirmed: this document, `sprint-12p-parent-experience-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: Sprint 12Q and every subsequent Parent-facing implementation sprint (Parent Portal build-out, parent messaging, parent notifications).
**Supersedes**: nothing. **Contradicts no prior ADR** — extends ADR-0005/0006 (Blueprint structure and meaning), ADR-0007/0009 (layout, audience visibility, presentation layers — Parent is already one of ADR-0007 §14's five named audiences), and ADR-0008 (lifecycle, snapshots, rendering pipeline) into the one dimension none of them fully specified: not *what* Blueprint contains or *how* it renders, but *how a parent, specifically, should experience it* — journey order, language, emotional tone, and what must never be shown.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (§3 ownership, §7 QR strategy), `adr-0006-blueprint-educational-experience.md` (§3 Learning Compass fields, §4 Career fields, the Evidence→Meaning→Action pattern), `adr-0007-blueprint-layout-and-experience.md` (§14 audience visibility — Parent already named), `adr-0008-blueprint-lifecycle-and-rendering.md` (Part 3 Snapshot philosophy, Part 5 rendering philosophy — "ask, never compute"), `adr-0009-blueprint-presentation-architecture.md` (5-layer presentation hierarchy, the real `app/(parent)/*` surfaces it already found), `docs/architecture/sprint-12o-teacher-reflection-domain.md` (Teacher Reflection, the newest Blueprint section this journey includes), Educational Constitution.

---

## Why This ADR Exists

Every prior Blueprint ADR answered a question about the record itself: what it contains (0005), what it means (0006), how it's laid out (0007), how it lives and freezes (0008), how it presents across surfaces structurally (0009). None of them answered the one question that becomes unavoidable the moment a real Parent Portal gets built: **when a parent — not a teacher, not an admin, not a developer — opens this, what should the experience actually feel like, in what order, in what language, and what must never appear at all.** Without this answered first, a Parent Portal sprint would invent journey order, terminology, and visibility rules under build pressure, on top of a Blueprint whose parent-facing content is *already* being independently reinvented in at least five separate places across this codebase (Phase 1's audit, below) — repeating the exact "invent a design under pressure" failure mode ADR-0006/0007/0008 already existed to prevent for Blueprint's structure.

---

## Core Question

**Blueprint is the canonical educational record. A parent is not a teacher, not an analyst, and not a surveillance operator. What experience turns that record into a five-minute understanding that strengthens the home-school partnership, without ever asking the parent to interpret raw data?**

**Answer**: Parent Experience is a **presentation layer only**, strictly downstream of Blueprint (Part 8), with its own frozen journey (Part 2), its own plain-language terminology (Part 4), an explicit visibility boundary (Part 3, Part 6), and a single design test applied to every future screen: *does this leave a parent informed, encouraged, included, and hopeful — never judged, overwhelmed, confused, scared, or compared* (Part 7).

---

## Part 1 — Definition (frozen)

**Parent Experience is the educational partnership layer through which parents understand, support, and celebrate their child's learning journey.**

It is explicitly **not**: monitoring, surveillance, a teacher-grading mechanism, a constant-alerts feed, or a source of academic pressure. A parent screen that makes a parent feel like an inspector, a competitor, or a source of pressure on the child has failed this definition regardless of how accurate its data is.

---

## Part 2 — Parent Journey (frozen)

```
Welcome
  ↓
Today's Snapshot
  ↓
Current Blueprint
  ↓
Teacher Reflection
  ↓
Attendance Health
  ↓
Learning Compass
  ↓
Career Snapshot
  ↓
Historical Growth
  ↓
Support At Home
  ↓
School Communication
```

**Why this order** — each step answers a specific question, in the order a caring, non-expert reader would naturally ask it, moving from *orientation* through *the record* through *what to do*:

| Step | Question it answers | Why here |
|---|---|---|
| Welcome | "Where am I, whose record is this?" | Orientation must precede content — matches ADR-0009 Layer 1 (Quick Overview) |
| Today's Snapshot | "Is everything okay right now?" | The first real content a worried or busy parent sees must be the fastest possible reassurance/status, not a wall of sections |
| Current Blueprint | "What is the fuller picture?" | The canonical record itself, once the parent is oriented and reassured |
| Teacher Reflection | "What does the person who actually knows my child think?" | Sprint 12O's newest section — placed early and prominently because it is the most *human* part of the record, the one most likely to build trust, immediately after the data-shaped Blueprint |
| Attendance Health | "Is my child present enough to learn?" | Foundational to everything academic that follows (ADR-0004's own attendance-first educational framing) |
| Learning Compass | "What is my child working on right now?" | The active, present-tense layer, naturally following the foundational/backward-looking sections |
| Career Snapshot | "Where might this be heading?" | Forward-looking, deliberately placed after the present-tense sections, never before them |
| Historical Growth | "How far have we come?" | Longitudinal context belongs after the current picture is understood, not before |
| Support At Home | "What do I actually do?" | Every journey must end in action (Phase 6) — placed after the full picture, not scattered earlier, so it's never mistaken for a hidden agenda behind the data |
| School Communication | "How do I reach the school?" | The practical exit point, last because it's always available, not because it's least important |

No step computes anything — each is a presentation view over Blueprint sections (or, for Welcome/School Communication, over Identity/school metadata Blueprint already carries). Historical Growth reads Blueprint Snapshots (ADR-0008 Part 3), never recomputed.

---

## Part 3 — Visibility Matrix (frozen)

| Blueprint Section | Parent Visibility | Notes |
|---|---|---|
| Identity | Yes | Learner name, admission number, class, school — the orientation layer |
| Academic Record | Yes | Trend + subject list, exactly as Blueprint composes it — never raw Projection values |
| Attendance | Summary only | Percentage + plain-language health status; daily session-level detail is Teacher/Admin only |
| Learning Compass | Yes | The four ADR-0006 §3 fields only (Current Focus, Readiness [when it exists], Holiday Programme availability, Next Recommended Action) |
| Career Intelligence | Yes | Cluster-level orientation only (Sprint 12N) — never a specific predicted job, exactly as Blueprint itself already restricts |
| Teacher Reflection | Yes | The published reflection only — a draft-in-progress is invisible to Parent Experience exactly as it's invisible to Current Blueprint (Sprint 12O) |
| Parent Summary | Yes | This section already exists specifically for this audience (ADR-0005 §2.8) |
| Educational Identity | Future | `not_implemented` in Blueprint today — Parent Experience shows nothing until the domain exists, never a placeholder guess |
| Growth Timeline | Future | Same — `not_implemented` today |
| Evidence Trail | No | Traceability is a teacher/auditor concern (ADR-0009 Layer 5), never a parent-facing layer |
| Confidence/Freshness Metadata | Partial | A plain-language equivalent only when it changes what a parent should do (e.g. "still building a picture" instead of a bare Low/Medium/High label); the raw label itself is not shown |
| Internal IDs (learner_id, snapshot_id, evidence_id, etc.) | Never | No technical identifier of any kind appears in any Parent Experience screen |
| Owner strings / repository/service names | Never | Internal architecture is never parent-facing |

**Rule**: a new Blueprint section is Parent-visible only when an explicit visibility decision is made for it (mirroring ADR-0007 §14's own rule that nothing is visible by default) — silence is never "yes."

---

## Part 4 — Educational Language (frozen terminology table)

| Technical term (internal / Teacher-facing) | Parent-facing term |
|---|---|
| Capability Projection | Learning Strengths |
| Risk Index / Risk Flag | Needs Extra Support |
| Attendance Percentage | Learning Time |
| Freshness: partial | Still Building the Picture |
| Confidence: Low | Early Signs (Still Confirming) |
| Confidence: High | Well Established |
| Snapshot | A Moment in {Child}'s Journey |
| Overall Trend: declining | An Area to Focus On Together |
| Overall Trend: improving | Growing Well |
| Career Cluster | An Area {Child} Is Exploring |
| Evidence | What We've Seen So Far |
| Unavailable (status) | Not Enough Information Yet |

**Rule**: every parent-facing screen uses only this table's right column (or a screen-specific equivalent added to it under the same review discipline) for any concept with a technical name — no internal field name, status enum value, or algorithm term is ever shown verbatim. This is a permanent terminology contract, not a per-screen style choice: extending it requires the same freeze discipline as this ADR, so language never silently drifts between screens the way the Phase 1 audit already found it has across the five existing parent-facing generators.

---

## Part 5 — Support Actions (frozen principle)

**Every parent-facing screen answers "what can I do?"** — Blueprint informs, parents act. Examples: read together, encourage revision, practice a specific skill, discuss career interests, support attendance, celebrate progress. An action is always specific and small (matching Educational Constitution Article II's "missing evidence is never poor performance" spirit — an action is a next step, never a verdict). No screen ends on a bare fact with no suggested response; if Blueprint's own source section has no actionable content, the screen says so plainly ("Not enough information yet") rather than inventing an action.

---

## Part 6 — Information Boundaries (frozen, permanent)

Parents never see: internal AI/confidence scores (only the Part 4 plain-language equivalent), teacher drafting notes (only a *published* Teacher Reflection, per Sprint 12O's own lifecycle), evidence debugging output, raw Projection metadata, identity-bridge state (Core↔legacy resolution is entirely invisible), repository/service/table names, algorithm identifiers or version strings, audit trails, or internal remarks (`lib/remarks/evidence.ts`'s raw teacher-remark evidence stream is a Teacher/Projection-internal input, never a Parent Experience surface). This restates ADR-0008 Part 9's "if it cannot be traced to an owning domain's own function, it does not render" as a parent-specific corollary: **if a fact is internal machinery rather than an owning domain's finished, human-authored conclusion, it does not render to a parent, regardless of how interesting or "transparent" it might seem to show.**

---

## Part 7 — Emotional Design (frozen)

Every screen must leave a parent feeling **informed, encouraged, included, hopeful**. Every screen must never leave a parent feeling **judged, overwhelmed, scared, confused, or compared** (to another learner, another class, or a statistical average). This is a design test, not a content rule — the same underlying fact ("attendance is at 78%") can pass or fail it entirely based on phrasing and surrounding context (Part 4/5's language and action-orientation exist specifically to pass this test consistently). No screen in Parent Experience ever ranks, compares, or aggregates across learners — that data may exist for School Leader/Admin audiences (ADR-0008 Part 7) but is structurally absent from every Parent Experience surface.

---

## Part 8 — Relationship With Blueprint (frozen, permanent, one-directional)

```
Blueprint
   ↓ feeds
Parent Experience
```

**Never the reverse.** Parent Experience originates nothing, computes nothing, and stores nothing Blueprint doesn't already have — it is purely a presentation/language/journey layer over Blueprint's own composed sections (and, for Historical Growth, over Blueprint Snapshots). No future Parent Experience feature (messaging, appointments, reminders — Part 10) may write back into Blueprint, Learning Compass, Career Intelligence, Teacher Reflection, or any canonical domain. This is the same read-only discipline ADR-0008 Part 4 already established for Blueprint's own relationship to canonical domains, extended one layer further.

---

## Part 9 — Relationship With Report Cards (frozen)

Three artifacts, three non-competing purposes (extending ADR-0008 Part 3's Report Card/Snapshot/Current-Blueprint distinction with a fourth):

| Artifact | Answers | Cadence |
|---|---|---|
| **Report Card** | "What was this term's official result?" | Per-term, official, immutable once published |
| **Blueprint** | "What is my child's whole educational picture, right now and historically?" | Continuously current, frozen only at Snapshot moments |
| **Parent Experience** | "What do I, as a parent, need to understand today, and what should I do?" | Always-available, daily-partnership cadence |

No duplication: Parent Experience never recomputes or re-summarizes what a Report Card already officially states — it links to or displays the Report Card's own published content as-is (exactly as `app/(parent)/report-card/page.tsx` already does today) rather than re-deriving a parallel "official result." Report Cards remain entirely independent — this ADR changes nothing about how they're generated, published, or displayed.

---

## Part 10 — Future Extensions (reserved, not designed, not implemented)

Named as future slots only, per the mission's explicit instruction not to design them yet: parent messaging, appointments, learning reminders, holiday guidance (already partially live via `lib/holiday/planner.ts` — see the Sprint 12P audit's consolidation note), homework support, community events, school announcements, fee reminders, transport, health. Each, when built, must satisfy Part 8's one-directional rule and Part 7's emotional-design test — no other constraint is frozen for any of them here.

---

## Constitutional / RAS / ADR Compliance (Phase 12)

- **Educational Constitution Article I** (Evidence is the only currency of truth) — every Parent Experience screen displays only Blueprint's own evidence-grounded sections, per Part 3/Part 6.
- **Article II** (Missing evidence is never poor performance) — "Not Enough Information Yet" (Part 4) is the frozen phrasing precisely so absence never reads as failure.
- **Article VI/IX** (AI explains, never invents; every recommendation traceable) — Part 5's actions all trace to Blueprint's own owning-domain content; no Parent Experience screen may originate a recommendation Blueprint didn't already carry.
- **Article XI** (a number without a name is not neutral) — Part 4's entire terminology table exists to satisfy this article for a non-expert audience specifically.
- **ADR-0004** — Attendance Health's placement (Part 2) and Summary-only visibility (Part 3) both extend, not alter, Attendance's existing educational framing.
- **ADR-0005 §3/§7** — no new ownership introduced; Parent is a named audience, not a domain (matches ADR-0007 §14's existing five-audience model).
- **ADR-0006** — the Learning Compass/Career field lists Part 3 restricts to are exactly ADR-0006 §3/§4's own frozen fields, not a reinterpretation.
- **ADR-0007 §14** — Parent Experience's visibility matrix (Part 3) is a refinement of, not a departure from, the audience-visibility model §14 already established.
- **ADR-0008 Part 3/Part 5/Part 9** — Historical Growth reads Snapshots without recomputation (Part 3 Part 2 row); Part 6 restates Part 9's traceability rule as a parent-specific corollary.
- **ADR-0009** — the Parent Journey (Part 2) is a specific instance of ADR-0009's presentation-layer model, not a competing structure; the real `app/(parent)/*` surfaces ADR-0009 already found are the ones Sprint 12P's audit re-examined.

No contradictions found.

---

## Stop Condition

This ADR, the companion `sprint-12p-parent-experience-architecture.md`, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** Do not begin the Parent Portal UI, authentication, notifications, messaging, SMS/WhatsApp, payments, Behaviour, Portfolio, Projects, QR generation, APIs, database changes, or any teacher/learner dashboard changes. Wait for explicit approval before Sprint 12Q.
