# ADR-0007 — Learner Blueprint Layout and Experience

**Status: DRAFT — awaiting explicit approval before the first Blueprint implementation sprint.** Design-freeze document only. No code, table, migration, repository, service, route, UI, PDF, QR generation, or AI implementation was created or modified in producing it — confirmed: this document, `sprint-12e-blueprint-layout-design.md`, and the implementation-log entry are the only files touched.

**Precedes**: the first Blueprint implementation sprint (explicit approval required, per Stop Condition).
**Supersedes**: nothing.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (structure and ownership), `adr-0006-blueprint-educational-experience.md` (educational meaning and tone), `adr-0004-attendance-integration-principles.md` (derived-data discipline), `adr-0003-attendance-domain.md` (Attendance's own ownership), `reference-architecture-specification.md` §9/§10.7/§10.8, `docs/sprint-25-educational-constitution-and-migration-strategy.md`.

---

## Why This ADR Exists

ADR-0005 froze *what* Blueprint is and who owns each section. ADR-0006 froze *what it means and how it should feel*. Neither froze *what it looks like* — the cover page, the printed layout, where a QR code physically sits, how a Cambridge-curriculum school's Blueprint differs from a CBC Junior school's, what a teacher sees on first opening it versus what a university admissions officer sees. Without this freeze, the first implementation sprint would be making irreversible layout decisions — cover page fields, print dimensions, branding placement — under build pressure, exactly the failure mode ADR-0005 and ADR-0006 already avoided for structure and meaning. This ADR is the third and, per the mission, likely final freeze before implementation begins: after this, implementation sprints build against a fixed specification rather than deciding design as they go.

**This ADR decides layout and experience. It does not re-decide ownership or meaning** — every field named below already has an owner from ADR-0005 and a meaning from ADR-0006; this document only decides where that field sits, how it looks, and which audience/curriculum/device sees it. Where this document appears to introduce a new field (e.g., Blueprint Version, Digital Signature), it is explicitly a **presentation/provenance** artifact, not a new data domain — see §12.

---

## Decisions (full detail and rationale in the companion document, `sprint-12e-blueprint-layout-design.md`)

1. **Cover Page** (companion §1): school branding, learner identity summary, Blueprint Version/Generated/Last-Updated provenance stamp, QR verification, and three one-line educational headline fields (Educational Identity, Learning Stage, Current Readiness, Growth Status) — no scores, no full sections, on the cover. The cover's only job is orientation, not content.
2. **Identity Section** (companion §2): fixed field order and visibility rules, one documented future-addition slot.
3. **Academic Record** (companion §3): what graphs/trend arrows are permitted on paper (sparklines only, no dense charts), teacher observation limited to a single cross-reference to Teacher Reflection (never duplicated text), report card references as citations only.
4. **Attendance** (companion §4): word/colour budget per ADR-0006 §5's five fields, explicit rule that colour never stands alone as a risk signal (never colour-only communication, an accessibility requirement).
5. **Learning Compass snapshot** (companion §5): the five fields ADR-0006 §3 already fixed, now given exact paper positioning and QR placement — no new fields introduced.
6. **Career Intelligence snapshot** (companion §6): the five fields ADR-0006 §4 already fixed, same treatment.
7. **Teacher Reflection** (companion §7): exact min/max length, a five-question writing guide, and an explicit approval workflow (teacher authors, no auto-publish, visible only after the authoring teacher confirms).
8. **Parent Summary** (companion §8): the 60-second read is operationalized as a fixed three-sentence template (headline, one detail, one action).
9. **Educational Identity** (companion §9): display rules (label + one supporting evidence phrase, never a bare label), confidence rules (only three confidence bands, never a numeric score shown to a parent/learner), and the mandatory insufficient-evidence placeholder state, extending ADR-0006 §9's limitations into concrete display rules.
10. **Growth Timeline** (companion §10): visual milestone-strip treatment, digital-only at first (per ADR-0006 §10's own scope), a fixed maximum of one milestone entry per triggering event (never a duplicate entry for the same underlying evidence).
11. **QR Experience** (companion §11): nine named QR destinations, each mapped to exactly one owning domain's existing (or future, domain-owned) surface — no QR ever points at a Blueprint-internal page that just restates domain data.
12. **School Branding and Provenance** (companion §12): logo/colour placement, watermark rule, and the distinction between a **verification QR** (proves the document is current/authentic) and a **digital signature block** (principal/teacher, provenance only) — neither is a new data domain; both are presentation of existing identity/authorization data.
13. **Curriculum Variants** (companion §13): one architecture, differently-rendered per curriculum (CBC Junior/Senior now; Cambridge/IB reserved) — variance is in which sections appear and their emphasis, never in ownership or computation.
14. **Audience Views** (companion §14): one Blueprint, five audience-scoped views (Teacher/Parent/Learner/University/Employer), extending ADR-0006 §12's reading order into which fields are visible at all per audience, not just their order.
15. **Printing Rules** (companion §15): A4 portrait as the default/canonical print format, booklet and digital-only as secondary renderings of the same data, black-and-white-safe design (colour is decoration, never the sole channel of meaning — ties directly to §4's accessibility rule), WCAG-aligned digital accessibility.
16. **Device Behaviour** (companion §16): phone/tablet/desktop/portal/PDF/offline behaviour, with a single rule governing all of them — the same section ownership and content, never a device-specific subset of *truth*, only of *layout density*.
17. **Future Modules** (companion §17): fourteen reserved section slots (Behaviour, Innovation, Leadership, Projects, Portfolio, Community Service, Entrepreneurship, Competitions, Sports, Arts, Wellbeing, AI Skills, Digital Literacy — Portfolio/Projects already implicitly reserved via QR in ADR-0006 §11), no schema or calculation decided for any.
18. **Final Educational Walkthrough** (companion §18): the full open-to-close experience narrated for each of the five audiences, tying together every decision above into one coherent user journey.

---

## Governing Rule Carried Forward From ADR-0005/0006, Restated for Layout

**A layout decision may never become an ownership or computation decision.** Every visual choice in the companion document (colour, word count, position, curriculum variant, device rendering) operates on data already owned and computed by another domain per ADR-0005 §3's matrix. If implementing any decision in this ADR would require Blueprint to compute something new (a new trend arrow algorithm, a new colour-threshold formula, a new "readiness" calculation for the cover page), that is out of scope and must be redirected to the owning domain — this ADR names that constraint explicitly wherever a layout choice could be mistaken for a computation (companion §3's trend arrows, §4's colour-as-risk-signal, §9's confidence bands).

---

## Constitutional / RAS Compliance

- **RAS §9, §10.7, §10.8**: no layout decision in this ADR introduces a new Operating-Layer read, a new calculation, or a new cross-domain ownership — restated per-section in the companion document.
- **ADR-0003 (Attendance domain)** and **ADR-0004 (Attendance integration)**: Attendance's layout treatment (companion §4) remains presentation-only over Attendance's own published summary; no new attendance business logic, no stored summary.
- **ADR-0005**: every field placed in this ADR already has an ADR-0005 owner; none is reassigned.
- **ADR-0006**: every educational-meaning decision (tone, Educational Identity limitations, Teacher Reflection AI boundary, Educational Philosophy text) is inherited unchanged; this ADR only adds where and how those already-decided meanings are displayed.
- **Educational Constitution Article XI** (a number without a name is not neutral): governs §9's confidence-band display rule and §4's colour-is-never-the-sole-signal rule directly.
- **Educational Constitution Article II** (missing evidence is never poor performance): governs §9's mandatory insufficient-evidence placeholder and §3's rule that a missing subject/competency renders as "not yet assessed," never a blank or a zero.

---

## Verification Against Mission's Checklist

- Every section has one owner — unchanged from ADR-0005 §3; this ADR adds zero new owning sections (Cover Page, Branding, and QR Experience are presentation-only, explicitly non-owning, companion §1/§11/§12).
- No duplicated ownership — confirmed; layout decisions operate on existing owned data only.
- QR destinations defined — nine, companion §11, each mapped to exactly one existing/reserved owning domain.
- Report Card, Attendance, Learning Compass, Career Intelligence remain independent — reaffirmed; Blueprint's layout never absorbs their full experience, only the snapshot each already-approved ADR fixed.
- Educational Constitution compliance — see above.
- ADR-0003/0004/0005/0006 compliance — each cited against the specific decision it governs, throughout.
- RAS compliance — §9/§10.7/§10.8, as above.

---

## Stop Condition

This ADR, the companion layout document, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** No Blueprint UI, PDF, QR generation, AI implementation, or domain integration begins. Wait for explicit approval before the first Blueprint implementation sprint.
