# ADR-0011 — Learner Portfolio Architecture

**Status: APPROVED (2026-07-17, Sprint 12V).** Design-freeze document; the first Learner Portfolio implementation sprint (Sprint 12V) now builds against this frozen design. Note: Sprint 12V's own Phase 5 category list drops "Innovation" from Portfolio, per ADR-0012's explicit supersession (Innovation records are Achievement-owned) — see ADR-0012's "Relationship to ADR-0011" section.

**Precedes**: the first Learner Portfolio implementation sprint (not yet scheduled — explicit approval required, per Stop Condition).
**Supersedes**: nothing. **Contradicts no prior ADR** — extends ADR-0005/0006 (Blueprint structure/meaning — Portfolio is the section Blueprint references, never absorbs), ADR-0007/0009 (layout, presentation layers, QR-to-deep-experience philosophy — Portfolio is this pattern's next application), ADR-0008 (lifecycle/snapshot discipline — Portfolio artefacts get their own curation lifecycle, distinct from Blueprint's), ADR-0010 (Parent Experience — Portfolio becomes a future audience-visible surface under the same visibility discipline).
**Depends on / extends**: `adr-0005-learner-blueprint-architecture.md` §3 (ownership), `adr-0006-blueprint-educational-experience.md` (Evidence→Meaning→Action pattern), `adr-0007-blueprint-layout-and-experience.md` §11 (QR philosophy), `adr-0008-blueprint-lifecycle-and-rendering.md` Part 3/Part 9 (Snapshot precedent, traceability), `adr-0009-blueprint-presentation-architecture.md` (presentation-layer discipline), `adr-0010-parent-experience-architecture.md` (visibility-matrix pattern, terminology discipline), `reference-architecture-specification.md` §3 (Canonical Domain Standards), §10 rules 7–8 (no duplicated business logic, no cross-domain ownership), Educational Constitution.

---

## Why This ADR Exists

EduNexus can now answer "who is this learner becoming" (Blueprint), "how has this learner grown" (Growth Timeline), and "what should the parent do next" (Parent Action Centre) — all built entirely from marks, attendance, and teacher narrative. None of that captures the thing a learner actually *makes*: a science-fair project, a piece of writing, a leadership role, a competition entry, a certificate earned outside the classroom. Without a frozen answer to "where does that live," a future implementation sprint would either bolt it onto Blueprint (violating ADR-0008's "Blueprint owns nothing, composes everything" discipline the moment Portfolio content needed its own lifecycle) or invent a second, uncoordinated system — exactly the failure mode this whole ADR series exists to prevent, and the one Sprint 12S's audit already found six live instances of for a much smaller feature (parent actions). This ADR freezes Portfolio's definition, ownership, and every cross-domain relationship once, before a single table exists.

---

## Core Question

**A learner's transcript records what they scored. What records what they *built*, and where does that live so it never collapses into — or duplicates — Blueprint, Report Cards, Evidence, or Career Intelligence?**

**Answer**: Learner Portfolio is a new, permanent canonical domain — the learner's own curated collection of demonstrated work, achievements, and creations — that Blueprint *references* but never contains, that Report Cards never touch, that Career Intelligence may *read* but never predicts from without evidence, and that draws its underlying facts from Evidence without duplicating a single one of them. **Every learner graduates with a portfolio, not just a transcript.**

---

## Phase 1 — Audit (mandatory, done first)

Searched the entire codebase for every term the mission named, before proposing anything.

**A real, existing "Portfolio" was found — and it is not this Portfolio.** `lib/academy/portfolio.ts`, `app/teacher/academy/portfolio/page.tsx`, and `components/academy/PortfolioView.tsx` implement **EduNexus Academy's teacher professional-development badge system** — `PortfolioData` aggregates a *teacher's* completed training modules, missions, reflections, lesson-plan/scheme-of-work tool usage, and earned badges (e.g. "Evidence Champion," "Platform Pioneer"). This is a teacher-facing gamification surface for the Academy training product, built and shipped independently (per the platform's own history) — it has no learner-facing concept, no achievement/project/certificate data, and no relationship whatsoever to a learner's demonstrated work.

**Verdict: this cannot become the canonical Learner Portfolio domain, and must not be renamed, merged, or reused for it.** Two unrelated concepts already share the English word "portfolio" in this codebase. This is a **naming-collision risk, not an ownership decision** — the first concrete rule this ADR sets is that the new domain must never be implemented under `lib/academy/portfolio.ts` or any path that could be mistaken for Academy's teacher badge system. A future implementation sprint must choose an unambiguous module path (e.g. `lib/learnerPortfolio/`) and every document/comment referencing "Portfolio" from this point forward must disambiguate **Learner Portfolio** from **Academy (Teacher) Portfolio** on first mention.

Every other searched term (Projects, Project Showcase, Innovation, Competitions, Certificates, Awards, Achievements, Leadership, Clubs, Community Service, Talent, Gallery, Evidence uploads, File uploads, Media library) returned **no matching domain, table, or module** — confirmed by searching migrations for any `achievements`/`awards`/`certificates`/`projects` table (none exist) and by searching for storage-bucket/upload infrastructure (none exists for learner-facing content — the one hit, `scripts/upload-reports-storage.ts`, is an internal pipeline script for already-generated report PDFs, not a user-facing upload feature). **No existing module owns any Portfolio concept for learners.** Per the mission's own instruction ("never invent a new domain if one already exists"), this confirms a new domain is the correct, non-duplicative outcome — not a default assumed in advance.

---

## Phase 2 — Definition (frozen)

**A Learner Portfolio is the learner's own curated collection of demonstrated work, achievements, and creations — evidence-backed, learner-and-teacher-curated, never a score, a comment, or an analytic.**

Distinguished permanently from every adjacent domain:

| Domain | Answers | Portfolio is not this |
|---|---|---|
| Report Card | "What did the learner score this term?" | Portfolio never contains a mark, grade, or ranking |
| Learner Blueprint | "Who is this learner becoming, evidence-grounded, right now?" | Portfolio is one thing Blueprint *references*, never computes or contains |
| Learning Compass | "What is the learner working on and being supported to improve?" | Portfolio is not active tutoring/practice content |
| Career Intelligence | "Where might evidenced strengths point, as orientation?" | Portfolio never predicts a career; Career Intelligence may read Portfolio, never the reverse |
| Teacher Reflection | "What does the teacher who knows this learner want understood beyond the marks?" | Portfolio is the learner's own artefacts, not a teacher's narrative about the learner (though a teacher may curate/endorse) |
| Evidence | "What raw observation was recorded, when, by whom, at what confidence?" | Portfolio never stores a second copy of an observation — see Phase 7 |
| Behaviour *(reserved, not yet built)* | Conduct/discipline records | Portfolio is never a behaviour or discipline record, in either direction |

Portfolio is not marks, not attendance, not comments, not analytics. It is the learner's demonstrated work, achievements, creations, and growth artefacts.

---

## Phase 3 — Canonical Ownership (frozen)

One ownership matrix, one owner per section, no exceptions:

| Section | Owner |
|---|---|
| Identity | Core (Learner Identity — Portfolio references it, never re-declares it, exactly as Blueprint already does) |
| Projects | Learner Portfolio |
| Innovation | Learner Portfolio |
| Competitions | Learner Portfolio |
| Leadership | Learner Portfolio |
| Community Service | Learner Portfolio |
| Creative Work | Learner Portfolio |
| Research | Learner Portfolio |
| Certifications | Learner Portfolio |
| Awards | Learner Portfolio |
| Skills Demonstrations | Learner Portfolio |
| Digital Artefacts | Learner Portfolio |
| Recommendations | Learner Portfolio (the artefact itself — e.g. a teacher/mentor endorsement text attached to an entry); the *authoring* of a Teacher Reflection specifically remains Teacher Reflection's own domain, never re-implemented inside Portfolio |
| Reflection *(the learner's own reflection on a Portfolio entry)* | Learner Portfolio — distinct from, and never a duplicate of, Teacher Reflection (a different author, a different subject: the learner reflecting on their own work, not a teacher reflecting on the learner) |
| Future Goals | Learner Portfolio |

**Portfolio owns only Portfolio.** It does not own Identity (references Core's), does not own scores (Report Cards'), does not own evidence confidence/lifecycle (Evidence's), does not own career predictions (Career Intelligence's), and does not own teacher narrative (Teacher Reflection's). Every section above is a *Portfolio-native artefact type* — content the learner or a curating teacher added to the Portfolio itself, never a second computation or a second copy of another domain's output.

---

## Phase 4 — Relationship With Blueprint (frozen, permanent)

```
Blueprint
   references
Portfolio
```

**Portfolio never lives inside Blueprint.** Blueprint contains exactly one Portfolio-related field set: a **Portfolio Summary** (a small, fixed set of counts/highlights — e.g. "3 Projects, 1 Competition, 2 Certifications" — composed the same "ask, never compute" way every other Blueprint section already is, per ADR-0008 Part 5) plus either a **QR** (once QR exists, ADR-0007 §11) or a **"View Portfolio"** link out to Portfolio's own surface. Blueprint never duplicates a Portfolio entry's content, never re-renders a project description, never recomputes an achievement count independently of Portfolio's own canonical count. This mirrors Learning Compass and Career Intelligence's existing Blueprint treatment exactly (ADR-0006 §3/§4: one concise snapshot plus a QR/link outward, never the full experience) — Portfolio is not a new pattern, it is this pattern's next, already-proven application.

---

## Phase 5 — Relationship With Report Cards (frozen)

**Portfolio ≠ Report Card.** Report Cards answer "what did the learner score?" — official, term-scoped, immutable once published (ADR-0008 Part 3's existing frozen definition, untouched by this ADR). Portfolio answers "what has the learner built or achieved?" — ongoing, learner-paced, never term-locked, never a scored artefact. Neither may reference the other's authority: a Portfolio entry is never graded, ranked, or averaged into a Report Card figure, and a Report Card never lists Portfolio entries as if they were assessed work. The two may sit side by side in a future presentation (e.g. a school's own printed profile), but they remain two permanently distinct artifacts, exactly as Report Card / Blueprint Snapshot / Current Blueprint already do (ADR-0008 Part 3) — this ADR adds Portfolio as a fourth non-competing artifact to that same discipline, not a competitor to any of the existing three.

---

## Phase 6 — Relationship With Career Intelligence (frozen)

**Career Intelligence may consume Portfolio. Portfolio never predicts careers.** A future Career Intelligence enhancement could read a learner's Portfolio (e.g. "this learner has three Innovation entries and one Competition award in robotics") as additional evidence input — but that reading, interpreting, and any resulting orientation-level judgment remains entirely Career Intelligence's own canonical computation (`lib/career/capabilityMatchEngine.ts`, unchanged by this ADR), never something Portfolio computes or asserts about itself. Portfolio simply preserves evidence of what was built; Career interprets it. This is a strict one-directional read relationship — Portfolio never calls into Career Intelligence, never stores a career-relevance score, never tags an entry with a predicted pathway.

---

## Phase 7 — Relationship With Evidence (frozen, the most important boundary in this ADR)

**Evidence remains the constitutional truth (Educational Constitution Article I). Portfolio owns curated artefacts. Evidence owns raw observations.**

- **Evidence** (`learner_evidence`, `lib/intelligence/evidence.ts`) records *what happened*, as a raw, confidence-scored, source-attributed observation — a teacher remark, an assessment result, a Compass session outcome. It is append-only, corrected only by retraction-plus-new-evidence (CLAUDE.md, unchanged).
- **Portfolio** records *what the learner chose to showcase* — a curated, selected, presented artefact (a project write-up, a competition certificate, a leadership role description) that may *reference* one or more Evidence rows as its supporting basis, but never stores a second copy of an Evidence row's payload, confidence, or lifecycle state.

**Portfolio selects. Evidence records. Never duplicate.** A future implementation must implement this as a reference (e.g. a Portfolio entry optionally links to `supporting_evidence_ids`, mirroring `learner_projections`' own existing traceability pattern, ADR-0008 Part 9) — never as a copy-in of Evidence's own fields. Not every Portfolio entry needs Evidence backing at all (a learner-submitted creative-writing piece may have no corresponding Evidence row and is still a legitimate Portfolio artefact) — but where Evidence does exist for a claim a Portfolio entry makes, the entry references it rather than restating it.

---

## Phase 8 — Portfolio Philosophy (frozen)

**Why should every learner have a Portfolio?** Because a transcript tells you what a learner scored under exam conditions; it says nothing about what they chose to build, lead, or create when given room to. A CBC/CBE system explicitly values competency and demonstrated capability over exam performance alone — Portfolio is the artifact that actually honors that value, rather than leaving it as a stated principle with no evidentiary home.

**Why should employers care?** A transcript proves competence on paper; a Portfolio proves initiative, sustained effort, and real output — the things a transcript structurally cannot show.

**Why should universities care?** Competitive admissions already ask for exactly this (personal statements, extracurricular records, project portfolios) through informal, unverified channels; an evidence-backed, school-curated Portfolio is a more trustworthy version of what universities already try to assess badly today.

**Why should parents care?** A Portfolio is the most *human* record of their child's growth outside the report card — the thing a parent can point to and feel proud of independent of a grade, directly continuing ADR-0010's own Parent Experience mandate ("strengthen partnership... celebrate their child's learning journey").

**Why should the learner care?** Because it is theirs — a lifelong artifact that outlives any single school, term, or grade, and the one part of their EduNexus record that is fundamentally about *them*, not about being measured.

**The frozen principle**: **Every learner graduates with a portfolio, not just a transcript.** This is the single sentence that distinguishes EduNexus from a system that only ever preserves grades — Portfolio is not a nice-to-have feature, it is the artifact that makes the platform's stated educational philosophy (evidence-first, growth-oriented, never reductive) true in practice rather than only in the Constitution's prose.

---

## Phase 9 — Paper vs Digital (frozen, permanent)

Extending ADR-0008 Part 8's already-frozen "Paper answers what matters today; digital answers what else should I explore" philosophy:

- **Paper**: a very small summary only — the same Portfolio Summary counts/highlights Blueprint itself carries (Phase 4), never more than a few lines. A printed page must never attempt to reproduce Portfolio entries in full.
- **Digital**: everything — every entry, every artefact, every reflection, at full depth. Digital is Portfolio's native, primary surface.
- **QR**: the full Portfolio, once QR exists (ADR-0007 §11's reserved future mechanism) — the paper summary's only job is to point somewhere, never to substitute for the real thing.

**Never print dozens of pages.** A Portfolio with fifty entries still produces a three-line paper summary and one QR code — this is a hard, permanent constraint, not a size-dependent judgment call for a future sprint to make differently per learner.

---

## Phase 10 — Portfolio Sections (frozen field list; no implementation)

Every section from Phase 3's ownership matrix, specified along the same ten dimensions:

| Section | Purpose | Audience | Owner | Freshness | Visibility | QR? | Max Size | Snapshot? | Evidence Source | Future Extensions |
|---|---|---|---|---|---|---|---|---|---|---|
| Projects | Demonstrate applied work | Teacher/Parent/Learner/University/Employer | Learner Portfolio | Live (learner-paced) | Full digital; summary on paper | Yes (future) | 1 page/entry digital; 1 line/entry paper | Yes (on curation/publish, mirroring Blueprint Snapshot's own trigger discipline) | Optional evidence reference | Hackathons, AI Projects |
| Innovation | Demonstrate original ideas/inventions | Same as Projects | Learner Portfolio | Live | Same | Yes (future) | Same | Yes | Optional | Patents, Open-source |
| Competitions | Record participation/results in external competitions | Teacher/Parent/Learner/University | Learner Portfolio | Live | Full digital; headline result on paper | Yes (future) | 1 line/entry paper | Yes | Optional (certificate/result reference) | Science fairs, Innovation challenges |
| Leadership | Record roles held (prefect, club lead, team captain) | Same | Learner Portfolio | Live | Full digital; role titles on paper | Yes (future) | 1 line/role paper | Yes | Optional | — |
| Community Service | Record service hours/activities | Teacher/Parent/Learner/University | Learner Portfolio | Live | Full digital; summary on paper | Yes (future) | Same | Yes | Optional | Volunteer work |
| Creative Work | Showcase writing, art, music, design | Teacher/Parent/Learner/University/Employer | Learner Portfolio | Live | Full digital only (never paper-reproduced) | Yes (future) | N/A digital-only | Yes | Optional | Art exhibitions, Music |
| Research | Record research projects/findings | Teacher/Parent/Learner/University | Learner Portfolio | Live | Full digital; title on paper | Yes (future) | 1 line/entry paper | Yes | Optional | Research papers, Publications |
| Certifications | Record external/micro-certifications earned | Teacher/Parent/Learner/University/Employer | Learner Portfolio | Live | Full digital; badge list on paper | Yes (future) | 1 line/cert paper | Yes | Optional (certificate reference) | Micro-certifications |
| Awards | Record honors/awards received | Same as Certifications | Learner Portfolio | Live | Same | Yes (future) | Same | Yes | Optional | — |
| Skills Demonstrations | Showcase a specific demonstrated skill | Teacher/Parent/Learner/Employer | Learner Portfolio | Live | Full digital only | Yes (future) | N/A | Yes | Optional | AI Projects |
| Digital Artefacts | Host links/files representing work (code repos, videos, sites) | Same as Creative Work | Learner Portfolio | Live | Full digital only, link-out never embedded storage this ADR decides | Yes (future) | N/A | Yes | Optional | Open-source contributions |
| Recommendations | Endorsement text attached to an entry (mentor/teacher) | Teacher/Parent/Learner/University/Employer | Learner Portfolio | Live | Full digital; never on paper (Phase 9 size discipline) | No | N/A | Yes | N/A (authored directly in Portfolio, not evidence-sourced) | — |
| Reflection | Learner's own reflection on an entry | Teacher/Parent/Learner | Learner Portfolio | Live | Full digital; never on paper | No | N/A | Yes | N/A | — |
| Future Goals | Learner-stated aspirations tied to Portfolio direction | Learner/Parent (Teacher optional) | Learner Portfolio | Live | Full digital; never on paper | No | N/A | Yes | N/A | — |

**Snapshot** column: every section snapshots on the same trigger discipline Blueprint Snapshots already established (ADR-0008 Part 3) — a Portfolio-specific snapshot trigger set (e.g. curation/publish moments) is reserved for the first implementation sprint to define precisely, not decided in full here; what is frozen now is that Portfolio entries **do** get their own immutable historical record, never silently overwritten, matching every other canonical domain's now-established discipline in this codebase.

---

## Phase 11 — Visibility Matrix (frozen)

| Section | Teacher | Parent | Learner | University | Employer | Government |
|---|---|---|---|---|---|---|
| Projects | Yes | Yes | Yes (own) | Yes (if published) | Yes (if published) | Reserved, undecided |
| Innovation | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Competitions | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Leadership | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Community Service | Yes | Yes | Yes | Yes (if published) | Partial (summary only) | Reserved |
| Creative Work | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Research | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Certifications | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Awards | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Skills Demonstrations | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Digital Artefacts | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Recommendations | Yes | Yes | Yes | Yes (if published) | Yes (if published) | Reserved |
| Reflection (learner's own) | Yes | Partial (learner-controlled) | Yes | No | No | No |
| Future Goals | Partial (if shared) | Partial (if shared) | Yes | No | No | No |

**Governing rule (frozen)**: every entry has a learner-and-school-controlled **publish** state — "if published" above means the learner (with school curation, exact workflow reserved for implementation) has chosen to expose that specific entry beyond the school/parent audience; nothing is University/Employer-visible by default. Reflection and Future Goals are never external-audience-visible under any circumstance this ADR decides — they are the learner's private working space, visible externally only via the learner's own explicit future choice, not a default. Government is reserved, undecided, exactly matching ADR-0008 Part 7's own precedent for that audience (no visibility rules decided until compliance requirements are known). No rule here duplicates or contradicts ADR-0010 Part 3's Blueprint visibility matrix — Portfolio's matrix governs Portfolio's own surface, referenced but not reproduced by Blueprint's Portfolio Summary.

---

## Phase 12 — Future Extensions (reserved, not designed, not implemented)

Named as future slots only: Internships, Entrepreneurship, Patents, Publications, Volunteer work, Open-source contributions, Hackathons, Science fairs, Art exhibitions, Music, Sports, Innovation challenges, Micro-certifications, AI projects, Research papers. Each, when built, becomes either a new Portfolio section (following Phase 10's ten-dimension specification pattern) or a sub-type within an existing section (e.g. Hackathons under Competitions, Publications under Research) — that classification decision is explicitly deferred to whichever future sprint actually proposes each one, not decided here.

---

## Phase 13 — Risks (documented, not mitigated by implementation — mitigated by this ADR's own constraints)

| Risk | How this ADR prevents it |
|---|---|
| **Portfolio becoming another Blueprint** | Phase 4 freezes Blueprint-references-Portfolio as one-directional and permanent; Blueprint's own field budget for Portfolio is capped at a summary + link, never full content |
| **Portfolio becoming another Report Card** | Phase 5 freezes the score/achievement distinction permanently; Portfolio structurally has no score/grade/ranking field in any section (Phase 10) |
| **AI inventing achievements** | Not addressed by this ADR because it isn't a risk this domain introduces — no AI feature is in scope for Portfolio at all (Explicitly Forbidden list); every entry's existence is either learner-submitted or teacher/mentor-curated, never generated |
| **Duplicate ownership** | Phase 3's one-owner-per-section matrix, with every non-Portfolio-native concept (Identity, scores, evidence, career predictions, teacher narrative) explicitly excluded and attributed to its real owner |
| **Evidence duplication** | Phase 7's reference-not-copy rule, mirroring `learner_projections`' own existing `supporting_evidence_ids` pattern |
| **Large PDFs** | Phase 9's paper/digital split — paper is permanently capped at a small summary, regardless of Portfolio size |
| **Storage explosion** | Not decided by this ADR (no storage/upload system is in scope) — flagged explicitly as a first-implementation-sprint concern: file/media storage strategy (size limits, allowed types, retention) must be designed before any upload capability ships, not assumed here |
| **University-only bias** | Phase 11's visibility matrix treats Teacher/Parent/Learner as the default-visible audience and University/Employer as opt-in-published only — Portfolio is designed first for the learner and school, external audiences are a deliberate, later-stage exposure, not the default framing |
| **Achievement inflation** (every learner having an inflated Portfolio that stops meaning anything) | Not solved by this ADR technically — flagged as a curation/policy risk for schools and the platform's own future guidelines to manage (e.g. teacher-curation/endorsement requirements for certain sections), not something a data model alone prevents |

---

## Phase 14 — Constitutional Compliance

- **Educational Constitution Article I** (Evidence is the only currency of truth) — Phase 7's reference-not-copy rule keeps Evidence the single source of observational truth; Portfolio entries without Evidence backing are still valid (a creative work has no "evidence" in the assessment sense) but never claim evidentiary weight they don't have.
- **Article II** (Missing evidence is never poor performance) — a learner with an empty Portfolio is never treated as deficient; Portfolio is additive, never a comparative or required record.
- **Article VI/IX** (AI explains, never invents; every recommendation traceable) — satisfied trivially: no AI feature exists in this domain's frozen scope at all.
- **Article XI** (a number without a name is not neutral) — Portfolio structurally contains no bare numeric score anywhere in Phase 10's field list.
- **RAS §3** (Canonical Domain Standards) — Learner Portfolio is declared here as a new canonical domain with one repository/service (reserved for implementation), never a duplicate of an existing one (Phase 1's audit confirms).
- **RAS §10 rules 7–8** (no duplicated business logic, no cross-domain ownership) — Phase 3/7 satisfy both directly: Portfolio never re-implements Evidence's confidence/lifecycle logic, Career's matching logic, or Report Cards'/Teacher Reflection's own authoring logic.
- **ADR-0004** — unaffected; no Attendance relationship exists in this domain.
- **ADR-0005 §3** — Portfolio's ownership matrix (Phase 3) follows the identical "one section, one owner" discipline ADR-0005 already established for Blueprint.
- **ADR-0006** (Evidence→Meaning→Action pattern) — a future implementation's Portfolio Summary (Phase 4) must satisfy this same pattern when it reaches Blueprint, exactly as Learning Compass/Career already do.
- **ADR-0007 §11** (QR philosophy) — Phase 9 explicitly extends, not reinterprets, "QR is an educational doorway, never a shortcut to a duplicate rendering."
- **ADR-0008 Part 3/Part 8/Part 9** — Phase 10's Snapshot column and Phase 9's paper/digital split are direct extensions, not departures.
- **ADR-0009** — Portfolio's own future presentation surface will need its own layer/navigation treatment, reserved for a future ADR extension at implementation time, not decided in full here.
- **ADR-0010** — Phase 11's visibility matrix follows the identical audience-visibility discipline ADR-0010 Part 3 established for Blueprint, applied to Portfolio's own, separate surface.

**Zero conflicts found.**

---

## Verification Against Mission's Checklist

- Portfolio has exactly one permanent definition — Phase 2.
- Every section has one canonical owner — Phase 3.
- No duplicated ownership exists — Phase 3/7, confirmed against every adjacent domain.
- Blueprint relationship is frozen — Phase 4.
- Report Card relationship is frozen — Phase 5.
- Career relationship is frozen — Phase 6.
- Evidence relationship is frozen — Phase 7.
- Paper vs Digital strategy is frozen — Phase 9.
- Visibility matrix is complete — Phase 11.
- Constitutional compliance is confirmed — Phase 14.
- No implementation occurred — confirmed; this document, the companion sprint document, and the implementation-log entry are the only files touched.

---

## Stop Condition

This ADR, `sprint-12t-learner-portfolio-architecture.md`, and the implementation-log entry are the complete deliverable. Per explicit mission instruction: **stop here.** Do not create tables, migrations, repositories, services, APIs, routes, UI, storage buckets, upload systems, PDFs, QR generation, AI summaries, a Portfolio Builder, Parent Portal integration, Blueprint integration code, Career integration code, Behaviour integration, notifications, or mobile views. Wait for explicit approval before the first Learner Portfolio implementation sprint.
