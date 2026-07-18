# Sprint 12Y — Learner Projects Domain (Canonical Foundation, Architecture Only)

Architecture-only sprint, per explicit mission instruction: produces `adr-0013-learner-projects-domain.md`, this document, and one implementation-log entry — nothing else. No table, migration, repository, service, route, UI, or integration code was written.

---

## Phase 1 — Audit First (done, before any design work)

Searched the entire codebase for every term the mission named: `project`, `projects`, `learner_project`, `student_project`, `research_project`, `innovation_project`, `cbc_project`, `capstone`, `portfolio project`, `submission`, `artifact`, `prototype`, `community project`, `presentation`, `maker`, `stem`, `digital product`, `coding project`, `project rubric`, `project evidence`, `project assessment`.

Full findings are in ADR-0013 Phase 1; summarized here:

| Candidate | Verdict |
|---|---|
| `lib/learnerPortfolio/` `projects` category | **The sharpest naming collision this ADR series has produced.** A free-text-ish label on a raw artefact — no goal, lifecycle, team, mentor, or verification. Not the canonical domain. Resolved architecturally, not by renaming Portfolio's category today (see ADR-0013 "Relationship to ADR-0011"). |
| `lib/projection/`, `learner_projections` table | Pure vocabulary collision only — the Learner Intelligence computed-state (capability/risk/knowledge/growth) engine. Zero conceptual overlap. Flagged once so it's never confused with Projects again. |
| `assignments`/`assignment_submissions`, `lib/assignments/evidence.ts` | Legacy scored classwork. Read in full — its own code comments confirm "project work" as an Evidence-producer candidate was explicitly *not* built for lack of a real capture feature, confirming from the inside that no project-tracking capability exists anywhere in the platform. |
| `lib/academy/` (rubric, aiJudge, missions) | Unrelated — teacher professional-development, already flagged twice in this ADR series. |
| Every other searched term | No hit. |

**Conclusion: no canonical Learner Projects domain exists. A new domain is the correct, non-duplicative outcome.**

---

## Phase 2 — Architecture

`adr-0013-learner-projects-domain.md` freezes: Purpose (Core Question), Ownership (Phase 3), Lifecycle (Phase 5), Relationships (Phase 2/7), Evidence ownership (Phase 7's reference-not-copy rule), Blueprint/Portfolio/Achievement/Career/Compass relationships (Phase 2, one-directional per Phase 7), Teacher/Verifier/Learner roles (Phase 6), and Future Extensions (Phase 4's closed-category-with-named-amendment-process discipline).

---

## Phase 3 — Ownership Matrix

Frozen in ADR-0013 Phase 3. One line summary: **Projects owns the work (title, description, goal, category, status, dates, artifacts, team, reflection, mentor, verification). Portfolio owns only how a Project is curated/presented. Achievement owns only the recognition a Project might earn. Blueprint owns only a summary. Career and Compass read only.**

---

## Phase 4 — Categories

Frozen in ADR-0013 Phase 4: Academic, CBC, Research, Innovation, Technology, Creative Arts, Music, Drama, Business, Agriculture, Engineering, Community, Environmental, Leadership, Entrepreneurship, Digital — a closed enum (matching Portfolio's and Achievement's own already-frozen discipline), extended only by a future named ADR amendment, never by free text at write time.

---

## Phase 5 — Lifecycle

Frozen in ADR-0013 Phase 5: `Draft → Planning → In Progress → Submitted → Reviewed → Verified → Published → Archived`, with `Rejected` reachable from Submitted/Reviewed and `Cancelled` reachable only from Draft/Planning/In Progress (never after Submitted — a submitted claim gets a real disposition, never a silent withdrawal). Every state's reasoning, including why Reviewed and Verified are kept as two distinct states, is in the ADR.

---

## Phase 6 — Verification

Frozen in ADR-0013 Phase 6: Teacher verified, School verified, Competition verified, External verified, Self only, Pending — six named states, no numeric trust score (Constitution Article XI). "Expired" is explicitly rejected as a stored verification state, matching the identical rule already frozen for Achievement. **Projects owns verification permanently — Blueprint never computes or re-derives a trust judgment about a Project.**

---

## Phase 7 — Relationships

Frozen in ADR-0013 Phase 7: `Projects → Evidence/Achievement/Portfolio/Blueprint/Career/Compass`, every arrow Projects-as-source, ownership never reverses — identical "reference, never copy" discipline every prior domain in this series already carries.

---

## Phase 8 — Paper vs Digital

Frozen in ADR-0013 Phase 8: paper carries a summary only, digital carries everything, QR is reserved future-only — extending ADR-0011 Phase 9's already-frozen split. No implementation.

---

## Phase 9 — Constitutional Review

Full compliance table in ADR-0013 Phase 9 — checked against the Educational Constitution (Articles I, II, VI/IX, XI), RAS §3/§10, and every prior ADR in the series (0003–0012). **Zero conflicts found.** One relationship, not a conflict, required explicit resolution: ADR-0011's `projects` Portfolio category is touched (a future reference-link is frozen as the eventual target state) but not superseded — Portfolio's category is unchanged today.

---

## Phase 10 — Risks

Ten risks documented in ADR-0013 Phase 10, each tied to the specific rule that prevents or defers it — project duplication, fake verification, AI-generated work, ownership drift, Portfolio/Achievement/Evidence duplication, teacher-ownership confusion (Mentor vs. Verifier kept explicitly separate), external-verification abuse (flagged as a real first-implementation-sprint concern, not solved here), and storage growth/media lifecycle/future uploads (explicitly deferred, matching Portfolio's own identical deferral in ADR-0011).

---

## Verification Against Mission's Checklist

- One owner — ADR-0013 Phase 3.
- No duplicated ownership — Phase 3/7, confirmed against every adjacent domain found in Phase 1's audit.
- Portfolio only references Projects — Phase 2/7 and the explicit "Relationship to ADR-0011" resolution.
- Blueprint only summarizes Projects — Phase 2/8.
- Achievement only references Projects — Phase 2/7.
- Career reads only — Phase 2/7.
- Compass reads only — Phase 2/7.
- Constitution compliant — Phase 9.
- RAS compliant — Phase 9.
- No architectural conflicts — Phase 9.

---

## Stop Condition

This document, `adr-0013-learner-projects-domain.md`, and the implementation-log entry are the complete deliverable. No implementation work began — confirmed: no table, migration, repository, service, route, UI, media, upload, QR, or Blueprint/Portfolio/Achievement/Career/Compass integration code exists anywhere from this sprint. Waiting for explicit approval before the first Learner Projects implementation sprint (Sprint 12Z, per the user's own named roadmap: 12Z Projects implementation → 13A Behaviour domain → 13B Educational Identity → 13C QR & Digital Experience → 13D Parent messaging → 13E Compass holiday experience → 13F Portfolio uploads/media → 13G University/Employer public profile).
