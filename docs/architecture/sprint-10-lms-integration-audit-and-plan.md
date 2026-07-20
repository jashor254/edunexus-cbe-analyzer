# Adaptive Assessment Completion & LMS Integration — Audit & Phased Plan

## Design/Planning Only — No Code Yet (see closing section for why)

---

## Executive Summary

This 14-part request is larger than Sprint 9's three slices combined. Before proposing how to sequence it, the honest first step is finding out how much of it already exists. **Result: 3 of 14 parts are already fully built (Slices 1–3), 2 more are partially built, and one part (bulk generation) has a real, mature, reusable piece of infrastructure sitting unused that makes it much smaller than it looks.** The remaining parts are genuinely new UI/routes, but smaller in aggregate than the brief's own framing suggests.

---

## 1. Part-by-Part Audit — What Exists vs. What's Net-New

| Part | Status | Evidence |
|---|---|---|
| **1. Creation wizard mode toggle** | Not built | `app/teacher/assignments/new/page.tsx` already has an `is_quiz` toggle (Standard vs. Quiz); no Adaptive sub-mode exists yet. Small, additive extension of an existing toggle pattern, not a new page. |
| **2. Review Dashboard (side-by-side)** | **Partially built** | Sprint 9 Slice 2 already added a per-question variant list to the quiz builder page with Generate/Approve/Reject/Regenerate. What's missing: a side-by-side Canonical/Foundation/Supported/Extension layout (currently a flat list) and an **Edit** UI affordance (`editVariant()` exists as a repository function, Sprint 9 Slice 2, with zero UI calling it yet). |
| **3. Status flow (Draft → Generate → Review → Publish)** | **Partially built** | `assignments.status` already supports `draft`/`active`/`closed` via the existing PATCH endpoint (confirmed, Sprint 4A audit), and the student list route already filters to `active` only (confirmed, same audit) — the visibility gate is real today. Missing: assignment creation still hardcodes `status: 'active'` (Sprint 4A.1's "draft-capable creation" design was never implemented) and nothing today blocks *publish* on "at least one tier reviewed." |
| **4. Bulk generation (progress, retry, resume)** | Not built, but a **real, mature, unused-for-this-purpose job queue already exists** | `lib/jobs/` + `job_queues`/`jobs`/`job_logs` tables (confirmed via migration `20260709081538_background_jobs_minimal.sql`) — retries, `max_attempts`, `dead_letter` + `requeueDeadLetterJob` (retry-failed-only, for free), `idempotency_key` (resume-without-duplicating, for free), `getJobStats`/`listJobs` (progress, for free). This is not a new build — it's registering one new job type (`ai.variant.generate`, fitting the already-declared `WellKnownJobType` pattern) and calling `enqueueBatch`. |
| **5. Teacher coverage visibility** | Not built as a view | All source data already exists (`assignment_question_variants.status`, `assignment_questions` count) — a read-only aggregation, no new calculation, matching the brief's own "no new calculations" instruction exactly. |
| **6. Student delivery** | **Already fully built** | Sprint 9 Slice 3 — `resolve_served_variants_batch`, `findServedQuestionsForStudent`, confirmed by 8 passing integration tests. Nothing to do here. |
| **7. Teacher Results (inspection)** | Not built as a view | All source data exists (`served_variant_map`, `assignment_question_variants`, `assignment_submissions.answers`, `learner_evidence` via `raw_input_ref`) — read-only, no recomputation, exactly as the brief specifies. |
| **8. Analytics** | Not built | Confirmed reusable: band distribution is `classifyGroup`'s own output (already computed, never persisted per-student per-assignment today — **a real, small gap**: nothing currently stores "which band was this learner in when served," only `served_variant_map`'s variant id, from which the tier — not the exact band — is recoverable via the variant's own `variant_type`. Question/variant success rate is a direct aggregate over `assignment_submissions.answers` + `served_variant_map`, no new engine. |
| **9. Editing rules + Duplicate Assignment** | **Partially built** | The immutability trigger (Sprint 9 Slice 1) already enforces "no edits after real submission activity" at the DB layer. "Duplicate Assignment" does not exist as a feature anywhere in the codebase. |
| **10. Evidence Verification / audit page** | Not built | Same as Parts 7/8 — a read-only trace view over already-existing, already-linked data (`assignment` → `assignment_question_variants` → `assignment_submissions` → `learner_evidence` via `raw_input_ref` pattern matching, confirmed this exact join already works, used by every quiz evidence integration test this series has written). |
| **11. Performance (async generation, batching)** | Generation is currently **synchronous** (the Slice 2 API route awaits `generateAdaptiveVariants` inline) | Directly solved by Part 4's job-queue reuse — moving generation off the request/response cycle is the same piece of work as "bulk generation," not a separate concern. |
| **12. Accessibility (no labels leak)** | **Already true** | Confirmed by Slice 3's own design and tests — `findServedQuestionsForStudent`'s output never includes `variant_type`, band, or any tier label. Nothing to build. |
| **13. Regression** | Ongoing discipline, not a deliverable to "build" | Every slice this series has shipped already re-runs the full existing suite before merge (84 tests passing as of Slice 3) — this continues, not a new task. |
| **14. Architecture rules** | Already the standing discipline of every slice in this series | Nothing to build — a constraint on how the rest is built, already respected throughout Sprint 6A–9. |

**Net-new work, honestly scoped**: Parts 1, 2 (partial), 3 (partial), 4/11 (one job type + a progress UI), 5, 7, 8 (one new field's worth of gap), 9 (partial — Duplicate Assignment specifically), 10. Six to seven real pieces of UI/routes, one new job-queue registration, one small schema addition (recording the band at serve time, if Part 8's band-distribution analytics is wanted precisely rather than approximated from tier).

---

## 2. The One Real Design Decision This Audit Surfaced

Part 8 (analytics) wants "Foundation learners / Supported Practice learners / Extension learners" counts. `served_variant_map` records a `variant_id` (or `null`), from which `variant_type` (the tier) is recoverable via a join — but **not** the learner's original `band` (`critical_gap` vs `prerequisite_gap` both map to `foundation`, so the tier alone can't distinguish them, and `academicGrain` is lost entirely). Two honest options, not decided here: (a) approximate analytics using tier only (zero schema change, slightly less precise), or (b) add a `resolved_band text` column to `assignment_submissions` (Sprint 4C's original design already named this field and deliberately left it out of Slice 3 as extra scope — this would be picking it back up). Named for the next planning pass, not resolved unilaterally here.

---

## 3. Proposed Phased Sequence

Mirroring Sprint 9's own proven approach (small, individually-verifiable, real-database-tested slices):

- **Slice A — Draft-gated creation + status flow** (Part 1, Part 3): the mode toggle, real draft-on-create, and a publish gate. Smallest, unblocks the review dashboard's own workflow context.
- **Slice B — Review Dashboard** (Part 2): side-by-side layout + wiring the existing `editVariant` into the UI. Builds directly on Slice A.
- **Slice C — Bulk generation via the existing job queue** (Part 4, Part 11): one new job type, a progress-polling UI. The single biggest "aha, this is smaller than it looks" win.
- **Slice D — Teacher visibility & inspection views** (Part 5, Part 7, Part 10): three read-only pages over already-existing data, naturally grouped since they share the same query shapes.
- **Slice E — Analytics + Duplicate Assignment + editing-rules UI polish** (Part 8, Part 9): the one place a real schema decision (§2) needs resolving first.

---

## 4. Why This Stops Here Instead of Building All 14 Parts

Every large build in this series so far — Sprint 9's schema, its generation pipeline, its delivery/grading — was scoped into a confirmed slice before code was written, specifically because each touched live schema, new UI, or a new cost/infra surface. This request is larger than all three of those combined, touches a live job queue for the first time, and adds no fewer than six new teacher-facing pages. Building all of it in one uninterrupted pass would be the largest single change this entire engagement has attempted, and would abandon the one practice that has kept every prior large change individually verifiable against the real database. The next message asks which slice to start with.
