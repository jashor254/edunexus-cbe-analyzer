# EduNexus Pilot Workflow & Operating Model Review
**Architecture Freeze — August Pilot**
Prepared 2026-07-09, branch `reference-school`. No new AI, no new domains, no redesign proposed anywhere in this document. Every claim below is anchored to a real file; every gap is a wiring, navigation, or orchestration gap — not a missing capability, except where explicitly marked otherwise.

---

## Full Lifecycle Walkthrough

For each stage: does it exist, is it wired, is it discoverable, would a real Kenyan teacher/head teacher/parent understand it.

### 1. School Setup

**This is the most serious gap in the entire review.** There is no school-creation flow. `SchoolRepository` has `findById`/`findByName`/`update` but **no insert method anywhere outside the reference-school seed scripts** (`lib/repositories/school.repository.ts:26-61`). The real relational `schools` table (FK'd by classes, org membership, everything Core) can currently only be populated by running `scripts/reference-school/run-all.ts` by hand.

Meanwhile teacher signup (`app/teacher/setup/page.tsx`) writes a **free-text `school` string** onto the `teachers` table — a completely different, non-relational field from the real `schools` table. So today: any teacher can self-register, type any school name as plain text, and land on their dashboard — with no real `schools` row, no head teacher, no org structure underneath them. This works fine for a single pioneer teacher testing the product, but it means **there is currently no product path to onboard a real second school** for pilot. Every school so far has effectively been the manually-seeded reference fixture.

- Exists? Partially — teacher self-signup exists; school creation does not.
- Wired? No — `teachers.school` and `schools` are disconnected.
- Would a Head Teacher understand it? There's nothing for them to log into at all (see Stage 12).

**This is the one item in this review that borders on "missing capability" rather than "unwired existing capability."** It needs to be flagged as such rather than papered over — the recommendation below is a repository method + a short guided form, not new intelligence.

### 2. Teacher Onboarding

Once a teacher exists, `app/teacher/setup/page.tsx` → `app/teacher/settings/page.tsx` collects the basics (name, school text, TSC number). No class/subject assignment wizard was found forcing a teacher through "create your first class → assign subjects → invite students" — teachers presumably reach `app/teacher/classes/page.tsx` on their own. `Teacher Academy` (professional development — missions, reflections, portfolio, competency radar) is a genuinely good onboarding-adjacent asset but is discoverable **only** via the bottom nav (`components/teacher/TeacherBottomNav.tsx`) and the global search bar — it is not surfaced on the dashboard or linked from setup, so a first-time teacher has no reason to find it.

- Would a real Kenyan teacher understand it? Individually, yes — each page is clear. As a sequence, no — nothing tells them what order to do things in.

### 3. Teaching (Scheme of Work, Lesson Plans)

`app/api/sow/generate/route.ts`, `app/api/sow/grades|strands|learning-areas|kicd-context/route.ts`, `lib/sow/*` — this is mature and curriculum-grounded (real KICD strand/sub-strand/learning-outcome data, honest about `kicd_data`/`kicd_subject_data` being unpopulated for Core Competencies/PCIs/Values). Lesson plans similarly (`app/teacher/lesson-plans/*`). No gaps found here beyond the curriculum-content-completeness gap already known and honestly surfaced by the system itself (`unavailableFields`).

### 4. Assessment

`app/dashboard/assessments/add|history/page.tsx`, `app/api/teacher/assessments/process/route.ts`, `lib/assessments/mutations.ts`, `lib/assessments/gradeCalculator.ts`. Bulk CSV upload/template exists (`.../assessments/[assessmentId]/template` and `/upload`). Solid, teacher-controlled, no gaps found beyond one schema debt: `class_assessments.class_id` still FKs to legacy `teacher_classes`, not Core's `classes` — which is why the reference-school fixture currently skips assessment seeding. This is worth closing since Assessment is the most common evidence source for a real school.

### 5. Evidence

`lib/intelligence/evidence.ts`, `evidenceLifecycle.ts::persistEvidenceBatch`, `confidence.ts`. Single, well-designed ingestion path from both CSV and Compass, with trust tiers and a review/confirm/retract lifecycle for teachers. No duplication found. This is one of the strongest pieces of the platform.

### 6. Projection

`lib/projection/engine.ts` (7 pure sub-projectors, explicit nulls instead of fabrication), `recompute.ts`, and an outbox-driven consumer `eventConsumer.ts::processProjectionEvents()`. **One orchestration question, not a redesign question: no scheduler/cron was located that actually invokes this consumer.** If it isn't scheduled tightly, evidence sits unprocessed and every downstream product (Blueprint, Career, Adaptive Learning, Attention Feed) silently serves stale intelligence. This must be confirmed, not assumed, before pilot — it's the single highest-consequence orchestration check in this document precisely because Projection is your stated single source of truth.

### 7. Blueprint

`lib/learnerIntelligence/blueprint.ts` — evidence-first, zero AI narrative generation, correctly grounded. Reachable only from a button buried in the 3,200-line class roster page (`app/teacher/classes/[classId]/page.tsx:3221-3225`), one student at a time. Not on the teacher dashboard. Discoverable in theory, practically invisible.

### 8. Career Intelligence

`lib/career/*` — genuinely multi-surface (teacher/student/parent all have their own routes), all built on the same `capabilityMatchEngine`/`Insight` shape. But it's **parallel implementations reached differently per role**, not one connected thread — a teacher, a parent, and the student themselves each get to Career Intelligence for the *same learner* through three unrelated navigation paths, with nothing that says "this is the same underlying capability profile you're all looking at."

### 9. Adaptive Learning

`lib/adaptiveLearning/recommend.ts` — genuinely projection-grounded, curriculum-grounded, gap-classified, Insight-shaped. This is the correct engine (a legacy `lib/adaptiveLearning.ts` template-only version still exists and should be phased out of any remaining callers). **Confirmed by this round of research: Adaptive Learning currently powers exactly two consumers — Holiday Learning and Classroom Differentiation.** It does **not** power Assignments/Homework — `app/api/teacher/assignments/route.ts` has zero import of `adaptiveLearning`, and assignment creation is a fully manual teacher flow (pick class/subject/topic/due date) with no adaptive intelligence behind it. This is a direct gap against your own stated principle ("Adaptive Learning should power... Homework... Teacher Assignments... Revision Work") — worth naming honestly rather than assuming it's already true.

### 10. Classroom Differentiation

`lib/adaptiveLearning/differentiation.ts::recommendForClass`, exposed via `app/api/teacher/classes/[classId]/differentiation/route.ts`. Correctly gated (draft → teacher review → approve), correctly grounded, correctly separated from labeling learners. This is one of the most complete pieces of the system and needs nothing.

### 11. Parent Communication

WhatsApp opt-in (`app/api/parent/whatsapp-optin/route.ts`) drives weekly Parent Pulse (`app/api/cron/parent-pulse/route.ts` → `lib/parentPulse/builder.ts`). **One nuance worth naming plainly: Parent Pulse reads the learner model (`getOrCreateLearnerProfile`) and a lightweight `career_signals` field directly — it does not call into Projection or Blueprint.** This means Parent Pulse is a fourth parallel reader of learner state alongside Blueprint, Career Intelligence, and Attention Feed, each computing from a slightly different source (some from Projection, some still from legacy `learner_profiles`). Not a bug — each was built correctly for its own scope — but it means "the parent's weekly message" and "the teacher's Blueprint for the same learner" are not guaranteed to be reading the same underlying numbers today. Worth tracking as consolidation debt, not fixing pre-pilot.

Non-WhatsApp parents fall back to email (`lib/email/reportEmail.ts`) and PDF (`lib/learnerIntelligence/pdfGenerator.tsx`), but there's no explicit onboarding question capturing which channel a parent actually has.

### 12. Holiday Learning

The strongest boarding-school-specific workflow in the platform: generate → teacher-approve → publish (with 3-day cron auto-publish fallback) → WhatsApp to parent → Compass sessions during holiday → teacher records return → new evidence → Projection updates. Correctly implements "teacher decides" and "evidence flows back" end to end.

### 13. Compass (Digital Delivery)

`app/api/learn/*` — already mode-aware (school vs. holiday, via KE CBC term calendar), different resume windows for each. Solid, no gaps.

### 14. Printed Packs (Path B Delivery)

`lib/holiday/packRenderer.ts` generates a complete printable Adaptive Learning Pack — same underlying grounding as Compass — but **has no caller anywhere in the codebase**: no route renders it, nothing converts it to PDF, no button reaches it. Given Path A/Path B are supposed to be equally first-class, this is the starkest violation of that stated principle currently in the codebase, and the single highest-leverage fix available (the hard part — grounding printable content in the same intelligence as digital — is already done).

### 15. Return to School → New Evidence

`app/api/holiday/return/route.ts` → `lib/holiday/return.ts` closes the loop correctly: teacher records what came back from a physical pack, mastery claims get written, `lib/holiday/notify.ts` fires a WhatsApp confirmation to the parent. This stage is correctly designed already — it's only waiting on Stage 14 (the printable pack itself) being wired to have real packs to record returns for at pilot scale.

### 16. Updated Projection → Next Recommendation

Loop closes correctly in principle (evidence → outbox → recompute → next Adaptive Learning recommendation), contingent entirely on Stage 6's open scheduling question.

---

## Cross-Cutting Findings

**Duplication found (flagging for consolidation, not rebuild):**
- `teachers.school` (free text) vs. `schools` table (relational, FK'd) — two disconnected notions of "which school," Stage 1.
- Four separate readers of learner state with only partial convergence on Projection: Blueprint (fully migrated), Career Intelligence (own engine, same `Insight` shape but separate compute), Attention Feed (partially migrated — attention/trajectory on Projection, mastery heatmap/misconceptions/acceleration still on legacy `learner_profiles`), Parent Pulse (reads learner model directly, not Projection). None of these are wrong in isolation; together they're consolidation debt worth a post-pilot pass.
- Two Adaptive Learning engines: legacy `lib/adaptiveLearning.ts` (template-only) and v2 `lib/adaptiveLearning/recommend.ts` (projection-grounded, correct). Confirm no live caller still points at the legacy one.

**Disconnected, not duplicated (navigation gaps only):** Blueprint, Career Intelligence, Monday Panel, Prerequisite Readiness, and Teacher Academy are each real and correct but reachable through different, non-adjacent navigation paths rather than one coherent teacher home base.

**Genuinely missing (not just unwired):** A school-creation flow (Stage 1) and a Principal/Head Teacher role at the application layer — `lib/auth/getRole.ts` only recognizes `teacher | parent | student`, while `school_users.role` in Core schema already reserves `school_admin | headteacher | deputy_headteacher`. The schema is ahead of the app here; extending the role check is a config change, not new design, but there is currently no screen for this role to see.

---

## Prioritized Recommendations

**1. Workflow improvements**
Sequence Stage 1→2 into an actual guided path: school creation (new repository insert method + a short form, reusing existing `schools` schema — no new fields needed) followed by teacher setup pointing at a real `school_id`, not free text.

**2. Wiring existing components together**
Wire `packRenderer.ts` into the Holiday publish flow (Stage 14) — the single highest-leverage fix in this review. Link Blueprint/Career/Monday Panel/Prerequisite Readiness directly from the teacher dashboard instead of requiring per-student or separate-route discovery.

**3. Teacher experience**
Put Attention Feed, Monday Panel, and Prerequisite Readiness alerts on one dashboard surface (Attention Feed is already there — the other two just need cards added, reusing their existing queries). Surface Teacher Academy from the dashboard, not only the bottom nav.

**4. Boarding-school readiness**
Stage 14 (printable pack) is the boarding-school readiness blocker. Everything else in the holiday loop (Stages 12, 13, 15, 16) already works correctly for boarding-school rhythms.

**5. Adaptive Learning integration**
Decide, deliberately, whether Assignments/Homework should call `recommend.ts` before pilot, or whether that's explicitly out of scope for August. Currently it's silently not connected — make that a decision, not an accident.

**6. Printed vs Digital parity**
Achievable with the existing `pdfRenderer.ts`/`packRenderer.ts`/`@react-pdf` stack already used elsewhere in the platform (SOW, lesson plans, assessments, clinic reports all already render to PDF) — only the holiday pack's route/PDF-conversion step is missing.

**7. Principal visibility**
Minimum viable: extend `getRole.ts` to recognize `headteacher`/`school_admin` from the already-existing `school_users.role` enum, and give that role read-only access to existing Monday Panel/Attention Feed queries scoped to the whole school instead of one teacher's classes. No new intelligence.

**8. Parent communication**
Add a channel-preference field at parent onboarding (WhatsApp / Email / Print) so a parent with neither WhatsApp nor email has a defined print fallback, reusing the existing PDF generation already in place for Blueprint reports.

**9. Deployment flexibility**
No code changes required for Intelligence Layer / Full Platform / Hybrid to work today — CSV evidence ingestion already supports Mode 1 informally. Add a `deployment_mode` metadata field on `schools` purely for onboarding/support context; do not gate any code path with it this pilot.

**10. Pilot readiness**
Before committing to pilot schools: (a) build the minimal school-creation path (Stage 1), (b) confirm Projection consumer scheduling (Stage 6), (c) wire the printable pack (Stage 14). These three are the only items in this review that block a *second real school* from onboarding at all — everything else is a discoverability or consolidation improvement layered on top of a working platform.

---

## Final Assessment

Architecture freeze is the right call — nothing found here calls for touching Evidence, Projection, Compass, Blueprint, Career, Adaptive Learning v2, or Holiday Learning's core logic. All of that is sound, evidence-first, and correctly principled. The pilot-readiness work is entirely: one missing repository method + form (school creation), one scheduling verification (Projection consumer), one wiring pass (printable pack into publish flow), and a round of dashboard navigation links connecting intelligence that already exists. That is realistically 1–2 weeks of focused work, not a rebuild.
