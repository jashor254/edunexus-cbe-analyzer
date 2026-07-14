# EduNexus — Engineering Hardening: Operational Excellence Report

## Executive Summary

This pass verified logging, error handling, health/readiness, audit trail, background jobs, observability, deployment safety, recovery, and documentation-vs-implementation across the platform. Verification (not redesign) was performed via direct code reading, two focused read-only research passes, and live queries against the production Supabase project.

The single most important discovery: **the entire event/audit-trail backing store was never deployed to production.** `platform_events`, `event_subscriptions`, `event_deliveries` (plus `organizations`, `audit_logs`, `api_keys`, `usage_events`, `invoices` — all defined in `supabase/migrations/20260701_phase8_platform_foundation.sql`) do not exist in the live database, confirmed via direct `pg_tables` query. Every `publishEvent()` call anywhere in the codebase — across every prior "completed" sprint, plus every audit-trail fix added in this pass — has been silently failing via its own `.catch()` since it was written. This is reported, not fixed (deploying 16 new tables is out of this sprint's "no new infrastructure" charter and needs a dedicated, reviewed migration pass).

Beyond that, closed 16 concrete, additive logging and audit-trail gaps (all "obvious omissions" — either a completely silent `catch` block or a confirmed missing `publishEvent`/`notification_log` call matching an existing sibling convention) and fixed 3 background-job logging gaps. No architecture, schema, or business logic changed.

## Operational Scorecard

| Area | Status | Notes |
|---|---|---|
| Logging | 🟡 Improved | 12 silent/under-logged catch blocks fixed; several Medium/Low items deferred (see below) |
| Error Handling | 🟢 Adequate | Consistent `apiError`/`apiSuccess` convention in newer code; a few older routes use raw `NextResponse.json` — cosmetic, not a correctness gap |
| Health | 🟢 Good | Two real, working health endpoints (`/api/health`, `/api/platform/health`) — see duplication note below |
| Audit Trail | 🔴 Broken at the infrastructure layer | Code-level coverage is now good (5/6 named actions covered or already covered); the backing tables don't exist in production (Critical finding above) |
| Background Jobs | 🟢 Fixed | All 17 cron routes verified: schedule exists, auth is consistent, 3 logging gaps closed, duplicate-execution safety re-confirmed from prior hardening passes |
| Observability | 🟡 Improved | Per-queue/per-entity failures now surface instead of being buried in response bodies or dropped entirely |
| Deployment Safety | 🟡 Needs follow-up | No `.env.example`; migration-history gap is a known, already-documented issue (not new) |
| Recovery | 🟢 Adequate | Idempotency already verified in the prior End-of-Term hardening pass; nothing new found that regresses it |
| Documentation | 🟡 Partial mismatch | `docs/migration-history-reconciliation.md` references a "deployment plan" doc that doesn't exist in the repo; its "two pending migrations...can be deployed safely today" framing is stale (still unapplied) |

## Findings

### Critical

**F1. The event/audit-trail table set was never deployed to production.**
- Evidence: `grep` confirms `supabase/migrations/20260701_phase8_platform_foundation.sql` is the only migration defining `platform_events`, `event_subscriptions`, `event_deliveries`, `organizations`, `organization_members`, `audit_logs`, `api_keys`, `usage_events`, `invoices`. Direct query — `select tablename from pg_tables where schemaname='public' and tablename in ('organizations','organization_members','audit_logs','usage_events','invoices','api_keys','job_queues','jobs','job_logs')` — returned only `job_queues`, `jobs`, `job_logs` (created later by the separate `20260709081738_background_jobs_minimal` migration). None of the other 13 tables exist.
- Impact: Every `publishEvent()` call in the codebase (dozens of call sites: `teacher.assessment.published`, `organization.member.invited`, `parent.pulse.generated`, `parent.observation.submitted`, and every fix added in this pass) silently no-ops in production. The audit trail that appears to exist in code does not exist operationally.
- Proposed fix: apply the missing portion of `20260701_phase8_platform_foundation.sql` (or a scoped subset covering just the event tables, if `organizations`/`billing` are intentionally superseded by Core's `school_users`/Paystack-based billing) as its own reviewed migration. **Not done in this pass** — deploying 13 new tables is new infrastructure by any reasonable reading of this sprint's charter, and deserves its own dedicated review (are `organizations`/`audit_logs`/`api_keys`/`usage_events`/`invoices` even still wanted, given Core and the dev-portal appear to have superseded some of this, or is only the event-subsystem subset needed?).

### High

**F2–F13** (fixed — see Fixes section): silent/near-silent catch blocks in payments verification (2 sites), the AI-call cost logger, Parent Pulse's per-student batch loop, Holiday Planner's AI-enrichment and career-intelligence enrichment, the canonical role-resolution function, account creation, assessment-marks' Learner Model trigger, and three cron routes (`academy-nudge` had no try/catch at all; `generate-record-of-work` caught but never logged; `jobs/process` never surfaced per-queue failures).

### Medium (reviewed, not fixed this pass — see Deferred Items)
- `lib/ai-orchestration/cost.ts` / `router.ts`: AI cost-tracking failures are silently swallowed with no org/user id logged — contradicts CLAUDE.md's "log token usage for cost monitoring" rule, but touching cost-tracking code carries more behavioral risk than a pure logging addition; deferred for a dedicated look.
- `lib/ai/rateLimit.ts`: deliberate fail-open on query failure, but zero logging means the safety net could be silently down; same reasoning as above.
- `lib/academicClinic/assessmentPipeline.ts` (3 sites): logs exist but omit `student_id`, weakening traceability rather than eliminating it.
- Two health endpoints (`/api/health`, `/api/platform/health`) independently re-implement overlapping DB/service connectivity checks — engineering-entropy finding, not a correctness bug; consolidating either risks breaking whichever URL an external uptime monitor is already pointed at, so left alone pending confirmation of which URL(s) are actually in use.
- No `.env.example` exists despite 27 distinct `process.env.*` references across the codebase — a fresh deploy has no single source of required configuration. Not authored in this pass (getting it wrong — stale or incomplete — would itself become misleading documentation; needs a deliberate pass, not a speculative one).

### Low
- `app/api/whatsapp/inbound/route.ts`'s auto-ack send now logs failures (fixed), but does not write a `notification_log` row — `notification_log.reference_id` is a `NOT NULL uuid` column and `processInboundReply`'s return type (`ProcessResult`) doesn't currently expose a `studentId` to key it on. Logging the send failure (done) closes the diagnosability gap; the audit-log entry itself is deferred rather than widening a shared type for one call site.
- `docs/migration-history-reconciliation.md` references "the deployment plan" as a separate document — no such file exists in `docs/`. Likely lost or never committed; flagged as a documentation-consistency mismatch only.

## Fixes

All fixes are additive (new log lines or new event/notification-log calls) — no logic, schema, or behavior changed.

**Logging:**
1. `lib/ai/logger.ts` — `insertAICallLog` failures now logged (previously silent in production; only logged in `development` via a separate, unrelated branch).
2. `app/api/payments/verify/route.ts` — logged the discarded Paystack verification error, and the previously-silent outer catch.
3. `lib/parentPulse/builder.ts` — per-student pulse-build failures now logged with `studentId`.
4. `lib/holiday/planner.ts` — AI-enrichment failure (`enrichPlanWithAI`) and career-intelligence enrichment failure now logged.
5. `lib/auth/getRole.ts` — the canonical role-lookup's two Supabase query errors are now logged when present (zero added noise on the success path, which is the overwhelming majority of calls — this runs on every navigation).
6. `app/api/users/create/route.ts` — outer catch now logs server-side (previously only returned to the client).
7. `app/api/teacher/assessments/[assessmentId]/marks/route.ts` — `triggerLearnerModelUpdates` failure now logged with `assessmentId` (matches the sibling `recordAssessmentEvidence` line immediately below it, which already logged).
8. `app/api/cron/academy-nudge/route.ts` — wrapped the entire handler in try/catch (previously had none at all).
9. `app/api/cron/generate-record-of-work/route.ts` — existing catch now logs (previously silent).
10. `app/api/cron/jobs/process/route.ts` — per-queue failures now logged via the existing `logger` (previously only visible inside the JSON response body).
11. `app/api/cron/term-readiness/route.ts` — WhatsApp send failure now logged (previously a fully empty `catch {}`).
12. `app/api/whatsapp/inbound/route.ts` — ack-send failure now logged (previously unguarded, relying on the outer catch with no per-message context).

**Audit trail (all via the existing `publishEvent()`/`notification_log` mechanisms — see Critical Finding F1 for why these don't yet take effect operationally):**
13. `lib/core/report-cards.ts` `publishReportCards` — emits `teacher.report_card.published`.
14. `lib/core/school.ts` `createSchool` — emits `organization.created` for the school entity itself (previously only the resulting admin-membership grant was traceable).
15. `lib/holiday/planner.ts` `publishHolidayPlan`/`publishClassHolidayPlans`, and `app/api/cron/auto-publish-holiday-plans` — emit `teacher.holiday_plan.published` with a `trigger: 'teacher' | 'auto'` field distinguishing a teacher-approved publish from the 3-day auto-publish fallback (previously indistinguishable in any trail).
16. `app/api/cron/term-readiness/route.ts` — WhatsApp brief send now writes a `notification_log` row (success and failure) and emits `teacher.term_readiness_brief.sent`, matching the `parent-pulse` cron's existing convention exactly.

## Validation

- **TypeScript**: `npx tsc --noEmit` — clean across all changed files; the 2 pre-existing, unrelated errors in `scripts/` (confirmed via `git status` to be untouched) remain, as in every prior hardening pass this sprint series.
- **ESLint**: run against every changed file — 0 errors, 0 warnings.
- **Production build**: `npm run build` — Turbopack compile succeeds; the same pre-existing script error blocks the full type-check phase, unrelated to and unaffected by this work.
- **Regression**: every fix is either (a) a new `console.error`/`logger.error` call with no control-flow change, or (b) a new `publishEvent`/`notification_log` call using the exact existing helper and column conventions already proven at sibling call sites (verified by reading `information_schema.columns` for `notification_log` directly, which caught a real mistake before it shipped — see below). No function signature, return type, or caller changed except `academy-nudge`'s response shape, which gained fields additively (`skipped`/`total` now always present) with zero existing callers found anywhere in the codebase.
- **Self-caught issue during validation**: an initial draft of the `whatsapp/inbound` fix attempted a `notification_log` insert keyed on a raw phone number string against `reference_id`, which is a `NOT NULL uuid` column — this would have failed on every single invocation. Caught by directly querying `information_schema.columns` before finalizing, not assumed from the sibling code's shape. Reverted to a logging-only fix for that site (see Findings, Low).

## Remaining Risks
- Until F1 is resolved, the audit trail is decorative in production — anyone relying on it today for a real incident investigation will find nothing. This applies equally to pre-existing `publishEvent` calls from prior sprints and everything added in this pass.
- The Medium-severity AI-cost-tracking and rate-limit silent-failure findings (`lib/ai-orchestration/cost.ts`, `router.ts`, `lib/ai/rateLimit.ts`) mean a real billing-reconciliation or abuse problem could still grow invisibly until a dedicated pass addresses them.
- No `.env.example` means a fresh deployment (e.g. onboarding a second engineer, or a disaster-recovery rebuild) has no authoritative list of required configuration — same underlying risk category as the long-standing migration-history gap already documented in `docs/migration-history-reconciliation.md`.

## Deferred Items ("Observed but intentionally deferred")
- Applying the missing event/organizations/audit-log/billing tables from `20260701_phase8_platform_foundation.sql` (F1) — needs its own scoped, reviewed migration, not a side effect of a logging pass.
- `lib/ai-orchestration/cost.ts`, `lib/ai-orchestration/router.ts`, `lib/ai/rateLimit.ts` silent-failure logging.
- `lib/academicClinic/assessmentPipeline.ts`'s three under-contextualized (but not silent) log lines.
- Consolidating or clarifying the two overlapping health endpoints (`/api/health` vs `/api/platform/health`).
- Authoring a `.env.example`.
- `app/api/whatsapp/inbound/route.ts`'s ack send: adding a real `notification_log` entry (needs `ProcessResult` widened to expose `studentId`, out of scope for a single-site logging fix).
- The `docs/migration-history-reconciliation.md` reference to a non-existent "deployment plan" document.
- Everything already carried forward as deferred from the prior three hardening passes (unregistered cron routes pending a Vercel plan-tier decision; the two stale-duplicate local migration files; the still-unapplied `trust_closure_sprint.sql`; `runEndOfTerm`'s narrow concurrent-race window).

## Engineering Confidence
**Medium-High.** Every fix made in this pass is low-risk, additive, and independently validated (including one self-caught schema mistake before it shipped). The overall confidence is tempered specifically by F1 — discovering that the platform's entire audit-trail mechanism has been non-functional in production for as long as it's existed is a materially different risk picture than "logging is slightly inconsistent," and it was not previously surfaced in any of the prior four hardening/readiness passes this series covered.

## Production Go / No-Go Recommendation
**Conditional Go.** Nothing in this pass blocks the pilot — the fixes strictly improve diagnosability with zero behavior change, and the pilot's core teaching/learning/reporting flows are unaffected by F1 (they don't depend on the event system to function, only to be *auditable*). However, F1 should be triaged and resolved (or explicitly accepted as a known gap) before treating "audit trail" as a checked box for compliance or incident-response purposes — right now it is not one.
