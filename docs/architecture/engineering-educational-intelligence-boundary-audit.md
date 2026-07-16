# Engineering Educational Intelligence — Boundary Audit

**Method:** every named area was classified against the manuscript as explicitly included, explicitly excluded, implicitly assumed, silently depended upon, or genuinely ambiguous — then cross-checked for the specific drift patterns requested: responsibilities treated as someone else's without saying so, ownership that changes across chapters, and whether the six bounded contexts collectively cover the discipline's own claimed territory.

---

## Executive Verdict

**Mostly Bounded with Significant Boundary Drift.**

The discipline's core territory — evidence, confidence, reasoning authority, computational entitlement, and the architecture/institution boundary — is drawn with real precision, and several exclusions (educational policy, pedagogy, storage technology, curriculum content authority) are stated or clearly implied and held consistently throughout. Against that, one genuine ownership contradiction was found, one of the six named bounded contexts is functionally never elaborated after being introduced, and four topics a real deployment cannot avoid — authorization, security, privacy, and legal compliance — have no architectural home anywhere in the six contexts or in any of the manuscript's explicitly-named cross-cutting disciplines (orchestration, governance). That absence is a materially different, and more significant, kind of gap than the areas the manuscript deliberately and visibly excludes.

---

## Area-by-Area Classification

| Area | Status | Basis |
|---|---|---|
| Evidence collection (the record itself) | **Explicitly included** | Chapter 1–2's central subject |
| Evidence collection (the workflow of gathering it) | **Silently depended upon** | Evidence is treated as arriving; how it is prompted or gathered is never addressed |
| Assessment (instrument delivery, ownership) | **Explicitly included** | The Assessment bounded context (2.1) |
| Psychometric methodology (item design, validation studies) | **Implicitly assumed to be external** — treated as someone else's responsibility without saying so | The Instrument Validity Gate consumes "validation studies and independent replication" as input, never claims to teach or perform them |
| Curriculum design (structure, prerequisites) | **Explicitly included** | The Curriculum bounded context, the knowledge graph |
| Curriculum design (what should be taught, pedagogical sequencing judgment) | **Explicitly external** | Chapter 4 §4.5: "a specific claim, by a specific curriculum authority" — named as external and authoritative over the system |
| Pedagogy / instructional method | **Explicitly excluded** | Reserved to teacher professional judgment throughout (3.6, 6.6) |
| Instructional design (lesson/materials planning) | **Ambiguous** | Named as the Instruction context's ownership (2.1) and never mentioned again anywhere in the manuscript |
| Intervention (the record) | **Contradictory** | See Finding A1 |
| Intervention (the real-world act) | **Explicitly excluded** | Chapter 3 §3.6: "belongs to the world, not to the system at all" |
| Institutional governance (policy, culture) | **Explicitly discussed, explicitly outside the architecture's control** | Chapter 6 throughout; Chapter 5 §5.10's closing statement |
| Security (cybersecurity) | **Silently depended upon; never mentioned** | No finding anywhere in the manuscript |
| Authorization (who may see what) | **Ambiguous** | The Stakeholder context implies it matters; no rule is ever given |
| Privacy / consent mechanisms | **Silently depended upon; never mentioned** | No finding anywhere in the manuscript |
| Legal compliance | **Silently depended upon; never mentioned** | No finding anywhere in the manuscript |
| AI reasoning (general practice) | **Explicitly discussed as governed territory, not taught as a practice** | Chapter 4 addresses where AI may operate, not how to build AI systems generally |
| Language models specifically | **Explicitly included, precisely bounded** | Chapter 4 §4.4–§4.6 |
| Analytics (computation: projections, capability profiles) | **Explicitly included** | Chapter 2 §2.5 |
| Analytics (dashboards, visualization, reporting UI) | **Implicitly excluded** | Never addressed; Chapter 2 §2.6 explicitly stops at "the only remaining work is to present it" |
| Educational decision-making | **Explicitly discussed as human-owned, outside system authority** | Chapter 3 §3.6 |
| Software engineering (general practice) | **Explicitly included** | The book's primary register throughout |
| Database architecture (logical data model) | **Explicitly included** | Evidence and confidence schemas given |
| Database architecture (specific storage technology) | **Explicitly excluded** | No vendor references, no technology commitment anywhere |
| User-interface design (content/language) | **Explicitly included** | The band-to-register mapping (2.4, 2.6) |
| User-interface design (visual/interaction design) | **Implicitly excluded** | Never addressed, never claimed |
| Organizational change | **Explicitly discussed, explicitly outside architectural control** | Chapter 6 throughout |
| Educational policy | **Explicitly excluded** | Preface: "not a product comparison, a policy document" |

---

## A — Boundary Contradictions

**A1 — Intervention ownership is assigned to the Reasoning context in Chapter 2 and then declared to belong to no part of the system in Chapter 3.**
Chapter 2 §2.1 lists the Reasoning context as owning "the derived judgments made from a learner's projected state: recommendation, and eventually, intervention" — placing intervention inside the architecture's ownership structure, alongside recommendation. Chapter 3 §3.6 then states plainly that intervention "belongs to the world, not to the system at all." These are not reconcilable by inference the way several other apparent tensions in this manuscript have been (per prior audits) — one statement places intervention inside a named context's ownership; the other places it outside the system entirely. A reader, or an implementing team, cannot determine from the text alone whether an intervention record is something the architecture owns and tracks, or something the architecture explicitly declines to claim any part of.

---

## B — Boundary Ambiguities

**B1 — The Instruction context is named and given an ownership claim, then never appears again anywhere in the manuscript.**
Of the six bounded contexts introduced in Chapter 2 §2.1, five (Curriculum, Learner, Assessment, Reasoning, Stakeholder) recur throughout the book, are given schemas or explicit responsibilities, and interact with the rest of the architecture in visible ways. The sixth, Instruction — "owns how teaching is planned against the curriculum" — is never mentioned again in Chapters 2 through 6. Whether instructional planning is meant to be a fully realized part of this architecture, a placeholder acknowledging future work, or effectively excluded in practice despite its formal listing, cannot be determined from the text.

**B2 — Authorization is implied to matter architecturally but is never specified.**
The Stakeholder context's entire purpose depends on some notion of who is entitled to see what — a teacher's view differs from a parent's, which differs from an administrator's. Nothing in the six chapters states whether *deciding* who counts as "this learner's teacher" or "this learner's parent" for access purposes is part of this architecture's responsibility or an external system's. The Stakeholder context's existence argues for inclusion; the total absence of any authorization rule argues for exclusion. The manuscript does not resolve which.

**B3 — Whether psychometric methodology is part of the discipline or an external input is never stated, only implied by usage.**
The Instrument Validity Gate reasons *about* validation studies with real architectural precision, but the manuscript never says whether conducting such studies — the actual practice of psychometrics — is inside Educational Intelligence Engineering's claimed territory or a neighboring discipline this architecture merely consumes output from. This is the clearest instance in the manuscript of a responsibility handled as though it belongs to someone else, without that boundary ever being stated.

**B4 — The line between "analytics this architecture computes" and "analytics this architecture presents" is implied, not drawn.**
Capability profiles, risk models, and confidence bands are clearly, architecturally owned computations. Whatever renders them into a dashboard, chart, or report a stakeholder actually looks at is never addressed, and the manuscript never states whether this rendering layer is considered part of the discipline (an unbuilt but claimed component) or explicitly outside it (a UI concern for someone else to solve).

---

## C — Intentional Exclusions (Consistently Held)

**C1 — Educational policy.** Stated directly in the Preface ("not a product comparison, a policy document") and never crossed anywhere in the six chapters.

**C2 — Pedagogy and instructional method.** Consistently reserved to teacher professional judgment (Chapter 3 §3.6, Chapter 6 §6.6); the architecture never claims to know how a child learns best, only to represent what has been observed about whether they have.

**C3 — Specific storage or database technology.** No vendor names, no technology commitment, anywhere — held with unusual discipline throughout, including in the otherwise fairly concrete schemas given in Chapter 2.

**C4 — Visual and interaction UI design.** Never addressed, never claimed as territory; the manuscript's UI-adjacent content stops at *what language* a system may use, never *how it should look*.

**C5 — Curriculum content authority.** What should be taught is explicitly deferred to "a specific curriculum authority" (Chapter 4 §4.5) as an external, authoritative source the architecture represents but does not itself decide.

**C6 — The physical act of intervention or instruction delivery.** Explicitly and consistently placed outside the system (Chapter 3 §3.6) — distinct from, and more cleanly handled than, the *record* of intervention, whose ownership is contradictory (A1).

---

## Responsibilities Explicitly Outside Educational Intelligence Engineering

Compiled from the classification table above — every responsibility the manuscript clearly and consistently treats as belonging to a different discipline, a different role, or a different party:

- Educational policy and country-specific regulatory frameworks.
- Pedagogy and instructional method — how a teacher should actually teach.
- The conduct of psychometric validation studies (though not the *reasoning about* their results, which is squarely inside).
- Specific database, storage, or infrastructure technology choices.
- Visual and interaction design of any user interface.
- The substantive judgment of what a curriculum should contain — owned by an external curriculum authority the architecture represents but does not author.
- The physical act of teaching, intervening, or otherwise acting on a learner in the world.
- The final decision about what happens to a specific learner — reserved to a human, never the system, at every point this boundary is discussed.
- Institutional culture, policy, and organizational change — discussed extensively as subject matter, explicitly and repeatedly declared outside what the architecture itself can compel or own.

---

## Do the Six Bounded Contexts Collectively Bound the Discipline?

No — and the manuscript is inconsistent about how honestly it acknowledges this.

Two responsibilities are explicitly and deliberately placed *outside* the six named contexts, with clear reasoning given for why: **orchestration** (Chapter 5 §5.4, explicitly "not a seventh context with its own truth to protect") and **governance** (Chapter 5 §5.9, explicitly "not a separate department"). Both are named, both are given a stated reason for sitting outside the context map, and both are cross-referenced back to mechanisms the contexts already own. This is boundary-drawing done well — an explicit acknowledgment that not every responsibility fits inside a data-ownership model, paired with a clear account of where the responsibility actually sits instead.

**Authorization, security, privacy, and legal compliance receive no such treatment.** They are not assigned to one of the six contexts, and they are not named as deliberately cross-cutting the way orchestration and governance are. They simply do not appear anywhere in the architecture, named or unnamed, contextual or cross-cutting. This is a materially different situation from the well-handled cases above: a reader cannot tell whether these four areas are meant to be out of scope by design (like educational policy, which the Preface states directly) or are simply gaps the architecture has not yet reached. Given how centrally this architecture concerns itself with a still-forming child's data, and given the manuscript's own repeated insistence elsewhere on naming its boundaries rather than leaving them to be discovered, this silence is the single most significant boundary-drawing weakness found in this audit.

---

## Overall Verdict

**Mostly Bounded with Significant Boundary Drift.**

The discipline's central claims — what counts as evidence, what a system may reason about, where computation is and is not entitled to operate, and the line between architecture and institution — are bounded with real precision, arguably more consistently than most technical books manage across a comparable scope. Against that: one direct ownership contradiction (intervention), one bounded context that exists in name only after its introduction (Instruction), and four foundational real-world concerns (authorization, security, privacy, legal compliance) with no stated home anywhere in the architecture, unacknowledged rather than deliberately excluded. None of this suggests a poorly conceived discipline — the areas where the manuscript draws a boundary, it draws it well. It suggests a discipline whose edges were not audited as carefully as its center, which is a fair and specific criticism distinct from either "well bounded" or "poorly bounded" as a whole.
