# Founder Outreach Playbook

**Sprint**: Pilot Operations Sprint PO-2. **Classification**: Pilot Critical (the document itself — see §8 for classification of the smaller recommendations inside it). **Status**: v1, 2026-07-21. One evolving operational document, not split across files, per this sprint's own instruction.

**What this is**: the answer to "what should I say next" at every stage of getting from zero to a running pilot school, for one founder, in Kenya, this August. **What this is not**: software, automation, or a CRM feature — this is content to read and use, and a small number of Growth Engine mapping decisions (§7), nothing else was built.

**How this relates to `docs/growth-os/sales-playbook.md`**: that file is the evidence log — filled in only after a real conversation happens, never with what sounds plausible. This file is the opposite direction: what to actually say *before* any evidence exists. **Every script, question, and response below that has no real conversation behind it yet is explicitly labeled `[HYPOTHESIS]`** — untested, written from first principles about Kenyan CBC/8-4-4 schools, expected to be wrong in places. The discipline going forward: after each real conversation, log it in `sales-playbook.md`'s Conversation Log, and the next time this playbook is revised, promote what worked into here and mark it `[VALIDATED — <date>, <n> conversations]`, and retire what didn't. This document should look different in September than it does today — if it doesn't, the loop isn't running.

---

## 1. First Contact

**Purpose**: get a real person at the school talking to the founder, without sounding like a cold sales pitch or a scam (a real risk in Kenya, where unsolicited "we have software for your school" messages are common and mistrusted).

**Objective**: a reply, in any form — not a yes, not a meeting, just proof a real conversation is possible.

**Success outcome**: the contact responds with a question, an objection, or a "call me" — anything other than silence.

**Channel-specific openers** `[HYPOTHESIS]`:

- **WhatsApp opener** — the default channel; matches how Kenyan schools actually communicate (per `docs/growth-os/edunexus-growth-engine-specification.md`'s own channel assumption). Keep it short enough to read on a lock screen.
  > "Good morning [Name], I'm [Founder name] — I build EduNexus, a CBC report-card and learner-progress tool used by a few schools around [area/county]. I'd like to show [School name] how it works, free, no obligation. Would a quick call this week work?"
  - Why this shape: names the school specifically (not a mass-blast), states the product in one sentence, offers something free and low-commitment, ends with a specific easy yes/no.

- **Phone opener** — used when a number is available but WhatsApp isn't confirmed, or after a WhatsApp message goes unanswered for a few days.
  > "Good morning, may I speak with the head teacher / deputy / person in charge of ICT? ... Hello, my name is [Founder name], I run EduNexus — we help schools generate CBC report cards and track learner progress. I'm reaching out to a few schools in [county] this month to offer a free pilot. Do you have two minutes, or should I call back at a better time?"
  - Always offer the "call back at a better time" exit — a school interrupted mid-class period will remember the interruption more than the pitch.

- **In-person opener** — used for schools close enough to visit, especially ones with a personal connection or referral (`selection_reason`/`contact_source`, per `docs/growth-os/pilot-acquisition-engine.md`).
  > "Good morning, I'm [Founder name] — I develop EduNexus, an education platform for CBC schools. I was hoping to introduce it to [School name] and see if it might help with report cards and tracking learner progress. Is the head teacher or deputy available, even for five minutes?"
  - In person, bring one concrete visual if possible (a phone screen showing a real report card) — abstract description is much harder to land face-to-face than on a call.

**Common objections at this stage** `[HYPOTHESIS]`:
- "We already have a system" → do not argue; ask what they use and what it does well/poorly (this becomes the Discovery conversation).
- "We're not interested" → thank them, ask permission to check back next term, log as `deferred` (not `lost` — a "not now" is not a "never").
- "Send me information on WhatsApp/email" → send a short, specific message (2–3 sentences + one link/screenshot), not a brochure dump; follow the 24-hour follow-up rule (§5).

**Evidence to capture**: exact wording used, channel, who responded (role), response time, and the reply itself — verbatim if possible — into `sales-playbook.md`'s Conversation Log and Messaging Library.

**Next action**: if any response → move to Discovery. If silence after the appropriate wait (§5's No-Response Sequence) → one follow-up attempt, then `deferred`.

---

## 2. Discovery Conversation

**Purpose**: understand the school well enough to know whether EduNexus actually helps them, and to make the eventual demo relevant instead of generic.

**Objective**: leave the conversation able to answer, in the founder's own words, what this school's biggest report-card/learner-tracking pain actually is.

**Success outcome**: the contact has described a real, specific frustration (not just "sounds interesting") and named who else needs to be involved in a decision.

**Questions, grouped by what they're really asking** `[HYPOTHESIS]`:

- **Current workflow**: "How do you currently prepare report cards / track learner progress across a term?" "Who does that work — one person, each teacher separately?" "How long does report-card season take, roughly?"
- **Pain points**: "What's the most frustrating or time-consuming part of that?" "Has a report card ever gone out with an error, or late?" "What do parents ask you for that's hard to give them right now?"
- **Existing systems**: "Do you use any software for this today — even Excel templates?" "What do you like about it? What don't you?" (Never disparage a competitor or existing tool — per `sales-playbook.md`'s Competitive Intelligence rule: learn from them, never attack them.)
- **Decision makers**: "Besides yourself, who else would need to be comfortable with a change like this — the principal, the board, a specific teacher?" (Critical in Kenyan schools, where a deputy or DoS may champion something the principal ultimately approves or blocks.)
- **Timeline**: "Is there a specific time this term or next when this would matter most — before exams, before a specific report deadline?" (Anchors the demo/pilot timing to something real, not the founder's own calendar.)

**Common objections** `[HYPOTHESIS]`:
- "We don't have budget for new systems" → clarify that the pilot is free and ask what "budget" concern really means (data cost? device access? staff time?) before responding to the wrong worry.
- "Our teachers aren't very tech-comfortable" → treat as real information, not a brush-off — this shapes the demo (§4) and the pilot's onboarding expectations (§6), it doesn't disqualify the school.

**Evidence to capture**: the specific pain point in their words, existing tools named, the named decision-maker(s), and any timeline constraint — all feed directly into `sales-playbook.md`'s Discovery Questions and Conversation Log sections, and should update the school's Growth Engine record (`notes` field, or a logged activity note — see §7).

**Next action**: if a real pain point + a plausible decision path exists → propose a demo (§3). If the school clearly doesn't fit (wrong grade range, no real pain, no path to a decision) → `deferred`, log why.

---

## 3. Demo Booking

**Purpose**: convert interest into a scheduled, specific time — the single biggest drop-off point in most sales processes is "let's do it sometime" never becoming a real date.

**Objective**: a calendar date, a duration, and a named attendee, agreed to before ending the conversation.

**Success outcome**: a specific date/time is set, and a follow-up reminder is scheduled (§5's 24-hour rule, applied in reverse — a reminder the day before).

**How to ask** `[HYPOTHESIS]`:
> "Based on what you've described, I think a short demo would show you exactly how this would work for [School name]. Could we do 20–30 minutes this week or next — would [specific day] work, morning or afternoon?"
- Always propose two specific options, not an open "whenever works for you" — specificity gets a faster, more committed answer.

**How to confirm**:
> "Great — I'll see you on [day] at [time]. I'll bring [what — laptop/phone, sample report card]. If anything changes, please let me know as early as you can."
- Send a WhatsApp confirmation the same day booked, and a reminder the morning of.

**How to handle delays** `[HYPOTHESIS]`:
- First reschedule request: accommodate without friction — "No problem, does [new specific day/time] work instead?" (Same specific-options pattern.)
- Second reschedule / repeated non-response: this is itself information — log it, and treat the school as lower-priority (not necessarily `lost`; could still be `deferred`) rather than continuing to chase indefinitely. A founder's time in August is the scarcest resource in this whole playbook.

**Evidence to capture**: how many attempts it took to land a confirmed date, what "reason for delay" was given (if any) — this is exactly the kind of pattern `sales-playbook.md`'s Metrics section exists to eventually reveal (e.g., "demos take an average of 2.3 scheduling attempts").

**Next action**: confirmed demo → prepare using §4. Repeated unconfirmable → `deferred`.

---

## 4. Demo Delivery

**Purpose**: show, not tell — let the school see their own report-card problem solved in front of them, using the pain point named in Discovery.

**Objective**: the attendee(s) can picture their own school actually using this, not just admire that it exists.

**Success outcome**: at least one specific "can it also do X for us" question — the strongest possible signal, since it means they're already imagining real use, not politely watching a presentation.

**Agenda** `[HYPOTHESIS]`, ~25–30 minutes:
1. 2 min: restate the pain point from Discovery in their own words ("You mentioned report cards take about a week and one teacher does most of it — let me show you what that looks like here.")
2. 10–12 min: walk through the exact workflow that addresses that pain point first (not a generic feature tour) — e.g. if report cards were the pain, start there, not on the dashboard.
3. 8–10 min: let them drive if comfortable, or ask them to name a learner/scenario and build it live.
4. 3–5 min: address the "existing ICT activity" reality check from `existing_ict_activity` (if teachers have low tech comfort, explicitly show how little technical skill this actually requires).
5. Close with the Pilot Invitation (§6) — a demo that ends without a next step is a wasted meeting.

**Questions to ask during the demo** `[HYPOTHESIS]`: "Does this match how your term is structured?" "Who in your school would actually be entering marks — would this be easy for them?" "What would need to be true for you to try this for a term?"

**What to observe, not just present**: who in the room reacts (principal vs. DoS vs. ICT teacher may react to different things), whether anyone asks about cost/data/devices unprompted (a buying signal), whether attention drops during any specific section (a sign that section needs to be cut or reordered next time — log it).

**What NOT to do** `[HYPOTHESIS]`:
- Don't demo features the school didn't express a need for — a broad feature tour reads as "impressive software," not "solves my problem."
- Don't promise a capability that doesn't exist yet or isn't stable — per the Foundation Freeze/Post-Audit Operating Charter's standing rule, never oversell ahead of what's actually built and verified.
- Don't rush past questions to "get through the slides" — a demo with three real questions and an unfinished agenda is a better outcome than a complete agenda with zero questions.

**Evidence to capture**: which section got the strongest reaction, every question asked verbatim, any feature request, and the founder's own confidence read on likelihood to proceed — feeds `sales-playbook.md`'s Demo Playbook section directly.

**Next action**: always end with the Pilot Invitation (§6), even if a "yes" isn't expected same-day.

---

## 5. Follow-up

**Purpose**: keep a warm contact warm without becoming a nuisance — the single most common way a real opportunity quietly dies is not objection, it's founder inconsistency.

**24-hour follow-up** `[HYPOTHESIS]` (after any first contact, demo, or meeting):
> "Thank you for your time today, [Name] — really enjoyed showing you EduNexus. [One specific thing from the conversation, e.g. "I'll follow up on whether we can also handle [X] you asked about."] Let me know if any questions come up."
- Purpose is warmth + one open loop closed, not a second pitch.

**7-day follow-up** (if no decision yet):
> "Hi [Name], just checking in — have you had a chance to discuss EduNexus with [the decision maker named in Discovery]? Happy to answer anything or do a quick follow-up call."
- References the specific decision-maker named earlier — shows the founder was actually listening, not running a script blind.

**"No response" sequence** `[HYPOTHESIS]`:
1. Day 1: first message/call (§1).
2. Day 4–5 (if silence): one short, low-pressure nudge — "Hi [Name], following up in case this got buried — happy to chat whenever works." No new information, no pressure.
3. Day 14 (if still silence): final message — "I'll leave this here for now, but please reach out anytime if this becomes useful — no pressure." Then mark `deferred`, set a `next_action_date` a term out, and stop actively pursuing. Chasing past this point costs founder time better spent on the Research Queue (`docs/growth-os/pilot-acquisition-engine.md` §3) finding a school that will respond.

**Evidence to capture**: at which follow-up stage (if any) a silent contact re-engaged — this is the single most useful pattern for tuning the sequence's timing later.

**Next action**: any reply at any point routes back into whichever stage the conversation had reached (Discovery, Demo Booking, or Pilot Invitation).

---

## 6. Pilot Invitation

**Purpose**: convert demo interest into a committed, time-bound pilot — clearly framed as a pilot, not a sale, since that framing lowers the barrier to a "yes" and sets honest expectations for both sides.

**How to invite** `[HYPOTHESIS]`:
> "I'd like to invite [School name] to be one of the first five pilot schools using EduNexus this term — completely free, no commitment beyond trying it and telling me honestly what works and what doesn't. Would you be open to that?"

**How to explain expectations**:
- What EduNexus will do: set up the school, help onboard the first admin/teacher(s), be reachable for questions throughout.
- What the school is asked to do: actually use it for report cards/tracking for the pilot term, and give honest feedback — including what's frustrating, not just what's good.
- Timeline: explicit, tied to their own term calendar from Discovery (e.g. "through the end of this term's report cards").

**How to explain that this is a pilot, not a finished product** — honesty here protects the relationship long-term: "This is early — you'll likely hit a rough edge or two, and when you do, that feedback is exactly what makes this better for you and for the next four schools. I'll be very responsive if something doesn't work." This directly matches the Post-Audit Operating Charter's standing principle of never overselling ahead of what's actually verified.

**Common objections at this stage** `[HYPOTHESIS]`:
- "What happens after the pilot / will we have to pay?" → be honest that pricing isn't finalized yet, and that pilot schools get first consideration/priority terms once it is — don't invent a number under pressure.
- "Our teachers won't have time to learn something new mid-term" → offer to handle onboarding directly (hands-on setup, not "here's a manual") — this is exactly why Customer Success (out of scope for this sprint, but named in the Phase 1 CEO Plan's four pillars) matters starting the moment a pilot says yes.

**Evidence to capture**: the exact framing that got a yes vs. hesitation, and every question asked about "after the pilot" — this directly informs future pricing/positioning decisions, without this playbook itself making any pricing decision.

**Next action**: a "yes" moves the school to `pilot_offered` then `pilot_running` in the Growth Engine (§7) and hands off to onboarding (`docs/architecture/release-gate-2-pilot-experience-certification.md`'s certified fresh-school journey). A "not yet" returns to Follow-up (§5) with a specific reason logged.

---

## 7. Growth Engine Integration

No new software, no automation — only which existing Activity Type (`lib/growth/types.ts`'s `GrowthActivityType`) and pipeline stage to log after each interaction, so the Growth Engine stays the single source of truth for where every school actually stands.

| Playbook stage | Activity Type to log | Pipeline stage to move to (via the existing stage dropdown / `changeStage()`) |
|---|---|---|
| First Contact (WhatsApp) | `whatsapp` | `contacted` (on any reply) |
| First Contact (phone) | `called` | `contacted` (on any reply) |
| First Contact (in-person) | `visited` | `contacted` |
| Discovery Conversation | `called` / `meeting` / `visited` (whichever channel it happened on) | `discovery` |
| Demo Booking (confirmed) | *(no separate activity — logged as part of scheduling; the follow-up reminder itself can be a `whatsapp`/`called` entry)* | `demo_scheduled` |
| Demo Delivery | `demo` | `demo_completed` |
| Follow-up (any of the three) | `whatsapp` / `called` / `email` (matching channel used) | unchanged unless the follow-up itself produces movement |
| Pilot Invitation accepted | `meeting` (or the channel it was delivered on) | `pilot_offered`, then `pilot_running` once actually onboarded |
| No-response sequence exhausted | *(no activity — the absence of one is itself the signal)* | `deferred` |

Every logged activity's `notes` field is where the Evidence to Capture from each section above actually lives — no new field, no new table, reusing exactly what Sprint C0 already built.

---

## 8. Classification

| Recommendation | Classification | Notes |
|---|---|---|
| This playbook document itself (all 6 stages, scripts, questions) | **Pilot Critical** | Directly the sprint's deliverable — without it, the founder improvises every conversation from scratch |
| The Growth Engine activity/stage mapping (§7) | **Pilot Critical** | Free — pure documentation over existing Activity Types/pipeline stages, no code change |
| Promoting validated scripts from here into `sales-playbook.md`'s Messaging Library after real use | **Pilot Critical** (as a discipline, not a build) | The whole point of the two-document split (§0) — must actually happen after each real conversation, not just be possible in theory |
| A monthly (or more frequent, given August's pace) revision pass on this playbook | **Pilot Helpful** | Valuable but not urgent enough to schedule rigidly yet — tie it to `docs/edunexus-operating-rhythm.md`'s existing Friday Learning Review cadence instead of inventing a new one |
| A structured post-demo debrief template (beyond "log it in the Conversation Log") | **Pilot Helpful** | Existing Conversation Log fields already cover this; a dedicated template is marginal value until volume makes free-text logging slow |
| A pricing script/objection-handling section for "after the pilot, what does it cost" | **Future** | Pricing isn't finalized — writing a script around a number that doesn't exist yet would be guidance built on nothing, worse than no guidance |
| An automated WhatsApp follow-up sequence (Day 1/4/14 sent automatically) | **Backlog** | Explicitly forbidden this sprint ("no automation," "no WhatsApp integration") — and more importantly, an automated message at this pilot's tiny volume (5 schools) removes exactly the personal touch that's the whole advantage of a founder doing this by hand |
| Objection-response A/B testing or scoring which script "performs better" | **Backlog** | No scoring algorithm, no volume to meaningfully test anything yet — revisit only after enough real conversations exist for a pattern to mean something |
| A dedicated Customer Success playbook (post-pilot-start conversations) | **Backlog** — belongs to a future sprint | Explicitly out of scope per this mission ("map each stage... do NOT build... anything after the pilot begins" was Sprint PO-1's boundary and remains this sprint's too); Pilot Invitation (§6) hands off to it but doesn't write it |

---

## Success Metric

Not a polished document. The playbook is working if, after the first five real conversations, at least one script or question in this file has been proven wrong and replaced — that's the loop (`sales-playbook.md` ← real conversations ← this playbook ← revision) actually running, not a document written once and left untouched through August.
