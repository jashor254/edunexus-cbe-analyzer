# Sprint 12U — Learner Achievement Domain (Canonical Achievement Engine)

**Status: architecture and documentation only, per explicit mission instruction.** No table, migration, repository, service, route, UI, PDF, upload, certificate, badge, or QR mechanism was created or modified, and no existing Blueprint/Portfolio/Parent Portal/Career/Compass/Evidence/Report Card/Teacher Reflection/Snapshot code was touched — confirmed: this document, `adr-0012-learner-achievement-domain.md`, and the implementation-log entry are the only files touched.

---

## Phase 1 — Audit First (mandatory, implementations read, not filenames trusted)

Searched the entire codebase for every term the mission named, then **read** (not assumed from the filename) every plausible hit:

- `lib/academy/portfolio.ts` / `PortfolioView.tsx` — read in full. Confirmed, again, to be EduNexus Academy's **teacher** professional-development badge system (badges computed in-memory from a teacher's training/tool-usage counts, never persisted). Already flagged once in ADR-0011's own audit; reconfirmed here rather than assumed still true.
- `app/student/groups/*` / `app/dashboard/groups/*` — read the `MyGroup` type and its queries. Confirmed to be gamified, subject-based **study groups** (points/rank/streak), a Compass-adjacent engagement feature with no achievement, award, or certificate concept anywhere in it.
- `components/organizations/sandbox-badge.tsx` — read in full. A static UI pill labeling sandbox-mode environments, not a data concept.
- `lib/repositories/academy.repository.ts` — searched for any `badge` query. None exists — Academy's badges are computed, not stored, confirming Academy has no achievement storage of any kind.
- Every remaining searched term (award, certificate, competition, innovation, science fair, club, leadership, captain, community service, volunteer, talent, music, sports, badge, recognition, medal, prize, activity, co-curricular) — returned only incidental word matches (marketing copy, a CBC subject named "Creative Arts & Sports," demo mock data, PDF styling constant names). No migration defines an achievements/awards/certificates/competitions/leadership table.

**Answer to Phase 1's explicit question**: neither one canonical system nor several unrelated ones exist — **zero** achievement systems exist. The two adjacent near-hits (Academy Teacher Portfolio, Student Study Groups) are genuinely unrelated domains that merely share vocabulary, not partial or competing implementations of this one. A new canonical domain is the correct, verified — not assumed — outcome.

---

## Phases 2–12

Every remaining phase (Domain Definitions, Ownership Matrix, Lifecycle, Evidence Relationship, Portfolio Relationship, Blueprint Relationship, Categories, Verification Model, Visibility Matrix, Risks, Constitutional Compliance) is frozen in full in `adr-0012-learner-achievement-domain.md` — this document does not restate that content, per the same one-frozen-source discipline every ADR/sprint-doc pair in this series has followed since ADR-0009/sprint-12i.

Three decisions worth calling out explicitly here, since they involved real judgment rather than transcription of the mission's own examples:

1. **Expired was rejected as a lifecycle state** (ADR-0012 Phase 4) — it is data on a record (an expiry date), computed at read time, never a stored, mutable status. Storing it as a state would need a background job and would reopen an otherwise-immutable `Verified`/`Published` record for no benefit a computed field doesn't already provide — the same derived-vs-stored discipline ADR-0004 already established for Attendance, applied here for the first time to a new domain.
2. **Milestone was rejected entirely** as an Achievement concept (ADR-0012 Phase 2) — every plausible use of the word is already owned elsewhere (Blueprint Snapshots for "a frozen moment," Sprint 12R's Growth Journey for "a labeled milestone view over Snapshots"). Adding a second "Milestone" inside Achievement would recreate the exact duplicated-terminology problem Sprint 12P's Parent Experience audit already found and fixed once.
3. **Citizenship, Environmental, and Culture were rejected as separate categories** (ADR-0012 Phase 8), each folded into an existing one (Community Service, Community Service, and Creative Arts respectively) with the specific reasoning that each would only ever differ from its parent category by topic/framing, never by anything the data model needs to treat differently — better one honest `Other` escape hatch than a slow proliferation of categories each covering a handful of real submissions.

**One explicit, named, reasoned partial supersession of ADR-0011** was required and is fully documented in ADR-0012's own "Relationship to ADR-0011" section: ADR-0011 Phase 3 provisionally assigned Competitions/Leadership/Community Service/Innovation/Certifications/Awards/Recommendations directly to Learner Portfolio, because no better-owning domain existed at the time. This ADR moves ownership of the *verifiable-claim* subset of those to Achievement Domain — Portfolio's role for them becomes read/compose only, exactly the same demotion Blueprint itself underwent for Compass/Career in ADR-0005/0006. ADR-0011's remaining rows (the raw Creative Work artefact, Digital Artefacts, Reflection, Future Goals) are unaffected — these have no external verification claim attached and remain genuinely Portfolio-native. This supersession is scoped, named, and reasoned per RAS §12's Evolution Policy — never a silent override of a decision frozen one sprint ago.

---

## Required Verification — evidence

- **Achievement has one canonical definition**: ADR-0012 Phase 2.
- **Portfolio owns nothing achievement-related**: ADR-0012 Phase 6, plus the explicit, scoped ADR-0011 supersession.
- **Blueprint owns nothing achievement-related**: ADR-0012 Phase 7 — summary-only everywhere except Achievement's own future full-detail surface.
- **Every achievement has exactly one owner**: ADR-0012 Phase 3 — one ownership matrix, no exceptions beyond the reasoned Portfolio/Career/Report Card read-only rows.
- **Evidence remains the only source of truth**: ADR-0012 Phase 5 — the domain's central, non-negotiable rule, stricter even than Portfolio's own Evidence rule.
- **No duplicated ownership**: confirmed by Phase 1's audit (nothing pre-existing to collide with) and Phase 3/6's explicit exclusions.
- **No architectural conflicts**: ADR-0012 Phase 12.
- **Constitution compliant**: ADR-0012 Phase 12.
- **RAS compliant**: ADR-0012 Phase 12.

---

## Stop Condition

Per explicit mission instruction: the ADR, this Sprint 12U architecture document, and the implementation-log entry are complete. **Stop here.** Do not begin implementation of any kind. Wait for explicit approval before the first Achievement implementation sprint.
