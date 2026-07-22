# EduNexus Growth Engine — Master Design Specification

**Status:** Design complete, not yet built. No code, tables, or routes referenced below exist in the codebase today.
**Owner:** Founder-led sales/growth function, single operator today, designed to scale to a small team.
**Relationship to the core product:** This is an internal commercial operating system for EduNexus the company (selling into schools). It is a *separate domain* from the CBC/CBE learner platform (Blueprint, Projection Engine, Evidence Layer, etc.) and should not import or couple to learner-intelligence code. Where it needs "intelligence," it consumes a defined interface from the existing AI reasoning layer rather than re-implementing reasoning — see §4.

> **Mission statement — the governing philosophy of this document.**
> The EduNexus Growth Engine is not designed to manage sales. It is designed to remove as much operational work as possible from a solo founder so that the founder spends the majority of each day building relationships with schools rather than managing spreadsheets, reminders, or administrative tasks. Every feature must earn its place by saving measurable time, reducing cognitive load, or increasing the probability of converting a school into a successful long-term partner. Scalability is intentional, but never comes at the expense of simplicity during the founder stage.
>
> Every future decision runs through one filter: **does this help the founder close more schools this month, or is it preparing for a team that doesn't exist yet?** If it's the latter, it waits.

---

## 0. Philosophy: Brain / Hands / Eyes / Memory

The single most important architectural decision in this spec is a separation of concerns, borrowed from the request but made concrete:

| Layer | Role | Owned by |
|---|---|---|
| **Brain** | Understands, predicts, scores, recommends. Answers "what does this mean and what should happen." | The existing/future EduNexus Intelligence Layer (external to this system) |
| **Hands** | Executes: sends messages, creates tasks, schedules follow-ups, updates records, prepares demo packs, moves pipeline stages. | Growth Automation Engine (§3) |
| **Eyes** | Observes: dashboards, analytics, health scores, anomaly alerts. | Analytics module (§14) + Founder Dashboard (§13.1) |
| **Memory** | Records: every school, contact, activity, deal, deliverable, decision, ever. | Growth CRM database (§5) |

The Growth Engine **never generates its own predictions from raw data**. It calls an intelligence interface (`getRecommendation(subjectType, subjectId)`), gets back a typed recommendation with a confidence score and rationale, stores it, and decides — via configurable rules — whether to surface it for approval or act on it autonomously. This keeps the Growth Engine replaceable/extensible without ever becoming a second, competing reasoning system (the exact anti-pattern the core product's `docs/architecture/learner-record-layer-decisions.md` already warns against for the learner domain — same lesson, different domain).

---

## 0.5 Founder Operating Philosophy

The Growth Engine is designed around **one operator**. Until multiple team members exist, every workflow is optimized for:

- fewer clicks
- fewer screens
- fewer decisions
- fewer duplicate entries
- maximum automation
- immediate visibility
- minimal configuration

This is not a style preference — it is a filter applied to every feature in this document before it's allowed to exist. Before anything ships, it must answer:

**Does this save the founder at least 30 minutes per week?**

If not, it's deferred — not deleted, just not now. Concretely, this philosophy is why: Phase 0 is five entities, not the module list's full twelve (§15); the Founder Dashboard reads as a briefing, not a control panel (§13.1); permissions and team metrics don't exist until Mode 2 (§0.6); and the Automation Engine defaults to doing things *for* the founder rather than asking the founder to configure things *about* automation. The architecture intentionally delays complexity until real organizational growth forces it — building for a team that doesn't exist yet is exactly the kind of work this philosophy exists to prevent.

## 0.6 Operating Modes

The system behaves differently depending on the stage of the business — the UI unlocks in steps, it does not launch with all of it visible and disabled.

| Mode | Who | What appears |
|---|---|---|
| **Mode 1 — Solo Founder** | 1 person | Everything optimized for a single operator: no assignment fields, no "owner" pickers, no team filters, no permissions UI at all. Dashboard is the personal-assistant briefing (§13.1). This is the only mode Phases 0–4 need to support. |
| **Mode 2 — Small Team** | 2–5 people | Permissions appear (the role matrix in §12 activates). Deal/task assignment appears. Team activity feed and per-person metrics appear on dashboards. Approval Queue gains "assigned to me" filtering. |
| **Mode 3 — Regional Sales Team** | Multiple reps, managers | Forecasting views, manager dashboards, regional/territory ownership, advanced reporting (rep leaderboards, pipeline-by-region). |

A mode is not a config toggle a founder flips manually day one — it's detected from `growth_users` headcount (or set explicitly once, in Settings, when the founder hires) and the UI conditionally renders accordingly. Nothing in Mode 1 is *removed* later — Mode 2/3 only ever *add* surface area (assignment pickers, team filters, manager views) on top of the same five core entities. This is what makes §15's phasing safe: building Phase 0 for Mode 1 never has to be rebuilt when Mode 2 arrives, because Mode 2 additively reveals fields/screens that already exist in the schema (`owner_id`, `assigned_to`) but stay invisible in a one-person UI where they'd just be noise.

---

## 1. Information Architecture

```
Growth OS
├── Home (Founder Dashboard)
├── Leads                          — Lead Intelligence
│   ├── All Leads (list/table)
│   ├── Lead Detail
│   └── Import / Bulk Add
├── Pipeline                       — Sales Pipeline (Kanban)
│   ├── Board View
│   ├── List View
│   └── Deal Detail
├── Outreach                       — Cold Outreach Engine
│   ├── Sequences
│   ├── Inbox (replies needing action)
│   └── Templates
├── Follow-ups                     — cross-cutting, surfaces everywhere
├── Demos
│   ├── Upcoming
│   ├── Demo Detail / Notes
│   └── Demo Library (recordings, decks)
├── Pilot Schools
│   ├── Pilot Roster
│   ├── Pilot Workspace (per school)
│   └── Health Board (all pilots, risk-sorted)
├── Champions                      — Teacher Champions
├── Partnerships
│   ├── Partner Directory
│   └── Partner Detail
├── Marketing
│   ├── Content Calendar
│   ├── Campaigns
│   └── Content Performance
├── Feedback                       — Product Feedback
├── Revenue                        — Revenue Dashboard
├── Automation                     — Growth Automation Engine console
│   ├── Rules
│   ├── Activity Log (audit trail)
│   └── Approvals Queue
├── Analytics
├── Settings
│   ├── Pipeline Stages
│   ├── Users & Permissions
│   ├── Integrations (WhatsApp/Email/Intelligence Layer)
│   └── Automation Rules (also linked from Automation)
└── Command Palette (global, ⌘K)
```

Everything hangs off one entity: the **School**. A School has Contacts, one active Deal (pipeline position), an Activity timeline, optional Pilot Workspace, optional Champion(s), Feedback items, and Revenue records. This mirrors the core product's own pattern of one canonical timeline per learner (`getLearnerTimeline()`) — one canonical timeline per school here.

---

## 2. Core Modules — Behavioral Spec

Each module below extends the fields already given in the brief with behavior, not just data.

### 2.1 Lead Intelligence
- Every school is a row the moment it's discovered — even from a Facebook comment or a WhatsApp forward. Zero-friction capture (quick-add: name + county + phone, everything else optional, backfilled later).
- **Lead Score** is not manually set — it's a computed field (rules-based today, Brain-assisted later) from: data completeness, school size, ICT teacher present, source quality, engagement signal count (opens, replies, demo attendance).
- Duplicate detection on School Name + County (fuzzy match) at creation time — never allow silent duplicate schools; the effect would be split activity history and a wrong "first contact" date.

### 2.2 Sales Pipeline
- Kanban with the stages listed in the brief, stored as an ordered, editable list (Settings → Pipeline Stages), not hardcoded — a founder will reorder/rename these within the first month.
- A Deal (`growth_deals`) is 1:1 with a School's *current* sales motion. Re-engaging a Lost school creates a new Deal, never resurrects the old one — Lost→Won history must stay intact for conversion-rate accuracy.
- Stage changes are always logged as Activities automatically (no silent state mutation — same principle CLAUDE.md enforces for learner evidence: state changes are never invisible).
- Every stage has: notes (freeform + structured), reminders (linked Follow-ups), activity history (auto + manual), attachments (proposal PDFs, signed MOUs), owner (defaults to creator, reassignable once multi-user).

### 2.3 Cold Outreach Engine
- An Outreach Touch (`growth_activities` with `channel` set) is the atomic unit — one call, one WhatsApp message, one email. A Sequence is an ordered template of touches with configurable delays ("Day 0: WhatsApp, Day 2: Email, Day 5: Call") assignable to a Lead.
- The engine never sends without a human click during Phase 1 (see automation approval model, §3.5) — it prepares the draft and queues it.
- A lead is "in an active sequence" or not — dashboard prominently flags leads with **zero scheduled next action**, which is the single worst state a lead can be in ("never allow a lead to disappear" from the brief, made literal as a query: `next_follow_up_at IS NULL AND stage NOT IN ('paid_customer','lost')`).

### 2.4 Follow-up Management
- Follow-ups are a first-class entity (`growth_follow_ups`), not a field on Deal — a School/Deal can have many, only one is ever "next."
- Rule templates ship as defaults (2-day, 7-day, post-demo, pre-term-open, pre-renewal) but are editable per-deal.
- Overdue = `due_at < now() AND completed_at IS NULL`. Overdue follow-ups are the top section of the Founder Dashboard, full stop — nothing above them.

### 2.5 Demo Management
- A Demo (`growth_demos`) belongs to a Deal. Fields per brief plus a required post-demo prompt (structured, not just a text box) so "probability of conversion" is comparable across demos rather than a vibe.
- Completing a Demo auto-creates a follow-up (default: 2 days later) — this is a rule in the Automation Engine, not hardcoded UI logic, so it stays configurable.

### 2.6 Pilot School Management
- A Pilot Workspace only exists once a Deal reaches `pilot_school` stage — creation is automatic on stage transition (an Automation Engine action, §3.1).
- **Weekly Health Score** is computed (not manually entered) from: login frequency of onboarded teachers, feature usage breadth, issues-reported vs issues-resolved ratio, training-session attendance. This is a Growth Engine computation over Growth Engine data (logins/usage synced from the product), *not* a call into the learner Intelligence Layer.
- Risk Level (Low/Medium/High) derives from Health Score trend (falling 2 weeks running → escalate), surfaced on the Health Board sorted worst-first.

### 2.7 Teacher Champions
- A Champion record links to exactly one School and optionally one Contact. Influence level is a manual 1–5 founder judgment call (not everything needs to be computed) but referral count and testimonial count are derived/counted fields, never hand-maintained, to avoid drift.

### 2.8 Partnership Management
- Partners are typed (union / university / NGO / publisher / trainer / government / consultant) for filtering. Partner meetings reuse the same Activity/Follow-up primitives as sales — no parallel meeting system.

### 2.9 Marketing Hub
- Content items carry a `generated_leads` counter, incremented by an Automation Engine rule whenever a new Lead's `source_content_id` is set (i.e., lead capture forms / UTM-tagged links attribute back to content) — this is what makes "which content generates leads" answerable rather than aspirational.

### 2.10 Product Feedback
- Feedback is captured from *anywhere* (a quick-add on Pilot Workspace, Champion page, or Demo notes) and always links to a School and optionally a Contact — feedback with no attribution is nearly useless six months later.
- Classification (feature/bug/improvement/complaint/praise) + frequency/impact/effort scoring drives a simple priority score (`frequency × impact / effort`) shown on a ranked list — enough for a founder to triage without building a full product-ops tool.

### 2.11 Revenue Dashboard
- Derived entirely from `growth_deals` (pipeline value, stage-weighted forecast) + `growth_payments` (actuals, MRR, renewals) — never hand-entered totals.

### 2.12 Founder Dashboard
- See §13.1 for wireframe. It is a *view*, not a data owner — every widget queries existing modules. This keeps it cheap to keep accurate as the system grows.

---

## 3. Growth Automation Engine

The Automation Engine is the "Hands." It is event-driven: every meaningful write to the Growth CRM emits an internal event; rules subscribe to events (or run on a schedule) and produce **proposed or executed actions**.

### 3.1 Architecture

```
[CRM writes] → [Event Bus] → [Rule Evaluator] → [Action Executor] → [Audit Log]
                    ↑                                    ↓
         [Scheduled ticks: hourly / daily / weekly]   [Approval Queue] (if action requires confirmation)
```

- **Event Bus**: reuses the pattern already established in the core product (`publishEvent()`, `docs/events/`) — this system should emit its own event types (`growth.lead.created`, `growth.deal.stage_changed`, `growth.followup.overdue`, `growth.demo.completed`, `growth.pilot.health_dropped`, `growth.deal.inactive`, etc.) into the same infrastructure rather than inventing a second one.
- **Rule** (`growth_automation_rules`): `{ id, name, trigger_event | trigger_schedule, condition (jsonb), action_type, action_config (jsonb), requires_approval (bool), enabled (bool) }`. Rules are data, editable in Settings → Automation Rules, not code — a founder must be able to turn one off without a deploy.
- **Action Executor**: a fixed, small set of typed action handlers (send_whatsapp_draft, send_email_draft, create_followup, create_task, change_deal_stage, create_pilot_workspace, post_notification, generate_briefing, generate_report). No arbitrary code execution from rule config — this is a safety boundary, not a limitation, since the whole point is a small trusted action vocabulary.
- **Audit Log** (`growth_automation_runs`): every rule evaluation that produced an action is recorded — rule id, trigger, input snapshot, action taken, approval status, who approved (if applicable), outcome. This is non-negotiable per the brief ("keep a complete audit trail of every automated action") and mirrors the append-only, never-mutated evidence pattern the core product already uses for learner evidence — corrections are new rows, not edits.

### 3.2 The 13 behaviors from the brief, mapped to rule types

| Behavior | Trigger | Action | Default approval |
|---|---|---|---|
| Detect new lead → onboarding workflow | `growth.lead.created` | attach default sequence, schedule first touch | auto |
| Remind of overdue follow-ups | scheduled (hourly) | `post_notification` + surface on dashboard | auto (it's a reminder, not an external action) |
| Suggest next best action | `growth.deal.*` events | calls Intelligence interface (§4), stores recommendation, surfaces in Deal Detail | auto-surface, human acts |
| Generate personalized drafts (email/WhatsApp/call script) | manual trigger or sequence step due | calls Intelligence interface for personalization, creates draft | **requires approval** (external-facing) |
| Schedule recurring follow-ups by stage | `growth.deal.stage_changed` | `create_followup` per stage template | auto |
| Identify inactive opportunities | scheduled (daily) | flag + `post_notification` | auto (flagging), re-engagement send requires approval |
| Highlight high-priority schools | scheduled (daily) or `growth.lead.score_changed` | surface on dashboard | auto |
| Surface at-risk pilot schools | `growth.pilot.health_dropped` | `post_notification`, add to Health Board top | auto |
| Detect objections, recommend responses | manual (founder logs an objection on an Activity) | calls Intelligence interface, returns suggested response | auto-surface, human sends |
| Morning briefing | scheduled (daily, 6am) | `generate_briefing` → summarizes overdue items, today's demos/follow-ups, new leads, at-risk pilots | auto (internal, read-only) |
| Weekly/monthly reports | scheduled (weekly/monthly) | `generate_report` → revenue, conversion, pipeline velocity snapshot | auto (internal, read-only) |
| KPI monitoring / anomaly flags | scheduled (daily) | compares rolling averages, flags >X% deviation | auto (flagging only) |
| Audit trail | every rule execution | write to `growth_automation_runs` | always, non-optional |

### 3.3 Reversibility

Every executed action records enough to undo it: stage changes store `previous_stage`; created follow-ups/tasks can be cancelled; drafted-but-unsent messages simply never left the system. Only two action types are genuinely irreversible once triggered — **sent messages** and **published reports** — which is exactly why those two categories default to `requires_approval = true` and everything read-only/internal defaults to auto.

### 3.4 Approval Queue

A single inbox-style queue (Automation → Approvals) lists every pending action awaiting a yes/no/edit-then-send. This is the one UI surface where automation and human judgment physically meet — it must never silently expire an approval (better to keep nagging than to lose a queued outreach).

### 3.5 Approval model — configurable, not fixed

Per rule: `requires_approval` defaults per the table above but is toggleable. As trust builds (a founder watching the audit log for a month and seeing zero bad sends), specific rules can be flipped to autonomous. This is the explicit design answer to "should require user approval unless explicitly enabled" — approval is the default; autonomy is opt-in per rule, never global.

---

## 4. Existing Intelligence Integration

### 4.1 Contract

The Growth Engine depends on one interface, not on any specific model, prompt, or reasoning implementation:

```ts
type IntelligenceSubjectType = 'school' | 'deal' | 'contact' | 'pilot' | 'objection';

type IntelligenceRecommendation = {
  subjectType: IntelligenceSubjectType;
  subjectId: string;
  kind:
    | 'next_best_action'
    | 'conversion_prediction'
    | 'reengagement_timing'
    | 'message_draft'
    | 'objection_response'
    | 'risk_flag';
  payload: Record<string, unknown>; // shape depends on `kind`
  confidence: number; // 0–1
  rationale: string;  // human-readable "why" — never surfaced without this
  generatedAt: string;
};

function getRecommendation(
  subjectType: IntelligenceSubjectType,
  subjectId: string,
  kind: IntelligenceRecommendation['kind']
): Promise<IntelligenceRecommendation>;
```

- The Growth Engine calls this interface, **caches the result** in `growth_intelligence_recommendations` (subject, kind, payload, confidence, rationale, generated_at, consumed_at, action_taken_id nullable), and never fabricates a recommendation itself if the call fails — a failed/absent recommendation means the automation rule that depends on it simply doesn't fire; it never falls back to a guess presented as if it were reasoned.
- This mirrors the core product's own hard rule that intelligence must always carry Observation/Evidence/Confidence/Action (`project-evidence-first-philosophy` in memory) — the Growth Engine imports that discipline for its own domain rather than reinventing a laxer one.
- **What the Growth Engine explicitly does NOT do**: no direct LLM calls for scoring/prediction/personalization logic buried in Growth Engine code. If a `message_draft` is needed and no Intelligence Layer exists yet for that subject type, the action is either skipped (auto path) or handed to the founder as a blank template (approval path) — never silently hand-rolled with an ad hoc prompt that competes with the real reasoning layer.

### 4.2 Where each module calls in

| Module | Recommendation kind consumed |
|---|---|
| Pipeline (Deal Detail) | `next_best_action`, `conversion_prediction` |
| Outreach | `message_draft` |
| Follow-ups | `reengagement_timing` |
| Pilot Health Board | `risk_flag` |
| Objection handling (Activity log) | `objection_response` |

### 4.3 Degradation

If the Intelligence Layer is unavailable or not yet built for a given `kind`, every dependent screen falls back to the rules-only baseline it would have had anyway (e.g., lead score from the deterministic formula in §2.1, follow-up templates from stage defaults). The Growth Engine is fully usable — just less smart — with zero intelligence integration. This is deliberate: it lets Phase 1 ship (§15) before any Brain-layer work is required.

---

## 5. Database Schema

All tables follow the core product's DB rules: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, explicit RLS, named-column selects only, indexes on every FK. Prefixed `growth_` to keep the domain visually and physically separate from learner-intelligence tables.

```sql
-- Organizations / users (reuse existing auth.users; one row per Growth OS user)
create table growth_users (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role text not null check (role in ('founder','sales','partnerships','marketing','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Schools = the Lead / Account entity
create table growth_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text,
  sub_county text,
  school_type text,               -- primary/junior secondary/senior secondary etc.
  ownership text check (ownership in ('public','private')),
  boarding_type text check (boarding_type in ('boarding','day','mixed')),
  learner_count int,
  teacher_count_approx int,
  website text,
  facebook_page text,
  source text,                    -- referral, cold call, event, content, inbound
  source_content_id uuid references growth_content(id),
  lead_score numeric,             -- computed, see §2.1
  notes text,
  owner_id uuid references growth_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_schools (owner_id);
create index on growth_schools (county);
create index on growth_schools (source_content_id);

create table growth_school_tags (
  school_id uuid not null references growth_schools(id) on delete cascade,
  tag text not null,
  primary key (school_id, tag)
);

-- Contacts (Principal, Deputy, ICT teacher, etc.)
create table growth_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id) on delete cascade,
  full_name text not null,
  title text,                     -- Principal / Deputy Principal / ICT Teacher / etc.
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_contacts (school_id);

-- Pipeline stage definitions (editable, ordered)
create table growth_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,       -- lead_identified, research_complete, ...
  label text not null,
  sort_order int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deals = one active sales motion per school
create table growth_deals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  stage_id uuid not null references growth_pipeline_stages(id),
  previous_stage_id uuid references growth_pipeline_stages(id),
  owner_id uuid references growth_users(id),
  estimated_value numeric,
  probability numeric,            -- may be Intelligence-supplied
  lost_reason text,
  stage_entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_deals (school_id);
create index on growth_deals (stage_id);
create index on growth_deals (owner_id);

-- Activities = every touch: call, WhatsApp, email, meeting, note, stage change
create table growth_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  deal_id uuid references growth_deals(id),
  contact_id uuid references growth_contacts(id),
  channel text not null check (channel in
    ('call','whatsapp','email','linkedin','facebook','meeting','note','system')),
  direction text check (direction in ('outbound','inbound')),
  subject text,
  body text,
  outcome text,
  occurred_at timestamptz not null default now(),
  created_by uuid references growth_users(id),
  created_at timestamptz not null default now()
);
create index on growth_activities (school_id);
create index on growth_activities (deal_id);
create index on growth_activities (contact_id);

-- Follow-ups / tasks
create table growth_follow_ups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  deal_id uuid references growth_deals(id),
  title text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references growth_users(id),
  assigned_to uuid references growth_users(id),
  source text not null default 'manual' check (source in ('manual','automation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_follow_ups (deal_id);
create index on growth_follow_ups (assigned_to, due_at);

-- Demos
create table growth_demos (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references growth_deals(id),
  scheduled_at timestamptz not null,
  duration_minutes int,
  attendees jsonb,                -- [{name, title}]
  questions_asked text,
  pain_points text,
  requested_features text,
  notes text,
  outcome text,
  conversion_probability numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_demos (deal_id);

-- Pilot workspaces
create table growth_pilot_schools (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id) unique,
  deal_id uuid not null references growth_deals(id),
  started_at timestamptz not null default now(),
  health_score numeric,
  risk_level text check (risk_level in ('low','medium','high')),
  renewal_likelihood numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_pilot_schools (school_id);

create table growth_pilot_teachers (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references growth_pilot_schools(id) on delete cascade,
  contact_id uuid references growth_contacts(id),
  onboarded_at timestamptz,
  last_login_at timestamptz,
  training_sessions_completed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_pilot_teachers (pilot_id);

create table growth_pilot_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references growth_pilot_schools(id) on delete cascade,
  description text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on growth_pilot_issues (pilot_id);

-- Teacher champions
create table growth_champions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  contact_id uuid references growth_contacts(id),
  subjects text[],
  influence_level int check (influence_level between 1 and 5),
  training_completed boolean not null default false,
  referrals_generated int not null default 0,
  testimonials_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_champions (school_id);

-- Partnerships
create table growth_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in
    ('union','university','ngo','publisher','trainer','government','consultant')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table growth_partner_meetings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references growth_partners(id) on delete cascade,
  occurred_at timestamptz not null,
  notes text,
  follow_up_id uuid references growth_follow_ups(id),
  created_at timestamptz not null default now()
);
create index on growth_partner_meetings (partner_id);

-- Marketing
create table growth_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null check (channel in
    ('tiktok','facebook','linkedin','blog','email','other')),
  status text not null default 'planned' check (status in ('idea','planned','published')),
  published_at timestamptz,
  generated_leads int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  starts_at date,
  ends_at date,
  budget numeric,
  leads_generated int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Feedback
create table growth_feedback (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  contact_id uuid references growth_contacts(id),
  category text not null check (category in
    ('feature_request','bug','improvement','complaint','praise')),
  description text not null,
  frequency int not null default 1,
  impact int check (impact between 1 and 5),
  effort int check (effort between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on growth_feedback (school_id);

-- Revenue
create table growth_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id),
  deal_id uuid references growth_deals(id),
  amount numeric not null,
  currency text not null default 'KES',
  paid_at timestamptz not null,
  kind text not null check (kind in ('trial','subscription','renewal')),
  created_at timestamptz not null default now()
);
create index on growth_payments (school_id);

-- Automation
create table growth_automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event text,             -- e.g. 'growth.deal.stage_changed'
  trigger_schedule text,          -- cron expression, mutually exclusive with trigger_event
  condition jsonb not null default '{}',
  action_type text not null,
  action_config jsonb not null default '{}',
  requires_approval boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table growth_automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references growth_automation_rules(id),
  trigger_event text,
  input_snapshot jsonb,
  action_type text not null,
  action_payload jsonb,
  status text not null check (status in
    ('proposed','approved','rejected','executed','failed')),
  approved_by uuid references growth_users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index on growth_automation_runs (rule_id);
create index on growth_automation_runs (status);

create table growth_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references growth_users(id),
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on growth_notifications (user_id, read_at);

-- Intelligence integration cache
create table growth_intelligence_recommendations (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  kind text not null,
  payload jsonb not null,
  confidence numeric not null,
  rationale text not null,
  generated_at timestamptz not null,
  consumed_at timestamptz,
  action_taken_id uuid references growth_automation_runs(id),
  created_at timestamptz not null default now()
);
create index on growth_intelligence_recommendations (subject_type, subject_id);
```

RLS: every table gated on `growth_users.role` (founder = full access; sales/partnerships/marketing/support = scoped per §12). Service-role client used only by the Automation Engine's scheduled/event-driven workers, per the core product's existing security rule that the service role bypasses RLS and is reserved for cron/webhooks.

---

## 6. Entity Relationships

```
growth_schools 1─* growth_contacts
growth_schools 1─* growth_deals
growth_schools 1─* growth_activities
growth_schools 1─* growth_feedback
growth_schools 1─1 growth_pilot_schools (optional)
growth_schools 1─* growth_champions
growth_schools 1─* growth_payments

growth_deals   *─1 growth_pipeline_stages
growth_deals   1─* growth_demos
growth_deals   1─* growth_follow_ups
growth_deals   1─* growth_activities
growth_deals   1─1 growth_pilot_schools (once stage = pilot_school)

growth_pilot_schools 1─* growth_pilot_teachers
growth_pilot_schools 1─* growth_pilot_issues

growth_partners 1─* growth_partner_meetings

growth_content   1─* growth_schools (attribution via source_content_id)
growth_campaigns  — reports against growth_schools.source / date range, no FK needed

growth_automation_rules 1─* growth_automation_runs
growth_intelligence_recommendations *─1 (subject_type, subject_id) — polymorphic, not FK-enforced
```

Everything ultimately traces back to `growth_schools.id` — the single join key for "show me everything about this school," the same design instinct as the core product's learner-centric timeline.

---

## 7. User Journeys

**J1 — New lead to first contact (founder, solo).**
Founder hears about a school → quick-add (name, county, phone) → Automation Engine fires `growth.lead.created` → default sequence attached, Day-0 WhatsApp draft generated → founder reviews draft in Approvals Queue → sends → Activity logged automatically → Follow-up scheduled for Day 2.

**J2 — Demo to pilot.**
Deal reaches `demo_conducted` → founder fills structured demo notes → completing the note auto-creates a 2-day follow-up (rule) → founder moves deal to `trial_started` → after trial period, moves to `pilot_school` → Automation Engine auto-creates the Pilot Workspace and prompts founder to add onboarded teachers/contacts.

**J3 — At-risk pilot rescue.**
Weekly health job recomputes all pilot health scores → one school's score has dropped 2 weeks running → `growth.pilot.health_dropped` fires → notification + Health Board top slot → founder opens Pilot Workspace, sees open issues and login gaps, logs a support call as an Activity, schedules a check-in Follow-up.

**J4 — Morning routine.**
6am scheduled job generates the morning briefing → founder opens Founder Dashboard → sees overdue follow-ups (top), today's demos, new leads since yesterday, at-risk pilots, pending approvals → works the Approval Queue first (drafts waiting from yesterday), then the day's calendar.

**J5 — Monthly review.**
1st of month, scheduled report generation → Revenue Dashboard + Analytics snapshot emailed/notified → founder reviews conversion rate trend, pipeline velocity, MRR growth, content performance → adjusts which content gets more investment.

**J6 — Feedback closing the loop.**
Pilot teacher raises an issue in a training session → founder logs it under Feedback (linked to school + contact) → later, when triaging feature requests, sorts by priority score → a shipped fix or feature can be marked resolved and (manually) referenced back to the school for a "we built this because you asked" touch — strong champion-building move, deliberately manual since it's relationship-sensitive.

---

## 8. Screen Inventory

| # | Screen | Type |
|---|---|---|
| 1 | Founder Dashboard (Home) | Dashboard |
| 2 | Leads — list/table | List (filterable, sortable) |
| 3 | Lead/School Detail | Detail (tabs: Overview, Activity, Contacts, Feedback, Documents) |
| 4 | Lead Import / Bulk Add | Form |
| 5 | Pipeline — Kanban board | Kanban |
| 6 | Pipeline — List view | List |
| 7 | Deal Detail | Detail (tabs: Overview, Activity, Demos, Follow-ups, Documents, Intelligence) |
| 8 | Outreach — Sequences | List + editor |
| 9 | Outreach — Inbox | List (reply triage) |
| 10 | Outreach — Templates | List + editor |
| 11 | Follow-ups — My Follow-ups | List (global, cross-school) |
| 12 | Demos — Upcoming | Calendar/list |
| 13 | Demo Detail / Notes | Form + detail |
| 14 | Demo Library | Gallery/list |
| 15 | Pilot Roster | List |
| 16 | Pilot Workspace | Detail (tabs: Teachers, Usage, Issues, Training, Health, Feedback) |
| 17 | Pilot Health Board | List, risk-sorted |
| 18 | Champions | List |
| 19 | Champion Detail | Detail |
| 20 | Partner Directory | List |
| 21 | Partner Detail | Detail |
| 22 | Content Calendar | Calendar |
| 23 | Campaigns | List |
| 24 | Content Performance | Analytics view |
| 25 | Feedback — Ranked list | List |
| 26 | Feedback Detail | Detail |
| 27 | Revenue Dashboard | Dashboard |
| 28 | Automation — Rules | List + editor |
| 29 | Automation — Activity Log | List (audit trail) |
| 30 | Automation — Approvals Queue | Queue/inbox |
| 31 | Analytics | Dashboard (multi-tab) |
| 32 | Settings — Pipeline Stages | Form/list editor |
| 33 | Settings — Users & Permissions | List + form |
| 34 | Settings — Integrations | Form |
| 35 | Global Search / Command Palette | Overlay |

---

## 9. Navigation Structure

- **Left sidebar** (collapsible, icon-only on mobile→bottom tab bar): Home, Leads, Pipeline, Outreach, Follow-ups, Demos, Pilot Schools, Champions, Partnerships, Marketing, Feedback, Revenue, Automation, Analytics — grouped visually into "Sell" (Leads/Pipeline/Outreach/Follow-ups/Demos), "Grow" (Pilot Schools/Champions/Partnerships/Marketing/Feedback), "Know" (Revenue/Automation/Analytics).
- **Top bar**: global search (⌘K opens full command palette), notification bell (unread `growth_notifications` count), quick-add (+) for Lead/Follow-up/Activity, user menu (theme toggle, settings).
- **Command palette**: fuzzy jump to any School/Deal/Contact by name; quick actions ("New lead," "Log a call," "Go to Approvals"); keyboard-first, no mouse required for the founder's daily loop.
- **Breadcrumbs** on every Detail screen: `Leads > [School Name]` or `Pipeline > [School Name] > Deal`.
- **Cross-cutting Follow-ups**: never siloed to one screen — a "Due today" badge count sits in the sidebar next to Follow-ups at all times.

---

## 10. Component Inventory

- **KanbanBoard / KanbanColumn / KanbanCard** — drag-drop deal cards, stage-colored, shows school name, value, days-in-stage, next follow-up chip.
- **DataTable** — sortable/filterable, saved views, bulk actions, used by Leads/Feedback/Partners/Content lists.
- **Timeline** — chronological Activity feed component, reused on School Detail, Deal Detail, Pilot Workspace.
- **FollowUpBadge / FollowUpList** — overdue (red), due-today (amber), upcoming (neutral).
- **HealthScoreGauge** — used on Pilot Workspace + Health Board.
- **RecommendationCard** — renders an `IntelligenceRecommendation` with confidence bar + rationale + accept/dismiss actions; the one component every Intelligence-consuming screen shares.
- **ApprovalCard** — draft preview (message/action), edit-then-send, approve, reject; used only in Approvals Queue.
- **StatTile** — single KPI with trend sparkline, used across Founder Dashboard/Revenue/Analytics (per the dataviz skill's stat-tile pattern).
- **QuickAddModal** — polymorphic (Lead/Follow-up/Activity/Feedback), opened from top bar (+).
- **CommandPalette** — global overlay, fuzzy search + actions.
- **StageBadge / RiskBadge / PriorityBadge** — small colored status chips reused everywhere a status enum appears.
- **CalendarView** — Demos, Content Calendar.
- **AuditLogRow** — Automation Activity Log entries, expandable to show input snapshot/output.
- **EmptyState** — every list screen needs one ("No leads yet — add your first school").
- **NotificationDrawer** — bell-triggered panel over `growth_notifications`.

---

## 11. API Architecture

REST, thin routes per CLAUDE.md convention — `app/api/growth/[resource]/route.ts`, all business logic in `lib/growth/*.ts`.

```
/api/growth/schools                GET, POST
/api/growth/schools/[id]           GET, PATCH
/api/growth/schools/[id]/activities GET, POST
/api/growth/contacts               GET, POST
/api/growth/contacts/[id]          PATCH, DELETE
/api/growth/deals                  GET, POST
/api/growth/deals/[id]             GET, PATCH
/api/growth/deals/[id]/stage       PATCH   (dedicated — always logs an Activity + fires event)
/api/growth/follow-ups             GET, POST
/api/growth/follow-ups/[id]        PATCH   (complete/reschedule)
/api/growth/demos                  GET, POST
/api/growth/demos/[id]             PATCH
/api/growth/pilots                 GET
/api/growth/pilots/[id]            GET, PATCH
/api/growth/pilots/[id]/teachers   GET, POST
/api/growth/pilots/[id]/issues     GET, POST, PATCH
/api/growth/champions              GET, POST
/api/growth/partners               GET, POST
/api/growth/partners/[id]/meetings GET, POST
/api/growth/content                GET, POST
/api/growth/campaigns              GET, POST
/api/growth/feedback               GET, POST
/api/growth/payments               GET, POST
/api/growth/automation/rules       GET, POST, PATCH
/api/growth/automation/runs        GET            (audit log, read-only)
/api/growth/automation/approvals   GET, POST       (approve/reject a proposed run)
/api/growth/notifications          GET, PATCH      (mark read)
/api/growth/analytics/[view]       GET             (revenue, pipeline, conversion, content)
/api/growth/search                 GET             (command palette)
/api/growth/cron/daily-jobs        POST            (webhook, service-role, verified secret — daily automation ticks)
/api/growth/cron/weekly-jobs       POST            (webhook, service-role — weekly reports/health recompute)
```

Every non-cron route: `auth.getUser()` first, 401 if absent, then role check from `growth_users.role` against the permissions matrix (§12), 403 on mismatch — same rule the core product already enforces platform-wide. Cron routes are service-role only and verify a shared secret header, mirroring the existing `CRON_SECRET` pattern already in use (memory: the existing Holiday Plans cron already had a real incident from an unquoted `#` truncating that secret — new cron secrets should be quoted).

---

## 12. Permissions Model

This entire section is **Mode 2/3 surface** (§0.6) — in Mode 1 there is exactly one role (`founder`, full access to everything) and none of this renders: no role picker, no assignment field, no "owner" column. The table below is the design for when it's needed, not something Phase 0 builds toward.

| Role | Leads/Pipeline | Outreach/Follow-ups | Demos | Pilots | Champions/Partners | Marketing | Feedback | Revenue | Automation | Settings |
|---|---|---|---|---|---|---|---|---|---|---|
| **founder** | full | full | full | full | full | full | full | full | full (incl. approvals) | full |
| **sales** | own + team-visible | own | own | read | read | read | create | read (own deals) | approve own | none |
| **partnerships** | read (schools linked to their partners) | own (partner meetings) | none | none | full | none | none | none | none | none |
| **marketing** | read | none | none | none | none | full | none | read (content-attributed) | none | none |
| **support** | read | none | none | full (assigned pilots) | read | none | create/read | none | none | none |

Row-level scoping beyond role (e.g., "sales rep only sees their own leads until founder marks team-visible") is a Mode 3 concern — Mode 2 is small enough that team-visible-by-default is simpler and correct. RLS policies implement the table above directly (mirrors the existing rule that RLS must be explicit per table, never assumed), and activate the moment `growth_users` headcount crosses into Mode 2.

---

## 13. Dashboard Wireframe Descriptions

### 13.1 Founder Dashboard (Home)

In Mode 1, this does not look like software. It reads like a briefing a good assistant would hand you at 7am — four short sections, nothing else above the fold:

```
Good morning, Dennis.

Today matters:

Must Do
☎ Call Kerugoya Boys
📧 Reply to KUPPET
🎥 Demo at 2 PM
📞 Follow up with ACK School

Waiting For
3 schools haven't replied.
1 demo awaiting confirmation.

At Risk
Pilot School A — no activity for 6 days.

Wins
1 new lead yesterday.
2 teachers joined.
TikTok generated 3 enquiries.
```

That's the whole page. Every one of the four sections is a thin read over existing modules, nothing new to maintain:

- **Must Do** — today's due Follow-ups + today's scheduled Demos + anything overdue, merged into one ranked, time-ordered list. This absorbs what would otherwise be three separate widgets ("Overdue Follow-ups," "Today's Demos," "Today's Follow-ups") — a founder doesn't think in those categories, they think in "what do I do next."
- **Waiting For** — deals sitting on someone else's reply (last Activity was outbound, no reply, no follow-up overdue yet — i.e., not yet actionable, just tracked so nothing is forgotten).
- **At Risk** — the merge of at-risk pilots (§2.6 health-drop) and inactive deals (§3.2), ranked worst-first, capped to the handful that actually need attention today, not a full list.
- **Wins** — yesterday's new leads, pilot milestones, and content-attributed enquiries. Morale and momentum, not analytics — this is deliberately the one section with no action attached to it.

Pipeline summary, revenue snapshot, recent activity feed, and recent feedback — all real, all still needed — live **one click away**, not on this page. Mode 1's dashboard optimizes for "what do I do in the next 10 minutes," not "survey everything." Founders spend ~95% of the day talking to people, not reading dashboards; this page's only job is to get out of the way fast. A quick-add row (New Lead · Log Activity · Schedule Demo) sits below the four sections for the rare case something needs creating before the day's list is worked.

In Mode 2/3 (§0.6), this page grows a "Team" variant — same four-section shape, but "Must Do" becomes per-rep and a team summary strip appears beneath Wins. The single-person version above is never replaced, only extended.

### 13.2 Revenue Dashboard
Top: 4 stat tiles (MRR, Pipeline Value, This Month's Payments, Forecast Next 90 Days). Below: pipeline-value-by-stage funnel chart, conversion-rate-by-stage table, sales-cycle-length trend line, renewal calendar (upcoming renewals in next 60 days, risk-flagged).

### 13.3 Pilot Health Board
List view, sorted risk-descending. Each row: school name, health score gauge, risk badge, trend arrow (vs last week), onboarded-teacher count, open-issues count, "last activity" timestamp. Click-through to Pilot Workspace.

### 13.4 Automation Console
Three tabs: Rules (table of all rules, enabled toggle, requires-approval toggle, edit condition/action), Activity Log (chronological, filterable by rule/status), Approvals Queue (card list, approve/edit/reject inline).

---

## 14. Analytics

Dashboards, each backed by a dedicated read-optimized view/query (never computed client-side from raw tables — same "no query inside a loop" discipline as the rest of the codebase):

- **Lead Sources** — volume + conversion rate by source, bar chart.
- **Conversion Rates** — funnel, stage-to-stage %, with drop-off callouts.
- **Pipeline Velocity** — average days-in-stage per stage, trend over time.
- **Sales Performance** — (multi-user phase) activity volume and conversion by owner.
- **Demo Success Rate** — demos → trial-started conversion %, by month.
- **Customer Acquisition Trends** — new pilots/paid customers over time, cohort by month.
- **Retention** — renewal rate, churn rate, cohort retention curves.
- **Revenue Growth** — MRR trend, new vs. expansion vs. churned MRR (simple mode: just new vs. churned, given school-level scale).
- **Content Performance** — leads generated per content item/campaign, cost-per-lead where budget tracked.
- **Referral Performance** — champion-sourced leads and their conversion rate vs. non-referral.
- **Pilot Success** — health score distribution, average time pilot→paid, risk-level distribution.

All chart/color/layout decisions for these dashboards should follow the `dataviz` skill's palette and form heuristics when actually built, to keep this visually consistent with the rest of the product's dashboards.

---

## 15. Recommended Implementation Phases

**Phase 0 — Five things, nothing else (August scope).**
Applying §0.5's filter honestly, Phase 0 is not six tables — it's five *concepts*, and `growth_pipeline_stages` + `growth_deals` collapse into one of them ("Pipeline" — a school's stage is just a field on the school's one active deal, and stages can start as a hardcoded enum, not an admin-editable table, until there's a real reason to rename one):

1. **Schools** — the CRM. Quick-add (name, county, phone), everything else optional.
2. **Contacts** — who do I talk to. A simple sub-list on the School, not its own top-level screen yet.
3. **Activities** — what happened. One timeline per school; call/WhatsApp/email/meeting/note.
4. **Follow-ups** — what happens next. One list, due-date sorted, that's the entire "what should I do" surface for now.
5. **Pipeline** — where are we. A stage field on the school (Lead → ... → Paid, hardcoded list) plus a single Kanban view over it.

Screens: School list, School Detail (Contacts + Activity timeline inline, not separate pages), Pipeline Kanban, Follow-ups list, plus the Mode-1 Founder Dashboard from §13.1 reading over exactly these four tables. No Demos, Pilots, Champions, Partners, Marketing, Feedback, Revenue, or Automation Engine yet — those all wait, per §0.5, until the five-thing version has been used for real and something in it is actually the bottleneck. This is genuinely usable solo within days and already beats a spreadsheet.

**Phase 1 — Demos + basic reminders.**
Add `growth_demos` and promote Pipeline stages from a hardcoded enum to the `growth_pipeline_stages` table once the stage list has actually needed to change. Follow-ups gain simple due-date notifications (still no automation engine — a plain scheduled query, not rules).

**Phase 2 — Automation Engine v1 (rules + audit log, approval-gated).**
Event bus wiring, `growth_automation_rules`/`growth_automation_runs`, the stage-template follow-up rules, overdue reminders as real notifications, Approvals Queue. No Intelligence Layer calls yet — every "suggestion" is deterministic/rules-based.

**Phase 3 — Pilot Management + Champions + Feedback.**
`growth_pilot_schools` + children, `growth_champions`, `growth_feedback`. Pilot Health Board (health score computed from Growth Engine data only, no Brain dependency yet).

**Phase 4 — Marketing + Partnerships + Revenue Dashboard.**
`growth_content`, `growth_campaigns`, `growth_partners` + meetings, `growth_payments`, Revenue Dashboard, Analytics module.

**Phase 5 — Intelligence Layer integration.**
Wire `getRecommendation()` for `next_best_action` and `message_draft` first (highest daily-use value), then `reengagement_timing`, `risk_flag`, `objection_response`. Each addition is additive — nothing in Phases 0–4 depends on this existing.

**Phase 6 — Mode 2 (Small Team).**
Only once a second team member actually joins — unlock the full role matrix (§12), assignment fields, and team-visible dashboard variant (§13.1). Building this earlier is pure speculative cost for a single-founder phase.

**Phase 7 — Mode 3 (Regional Sales Team).**
Only once there are multiple reps and a manager layer — forecasting, manager dashboards, regional ownership, rep leaderboards (§0.6). Not designed in schema detail here; revisit when Phase 6 is real and the shape of an actual team is known rather than guessed.

This phasing directly follows the "Start Simple, Grow Later" principle already established for this project (smallest correct slice first, proven with real data, before generalizing), the Post-Audit Operating Charter's instruction to keep new build surface small and trustworthy, and §0.5's 30-minutes-per-week filter — Phase 0 alone is a legitimate, shippable v1, and every phase after it must independently clear that bar before it's built.

---

## 16. Risks and Trade-offs

| Risk | Trade-off / mitigation |
|---|---|
| **Second CRM-shaped system to maintain** alongside the learner platform | Kept fully domain-separated (`growth_` tables, `lib/growth/`, `app/api/growth/`) — zero coupling to learner intelligence code, reviewed as such. |
| **Automation sends something embarrassing to a real school** | Approval-gated by default for every external-facing action (§3.5); autonomy is earned per-rule, never assumed. |
| **Intelligence Layer doesn't exist yet for most `kind`s** | System is fully functional without it (§4.3) — Phase 5 is additive, not a blocker for Phases 0–4. |
| **Founder over-invests in dashboards/analytics before there's enough data to make them meaningful** | Phasing pushes Analytics/Revenue Dashboard to Phase 4, after there's a real pipeline to visualize. |
| **Health score / lead score formulas feel arbitrary early on** | Both are explicitly "deterministic v1, Brain-assisted later" — documented as provisional, not presented as authoritative until validated against real conversions. |
| **Scope creep — this spec is large** | Phase 0 alone (5 things, 4 screens) is independently shippable and already beats a spreadsheet; nothing here requires building the whole system before value appears. |
| **Multi-user permissions built too early** | Explicitly deferred to Phase 6 (Mode 2), gated on an actual second hire — avoids designing access control for a team that doesn't exist yet. |
| **Duplicate schools / dirty data at import time** | Fuzzy dedup at creation (§2.1) — cheap insurance against a spreadsheet-import mess later. |
| **Automation audit log becomes noise no one reads** | Approvals Queue surfaces the subset that needs a decision; the full log is opt-in reading, not forced reading — same pattern as the learner Evidence Layer's append-only-but-not-everything-surfaced design. |

---

## 17. Founder OS Charter

Everything in §§1–16 is mechanism. This section is the reason the mechanism exists — the standing charter every future addition to the Growth Engine is measured against, above even §0.5's 30-minute filter (that filter tells you *whether* to build something; this charter tells you *why* the thing you build should exist at all).

### Purpose

The EduNexus Growth Engine exists for one purpose: **to become the operating system of a founder building an education company from zero to national scale.**

It is not simply a CRM. It is not a marketing platform. It is not a task manager. It is not an automation tool. It is the environment in which the founder operates every day.

### Core Philosophy

The Growth Engine should continuously reduce friction between intention and execution. Every minute spent updating records, remembering follow-ups, searching for notes, switching between applications, or wondering what to do next is a minute not spent building relationships with schools. The system exists to eliminate that friction.

### The Founder Loop

The system should quietly guide the founder through the same repeatable cycle every day: **Observe → Decide → Act → Learn → Repeat.** Everything inside the Growth Engine should strengthen this loop.

**Observe.** The system continuously gathers information — schools discovered, people met, messages exchanged, meetings completed, content published, feedback received, pilot usage, revenue. Nothing important is forgotten.

**Decide.** The founder should never need to search for work. The system should surface the highest-leverage opportunities based on evidence — not the loudest task, not the oldest reminder, but the opportunity most likely to move EduNexus forward.

**Act.** Execution should require as little effort as possible: one click to call, one click to send an approved message, one click to schedule a demo, one click to log an activity. The founder should spend time talking to schools — not operating software.

**Learn.** Every interaction becomes organizational knowledge — which counties convert best, which messages work, which objections repeat, which partnerships matter, which content attracts schools, which pilots become paying customers. The company becomes smarter every week because its memory continuously improves.

### Daily Success

A successful day is not measured by how many tasks were completed. A successful day is measured by meaningful progress: a new school discovered, a principal contacted, a demo completed, a pilot school onboarded, a teacher becoming a champion, valuable product feedback captured, a partnership advanced, a customer renewed. The system should celebrate progress rather than busyness.

### Opportunity Engine

Every morning the system should answer one question — **"What are today's highest-leverage opportunities?"** — not "what are today's tasks?" Opportunities create growth. Tasks only create activity. This is the standard the Founder Dashboard's Must Do section (§13.1) is held to: it is a ranked opportunity list, not a raw task dump, even before Intelligence Layer ranking (§4) exists to make that literal.

### Founder Energy

The system should adapt to the founder's available capacity, not the other way around. High-energy days encourage outreach, demos, partnerships, and content creation. Medium-energy days focus on follow-ups, relationship building, and planning. Low-energy days prioritize lightweight administrative work, approvals, and maintaining momentum. The founder should not have to adapt to the system.

### Scale Through Simplicity

The first version should comfortably manage 20 schools, 100 contacts, 500 activities, 200 follow-ups, and 10 pilot schools. Only after this is proven through real daily use should the system expand. Real usage — not imagination — determines the roadmap, which is the same instinct that produced the five-thing Phase 0 in §15.

### The Automation Principle

Automation exists to remove repetitive work. It never removes accountability. Internal actions may execute automatically; external communication with schools remains approval-based unless explicitly enabled (§3.5). Every automated decision is explainable, every automated action is reversible where technically possible, and every automated action leaves an audit trail (§3.1, §3.3). Trust is earned through transparency.

### The Human Relationship Principle

Schools do not buy software. People trust people. Technology should strengthen relationships, not replace them. The Growth Engine should help the founder remember names, conversations, promises, concerns, and opportunities so that every interaction feels personal. Relationships remain human; operations become intelligent.

### The Final Question

Every feature added to the Growth Engine must answer one question before it is accepted into the product: **"Will this help EduNexus build stronger relationships with schools while reducing the founder's operational burden?"** If the answer is no, it does not belong in the Founder OS.

### Closing Statement

The EduNexus Founder OS is not designed to build a large company. It is designed to help one founder consistently do the right work, every day, until a large company naturally emerges. Its success is measured not by the number of features it contains, but by the number of schools whose lives improve because the founder had more time to serve them.

---

## Summary

This is a school-centric CRM (`growth_schools` as the hub) with a small, typed set of supporting entities (contacts, deals, activities, follow-ups, demos, pilots, champions, partners, content, feedback, payments), a rules-driven Automation Engine that acts as the system's "hands" with approval gating as the safety default, and a narrow, well-typed integration point into whatever Intelligence Layer exists or gets built later — never a second reasoning system. It is fully domain-separated from the CBC/CBE learner platform, follows the same architectural discipline (thin routes, `lib/` business logic, explicit RLS, append-only audit trails, no silent state mutation) already codified in this project's CLAUDE.md, and phases from a usable spreadsheet-replacement in days up to a full automated growth operating system without requiring any phase to wait on a later one.
