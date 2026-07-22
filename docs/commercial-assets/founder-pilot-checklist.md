# Founder Pilot Checklist

**Sprint**: Pilot Operations Sprint PO-4 — Founder Execution Readiness Audit. **Classification**: Pilot Critical. **Status**: v1, 2026-07-21. No software built, no authentication modified, no onboarding redesigned — this is a compiled audit of manual founder responsibility, drawn from what's already designed and verified in `docs/growth-os/pilot-acquisition-engine.md`, `docs/commercial-assets/founder-outreach-playbook.md`, `docs/commercial-assets/pilot-success-playbook.md`, and `docs/architecture/release-gate-2-pilot-experience-certification.md`.

**How to use this document**: it is the one checklist a founder should be able to run the entire first-five-pilots programme from, start to finish, without needing to recall anything from the other four documents above by memory. Where a task's mechanics are defined in more detail elsewhere, this document says so and points there — it does not duplicate the content, only the checklist item and its execution facts.

---

## Acquisition Phase

| # | Task | Why it exists | When it happens | Est. time | Repeatable? | Stay manual? | Phase 2 automation candidate? |
|---|---|---|---|---|---|---|---|
| 1 | Run the Qualification Checklist on a prospective school | Prevents wasted research/outreach effort on a poor-fit school (`pilot-acquisition-engine.md` §2) | Before adding any school | 2–5 min | Yes, every school | **Yes** | No — judgment call, no data to automate against yet |
| 2 | Add school to Growth Engine with research fields (`selection_reason`, `contact_source`, `existing_ict_activity`) | Single source of truth for the pipeline; the reason field is the only record of *why* this school was worth pursuing | At moment of research | 2–3 min | Yes, every school | **Yes** | No — this is founder judgment being recorded, not a mechanical step |
| 3 | First contact (WhatsApp/phone/in-person opener) | Gets a real reply — `founder-outreach-playbook.md` §1 | Once per school, start of outreach | 5–15 min incl. wait for reply | Yes | **Yes** | No — personal touch is the actual advantage at this scale |
| 4 | Discovery conversation | Understand real pain point, decision-maker, timeline before proposing a demo (§2) | Once per responding school | 15–30 min | Yes | **Yes** | No |
| 5 | Demo booking (ask, confirm, handle delays) | Converts interest into a specific committed date (§3) | Once per school reaching this stage | 5–10 min + reschedule overhead | Yes | **Yes** | Partial — see Phase 2 candidates below (reminder only, not the ask) |
| 6 | Demo preparation (review Discovery notes, prep the one relevant workflow to show) | A generic demo underperforms a demo anchored to the school's own stated pain point (§4) | Before every demo | 10–15 min | Yes | **Yes** | No — requires reading and judgment, not lookup |
| 7 | Demo delivery | The core conversion moment | Once per school | 25–30 min | Yes | **Yes** | No |
| 8 | Follow-up sequence (24h / 7-day / no-response) | Keeps warm contacts warm without founder inconsistency being the reason a real opportunity dies (§5) | After every contact/demo/meeting | 5 min per touch | Yes, and frequent | **Yes for the message itself** | **Yes for the reminder-to-send**, see Phase 2 |
| 9 | Pilot invitation (invite, explain expectations, explain pilot framing) | Converts interest into a time-bound, honestly-framed commitment (§6) | Once per school reaching this point | 10–15 min | Yes | **Yes** | No — expectation-setting must be a real conversation |

## Onboarding Phase

| # | Task | Why it exists | When it happens | Est. time | Repeatable? | Stay manual? | Phase 2 automation candidate? |
|---|---|---|---|---|---|---|---|
| 10 | School creation via `/admin/core-schools/new` | Only existing, verified path to a real activated school (`pilot-success-playbook.md` Stage 2) | Once per pilot school | 5–10 min, mostly automatic once submitted | Yes | **Yes** (the click itself; the pipeline behind it already automates activation) | No — already as automated as it should be without removing founder oversight of the result |
| 11 | Account-prerequisite check: confirm the school's admin/teachers have created their own personal EduNexus accounts *before* inviting them | The single most likely silent onboarding failure — `inviteTeacher()` requires the account to already exist (Stage 1/2 finding) | Before every invite | 2 min per person (a message + a wait) | Yes, per person, every school | **Yes for now** | **Yes**, see Phase 2 — a simple existence check is low-risk and saves real repeated back-and-forth |
| 12 | Initial administrator setup — currently the founder personally performs setup on the school's behalf, since no self-serve admin-invite mechanism exists (flagged gap, `pilot-success-playbook.md` Stage 2) | Auth/authorization limitation, not a process choice | Once per pilot school | 20–30 min | Yes, but costly | **Yes, for this sprint's scope** | **No** — would require modifying authentication/authorization surface, explicitly out of bounds for this audit and the filter itself excludes it |
| 13 | Teacher invitations (`inviteTeacher`) | Links each teacher's already-created account to the school | Once per teacher, per school | 2 min per teacher | Yes | **Yes** | No — mechanically already a single existing function call; the manual part is knowing whom to invite |
| 14 | Academic activation verification (review the Academic Office readiness checklist) | Confirms year/term/classes/subjects/teachers are actually resolved before real use starts | Once per pilot school, before first classroom use | 5 min (reading an already-computed report, not computing it) | Yes | **Yes** | No — the computation is already automatic (`getSchoolAcademicReadiness()`); only the founder's read of it is manual, and that's appropriately light already |
| 15 | Subject readiness verification / one-click seeding | Prevents the exact silent gap Release Gate 1 found (a fresh school with zero subjects) | Once per pilot school | 1 min (a single button click, Sprint C0 fix) | Yes | **Yes** | No — already minimal; further automating would mean silently deciding subjects for a school without its input |
| 16 | First login verification (confirm the admin and at least one teacher can actually log in and see their school) | Catches an account-linking mistake before it surfaces mid-lesson | Once per pilot school | 5 min | Yes | **Yes** | No — needs a real human confirming a real login, not a system-side proxy for it |
| 17 | Teacher orientation session | First real trust-building moment; addresses fears directly (`pilot-success-playbook.md` Stage 3) | Once per pilot school | 30–45 min | Yes | **Yes** | No |
| 18 | First support session (rapid response to first classroom use) | The actual test of whether onboarding worked without the founder present (Stage 4) | Once per pilot school, first week | Variable, same-day availability expected | Yes | **Yes** | No — direct founder responsiveness is the trust-building mechanism at this scale, not a gap to route around |
| 19 | First-week follow-up / review | Deliberate checkpoint rather than waiting for a problem to surface (Stage 5) | Once per pilot school, ~day 7 | 20–30 min | Yes | **Yes** | Partial — see Phase 2 (the reminder to schedule it, not the review itself) |

## Completion Phase

| # | Task | Why it exists | When it happens | Est. time | Repeatable? | Stay manual? | Phase 2 automation candidate? |
|---|---|---|---|---|---|---|---|
| 20 | Pilot completion review meeting | Closes the loop honestly regardless of outcome (Stage 6) | Once per pilot school, end of term | 30–45 min | Yes | **Yes** | No |
| 21 | Testimonial request | Highest-trust acquisition asset, but only meaningful if genuinely earned and permissioned | Once per successful pilot | 5–10 min | Yes, but conditional on outcome | **Yes** | No — a template ask undermines the exact authenticity that makes a testimonial valuable |
| 22 | Referral request | Cheapest, highest-trust acquisition channel available | Once per successful pilot | 5 min | Yes, but conditional on outcome | **Yes** | No |
| 23 | Growth Engine activity logging (after every interaction, every stage) | The single source of truth for pipeline status and history — no duplicate tracking anywhere | After every interaction, all phases | 1–2 min per entry | Yes, very frequent | **Yes** | No — the log entry *is* the founder's judgment/evidence; automating its content would make it worthless as evidence |
| 24 | Voice of Customer logging into `sales-playbook.md` | The only mechanism turning real conversations into reusable, improving scripts/objection handling | After every stage with a "Voice of Customer update required" (all documents above) | 2–5 min per entry | Yes, very frequent | **Yes** | No — same reasoning as #23 |

---

## Automation Filter, Applied

Recommend automation only where **all four** hold: (1) will recur frequently past the first five pilots, (2) low risk, (3) does not expand the authentication/authorization surface, (4) saves meaningful founder time. Checked against every task above — **21 of 24 tasks fail at least one criterion and stay fully manual for Phase 1**, most commonly criterion 4 (the manual version is already fast, or fundamentally requires human judgment/relationship-building that automating would cheapen, not speed up) or criterion 3 (task #12, the admin-setup workaround, explicitly fails criterion 3 and must not be automated without a deliberate, separate authorization decision — consistent with this sprint's own explicit "do not modify authentication" boundary).

Three tasks pass all four and are named below as genuine Phase 2 candidates — notably, none of them are the core relationship-building tasks (contact, discovery, demo, orientation, review, testimonial/referral asks), which stay human by design, not by oversight.

---

## 1. Manual for Phase 1 (the first five pilots)

Every task in the three tables above except the three named in §2 below — 21 of 24 total. This is the checklist to actually execute against, unchanged, for schools one through five. No task on this list is manual because building the alternative wasn't considered; each is manual because the filter, applied honestly, said so — either the volume doesn't yet justify it, the risk is too high (task #12), or automating it would remove the exact personal judgment or trust-building effect that makes it work at this scale.

## 2. Candidates for Phase 2 Automation

1. **Account-prerequisite existence check** (task #11) — a simple, read-only check of whether an invited email already has an EduNexus account, surfaced to the founder before they send an invite (not an auth change — a read against existing `auth.users`, same direction as data the founder already has to ask for manually today). Passes all four: recurs for every teacher at every future school, read-only and low-risk, no authorization surface change, and removes a real repeated back-and-forth ("have you signed up yet?"). **Not built this sprint** — named as a candidate only, per this sprint's explicit "do not build new software" instruction.
2. **Demo/follow-up reminder nudges to the founder** (tasks #5, #8, #19) — a reminder *to the founder* that a scheduled demo, a due follow-up, or a first-week review is coming up, not an automated message *to the school*. The actual message the founder sends stays personal and manual; only the "don't forget to send it" prompt is a candidate. Passes all four at real future volume (recurs constantly past five schools, low risk, no auth surface, saves real founder attention/memory load) — worth noting this is close to what the Founder Dashboard's existing Must Do/At Risk sections (`docs/growth-os/pilot-acquisition-engine.md`) already do for follow-ups; the gap is only extending the same existing pattern to demos and first-week reviews specifically, not inventing a new mechanism.
3. **Nothing else.** Every other task was tested against the filter and failed at least one criterion — most on criterion 4 (already fast/light) or by being the relationship-building core this whole programme depends on, which the filter's own logic (and `pilot-success-playbook.md`'s repeated point about personal touch mattering at n=5) argues should stay manual on principle, not just by default.

---

## Success Criterion, Checked

A founder can execute Stage 1 through Stage 6 of the entire first-five-pilots programme using only the 24 tasks above, each with a stated why/when/estimated time — no task here relies on a step documented only in someone's memory. The three Phase 2 candidates are recommendations for later, not gaps in what's usable today.
