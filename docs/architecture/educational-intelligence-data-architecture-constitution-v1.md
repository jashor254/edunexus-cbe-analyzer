# The Educational Intelligence Data Architecture Constitution

**Version 1.0**

## Where this document sits

EduNexus already has three constitutional or constitution-adjacent documents, and this is deliberately not a fourth competing claim to supremacy:

- **`docs/edunexus-constitution.md`** (10 Articles) is the **Business/Mission Constitution**. Where a principle below and the Business Constitution ever conflict, the Business Constitution wins.
- **`docs/engineering-constitution.md`** governs **how engineers work**. This document does not govern that.
- **`docs/sprint-25-educational-constitution-and-migration-strategy.md`**'s 11 Articles are the **ratified Educational Intelligence Constitution** for the epistemic and pedagogical layer — what Educational Intelligence may claim, how confidence and risk are reasoned about, and the human-approval gates that sit above any automated output. This document does not rewrite, extend, or reopen those Articles. It governs a different, lower layer: the data architecture those Articles are reasoned on top of — how learner evidence is stored, read, resolved, and proven equivalent under migration. Where this document's laws and Sprint 25's Articles both bear on the same output (for example, Article IX's traceability requirement and this document's Canonical Intelligence Read Path), they compose rather than compete: this document supplies the structural guarantee that makes the epistemic requirement enforceable in practice.
- **`docs/architecture/edunexus-architecture-constitution.md`** governs institutional ownership structure — what owns what across Institution, Teaching, and Educational Intelligence as domains. This document is scoped entirely inside the Educational Intelligence domain that document names; it does not restate or alter the ownership boundary itself.

This document fills the one gap those four do not cover: the permanent data-architecture guarantees for Educational Intelligence — proven true by completed investigation, not proposed for adoption.

---

## Part I — Preamble

Educational Intelligence produces claims about real learners: what they know, where they are at risk, what they should do next. Those claims are only as trustworthy as the data architecture beneath them. A framework, a database engine, or an AI provider can be replaced without incident. A silent violation of how evidence is stored, read, or resolved cannot be replaced without incident — it corrupts every claim built on top of it, often invisibly, because the claim's surface presentation gives no sign that its foundation has failed.

This is why Educational Intelligence requires governance distinct from ordinary engineering practice. Ordinary engineering practice — logging conventions, error-handling style, test cleanup discipline — properly changes as the team, the tools, and the codebase mature. The guarantees this document ratifies must not change on that schedule. They must hold regardless of which database, which framework, which AI model, or which contributor is present, because the cost of silently discovering they do not hold is a false claim about a real learner, discovered too late to matter.

Architectural truth is separated from implementation deliberately. A law in this document names what must remain true; it does not name how that truth is currently achieved. The current mechanism — a specific database trigger, a specific lint rule, a specific test suite — is evidence that the law is achievable and enforced today, not part of the law itself. A future implementation may satisfy the same law by different means.

Every law in this document exists because a specific, completed investigation proved it, not because it seemed reasonable. Six investigations preceded this document. Several returned a conditional or negative verdict — identity semantics remain unresolved, the question of which learner-identity domain is canonical remains conditional, and a known failure-handling pattern remains unfixed in named locations. None of those findings were promoted to law. A constitution built from aspiration rather than proof would be indistinguishable, at the moment it mattered, from having no constitution at all.

For the same reason, this document is deliberately narrower than Educational Intelligence as a product concept. It governs only what six completed investigations actually proved: evidence storage, the intelligence read path, attribution, and identity resolution under migration. Guardian identity, Compass, Academic Clinic, Career Intelligence, and the timing of any full institutional migration are real parts of Educational Intelligence that this document does not govern, because they have not yet been investigated to the same evidentiary standard. Part VII names them explicitly rather than leaving their absence unexplained.

---

## Part II — Constitutional Laws

### Law 1 — Evidence Immutability

**Constitutional Statement**: A recorded piece of learner evidence is never altered after creation; a correction is new evidence that supersedes it, never an edit to it.

**Architectural Meaning**: This law governs the permanent record of what was observed about a learner. It forbids any mechanism, however well-intentioned, from rewriting an existing evidence record in place — including for correction, cleanup, or migration. A wrong observation is retracted or superseded by a new, separate record; it is never made to disappear or silently change into something else.

**Evidence Supporting Ratification**: Enforced at the database layer, not by application convention alone. Exercised correctly and without exception across every investigation in this series that touched evidence, including a direct test of retraction producing the expected, non-destructive result.

**Why It Is Constitutional**: This law does not depend on which database engine enforces it, which application framework reads it, or which team maintains it. Any Educational Intelligence architecture that permits silent evidence rewriting cannot support the traceability its own claims require, regardless of implementation. It is the one law in this document with no plausible future exception.

---

### Law 2 — Canonical Intelligence Read Path

**Constitutional Statement**: Learner intelligence state is read through one canonical computation, never through a direct read of raw evidence by a feature-specific consumer.

**Architectural Meaning**: This law governs how the platform's many features — reports, dashboards, recommendations, parent-facing summaries — obtain a learner's capability, risk, or knowledge state. It forbids any feature from deriving its own, independent interpretation of raw evidence. Every feature must obtain intelligence state through the same computation every other feature uses.

**Evidence Supporting Ratification**: Enforced by an automated guardrail, confirmed live during this series' own work — a new module written specifically to validate this law's neighboring guarantee (Law 4) violated this law on first attempt and was rejected by the guardrail before it could be merged. A law that catches its own author is proven enforced, not merely documented.

**Why It Is Constitutional**: Without this law, two features could reach different conclusions about the same learner from the same underlying evidence, and neither would be wrong by its own logic — only inconsistent with the other. That failure mode is independent of any particular framework or database; it is a structural risk of allowing more than one interpretation path to exist at all.

---

### Law 3 — Attribution Is Not Ownership

**Constitutional Statement**: A record of who entered a piece of evidence is attribution only; it is never used to determine who may access it.

**Architectural Meaning**: This law governs the difference between provenance and authorization. The identity of the person who created a record answers "who entered this" — a historical fact that never changes. It does not answer "who may read this now" — a question whose answer depends on the learner's current, live relationships (which teacher currently teaches them, which parent is currently linked), which do change over time.

**Evidence Supporting Ratification**: Directly implemented in the platform's learner-visibility logic, and independently confirmed as unviolated during a full audit of the platform's identity-resolution functions conducted specifically to find violations of exactly this pattern.

**Why It Is Constitutional**: Conflating attribution with ownership produces a predictable, serious failure: a learner's record becomes inaccessible the moment the person who happened to enter it leaves, transfers, or changes role, even though the learner's real, current relationships have not changed. This failure mode does not depend on implementation; it is a structural consequence of using one fact to answer two different questions.

---

### Law 4 — Semantic Equivalence Under Identity Resolution

**Constitutional Statement**: Resolving a learner through one identity system must produce educationally identical intelligence output to resolving the same learner directly.

**Architectural Meaning**: This law governs what is allowed to change when a learner's identity is resolved through an indirection layer rather than addressed directly. The resolution mechanism is allowed to change. The educational meaning of the output — the same projections, the same Blueprint content, the same evidence considered — is not.

**Evidence Supporting Ratification**: Proven, not merely asserted, by a repeatable regression suite built specifically to test this claim — including deliberate negative tests confirming the suite can detect a real divergence, not merely pass by construction. This is the platform's first codified proof that an identity-resolution indirection preserves educational meaning rather than merely preserving referential correctness.

**Why It Is Constitutional**: Any future migration, bridge, or identity-resolution mechanism this platform ever builds inherits this same obligation: proving equivalence, not assuming it. A migration that changes which record a learner's identity resolves to, without proving the resulting intelligence output is unchanged, is a migration that has not met this platform's own bar for safety — independent of which two identity systems are involved.

---

### Law 5 — Ambiguous Identity Mappings Are Never Arbitrarily Resolved

**Constitutional Statement**: When a learner identity resolves to more than one candidate record, no candidate is ever silently selected.

**Architectural Meaning**: This law governs the failure mode where an identity-resolution mechanism, faced with two or more plausible matches, must not guess. The correct behavior is to report the ambiguity, not to pick one candidate and proceed as though the ambiguity did not exist.

**Evidence Supporting Ratification**: Demonstrated directly during this series' identity-resolution testing: a deliberately constructed ambiguous case was confirmed to be refused rather than arbitrarily resolved, by both a stricter test-only classifier and the platform's real production resolution function.

**Why It Is Constitutional**: An arbitrarily resolved ambiguity is a silent wrong-learner error — the single most severe failure an identity system can produce, because nothing about its output signals that anything went wrong. This risk exists in any system that maps one identity space onto another; it is not specific to the current implementation.

---

## Part III — Architectural Laws

These are mandatory in current practice but intentionally withheld from constitutional status: each is real, evidenced, and currently governs decisions, but each has a named condition under which it would need to change, and none has yet survived long enough or completely enough to bind future architecture without review.

### Institutional Ownership on New Writes

**Current Status**: Every newly created class or learner record is required to carry a real institutional owner.

**Supporting Evidence**: Implemented and confirmed operating on new writes as of this series' own audit work.

**Why Not Yet Constitutional**: The requirement is proven only for records created after its introduction. Historical records, and full parity across every learner-identity system this platform maintains, remain incomplete. A law binding all future architecture should not be ratified from a guarantee that does not yet hold for all present data.

**Conditions Required Before Promotion**: Confirmation that institutional ownership holds without exception across every learner-identity system in use, not only the newest one, and confirmation that no code path can create a class or learner record without it.

---

### Canonical Identity Indirection as the Migration Pattern

**Current Status**: Where one learner-identity system must write through another, the write is required to resolve identity first and then proceed through the existing, unmodified processing pipeline — never by duplicating that pipeline's logic against a second identity system.

**Supporting Evidence**: Implemented and operating in production for a defined subset of writes; identified during this series' migration-readiness investigation as the pattern that specific investigation's own recommendation was independently derived to match.

**Why Not Yet Constitutional**: Proven for one subset of write paths, not yet extended to the full range this platform's Educational Intelligence domain will eventually require.

**Conditions Required Before Promotion**: Extension of the pattern beyond its current subset, with the same equivalence proof Law 4 requires, applied to each additional write path before it is added.

---

### Core as Directional Canonical Owner for Institutional Facts

**Current Status**: For learner identity, enrollment, and school ownership specifically, the platform's newer institutional data system is treated as the intended long-term canonical owner.

**Supporting Evidence**: A completed source-of-truth investigation found this system now exceeds its predecessor in the relevant record counts and has a real, in-use administrative surface — but found the platform's evidence, projection, and reasoning outputs entirely unmigrated and without a committed migration timeline.

**Why Not Yet Constitutional**: The investigation that produced this finding returned a conditional verdict, not an unconditional one, specifically because the domain this document governs (evidence and intelligence) is not yet part of what has actually moved.

**Conditions Required Before Promotion**: Completion of the four measurable conditions this platform's own migration-trigger investigation already named for the evidence and intelligence domain specifically.

---

## Part IV — Engineering Rules

These are implementation guidance, current and correct, but not architectural truth — they may change as tooling, team composition, or scale change, without requiring review of anything in Part II or Part III.

**Structured, contextual logging in place of silent failure handling.** Correct current practice, applied consistently where it has been applied — but applied to a limited set of locations so far, not yet a platform-wide guarantee. Remains engineering guidance because its correctness does not depend on any architectural claim; it is a matter of operational hygiene.

**Explicit classification between expected absence and unexpected failure in error handling.** Proven correct and effective in the one location where it has been fully applied. A platform-wide audit conducted during this series found the identical, unfixed pattern in five further locations in the same module. This is exactly the kind of principle that could earn constitutional status once its evidence is complete — Part VII names it as a leading candidate — but a rule proven violated in known, unremediated locations cannot yet bind future architecture without becoming aspirational rather than proven.

**Cleanup of test fixtures by querying actual relationships, not only by relying on a list of ids collected during setup.** A lesson learned directly during this series' own testing work, where a cleanup routine that trusted only its own tracked-id list left real rows behind because a downstream operation created additional, untracked dependent records. Sound practice, but a testing-hygiene matter, not an architectural one.

---

## Part V — Product Policies

These are business and prioritization decisions. They may change at any time, for business reasons, without amending this Constitution.

**The authorization and timing of any institutional-migration initiative.** When such work is scheduled, how it is sequenced against other priorities, and whether it proceeds ahead of, during, or after any particular pilot phase are founder and product decisions. This Constitution's laws constrain how such work must be done, once undertaken; they do not decide when it is undertaken.

**Which learner-identity system receives new feature investment.** A business and resourcing choice, informed by but not decided by the architectural findings in Part III.

**Release and pilot sequencing.** Which schools, cohorts, or features are prioritized, and in what order, is a business decision this Constitution does not govern.

None of these policies may be cited as justification for violating a law in Part II. A business decision may change what is built next; it may never change what a completed law requires of what already exists.

---

## Part VI — Constitutional Boundaries

This Constitution governs the data architecture of Educational Intelligence: evidence storage, the intelligence read path, attribution, and identity resolution under migration. It does not govern, and no future interpretation of this document may be extended to govern:

- User interface design or presentation
- Pricing, billing, or commercial terms
- Marketing content or positioning
- Choice of AI provider or model
- Programming language or frontend framework
- Deployment platform or hosting infrastructure
- General software engineering practice, which `docs/engineering-constitution.md` governs
- Business mission and strategic priority, which `docs/edunexus-constitution.md` governs
- What Educational Intelligence may epistemically claim, and the human-approval gates above its output, which `docs/sprint-25-educational-constitution-and-migration-strategy.md` governs
- Institutional ownership structure across Institution, Teaching, and Educational Intelligence as domains, which `docs/architecture/edunexus-architecture-constitution.md` governs

A future contributor citing this document to settle a question outside this list has misapplied it, regardless of how architectural the question may appear.

---

## Part VII — Deferred Constitutional Domains

The following are real parts of Educational Intelligence, deliberately excluded from this Constitution because they have not yet been investigated to the evidentiary standard Part II requires.

**Guardian identity.** Two independent, unreconciled systems for linking a guardian to a learner currently coexist. No governing principle can be ratified until a single investigation determines which system is authoritative, or how the two are reconciled. A future law would likely depend on that determination directly.

**Compass.** Touched only narrowly, through one representative component, during the equivalence investigation in this series. Not audited for identity handling, evidence dependency, or migration readiness in its own right. A future law would depend on that dedicated audit.

**Academic Clinic.** Referenced but not directly investigated in this series. The same evidentiary gap as Compass applies.

**Career Intelligence.** Referenced but not directly investigated in this series. The same evidentiary gap as Compass applies.

**Full institutional migration, beyond identity and evidence.** This series investigated learner identity and evidence specifically. Class structure and report-card generation were last investigated under an earlier pass whose findings substantially predate this series' own discovery that the underlying data has since changed materially. A future law here would depend on a re-investigation under current conditions, not the earlier, now-stale findings.

**Resolution of learner-identity field semantics.** A specific, named identity field was found during this series to carry more than one incompatible meaning depending on which part of the platform wrote it. The investigation that found this returned a negative verdict and deferred the decision; it did not make one. No law can be ratified about the meaning of that field until that decision is made.

---

## Part VIII — Constitutional Amendment Process

A law in Part II may be amended only when one or more of the following changes:

- The repository evidence the law cites no longer holds
- A new, completed investigation produces architectural proof that supersedes the evidence a law was ratified on
- A regression suite that a law depends on begins failing, or is found to have never actually tested what it claimed to test
- A database invariant a law depends on is removed or weakened
- A new, completed architectural decision directly and explicitly supersedes an existing law

Implementation convenience is never sufficient justification for amendment. Business pressure is never sufficient justification for amendment. A law may only yield to new evidence of the same rigor that ratified it.

Every amendment must record, in the amending document:

- The previous law, stated exactly as it read before amendment
- The new law, stated exactly as it will read after amendment
- The specific investigation, evidence, or regression result justifying the change
- The impact on any existing architecture, migration, or feature that depended on the previous law

A law may also move between sections of this document — from Part III into Part II upon completion of its named promotion condition, or, in principle, out of Part II entirely if evidence is later found to have been incomplete — following the same recording requirement.

---

## Part IX — Ratification Statement

This Constitution ratifies five laws: Evidence Immutability, the Canonical Intelligence Read Path, Attribution Is Not Ownership, Semantic Equivalence Under Identity Resolution, and the prohibition on arbitrarily resolving ambiguous identity mappings. Each is supported by implemented, enforced, or repeatably-tested architecture confirmed during the six investigations that preceded this document, not by intention or design preference.

This Constitution does not govern learner-identity field semantics, guardian identity, Compass, Academic Clinic, Career Intelligence, or any institutional migration beyond what has been directly investigated. Each is named in Part VII rather than left silently absent, because an architecture document that omits its own gaps without naming them is less trustworthy than one that states them plainly.

This Constitution is intentionally narrower than Educational Intelligence as a whole, because ratifying an unproven principle as permanent law would cost this platform more than leaving that principle unratified. A gap named honestly can be closed by a future investigation. A false law, once relied upon by future architecture, is discovered only when something built on top of it fails.

Amendments to this document are expected, and are not a sign of failure. Part VII names the investigations already known to be pending. As each is completed, this document is expected to grow — not by revision of what is already ratified, but by the same evidentiary process that ratified it the first time.
