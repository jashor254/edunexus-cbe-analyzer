# Sprint PE-7 — Pilot Campaign Launch

**Classification**: Pilot Critical. **Status**: shipped, verified against real Supabase data (synthetic rows, created and cleaned up each time — `growth_schools` was and remains 0 rows pending the founder's own `ready_for_import` review, same as PE-6).

**Constraints honored**: zero new database tables; zero new columns (Manual Boost's `starred` and the enrichment columns were already added in PE-6 — this sprint added none); no automation that contacts a school (every outbound action is founder-initiated, one click at a time); no AI summaries anywhere (Daily Success Counter and End-of-Day Review are both plain counts over real rows); no redesign of anything shipped in PE-2 through PE-6.

---

## 1. What Shipped, Part by Part

**Part 1-2 — Import Readiness Dashboard + Import Summary**: a real web page, `/growth/import`, not a CLI-only report. Reads a CSV from `scripts/growth/output/` (this whole pipeline runs locally, same as every discovery/enrichment script before it), shows Total reviewed / Ready for import / Held back / Missing phone / Missing email / Needs manual verification / Out of scope, and an Import button disabled at 0 ready rows. After import: Schools imported / Duplicates skipped / Contacts created / Schools updated / Time taken / Errors, nothing hidden. The core import logic moved out of the CLI script into `lib/growth/services/csvImport.ts` so the web page and `npm run growth:import-schools` run identically — no drift between the two paths.

**Part 3 — First Contact Queue**: `getPilotTargeting()` (PE-6's targeting engine) now also returns `readyToContact` — active schools at the `research` stage with both `selection_reason` and `existing_ict_activity` on file (research complete) and no activity ever logged (never contacted), sorted by Founder Priority Score. Surfaced as its own "🔥 Ready to Contact" section on Mission Control, distinct from the broader Mission Today ranking (which also includes schools already being worked).

**Part 4 — Contact Workspace**: the school detail page gained a single "Contact Workspace" card — phone, WhatsApp, email, website, Google Maps link (there is no `address` column; the maps link serves the same "where is this place" need without a schema addition), contact quality, discovery score, selection reason, existing ICT activity, and notes — all in one place, no tab switching. Previous activities and follow-ups were already on this page (PO-1/C0) and remain exactly where they were.

**Part 5 — One-click Activity Logging**: 10 buttons (Called, WhatsApp Sent, Email Sent, Visited, Meeting, Discovery Complete, Demo Scheduled, Demo Completed, Pilot Accepted, Pilot Declined) replace the old type-dropdown-plus-submit form. Each button fires immediately; an optional note field and an optional "They replied" checkbox are the only inputs, never required. No new activity-type enum values — `lib/growth/quickActions.ts` maps each button to an existing `growth_activities.type` plus a default note carrying the button's real meaning (e.g. "Pilot Declined" logs `type: 'meeting'`, `notes: 'Pilot declined'`), so nothing is lost to a coarser type column. Milestone actions (Demo Scheduled/Completed, Pilot Accepted/Declined, Discovery Complete) also advance `pipeline_stage` — but only forward, never backward (`shouldAdvanceStage()`), and a decline forces the terminal `lost` stage unconditionally from any stage.

**Part 6 — Daily Success Counter**: a 7-tile header row on Mission Control — Today's Contacts, Today's Replies, Discovery Meetings, Demos, Pilots, Weekly Goal (vs. `thisWeek.schoolsContacted`), Monthly Goal (vs. the existing `PILOT_ACQUISITION_GOAL`). "Today's Replies" needed a real signal that didn't exist — solved with a `[replied]` tag appended to an activity's `notes` when the founder checks "They replied," the same notes-scanning convention PE-2's Recent Wins already used for testimonial/referral — no schema change.

**Part 7 — End-of-Day Review**: a collapsible, facts-only digest — schools contacted today, responses, no-responses, follow-ups due tomorrow, discovery meetings booked today, demo schedule, pilot opportunities. Every field is a plain count/list over `growth_activities`/`growth_follow_ups`/`growth_schools`, computed the same way every other Mission Control section already is.

**Part 8 — Verification**: see §3.

---

## 2. Files Changed

**New services**: `lib/growth/services/csvImport.ts` (readiness stats + shared import logic + safe local-file resolution), `lib/growth/services/campaignProgress.ts` (daily counters + end-of-day review), `lib/growth/quickActions.ts` (the one-click action table).
**New constants**: `lib/growth/constants.ts` (`PILOT_ACQUISITION_GOAL` moved here from `dashboard.ts`, `WEEKLY_CONTACT_GOAL` added) — one place, no duplicate goal numbers between Mission Progress and the Daily Success Counter.
**New API routes**: `app/api/growth/import/{files,readiness,run}/route.ts`, `app/api/growth/daily-counters/route.ts`, `app/api/growth/end-of-day-review/route.ts`, `app/api/growth/schools/[id]/quick-action/route.ts`.
**New page**: `app/(growth)/growth/import/page.tsx` (+ nav link in `layout.tsx`).
**Extended**: `lib/growth/services/activities.ts` (`logQuickAction()`, `REPLY_TAG`), `lib/growth/repositories/contact.repository.ts` (unchanged from PE-6), `lib/growth/services/targeting.ts` (`readyToContact`), `app/(growth)/growth/page.tsx` (header counters, Ready to Contact, End-of-Day Review sections), `app/(growth)/growth/schools/[id]/page.tsx` (Contact Workspace card, one-click Activity section).
**Refactored**: `scripts/growth/import-schools-csv.ts` now calls the shared `lib/growth/services/csvImport.ts` instead of duplicating the import loop.
**Tests**: `lib/growth/services/csvImport.test.ts` (5), `lib/growth/quickActions.test.ts` (6), `lib/growth/services/pilotCampaignLaunch.integration.test.ts` (4, real DB), plus a 4th test added to `lib/growth/services/targeting.integration.test.ts` for the First Contact Queue.

---

## 3. Verification (Part 8)

- **Import**: real-DB integration test imports a `ready_for_import=TRUE` synthetic row, confirms it lands correctly, then re-runs the same batch and confirms the place_id dedup guard skips it (no duplicate import).
- **First Contact Queue**: a synthetic school with both `selection_reason` and `existing_ict_activity` set and zero logged activity appears in `readyToContact`; a school with no research recorded does not.
- **Activity logging updates correctly**: `logQuickAction('called', from: 'research')` advances to `contacted`; firing it again from `contacted` correctly no-ops (`newStage: null`) rather than erroring or regressing. `pilot_declined` forces `lost` from `pilot_running`. The reply tag shows up verbatim in the logged activity's `notes`.
- **Dashboard counters change**: after logging a real WhatsApp-sent activity with a reply tag, `getDailyCounters()` shows `todaysContacts >= 1` and `todaysReplies >= 1`; `getEndOfDayReview()` lists the same school under both "schools contacted" and "responses," and correctly excludes it from "no responses."
- **No duplicate imports**: proven directly in the import test above.

All synthetic rows (schools + activities + the throwaway founder account) were deleted in `after()`; confirmed via direct query that `growth_schools`/`growth_activities` are back to 0 rows and the real founder's `growth_users` row is untouched.

`npx tsc --noEmit`, `npx eslint`, and `npx next build` all clean.

---

## 4. Technical Debt

- **"Contacts created" and "Schools updated" in the Import Summary are always 0** — honestly, not as a bug: the importer has never created `growth_contacts` rows or updated an existing school (a duplicate is always skipped, never merged). Both fields are kept in the summary shape because Part 2 names them explicitly, but they're a promise about what this import *could* report if that behavior is ever added, not a current capability.
- **The Import page only works via `npm run dev` locally** — it reads `scripts/growth/output/*.csv` off the local filesystem, the same constraint every discovery/enrichment script in this pipeline already has. Would not work against a deployed, filesystem-ephemeral host without a real file-upload flow.
- **"Today's Replies"/"Responses" depend on the founder remembering to check "They replied"** — there's no automatic reply detection (no WhatsApp/email integration exists), so this number is only as complete as the founder's own logging discipline. Documented, not hidden.
- **Weekly/Monthly goals are fixed code constants** (`lib/growth/constants.ts`), not configurable via any UI — same tradeoff PE-3 already accepted for the August pilot goal.

---

## 5. Rollback Strategy

- **No schema changes this sprint** — nothing to roll back at the database level.
- **New files** (`csvImport.ts`, `campaignProgress.ts`, `quickActions.ts`, the 5 new API routes, `/growth/import` page) are all additive — deleting them has no effect on PE-2 through PE-6's existing functionality.
- **`import-schools-csv.ts`'s refactor** is a straight logic move with identical behavior — reverting it to its pre-PE-7 self-contained form (in git history) changes nothing about what it does.
- **`page.tsx`/`schools/[id]/page.tsx`** changes are additive sections/replacements of one existing section (the Activity form) — reverting either file to its PE-6 version fully restores prior behavior.
