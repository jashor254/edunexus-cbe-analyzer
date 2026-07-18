# ADR-0009 — Blueprint Presentation Architecture

**Status: DRAFT — awaiting explicit approval before Sprint 12J (Blueprint UI Implementation).** Design-freeze document only. No React page, component, PDF renderer, QR generator, API, repository, service, or domain calculation was created or modified in producing it — confirmed: this document, `sprint-12i-blueprint-presentation-architecture.md`, and the implementation-log entry are the only files touched.

**Precedes**: Sprint 12J and every subsequent Blueprint-surfacing sprint (Teacher Workspace, Parent Portal, Learner Portal, PDF export, mobile, future API consumers).
**Supersedes**: nothing. **Contradicts no prior ADR** — extends ADR-0005 (structure/ownership), ADR-0006 (educational meaning), ADR-0007 (layout/audience visibility), ADR-0008 (lifecycle/rendering pipeline) into the one dimension none of them fully specified: how the same composed object actually appears, differently, across every real surface, without becoming five different reports.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md`, `adr-0006-blueprint-educational-experience.md`, `adr-0007-blueprint-layout-and-experience.md` (§14 audience visibility, §15 printing, §16 device behaviour — this ADR's starting point, not a redo), `adr-0008-blueprint-lifecycle-and-rendering.md` (Part 6 rendering pipeline, Part 7 audience rendering, Part 8 paper/digital philosophy — this ADR sits directly downstream of Audience Filter), `adr-0004-attendance-integration-principles.md`, `reference-architecture-specification.md` §9.

---

## Why This ADR Exists

ADR-0007 already produced a 9-row audience visibility matrix and printing rules; ADR-0008 already defined a rendering pipeline ending in "Paper Renderer / Digital Renderer → PDF → QR Links → Interactive Experiences." Neither answered the question a real implementation sprint immediately hits: **which actual, already-existing EduNexus surface renders which layer, in what order, with what navigation model, and how does a user move between Blueprint and the five adjacent experiences (Compass, Career Intelligence, Report Cards, Snapshots, Evidence) without the boundary blurring.** This sprint answers that permanently, grounded in the real surfaces that already exist in this codebase, not hypothetical ones — the audit below found real, live routes (`app/(parent)/report-card`, `app/(parent)/career-intelligence`, `app/dashboard/clinic`, `app/dashboard/learning-compass`, `app/(student)/blueprint`, `app/teacher/core-office`, `app/teacher/core-team`) that any future implementation sprint must reconcile with, not ignore.

---

## Core Question

**One Blueprint exists. Five audiences consume it. Many platforms display it. How do all those experiences remain one Blueprint rather than five different reports?**

**Answer**: by fixing, permanently, one **presentation hierarchy** (5 layers, §1) that every surface draws from without exception, one **navigation model** (§4) that is the same shape everywhere (progressive disclosure, never a fork), and one rule binding every decision in this document: **presentation may change depth, order, and channel; it may never change content, ownership, or computation.** A surface either shows a layer or doesn't — it never shows a *different version* of a layer.

---

## 1. Presentation Layers (frozen)

| Layer | Name | Purpose | Contains |
|---|---|---|---|
| 1 | Quick Overview | Answer the Core Question (ADR-0006) in one glance | Cover page fields (ADR-0007 §1): learner identity, Growth Status, Educational Identity headline (or placeholder), verification QR |
| 2 | Educational Profile | The five-minute read | Identity, Academic Record summary, Attendance summary, Parent Summary or audience-equivalent, one-line Compass/Career snapshots |
| 3 | Full Blueprint | Every ADR-0005 section, full detail, still composed (not recalculated) | All nine sections at full field depth (ADR-0007 §2's per-section detail), QR links to deep experiences |
| 4 | Historical Snapshots | Longitudinal view | Blueprint Snapshots (ADR-0008 Part 3) across terms, Growth Timeline once built |
| 5 | Evidence Trail | Full traceability, for anyone who asks "why" | Supporting evidence references already carried by Projection (ADR-0008 Part 9) — never a new Evidence UI, only a deep link into Evidence's own future surface |

Every layer has exactly one purpose and nests inside the one before it — Layer 2 is not a different Blueprint from Layer 3, it is Layer 3 with lower detail, same source composition (ADR-0008 Part 6's single Composition stage). Full per-layer detail in the companion document §1.

---

## 2. Surface Matrix (frozen — summary; full matrix in companion document §2)

Real, already-live surfaces audited: Teacher Workspace (`app/teacher/*`, including `core-office`/`core-team`/`core-admissions`/`core-readiness`), Parent Portal (`app/(parent)/*`, `app/dashboard/*`), Learner Portal (`app/(student)/*`, including an **already-existing** `app/(student)/blueprint` page built on the pre-canonical engine), School Administration/Academic Office (inside Teacher Workspace's `core-*` routes — no separate app exists), Report Cards (`app/(parent)/report-card`), Learning Compass (`app/dashboard/learning-compass`, `app/(student)`), Career Intelligence (`app/(parent)/career-intelligence*`, `app/(student)/career`), Academic Clinic (`app/academic-clinic`, `app/dashboard/clinic`), plus not-yet-built PDF Export, Print, Mobile, and future API consumers (University/Employer/Government, per ADR-0008 Part 7).

Each surface's shows/hides/summarizes/links/QRs/interactivity/print/offline behaviour is fixed in the companion document's full matrix (§2) — every future implementation sprint reads that table, not this summary.

---

## 3. Progressive Disclosure (frozen)

**Identity → Academic Snapshot → Attendance → Growth → Compass → Career → Evidence → Timeline → Appendix.**

This is the fixed unfolding order for any surface presenting more than Layer 1. It is not identical to ADR-0005's section-ownership list order (Identity, Academic Record, Attendance, Compass, Career, Behaviour, Teacher Insights, Parent Summary, Timeline) — disclosure order is a presentation decision (this ADR), section ownership order is a structural one (ADR-0005); they are allowed to differ, and do, because disclosure optimizes for "what does a reader need first," not "how the type is declared." Full rationale and per-step detail in companion document §3.

---

## 4. Navigation Philosophy (frozen)

**Single scrolling document with progressive disclosure, not tabs, not a card grid, not a forced wizard.** Sections expand/collapse in place (mirrors ADR-0007 §16's mobile-card pattern, generalized to desktop too) rather than requiring a tab switch that hides everything else. Desktop shows more sections expanded by default (larger viewport, ADR-0007 §16); mobile collapses everything but Layer 1/2 by default; print is the fixed Layer 3 rendering regardless of on-screen state (ADR-0007 §15). QR codes are the only hard navigation *exit* from the document (ADR-0006 §11, ADR-0008 Part 8) — everything else is expand/collapse within one continuous page, never a click into a separate Blueprint sub-page that could drift out of sync with the composition that generated it. Full rationale and rejected alternatives (tabs, card grid, wizard) in companion document §4.

---

## 5. Audience Differences (frozen)

Teacher, Parent, Learner, University, Employer (and School Leader, Government per ADR-0008 Part 7) all consume **the same Blueprint** — restated as binding, not just inherited: no audience ever triggers a different computation, a different Composition run, or a different underlying data source. Only which layers are reachable, and how deep into Layer 3 each section renders, changes per audience — exactly ADR-0007 §14's matrix, unchanged by this ADR, now given its navigation consequence: an audience with narrower visibility doesn't see a "different Blueprint," it sees fewer expand-targets in the same document. Full detail, companion document §5.

---

## 6. Snapshot Presentation (frozen)

**Current Blueprint → Historical Blueprint (Snapshot) → Report Card → Evidence Trail.** A user viewing the Current Blueprint can navigate *backward* into a specific Historical Snapshot (Layer 4) via a term selector; from a Historical Snapshot they can reach the Report Card that was published at the same moment (a citation-only link, ADR-0005 §5 — never a re-render of the report card's own content) and, separately, the Evidence Trail (Layer 5) underlying any specific claim. These are three distinct, one-directional reference links, never a merge — a Historical Snapshot never absorbs Report Card content, and a Report Card never links "up" into a Blueprint (Report Cards remain independent per ADR-0008 Part 3). Full navigation diagram, companion document §6.

**Clarification frozen by Sprint 12J (per Sprint 12J-A's Finding 5)**: the canonical phrase for this chain, wherever it is next cited, is **Report Card ↓ Current Blueprint ↓ Historical Snapshots ↓ Compass / Career**, read as an *entity ordering*, never a literal forward click-path. Report Card is a strict dead-end with zero embedded navigation (§9) — nothing flows "up" from it. The only real, directional navigation is backward from Current Blueprint into Historical Snapshots, and from either of those into a Report Card citation or an Evidence Trail link. Compass and Career are not downstream stops after Report Card in a chain — they are **parallel, independent one-directional exits** reachable from Current Blueprint (and from a Historical Snapshot, at the same Layer 2/3 depth), per §7/§8. A future implementation must not build a literal "Report Card links to Snapshot links to Current links to Compass" chain from the shorthand phrase alone.

---

## 7. Learning Compass Relationship (frozen)

Compass must never become Blueprint; Blueprint must never become Compass. Navigation is one-directional and QR/link-only, restated from ADR-0006 §3 and ADR-0008 Part 8 as a presentation-layer *navigation* rule, not just a content rule: Blueprint's Compass section (Layer 2/3) is a dead-end in the disclosure order except for one explicit "Continue in Compass" exit (QR on paper, a real link digitally) — there is no path *from* Compass *back into* Blueprint's Compass section (Compass has its own navigation, entirely outside this ADR's scope). Full detail, companion document §7.

---

## 8. Career Intelligence Relationship (frozen)

Same principle as §7: Blueprint summarizes (Layer 2/3's one-snapshot rule, ADR-0006 §4), Career Intelligence explores (its own full surface, entirely outside this ADR). One-directional exit only. Full detail, companion document §8.

---

## 9. Report Card Relationship (frozen)

**Report Card → Blueprint Snapshot → Current Blueprint.** Three experiences, three purposes, restated as a presentation/navigation rule (structural relationship already fixed by ADR-0008 Part 3): a Report Card is a dead-end, self-contained official document (no Blueprint navigation embedded in it — Report Cards remain untouched, ADR-0005 §5); a Blueprint Snapshot references the Report Card published at that moment (one link, one direction) and can be reached from, or navigate forward to, the Current Blueprint; the Current Blueprint can navigate backward into any Historical Snapshot. No cycle, no duplication of navigation entry points. Full diagram, companion document §9.

---

## 10. Mobile Philosophy (frozen)

Extending ADR-0007 §16 (same truth, only layout density changes) with the concrete mobile rules this sprint was asked to freeze: Layer 1 (cover-equivalent) and Layer 2 (Educational Profile) are always visible, expanded, on first load — everything in Layer 3 collapses into tap-to-expand cards; Historical Snapshots (Layer 4) and Evidence Trail (Layer 5) are QR-only on mobile-print contexts but in-app-navigable (not QR-gated) on a logged-in mobile session; nothing becomes a chart/graph on mobile that isn't already a sparkline-class element permitted on paper (ADR-0007 §3 — mobile does not get *richer* visualization than paper, only more expand/collapse); offline behaviour shows the last-synced snapshot with a visible staleness indicator (ADR-0007 §16, unchanged). Full mobile decision table, companion document §10.

---

## 11. Accessibility, Printing, Offline (carried forward, not re-decided)

This ADR does not re-open ADR-0007 §15 (printing: A4 portrait canonical, black-and-white-safe, colour never the sole channel of meaning) or §16 (device/offline behaviour) — it confirms both apply unchanged to every surface in the Surface Matrix (§2) and states explicitly, per the mission's verification checklist, that no surface decision in this document requires an exception to either.

---

## Rejected Alternatives

- **A tabbed interface** (one tab per ADR-0005 section) — rejected. Tabs hide everything else by default, working against progressive disclosure (§3) and against the Core Question's five-minute-read goal; a reader wanting the whole picture would have to click through nine tabs instead of scrolling one document.
- **A card-grid dashboard** (one card per section, no fixed order) — rejected. No fixed order means no progressive disclosure — the mission explicitly required "information unfolds," which a grid (equally-weighted, order-agnostic by nature) cannot express.
- **Per-audience separate Blueprint documents** (a "Teacher Blueprint," "Parent Blueprint," etc.) — rejected outright, this is the one alternative the Core Question exists specifically to prevent; would violate ADR-0005 Principle Two and reintroduce the exact "N independent report pipelines" problem `sprint-12c-academic-clinic-hardening.md` found already live in the pre-Blueprint Academic Clinic system.
- **A wizard/step-by-step forced flow** — rejected. Forces every audience through identical sequential steps, contradicting ADR-0007 §12/ADR-0008 Part 7's audience-specific reading order (a University reader should reach Academic Record before Attendance; a wizard can't express that without becoming N wizards).
- **Rendering Historical Snapshots inline inside the Current Blueprint's scroll** — rejected. Would blur "Blueprint changes continuously, Snapshots freeze history" (ADR-0008 Part 3) into a single ambiguous timeline; kept as an explicit backward-navigation action instead (§6).

---

## Constitutional / RAS Compliance

- **RAS §9, §10.7-10.8**: no presentation decision in this ADR introduces a computation, a duplicated section, or a new cross-domain ownership — every layer/surface/navigation rule operates on the single Composition output (ADR-0008 Part 6), never re-fetching or recomputing per surface.
- **Educational Constitution Article XI**: every layer/surface still carries its section's freshness/confidence labeling (ADR-0005 §6, ADR-0007 §9) unchanged — presentation depth never strips a label to save space; a section either shows with its label or doesn't show.
- **ADR-0004 §4/§5**: derived-value and no-summary-storage discipline unaffected — this ADR governs display/navigation only, no new storage or caching decision is made here.
- **ADR-0005/0006/0007/0008**: extended, not contradicted, throughout — every section of this ADR cites the specific prior rule it builds on; no ownership, meaning, layout field, or lifecycle rule is altered.

---

## Verification Against Mission's Checklist

- Every audience has one navigation path — §4/§5 (single scrolling document, audience changes only reachable depth, never a second path).
- Every section has one owner — inherited unchanged from ADR-0005 §3; this ADR introduces no new section.
- No duplicated presentation — §1 (layers nest, never fork); Rejected Alternatives (no per-audience document).
- No duplicated calculations — §5 (audiences share one Composition run).
- No presentation contradicts earlier ADRs — Constitutional/RAS Compliance above, and every section cites its ADR-0005/6/7/8 basis explicitly.
- Progressive disclosure is complete — §3, full order given.
- Accessibility considered — §11 (ADR-0007 §15 reaffirmed).
- Printing considered — §11 (ADR-0007 §15 reaffirmed), §6/§9 (Report Card/Snapshot print independence).
- Mobile considered — §10.
- Offline considered — §11 (ADR-0007 §16 reaffirmed).
- Future extensions identified — companion document §11 (University/Employer/Government surfaces, future API consumers, PDF/mobile-app implementation).

---

## Stop Condition

This ADR, the companion presentation-architecture document, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** No Blueprint UI, React page, component, PDF renderer, QR generator, Parent/Learner Portal work, or API begins. Wait for explicit approval before Sprint 12J.
