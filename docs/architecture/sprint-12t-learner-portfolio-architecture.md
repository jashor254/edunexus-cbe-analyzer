# Sprint 12T — Learner Portfolio Architecture

**Status: architecture and documentation only, per explicit mission instruction.** No table, migration, repository, service, API, route, UI, storage bucket, upload system, PDF, QR generation, or AI feature was created or modified in producing this document — confirmed: this document, `adr-0011-learner-portfolio-architecture.md`, and the implementation-log entry are the only files touched.

---

## Phase 1 — Audit First (mandatory)

Searched the entire codebase for every term the mission named before proposing anything.

**Finding: a "Portfolio" already exists — and it is a different domain entirely.** `lib/academy/portfolio.ts` (`getPortfolioData`), `app/teacher/academy/portfolio/page.tsx`, and `components/academy/PortfolioView.tsx` implement **EduNexus Academy's teacher professional-development badge system** — a *teacher's* completed training modules, missions, reflections, lesson-plan/scheme-of-work tool usage counts, and earned badges (e.g. "Evidence Champion," "Platform Pioneer," "CBC Judge"). Confirmed by reading `PortfolioData`'s full type and `getPortfolioData()`'s implementation: every field is teacher-scoped (`teacher: { id, full_name, school, ... }`, `phaseStats`, `missionStats`, `reflectionStats`, `toolUsage`, `badges`), with zero learner-facing achievement/project/certificate concept anywhere in the module.

**Can it become the canonical Learner Portfolio domain? No** — it answers a completely different question ("how is this teacher progressing through Academy training") from the one this ADR needs answered ("what has this learner built or achieved"). Reusing, renaming, or merging it would conflate two unrelated audiences and two unrelated purposes under one name — exactly the kind of ownership confusion this whole ADR series exists to prevent. **This is documented as a naming-collision risk, not an ownership decision**: ADR-0011 explicitly requires the future Learner Portfolio implementation to use an unambiguous module path (e.g. `lib/learnerPortfolio/`, never `lib/academy/portfolio.ts` or anything nested under `lib/academy/`) and to disambiguate "Learner Portfolio" from "Academy (Teacher) Portfolio" on first mention in any future document.

Every other searched term returned no existing domain:

- **Projects, Project Showcase, Innovation, Competitions, Certificates, Awards, Achievements, Leadership, Clubs, Community Service, Talent, Gallery** — no matching table, repository, or module found anywhere in `lib/`, `app/`, or `supabase/migrations/`.
- **Evidence uploads, File uploads, Media library** — no learner-facing upload or storage-bucket infrastructure exists. The only file-storage code found, `scripts/upload-reports-storage.ts`, is an internal pipeline script that uploads already-generated report PDFs to storage — not a user-facing upload feature, and not reusable as Portfolio's future media layer without its own design pass.

**Conclusion**: no existing module owns any Learner Portfolio concept. A new canonical domain is the correct outcome — not a default assumed going in, but confirmed by exhaustive search before ADR-0011 froze anything. This mirrors exactly the discipline Sprint 12K's own storage audit applied before creating `blueprint_snapshots`, and the discipline Sprint 12S's audit applied before finding (but explicitly not reusing) five non-canonical parent-action generators.

---

## Phases 2–14

Every remaining phase (Definition, Canonical Ownership, Blueprint/Report Card/Career/Evidence relationships, Philosophy, Paper vs Digital, Portfolio Sections, Visibility Matrix, Future Extensions, Risks, Constitutional Compliance) is frozen in full in `adr-0011-learner-portfolio-architecture.md` — this document does not restate that content, per the same "one frozen source, not two documents saying the same thing differently" discipline every prior ADR/sprint-doc pair in this series has followed (e.g. ADR-0010/sprint-12p, ADR-0009/sprint-12i).

The one addition beyond ADR-0011's own text: the user's recommended principle — **"Every learner graduates with a portfolio, not just a transcript"** — was adopted verbatim as the frozen closing statement of ADR-0011's Phase 8 (Portfolio Philosophy), exactly as proposed, since it correctly names the thing every other phase in this ADR technically protects: Portfolio is not a peripheral feature, it is the artifact that makes the platform's evidence-first, growth-oriented philosophy true in practice for the one thing a transcript can never show — what a learner actually built.

---

## Required Verification — evidence

- **Portfolio has exactly one permanent definition**: ADR-0011 Phase 2.
- **Every section has one canonical owner**: ADR-0011 Phase 3 — fifteen sections, each attributed to exactly one owner (fourteen to Learner Portfolio itself, Identity referenced from Core).
- **No duplicated ownership exists**: confirmed by Phase 1's audit (no pre-existing domain to collide with) and ADR-0011 Phase 3/7's explicit exclusion of every adjacent domain's own concepts (scores, evidence, career predictions, teacher narrative).
- **Blueprint relationship is frozen**: ADR-0011 Phase 4 — one-directional, summary-plus-link only, permanent.
- **Report Card relationship is frozen**: ADR-0011 Phase 5 — two non-competing purposes, neither references the other's authority.
- **Career relationship is frozen**: ADR-0011 Phase 6 — Career may read Portfolio, Portfolio never predicts.
- **Evidence relationship is frozen**: ADR-0011 Phase 7 — reference, never copy, mirroring `learner_projections`' own existing pattern.
- **Paper vs Digital strategy is frozen**: ADR-0011 Phase 9 — small paper summary, full digital, QR as the bridge, never dozens of printed pages.
- **Visibility matrix is complete**: ADR-0011 Phase 11 — every section classified across all six named audiences, with a single governing publish-state rule rather than per-section special cases.
- **Constitutional compliance is confirmed**: ADR-0011 Phase 14 — cross-referenced against the Educational Constitution, RAS §3/§10, and ADR-0004 through ADR-0010, zero conflicts found.
- **No implementation occurred**: confirmed — this sprint's only outputs are this document, ADR-0011, and the implementation-log entry below.

---

## Stop Condition

Per explicit mission instruction: the ADR, this Sprint 12T architecture document, and the implementation-log entry are complete. **Stop here.** Do not begin implementation of any kind. Wait for explicit approval before the first Learner Portfolio implementation sprint.
