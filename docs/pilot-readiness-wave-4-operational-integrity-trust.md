# EduNexus — Pilot Readiness Wave 4 Report

**Operational Integrity & Trust**
Date: 2026-07-13
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit only, no code changed. Final operational trust verification before pilot deployment, following Pilot Readiness Waves 1–3. Objectives 1–4 and 6 (notifications, automation, status badges, failure visibility, trust ranking) cover the exact ground Wave 3 already audited exhaustively and definitively — this report cites those findings directly rather than re-deriving them, since nothing about the codebase changed between Wave 3 and this wave. The two genuinely new investigations this wave adds are objective 5 (audit trail review for 9 specific educational actions) and objective 7 (verifying, at the UI/workflow layer rather than the computation layer, that no feature actually requires topical assessments).

---

## 1. Executive Summary

Wave 3 already established the platform's core trust posture in full: 3 confirmed false promises (a parent told "the teacher has been notified" when nothing notifies the teacher; a WhatsApp template claiming "sent to your email" regardless of whether email was attempted; and a real bug that swaps email/WhatsApp status badges via fixed-position array destructuring), 3 notification crons that are fully built but will never fire in production (Parent Pulse, term-readiness, Academy nudge), and zero error-tracking or operator-visible failure surface anywhere in the platform. Nothing in this wave's new investigation contradicts or changes that picture — it still stands as the accurate, current state.

This wave's new findings sharpen two specific areas the Constitution and this wave's mandate both call out by name:

**Audit trails**: 6 of 9 checked educational actions have a genuine, queryable audit trail with actor/timestamp/before-after state (projection recomputation, career updates, holiday publication, parent notifications, promotion, teacher intervention). Report card publication is partial — it records *when* but not *who*. Two are real gaps: **assessment mark corrections are destructive overwrites with zero history** (a teacher's correction erases the prior value with no trace), and **term rollover is a boolean flip with no actor or history**. Both are fixable without new architecture — they need one column and one table respectively, not a redesign.

**Exam-only reality**: verified clean. No feature — Monday Panel, Blueprint, Career Explorer, Holiday Planner, or Remedial Planner — silently blocks or empties for a student with only opener/midterm/end-term marks. The one real UI gate found (Career Explorer requiring "at least one assessment") is evidence-*existence*, not evidence-*type*, and is satisfied by a single exam mark. Every "insufficient evidence" string found is an honest per-claim confidence caveat shown alongside otherwise-working output — exactly what the Constitution requires, not a blocker.

**Verdict: CONDITIONAL GO** — unchanged from Wave 3's assessment, now confirmed still accurate and extended with two additional fixable audit-trail gaps. The condition remains the same four items Wave 3 identified (fix the swapped status-badge bug, fix the two false promises, schedule or stop implying the three dead crons run), joined by two smaller additions from this wave: add an actor column to report-card publication, and add minimal history for assessment corrections and term rollover before a pilot school's data integrity depends on neither ever needing to be reconstructed after the fact.

---

## 2. Operational Trust Map

```
Evidence enters (exam marks, topical checks, Compass, ...)
        │
        ├── Projection recomputation ─────────────── AUDITABLE (evidence_projection_events + last_computed)
        ├── Career update (capability_profile) ────── AUDITABLE (capability_history)
        │
        ├── Assessment mark entry/correction ──────── NOT AUDITABLE (destructive overwrite, §5)
        │
        ▼
Teacher/Parent-facing surfaces
        │
        ├── Monday Panel / Blueprint / Career Explorer / Holiday / Remedial
        │     → confirmed exam-only-safe at the UI layer (§7, new this wave)
        │
        ├── Notifications (WhatsApp/email) ────────── 3 CONFIRMED FALSE PROMISES (§3, from Wave 3)
        │     → notification_log IS auditable, but nothing reads it (§5)
        │
        ├── Holiday plan publication ──────────────── AUDITABLE, actor-tagged (teacher vs auto)
        ├── Report card publication ───────────────── PARTIAL (timestamp yes, actor no)
        ├── Promotion ──────────────────────────────── AUDITABLE, actor-attributed — but UNREACHABLE from any UI (Wave 2)
        ├── Term rollover ──────────────────────────── NOT AUDITABLE (boolean flip, §5)
        └── Teacher intervention ───────────────────── AUDITABLE data, but no UI writes to it (Wave 2)
```

Two threads run through this map: (a) several actions are auditable in the database but have no UI that reads or acts on that history, and (b) two actions (assessment corrections, term rollover) aren't auditable at all yet. Neither requires new architecture to fix.

## 3. Notification Verification (from Wave 3, reconfirmed unchanged)

| Claim | Verdict |
|---|---|
| "Teacher has been notified" (parent WhatsApp reply ack) | **False promise** — `parent.observation.submitted` event has zero subscribers |
| "Full report sent to your email" (WhatsApp template) | **False promise** — hardcoded regardless of whether email was attempted |
| "Email Sent"/"WhatsApp Sent" status badges | **False promise, real bug** — `Promise.allSettled` results unpacked by fixed array position while the job array is built conditionally; results can be silently swapped |
| "Parents will be notified automatically" | **Partially true** — true only for opted-in parents with contact info, no caveat shown |
| Holiday publish, CSV upload counts, Academy completion badges, lesson-progress saves, Monday Panel milestone flag | **True** (7 of 11 checked claims) |

No new notification claims were found this wave requiring separate verification — the 11-claim inventory from Wave 3 remains the complete, current picture.

## 4. Automation Verification (from Wave 3, reconfirmed unchanged)

18 `app/api/cron/*` routes exist. 7 are scheduled and operational (4 via `vercel.json`, 3 via a GitHub Actions workaround built specifically to route around Vercel Hobby's cron cap). **Parent Pulse, term-readiness, and Academy nudge are confirmed to never fire in production** — complete, correctly secret-gated route code that neither scheduler ever calls. 7 further crons (dlq-requeue, billing-renewals, cleanup-users, quota-alerts, snapshot-metrics, sandbox-reset, study-group-challenges) are also unscheduled but lower-priority for a pilot. No retry behavior exists anywhere (confirmed by grep in Wave 3 — zero `retry`/`attempt` logic in the WhatsApp sender). No failure is logged anywhere a human would see it without querying the database directly; no error-tracking package exists in the repo.

## 5. Audit Trail Review (new this wave)

| # | Action | Audit trail? | Evidence | Verdict |
|---|---|:---:|---|---|
| 1 | Assessment entry/correction | **No** | `bulkSaveMarks` deletes then re-inserts; `upsertMarksCSV` overwrites in place. No `assessment_audit`/`marks_history` table anywhere in the schema | A correction destroys the prior value with zero trace |
| 2 | Projection recomputation | **Yes** | `evidence_projection_events.processed_at`/`metadata`, `learner_projections.last_computed`/`supporting_evidence_ids` | Fully reconstructable |
| 3 | Career update | **Yes** | `capability_history` — full jsonb snapshot per computation, queryable by student, RLS-gated for student self-read | Real time-series, not fire-and-forget |
| 4 | Holiday plan publication | **Yes** | `emitHolidayPlanPublished()` tags `trigger: 'teacher'|'auto'`, lands in `platform_events`, queryable by `resource_id` | Distinguishes teacher approval from the 3-day auto-fallback |
| 5 | Report publication | **Partial** | `school_report_cards.is_published`/`published_at`/`generated_at` exist; **no `published_by` actor column anywhere** | Answers "when," not "who" |
| 6 | Parent communication | **Yes** | `notification_log` (singular table name) has recipient, channel, timestamp, success/failure, `error_message` | Schema is complete — the gap (Wave 3) is that nothing reads it, not that it's unauditable |
| 7 | Promotion | **Yes** | `learner_promotions`, explicitly commented "full audit trail," actor-attributed via `processed_by` (NOT NULL FK) | Complete — but recall from Wave 2 the API itself has zero UI callers, so this trail currently records nothing in practice |
| 8 | Term rollover | **No** | `terms`/`academic_years.is_current` is a plain boolean flip via `clearCurrentTerm`/`setCurrentTerm`, no actor, no history table, no event emitted | The prior "current" term is overwritten with no trace of who triggered the transition or when, beyond a generic `updated_at` |
| 9 | Teacher intervention | **Yes** | `intervention_log` — before/after risk and knowledge levels, `teacher_outcome`, computed `was_effective`, indexed | Genuine audit trail — separate from the missing check-in UI (Wave 2), the underlying data model is sound |

**6 of 9 fully auditable, 1 partial, 2 real gaps** (assessment corrections, term rollover) — both fixable with a small additive schema change (an audit table or a `published_by`/history column), not a redesign.

## 6. Status Badge Verification (from Wave 3, reconfirmed)

Same finding as §3's third row: the "Email Sent"/"WhatsApp Sent" badges are the one confirmed case of a status badge not corresponding to real backend state, due to the positional-unpacking bug. All other checked completion badges (Academy modules/certificates, CSV upload results, holiday publish) were verified to derive from real, server-confirmed state with no optimistic pre-confirmation.

## 7. Failure Visibility Review (from Wave 3, reconfirmed)

- **Can the teacher know?** No — no in-app notification center exists; failures are invisible unless a teacher notices a missing/wrong status badge.
- **Can the administrator know?** No — no admin page surfaces cron failures, WhatsApp send failures, or `notification_log` contents.
- **Can support diagnose it?** Only by directly querying the database or reading raw Vercel function logs — no structured error tracking (Sentry or equivalent) exists anywhere in the repo.
- **Can the platform retry safely?** No — confirmed zero retry logic in the WhatsApp send path; a failed send is recorded to `notification_log` and never attempted again.

## 8. Educational Reality Confirmation (new this wave)

Verified at the UI/workflow layer specifically (distinct from the computation-layer verification already done in the intelligence-convergence waves):

| Feature | Exam-only verdict |
|---|---|
| Monday Panel | **Works correctly** — core risk layer runs entirely off Projection; bonus layers (teaching patterns, prerequisite alerts) degrade to empty arrays gracefully, panel still renders |
| Blueprint | **Works correctly** — falls back from a Grade-7-only substrand path to capability-dimension analysis when quick-wins are empty |
| Career Explorer | **Works correctly** — the one real gate requires "at least one assessment" (any type), satisfied by a single exam mark; the entrepreneurial tier's 2-assessment floor is a legitimate confidence gate, not a topical-assessment requirement |
| Holiday Planner | **Works correctly** — prior-wave fix already landed (subject-level, not substrand-level, priority gaps) |
| Remedial Planner | **Works correctly** — operates on Projection-driven risk lists, no topical-specific fields found |

No feature silently blocks or empties for exam-only evidence. Every "insufficient evidence" string found is a per-claim confidence caveat shown alongside working output, matching the Constitution exactly. **No remediation needed here.**

## 9. Trust Risk Ranking

Unchanged from Wave 3, now with two additions from this wave's audit-trail review:

1. Swapped email/WhatsApp status badges — highest impact, an active incorrect claim (Wave 3)
2. False "teacher has been notified" promise to a parent (Wave 3)
3. Three orphaned notification crons implying weekly/termly contact that never happens (Wave 3)
4. False "sent to your email" WhatsApp line (Wave 3)
5. No operational visibility — compounds every risk above by making them undetectable during a pilot (Wave 3)
6. **New: assessment mark corrections have zero audit trail** — if a mark dispute arises during a pilot (a parent or teacher questioning a grade), there is no way to prove what the original value was
7. **New: term rollover has no actor/history** — lower likelihood of surfacing during a single-term pilot, but a real gap if a rollover ever needs to be investigated or reversed
8. Intervention workflow dead end (Wave 2/3)
9. Report card publication missing an actor column — lowest priority of the new findings, "when" is preserved even without "who"

## 10. Recommended Quick Fixes (smallest safe, reusing existing services — not implemented this wave)

Carried forward from Wave 3 (unchanged, still the highest priority):
1. Fix the positional-destructuring bug in `lib/academicClinic/assessmentPipeline.ts` — match results to channels by key, not array position.
2. Remove/condition the hardcoded "sent to your email" WhatsApp line on whether email was actually attempted.
3. Fix or soften the "teacher has been notified" copy in `observationPipeline.ts`.
4. Schedule `parent-pulse`/`term-readiness`/`academy-nudge`, or remove any implication they run.

New this wave, same "smallest safe" standard:
5. Add a `published_by` column to `school_report_cards`, populated from the existing end-of-term actor context — no new table needed.
6. Add a lightweight `assessment_marks_history` table (or reuse the existing audit-log pattern already proven for `intervention_log`/`capability_history`) populated on `bulkSaveMarks`/`upsertMarksCSV` before overwrite — reuses an existing, already-trusted pattern rather than inventing a new one.
7. Add a `term_transitions` table (or an event emission via the existing `publishEvent()` mechanism, matching the pattern already used for holiday-plan publication) recording who/when a term rollover occurred — reuses `lib/events/` infrastructure that already exists.

## 11. Regression Results

- **TypeScript**: identical to the established baseline across every prior wave — the same 3 pre-existing script-only errors, zero new errors. No code changed this wave.
- **ESLint**: zero errors across `lib/` and `app/`.
- **Production build**: compiles successfully (Turbopack, 20.0s); the TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error, unchanged since Wave 1.

## 12. Final: CONDITIONAL GO

This wave confirms Wave 3's trust assessment holds unchanged, and adds two specific, small, fixable audit-trail gaps rather than any new blocker. The educational-reality check (§8) came back fully clean — exam-only schools are not disadvantaged anywhere in the UI layer, confirming the Constitution's Reality Principle holds end-to-end, from computation (prior waves) through to what a teacher actually sees. The condition for full GO remains exactly what Wave 3 named: fix the swapped status-badge bug, the two false promises, and the three silently-dead crons — joined by this wave's two additions (report-card actor attribution, assessment/term-rollover history) as good, cheap, do-before-pilot practice rather than launch blockers on their own. None of these require new architecture, new intelligence, or new engines — every fix reuses a pattern (event emission, audit tables) already proven elsewhere in this same codebase.
