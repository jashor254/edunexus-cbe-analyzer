# Sprint 12I — Learner Blueprint Presentation Architecture

**Status: architecture only. No React page, component, PDF renderer, QR generator, API, repository, or service was created or modified in producing this document.**

**Companion to**: `adr-0009-blueprint-presentation-architecture.md` (the binding decision — read that first). This document is the reference detail, the real-surface audit, and the full matrices beneath it.

---

## 0. Audit — Every Current and Planned Blueprint Consumer

Grounded in the actual current codebase, not hypothetical surfaces:

| Consumer | Route(s) that exist today | Who opens it | Why | Permissions | Device | Detail level today |
|---|---|---|---|---|---|---|
| Teacher Workspace | `app/teacher/*` (incl. `core-office`, `core-team`, `core-admissions`, `core-readiness`) | Teacher | Manage class, view learner standing | `requireClassTeacher`/school-admin checks (Core) | Desktop-primary, responsive | Full — teachers see the most detail of any audience |
| Parent Portal | `app/(parent)/report-card`, `app/(parent)/career-intelligence*`, `app/dashboard/*` (clinic, learning-compass, assessments) | Parent/guardian | Understand child's standing, download reports | `students.user_id`/`parent_user_id` ownership checks | Mobile + desktop | Report Card full, Career Intelligence full report, Clinic PDF |
| Learner Portal | `app/(student)/*` (`blueprint`, `career`, `holiday`, `progress`), `app/student/groups` | Learner | Self-view of progress/career | session-based, self only | Mobile-primary | **An unmigrated "Blueprint" page already exists** — `app/(student)/blueprint/page.tsx` renders `components/student/StudentBlueprint`, built against the pre-Sprint-12G `lib/learnerIntelligence/` engine, not the new canonical `lib/learnerBlueprint/` composition engine. This is a real, concrete migration target for Sprint 12J+, not a hypothetical future surface. |
| School Administration / Academic Office | Not a separate app — lives inside Teacher Workspace's `core-office`/`core-team`/`core-admissions`/`core-readiness` routes | School admin | Cross-class/cross-learner administration | `isSchoolAdmin` | Desktop-primary | Administrative, not currently Blueprint-shaped |
| Report Cards | `app/(parent)/report-card` | Parent | Official term result | ownership-checked | Mobile + desktop | Full, independent (ADR-0005 §5) |
| Learning Compass | `app/dashboard/learning-compass` (parent view), `app/(student)` (learner session) | Parent, Learner | Track/engage with adaptive learning | ownership/session | Mobile-primary for learner | Full Compass experience, outside Blueprint's scope entirely |
| Career Intelligence | `app/(parent)/career-intelligence`, `app/(parent)/career-intelligence-report`, `app/(parent)/career-report`, `app/(student)/career` | Parent, Learner | Explore career matches | ownership/session | Mobile + desktop | Full — three parent-facing variants already exist, a duplication risk flagged in the earlier `sprint-12c-academic-clinic-hardening.md` audit, unresolved, out of this sprint's scope |
| Academic Clinic | `app/academic-clinic`, `app/dashboard/clinic`, `app/api/clinic/download` | Parent, self-service | Legacy PDF report | mixed, some gaps flagged in `sprint-12c-academic-clinic-hardening.md` | Desktop-primary (PDF) | Full, independent pipeline, not yet the canonical Blueprint |
| PDF Export | Not yet built for the new engine (Academic Clinic has its own, separate, PDF pipeline — ADR-0005 §4 terminology freeze keeps them distinct) | Any audience | Printable/shareable artifact | inherits viewer's audience | N/A (artifact) | Future: Layer 3 fixed rendering (ADR-0007 §15) |
| Print | Not yet built | Any audience | Physical/A4 artifact | inherits viewer's audience | N/A | Future: same as PDF |
| Mobile | Existing responsive web only — no native app | Any audience | On-the-go access | inherits viewer's audience | Phone/tablet | Future Blueprint-specific collapse/expand behaviour, §10 |
| Future API consumers | None exist yet | University, Employer, Government (ADR-0008 Part 7), future third-party integrations | External verification/admissions/employment | Not yet designed — flagged, not decided, this sprint | Server-to-server / embedded widget | Future — Layer 1/2 only per §5's audience matrix |

**Key audit finding**: the platform already has **three separate, undecided-relationship surfaces** that a future Blueprint rollout must reconcile — the old `app/(student)/blueprint` page (pre-canonical engine), the Academic Clinic PDF pipeline (`lib/academicClinic/`, terminologically frozen as the "internal engine" per ADR-0005 §4 but not the same code as the new composition engine), and three duplicate Career Intelligence parent routes. None of these are touched by this sprint (architecture only) — they are named here so Sprint 12J does not rediscover them from scratch.

---

## 1. Presentation Layers — full detail

### Layer 1 — Quick Overview
**Purpose**: answer the Core Question in the time it takes to glance at a cover page. **Contains**: learner identity (name, photo, school, class), Growth Status one-word headline, Educational Identity label or its insufficient-evidence placeholder (ADR-0006 §9), verification QR (ADR-0007 §12). **Always visible**, on every surface, every audience, every device — this is the one layer with zero audience-based hiding (mirrors ADR-0007 §2.1's Identity treatment).

### Layer 2 — Educational Profile
**Purpose**: the five-minute read (Core Question, literally). **Contains**: Identity block, Academic Record summary (overall trend + top 2-3 competency highlights, ADR-0007 §2.2), Attendance summary (Trend + Health only, ADR-0007 §4), Parent Summary (for Parent audience) or its audience-equivalent synthesis, one-line Learning Compass and Career Intelligence snapshots. **Default-expanded** for every audience except mobile-first-load (§10).

### Layer 3 — Full Blueprint
**Purpose**: every ADR-0005 section at full field depth, still one Composition (ADR-0008 Part 6), never recalculated per layer. **Contains**: full Academic Record (subject table, competencies, sparkline), full Attendance (all five ADR-0006 §5 fields where available), full Learning Compass snapshot (all five ADR-0007 §5 fields), full Career Intelligence snapshot (all five ADR-0007 §6 fields), Teacher Reflection (once implemented), Educational Identity with full limitations text (ADR-0006 §9). **Reached by expansion**, never a separate page load — same document, more sections open.

### Layer 4 — Historical Snapshots
**Purpose**: longitudinal comparison — "what did this look like last term." **Contains**: any Blueprint Snapshot (ADR-0008 Part 3), selectable by term, rendered identically to Layer 3 but explicitly labeled as historical/immutable (never mistaken for the Current Blueprint — Educational Constitution Article XI). **Reached by explicit navigation** (a term selector), never inline in the Current Blueprint's scroll (ADR-0009 Rejected Alternatives).

### Layer 5 — Evidence Trail
**Purpose**: full traceability for any specific claim — "why does it say this." **Contains**: the `supporting_evidence_ids` already carried by every Projection (ADR-0008 Part 9) surfaced as a deep link into Evidence's own future learner-facing surface (ADR-0005 §3: Evidence is "indirect only" for Blueprint — this layer is a *link*, never a rendered Evidence explorer inside Blueprint itself, which would violate that indirect-only rule). **Reached only via explicit "why" affordance** on a specific claim, never a default-visible layer for anyone.

---

## 2. Surface Matrix (full)

| Surface | Shows | Hides | Summarizes | Links/QRs to | Interactive components | Print behaviour | Offline behaviour |
|---|---|---|---|---|---|---|---|
| Teacher Workspace | Layers 1-3, full (Teacher audience per ADR-0007 §14 — includes Attendance Risk/Support) | Layer 5 unless a specific "why" is clicked | n/a — teacher gets least summarization, most detail | Compass, Career, Report Card, future Evidence surface | Term selector (Layer 4), expand/collapse (Layer 3), "why" affordance (Layer 5) | A4 portrait export available (ADR-0007 §15) | Last-synced snapshot + staleness indicator (ADR-0007 §16) |
| Parent Portal | Layers 1-2 default-expanded, Layer 3 available on demand (Parent audience — Attendance Trend+Health only) | Attendance Risk detail unless paired with Support (ADR-0007 §4) | Parent Summary is the entry point (ADR-0007 §7/§12) | Compass, Career (QR on mobile-print, link in-app) | Term selector, expand/collapse | A4 portrait, black-and-white-safe (ADR-0007 §15) | Same as Teacher |
| Learner Portal | Layers 1-2 default-expanded, motivational framing (ADR-0006 §8) | Attendance Risk/Support entirely for this audience per ADR-0007 §14's table (Learner sees Trend only, encouraging tone) | Full Learner-toned Academic Record summary | Compass ("continue your journey"), Career ("explore careers") | Expand/collapse only — no term selector by default (a learner's own longitudinal view is Layer 4 but framed as "your growth," not "historical audit") | Same base rules, learner-toned copy | Same base rules |
| School Administration / Academic Office | Same as Teacher, but scoped to "one learner at a time" (ADR-0008 Part 7 — no cross-learner aggregate; that's Analytics, out of Blueprint's scope) | Nothing beyond Teacher's own hidden set | n/a | Same as Teacher | Same as Teacher | Same as Teacher | Same as Teacher |
| Report Cards | Nothing Blueprint-owned — remains fully independent (ADR-0005 §5) | n/a (separate document) | n/a | One citation link *from* a Blueprint Snapshot *to* the Report Card that existed at that moment — never the reverse | n/a | Unchanged, Report Cards' own existing pipeline | Unchanged |
| Learning Compass | Nothing Blueprint-owned | n/a | n/a | One inbound QR/link *from* Blueprint's Layer 2/3 Compass snapshot | Compass's own, entirely outside this ADR | Unchanged | Unchanged |
| Career Intelligence | Nothing Blueprint-owned | n/a | n/a | One inbound QR/link *from* Blueprint's Layer 2/3 Career snapshot | Career Intelligence's own, entirely outside this ADR | Unchanged | Unchanged |
| Academic Clinic | Nothing Blueprint-owned — separate, frozen-terminology internal engine (ADR-0005 §4) | n/a | n/a | None decided this sprint — reconciling Academic Clinic's PDF pipeline with Blueprint's Layer 3 print rendering is a named, deferred question (§11) | n/a | Its own existing pipeline, unaffected | n/a |
| PDF Export | Layer 3, fixed A4 portrait rendering (ADR-0007 §15), audience-scoped at generation time | Whatever the generating audience's matrix row hides | Same as the generating audience's Layer 2 | QR codes render as actual scannable codes (only "digital" surface where a QR is inert until scanned) | None — a PDF is static by nature | Is the print behaviour | n/a — a PDF is inherently a snapshot artifact, generated from the Current Blueprint or a Historical Snapshot, timestamped either way (ADR-0008 Part 3) |
| Print (physical) | Same as PDF Export | Same as PDF Export | Same as PDF Export | Same as PDF Export | None | Canonical A4 portrait, booklet as secondary future rendering (ADR-0007 §15) | n/a |
| Mobile | Layers 1-2 expanded, Layer 3 collapsed-by-default cards (§10) | Nothing beyond the viewing audience's own matrix row | Same as desktop for the same audience | Same links, tappable | Swipeable section cards permitted (§10), term selector as a picker sheet | Triggers the same PDF Export path | Last-synced + staleness indicator, most load-bearing surface for this rule since mobile is most likely to be used with poor connectivity |
| Future API consumers (University/Employer/Government) | Layer 1-2 only, per ADR-0008 Part 7's audience rows | Layers 3-5 entirely, until a future ADR extends this | Career Intelligence-first (Employer) or Academic Record-first (University) per ADR-0007 §12 | Not decided this sprint — whether external consumers get QR/links to Compass/Career at all is a privacy/scope question for a future ADR, not assumed here | None decided | Not decided | Not decided |

---

## 3. Progressive Disclosure — full detail

**Identity → Academic Snapshot → Attendance → Growth → Compass → Career → Evidence → Timeline → Appendix**

1. **Identity** — always first, always visible (Layer 1), anchors every reader regardless of audience.
2. **Academic Snapshot** — the first substantive content (Layer 2's Academic Record summary) — "how is this learner doing" is the most universally-relevant next question after "who is this."
3. **Attendance** — immediately after academics, before Compass/Career, because it answers "is the learner even present enough to learn" (ADR-0007 §5's educational framing) — a precondition-level question, not a forward-looking one, so it sits earlier than Compass/Career.
4. **Growth** — the synthesized trend across Academic + Attendance (Parent Summary's "detail" sentence, ADR-0007 §8, or the Growth Status cover headline) — a natural checkpoint after the two precondition sections before moving to forward-looking ones.
5. **Compass** — forward-looking, "what's being done about it right now."
6. **Career** — further forward-looking, "where might this lead."
7. **Evidence** — only for a reader who wants to verify a specific claim — deliberately after every narrative section, never interrupting the read.
8. **Timeline** — the longitudinal view, placed after Evidence because it's the most exploratory, least immediately-actionable layer (Layer 4, reached by explicit navigation per §1, not sequential scroll — its position in this list describes conceptual depth-order, not literal scroll position, since Layer 4 is a navigation target not a scroll section).
9. **Appendix** — Teacher Reflection, Educational Identity's full limitations text, provenance/signature blocks (ADR-0007 §12) — reference material a reader consults, not reads sequentially.

**Rule**: no surface may reorder this sequence for its own convenience — a surface may *truncate* it (show fewer steps, per its audience row in §2) but never *reorder* it. Reordering per audience is handled separately and explicitly by §5/ADR-0007 §12's reading-order table, which governs *entry point*, not the disclosure sequence once a reader continues past their entry point.

---

## 4. Navigation Philosophy — full rationale

**Chosen: single scrolling document, progressive disclosure via expand/collapse, QR as the only hard exit.**

Why not tabs: tabs are a strong signal that content in other tabs doesn't matter right now — directly working against "answer the Core Question in five minutes," which requires a reader to see the whole shape of the document even if they don't read every word. Why not a card grid: a grid has no implied order, and §3's fixed disclosure sequence is a load-bearing decision, not a nice-to-have — a grid can't express it without external labeling that becomes a de facto ordered list anyway (at which point it's just a worse version of the scrolling document). Why not a wizard: a wizard assumes every reader takes the same path at the same pace, contradicting the audience-specific reading order this ADR series has established since ADR-0007 §12.

**Desktop**: more sections expanded by default (ADR-0007 §16), reflecting the larger viewport's ability to show more without overwhelming. **Mobile**: Layer 1-2 only expanded by default, Layer 3 sections become tap-to-expand cards (§10) — same document, same order, different default expansion state. **Print**: the fixed Layer 3 rendering (ADR-0007 §15) — print has no "collapsed" state, since a folded/hidden section on paper is simply absent, and Layer 3's own field budgets (ADR-0007 §2's per-section maximums) already ensure it fits.

---

## 5. Audience Differences — full detail

Restates ADR-0007 §14's matrix as a **navigation** consequence, not a re-decision:

| Audience | Entry point (unchanged, ADR-0007 §12/§18) | Reachable layers | Notes |
|---|---|---|---|
| Teacher | Academic Record / Attendance detail | 1-5 | Fullest access, including Layer 5 |
| Parent | Parent Summary | 1-4 (Layer 5 available but not surfaced prominently — a parent *can* ask "why," it's just not a default affordance) | |
| Learner | Compass/Career (motivational) | 1-4, learner-toned | Layer 4 framed as "your growth" |
| University | Academic Record (historical) | 1-3, plus full Layer 4 | No Attendance Risk/Compass session detail (ADR-0007 §14) |
| Employer | Career Intelligence snapshot | 1-3, Layer 4 summary only | Inverse emphasis of University |
| School Leader | Same as Teacher, single-learner scoped | 1-5 | No cross-learner aggregate (ADR-0008 Part 7) |
| Government | Reserved | Undecided | No rules defined this sprint |

**Binding restatement**: none of these rows ever triggers a different Composition run (ADR-0008 Part 6) — the *same* composed object is filtered per row. A Teacher and a Parent viewing the same learner on the same day see numbers computed from the identical evidence snapshot; the only difference is which fields render and how deep the reader can navigate.

---

## 6. Snapshot Presentation — full navigation diagram

```
Current Blueprint (always live, ADR-0008 Part 3)
      |
      | [term selector — explicit navigation, Layer 4]
      v
Historical Blueprint Snapshot (immutable, timestamped)
      |
      | [one citation link, one direction]
      v
Report Card (published at that same moment — independent document,
             ADR-0005 §5, never re-rendered inside Blueprint)

Historical Blueprint Snapshot
      |
      | [one "why" link per claim, one direction]
      v
Evidence Trail (Layer 5 — a deep link into Evidence's own future
                    surface, never rendered inside Blueprint itself)
```

**Rule**: every arrow above is one-directional and single-purpose. A Report Card never links back "up" into a Blueprint (it doesn't know Blueprint exists — ADR-0005 §5's independence is preserved at the navigation layer, not just the data layer). The Evidence Trail is reached the same way from a Current Blueprint claim or a Historical Snapshot claim — the link's destination depends on which evidence supports the claim being asked about, not which layer the reader started from.

---

## 7. Learning Compass Relationship — full detail

Blueprint's Compass section (Layer 2 one-liner, Layer 3 five-field snapshot per ADR-0007 §5) is a **navigation dead-end** except for one explicit "Continue your learning journey" exit (QR on paper/PDF, a real in-app link on digital surfaces). There is no path from Compass's own surface back into Blueprint's Compass section specifically — a user finishing a Compass session returns to wherever Compass's own navigation sends them (entirely outside this ADR's authority, per ADR-0006 §3's ownership rule: Compass owns Compass). This one-directional design is deliberate: it prevents Blueprint and Compass from growing a shared navigation shell that would blur which one owns the experience a reader is currently in.

---

## 8. Career Intelligence Relationship — full detail

Identical principle and mechanism to §7, applied to Career Intelligence's one-snapshot rule (ADR-0006 §4). One exit ("Explore careers matched to your strengths"), no return path defined by this ADR. The three existing duplicate parent-facing Career Intelligence routes (§0's audit finding) are explicitly **not** reconciled by this sprint — a future sprint must decide which one Blueprint's QR should point to, or whether that duplication itself needs resolving first; this document only states that whichever surface is chosen, Blueprint links to it, never re-renders it.

---

## 9. Report Card Relationship — full navigation

Restates §6's diagram from the Report Card's perspective: **Report Card is always a dead-end.** It has zero awareness of Blueprint, zero embedded navigation into it, and remains generated, published, and viewed entirely through its own existing pipeline (`app/(parent)/report-card`, `lib/core/report-cards.ts`), unmodified by this sprint or any Blueprint sprint before it (ADR-0005 §5, restated every ADR in this series without exception). The only connection is the single citation link *from* a Blueprint Snapshot, added when Blueprint's presentation layer is eventually built — never the reverse, never a merge.

---

## 10. Mobile Philosophy — full decision table

| Element | Mobile behaviour |
|---|---|
| Layer 1 (cover-equivalent) | Always expanded, first thing shown |
| Layer 2 (Educational Profile) | Always expanded, immediately below Layer 1 |
| Layer 3 sections | Collapsed by default, tap-to-expand cards (one card per ADR-0005 section) |
| Layer 4 (Historical Snapshots) | In-app: reachable via a picker sheet (not QR-gated) for a logged-in session. Print/PDF context on a phone: QR-only, same as desktop print |
| Layer 5 (Evidence Trail) | QR/link-only on every device, including mobile — never inline, regardless of screen size (ADR-0005 §3's indirect-only rule for Evidence has no device exception) |
| Charts/sparklines | Identical to paper — no richer visualization unlocked by a larger interactive surface (ADR-0007 §3's sparkline-only rule has no mobile exception) |
| Section-to-section movement | Swipeable cards permitted *within* Layer 3's expanded state (e.g., swiping between subject cards in Academic Record) — never a swipe that changes which *layer* is showing, which stays scroll-based like desktop |
| Offline | Last-synced snapshot + visible staleness indicator (ADR-0007 §16) — the most load-bearing surface for this rule, since mobile is the likeliest context for poor connectivity |

---

## 11. Future Extension Points

1. **Reconciling the three already-existing, undecided-relationship surfaces** found in §0's audit: `app/(student)/blueprint` (old engine), Academic Clinic's separate PDF pipeline, and the three duplicate Career Intelligence parent routes. None resolved this sprint.
2. **University/Employer/Government API consumer design** — authentication model, rate limits, privacy scope (does an external consumer ever get a QR/link into Compass/Career at all) — flagged, not decided.
3. **Behaviour and the eighteen other reserved future modules** — the canonical 19-item list frozen in `sprint-12e-blueprint-layout-design.md` §17 (Sprint 12J correction, replacing this document's prior "thirteen other ADR-0007 §17" reference, itself a miscount flagged by the Sprint 12J-A consistency review) — once any is built, its presentation-layer treatment (which Layer, which audience rows) follows this ADR's existing pattern, not a redesign.
4. **PDF/Print implementation** for the new canonical engine specifically, distinct from Academic Clinic's existing separate pipeline.
5. **A native mobile app**, should one ever be built — §10's rules are written device-behaviour-first, not web-specific, so they should carry over, but this is explicitly unverified until a native app sprint actually exists.

---

## 12. Verification

- Every audience has one navigation path — §5 (rows differ in *reach*, not *path shape*).
- Every section has one owner — unchanged from ADR-0005 §3, reaffirmed, zero new sections introduced.
- No duplicated presentation — §2 (Report Cards/Compass/Career all remain single-owned, single-rendered, linked not duplicated).
- No duplicated calculations — §5's binding restatement (one Composition run, filtered per audience).
- No presentation contradicts earlier ADRs — every section above cites its ADR-0005/6/7/8 basis; Rejected Alternatives (ADR-0009) confirms no contradiction was introduced to resolve a hard case.
- Progressive disclosure is complete — §3, full nine-step order given with rationale for each position.
- Accessibility considered — inherits ADR-0007 §15 (colour never sole channel of meaning) unchanged, reaffirmed for every surface in §2.
- Printing considered — §2 (PDF Export/Print rows), §6/§9 (Report Card/Snapshot independence at print time too).
- Mobile considered — §10, full table.
- Offline considered — §2/§10 (staleness indicator, most load-bearing on mobile).
- Future extensions identified — §11, five items.

---

## Stop Condition

Per explicit mission instruction: this document, ADR-0009, and the implementation-log entry are the complete deliverable. **Stop here.** No Blueprint UI, React page, component, PDF renderer, QR generator, Parent/Learner Portal implementation, or API begins. Wait for explicit approval before Sprint 12J.
