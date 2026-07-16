# Manuscript Reconciliation — Post-Completion Audit

**Status:** the manuscript (Preface + Chapters 1–6) is complete and takes priority over every planning document, including the Blueprint. This document is the audit trail supporting the Blueprint's v6 reconciliation — it does not modify manuscript prose, introduce new ideas, or redesign the book. It records what the finished work actually is, against what was planned, and flags what remains genuinely unresolved.

---

## 1. Decisions: Unchanged, Evolved, Superseded

**Unchanged, holding exactly as originally decided:**
- The ten Foundational Axioms (§FA) — no axiom was touched during drafting except two Phase-IV hardening clauses added before drafting began.
- The Educational Confidence Model's four bands, four inputs, decay rule, and the Confidence Non-Invention Principle (§11.1–§11.7) — used identically from Chapter 1 through Chapter 4's explicit citation of the Source Reliability tier.
- The Instrument Validity Gate and Evidence Continuity Invariant (§11.8, §11.10) — both cited correctly in Chapter 2 (their origin) and referenced correctly in Chapters 3, 4, and 5 without redefinition.
- Standalone scope (§0.1 Decision 4) — nothing in the finished manuscript gestures at a sequel or treats itself as incomplete without one.
- "Continuity over chaptering" (§13 item 9) — every section in all six chapters opens with a bridge and closes by raising the next question. This is, after the axioms, the single most consistently honored commitment in the entire project.
- Composite examples only (§13 item 3) — Amina and Daniel, fictional throughout, no real individuals, in all six chapters.
- No vendor names, no product placement (§13 item 4) — held through Chapter 4's LLM discussion, which named no product, company, or benchmark, exactly as instructed.

**Evolved — the underlying goal survived, the mechanism changed:**
- **Structure** (§0.1 Decision 1): four chapters became six. The *reason* for depth over breadth held; the *count* did not. See Blueprint §0.1 and §5 for the full account.
- **Chapter template application** (§9): Chapters 1–3 kept schemas, pseudocode, and per-section discipline; Chapters 4–6 moved to continuous philosophical prose by deliberate instruction. The template's spirit (derive before define, one idea per paragraph, trade-offs mandatory) held in both registers; its letter (schema, pseudocode, exercise per section) did not survive past Chapter 3.
- **Teacher-as-decision-maker content**: planned as its own chapter section (old 4.2), ended up split across Chapter 3 §3.6 (the architectural boundary) and Chapter 6 §6.6 (the institutional consequence) — richer for being split, arguably, since it now has both an engineering and an institutional treatment instead of one section trying to do both.
- **Ethics/governance content**: planned as a compliance-and-consent chapter section (old 4.3), ended up as Chapter 5 §5.9 (governance as an emergent architectural property) and Chapter 6 §6.9 (institutional cost and humility) — a philosophical argument in both cases, not a policy checklist, which is arguably truer to the book's own stated register than the original plan was.

**Superseded — the planned material did not survive, and is recorded as such, not silently dropped:**
- **The consolidated Failure Modes catalog** (old 4.4). No section in the finished manuscript collects every Five-Failure-Questions answer into one cross-referenced catalog. The discipline itself is honored contextually (Ch. 5 §5.7–§5.9, Ch. 6 §6.9) but never indexed. Candidate for back matter.
- **Open Problems / Research Agenda** (old 4.5). No section in the finished manuscript names the field's open research questions as such. Candidate for back matter.
- **Per-section guided exercises** (§0.1 Decision 5, §9 item 9). Present only in Chapter 1. Not carried into Chapters 2–6's prose; the book's actual register moved away from textbook cadence.
- **The archive KEEP/DISCARD/REFORGE review** (§0.1 Decision 6, §17). Completed through Manuscript 1 Chapters 1–9 only; abandoned, not finished, once drafting outran it. The completed portion remains valid and is not itself in question.
- **The "What LLMs Are and Are Not" placement** (old 3.1). Not superseded in substance — it was deliberately relocated, whole, into Chapter 4 (§4.4–§4.6), and arguably strengthened by arriving after reasoning's rules were fully derived rather than before them.

---

## 2. Final Dependency Graph

The authoritative version lives in Blueprint §7, reproduced here as the reconciliation's own record of it (identical content, kept in sync — if these two ever diverge, the Blueprint's copy is canonical since it is checked more often):

```
Preface → Ch.1 (1.1→1.6, strictly sequential)
       → Ch.2 (2.1→2.7, each requiring specific Ch.1 sections as noted in Blueprint §7)
       → Ch.3 (3.1→3.7, each requiring specific Ch.2 sections)
       → Ch.4 (4.1→4.7, each requiring specific Ch.1–3 sections, culminating in 4.5's
                dependency on every named mechanism in Ch.2)
       → Ch.5 (5.1→5.10, each requiring specific Ch.1–4 sections, culminating in 5.9's
                dependency on 5.8's explainability mechanism turned toward the system itself)
       → Ch.6 (6.1→6.11, each requiring specific Ch.1–5 sections, culminating in 6.11's
                synthesis of every gain-and-cost pairing in 6.2–6.9)
```

No cross-chapter dependency was found running backward (a later chapter requiring content only a chapter after it provides) or sideways in a way that would indicate a hidden circular dependency. The chain from Preface to 6.11 is a genuine directed acyclic graph with a single linear spine — confirmed by re-deriving each chapter's opening sentence against its stated predecessor's closing sentence, for all six chapter boundaries, during this reconciliation.

---

## 3. Chapter Progression Map

| Chapter | Central question answered | Central question raised for the next |
|---|---|---|
| Preface | Why does this discipline need to exist? | (sets terms; Ch.1 begins the argument proper) |
| 1 — Learning Is Not Data | What must a learner record actually represent? | What architecture makes that representation real? |
| 2 — The Architecture of Educational Intelligence | How is evidence turned into a trustworthy, explainable representation? | How is a system entitled to reason about what it represents? |
| 3 — The Reasoning Engine | What may reasoning conclude, and what must it never claim? | What kind of computation is entitled to perform that reasoning, at scale? |
| 4 — Computational Intelligence | What kinds of computation may legitimately perform which parts of educational work? | What keeps such a system correct, continuously, in a real institution? |
| 5 — Operational Architecture | How does the architecture stay truthful about a learner while running, continuously, under real operational conditions? | What kind of institution is capable of living truthfully with what this architecture provides? |
| 6 — The Institution | What changes — in the school, not the software — once truthful representation becomes possible? | (none — the manuscript's intended closing chapter) |

Every "raised" question in this table was checked against the actual final sentence(s) of its chapter, and every "answered" question was checked against that chapter's stated closing synthesis section. No chapter was found to raise a question a later chapter fails to address, and no chapter was found to silently answer a question it had not yet earned the right to raise.

---

## 4. Concept Progression Map

Tracing the book's core concepts from first appearance to full formalization to final application:

- **Evidence**: introduced informally (1.3) → formal schema with `occurred_at`/`recorded_at`/`supersedes` (2.2) → cited as the fixed reliability floor for AI-inferred hypotheses (4.6) → generalized to events (5.2) → generalized to institutional memory (6.8).
- **Trajectory**: motivated by the two-student example (1.1) → formalized with the n=1 `insufficient_data` rule (1.4, §11.2) → cited in risk models (2.5) → institutionalized as the replacement for the average (6.2).
- **Confidence / bands**: named as a problem, deliberately unsolved (1.5) → full formal model, ECM (2.4, §11) → the weakest-link corollary for composite claims (3.3) → the fixed source-reliability tier for language-model output (4.6) → decay tied to reliability as an architectural, not merely mathematical, requirement (5.3, 5.7).
- **Bounded contexts**: introduced with the six named contexts (2.1) → the Reasoning context built out (3.1) → tested against a language model's inability to respect the boundary (4.5) → made structurally durable via independent services (5.5).
- **The Educational Intelligence Loop**: named and diagrammed in full for the first time in the manuscript at 2.4 (having been foreshadowed structurally by 2.2's pipeline) → completed end-to-end at 3.7 → shown to require continuous, not on-demand, operation (5.1) → shown to depend on institutional receipt, not just system correctness, for its promise to matter (6.1, 6.11).
- **Recommendation / decision / intervention**: the three-way boundary built in full at 3.5–3.6 → operationalized computationally (a recommendation candidate's confidence fixed before a language model ever touches its language, 4.6) → operationalized institutionally (6.6, 6.7).
- **Explainability**: an enforceable contract, not a UI feature (2.6) → shown to require surviving failure, retry, and delay, not just success (5.8) → generalized into governance, the system explaining itself to itself (5.9).

No concept was found to be redefined at a later appearance in a way that contradicts its origin. Every later appearance either applies the concept unchanged or explicitly derives a new consequence from it, naming the derivation as such.

---

## 5. Terminology Consistency Audit

Checked across all six chapters plus the Preface:

- **Educational Confidence Model, Confidence Non-Invention Principle, Instrument Validity Gate, Evidence Continuity Invariant, Educational Intelligence Loop, bounded context, projection, evidence log, educational claim, recommendation, decision, intervention** — all used with identical meaning at every appearance after their formal introduction. No drift found.
- **Capitalization convention** — proper-noun-style terms (the five named frameworks above) stay capitalized throughout; common-noun-style terms (projection, evidence log, capability profile, risk model, bounded context) are bold-introduced once, then lowercase — held consistently through Chapter 3. **Chapters 4–6 do not introduce new terms this way at all** (see Blueprint §8's note on "event," "orchestration," "hybrid architecture") — not an inconsistency in how existing terms are used, but a genuine shift in whether new terms get the formal treatment. Recorded, not corrected, since it reflects the deliberate register change instructed for those chapters.
- **"Educational Intelligence" vs. "Educational Intelligence Engineering" vs. "Educational Intelligence System"** — three distinct, correctly distinguished uses throughout: the discipline (Engineering), the running architecture (System), and the general subject (Intelligence, used loosely in prose, e.g., Chapter 4's title). No case found where these are used interchangeably in a way that would confuse a careful reader.
- **"The loop" vs. "the Educational Intelligence Loop"** — the shorter form is used informally after formal introduction (e.g., Ch. 3 §3.7, Ch. 5 §5.1), consistent with the bold-then-lowercase convention applied to a multi-word proper term.
- No case was found of two different concepts sharing one name, or one concept acquiring two different names, across the six chapters.

---

## 6. Cross-Reference Audit

Every explicit forward or backward reference between chapters was checked for pointing at real, existing content:

- Ch.1 → Ch.2: "the contract Chapter 2 architects around" (1.6) — correct; 2.1–2.7 build exactly this.
- Ch.2 → Ch.3: "reasoning about cause and response is a different kind of problem" (2.7) — correct; Ch.3 opens exactly here.
- Ch.3 → Ch.4: "what kind of computational system is actually entitled to perform educational reasoning at that scale" (3.7) — correct; Ch.4 opens with this exact question restated.
- Ch.4 → Ch.5: "what that something looks like, in practice, is a different kind of question" (4.7) — correct; Ch.5 opens exactly here.
- Ch.5 → Ch.6: "what kind of school would actually have to exist to hear it" (5.10) — correct; Ch.6 opens exactly here.
- Internal citations within chapters (e.g., Ch.4 §4.6 citing Ch.2's source-reliability tier; Ch.5 §5.5 citing Ch.2 §2.1's opening scenario; Ch.6 §6.8 citing Ch.2 §2.4's Instrument Validity Gate generalization) were each checked against the cited section's actual content and found accurate.

No dangling forward reference (a chapter promising content a later chapter does not deliver) or false backward reference (citing an earlier chapter for content it does not actually contain) was found.

---

## 7. Remaining Inconsistencies Between Planning Documents and the Finished Manuscript

Consolidated from the notes distributed throughout the Blueprint's v6 update, for a single point of reference:

1. **Axiom "Derives" citations (§FA)** still reference the pre-drafting Chapter 3 outline and were never extended to Chapters 4–6 at all. Directionally correct, not precise. Not mechanically remapped, due to size and error risk — flagged rather than fixed.
2. **The consolidated Failure Modes catalog** (old §0.1 Decision 3, old 4.4) does not exist in any form in the finished manuscript. The discipline is honored contextually; no index exists.
3. **The Open Problems / Research Agenda** (old 4.5) does not exist in any form in the finished manuscript. Not resolved, not contradicted, not placed.
4. **Per-section guided exercises** (old §0.1 Decision 5) exist only in Chapter 1.
5. **The archive KEEP/DISCARD/REFORGE review** (§17) is complete only through Manuscript 1, Chapters 1–9; the remainder of both archive manuscripts was never reviewed.
6. **The exact Source Reliability Table** (§11.3) was never built as a standalone reference beyond the four examples named in running prose.
7. **The reading paths in Blueprint §7** ("Practitioner fast-path," "Educator/non-engineer path") were designed against the four-chapter, schema-heavy plan and have not been re-validated against Chapters 4–6's different register — flagged in the Blueprint as not re-validated rather than silently left as though still authoritative.
8. **The Preface's required epistemic-layering statement** (design commitments vs. falsifiable claims) has not been re-audited line-by-line against the Preface's actual final published text as part of this reconciliation pass — worth confirming in the upcoming manuscript continuity audit.
9. **Cost/resourcing constraints** (v1 §14.8), originally folded into the old 4.1 maturity model, have no confirmed home in the finished manuscript — the maturity-model content itself did not survive into Chapter 4 in that form.

None of these nine items contradict anything in the finished manuscript. All nine are absences or approximations in the planning documents relative to a manuscript that took a different, and in several cases richer, path than originally planned. None are blocking for the next step in the stated production sequence (a full manuscript continuity audit).
