# EduNexus Growth Engine — Implementation Blueprint (Sprint 0 → v1.0)

**Status:** Execution plan only. The architecture is frozen at `docs/growth-os/edunexus-growth-engine-specification.md` ("the Spec"). This document introduces **zero** new modules, entities, or requirements — every sprint below traces to a table, screen, or rule already defined in the Spec. Where this document deviates from a literal reading of the Spec (e.g. deferring `growth_pipeline_stages` to a trigger-based sprint), that deviation was already specified in the Spec itself (§15 Phase 0/1), not invented here.

**Role of this document:** answer "in what order, and how small a slice at a time, does a solo founder actually build this without ever having an undeployable branch." Nothing here is a design decision — every design decision was made in the Spec.

---

## 0. Ground Rules Carried Forward From the Spec

- One bounded context: `growth_*` tables, `lib/growth/`, `app/api/growth/`, `app/(growth)/` route group. Zero imports from learner-intelligence code (`lib/projection/`, `lib/intelligence/`, `lib/learnerRecord/`, `lib/career/`) and zero imports the other direction.
- Every sprint ends with a deployable `main`. "Deployable" means: builds, passes existing test suite, RLS is never weaker after the sprint than before it, and any half-built screen is either behind a route that only the founder's own `growth_users` row can reach, or simply not linked from navigation yet (an unlinked route is not a security boundary — RLS is the boundary, not obscurity; so unfinished screens still get real auth checks from day one).
- Existing platform conventions are reused, not reinvented: the repository pattern already in `lib/repositories/` (`learner.repository.ts`, `school.repository.ts`, `assessment.repository.ts`), the route-level HTTP test harness already in `lib/testing/httpAuthTestHelper.ts`, the existing `publishEvent()` event bus, the existing cron-secret pattern for scheduled jobs, `createServiceClient()` / `createClient()` factories, Zod validation on every route input, explicit-column selects, no `any`.

---

## 1. Repository Structure

```
app/
  (growth)/                          # route group — Growth Engine UI, isolated navigation shell
    growth/
      page.tsx                       # Founder Dashboard (Home)
      schools/
        page.tsx                     # School list
        [schoolId]/page.tsx          # School detail (contacts + activity + follow-ups inline)
      pipeline/
        page.tsx                     # Kanban
      follow-ups/
        page.tsx                     # Global follow-up list
      demos/
        page.tsx
        [demoId]/page.tsx
      pilots/
        page.tsx                     # Health board
        [pilotId]/page.tsx           # Pilot workspace
      champions/page.tsx
      partners/
        page.tsx
        [partnerId]/page.tsx
      marketing/
        content/page.tsx
        campaigns/page.tsx
      feedback/page.tsx
      revenue/page.tsx
      automation/
        rules/page.tsx
        runs/page.tsx
        approvals/page.tsx
      analytics/page.tsx
      settings/
        stages/page.tsx
        users/page.tsx
        integrations/page.tsx
  api/
    growth/
      schools/route.ts, [id]/route.ts, [id]/activities/route.ts
      contacts/route.ts, [id]/route.ts
      deals/route.ts, [id]/route.ts, [id]/stage/route.ts
      follow-ups/route.ts, [id]/route.ts
      demos/route.ts, [id]/route.ts
      pilots/route.ts, [id]/route.ts, [id]/teachers/route.ts, [id]/issues/route.ts
      champions/route.ts
      partners/route.ts, [id]/meetings/route.ts
      content/route.ts
      campaigns/route.ts
      feedback/route.ts
      payments/route.ts
      automation/rules/route.ts, runs/route.ts, approvals/route.ts
      notifications/route.ts
      analytics/[view]/route.ts
      search/route.ts
      cron/
        daily-jobs/route.ts          # service-role, CRON_SECRET-verified
        weekly-jobs/route.ts

lib/growth/
  repositories/                      # pure data access — named columns only, zero business logic
    school.repository.ts
    contact.repository.ts
    deal.repository.ts
    activity.repository.ts
    followUp.repository.ts
    demo.repository.ts
    pilot.repository.ts
    champion.repository.ts
    partner.repository.ts
    content.repository.ts
    feedback.repository.ts
    payment.repository.ts
    automationRule.repository.ts
    automationRun.repository.ts
    notification.repository.ts
    intelligenceRecommendation.repository.ts
  services/                          # business rules — the only thing API routes call
    schools.ts
    pipeline.ts                      # changeStage() — the single writer for deal/school stage (§4 below)
    followUps.ts
    demos.ts
    pilots.ts
    champions.ts
    partners.ts
    marketing.ts
    feedback.ts
    revenue.ts
    dashboard.ts                     # composes the 4-section briefing read, owns no data itself
  validation/                        # Zod schemas, one file per resource, imported by both routes and forms
  events/
    types.ts                         # typed catalog: growth.lead.created, growth.deal.stage_changed, ...
    publish.ts                       # thin wrapper over the existing publishEvent()
  automation/
    ruleEvaluator.ts                 # matches an incoming event/tick against enabled rules' `condition`
    actionExecutor.ts                # dispatches to the fixed action-handler vocabulary
    actions/
      createFollowUp.ts
      postNotification.ts
      changeDealStage.ts
      createPilotWorkspace.ts
      draftMessage.ts
      generateBriefing.ts
      generateReport.ts
    conditionMatcher.ts              # tiny JSON-logic-style matcher — see §4.5, never eval()
  intelligence/
    getRecommendation.ts             # the one call-out to the external Intelligence Layer (Spec §4)
    cache.ts                         # reads/writes growth_intelligence_recommendations
  scoring/
    leadScore.ts                     # deterministic v1 formula (Spec §2.1)
    healthScore.ts                   # deterministic v1 formula (Spec §2.6)

components/growth/
  KanbanBoard/, DataTable/, Timeline/, FollowUpBadge/, HealthScoreGauge/,
  RecommendationCard/, ApprovalCard/, StatTile/, QuickAddModal/, CommandPalette/,
  StageBadge/, RiskBadge/, PriorityBadge/, CalendarView/, AuditLogRow/, EmptyState/,
  NotificationDrawer/, DashboardBriefing/            # the 4-section Founder Dashboard layout

hooks/growth/
  useSchools.ts, useDeals.ts, useFollowUps.ts, useDashboardBriefing.ts,
  useApprovalsQueue.ts, useCommandPalette.ts          # thin data-fetching hooks over the API routes only

types/growth/
  school.ts, contact.ts, deal.ts, activity.ts, followUp.ts, demo.ts, pilot.ts,
  automation.ts, intelligence.ts                      # shared request/response + domain types

services/growth/                     # external integrations only — deliberately thin, see Tech Debt §13
  whatsapp/ (stub in v1 — draft-only, no send API)
  email/ (stub in v1 — draft-only, no send API)
```

**Why each top-level folder exists:**
- `app/(growth)/` as its own route group keeps the Growth Engine's nav shell (sidebar, command palette) from ever leaking into the learner-facing app shell, and lets the whole context be feature-flagged or access-gated at the layout level in one place.
- `app/api/growth/` mirrors the existing `app/api/` thinness rule — routes only parse/validate input, call one `lib/growth/services/*` function, and shape the response.
- `lib/growth/repositories/` and `lib/growth/services/` are a straight copy of the pattern already proven in `lib/repositories/` + the domain files beside it (`lib/core/*.ts`) — no new architectural idea introduced, just the existing one applied to a new domain.
- `lib/growth/automation/` and `lib/growth/events/` are isolated from `services/` because the automation engine is a *consumer* of services (it calls `pipeline.changeStage()`, `followUps.create()`, etc.) — it must never contain its own duplicate business logic. This is the same discipline as the Spec's §3.1 diagram: automation is "hands," not a second brain.
- `lib/growth/intelligence/` is a single narrow folder on purpose — it is the *entire* surface area where this codebase is allowed to talk to the Intelligence Layer. One folder, one file doing the actual call, makes "did we accidentally start reasoning ourselves" a one-file code-review question forever.
- `services/growth/whatsapp/` and `services/growth/email/` exist as folders now but ship as stubs (draft text, copy-to-clipboard) — the seam is placed early so Stage 4 automation (real sending) is a swap-the-implementation change later, not a re-architecture. See Tech Debt §13.

---

## 2. Database Migration Plan

Every migration is additive-only: `create table`, `add column ... nullable or with default`, `create index`, `create policy`. No migration in this plan drops or renames a column, alters a type on an existing table, or removes a policy without a same-migration replacement.

### 2.1 Ordering principle

Migrations are ordered so that **every migration's table is either standalone or references a table that already exists**, and RLS is enabled *in the same migration* that creates the table — never a follow-up migration. A table with RLS enabled but no policies yet defaults to deny-all, which is the correct fail-closed state between "table created" and "policies written" if those ever end up split (they won't be, by rule above, but fail-closed is the safety net if a migration is ever split under time pressure).

| # | Migration | Tables | Depends on | RLS policy shipped same migration |
|---|---|---|---|---|
| M1 | `growth_users` | `growth_users` | `auth.users` | founder reads/writes own row only (v1: table has exactly one row) |
| M2 | `growth_schools` core | `growth_schools`, `growth_school_tags` | M1 | owner (`growth_users.id = auth.uid()`) full access; v1 single-founder so effectively full access gated on being a `growth_users` member at all |
| M3 | `growth_contacts` | `growth_contacts` | M2 | via parent `school_id` membership check |
| M4 | `growth_activities` | `growth_activities` | M2, M3 | via `school_id` |
| M5 | `growth_follow_ups` | `growth_follow_ups` | M2 | via `school_id` |
| M6 | Pipeline v1 (enum column) | `alter table growth_schools add column stage text not null default 'lead_identified' check (stage in (...))` | M2 | inherits `growth_schools` policy — no new table, no new policy needed |
| M7 | `growth_demos` | `growth_demos` | M2 (via `deal_id`... see note) | via `school_id` |
| M8 | Pipeline v2 (promotion, trigger-based, not calendar-scheduled) | `growth_pipeline_stages`, `growth_deals`, backfill `growth_deals` from `growth_schools.stage`, then drop default on the now-legacy `growth_schools.stage` column (kept, not dropped — see rollback) | M6 | new policies for `growth_deals`; `growth_schools.stage` policy untouched |
| M9 | `growth_pilot_schools`, `growth_pilot_teachers`, `growth_pilot_issues` | 3 tables | M8 (`deal_id`) | via `school_id` / parent chain |
| M10 | `growth_champions` | 1 table | M2, M3 | via `school_id` |
| M11 | Automation core | `growth_automation_rules`, `growth_automation_runs` | M1 | founder-only (Mode 1) |
| M12 | `growth_notifications` | 1 table | M1 | own rows only |
| M13 | `growth_content`, `growth_campaigns` | 2 tables | M1 | founder-only |
| M14 | Attribution FK | `alter table growth_schools add column source_content_id uuid references growth_content(id)` | M2, M13 | inherits |
| M15 | `growth_partners`, `growth_partner_meetings` | 2 tables | M5 (`follow_up_id`) | founder-only |
| M16 | `growth_feedback` | 1 table | M2, M3 | via `school_id` |
| M17 | `growth_payments` | 1 table | M2, M8 | via `school_id` |
| M18 | Intelligence cache | `growth_intelligence_recommendations` | none (polymorphic, no FK) | founder-only |

**Note on M7/M9 ordering:** the Spec's schema (§5) has `growth_demos.deal_id` and `growth_pilot_schools.deal_id` reference `growth_deals`, but Phase 0/1 (§15) deliberately doesn't have `growth_deals` yet — stage lives on `growth_schools` directly until M8. Resolution: M7 (`growth_demos`, needed in Phase 1, before M8's Phase-2 automation work) ships with `deal_id uuid references growth_deals(id)` as **nullable** and a same-migration `school_id uuid not null references growth_schools(id)` as the actual FK used until M8 lands; once M8 runs, a follow-up data migration (still additive: backfill only) populates `deal_id` on existing rows. This avoids inventing `growth_deals` earlier than the Spec's phasing calls for, while not fighting the Spec's schema either — it arrives late, additively.

### 2.2 Rollback strategy

Because every migration is additive, rollback is never "undo the schema" — it's "stop reading from the new column/table." Concretely:
- A new **table**: rollback = revoke the route/service that writes to it; the table sits unused. Dropping it is a deliberate, separate, manual decision made only after confirming nothing references it — never part of an automated rollback.
- A new **column with a default**: rollback = stop writing to it; existing rows already have the default, nothing breaks.
- A new **policy**: rollback = the previous fail-closed or previous-policy state is restored by re-applying the prior migration's policy statement, kept in the migration file's `down` companion (even though this project's Supabase workflow is forward-only in practice — the `down` SQL is written and reviewed, not necessarily run, as documentation of what "off" looks like).
- **Never** a `drop column` or `drop table` migration in this plan. If M8's promotion of Pipeline v1→v2 is ever wrong, `growth_schools.stage` is left in place (unused) rather than dropped — cheap insurance, and it directly follows the CLAUDE.md instruction against destructive migrations.

### 2.3 Data integrity

- Every FK has an index (M-by-M above, per Spec §5's own inventory) — created in the same migration as the FK, never deferred.
- `growth_deals.stage_id` (post-M8) is `not null` — a deal always has a stage; there is no "unstaged" state, matching the Kanban UI's assumption that every card has a column.
- Backfills (M8's `growth_schools.stage` → `growth_deals` migration, M9's `deal_id` backfill) run inside the same migration transaction as the schema change where the platform's migration tool supports it, so a school is never observed mid-migration with a deal in one state and its legacy stage field in another.

### 2.4 RLS rollout

RLS ships **with** the table, not after — this is stricter than "eventually add RLS," and it's the only sequencing that guarantees no window where a `growth_*` table is queryable without a policy. Mode 1 policies are intentionally simple (founder-only via `growth_users` membership) — the richer role matrix (Spec §12) is **new policies added in Phase 6**, layered on top of, not replacing, the Mode-1 policies. This means Phase 6 migrations are also purely additive.

### 2.5 Indexes

All indexes listed in Spec §5 are created in the migration that creates their table (not batched into a later "add indexes" migration) — an index added after a table already has data is a heavier, riskier operation than one created empty; creating them empty from day one avoids that entirely.

---

## 3. Sprint Breakdown

Every sprint below is sized for **one person, part-time-to-full-time**, and every sprint ships something a founder could open in a browser and use, even if the day-to-day workflow only becomes complete a few sprints later. "Effort" is a rough solo-founder estimate assuming familiarity with the existing codebase's conventions (real effort will vary; treat these as ordering guidance, not commitments).

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **0** | Scaffolding, no user-visible feature | `growth_users` (M1), route group shell, nav item visible only to founder, empty layout | `pnpm build` passes; founder can log in and see an empty "Growth" nav item | Deployed, zero behavior change to existing app | Route group misconfigured, breaks existing routing | Delete route group folder — nothing else references it yet | 0.5–1 day |
| **1** | Schools | M2, `school.repository.ts`, `schools.ts` service, `/api/growth/schools`, School List + Quick Add + read-only Detail | Route-level HTTP tests (reuse `httpAuthTestHelper.ts`) for 401/403/CRUD; manual add of 3 real schools | Founder can add and list real schools | Duplicate-school dedup (§2.1 of Spec) not yet built — accept as v1 gap, log to Tech Debt | Route/service files unused if reverted; table stays empty | 2–3 days |
| **2** | Contacts | M3, contact repo/service, inline on School Detail | HTTP tests; manual add of contacts to the 3 schools | Founder can record who to talk to per school | None significant — pure CRUD | Same as Sprint 1 | 1 day |
| **3** | Activities | M4, activity repo/service, `Timeline` component, log-activity form | HTTP tests; manual log of real calls/WhatsApp touches | Timeline shows chronological history per school | `Timeline` becomes the most-reused component — get its shape right now, it's expensive to change later once 4+ screens embed it | Component/table unused if reverted | 2 days |
| **4** | Follow-ups | M5, follow-up repo/service, global list, `FollowUpBadge` | HTTP tests; manual scheduling of real follow-ups | Global Follow-ups list shows every due/overdue item across schools | Overdue-query correctness (`due_at < now() and completed_at is null`) — write this as a repository unit test, not just eyeballed | Same as above | 1–2 days |
| **5** | Pipeline v1 | M6 (enum column), `pipeline.changeStage()` service (single writer, logs Activity + emits event even in v1), Kanban view | HTTP tests on stage-change route; drag-drop manually tested; verify Activity auto-logged on every stage move | Kanban reflects real deals, moving a card always produces a Timeline entry | Enum `check` constraint too rigid if stage list needs an early change — acceptable, flagged in Tech Debt, resolved by Sprint 8 | Revert Kanban page; `stage` column stays, defaults to `lead_identified` | 2–3 days |
| **6** | Founder Dashboard v1 | `dashboard.ts` service composing Must Do / Waiting For / At Risk / Wins purely from M2–M6 tables, `DashboardBriefing` component | Manual daily use for a full week is the actual verification — this is the sprint the Founder Experience Review (§10) first applies to | Founder opens this page every morning instead of a spreadsheet | "At Risk" needs an inactivity threshold — hardcode 6 days (matches the Spec's own worked example), make configurable later if wrong | Dashboard falls back to a simple list if composition query is wrong | 2 days |

**Phase 0 complete after Sprint 6** — this is the Spec's five-thing v1, independently shippable, matches §15/§17's "prove it with real use before expanding."

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **7** | Demos | M7, demo repo/service, Demo Detail/notes, Upcoming list, Dashboard's Must Do now includes today's demos | HTTP tests; run one real demo through the flow end to end | Structured demo notes exist for every demo going forward | `deal_id` nullable per §2.1 note — don't let this leak into UI as a visible gap | Table unused if reverted | 2 days |
| **8** | Pipeline v2 (trigger-based — only when stage list actually needs to change) | M8, `growth_deals`/`growth_pipeline_stages`, backfill, Settings → Pipeline Stages editor | Backfill row-count-matches-source test (every school has exactly one deal after migration); HTTP tests on new stage routes | Kanban now reads from `growth_deals`, stages are founder-editable | Backfill correctness is the whole risk — dry-run against a copy of production data first | `growth_schools.stage` retained (§2.2) — Kanban can be pointed back at it if `growth_deals` read path has a bug | 3–4 days |

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **9** | Event bus wiring | `lib/growth/events/*`, emit on every existing write path from Sprints 1–8 (no UI change — "dark" deploy) | Unit tests: each service call emits the expected typed event | Every meaningful write produces an event, nothing consumes them yet | None — this sprint is deliberately inert in production behavior | Stop calling `publish()`; writes still succeed (events are fire-and-forget, never in the write transaction's critical path) | 1–2 days |
| **10** | Automation Stage 1 — internal reminders only | M11, `ruleEvaluator.ts` + `conditionMatcher.ts`, two shipped rules: overdue-follow-up reminder, stage-template follow-up creation | Automation dry-run tests (fixture event → expected proposed action, no side effect) + one real week of use | Overdue reminders and stage-based follow-ups happen without the founder remembering to create them | Rule evaluator scope creep into a general DSL — reject per Architecture Guardian §11; keep the matcher to field/operator/value only | Disable both rules via `enabled = false` — no code rollback needed, this is the point of rules-as-data | 3 days |
| **11** | Notifications + Audit Log UI | M12, `NotificationDrawer`, Automation → Activity Log screen | HTTP tests; manual verification that Sprint 10's rule firings appear correctly | Founder can see what automation did and why, in one place | None significant | Hide nav entries; tables keep recording regardless | 2 days |
| **12** | Automation Stage 2 — suggested actions | `growth_intelligence_recommendations` table (M18, pulled forward — used here as a cache for *deterministic* suggestions before any real Intelligence Layer exists, per Spec §4.3's degradation mode), `RecommendationCard`, surfaced on Deal Detail | Unit tests on the deterministic suggestion rules (e.g. "no activity in N days → suggest re-engagement") | Deal Detail shows a suggestion with a rationale string, matching the Spec's evidence-first discipline even with zero AI involved | Temptation to hardcode a fake confidence score to "look smart" — reject; use a real deterministic value (e.g. days-since-contact) or omit confidence entirely rather than fabricate one | Hide `RecommendationCard`; underlying data harmless | 3 days |
| **13** | Automation Stage 3 — approval workflow (internal actions) | `growth_automation_runs` approval states, Approvals Queue screen, `ApprovalCard` | HTTP tests on approve/reject routes; verify audit trail captures approver + timestamp | Every `requires_approval` rule's output lands in one queue, nothing auto-executes past it | Queue becoming a second inbox no one checks — mitigate by surfacing pending-approval count on the Dashboard's Must Do (per Spec §3.4) | Approvals simply accumulate unapproved (fail-closed); no destructive default | 3 days |
| **14** | Automation Stage 4 — external communication (draft-only) | `draftMessage.ts` action, `services/growth/whatsapp` + `email` **stubs** (produce draft text, copy-to-clipboard — no send API yet, see Tech Debt §13), wired through the same Approvals Queue | Manual test: a real drafted WhatsApp message copy-pasted and sent by hand | Founder gets a drafted, on-brand message to review and manually send — automation stops exactly at the boundary the Spec requires (§3.5) | Building a real WhatsApp Business API integration here would be scope expansion — explicitly rejected for v1.0, logged as Tech Debt | Disable the rule; drafts stop generating, nothing was ever auto-sent | 2–3 days |

**Automation Engine v1 complete after Sprint 14**, matching the required Stage 1→4 rollout exactly, and never reaching "fully autonomous" for anything external — consistent with the non-negotiable instruction.

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **15** | Pilot Schools | M9, Pilot Roster, Pilot Workspace shell, auto-create on stage→`pilot_school` (an automation action, reusing Sprint 10's engine) | HTTP tests; one real pilot school moved through the flow | A school reaching Pilot stage gets a workspace with zero manual setup | Health score formula (§scoring/healthScore.ts) needs at least 2 weeks of real login/usage data before it means anything — ship the gauge showing "insufficient data" rather than a misleading number early | Workspace creation rule disabled; pilots still visible as schools | 3 days |
| **16** | Pilot Health Board + Teachers/Issues | Remaining M9 tables wired into UI, `HealthScoreGauge`, at-risk rule (Stage 1 automation, extends Sprint 10) | Unit test on health-score/risk-level derivation; manual verification against 1–2 real pilots | Health Board sorted risk-first, matches Dashboard's "At Risk" section | None beyond Sprint 15's | Hide board; data still recorded | 2 days |
| **17** | Champions | M10 | HTTP tests; manual entry for known champions | Champions trackable, referral/testimonial counts derived not hand-typed | None significant | — | 1–2 days |
| **18** | Product Feedback | M16, ranked list (`frequency × impact / effort`) | Unit test on the priority formula; manual entry of real feedback collected so far | Founder has one ranked backlog instead of scattered notes | None significant | — | 1–2 days |

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **19** | Marketing — Content + Campaigns | M13, M14 (attribution FK), Content Calendar, `generated_leads` increment wired via Sprint 9's event bus (a lead created with `source_content_id` set increments the counter — Stage 1 automation, not a new mechanism) | Unit test on the attribution increment; manual publish of one real piece of content | "Which content generates leads" is answerable, not aspirational (per Spec §2.9) | None significant | — | 2–3 days |
| **20** | Partnerships | M15 | HTTP tests | Partner meetings tracked on the same Activity/Follow-up primitives — verify no parallel meeting system got built by accident | Temptation to give partnerships its own timeline component — reject, reuse Sprint 3's `Timeline` | — | 2 days |
| **21** | Revenue — Payments + Dashboard | M17, Revenue Dashboard | Unit tests on MRR/forecast calculations against fixture payment data | Revenue numbers trace to real `growth_payments` rows, never hand-entered | Calculation correctness — write these as pure functions with unit tests before wiring to UI, per the existing platform's testing-infra pattern | — | 3 days |
| **22** | Analytics | Views/queries per Spec §14, Analytics screen | Manual review against known real numbers from Sprints 1–21 | Every chart is backed by a named query, none computed client-side from raw rows (per Spec §14's own rule) | Over-building — ship the 3–4 analytics views the founder actually opens weekly first (lead sources, conversion, pipeline velocity), defer the rest until asked for | — | 3–4 days |

| Sprint | Objective | Deliverable | Verification | Exit criteria | Key risk | Rollback | Effort |
|---|---|---|---|---|---|---|---|
| **23** | Intelligence Layer integration — first two kinds | `lib/growth/intelligence/getRecommendation.ts` wired for real (replacing Sprint 12's deterministic-only cache) for `next_best_action` and `message_draft` | Contract test: mocked Intelligence Layer response → correct cache write → correct UI render, including the degradation path (Spec §4.3) when the call fails | Deal Detail and Outreach drafts get real AI-assisted suggestions, with rationale always shown | The one place this could go wrong is silently fabricating a recommendation on failure — test the failure path explicitly, not just the happy path | Feature-flag the real call off; Sprint 12's deterministic suggestions remain as the floor | 3–4 days (depends entirely on Intelligence Layer's actual existing interface — this estimate assumes it already exists per the Spec's assumption) |
| **24** | Intelligence Layer integration — remaining kinds | `reengagement_timing`, `risk_flag`, `objection_response` | Same pattern as Sprint 23 | All five recommendation kinds from Spec §4.2 are live | Same as Sprint 23 | Same as Sprint 23 | 3 days |

**v1.0 complete after Sprint 24.** Mode 2 (Phase 6) and Mode 3 (Phase 7) are explicitly out of this blueprint's scope — they begin only when a second person actually joins, per Spec §0.6/§15, and get their own blueprint at that time rather than being pre-planned now.

Total: 25 sprints (0–24), roughly 55–70 solo-founder days end to end if run sequentially full-time — in practice this runs part-time alongside actual selling, which is the entire point of shipping Phase 0 (Sprint 6) early and living in it for real before continuing.

---

## 4. Domain Layer Design

### 4.1 Repositories
Pure data access. One file per aggregate root, named-column `select()`s only, no `select('*')`, no business logic, no validation beyond what the DB schema already enforces. Signature shape:

```ts
// lib/growth/repositories/school.repository.ts
export async function findSchoolById(id: string): Promise<GrowthSchool | null>
export async function listSchools(filter: SchoolFilter): Promise<GrowthSchool[]>
export async function insertSchool(input: NewSchool): Promise<GrowthSchool>
export async function updateSchool(id: string, patch: SchoolPatch): Promise<GrowthSchool>
```

### 4.2 Services
Business rules live here, and only here. Services call repositories, never Supabase directly. Every service function has an explicit return type (per CLAUDE.md). Example — the single most important service in the whole system:

```ts
// lib/growth/services/pipeline.ts
export async function changeStage(dealId: string, toStageId: string, actorId: string): Promise<GrowthDeal> {
  // 1. load current deal, 2. validate transition (no-op guard), 3. write new stage + previous_stage,
  // 4. insert an Activity row (channel: 'system'), 5. publish 'growth.deal.stage_changed', 6. return updated deal
}
```

This is the **only** code path allowed to change a deal's stage — Kanban drag-drop, the API route, and every automation action all call this one function, never write `stage_id` directly. This mirrors the existing platform rule that evidence rows are only ever mutated through named domain functions (`lib/intelligence/evidenceLifecycle.ts`) — same discipline, applied to pipeline state instead of evidence state, and it's what makes "every stage change is logged and eventable" a guarantee instead of a convention someone can forget.

### 4.3 Validation
Zod schemas in `lib/growth/validation/`, one per resource, imported by both the API route (server-side, non-negotiable) and the form component (client-side, for UX only — never trusted). No schema is duplicated between route and form.

### 4.4 Events
Typed catalog (`events/types.ts`) is a closed union, not a free-text string anywhere except the DB column that stores it. Adding a new event type is a one-line addition to the union plus wherever it's emitted — never a magic string invented inline in a service function.

### 4.5 Automation / Rules
`condition` on `growth_automation_rules` is JSON but is deliberately **not** a place for arbitrary logic. `conditionMatcher.ts` supports exactly: field path, operator (`eq`, `gt`, `lt`, `gte`, `lte`, `in`, `days_since`), value. This is intentionally underpowered compared to a real rules DSL — see Architecture Guardian §11 for why that's a feature, not a gap.

### 4.6 State Transitions
Every entity with a meaningful lifecycle (Deal stage, Follow-up completion, Automation run approval, Pilot risk level) has exactly one service function that's allowed to change it, following the `changeStage()` pattern above. No UI component, no repository, and no automation action ever writes a status/stage/state column directly.

---

## 5. UI Build Order

Already encoded in the Sprint table (§3) — restated here as the underlying logic:

1. **School Detail is built once, extended repeatedly** — Sprints 1–5 all add a tab/section to the same screen (Overview → +Contacts → +Activity → +Follow-ups → +Pipeline position) rather than five separate screens that get stitched together later. This avoids the single biggest source of duplicate work: building a detail screen shell more than once.
2. **`Timeline`, `DataTable`, `FollowUpBadge` are load-bearing components built early** (Sprints 3–4) precisely because 10+ later screens reuse them (Pilot Workspace, Partner Detail, Champion Detail, Deal Detail all embed `Timeline`; every list screen in the inventory uses `DataTable`). Get these two right before Sprint 7 — changing their prop shape after 6 screens depend on it is expensive; changing it after 1 screen depends on it is cheap.
3. **Kanban depends on Pipeline v1 existing (Sprint 5) but not on `growth_deals` existing (Sprint 8)** — it's built once against the enum column and re-pointed at the real table later, never rebuilt from scratch.
4. **Dashboard (Sprint 6) depends on everything before it and nothing after it** — it's the first screen where "can the founder use this every day" becomes literally true, which is why Phase 0 ends there.
5. **Screens that can wait**: Settings screens (stages editor, users, integrations) are the last thing built in each phase they belong to, not the first — a founder doesn't need to *configure* a system they're the only user of. Automation Rules editor UI similarly waits until Sprint 10 has shipped two hardcoded rules that work — editing a rule that already exists and is trusted is a much lower-risk UI to build than a blank rule-builder no one has validated the shape of yet.

---

## 6. Automation Rollout

Exactly the four stages required, mapped to sprints:

| Stage | Sprint(s) | Autonomy level |
|---|---|---|
| **1 — Internal reminders** | 10 | Fully automatic — nothing external, nothing destructive (overdue follow-up notices, stage-template follow-up creation) |
| **2 — Suggested actions** | 12 | Automatic *surfacing*, zero automatic *action* — a `RecommendationCard` is a suggestion, never an executed change |
| **3 — Approval workflows** | 13 | Infrastructure for human-in-the-loop, applied first to internal actions so the queue itself is proven before anything external flows through it |
| **4 — External communication** | 14 | Draft-only, always approval-gated, no autonomous send capability exists anywhere in v1.0 |

No sprint anywhere in this blueprint builds fully autonomous external behavior — that's not a v1.0 deferral, it's outside the non-negotiable rules for this system as specified (Spec §3.5).

---

## 7. Testing Strategy

- **Repository tests**: one suite per repository, hitting a real (test-schema) Supabase instance, verifying exact-column selects and that RLS actually blocks a non-owner — this is the layer where "does RLS really work" gets proven, not asserted.
- **Service tests**: business-rule tests, especially `pipeline.changeStage()` (the single-writer guarantee), `leadScore.ts`/`healthScore.ts` (deterministic formula correctness against fixture data), the `frequency × impact / effort` feedback priority calc, and MRR/forecast math.
- **Integration tests**: reuse `lib/testing/httpAuthTestHelper.ts` (already proven infrastructure per this project's own history — it caught a real routing collision on the learner side) for every `app/api/growth/*` route: 401 with no session, 403 on role mismatch, 200 with correct shape.
- **Automation tests**: dry-run the rule evaluator against fixture events with mocked clocks — assert the *proposed* action and its `requires_approval` flag, without ever calling the real action executor, for every rule shipped in Sprints 10–14.
- **Permission tests**: minimal in Mode 1 (only one role exists — verify a non-`growth_users` authenticated user gets 403 everywhere), expands into a full matrix test only when Phase 6 actually ships the role matrix.
- **End-to-end**: exactly one flow, the highest-risk one — the daily Founder Dashboard loop (log an activity → see it reflected in Timeline and Dashboard → complete a follow-up → see it drop off "Must Do"). Do not build broad e2e coverage for a single-user internal tool; it's not worth the maintenance cost the platform's own engineering culture already warns against for low-ROI test surface.

High-risk workflows, ranked, get priority in test-writing order: (1) stage-change side effects (`changeStage()`), (2) automation action execution + audit logging, (3) approval-gate enforcement (nothing external ever bypasses it), (4) RLS on every new table, (5) revenue/health-score calculations.

---

## 8. Security Review

| Area | v1.0 posture | Notes |
|---|---|---|
| **Authentication** | Every `app/api/growth/*` route calls `auth.getUser()` first, 401 if absent — no exceptions, including cron routes which instead verify `CRON_SECRET` (quoted this time — the existing Holiday Plans cron incident with an unquoted `#` truncating a secret is exactly the mistake to not repeat) | Matches CLAUDE.md verbatim |
| **Authorization** | Mode 1: membership in `growth_users` is the only check. Never trust a role/owner claim from the request body — always re-derive from the authenticated session, same as the platform-wide rule | Full role matrix deferred to Phase 6, not weakened before then |
| **RLS** | Ships with every table, in the same migration (§2.4) — never a follow-up | Fail-closed by default between table creation and policy authorship if that ever gets split |
| **Audit logs** | `growth_automation_runs` append-only from Sprint 10 onward, no update/delete policy ever granted on it — mirrors the learner Evidence Layer's append-only pattern | Corrections would be a new row, never an edit, if this is ever needed |
| **Approval gates** | Enforced at the service layer (`actionExecutor.ts` refuses to execute a `requires_approval` action without an `approved_at` on the run row), not just hidden in the UI — a direct API call can't bypass it | Defense in depth — never rely on the UI hiding a button as the actual control |
| **Input validation** | Zod on every route, per §4.3 | No schema duplication between client and server trust boundary |
| **Sensitive data** | Contact phone/email are the only PII-adjacent fields in v1.0 — no payment card data (Paystack handles that on the learner-platform side, not touched here), no service-role key ever reaches a client component | `growth_payments.amount` is business data, not sensitive-PII in the same sense |
| **Least privilege** | Service-role client (`createServiceClient()`) used only in `app/api/growth/cron/*` — every other route uses the request-scoped client | Matches the existing platform rule exactly |

**No shortcut implementations**: nothing in this plan proposes disabling RLS "temporarily," trusting a client-supplied ID, or skipping auth on an "internal-only" route — internal-only is not a security boundary in a system a founder will eventually demo to a co-founder or investor with real school data in it.

---

## 9. Performance Strategy

At the Spec's own target scale (20 schools, 100 contacts, 500 activities, 200 follow-ups, 10 pilots — §17), almost every performance concern in the "required deliverables" list is premature. Applying the Architecture Guardian discipline explicitly:

- **Query optimization**: named-column selects (already a hard rule) and FK indexes (already required at migration time, §2.5) are the only two things done *proactively*. Nothing else.
- **Pagination**: not built in v1.0 — 500 rows renders fine in a `DataTable` without it. Add it the first time a list screen actually feels slow with real data, not before.
- **Search strategy**: the command palette (§ Spec 9) starts as a simple `ilike` query across school names in v1.0 — no search index, no external search service. Revisit only if school count grows an order of magnitude past the target.
- **Caching**: none in v1.0. The Founder Dashboard's four sections are cheap reads at this scale; adding a cache layer before there's a measured slow query is the exact "premature optimization" the Architecture Guardian responsibilities call out for rejection.
- **Background jobs**: the existing cron pattern (two routes, `daily-jobs` and `weekly-jobs`, per §1's file tree) is sufficient — no job queue infrastructure (no Redis, no BullMQ) is introduced. Automation's Stage-1 reminders and Stage-4 draft generation both fit inside a once-daily tick at this volume.
- **Event processing**: synchronous, in-process, fire-and-forget (§Sprint 9) — no message broker. The existing `publishEvent()` infrastructure is reused as-is; if it already scales for the learner platform's event volume, it scales for a 20-school pipeline trivially.
- **Dashboard loading**: four independent, small queries composed server-side in `dashboard.ts` (§4.2), rendered as a Server Component — no client-side waterfall, no need for it at this data volume.

**The one thing addressed proactively despite being "premature" by this logic**: FK indexes and RLS, because both are *correctness and security* concerns wearing a performance-sounding name, not actual premature optimization — they're required by CLAUDE.md unconditionally, not contingent on scale.

---

## 10. Founder Experience Review (applied every sprint)

After each sprint in §3, before merging to `main`, three questions gate the merge — this is not a separate ceremony, it's a checklist attached to the sprint's own exit criteria:

1. **Can the founder actually use this every day?** — if a sprint's deliverable requires configuration, a second user, or a workflow that doesn't exist yet to be useful, it's landed too early (this is why Settings screens are consistently last, §5).
2. **Does it reduce operational burden?** — every sprint's deliverable is traceable to a §0.5 "30 minutes a week" claim; if a sprint can't articulate that claim in one sentence, it's deferred, not built.
3. **Would this replace part of a spreadsheet today?** — the literal test used to decide Phase 0's scope (§15) applies sprint-by-sprint too: Sprint 1 replaces a leads spreadsheet tab, Sprint 5 replaces a pipeline spreadsheet tab, Sprint 21 replaces a revenue spreadsheet tab. A sprint that doesn't replace or meaningfully extend a real spreadsheet habit is a signal to re-check scope before building it.

If any answer is no, the sprint is either simplified in place or its deliverable is split so the useful part ships and the rest waits — per the non-negotiable "no big-bang releases" rule.

---

## 11. Architecture Guardian Responsibilities — Standing Rejections

These are pre-committed "no" answers to temptations this kind of build predictably produces, stated now so they don't need to be re-litigated sprint by sprint. Each follows the required why-now/why-not-later format.

| Temptation | Rejected because | Why not later either (unless a real trigger fires) |
|---|---|---|
| Generic workflow/rules engine (visual builder, arbitrary scripting) | `conditionMatcher.ts` (§4.5) covers every rule in the Spec's §3.2 table with five operators — a general engine solves a problem that doesn't exist yet | Revisit only if a rule genuinely can't be expressed in field/operator/value form — not because a rules engine sounds more "platform-y" |
| Multi-tenant organization model | v1.0 has exactly one `growth_users` row — org-level modeling is Phase 6+ Mode 2/3 territory (Spec §0.6), and even then "small team" is not "multi-tenant SaaS" | Only if EduNexus itself ever needs to run *multiple* independent sales orgs (e.g. white-labeling this tool) — not implied anywhere in the Spec |
| Generic plugin system for automation actions | The fixed action vocabulary (§4.5, Spec §3.1) is a stated safety boundary, not a limitation — "no arbitrary code execution from rule config" is load-bearing | Only if the fixed vocabulary is repeatedly insufficient in the audit log — evidence-driven, not speculative |
| Real-time (websocket) sync across the UI | Single founder, single browser tab, most of the day — there is no second viewer to sync to yet | Mode 2 (multiple simultaneous users) is the actual trigger, not "it would feel snappier" |
| New/custom design system components instead of reusing the platform's existing ones | Duplicates existing platform capability — CLAUDE.md's component conventions already exist; Growth Engine components extend, not fork, them | Never, unless the learner-facing design system is itself being replaced platform-wide |
| Microservice split for the automation engine | Adds deployment complexity for a workload that's a handful of daily cron ticks over a few hundred rows | Only if automation volume genuinely can't run inline in the existing Next.js deployment — not a credible near-term scenario |
| ML-based lead/health scoring before the deterministic v1 is validated | Fabricates confidence where none has been earned yet — violates the evidence-first discipline this whole platform already holds itself to | Only after the deterministic formula has run against enough real conversions to know if it's even directionally right (Spec §16 already flags both formulas as provisional) |
| A no-code rule-authoring UI for non-technical users | There is no non-technical user in Mode 1 — the founder edits `growth_automation_rules` rows directly via the Sprint-13/14-built settings screen, which is enough | Mode 2/3, when someone other than the founder needs to author rules |
| Hidden/implicit state (e.g. caching Dashboard results client-side without a clear invalidation rule) | Every §9 decision is explicit about staying server-computed and uncached — hidden state is exactly what makes "why does the Dashboard show stale data" unanswerable later | Only with a measured, specific slow query as the trigger — and even then, cache invalidation is designed explicitly, not left implicit |
| Unnecessary configuration (e.g. making every automation rule's operator set admin-configurable in v1.0) | The five operators in `conditionMatcher.ts` are hardcoded, not admin-extensible, in v1.0 — configurability here is speculative for a one-person system | Only if Mode 2/3 rule authors need an operator the founder's own rules never needed |

---

## 12. Technical Debt Register

Every deliberate gap below is accepted *now*, with a named trigger for when it stops being acceptable. Nothing on this list is accidental debt discovered later — it's scoped out on purpose, and this table is the record of that decision.

| Item | Deferred because | Revisit trigger |
|---|---|---|
| No duplicate-school detection (fuzzy match) | Spec §2.1 names it, but manual founder review of ~20 schools catches duplicates trivially — building fuzzy matching for this volume is premature | School count grows past what one person can eyeball, or a real duplicate causes a split-history problem |
| Pipeline stage is a hardcoded enum until Sprint 8 | Spec §15 explicitly allows this — an admin-editable stage list is only needed once the list actually needs to change | The founder wants to rename/reorder/add a stage for the first time |
| No WhatsApp/Email send API — Stage 4 automation produces copy-paste drafts only | A real send integration is a meaningful scope/vendor decision (WhatsApp Business API approval, deliverability, opt-out handling) explicitly excluded from "do not expand scope" | Draft-then-manual-send is measurably a bottleneck after Sprint 14 has been used for real — then it becomes its own scoped mini-project, not a Growth Engine architecture change |
| No row-level "own vs. team-visible" scoping | Not needed with one user (Spec §12) | Phase 6 / Mode 2, on the actual day a second person joins |
| Health/lead scores are simple deterministic formulas, not learned models | Evidence-first discipline — no confidence claimed that hasn't been earned (§11 table) | Enough real conversion outcomes exist to validate or replace the formula empirically |
| No pagination, search index, or caching layer (§9) | Premature at target scale | A specific, measured slow query or a school count an order of magnitude above the Spec's stated target |
| `growth_intelligence_recommendations` used as a plain cache for deterministic suggestions before Sprint 23 | Lets Automation Stage 2 (Sprint 12) ship without waiting on the real Intelligence Layer, per Spec §4.3's designed degradation path | Sprint 23, when the real `getRecommendation()` call replaces the deterministic stand-in |
| Analytics ships with only 3–4 of the Spec's 11 named views (§Sprint 22) | Building all 11 before any are used weekly is speculative | Founder asks for a specific missing view after using the shipped ones for a few weeks |
| Minimal e2e coverage (one flow only, §7) | Broad e2e suites are high-maintenance-cost for a single-internal-user tool | Mode 2+, when more than one person's daily workflow depends on this system not silently breaking |
| `growth_schools.stage` column left in place, unused, after Sprint 8's migration to `growth_deals` | Never-drop rollback safety (§2.2) | A deliberate, separate cleanup migration once M8 has been stable in production for a full term/quarter — not part of this blueprint |

---

## Summary

Twenty-five sprints, Sprint 0 through Sprint 24, each additive, each deployable, each answering the Founder Experience Review's three questions before it's allowed to merge. Phase 0 (Sprints 0–6) ships a real five-entity replacement for a spreadsheet inside roughly two to three weeks of solo, part-time work and is meant to be *lived in* before Sprint 7 starts. The Automation Engine never exceeds the Spec's approval-gated ceiling — nothing external ever sends itself. The Intelligence Layer integration is deferred to the very end (Sprints 23–24) precisely because everything before it works without it, proving the "Hands" architecture doesn't secretly depend on the "Brain" existing on any particular timeline. Every schema change is additive-only, every table ships with RLS in its own migration, and every rejected shortcut in §11 is rejected for a stated reason, not by default caution — which is what makes this a guardian's blueprint and not just a task list.
