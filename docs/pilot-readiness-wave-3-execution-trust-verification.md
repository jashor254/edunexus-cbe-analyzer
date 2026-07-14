# EduNexus — Pilot Readiness Wave 3 Report

**Pilot Execution & Trust Verification**
Date: 2026-07-12
Branch: `fix/sprint15-rls-recursion-storage-grants`
Scope: audit only, no code changed. Final operational verification before real pilot schools, following Pilot Readiness Waves 1 (teacher journey) and 2 (classroom operations). This wave asks one question: can EduNexus support one complete school term without breaking a teacher, parent, or principal's trust — by verifying every automated promise actually happens, and ranking every gap found by trust impact rather than technical severity.

---

## 1. Executive Summary

This wave definitively resolves a question Wave 2 could only hedge on: **Parent Pulse, the term-readiness brief, and the Academy reflection nudge will not fire in production, full stop.** Their route code is complete and correctly secret-gated, but neither `vercel.json` nor the GitHub Actions workflow that was specifically added to work around Vercel's Hobby-plan cron cap ever calls them. This is not a timing or frequency problem — it is three fully-built features that currently do nothing.

More consequential than any missing feature: this wave found a **real, reproducible bug that produces an actively false status in the teacher UI**, not just a missing one. In `lib/academicClinic/assessmentPipeline.ts`, notification jobs (email, WhatsApp) are built conditionally — only pushed into an array if that channel is actually eligible — but their results are then unpacked by fixed array position (`const [emailResult, whatsappResult] = ...`). When only WhatsApp is eligible (the common case for phone-only parents), `emailResult` silently becomes the WhatsApp result and `whatsappResult` becomes `undefined`. A teacher can see "Email Sent" for a parent who was never emailed, while the successful WhatsApp send is marked as not sent. This is worse than a missing feature — it is the platform actively telling a teacher something false, in a UI they're expected to trust.

A third, related finding: the WhatsApp report-ready template unconditionally claims "Full report sent to your email" regardless of whether an email was ever attempted, compounding the same failure mode from the parent's side.

On the reassuring side: a broad sample of 32 UI-to-backend calls across teacher/parent/student pages found **zero broken links** — every route exists, is fully implemented, and matches what the UI expects. The two most-used admin pages (`app/admin/page.tsx`, `app/admin/pilot/page.tsx`) are genuinely complete workflows with real confirmations. Eight of eleven checked user-facing "completion" claims (holiday plan publish, CSV upload results, Academy completion badges/certificates, lesson-progress saves) were verified **True** — the platform does not lie about most of what it claims.

The most severe operational gap for a live pilot: **there is no error-tracking integration anywhere, no cron-run log, and the one table that does record WhatsApp send failures (`notification_logs`) is written to but never read by any page** — if something breaks during the pilot, the EduNexus team would have no way to know without manually querying the database.

**Verdict: CONDITIONAL GO** — the platform will not lose a pilot before it starts, but three specific, cheap-to-fix trust risks (the swapped notification-status bug, the false "sent to your email" claim, and the three orphaned crons) should be fixed or explicitly disabled before real parents and teachers can observe them.

---

## 2. Operational Trust Audit — Automation Verification

Every `app/api/cron/*` route (18 total), definitively classified — not sampled, not hedged:

| Route | Configured | Scheduled | Reachable | Operational in prod |
|---|---|---|---|---|
| `friday-generation` | Yes | Yes — `vercel.json` | Yes | **Yes** |
| `generate-record-of-work` | Yes | Yes — `vercel.json` | Yes | **Yes** |
| `auto-publish-holiday-plans` | Yes | Yes — `vercel.json` | Yes | **Yes** |
| `ai-log-retention` | Yes | Yes — `vercel.json` | Yes | **Yes** |
| `events/dispatch` | Yes | Yes — GitHub Actions, every 5 min | Yes | **Yes** (workflow fails loudly on non-200) |
| `jobs/process` | Yes | Yes — GitHub Actions | Yes | **Yes** |
| `projection-events/process` | Yes | Yes — GitHub Actions | Yes | **Yes** |
| **`parent-pulse`** | Yes | **No — in neither scheduler** | Yes (guard exists, unused) | **No — will not fire** |
| **`term-readiness`** | Yes | **No — in neither scheduler** | Yes | **No — will not fire** |
| **`academy-nudge`** | Yes | **No — in neither scheduler** | Yes | **No — will not fire** |
| `dlq-requeue`, `billing-renewals`, `cleanup-users`, `quota-alerts`, `snapshot-metrics`, `sandbox-reset`, `study-group-challenges` | Yes (all 7) | No (all 7) | Yes (all 7) | No (all 7) — not this wave's priority, but confirmed unscheduled |

`vercel.json`'s 4-entry cap plus the GitHub Actions workaround (added specifically to route around the Vercel Hobby plan's cron limit) together cover exactly the routes that were prioritized when that workaround was built — parent-pulse/term-readiness/academy-nudge were never added to either. **No failure visibility exists**: no Sentry/error-tracking package anywhere in the repo, no `cron_runs`/`job_log` table — the only visible failure signal is a GitHub Actions run failing (for 3 routes only) or a `console.error` line in Vercel's function logs, which nobody is proactively watching.

## 3. False Promise Inventory

Eleven distinct user-facing "this happened" claims traced end-to-end:

| # | Claim | Location | Verdict |
|---|---|---|---|
| 1 | "[Child]'s teacher has been notified" (parent WhatsApp reply ack) | `lib/parentPulse/observationPipeline.ts:275` | **False promise** (confirmed Wave 2) — the event it should trigger has zero subscribers anywhere |
| 2 | "Full report sent to your email" (WhatsApp report template) | `lib/whatsapp/reportNotify.ts:38` | **False promise** — hardcoded unconditionally regardless of whether email was attempted or has a valid address on file |
| 3 | "Email Sent" / "WhatsApp Sent" status badges on report delivery | `lib/academicClinic/assessmentPipeline.ts:241-274`, rendered in `app/teacher/reports/page.tsx`, `app/teacher/classes/[classId]/page.tsx` | **False promise — real bug**, not just a gap: `notifyJobs` is built conditionally but `Promise.allSettled` results are unpacked by fixed position (`[emailResult, whatsappResult]`), so when only one channel is eligible, results are silently swapped. A teacher can see the wrong channel marked "sent." |
| 4 | "Parents will be notified automatically" (after bulk report generation) | `app/teacher/classes/[classId]/page.tsx:520` | **Partially true** — true only for opted-in parents with contact info on file; the teacher isn't told which students' parents will get nothing |
| 5 | Holiday plan publish confirmation | `app/api/holiday/publish/route.ts`, `lib/holiday/planner.ts` | **True** — server-verified ownership, real row count returned, no optimistic UI |
| 6 | CSV bulk-upload result counts (imported/updated/skipped/errors) | `app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx:498-524` | **True** |
| 7 | "Scheme saved to My Schemes and downloaded!" | `app/teacher/scheme-of-work/new/page.tsx:444` | **True** |
| 8 | Academy module/lesson "Completed" badges | `app/teacher/academy/page.tsx`, `module/[slug]/page.tsx` | **True** — server-computed from real progress records |
| 9 | Academy certificate completion claim | `app/teacher/academy/certificate/CertificateClient.tsx` | **True** |
| 10 | "Lesson progress recorded successfully" | `app/api/academy/progress/route.ts:63` | **True** |
| 11 | Monday Panel milestone "notified" flag | `app/api/teacher/monday-panel/route.ts:228-260` | **True** (narrow scope — means "shown in this panel," not "parent was messaged," and doesn't overstate) |

**8 of 11 True, 1 Partially true, 3 False promises** (one previously known, two newly confirmed this wave) — all three false promises sit inside the same two-file notification pipeline (`assessmentPipeline.ts` → `whatsapp/reportNotify.ts` and `parentPulse/observationPipeline.ts`), making that pipeline the highest-concentration trust risk in the codebase.

## 4. Backend/UI Coverage

**Backend with no reachable UI** (carried forward and confirmed from Waves 1–2, not re-derived): grade promotion (`lib/core/promotions.ts`, zero callers), the Principal dashboard (`buildPrincipalDashboard()`, zero pages), 9 of 10 `app/api/core/*` routes, the Academic Clinic `assessments` table (no teacher-facing writer), the intervention check-in API (zero UI callers).

**UI with no working backend** (new this wave): sampled 32 `fetch('/api/...')` calls across teacher/parent/student pages — **zero broken links found**. Every target route exists, is fully implemented (not a stub/TODO/501), and does real auth + DB work. This is a genuinely clean result — the "UI with no backend" failure mode does not occur on the surfaces sampled.

**Recommended smallest safe connection** for the backend-with-no-UI items: none require new intelligence or schema — per Wave 2, the fix is either building a minimal admin form (promotion, principal dashboard) or explicitly retiring the route. This wave adds no new items to that list, only confirms the sampled UI surface has no equivalent problem in the other direction.

## 5. Workflow Completion Matrix

Beginning → middle → end, per role:

| Role | Workflow | Beginning | Middle | End | Verdict |
|---|---|---|---|---|---|
| Teacher | Plan → Teach → Assess | Clear | Clear, mostly automatic feed-forward | Clear (marks saved, grades computed) | **Complete** |
| Teacher | Risk flag → Intervention | Clear (Monday Panel) | **Breaks — no logging UI reachable from the panel** | N/A | **Abandoned** (Wave 2 finding, unchanged) |
| Parent | Report card / holiday plan delivery | Clear | **Compromised by §3 items 2-3 — status may be shown incorrectly** | Parent can view via link | **Complete, but untrustworthy in the false-status case** |
| Parent | "Struggled" reply → teacher awareness | Clear (parent replies) | **Breaks — event has no subscriber** | N/A | **Abandoned** (§3 item 1) |
| Student | Compass / Academy learning loop | Clear | Clear, real progress tracking | Clear, verified-true completion badges | **Complete** |
| School Leader | Principal oversight | N/A | N/A | N/A | **Never begins — no UI exists at all** |
| Administrator | Platform-level admin (grant access, pilot tracking) | Clear | Clear | Clear, with live status updates | **Complete** |
| Administrator | Core school onboarding | Clear (form) | N/A | **No confirmation, no way to see the created school afterward** | **Abandoned at the end** |

4 of 8 traced workflows are fully complete; 2 are abandoned mid-flow (both previously known, now precisely located); 1 never begins (Principal); 1 is complete but ends on unreliable information.

## 6. Trust Risk Ranking

Ranked by capacity to make a real user lose confidence in the platform, not by engineering severity:

1. **Swapped email/WhatsApp status badges (§3 item 3).** A teacher who trusts a "sent" badge and later learns it was wrong loses confidence in every other status the platform shows them — this is the single highest-trust-impact finding in three waves of audit, because it is an *active incorrect claim*, not a missing feature.
2. **False "teacher has been notified" promise to a parent (§3 item 1).** A parent who believes their concern was escalated, when it structurally cannot have been, is a direct trust violation with a real child's wellbeing implicitly at stake.
3. **Three orphaned notification crons (§2).** If a pilot school is told (even informally) to expect weekly parent updates or term-start briefs, and they simply never arrive, the platform looks broken or abandoned rather than incomplete.
4. **False "sent to your email" WhatsApp line (§3 item 2).** Same failure family as #1 — compounds it for the same parent in the same message.
5. **No operational visibility (§2, §4).** Not directly user-facing, but it means every risk above could persist for an entire pilot term undetected by the EduNexus team, since nothing surfaces `notification_logs` failures or cron non-execution to a human.
6. **Intervention workflow dead end (§5).** A teacher who thoughtfully logs a risk observation and finds no way to track its resolution will stop trusting the "intelligence" layer's usefulness, even though the underlying computation (Waves 1-3 of the intelligence series) is sound.
7. **Core school onboarding form with no follow-through (§5).** Lowest priority — admin-only, low frequency, not visible to teachers/parents/students.

## 7. Quick Wins (small, safe — not implemented this wave, audit only)

1. Fix the positional-destructuring bug in `lib/academicClinic/assessmentPipeline.ts` — match each `Promise.allSettled` result back to its channel by index/key instead of fixed position. This is a small, isolated, high-value fix.
2. Remove or condition the hardcoded "Full report sent to your email" line in `lib/whatsapp/reportNotify.ts:38` on whether an email was actually attempted.
3. Fix or soften the "teacher has been notified" copy in `observationPipeline.ts:275` (carried from Wave 2, now confirmed at higher priority).
4. Either schedule `parent-pulse`, `term-readiness`, and `academy-nudge` (add to `vercel.json` or extend the GitHub Actions workflow), or remove any code comments/documentation implying they run, so nobody — pilot staff included — assumes they're live.
5. Add a caveat to the "Parents will be notified automatically" teacher-facing message, or list which students' parents won't be reached.

## 8. Deferred Items (larger, needs a product decision)

1. Build a minimal operator-visible view of `notification_logs` (WhatsApp/email failures) and cron execution — currently a completely blind spot for the whole pilot period.
2. Add basic error-tracking (even a free-tier Sentry integration) before a real pilot, given zero exists today.
3. Wire the intervention check-in API into the Monday Panel UI (carried from Waves 1–2).
4. Decide the fate of the Core module and Principal dashboard (carried from Wave 2).
5. Add a confirmation/follow-through step to Core school onboarding (`app/admin/core-schools/new/page.tsx`).
6. Add retry logic (or at minimum a visible failure state) for WhatsApp sends — confirmed zero retry exists today.

## 9. Regression Results

- **TypeScript**: identical to the established baseline across all prior waves — the same 3 pre-existing script-only errors, zero new errors. No code changed this wave.
- **ESLint**: zero errors across `lib/` and `app/`.
- **Production build**: compiles successfully (Turbopack, 20.9s); the TypeScript pass fails only on the same pre-existing `scripts/create-compass-auto-confirm-account.ts` error, unchanged since Wave 1.

## 10. Final: CONDITIONAL GO

EduNexus will not fail a pilot term on missing intelligence — Waves 1–3 of the implementation series already established the underlying computation is sound and converges to one truth everywhere it's read. What this wave found is narrower and more fixable: a real bug that shows teachers an incorrect status, a false claim sent directly to parents, a matching false claim about email delivery, and three fully-built notification features that silently never run. None of these require an architecture change — items 1-4 in §7 are copy fixes and one array-indexing bug, all small and safe by this wave's own mandate. They should land before a real pilot, specifically because this wave's guiding principle is that trust, once broken by a provably false status a teacher or parent can catch, is far more costly to rebuild than a missing feature ever was. With those four fixes in place, the platform is ready to support a full pilot term without a promise it cannot keep.
