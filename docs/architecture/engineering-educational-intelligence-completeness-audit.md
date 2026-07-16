# Engineering Educational Intelligence — Completeness Audit

**Method:** for every major mechanism, I asked what must exist for it to actually function, then checked whether the manuscript specifies that thing anywhere — not whether it's specified *well* (a prior audit covered determinism and engineering judgment), but whether it exists at all, is created, is owned, and is retired or resolved. Findings are reported only where an implementation team would have to invent architecture the manuscript never provides, not merely make a judgment call within bounds the manuscript sets.

---

## Executive Verdict

**Substantially Complete with Significant Omissions.**

This is a step down from the prior implementability audit's finding of zero critical issues, and the difference is deliberate: that audit asked whether teams would converge on similar systems; this one asks whether every object the architecture requires is actually created, owned, and retired somewhere in the text. Under that stricter lens, one genuine structural self-contradiction was found (below, A1), and a cluster of significant omissions — several in areas (access authorization, data retention, concurrent evidence handling) that are not edge cases for a system meant to hold real children's records, but ordinary requirements any deployed instance would hit immediately.

---

## A — Critical Incompleteness

**A1 — The evidence dispute mechanism cannot represent its own resolution.**

Chapter 2's `EvidenceRecord` schema specifies `dispute_flag: Boolean // set at creation only, if raised at the time of recording; never modified afterward`. This is stated with unusual emphasis — not merely undocumented, but explicitly forbidden from changing after creation.

Chapter 6 §6.3, however, describes disputes as things that get resolved: "a request to see the trace... the institution's obligation is not to defend a position but to show its work." A dispute that is shown to be unfounded, or is settled by producing the trace, needs some way to reflect that it has been resolved — but the one field the architecture gives for representing a dispute is, by its own explicit rule, permanently frozen at whatever value it held at creation.

This is not a case where a reasonable team would converge on an obvious answer — it is a case where two parts of the architecture directly conflict: honoring the field's stated immutability makes dispute resolution unrepresentable; representing dispute resolution requires violating the field's stated rule. An implementing team must invent something the manuscript does not provide (a separate resolution record, a different mechanism entirely) to reconcile Chapter 6's expectation with Chapter 2's schema. This is the one place in the manuscript where the architecture, taken literally, cannot be implemented consistently with itself.

---

## B — Significant Incompleteness

**B1 — Instrument Validity has no stated owner among the six bounded contexts.**
The Instrument Validity Gate is one of the most heavily used mechanisms in the book, and its standing must be tracked persistently (Chapter 2 explicitly discusses later revocation). None of the six named contexts (Curriculum, Learner, Assessment, Instruction, Reasoning, Stakeholder) is ever stated as the owner of this tracking. Assessment is the most plausible inference, since it "owns the design and delivery of instruments," but this is never said. A team must assign ownership themselves.

**B2 — "Intervention" appears in one context's ownership list (Chapter 2) and is then defined as belonging to no part of the system at all (Chapter 3).**
Chapter 2 §2.1 lists the Reasoning context as owning "the derived judgments made from a learner's projected state: recommendation, and eventually, intervention." Chapter 3 §3.6 then states that intervention "belongs to the world, not to the system at all." A charitable reading distinguishes the system's *record* of an intervention (plausibly Reasoning-owned) from the real-world *act* (which belongs to no part of the system) — but the manuscript never draws this distinction explicitly, leaving the two statements in apparent tension about who, if anyone, owns intervention data.

**B3 — No mechanism, named or unnamed, links an observation back to the specific intervention it is evaluating, and no persistent component is ever named for tracking instrument validity standing over time**, distinct from the band-computation mechanism itself. The *computation* (how a band is derived) is fully specified; the *storage/tracking component* that would let a later query ask "is this instrument still valid, and since when" is never named the way the evidence log is named as a component.

**B4 — Access authorization is never specified anywhere in the architecture.**
The Stakeholder context is described as translating a projection into audience-appropriate registers for a teacher, a parent, an administrator — but nothing in the six chapters specifies *who is authorized to see what*. There is no stated rule analogous to "a stakeholder may view a learner's record only if a specific relationship (currently assigned teacher, legal guardian) exists." Every other boundary in this architecture is drawn with care; the authorization boundary — arguably the most legally and ethically consequential one for a real system holding children's records — is assumed rather than specified.

**B5 — Data retention and erasure are never addressed.**
The architecture's central discipline is that evidence is never deleted, only superseded. This is stated and defended repeatedly and is clearly correct as a principle for preserving history. What is never addressed is the boundary case every real deployment will eventually hit: a learner leaves the institution permanently, an institution closes, or a legal retention limit applies. Nothing in the manuscript states whether evidence permanence is intended to be genuinely unlimited, or whether some erasure/retention policy exists that the immutability principle would need to accommodate without contradicting itself.

**B6 — Concurrent evidence arrival for the same learner and competency is never addressed.**
Chapter 2's recompute-on-arrival rule ("every new evidence record is an event, and every context with a projection that depends on the affected competency must recompute") does not state what happens when two evidence records for the same learner and competency are appended concurrently — whether recomputation is guaranteed to see both, whether there is a defined ordering, or whether a race condition could produce a projection reflecting only one of two simultaneous updates. For a system meant to serve entire classrooms of learners whose evidence arrives continuously and independently, this is a real gap, not a narrow edge case.

**B7 — Reasoning's re-evaluation trigger is stated as a possibility, not a requirement.**
Chapter 5 §5.2 says the Reasoning context "may need to know" that evidence has changed. "May" leaves genuinely open whether every relevant evidence change is required to trigger reasoning re-evaluation, or only some — and the manuscript never resolves which, despite this materially affecting whether the architecture's central promise (claims stay current) actually holds.

**B8 — The connection between Chapter 2's "capability profile" and "risk model" and Chapter 5's continuous-recomputation guarantee is never made explicit.**
Chapter 5 §5.3 argues that "a projection" must be continuously, not just capably, recomputed. Chapter 2 §2.5 introduces capability profile and risk model as objects "computed once" (meaning single-source-of-truth, not single-point-in-time). Whether these two named objects fall under Chapter 5's later, stronger continuous-recomputation guarantee is a reasonable inference but is never stated as a connection between the two chapters.

**B9 — Learner identity reconciliation is unaddressed, both within and across institutions.**
Nothing in the manuscript addresses what happens if the same learner ends up represented by two different identity records (a data-entry duplicate within one institution, or a genuine transfer between institutions using the same system). Given how much architectural weight this book places on a learner's evidence being a single, continuous, honest account, the absence of any identity-continuity rule is a substantive gap, not a peripheral one.

---

## C — Optional Completeness Improvements

**C1** — Recommendation and hypothesis objects that are superseded or retired are, by strong inference from the book's overall evidentiary-permanence ethos, most likely meant to be retained and marked rather than deleted — but this is never stated for these two object types specifically, unlike evidence, where it is stated explicitly and repeatedly.

**C2** — Chapter 5 §5.9 establishes that the system can answer governance questions about its own compliance, but never states who is responsible for actually asking them on an ongoing basis. This is plausibly, and defensibly, left to Chapter 6's institutional territory rather than the architecture's — worth confirming as a deliberate boundary rather than an oversight.

**C3** — Curriculum-graph edges are stated to carry their own validity band (§2.4's generalization of the Instrument Validity Gate), but no schema or storage location for this band is given, unlike the fairly complete `EvidenceRecord` and `ConfidenceClaim` schemas provided elsewhere.

---

## Places the Manuscript Silently Assumes Earlier Knowledge

- Chapter 4 §4.5's argument that a language model "has no persistent memory of its own outside of what is explicitly given to it in a particular interaction" assumes the reader already has some working familiarity with how such models are typically deployed (stateless per-call invocation) — this is never established earlier in the book and is simply assumed at the point it is used. It does not affect the argument's validity (already tested in the prior integrity audit) but is a place unstated background knowledge is relied on.
- Chapter 5 §5.4's orchestration discussion assumes the reader already understands why "letting the Reasoning context react to raw evidence directly, in parallel with the Learner context's own recomputation" would actually produce disagreement, without re-deriving the two-truths mechanism from first principles at that specific point — this is a legitimate callback to Chapter 2, not a gap, but is worth noting as exactly the kind of forward-assumed familiarity this checklist asks to be surfaced.
- Chapter 6 §6.8's discussion of curriculum-edge disputes being "answerable" by the graph's "accumulated, evidence-checked structure" quietly relies on the Chapter 2 §2.4 edge-validity generalization without restating it, which is appropriate given the book's own continuity discipline, but does mean a reader who skipped Chapter 2 §2.4 would not understand what "evidence-checked" means in that sentence.

---

## Architectural Areas That Are Surprisingly Complete

Mechanisms that looked, on first pass, like they might have gaps, and proved fully specified on cross-reading:

- **Evidence status derivation.** It initially looks like a record's current-versus-superseded status might need a mutable field. Cross-reading Chapter 2 §2.2 confirms this is fully and deliberately resolved: status is a derived fact, computed by checking whether any other record declares `supersedes` pointing at it, never stored. No gap remains once the full mechanism is read together.
- **Confidence band precedence.** The interaction between recency, corroboration, and volume looked, on first encounter, like it might leave edge cases (what wins when they conflict) unresolved. It does not — the recency-filter-first rule, applied before corroboration and volume are computed at all, is a complete, total-order specification with no unhandled case found.
- **The recommendation/decision/intervention conceptual boundary**, as distinct from its data schema (which is incomplete, per B2–B3 above). *Who is permitted to do what* — the system recommends, a human decides, the world determines the outcome — is stated and cross-confirmed consistently across Chapters 3, 4, 5, and 6 without a single instance of drift or contradiction found anywhere.
- **The set of roles a language model may and may not occupy.** Given how many distinct architectural roles Chapter 4 §4.5 checks a language model against (evidence log, curriculum authority, confidence assignment, instrument validity, bounded-context separation, projection ownership, reasoning authority, human accountability), it would be reasonable to expect at least one left unaddressed. Cross-reading confirms all eight are individually and explicitly resolved, even though the *verification mechanism* for one of them (language-register compliance) remains a genuine gap, reported separately in the prior implementability audit.
- **The four confidence inputs themselves.** Source reliability, recency, corroboration, and volume are each independently and completely defined, including the specific structural test for corroboration's independence requirement (differing individual, role, or instrument) — a level of completeness this checklist did not find matched elsewhere in the architecture's less-central mechanisms.

---

## Overall Verdict

**Substantially Complete with Significant Omissions.**

One genuine structural self-contradiction (A1) and nine significant omissions were found, several of them — authorization, retention, concurrency — in territory any real deployment reaches immediately rather than in rare edge cases. This sits below "Architecturally Complete with Minor Gaps" specifically because of A1: a single unresolved internal conflict is enough to prevent the label "minor," regardless of how narrow its scope is, because by definition it cannot be implemented as written without a team inventing a resolution the manuscript does not supply. At the same time, the "Surprisingly Complete" section is not a formality — the architecture's most central mechanisms (evidence status derivation, confidence precedence, the human-accountability boundary, the language-model containment rules) were tested hard against this checklist and held completely. The omissions found are real, are concentrated at the architecture's edges and boundaries rather than its core, and are the kind of gap a founding text is expected to leave for the discipline that follows it to close — which is a meaningfully different, and more favorable, situation than an architecture whose center does not hold.
