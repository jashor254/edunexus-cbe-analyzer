# Blueprint Pilot Demonstration — Phase 3B (reduced scope)

**Date:** 2026-07-26
**Scope:** The original Phase 3B brief requested a large hardening effort (teacher-native route, parent-access rework, delivery-recovery/reconciliation layer, ~50 tests, new observability, new architecture doc). That was reduced, by explicit decision, to only the two workstreams that directly serve the current stage of the business — School Discovery + Outreach, zero pilot schools onboarded — under the active Foundation Freeze / PE-1 charter ("engineering is no longer the default response, execution is"; "does this remove a REAL blocker a pilot hit TODAY"). No pilot school has hit any of the hardening scenarios in the original brief, because none exist yet.

**What this phase actually delivers:**
1. A reproducible, idempotent seed script that prepares one real, evidence-backed, fully-delivered-and-reviewed Blueprint demonstration scenario in the reference school (Workstream D).
2. A verified, repeatable 5-minute teacher demonstration script and a 2-minute principal narrative, usable today for outreach conversations (Workstream E).

**What this phase explicitly does not touch:** the teacher-native route, parent-access routing, delivery-recovery/reconciliation UI, and pilot observability from the original brief remain undone. They are re-scoped as future work, gated on having a real pilot school that has actually hit one of those problems (see §6).

---

## 1. Demonstration dataset (Workstream D)

`scripts/reference-school/07-seed-blueprint-demo.ts` (`npm run seed:blueprint-demo`).

Builds on the existing reference-school seed suite (`01`–`06`), calling `seedLegacyBridge()` first so the Core structure, real Evidence (`persistEvidenceBatch` via `recordAssessmentEvidence`), and the legacy identity bridge all exist — idempotent, cheap to re-run.

It then, using only canonical domain services (no direct table writes to any Blueprint table):

1. Picks a deterministic demo learner (first enrolled learner, by admission number, in the first Grade 10 class) who already has real Kiswahili CAT evidence from the legacy bridge.
2. Calls `recomputeLearnerProjection()` to confirm a persisted Projection exists.
3. Impersonates the learner's real bridged class teacher via Supabase Admin `generateLink()` + `verifyOtp({ token_hash, type: 'magiclink' })` — necessary because reference-school teacher passwords (`03-seed-staff.ts`) are randomized and never stored, so there is no credential to sign in with directly. Every authorization check the impersonated session then hits (`canManageLearnerRecordCore`, `requireClassTeacher`, …) still runs for real.
4. Proposes and approves one Blueprint action (`proposeBlueprintAction` → `approveBlueprintAction`), marked by a fixed title so re-runs find it instead of duplicating it.
5. Delivers the same action to a real class-wide assignment (`deliverBlueprintActionAsAssignment`) **and** to Learning Compass (`deliverBlueprintActionToCompass`) — both idempotent by the action item's own id, exercising the card's "both" delivery state.
6. Records one educator review (`reviewBlueprintAction`, decision `no_decision`) — honest, since no real learner activity exists yet at seed time. The script checks for an existing review first and skips if one is already there; `reviewBlueprintAction()` is deliberately append-only in production, so an unconditional call here would stack a fresh review every re-run.

**Verified idempotent** — three consecutive runs against the real project: run 1 created everything; runs 2 and 3 reported `already exists` / `alreadyDelivered: true` for the action, both deliveries, and the review, with zero new rows.

**Safety:** refuses to run when `NODE_ENV=production` (an explicit guard, unlike its siblings in this directory — the generateLink/verifyOtp impersonation technique has a strictly larger blast radius than anything else in this script suite, so it gets one). Beyond that it follows the same convention as every other reference-school script: scoped by whichever `.env.local` you run it against, no separate feature flag.

**Generated records are identifiable** via the fixed marker title `Strengthen Kiswahili comprehension through weekly guided practice` on the action item, and by being reachable only through the one demo learner printed at the end of the run.

**Cleanup:** not built. The action item, delivery rows, and review are ordinary rows under the reference school's existing cascade (see `scripts/reference-school/shared.ts`'s cleanup note) — deleting the reference school removes them. No standalone cleanup script exists for just this demo scenario; documented here as a known limitation rather than silently assumed.

### A real, pre-existing bug found and fixed along the way

`06-seed-legacy-bridge.ts`'s `bridgeStudents()` verification step sampled the first 5 learners by admission number to confirm the bridge — but one learner in the reference school (`ADM-BRIAN-999`, a stray row from an unrelated script, not created by this phase) has no class enrollment, which the bridging loop itself already knows to skip gracefully. The verify step didn't account for that and aborted the entire legacy bridge (and therefore this phase's seed script) on a condition unrelated to whether bridging actually worked. Fixed by sampling only from already-enrolled learners (`06-seed-legacy-bridge.ts`, one-line filter). This was a required fix, not scope creep — the seed script could not run at all without it, and the fix is a correctness fix to an existing verification step, not a feature addition.

### A pre-existing gap observed, not fixed

The seed run logs `[events] teacher.assignment.created: Failed to publish event: Could not find the table 'public.platform_events' in the schema cache` — `publishEvent()` fails non-fatally (assignment creation itself succeeds) because this environment's `platform_events` table is missing or out of sync with the schema cache. This is a pre-existing environment/migration gap, unrelated to Blueprint, out of this phase's scope, and noted here as a residual risk (§6) rather than fixed silently.

### Real learner activity was deliberately not fabricated

Per Phase 3A's own finding (`blueprint-execution-experience-phase3a.md` §14): "this cannot be faked." A real assignment submission is honestly scriptable (it needs only a real authenticated HTTP call to `/api/student/submit`, no AI involved) but was judged out of scope here to avoid depending on a running `next dev`/`next start` server from a one-shot data seed script. A real Compass tutoring session is not honestly scriptable at all without either genuinely calling DeepSeek through `/api/learn` (slow/costly for a seed script) or hand-writing `endSession`/`recordCompassSessionEvidence` inputs (`masteredConcepts`, `genuineProgress`) that no real exchange produced — the latter would be evidence fabrication wearing a legitimate-looking API call. **The demo narrative below treats this as a live, honest step** ("no learner activity recorded yet" is itself the correct, shown state) rather than faking it.

---

## 2. Five-minute teacher demonstration

Uses the real, already-seeded demo learner. Run `npm run seed:blueprint-demo` once beforehand (idempotent — safe to run again right before a demo) and use the `Learner Blueprint URL` it prints.

1. **Open the learner's Blueprint** (`/student/blueprint/<learnerId>`, signed in as the demo teacher account) — the same class-teacher account the seed script itself impersonates; no separate demo login needs to be prepared.
2. **Point to the evidence-backed need already visible on the Blueprint** — the learner's real, seeded Kiswahili CAT evidence and its Projection.
3. **Scroll to "Blueprint Action Plan"** — show the approved card: *Strengthen Kiswahili comprehension through weekly guided practice*. Read the rationale and the learner/teacher actions aloud — this is what the teacher agreed to do, in plain language.
4. **Show the delivery state** — the card already reads "Delivered" for both the class assignment and Learning Compass (the seed script did this once, ahead of time, exactly as Phase 3A's own UI would). If you want the audience to see the *click*, use a second, freshly-proposed action instead and deliver it live — the confirmation-sentence UI and the card updating in place is the moment worth showing.
5. **Be honest about learner activity** — the card correctly shows "No learner activity recorded yet." Say so plainly. This is the one point in the walkthrough where the honest answer is "nothing has happened yet, and the product says so clearly instead of guessing."
6. **Click "Review progress"** — lands directly in the Review Workspace for this exact action (Phase 2E, deep-linked via `?action=<id>`).
7. **Walk through the Assignment/Compass activity summary, latest Evidence, and current Projection sections** — all real, all read directly from `learner_evidence`/`learner_projections`, nothing recomputed for the demo.
8. **Record a decision** — show the required disclaimer sentence, submit a decision (e.g. `no_decision` again, or `complete` if you're demonstrating a hypothetical future state honestly labeled as such), and the new review appears — the append-only history in front of the audience.
9. **Return to the Blueprint page** — the card now shows "Latest teacher review: …", kept visibly distinct from "Approval status: Approved."

**What this proves, per the task's own seven questions:**
1. What is the learner struggling with? → the real, evidence-backed Kiswahili comprehension gap.
2. What evidence supports that? → the CAT score and its Projection, both on-screen, both real.
3. What action did the teacher approve? → the Blueprint Action Plan card, in the teacher's own words.
4. Where was it delivered? → the class assignment and/or Learning Compass, shown live.
5. What learner activity occurred? → honestly "none yet," or a real submission if one has genuinely happened since delivery.
6. What does the latest picture show? → the Review Workspace's live Evidence/Projection sections.
7. What did the teacher conclude, and what happens next? → the recorded review decision and its notes.

## 3. Two-minute principal narrative

> EduNexus does not merely record marks. Here is one real learner at your school — this is what the evidence already shows about where they need support. The teacher reviewed that evidence, agreed on one specific action, and sent it either into a class assignment or into the learner's Learning Compass — both in one click, both auditable. When the learner engages, that activity flows back onto the same page. And when the teacher checks in, their professional judgement — not an automated verdict — is what gets recorded and kept. Nothing here claims a learner has succeeded; it shows what's known, what was decided, and what a real teacher concluded.

Keep to: evidence → decision → delivery → (honest) activity state → teacher judgement. Never claim activity is learning success (per the task's own constraint) — the "no learner activity recorded yet" state in step 5 above is itself worth narrating as a feature, not skipped over.

---

## 4. Reuse of Phase 3A material

This doc deliberately does not re-derive the UI-level facts Phase 3A already established and tested (`blueprint-execution-experience-phase3a.md` §§1–13): the Action Plan section, both delivery panels, the Review Workspace deep-link, authorization boundaries, accessibility. Phase 3A's own §14/§16 supplied the shape of the demo script; this doc replaces "prepare a demo learner" (an abstract manual sequence Phase 3A judged sufficient at the time) with a concrete, run-once, idempotent script against a real, named learner and teacher — the smallest addition that turns an abstract recipe into something repeatable on demand.

## 5. Files changed

- `scripts/reference-school/07-seed-blueprint-demo.ts` (new)
- `scripts/reference-school/06-seed-legacy-bridge.ts` (one-line verify-sample fix, §1)
- `package.json` (`seed:blueprint-demo` script)
- `docs/architecture/blueprint-pilot-demonstration-phase3b.md` (this file, new)

No migration. No new writer. No new route. No new UI.

## 6. Residual risks / explicitly deferred

- The original Phase 3B brief's Workstreams A, B, C, F (teacher-native route, parent-access correction, delivery-recovery/reconciliation UI, minimal observability) are **not done** — deferred until a real pilot school has actually hit one of those problems, per the active Foundation Freeze / PE-1 execution filter.
- The parent-access gap flagged in Phase 3A §15 (`app/student/layout.tsx` unconditionally blocks `parent`-role viewers from `/student/**`, including Blueprint, despite `requireLearnerAccess` already admitting them) remains open.
- `publishEvent()` failing on a missing `public.platform_events` table (§1) is a real, pre-existing environment gap, unfixed here.
- No cleanup script exists for just the demo scenario's rows (only the whole reference school's cascade).
- Real learner activity for the demo remains a live/manual step, not scripted — see §1's rationale.

## 7. Commercial pilot-readiness verdict

**GO for outreach conversations, not GO for repeated real-teacher pilot use.** The demonstration itself is real, reproducible, and honest — suitable today for a school visit or a founder-led pitch. The underlying product still has the routing/access/recovery gaps Phase 3A and this doc both name; those need a real pilot school's actual usage to prioritize correctly, which is precisely why they were not built speculatively in this phase.

## 8. Recommendation for next phase

Do not resume the full original Phase 3B brief speculatively. When the first real pilot school is signed, revisit Workstreams A–C and F against what that school's teachers actually hit — not against the hypothetical scenario list in the original brief.
