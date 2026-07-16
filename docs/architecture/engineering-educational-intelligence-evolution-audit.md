# Engineering Educational Intelligence — Evolution and Extensibility Audit

**Scope:** Preface + Chapters 1–6, as a finished, successfully implemented architecture.
**Question asked of every mechanism:** if this changes in twenty years, does the architecture already explain how the change is absorbed?
**Not in scope:** implementability, completeness, redesign, or invented future mechanisms. This audit judges only whether the architecture as written remains coherent under the changes listed below.

**Classification used throughout:**
- **A — Implementation only.** New config, new instance of an existing category, new consumer of an existing contract.
- **B — New architectural mechanism.** A new procedure, protocol, or structural addition is required, but no principle in Chapters 1–6 is violated to build it.
- **C — Principle change.** The change cannot be absorbed without altering one of the book's stated non-negotiables (immutability, confidence non-invention, bounded-context ownership, human accountability, evidence continuity).

Only C is a serious extensibility weakness. B is normal, healthy growth for a twenty-year system. A is the sign of a mechanism doing its job.

---

## Verdict, stated up front

**Evolvable but Requires Periodic Architectural Revision.**

The reasoning is given in full below, but the shape of the finding is: the core loop (evidence → projection → confidence → reasoning → recommendation → decision → intervention → evidence) is unusually well future-proofed, including against changes the authors could not have specifically predicted, because it was built by deriving a *test* (does this kind of computation provide permanence, authority, honest derivation, validated measurement, enforced separation, reproducibility, rule-governed inference, accountable judgment?) rather than by hard-coding today's answer. That test is what makes Category A absorb far more of the hypothetical list than would be typical for a system this ambitious. But several changes that a twenty-year deployment will *certainly* encounter — not edge cases, but the ordinary business of running schools for two decades — land in Category B with no mechanism sketched for them at all (curriculum replacement, institutional mergers, learners crossing institutional boundaries, confidence-model revision), and one named category, future legal requirements, sits close enough to Category C that it deserves to be flagged as the architecture's one real open wound.

---

## Change-by-change assessment

| # | Hypothetical change | Category | Where the architecture speaks to it |
|---|---|---|---|
| 1 | New evidence types | A | `source_type` is an open enum; reliability is "fixed in advance for each source type," which is a config act, not a redesign (2.4). |
| 2 | New assessment methods | A | Assessment context owns instrument design; any new instrument enters through the same Instrument Validity Gate (2.4). |
| 3 | New curriculum structures (new edge semantics, not just new nodes) | B | The graph is stated as prerequisite/reinforces/applies-in "for instance" (2.3), not a closed set, but no mechanism governs adding a *new relationship type* without re-validating traversal logic built around the existing three. |
| 4 | Curriculum revisions | A | Edges are themselves banded claims, revisable exactly like any other claim (2.3, 2.4). Explicitly anticipated. |
| 5 | Curriculum replacement (CBC → something else entirely) | B | Versioning of a graph is assumed; **mapping a learner's accumulated evidence from an old competency graph onto a new one** — a crosswalk between two graphs — has no described mechanism. Evidence stays immutable and keyed to the old `competency_id`; nothing says how a claim gets re-projected onto a successor curriculum. |
| 6 | Multiple national curricula (concurrent, e.g. CBC + IGCSE for the same learner) | B | Learner-specific graphs are explicitly first-class (2.3), which is most of the way there, but the Curriculum context is written as owning "the specification" in the singular; hosting several live, independently authoritative graphs per learner is a natural but unbuilt extension, not a principle violation. |
| 7 | Changing confidence models (different bands, different inputs) | B | The Confidence Non-Invention Principle and weakest-link inheritance are principles and survive any replacement. The specific four bands and four inputs are a named *design commitment* (per the Preface's own testable/commitment distinction), but unlike the curriculum graph — which has an explicit mechanism for its own claims aging and being superseded — the ECM itself has no described migration path for re-banding historical claims if the model that assigns bands changes. |
| 8 | New reasoning algorithms | A/B | Chapter 4 already separates *what proposes a hypothesis* from *the discipline governing what happens to it* — a new algorithm is just a new proposer, subject to the same five rules (3.3, 4.6). |
| 9 | Replacement of language models | A | The most explicitly future-proofed mechanism in the book. LLMs are confined to two seams (hypothesis proposal, prose translation) and admitted only as a low-reliability evidence source, never as authority (4.5–4.6). Swapping one model for another changes nothing structural. |
| 10 | Completely removing language models | A | Explicitly stated: classical computation is "the backbone... unchanged," and the LLM is invited in "only at the two seams classical computation cannot close on its own" (4.6–4.7). Remove it and those two seams go unfilled; the rest of the loop runs exactly as before. This is close to a textbook example of correct extensibility design. |
| 11 | Future AI systems beyond LLMs | A/B | Section 4.5's test (does this computation provide permanence, authority, honest derivation, validated measurement, enforced separation, reproducibility, rule-governed inference, accountable judgment?) is stated in terms general enough to apply to any future computation type, not specifically to transformer-based LLMs. Applying the same test to a new substrate is Category A; if the new substrate satisfies guarantees an LLM structurally cannot (e.g., genuine reproducibility), the architecture would need to decide whether it may then be trusted for more than proposal-and-translation — a real question the book doesn't pre-answer, hence B rather than pure A. |
| 12 | Institutional mergers | B | No mechanism for merging two independent evidence logs, reconciling two sets of instrument-validity histories, or unifying two curriculum graphs that may have diverged. Nothing here contradicts immutability (a union of two append-only logs is still append-only), but the procedure is unwritten. |
| 13 | Learners changing schools | B | Chapter 6.10 implies the record should travel with the learner ("sustained for as long as the learner remains in the institution's care"), but the book never states whether the evidence log is scoped per-institution or globally per-learner. If it is institution-scoped by default, a transfer would sever exactly the trajectory continuity Chapter 1 was built to preserve — this is a genuine architectural ambiguity, not just an implementation detail, though it is resolvable without touching any principle. |
| 14 | Historical schema evolution (new fields on `EvidenceRecord` a decade from now) | A | Falls directly out of immutability: old records are simply structurally older and are never rewritten; new fields apply going forward. This is one of the cleanest wins the immutability principle buys, and the book gets credit for it even though it never states it explicitly. |
| 15 | New stakeholder types | A | Stakeholder context owns presentation "to a teacher, a parent, an administrator, or anyone else with a legitimate reason to look" (2.1) — explicitly open-ended. |
| 16 | Changing educational policy | A/B | Chapter 6 treats a policy demand for a single reportable figure as an *institutional* temptation to resist, not an architectural obligation — the architecture can still emit an honestly-labeled derived figure as one more consumer of the projection. Fine as long as policy only asks for a *view*. See #21 for what happens if policy asks for something structural. |
| 17 | New intervention categories | A | Intervention is deliberately left maximally generic — "the world, not the system" (3.6) — new categories are just new facts a human enters, untouched by reasoning's own rules. |
| 18 | Evolving psychometric methods | A | Instrument validity is itself banded using "exactly the same four bands and four inputs already built, applied one level up" (2.4) — new psychometric methods just feed better evidence into an existing, generic mechanism. |
| 19 | Evidence imported from external systems | B | The schema is generic enough to add an `external_import` source type, but the Instrument Validity Gate assumes validity can be established and banded; an external system whose own instrument validity is unknown or unverifiable is a case the gate's binary admit/exclude logic doesn't explicitly anticipate. |
| 20 | Conflicting external evidence | A | This is core, not peripheral, to the design: the corroboration rule requires genuine independence, `dispute_flag` exists at the schema level, and the "no unresolved contradiction" clause gates the Established band directly (2.4). Handled by construction. |
| 21 | Future legal requirements | **B, bordering C** | The clearest open wound in the book. A right-to-erasure-style legal requirement — actual deletion, not supersession — directly contradicts "nothing about the past is ever quietly erased, only ever superseded" (1.3) and the Evidence Continuity Invariant itself (2.4), which requires an unbroken trace back to source evidence for every claim. The book never raises this tension, despite naming "future legal requirements" as exactly the kind of change an architecture should be tested against. If such a law arrives, the system cannot honor both the law and its own immutability principle simultaneously — one of them has to give, which is the definition of Category C. |
| 22 | Partial system replacement | A | Independent services per bounded context, coupled only through published events (5.5), is built specifically so any one context can be replaced without the others noticing anything beyond the published contract. |
| 23 | Distributed deployments | A | Asynchrony is argued for on principle, not performance — "a system built to be honest about incomplete, unevenly-arriving evidence" (5.6) — and is explicitly grounded in low-connectivity, delayed-entry school settings. |
| 24 | National-scale deployments | A/B | Governance is explicitly designed to be emergent rather than a bolt-on monitoring layer (5.9), and independent per-context services scale horizontally in principle. What isn't addressed: multi-tenancy across a ministry with regionally varying curricula, or the compute cost of holding multiple live hypotheses per learner at national volume — an operational question the book itself flags as belonging to "the next question" at the end of Chapter 4, and never actually returns to at national scale. |

---

## Changes the Architecture Already Anticipates

These are places where the manuscript does not merely tolerate a future change but explicitly designs for it:

- **AI substitutability, including total removal.** Chapter 4 is built around the claim that LLMs occupy exactly two seams and are never trusted with authority — making replacement or removal of the entire AI layer a Category A change. This is stated as a deliberate ambition in the Preface ("written to still be correct if every technology it mentions... has been replaced by something unrecognizable") and Chapter 4 is the strongest evidence the ambition was actually executed, not just asserted.
- **New evidence and instrument types**, admitted through an open `source_type` enum and a generic, reusable Instrument Validity Gate (2.4).
- **Curriculum revision**, because prerequisite edges are themselves banded, revisable claims rather than fixed facts (2.3, 2.4).
- **Learner-specific curricula**, explicitly named as a first-class case rather than an exception (2.3) — the closest the book comes to anticipating personalization at the structural level.
- **New stakeholder audiences**, via the Stakeholder context's deliberately open mandate (2.1).
- **New intervention types**, by design left entirely outside the system's own vocabulary (3.6).
- **Conflicting and corroborating evidence**, handled by the corroboration-independence rule and `dispute_flag` rather than treated as an exception (2.4).
- **Partial replacement of any subsystem**, via independent per-context services with event-only coupling (5.5).
- **Uneven, delayed, offline evidence arrival**, argued for on epistemic grounds, not performance grounds (5.6) — directly serves the rural/low-connectivity contexts the book names explicitly.
- **Governance and audit at scale**, built as the same tracing mechanism used for a single learner's explainability, applied reflexively to the system itself (5.9) — a rare example of a mechanism generalizing upward without new machinery.
- **Historical schema drift**, an unstated but structurally guaranteed consequence of immutability (1.3): old records need never be rewritten to accommodate new fields.

---

## Future Changes Most Likely to Stress the Architecture

1. **Legal requirements to actually delete data.** The single clearest tension in the book. Immutability and the Evidence Continuity Invariant are principles; a hard erasure mandate cannot be satisfied by supersession, which is the only "correction" mechanism the architecture offers. Unaddressed anywhere in six chapters.
2. **Curriculum replacement**, as distinct from curriculum revision. Revision is well handled (edges as revisable claims); replacing the whole graph a learner's history is projected against has no crosswalk mechanism.
3. **Institutional mergers.** No protocol for reconciling two evidence logs, two instrument-validity histories, or two diverging curriculum graphs, even though nothing about a merger is inherently incompatible with append-only records.
4. **Learners moving between institutions.** The book implies continuity but never states whether the evidence log is scoped to the learner or the institution — an ambiguity that, resolved the wrong way, would recreate exactly the discontinuity Chapter 1 exists to prevent.
5. **Confidence-model evolution.** The ECM's specific bands and inputs are treated as more fixed than the curriculum graph is — there is no described mechanism for re-banding a decade of historical claims if the model itself is revised, even though the underlying Non-Invention Principle would survive any such revision.
6. **Curricula that resist competency decomposition.** The whole evidence schema keys off `competency_id`. Standards-based, competency-structured curricula (CBC among them) fit this well; a genuinely holistic or portfolio-native assessment philosophy that rejects decomposition into discrete competencies would strain the schema at a level the "graph with no edges" degenerate case (2.3) doesn't fully cover, since that case still assumes discrete nodes exist.
7. **The seventh-context question.** Chapter 5.9 shows real discipline resisting the urge to add a governance context, folding it into existing tracing instead. But the book never states a general rule for *when* a genuinely new kind of truth (e.g., safeguarding, wellbeing) warrants a new bounded context versus being absorbed into an existing one — leaving this judgment call to whoever is under deadline pressure twenty years from now, which is exactly the failure mode Chapter 2 opened by describing.
8. **National-scale multi-tenancy** and the operational cost of per-learner hypothesis-tracking at that volume — flagged by the book itself as a question it hasn't yet answered (end of Chapter 4), and never revisited.

---

## Cross-cutting observations

**Principles coupled to today's technology:** none found. This is the audit's most notable positive finding — Chapter 4 goes out of its way to define AI's role by a structural test (what guarantees does this kind of computation provide) rather than by naming a technology, and explicitly rehearses its own obsolescence ("technologies will change before this ink is dry"). This is unusual discipline and it pays off directly in changes #9–11 above.

**Assumptions tied to today's AI capabilities:** none load-bearing. The architecture is built to survive an LLM that is more capable, less capable, differently shaped, or entirely absent.

**Assumptions tied to today's curriculum structures:** one real assumption, flagged as #6 in the stress list — that a learner's understanding decomposes into discrete, graph-representable competencies. This fits CBC (the book's own tested domain) well and is stated as an ambition to generalize beyond CBC in the Preface; the fit is weaker for curricular philosophies built explicitly against decomposition.

**Hidden assumptions about institutions:** Chapter 6's entire argument is institution-centric ("the institution's relationship to its own uncertainty"), but the core architecture (Chapters 1–5) does not actually require an institution to exist — a self-directed learner could occupy the Stakeholder role themselves. This is a narrative-scope choice, not a structural dependency, and does not by itself constitute an extensibility weakness.

**Mechanisms likely to become obsolete:** none of the architectural mechanisms; some of the illustrative technology references (a "digitally delivered quiz," a specific description of how LLMs are trained) will read as dated, but nothing load-bearing depends on them remaining accurate.

**Architectural rigidity / unnecessary coupling:** the six-bounded-context count is presented as derived rather than arbitrary, and Chapter 5.9's refusal to add a seventh context for governance is a genuine sign of discipline against unnecessary proliferation. The absence of a stated *rule* for when a new context actually is warranted (stress point #7) is the one place this discipline could calcify into rigidity under future pressure, precisely because the book demonstrates the right instinct without codifying it.

**Mechanisms that unexpectedly generalize well beyond education:** the evidence/confidence/reasoning/recommendation/decision/intervention loop, and the bounded-context-plus-event-sourcing structure underneath it, are domain-general techniques the book itself borrows from fraud detection and clinical decision support (Preface) and returns, by the end, in a form general enough to apply cleanly to any domain requiring auditable, evidence-based claims about people over time. This is a strength worth naming precisely because it was not the book's stated goal.

---

## Summary of the verdict

Most of the twenty-three hypothetical changes tested land at Category A, and a striking number of the hardest ones — replacing or removing the AI layer entirely, absorbing genuinely new future computation, surviving partial system replacement, tolerating distributed and offline deployment — land at Category A precisely because the book derived a test rather than hard-coding an answer. That is real, demonstrated evolvability, not an aspiration.

But a cluster of ordinary, high-probability twenty-year events — curriculum replacement, institutional mergers, learners crossing institutional boundaries, and confidence-model revision — sit at Category B with no mechanism sketched, only silence. None of these breaks a principle; all of them would require a designed extension the book doesn't attempt, because attempting it wasn't its brief. And one named category, future legal requirements, exposes a real, unresolved tension between the architecture's central principle (nothing is ever erased) and a plausible future legal mandate (erasure on request) — the one place this audit found where the fault line runs through a principle rather than around one.

That combination — excellent handling of technological change, incomplete handling of institutional and organizational change, and one genuine principle-level fault line left unnamed by the book itself — is what places the verdict at **Evolvable but Requires Periodic Architectural Revision** rather than at either extreme.
