# EduNexus August Pilot — Final Architecture & Workflow Implementation Review
**Architecture Freeze in effect.** Evidence, Projection, Blueprint, Career Intelligence, Adaptive Learning v2, Compass, Holiday Learning, and Curriculum Domain v2 are treated as canonical and correct below. Every finding is classified by type, not just severity, per the requested taxonomy. Grounded in the codebase on branch `reference-school`, 2026-07-09. This document synthesizes and finalizes the two prior reviews (`docs/pilot-readiness-review.md`, `docs/pilot-operating-model-review.md`) into a single scored operating decision.

---

## Issue Classification Taxonomy Used

`Architecture flaw` · `Workflow gap` · `Navigation gap` · `Missing wiring` · `Missing deployment support` · `Missing onboarding` · `Security issue` · `Data integrity issue` · `Pilot blocker` · `Technical debt` · `Future enhancement`

No genuine architecture flaw was found in the frozen intelligence chain (Evidence → Projection → downstream products) — it holds up under this review. One item below (Parallel Learner-State Readers) sits closest to an architecture concern and is flagged precisely as such, not overstated.

---

## Full Findings Register

| # | Finding | Classification | Pilot Blocker? |
|---|---|---|---|
| 1 | No `schools` table insert path exists outside manual seed scripts (`SchoolRepository` has `findById`/`findByName`/`update`, no `create`); teacher signup writes a disconnected free-text `teachers.school` field instead of a real `school_id` | **Missing onboarding**, Data integrity issue (two disconnected notions of "school") | **YES** |
| 2 | No scheduler was located that invokes `lib/projection/eventConsumer.ts::processProjectionEvents()` — the outbox may sit unconsumed | **Missing wiring** (verify before assuming) | **YES — must verify** |
| 3 | `lib/holiday/packRenderer.ts` (printable Adaptive Learning Pack) has zero callers anywhere in the codebase — not routed, not rendered to PDF, not linked from any UI | **Missing wiring** | **YES** |
| 4 | No Principal/Head Teacher role exists at the app layer (`getRole.ts` only knows `teacher\|parent\|student`), though `school_users.role` in Core schema already reserves `school_admin\|headteacher\|deputy_headteacher` | **Missing onboarding** (role exists in data model, not in app) | Must finish before August (minimum viable) |
| 5 | Adaptive Learning v2 powers only Holiday Learning and Classroom Differentiation; Assignments/Homework creation has zero import of the adaptive engine and is fully manual | **Workflow gap** (stated principle not yet true; needs a deliberate in/out-of-scope decision, not silent assumption) | Safe to defer if decided explicitly |
| 5b | Legacy `lib/adaptiveLearning.ts` (template-only, no Projection/curriculum grounding) still exists alongside the correct v2 engine; unclear if any live dashboard card still calls it | **Technical debt** | Should verify, not urgent |
| 6 | Blueprint and Career Intelligence are reachable only from a per-student button buried inside the 3,200-line class roster page; not on the teacher dashboard | **Navigation gap** | No — but high-value quick win |
| 7 | Monday Panel, Prerequisite Readiness, and Teacher Academy are each real and correct but reachable only via separate routes/bottom-nav, not surfaced on the main teacher dashboard alongside Attention Feed | **Navigation gap** | No |
| 8 | `class_assessments.class_id` still FKs to legacy `teacher_classes`, not Core's `classes` — the reference-school fixture (your canonical pilot demo) currently cannot seed/demo the Assessment→Evidence step end to end | **Data integrity issue** | Demo risk — recommend fixing before using Mwatate Ridge as a pilot script |
| 9 | Four partially-overlapping readers of learner state exist with inconsistent Projection adoption: Blueprint (fully migrated to Projection), Career Intelligence (separate engine, same `Insight` shape, not reading Projection directly), Attention Feed (attention/trajectory on Projection; mastery heatmap/misconceptions/acceleration still on legacy `learner_profiles`), Parent Pulse (reads `learner_profiles`/`career_signals` directly, does not call Projection or Blueprint) | **Architecture flaw (narrow, migration-scoped)** — this is the one place the golden rule "nothing bypasses Projection" is not yet fully true in production code, though each reader was built correctly for its original scope and the migration path is documented in-code | Not a hard blocker, but risks a parent seeing a different picture than the teacher's Blueprint for the same learner — worth a decision on tolerance for pilot |
| 10 | Compass still dual-writes evidence to legacy `learner_profiles` via `updateFromCompass`, documented in-code as intentional until Parent Pulse/Holiday/Remedial/Monday Panel finish migrating to Projection | **Technical debt** (documented, deliberate) | No |
| 11 | No parent channel preference captured at onboarding (WhatsApp / Email / Print); a parent with neither WhatsApp nor email has no defined path to a report today, despite PDF generation already existing | **Missing onboarding** | Should fix — real boarding-school population |
| 12 | No per-school deployment-mode or feature-flag data model exists (`lib/config/features.ts` is a hardcoded pioneer-teacher allowlist by user ID, explicitly marked temporary in comments) | **Missing deployment support** (metadata-only fix, not gating logic) | No — CSV bridge already makes Mode 1/3 work informally |
| 13 | Mode 1 (Intelligence Layer) and Mode 3 (Hybrid) are not explicitly named or documented anywhere as supported paths, even though CSV evidence ingestion already makes them functionally work today | **Missing onboarding** (support/sales documentation gap, not code) | No |
| 14 | No security issues were identified in this review's scope (auth gating, role checks, and service-role client usage all matched CLAUDE.md's security rules in every file examined) | — | — |

---

## Scores

**1. Pilot Readiness Score — 7/10**
The intelligence chain is real and trustworthy. Three specific items (#1, #2, #3) are hard blockers to onboarding a *second* real school and to the boarding-school printed-delivery promise; everything else is polish on a working foundation.

**2. Architecture Health — 9/10**
Evidence-first, honest-unavailable-state, no-fabrication principles hold up under direct code inspection everywhere they were tested. The one deduction is #9 — Projection is not yet universally the single read path in production, though the gap is documented migration debt, not a design failure.

**3. Workflow Health — 6/10**
Individual workflows (Holiday Learning, Differentiation, Evidence review) are excellent in isolation. The connective tissue between them — one teacher home base, one Principal view, one parent onboarding path — is the weak point.

**4. Teacher Experience Score — 6/10**
Powerful, correct tools exist (Blueprint, Career, Monday Panel, Academy) but a real teacher would not discover most of them without being told where to click. Fixing this is pure navigation work, not new capability.

**5. Learner Experience Score — 6/10**
Compass (digital) is mature and mode-aware. The printed path — the majority use case for a boarding-school learner without a phone — is built but entirely disconnected (#3), so today a real learner without smartphone access gets nothing during the holiday.

**6. Parent Experience Score — 5/10**
WhatsApp Pulse and reports work well for smartphone parents. Non-smartphone parents have no defined path (#11), and the message a parent receives may not agree with what the teacher sees in Blueprint for the same child (#9).

**7. Head Teacher Experience Score — 2/10**
No product surface exists for this role at all (#4). This is the lowest score in this review and the one most likely to affect whether a school renews past pilot — the person signing the contract has nothing to look at.

**8. Deployment Flexibility Score — 6/10**
All three deployment modes work *informally* today because evidence ingestion is source-agnostic — but nothing is documented, named, or configured (#12, #13), and Full Platform onboarding for a brand-new school is blocked entirely by #1.

**9. Boarding-School Readiness Score — 5/10**
Term-time teacher rhythm (SOW, lesson plans, assessment, differentiation, Attention Feed) is fully supported and correctly designed for "teachers use it, learners mostly don't." The holiday half of the rhythm is only half-wired: digital (Compass) works, printed (the majority case for this population) does not (#3).

---

## 10. Top Pilot Blockers

1. **No school-creation path** (#1) — blocks onboarding any real school beyond the manually-seeded reference fixture.
2. **Projection consumer scheduling unverified** (#2) — if unscheduled, every downstream product silently serves stale data for CSV-only (Mode 1) schools.
3. **Holiday Printable Pack unwired** (#3) — breaks the "Path A/Path B equal citizens" promise for the exact population (boarding, non-smartphone) this pilot targets.
4. **No Head Teacher visibility** (#4) — real adoption/renewal risk, independent of technical correctness.
5. **Reference-school fixture can't demo Assessment→Evidence** (#8) — risk of an awkward, confidence-denting pilot walkthrough with your own canonical demo school.

## 11. Quick Wins

- Add one `SchoolRepository.create()` method + a short guided form reusing the existing `schools` schema (no new columns needed) — closes blocker #1.
- Wire `packRenderer.ts` into the existing Holiday `publish` route, using the same `@react-pdf` pipeline already used for Blueprint/SOW/lesson-plan PDFs — closes blocker #3.
- Add Blueprint, Career, Monday Panel, Prerequisite Readiness, and Academy links to the existing teacher dashboard — pure navigation, zero new queries.
- Add a channel-preference field (WhatsApp/Email/Print) to parent onboarding, routing Print to the existing PDF generator.
- Confirm (or add) a tight-interval cron calling `processProjectionEvents()` — closes blocker #2.

## 12. Can Ship Now?

**Yes, for a single-school, guided pilot** (i.e., you personally onboard the pilot school by hand, as was effectively done for the reference school) — the core teaching→assessment→evidence→intelligence→holiday loop is real and correct end to end. **Not yet for self-serve or multi-school rollout** until #1 is closed, since there is currently no product path for a school to onboard itself.

## 13. Must Finish Before August

- #1 School creation path
- #2 Projection consumer scheduling — verify or wire
- #3 Holiday Printable Pack wiring
- #4 Head Teacher minimum-viable read-only view (reuse existing Monday Panel/Attention Feed queries at school scope)
- #8 Reference-school Assessment→Evidence FK fix (for demo integrity)
- #11 Parent channel-preference field + print fallback

## 14. Safe to Defer Until After Pilot

- #5 Deciding whether Adaptive Learning should power Assignments/Homework (make the decision explicit, but the build itself can wait)
- #5b Retiring the legacy `lib/adaptiveLearning.ts` template engine
- #9 Fully consolidating Parent Pulse and Career Intelligence onto direct Projection reads (document the current divergence for pilot; don't rebuild under deadline pressure)
- #10 Removing Compass's dual-write to `learner_profiles`
- #12/#13 Formal per-school deployment-mode gating and documentation (informal support already works)
- Populating empty `kicd_data`/`kicd_subject_data` curriculum-content fields — already handled honestly via `unavailableFields`, a content project not a pilot blocker
- Unifying `knowledge_nodes`/`knowledge_edges` with the `sow_*` curriculum tree into one graph

## 15. Recommended Implementation Order

1. Verify Projection consumer scheduling (#2) — cheapest check, highest downstream consequence if wrong.
2. School creation path (#1) — unblocks everything else about onboarding a real second school.
3. Reference-school Assessment→Evidence FK fix (#8) — protects your own demo before you rely on it in front of a school.
4. Holiday Printable Pack wiring (#3) — the single highest-leverage boarding-school fix.
5. Head Teacher minimum-viable view (#4) — role-check extension + scoped reuse of existing queries.
6. Parent channel-preference + print fallback (#11).
7. Teacher dashboard navigation pass — surface Blueprint/Career/Monday Panel/Prerequisite Readiness/Academy (#6, #7).
8. Everything in §14, opportunistically, without deadline pressure.

---

## Closing Assessment

Nothing in this review asks you to touch Evidence, Projection, Blueprint, Career Intelligence, Adaptive Learning v2, Compass, or Holiday Learning's core logic — the freeze holds. What stands between the current codebase and a real Kenyan boarding school going through a full term-to-holiday-to-term cycle is: one missing onboarding path, one scheduling verification, one rendering pipeline connection, one minimum-viable role extension, and a navigation pass linking intelligence that already exists and already works. That is the actual scope of "final implementation phase before August" — not a new build, a connection pass.
