# The EduNexus Architecture Constitution

**Version 1.0**

## Where this document sits

EduNexus already has two constitutional documents, and this is deliberately not a third competing claim to supremacy:

- **`docs/edunexus-constitution.md`** (10 Articles) is the **Business/Mission Constitution** — Schools First, Trust Above Growth, Evidence Before Expansion, and so on. Its own Preamble already establishes it as taking precedence "when a difficult decision arises." This document does not challenge that. Where an architectural principle below and the Business Constitution ever conflict, the Business Constitution wins.
- **`docs/engineering-constitution.md`** governs **how engineers work** — culture, code review, decision-making, technical judgment. This document governs **what the architecture is**. They are peers addressing different questions, not competitors.
- **`docs/sprint-25-educational-constitution-and-migration-strategy.md`**'s 11 Articles are the **already-ratified Educational Intelligence Constitution**. Part 7 of this document does not rewrite them — it adopts them by reference as the binding law for that domain and shows how they compose with the ownership model below.

This document fills the one gap those three don't cover: the permanent structural rules for **what owns what, what must always remain true, and how the system is allowed to grow** — derived from the Institution/Teaching/Educational-Intelligence separation, the Canonical Class & Learner Decision Review, and the Canonical Educational Structure decision, all already ratified in this engagement and not re-opened here.

---

## Foundation (already decided, not re-litigated)

- Institution-first School Operating System
- Institution vs. Teaching separation
- Educational Intelligence as a reasoning layer, never a records layer
- Curriculum → Level → Stream as the canonical educational structure
- Learner identity independent of enrollment
- Teacher Workspace as a projection of institutional data, not a source of institutional truth
- Schools own institutional records; Teachers own teaching; Educational Intelligence owns reasoning

---

## Part 1 — Architectural Axioms

Permanent, technology-independent truths. An axiom is falsified by evidence, never voted out by convenience.

1. **A School owns institutional truth.** Every official Class, every Learner's admission, every official Report exists because a School's authority created or approved it.
2. **A Teacher never owns institutional identity.** A teacher may create a teaching artifact (a lesson plan, a gradebook entry) but never an institutional fact (a Class's existence, a Learner's admission) without that fact tracing to School authority.
3. **A Learner exists independently of enrollment.** Identity survives every enrollment, transfer, curriculum change, and graduation. No enrollment event may re-create or fork a Learner's identity.
4. **A Level always belongs to exactly one Curriculum.** There is no curriculum-agnostic "Grade 7" — only "Grade 7 of CBC." A Level's meaning is never assumed portable across curricula.
5. **Streams belong to Schools, not to Curricula.** Every curriculum can be streamed; the stream itself carries no educational meaning of its own.
6. **Evidence is immutable.** A fact about what a learner did is never edited — only superseded by new evidence, per the existing evidence-lifecycle domain functions. Sprint 25's Article I ("Evidence is the only currency of truth") is the specific law; this axiom is why that law exists.
7. **Educational Intelligence never rewrites evidence, and never becomes an official record.** It reasons over evidence and produces recommendations; it does not become the thing being reasoned about.
8. **Institutional truth is never inferred from teacher workspaces.** A teacher's personal view of "my classes" is a query result, not a source; the school's own records answer "does this class officially exist," never the teacher's workspace.
9. **A single fact has exactly one authoritative field.** Where a compatibility or derived value must also exist (an integer grade alongside a `level_id`, for example), it is read-only and computed, never independently writable.
10. **Ownership is a property of the fact, not of who happened to enter it.** `teacher_id`/`created_by`-style columns record attribution, never access control or truth.

## Part 2 — Architectural Invariants

Conditions that must hold at every point in time, checkable, not aspirational.

1. Every Learner has exactly one identity record, regardless of how many schools, curricula, or enrollments they accumulate.
2. Every Enrollment belongs to exactly one School, one Curriculum, and one Level at a time.
3. Every official Class belongs to exactly one School.
4. Every Teacher Workspace view is derivable, at any moment, purely from institutional data (roster identity + teacher assignment) — never from data that exists only in the workspace.
5. Every Educational Intelligence recommendation traces to specific evidence, per Sprint 25's Article IX, without exception.
6. Every official Report traces to institutional records that existed before the report was generated — never to intelligence output alone.
7. No table may hold two independently-writable representations of the same fact (Part 1, Axiom 9, made checkable).
8. No cross-curriculum Level mapping is ever automatic — every such mapping is a logged, human decision.
9. A retired/adapter table may still be read during its observation window, but never written to by any new code path.

## Part 3 — Ownership Constitution

| Domain | Owns | Never owns |
|---|---|---|
| **Institution** | Schools, official Classes, Learner admission/enrollment/transfer/promotion, official Reports, Academic structure (Curriculum/Level/Stream/Term) | Teaching content, pedagogical judgment |
| **Teaching** | Lesson plans, schemes of work, gradebook entries, attendance sessions, assignments, observations | Class existence, learner admission, official report publication |
| **Educational Intelligence** | Derived reasoning, projections, recommendations, Blueprint, Compass, Career Intelligence, Academic Clinic | Any official record, any institutional fact, any evidence row it did not itself derive-and-label as derived |
| **Parent** | Their own visibility/consent settings, communication preferences | Any learner or institutional record |
| **Learner** | Their own self-reflection artifacts, portfolio submissions | Their own official enrollment/admission facts |
| **Platform** | Cross-tenant operations (billing, platform-operator tooling), never mistaken for "admin" of any single school | Any single school's institutional records |

**Deciding ownership for a future entity**: ask which of these six domains would be *harmed by losing accuracy* if the entity were wrong — that domain owns it. If two domains are equally harmed, the entity is split (per the Class Decision precedent: roster identity vs. teacher assignment vs. subject teaching vs. workspace projection), never jointly owned by one row.

## Part 4 — Evolution Rules

- **A new entity may be introduced** when an existing entity would have to represent two genuinely different facts to accommodate it (the Class Decision's unbundling into roster/assignment/subject-teaching/workspace is the template).
- **An existing entity should evolve instead** when the new need is a missing attribute of a fact already correctly owned by that entity — not a different fact.
- **An adapter/bridge should be built** only as an explicitly time-boxed migration mechanism (`academicBridge.ts` is the working example) — never as a permanent integration pattern. Every adapter is created with its own retirement condition stated at creation time.
- **Duplication is rejected** whenever a new write path would create a second writable source for a fact that already has one — the answer is always "extend the existing owner," never "add a second table that's easier right now." This is the single rule that would have prevented the `teacher_classes`/`classes` and `students`/`learners` divergence this engagement spent multiple sessions resolving.

## Part 5 — Feature Admission Rules

Every proposed feature must answer, before implementation begins:

1. **Which constitutional principle does it reinforce?** If none, it doesn't ship as architected; it's redesigned until it does.
2. **Which domain owns it?** Per Part 3. If the answer is ambiguous, that ambiguity is resolved *before* code, not discovered after.
3. **Which existing workflow does it extend?** A feature with no answer here is a strong signal it's inventing a new entity where Part 4 says it shouldn't.
4. **Does it introduce a duplicate writable truth?** Any "yes" here is an automatic redesign, not a tradeoff to weigh.
5. **Does it create parallel ownership?** Two domains able to write the same fact independently is rejected outright, not mitigated.
6. **Does it violate the educational architecture** (Curriculum→Level→Stream, Learner-independent-of-enrollment)? A "yes" here means the feature is redesigned around the architecture, never the reverse.

A feature that fails any question is rejected or redesigned before implementation — not shipped with a follow-up ticket to fix the violation later.

## Part 6 — Database Constitution

Principles, not schema:

1. **One authoritative source per fact.** Everything else referencing that fact points to it; nothing re-derives it independently.
2. **No duplicate writable truths.** A compatibility/legacy column may exist during a migration window; it is read-only from the moment the authoritative field exists.
3. **Derived data is never edited directly.** A computed value (an aggregate, a projection, a cached read) is regenerated, never hand-patched.
4. **Migration before retirement.** No table is dropped until everything real that depended on it has been proven, on real evidence (not row counts alone — this engagement's own decisive lesson), to depend on its replacement instead.
5. **Evidence before intelligence.** No intelligence feature computes over data that isn't itself traceable to a real evidence row.
6. **Ownership columns describe ownership, not access.** A `school_id`/`teacher_id` column establishes whose fact it is; access control is a separate, explicit policy, never inferred from who happens to be named in a row.

## Part 7 — Educational Intelligence Constitution

Adopted by reference, not restated: **`docs/sprint-25-educational-constitution-and-migration-strategy.md`, Articles I–XI**, in full, is the binding law for this domain. Composed with Part 3's ownership table, the operative summary is:

**Educational Intelligence may**: reason, predict, recommend, explain, simulate — always over evidence that already exists and is already labeled as evidence.

**Educational Intelligence may never**: invent evidence, rewrite evidence, publish an official record, or replace institutional authority — per Sprint 25 Article VI ("AI explains evidence; it never invents it") and Article VIII ("a teacher approves before a claim reaches a parent"), which remain unmodified by this document.

## Part 8 — API Constitution

- APIs expose **educational concepts** (a Class, a Learner, an Enrollment, a Recommendation) — never storage concepts (a table name, a join shape, an internal bridge identifier).
- No endpoint response includes a field whose only purpose is to leak which physical table, migration state, or temporary bridge produced it. A consumer of `/api/core/classes` should never need to know whether the row underneath is mid-migration.
- Versioning changes when the *educational concept's meaning* changes, not when its storage does — a storage-only migration (this engagement's own Class/Learner work) should be invisible at the API boundary if done correctly.

## Part 9 — Review Governance

| Review type | Triggered by | Approves |
|---|---|---|
| **Architecture Review** | Any new entity, any change to Part 1–4 | Whether the change is constitutional |
| **Product Review** | Any feature admission (Part 5) | Whether the feature is worth building at all |
| **Educational Review** | Anything touching Curriculum/Level/Learner-identity/Educational-Intelligence | Whether it's pedagogically and evidentially sound, per Part 7 |
| **Migration Review** | Any schema change, retirement, or backfill | Whether Part 4/6/10's sequencing is honored |
| **Backward-Compatibility Review** | Any API or schema change touching a live consumer | Whether existing real workflows are protected |

No single review type approves a change alone if it touches more than one column of this table — a migration that also changes an educational concept needs both Migration and Educational Review, not one standing in for the other.

## Part 10 — Deprecation Constitution

The only sanctioned sequence, matching the one already used and proven in this engagement's own Class/Learner migration plan:

**Adapter → Warning → Freeze → Migration → Observation → Retirement → Removal.**

- **Never immediate replacement.** No concept is retired in the same change that introduces its successor.
- **Freeze precedes Migration**, always — no backfill begins while a competing write path can still create new instances of the fact being retired (this engagement's own Phase 0 work is this rule applied directly).
- **Observation precedes Retirement**, on real usage, not a calendar deadline alone.
- **Removal requires explicit, named approval** — never an automatic step at the end of a pipeline, per the Migration Runbook's own Step 16/17 gate.

## Part 11 — Future-Proofing Rules

This Constitution survives the following without needing to be rewritten, because each is already an *instance* of a rule above, not an exception to it:

- **New curricula** — a new Curriculum + Level catalogue entry (Part 1, Axiom 4), never a schema change.
- **AI advances** — bounded by Part 7 regardless of model capability; a more capable model still may never invent or rewrite evidence.
- **Offline-first support** — a sync/replication concern beneath the ownership model, not a change to who owns what.
- **District/county/Ministry deployment** — an additional layer *above* School (a School's parent), not a change to School's own ownership of its institutional records; School remains the unit institutional truth is anchored to.
- **International schools** — already accommodated by Curriculum being a first-class, multi-valued concept (Part 5 of the Canonical Educational Structure decision).
- **Multi-campus institutions** — a School-to-campus relationship, modeled the same way District-to-School would be, without touching Parts 1–8.
- **Future engineering teams** — inherit this document instead of the tribal knowledge this whole engagement spent many sessions reconstructing from a database that had drifted silently from its own migration history. That reconstruction cost is the concrete argument for why this Constitution exists.

## Part 12 — Constitution Compliance Checklist

For any PR, ADR, migration, feature, or AI capability:

- [ ] States which Part 3 domain owns the change.
- [ ] Answers all six Part 5 admission questions, in writing, before implementation.
- [ ] Introduces no second writable source for an existing fact (Part 1 Axiom 9, Part 6.2).
- [ ] If retiring anything, follows the Part 10 sequence with no step skipped.
- [ ] If touching Educational Intelligence, cites the specific Sprint 25 Article it complies with.
- [ ] If touching the API surface, exposes an educational concept, not a storage detail (Part 8).
- [ ] If claiming evidence of adoption/usage, distinguishes real usage from test/fixture/seed data explicitly — never row count alone (the lesson this engagement's own Canonical Class & Learner review had to learn the hard way).
- [ ] Names the correct Part 9 review type(s) — more than one if it spans domains.
- [ ] Does not contradict the Business Constitution (`edunexus-constitution.md`) or the Educational Intelligence Constitution (Sprint 25) — if it appears to, the Business Constitution wins, per this document's own opening section.
