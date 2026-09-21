---
name: pilot-review
description: Produce the weekly Pilot Execution Review — the fixed 10-item PE-1 format. Items 1–6 (schools researched, contacted, discovery meetings, demos, pilot agreements, active pilots) are pulled from real Growth Engine data by read-only SQL; items 7–10 (biggest blocker, biggest lesson, evidence-triggered product changes, next week's priorities) are the founder's and are asked, never invented. Use on Fridays, at week end, or when the user asks for the weekly review / pilot review / PE-1 review.
---

# /pilot-review — weekly Pilot Execution Review

The success metric is real schools using EduNexus — not features, code or
documents. This review reports that truthfully, from logged data. A week
with no real school interactions is reported as exactly that.

`$ARGUMENTS` may name a week (e.g. "last week", "w/c 2026-09-14"). Default
is the current week, Monday 00:00 Africa/Nairobi to now.

## Step 1 — Pull items 1–6 from the Growth Engine (read-only)

Run this against the project database (Supabase MCP `execute_sql`, or
`npx tsx` with `growthRepos` from `lib/growth/repositories`). SELECT only —
this skill never writes.

```sql
with bounds as (
  select
    date_trunc('week', (now() at time zone 'Africa/Nairobi'))                     as this_start,
    date_trunc('week', (now() at time zone 'Africa/Nairobi')) - interval '7 days' as last_start
),
this_week as (
  select * from growth_activities, bounds
  where occurred_at >= this_start
),
last_week as (
  select * from growth_activities, bounds
  where occurred_at >= last_start and occurred_at < this_start
)
select
  -- 1. schools researched (added to the pipeline this week)
  (select count(*) from growth_schools, bounds where created_at >= this_start)           as researched_this,
  (select count(*) from growth_schools, bounds
     where created_at >= last_start and created_at < this_start)                          as researched_last,
  -- 2. schools contacted (distinct schools with an outbound touch)
  (select count(distinct school_id) from this_week
     where type in ('called','whatsapp','email','visited'))                               as contacted_this,
  (select count(distinct school_id) from last_week
     where type in ('called','whatsapp','email','visited'))                               as contacted_last,
  -- 3. discovery meetings
  (select count(*) from this_week where type = 'meeting')                                 as meetings_this,
  (select count(*) from last_week where type = 'meeting')                                 as meetings_last,
  -- 4. demos completed
  (select count(*) from this_week where type = 'demo')                                    as demos_this,
  (select count(*) from last_week where type = 'demo')                                    as demos_last,
  -- 5. pilot agreements (schools at pilot_offered or beyond, and how many moved there this week)
  (select count(*) from growth_schools
     where pipeline_stage in ('pilot_offered','pilot_running','pilot_won'))               as pilot_agreements_total,
  (select count(*) from growth_schools, bounds
     where pipeline_stage in ('pilot_offered','pilot_running','pilot_won')
       and updated_at >= this_start)                                                      as pilot_agreements_moved_this,
  -- 6. active pilot schools (current state, not a weekly delta)
  (select count(*) from growth_schools where pipeline_stage = 'pilot_running')            as active_pilots,
  (select count(*) from growth_schools where pipeline_stage = 'pilot_won')                as pilots_won;
```

Also pull the names behind any non-zero count for 3–6 (school name +
stage), so the review says which schools, not just how many:

```sql
select s.name, s.county, s.pipeline_stage, a.type, a.occurred_at::date, left(a.notes, 80) as note
from growth_activities a
join growth_schools s on s.id = a.school_id
where a.occurred_at >= date_trunc('week', (now() at time zone 'Africa/Nairobi'))
  and a.type in ('meeting','demo','training','support')
order by a.occurred_at;
```

If the query returns all zeros, that is the review. Do not soften it.

## Step 2 — Ask for items 7–10; never fill them in

These are the founder's judgment from the week they actually lived. Ask
all four at once, then wait:

7. Biggest blocker encountered this week
8. Biggest lesson learned
9. Product changes triggered by evidence (real school feedback → change
   made or queued). If the answer is "none," that is a valid answer.
10. Priorities for next week (max 3)

Do not propose answers, do not draft "likely" blockers from the data, do
not suggest product changes. If the user says there were no school
interactions this week, record that and skip to Step 3.

## Step 3 — Produce the review

```
# Pilot Execution Review — week of YYYY-MM-DD

| # | Item                          | This week | Last week |
|---|-------------------------------|-----------|-----------|
| 1 | Schools researched            |           |           |
| 2 | Schools contacted             |           |           |
| 3 | Discovery meetings            |           |           |
| 4 | Demos completed               |           |           |
| 5 | Pilot agreements              | total N (M moved this week)          |
| 6 | Active pilot schools          | N running · M won        |

Named interactions this week:
- <school> (<county>, <stage>) — <type> on <date>: <note>

7.  Biggest blocker:        <founder's words>
8.  Biggest lesson:         <founder's words>
9.  Evidence → product:     <founder's words, or "none">
10. Next week (max 3):      <founder's words>
```

Save it to `docs/growth-os/pilot-execution-reviews/YYYY-MM-DD.md` (create
the folder on first use) so the series is versioned and comparable.

## Step 4 — Learning policy follow-through

After the review is saved, remind the user which downstream records the
week's real interactions should update — only the ones that apply:

- Voice of Customer — per-school profile, if any school was spoken to
- Sales Playbook — if an objection, opener or close worked or failed
- Decision Journal (`/decide`) — only if a meaningful decision was made
- Market Intelligence — only if something ecosystem-level surfaced

Close by naming one real win from the week, drawn from the data or the
founder's answers. If there genuinely was none, say so rather than
inventing one.

## Guardrails

- Numbers come from the query, never from the founder's recollection.
- Items 7–10 come from the founder, never from inference.
- Engineering suggestions do not belong in this review. If item 7 names a
  real blocker a real school hit, that is a separate conversation, gated by
  PE-1's "does it remove a blocker for a real school today" filter.
