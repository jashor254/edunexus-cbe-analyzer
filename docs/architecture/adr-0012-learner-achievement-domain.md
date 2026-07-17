# ADR-0012 — Learner Achievement Domain (Canonical Achievement Engine)

**Status: APPROVED (2026-07-17), the ownership rules (Phase 3, Phase 6) are now binding on Sprint 12V's Learner Portfolio implementation.** Design-freeze document only — the Achievement domain itself (tables, repository, service, routes, UI) remains unimplemented; only its *ownership boundary* is now load-bearing, since Sprint 12V's Portfolio categories are defined to exclude every achievement-owned concept (Awards, Certificates, Leadership, Competitions, Community Service, Innovation) per this ADR's supersession of ADR-0011 Phase 3. The first Achievement implementation sprint is still not scheduled.

**Precedes**: the first Achievement implementation sprint (not yet scheduled — explicit approval required, per Stop Condition), and every future Portfolio/Blueprint/Graduation-Profile/University-Profile/Employer-Profile sprint that needs achievement data.
**Supersedes**: `adr-0011-learner-portfolio-architecture.md` Phase 3, **partially and explicitly** — see "Relationship to ADR-0011" below. Does not supersede any other prior ADR.
**Depends on / extends**: `adr-0011-learner-portfolio-architecture.md` (Portfolio's own frozen definition and its "compose, never own" discipline — this ADR applies that identical discipline one layer earlier), `adr-0005-learner-blueprint-architecture.md` §3 (ownership), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern, terminology discipline), `adr-0004-attendance-integration-principles.md` (derived-data discipline — the precedent for treating "expired" as a computed fact, not a stored state, see Phase 4), `adr-0003-attendance-domain.md` (the precedent for a canonical domain owning its own evidence-sourced records), `reference-architecture-specification.md` §3 (Canonical Domain Standards), §9 (Intelligence Standards), §10 rules 7–8, Educational Constitution.

---

## Why This ADR Exists

ADR-0011 froze what a Learner Portfolio is and, in its Phase 3 ownership matrix, provisionally assigned sections like Competitions, Leadership, Community Service, Innovation, Certifications, and Awards directly to "Learner Portfolio." That was correct as far as it went — no other domain existed yet to own them. It is no longer correct: this ADR creates that domain. Without it, a future Portfolio implementation would have built its own ad-hoc storage for exactly the kind of verifiable claim (a certificate, a competition result, a leadership role) that most needs a permanent, evidence-backed, revocable record — repeating, for achievements, the exact mistake Sprint 12S's audit found already made five times over for parent-facing actions. This ADR closes that gap once, permanently, before Portfolio's first implementation sprint could otherwise get there first and invent it under pressure.

---

## Core Question

**A learner does far more than get marked on assessments — they earn certificates, win competitions, lead clubs, serve their community, build and create. Who owns the permanent record of that, and how does every other domain that needs it (Portfolio, Blueprint, Parent Experience, a future Graduation/University/Employer Profile) read it without ever storing a second copy?**

**Answer**: a new canonical domain, **Learner Achievement**, owns every verifiable achievement, recognition, leadership role, certificate, innovation, competition result, community-service milestone, and school contribution — forever, evidence-backed, revocable but never deleted. Everything else reads Achievement. Achievement owns Achievement forever.

---

## Phase 1 — Audit (mandatory, done first, implementations read — not filenames trusted)

Searched the entire codebase for every term the mission named and **read the actual implementation**, not just the filename, of every plausible hit.

**No canonical Achievement system exists.** Confirmed by reading, not assuming:

| Near-hit | What it actually is, on reading | Why it is not this domain |
|---|---|---|
| `lib/academy/portfolio.ts`, `app/teacher/academy/portfolio/page.tsx`, `components/academy/PortfolioView.tsx` (`Badge` type, `buildBadges()`) | EduNexus Academy's **teacher** professional-development badge system — badges like "Evidence Champion," "Platform Pioneer," computed in-memory from a teacher's own training/tool-usage counts, never persisted as their own table | Teacher-scoped, not learner-scoped; already flagged as a naming collision in ADR-0011's own Phase 1 — reconfirmed here, not a new finding |
| `app/student/groups/*`, `app/dashboard/groups/*` (`MyGroup` type: `points`, `rank`, `streak_days`) | Subject-based **study groups** with gamified points/rank/streak — a Compass-adjacent engagement feature | No achievement, certificate, or recognition concept anywhere in the type or its queries |
| `components/organizations/sandbox-badge.tsx` | A UI pill (`<FlaskConical/> sandbox`) marking sandbox-mode environments | Not a data concept at all — a static label component |
| `lib/repositories/academy.repository.ts` | No `badge`-related query exists here at all — Academy's badges (above) are computed client-side from other Academy stats, never their own persisted row | Confirms Academy has no achievement storage of any kind to (mis)reuse |

Every other searched term (award, certificate, competition, innovation, science fair, club, leadership, captain, community service, volunteer, talent, music, sports, badge, recognition, medal, prize, activity, co-curricular) returned only incidental word matches in unrelated content — marketing copy, curriculum subject lists ("Creative Arts & Sports" as a CBC subject name), demo mock data, PDF renderer styling constants, and generic UI vocabulary ("recognition" in a sentence, not a data field). No migration defines an `achievements`, `awards`, `certificates`, `competitions`, or `leadership_roles` table (re-confirmed against the full migrations directory, extending ADR-0011's own already-clean search).

**Answer to Phase 1's question**: **we have neither one canonical learner achievement system nor several unrelated ones — we have zero.** The only two adjacent systems (Academy Teacher Portfolio, Student Study Groups) are unrelated domains that happen to share vocabulary, not partial implementations of this one. A new canonical domain is the correct, non-duplicative outcome, verified rather than assumed — matching the same discipline ADR-0011's own audit already established one sprint ago.

---

## Phase 2 — Domain Definitions (frozen)

| Term | Frozen meaning |
|---|---|
| **Achievement** | The canonical, evidence-backed record of a verifiable thing a learner did, earned, led, or contributed — the umbrella term for every row this domain stores. |
| **Recognition** | A form of Achievement where an external or internal party formally acknowledges the learner (a certificate of merit, a school commendation) — a category of Achievement, not a separate domain. |
| **Certificate** | A specific Achievement sub-type representing a formally issued credential (external body or school-issued) — always carries an issuing authority and, optionally, an expiry date (see Phase 4 — expiry is data, never a lifecycle state). |
| **Competition** | An Achievement sub-type representing participation in, or a result from, a competitive event (science fair, debate, sports tournament, hackathon) — carries a result field (participated / placed / won), never a fabricated ranking Achievement itself computes. |
| **Leadership** | An Achievement sub-type representing a role held (club president, house captain, prefect) — carries a role title, scope, and duration. |
| **Community Service** | An Achievement sub-type representing service contributed (hours, activity type, verifying party) — see Phase 8 for what folds into this category. |
| **Innovation** | An Achievement sub-type representing an original idea, invention, or project outcome recognized as such (not merely "a project exists" — recognition or verified completion is required, matching Phase 5's evidence rule). |
| **Creative Work** *(as an Achievement concept)* | An Achievement sub-type representing **recognition of** creative output (an art-competition win, an exhibition inclusion, a published piece) — distinguished from Portfolio's own "Creative Work" section, which holds the raw artefact itself; see "Relationship to ADR-0011" below for the precise boundary. |
| **Participation** | The lowest-weight Achievement sub-type — attended/took part, without a competitive result or formal recognition (e.g. "participated in the regional debate"). Kept as its own sub-type, not merged into Competition, because a Participation record deliberately carries no result field at all — conflating it with Competition would force every non-competitive activity to awkwardly claim a "did not place" result it never had. |
| **Portfolio Item** | Not an Achievement concept — Portfolio's own artefact wrapper (ADR-0011). Defined here only to state explicitly that Achievement does not use this term for anything of its own. |
| **Milestone** | Rejected as a distinct Achievement concept. Every candidate use of "milestone" (first achievement, a graduation-adjacent moment) is already covered by an existing concept elsewhere in the platform — Blueprint Snapshots already own "moment in the learner's journey" (ADR-0008 Part 3), and Sprint 12R's Growth Journey already owns "milestone" as a presentation-layer label over Snapshots. Introducing a second "Milestone" concept inside Achievement would create exactly the duplicated-terminology problem Sprint 12P's audit already found and fixed once. Achievement has no `milestone` field, type, or category. |

---

## Phase 3 — Ownership Matrix (frozen)

| Data | Owner |
|---|---|
| Awards | Achievement Domain |
| Certificates | Achievement Domain |
| Competition results | Achievement Domain |
| Leadership positions | Achievement Domain |
| Service hours / Community Service records | Achievement Domain |
| Innovation records | Achievement Domain |
| Creative-work **recognitions** (competition wins, exhibitions, publications) | Achievement Domain |
| School recognitions | Achievement Domain |
| Raw creative/digital **artefacts** (the poem, the code repo, the design file itself) | Learner Portfolio (unchanged from ADR-0011 — Achievement never stores the artefact, only the recognition of it, if any) |
| Learner's own reflection/Future Goals | Learner Portfolio (unchanged from ADR-0011) |
| Blueprint | Reads Achievement (summary only, exactly as it reads Compass/Career today) |
| Portfolio | Reads/composes Achievement (never stores a second copy) |
| Career Intelligence | Reads Achievement **summaries only** — never full records, never raw evidence |
| Report Cards | References Achievement only (e.g. a report card's co-curricular section may cite an Achievement, never restate or recompute one) |
| Parent Experience | Reads Achievement, via Blueprint/Portfolio only — never a direct read path of its own (matching ADR-0010 Part 8's one-directional discipline) |

**No duplicated ownership.** Every row above has exactly one owner; every reader is explicitly a reader, never a second writer.

### Relationship to ADR-0011 (explicit, partial supersession)

ADR-0011 Phase 3 provisionally assigned Projects, Innovation, Competitions, Leadership, Community Service, Certifications, Awards, and Recommendations directly to "Learner Portfolio," because no better-owning domain existed yet. **This ADR supersedes those specific rows**: for any of those categories that represents a *verifiable claim* (a certificate, a result, a role, a recognition), the canonical owner is now **Achievement Domain**, not Portfolio. Portfolio's role for these becomes **read/compose only** — exactly the same demotion Blueprint itself underwent for Compass/Career back in ADR-0005/0006 (Portfolio never computed these in the first place, so nothing about this changes any already-shipped code; it changes only which *future* domain owns the write path). ADR-0011's remaining rows — Creative Work (the artefact itself), Digital Artefacts, Reflection, Future Goals — are **unchanged and not superseded**: these remain genuinely Portfolio-native, since they are the learner's own authored content with no external verification claim attached. This is the precise reading of this sprint's own Phase 6 instruction: **"Portfolio is NOT Achievement storage. Portfolio composes Achievement. Portfolio owns nothing."**

---

## Phase 4 — Lifecycle (frozen; unnecessary states rejected, with reasoning)

**Frozen lifecycle**: `Draft → Verified → Published`, with `Rejected` and `Revoked` as terminal branches reachable from specific points, and `Archived` as a retention-only end state.

```
Draft ──(submitted for verification)──▶ Verified ──▶ Published ──▶ Archived
  │                                        │              │
  └──(verification fails)──▶ Rejected      └──(found false)──▶ Revoked
```

- **Draft**: required — an Achievement is entered (by a teacher, or a learner pending confirmation) before it carries any institutional weight. Never visible beyond its author until it moves to Verified.
- **Verified**: required — the core rule this whole domain exists to enforce (Phase 5, Phase 9): a claimed Achievement is checked against Evidence and/or a verifying party before it becomes real. No Achievement skips this state.
- **Published**: required — matches Portfolio's own publish-state discipline (ADR-0011 Phase 11) and Teacher Reflection's own Draft→Published precedent (Sprint 12O): verification alone doesn't mean "visible everywhere," publishing is a distinct, deliberate step.
- **Rejected**: required — a distinct terminal state from Revoked. A submission that never passed verification (insufficient evidence, unconfirmable claim) is a different fact from a previously-verified Achievement later found false — collapsing the two would lose the "was this ever real" history Phase 11's fraud-prevention goal needs.
- **Revoked**: required — Phase 11 explicitly names "fake certificates" as a risk to prevent; an Achievement domain with no revocation path cannot correct a verified-then-disproven record without deleting history, which Phase 9/RAS immutability discipline forbids. Revocation is a new state transition on the existing row, never a delete.
- **Archived**: required, but narrowly — the same "retention-policy-driven read-only state" ADR-0008 Part 2 already froze for Blueprint's own lifecycle (e.g., after a learner graduates or leaves). Archived does not mean false or lesser; it means "no longer actively updated, still permanently true."

**Rejected as unnecessary**: **Expired**. An expiry date (e.g., a certification valid through a specific date) is **data on the record, never a separate stored lifecycle state** — whether an Achievement is currently "expired" is a computed, presentation-time fact (`expiresAt < now()`), exactly the same discipline ADR-0004 already established for Attendance (derived facts are computed at read time, never persisted as a mutable status). Storing "Expired" as a state would require a background job to transition rows over time for no benefit a computed field doesn't already provide, and would create an update path to an otherwise-immutable Verified/Published record — a needless mutability risk for a fact that's already fully determined by data the row already holds.

---

## Phase 5 — Evidence Relationship (frozen, the central rule of this domain)

**Evidence → Achievement. Never Achievement → Evidence.**

An Achievement must never exist without at least one supporting Evidence reference (or, where the claim predates the Evidence system's own scope — e.g. an external certificate with a physical/scanned document as its basis — an equivalent verifying-artifact reference, itself never a second copy of Evidence's own confidence/lifecycle machinery). This is **stricter** than Portfolio's own evidence rule (ADR-0011 Phase 7, where a purely creative artefact may legitimately have no Evidence at all) — Achievement makes a factual, verifiable claim about the world ("this learner won this competition"), and the Educational Constitution's Article I ("Evidence is the only currency of truth") applies to that claim directly and without exception, unlike a Portfolio artefact which makes no verifiable claim about itself in the first place.

Achievement **references** Evidence (mirroring `learner_projections`' own `supporting_evidence_ids` pattern, exactly as ADR-0011 Phase 7 already established for Portfolio) — it never stores a duplicate of an Evidence row's payload, confidence score, or lifecycle state. Evidence remains the one place an observation's raw truth lives; Achievement is a curated, verified *conclusion* drawn from one or more such observations, never a second observation-store.

---

## Phase 6 — Portfolio Relationship (frozen forever)

**Portfolio is NOT Achievement storage. Portfolio composes Achievement. Portfolio owns nothing achievement-related.**

This is the exact architectural rule Blueprint already follows toward every domain it composes (ADR-0008 Part 5/Part 12 invariant 1: "Blueprint owns nothing... composes everything it displays; it originates nothing") — applied here one layer earlier, since Portfolio itself composes Achievement the same way Blueprint composes Portfolio (Phase 7, below). A future Portfolio implementation reads Achievement's already-verified, already-published records and presents them alongside Portfolio's own native artefacts (Creative Work files, Digital Artefacts, Reflection) — it never recomputes a verification decision, never stores a second "is this real" judgment, and never writes to Achievement's own tables.

---

## Phase 7 — Blueprint Relationship

**Summaries only, everywhere except the learner's own full Portfolio/Achievement surfaces.**

| Surface | Full achievement records? | Summary only? |
|---|---|---|
| Paper | No | Yes — a small count/highlight line, matching ADR-0011 Phase 9's paper discipline exactly (never dozens of entries printed) |
| Digital (Current Blueprint) | No | Yes — Blueprint's field budget for this is capped at a summary, exactly as Portfolio's own Blueprint relationship is capped (ADR-0011 Phase 4) |
| QR (future) | Yes, via the QR destination | The QR points to Portfolio's/Achievement's own full digital surface — never a duplicate rendering inside Blueprint itself (ADR-0007 §11's "never a shortcut to a duplicate rendering" rule, restated) |
| Historical Snapshot | No | Yes — a snapshot freezes whatever summary the Current Blueprint showed at that moment, exactly like every other Blueprint section (ADR-0008 Part 3); it never independently re-queries Achievement at snapshot-view time |
| Parent Portal | No | Yes — matching ADR-0010's own information-boundary discipline (concise, action-oriented, never a raw data dump) |
| University View *(future, not yet built)* | Yes — full, verified, published records | This is precisely the audience a verified Achievement record is for; full detail is appropriate and intended here, not a violation of the "summary only" rule above (that rule governs Blueprint's own field budget, not Achievement's own future full-detail surface) |
| Employer View *(future, not yet built)* | Yes — full, verified, published records, subject to the learner's own publish/visibility choice (Phase 10) | Same reasoning as University View |
| Teacher View | Yes, via Achievement's/Portfolio's own full surface (not embedded inside Blueprint's own section body) | Blueprint's own section stays summary-only for every audience, including Teacher — a teacher who needs full detail follows the link out, exactly as they already do for Compass/Career (ADR-0006 §3/§4) |

**Rule, restated once, permanently**: an individual Achievement record renders in exactly one place — its own (future) Achievement/Portfolio surface. Every other surface (Blueprint, paper, Parent Portal) shows a summary and a way to reach that one place. This is not a new pattern; it is Learning Compass and Career Intelligence's already-proven Blueprint treatment, applied a third time.

---

## Phase 8 — Categories (frozen; unnecessary categories rejected, with reasoning)

**Frozen, ten categories**: Academic, Leadership, Innovation, Community Service, Creative Arts, Sports, Entrepreneurship, Research, Technology, Other.

**Rejected, folded into an existing category, with reasoning**:
- **Citizenship** → folded into **Community Service**. In practice, every plausible Citizenship example (civic participation, student government beyond a named Leadership role, voter-education drives) is either already a Leadership role or already a service activity — a separate category would create a near-permanent ambiguous boundary with Community Service in almost every real submission, the exact kind of duplicated-classification risk this whole ADR series exists to avoid.
- **Environmental** → folded into **Community Service**. Environmental action (tree planting, clean-up drives, conservation projects) is, structurally, a service activity with an environmental focus — the category adds a classification axis (topic) that cuts across an existing one (activity type) rather than naming a genuinely distinct kind of achievement.
- **Culture** → folded into **Creative Arts**. Cultural performance and heritage work (traditional dance, music, storytelling) is creative expression in practice; a separate category would only ever differ from Creative Arts by the cultural-vs-contemporary framing of the content, not by anything the data model needs to treat differently.

`Other` is retained deliberately, as the one designed escape hatch — better an honest `Other` than a slow proliferation of narrow categories each covering a handful of real submissions, which is exactly the failure mode the three rejections above are pre-empting.

---

## Phase 9 — Verification Model (frozen)

Every Achievement record answers, permanently, as required fields, not optional ones:

- **Who recorded it?** — the entering actor (teacher, admin, or learner-submitted-pending-confirmation), attribution only, never an access gate (CLAUDE.md's `teacher_id` rule, applied identically here).
- **Who verified it?** — the verifying actor, required before the record can leave `Draft`. May be the same school actor for an internally-witnessed achievement (e.g. a teacher confirming a classroom leadership role) or a reference to an external verifying party's identity/document for an externally-issued one (e.g. a competition organizer's certificate) — the exact verifying-party data model is reserved for the first implementation sprint, not decided in full here; what is frozen is that this field is never empty for a `Verified` record.
- **Evidence?** — at least one reference, per Phase 5, never optional, never a duplicate copy.
- **School?** — required, exactly like every other Operating-Layer table (RAS §10 rule 9: "no table without a `school_id`").
- **Date?** — required (when the achievement occurred, distinct from `created_at`/when it was recorded — the two are frequently different and both matter for an accurate record).
- **Confidence?** — **not a numeric score**. Achievement does not import Evidence's own confidence-scoring machinery (Educational Constitution Article XI: a bare number is never neutral) — instead, confidence is expressed entirely through the lifecycle state itself (`Draft` = unconfirmed, `Verified`/`Published` = confirmed, `Rejected` = could not be confirmed). A future implementation must resist adding a parallel numeric confidence field to this domain; the state machine already carries that meaning.
- **Can it ever be revoked?** — yes, always, at any point after `Verified` (Phase 4) — a revocation is a new state transition recorded on the existing row (with its own revoked-by/revoked-reason/revoked-at fields, reserved for implementation), never a delete and never a silent status flip with no record of why.

---

## Phase 10 — Visibility Matrix (frozen)

| Audience | Draft | Verified (not yet published) | Published | Revoked |
|---|---|---|---|---|
| Teacher | Yes (own school) | Yes | Yes | Yes (with revocation reason visible) |
| Administrator | Yes (own school) | Yes | Yes | Yes |
| Learner (own record) | Yes (own submission) | Yes | Yes | Yes (with revocation reason visible — a learner is never left wondering why something disappeared) |
| Parent | No | No | Yes | Yes (shown as revoked, per ADR-0010 Part 6's "never expose internals" balanced against "never hide a real correction from a parent" — shown plainly, without internal verification-process detail) |
| University | No | No | Yes (only if learner has published/shared, per ADR-0011 Phase 11's publish-state rule, extended here identically) | No (a revoked claim is never shown to an external audience — it was never true) |
| Employer | No | No | Yes (same publish-gate as University) | No |

**Governing rule**: nothing is externally visible (University/Employer) before `Published`, and nothing revoked is ever shown externally at all — a revoked Achievement's existence is a school/parent/learner-internal fact, not something a university or employer ever needs to see disproven, since they were never shown the false claim in the first place under this rule.

---

## Phase 11 — Risks (documented, each tied to the specific rule that prevents it)

| Risk | Prevented by |
|---|---|
| **Fake certificates** | Phase 9's mandatory verification step and evidence requirement — no record reaches `Verified` without a verifying actor and Evidence/document reference |
| **Duplicate awards** | Phase 3's single-owner rule (Achievement Domain only) plus a future implementation's own uniqueness constraint (reserved, not decided here) on (learner, achievement type, date, issuing body) |
| **Two schools claiming the same achievement** | Achievement is keyed to one canonical learner identity and one `school_id` (Phase 9) — an achievement earned before a school transfer stays attributed to the school that verified it, mirroring `learner_promotions`' own existing transfer-history precedent, never silently reattributed |
| **Deleted history** | No delete path exists in this domain's frozen lifecycle (Phase 4) — only `Revoked`/`Archived`, both preserving the row forever, matching `learner_evidence`/`blueprint_snapshots`/`teacher_reflections`' own database-trigger-enforced immutability precedent |
| **Portfolio copying achievements** | Phase 6's frozen rule — Portfolio composes, never stores, a second copy |
| **Career inventing achievements** | Phase 3's explicit "Career reads summaries only" — Career Intelligence has no write path to Achievement and no mechanism to originate one |
| **AI hallucinating achievements** | Not applicable by design — no AI feature exists anywhere in this domain's frozen scope (Explicitly Forbidden list); every record's existence traces to a human-entered claim plus human/document verification, never a generated one |

---

## Phase 12 — Constitutional Compliance

- **Educational Constitution Article I** (Evidence is the only currency of truth) — Phase 5 makes this the strictest rule in the domain: no Achievement without Evidence, no exceptions.
- **Article II** (Missing evidence is never poor performance) — a learner with zero Achievements is never treated as deficient; this domain is purely additive, exactly like Portfolio (ADR-0011 Phase 2).
- **Article VI/IX** (AI explains, never invents; every recommendation traceable) — satisfied trivially, no AI feature is in scope.
- **Article XI** (a number without a name is not neutral) — Phase 9 explicitly rejects a numeric confidence field for this exact reason.
- **RAS §3** (Canonical Domain Standards) — Achievement is declared here as one new canonical domain, one repository/service reserved for implementation, confirmed non-duplicative by Phase 1's audit.
- **RAS §9** (Intelligence Standards) — Achievement is an Operating-Layer domain (a factual record), not an Intelligence-Layer one; it does not compute risk, confidence scores, or predictions about the learner — Career Intelligence remains the only domain permitted to interpret Achievement data into orientation-level meaning (Phase 3).
- **RAS §10 rules 7–9** — no duplicated business logic (Phase 3/6), no cross-domain ownership (Phase 3's explicit exclusions), every table carries `school_id` (Phase 9).
- **ADR-0003/ADR-0004** (Attendance domain/integration principles) — Phase 4's "Expired is computed, never stored" rule is a direct, named extension of ADR-0004's own derived-data discipline.
- **ADR-0005 §3** — Achievement's ownership matrix (Phase 3) follows the identical one-section-one-owner discipline ADR-0005 established for Blueprint.
- **ADR-0010** — Phase 10's visibility matrix and Phase 7's Parent Portal row both extend, not depart from, ADR-0010's existing information-boundary and one-directional-read discipline.
- **ADR-0011** — extended and, for the specific rows named in "Relationship to ADR-0011" above, **explicitly, partially superseded** — the supersession is named, scoped, and reasoned, never a silent override.

**Zero unresolved conflicts.** The one deliberate supersession is documented in full above, per RAS §12's own Evolution Policy (a later ADR may supersede an earlier one's specific, named provisions when a new canonical domain is created to fill a gap the earlier ADR could only provisionally address).

---

## Verification Against Mission's Checklist

- Achievement has one canonical definition — Phase 2.
- Portfolio owns nothing achievement-related — Phase 6, and the explicit ADR-0011 supersession above.
- Blueprint owns nothing achievement-related — Phase 7's summary-only rule, restating ADR-0008's existing "Blueprint owns nothing" invariant.
- Every achievement has exactly one owner — Phase 3.
- Evidence remains the only source of truth — Phase 5, the domain's central, non-negotiable rule.
- No duplicated ownership — Phase 3/6/7, confirmed against every adjacent domain including the one explicit, reasoned exception to ADR-0011.
- No architectural conflicts — Phase 12.
- Constitution compliant — Phase 12.
- RAS compliant — Phase 12.

---

## Stop Condition

This ADR, `sprint-12u-achievement-domain.md`, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** Do not create tables, migrations, repositories, services, routes, UI, PDFs, uploads, certificates, badges, or QR mechanisms, and do not modify Blueprint, Portfolio, Parent Portal, Career, Compass, Evidence, Report Cards, Teacher Reflection, or Snapshots. Wait for explicit approval before the first Achievement implementation sprint.
