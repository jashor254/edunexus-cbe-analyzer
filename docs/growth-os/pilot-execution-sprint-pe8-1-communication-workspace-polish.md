# Sprint PE-8.1 — Founder Communication Workspace Polish (Pilot Blocking UX)

**Classification**: Pilot Blocking UX. **Status**: shipped. UX-only pass over Sprint PE-8's Communication Workspace (`lib/growth/messaging/*`) and Sprint PE-7's Contact Workspace/one-click logging — zero logic, schema, or API changes.

**Constraints honored**: no new database tables, no AI, no automation, no pipeline architecture changes. Every button in the redesigned page calls the exact same handler/endpoint it called before this sprint.

---

## 1. What Changed, Part by Part

All in `app/(growth)/growth/schools/[id]/page.tsx` — presentation only.

1. **Contact Card** — the old "Contact Workspace" field grid became one icon-labeled card (☎ Primary Phone, 🟢 WhatsApp, ✉ Email, 🌍 Website, 📍 Location, ⭐ Contact Quality, 📊 Discovery Score, Research Notes). WhatsApp now shows **Verified** (a `whatsapp_number` is on file) / **Unknown** (a phone exists but no confirmed WhatsApp number) / **Not Available** (neither) instead of a raw value-or-dash.
2. **Recommended First Action** — replaced the one-line "Preferred: X / reason" box with a bordered banner: channel icon + name, a bulleted "Reason" (the strategy engine's real fact, plus a general "fastest response" line), and an estimated time (reusing the same per-channel minute values Sprint PE-6's Today's Route already established, so the numbers never disagree across the app).
3. **Message editor** — Template and Channel are now labeled selects side by side (not a bare unlabeled dropdown pair), Subject only appears for email, the message box has a visible "Message" label, a live character count, and an Edit/Preview toggle (preview renders the subject+body as it will actually read, read-only).
4. **Professional actions** — "Open in {Channel}" → **🟢 Open WhatsApp** / **☎ Call Now** / **✉ Open Email** (channel-specific icon+label); "Copy" → **📋 Copy Message**; "Mark Sent" → **✅ Log as Sent** (emerald, filled — the clear terminal action of the flow).
5. **Follow-up Assistant** — restyled as a "Next Follow-up" card: 📅 + an honest due label (**"Due today"** when the suggestion's date is today, which — per Sprint PE-8's existing `suggestFollowUp()` — it always is; this sprint didn't change that logic, only stopped implying a future date the data doesn't actually have), the reason, and a **Schedule Reminder** button (same `POST /follow-ups` call as before).
6. **School Snapshot** (new section, top of page) — Pipeline Stage (the stage selector moved here), Last Contact (relative — "Today"/"Yesterday"/weekday/date), Last Contact Method (from the most recent activity's `type`), Times Contacted (`activities.length`), and three ✅/— flags: Discovery Meeting, Demo Done, Pilot — all derived from `pipeline_stage`'s position in `GROWTH_PIPELINE_STAGES`, no new query.
7. **Communication Timeline** — the activity list now groups by relative day ("Today," "Yesterday," weekday name, then `Mon D`) instead of one flat list of full timestamps, newest first (unchanged sort, just regrouped). The one-click quick-log buttons (Sprint PE-7) sit above it, relabeled "Log an Interaction."
8. **Visual hierarchy** — bigger card padding/radius (`p-5 rounded-xl` vs. the old `p-4 rounded-md`), bigger primary text (`text-base`/`text-lg`/`text-2xl` where the old page used `text-sm` throughout), filled/colored primary buttons (emerald "Log as Sent," dark "Open X") vs. flat secondary ones, and every section title is now a consistent uppercase micro-label instead of the previous mix of styles.
9. **Mobile readiness** — phone numbers (`tel:`), emails (`mailto:`), the website, and Google Maps link are all real anchor tags now (Contact Card's WhatsApp/phone rows, plus a contact's own phone number in the Contacts list); every button row already used `flex-wrap`, carried forward; long values wrap (`wrap-break-word`) instead of overflowing a fixed-width row.
10. **Flow speed** — reordered the whole page to match the stated 2-minute flow: School Snapshot (understand instantly) → Contact Card (channels available) → Message Workspace (choose channel, personalize, send, log) → Communication Timeline (what's already happened) → Contacts/Follow-ups management (secondary, unchanged).

---

## 2. Files Changed

- **`app/(growth)/growth/schools/[id]/page.tsx`** — the only file touched. Rewritten presentation layer; `SchoolSnapshot` and `ContactCard` are new components, `MessageWorkspace`/`FollowUpSuggestionBanner` restyled with identical internal logic, `ActivitySection` renamed `CommunicationTimeline` with day-grouping added.
- **No changes** to `lib/growth/messaging/*`, `lib/growth/services/{activities,schools,targeting}.ts`, `lib/growth/quickActions.ts`, or any API route — every fetch call in the new page hits the same endpoint, with the same request body shape, as before this sprint.

---

## 3. Verification

- `npx tsc --noEmit`, `npx eslint`, and `npx next build` all clean.
- Full existing test suite re-run (none of it touches this page, since it's all pure-logic/service tests) — 60/60 passing (`lib/growth/messaging/*.test.ts`, `lib/growth/targeting/*.test.ts`, `lib/growth/quickActions.test.ts`, `lib/growth/services/csvImport.test.ts`).
- Dev-server request log from the founder's own prior session confirms the underlying Communication Workspace (template selection, channel switching, message generation) was already working end-to-end before this polish pass — this sprint changed none of that request/response path, only presentation, so that verified behavior carries forward unchanged.
- Could not click through the new layout as the authenticated founder from this environment (no real browser session available here) — worth a look next time you're signed in, particularly the Preview toggle and the WhatsApp Verified/Unknown/Not Available states on a couple of different real schools.

---

## 4. Technical Debt / Honesty Notes

- **"Next Follow-up" always says "Due today"** because Sprint PE-8's `suggestFollowUp()` always sets `dueDate` to the current date, not a real future date computed from "3 days from last contact." This sprint deliberately did not change that logic (out of scope — "no architectural changes"), only stopped the UI from implying a specific future countdown ("3 days") the underlying data doesn't provide.
- **The "fastest response" bullet under Recommended First Action** is a general, defensible statement about channel ordering (the same WhatsApp > Call > Email > Visit priority `strategy.ts` already encodes), not a per-school statistic — no fabricated response-rate number was added.
- **CHANNEL_MINUTES is duplicated** (once in `lib/growth/targeting/route.ts`, once inline in this page) rather than imported, to keep this client page free of a service-layer import for a purely cosmetic number. If either ever changes, check both.

---

## 5. Rollback Strategy

Single-file change. Reverting `app/(growth)/growth/schools/[id]/page.tsx` to its pre-PE-8.1 version (in git history) fully restores the previous layout with zero effect on any API route, service, or database state — nothing else in the codebase references this page's internal component names.
