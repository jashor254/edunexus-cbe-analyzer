# EduNexus Pilot Readiness Review
**August Pilot — Kenyan Boarding Schools**
Prepared 2026-07-09. Grounded entirely in the current codebase (branch `reference-school`). No new domains proposed — this is a workflow, orchestration, and deployment review of what already exists.

---

## How to read this document

Everything below is anchored to real files. Where a gap exists, it's named as a gap, not silently assumed away. The short version, if you read nothing else:

**The intelligence architecture is in genuinely good shape** — Evidence → Projection → Blueprint/Career/Adaptive Learning is a real, evidence-first pipeline with no fabrication, honest "unavailable" states, and no duplicate learner models being built. **The workflow layer around it is not pilot-ready.** The system was built domain-by-domain (Compass, Blueprint, Career, Holiday, Attention Feed) and each domain is solid in isolation, but nothing stitches them into a single thing a Head Teacher can hand to a boarding school and say "here's how Monday works." That stitching — not new intelligence — is the August work.

---

## 1. Deployment Model Evaluation

The three modes you've described (Intelligence Layer, Full Platform, Hybrid) are **not implemented as explicit configuration anywhere** — there is no `deploymentMode` field on `schools`, no per-school feature-flag table (`lib/config/features.ts` is a hardcoded pioneer-teacher allowlist by user ID, explicitly labeled temporary), and no SMS/ERP connector.

But here's the good news: **Mode 1 (Intelligence Layer) already works today, informally**, because evidence ingestion doesn't care where marks came from. `lib/intelligence/csvSource.ts` + `lib/assessments/mutations.ts::upsertMarksCSV` accept a CSV of marks regardless of whether a teacher typed them by hand or exported them from an existing school ERP. A school running Mode 1 can, right now, export marks from their SMS, reformat to the CSV template, and upload — the Evidence → Projection → Blueprint → Career chain runs identically. What's missing is **naming this as a supported path** and giving it a template/instructions, not building new infrastructure.

Mode 2 (Full Platform) is what almost everything in the codebase assumes as the default — admissions/classes/teaching all live in Core schema, and the reference-school fixture (Mwatate Ridge, 405 learners, 9 classes) proves the full chain seeds cleanly. This is the mode furthest along.

Mode 3 (Hybrid) is really "Mode 2 minus admissions/attendance/finance" — nothing in the codebase blocks a school from only using Teaching → Assessment → Blueprint → Career → Adaptive → Holiday → Reports while keeping their own SMS for admissions/finance. It already works because those two halves aren't coupled.

**Recommendation:** Don't build a "deployment mode" system before August. Instead, add one nullable `deployment_mode` text column to `schools` (Intelligence Layer / Full Platform / Hybrid) purely for onboarding conversation and support-team context — it should not gate any code path this pilot. Real gating (if a school truly runs Mode 1 and never touches Classes/Attendance) can wait until you see a real school ask for it.

---

## 2. Teacher Workflow

Today: a teacher's actual daily surface (`app/teacher/dashboard/page.tsx`) shows Active Classes, a Needs Attention count, `<AttentionFeed />`, and a weekly TIE Intel card. That's it. **Blueprint and Career Intelligence are not on this page at all** — they're reachable only via a button buried inside the 3,200-line class roster page (`app/teacher/classes/[classId]/page.tsx:3221-3228`), one per student. Monday Panel is a separate API a teacher has to know to navigate to.

This means the actual weekly rhythm a teacher needs — "who needs attention this week, why, and what do I do about it" — is split across four surfaces that don't link to each other: Dashboard (Attention Feed) → Monday Panel (separate route) → Class roster (Blueprint/Career per student) → Prerequisite Readiness (separate route). A pioneer teacher with 50 students across several classes will not discover all four on their own.

**Recommendation:** Don't rebuild any of these — they're good. Add navigation, not code: put Monday Panel and Prerequisite Readiness alerts as cards on the existing teacher dashboard (same pattern as Attention Feed), and add a "Blueprint / Career" link directly next to each student's name in the roster rather than requiring a click-through per student.

---

## 3. Learner Workflow

Digital: `app/api/learn/*` (Compass) is the only learner-facing surface, and it already has mode detection (`detectMode` in `learn/route.ts`, school vs. holiday, driven by the KE CBC term calendar) with different session-resume windows (3h school / 30min holiday) — this is exactly the boarding-school-aware design the brief asks for, and it's already built.

Printable: **This is the real gap.** `lib/holiday/packRenderer.ts` generates a complete, well-designed printable Adaptive Learning Pack (weekly structure, per-subject exercises reusing the same question builders as Compass, reflection page, parent-signature return checklist) explicitly written for households with no smartphone — but it has **zero callers anywhere in the codebase**. No route renders it, nothing converts the HTML to PDF, no teacher UI links to it. It was built and never wired in.

Given your Adaptive Learning Principle ("the intelligence must be identical regardless of delivery channel, digital → Compass, else → Printable Worksheet"), this unwired pack is the single highest-leverage quick win in this entire review — the hard part (grounding printable exercises in the same projection/curriculum data as Compass) is done.

---

## 4. Parent Workflow

Smartphone parents: WhatsApp opt-in (`app/api/parent/whatsapp-optin/route.ts`) drives a weekly Parent Pulse cron, Holiday Plan WhatsApp summaries (AI-generated, ≤220 words, Kenyan-context tone — `lib/holiday/planner.ts`), and report-ready notifications (`lib/whatsapp/reportNotify.ts`).

Non-smartphone parents: the fallback already exists structurally — `reportNotify.ts` always also states "Full report sent to your email," and `lib/learnerIntelligence/pdfGenerator.tsx` produces an exportable 3-page Blueprint PDF. But there is **no explicit parent-channel preference at signup** ("do you have WhatsApp? Do you have email? Should we print instead?"). The distinction currently lives only implicitly in who opts into WhatsApp — a parent with neither WhatsApp nor email (a real boarding-school reality) currently falls through with no defined path to a printed report.

**Recommendation:** Add one field to parent onboarding — preferred channel (WhatsApp / Email / Print via school) — and route the existing Holiday Pack + Blueprint PDF to a "hand this to the school office to print" path when Print is selected. No new report content needed; only a channel selector and a print fallback for the guardian who has genuinely no digital access.

---

## 5. Principal Workflow

**This role does not exist in the application today.** `lib/auth/getRole.ts` defines exactly three roles — `teacher | parent | student` — with no `principal`/`headteacher` value, and both `app/dashboard/layout.tsx` and `app/teacher/layout.tsx` only branch on those three. There is no principal dashboard, no cross-class or whole-school view, nothing a Head Teacher can log into.

The encouraging part: **the data model is already ahead of the app.** `types/core.ts` defines `school_users.role` with a CHECK constraint that already includes `school_admin | headteacher | deputy_headteacher | teacher | parent`, and the reference-school seed script maps a richer staff catalogue down into these buckets already (`scripts/reference-school/03-seed-staff.ts`). This is a genuine schema-ahead-of-app gap, not a missing design.

For a boarding school pilot, a Head Teacher without any visibility into the platform is a real adoption risk — they're the one who decides whether the school keeps paying. But building a full Principal experience before August is out of scope per your own "don't build features" framing.

**Recommendation (minimum viable, reusing existing intelligence):** Extend `getRole.ts` to recognize `headteacher`/`school_admin` from `school_users.role` (already there), and give that role read-only access to the *existing* Monday Panel and Attention Feed logic, aggregated across all classes in the school rather than one teacher's classes. No new intelligence — just a wider query scope on code that already exists. This is a config/query change, not a new domain.

---

## 6. Intelligence Layer Workflow

Evidence enters via CSV upload (`upsertMarksCSV`) or Compass sessions, both landing in `lib/intelligence/evidenceLifecycle.ts::persistEvidenceBatch`, which writes to an outbox table (`evidence_projection_events`). `lib/projection/eventConsumer.ts::processProjectionEvents()` drains that outbox and recomputes projections. **One real question surfaced by research: no cron/scheduler was found that calls `processProjectionEvents()`.** If nothing invokes this consumer, evidence can sit in the outbox unprocessed indefinitely, meaning Blueprint/Career/Adaptive Learning would silently serve stale projections after new marks are imported.

**This must be verified before pilot, not assumed.** It's a five-minute check, not a redesign: confirm a cron/webhook actually calls `processProjectionEvents()` on a tight interval (minutes, not hours) after CSV import, since Mode 1 schools depend entirely on this path with no Compass activity to otherwise trigger recomputation.

---

## 7. Full Platform Workflow

Admissions → Classes → Teaching → Assessments → Evidence → Projection → Blueprint → Career → Parents → Reports → Holiday Learning: every link in this chain has a real, working implementation, proven end-to-end by the reference-school fixture. One documented gap: the reference school's assessment pipeline is skipped in seeding because `class_assessments.class_id` still FKs to the legacy `teacher_classes` table rather than Core's `classes` (`docs/reference-school/README.md`, "known gaps"). This means the canonical fixture cannot currently exercise the full Assessment→Evidence step end-to-end — worth closing before using Mwatate Ridge as a pilot demo script, since assessments are the most common evidence source for a real school.

---

## 8. Hybrid Workflow

As noted in §1, Hybrid isn't a separate code path — it's Full Platform with some upstream stages (admissions, attendance, finance) supplied externally and Teaching-onward run inside EduNexus. Nothing currently blocks this; it needs no engineering before August, only a support/sales script describing which modules a hybrid school turns on.

---

## 9. Adaptive Learning Workflow

Two generations coexist and this is worth resolving before pilot: `lib/adaptiveLearning.ts` (legacy, template-only, no DB/AI/curriculum grounding, used for simple dashboard cards) vs. `lib/adaptiveLearning/recommend.ts` (v2 — reads real Projection + real curriculum context, classifies gap type, produces an Insight-shaped `AdaptiveTask`). The v2 engine already powers Classroom Differentiation (`differentiation.ts::recommendForClass`) with the same draft → teacher-review → approve gate used by Holiday Plans — this is exactly the "teacher always decides" principle, already implemented correctly.

The digital/printable symmetry the brief asks for is achievable with existing pieces: v2's `AdaptiveTask` output and the Holiday Pack's exercise builder both ultimately reuse `lib/assignments/pdfRenderer.ts` question construction. The missing piece is the same one from §3 — wiring, not new intelligence.

**Recommendation:** Confirm which dashboard cards still call the legacy `lib/adaptiveLearning.ts` and migrate them to v2's projection-grounded output before pilot, so a teacher never sees two different "levels" for the same learner from two different engines.

---

## 10. Compass Workflow

Compass is correctly positioned as both teacher- and learner-facing, and evidence is emitted once per session (on `learn/end`), not per-exchange — a sane trust/cost tradeoff. One thing worth teacher-communicating: the "mastery" evidence claim only fires if the AI's in-session eval reports genuine progress with named concepts; routine engagement always produces an "engagement" claim regardless. This asymmetry is correct (mastery claims should be conservative) but should be explained in teacher onboarding so nobody misreads a low mastery-claim count as "the platform isn't working."

**Known migration debt, not a bug:** Compass still dual-writes to legacy `learner_profiles` via `lib/learnerModel/updater.ts::updateFromCompass`, documented in the code as intentional until Holiday Planner, Parent Pulse, Remedial Planner, and Monday Panel all migrate to reading Projection directly. `lib/attentionFeed/panel.ts` is a confirmed partial-migration case — attention/trajectory read Projection, but mastery heatmap, misconceptions, peer-matching, and acceleration candidates still read legacy profiles. This isn't visible to teachers today (numbers still show up), but it is a duplicated-source-of-truth risk if the two diverge. Not urgent for August; worth flagging so it doesn't get forgotten post-pilot.

---

## 11. Holiday Learning Workflow

The strongest single workflow in the platform for the boarding-school reality: generate (teacher, class or individual) → draft → **teacher-approval gate** → publish (with a 3-day cron auto-publish fallback if the teacher doesn't act) → WhatsApp to opted-in parents → learner does Compass sessions during the holiday → teacher records return (weeks completed, per-subject mastery) → evidence flows back into Projection. This is your "Compass becomes learner-facing during holidays" principle, implemented correctly, already.

The one hole: the printable path for households without a smartphone (§3) is built but not wired to the publish flow. Fixing this closes the loop for the majority of boarding-school families this pilot targets.

---

## 12. Differentiated Classroom Workflow

`lib/adaptiveLearning/differentiation.ts::recommendForClass` already implements exactly the "Group A/B/C" pattern described in the brief, grounded in real projection data and gated by teacher review before anything reaches students — never auto-published to a classroom without a teacher decision. No changes needed here for pilot; this is one of the more complete pieces of the system.

---

## 13. Printed vs. Digital Strategy

The platform already has **substantial**, mature PDF/print capability — scheme of work, lesson plans, record of work, assessments, academic clinic reports, career reports, and the Blueprint itself all render to PDF via `@react-pdf`. This is not a weak area. The single specific gap is the Holiday Printable Pack (§3, §11) — everything else needed to make "printed = same intelligence as digital" real already exists; it's one unwired renderer away from being complete.

**Recommendation for August:** wire `packRenderer.ts` into the existing holiday `publish` flow (render + convert to PDF using the same `@react-pdf`/render approach already used elsewhere, store, and either email to the parent or hand a print-ready link to the teacher for the school office). This is the single highest-value quick win in this review.

---

## 14. Pilot Risks

1. **Projection outbox may not be consumed on a schedule** (§6) — unverified cron wiring could mean Mode 1 schools (CSV-only evidence) never see fresh intelligence. Verify before pilot.
2. **No Principal/Head Teacher visibility** (§5) — real adoption risk; the person who renews the contract has no window into the platform.
3. **Holiday Printable Pack unwired** (§3, §11) — the boarding-school non-smartphone majority currently has no delivery path for holiday work despite the content already being generatable.
4. **Reference-school assessment pipeline gap** (§7) — your canonical demo fixture can't currently exercise the most common evidence path (assessments) end-to-end; risks an awkward pilot demo.
5. **Two adaptive-learning engines coexisting** (§9) — risk of a teacher seeing inconsistent levels for the same learner from legacy vs. v2 code paths.
6. **No explicit parent channel preference** (§4) — parents with neither WhatsApp nor email currently have no defined fallback, despite print infrastructure existing elsewhere in the platform.
7. **Workflow fragmentation for teachers** (§2) — Blueprint, Career, Monday Panel, Prerequisite Readiness are all real and correct but scattered across four unlinked surfaces; a beta teacher is unlikely to discover all of them without hand-holding.
8. **Compass mastery-claim conservatism could be misread as "not tracking"** (§10) without onboarding explanation.

---

## 15. Pilot Recommendations

- Treat this pilot as a **wiring and navigation pass**, not a build phase. Every gap above is a connection between two things that already exist, not a missing capability.
- Prioritize fixes that touch the **boarding-school holiday cycle** first (Printable Pack, parent channel preference) — that's the single moment where this whole platform either works for a real Kenyan boarding school or doesn't.
- Give the Head Teacher *something* to log into, even a stripped read-only aggregate view, before asking a school to commit to a paid pilot.
- Verify (don't rebuild) the projection consumer scheduling — this is a five-minute infrastructure check with outsized correctness consequences if wrong.

---

## 16. Quick Wins Before August

1. Wire `lib/holiday/packRenderer.ts` into the holiday publish flow → PDF → email/print path. *(highest leverage)*
2. Confirm/schedule `processProjectionEvents()` on a short interval.
3. Add Blueprint + Career links directly on the teacher dashboard and in-roster (not buried behind a per-student click-through).
4. Add Monday Panel + Prerequisite Readiness as dashboard cards instead of separate undiscovered routes.
5. Add a parent-onboarding channel preference field (WhatsApp / Email / Print) with a print fallback path.
6. Migrate remaining legacy `lib/adaptiveLearning.ts` dashboard callers to v2 `recommend.ts` so levels are consistent everywhere.
7. Fix the `class_assessments.class_id` FK gap so the reference-school fixture can demo the full assessment→evidence→projection chain.

---

## 17. Features to Defer Until After Pilot

- A full Principal/Head Teacher product surface (whole-school analytics, staff management UI) — ship the minimum read-only aggregate now, build the real thing after pilot signal.
- Formal per-school `deployment_mode` gating logic — track it as metadata only; don't build enforcement until a real school asks.
- SMS/ERP connector automation for Mode 1 — CSV bridge is sufficient for pilot scale.
- Unifying `knowledge_nodes`/`knowledge_edges` with the `sow_*` KICD curriculum tree into one graph — both are honest and functioning independently; consolidation is a real project, not a pilot blocker.
- Retiring the `learner_profiles` dual-write in Compass — correctly deferred until all four dependent consumers (Holiday, Parent Pulse, Remedial Planner, Monday Panel) migrate to Projection.
- Populating empty `kicd_data`/`kicd_subject_data` fields (Core Competencies, PCIs, Values, Assessment Opportunities) — the platform already handles this honestly via `unavailableFields`; expanding curriculum data is a content project, not a pilot blocker.

---

## 18. Final Readiness Assessment

**The intelligence architecture is pilot-ready.** Evidence-first design is real and enforced throughout — no fabricated curriculum links, no duplicate learner models, honest gaps surfaced instead of hidden. This is the hard part, and it's done well.

**The workflow layer is not yet pilot-ready**, but every identified gap is closeable without touching a single working domain: it's wiring an existing renderer, adding navigation links between existing pages, verifying a scheduler, and extending a role check to a role the schema already supports. None of it requires new AI, new schema design, or new intelligence — which matches your instruction not to redesign what's already working.

The realistic August-readiness path is the seven items in §16, roughly a 1–2 week focused effort, not a rebuild.
