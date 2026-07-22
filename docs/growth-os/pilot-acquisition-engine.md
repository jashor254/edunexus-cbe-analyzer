# Pilot Acquisition Engine

**Sprint**: Pilot Operations Sprint PO-1. **Classification**: Pilot Critical. **Status**: designed and partially implemented — see §7 for exactly what shipped and what didn't, and why.

**What this is not**: not marketing automation, not lead scoring, not AI, not a CRM expansion. It is the operational workflow that consistently feeds the Growth Engine (`docs/growth-os/edunexus-growth-engine-specification.md`) with qualified pilot-school opportunities, for one founder, in August.

---

## 1. Research Workflow

The complete workflow for identifying a target school, kept to what's actually useful for a pilot-acquisition decision — nothing that would make research feel like data entry.

**Capture, at the moment a school is added** (all optional, none block adding the school):
- School name (required — the only required field, unchanged from before this sprint)
- County
- Category (e.g. Junior Secondary, IGCSE)
- **Why this school was selected** (`selection_reason`) — the founder's own reasoning: proximity, a referral, a visible ICT program, a personal connection. This is the single most valuable field for later pattern-recognition ("which selection reasons actually convert"), and it is only ever accurate if captured at the moment of research, not reconstructed later.
- **Contact source** (`contact_source`) — where the lead/contact info came from: a referral name, a public directory, a personal visit, a WhatsApp group. Matters later for "which channel actually works," without needing any scoring or analytics system to answer it — the founder can just read the list.
- **Existing ICT activity** (`existing_ict_activity`) — anything observed or known about the school's current computer/ICT lab, teacher device, or digital tool usage. A strong qualification signal (see §2) captured once, not re-investigated at every pipeline stage.

**Deliberately not captured**: enrollment numbers beyond the existing `students_count` field, financial data, competitor usage, or anything requiring a phone call or visit to obtain before the school is even worth adding — those belong to the Discovery/Demo stages, not Research.

---

## 2. Qualification Checklist

**"Should this school enter the pipeline?"** — a founder checklist, evidence-based, run mentally (or on paper) before clicking "+ Add school." Deliberately **not** a stored field, a form, or a gate in the UI — a checklist that requires its own screen and its own data model is exactly the kind of unnecessary complexity this sprint's mandate warns against. If a future pattern emerges where this needs to be tracked per-school, promote it then; don't build the tracking now on the guess that it will.

Ask, in order, stopping at the first "no" that isn't outweighed by the others:

1. **Is there a real, findable contact?** A school with no discoverable phone number, head teacher name, or referral path is not yet ready for the pipeline — keep researching, don't add it yet.
2. **Does it fit EduNexus's actual served segment?** CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), or 8-4-4 (Form 3–4) — per CLAUDE.md's stated target users. A school entirely outside this range is a "Future" prospect, not a Pilot Critical one.
3. **Is there any existing ICT activity, even informal?** A school with zero computers and no teacher comfortable with digital tools is a much harder, slower pilot — not disqualifying, but it changes urgency and expected timeline. Record what's found in `existing_ict_activity` regardless of the answer.
4. **Is there a plausible reason to expect a "yes" to a demo?** A referral, a known pain point (e.g. a head teacher who's mentioned wanting better report cards), or geographic proximity for easy in-person follow-up. This is `selection_reason` — if the honest answer is "no particular reason, just picked from a list," that's a signal to deprioritize this school under a real one.

A school that passes this checklist gets added via the Research Workflow above, starting at the pipeline's existing default stage (`research`). A school that doesn't pass isn't added at all — there is no "rejected" pipeline stage to manage, because a school that was never added needs no further attention.

---

## 3. Daily Research Queue

**"What schools should I research today?"** — a founder should never have to scroll the full Schools list or remember which ones are stale.

**Implemented**: a new **Research Next** section on the Founder Dashboard (`app/(growth)/growth/page.tsx`, first section — placed above Must Do, since an empty top-of-funnel is the earliest-warning problem this dashboard should surface). It lists every active school still sitting in the `research` pipeline stage — i.e., added but never yet moved to `contacted` — oldest first, so nothing silently ages out of view. Each row flags `hasSelectionReason: false` visibly ("no reason recorded yet") as a nudge to complete the Qualification Checklist's output for that school, without blocking or nagging.

This required zero new queries: `getFounderDashboard()` already fetched the full schools list for Must Do / Waiting For / At Risk / Wins; the Research Queue is one more filter over that same array (`lib/growth/services/dashboard.ts`).

---

## 4. Growth Engine Integration

The three Research Workflow fields (`contact_source`, `existing_ict_activity`, `selection_reason`) were added as three new nullable columns directly on the existing `growth_schools` table (`supabase/migrations/20260724090000_growth_pilot_acquisition_fields.sql`) — not a new table, not a separate "research" entity. A school researched today and contacted next week is the same row throughout its whole lifecycle; there is exactly one place its data lives, matching this Blueprint's existing single-writer-per-concern pattern (`changeStage()` for pipeline stage, this same `updateSchool()`/`createSchool()` pair now also carrying the three research fields).

No duplicate data entry: research fields are set once, at add-time, on the same form that already captures name/county/category, and are visible read-only on the existing school detail page (`app/(growth)/growth/schools/[id]/page.tsx`) alongside the contacts/activities/follow-ups sections that already exist there.

---

## 5. Founder Workflow

```
Research (checklist, §2)
    ↓
Add School (name + county/category + the 3 research fields, one form, §1/§4)
    ↓
Add Contact (existing Contacts section on the school page)
    ↓
Schedule Follow-up (existing Follow-ups section)
    ↓
Contact (Log Activity — existing Activity section)
    ↓
Discovery / Demo / Pilot (existing pipeline_stage dropdown — research → contacted → discovery → demo_scheduled → demo_completed → pilot_offered → pilot_running → pilot_won)
```

**Important finding, stated plainly**: every step from "Add Contact" onward already existed before this sprint (Sprint C0's Growth Engine build) — this sprint did not need to build a new founder workflow, only to close the one real gap at the very top of it (Research → Add School wasn't capturing why a school was worth adding at all, and there was no daily view of what needed researching). Click count end-to-end, per step: Add School (1 click to open the form, fill fields, 1 click to submit), Add Contact (1+1, same pattern), Schedule Follow-up (1+1), Log Activity (1+1), change pipeline stage (1, a single dropdown). No step requires more than opening one form and submitting it — already at the "minimum clicks possible" bar this sprint's mission asks for, so no UI restructuring was needed there.

---

## 6. Out of Scope (confirmed, not touched)

Everything after the pilot begins, Customer Success, automation, email/WhatsApp sending, scraping, AI recommendations, external APIs, proposal generation, analytics, bulk import, lead scoring, CRM expansion, multi-user. None of these were designed, stubbed, or partially built — they remain exactly as absent as before this sprint.

---

## 7. Classification and What Actually Shipped

| Item | Classification | Shipped this sprint? | Rationale |
|---|---|---|---|
| Three research-capture fields on `growth_schools` (migration + types + service + repository) | **Pilot Critical** | Yes | Directly the Research Workflow's missing capture — without it, "why was this school selected" lives only in the founder's memory, which doesn't scale past a handful of schools |
| Research fields on the Add School form | **Pilot Critical** | Yes | The only moment this data is cheap to capture is at add-time; deferring it to a later edit step means it mostly never gets filled in |
| Research fields displayed on the school detail page | **Pilot Critical** | Yes | Free to add alongside existing sections; without display, the captured data is invisible until someone queries the database directly |
| Daily Research Queue on the Founder Dashboard | **Pilot Critical** | Yes | Directly answers deliverable §3's named question; reuses an existing query, near-zero implementation cost |
| Qualification Checklist | **Pilot Critical** | Yes, as documentation only | A checklist is valuable now; a data model or UI for it is not justified yet (see §2) |
| Editing research fields after initial creation via a dedicated UI | **Pilot Helpful** | No | `updateSchool()`/`updateSchoolSchema` already accept all three fields (so the API path exists), but no edit UI was built this sprint — a founder who needs to correct a typo can do so via a direct API call today; a real inline-edit UI is worth building once it's actually been needed once, not preemptively |
| Marking a stalled research-stage school as "deferred" from the Research Queue directly (one click, without opening the school page) | **Pilot Helpful** | No | The existing pipeline-stage dropdown on the school detail page already covers this in one extra click; a dashboard shortcut is a nice-to-have, not a gap |
| A "why this school" prompt required (not optional) before a school can be added | **Backlog** | No | Would slow down the exact moment (spotting a school worth adding) this sprint is trying to make effortless; the Research Queue's `hasSelectionReason` flag already nudges completion without forcing it |
| Bulk import of schools from a spreadsheet/list | **Backlog** | No | Explicitly out of scope per this sprint's mission; revisit only if manual one-at-a-time entry becomes a real bottleneck at real pilot-search volume |
| Any scoring/ranking of "most likely to become a pilot school" | **Backlog** | No | Explicitly forbidden ("no scoring algorithm") — the Qualification Checklist and `selection_reason`/`existing_ict_activity` fields exist so a founder can judge this themselves, not so a formula can |
| Contact-source analytics ("which channel converts best") | **Future** | No | The data (`contact_source`) is now being captured so this becomes answerable later, once there's enough real pilot history to make the answer meaningful — building the analysis today would be analyzing noise |

---

## Success Metric

Not features shipped. A healthy pipeline throughout August means: the Research Queue is never empty for long, every school added has a real `selection_reason`, and the founder can answer "which schools to research/contact/follow-up/demo next" by looking at one dashboard, not by remembering or re-deriving it.
