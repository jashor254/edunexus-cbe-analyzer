# Sprint PE-8 — Founder Communication Engine

**Classification**: Pilot Critical (Parts 1-5, 9), Helpful (Parts 6-8, since a founder can already send by hand — these save time, they don't unblock anything). **Status**: shipped, verified with unit tests only — `growth_schools` remains 0 rows (PE-7's own note still holds), so there is no real school to generate a real draft against yet. Every code path is proven with synthetic data, not a real send.

**Contradiction flagged and resolved before building**: this sprint's own spec is exactly the kind of speculative Growth Engine work Sprint PE-1 said to stop doing until a pilot hits a real blocker — no school has hit a communication blocker yet, because no school is in the pipeline yet (PE-7's import step is still pending the founder's own review). Raised to the founder before starting; founder chose to proceed with the full spec regardless of the empty pipeline, accepting that "send" cannot be validated against a real conversation until schools exist. Recorded here rather than silently building around the tension.

**Constraints honored**: zero new database tables; zero new columns (channel/template/edited-flag are encoded as notes tags on the existing `growth_activities.notes`, the same convention PE-7's `[replied]` tag established); no automatic sending anywhere — "Send" only opens a `wa.me:`/`sms:`/`tel:`/`mailto:` link with the draft pre-filled, the founder still presses send in their own WhatsApp/SMS/mail/phone app; no bulk anything (every generator call is scoped to one school); no AI call anywhere in the message path — all 14 templates are hand-written, fixed strings with `{{token}}` substitution, not model-generated per send.

---

## 1. What Shipped, Part by Part

**Part 1 — Communication Strategy Engine** (`lib/growth/messaging/strategy.ts`): `determineChannelStrategy(school, contacts)` picks WhatsApp > Call > Email > Visit, in that fixed order, from real stored data only — `growth_schools.whatsapp_number`, a contact's `preferred_contact`, `phone`, or `email`. Every branch returns a reason naming the specific fact that drove it (e.g. "Jane Doe has recorded WhatsApp as their preferred contact method"), never a generic label. `visit` was added as a fifth `MessageChannel` value (the spec's own fallback) — a channel the generator never writes a body for, since there's nothing to draft for an in-person visit.

**Part 2 — Founder Message Library** (`lib/growth/messaging/templates.ts`): 14 hand-written templates — 4 cold-intro variants (public secondary / private / junior secondary / mixed, since the opening line genuinely differs by school type), warm referral, follow-up 1, follow-up 2, discovery meeting confirmation, demo reminder, thank-you after demo, pilot invitation, pilot accepted, one-week check-in, referral request. Every template carries purpose, when-to-use, default channel, expected outcome, the variables it uses, tone, and length, exactly as the spec's Part 2 lists. Later-stage templates (follow-ups, confirmations, demo, pilot) don't get school-type variants — by then the relationship, not the school type, drives the message.

**Part 3 — Dynamic Personalization** (`lib/growth/messaging/variables.ts`): every `{{token}}` maps to a real column — `school_name`/`county`/`phone`/`email`/`website` from `growth_schools` (contact-level phone/email wins when a contact is on file), `contact_name`/`contact_role` from `growth_contacts`, `founder_name` from `growth_users.full_name` (the authenticated caller), `pilot_slots_remaining` computed as `PILOT_ACQUISITION_GOAL - (schools at pilot_running/pilot_won)`, same definition Mission Control already uses. `meeting_date`/`meeting_time` are the one pair of variables with no DB source — they're founder-typed inputs for that one draft, never fabricated. A missing value renders as an unresolved `{{token}}` left visible in the draft (surfaced to the founder in the UI), never silently blanked — except a cosmetic `_greeting` connector token, which collapses to `''` so "Good day {{contact_name_greeting}}," degrades to "Good day," instead of showing a broken token.

**Part 4 — Message Generator** (`lib/growth/messaging/generate.ts`): `generateMessage()` picks the channel-specific body off the chosen template (WhatsApp/SMS/Email/Call-opening), falling back to the WhatsApp body when a template has no channel-specific variant written — a content choice made at authoring time, not a generation-time guess. Returns the rendered subject (email only) and body, plus which variables came back unresolved.

**Part 5 — Communication Workspace**: a new "Message" card on the school detail page (`app/(growth)/growth/schools/[id]/page.tsx`), sitting above the pre-existing Contact Workspace (PE-7). Shows Preferred channel + reason, a template dropdown (defaulting to the pipeline-stage suggestion), a channel dropdown, the editable draft (subject field appears only for email), an "Open in {channel}" button (the wa.me/sms/tel/mailto link), Copy, an optional outcome note, and Mark Sent. A due follow-up suggestion (Part 8) appears inline with a one-click "Add follow-up" action.

**Part 6/7 — Email/WhatsApp "Integration"**: no email or WhatsApp API is connected (Gmail MCP is unauthorized in this environment, and there is no WhatsApp Business API integration in this codebase) — "Open in WhatsApp"/"Open in Email" are `wa.me`/`mailto:` links (`lib/growth/messaging/links.ts`), which hand off to whatever WhatsApp/mail client is already configured on the founder's own device. This satisfies the spec's actual requirement ("no automatic sending... founder always remains in control") more completely than a real API integration would — there is no code path anywhere that can transmit a message without the founder's own client app in the loop. SMS uses an `sms:` URI the same way. `buildTelLink()` covers the Call fallback.

**Part 8 — Follow-up Assistant** (`lib/growth/messaging/followUpSuggestion.ts`): `suggestFollowUp(lastContactAt)` returns Follow-up 1 at 3 days, Follow-up 2 at 7 days, "close for now" at 14 days (no template — a founder judgment call, not automated), or `null` before 3 days / with no prior contact. Purely a suggestion: the workspace's "Add follow-up" button calls the existing `POST /api/growth/schools/[id]/follow-ups` endpoint (PE-7, unchanged) — no new persistence, nothing is ever auto-created or auto-sent.

**Part 9 — Logging**: `logMessageSent()` (`lib/growth/services/activities.ts`) writes a real `growth_activities` row — `type` maps to the closest existing enum value (`whatsapp`→`whatsapp`, `sms`→`whatsapp` with a `[channel:sms]` tag since no `sms` enum value exists, `email`→`email`, `call`→`called`, `visit`→`visited`), and `notes` carries `[channel:x][template:y][edited]` tags plus the founder's outcome note — the same tag-in-notes convention `REPLY_TAG` already established, not a schema change. Advances `pipeline_stage` to `contacted` only if the school was still at `research`, mirroring quick actions' "only ever moves forward" rule. `POST /api/growth/schools/[id]/messages/log` is the new endpoint; `GET /api/growth/schools/[id]/messages` returns the composed workspace (strategy, suggested template, all templates, the generated draft, and the follow-up suggestion), accepting `templateId`/`channel`/`meetingDate`/`meetingTime` query overrides.

**Part 10 — Founder Experience**: verified by inspection against the target workflow (open school → everything prepared → review → edit → send → logged → next school) — the workspace loads with a pre-selected template and channel and a fully rendered draft on page load, requiring no clicks before the founder can already read a usable message. Not timed against a real founder session, since there is no real school yet to time it against.

---

## 2. Files Changed

**New messaging domain** (`lib/growth/messaging/`): `types.ts`, `templates.ts`, `variables.ts`, `render.ts`, `strategy.ts`, `generate.ts`, `followUpSuggestion.ts`, `links.ts`.
**New service**: `lib/growth/services/messaging.ts` (`getCommunicationWorkspace()` — the one DB-touching composition point).
**Extended**: `lib/growth/services/activities.ts` (`logMessageSent()`, `CHANNEL_TO_ACTIVITY_TYPE`).
**New validation**: `lib/growth/validation/messages.ts`.
**New API routes**: `app/api/growth/schools/[id]/messages/route.ts` (GET), `app/api/growth/schools/[id]/messages/log/route.ts` (POST).
**Extended UI**: `app/(growth)/growth/schools/[id]/page.tsx` (`MessageWorkspace`, `FollowUpSuggestionBanner`).
**Tests**: `lib/growth/messaging/{strategy,render,generate,templates,followUpSuggestion,links}.test.ts` — 33 tests, all pure-function unit tests (no DB).

---

## 3. Verification

- `npx tsc --noEmit -p .` — clean.
- `npx eslint` on every new/changed file — clean (0 errors, 0 warnings; one Tailwind canonical-class warning fixed during the sprint).
- `npx tsx --test lib/growth/messaging/*.test.ts` — 33 passing: channel-strategy priority and every fallback branch, variable substitution and the `_greeting` collapse behavior, per-channel draft generation (including the pilot-slots-remaining arithmetic against a real `PILOT_ACQUISITION_GOAL`), every one of the 14 templates renders a non-empty body with no unexpectedly-unresolved variables, the 3/7/14-day follow-up cadence, and the wa.me/sms/tel/mailto link builders (including Kenyan phone normalization: `07...` / `+254...` / `254...` all resolve to the same `254...` form).
- **Not verified**: an actual send (no WhatsApp/email account connected in this environment), and the UI against a real school (no real `growth_schools` row exists — see the Classification note above). The UI was read through carefully against the API contract but not exercised in a live browser session.

---

## 4. Technical Debt / Deferred

- **No real-school or live-browser verification** — the single biggest gap. Everything here is proven correct in isolation; nothing is proven correct end-to-end against a real founder sending a real message to a real school, because no real school exists yet in `growth_schools`.
- **SMS is folded into the `whatsapp` activity type via a notes tag** — there is no `sms` value in `growth_activities.type`'s check constraint, and adding one is a migration this sprint wasn't scoped to make for a channel that isn't even in the Part 1 priority order. If SMS logging turns out to matter in practice, add the enum value then.
- **`phone`/`email`/`website` template variables are the school's own stored contact details, not the founder's** — the spec listed these variables ambiguously (alongside `founder_name`); mapping them to real, already-stored school/contact data (rather than inventing a founder phone number or a company website that isn't configured anywhere in this codebase) was the safer reading, consistent with "no invented capabilities." If the intent was a founder signature line, that needs an explicit founder-contact field added to `growth_users` first.
- **No "days since last activity per school" batched read reused for follow-up suggestions across the whole pipeline** — `suggestFollowUp()` is called per-school-page-load only; a Mission Control-wide "N follow-ups now due" tile (mirroring PE-6/PE-7's batched-query conventions) would need a small addition to `dashboard.ts`, deliberately not built this sprint since Part 8 only asked for the assistant on the school page.
- **Template copy is fixed English, Kenyan-school-register by best effort** — not reviewed by an actual Kenyan school administrator; treat the wording as a first draft to be refined once real replies start coming in, not as finished copywriting.

---

## 5. Rollback Strategy

- **No schema changes this sprint** — nothing to roll back at the database level.
- **All new files are additive** (`lib/growth/messaging/*`, `lib/growth/services/messaging.ts`, the two new API routes) — deleting them has no effect on PE-1 through PE-7's existing functionality.
- **`lib/growth/services/activities.ts`** gained one new export (`logMessageSent`) and one new constant (`CHANNEL_TO_ACTIVITY_TYPE`) — `logActivity`/`logQuickAction` are untouched; reverting the addition changes nothing about quick-action logging.
- **`schools/[id]/page.tsx`** gained one new section (`MessageWorkspace`) inserted above the pre-existing Contacts section — reverting to the PE-7 version of this file fully restores prior behavior with zero data impact (no rows this sprint's UI created can't just sit unread in `growth_activities`/`growth_follow_ups`, same as any other logged activity).
