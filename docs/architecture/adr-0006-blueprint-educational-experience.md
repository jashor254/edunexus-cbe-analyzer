# ADR-0006 — Learner Blueprint Educational Experience

**Status: DRAFT — awaiting explicit approval before the first Blueprint implementation sprint.** Design-freeze document only. No table, migration, repository, service, route, UI, or code was created, renamed, or modified in producing it — confirmed: this document, `sprint-12d-blueprint-educational-experience.md`, and the implementation-log entry are the only files touched. No Blueprint, Academic Clinic, Learning Compass, Career Intelligence, or Attendance code was modified.

**Precedes**: the first Blueprint implementation sprint (Sprint 12E or later — explicit approval required, per Stop Condition).
**Supersedes**: nothing.
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` (the structural/ownership decision this ADR gives educational meaning to), `adr-0004-attendance-integration-principles.md` (derived-data and read-direction discipline), `reference-architecture-specification.md` §9 (Intelligence Standards), `docs/sprint-25-educational-constitution-and-migration-strategy.md` (Articles I-XI, the evidence-first principles every Blueprint statement must obey).

---

## Why This ADR Exists

ADR-0005 froze what the Learner Blueprint *is structurally* — nine sections, one owner each, a live/snapshot/historical freshness classification, a QR-based paper/digital split. It deliberately did not decide what those sections should *say*, what tone they should take, or why a learner, parent, teacher, university, or employer should trust what they read. Without that decision, the first implementation sprint would either invent educational philosophy under implementation pressure (the exact failure mode ADR-0005 §10 warned about — deciding architecture and meaning at the same time) or default to what every other school system already does: a printout of marks. This ADR makes the Blueprint's educational meaning explicit and permanent, the same way ADR-0005 made its structure explicit and permanent, so the eventual implementation sprint executes a decision rather than makes one under deadline.

---

## Core Question

**If a learner, parent, teacher, university, or employer opens the Learner Blueprint, what should they understand about this learner within five minutes?**

**Answer**: not "how well did this learner score" but **who this learner is becoming, as an evidence-grounded educational trajectory** — their current academic standing (Academic Record), whether they're present enough to learn (Attendance, reframed educationally per §3 of the companion document), what they're actively working on and being supported to improve (Learning Compass insight), where their evidenced strengths point for the future (Career Intelligence insight), how a teacher who knows them describes their growth (Teacher Reflection), and one evidence-grounded phrase for how they learn (Educational Identity, §9 below) — never a static score, always a trajectory with evidence behind it. Every section decision in this ADR and its companion document traces back to this answer: if a proposed field doesn't help answer "who is this learner becoming," it doesn't belong in Blueprint, regardless of whether some other domain already computes it.

---

## Principle One — The Blueprint always exists; it is never generated

The Blueprint is not a document a user requests and waits for. It is a continuously current view over evidence that already exists across Assessments, Attendance, Learning Compass, Career Intelligence, and Teacher Reflection. Every educational experience a learner has — an assessment recorded, a Compass session completed, an attendance day logged, a teacher writing a reflection — updates what the Blueprint would show, whether or not anyone opens it that day.

**Terminology consequence, binding on all future UI/copy work**: never describe the action of viewing the Blueprint as "Generate Blueprint," "Create Report," or "Run Blueprint." The correct verbs are **View Blueprint**, **Open Blueprint**, or simply **Learner Blueprint** / **Educational Profile** as a noun a user navigates to. This is not a copywriting preference — it is the direct linguistic consequence of Principle Two: a "generate" action implies Blueprint computes something at that moment, which would contradict "Blueprint owns nothing, Blueprint composes." A future PDF/print export is still permitted (ADR-0005 §7's QR strategy assumes a printed artifact exists) — but the export is a rendering of the always-current profile, not a generation event that produces new content.

---

## Principle Two — Blueprint owns nothing; it composes, never duplicates, never recalculates, never stores second copies

Restated and made binding for the educational-experience layer, not just the structural layer ADR-0005 already covered: every sentence, every number, every insight rendered inside Blueprint must be traceable to exactly one owning domain's own canonical function. This ADR adds one educational-experience-specific corollary ADR-0005 did not need to state: **a Blueprint section may summarize or select from an owning domain's output, but it may never re-derive a new interpretation the owning domain didn't itself produce.** Example: Blueprint may display Learning Compass's own "readiness: developing" label; it may not compute its own paraphrase of readiness from raw mastery numbers, because that would be a second, Blueprint-owned calculation of something Compass already owns — exactly the failure mode `sprint-12c-academic-clinic-hardening.md` found already live in `lib/academicClinic/`.

---

## Principle Three — Paper is concise, digital is deep

Every section answers three questions, documented per-section in the companion document (`sprint-12d-blueprint-educational-experience.md` §2): should this live on paper, should this live digitally, should this be QR-only. This generalizes ADR-0005 §7's QR strategy from "Learning Compass and Career Intelligence get one insight plus a QR code" to every section in the Blueprint, including new sections this ADR introduces (Educational Identity, Growth Timeline).

---

## Decisions Summary (full detail in the companion document)

1. **Section-by-section purpose/owner/audience/paper-or-digital/freshness/QR/size table** — companion document §2, covering Identity, Academic Record, Attendance, Learning Compass, Career Intelligence, Teacher Reflection, Parent Summary, Growth Timeline, plus the two new sections this ADR adds (Educational Identity, §9; the Educational Philosophy statement, §11 — a fixed section, not a data section).
2. **Learning Compass integration** limited to: Current Learning Focus, Learning Readiness, Holiday Programme availability, Next Recommended Action, QR to full Compass. Never adaptive lesson content, practice history, AI tutoring transcripts, or mastery maps — those remain exclusively inside Compass's own surface. Rationale in companion document §3.
3. **Career Intelligence integration** limited to one snapshot: Emerging Career Cluster, Strength Profile, AI Outlook, Future Readiness, QR to full report. Blueprint is explicitly never a career report. Rationale in companion document §4.
4. **Attendance reframed educationally**, not administratively: Attendance Trend, Attendance Health, Attendance Risk, Learning Time Lost, Support Recommendation — framed around "is this learner present enough to learn," never a bare present/absent tally. Companion document §5 documents which of these belong on paper vs. digital vs. QR, and reiterates ADR-0005 §2.3's rule: Blueprint still performs zero attendance business logic, only presentation of Attendance's own published summary.
5. **Teacher Reflection** replaces generic "teacher comment" with a structured educational reflection (Strengths, Growth Area, Recommended Support, Parent Partnership, Holiday Focus) — companion document §6 defines length limits, authorship (the learner's current teacher, snapshot at time of writing per ADR-0005 §6), and the boundary on AI assistance (AI may assist drafting; the teacher remains the accountable author — per Educational Constitution Article VI, AI explains evidence, it never invents it, and per Article VIII, a teacher approves before a claim reaches a parent).
6. **Parent Summary**: half-page maximum, no educational jargon, written for a busy parent to understand the learner quickly — principles in companion document §7.
7. **Learner Experience**: tone must be motivating, guiding, supportive, never judging — principles in companion document §8.
8. **Educational Identity** (new section, architecture only, not implemented): a single evidence-grounded phrase (e.g. "Curious Explorer," "Persistent Builder") describing *how* a learner engages with learning, derived strictly from accumulated evidence patterns, never from a personality or psychological inventory. Full definition, evidence sourcing, meaning, and explicit limitations in companion document §9. This is the sharpest new risk this ADR introduces — see Risks below.
9. **Growth Timeline**: what belongs (academic milestones, attendance milestones, Compass milestones, teacher reflections, career discoveries, achievements) and what never belongs (raw scores, disciplinary records outside the reserved Behaviour section, anything not evidence-backed) — companion document §10.
10. **QR philosophy**, generalized across Learning Compass, Career Intelligence, Portfolio, Projects, and Evidence: any experience that is inherently long-form or ongoing stays digital; Blueprint never reprints it — companion document §11.
11. **Reading order per audience** (Teacher, Parent, Learner, University, Employer) — each audience discovers the learner through a different entry section, not a forced identical sequence — companion document §12.
12. **Educational Philosophy statement** — a fixed, permanent section stating what Blueprint believes about learning (growth over marks, attendance as learning time, career emerging over time, AI in service of learning, teachers central, parents as partners, every learner improvable) — full text in companion document §13.
13. **Future extension points** (Behaviour, Portfolio, Projects, Competitions, Innovation, Community Service, Leadership, Wellbeing) — reserved only, no schema, no calculation, per companion document §14.

---

## Risks

1. **Educational Identity is the one new concept in this ADR without a precedent elsewhere in the codebase** (unlike Attendance/Compass/Career Intelligence, which already have canonical owners to defer to). The risk is a future implementation sprint quietly turning it into an AI-generated personality label, which would violate Educational Constitution Article VI (AI explains evidence, never invents it) and Article II (missing evidence is never poor performance — a learner with sparse evidence must not receive a confident-sounding label). The companion document (§9) states explicit limitations precisely to pre-empt this; any implementation sprint must re-read those limitations before writing the first line of code, not treat the label list as a menu to pick from freely.
2. **"Blueprint always exists, never generated" is a framing decision the current shipped code does not yet reflect** — `app/api/learner-intelligence/blueprint/route.ts` is a GET endpoint that computes a fresh Insight-shaped report on request, which is compatible with "always current, composed at read time" but the product copy/route naming should be audited against Principle One's terminology rule at implementation time, not assumed already compliant.
3. **Overlap with the still-unresolved worktree item from Sprint 12C** (`.claude/worktrees/agent-aedf323a0b5ed2eb3`) is unchanged by this ADR — restated here because Educational Identity and Growth Timeline, if that worktree already contains partial Blueprint work, could collide with this ADR's definitions before they're even ratified.

---

## Constitutional / RAS Compliance

- **Educational Constitution Article I** (Evidence is the only currency of truth) — every Blueprint statement, including the new Educational Identity phrase, must trace to evidence; no section this ADR defines introduces an exception.
- **Article II** (Missing evidence is never poor performance) — governs Educational Identity's explicit "insufficient evidence" case (companion document §9) and Attendance Health/Risk framing (companion document §5).
- **Article VI** (AI explains evidence; it never invents it) and **Article VIII** (a teacher approves before a claim reaches a parent) — govern Teacher Reflection's AI-assistance boundary (companion document §6) and Educational Identity generation (companion document §9).
- **Article X** (Career guidance recommends possibility, never fixed destiny) — governs Career Intelligence's Blueprint snapshot wording (companion document §4).
- **Article XI** (A number without a name is not neutral) — governs every freshness label and confidence statement across all sections, inherited from ADR-0005 §6, restated here as binding on the educational-experience copy layer specifically.
- **RAS §9** — Blueprint continues to compose via each domain's own canonical function; this ADR adds no new direct Operating-Layer or cross-domain read.
- **ADR-0005 §2/§3** — every section named in this ADR maps onto an existing ADR-0005 section with an unchanged owner; Educational Identity and the Educational Philosophy statement are the only additions, both explicitly non-owning (Identity composes from existing evidence sources; Philosophy is fixed text, not data).
- **ADR-0004** — Attendance framing (companion document §5) remains presentation-only, no new attendance business logic, per ADR-0004 §4's derived-value discipline.

---

## Verification Against Mission's Checklist

- Every Blueprint section has exactly one owner — companion document §2 table, unchanged from ADR-0005 §3 plus two new non-owning additions.
- No duplicated ownership exists — Educational Identity and Educational Philosophy both introduce no new "owner," per Principle Two.
- Paper remains concise — enforced per-section in companion document §2's "Paper or Digital" and "Maximum recommended size" columns, and generally by Principle Three.
- Digital remains rich — QR-linked full experiences (companion document §11) are explicitly preserved, never flattened into paper.
- Blueprint never replaces Report Cards — unchanged from ADR-0005 §5; reaffirmed, not re-litigated.
- Blueprint never replaces Learning Compass — companion document §3's exclusion list (adaptive lessons, practice history, AI tutoring, mastery maps stay in Compass).
- Blueprint never replaces Career Intelligence — companion document §4's "one snapshot only" rule plus explicit rationale for why the rest belongs elsewhere.
- Educational Constitution compliance — see Constitutional/RAS Compliance above.
- ADR-0005 compliance — this ADR extends, does not amend or contradict, ADR-0005's structure.
- ADR-0004 compliance — Attendance framing remains presentation-only.
- RAS compliance — §9 (Intelligence separation), §10.7/§10.8 (no duplicated logic, no cross-domain ownership) all unchanged and reaffirmed.

---

## Stop Condition

ADR-0006, the companion architecture document, and the implementation-log entry are the complete deliverable for this sprint. Per explicit mission instruction: **stop here.** Do not build Blueprint UI, PDFs, Parent Portal, QR generation, Educational Identity computation, AI summaries, or the Growth Timeline. Wait for explicit approval before the first Blueprint implementation sprint — and, as ADR-0005 already flagged and this ADR restates (Risks §3), resolve the outstanding worktree question before that approval is sought.
